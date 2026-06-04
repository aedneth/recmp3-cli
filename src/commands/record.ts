import { randomBytes } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pc from 'picocolors';
import type { AgentContext } from '../agent/context.js';
import { pickAutoSource } from '../audio/auto-source.js';
import { getAudioFactory } from '../audio/capture.js';
import type { AudioCaptureFactory } from '../audio/types.js';
import { loadConfig } from '../config/load.js';
import type { RecmpConfig } from '../config/schema.js';
import { ensureUploadConsent } from '../consent.js';
import { RecmpError } from '../errors.js';
import { copyToClipboard } from '../output/clipboard.js';
import { buildOutputPath, generateRecordingName } from '../output/filenames.js';
import { writeTranscriptFiles } from '../output/writer.js';
import { transcribeWithChunking } from '../transcription/chunking.js';
import { createProvider, providerUploads } from '../transcription/registry.js';
import { type RecorderResult, runRecorderTUI } from '../tui/recorder.js';

export interface RecordOptions {
  name?: string;
  out?: string;
  transcribe?: boolean;
  mp3?: boolean;
  provider?: string;
  lang?: string;
  source?: string;
  duration?: string;
  tui?: boolean; // commander sets false for --no-tui
  copy?: boolean;
  print?: boolean;
}

/**
 * Resolve the capture source. Precedence: --source flag → config.audio.source
 * (which env RECMP3_SOURCE may have overridden). The literal "auto" triggers
 * physical-mic auto-detection via the factory's source list.
 */
async function resolveSource(
  opts: RecordOptions,
  config: RecmpConfig,
  factory: AudioCaptureFactory
): Promise<string> {
  const requested = opts.source ?? config.audio.source;
  if (requested !== 'auto') return requested;
  const sources = await factory.listSources();
  return pickAutoSource(sources);
}

interface TranscriptionPayload {
  text: string;
  provider: string;
  model: string;
  language?: string;
  durationSec?: number;
  latencyMs: number;
  segments?: unknown;
  transcriptPath?: string;
}

export async function runRecord(
  opts: RecordOptions,
  ctx: AgentContext
): Promise<void> {
  const config = await loadConfig();

  const durationSec = opts.duration ? Number(opts.duration) : undefined;
  const headless =
    opts.tui === false ||
    durationSec !== undefined ||
    ctx.json ||
    process.stdout.isTTY !== true;

  const outDir = opts.out ?? config.output.recordingDir!;
  await mkdir(outDir, { recursive: true });

  if (headless) {
    await recordHeadless(opts, ctx, config, outDir, durationSec);
  } else {
    await recordTui(opts, ctx, config, outDir);
  }
}

/** Headless capture: no Ink TUI, records for --duration seconds or until SIGINT. */
async function recordHeadless(
  opts: RecordOptions,
  ctx: AgentContext,
  config: RecmpConfig,
  outDir: string,
  durationSec?: number
): Promise<void> {
  if (opts.mp3)
    ctx.note(pc.yellow('  --mp3 is ignored in headless mode; saving WAV.\n'));

  const filename = generateRecordingName({
    name: opts.name,
    prefix: config.output.namePrefix,
    ext: 'wav',
  });
  const outputPath = buildOutputPath(outDir, filename);

  const factory = await getAudioFactory();
  const capture = factory.create();
  const source = await resolveSource(opts, config, factory);

  try {
    await capture.start({
      source,
      outputPath,
      sampleRate: 16000,
      channels: 1,
      format: 'wav',
    });
  } catch (err: unknown) {
    if (err instanceof RecmpError) throw err;
    throw new RecmpError(
      'AUDIO_START_FAILED',
      `Failed to start recording: ${err instanceof Error ? err.message : String(err)}`,
      3
    );
  }

  ctx.note(
    pc.cyan(
      durationSec !== undefined
        ? `  Recording for ${durationSec}s...\n`
        : '  Recording... press Ctrl+C to stop.\n'
    )
  );

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      process.off('SIGINT', finish);
      if (timer) clearTimeout(timer);
      resolve();
    };
    const timer =
      durationSec !== undefined ? setTimeout(finish, durationSec * 1000) : null;
    process.on('SIGINT', finish);
  });

  const segment = await capture.stop();
  await capture.dispose().catch(() => {});

  ctx.note(`${pc.green('✓')} Saved: ${segment.path}\n`);

  const transcription = opts.transcribe
    ? await transcribeRecording(segment.path, opts, ctx, config)
    : undefined;

  ctx.ok(
    'record',
    {
      audioPath: segment.path,
      durationSec: segment.durationSec,
      sizeBytes: segment.sizeBytes,
      transcription,
    },
    () => {
      if (transcription) process.stdout.write(`${transcription.text}\n`);
    }
  );
}

