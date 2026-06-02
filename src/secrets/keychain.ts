import { log } from '../log.js';

const SERVICE = 'recmp3';

// keytar is an optional native dependency. We load it lazily and degrade gracefully:
// if the native module is missing or fails to build, key storage falls back to
// environment variables only (no crash, single warning).
type Keytar = {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(
    service: string,
    account: string,
    password: string
  ): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

let _keytar: Keytar | null | undefined;
let _warned = false;

async function getKeytar(): Promise<Keytar | null> {
  if (_keytar !== undefined) return _keytar;
  try {
    const mod = (await import('keytar')) as unknown as {
      default?: Keytar;
    } & Keytar;
    _keytar = (mod.default ?? mod) as Keytar;
  } catch {
    _keytar = null;
    if (!_warned) {
      _warned = true;
      log.info(
        'OS keychain (keytar) unavailable — falling back to environment variables.'
      );
    }
  }
  return _keytar;
}

/** True when the OS keychain backend is available on this machine. */
export async function keychainAvailable(): Promise<boolean> {
  return (await getKeytar()) !== null;
}

export async function getSecret(account: string): Promise<string | undefined> {
  const kt = await getKeytar();
  if (!kt) return undefined;
  try {
    return (await kt.getPassword(SERVICE, account)) ?? undefined;
  } catch (err: unknown) {
    log.info(
      `keychain read failed for ${account}: ${err instanceof Error ? err.message : String(err)}`
    );
    return undefined;
  }
}

export async function setSecret(
  account: string,
  value: string
): Promise<boolean> {
  const kt = await getKeytar();
  if (!kt) return false;
  await kt.setPassword(SERVICE, account, value);
  return true;
}

export async function deleteSecret(account: string): Promise<boolean> {
  const kt = await getKeytar();
  if (!kt) return false;
  return kt.deletePassword(SERVICE, account);
}
