import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { type ZodRawShape, z } from 'zod';
import { runConfigShow } from '../commands/config.js';
import { runDoctor } from '../commands/doctor.js';
import { runManifest } from '../commands/manifest.js';
import { runPrompt } from '../commands/prompt.js';
import { runRecord } from '../commands/record.js';
import { runSources } from '../commands/sources.js';
import { runTranscribe } from '../commands/transcribe.js';
import { AgentContext } from './context.js';
import { MANIFEST } from './manifest.js';
import type { CaptureSink } from './output.js';

type ToolRun = (
  args: Record<string, unknown>,
  ctx: AgentContext
) => Promise<void>;

/**
 * Run a command in capture mode and return its JSON envelope as MCP text content.
 * Any thrown error becomes a captured error envelope (isError flagged for the client).
 */
async function callCommand(run: ToolRun, args: Record<string, unknown>) {
  const ctx = AgentContext.forCapture();
  const sink = ctx.sink as CaptureSink;
  try {
    await run(args, ctx);
  } catch (err: unknown) {
    ctx.fail(err, 'mcp');
  }
  const envelope = sink.envelope;
  return {
    isError: envelope?.ok === false,
    content: [
      { type: 'text' as const, text: JSON.stringify(envelope, null, 2) },
    ],
  };
}

function descriptionFor(tool: string): string {
  return MANIFEST.commands.find((c) => c.tool === tool)?.summary ?? '';
}

function register(
  server: McpServer,
  tool: string,
  inputSchema: ZodRawShape,
  run: ToolRun
) {
  server.registerTool(
    tool,
    { description: descriptionFor(tool), inputSchema },
    async (args: Record<string, unknown>) => callCommand(run, args ?? {})
  );
}

export async function runMcpServer(): Promise<void> {
  const server = new McpServer({
    name: MANIFEST.name,
    version: MANIFEST.version,
  });

  register(
    server,
    'recmp3_transcribe',
    {
      file: z
        .string()
        .describe('Audio file path (must exist on the server host)'),
      provider: z.string().optional(),
      lang: z.string().optional(),
    },
    (a, ctx) =>
      runTranscribe(
        a.file as string,
        { provider: a.provider as string, lang: a.lang as string },
        ctx
      )
  );

  register(
    server,
    'recmp3_prompt',
    {
      file: z.string().describe('Transcript file path, or "-" for stdin'),
      template: z.string().optional(),
    },
    (a, ctx) =>
      runPrompt(a.file as string, { template: a.template as string }, ctx)
  );

  register(server, 'recmp3_sources', {}, (_a, ctx) => runSources(ctx));
  register(server, 'recmp3_doctor', {}, (_a, ctx) => runDoctor(ctx));
  register(server, 'recmp3_config_show', {}, (_a, ctx) => runConfigShow(ctx));
  register(server, 'recmp3_manifest', {}, (_a, ctx) => runManifest(ctx));

  register(
    server,
    'recmp3_record',
    {
      duration: z.number().describe('Seconds to record (headless)'),
      name: z.string().optional(),
      out: z.string().optional(),
      transcribe: z.boolean().optional(),
      provider: z.string().optional(),
      lang: z.string().optional(),
    },
    (a, ctx) =>
      runRecord(
        {
          duration: String(a.duration),
          name: a.name as string,
          out: a.out as string,
          transcribe: a.transcribe as boolean,
          provider: a.provider as string,
          lang: a.lang as string,
        },
        ctx
      )
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
