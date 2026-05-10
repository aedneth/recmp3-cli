export interface TranscriptionInput {
  audioPath: string;
  language?: string;
  prompt?: string;
  signal?: AbortSignal;
  responseFormat?: 'text' | 'json' | 'verbose_json';
}

export interface TranscriptionSegment {
  startSec: number;
  endSec: number;
  text: string;
  words?: Array<{ word: string; startSec: number; endSec: number }>;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  durationSec?: number;
  segments?: TranscriptionSegment[];
  raw: unknown;
  provider: 'groq' | 'openai' | 'local-whisper';
  model: string;
  latencyMs: number;
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface TranscriptionProvider {
  readonly name: 'groq' | 'openai' | 'local-whisper';
  readonly maxFileSizeBytes: number;
  readonly supportedFormats: readonly string[];
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
  ping?(): Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
}
