import { ExitCode } from '../errors.js';

export interface ManifestFlag {
  name: string;
  type: 'string' | 'boolean' | 'number';
  description: string;
  env?: string;
  default?: string | boolean | number;
}

export interface ManifestCommand {
  name: string;
  /** MCP tool name (snake_case, recmp3_-prefixed) when agentSafe. */
  tool?: string;
  summary: string;
  /** True when the command runs fully non-interactively and is safe to expose via MCP. */
  agentSafe: boolean;
  args?: Array<{ name: string; required: boolean; description: string }>;
  flags: ManifestFlag[];
  stdin: boolean;
  stdout: 'json' | 'text' | 'none';
}

export interface Manifest {
  name: string;
  version: string;
  description: string;
  globalFlags: ManifestFlag[];
  exitCodes: Record<string, number>;
  commands: ManifestCommand[];
}

const GLOBAL_FLAGS: ManifestFlag[] = [
  {
    name: '--json',
    type: 'boolean',
    description: 'Emit a stable JSON envelope on stdout',
    env: 'RECMP3_JSON',
  },
  {
    name: '--yes',
    type: 'boolean',
    description: 'Skip all interactive prompts',
    env: 'RECMP3_YES',
  },
  {
    name: '--quiet',
    type: 'boolean',
    description: 'Suppress stderr chatter',
    env: 'RECMP3_QUIET',
  },
  {
    name: '--no-color',
    type: 'boolean',
    description: 'Disable colored output',
    env: 'NO_COLOR',
  },
];

export const MANIFEST: Manifest = {
  name: 'recmp3',
  version: '1.0.0',
  description:
    'Record audio, transcribe with AI, output developer-ready prompts.',
  globalFlags: GLOBAL_FLAGS,
  exitCodes: {
    success: ExitCode.SUCCESS,
    unknown: ExitCode.UNKNOWN,
    config: ExitCode.CONFIG,
    audio: ExitCode.AUDIO,
    transcription: ExitCode.TRANSCRIPTION,
    network: ExitCode.NETWORK,
    localWhisper: ExitCode.LOCAL_WHISPER,
    input: ExitCode.INPUT,
    userAbort: ExitCode.USER_ABORT,
  },
  commands: [
    {
      name: 'transcribe',
      tool: 'recmp3_transcribe',
      summary: 'Transcribe an existing audio file.',
      agentSafe: true,
      args: [
        {
          name: 'file',
          required: true,
          description: 'Audio file path, or "-" for stdin',
        },
      ],
      flags: [
        {
          name: '--provider',
          type: 'string',
          description: 'groq | openai | local-whisper',
        },
        {
          name: '--lang',
          type: 'string',
          description: 'Force language code (e.g. es, en)',
        },
        {
          name: '--copy',
          type: 'boolean',
          description: 'Copy transcript to clipboard',
        },
      ],
      stdin: true,
      stdout: 'json',
    },
    {
      name: 'prompt',
      tool: 'recmp3_prompt',
      summary: 'Wrap a transcript in a developer prompt template (no network).',
      agentSafe: true,
      args: [
        {
          name: 'file',
          required: true,
          description: 'Transcript file path, or "-" for stdin',
        },
      ],
      flags: [
        {
          name: '--template',
          type: 'string',
          description:
            'claude-code | prd | bug | todo | meeting-notes | commit-message | raw',
          default: 'claude-code',
        },
        {
          name: '--out',
          type: 'string',
          description: 'Write output to a file',
        },
        {
          name: '--copy',
          type: 'boolean',
          description: 'Copy output to clipboard',
        },
      ],
      stdin: true,
      stdout: 'json',
    },
    {
      name: 'sources',
      tool: 'recmp3_sources',
      summary: 'List available audio input sources for the OS.',
      agentSafe: true,
      flags: [],
      stdin: false,
      stdout: 'json',
    },
    {
      name: 'doctor',
      tool: 'recmp3_doctor',
      summary:
        'Run preflight checks (Node, ffmpeg, audio backend, provider, etc.).',
      agentSafe: true,
      flags: [],
      stdin: false,
      stdout: 'json',
    },
    {
      name: 'config show',
      tool: 'recmp3_config_show',
      summary: 'Show resolved configuration (API keys redacted).',
      agentSafe: true,
      flags: [],
      stdin: false,
      stdout: 'json',
    },
    {
      name: 'manifest',
      tool: 'recmp3_manifest',
      summary: 'Print the command/tool manifest.',
      agentSafe: true,
      flags: [],
      stdin: false,
      stdout: 'json',
    },
    {
      name: 'record',
      tool: 'recmp3_record',
      summary: 'Record audio. Agent/headless mode requires --duration.',
      agentSafe: true,
      flags: [
        {
          name: '--duration',
          type: 'number',
          description: 'Headless: record N seconds then stop',
        },
        { name: '--name', type: 'string', description: 'Output filename stem' },
        { name: '--out', type: 'string', description: 'Output directory' },
        {
          name: '--transcribe',
          type: 'boolean',
          description: 'Transcribe after recording',
        },
        {
          name: '--provider',
          type: 'string',
          description: 'groq | openai | local-whisper',
        },
        { name: '--lang', type: 'string', description: 'Force language code' },
        {
          name: '--source',
          type: 'string',
          description: 'Audio source id, or "auto" for the best physical mic',
        },
      ],
      stdin: false,
      stdout: 'json',
    },
    {
      name: 'config init',
      summary: 'First-time setup. Flag-driven when non-interactive.',
      agentSafe: false,
      flags: [
        {
          name: '--provider',
          type: 'string',
          description: 'groq | openai | local-whisper',
        },
        {
          name: '--lang',
          type: 'string',
          description: 'Default language code',
        },
        {
          name: '--outdir',
          type: 'string',
          description: 'Recordings output directory',
        },
        {
          name: '--key',
          type: 'string',
          description: 'API key to store in the OS keychain',
        },
      ],
      stdin: false,
      stdout: 'none',
    },
    {
      name: 'config set-key',
      summary: 'Store an API key in the OS keychain.',
      agentSafe: false,
      args: [
        { name: 'provider', required: true, description: 'groq | openai' },
      ],
      flags: [
        {
          name: '--key',
          type: 'string',
          description: 'Key value (else stdin or *_API_KEY env)',
        },
      ],
      stdin: true,
      stdout: 'none',
    },
    {
      name: 'mcp',
      summary: 'Start the Model Context Protocol server over stdio.',
      agentSafe: false,
      flags: [],
      stdin: true,
      stdout: 'none',
    },
  ],
};

export function agentTools(): ManifestCommand[] {
  return MANIFEST.commands.filter((c) => c.agentSafe && c.tool);
}
