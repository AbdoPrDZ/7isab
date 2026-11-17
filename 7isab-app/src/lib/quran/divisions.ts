/**
 * Hizb (60), rub' (quarter, 240) and thumn (eighth, 480) of the Quran, from
 * the server's metadata. A hizb is 4 quarters or 8 eighths.
 *
 * Reading counts each word as a fraction of its own eighth, quarter and hizb
 * (1 / words in it), so reading a whole quarter adds exactly 1 quarter, half
 * of it 0.5, and so on, wherever you start.
 */
import type { QuranMeta } from './types';

export type Division = { key: string; page: number; words: number };
export type DivisionUnit = 'hizb' | 'rub' | 'thumn';

type Index = {
  /** Global ayah number of the first ayah of each surah (index = surah id). */
  surahStart: number[];
  quarterStarts: number[];
  eighthStarts: number[];
  quarters: Division[];
  eighths: Division[];
  hizbWords: number[];
};

let index: Index | null = null;

/** Global ayah number (1…6236) of "surah:ayah". */
function globalAyah(key: string, surahStart: number[]): number {
  const [surah, ayah] = key.split(':').map(Number);
  return (surahStart[surah] ?? 0) + ayah;
}

/** Call whenever metadata is loaded; ignores metadata without divisions (old server). */
export function setDivisions(meta: QuranMeta): void {
  const divisions = meta.divisions;
  if (!divisions?.quarters?.length || !divisions.eighths?.length) return;
  const surahStart: number[] = [];
  let total = 0;
  for (const surah of [...meta.surahs].sort((a, b) => a.id - b.id)) {
    surahStart[surah.id] = total;
    total += surah.verses_count;
  }
  const hizbWords: number[] = [];
  divisions.quarters.forEach((quarter, i) => {
    const hizb = Math.floor(i / 4);
    hizbWords[hizb] = (hizbWords[hizb] ?? 0) + quarter.words;
  });
  index = {
    surahStart,
    quarterStarts: divisions.quarters.map((item) => globalAyah(item.key, surahStart)),
    eighthStarts: divisions.eighths.map((item) => globalAyah(item.key, surahStart)),
    quarters: divisions.quarters,
    eighths: divisions.eighths,
    hizbWords,
  };
}

export function hasDivisions(): boolean {
  return index !== null;
}

/** Last position in `starts` whose value is ≤ target (starts are sorted). */
function lastAtOrBefore(starts: number[], target: number): number {
  let low = 0;
  let high = starts.length - 1;
  let found = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (starts[mid] <= target) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

export type DivisionPosition = {
  /** 1…60 */
  hizb: number;
  /** Quarter within the hizb, 1…4 (1 = start of the hizb). */
  rub: number;
  /** Eighth within the hizb, 1…8. */
  thumn: number;
  /** Global indexes, 0-based. */
  quarter: number;
  eighth: number;
};

/** Which hizb, quarter and eighth an ayah is in. */
export function divisionOf(key: string): DivisionPosition | null {
  if (!index) return null;
  const ayah = globalAyah(key, index.surahStart);
  let eighth = lastAtOrBefore(index.eighthStarts, ayah);
  // A one-ayah quarter has an empty second eighth on the same ayah: its words belong to the first.
  while (
    eighth > 0 &&
    index.eighths[eighth].words === 0 &&
    index.eighthStarts[eighth - 1] === index.eighthStarts[eighth]
  ) {
    eighth -= 1;
  }
  const quarter = lastAtOrBefore(index.quarterStarts, ayah);
  return {
    hizb: Math.floor(quarter / 4) + 1,
    rub: (quarter % 4) + 1,
    thumn: (eighth % 8) + 1,
    quarter,
    eighth,
  };
}

/** How much of its hizb, quarter and eighth one word of this ayah is. */
export function wordShare(key: string): Record<DivisionUnit, number> {
  const position = divisionOf(key);
  if (!position || !index) return { hizb: 0, rub: 0, thumn: 0 };
  const share = (words: number | undefined) => (words ? 1 / words : 0);
  return {
    hizb: share(index.hizbWords[position.hizb - 1]),
    rub: share(index.quarters[position.quarter]?.words),
    thumn: share(index.eighths[position.eighth]?.words),
  };
}

/** Page where a hizb (1…60), quarter (1…240) or eighth (1…480) starts. */
export function divisionStartPage(unit: DivisionUnit, number: number): number | null {
  if (!index) return null;
  if (unit === 'hizb') return index.quarters[(number - 1) * 4]?.page ?? null;
  if (unit === 'rub') return index.quarters[number - 1]?.page ?? null;
  return index.eighths[number - 1]?.page ?? null;
}

/** Hizb, quarter and eighth at the start of a page (the last ones starting on or before it). */
export function divisionAtPage(page: number): DivisionPosition | null {
  if (!index) return null;
  const quarter = lastAtOrBefore(
    index.quarters.map((item) => item.page),
    page,
  );
  const eighth = lastAtOrBefore(
    index.eighths.map((item) => item.page),
    page,
  );
  return { hizb: Math.floor(quarter / 4) + 1, rub: (quarter % 4) + 1, thumn: (eighth % 8) + 1, quarter, eighth };
}
