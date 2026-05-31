import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalWhisperProvider } from '../../src/transcription/local-whisper.js';
import { findWhisperModel } from '../../src/transcription/whisper-bin.js';

describe('LocalWhisperProvider', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.RECMP3_WHISPER_BIN;
    delete process.env.RECMP3_WHISPER_MODEL;
  });

  afterEach(() => {
    process.env = original;
  });

  it('has no upload size limit and the local-whisper name', () => {
    const provider = new LocalWhisperProvider();
    expect(provider.name).toBe('local-whisper');
    expect(provider.maxFileSizeBytes).toBe(Number.POSITIVE_INFINITY);
  });

  it('ping reports not-ok (exit code 6 path) when no binary/model is configured', async () => {
    const provider = new LocalWhisperProvider();
    const ping = await provider.ping();
    expect(ping.ok).toBe(false);
    expect(ping.error).toBeTruthy();
  });

  it('findWhisperModel throws a LocalWhisperError when no model is set', () => {
    expect(() => findWhisperModel()).toThrowError(/model/i);
  });

  it('findWhisperModel throws when the model path does not exist', () => {
    expect(() => findWhisperModel('/no/such/model.bin')).toThrowError(/not found/i);
  });
});
