import { Command } from 'commander';
import pc from 'picocolors';
import { AgentContext } from './agent/context.js';
import { runMcpServer } from './agent/mcp.js';
import { toErrorPayload } from './agent/output.js';
import {
  runConfigInit,
  runConfigPath,
  runConfigSet,
  runConfigSetKey,
  runConfigShow,
} from './commands/config.js';
import { runDoctor } from './commands/doctor.js';
import { runManifest } from './commands/manifest.js';
import { listTemplates, runPrompt } from './commands/prompt.js';
import { runRecord } from './commands/record.js';
import { runSources } from './commands/sources.js';
import { runTranscribe } from './commands/transcribe.js';
import { ExitCode, RecmpError } from './errors.js';
import { initLogger } from './log.js';

const VERSION = '0.2.0';

const program = new Command();

// Active agent context for the running command. Built in the preAction hook from the
// resolved global flags (commander merges program-level options via optsWithGlobals()).
let ctx = new AgentContext();

program
  .name('recmp3')
  .description(
    'Record audio, transcribe with AI, output developer-ready prompts.'
  )
  .version(VERSION, '-v, --version')
  .option(
    '--json',
    'Emit a stable machine-readable JSON envelope on stdout',
    false
  )
  .option('-y, --yes', 'Skip all interactive prompts (consent, setup)', false)
  .option('--quiet', 'Suppress progress/diagnostic output on stderr', false)
  .option('--no-color', 'Disable colored output')
  .option('--debug', 'Enable debug output', false)
  .option('--verbose', 'Enable verbose output', false)
  .hook('preAction', (_thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    initLogger({ debug: opts.debug, verbose: opts.verbose });
    ctx = AgentContext.fromGlobals(opts);
  });

// Default action: recmp3 → recmp3 record
program.action(async () => {
  await handleError('record', () => runRecord({}, ctx));
});

// record command
program
  .command('record')
  .description('Record audio from your microphone')
  .option('-n, --name <name>', 'Output filename stem (e.g. "my-idea")')
  .option('-o, --out <dir>', 'Output directory')
  .option('-t, --transcribe', 'Transcribe immediately after recording')
  .option('--mp3', 'Save as MP3 instead of WAV (post-processing)')
  .option(
    '--provider <name>',
    'Override transcription provider (groq, openai, local-whisper)'
  )
  .option('--lang <code>', 'Force language code (e.g. es, en)')
  .option(
    '--duration <seconds>',
    'Headless: record for N seconds then stop (no TUI)'
  )
  .option(
    '--no-tui',
    'Force headless capture (record until SIGINT or --duration)'
  )
  .option(
    '--copy',
    'Copy transcript to clipboard (default: on with --transcribe)'
  )
  .option('--no-copy', 'Do not copy transcript to clipboard')
  .option(
    '--print',
    'Print transcript to stdout (default: on with --transcribe)'
  )
  .option('--no-print', 'Do not print transcript to stdout')
  .action(async (opts) => {
    await handleError('record', () => runRecord(opts, ctx));
  });

// transcribe command
program
  .command('transcribe <file>')
  .description('Transcribe an existing audio file ("-" reads audio from stdin)')
  .option(
    '--provider <name>',
    'Override provider (groq, openai, local-whisper)'
  )
  .option('--lang <code>', 'Force language code')
  .option('--copy', 'Copy transcript to clipboard')
  .action(async (file, opts) => {
    await handleError('transcribe', () => runTranscribe(file, opts, ctx));
  });

// sources command
program
  .command('sources')
  .description('List available audio input sources for your OS')
  .action(async () => {
    await handleError('sources', () => runSources(ctx));
  });

// config commands
const configCmd = program
  .command('config')
  .description('Manage recmp3 configuration');

configCmd
  .command('init')
  .description(
    'First-time setup (interactive, or flag-driven when non-interactive)'
  )
  .option('--provider <name>', 'Provider (groq, openai, local-whisper)')
  .option('--lang <code>', 'Default language code')
  .option('--outdir <dir>', 'Recordings output directory')
  .option('--key <value>', 'API key to store in the OS keychain')
  .action(async (opts) => {
    await handleError('config init', () => runConfigInit(opts, ctx));
  });

configCmd
  .command('show')
  .description('Show resolved configuration (API keys redacted)')
  .action(async () => {
    await handleError('config show', () => runConfigShow(ctx));
  });

configCmd
  .command('path')
  .description('Print path to config file')
  .action(async () => {
    await handleError('config path', () => runConfigPath(ctx));
  });

configCmd
  .command('set <key> <value>')
  .description('Set a config value (e.g. provider.default groq)')
  .action(async (key, value) => {
    await handleError('config set', () => runConfigSet(key, value, ctx));
  });

configCmd
  .command('set-key <provider>')
  .description(
    'Store an API key in the OS keychain (value from --key, stdin, or env)'
  )
  .option(
    '--key <value>',
    'API key value (otherwise read from stdin or *_API_KEY env)'
  )
  .action(async (provider, opts) => {
    await handleError('config set-key', () =>
      runConfigSetKey(provider, opts, ctx)
    );
  });

// doctor command
program
  .command('doctor')
  .description('Run preflight checks to verify your setup')
  .action(async () => {
    await handleError('doctor', () => runDoctor(ctx));
  });

// prompt command
program
  .command('prompt <file>')
  .description(
    'Wrap a transcript file in a prompt template ("-" reads from stdin)'
  )
  .option(
    '-t, --template <name>',
    'Template name (claude-code, prd, bug, todo, meeting-notes, commit-message, raw)',
    'claude-code'
  )
  .option('--copy', 'Copy output to clipboard')
  .option('--out <file>', 'Write output to a file')
  .option('--list-templates', 'List available templates')
  .action(async (file, opts) => {
    if (opts.listTemplates) {
      listTemplates();
      return;
    }
    await handleError('prompt', () => runPrompt(file, opts, ctx));
  });

// manifest command — discoverable command/tool surface
program
  .command('manifest')
  .description('Print the command/tool manifest (use --json for machine form)')
  .action(async () => {
    await handleError('manifest', () => runManifest(ctx));
  });

// mcp command — stdio MCP server
program
  .command('mcp')
  .description('Start the Model Context Protocol server over stdio')
  .action(async () => {
    await runMcpServer();
  });

// Global error handler
async function handleError(
  command: string,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
  } catch (err: unknown) {
    const payload = toErrorPayload(err);
    ctx.fail(err, command);
    if (process.env.RECMP3_DEBUG && err instanceof Error) {
      process.stderr.write(`${err.stack ?? ''}\n`);
    }
    process.exit(payload.exitCode);
  }
}

program.parseAsync(process.argv).catch((err) => {
  const payload = toErrorPayload(err);
  process.stderr.write(`${pc.red('✗')} ${payload.message}\n`);
  process.exit(err instanceof RecmpError ? err.exitCode : ExitCode.UNKNOWN);
});
