import type { AudioSource } from './types.js';

/** Matches system-audio "monitor" sources (loopback of output), which are never a mic. */
const MONITOR_RE = /\.monitor\b|\bmonitor\b/i;

/**
 * Pick the best physical microphone from a source list for `--source auto`.
 *
 * Precedence:
 *  1. A real capture device — the id is not the generic `default` alias and is not
 *     a system-audio `.monitor` source — preferring ids that look like inputs
 *     (e.g. `alsa_input.platform-avs_hdaudio.0.stereo-fallback`).
 *  2. Any non-monitor, non-`default` source.
 *  3. `default` as a last resort when no physical input can be identified.
 *
 * Pure and platform-agnostic so it can be unit-tested against fixture lists.
 */
export function pickAutoSource(sources: AudioSource[]): string {
  const physical = sources.filter(
    (s) =>
      s.id !== 'default' && !MONITOR_RE.test(s.id) && !MONITOR_RE.test(s.label)
  );
  const preferred = physical.find((s) => /input/i.test(s.id));
  return (preferred ?? physical[0])?.id ?? 'default';
}
