import { writeFile } from 'fs/promises';
import { TranscriptionResult } from '../transcription/types.js';
import { transcriptPath } from './filenames.js';

export async function writeTranscriptFiles(
  audioPath: string,
  result: TranscriptionResult,
): Promise<{ txtPath: string; jsonPath: string }> {
  const txtPath = transcriptPath(audioPath, 'txt');
  const jsonPath = transcriptPath(audioPath, 'json');

  await writeFile(txtPath, result.text + '\n', 'utf-8');

  const meta = {
    text: result.text,
    provider: result.provider,
    model: result.model,
    language: result.language,
    durationSec: result.durationSec,
    latencyMs: result.latencyMs,
    audioFile: audioPath,
    segments: result.segments,
  };
  await writeFile(jsonPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');

  return { txtPath, jsonPath };
}
