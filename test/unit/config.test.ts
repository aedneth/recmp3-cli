import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, resetConfigCache } from '../../src/config/load.js';

describe('config env overrides', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    resetConfigCache();
  });

  afterEach(() => {
    process.env = original;
    resetConfigCache();
  });

  it('RECMP3_PROVIDER overrides default provider', async () => {
    process.env.RECMP3_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test-key';
    const cfg = await loadConfig();
    expect(cfg.provider.default).toBe('openai');
  });

  it('RECMP3_MODEL overrides groq model when provider is groq', async () => {
    process.env.RECMP3_PROVIDER = 'groq';
    process.env.RECMP3_MODEL = 'whisper-1';
    process.env.GROQ_API_KEY = 'gsk_test';
    const cfg = await loadConfig();
    expect(cfg.provider.groq?.model).toBe('whisper-1');
  });

  it('RECMP3_MODEL overrides openai model when provider is openai', async () => {
    process.env.RECMP3_PROVIDER = 'openai';
    process.env.RECMP3_MODEL = 'whisper-1';
    process.env.OPENAI_API_KEY = 'sk-test';
    const cfg = await loadConfig();
    expect(cfg.provider.openai?.model).toBe('whisper-1');
  });

  it('RECMP3_SOURCE sets audio source', async () => {
    process.env.RECMP3_SOURCE = 'alsa_input.test-device';
    process.env.GROQ_API_KEY = 'gsk_test';
    const cfg = await loadConfig();
    expect(cfg.audio.source).toBe('alsa_input.test-device');
  });

  it('loads defaults when no env vars set', async () => {
    // Remove all recmp3 vars
    delete process.env.RECMP3_PROVIDER;
    delete process.env.RECMP3_MODEL;
    delete process.env.RECMP3_SOURCE;
    const cfg = await loadConfig();
    expect(cfg.provider.default).toBe('groq');
    expect(cfg.audio.source).toBe('default');
  });
});
