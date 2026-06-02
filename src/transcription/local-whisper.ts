import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { LocalWhisperError } from '../errors.js';
import { log } from '../log.js';
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from './types.js';
import { findWhisperBin, findWhisperModel } from './whisper-bin.js';

const execFileAsync = promisify(execFile);

interface LocalConfig {
  binPath?: string;
  modelPath?: string;
  language?: string;
}

interface WhisperJsonSegment {
  offsets?: { from?: number; to?: number };
  text?: string;
}

interface WhisperJson {
  result?: { language?: string };
  transcription?: WhisperJsonSegment[];
}

/**
 * Local, no-upload transcription via a whisper.cpp binary. Audio never leaves the
 * machine, so no upload consent is required. Expects 16 kHz mono WAV (what `recmp3
 * record` produces); other inputs may need pre-conversion via ffmpeg.
 */
export class LocalWhisperProvider implements TranscriptionProvider {
  readonly name = 'local-whisper' as const;
  readonly maxFileSizeBytes = Number.POSITIVE_INFINITY;
  readonly supportedFormats = ['wav', 'mp3', 'flac', 'ogg'] as const;

  constructor(private config: LocalConfig = {}) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const { audioPath, language, signal } = input;
    const t0 = Date.now();

    const bin = await findWhisperBin(this.config.binPath);
    const model = findWhisperModel(this.config.modelPath);
    const lang = language ?? this.config.language;

    log.info(`Transcribing locally with whisper.cpp: ${basename(audioPath)}`);

    const workDir = await mkdtemp(join(tmpdir(), 'recmp3-whisper-'));
    const outPrefix = join(workDir, 'out');
    const args = ['-m', model, '-f', audioPath, '-oj', '-of', outPrefix];
    if (lang) args.push('-l', lang);

    try {
      await execFileAsync(bin, args, { signal, maxBuffer: 64 * 1024 * 1024 });
    } catch (err: unknown) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
      throw new LocalWhisperError(
        `whisper.cpp failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const jsonPath = `${outPrefix}.json`;
    if (!existsSync(jsonPath)) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
      throw new LocalWhisperError('whisper.cpp produced no JSON output.');
    }

    let parsed: WhisperJson;
    try {
      parsed = JSON.parse(await readFile(jsonPath, 'utf-8')) as WhisperJson;
    } catch (err: unknown) {
      throw new LocalWhisperError(
        `Failed to parse whisper.cpp output: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }

    const segments = (parsed.transcription ?? []).map((s) => ({
      startSec: (s.offsets?.from ?? 0) / 1000,
      endSec: (s.offsets?.to ?? 0) / 1000,
      text: (s.text ?? '').trim(),
    }));
    const text = segments
      .map((s) => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const latencyMs = Date.now() - t0;

    return {
      text,
      language: parsed.result?.language ?? lang,
      durationSec: segments.length
        ? segments[segments.length - 1].endSec
        : undefined,
      segments,
      raw: parsed,
      provider: 'local-whisper',
      model: basename(model),
      latencyMs,
    };
  }

  async ping(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const t0 = Date.now();
    try {
      await findWhisperBin(this.config.binPath);
      findWhisperModel(this.config.modelPath);
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
