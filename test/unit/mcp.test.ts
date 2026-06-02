import { describe, expect, it } from 'vitest';
import { AgentContext } from '../../src/agent/context.js';
import { CaptureSink } from '../../src/agent/output.js';
import { agentTools } from '../../src/agent/manifest.js';
import { runManifest } from '../../src/commands/manifest.js';

describe('MCP tool derivation', () => {
  it('derives at least the core agent tools from the manifest', () => {
    const names = agentTools().map((c) => c.tool);
    expect(names).toContain('recmp3_transcribe');
    expect(names).toContain('recmp3_sources');
    expect(names).toContain('recmp3_manifest');
  });

  it('a capture-mode command yields a forwardable envelope (the MCP call shape)', async () => {
    const sink = new CaptureSink();
    const ctx = new AgentContext({ json: true, yes: true, quiet: true, sink });

    await runManifest(ctx);

    expect(sink.envelope?.ok).toBe(true);
    const data = (sink.envelope as { data: { name: string } }).data;
    expect(data.name).toBe('recmp3');
    // The MCP server JSON-stringifies this envelope as tool result content.
    expect(() => JSON.stringify(sink.envelope)).not.toThrow();
  });
});
