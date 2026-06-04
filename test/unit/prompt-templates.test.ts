import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentContext } from '../../src/agent/context.js';
import { CaptureSink } from '../../src/agent/output.js';
import { runPrompt } from '../../src/commands/prompt.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'recmp3-prompt-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function transcript(text: string, stem = 'idea'): Promise<string> {
  const p = join(dir, `${stem}.txt`);
  await writeFile(p, text, 'utf-8');
  return p;
}

function run(file: string, template: string) {
  const sink = new CaptureSink();
  const ctx = new AgentContext({ json: true, sink });
  return runPrompt(file, { template }, ctx).then(() => sink);
}

describe('prompt templates from a file', () => {
  it('reads the transcript file and embeds the filename stem as the title', async () => {
    const file = await transcript('build a login screen', 'feature-x');
    const sink = await run(file, 'claude-code');
    const data = sink.envelope?.data as { output: string; template: string };
    expect(data.template).toBe('claude-code');
    expect(data.output).toContain('# Claude Code Prompt — feature-x');
    expect(data.output).toContain('build a login screen');
  });

  it('errors with INPUT_ERROR when the file does not exist', async () => {
    const ctx = new AgentContext({ json: true, sink: new CaptureSink() });
    await expect(
      runPrompt(join(dir, 'missing.txt'), { template: 'raw' }, ctx)
    ).rejects.toMatchObject({ code: 'INPUT_ERROR' });
  });

  it.each([
    ['prd', '# Product Requirements Document'],
    ['bug', '# Bug Report'],
    ['meeting-notes', '# Meeting Notes'],
  ])('renders the %s template heading', async (template, heading) => {
    const file = await transcript('some captured thought');
    const sink = await run(file, template);
    const data = sink.envelope?.data as { output: string };
    expect(data.output).toContain(heading);
    expect(data.output).toContain('some captured thought');
  });

  it('todo template splits sentences into checkbox items', async () => {
    const file = await transcript(
      'call the dentist. finish the report. buy groceries.'
    );
    const sink = await run(file, 'todo');
    const out = (sink.envelope?.data as { output: string }).output;
    expect(out).toContain('# TODO List');
    expect(out).toContain('- [ ] call the dentist');
    expect(out).toContain('- [ ] finish the report');
    expect(out).toContain('- [ ] buy groceries');
  });

  it('commit-message template lowercases, strips leading "I ", and truncates the subject', async () => {
    const file = await transcript(
      'I Added retry logic to the uploader so flaky networks recover'
    );
    const sink = await run(file, 'commit-message');
    const out = (sink.envelope?.data as { output: string }).output;
    const subject = out.split('\n')[0];
    expect(subject.startsWith('added retry logic')).toBe(true);
    expect(subject.length).toBeLessThanOrEqual(72);
  });

  it('writes output to --out when requested', async () => {
    const file = await transcript('persist me');
    const outPath = join(dir, 'result.md');
    const ctx = new AgentContext({ json: true, sink: new CaptureSink() });
    await runPrompt(file, { template: 'raw', out: outPath }, ctx);
    expect(await readFile(outPath, 'utf-8')).toBe('persist me');
  });
});
