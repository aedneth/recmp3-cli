import { z } from 'zod';

export const RecmpConfigSchema = z.object({
  version: z.literal(1).default(1),
  provider: z
    .object({
      default: z.enum(['groq', 'openai', 'local-whisper']).default('groq'),
      groq: z
        .object({
          model: z.string().default('whisper-large-v3-turbo'),
          baseUrl: z.string().optional(),
          timeoutMs: z.number().optional(),
        })
        .optional(),
      openai: z
        .object({
          model: z.string().default('whisper-1'),
          baseUrl: z.string().optional(),
          timeoutMs: z.number().optional(),
        })
        .optional(),
      local: z
        .object({
          binPath: z.string().optional(),
          modelPath: z.string().optional(),
          language: z.string().optional(),
        })
        .optional(),
    })
    .default({}),
  audio: z
    .object({
      source: z.string().default('default'),
      sampleRate: z.literal(16000).default(16000),
      channels: z.literal(1).default(1),
      format: z.literal('wav').default('wav'),
    })
    .default({}),
  output: z
    .object({
      recordingDir: z.string().optional(),
      namePrefix: z.string().default('rec'),
      keepAudio: z.boolean().default(true),
      saveTranscriptToFile: z.boolean().default(true),
    })
    .default({}),
  transcription: z
    .object({
      defaultLanguage: z.string().optional(),
      chunking: z
        .object({
          enabled: z.boolean().default(true),
          chunkSeconds: z.number().default(600),
        })
        .default({}),
    })
    .default({}),
  ui: z
    .object({
      clipboardOnTranscribe: z.boolean().default(true),
      printOnTranscribe: z.boolean().default(true),
      color: z.enum(['auto', 'always', 'never']).default('auto'),
    })
    .default({}),
  consent: z
    .object({
      uploadsAcknowledged: z.boolean().default(false),
      acknowledgedAt: z.string().optional(),
    })
    .default({}),
});

export type RecmpConfig = z.infer<typeof RecmpConfigSchema>;
