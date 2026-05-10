# AI-RULES.md — recmp3-cli

Rules for AI agents (Claude Code, Codex, Gemini CLI, etc.) working in this repo.

## Architecture invariants

- **ESM only.** `"type": "module"` in package.json. All imports must use `.js` extensions. No CommonJS `require()`.
- **Node.js 20+.** Use native `fetch`, `FormData`, `Blob`, `AbortSignal.timeout()` — no polyfills.
- **No new runtime dependencies** without explicit approval. Current dep count is intentionally minimal.
- **tsup is the bundler.** Do not introduce webpack, rollup, esbuild directly, or vite.
- **No `any`.** TypeScript strict mode is on. Use `unknown` and narrow — do not cast to `any`.

## Provider abstraction (do not break)

All transcription goes through `TranscriptionProvider` in `src/transcription/types.ts`. Adding a new provider = new class implementing that interface + entry in `src/transcription/registry.ts`. Never call a provider API directly from a command file.

## Audio capture abstraction (do not break)

Platform audio backends live in `src/audio/`. `getAudioFactory()` in `src/audio/capture.ts` lazy-imports the right one. Never reference `LinuxPulseCapture` / `MacAvFoundationCapture` / `WindowsDshowCapture` directly from commands.

## Error handling

All user-facing errors go through the typed error classes in `src/errors.ts`. Each class has a specific `exitCode`. Don't `process.exit()` directly from business logic — throw the appropriate error class and let `handleError()` in `src/index.ts` catch it.

## Security rules

- **No secrets in source.** API keys come from env vars only. No `.env` files committed. No keys in `config.json`.
- **No `shell: true`** in `spawn`/`exec` calls. Use `execFile` (not `exec`) with an explicit args array to prevent command injection. FFmpeg args must be built from validated inputs.
- **Upload consent.** Any code path that sends audio to a cloud API must go through `src/consent.ts` first.
- **No logging of full API keys.** Use `redactKey()` from `src/log.ts`.

## Testing

- Test files go in `test/unit/`. Use vitest + msw for HTTP mocking.
- Network calls in tests **must** be intercepted by msw — no real API calls in CI.
- `resetConfigCache()` must be called in `beforeEach`/`afterEach` when testing config.

## What not to change without discussion

- `src/tui/recorder.tsx` keyboard bindings — they are designed to avoid conflicts with Flow Clock / terminal shortcuts.
- WAV capture parameters (16kHz, mono, pcm_s16le) — optimized for Whisper, changing these affects transcription quality.
- Exit codes in `src/errors.ts` — consumers may script against them.
- The `--yes` / `RECMP3_SKIP_CONSENT` consent bypass — required for CI/scripting use cases.
