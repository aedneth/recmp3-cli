import { existsSync } from 'fs';
import pc from 'picocolors';
import { loadConfig } from '../config/load.js';
import { createProvider } from '../transcription/registry.js';
import { transcribeWithChunking } from '../transcription/chunking.js';
import { writeTranscriptFiles } from '../output/writer.js';
import { copyToClipboard } from '../output/clipboard.js';
import { ensureUploadConsent } from '../consent.js';
import { RecmpError } from '../errors.js';

export interface TranscribeOptions {
  provider?: string;
  lang?: string;
  json?: boolean;
  copy?: boolean;
  yes?: boolean;
}

export async function runTranscribe(audioFile: string, opts: TranscribeOptions = {}): Promise<void> {
  if (!existsSync(audioFile)) {
    console.error(`${pc.red('✗')} File not found: ${audioFile}`);
    process.exit(1);
  }

  await ensureUploadConsent({ yes: opts.yes });

  const config = await loadConfig();

  if (opts.provider) {
    (config.provider as { default: string }).default = opts.provider;
  }

  const provider = createProvider(config);

  process.stderr.write(pc.cyan(`  Transcribing with ${provider.name} (${config.provider.default === 'groq' ? config.provider.groq?.model ?? 'whisper-large-v3-turbo' : config.provider.openai?.model ?? 'whisper-1'})...\n`));

  try {
    const result = await transcribeWithChunking(
      provider,
      {
        audioPath: audioFile,
        language: opts.lang ?? config.transcription.defaultLanguage,
        responseFormat: 'verbose_json',
      },
      config.transcription.chunking.chunkSeconds,
    );

    if (config.output.saveTranscriptToFile) {
      const { txtPath, jsonPath } = await writeTranscriptFiles(audioFile, result);
      process.stderr.write(`${pc.green('✓')} Transcript saved: ${txtPath}\n`);
      if (opts.json) process.stderr.write(`${pc.green('✓')} JSON saved: ${jsonPath}\n`);
    }

    // stdout is for the transcript text — pipeable
    if (opts.json) {
      process.stdout.write(JSON.stringify({
        text: result.text,
        provider: result.provider,
        model: result.model,
        language: result.language,
        durationSec: result.durationSec,
        latencyMs: result.latencyMs,
        segments: result.segments,
      }, null, 2) + '\n');
    } else {
      process.stdout.write(result.text + '\n');
    }

    if (opts.copy) {
      const copied = await copyToClipboard(result.text);
      if (copied) process.stderr.write(pc.gray('  Copied to clipboard.\n'));
    }

    process.stderr.write(
      pc.gray(`  ${provider.name} · ${result.model} · ${(result.latencyMs / 1000).toFixed(1)}s\n`),
    );
  } catch (err: unknown) {
    if (err instanceof RecmpError) {
      console.error(`${pc.red('✗')} ${err.message}`);
      if (err.message.includes('not set')) {
        console.error(`  Run: recmp3 config init`);
      }
      process.exit(err.exitCode);
    }
    throw err;
  }
}
