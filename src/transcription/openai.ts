import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { NetworkError, TranscriptionError } from '../errors.js';
import { log } from '../log.js';
import type {
  ProviderConfig,
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from './types.js';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SUPPORTED_FORMATS = [
  'flac',
  'm4a',
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'oga',
  'ogg',
  'wav',
  'webm',
] as const;

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase().slice(1);
  const mimes: Record<string, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
  };
  return mimes[ext] ?? 'audio/wav';
}

export class OpenAIProvider implements TranscriptionProvider {
  readonly name = 'openai' as const;
  readonly maxFileSizeBytes = MAX_FILE_SIZE;
  readonly supportedFormats = SUPPORTED_FORMATS;

  private baseUrl: string;
  private timeoutMs: number;

  constructor(private config: ProviderConfig) {
    this.baseUrl = config.baseUrl ?? OPENAI_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const {
      audioPath,
      language,
      prompt,
      responseFormat = 'verbose_json',
      signal,
    } = input;
    const t0 = Date.now();

    log.info(
      `Transcribing with OpenAI (${this.config.model}): ${basename(audioPath)}`
    );

    const audioBuffer = await readFile(audioPath);
    const form = new FormData();
    const blob = new Blob([audioBuffer], { type: getMimeType(audioPath) });
    form.append('file', blob, basename(audioPath));
    form.append('model', this.config.model);
    form.append('response_format', responseFormat);
    if (language) form.append('language', language);
    if (prompt) form.append('prompt', prompt);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        body: form,
        signal: signal ?? controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeout);
      throw new NetworkError(
        `Network error connecting to OpenAI: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new TranscriptionError(
        `OpenAI API error ${response.status}: ${body || response.statusText}`,
        response.status
      );
    }

    const raw = (await response.json()) as Record<string, unknown>;
    return {
      text: (typeof raw === 'string'
        ? raw
        : ((raw.text as string) ?? '')
      ).trim(),
      language: raw.language as string | undefined,
      durationSec: raw.duration as number | undefined,
      segments: (
        raw.segments as
          | Array<{ start: number; end: number; text: string }>
          | undefined
      )?.map((s) => ({
        startSec: s.start,
        endSec: s.end,
        text: s.text,
      })),
      raw,
      provider: 'openai',
      model: this.config.model,
      latencyMs: Date.now() - t0,
    };
  }

  async ping(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const t0 = Date.now();
    try {
      const r = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      return r.ok
        ? { ok: true, latencyMs: Date.now() - t0 }
        : { ok: false, error: `HTTP ${r.status}` };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
