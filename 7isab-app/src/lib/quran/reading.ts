/**
 * Tap-anywhere Quran reading: each tap counts the highlighted word and moves
 * to the next one. Progress is saved as the reading position, daily word and
 * page counts (which feed Quran tasks), and the khatma count.
 *
 * Fast-tap detection: a rolling window of the last taps is compared with the
 * time those words should take, from their letter count and the reader's own
 * speed (learned over the first pages). Too fast → a warning and the window's
 * words are not counted (the position goes back); doing it again the same day
 * adds a fast-tapping ذنب entry.
 */
import { create } from 'zustand';

import { today } from '@/lib/dates';
import { deterministicId, getDoc, putDoc, useDoc } from '@/lib/data/vault';
import { getSettings, logFastTap } from '@/lib/ledger/ledger';
import { addLinkedProgress } from '@/lib/ledger/tasks';
import { RecordTypes } from '@/lib/ledger/types';
import type { Doc } from '@/lib/data/vault';

import { wordShare, type DivisionUnit } from './divisions';

export const TOTAL_PAGES = 604;
export const TOTAL_WORDS = 77430;

export type ReadingDoc = Doc & {
  page: number;
  /** Index of the next word to read on `page` (ayah-number markers excluded). */
  word: number;
  totalWords: number;
  /** Pages finished in the current khatma. */
  pagesDone: number;
  khatmas: number;
  /** Learned reading speed, ms per letter. */
  msPerLetter: number;
  samples: number;
};

export type ReadingDay = Doc & { date: string; words: number; pages: number };

const WINDOW = 12;
const INITIAL_MS_PER_LETTER = 110;
const LEARNING_SAMPLES = 600;
/** Share of the expected time below which the window is "too fast", per strictness. */
const STRICTNESS_FACTOR = [0, 0.3, 0.45, 0.6];
const FLUSH_DELAY_MS = 2500;
/** Gaps longer than this are pauses, not reading. */
const MAX_GAP_MS = 20_000;

function readingId(): string {
  return deterministicId('reading');
}

function dayId(day: string): string {
  return deterministicId(`reading-day:${day}`);
}

/** Letters in a word, without diacritics or marks. */
export function letterCount(text: string): number {
  return (text.match(/[ء-غف-يٱ]/g) ?? []).length || 1;
}

function initialReading(): Omit<ReadingDoc, 'createdAt' | 'updatedAt'> {
  return {
    id: readingId(),
    page: 1,
    word: 0,
    totalWords: 0,
    pagesDone: 0,
    khatmas: 0,
    msPerLetter: INITIAL_MS_PER_LETTER,
    samples: 0,
  };
}

type Tap = { at: number; letters: number };

type LiveState = {
  /** Unsaved position (shown immediately; saved debounced). */
  live: Omit<ReadingDoc, 'createdAt' | 'updatedAt'> | null;
  pendingWords: number;
  pendingPages: number;
  /** Fractions of hizb / rub' / thumn read since the last save. */
  pendingParts: Record<DivisionUnit, number>;
  taps: Tap[];
  warnings: number;
};

const NO_PARTS: Record<DivisionUnit, number> = { hizb: 0, rub: 0, thumn: 0 };

const useLive = create<LiveState>(() => ({
  live: null,
  pendingWords: 0,
  pendingPages: 0,
  pendingParts: NO_PARTS,
  taps: [],
  warnings: 0,
}));

/** Word keys of the pages read in this session (for undo). */
const pageKeys = new Map<number, string[]>();

/** Adds (sign 1) or removes (sign -1) the hizb / rub' / thumn share of some words. */
function withParts(parts: Record<DivisionUnit, number>, keys: (string | undefined)[], sign: 1 | -1) {
  const next = { ...parts };
  for (const key of keys) {
    if (!key) continue;
    const share = wordShare(key);
    next.hizb += sign * share.hizb;
    next.rub += sign * share.rub;
    next.thumn += sign * share.thumn;
  }
  return next;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

function current(): Omit<ReadingDoc, 'createdAt' | 'updatedAt'> {
  return useLive.getState().live ?? getDoc<ReadingDoc>(RecordTypes.reading, readingId()) ?? initialReading();
}

/** Saves the position and adds the day's counts (and linked task progress). */
export async function flushReading(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  const { live, pendingWords, pendingPages, pendingParts } = useLive.getState();
  if (!live) return;
  useLive.setState({ pendingWords: 0, pendingPages: 0, pendingParts: NO_PARTS });

  await putDoc<ReadingDoc>(RecordTypes.reading, live);
  if (pendingWords || pendingPages) {
    const day = today();
    const existing = getDoc<ReadingDay>(RecordTypes.readingDay, dayId(day));
    await putDoc<ReadingDay>(RecordTypes.readingDay, {
      id: dayId(day),
      date: day,
      words: Math.max(0, (existing?.words ?? 0) + pendingWords),
      pages: Math.max(0, (existing?.pages ?? 0) + pendingPages),
    });
    await addLinkedProgress((task) => task.kind === 'quran', {
      words: pendingWords,
      pages: pendingPages,
      hizb: pendingParts.hizb,
      rub: pendingParts.rub,
      thumn: pendingParts.thumn,
    });
  }
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flushReading(), FLUSH_DELAY_MS);
}

