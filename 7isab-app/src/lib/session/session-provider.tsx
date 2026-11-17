import * as Device from 'expo-device';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import * as AuthApi from '@/lib/api/auth';
import type { AccountUser } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { base64ToBytes, bytesToBase64 } from '@/lib/crypto/encoding';
import {
  deriveKeys,
  generateDataKey,
  generateRecoveryKey,
  lockDataKey,
  newKdfParams,
  normalizeRecoveryKey,
  unlockDataKey,
} from '@/lib/crypto/keys';

import { closeVault } from '@/lib/data/vault';
import { resetAppLock } from '@/lib/lock/app-lock';

import i18n from '@/i18n';

import {
  clearSession,
  loadSessionWithPrompt,
  saveSession,
  type LoadedSession,
  saveUser,
  setKeyProtection as storeKeyProtection,
} from './storage';

/** 'keyLocked': signed in, but the fingerprint check that protects the data key failed or was cancelled. */
export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'keyLocked';

/**
 * What sign-in / sign-up is doing, for the UI:
 * 'keys' = deriving encryption keys (progress 0..1), 'server' = waiting for the server.
 */
export type AuthProgress = { stage: 'keys'; progress: number } | { stage: 'server' };
export type ProgressCallback = (progress: AuthProgress) => void;

