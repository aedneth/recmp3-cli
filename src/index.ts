import { Command } from 'commander';
import pc from 'picocolors';
import { initLogger } from './log.js';
import { RecmpError } from './errors.js';
import { runRecord } from './commands/record.js';
import { runTranscribe } from './commands/transcribe.js';
import { runSources } from './commands/sources.js';
import { runConfigInit, runConfigShow, runConfigPath, runConfigSet } from './commands/config.js';
import { runDoctor } from './commands/doctor.js';
import { runPrompt, listTemplates } from './commands/prompt.js';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('recmp3')
  .description('Record audio, transcribe with AI, output developer-ready prompts.')
  .version(VERSION, '-v, --version')
  .option('--debug', 'Enable debug output', false)
  .option('--verbose', 'Enable verbose output', false)
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    initLogger({ debug: opts.debug, verbose: opts.verbose });
  });

// Default action: recmp3 → recmp3 record
program
  .action(async () => {
    await handleError(() => runRecord({}));
  });

// record command
const recordCmd = program
  .command('record')
  .description('Record audio from your microphone')
  .option('-n, --name <name>', 'Output filename stem (e.g. "my-idea")')
  .option('-o, --out <dir>', 'Output directory')
  .option('-t, --transcribe', 'Transcribe immediately after recording')
  .option('--mp3', 'Save as MP3 instead of WAV (post-processing)')
  .option('--provider <name>', 'Override transcription provider (groq, openai)')
  .option('--lang <code>', 'Force language code (e.g. es, en)')
  .option('--copy', 'Copy transcript to clipboard (default: on with --transcribe)')
  .option('--no-copy', 'Do not copy transcript to clipboard')
  .option('--print', 'Print transcript to stdout (default: on with --transcribe)')
  .option('--no-print', 'Do not print transcript to stdout')
  .option('-y, --yes', 'Skip upload consent prompt')
  .action(async (opts) => {
    await handleError(() => runRecord(opts));
  });

// transcribe command
program
  .command('transcribe <file>')
  .description('Transcribe an existing audio file')
  .option('--provider <name>', 'Override provider (groq, openai)')
  .option('--lang <code>', 'Force language code')
  .option('--json', 'Output full JSON result')
  .option('--copy', 'Copy transcript to clipboard')
  .option('-y, --yes', 'Skip upload consent prompt')
  .action(async (file, opts) => {
    await handleError(() => runTranscribe(file, opts));
  });

// sources command
program
  .command('sources')
  .description('List available audio input sources for your OS')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    await handleError(() => runSources(opts));
  });

// config commands
const configCmd = program
  .command('config')
  .description('Manage recmp3 configuration');

configCmd
  .command('init')
  .description('Interactive first-time setup')
  .action(async () => {
    await handleError(() => runConfigInit());
  });

configCmd
  .command('show')
  .description('Show resolved configuration (API keys redacted)')
  .action(async () => {
    await handleError(() => runConfigShow());
  });

configCmd
  .command('path')
  .description('Print path to config file')
  .action(async () => {
    await handleError(() => runConfigPath());
  });

configCmd
  .command('set <key> <value>')
  .description('Set a config value (e.g. provider.default groq)')
  .action(async (key, value) => {
    await handleError(() => runConfigSet(key, value));
  });

// doctor command
program
  .command('doctor')
  .description('Run preflight checks to verify your setup')
  .action(async () => {
    await handleError(() => runDoctor());
  });

// prompt command
program
  .command('prompt <file>')
  .description('Wrap a transcript file in a prompt template')
  .option('-t, --template <name>', 'Template name (claude-code, prd, bug, todo, meeting-notes, commit-message, raw)', 'claude-code')
  .option('--copy', 'Copy output to clipboard')
  .option('--out <file>', 'Write output to a file')
  .option('--list-templates', 'List available templates')
  .action(async (file, opts) => {
    if (opts.listTemplates) { listTemplates(); return; }
    await handleError(() => runPrompt(file, opts));
  });

// Global error handler
async function handleError(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err: unknown) {
    if (err instanceof RecmpError) {
      console.error(`\n${pc.red('✗')} ${err.message}\n`);
      if (process.env.RECMP3_DEBUG) console.error(err.stack);
      process.exit(err.exitCode);
    }
    if (err instanceof Error) {
      console.error(`\n${pc.red('✗')} Unexpected error: ${err.message}\n`);
      if (process.env.RECMP3_DEBUG) console.error(err.stack);
    } else {
      console.error(`\n${pc.red('✗')} Unknown error\n`);
    }
    process.exit(1);
  }
}

program.parseAsync(process.argv).catch((err) => {
  console.error(`${pc.red('✗')} ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
