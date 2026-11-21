/**
 * Quran data hooks: cache first (works offline), then the server.
 * Neighbouring pages are prefetched so swiping feels instant.
 */
import { useCallback, useEffect, useState } from 'react';

import { fetchQuranMeta, fetchQuranPage } from './api';
import { readLatestMeta, readPage, writeMeta, writePage } from './cache';
import { setDivisions } from './divisions';
import type { QuranMeta, QuranPage } from './types';

type Loadable<T> = { data: T | null; loading: boolean; error: boolean; retry: () => void };

let metaPromise: Promise<QuranMeta> | null = null;

/** Metadata: cached copy immediately, refreshed from the server once per app run. */
async function loadMeta(): Promise<QuranMeta> {
  metaPromise ??= fetchQuranMeta()
    .then(async (meta) => {
      setDivisions(meta);
      await writeMeta(meta);
      return meta;
    })
    .catch(async (error) => {
      metaPromise = null;
      const cached = await readLatestMeta();
      if (cached) {
        setDivisions(cached);
        return cached;
      }
      throw error;
    });

  return metaPromise;
}

const pageRequests = new Map<string, Promise<QuranPage>>();

/** Parsed pages kept in memory, so swiping back and forth doesn't re-read files. */
const pageMemory = new Map<string, QuranPage>();
const PAGE_MEMORY_LIMIT = 30;

function remember(version: string, data: QuranPage): QuranPage {
  const key = `${version}:${data.number}`;
  pageMemory.delete(key);
  pageMemory.set(key, data);
  if (pageMemory.size > PAGE_MEMORY_LIMIT) {
    const oldest = pageMemory.keys().next().value;
    if (oldest !== undefined) pageMemory.delete(oldest);
  }
  return data;
}

/** A page from memory, the phone's copy, or the server (saved on the phone). */
export async function loadPage(version: string, page: number): Promise<QuranPage> {
  const inMemory = pageMemory.get(`${version}:${page}`);
  if (inMemory) return inMemory;

  const cached = await readPage(version, page);
  if (cached) return remember(version, cached);

  const key = `${version}:${page}`;
  let request = pageRequests.get(key);
  if (!request) {
    request = fetchQuranPage(page)
      .then(async (data) => {
        await writePage(version, data);
        return remember(version, data);
      })
      .finally(() => pageRequests.delete(key));
    pageRequests.set(key, request);
  }

  return request;
}

export function prefetchPages(version: string, pages: number[], total: number): void {
  for (const page of pages) {
    if (page >= 1 && page <= total) {
      void loadPage(version, page).catch(() => undefined);
    }
  }
}

/** Loads the metadata (and the hizb divisions) in the background, e.g. at app start. */
export function preloadQuranMeta(): void {
  void loadMeta().catch(() => undefined);
}

export function useQuranMeta(): Loadable<QuranMeta> {
  const [state, setState] = useState<{ data: QuranMeta | null; loading: boolean; error: boolean }>({
    data: null,
    loading: true,
    error: false,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Show the cached copy right away, then the fresh one.
    void readLatestMeta().then((cached) => {
      if (cached) setDivisions(cached);
      if (!cancelled && cached)
        setState((current) => (current.data ? current : { data: cached, loading: true, error: false }));
    });

    loadMeta()
      .then((meta) => !cancelled && setState({ data: meta, loading: false, error: false }))
      .catch(() => !cancelled && setState((current) => ({ data: current.data, loading: false, error: !current.data })));

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: false }));
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, retry };
}

export function useQuranPage(version: string | undefined, page: number): Loadable<QuranPage> {
  const [state, setState] = useState<{ data: QuranPage | null; loading: boolean; error: boolean; key: string }>({
    data: null,
    loading: true,
    error: false,
    key: '',
  });
  const [attempt, setAttempt] = useState(0);
  const key = `${version}:${page}:${attempt}`;
  // Already in memory: show it on the first render, with no loading state.
  const inMemory = version ? pageMemory.get(`${version}:${page}`) : undefined;

  useEffect(() => {
    if (!version || inMemory) return;
    let cancelled = false;

    loadPage(version, page)
      .then((data) => !cancelled && setState({ data, loading: false, error: false, key }))
      .catch(() => !cancelled && setState({ data: null, loading: false, error: true, key }));

    return () => {
      cancelled = true;
    };
  }, [version, page, key, inMemory]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  if (inMemory) return { data: inMemory, loading: false, error: false, retry };
  const current = state.key === key;

  return {
    data: current ? state.data : null,
    loading: !current || state.loading,
    error: current && state.error,
    retry,
  };
}
