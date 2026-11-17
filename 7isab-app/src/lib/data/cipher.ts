/**
 * Encrypts user records with the data key (DEK) before they are stored or synced.
 *
 * Format: base64(nonce[24] || XChaCha20-Poly1305(JSON)). The record's type and
 * id are bound as associated data, so a payload can't be moved to another record.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { base64ToBytes, bytesToBase64, utf8ToBytes } from '@/lib/crypto/encoding';
import { randomBytes } from '@/lib/crypto/keys';

const NONCE_LENGTH = 24;

function associatedData(type: string, id: string): Uint8Array {
  return utf8ToBytes(`7isab:record:v1:${type}:${id}`);
}

export function encryptRecord(dataKey: Uint8Array, type: string, id: string, value: unknown): string {
  const nonce = randomBytes(NONCE_LENGTH);
  const sealed = xchacha20poly1305(dataKey, nonce, associatedData(type, id)).encrypt(utf8ToBytes(JSON.stringify(value)));
  const output = new Uint8Array(NONCE_LENGTH + sealed.length);
  output.set(nonce);
  output.set(sealed, NONCE_LENGTH);
  return bytesToBase64(output);
}

/** Throws when the key is wrong or the payload was changed. */
export function decryptRecord<T>(dataKey: Uint8Array, type: string, id: string, payload: string): T {
  const bytes = base64ToBytes(payload);
  const plain = xchacha20poly1305(dataKey, bytes.slice(0, NONCE_LENGTH), associatedData(type, id)).decrypt(
    bytes.slice(NONCE_LENGTH),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/**
 * A stable record id derived from the data key: the same input gives the same
 * id on every device (no duplicate daily entries), but reveals nothing to the
 * server. Formatted like a UUID.
 */
export function stableId(dataKey: Uint8Array, input: string): string {
  const hex = Array.from(hmac(sha256, dataKey, utf8ToBytes(`7isab:id:v1:${input}`)).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
