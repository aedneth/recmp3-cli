import { describe, expect, it } from 'vitest';
import { pickAutoSource } from '../../src/audio/auto-source.js';
import type { AudioSource } from '../../src/audio/types.js';

const src = (id: string, isDefault = false): AudioSource => ({
  id,
  label: id,
  isDefault,
});

describe('pickAutoSource', () => {
  it('picks the physical alsa_input over default and the monitor source', () => {
    // Mirrors the real machine layout the feature was built for.
    const sources: AudioSource[] = [
      src('default', true),
      src('alsa_output.platform-avs_hdaudio.0.stereo-fallback.monitor'),
      src('alsa_input.platform-avs_hdaudio.0.stereo-fallback'),
    ];
    expect(pickAutoSource(sources)).toBe(
      'alsa_input.platform-avs_hdaudio.0.stereo-fallback'
    );
  });

  it('never selects a .monitor (system-audio loopback) source', () => {
    const sources: AudioSource[] = [
      src('default', true),
      src('alsa_output.pci-0000_00_1f.3.analog-stereo.monitor'),
    ];
    // Only a monitor + default exist → falls back to default, not the monitor.
    expect(pickAutoSource(sources)).toBe('default');
  });

  it('excludes monitor sources flagged only in the label', () => {
    const sources: AudioSource[] = [
      src('default', true),
      {
        id: 'src-1',
        label: 'Loopback (system audio monitor)',
        isDefault: false,
      },
      src('alsa_input.usb-mic'),
    ];
    expect(pickAutoSource(sources)).toBe('alsa_input.usb-mic');
  });

  it('prefers an "input"-named device over a generic physical one', () => {
    const sources: AudioSource[] = [
      src('default', true),
      src('some_generic_device'),
      src('alsa_input.usb-Blue_Microphones'),
    ];
    expect(pickAutoSource(sources)).toBe('alsa_input.usb-Blue_Microphones');
  });

  it('falls back to the first physical device when none look like inputs', () => {
    const sources: AudioSource[] = [
      src('default', true),
      src('CoreAudio Device A'),
      src('CoreAudio Device B'),
    ];
    expect(pickAutoSource(sources)).toBe('CoreAudio Device A');
  });

  it('returns "default" when only the default alias is present', () => {
    expect(pickAutoSource([src('default', true)])).toBe('default');
  });

  it('returns "default" for an empty source list', () => {
    expect(pickAutoSource([])).toBe('default');
  });
});
