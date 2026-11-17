/**
 * The vault: the account's decrypted records, kept in memory while the app is
 * unlocked, and written back to the local database encrypted.
 *
 * - openVault() decrypts every record once (the data set is small: tasks,
 *   entries, accounts, …) so screens read synchronously from memory.
 * - put() / remove() update memory first, then persist (encrypted) and mark the
 *   record dirty for the next sync push.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { useMemo } from 'react';
import { create } from 'zustand';

import { decryptRecord, encryptRecord, stableId } from './cipher';
import { openUserDatabase, readMeta, writeMeta, type RecordRow } from './database';

/** Every stored record has these fields. */
export type Doc = { id: string; createdAt: number; updatedAt: number };

export type VaultStatus = 'closed' | 'opening' | 'open' | 'error';

type Collections = Record<string, Record<string, Doc>>;

type VaultState = {
  status: VaultStatus;
  collections: Collections;
  /** Changes every time records change (for effects that react to any change). */
  revision: number;
};

export const useVaultStore = create<VaultState>(() => ({ status: 'closed', collections: {}, revision: 0 }));

let db: SQLiteDatabase | null = null;
let dataKey: Uint8Array | null = null;
let openedFor: string | null = null;
const listeners = new Set<() => void>();

/**
 * Every database write runs through this queue, one at a time: expo-sqlite
 * transactions share one connection, so two overlapping writes would try to
 * start a transaction inside another ("cannot start a transaction within a
 * transaction").
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}

/** Called after any local change (the sync engine debounces a push on it). */
export function onLocalChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyLocalChange(): void {
  for (const listener of listeners) listener();
}

function requireOpen(): { db: SQLiteDatabase; key: Uint8Array } {
  if (!db || !dataKey) throw new Error('The vault is locked');
  return { db, key: dataKey };
}

export async function openVault(userId: number | string, key: Uint8Array): Promise<void> {
  const owner = String(userId);
  if (openedFor === owner && db) return;

  useVaultStore.setState({ status: 'opening' });
  try {
    const database = await openUserDatabase(userId);
    const rows = await database.getAllAsync<RecordRow>('SELECT * FROM records WHERE deleted_at IS NULL');
    const collections: Collections = {};

    for (const row of rows) {
      try {
        const doc = decryptRecord<Doc>(key, row.type, row.id, row.payload);
        (collections[row.type] ??= {})[row.id] = doc;
      } catch {
        // A record that doesn't decrypt is skipped (corrupt or from another key).
      }
    }

    db = database;
    dataKey = key;
    openedFor = owner;
    useVaultStore.setState({ status: 'open', collections, revision: Date.now() });
  } catch (error) {
    useVaultStore.setState({ status: 'error' });
    throw error;
  }
}

export async function closeVault(): Promise<void> {
  const database = db;
  db = null;
  dataKey = null;
  openedFor = null;
  useVaultStore.setState({ status: 'closed', collections: {}, revision: 0 });
  await database?.closeAsync().catch(() => undefined);
}

export function newId(): string {
  return randomUUID();
}

/** A stable id from the data key (see stableId): same input, same id on every device. */
export function deterministicId(input: string): string {
  return stableId(requireOpen().key, input);
}

/** Reads one record from memory. */
export function getDoc<T extends Doc>(type: string, id: string): T | undefined {
  return useVaultStore.getState().collections[type]?.[id] as T | undefined;
}

export function getDocs<T extends Doc>(type: string): T[] {
  return Object.values(useVaultStore.getState().collections[type] ?? {}) as T[];
}

type NewDoc<T extends Doc> = Omit<T, 'createdAt' | 'updatedAt'> & Partial<Pick<T, 'createdAt' | 'updatedAt'>>;

/** Creates or replaces records (one transaction, one memory update). */
export async function putDocs<T extends Doc>(type: string, docs: NewDoc<T>[]): Promise<T[]> {
  const { db: database, key } = requireOpen();
  const now = Date.now();
  const saved = docs.map((doc) => {
    const existing = getDoc<T>(type, doc.id);
    return { ...doc, createdAt: doc.createdAt ?? existing?.createdAt ?? now, updatedAt: now } as T;
  });

  useVaultStore.setState((state) => ({
    collections: {
      ...state.collections,
      [type]: { ...state.collections[type], ...Object.fromEntries(saved.map((doc) => [doc.id, doc])) },
    },
    revision: state.revision + 1,
  }));

  await serialized(() =>
    database.withTransactionAsync(async () => {
      for (const doc of saved) {
        await database.runAsync(
          `INSERT INTO records (id, type, updated_at, deleted_at, payload, dirty) VALUES (?, ?, ?, NULL, ?, 1)
         ON CONFLICT(id) DO UPDATE SET type = excluded.type, updated_at = excluded.updated_at,
           deleted_at = NULL, payload = excluded.payload, dirty = 1`,
          [doc.id, type, doc.updatedAt, encryptRecord(key, type, doc.id, doc)],
        );
      }
    }),
  );
  notifyLocalChange();
  return saved;
}

