# Data Model

## Phone (expo-sqlite, one file per account: `hisab-<userId>.db`)
- **`records`**: `id`, `type`, `updated_at` (ms), `deleted_at` (ms, tombstone), `payload` (encrypted JSON), `dirty` (needs push), `seq` (server sequence).
- **`meta`**: key/value (sync cursor, one-time migration flags such as `starter_accounts`, `default_categories`, `currency_default_dzd`).
- Migrations: an ordered list in `lib/data/database.ts`, tracked with `PRAGMA user_version`.
- **All reads come from memory:** `vault.ts` decrypts every record once when it opens; screens use `useDocs(type)` / `useDoc(type, id)`.
- **All writes go through one queue** (`serialized()` in `vault.ts`): expo-sqlite transactions share one connection, so overlapping writes fail with "cannot start a transaction within a transaction".
- Record types are listed in `RecordTypes` (`lib/ledger/types.ts`): settings, account, entry, task, progress, sin_type, exchange_rate, category, budget, goal, recurring, reading, reading_day, athkar, athkar_day, zakat_state, prayer_settings, alarm.
- `progress` of a prayer also stores how it was prayed: `status` (onTime / late / combined), `cause`, `combinedWith`, `prayedAt`.
- Device-only vault meta (not synced): `prayer_schedule`, `alarm_schedule` (schedule signatures), `prayer_location_check`.
- Every record has `id`, `createdAt`, `updatedAt` in its payload (`Doc`).

## Server (PostgreSQL)
- `users`: email, name, `kdf` (jsonb), `is_active`, `sync_seq` (per-user counter), `storage_bytes`, `last_login_at`, `last_sync_at`; soft deletes.
- `user_keys`: locked data key copies (password, recovery) with their KDF params and auth hash.
- `sync_records`: `user_id`, `uid` (record id), `type`, `seq` (unique per user), `payload` (null when deleted), `payload_size`, `client_updated_at`, `client_deleted_at`.
- `surahs`, `ayahs`, `words`: Quran text with Madani page and line numbers (imported by `php artisan quran:import`). `ayahs.rub_el_hizb` gives the quarters; eighths are computed (`QuranDivisions`) and cached in the meta response (`quran.meta.v2`).
- Sanctum `personal_access_tokens`, Spatie permission tables.
- Tests run on a separate Postgres database (`hisab_test`); PHP has no SQLite driver here.
