import pc from 'picocolors';
import { checkFfmpegVersion, findFfmpeg, supportsInputFormat } from '../audio/ffmpeg.js';
import { loadConfig, getApiKey } from '../config/load.js';
import { configFilePath } from '../config/paths.js';
import { redactKey } from '../log.js';
import { existsSync } from 'fs';

interface Check {
  label: string;
  ok: boolean;
  detail?: string;
  hint?: string;
}

function printCheck(check: Check) {
  const icon = check.ok ? pc.green('✓') : pc.red('✗');
  const label = pc.bold(check.label.padEnd(30));
  const detail = check.detail ? pc.gray(check.detail) : '';
  console.log(`  ${icon} ${label} ${detail}`);
  if (!check.ok && check.hint) {
    console.log(`    ${pc.yellow('→')} ${pc.yellow(check.hint)}`);
  }
}

export async function runDoctor(): Promise<void> {
  console.log(`\n${pc.bold('recmp3 doctor — preflight checks')}\n`);

  const checks: Check[] = [];
  let allOk = true;

  // 1. Node version
  const nodeVersion = process.version;
  const [nodeMajor] = nodeVersion.slice(1).split('.').map(Number);
  const nodeOk = nodeMajor >= 20;
  checks.push({
    label: 'Node.js version',
    ok: nodeOk,
    detail: nodeVersion,
    hint: nodeOk ? undefined : 'Requires Node.js 20+. Visit https://nodejs.org/',
  });

  // 2. Platform
  const platform = process.platform;
  const platformLabels: Record<string, string> = { linux: 'Linux', darwin: 'macOS', win32: 'Windows' };
  const platformLabel = platformLabels[platform] ?? platform;
  const platformSupported = ['linux', 'darwin', 'win32'].includes(platform);
  checks.push({
    label: 'Platform',
    ok: platformSupported,
    detail: `${platformLabel} (${process.arch})`,
    hint: platformSupported ? undefined : `Platform "${platform}" may not be fully supported.`,
  });

  // 3. ffmpeg
  const ffmpegCheck = await checkFfmpegVersion();
  checks.push({
    label: 'ffmpeg',
    ok: ffmpegCheck.meets,
    detail: ffmpegCheck.version,
    hint: ffmpegCheck.meets ? undefined : 'Requires ffmpeg 4.4+. Install: sudo apt install ffmpeg',
  });

  // 4. Audio backend
  if (ffmpegCheck.meets) {
    const backendFormats: Record<string, string> = { linux: 'pulse', darwin: 'avfoundation', win32: 'dshow' };
    const backendFormat = backendFormats[platform] ?? 'pulse';
    const backendOk = await supportsInputFormat(backendFormat).catch(() => false);
    checks.push({
      label: 'Audio backend',
      ok: backendOk,
      detail: backendFormat,
      hint: backendOk ? undefined : `ffmpeg missing "${backendFormat}" input support. Reinstall ffmpeg.`,
    });
  }

  // 5. Config file
  const configExists = existsSync(configFilePath);
  checks.push({
    label: 'Config file',
    ok: true,
    detail: configExists ? configFilePath : `${configFilePath} (using defaults)`,
  });

  // 6. Load config
  let config;
  try {
    config = await loadConfig();
  } catch (err: unknown) {
    checks.push({
      label: 'Config load',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      hint: 'Run: recmp3 config init',
    });
    allOk = false;
  }

  if (config) {
    // 7. Provider
    const providerName = config.provider.default;
    const apiKey = getApiKey(providerName);
    const keyOk = Boolean(apiKey);

    checks.push({
      label: `Provider: ${providerName}`,
      ok: keyOk,
      detail: keyOk ? `API key set (${redactKey(apiKey!)})` : 'API key not set',
      hint: keyOk ? undefined :
        `Set ${providerName === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'} env var, or run: recmp3 config init`,
    });

    // 8. Network ping (only if key is set)
    if (keyOk) {
      process.stdout.write(`  ${pc.gray('○')} ${pc.bold('Provider ping'.padEnd(30))} ${pc.gray('checking...')}\r`);
      try {
        const { createProvider } = await import('../transcription/registry.js');
        const provider = createProvider(config);
        const ping = provider.ping ? await provider.ping() : null;
        if (ping) {
          checks.push({
            label: `Provider ping`,
            ok: ping.ok,
            detail: ping.ok ? `${ping.latencyMs}ms` : ping.error,
            hint: ping.ok ? undefined : 'Check network connection or API key validity.',
          });
        }
      } catch (err: unknown) {
        checks.push({
          label: 'Provider ping',
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
          hint: 'Check network connectivity.',
        });
      }
    }

    // 9. Recordings directory
    const recDir = config.output.recordingDir!;
    checks.push({
      label: 'Recordings directory',
      ok: true,
      detail: recDir,
    });
  }

  // Print all checks
  for (const check of checks) {
    printCheck(check);
    if (!check.ok) allOk = false;
  }

  console.log('');
  if (allOk) {
    console.log(pc.green(`  ✓ All checks passed. Run: recmp3 record --transcribe\n`));
  } else {
    console.log(pc.yellow(`  Some checks failed. Address the issues above and re-run: recmp3 doctor\n`));
    process.exit(1);
  }
}
