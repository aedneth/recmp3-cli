import { type ChildProcess, execFile, spawn } from 'node:child_process';
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

export class MacAvFoundationCapture implements AudioCapture {
  private process: ChildProcess | null = null;
  private startedAt: Date | null = null;
  private outputPath: string | null = null;
  private recording = false;

  async start(opts: CaptureOptions): Promise<void> {
    const ffmpeg = await findFfmpeg();
    // On macOS, source format is ":N" (audio device index, no video)
    const source = opts.source.startsWith(':')
      ? opts.source
      : `:${opts.source}`;
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'avfoundation',
      '-i',
      source,
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

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => resolve(), 800);
      proc.on('error', (err) => {
        clearTimeout(timer);
        this.recording = false;
        reject(
          new AudioCaptureError(
            `Failed to start ffmpeg: ${err.message}. Grant microphone access in System Settings → Privacy & Security → Microphone.`
          )
        );
      });
    });
  }

  async stop(): Promise<CaptureSegment> {
    if (!this.process || !this.recording)
      throw new AudioCaptureError('Not recording.');

    const proc = this.process;
    const startedAt = this.startedAt ?? new Date();
    const outputPath = this.outputPath!;
    const endedAt = new Date();

    this.recording = false;
    this.process = null;

    await new Promise<void>((resolve) => {
      proc.on('close', resolve);
      try {
        proc.stdin?.write('q');
        proc.stdin?.end();
      } catch {
        proc.kill('SIGTERM');
      }
      setTimeout(() => proc.kill('SIGTERM'), 5000);
    });

    const fileStat = await stat(outputPath).catch(() => ({ size: 0 }));
    return {
      path: outputPath,
      durationSec: (endedAt.getTime() - startedAt.getTime()) / 1000,
      sizeBytes: fileStat.size,
      startedAt,
      endedAt,
    };
  }

  isRecording() {
    return this.recording;
  }

  async dispose(): Promise<void> {
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch {}
      this.process = null;
    }
    this.recording = false;
  }
}

export class MacAvFoundationFactory implements AudioCaptureFactory {
  create(): AudioCapture {
    return new MacAvFoundationCapture();
  }

  async listSources(): Promise<AudioSource[]> {
    try {
      const ffmpeg = await findFfmpeg();
      const { stderr } = await execFileAsync(ffmpeg, [
        '-f',
        'avfoundation',
        '-list_devices',
        'true',
        '-i',
        '',
      ]);
      const sources: AudioSource[] = [];
      let inAudioSection = false;

      for (const line of stderr.split('\n')) {
        if (line.includes('AVFoundation audio devices:')) {
          inAudioSection = true;
          continue;
        }
        if (!inAudioSection) continue;
        const match = line.match(/\[(\d+)\] (.+)/);
        if (match) {
          sources.push({
            id: match[1],
            label: match[2],
            isDefault: match[1] === '0',
          });
        }
      }

      return sources.length > 0
        ? sources
        : [{ id: '0', label: 'Default audio device', isDefault: true }];
    } catch {
      return [{ id: '0', label: 'Default audio device', isDefault: true }];
    }
  }

  defaultSource(): string {
    return process.env.RECMP3_SOURCE ?? '0';
  }
}
