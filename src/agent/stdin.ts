/** Read all of stdin as a Buffer (for piped audio bytes). */
export async function readStdinBuffer(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Read all of stdin as UTF-8 text (for piped transcript text). */
export async function readStdinText(): Promise<string> {
  return (await readStdinBuffer()).toString('utf-8');
}
