/** Shapes returned by the server's public Quran API (/api/v1/quran/*). */

export type Surah = {
  id: number;
  name_arabic: string;
  name_simple: string;
  name_english: string;
  revelation_place: 'makkah' | 'madinah';
  verses_count: number;
  page_start: number;
  page_end: number;
  bismillah_pre: boolean;
};

export type QuranMeta = {
  version: string;
  pages: number;
  complete: boolean;
  surahs: Surah[];
  juz_starts: { juz: number; page: number }[];
  /** Quarters (rub', 240) and eighths (thumn, 480) of the hizbs; missing from older servers. */
  divisions?: {
    quarters: { key: string; page: number; words: number }[];
    eighths: { key: string; page: number; words: number }[];
  };
};

export type QuranWord = {
  /** Ayah key, e.g. "2:255". */
  key: string;
  position: number;
  /** 'end' is the ayah-number marker. */
  type: 'word' | 'end';
  text: string;
};

export type QuranLine = { line: number; words: QuranWord[] };

export type QuranPage = {
  number: number;
  juz: number | null;
  hizb: number | null;
  first_key: string | null;
  last_key: string | null;
  word_count: number;
  /** Surahs whose first ayah is on this page, and the line it starts on. */
  surah_starts: { surah_id: number; line: number }[];
  lines: QuranLine[];
};
