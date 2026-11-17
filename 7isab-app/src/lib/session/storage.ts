/**
 * Session secrets on the device: the API token, the unlocked data key and
 * the cached account. Native: Keychain / Keystore (expo-secure-store).
 * Web: localStorage (development only; not secure).
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AccountUser } from '@/lib/api/auth';

const KEYS = {
  token: 'hisab.session.token',
  dataKey: 'hisab.session.data_key',
  /** The data key stored so it can only be read after a fingerprint / Face ID check. */
  protectedDataKey: 'hisab.session.data_key_bio',
  user: 'hisab.session.user',
} as const;

/** Per-device choice: keep the data key behind a fingerprint check. */
const PROTECT_KEY_PREF = 'hisab.session.protect_key';

export type StoredSession = {
  token: string;
  /** Base64 data key. */
  dataKey: string;
  user: AccountUser;
};

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function setValue(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, secureOptions);
}

async function getValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key, secureOptions);
}

async function deleteValue(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key, secureOptions);
}

export function isKeyProtected(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return SecureStore.getItem(PROTECT_KEY_PREF) === '1';
  } catch {
    return false;
  }
}

async function saveDataKey(dataKey: string): Promise<void> {
  if (isKeyProtected()) {
    await SecureStore.setItemAsync(KEYS.protectedDataKey, dataKey, { ...secureOptions, requireAuthentication: true });
    await deleteValue(KEYS.dataKey);
  } else {
    await setValue(KEYS.dataKey, dataKey);
  }
}

/**
 * Turns fingerprint protection of the stored data key on or off. Throws if
 * the fingerprint check fails (the setting is then left unchanged).
 */
export async function setKeyProtection(enabled: boolean, dataKey: string, prompt: string): Promise<void> {
  if (Platform.OS === 'web') return;
  if (enabled) {
    await SecureStore.setItemAsync(KEYS.protectedDataKey, dataKey, {
      ...secureOptions,
      requireAuthentication: true,
      authenticationPrompt: prompt,
    });
    SecureStore.setItem(PROTECT_KEY_PREF, '1');
    await deleteValue(KEYS.dataKey);
  } else {
    await setValue(KEYS.dataKey, dataKey);
    SecureStore.setItem(PROTECT_KEY_PREF, '0');
    await SecureStore.deleteItemAsync(KEYS.protectedDataKey, secureOptions).catch(() => undefined);
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await setValue(KEYS.token, session.token);
  await saveDataKey(session.dataKey);
  await setValue(KEYS.user, JSON.stringify(session.user));
}

export type LoadedSession = StoredSession | { locked: true } | null;

/**
 * The saved session. When the data key is fingerprint-protected this shows the
 * system prompt; if the check fails or is cancelled, returns { locked: true }
 * (call again to retry).
 */
export async function loadSessionWithPrompt(prompt: string): Promise<LoadedSession> {
  if (!isKeyProtected()) return loadSession();
  const [token, user] = await Promise.all([getValue(KEYS.token), getValue(KEYS.user)]);
  if (!token || !user) return null;
  let dataKey: string | null;
  try {
    dataKey = await SecureStore.getItemAsync(KEYS.protectedDataKey, {
      ...secureOptions,
      requireAuthentication: true,
      authenticationPrompt: prompt,
    });
  } catch {
    return { locked: true };
  }
  if (!dataKey) return null;
  try {
    return { token, dataKey, user: JSON.parse(user) as AccountUser };
  } catch {
    return null;
  }
}

export async function saveUser(user: AccountUser): Promise<void> {
  await setValue(KEYS.user, JSON.stringify(user));
}

export async function loadSession(): Promise<StoredSession | null> {
  const [token, dataKey, user] = await Promise.all([getValue(KEYS.token), getValue(KEYS.dataKey), getValue(KEYS.user)]);

  if (!token || !dataKey || !user) return null;

  try {
    return { token, dataKey, user: JSON.parse(user) as AccountUser };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((key) => deleteValue(key).catch(() => undefined)));
  if (Platform.OS !== 'web') SecureStore.setItem(PROTECT_KEY_PREF, '0');
}
