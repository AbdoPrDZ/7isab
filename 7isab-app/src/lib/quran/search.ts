/**
 * Offline Quran search. The Quran is kept on the phone one page at a time as
 * pages are read; searching needs all of it, so the first search downloads the
 * missing pages once (with progress). Then an in-memory index of the 6236 ayat
 * (Uthmani text folded with `foldQuran`) answers every search on the phone, so
 * search words never leave the device.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { foldQuran } from '@/lib/search/normalize';

import { readPage } from './cache';
import { loadPage } from './hooks';
import type { QuranPage } from './types';

export type AyahResult = { key: string; surah: number; ayah: number; page: number; text: string };

type IndexedAyah = AyahResult & { folded: string };

export type QuranSearchStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'missing'; have: number; total: number }
  | { state: 'downloading'; done: number; total: number }
  | { state: 'ready' }
  | { state: 'error'; have: number; total: number };

let status: QuranSearchStatus = { state: 'idle' };
let index: { version: string; ayat: IndexedAyah[] } | null = null;
const listeners = new Set<() => void>();

function setStatus(next: QuranSearchStatus) {
  status = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Builds the index from pages on the phone; returns the pages still missing. */
async function buildIndex(version: string, total: number): Promise<number[]> {
  const pages: (QuranPage | null)[] = await Promise.all(
    Array.from({ length: total }, (_, i) => readPage(version, i + 1)),
  );
  const missing = pages.flatMap((page, i) => (page ? [] : [i + 1]));
  if (missing.length) return missing;

  const byKey = new Map<string, { page: number; words: string[] }>();
  for (const page of pages as QuranPage[]) {
    for (const line of page.lines) {
      for (const word of line.words) {
        if (word.type !== 'word') continue;
        const entry = byKey.get(word.key) ?? { page: page.number, words: [] };
        entry.words.push(word.text);
        byKey.set(word.key, entry);
      }
    }
  }
  const ayat: IndexedAyah[] = [];
  for (const [key, { page, words }] of byKey) {
    const [surah, ayah] = key.split(':').map(Number);
    const text = words.join(' ');
    ayat.push({ key, surah, ayah, page, text, folded: foldQuran(text) });
  }
  ayat.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
  index = { version, ayat };
  return [];
}

/** Checks what's on the phone and builds the index when the whole Quran is there. */
export async function prepareQuranSearch(version: string, total: number): Promise<void> {
  if (index?.version === version) return setStatus({ state: 'ready' });
  if (status.state === 'checking' || status.state === 'downloading') return;
  setStatus({ state: 'checking' });
  const missing = await buildIndex(version, total);
  setStatus(missing.length ? { state: 'missing', have: total - missing.length, total } : { state: 'ready' });
}

/** Downloads every missing page (4 at a time), then builds the index. */
export async function downloadQuran(version: string, total: number): Promise<void> {
  if (status.state === 'downloading') return;
  const pages = await Promise.all(Array.from({ length: total }, (_, i) => readPage(version, i + 1)));
  const missing = pages.flatMap((page, i) => (page ? [] : [i + 1]));
  let done = total - missing.length;
  setStatus({ state: 'downloading', done, total });
  let failed = false;
  const queue = [...missing];
  const worker = async () => {
    for (let page = queue.shift(); page !== undefined; page = queue.shift()) {
      try {
        await loadPage(version, page);
      } catch {
        failed = true;
      }
      done += 1;
      setStatus({ state: 'downloading', done, total });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  const stillMissing = await buildIndex(version, total);
  if (failed || stillMissing.length) setStatus({ state: 'error', have: total - stillMissing.length, total });
  else setStatus({ state: 'ready' });
}

/** Ayat containing every word of the query (in Quran order), at most `limit`. */
export function searchQuran(query: string, limit = 200): { results: AyahResult[]; total: number } {
  const folded = foldQuran(query);
  if (!index || folded.length < 2) return { results: [], total: 0 };
  const words = query
    .trim()
    .split(/\s+/)
    .map((word) => foldQuran(word))
    .filter(Boolean);
  // The whole phrase first (it ignores spaces), else every word anywhere in the ayah.
  const matches = index.ayat.filter(
    (ayah) => ayah.folded.includes(folded) || (words.length > 1 && words.every((word) => ayah.folded.includes(word))),
  );
  return { results: matches.slice(0, limit), total: matches.length };
}

export function useQuranSearchStatus(): QuranSearchStatus {
  return useSyncExternalStore(subscribe, () => status);
}

/** Prepares the index for this Quran version and searches it. */
export function useQuranSearch(
  version: string | undefined,
  total: number,
  query: string,
): { status: QuranSearchStatus; results: AyahResult[]; total: number } {
  const current = useQuranSearchStatus();
  const active = query.trim().length >= 2;
  useEffect(() => {
    if (version && active) void prepareQuranSearch(version, total).catch(() => setStatus({ state: 'idle' }));
  }, [version, total, active]);
  const ready = current.state === 'ready';
  const found = useMemo(() => (ready && active ? searchQuran(query) : { results: [], total: 0 }), [ready, active, query]);
  return { status: current, ...found };
}
