import { getApiKey } from '../config/load.js';
import type { RecmpConfig } from '../config/schema.js';
import { ConfigError } from '../errors.js';
import { GroqProvider } from './groq.js';
import { LocalWhisperProvider } from './local-whisper.js';
import { OpenAIProvider } from './openai.js';
import type { TranscriptionProvider } from './types.js';

/** Providers that send audio to a remote API (and therefore require upload consent). */
export function providerUploads(name: string): boolean {
  return name === 'groq' || name === 'openai';
}

export async function createProvider(
  config: RecmpConfig
): Promise<TranscriptionProvider> {
  const providerName = config.provider.default;

  if (providerName === 'groq') {
    const apiKey = await getApiKey('groq');
    if (!apiKey) {
      throw new ConfigError(
        'GROQ_API_KEY is not set.\n' +
          '  Set it with: export GROQ_API_KEY=your_key\n' +
          '  Or run: recmp3 config set-key groq --key your_key'
      );
    }
    const groqConfig = config.provider.groq;
    return new GroqProvider({
      apiKey,
      model: groqConfig?.model ?? 'whisper-large-v3-turbo',
      baseUrl: groqConfig?.baseUrl,
      timeoutMs: groqConfig?.timeoutMs,
    });
  }

  if (providerName === 'openai') {
    const apiKey = await getApiKey('openai');
    if (!apiKey) {
      throw new ConfigError(
        'OPENAI_API_KEY is not set.\n' +
          '  Set it with: export OPENAI_API_KEY=your_key\n' +
          '  Or run: recmp3 config set-key openai --key your_key'
      );
    }
    const openaiConfig = config.provider.openai;
    return new OpenAIProvider({
      apiKey,
      model: openaiConfig?.model ?? 'whisper-1',
      baseUrl: openaiConfig?.baseUrl,
      timeoutMs: openaiConfig?.timeoutMs,
    });
  }

  if (providerName === 'local-whisper') {
    return new LocalWhisperProvider(config.provider.local ?? {});
  }

  throw new ConfigError(
    `Unknown provider: "${providerName}". Valid options: groq, openai, local-whisper.`
  );
}
