# Changelog

All notable changes are documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-06-02

### Added

- **Agent-native layer** — every command works fully non-interactively for AI agents and scripts:
  - Global `--json` flag (and `RECMP3_JSON=1`) emits a stable, versioned JSON envelope on stdout.
  - Global `--yes` (and `RECMP3_YES=1`) skips all prompts; global `--quiet` and `--no-color`.
  - Documented, deterministic POSIX exit-code contract (0/1/2/3/4/5/6/7/130).
  - `stdin`/`stdout` composability: `transcribe -` reads audio from stdin, `prompt -` reads text from stdin.
- `recmp3 manifest` — discoverable command/tool manifest (`--json` for machine form).
- `recmp3 mcp` — Model Context Protocol server over stdio exposing `recmp3_*` tools.
- Headless recording — `recmp3 record --duration <s>` / `--no-tui` capture without the Ink TUI.
- Non-interactive `recmp3 config init` (flag-driven) and new `recmp3 config set-key` (OS keychain).
- **Local Whisper backend** — `--provider local-whisper` runs a whisper.cpp binary with no upload.
- **OS keychain key storage** via `keytar` (env vars still take precedence; graceful fallback).
- Expanded vitest + msw test suite; CI now runs tests on an OS matrix (Linux/macOS/Windows × Node 20/22).
- `release.yml` workflow to publish to npm on `v*` tags; `docs/AGENTS.md` agent-integration guide.

### Fixed

- `package.json` license corrected from `MIT` to `AGPL-3.0-or-later` to match the LICENSE file.
- Added `.gitattributes` (`* text=auto eol=lf`) and `biome.json` `lineEnding: lf` to fix Windows CI (CRLF/LF mismatch caused Biome format check to fail on all Windows matrix jobs).

### Changed

- `getApiKey` and provider construction are now async (keychain-aware). Internal only; CLI behavior unchanged.

## [0.1.0] — 2026-05-10

### Added

- `recmp3 record` — capture audio from terminal with Ink TUI (pause/resume/cancel controls)
- `recmp3 transcribe <file>` — transcribe an existing audio file; output to stdout (pipeable)
- `recmp3 prompt <file>` — apply a developer template to a transcript or text file (no network call)
- `recmp3 sources` — list available audio input devices; `--json` flag for machine-readable output
- `recmp3 doctor` — 8-check system diagnostic (Node, platform, ffmpeg, audio backend, config, API key, provider connectivity, recordings dir)
- `recmp3 config` — interactive setup wizard + `set`, `show`, `path` subcommands
- 7 output templates: `claude-code`, `prd`, `bug`, `meeting-notes`, `todo`, `commit-message`, `raw`
- Groq `whisper-large-v3-turbo` as primary transcription provider (free tier supported)
- OpenAI `whisper-1` as fallback provider
- Cross-platform audio capture: Linux (PulseAudio/PipeWire via ffmpeg), macOS (AVFoundation), Windows (DirectShow)
- Automatic chunking for recordings exceeding 25 MB provider limit (~25 min at 16kHz mono)
- Per-platform config file location (`~/.config/recmp3/` on Linux, etc.)
- Full environment variable override for all config values
