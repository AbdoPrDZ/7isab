/**
 * App lock (per device): PIN or fingerprint / Face ID, with the PIN as fallback.
 *
 * - The PIN is stored hashed (PBKDF2-SHA256, random salt) in secure-store.
 * - Locks on app open and after a chosen time in the background.
 * - Wrong PINs: after 5, a lockout that doubles each time; after 10, the
 *   account password is required (the device signs out).
 */
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { base64ToBytes, bytesToBase64, utf8ToBytes } from '@/lib/crypto/encoding';
import { randomBytes } from '@/lib/crypto/keys';
import { readPreference, writePreference } from '@/lib/preferences/store';

export type LockMode = 'none' | 'pin' | 'biometric';

export const LOCK_TIMEOUTS = [0, 60, 300, 900] as const;
export type LockTimeout = (typeof LOCK_TIMEOUTS)[number];

const KEYS = {
  mode: 'hisab.lock.mode',
  pin: 'hisab.lock.pin',
  timeout: 'hisab.lock.timeout',
  failures: 'hisab.lock.failures',
  until: 'hisab.lock.until',
} as const;

const PIN_ITERATIONS = 20000;
export const MAX_FAILURES_BEFORE_LOCKOUT = 5;
export const MAX_FAILURES_BEFORE_SIGN_OUT = 10;

type LockState = {
  mode: LockMode;
  timeout: LockTimeout;
  locked: boolean;
  failures: number;
  /** Lockout end (ms since epoch), 0 when none. */
  lockedUntil: number;
};

function readMode(): LockMode {
  const value = readPreference(KEYS.mode);
  return value === 'pin' || value === 'biometric' ? value : 'none';
}

function readTimeout(): LockTimeout {
  const value = Number(readPreference(KEYS.timeout) ?? 60);
  return (LOCK_TIMEOUTS as readonly number[]).includes(value) ? (value as LockTimeout) : 60;
}

export const useLockStore = create<LockState>(() => ({
  mode: readMode(),
  timeout: readTimeout(),
  // Locked from the start when a lock is set (lock on app open).
  locked: readMode() !== 'none',
  failures: Number(readPreference(KEYS.failures) ?? 0),
  lockedUntil: Number(readPreference(KEYS.until) ?? 0),
}));

function hashPin(pin: string, salt: Uint8Array): string {
  return bytesToBase64(pbkdf2(sha256, utf8ToBytes(pin), salt, { c: PIN_ITERATIONS, dkLen: 32 }));
}

export function hasPin(): boolean {
  return !!readPreference(KEYS.pin);
}

export function setPin(pin: string): void {
  const salt = randomBytes(16);
  writePreference(KEYS.pin, JSON.stringify({ salt: bytesToBase64(salt), hash: hashPin(pin, salt) }));
}

function checkPin(pin: string): boolean {
  try {
    const stored = JSON.parse(readPreference(KEYS.pin) ?? '') as { salt: string; hash: string };
    const actual = hashPin(pin, base64ToBytes(stored.salt));
    // Constant-time compare.
    let diff = actual.length ^ stored.hash.length;
    for (let i = 0; i < Math.min(actual.length, stored.hash.length); i++) {
      diff |= actual.charCodeAt(i) ^ stored.hash.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export function setLockMode(mode: LockMode): void {
  writePreference(KEYS.mode, mode);
  if (mode === 'none') writePreference(KEYS.pin, '');
  useLockStore.setState({ mode, locked: false });
}

export function setLockTimeout(timeout: LockTimeout): void {
  writePreference(KEYS.timeout, String(timeout));
  useLockStore.setState({ timeout });
}

export function lockNow(): void {
  if (useLockStore.getState().mode !== 'none') useLockStore.setState({ locked: true });
}

function saveFailures(failures: number, lockedUntil: number): void {
  writePreference(KEYS.failures, String(failures));
  writePreference(KEYS.until, String(lockedUntil));
  useLockStore.setState({ failures, lockedUntil });
}

function unlock(): void {
  saveFailures(0, 0);
  useLockStore.setState({ locked: false });
}

export type PinResult = 'ok' | 'wrong' | 'lockedOut' | 'signOut';

/** Checks a PIN, applying the lockout rules. */
export function submitPin(pin: string): PinResult {
  const { failures, lockedUntil } = useLockStore.getState();
  if (lockedUntil > Date.now()) return 'lockedOut';

  if (checkPin(pin)) {
    unlock();
    return 'ok';
  }

  const next = failures + 1;
  if (next >= MAX_FAILURES_BEFORE_SIGN_OUT) {
    saveFailures(0, 0);
    return 'signOut';
  }
  // 30 s after the 5th failure, doubling after each further one.
  const lockout = next >= MAX_FAILURES_BEFORE_LOCKOUT ? 30_000 * 2 ** (next - MAX_FAILURES_BEFORE_LOCKOUT) : 0;
  saveFailures(next, lockout ? Date.now() + lockout : 0);
  return lockout ? 'lockedOut' : 'wrong';
}

export async function biometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Shows the system fingerprint / Face ID prompt; unlocks on success. */
export async function unlockWithBiometrics(promptMessage: string, cancelLabel: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      // The app's own PIN is the fallback, not the device passcode.
      disableDeviceFallback: true,
    });
    if (result.success) unlock();
    return result.success;
  } catch {
    return false;
  }
}

/** Clears the lock (used on sign-out). */
export function resetAppLock(): void {
  writePreference(KEYS.mode, 'none');
  writePreference(KEYS.pin, '');
  saveFailures(0, 0);
  useLockStore.setState({ mode: 'none', locked: false });
}
