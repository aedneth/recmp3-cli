import { ConfigError } from '../errors.js';
import { getApiKey } from '../config/load.js';
import { RecmpConfig } from '../config/schema.js';
import { GroqProvider } from './groq.js';
import { OpenAIProvider } from './openai.js';
import { TranscriptionProvider } from './types.js';

export function createProvider(config: RecmpConfig): TranscriptionProvider {
  const providerName = config.provider.default;

  if (providerName === 'groq') {
    const apiKey = getApiKey('groq');
    if (!apiKey) {
      throw new ConfigError(
        'GROQ_API_KEY is not set.\n' +
        '  Set it with: export GROQ_API_KEY=your_key\n' +
        '  Or run: recmp3 config init',
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
    const apiKey = getApiKey('openai');
    if (!apiKey) {
      throw new ConfigError(
        'OPENAI_API_KEY is not set.\n' +
        '  Set it with: export OPENAI_API_KEY=your_key\n' +
        '  Or run: recmp3 config init',
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

  throw new ConfigError(`Unknown provider: "${providerName}". Valid options: groq, openai.`);
}
