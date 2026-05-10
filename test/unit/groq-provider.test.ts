import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GroqProvider } from '../../src/transcription/groq.js';
import { writeFile, rm, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';

const server = setupServer(
  http.post(GROQ_URL, () =>
    HttpResponse.json({
      text: 'Hello world from mock.',
      language: 'en',
      duration: 3.5,
      segments: [{ start: 0, end: 3.5, text: 'Hello world from mock.' }],
    }),
  ),
  http.get(GROQ_MODELS_URL, () => HttpResponse.json({ data: [] })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('GroqProvider.transcribe', () => {
  it('returns text and segments from API response', async () => {
    const provider = new GroqProvider({
      apiKey: 'gsk_test',
      model: 'whisper-large-v3-turbo',
    });

    const tmpDir = await mkdtemp(join(tmpdir(), 'recmp3-test-'));
    const audioPath = join(tmpDir, 'test.wav');
    // Write minimal WAV header (44 bytes) so readFile succeeds
    const wavHeader = Buffer.alloc(44);
    wavHeader.write('RIFF', 0);
    wavHeader.write('WAVE', 8);
    await writeFile(audioPath, wavHeader);

    const result = await provider.transcribe({ audioPath });
    expect(result.text).toBe('Hello world from mock.');
    expect(result.language).toBe('en');
    expect(result.durationSec).toBe(3.5);
    expect(result.segments).toHaveLength(1);
    expect(result.provider).toBe('groq');

    await rm(tmpDir, { recursive: true });
  });

  it('throws TranscriptionError on non-ok response', async () => {
    server.use(
      http.post(GROQ_URL, () =>
        HttpResponse.json({ error: { message: 'Invalid API key' } }, { status: 401 }),
      ),
    );

    const provider = new GroqProvider({ apiKey: 'bad-key', model: 'whisper-large-v3-turbo' });
    const tmpDir = await mkdtemp(join(tmpdir(), 'recmp3-test-'));
    const audioPath = join(tmpDir, 'test.wav');
    await writeFile(audioPath, Buffer.alloc(44));

    await expect(provider.transcribe({ audioPath })).rejects.toThrow('401');

    await rm(tmpDir, { recursive: true });
  });
});

describe('GroqProvider.ping', () => {
  it('returns ok:true when models endpoint responds 200', async () => {
    const provider = new GroqProvider({ apiKey: 'gsk_test', model: 'whisper-large-v3-turbo' });
    const result = await provider.ping();
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns ok:false when models endpoint fails', async () => {
    server.use(
      http.get(GROQ_MODELS_URL, () => HttpResponse.json({}, { status: 403 })),
    );
    const provider = new GroqProvider({ apiKey: 'bad-key', model: 'whisper-large-v3-turbo' });
    const result = await provider.ping();
    expect(result.ok).toBe(false);
  });
});
