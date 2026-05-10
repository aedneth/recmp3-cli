import { homedir } from 'os';
import { join } from 'path';

function xdgConfigHome(): string {
  return process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
}

function xdgDataHome(): string {
  return process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share');
}

function appPaths() {
  const platform = process.platform;

  if (platform === 'darwin') {
    const appSupport = join(homedir(), 'Library', 'Application Support', 'recmp3');
    return {
      config: join(homedir(), 'Library', 'Preferences', 'recmp3'),
      data: appSupport,
      recordings: join(appSupport, 'recordings'),
      transcripts: join(appSupport, 'transcripts'),
    };
  }

  if (platform === 'win32') {
    const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    const base = join(appData, 'recmp3');
    return {
      config: base,
      data: base,
      recordings: join(base, 'recordings'),
      transcripts: join(base, 'transcripts'),
    };
  }

  // Linux and everything else — XDG
  const config = join(xdgConfigHome(), 'recmp3');
  const data = join(xdgDataHome(), 'recmp3');
  return {
    config,
    data,
    recordings: join(data, 'recordings'),
    transcripts: join(data, 'transcripts'),
  };
}

export const paths = appPaths();
export const configFilePath = join(paths.config, 'config.json');
