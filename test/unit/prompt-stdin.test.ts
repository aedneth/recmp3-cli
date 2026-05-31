import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentContext } from '../../src/agent/context.js';
import { CaptureSink } from '../../src/agent/output.js';
import { runPrompt } from '../../src/commands/prompt.js';

const realStdin = process.stdin;

function mockStdin(text: string) {
  const stream = Readable.from([Buffer.from(text, 'utf-8')]);
  Object.defineProperty(process, 'stdin', { value: stream, configurable: true });
}

afterEach(() => {
  Object.defineProperty(process, 'stdin', { value: realStdin, configurable: true });
});

describe('prompt reads from stdin via "-"', () => {
  it('applies the raw template to piped text', async () => {
    mockStdin('hello from a pipe');
    const sink = new CaptureSink();
    const ctx = new AgentContext({ json: true, sink });

    await runPrompt('-', { template: 'raw' }, ctx);

    expect(sink.envelope?.ok).toBe(true);
    expect(sink.envelope).toMatchObject({
      command: 'prompt',
      data: { template: 'raw', output: 'hello from a pipe' },
    });
  });

  it('rejects an unknown template with an INPUT error', async () => {
    const ctx = new AgentContext({ json: true, sink: new CaptureSink() });
    await expect(runPrompt('transcript.txt', { template: 'nope' }, ctx)).rejects.toMatchObject({
      code: 'INPUT_ERROR',
    });
  });

  it('errors when stdin is empty', async () => {
    mockStdin('');
    const ctx = new AgentContext({ json: true, sink: new CaptureSink() });
    await expect(runPrompt('-', { template: 'raw' }, ctx)).rejects.toMatchObject({
      code: 'INPUT_ERROR',
    });
  });
});
