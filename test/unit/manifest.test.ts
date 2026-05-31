import { describe, expect, it } from 'vitest';
import { ExitCode } from '../../src/errors.js';
import { MANIFEST, agentTools } from '../../src/agent/manifest.js';

describe('command manifest', () => {
  it('declares the agent-native global flags', () => {
    const names = MANIFEST.globalFlags.map((f) => f.name);
    expect(names).toContain('--json');
    expect(names).toContain('--yes');
    expect(names).toContain('--quiet');
  });

  it('exposes the stable exit-code contract', () => {
    expect(MANIFEST.exitCodes.success).toBe(ExitCode.SUCCESS);
    expect(MANIFEST.exitCodes.transcription).toBe(ExitCode.TRANSCRIPTION);
    expect(MANIFEST.exitCodes.localWhisper).toBe(ExitCode.LOCAL_WHISPER);
    expect(MANIFEST.exitCodes.input).toBe(ExitCode.INPUT);
  });

  it('gives every agent-safe command a unique snake_case tool name and flags array', () => {
    const tools = agentTools();
    expect(tools.length).toBeGreaterThan(0);
    const toolNames = new Set<string>();
    for (const cmd of tools) {
      expect(cmd.tool).toMatch(/^recmp3_[a-z_]+$/);
      expect(toolNames.has(cmd.tool!)).toBe(false);
      toolNames.add(cmd.tool!);
      expect(Array.isArray(cmd.flags)).toBe(true);
    }
  });

  it('does not expose interactive commands (mcp, config init) as agent tools', () => {
    const toolNames = agentTools().map((c) => c.name);
    expect(toolNames).not.toContain('mcp');
    expect(toolNames).not.toContain('config init');
  });
});
