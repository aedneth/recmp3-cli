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

export class WindowsDshowCapture implements AudioCapture {
  private process: ChildProcess | null = null;
  private startedAt: Date | null = null;
  private outputPath: string | null = null;
  private recording = false;

  async start(opts: CaptureOptions): Promise<void> {
    const ffmpeg = await findFfmpeg();
    const deviceName =
      opts.source === 'default' ? await this.getDefaultDevice() : opts.source;
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'dshow',
      '-i',
      `audio=${deviceName}`,
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
      const timer = setTimeout(() => resolve(), 1000);
      proc.on('error', (err) => {
        clearTimeout(timer);
        this.recording = false;
        reject(
          new AudioCaptureError(
            `Failed to start recording: ${err.message}. Run 'recmp3 sources' to list available devices.`
          )
        );
      });
    });
  }

  private async getDefaultDevice(): Promise<string> {
    const sources = await this.listSources();
    const first =
      sources.find((s) => !s.label.includes('monitor')) ?? sources[0];
    return first?.id ?? 'Microphone';
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

  async listSources(): Promise<AudioSource[]> {
    try {
      const ffmpeg = await findFfmpeg();
      const { stderr } = await execFileAsync(ffmpeg, [
        '-list_devices',
        'true',
        '-f',
        'dshow',
        '-i',
        'dummy',
      ]);
      const sources: AudioSource[] = [];
      let inAudioSection = false;

      for (const line of stderr.split('\n')) {
        if (line.includes('DirectShow audio devices')) {
          inAudioSection = true;
          continue;
        }
        if (line.includes('DirectShow video devices')) {
          inAudioSection = false;
          continue;
        }
        if (!inAudioSection) continue;
        const match = line.match(/"([^"]+)"/);
        if (match)
          sources.push({
            id: match[1],
            label: match[1],
            isDefault: sources.length === 0,
          });
      }

      return sources;
    } catch {
      return [
        { id: 'Microphone', label: 'Microphone (default)', isDefault: true },
      ];
    }
  }
}

export class WindowsDshowFactory implements AudioCaptureFactory {
  private capture = new WindowsDshowCapture();

  create(): AudioCapture {
    return new WindowsDshowCapture();
  }

  async listSources(): Promise<AudioSource[]> {
    return this.capture.listSources();
  }

  defaultSource(): string {
    return process.env.RECMP3_SOURCE ?? 'default';
  }
}
