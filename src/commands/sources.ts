import pc from 'picocolors';
import { getAudioFactory } from '../audio/capture.js';
import { AudioSource } from '../audio/types.js';

export interface SourcesOptions {
  json?: boolean;
}

export async function runSources(opts: SourcesOptions = {}): Promise<void> {
  let sources: AudioSource[] = [];

  try {
    const factory = await getAudioFactory();
    sources = await factory.listSources();
  } catch (err: unknown) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ error: String(err), sources: [] }, null, 2) + '\n');
    } else {
      console.error(`${pc.red('✗')} Failed to list audio sources: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`  Make sure ffmpeg is installed: sudo apt install ffmpeg`);
    }
    process.exit(1);
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify(sources, null, 2) + '\n');
    return;
  }

  const platform = process.platform;
  const platformLabels: Record<string, string> = { linux: 'Linux (PulseAudio/PipeWire)', darwin: 'macOS (AVFoundation)', win32: 'Windows (DirectShow)' };
  const platformLabel = platformLabels[platform] ?? platform;

  console.log(`\n${pc.bold('Audio sources')} on ${platformLabel}:\n`);

  if (sources.length === 0) {
    console.log(pc.yellow('  No audio sources found. Check your audio hardware.'));
    return;
  }

  for (const source of sources) {
    const marker = source.isDefault ? pc.green(' (default)') : '';
    const id = pc.cyan(source.id);
    const label = source.label !== source.id ? pc.gray(` — ${source.label}`) : '';
    console.log(`  ${id}${label}${marker}`);
  }

  console.log(`\n${pc.gray('  Use with: recmp3 record --source <id>')}`);
  console.log(pc.gray('  Or set:   RECMP3_SOURCE=<id> in your environment\n'));
}
