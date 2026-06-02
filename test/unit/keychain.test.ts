import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory keytar mock so tests never touch the real OS keychain.
const store = new Map<string, string>();
vi.mock('keytar', () => ({
  default: {
    getPassword: async (service: string, account: string) => store.get(`${service}:${account}`) ?? null,
    setPassword: async (service: string, account: string, password: string) => {
      store.set(`${service}:${account}`, password);
    },
    deletePassword: async (service: string, account: string) => store.delete(`${service}:${account}`),
  },
}));

import { getApiKey } from '../../src/config/load.js';
import { getSecret, setSecret } from '../../src/secrets/keychain.js';

describe('keychain + getApiKey precedence', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    store.clear();
  });

  afterEach(() => {
    process.env = original;
  });

  it('stores and reads a secret through the keychain', async () => {
    await setSecret('GROQ_API_KEY', 'gsk_keychain');
    expect(await getSecret('GROQ_API_KEY')).toBe('gsk_keychain');
  });

  it('environment variable takes precedence over the keychain', async () => {
    await setSecret('GROQ_API_KEY', 'gsk_keychain');
    process.env.GROQ_API_KEY = 'gsk_env';
    expect(await getApiKey('groq')).toBe('gsk_env');
  });

  it('falls back to the keychain when the env var is unset', async () => {
    await setSecret('OPENAI_API_KEY', 'sk_keychain');
    expect(await getApiKey('openai')).toBe('sk_keychain');
  });

  it('returns undefined when neither source has a key', async () => {
    expect(await getApiKey('groq')).toBeUndefined();
  });
});
