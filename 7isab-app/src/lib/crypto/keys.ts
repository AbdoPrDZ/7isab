/**
 * End-to-end encryption keys.
 *
 * - A random 32-byte data key (DEK) encrypts all user data on the device.
 * - The password goes through scrypt (account salt + cost) into a master key.
 *   HKDF splits it into:
 *     authKey: sent to the server as the "password" (server stores its hash),
 *     kek:     locks the DEK; never leaves the device.
 * - The recovery key (shown once at signup) works the same way, with its own salt.
 *
 * Locked DEK format: base64(nonce[24] || XChaCha20-Poly1305 ciphertext).
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as Crypto from 'expo-crypto';

import { base64ToBytes, bytesToBase32, bytesToBase64, utf8ToBytes } from './encoding';
import { scrypt32 } from './scrypt';

export type KdfParams = {
  algorithm: 'scrypt';
  salt: string;
  params: { N: number; r: number; p: number };
};

export type DerivedKeys = {
  /** Base64 auth key, sent instead of the password. */
  authKey: string;
  /** Key-encryption key for locking the data key. */
  kek: Uint8Array;
};

/**
 * Cost for new accounts. Must match the server's fake-parameter defaults
 * (KdfParams::DEFAULT_PARAMS) so unknown emails look like real ones.
 * 2^15 * 8 * 128 bytes = 32 MiB of memory: safe for phones, even on the JS fallback.
 */
export const DEFAULT_SCRYPT_PARAMS = { N: 32768, r: 8, p: 1 } as const;

const AUTH_INFO = utf8ToBytes('7isab:auth:v1');
const KEK_INFO = utf8ToBytes('7isab:kek:v1');
const NONCE_LENGTH = 24;

export function randomBytes(length: number): Uint8Array {
  return Crypto.getRandomBytes(length);
}

export function newKdfParams(): KdfParams {
  return { algorithm: 'scrypt', salt: bytesToBase64(randomBytes(16)), params: { ...DEFAULT_SCRYPT_PARAMS } };
}

export function generateDataKey(): Uint8Array {
  return randomBytes(32);
}

/**
 * Slow by design (protects against password guessing). Report progress to the UI.
 */
export async function deriveKeys(
  secret: string,
  kdf: KdfParams,
  onProgress?: (progress: number) => void,
): Promise<DerivedKeys> {
  if (kdf.algorithm !== 'scrypt') {
    throw new Error(`Unsupported key derivation: ${kdf.algorithm}`);
  }

  const { N, r, p } = kdf.params;
  const master = await scrypt32(utf8ToBytes(secret.normalize('NFKC')), base64ToBytes(kdf.salt), { N, r, p }, onProgress);

  const authKey = hkdf(sha256, master, undefined, AUTH_INFO, 32);
  const kek = hkdf(sha256, master, undefined, KEK_INFO, 32);
  master.fill(0);

  return { authKey: bytesToBase64(authKey), kek };
}

export function lockDataKey(dataKey: Uint8Array, kek: Uint8Array): string {
  const nonce = randomBytes(NONCE_LENGTH);
  const sealed = xchacha20poly1305(kek, nonce).encrypt(dataKey);
  const output = new Uint8Array(nonce.length + sealed.length);
  output.set(nonce);
  output.set(sealed, nonce.length);

  return bytesToBase64(output);
}

/** Throws when the key is wrong or the data was tampered with. */
export function unlockDataKey(lockedKey: string, kek: Uint8Array): Uint8Array {
  const bytes = base64ToBytes(lockedKey);
  const nonce = bytes.slice(0, NONCE_LENGTH);
  const sealed = bytes.slice(NONCE_LENGTH);

  return xchacha20poly1305(kek, nonce).decrypt(sealed);
}

/**
 * A new recovery key: 160 random bits as Crockford base32,
 * grouped for writing down, e.g. "7K2M-Q9XD-...".
 */
export function generateRecoveryKey(): string {
  const raw = bytesToBase32(randomBytes(20));

  return raw.match(/.{1,4}/g)!.join('-');
}

/** Accepts the recovery key typed with or without dashes, in any case. */
export function normalizeRecoveryKey(input: string): string {
  const clean = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');

  return clean.match(/.{1,4}/g)?.join('-') ?? '';
}
