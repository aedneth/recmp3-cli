import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir, platform } from 'os';
import { randomBytes } from 'crypto';
import pc from 'picocolors';
import { loadConfig } from '../config/load.js';
import { getAudioFactory } from '../audio/capture.js';
import { runRecorderTUI } from '../tui/recorder.js';
import { generateRecordingName, buildOutputPath } from '../output/filenames.js';
import { copyToClipboard } from '../output/clipboard.js';
import { writeTranscriptFiles } from '../output/writer.js';
import { createProvider } from '../transcription/registry.js';
import { transcribeWithChunking } from '../transcription/chunking.js';
import { ensureUploadConsent } from '../consent.js';
import { RecmpError, UserAbortError } from '../errors.js';

export interface RecordOptions {
  name?: string;
  out?: string;
  transcribe?: boolean;
  mp3?: boolean;
  provider?: string;
  lang?: string;
  copy?: boolean;
  print?: boolean;
  yes?: boolean;
}

export async function runRecord(opts: RecordOptions = {}): Promise<void> {
  if (!process.stdout.isTTY && !process.env.RECMP3_PLAIN) {
    console.error(
      pc.red('✗') + ' recmp3 record requires an interactive terminal (TTY).\n' +
      '  To transcribe an existing file in a pipe, use: recmp3 transcribe <file>',
    );
    process.exit(1);
  }

  const config = await loadConfig();

  const outDir = opts.out ?? config.output.recordingDir!;
  await mkdir(outDir, { recursive: true });

  const ext = opts.mp3 ? 'mp3' : 'wav';
  const filename = generateRecordingName({
    name: opts.name,
    prefix: config.output.namePrefix,
    ext,
  });
  const outputPath = buildOutputPath(outDir, filename);

  // Intermediate segments go to a temp dir
  const sessionId = randomBytes(4).toString('hex');
  const tmpDir = join(tmpdir(), `recmp3-${sessionId}`);
  await mkdir(tmpDir, { recursive: true });

  const factory = await getAudioFactory();
  const capture = factory.create();

  const source = config.audio.source;

  // Start the first segment immediately
  const firstSegPath = join(tmpDir, 'segment-0001.wav');
  try {
    await capture.start({
      source,
      outputPath: firstSegPath,
      sampleRate: 16000,
      channels: 1,
      format: 'wav',
    });
  } catch (err: unknown) {
    await rm(tmpDir, { recursive: true, force: true });
    if (err instanceof RecmpError) throw err;
    throw new RecmpError('AUDIO_START_FAILED', `Failed to start recording: ${err instanceof Error ? err.message : String(err)}`);
  }

  let result;
  try {
    result = await runRecorderTUI(
      capture,
      { source, sampleRate: 16000, channels: 1, format: 'wav', tmpDir },
      outputPath,
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  if (result.cancelled || !result.outputPath) {
    process.stdout.write(pc.gray('  Recording cancelled.\n'));
    return;
  }

  // Print saved path
  process.stdout.write(`\n${pc.green('✓')} Saved: ${result.outputPath}\n`);

  // Transcribe if requested
  if (opts.transcribe) {
    if (opts.yes !== false) {
      await ensureUploadConsent({ yes: opts.yes });
    }

    process.stdout.write(pc.cyan('  Transcribing...') + '\n');

    try {
      const providerConfig = { ...config };
      if (opts.provider) {
        (providerConfig.provider as { default: string }).default = opts.provider;
      }

      const provider = createProvider(providerConfig);
      const transcription = await transcribeWithChunking(provider, {
        audioPath: result.outputPath,
        language: opts.lang ?? config.transcription.defaultLanguage,
        responseFormat: 'verbose_json',
      }, config.transcription.chunking.chunkSeconds);

      if (config.output.saveTranscriptToFile) {
        const { txtPath } = await writeTranscriptFiles(result.outputPath, transcription);
        process.stdout.write(`${pc.green('✓')} Transcript: ${txtPath}\n`);
      }

      const shouldPrint = opts.print !== false && config.ui.printOnTranscribe;
      const shouldCopy = opts.copy !== false && config.ui.clipboardOnTranscribe;

      if (shouldPrint) {
        process.stdout.write('\n' + transcription.text + '\n\n');
      }

      if (shouldCopy) {
        const copied = await copyToClipboard(transcription.text);
        if (copied) {
          process.stdout.write(pc.gray('  Copied to clipboard.\n'));
        }
      }

      process.stdout.write(
        pc.gray(`  Provider: ${transcription.provider} · Model: ${transcription.model} · ${(transcription.latencyMs / 1000).toFixed(1)}s\n`),
      );
    } catch (err: unknown) {
      if (err instanceof RecmpError) {
        process.stderr.write(`${pc.red('✗')} ${err.message}\n`);
        process.exit(err.exitCode);
      }
      throw err;
    }
  }
}
