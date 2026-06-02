import {
  CaptureSink,
  HumanSink,
  JsonSink,
  type OutputSink,
  toErrorPayload,
} from './output.js';

export interface AgentContextOptions {
  json?: boolean;
  yes?: boolean;
  quiet?: boolean;
  color?: boolean;
  sink?: OutputSink;
}

/**
 * Per-invocation runtime mode. Built once in `index.ts` from the resolved global
 * flags + environment, then threaded into every command so a single code path serves
 * humans, scripting agents (`--json`), and the MCP server (CaptureSink).
 */
export class AgentContext {
  readonly json: boolean;
  readonly yes: boolean;
  readonly quiet: boolean;
  readonly color: boolean;
  readonly sink: OutputSink;

  constructor(opts: AgentContextOptions = {}) {
    this.json = opts.json ?? false;
    this.yes = opts.yes ?? false;
    this.quiet = opts.quiet ?? false;
    this.color = opts.color ?? true;
    this.sink = opts.sink ?? (this.json ? new JsonSink() : new HumanSink());
  }

  /** Build the context from resolved global option values + environment. */
  static fromGlobals(opts: Record<string, unknown>): AgentContext {
    const json = Boolean(opts.json) || process.env.RECMP3_JSON === '1';
    const yes =
      Boolean(opts.yes) ||
      process.env.RECMP3_YES === '1' ||
      process.env.RECMP3_SKIP_CONSENT === '1';
    const quiet = Boolean(opts.quiet) || process.env.RECMP3_QUIET === '1';
    // commander stores --no-color as opts.color === false
    const color =
      opts.color !== false &&
      !process.env.NO_COLOR &&
      process.stdout.isTTY !== false;
    return new AgentContext({
      json,
      yes,
      quiet,
      color,
      sink: json ? new JsonSink() : new HumanSink(),
    });
  }

  /** Context for MCP tool calls: captured JSON, prompts auto-skipped, no chatter. */
  static forCapture(): AgentContext {
    return new AgentContext({
      json: true,
      yes: true,
      quiet: true,
      color: false,
      sink: new CaptureSink(),
    });
  }

  /** Emit a successful result. `humanRender` runs only in human (non-json) mode. */
  ok(command: string, payload: unknown, humanRender?: () => void): void {
    this.sink.ok(command, payload, humanRender);
  }

  /** Emit a failure envelope. Does not exit — the caller controls process exit. */
  fail(err: unknown, command: string): void {
    this.sink.fail(toErrorPayload(err), command);
  }

  /** Write progress/diagnostic chatter to stderr unless quiet. */
  note(text: string): void {
    if (!this.quiet) process.stderr.write(text);
  }
}
