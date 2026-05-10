import { createInterface } from 'readline';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import pc from 'picocolors';
import { configFilePath, paths } from '../config/paths.js';
import { loadConfig, saveConfig, resetConfigCache, getApiKey } from '../config/load.js';
import { RecmpConfigSchema } from '../config/schema.js';
import { redactKey } from '../log.js';

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
    rl.once('close', () => resolve(''));
  });
}

async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${hint} `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

export async function runConfigInit(): Promise<void> {
  if (!process.stdout.isTTY) {
    console.error(`${pc.red('✗')} recmp3 config init requires an interactive terminal.`);
    process.exit(1);
  }

  console.log(`\n${pc.bold('recmp3 — First-time setup')}`);
  console.log(pc.gray(`Config will be saved to: ${configFilePath}\n`));

  // Provider selection
  console.log(`${pc.bold('1. Transcription provider')}`);
  console.log(`   ${pc.cyan('groq')}   — Groq Whisper API (fast, cheap, recommended)`);
  console.log(`   ${pc.cyan('openai')} — OpenAI Whisper API`);
  const providerInput = await prompt('\n   Choice [groq]: ');
  const providerName = (['groq', 'openai'].includes(providerInput) ? providerInput : 'groq') as 'groq' | 'openai';

  // API key instructions
  console.log(`\n${pc.bold('2. API key')}`);
  const envVar = providerName === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY';
  const existingKey = getApiKey(providerName);

  if (existingKey) {
    console.log(`   ${pc.green('✓')} ${envVar} is already set: ${redactKey(existingKey)}`);
  } else {
    console.log(`   ${pc.yellow('!')} ${envVar} is not set.`);
    console.log(`\n   Add to your shell profile (~/.bashrc or ~/.zshrc):`);
    console.log(`   ${pc.cyan(`export ${envVar}=your_key_here`)}\n`);
    console.log(`   Then reload: ${pc.cyan('source ~/.bashrc')}\n`);
    const ok = await confirm('   Continue without setting the key for now?', true);
    if (!ok) {
      console.log(pc.gray('\n  Setup cancelled. Re-run after setting the API key.\n'));
      process.exit(0);
    }
  }

  // Language
  console.log(`\n${pc.bold('3. Default language')}`);
  console.log(`   ${pc.gray('Leave blank for auto-detect (works for Spanish and English)')}`);
  const lang = await prompt('   Language code (e.g. es, en) [auto]: ');

  // Output directory
  console.log(`\n${pc.bold('4. Recordings directory')}`);
  console.log(`   ${pc.gray(`Default: ${paths.recordings}`)}`);
  const outDir = await prompt('   Directory [default]: ');

  // Build config
  const config = RecmpConfigSchema.parse({});
  config.provider.default = providerName;
  if (lang) config.transcription.defaultLanguage = lang;
  if (outDir) config.output.recordingDir = outDir;
  else config.output.recordingDir = paths.recordings;

  await mkdir(dirname(configFilePath), { recursive: true });
  await mkdir(config.output.recordingDir, { recursive: true });
  await saveConfig(config);

  console.log(`\n${pc.green('✓')} Config saved: ${configFilePath}`);
  console.log(`${pc.green('✓')} Recordings directory: ${config.output.recordingDir}`);

  if (!existingKey) {
    console.log(`\n${pc.yellow('  Next:')} Set ${envVar} in your environment, then run:`);
    console.log(`  ${pc.cyan('recmp3 doctor')}            — verify setup`);
    console.log(`  ${pc.cyan('recmp3 record --transcribe')} — test it\n`);
  } else {
    console.log(`\n  ${pc.cyan('recmp3 doctor')}            — verify setup`);
    console.log(`  ${pc.cyan('recmp3 record --transcribe')} — start recording\n`);
  }
}

export async function runConfigShow(): Promise<void> {
  const config = await loadConfig();
  const groqKey = getApiKey('groq');
  const openaiKey = getApiKey('openai');

  console.log(`\n${pc.bold('recmp3 configuration')}`);
  console.log(pc.gray(`Config file: ${existsSync(configFilePath) ? configFilePath : `${configFilePath} (not found — using defaults)`}\n`));

  console.log(`${pc.bold('Provider')}`);
  console.log(`  default:     ${pc.cyan(config.provider.default)}`);
  console.log(`  groq model:  ${config.provider.groq?.model ?? 'whisper-large-v3-turbo'}`);
  console.log(`  openai model:${config.provider.openai?.model ?? 'whisper-1'}`);

  console.log(`\n${pc.bold('API keys')}`);
  console.log(`  GROQ_API_KEY:   ${groqKey ? pc.green(`set (${redactKey(groqKey)})`) : pc.red('not set')}`);
  console.log(`  OPENAI_API_KEY: ${openaiKey ? pc.green(`set (${redactKey(openaiKey)})`) : pc.gray('not set')}`);

  console.log(`\n${pc.bold('Audio')}`);
  console.log(`  source:      ${config.audio.source}`);
  console.log(`  sample rate: ${config.audio.sampleRate} Hz`);
  console.log(`  channels:    ${config.audio.channels} (mono)`);

  console.log(`\n${pc.bold('Output')}`);
  console.log(`  recordingDir: ${config.output.recordingDir}`);
  console.log(`  namePrefix:   ${config.output.namePrefix}`);
  console.log(`  keepAudio:    ${config.output.keepAudio}`);

  console.log(`\n${pc.bold('Transcription')}`);
  console.log(`  language:    ${config.transcription.defaultLanguage ?? 'auto-detect'}`);
  console.log(`  chunking:    ${config.transcription.chunking.enabled ? `enabled (${config.transcription.chunking.chunkSeconds}s chunks)` : 'disabled'}\n`);
}

export async function runConfigPath(): Promise<void> {
  console.log(configFilePath);
}

export async function runConfigSet(key: string, value: string): Promise<void> {
  const config = await loadConfig();

  const parts = key.split('.');
  let obj: Record<string, unknown> = config as Record<string, unknown>;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof obj[part] !== 'object' || obj[part] === null) {
      obj[part] = {};
    }
    obj = obj[part] as Record<string, unknown>;
  }

  const lastKey = parts[parts.length - 1];
  if (value === 'true') obj[lastKey] = true;
  else if (value === 'false') obj[lastKey] = false;
  else if (!Number.isNaN(Number(value))) obj[lastKey] = Number(value);
  else obj[lastKey] = value;

  const parsed = RecmpConfigSchema.safeParse(config);
  if (!parsed.success) {
    console.error(`${pc.red('✗')} Invalid config value: ${parsed.error.message}`);
    process.exit(1);
  }

  await saveConfig(parsed.data);
  resetConfigCache();
  console.log(`${pc.green('✓')} Set ${key} = ${value}`);
}
