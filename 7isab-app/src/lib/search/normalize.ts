/**
 * Text folding for search, so plain typing finds the stored text:
 * - Latin: lower case, accents removed (é → e).
 * - Arabic: diacritics and Quran marks removed; hamza forms, alef forms and
 *   ta marbuta folded. `quran: true` also folds the Uthmani spelling of the
 *   Quran text to plain spelling (ٱلصَّلَوٰة ↔ الصلاة, ٱلْقُرْءَان ↔ القرآن,
 *   إِبْرَٰهِـۧم ↔ إبراهيم): alefs, hamza and spaces are ignored on both sides.
 */

/** Harakat, tanwin, shadda, sukun, Quran annotation marks, tatweel. */
const MARKS = /[ؐ-ًؚ-ٟۖ-ۜ۟-۪ۤۧۨ-ۭـ]/g;

export function foldText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // Latin accents
    .toLowerCase()
    .replace(/[ۥۦ]/g, '') // small waw / yeh
    .replace(MARKS, '')
    .replace(/ٰ/g, '') // dagger alef
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[ئى]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Uthmani-aware folding for Quran text (see the file comment). Spaces are removed. */
export function foldQuran(text: string): string {
  return text
    .normalize('NFC')
    .replace(/ۧ/g, 'ي') // small high yeh (إِبْرَٰهِـۧمَ)
    .replace(/[ۥۦ]/g, '') // small waw / yeh lengthening a pronoun (تَأْخُذُهُۥ, بِهِۦ): not written in plain spelling
    // Silent waw before ta marbuta (ٱلصَّلَوٰة, ٱلزَّكَوٰة, ٱلْحَيَوٰة, مِشْكَوٰة) reads as alef;
    // elsewhere (ٱلسَّمَٰوَٰت, وَٰلِدَيْن) the waw is real and the dagger alef is just an alef.
    .replace(/و[ً-ٟ]*ٰ(?=[ً-ٟۖ-ۭ]*ة)/g, 'ا')
    .replace(/ٰ/g, 'ا') // dagger alef
    .replace(MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    // Hamza seats differ between Uthmani and plain spelling (ٱلصَّٰبِـِٔينَ ↔ الصابئين): ignore hamza, alef and spaces.
    .replace(/[اءئؤ\s]/g, '');
}

/** True when every word of the query is in the text (both already folded). */
export function matchesAll(folded: string, query: string): boolean {
  if (!query) return false;
  return query.split(' ').every((word) => folded.includes(word));
}
