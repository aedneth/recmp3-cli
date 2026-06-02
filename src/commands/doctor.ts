import { existsSync } from 'node:fs';
import pc from 'picocolors';
import type { AgentContext } from '../agent/context.js';
import { checkFfmpegVersion, supportsInputFormat } from '../audio/ffmpeg.js';
import { getApiKey, loadConfig } from '../config/load.js';
import { configFilePath } from '../config/paths.js';
import type { RecmpConfig } from '../config/schema.js';
import { redactKey } from '../log.js';

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

export async function runDoctor(ctx: AgentContext): Promise<void> {
  const checks: Check[] = [];

  // 1. Node version
  const nodeVersion = process.version;
  const [nodeMajor] = nodeVersion.slice(1).split('.').map(Number);
  const nodeOk = nodeMajor >= 20;
  checks.push({
    label: 'Node.js version',
    ok: nodeOk,
    detail: nodeVersion,
    hint: nodeOk
      ? undefined
      : 'Requires Node.js 20+. Visit https://nodejs.org/',
  });

  // 2. Platform
  const platform = process.platform;
  const platformLabels: Record<string, string> = {
    linux: 'Linux',
    darwin: 'macOS',
    win32: 'Windows',
  };
  const platformLabel = platformLabels[platform] ?? platform;
  const platformSupported = ['linux', 'darwin', 'win32'].includes(platform);
  checks.push({
    label: 'Platform',
    ok: platformSupported,
    detail: `${platformLabel} (${process.arch})`,
    hint: platformSupported
      ? undefined
      : `Platform "${platform}" may not be fully supported.`,
  });

  // 3. ffmpeg
  const ffmpegCheck = await checkFfmpegVersion();
  checks.push({
    label: 'ffmpeg',
    ok: ffmpegCheck.meets,
    detail: ffmpegCheck.version,
    hint: ffmpegCheck.meets
      ? undefined
      : 'Requires ffmpeg 4.4+. Install: sudo apt install ffmpeg',
  });

  // 4. Audio backend
  if (ffmpegCheck.meets) {
    const backendFormats: Record<string, string> = {
      linux: 'pulse',
      darwin: 'avfoundation',
      win32: 'dshow',
    };
    const backendFormat = backendFormats[platform] ?? 'pulse';
    const backendOk = await supportsInputFormat(backendFormat).catch(
      () => false
    );
    checks.push({
      label: 'Audio backend',
      ok: backendOk,
      detail: backendFormat,
      hint: backendOk
        ? undefined
        : `ffmpeg missing "${backendFormat}" input support. Reinstall ffmpeg.`,
    });
  }

  // 5. Config file
  const configExists = existsSync(configFilePath);
  checks.push({
    label: 'Config file',
    ok: true,
    detail: configExists
      ? configFilePath
      : `${configFilePath} (using defaults)`,
  });

  // 6. Load config
  let config: RecmpConfig | undefined;
  try {
    config = await loadConfig();
  } catch (err: unknown) {
    checks.push({
      label: 'Config load',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      hint: 'Run: recmp3 config init',
    });
  }

  if (config) {
    const providerName = config.provider.default;

    if (providerName === 'local-whisper') {
      // 7/8. Local whisper: binary + model present (no network)
      const { LocalWhisperProvider } = await import(
        '../transcription/local-whisper.js'
      );
      const provider = new LocalWhisperProvider(config.provider.local ?? {});
      const ping = await provider.ping();
      checks.push({
        label: 'Provider: local-whisper',
        ok: ping.ok,
        detail: ping.ok ? `ready (${ping.latencyMs}ms)` : ping.error,
        hint: ping.ok
          ? undefined
          : 'Set RECMP3_WHISPER_BIN and RECMP3_WHISPER_MODEL.',
      });
    } else {
      // 7. Cloud provider API key
      const apiKey = await getApiKey(providerName);
      const keyOk = Boolean(apiKey);
      checks.push({
        label: `Provider: ${providerName}`,
        ok: keyOk,
        detail: keyOk
          ? `API key set (${redactKey(apiKey!)})`
          : 'API key not set',
        hint: keyOk
          ? undefined
          : `Set ${providerName === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'}, or run: recmp3 config set-key ${providerName}`,
      });

      // 8. Network ping (only if key is set)
      if (keyOk) {
        try {
          const { createProvider } = await import(
            '../transcription/registry.js'
          );
          const provider = await createProvider(config);
          const ping = provider.ping ? await provider.ping() : null;
          if (ping) {
            checks.push({
              label: 'Provider ping',
              ok: ping.ok,
              detail: ping.ok ? `${ping.latencyMs}ms` : ping.error,
              hint: ping.ok
                ? undefined
                : 'Check network connection or API key validity.',
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
    }

    // 9. Recordings directory
    checks.push({
      label: 'Recordings directory',
      ok: true,
      detail: config.output.recordingDir!,
    });
  }

  const allOk = checks.every((c) => c.ok);

  ctx.ok('doctor', { ok: allOk, checks }, () => {
    console.log(`\n${pc.bold('recmp3 doctor — preflight checks')}\n`);
    for (const check of checks) printCheck(check);
    console.log('');
    if (allOk) {
      console.log(
        pc.green('  ✓ All checks passed. Run: recmp3 record --transcribe\n')
      );
    } else {
      console.log(
        pc.yellow(
          '  Some checks failed. Address the issues above and re-run: recmp3 doctor\n'
        )
      );
    }
  });

  if (!allOk) process.exitCode = 1;
}
