import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pc from 'picocolors';
import type { AgentContext } from '../agent/context.js';
import { readStdinBuffer } from '../agent/stdin.js';
import { loadConfig } from '../config/load.js';
import { ensureUploadConsent } from '../consent.js';
import { InputError } from '../errors.js';
import { copyToClipboard } from '../output/clipboard.js';
import { writeTranscriptFiles } from '../output/writer.js';
import { transcribeWithChunking } from '../transcription/chunking.js';
import { createProvider, providerUploads } from '../transcription/registry.js';

export interface TranscribeOptions {
  provider?: string;
  lang?: string;
  copy?: boolean;
}

export async function runTranscribe(
  audioFile: string,
  opts: TranscribeOptions,
  ctx: AgentContext
): Promise<void> {
  // Resolve the input path; "-" streams audio from stdin into a temp file.
  let path = audioFile;
  let tmpFromStdin: string | null = null;
  if (audioFile === '-') {
    const buf = await readStdinBuffer();
    if (buf.length === 0) throw new InputError('No audio received on stdin.');
    const dir = await mkdtemp(join(tmpdir(), 'recmp3-stdin-'));
    tmpFromStdin = join(dir, 'input.wav');
    await writeFile(tmpFromStdin, buf);
    path = tmpFromStdin;
  } else if (!existsSync(audioFile)) {
    throw new InputError(`File not found: ${audioFile}`);
  }

  try {
    const config = await loadConfig();
    if (opts.provider) {
      (config.provider as { default: string }).default = opts.provider;
    }

    if (providerUploads(config.provider.default)) {
      await ensureUploadConsent(ctx);
    }

    const provider = await createProvider(config);

    ctx.note(pc.cyan(`  Transcribing with ${provider.name}...\n`));

    const result = await transcribeWithChunking(
      provider,
      {
        audioPath: path,
        language: opts.lang ?? config.transcription.defaultLanguage,
        responseFormat: 'verbose_json',
      },
      config.transcription.chunking.chunkSeconds
    );

    let transcriptPath: string | undefined;
    // Persist transcript only for real on-disk inputs (not piped stdin).
    if (config.output.saveTranscriptToFile && !tmpFromStdin) {
      const { txtPath } = await writeTranscriptFiles(audioFile, result);
      transcriptPath = txtPath;
      ctx.note(`${pc.green('✓')} Transcript saved: ${txtPath}\n`);
    }

    if (opts.copy) {
      const copied = await copyToClipboard(result.text);
      if (copied) ctx.note(pc.gray('  Copied to clipboard.\n'));
    }

    ctx.note(
      pc.gray(
        `  ${provider.name} · ${result.model} · ${(result.latencyMs / 1000).toFixed(1)}s\n`
      )
    );

    ctx.ok(
      'transcribe',
      {
        text: result.text,
        provider: result.provider,
        model: result.model,
        language: result.language,
        durationSec: result.durationSec,
        latencyMs: result.latencyMs,
        segments: result.segments,
        transcriptPath,
      },
      // Human mode: transcript text on stdout (pipeable), nothing else.
      () => process.stdout.write(`${result.text}\n`)
    );
  } finally {
    if (tmpFromStdin) {
      await rm(join(tmpFromStdin, '..'), {
        recursive: true,
        force: true,
      }).catch(() => {});
    }
  }
}