type SessionContextValue = {
  status: SessionStatus;
  user: AccountUser | null;
  token: string | null;
  /** Shown once after signup until the user confirms they saved it. */
  pendingRecoveryKey: string | null;
  signIn: (email: string, password: string, onProgress?: ProgressCallback) => Promise<void>;
  signUp: (name: string, email: string, password: string, onProgress?: ProgressCallback) => Promise<void>;
  acknowledgeRecoveryKey: () => void;
  signOut: () => Promise<void>;
  /** The unlocked data key (only while signed in). */
  getDataKey: () => Uint8Array | null;
  /** Retries the fingerprint check when the status is 'keyLocked'. */
  retryUnlock: () => Promise<void>;
  /** Forgot password: unlocks the data key with the recovery key, sets a new password, signs in. */
  recover: (email: string, recoveryKey: string, newPassword: string, onProgress?: ProgressCallback) => Promise<void>;
  /** Re-locks the data key with a new password (other devices are signed out). */
  changePassword: (currentPassword: string, newPassword: string, onProgress?: ProgressCallback) => Promise<void>;
  /** Makes a new recovery key (shown once, like at signup); the old one stops working. */
  replaceRecoveryKey: (password: string, onProgress?: ProgressCallback) => Promise<void>;
  /** Keeps the data key on this phone behind a fingerprint check. */
  setKeyProtection: (enabled: boolean) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function deviceName(): string {
  return Device.modelName ?? Device.deviceName ?? 'Phone';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<AccountUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<string | null>(null);
  const dataKeyRef = useRef<Uint8Array | null>(null);

  const reset = useCallback(async () => {
    dataKeyRef.current?.fill(0);
    dataKeyRef.current = null;
    setToken(null);
    setUser(null);
    setPendingRecoveryKey(null);
    setStatus('signedOut');
    resetAppLock();
    await closeVault();
    await clearSession();
  }, []);

  // Restore the session saved on this device, then refresh the account in the background.
  const applyStored = useCallback(
    async (stored: LoadedSession) => {
      if (!stored) {
        setStatus('signedOut');
        return;
      }
      if ('locked' in stored) {
        setStatus('keyLocked');
        return;
      }

      dataKeyRef.current = base64ToBytes(stored.dataKey);
      setToken(stored.token);
      setUser(stored.user);
      setStatus('signedIn');

      try {
        const { user: fresh } = await AuthApi.me(stored.token);
        setUser(fresh);
        await saveUser(fresh);
      } catch (error) {
        // Offline is fine (the app works offline). A revoked token or
        // disabled account signs the device out.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await reset();
        }
      }
    },
    [reset],
  );

  useEffect(() => {
    let cancelled = false;
    void loadSessionWithPrompt(i18n.t('lock.biometricPrompt')).then((stored) => {
      if (!cancelled) void applyStored(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [applyStored]);

  const retryUnlock = useCallback(async () => {
    await applyStored(await loadSessionWithPrompt(i18n.t('lock.biometricPrompt')));
  }, [applyStored]);

  const finishSignIn = useCallback(async (result: AuthApi.AuthResult, dataKey: Uint8Array) => {
    await saveSession({ token: result.token, dataKey: bytesToBase64(dataKey), user: result.user });
    dataKeyRef.current = dataKey;
    setToken(result.token);
    setUser(result.user);
    setStatus('signedIn');
  }, []);

  const signIn = useCallback<SessionContextValue['signIn']>(
    async (email, password, onProgress) => {
      const normalizedEmail = normalizeEmail(email);
      onProgress?.({ stage: 'server' });
      const { kdf } = await AuthApi.prelogin(normalizedEmail);
      const { authKey, kek } = await deriveKeys(password, kdf, (progress) => onProgress?.({ stage: 'keys', progress }));

      onProgress?.({ stage: 'server' });
      const result = await AuthApi.login(normalizedEmail, authKey, deviceName());

      let dataKey: Uint8Array;
      try {
        dataKey = unlockDataKey(result.key.wrapped_key, kek);
      } catch {
        // The server accepted the auth key but the key doesn't open: data was tampered with.
        await AuthApi.logout(result.token).catch(() => undefined);
        throw new Error('key_unlock_failed');
      } finally {
        kek.fill(0);
      }

      await finishSignIn(result, dataKey);
    },
    [finishSignIn],
  );

  const signUp = useCallback<SessionContextValue['signUp']>(
    async (name, email, password, onProgress) => {
      const passwordKdf = newKdfParams();
      const recoveryKdf = newKdfParams();
      const recoveryKey = generateRecoveryKey();
      const dataKey = generateDataKey();

      // Two slow derivations: report them as one progress bar.
      const passwordKeys = await deriveKeys(password, passwordKdf, (p) => onProgress?.({ stage: 'keys', progress: p / 2 }));
      const recoveryKeys = await deriveKeys(recoveryKey, recoveryKdf, (p) =>
        onProgress?.({ stage: 'keys', progress: 0.5 + p / 2 }),
      );

      onProgress?.({ stage: 'server' });
      const result = await AuthApi.register({
        name: name.trim() || null,
        email: normalizeEmail(email),
        password: passwordKeys.authKey,
        kdf: passwordKdf,
        keys: {
          password: { wrapped_key: lockDataKey(dataKey, passwordKeys.kek) },
          recovery: { wrapped_key: lockDataKey(dataKey, recoveryKeys.kek), kdf: recoveryKdf, auth: recoveryKeys.authKey },
        },
        device_name: deviceName(),
      });

      passwordKeys.kek.fill(0);
      recoveryKeys.kek.fill(0);

      setPendingRecoveryKey(recoveryKey);
      await finishSignIn(result, dataKey);
    },
    [finishSignIn],
  );

  const acknowledgeRecoveryKey = useCallback(() => setPendingRecoveryKey(null), []);

  const signOut = useCallback(async () => {
    const current = token;
    await reset();
    if (current) {
      await AuthApi.logout(current).catch(() => undefined);
    }
  }, [reset, token]);

  const getDataKey = useCallback(() => dataKeyRef.current, []);

  const recover = useCallback<SessionContextValue['recover']>(
    async (email, recoveryKey, newPassword, onProgress) => {
      const normalizedEmail = normalizeEmail(email);
      onProgress?.({ stage: 'server' });
      const { kdf: recoveryKdf } = await AuthApi.recoveryParams(normalizedEmail);
      const recoveryKeys = await deriveKeys(normalizeRecoveryKey(recoveryKey), recoveryKdf, (p) =>
        onProgress?.({ stage: 'keys', progress: p / 2 }),
      );

      onProgress?.({ stage: 'server' });
      const { key } = await AuthApi.recoveryUnlock(normalizedEmail, recoveryKeys.authKey);
      let dataKey: Uint8Array;
      try {
        dataKey = unlockDataKey(key.wrapped_key, recoveryKeys.kek);
      } catch {
        throw new Error('key_unlock_failed');
      } finally {
        recoveryKeys.kek.fill(0);
      }

      const passwordKdf = newKdfParams();
      const passwordKeys = await deriveKeys(newPassword, passwordKdf, (p) =>
        onProgress?.({ stage: 'keys', progress: 0.5 + p / 2 }),
      );
      onProgress?.({ stage: 'server' });
      const result = await AuthApi.recoveryReset({
        email: normalizedEmail,
        recovery_auth: recoveryKeys.authKey,
        password: passwordKeys.authKey,
        kdf: passwordKdf,
        keys: { password: { wrapped_key: lockDataKey(dataKey, passwordKeys.kek) } },
        device_name: deviceName(),
      });
      passwordKeys.kek.fill(0);
      await finishSignIn(result, dataKey);
    },
    [finishSignIn],
  );

  /** Auth key of the current password (to prove it to the server). */
  const currentAuthKey = useCallback(
    async (password: string, onProgress?: (progress: number) => void) => {
      if (!user) throw new Error('not_signed_in');
      const { kdf } = await AuthApi.prelogin(user.email);
      const keys = await deriveKeys(password, kdf, onProgress);
      keys.kek.fill(0);
      return keys.authKey;
    },
    [user],
  );

  const changePassword = useCallback<SessionContextValue['changePassword']>(
    async (currentPassword, newPassword, onProgress) => {
      const dataKey = dataKeyRef.current;
      if (!token || !dataKey) throw new Error('not_signed_in');
      onProgress?.({ stage: 'server' });
      const current = await currentAuthKey(currentPassword, (p) => onProgress?.({ stage: 'keys', progress: p / 2 }));
      const kdf = newKdfParams();
      const next = await deriveKeys(newPassword, kdf, (p) => onProgress?.({ stage: 'keys', progress: 0.5 + p / 2 }));
      onProgress?.({ stage: 'server' });
      await AuthApi.changePassword(token, {
        current_password: current,
        password: next.authKey,
        kdf,
        keys: { password: { wrapped_key: lockDataKey(dataKey, next.kek) } },
      });
      next.kek.fill(0);
    },
    [token, currentAuthKey],
  );

  const replaceRecoveryKey = useCallback<SessionContextValue['replaceRecoveryKey']>(
    async (password, onProgress) => {
      const dataKey = dataKeyRef.current;
      if (!token || !dataKey) throw new Error('not_signed_in');
      onProgress?.({ stage: 'server' });
      const current = await currentAuthKey(password, (p) => onProgress?.({ stage: 'keys', progress: p / 2 }));
      const recoveryKey = generateRecoveryKey();
      const kdf = newKdfParams();
      const keys = await deriveKeys(recoveryKey, kdf, (p) => onProgress?.({ stage: 'keys', progress: 0.5 + p / 2 }));
      onProgress?.({ stage: 'server' });
      await AuthApi.replaceRecovery(token, {
        password: current,
        keys: { recovery: { wrapped_key: lockDataKey(dataKey, keys.kek), kdf, auth: keys.authKey } },
      });
      keys.kek.fill(0);
      // Shown once on the recovery-key screen, like at signup.
      setPendingRecoveryKey(recoveryKey);
    },
    [token, currentAuthKey],
  );

  const setKeyProtection = useCallback<SessionContextValue['setKeyProtection']>(async (enabled) => {
    const dataKey = dataKeyRef.current;
    if (!dataKey) throw new Error('not_signed_in');
    await storeKeyProtection(enabled, bytesToBase64(dataKey), i18n.t('lock.biometricPrompt'));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user,
      token,
      pendingRecoveryKey,
      signIn,
      signUp,
      acknowledgeRecoveryKey,
      signOut,
      getDataKey,
      retryUnlock,
      recover,
      changePassword,
      replaceRecoveryKey,
      setKeyProtection,
    }),
    [
      status,
      user,
      token,
      pendingRecoveryKey,
      signIn,
      signUp,
      acknowledgeRecoveryKey,
      signOut,
      getDataKey,
      retryUnlock,
      recover,
      changePassword,
      replaceRecoveryKey,
      setKeyProtection,
    ],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
