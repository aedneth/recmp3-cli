/**
 * Stable POSIX-ish exit-code contract. Consumers (scripts, agents) script against
 * these — values are part of the public API and must not change. New error classes
 * may add new codes, but existing codes keep their meaning. Surfaced in the manifest
 * and README.
 */
export const ExitCode = {
  SUCCESS: 0,
  UNKNOWN: 1,
  CONFIG: 2,
  AUDIO: 3,
  TRANSCRIPTION: 4,
  NETWORK: 5,
  LOCAL_WHISPER: 6,
  INPUT: 7,
  USER_ABORT: 130,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export class RecmpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly exitCode: number = ExitCode.UNKNOWN
  ) {
    super(message);
    this.name = 'RecmpError';
  }
}

export class ConfigError extends RecmpError {
  constructor(message: string) {
    super('CONFIG_ERROR', message, 2);
    this.name = 'ConfigError';
  }
}

export class AudioCaptureError extends RecmpError {
  constructor(message: string) {
    super('AUDIO_CAPTURE_ERROR', message, 3);
    this.name = 'AudioCaptureError';
  }
}

export class TranscriptionError extends RecmpError {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super('TRANSCRIPTION_ERROR', message, 4);
    this.name = 'TranscriptionError';
  }
}

export class NetworkError extends RecmpError {
  constructor(message: string) {
    super('NETWORK_ERROR', message, 5);
    this.name = 'NetworkError';
  }
}

export class UserAbortError extends RecmpError {
  constructor() {
    super('USER_ABORT', 'Cancelled by user.', 130);
    this.name = 'UserAbortError';
  }
}

export class FfmpegNotFoundError extends RecmpError {
  constructor() {
    super(
      'FFMPEG_NOT_FOUND',
      'ffmpeg not found. Install it with: sudo apt install ffmpeg',
      ExitCode.AUDIO
    );
    this.name = 'FfmpegNotFoundError';
  }
}

export class LocalWhisperError extends RecmpError {
  constructor(message: string) {
    super('LOCAL_WHISPER_ERROR', message, ExitCode.LOCAL_WHISPER);
    this.name = 'LocalWhisperError';
  }
}

export class InputError extends RecmpError {
  constructor(message: string) {
    super('INPUT_ERROR', message, ExitCode.INPUT);
    this.name = 'InputError';
  }
}
