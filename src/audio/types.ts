export interface CaptureOptions {
  source: string;
  outputPath: string;
  sampleRate: 16000;
  channels: 1;
  format: 'wav';
  signal?: AbortSignal;
}

export interface CaptureSegment {
  path: string;
  durationSec: number;
  sizeBytes: number;
  startedAt: Date;
  endedAt: Date;
}

export interface AudioSource {
  id: string;
  label: string;
  isDefault: boolean;
}

export interface AudioCapture {
  start(opts: CaptureOptions): Promise<void>;
  stop(): Promise<CaptureSegment>;
  isRecording(): boolean;
  dispose(): Promise<void>;
}

export interface AudioCaptureFactory {
  create(): AudioCapture;
  listSources(): Promise<AudioSource[]>;
  defaultSource(): string;
}
