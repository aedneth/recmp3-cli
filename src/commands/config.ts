import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import pc from 'picocolors';
import type { AgentContext } from '../agent/context.js';
import { readStdinText } from '../agent/stdin.js';
import {
  getApiKey,
  loadConfig,
  resetConfigCache,
  saveConfig,
} from '../config/load.js';
import { configFilePath, paths } from '../config/paths.js';
import { RecmpConfigSchema } from '../config/schema.js';
import { ConfigError, InputError } from '../errors.js';
import { redactKey } from '../log.js';
import { keychainAvailable, setSecret } from '../secrets/keychain.js';

const ENV_VAR: Record<'groq' | 'openai', string> = {
  groq: 'GROQ_API_KEY',
  openai: 'OPENAI_API_KEY',
};

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
    rl.once('close', () => resolve(''));
  });
}

async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${hint} `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

export interface ConfigInitOptions {
  provider?: string;
  lang?: string;
  outdir?: string;
  key?: string;
}

export async function runConfigInit(
  opts: ConfigInitOptions,
  ctx: AgentContext
): Promise<void> {
  const flagDriven = Boolean(
    opts.provider || opts.lang || opts.outdir || opts.key
  );
  const interactive =
    !flagDriven && !ctx.yes && process.stdout.isTTY === true && !ctx.json;

  if (interactive) {
    return runConfigInitInteractive();
  }

  // Non-interactive / flag-driven setup — no prompts.
  const providerName = (
    ['groq', 'openai', 'local-whisper'].includes(opts.provider ?? '')
      ? opts.provider
      : 'groq'
  ) as 'groq' | 'openai' | 'local-whisper';

  const config = RecmpConfigSchema.parse({});
  config.provider.default = providerName;
  if (opts.lang) config.transcription.defaultLanguage = opts.lang;
  config.output.recordingDir = opts.outdir ?? paths.recordings;

  await mkdir(dirname(configFilePath), { recursive: true });
  await mkdir(config.output.recordingDir, { recursive: true });
  await saveConfig(config);

  let keychainStored = false;
  if (opts.key && (providerName === 'groq' || providerName === 'openai')) {
    keychainStored = await setSecret(ENV_VAR[providerName], opts.key);
    if (!keychainStored) {
      ctx.note(
        pc.yellow(
          '  OS keychain unavailable — set the key via env var instead.\n'
        )
      );
    }
  }

  ctx.ok(
    'config init',
    {
      configPath: configFilePath,
      provider: providerName,
      recordingDir: config.output.recordingDir,
      keychainStored,
    },
    () => {
      console.log(`${pc.green('✓')} Config saved: ${configFilePath}`);
      console.log(`${pc.green('✓')} Provider: ${providerName}`);
      if (keychainStored)
        console.log(`${pc.green('✓')} API key stored in OS keychain`);
    }
  );
}

async function runConfigInitInteractive(): Promise<void> {
  console.log(`\n${pc.bold('recmp3 — First-time setup')}`);
  console.log(pc.gray(`Config will be saved to: ${configFilePath}\n`));

  console.log(`${pc.bold('1. Transcription provider')}`);
  console.log(
    `   ${pc.cyan('groq')}   — Groq Whisper API (fast, cheap, recommended)`
  );
  console.log(`   ${pc.cyan('openai')} — OpenAI Whisper API`);
  console.log(`   ${pc.cyan('local-whisper')} — local whisper.cpp (no upload)`);
  const providerInput = await prompt('\n   Choice [groq]: ');
  const providerName = (
    ['groq', 'openai', 'local-whisper'].includes(providerInput)
      ? providerInput
      : 'groq'
  ) as 'groq' | 'openai' | 'local-whisper';

  console.log(`\n${pc.bold('2. API key')}`);
  if (providerName === 'local-whisper') {
    console.log(
      `   ${pc.gray('No API key needed. Set RECMP3_WHISPER_BIN and RECMP3_WHISPER_MODEL.')}`
    );
  } else {
    const envVar = ENV_VAR[providerName];
    const existingKey = await getApiKey(providerName);
    if (existingKey) {
      console.log(
        `   ${pc.green('✓')} ${envVar} is already set: ${redactKey(existingKey)}`
      );
    } else {
      const entered = await prompt(
        `   Paste ${envVar} (stored in OS keychain), or leave blank: `
      );
      if (entered) {
        const stored = await setSecret(envVar, entered);
        console.log(
          stored
            ? `   ${pc.green('✓')} Stored in OS keychain`
            : `   ${pc.yellow('!')} Keychain unavailable — set ${envVar} as an env var.`
        );
      } else {
        const ok = await confirm(
          '   Continue without setting the key for now?',
          true
        );
        if (!ok) {
          console.log(
            pc.gray('\n  Setup cancelled. Re-run after setting the API key.\n')
          );
          return;
        }
      }
    }
  }

  console.log(`\n${pc.bold('3. Default language')}`);
  const lang = await prompt('   Language code (e.g. es, en) [auto]: ');

  console.log(`\n${pc.bold('4. Recordings directory')}`);
  console.log(`   ${pc.gray(`Default: ${paths.recordings}`)}`);
  const outDir = await prompt('   Directory [default]: ');

  const config = RecmpConfigSchema.parse({});
  config.provider.default = providerName;
  if (lang) config.transcription.defaultLanguage = lang;
  config.output.recordingDir = outDir || paths.recordings;

  await mkdir(dirname(configFilePath), { recursive: true });
  await mkdir(config.output.recordingDir, { recursive: true });
  await saveConfig(config);

  console.log(`\n${pc.green('✓')} Config saved: ${configFilePath}`);
  console.log(
    `${pc.green('✓')} Recordings directory: ${config.output.recordingDir}`
  );
  console.log(`\n  ${pc.cyan('recmp3 doctor')}  — verify setup\n`);
}

export async function runConfigShow(ctx: AgentContext): Promise<void> {
  const config = await loadConfig();
  const groqKey = await getApiKey('groq');
  const openaiKey = await getApiKey('openai');

  const payload = {
    configPath: existsSync(configFilePath) ? configFilePath : null,
    provider: {
      default: config.provider.default,
      groqModel: config.provider.groq?.model ?? 'whisper-large-v3-turbo',
      openaiModel: config.provider.openai?.model ?? 'whisper-1',
      local: config.provider.local ?? null,
    },
    keys: {
      groq: groqKey ? redactKey(groqKey) : null,
      openai: openaiKey ? redactKey(openaiKey) : null,
    },
    audio: config.audio,
    output: config.output,
    transcription: config.transcription,
  };

  ctx.ok('config show', payload, () => {
    console.log(`\n${pc.bold('recmp3 configuration')}`);
    console.log(
      pc.gray(
        `Config file: ${payload.configPath ?? `${configFilePath} (not found — using defaults)`}\n`
      )
    );
    console.log(`${pc.bold('Provider')}`);
    console.log(`  default:     ${pc.cyan(config.provider.default)}`);
    console.log(`  groq model:  ${payload.provider.groqModel}`);
    console.log(`  openai model:${payload.provider.openaiModel}`);
    console.log(`\n${pc.bold('API keys')}`);
    console.log(
      `  GROQ_API_KEY:   ${groqKey ? pc.green(`set (${redactKey(groqKey)})`) : pc.red('not set')}`
    );
    console.log(
      `  OPENAI_API_KEY: ${openaiKey ? pc.green(`set (${redactKey(openaiKey)})`) : pc.gray('not set')}`
    );
    console.log(`\n${pc.bold('Audio')}`);
    console.log(`  source:      ${config.audio.source}`);
    console.log(`\n${pc.bold('Output')}`);
    console.log(`  recordingDir: ${config.output.recordingDir}`);
    console.log(`\n${pc.bold('Transcription')}`);
    console.log(
      `  language:    ${config.transcription.defaultLanguage ?? 'auto-detect'}\n`
    );
  });
}

export async function runConfigPath(ctx: AgentContext): Promise<void> {
  ctx.ok('config path', { path: configFilePath }, () =>
    console.log(configFilePath)
  );
}

export async function runConfigSet(
  key: string,
  value: string,
  ctx: AgentContext
): Promise<void> {
  const config = await loadConfig();

  const parts = key.split('.');
  let obj: Record<string, unknown> = config as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof obj[part] !== 'object' || obj[part] === null) obj[part] = {};
    obj = obj[part] as Record<string, unknown>;
  }

  const lastKey = parts[parts.length - 1];
  if (value === 'true') obj[lastKey] = true;
  else if (value === 'false') obj[lastKey] = false;
  else if (!Number.isNaN(Number(value))) obj[lastKey] = Number(value);
  else obj[lastKey] = value;

  const parsed = RecmpConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new ConfigError(`Invalid config value: ${parsed.error.message}`);
  }

  await saveConfig(parsed.data);
  resetConfigCache();
  ctx.ok('config set', { key, value }, () =>
    console.log(`${pc.green('✓')} Set ${key} = ${value}`)
  );
}

export interface ConfigSetKeyOptions {
  key?: string;
}

export async function runConfigSetKey(
  provider: string,
  opts: ConfigSetKeyOptions,
  ctx: AgentContext
): Promise<void> {
  if (provider !== 'groq' && provider !== 'openai') {
    throw new InputError(
      `Unknown provider: "${provider}". Valid: groq, openai.`
    );
  }

  // Value precedence: --key → stdin (if piped) → *_API_KEY env.
  let value = opts.key;
  if (!value && process.stdin.isTTY !== true) {
    value = (await readStdinText()).trim();
  }
  if (!value) value = process.env[ENV_VAR[provider]];
  if (!value) {
    throw new InputError(
      'No key provided. Use --key, pipe it on stdin, or set the *_API_KEY env var.'
    );
  }

  if (!(await keychainAvailable())) {
    throw new ConfigError(
      'OS keychain (keytar) is unavailable on this machine.'
    );
  }

  await setSecret(ENV_VAR[provider], value);
  ctx.ok(
    'config set-key',
    { provider, stored: true, backend: 'keychain' },
    () =>
      console.log(
        `${pc.green('✓')} Stored ${ENV_VAR[provider]} in the OS keychain (${redactKey(value!)})`
      )
  );
}
