# Sync

**Status:** server built and tested; app client written, not yet tested between two devices.

## Flow
- **Push** (`POST /sync/push`, body `{records: [{id, type, payload, updated_at, deleted_at}]}`, times in ms): the phone sends `dirty` records in batches of 200. The server answers `{records: [{id, updated_at, seq, applied}]}`; the phone clears `dirty` only when its local `updated_at` still matches (`markPushed`).
- **Pull** (`GET /sync/pull?since=N`): records with `seq > N` in order, plus `cursor` and `has_more`. The phone saves the cursor in `meta.sync_cursor`.
- **Order of a run:** push → pull → push again (`syncNow`, concurrent calls share one run).

## Rules
- **Sequence numbers:** the server gives each applied change the user's next `sync_seq` (user row locked in a transaction), so phone clocks don't matter for ordering.
- **Newest edit wins** on both sides: the server doesn't apply an older `updated_at` (still acknowledges it); the phone ignores pulled records older than its local copy.
- **Deletions** are tombstones (`deleted_at`); the server drops the payload and the phone removes the record from memory.
- **No duplicates across devices:** automatic records use stable ids (`deterministicId` = HMAC of the data key + a label, formatted like a UUID), e.g. fixed accounts, settings, task entries per day, progress per task per day.
- Storage accounting: the server keeps `users.storage_bytes` and `last_sync_at` up to date.

## Triggers (`startSync` in `lib/sync/sync-engine.ts`)
App open (after the vault opens), coming back to the app, 4 s after local changes, every 5 minutes, and "Sync now" in Settings. Failures are silent and retried; Settings shows the last sync time or an error.
