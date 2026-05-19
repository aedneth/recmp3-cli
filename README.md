# recmp3-cli

[![CI](https://github.com/aedneth/recmp3-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/aedneth/recmp3-cli/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/aedneth/recmp3-cli/releases)

Record audio from any terminal, transcribe with Groq Whisper, get developer-ready output.

```
recmp3 record --name "my standup"
recmp3 prompt standup.wav --template claude-code | pbcopy
```

## What it does

- **Records** audio with pause/resume using an Ink TUI (runs in your current terminal — no popup windows)
- **Transcribes** via Groq `whisper-large-v3-turbo` (or OpenAI Whisper)
- **Formats** output with 7 developer templates: `claude-code`, `prd`, `bug`, `meeting-notes`, `todo`, `commit-message`, `raw`
- **Cross-platform:** Linux (PulseAudio/PipeWire), macOS (AVFoundation), Windows (DirectShow)

## Requirements

- Node.js ≥ 20
- ffmpeg ≥ 4.4 (`sudo apt install ffmpeg` / `brew install ffmpeg`)
- A Groq API key (free tier works) — get one at console.groq.com

## Installation

```bash
git clone https://github.com/aedneth/recmp3-cli
cd recmp3-cli
npm install
npm run build
npm link
```

Then set your API key:

```bash
echo 'export GROQ_API_KEY=gsk_...' >> ~/.bashrc
source ~/.bashrc
```

Verify the install:

```bash
recmp3 doctor
```

## Commands

### `recmp3 record`

```
recmp3 record [options]

Options:
  -n, --name <name>        Recording name (used in filename)
  -s, --source <id>        Audio source ID (default: "default")
  -o, --outdir <dir>       Output directory
  -t, --template <name>    Prompt template to apply after transcription
  --no-transcribe          Skip transcription step
  --no-clipboard           Don't copy result to clipboard
  -y, --yes                Skip upload consent prompt
```

Controls while recording:
- `p` or Space — pause / resume
- `s` or Enter — save and finish
- `c` or Escape — cancel (discard recording)
- Ctrl+C — cancel

### `recmp3 transcribe <file>`

Transcribe an existing audio file. Outputs transcript text to stdout (pipeable).

```bash
recmp3 transcribe meeting.wav --template prd > meeting-prd.md
```

### `recmp3 prompt <file>`

Apply a developer template to a transcript or text file. No network call — purely deterministic formatting.

```bash
recmp3 prompt transcript.txt --template claude-code
recmp3 prompt transcript.txt --list-templates
```

**Available templates:** `raw`, `claude-code`, `prd`, `bug`, `meeting-notes`, `todo`, `commit-message`

### `recmp3 sources`

List available audio input devices for the current platform.

```bash
recmp3 sources
recmp3 sources --json
```

### `recmp3 doctor`

Run 8 system checks: Node version, platform support, ffmpeg version, audio backend, config file, API key, provider connectivity, and recordings directory.

### `recmp3 config`

```bash
recmp3 config init          # Interactive setup wizard
recmp3 config show          # Display current config (API key redacted)
recmp3 config path          # Print config file path
recmp3 config set <k> <v>  # Set a config key
```

## Configuration

Config file location:
- Linux: `~/.config/recmp3/config.json`
- macOS: `~/Library/Preferences/recmp3/config.json`
- Windows: `%APPDATA%\recmp3\config.json`

Environment variables override config file values:

| Variable | Effect |
|---|---|
| `GROQ_API_KEY` | Groq API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `RECMP3_PROVIDER` | `groq` or `openai` |
| `RECMP3_MODEL` | Override transcription model |
| `RECMP3_SOURCE` | Default audio source |
| `RECMP3_FFMPEG_PATH` | Path to ffmpeg binary |
| `RECMP3_OUTDIR` | Default recordings output directory |
| `RECMP3_LANG` | Default language hint (e.g. `es`, `en`) |
| `RECMP3_SKIP_CONSENT` | `1` to skip upload consent prompt |

## Providers

| Provider | Default model | Max file size |
|---|---|---|
| Groq | `whisper-large-v3-turbo` | 25 MB |
| OpenAI | `whisper-1` | 25 MB |

Audio is captured as WAV 16kHz mono (~1 MB/min), so the 25 MB limit covers ~25 minutes per recording. Longer recordings are chunked automatically.

## Development

```bash
npm run dev           # Run with tsx (no build step)
npm run build         # Build to dist/
npm run typecheck     # TypeScript check
npm run lint          # Biome lint
npm test              # Run test suite
npm run test:watch    # Watch mode
```

## License

`recmp3-cli` is dual-licensed:

- **[AGPL-3.0](LICENSE)** — free for personal use and open source projects
- **[Commercial license](LICENSE-COMMERCIAL.md)** — required for proprietary/commercial use

Contact **eduardoa.borjas@gmail.com** to purchase a commercial license.
