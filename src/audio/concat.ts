import { execFile } from 'node:child_process';
import { stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { AudioCaptureError } from '../errors.js';
import { findFfmpeg } from './ffmpeg.js';
import type { CaptureSegment } from './types.js';

const execFileAsync = promisify(execFile);

export async function concatSegments(
  segments: CaptureSegment[],
  outputPath: string,
  tmpDir: string,
  format: 'wav' | 'mp3' = 'wav'
): Promise<string> {
  const validSegments = segments.filter((s) => s.sizeBytes > 0);

  if (validSegments.length === 0) {
    throw new AudioCaptureError(
      'No audio was recorded. The recording was empty or too short.'
    );
  }

  const ffmpeg = await findFfmpeg();

  if (validSegments.length === 1) {
    // No concat needed — just encode the single segment
    if (format === 'wav') {
      // Already WAV — just move/copy it
      const { copyFile } = await import('node:fs/promises');
      await copyFile(validSegments[0].path, outputPath);
      return outputPath;
    }
    // Convert to MP3
    await execFileAsync(ffmpeg, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      validSegments[0].path,
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      '-y',
      outputPath,
    ]);
    return outputPath;
  }

  // Multiple segments — write concat list file and merge
  const listPath = join(tmpDir, 'concat-list.txt');
  const listContent = validSegments
    .map((s) => `file '${s.path.replace(/'/g, "'\\''")}'`)
    .join('\n');
  await writeFile(listPath, listContent, 'utf-8');

  const codecArgs =
    format === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', '192k'] : ['-c', 'copy'];

  await execFileAsync(ffmpeg, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    ...codecArgs,
    '-y',
    outputPath,
  ]);

  return outputPath;
}

export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { execFile: ef } = await import('node:child_process');
    const { promisify: p } = await import('node:util');
    const execAsync = p(ef);
    const { stderr } = await execAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    return Number.parseFloat(stderr.trim()) || 0;
  } catch {
    return 0;
  }
}

export async function getFileSizeBytes(filePath: string): Promise<number> {
  try {
    const s = await stat(filePath);
    return s.size;
  } catch {
    return 0;
  }
}
