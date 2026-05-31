import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { configFilePath, paths } from './paths.js';
import { type RecmpConfig, RecmpConfigSchema } from './schema.js';

let _config: RecmpConfig | null = null;

function applyEnvOverrides(config: RecmpConfig): RecmpConfig {
  const clone = structuredClone(config);

  if (process.env.RECMP3_PROVIDER) {
    const p = process.env.RECMP3_PROVIDER as 'groq' | 'openai';
    if (p === 'groq' || p === 'openai') clone.provider.default = p;
  }

  if (process.env.RECMP3_MODEL) {
    const model = process.env.RECMP3_MODEL;
    const provider = clone.provider.default;
    if (provider === 'groq') {
      clone.provider.groq = { ...clone.provider.groq, model };
    } else if (provider === 'openai') {
      clone.provider.openai = { ...clone.provider.openai, model };
    }
  }

  if (process.env.RECMP3_SOURCE) {
    clone.audio.source = process.env.RECMP3_SOURCE;
  }

  if (process.env.RECMP3_LANG) {
    clone.transcription.defaultLanguage = process.env.RECMP3_LANG;
  }

  if (process.env.RECMP3_OUTDIR) {
    clone.output.recordingDir = process.env.RECMP3_OUTDIR;
  }

  if (process.env.RECMP3_WHISPER_BIN) {
    clone.provider.local = {
      ...clone.provider.local,
      binPath: process.env.RECMP3_WHISPER_BIN,
    };
  }

  if (process.env.RECMP3_WHISPER_MODEL) {
    clone.provider.local = {
      ...clone.provider.local,
      modelPath: process.env.RECMP3_WHISPER_MODEL,
    };
  }

  return clone;
}

export async function loadConfig(): Promise<RecmpConfig> {
  if (_config) return _config;

  // Load .env from cwd if it exists (dotenv pattern for dev)
  if (existsSync('.env')) {
    const { config: dotenvConfig } = await import('dotenv');
    dotenvConfig({ path: join(process.cwd(), '.env') });
  }

  let raw: unknown = {};
  if (existsSync(configFilePath)) {
    try {
      raw = JSON.parse(readFileSync(configFilePath, 'utf-8'));
    } catch {
      raw = {};
    }
  }

  const parsed = RecmpConfigSchema.safeParse(raw);
  const base = parsed.success ? parsed.data : RecmpConfigSchema.parse({});

  // Set default recording dir if not configured
  if (!base.output.recordingDir) {
    base.output.recordingDir = paths.recordings;
  }

  _config = applyEnvOverrides(base);
  return _config;
}

export function resetConfigCache() {
  _config = null;
}

export async function saveConfig(config: RecmpConfig): Promise<void> {
  await mkdir(dirname(configFilePath), { recursive: true });
  await writeFile(
    configFilePath,
    `${JSON.stringify(config, null, 2)}\n`,
    'utf-8'
  );
  _config = config;
}

export async function loadConfigFile(): Promise<RecmpConfig | null> {
  if (!existsSync(configFilePath)) return null;
  try {
    const raw = JSON.parse(await readFile(configFilePath, 'utf-8'));
    const parsed = RecmpConfigSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const ENV_VAR: Record<'groq' | 'openai', string> = {
  groq: 'GROQ_API_KEY',
  openai: 'OPENAI_API_KEY',
};

/**
 * Resolve an API key with precedence: environment variable → OS keychain → undefined.
 * Env always wins so CI/agent overrides are honored without touching the keychain.
 */
export async function getApiKey(
  provider: 'groq' | 'openai'
): Promise<string | undefined> {
  const fromEnv = process.env[ENV_VAR[provider]];
  if (fromEnv) return fromEnv;
  const { getSecret } = await import('../secrets/keychain.js');
  return getSecret(ENV_VAR[provider]);
}