export type TapResult = 'counted' | 'pageDone' | 'tooFast' | 'penalty';

/**
 * Counts the next word on `page`. `words` are the page's words in reading
 * order (markers excluded) and `keys` their ayah keys (for hizb / rub' /
 * thumn). Moving to a different page starts there.
 */
export function tapWord(page: number, words: string[], keys: string[] = []): TapResult {
  if (keys.length) pageKeys.set(page, keys);
  let state = current();
  if (state.page !== page) state = { ...state, page, word: 0 };
  if (state.word >= words.length) return 'pageDone';

  const now = Date.now();
  const { taps, pendingWords, pendingPages, pendingParts, warnings } = useLive.getState();
  const last = taps.at(-1);
  const nextTaps = last && now - last.at > MAX_GAP_MS ? [] : [...taps];
  nextTaps.push({ at: now, letters: letterCount(words[state.word]) });
  const window = nextTaps.slice(-WINDOW);

  // Fast-tap check on a full window.
  const strictness = getSettings().fastTapStrictness ?? 2;
  if (window.length === WINDOW && strictness > 0) {
    const elapsed = window[WINDOW - 1].at - window[0].at;
    const letters = window.slice(1).reduce((sum, tap) => sum + tap.letters, 0);
    const expected = letters * state.msPerLetter;

    if (elapsed < expected * STRICTNESS_FACTOR[strictness]) {
      // The window's words don't count: go back to re-read them.
      const back = Math.min(WINDOW - 1, state.word);
      const live = { ...state, word: state.word - back, totalWords: Math.max(0, state.totalWords - back) };
      useLive.setState({
        live,
        taps: [],
        pendingWords: pendingWords - back,
        pendingParts: withParts(pendingParts, keys.slice(state.word - back, state.word), -1),
        warnings: warnings + 1,
      });
      scheduleFlush();
      if (warnings >= 1) {
        void logFastTap();
        return 'penalty';
      }
      return 'tooFast';
    }

    // Learn the reader's speed from normal windows (fast at first, then slowly).
    const observed = elapsed / Math.max(1, letters);
    if (observed < state.msPerLetter * 4) {
      const weight = state.samples < LEARNING_SAMPLES ? 0.2 : 0.02;
      const msPerLetter = Math.min(400, Math.max(50, state.msPerLetter * (1 - weight) + observed * weight));
      state = { ...state, msPerLetter, samples: state.samples + 1 };
    }
  }

  let next = { ...state, word: state.word + 1, totalWords: state.totalWords + 1 };
  let pagesAdded = 0;
  let result: TapResult = 'counted';
  if (next.word >= words.length) {
    pagesAdded = 1;
    result = 'pageDone';
    const pagesDone = next.pagesDone + 1;
    next = pagesDone >= TOTAL_PAGES ? { ...next, pagesDone: 0, khatmas: next.khatmas + 1 } : { ...next, pagesDone };
    next = { ...next, page: page >= TOTAL_PAGES ? 1 : page + 1, word: 0 };
  }

  useLive.setState({
    live: next,
    taps: window,
    pendingWords: pendingWords + 1,
    pendingPages: pendingPages + pagesAdded,
    pendingParts: withParts(pendingParts, [keys[state.word]], 1),
  });
  scheduleFlush();
  return result;
}

/** Steps back one word (within the current page). */
export function undoTap(page: number): void {
  const keys = pageKeys.get(page) ?? [];
  const state = current();
  if (state.page !== page || state.word === 0) return;
  const { pendingWords, pendingParts } = useLive.getState();
  useLive.setState({
    live: { ...state, word: state.word - 1, totalWords: Math.max(0, state.totalWords - 1) },
    pendingWords: pendingWords - 1,
    pendingParts: withParts(pendingParts, [keys[state.word - 1]], -1),
    taps: [],
  });
  scheduleFlush();
}

/** Puts the reading position at the start of a page (to start reading there). */
export function startAtPage(page: number): void {
  useLive.setState({ live: { ...current(), page, word: 0 }, taps: [] });
  scheduleFlush();
}

/** The live reading position and today's words (null before any reading). */
export function useReadingState(): { page: number; word: number; wordsToday: number; doc: ReadingDoc | null } | null {
  const saved = useDoc<ReadingDoc>(RecordTypes.reading, readingIdSafe());
  const live = useLive((state) => state.live);
  const pendingWords = useLive((state) => state.pendingWords);
  const day = useDoc<ReadingDay>(RecordTypes.readingDay, dayIdSafe(today()));
  const position = live ?? saved;
  if (!position) return null;
  return {
    page: position.page,
    word: position.word,
    wordsToday: Math.max(0, (day?.words ?? 0) + pendingWords),
    doc: { ...(saved ?? { createdAt: 0, updatedAt: 0 }), ...position } as ReadingDoc,
  };
}

/** Ids need the open vault; hooks may render a moment before it opens. */
function readingIdSafe(): string | undefined {
  try {
    return readingId();
  } catch {
    return undefined;
  }
}

function dayIdSafe(day: string): string | undefined {
  try {
    return dayId(day);
  } catch {
    return undefined;
  }
}
