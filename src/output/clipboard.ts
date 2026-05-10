import { log } from '../log.js';

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const clipboardy = await import('clipboardy');
    await clipboardy.default.write(text);
    return true;
  } catch (err: unknown) {
    log.info(
      'Clipboard copy failed (headless or missing xclip/wl-copy): ' +
      (err instanceof Error ? err.message : String(err)),
    );
    return false;
  }
}