export async function putDoc<T extends Doc>(type: string, doc: NewDoc<T>): Promise<T> {
  const [saved] = await putDocs<T>(type, [doc]);
  return saved;
}

/** Marks a record deleted (kept as a tombstone so the deletion syncs). */
export async function removeDoc(type: string, id: string): Promise<void> {
  const { db: database, key } = requireOpen();
  const now = Date.now();

  useVaultStore.setState((state) => {
    const { [id]: _removed, ...rest } = state.collections[type] ?? {};
    return { collections: { ...state.collections, [type]: rest }, revision: state.revision + 1 };
  });

  await serialized(() =>
    database.runAsync(
      `INSERT INTO records (id, type, updated_at, deleted_at, payload, dirty) VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, deleted_at = excluded.deleted_at,
         payload = excluded.payload, dirty = 1`,
      [id, type, now, now, encryptRecord(key, type, id, { id, deleted: true })],
    ),
  );
  notifyLocalChange();
}

// ---- Sync support -------------------------------------------------------------

export type SyncRecord = {
  id: string;
  type: string;
  updated_at: number;
  deleted_at: number | null;
  payload: string;
};

export async function getDirtyRecords(limit: number): Promise<SyncRecord[]> {
  const { db: database } = requireOpen();
  return database.getAllAsync<SyncRecord>(
    'SELECT id, type, updated_at, deleted_at, payload FROM records WHERE dirty = 1 ORDER BY updated_at LIMIT ?',
    [limit],
  );
}

/** After a push: clear the dirty flag unless the record changed again meanwhile. */
export async function markPushed(records: { id: string; updated_at: number; seq: number }[]): Promise<void> {
  const { db: database } = requireOpen();
  await serialized(() =>
    database.withTransactionAsync(async () => {
      for (const record of records) {
        await database.runAsync('UPDATE records SET dirty = 0, seq = ? WHERE id = ? AND updated_at = ?', [
          record.seq,
          record.id,
          record.updated_at,
        ]);
      }
    }),
  );
}

/** Applies records pulled from the server. Newest edit wins; local unsynced newer edits are kept. */
export async function applyRemoteRecords(
  records: (Omit<SyncRecord, 'payload'> & { payload: string | null; seq: number })[],
): Promise<number> {
  const { db: database, key } = requireOpen();
  let applied = 0;
  const changes: { type: string; id: string; doc: Doc | null }[] = [];

  await serialized(() =>
    database.withTransactionAsync(async () => {
      for (const record of records) {
        const local = await database.getFirstAsync<{ updated_at: number; dirty: number }>(
          'SELECT updated_at, dirty FROM records WHERE id = ?',
          [record.id],
        );
        if (local && local.updated_at > record.updated_at) continue;

        let doc: Doc | null = null;
        if (record.deleted_at === null) {
          try {
            doc = decryptRecord<Doc>(key, record.type, record.id, record.payload ?? '');
          } catch {
            continue;
          }
        }

        await database.runAsync(
          `INSERT INTO records (id, type, updated_at, deleted_at, payload, dirty, seq) VALUES (?, ?, ?, ?, ?, 0, ?)
         ON CONFLICT(id) DO UPDATE SET type = excluded.type, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at, payload = excluded.payload, dirty = 0, seq = excluded.seq`,
          [record.id, record.type, record.updated_at, record.deleted_at, record.payload ?? '', record.seq],
        );
        changes.push({ type: record.type, id: record.id, doc });
        applied++;
      }
    }),
  );

  if (changes.length) {
    useVaultStore.setState((state) => {
      const collections = { ...state.collections };
      for (const change of changes) {
        const collection = { ...collections[change.type] };
        if (change.doc) collection[change.id] = change.doc;
        else delete collection[change.id];
        collections[change.type] = collection;
      }
      return { collections, revision: state.revision + 1 };
    });
  }
  return applied;
}

export async function getSyncCursor(): Promise<number> {
  return Number((await readMeta(requireOpen().db, 'sync_cursor')) ?? 0);
}

export async function setSyncCursor(cursor: number): Promise<void> {
  const { db: database } = requireOpen();
  await serialized(() => writeMeta(database, 'sync_cursor', String(cursor)));
}

export async function getVaultMeta(key: string): Promise<string | null> {
  return readMeta(requireOpen().db, key);
}

export async function setVaultMeta(key: string, value: string): Promise<void> {
  const { db: database } = requireOpen();
  await serialized(() => writeMeta(database, key, value));
}

// ---- React hooks --------------------------------------------------------------

const EMPTY: Record<string, Doc> = {};

/** All records of a type (re-renders only when that type changes). */
export function useDocs<T extends Doc>(type: string): T[] {
  const collection = useVaultStore((state) => state.collections[type] ?? EMPTY);
  return useMemo(() => Object.values(collection) as T[], [collection]);
}

export function useDoc<T extends Doc>(type: string, id: string | undefined): T | undefined {
  return useVaultStore((state) => (id ? (state.collections[type]?.[id] as T | undefined) : undefined));
}
