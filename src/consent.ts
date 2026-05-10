import { createInterface } from 'readline';
import pc from 'picocolors';
import { loadConfig, saveConfig } from './config/load.js';

export async function ensureUploadConsent(opts: { yes?: boolean } = {}): Promise<void> {
  const config = await loadConfig();

  if (config.consent.uploadsAcknowledged) return;
  if (opts.yes || process.env.RECMP3_SKIP_CONSENT === '1') {
    // Auto-acknowledge in non-interactive mode
    config.consent.uploadsAcknowledged = true;
    config.consent.acknowledgedAt = new Date().toISOString();
    await saveConfig(config).catch(() => {});
    return;
  }

  if (!process.stdout.isTTY) {
    // Non-interactive — warn and continue (don't block scripts)
    process.stderr.write(
      pc.yellow('⚠  recmp3 will upload audio to the configured provider for transcription.\n') +
      '   Set RECMP3_SKIP_CONSENT=1 to suppress this warning in scripts.\n',
    );
    return;
  }

  process.stdout.write(
    '\n' +
    pc.bold('  recmp3 will upload your audio to the transcription provider.\n') +
    pc.gray('  Audio is transmitted over HTTPS. Provider data retention terms apply.\n') +
    pc.gray(`  Current provider: ${config.provider.default}\n`) +
    '\n  Continue? [Y/n] ',
  );

  const answer = await new Promise<string>((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.once('line', (line) => { rl.close(); resolve(line.trim().toLowerCase()); });
    rl.once('close', () => resolve('y'));
  });

  if (answer === 'n' || answer === 'no') {
    process.stdout.write(pc.gray('  Cancelled. No audio was uploaded.\n\n'));
    process.exit(0);
  }

  config.consent.uploadsAcknowledged = true;
  config.consent.acknowledgedAt = new Date().toISOString();
  await saveConfig(config).catch(() => {});
  process.stdout.write('\n');
}
