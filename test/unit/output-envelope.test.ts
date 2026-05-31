import { describe, expect, it } from 'vitest';
import { AgentContext } from '../../src/agent/context.js';
import { CaptureSink, SCHEMA_VERSION, toErrorPayload } from '../../src/agent/output.js';
import { ConfigError, ExitCode, InputError, LocalWhisperError } from '../../src/errors.js';

describe('JSON envelope', () => {
  it('wraps a successful payload with ok=true and the schema version', () => {
    const sink = new CaptureSink();
    const ctx = new AgentContext({ json: true, sink });
    ctx.ok('demo', { hello: 'world' });

    expect(sink.envelope).toEqual({
      ok: true,
      command: 'demo',
      schemaVersion: SCHEMA_VERSION,
      data: { hello: 'world' },
    });
  });

  it('wraps an error with ok=false and the error contract', () => {
    const sink = new CaptureSink();
    const ctx = new AgentContext({ json: true, sink });
    ctx.fail(new InputError('bad input'), 'demo');

    expect(sink.envelope).toMatchObject({
      ok: false,
      command: 'demo',
      error: { code: 'INPUT_ERROR', message: 'bad input', exitCode: ExitCode.INPUT },
    });
  });

  it('does not run the human renderer in json mode', () => {
    const sink = new CaptureSink();
    const ctx = new AgentContext({ json: true, sink });
    let ran = false;
    ctx.ok('demo', {}, () => {
      ran = true;
    });
    expect(ran).toBe(false);
  });

  it('runs the human renderer in human mode', () => {
    const ctx = new AgentContext({ json: false });
    let ran = false;
    ctx.ok('demo', {}, () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});

describe('toErrorPayload exit-code mapping', () => {
  it('maps typed errors to their stable exit codes', () => {
    expect(toErrorPayload(new ConfigError('x')).exitCode).toBe(ExitCode.CONFIG);
    expect(toErrorPayload(new LocalWhisperError('x')).exitCode).toBe(ExitCode.LOCAL_WHISPER);
    expect(toErrorPayload(new InputError('x')).exitCode).toBe(ExitCode.INPUT);
  });

  it('maps unexpected errors to UNKNOWN', () => {
    expect(toErrorPayload(new Error('boom')).exitCode).toBe(ExitCode.UNKNOWN);
    expect(toErrorPayload('weird').exitCode).toBe(ExitCode.UNKNOWN);
  });
});
