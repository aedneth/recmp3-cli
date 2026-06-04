import { afterEach, describe, expect, it, vi } from 'vitest';
import { initLogger, log, redactKey } from '../../src/log.js';

describe('redactKey', () => {
  it('masks the middle, keeping a 3+4 fingerprint for recognizable keys', () => {
    expect(redactKey('gsk_abcdefgh1234')).toBe('gsk***1234');
  });

  it('never leaks short secrets — anything under 8 chars is fully masked', () => {
    expect(redactKey('short')).toBe('***');
    expect(redactKey('1234567')).toBe('***');
  });

  it('masks empty input rather than returning it', () => {
    expect(redactKey('')).toBe('***');
  });

  it('never returns the original key verbatim for a realistic secret', () => {
    const key = 'sk-proj-VERYsecretVALUE0987';
    const redacted = redactKey(key);
    expect(redacted).not.toBe(key);
    expect(redacted).not.toContain('secret');
  });
});

describe('log level gating', () => {
  afterEach(() => {
    initLogger({ debug: false, verbose: false });
    vi.restoreAllMocks();
  });

  it('suppresses debug/info when disabled but always emits warn/error', () => {
    const writes: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    initLogger({ debug: false, verbose: false });
    log.debug('hidden-debug');
    log.info('hidden-info');
    log.warn('shown-warn');
    log.error('shown-error');

    const out = writes.join('');
    expect(out).not.toContain('hidden-debug');
    expect(out).not.toContain('hidden-info');
    expect(out).toContain('shown-warn');
    expect(out).toContain('shown-error');
  });

  it('emits debug and info once debug is enabled', () => {
    const writes: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    initLogger({ debug: true });
    log.debug('visible-debug');
    log.info('visible-info');

    const out = writes.join('');
    expect(out).toContain('visible-debug');
    expect(out).toContain('visible-info');
  });
});
