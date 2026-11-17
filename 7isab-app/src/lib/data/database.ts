/**
 * The local database (expo-sqlite), one file per account. It holds only
 * encrypted payloads plus the metadata sync needs (type, timestamps, sequence).
 *
 * records:
 *   id          UUID made on the phone (or a stable HMAC id, see stableId)
 *   type        record type ("account", "entry", "task", …)
 *   updated_at  ms since epoch, newest edit wins
 *   deleted_at  ms since epoch when deleted (records are marked, never erased)
 *   payload     encrypted JSON (see cipher.ts)
 *   dirty       1 while the change still has to be pushed to the server
 *   seq         server sequence number of the last synced version
 */
import * as SQLite from 'expo-sqlite';

export type RecordRow = {
  id: string;
  type: string;
  updated_at: number;
  deleted_at: number | null;
  payload: string;
  dirty: number;
  seq: number | null;
};

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS records (
     id TEXT PRIMARY KEY NOT NULL,
     type TEXT NOT NULL,
     updated_at INTEGER NOT NULL,
     deleted_at INTEGER,
     payload TEXT NOT NULL,
     dirty INTEGER NOT NULL DEFAULT 1,
     seq INTEGER
   );
   CREATE INDEX IF NOT EXISTS records_type ON records (type);
   CREATE INDEX IF NOT EXISTS records_dirty ON records (dirty);
   CREATE TABLE IF NOT EXISTS meta (
     key TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL
   );`,
];

/** Database file name for an account (ids only, no personal details). */
function fileName(userId: number | string): string {
  return `hisab-${userId}.db`;
}

export async function openUserDatabase(userId: number | string): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(fileName(userId));
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }

  return db;
}

export async function deleteUserDatabase(userId: number | string): Promise<void> {
  try {
    await SQLite.deleteDatabaseAsync(fileName(userId));
  } catch {
    // Already gone or still open: nothing else to do.
  }
}

export async function readMeta(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function writeMeta(db: SQLite.SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    value,
  ]);
}
