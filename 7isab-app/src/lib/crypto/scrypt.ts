/**
 * scrypt with the fastest implementation available:
 * - native (react-native-quick-crypto, C++) in development/production builds;
 * - pure JS (@noble/hashes) as a fallback, e.g. in Expo Go or on web.
 * Both produce identical output for the same inputs.
 */
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { Platform, TurboModuleRegistry } from 'react-native';

export type ScryptParams = { N: number; r: number; p: number };

type NativeScrypt = (
  password: Uint8Array,
  salt: Uint8Array,
  keylen: number,
  options: ScryptParams & { maxmem: number },
  callback: (error: Error | null, derivedKey?: Uint8Array) => void,
) => void;

/** undefined = not checked yet, null = unavailable. */
let nativeScrypt: NativeScrypt | null | undefined;

/**
 * The native modules quick-crypto needs. Checked with the non-throwing
 * `TurboModuleRegistry.get`, because merely loading the package without them
 * (Expo Go, or a build made before it was added) logs an Invariant Violation.
 */
const REQUIRED_NATIVE_MODULES = ['NitroModules', 'QuickBase64'];

function nativeModulesPresent(): boolean {
  if (Platform.OS === 'web') return false;

  return REQUIRED_NATIVE_MODULES.every((name) => {
    try {
      return TurboModuleRegistry.get(name) != null;
    } catch {
      return false;
    }
  });
}

function loadNativeScrypt(): NativeScrypt | null {
  if (nativeScrypt !== undefined) return nativeScrypt;

  if (!nativeModulesPresent()) {
    nativeScrypt = null;
    return nativeScrypt;
  }

  try {
    // Loaded lazily: the native module doesn't exist in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('react-native-quick-crypto') as { scrypt?: NativeScrypt };
    nativeScrypt = typeof module.scrypt === 'function' ? module.scrypt : null;
  } catch {
    nativeScrypt = null;
  }

  return nativeScrypt;
}

function maxMemory({ N, r, p }: ScryptParams): number {
  return 128 * N * r * p + 1024 * 1024;
}

function runNative(scrypt: NativeScrypt, password: Uint8Array, salt: Uint8Array, params: ScryptParams): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, { ...params, maxmem: maxMemory(params) }, (error, derivedKey) => {
      if (error || !derivedKey) reject(error ?? new Error('scrypt failed'));
      else resolve(new Uint8Array(derivedKey));
    });
  });
}

/**
 * Derives 32 bytes. `onProgress` reports 0..1 (the native path reports only
 * start and end, since it finishes quickly).
 */
export async function scrypt32(
  password: Uint8Array,
  salt: Uint8Array,
  params: ScryptParams,
  onProgress?: (progress: number) => void,
): Promise<Uint8Array> {
  const native = loadNativeScrypt();

  if (native) {
    try {
      onProgress?.(0);
      const key = await runNative(native, password, salt, params);
      onProgress?.(1);
      return key;
    } catch {
      // Native module present but unusable (e.g. not linked): use JS from now on.
      nativeScrypt = null;
    }
  }

  return scryptAsync(password, salt, { ...params, dkLen: 32, maxmem: maxMemory(params), onProgress });
}

/** Whether the fast native implementation is in use (for diagnostics). */
export function isNativeScryptAvailable(): boolean {
  return loadNativeScrypt() !== null;
}
