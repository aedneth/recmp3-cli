import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioSource } from '../../src/audio/types.js';

// Mock the audio factory so runSources is exercised without real hardware/ffmpeg.
const listSources = vi.fn<() => Promise<AudioSource[]>>();
vi.mock('../../src/audio/capture.js', () => ({
  getAudioFactory: async () => ({
    create: () => ({}),
    listSources,
    defaultSource: () => 'default',
  }),
}));

const { runSources } = await import('../../src/commands/sources.js');
const { AgentContext } = await import('../../src/agent/context.js');
const { CaptureSink } = await import('../../src/agent/output.js');

function captureCtx() {
  const sink = new CaptureSink();
  return { ctx: new AgentContext({ json: true, sink }), sink };
}

describe('runSources', () => {
  beforeEach(() => listSources.mockReset());

  it('recommends the physical mic and excludes the monitor source', async () => {
    listSources.mockResolvedValue([
      { id: 'default', label: 'default', isDefault: true },
      {
        id: 'alsa_output.x.monitor',
        label: 'alsa_output.x.monitor',
        isDefault: false,
      },
      {
        id: 'alsa_input.platform-avs_hdaudio.0.stereo-fallback',
        label: 'alsa_input.platform-avs_hdaudio.0.stereo-fallback',
        isDefault: false,
      },
    ]);

    const { ctx, sink } = captureCtx();
    await runSources(ctx);

    expect(sink.envelope?.ok).toBe(true);
    const data = sink.envelope?.data as {
      recommended: string;
      sources: AudioSource[];
    };
    expect(data.recommended).toBe(
      'alsa_input.platform-avs_hdaudio.0.stereo-fallback'
    );
    expect(data.sources).toHaveLength(3);
  });

  it('recommends "default" when no physical mic is available', async () => {
    listSources.mockResolvedValue([
      { id: 'default', label: 'default', isDefault: true },
    ]);

    const { ctx, sink } = captureCtx();
    await runSources(ctx);

    const data = sink.envelope?.data as { recommended: string };
    expect(data.recommended).toBe('default');
  });
});
