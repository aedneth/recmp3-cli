# TODO — recmp3-cli

## v0.1.0 ✅ shipped 2026-05-10

- [x] Project scaffold (package.json, tsconfig, tsup, biome)
- [x] Error class hierarchy (`src/errors.ts`)
- [x] Logger with API key redaction (`src/log.ts`)
- [x] Config schema (Zod) + XDG paths + env overrides
- [x] ffmpeg detection + version check (`src/audio/ffmpeg.ts`)
- [x] Linux PulseAudio backend (`src/audio/linux-pulse.ts`)
- [x] macOS AVFoundation backend (`src/audio/mac-avfoundation.ts`)
- [x] Windows DirectShow backend (`src/audio/windows-dshow.ts`)
- [x] Segment concat (`src/audio/concat.ts`)
- [x] Groq provider (`src/transcription/groq.ts`)
- [x] OpenAI provider (`src/transcription/openai.ts`)
- [x] Chunking for >25MB files (`src/transcription/chunking.ts`)
- [x] Output: filename generation, transcript writer, clipboard copy
- [x] Ink TUI recorder (pause/resume/save/cancel, Ctrl+C)
- [x] Upload consent flow (`src/consent.ts`)
- [x] `recmp3 record` command
- [x] `recmp3 transcribe` command
- [x] `recmp3 prompt` command (7 templates)
- [x] `recmp3 sources` command
- [x] `recmp3 config` command (init/show/set/path)
- [x] `recmp3 doctor` command (8 checks)
- [x] `npm link` global install verified
- [x] Old bash script backed up (`~/.local/bin/recmp3.bash.bak`)
- [x] Unit tests: filenames (10), config (5), groq provider (4) — 19/19 passing
- [x] CKIS documentation: `02-projects/recmp3-cli/_overview.md` created
- [x] CKIS documentation: `04-resources/tools/pop-os-audio-mp3-ffmpeg.md` superseded

## v0.2.0

- [ ] OS keychain storage via `keytar` (API keys currently env-var only)
- [ ] `recmp3 config init` — store key in keychain instead of instructing user to set env var
- [ ] Local Whisper backend (no upload) — add `LocalWhisperProvider` class
- [ ] `recmp3 sources` — auto-detect physical mic vs `default` virtual device (mark physical as recommended)
- [ ] Integration test: full record → transcribe → prompt pipeline with mock ffmpeg
- [ ] `recmp3 record --watch` — continuous recording mode (auto-split by silence)
- [ ] Publish to npm

## Backlog / ideas

- [ ] `--output-format md` — Markdown transcript with timestamp annotations from segments
- [ ] `recmp3 replay <file>` — play back a recording with transcript overlay
- [ ] Korvex integration: meeting notes template auto-routes to vault via CKIS process-inbox
- [ ] Multi-language auto-detect (remove need for `--language` flag in most cases)
- [ ] Self-update via `recmp3 update` (npm global update wrapper)