/** Interactive Ink TUI path (unchanged behavior). */
async function recordTui(
  opts: RecordOptions,
  ctx: AgentContext,
  config: RecmpConfig,
  outDir: string
): Promise<void> {
  const ext = opts.mp3 ? 'mp3' : 'wav';
  const filename = generateRecordingName({
    name: opts.name,
    prefix: config.output.namePrefix,
    ext,
  });
  const outputPath = buildOutputPath(outDir, filename);

  const sessionId = randomBytes(4).toString('hex');
  const tmpDir = join(tmpdir(), `recmp3-${sessionId}`);
  await mkdir(tmpDir, { recursive: true });

  const factory = await getAudioFactory();
  const capture = factory.create();
  const source = await resolveSource(opts, config, factory);

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
    throw new RecmpError(
      'AUDIO_START_FAILED',
      `Failed to start recording: ${err instanceof Error ? err.message : String(err)}`,
      3
    );
  }

  let result: RecorderResult;
  try {
    result = await runRecorderTUI(
      capture,
      { source, sampleRate: 16000, channels: 1, format: 'wav', tmpDir },
      outputPath
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  if (result.cancelled || !result.outputPath) {
    ctx.note(pc.gray('  Recording cancelled.\n'));
    return;
  }

  process.stdout.write(`\n${pc.green('✓')} Saved: ${result.outputPath}\n`);

  if (opts.transcribe) {
    const transcription = await transcribeRecording(
      result.outputPath,
      opts,
      ctx,
      config
    );
    const shouldPrint = opts.print !== false && config.ui.printOnTranscribe;
    if (shouldPrint) process.stdout.write(`\n${transcription.text}\n\n`);
  }
}

/** Shared transcription step for both record paths. */
async function transcribeRecording(
  audioPath: string,
  opts: RecordOptions,
  ctx: AgentContext,
  config: RecmpConfig
): Promise<TranscriptionPayload> {
  const providerConfig = { ...config };
  if (opts.provider) {
    (providerConfig.provider as { default: string }).default = opts.provider;
  }

  if (providerUploads(providerConfig.provider.default)) {
    await ensureUploadConsent(ctx);
  }

  ctx.note(pc.cyan('  Transcribing...\n'));

  const provider = await createProvider(providerConfig);
  const transcription = await transcribeWithChunking(
    provider,
    {
      audioPath,
      language: opts.lang ?? config.transcription.defaultLanguage,
      responseFormat: 'verbose_json',
    },
    config.transcription.chunking.chunkSeconds
  );

  let transcriptPath: string | undefined;
  if (config.output.saveTranscriptToFile) {
    const { txtPath } = await writeTranscriptFiles(audioPath, transcription);
    transcriptPath = txtPath;
    ctx.note(`${pc.green('✓')} Transcript: ${txtPath}\n`);
  }

  const shouldCopy = opts.copy !== false && config.ui.clipboardOnTranscribe;
  if (shouldCopy) {
    const copied = await copyToClipboard(transcription.text);
    if (copied) ctx.note(pc.gray('  Copied to clipboard.\n'));
  }

  ctx.note(
    pc.gray(
      `  Provider: ${transcription.provider} · Model: ${transcription.model} · ${(transcription.latencyMs / 1000).toFixed(1)}s\n`
    )
  );

  return {
    text: transcription.text,
    provider: transcription.provider,
    model: transcription.model,
    language: transcription.language,
    durationSec: transcription.durationSec,
    latencyMs: transcription.latencyMs,
    segments: transcription.segments,
    transcriptPath,
  };
}
