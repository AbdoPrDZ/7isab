/**
 * Sync engine (offline first). The phone is the source of truth for reading
 * and writing; the server only stores encrypted records.
 *
 * - push: local changes (dirty records) → POST /sync/push; the server answers
 *   with the sequence number it gave each record.
 * - pull: GET /sync/pull?since=<cursor> → records changed on other devices.
 *   Newest edit wins (see applyRemoteRecords).
 * - Triggers: start (app open), coming back to the foreground, local changes
 *   (debounced), and by hand (syncNow).
 */
import { AppState } from 'react-native';
import { create } from 'zustand';

import { apiRequest } from '@/lib/api/client';
import {
  applyRemoteRecords,
  getDirtyRecords,
  getSyncCursor,
  markPushed,
  onLocalChange,
  setSyncCursor,
  type SyncRecord,
} from '@/lib/data/vault';

const PUSH_BATCH = 200;
const PUSH_DEBOUNCE_MS = 4000;
const PERIODIC_MS = 5 * 60 * 1000;

type SyncState = { syncing: boolean; lastSyncAt: number | null; error: boolean };

export const useSyncStore = create<SyncState>(() => ({ syncing: false, lastSyncAt: null, error: false }));

type PushResponse = { records: { id: string; updated_at: number; seq: number }[] };
type PullResponse = {
  records: (Omit<SyncRecord, 'payload'> & { payload: string | null; seq: number })[];
  cursor: number;
  has_more: boolean;
};

let currentToken: string | null = null;
let running: Promise<void> | null = null;

async function push(token: string): Promise<void> {
  for (;;) {
    const records = await getDirtyRecords(PUSH_BATCH);
    if (!records.length) return;
    const response = await apiRequest<PushResponse>('/sync/push', { method: 'POST', token, body: { records } });
    await markPushed(response.records);
    if (records.length < PUSH_BATCH) return;
  }
}

async function pull(token: string): Promise<void> {
  for (;;) {
    const since = await getSyncCursor();
    const response = await apiRequest<PullResponse>(`/sync/pull?since=${since}`, { token });
    await applyRemoteRecords(response.records);
    await setSyncCursor(response.cursor);
    if (!response.has_more) return;
  }
}

/** Pushes then pulls. Concurrent calls share one run. */
export function syncNow(): Promise<void> {
  const token = currentToken;
  if (!token) return Promise.resolve();
  running ??= (async () => {
    useSyncStore.setState({ syncing: true });
    try {
      await push(token);
      await pull(token);
      // Changes made while pulling are pushed right away.
      await push(token);
      useSyncStore.setState({ syncing: false, lastSyncAt: Date.now(), error: false });
    } catch {
      useSyncStore.setState({ syncing: false, error: true });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Starts background sync for a signed-in, unlocked session. Returns a stop function. */
export function startSync(token: string): () => void {
  currentToken = token;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = onLocalChange(() => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void syncNow(), PUSH_DEBOUNCE_MS);
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncNow();
  });
  const interval = setInterval(() => void syncNow(), PERIODIC_MS);
  void syncNow();

  return () => {
    currentToken = null;
    unsubscribe();
    appState.remove();
    clearInterval(interval);
    if (debounce) clearTimeout(debounce);
  };
}
