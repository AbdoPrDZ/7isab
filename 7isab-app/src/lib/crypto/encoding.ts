/**
 * Byte <-> string helpers that don't depend on Buffer or atob (not
 * guaranteed in every JS engine the app runs on).
 */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = new Map([...BASE64_ALPHABET].map((char, index) => [char, index]));

export function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;

    output += BASE64_ALPHABET[(triple >> 18) & 63];
    output += BASE64_ALPHABET[(triple >> 12) & 63];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? BASE64_ALPHABET[triple & 63] : '=';
  }

  return output;
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[\s=]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byteIndex = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const values = [0, 1, 2, 3].map((offset) => {
      const char = clean[i + offset];
      if (char === undefined) return 0;
      const value = BASE64_LOOKUP.get(char);
      if (value === undefined) throw new Error('Invalid base64 input');
      return value;
    });
    const triple = (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3];

    bytes[byteIndex++] = (triple >> 16) & 255;
    if (i + 2 < clean.length) bytes[byteIndex++] = (triple >> 8) & 255;
    if (i + 3 < clean.length) bytes[byteIndex++] = triple & 255;
  }

  return bytes.slice(0, byteIndex);
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Crockford base32 (no I, L, O, U): easy to read aloud and write down. */
const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}
