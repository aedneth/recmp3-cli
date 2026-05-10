import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

let _ffmpegPath: string | null = null;

export async function findFfmpeg(): Promise<string> {
  if (_ffmpegPath) return _ffmpegPath;

  // Check RECMP3_FFMPEG_PATH env override
  if (process.env.RECMP3_FFMPEG_PATH) {
    _ffmpegPath = process.env.RECMP3_FFMPEG_PATH;
    return _ffmpegPath;
  }

  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const { stdout } = await execFileAsync(which, ['ffmpeg']);
    _ffmpegPath = stdout.trim().split('\n')[0];
    return _ffmpegPath;
  } catch {
    throw new Error('ffmpeg not found. Install with: sudo apt install ffmpeg');
  }
}

export async function checkFfmpegVersion(): Promise<{ version: string; meets: boolean }> {
  try {
    const ffmpeg = await findFfmpeg();
    const { stdout, stderr } = await execFileAsync(ffmpeg, ['-version']);
    const output = stdout + stderr;
    const match = output.match(/ffmpeg version (\S+)/);
    const version = match?.[1] ?? 'unknown';

    // Require 4.4+
    const [major, minor] = version.split('.').map(Number);
    const meets = major > 4 || (major === 4 && minor >= 4);

    return { version, meets };
  } catch {
    return { version: 'not found', meets: false };
  }
}

export async function supportsInputFormat(format: string): Promise<boolean> {
  try {
    const ffmpeg = await findFfmpeg();
    const { stdout } = await execFileAsync(ffmpeg, ['-formats']);
    return stdout.includes(format);
  } catch {
    return false;
  }
}
