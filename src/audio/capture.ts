import type { AudioCaptureFactory } from './types.js';

let _factory: AudioCaptureFactory | null = null;

export async function getAudioFactory(): Promise<AudioCaptureFactory> {
  if (_factory) return _factory;

  const platform = process.platform;

  if (platform === 'linux') {
    const { LinuxPulseCaptureFactory } = await import('./linux-pulse.js');
    _factory = new LinuxPulseCaptureFactory();
  } else if (platform === 'darwin') {
    const { MacAvFoundationFactory } = await import('./mac-avfoundation.js');
    _factory = new MacAvFoundationFactory();
  } else if (platform === 'win32') {
    const { WindowsDshowFactory } = await import('./windows-dshow.js');
    _factory = new WindowsDshowFactory();
  } else {
    throw new Error(
      `Unsupported platform: ${platform}. Supported platforms: linux, darwin, win32.`
    );
  }

  return _factory;
}
