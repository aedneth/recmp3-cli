import { execFile } from 'child_process';
import { mkdir, readdir, stat } from 'fs/promises';
import { basename, join } from 'path';
import { promisify } from 'util';
import { findFfmpeg } from '../audio/ffmpeg.js';
import { TranscriptionInput, TranscriptionProvider, TranscriptionResult } from './types.js';

const execFileAsync = promisify(execFile);

export async function transcribeWithChunking(
  provider: TranscriptionProvider,
  input: TranscriptionInput,
  chunkSeconds = 600,
): Promise<TranscriptionResult> {
  const fileStat = await stat(input.audioPath);

  // If file fits within provider limit, transcribe directly
  if (fileStat.size <= provider.maxFileSizeBytes) {
    return provider.transcribe(input);
  }

  // File is too large — split into chunks and transcribe sequentially
  const tmpDir = join(
    (await import('os')).tmpdir(),
    `recmp3-chunks-${Date.now()}`,
  );
  await mkdir(tmpDir, { recursive: true });

  const ffmpeg = await findFfmpeg();
  const chunkPattern = join(tmpDir, 'chunk-%04d.wav');

  await execFileAsync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error',
    '-i', input.audioPath,
    '-f', 'segment',
    '-segment_time', String(chunkSeconds),
    '-c', 'copy',
    chunkPattern,
  ]);

  const files = (await readdir(tmpDir))
    .filter((f) => f.startsWith('chunk-') && f.endsWith('.wav'))
    .sort()
    .map((f) => join(tmpDir, f));

  if (files.length === 0) {
    // Fallback: transcribe original even if over limit
    return provider.transcribe(input);
  }

  const results: TranscriptionResult[] = [];
  for (const chunkPath of files) {
    const result = await provider.transcribe({ ...input, audioPath: chunkPath });
    results.push(result);
  }

  // Combine results
  const combinedText = results.map((r) => r.text).join(' ');
  const totalLatency = results.reduce((sum, r) => sum + r.latencyMs, 0);

  return {
    text: combinedText,
    language: results[0]?.language,
    durationSec: results.reduce((sum, r) => sum + (r.durationSec ?? 0), 0),
    raw: results.map((r) => r.raw),
    provider: results[0]?.provider ?? provider.name,
    model: results[0]?.model ?? '',
    latencyMs: totalLatency,
  };
}
