import { type ChildProcess, spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { AudioCaptureError } from '../errors.js';
import { findFfmpeg } from './ffmpeg.js';
import type {
  AudioCapture,
  AudioCaptureFactory,
  AudioSource,
  CaptureOptions,
  CaptureSegment,
} from './types.js';

const execFileAsync = promisify(execFile);

export class LinuxPulseCapture implements AudioCapture {
  private process: ChildProcess | null = null;
  private startedAt: Date | null = null;
  private outputPath: string | null = null;
  private recording = false;

  async start(opts: CaptureOptions): Promise<void> {
    const ffmpeg = await findFfmpeg();
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'pulse',
      '-i',
      opts.source,
      '-ac',
      String(opts.channels),
      '-ar',
      String(opts.sampleRate),
      '-c:a',
      'pcm_s16le',
      '-y',
      opts.outputPath,
    ];

    this.outputPath = opts.outputPath;
    this.startedAt = new Date();

    const proc = spawn(ffmpeg, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    this.process = proc;
    this.recording = true;

    // Wait for ffmpeg to actually start capturing (500ms grace period)
    // or reject immediately if it fails to start
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => resolve(), 500);

      proc.on('error', (err) => {
        clearTimeout(timer);
        this.recording = false;
        reject(new AudioCaptureError(`Failed to start ffmpeg: ${err.message}`));
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        this.recording = false;
        if (code !== 0 && code !== null) {
          // ffmpeg exited before we stopped it — error
        }
      });

      // Check if it fails on stderr quickly
      let stderrBuf = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString();
      });

      setTimeout(() => {
        if (!proc.pid) {
          clearTimeout(timer);
          reject(
            new AudioCaptureError(
              `ffmpeg failed to start. Check audio source: "${opts.source}"`
            )
          );
        }
      }, 200);
    });

    if (!proc.pid) {
      throw new AudioCaptureError(
        `ffmpeg failed to start. Run 'recmp3 sources' to list available audio sources.`
      );
    }
  }

  async stop(): Promise<CaptureSegment> {
    if (!this.process || !this.recording) {
      throw new AudioCaptureError('Not currently recording.');
    }

    const proc = this.process;
    const startedAt = this.startedAt ?? new Date();
    const outputPath = this.outputPath!;
    const endedAt = new Date();

    this.recording = false;
    this.process = null;
    this.startedAt = null;
    this.outputPath = null;

    await new Promise<void>((resolve, reject) => {
      proc.on('close', () => resolve());
      proc.on('error', reject);

      // Send 'q' to ffmpeg stdin for graceful shutdown
      try {
        proc.stdin?.write('q');
        proc.stdin?.end();
      } catch {
        proc.kill('SIGTERM');
      }

      // Force kill if it doesn't stop in 5s
      const forceKill = setTimeout(() => {
        proc.kill('SIGTERM');
      }, 5000);

      proc.on('close', () => clearTimeout(forceKill));
    });

    const fileStat = await stat(outputPath).catch(() => ({ size: 0 }));
    const durationSec = (endedAt.getTime() - startedAt.getTime()) / 1000;

    return {
      path: outputPath,
      durationSec,
      sizeBytes: fileStat.size,
      startedAt,
      endedAt,
    };
  }

  isRecording(): boolean {
    return this.recording;
  }

  async dispose(): Promise<void> {
    if (this.process) {
      try {
        this.process.stdin?.end();
        this.process.kill('SIGTERM');
      } catch {
        // Ignore cleanup errors
      }
      this.process = null;
    }
    this.recording = false;
  }
}

export class LinuxPulseCaptureFactory implements AudioCaptureFactory {
  create(): AudioCapture {
    return new LinuxPulseCapture();
  }

  async listSources(): Promise<AudioSource[]> {
    try {
      const { stdout } = await execFileAsync('pactl', [
        'list',
        'sources',
        'short',
      ]);
      const sources: AudioSource[] = [];

      for (const line of stdout.trim().split('\n')) {
        const parts = line.split('\t');
        if (parts.length < 2) continue;
        const id = parts[1];
        if (!id) continue;
        // Filter out monitor sources (system audio) unless nothing else available
        const isMonitor = id.includes('.monitor');
        sources.push({
          id,
          label: isMonitor ? `${id} (system audio monitor)` : id,
          isDefault: id === 'default' || false,
        });
      }

      // Add 'default' as the first option
      const hasDefault = sources.some((s) => s.id === 'default');
      if (!hasDefault) {
        sources.unshift({
          id: 'default',
          label: 'default (system default)',
          isDefault: true,
        });
      }

      return sources;
    } catch {
      // pactl not available — fall back to ffmpeg pulse enumeration
      try {
        const ffmpeg = await findFfmpeg();
        const { stderr } = await execFileAsync(ffmpeg, [
          '-sources',
          'pulse',
          '-hide_banner',
        ]);
        const sources: AudioSource[] = [
          { id: 'default', label: 'default (system default)', isDefault: true },
        ];

        for (const line of stderr.split('\n')) {
          const match = line.match(/^\s+(\S+)\s/);
          if (match)
            sources.push({ id: match[1], label: match[1], isDefault: false });
        }

        return sources;
      } catch {
        return [
          { id: 'default', label: 'default (system default)', isDefault: true },
        ];
      }
    }
  }

  defaultSource(): string {
    return process.env.RECMP3_SOURCE ?? 'default';
  }
}
