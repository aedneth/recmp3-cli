import pc from 'picocolors';
import type { AgentContext } from '../agent/context.js';
import { pickAutoSource } from '../audio/auto-source.js';
import { getAudioFactory } from '../audio/capture.js';
import type { AudioSource } from '../audio/types.js';
import { RecmpError } from '../errors.js';

export async function runSources(ctx: AgentContext): Promise<void> {
  let sources: AudioSource[] = [];

  try {
    const factory = await getAudioFactory();
    sources = await factory.listSources();
  } catch (err: unknown) {
    throw err instanceof RecmpError
      ? err
      : new RecmpError(
          'AUDIO_CAPTURE_ERROR',
          `Failed to list audio sources: ${err instanceof Error ? err.message : String(err)}. Make sure ffmpeg is installed.`,
          3
        );
  }

  const platform = process.platform;
  const recommended = sources.length ? pickAutoSource(sources) : 'default';

  ctx.ok('sources', { platform, sources, recommended }, () => {
    const platformLabels: Record<string, string> = {
      linux: 'Linux (PulseAudio/PipeWire)',
      darwin: 'macOS (AVFoundation)',
      win32: 'Windows (DirectShow)',
    };
    const platformLabel = platformLabels[platform] ?? platform;

    console.log(`\n${pc.bold('Audio sources')} on ${platformLabel}:\n`);

    if (sources.length === 0) {
      console.log(
        pc.yellow('  No audio sources found. Check your audio hardware.')
      );
      return;
    }

    for (const source of sources) {
      const markers = [
        source.isDefault ? pc.green(' (default)') : '',
        source.id === recommended ? pc.yellow(' (recommended)') : '',
      ].join('');
      const id = pc.cyan(source.id);
      const label =
        source.label !== source.id ? pc.gray(` — ${source.label}`) : '';
      console.log(`  ${id}${label}${markers}`);
    }

    console.log(
      `\n${pc.gray('  Best mic:')} ${pc.cyan('recmp3 record --source auto')}`
    );
    console.log(`${pc.gray('  Specific:')} recmp3 record --source <id>`);
    console.log(
      pc.gray('  Or set:   RECMP3_SOURCE=<id> in your environment\n')
    );
  });
}
