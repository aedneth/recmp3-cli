export class RecmpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly exitCode: number = 1,
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
  constructor(message: string, public readonly statusCode?: number) {
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
      3,
    );
    this.name = 'FfmpegNotFoundError';
  }
}
