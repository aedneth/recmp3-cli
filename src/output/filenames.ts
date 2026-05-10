import { join } from 'path';

function formatDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

export function generateRecordingName(opts: {
  name?: string;
  prefix?: string;
  ext?: string;
}): string {
  const ext = opts.ext ?? 'wav';
  const ts = formatDate();

  if (opts.name) {
    const slug = opts.name
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${slug}-${ts}.${ext}`;
  }

  const prefix = opts.prefix ?? 'rec';
  return `${prefix}-${ts}.${ext}`;
}

export function transcriptPath(audioPath: string, ext: 'txt' | 'json'): string {
  const base = audioPath.replace(/\.(wav|mp3|m4a|ogg|flac)$/i, '');
  return `${base}.${ext}`;
}

export function buildOutputPath(dir: string, name: string): string {
  return join(dir, name);
}
