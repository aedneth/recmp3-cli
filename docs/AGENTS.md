# Using recmp3 from AI agents

`recmp3` is a first-class tool for terminal AI agents (Claude Code, Codex, Gemini CLI,
Hermes, OpenClaw, OpenCode, DeepSeek) as well as plain shell scripts. Every interactive
flow has a fully non-interactive equivalent: no command requires a TTY in agent mode.

## The three things every agent needs

1. **`--json`** — emit a stable JSON envelope on stdout (or set `RECMP3_JSON=1`).
2. **`--yes`** — skip every prompt, including upload consent (or set `RECMP3_YES=1`).
3. **Deterministic exit codes** — see the table below.

## JSON envelope

Every command emits exactly one envelope on stdout in `--json` mode:

```jsonc
// success
{ "ok": true, "command": "transcribe", "schemaVersion": 1, "data": { /* ... */ } }
// failure
{ "ok": false, "command": "transcribe", "schemaVersion": 1,
  "error": { "code": "INPUT_ERROR", "message": "File not found: x.wav", "exitCode": 7 } }
```

Progress/diagnostic text goes to **stderr** (suppress it with `--quiet`); results go to
**stdout**, so pipes stay clean.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | success |
| 1 | unknown / unexpected error |
| 2 | config / usage error |
| 3 | audio capture / ffmpeg |
| 4 | transcription (cloud provider) |
| 5 | network |
| 6 | local whisper (binary/model) |
| 7 | input / file-not-found / bad argument |
| 130 | user abort (SIGINT) |

## Discovery

```bash
recmp3 manifest --json     # full command/tool surface, flags, exit codes
```

## Composability (stdin/stdout)

```bash
# transcribe → template, fully piped
recmp3 transcribe meeting.wav --json --yes \
  | jq -r .data.text \
  | recmp3 prompt - --template prd

# pipe audio bytes in, transcript text out
cat clip.wav | recmp3 transcribe - --yes
```

## Headless recording

The Ink TUI is replaced by a headless capture path whenever stdout is not a TTY, when
`--json` is set, or when `--duration` is given:

```bash
recmp3 record --duration 5 --json --yes        # record 5s, emit envelope
```

## MCP server

`recmp3` ships a Model Context Protocol server over stdio. Point any MCP client at it:

```jsonc
// e.g. Claude Code / Codex MCP config
{
  "mcpServers": {
    "recmp3": { "command": "recmp3", "args": ["mcp"] }
  }
}
```

Exposed tools: `recmp3_transcribe`, `recmp3_prompt`, `recmp3_sources`, `recmp3_doctor`,
`recmp3_config_show`, `recmp3_record` (requires `duration`), `recmp3_manifest`. Each tool
returns the same JSON envelope as the CLI.

## Credentials without prompts

```bash
export GROQ_API_KEY=gsk_...          # env var (highest precedence), or
recmp3 config set-key groq --key gsk_...   # store in the OS keychain
```

For fully local, no-upload transcription, point recmp3 at a whisper.cpp build:

```bash
export RECMP3_WHISPER_BIN=/usr/local/bin/whisper-cli
export RECMP3_WHISPER_MODEL=/models/ggml-base.en.bin
recmp3 transcribe clip.wav --provider local-whisper --json
```
