/**
 * Auth endpoints. The "password" sent here is always the derived auth key,
 * never the real password.
 */
import type { KdfParams } from '@/lib/crypto/keys';

import { apiRequest } from './client';

export type AccountUser = {
  id: number;
  name: string | null;
  email: string;
  is_active: boolean;
  storage_bytes: number;
  last_login_at: string | null;
  last_sync_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type LockedKey = {
  type: 'password' | 'recovery';
  wrapped_key: string;
  kdf: KdfParams | null;
  version: number;
  updated_at: string | null;
};

export type AuthResult = { token: string; user: AccountUser; key: LockedKey };

export type RegisterBody = {
  name: string | null;
  email: string;
  password: string;
  kdf: KdfParams;
  keys: {
    password: { wrapped_key: string };
    recovery: { wrapped_key: string; kdf: KdfParams; auth: string };
  };
  device_name: string;
};

export function prelogin(email: string): Promise<{ kdf: KdfParams }> {
  return apiRequest('/auth/prelogin', { method: 'POST', body: { email } });
}

export function login(email: string, authKey: string, deviceName: string): Promise<AuthResult> {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password: authKey, device_name: deviceName } });
}

export function register(body: RegisterBody): Promise<AuthResult> {
  return apiRequest('/auth/register', { method: 'POST', body });
}

export function me(token: string): Promise<{ user: AccountUser }> {
  return apiRequest('/auth/me', { token });
}

export function logout(token: string): Promise<object> {
  return apiRequest('/auth/logout', { method: 'POST', token });
}

// ---- Recovery (forgot password) -------------------------------------------------

export function recoveryParams(email: string): Promise<{ kdf: KdfParams }> {
  return apiRequest('/auth/recovery/params', { method: 'POST', body: { email } });
}

/** Proves the recovery key (its auth key) and returns the data key locked with it. */
export function recoveryUnlock(email: string, recoveryAuth: string): Promise<{ key: LockedKey }> {
  return apiRequest('/auth/recovery/unlock', { method: 'POST', body: { email, recovery_auth: recoveryAuth } });
}

export type RecoveryResetBody = {
  email: string;
  recovery_auth: string;
  password: string;
  kdf: KdfParams;
  keys: { password: { wrapped_key: string } };
  device_name: string;
};

/** Sets a new password (auth key + re-locked data key) and signs this device in. */
export function recoveryReset(body: RecoveryResetBody): Promise<AuthResult> {
  return apiRequest('/auth/recovery/reset', { method: 'POST', body });
}

// ---- Signed-in key changes --------------------------------------------------------

export type ChangePasswordBody = {
  current_password: string;
  password: string;
  kdf: KdfParams;
  keys: { password: { wrapped_key: string } };
};

/** Other devices are signed out; this one stays signed in. */
export function changePassword(token: string, body: ChangePasswordBody): Promise<{ key: LockedKey }> {
  return apiRequest('/auth/password', { method: 'PUT', token, body });
}

export type ReplaceRecoveryBody = {
  password: string;
  keys: { recovery: { wrapped_key: string; kdf: KdfParams; auth: string } };
};

export function replaceRecovery(token: string, body: ReplaceRecoveryBody): Promise<{ version: number }> {
  return apiRequest('/vault/recovery', { method: 'PUT', token, body });
}
