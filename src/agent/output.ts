import pc from 'picocolors';
import { ExitCode, RecmpError } from '../errors.js';

/** Bumped only on breaking changes to the envelope contract. */
export const SCHEMA_VERSION = 1;

export interface SuccessEnvelope {
  ok: true;
  command: string;
  schemaVersion: number;
  data: unknown;
}

export interface ErrorEnvelope {
  ok: false;
  command: string;
  schemaVersion: number;
  error: {
    code: string;
    message: string;
    exitCode: number;
    details?: unknown;
  };
}

export type Envelope = SuccessEnvelope | ErrorEnvelope;

/**
 * An OutputSink decides how a command's result is rendered:
 * - HumanSink  → colored, human-readable text (stdout for results, stderr for chatter)
 * - JsonSink   → a single stable JSON envelope on stdout
 * - CaptureSink → an in-memory payload (used by the MCP server)
 *
 * Commands call `ok(command, payload, humanRender?)` exactly once on success, and the
 * CLI layer calls `fail(error, command)` for failures. This keeps the same command
 * logic usable by humans, scripting agents, and MCP tools.
 */
export interface OutputSink {
  ok(command: string, payload: unknown, humanRender?: () => void): void;
  fail(error: ErrorEnvelope['error'], command: string): void;
}

/** Human sink: payload-as-JSON is irrelevant; the optional humanRender does the work. */
export class HumanSink implements OutputSink {
  ok(_command: string, _payload: unknown, humanRender?: () => void): void {
    if (humanRender) humanRender();
  }

  fail(error: ErrorEnvelope['error'], _command: string): void {
    process.stderr.write(`\n${pc.red('✗')} ${error.message}\n\n`);
  }
}

/** JSON sink: one envelope per invocation, written to stdout. */
export class JsonSink implements OutputSink {
  ok(command: string, payload: unknown): void {
    const envelope: SuccessEnvelope = {
      ok: true,
      command,
      schemaVersion: SCHEMA_VERSION,
      data: payload,
    };
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  }

  fail(error: ErrorEnvelope['error'], command: string): void {
    const envelope: ErrorEnvelope = {
      ok: false,
      command,
      schemaVersion: SCHEMA_VERSION,
      error,
    };
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  }
}

/** Capture sink: keeps the last envelope in memory for the MCP server to forward. */
export class CaptureSink implements OutputSink {
  envelope: Envelope | null = null;

  ok(command: string, payload: unknown): void {
    this.envelope = {
      ok: true,
      command,
      schemaVersion: SCHEMA_VERSION,
      data: payload,
    };
  }

  fail(error: ErrorEnvelope['error'], command: string): void {
    this.envelope = {
      ok: false,
      command,
      schemaVersion: SCHEMA_VERSION,
      error,
    };
  }
}

/** Normalize any thrown value into the envelope error shape. */
export function toErrorPayload(err: unknown): ErrorEnvelope['error'] {
  if (err instanceof RecmpError) {
    return { code: err.code, message: err.message, exitCode: err.exitCode };
  }
  if (err instanceof Error) {
    return {
      code: 'UNEXPECTED_ERROR',
      message: err.message,
      exitCode: ExitCode.UNKNOWN,
    };
  }
  return {
    code: 'UNKNOWN_ERROR',
    message: String(err),
    exitCode: ExitCode.UNKNOWN,
  };
}
