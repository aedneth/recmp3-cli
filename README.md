# recmp3-cli

[![CI](https://github.com/aedneth/recmp3-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/aedneth/recmp3-cli/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![version](https://img.shields.io/badge/version-0.2.0-blue)](https://github.com/aedneth/recmp3-cli/releases)

Record audio from any terminal, transcribe with Groq Whisper, get developer-ready output.
A first-class tool for **both humans and terminal AI agents** — every interactive flow has a
fully non-interactive, JSON-emitting equivalent, plus a built-in MCP server.

```
recmp3 record --name "my standup"
recmp3 prompt standup.wav --template claude-code | pbcopy
```

## What it does

- **Records** audio with pause/resume using an Ink TUI (runs in your current terminal — no popup windows)
- **Transcribes** via Groq `whisper-large-v3-turbo` (or OpenAI Whisper)
- **Formats** output with 7 developer templates: `claude-code`, `prd`, `bug`, `meeting-notes`, `todo`, `commit-message`, `raw`
- **Cross-platform:** Linux (PulseAudio/PipeWire), macOS (AVFoundation), Windows (DirectShow)
- **Agent-native:** global `--json` envelopes, `--yes`, deterministic exit codes, stdin/stdout piping, a discoverable `manifest`, and an MCP server — see [Agent & scripting use](#agent--scripting-use)
- **Local option:** `--provider local-whisper` transcribes on-device via whisper.cpp (no upload)

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
recmp3 config init          # Setup (interactive, or flag-driven: --provider/--lang/--outdir/--key)
recmp3 config show          # Display current config (API key redacted)
recmp3 config path          # Print config file path
recmp3 config set <k> <v>   # Set a config key
recmp3 config set-key groq --key gsk_...   # Store an API key in the OS keychain
```

## Agent & scripting use

Every command is usable by AI agents (Claude Code, Codex, Gemini CLI, …) and shell scripts
with no TTY and no prompts. See [`docs/AGENTS.md`](docs/AGENTS.md) for the full reference.

```bash
# Stable JSON envelope on stdout; chatter on stderr
recmp3 transcribe meeting.wav --json --yes | jq -r .data.text

# Compose via pipes: transcribe → template
recmp3 transcribe meeting.wav --json --yes | jq -r .data.text | recmp3 prompt - --template prd

# Headless recording (no Ink TUI)
recmp3 record --duration 5 --json --yes

# Discover the command/tool surface
recmp3 manifest --json
```

**Exit codes:** `0` success · `1` unknown · `2` config · `3` audio/ffmpeg · `4` transcription ·
`5` network · `6` local-whisper · `7` input · `130` user abort.

### MCP server

`recmp3` ships a Model Context Protocol server over stdio. Register it with any MCP client:

```jsonc
{ "mcpServers": { "recmp3": { "command": "recmp3", "args": ["mcp"] } } }
```

Tools: `recmp3_transcribe`, `recmp3_prompt`, `recmp3_sources`, `recmp3_doctor`,
`recmp3_config_show`, `recmp3_record`, `recmp3_manifest`.

### Local, no-upload transcription

```bash
export RECMP3_WHISPER_BIN=/usr/local/bin/whisper-cli   # whisper.cpp binary
export RECMP3_WHISPER_MODEL=/models/ggml-base.en.bin
recmp3 transcribe clip.wav --provider local-whisper --json
```

## Use Cases

### Transcribe Instagram reels, TikToks, or any system audio (`recwatch`)

Capture the audio your speakers are playing — useful for transcribing reels, TikToks, YouTube clips, podcasts, or any video in your browser without re-recording with the mic. Linux + PulseAudio/PipeWire only; the source name below is the monitor of your default output sink (find yours via `recmp3 sources` or `pactl list short sources`).

```bash
alias recwatch='RECMP3_SOURCE="alsa_output.platform-avs_hdaudio.0.stereo-fallback.monitor" recmp3 record --transcribe -y'
```

1. Add the alias above to `~/.bashrc` and `source ~/.bashrc`.
2. Open the Instagram reel / TikTok / video in your browser.
3. Run `recwatch` — it starts recording your system audio output.
4. Watch the video; the audio plays through your speakers and is captured.
5. Press `s` to stop → auto-transcribes via Groq Whisper → transcript prints to terminal and is copied to your clipboard.

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
| `RECMP3_WHISPER_BIN` | Path to a whisper.cpp binary (for `local-whisper`) |
| `RECMP3_WHISPER_MODEL` | Path to a GGML model file (for `local-whisper`) |
| `RECMP3_JSON` | `1` to always emit JSON envelopes |
| `RECMP3_YES` | `1` to skip all prompts |
| `RECMP3_QUIET` | `1` to suppress stderr chatter |
| `RECMP3_SKIP_CONSENT` | `1` to skip upload consent prompt |

## Providers

| Provider | Default model | Max file size | Upload |
|---|---|---|---|
| Groq | `whisper-large-v3-turbo` | 25 MB | yes |
| OpenAI | `whisper-1` | 25 MB | yes |
| local-whisper | whisper.cpp GGML model | unlimited | **no (on-device)** |

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
