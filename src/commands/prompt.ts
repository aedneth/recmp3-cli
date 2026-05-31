import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import pc from 'picocolors';
import type { AgentContext } from '../agent/context.js';
import { readStdinText } from '../agent/stdin.js';
import { InputError } from '../errors.js';
import { copyToClipboard } from '../output/clipboard.js';

const TEMPLATES: Record<string, (text: string, name?: string) => string> = {
  raw: (text) => text,

  'claude-code': (
    text,
    name
  ) => `# Claude Code Prompt${name ? ` — ${name}` : ''}

## Objective
${text}

## Context
[Add relevant codebase context here]

## Scope
- In scope: [define boundaries]
- Out of scope: [define exclusions]

## Constraints
- [Technical constraints]
- [Time constraints]

## Acceptance Criteria
- [ ] [Add specific acceptance criteria]
- [ ] All existing tests pass
- [ ] No regressions introduced

## Verification
\`\`\`bash
# Add verification commands here
\`\`\`

## CKIS writeback suggestion
[Note any architectural decisions made during implementation]
`,

  prd: (
    text,
    name
  ) => `# Product Requirements Document${name ? ` — ${name}` : ''}

**Created:** ${new Date().toISOString().split('T')[0]}
**Status:** Draft

## Problem Statement
${text}

## Goals
- [Primary goal]
- [Secondary goal]

## Non-Goals
- [What this does NOT address]

## User Stories
- As a [user], I want [feature] so that [benefit]

## Requirements
### Functional
- [ ] [Requirement 1]

### Non-Functional
- [ ] [Performance requirement]
- [ ] [Security requirement]

## Success Metrics
- [Metric 1]

## Open Questions
- [Question 1]

## Timeline
- [Milestone]: [Date]
`,

  bug: (text, name) => `# Bug Report${name ? ` — ${name}` : ''}

**Date:** ${new Date().toISOString().split('T')[0]}
**Severity:** [critical / high / medium / low]

## Description
${text}

## Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- OS: ${process.platform}
- Node: ${process.version}

## Possible Fix
[Your hypothesis]

## Attachments
- [ ] Screenshots
- [ ] Logs
- [ ] Reproduction repo
`,

  'meeting-notes': (text, name) => `# Meeting Notes${name ? ` — ${name}` : ''}

**Date:** ${new Date().toISOString().split('T')[0]}

## Summary
${text}

## Action Items
- [ ] [Owner] — [Action] — [Due date]

## Decisions Made
- [Decision 1]

## Open Questions
- [Question 1]

## Next Meeting
- [ ] Schedule: [Date/Time]
`,

  todo: (text) => {
    const lines = text.split(/[.!?]+/).filter((l) => l.trim().length > 5);
    const todos = lines.map((l) => `- [ ] ${l.trim()}`).join('\n');
    return `# TODO List\n\n${todos}\n`;
  },

  'commit-message': (text) => {
    const firstSentence = text.split(/[.!?]/)[0]?.trim() ?? text;
    const subject = firstSentence.slice(0, 72).toLowerCase().replace(/^i /, '');
    const body = text.length > firstSentence.length ? `\n\n${text}` : '';
    return `${subject}${body}\n`;
  },
};

export function listTemplates(): void {
  console.log(`\n${pc.bold('Available prompt templates:')}\n`);
  for (const name of Object.keys(TEMPLATES)) {
    console.log(`  ${pc.cyan(name)}`);
  }
  console.log(
    '\n  Usage: recmp3 prompt <transcript.txt> --template claude-code\n'
  );
}

export interface PromptOptions {
  template?: string;
  copy?: boolean;
  out?: string;
  listTemplates?: boolean;
}

export async function runPrompt(
  transcriptFile: string,
  opts: PromptOptions,
  ctx: AgentContext
): Promise<void> {
  if (opts.listTemplates) {
    listTemplates();
    return;
  }

  const templateName = opts.template ?? 'claude-code';
  const templateFn = TEMPLATES[templateName];

  if (!templateFn) {
    throw new InputError(
      `Unknown template: "${templateName}". Available: ${Object.keys(TEMPLATES).join(', ')}`
    );
  }

  // "-" reads transcript text from stdin (composes with `transcribe ... | prompt -`).
  let text: string;
  let name: string | undefined;
  if (transcriptFile === '-') {
    text = (await readStdinText()).trim();
    if (!text) throw new InputError('No text received on stdin.');
  } else {
    if (!existsSync(transcriptFile)) {
      throw new InputError(`File not found: ${transcriptFile}`);
    }
    text = readFileSync(transcriptFile, 'utf-8').trim();
    name = basename(transcriptFile, '.txt');
  }

  const output = templateFn(text, name);

  if (opts.out) {
    await writeFile(opts.out, output, 'utf-8');
    ctx.note(`${pc.green('✓')} Written to: ${opts.out}\n`);
  }

  if (opts.copy) {
    const copied = await copyToClipboard(output);
    if (copied) ctx.note(pc.gray('  Copied to clipboard.\n'));
  }

  ctx.ok('prompt', { template: templateName, output }, () =>
    process.stdout.write(output)
  );
}
