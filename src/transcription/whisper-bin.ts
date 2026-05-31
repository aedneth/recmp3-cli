import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { LocalWhisperError } from '../errors.js';

const execFileAsync = promisify(execFile);

// whisper.cpp ships its CLI under a few names across versions/distros.
const CANDIDATE_BINS = ['whisper-cli', 'whisper', 'main'] as const;

/**
 * Locate a whisper.cpp binary. Precedence mirrors findFfmpeg():
 * explicit path → RECMP3_WHISPER_BIN → PATH lookup of known names.
 */
export async function findWhisperBin(configPath?: string): Promise<string> {
  const explicit = configPath ?? process.env.RECMP3_WHISPER_BIN;
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new LocalWhisperError(`whisper binary not found at: ${explicit}`);
    }
    return explicit;
  }

  const which = process.platform === 'win32' ? 'where' : 'which';
  for (const name of CANDIDATE_BINS) {
    try {
      const { stdout } = await execFileAsync(which, [name]);
      const found = stdout.trim().split('\n')[0];
      if (found) return found;
    } catch {
      // try next candidate
    }
  }

  throw new LocalWhisperError(
    'whisper.cpp binary not found. Install whisper.cpp and ensure "whisper-cli" is on PATH, ' +
      'or set RECMP3_WHISPER_BIN / config provider.local.binPath.'
  );
}

/**
 * Resolve the GGML model file. Precedence: explicit path → RECMP3_WHISPER_MODEL.
 * There is no PATH fallback — a model file must be provided.
 */
export function findWhisperModel(configPath?: string): string {
  const model = configPath ?? process.env.RECMP3_WHISPER_MODEL;
  if (!model) {
    throw new LocalWhisperError(
      'No whisper model configured. Set RECMP3_WHISPER_MODEL / config provider.local.modelPath ' +
        'to a .bin model file (e.g. ggml-base.en.bin).'
    );
  }
  if (!existsSync(model)) {
    throw new LocalWhisperError(`whisper model not found at: ${model}`);
  }
  return model;
}
