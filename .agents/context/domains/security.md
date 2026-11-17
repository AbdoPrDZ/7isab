# Security

**Status:** implemented (key derivation, signup / sign-in, record encryption, app lock); app lock not yet tested on a device.

## End-to-end encryption
- **Data key (DEK):** a random key per user, created on the phone at signup. It encrypts **all** user content (ledger, wallet, sins, tasks, progress, plans).
- **Password key (KEK):** scrypt (N=32768, r=8, p=1, per-account salt) → master key → HKDF-SHA256 into an **auth key** (`7isab:auth:v1`, sent instead of the password; the server stores its hash) and the **KEK** (`7isab:kek:v1`, never leaves the phone). The KEK locks the DEK with XChaCha20-Poly1305 (`base64(nonce24 ‖ ciphertext)`); the locked DEK is stored on the server.
- **scrypt:** native through react-native-quick-crypto in a dev build, `@noble/hashes` fallback in Expo Go (checked with `TurboModuleRegistry.get` before requiring the native module).
- **Recovery key:** 20 random bytes as Crockford base32 (groups of 4), shown once at signup. It locks a second copy of the DEK with its own salt.
- **New device:** log in → download the locked DEK → unlock it with the password or the recovery key.
- **Password change:** only re-locks the DEK. Nothing else is re-encrypted.
- **Records:** each payload is encrypted with the DEK (XChaCha20-Poly1305) with the record's type and id as associated data (`lib/data/cipher.ts`), so a payload can't be moved to another record. The local database holds only these encrypted payloads (no SQLCipher, see `../decisions.md`).
- **On the device:** token, unlocked DEK and cached account in expo-secure-store (`lib/session/storage.ts`).

## What the server may see
Email, record IDs, record type, timestamps, payload sizes. **Nothing else.**
- The super admin manages users (list, disable, delete, force logout, manage admins) and can never decrypt data.
- The server can't search or aggregate user data. Every feature has to work on the phone.

## What this means for sync
The server stores only encrypted records with their metadata. See [sync.md](sync.md).

## App lock
- **Method:** PIN or fingerprint / Face ID, chosen by the user; fingerprint mode needs a PIN as the fallback (`lib/lock/app-lock.ts`, `expo-local-authentication`, dev build only).
- **When it locks:** on app open, and after 0 / 1 / 5 / 15 minutes in the background (per device).
- **PIN:** 4–8 digits, stored as PBKDF2-SHA256 (20 000 rounds, random salt) in secure-store.
- **Wrong attempts:** from the 5th, a lockout of 30 s doubling each time; at the 10th the device signs out and the password is required.
- Signing out clears the lock and closes the vault.
- **Not done yet:** the option to make the stored DEK require fingerprint authentication.

## Accepted risk
Losing both the password and the recovery key means the data is lost. Admin recovery is impossible by design.
