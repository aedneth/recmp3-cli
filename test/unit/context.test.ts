import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentContext } from '../../src/agent/context.js';
import { CaptureSink, JsonSink } from '../../src/agent/output.js';

const ENV_KEYS = [
  'RECMP3_JSON',
  'RECMP3_YES',
  'RECMP3_SKIP_CONSENT',
  'RECMP3_QUIET',
  'NO_COLOR',
];

describe('AgentContext.fromGlobals', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('honors --json flag and selects a JsonSink', () => {
    const ctx = AgentContext.fromGlobals({ json: true });
    expect(ctx.json).toBe(true);
    expect(ctx.sink).toBeInstanceOf(JsonSink);
  });

  it('enables json mode via RECMP3_JSON=1 even without the flag', () => {
    process.env.RECMP3_JSON = '1';
    expect(AgentContext.fromGlobals({}).json).toBe(true);
  });

  it('treats RECMP3_SKIP_CONSENT=1 as --yes', () => {
    process.env.RECMP3_SKIP_CONSENT = '1';
    expect(AgentContext.fromGlobals({}).yes).toBe(true);
  });

  it('disables color when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1';
    expect(AgentContext.fromGlobals({}).color).toBe(false);
  });

  it('disables color when commander reports --no-color (color === false)', () => {
    expect(AgentContext.fromGlobals({ color: false }).color).toBe(false);
  });
});

describe('AgentContext.forCapture', () => {
  it('captures JSON, auto-skips prompts, and stays quiet', () => {
    const ctx = AgentContext.forCapture();
    expect(ctx.json).toBe(true);
    expect(ctx.yes).toBe(true);
    expect(ctx.quiet).toBe(true);
    expect(ctx.sink).toBeInstanceOf(CaptureSink);
  });
});

describe('AgentContext.note', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes chatter to stderr in normal mode', () => {
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    new AgentContext({ quiet: false }).note('working...\n');
    expect(spy).toHaveBeenCalledWith('working...\n');
  });

  it('suppresses chatter when quiet', () => {
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    new AgentContext({ quiet: true }).note('should not appear\n');
    expect(spy).not.toHaveBeenCalled();
  });
});
