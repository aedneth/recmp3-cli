import { describe, expect, it } from 'vitest';
import {
  AudioCaptureError,
  ConfigError,
  ExitCode,
  FfmpegNotFoundError,
  InputError,
  LocalWhisperError,
  NetworkError,
  RecmpError,
  TranscriptionError,
  UserAbortError,
} from '../../src/errors.js';

describe('error → exit-code contract', () => {
  // These exit codes are part of the public CLI API (scripted by agents). If this
  // table changes, it is a breaking change and must be intentional.
  const cases: Array<[RecmpError, string, number]> = [
    [new ConfigError('x'), 'CONFIG_ERROR', ExitCode.CONFIG],
    [new AudioCaptureError('x'), 'AUDIO_CAPTURE_ERROR', ExitCode.AUDIO],
    [
      new TranscriptionError('x'),
      'TRANSCRIPTION_ERROR',
      ExitCode.TRANSCRIPTION,
    ],
    [new NetworkError('x'), 'NETWORK_ERROR', ExitCode.NETWORK],
    [new LocalWhisperError('x'), 'LOCAL_WHISPER_ERROR', ExitCode.LOCAL_WHISPER],
    [new InputError('x'), 'INPUT_ERROR', ExitCode.INPUT],
    [new FfmpegNotFoundError(), 'FFMPEG_NOT_FOUND', ExitCode.AUDIO],
    [new UserAbortError(), 'USER_ABORT', ExitCode.USER_ABORT],
  ];

  it.each(cases)('%o carries code %s and exit code %i', (err, code, exit) => {
    expect(err).toBeInstanceOf(RecmpError);
    expect(err.code).toBe(code);
    expect(err.exitCode).toBe(exit);
  });

  it('defaults a bare RecmpError to the UNKNOWN exit code', () => {
    expect(new RecmpError('SOMETHING', 'msg').exitCode).toBe(ExitCode.UNKNOWN);
  });

  it('preserves the HTTP status on TranscriptionError', () => {
    expect(new TranscriptionError('rate limited', 429).statusCode).toBe(429);
  });
});
