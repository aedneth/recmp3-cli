import { readFile } from 'fs/promises';
import { basename, extname } from 'path';
import { NetworkError, TranscriptionError } from '../errors.js';
import { log } from '../log.js';
import {
  ProviderConfig,
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from './types.js';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const SUPPORTED_FORMATS = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'] as const;

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase().slice(1);
  const mimes: Record<string, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    mp4: 'audio/mp4',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    flac: 'audio/flac',
    webm: 'audio/webm',
  };
  return mimes[ext] ?? 'audio/wav';
}

export class GroqProvider implements TranscriptionProvider {
  readonly name = 'groq' as const;
  readonly maxFileSizeBytes = MAX_FILE_SIZE;
  readonly supportedFormats = SUPPORTED_FORMATS;

  private baseUrl: string;
  private timeoutMs: number;

  constructor(private config: ProviderConfig) {
    this.baseUrl = config.baseUrl ?? GROQ_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const { audioPath, language, prompt, responseFormat = 'verbose_json', signal } = input;
    const t0 = Date.now();

    log.info(`Transcribing with Groq (${this.config.model}): ${basename(audioPath)}`);

    const audioBuffer = await readFile(audioPath);
    const mimeType = getMimeType(audioPath);
    const filename = basename(audioPath);

    const form = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    form.append('file', blob, filename);
    form.append('model', this.config.model);
    form.append('response_format', responseFormat);
    if (language) form.append('language', language);
    if (prompt) form.append('prompt', prompt);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const combinedSignal = signal ?? controller.signal;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: form,
        signal: combinedSignal,
      });
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TranscriptionError('Transcription timed out after ' + Math.round(this.timeoutMs / 1000) + 's.');
      }
      throw new NetworkError(`Network error connecting to Groq: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new TranscriptionError(
        `Groq API error ${response.status}: ${body || response.statusText}`,
        response.status,
      );
    }

    const raw = await response.json() as Record<string, unknown>;
    const text = typeof raw === 'string' ? raw : ((raw.text as string) ?? '');
    const latencyMs = Date.now() - t0;

    log.info(`Transcription complete in ${(latencyMs / 1000).toFixed(1)}s`);

    return {
      text: text.trim(),
      language: raw.language as string | undefined,
      durationSec: raw.duration as number | undefined,
      segments: (raw.segments as Array<{ start: number; end: number; text: string }> | undefined)?.map((s) => ({
        startSec: s.start,
        endSec: s.end,
        text: s.text,
      })),
      raw,
      provider: 'groq',
      model: this.config.model,
      latencyMs,
    };
  }

  async ping(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const t0 = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
