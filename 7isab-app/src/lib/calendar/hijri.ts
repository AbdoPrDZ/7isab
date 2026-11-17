/**
 * Hijri dates (Umm al-Qura, from the phone's Intl calendar) with the user's
 * ±days adjustment, because countries that start months by moon sighting
 * (Algeria, Morocco…) can be a day off from Umm al-Qura.
 */
import { addDays, fromDay } from '@/lib/dates';

export type HijriDate = { year: number; month: number; day: number };

let offset = 0;
const cache = new Map<string, HijriDate | null>();

/** Days added to every Hijri date (−2…+2). Set from the prayer settings. */
export function setHijriOffset(days: number): void {
  const next = Math.max(-2, Math.min(2, Math.round(days || 0)));
  if (next !== offset) {
    offset = next;
    cache.clear();
  }
}

export function getHijriOffset(): number {
  return offset;
}

let parts: Intl.DateTimeFormat | null | undefined;

function partsFormat(): Intl.DateTimeFormat | null {
  if (parts === undefined) {
    try {
      parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      });
    } catch {
      parts = null;
    }
  }
  return parts;
}

function compute(day: string): HijriDate | null {
  const format = partsFormat();
  if (!format) return null;
  const date = fromDay(addDays(day, offset));
  try {
    const values = Object.fromEntries(
      format
        .formatToParts(date)
        .filter((part) => part.type === 'day' || part.type === 'month' || part.type === 'year')
        .map((part) => [part.type, Number.parseInt(part.value, 10)]),
    );
    if (values.day && values.month && values.year) return { year: values.year, month: values.month, day: values.day };
  } catch {
    // formatToParts missing: fall back to "M/D/YYYY AH".
  }
  const numbers = format.format(date).match(/\d+/g)?.map(Number);
  return numbers && numbers.length >= 3 ? { month: numbers[0], day: numbers[1], year: numbers[2] } : null;
}

/** Hijri date of a "YYYY-MM-DD" day, or null when the phone has no Hijri calendar. */
export function hijriDate(day: string): HijriDate | null {
  if (!cache.has(day)) cache.set(day, compute(day));
  return cache.get(day) ?? null;
}

const textFormats = new Map<string, Intl.DateTimeFormat | null>();

/** Hijri date as text in the app language; 'day' gives only the day number. */
export function hijriText(day: string, language: string, style: 'day' | 'long' | 'month'): string {
  const key = `${language}:${style}`;
  if (!textFormats.has(key)) {
    try {
      const options: Intl.DateTimeFormatOptions =
        style === 'day'
          ? { day: 'numeric' }
          : style === 'month'
            ? { month: 'long', year: 'numeric' }
            : { day: 'numeric', month: 'long', year: 'numeric' };
      textFormats.set(key, new Intl.DateTimeFormat(`${language}-u-ca-islamic-umalqura-nu-latn`, options));
    } catch {
      textFormats.set(key, null);
    }
  }
  const format = textFormats.get(key);
  return format ? format.format(fromDay(addDays(day, offset))) : '';
}

/** First and last Gregorian day of the Hijri month that holds `day`. */
export function hijriMonthRange(day: string): { start: string; end: string } | null {
  const here = hijriDate(day);
  if (!here) return null;
  let start = day;
  for (let step = 0; step < 31; step += 1) {
    const before = hijriDate(addDays(start, -1));
    if (!before || before.month !== here.month) break;
    start = addDays(start, -1);
  }
  let end = day;
  for (let step = 0; step < 31; step += 1) {
    const after = hijriDate(addDays(end, 1));
    if (!after || after.month !== here.month) break;
    end = addDays(end, 1);
  }
  return { start, end };
}

export type SpecialDay = 'ramadan' | 'eidFitr' | 'eidAdha' | 'arafah' | 'ashura' | 'whiteDay' | 'newYear' | 'tashriq';

/** Notable days of the Islamic year (for the calendar). */
export function specialDays(day: string): SpecialDay[] {
  const h = hijriDate(day);
  if (!h) return [];
  const result: SpecialDay[] = [];
  if (h.month === 9) result.push('ramadan');
  if (h.month === 10 && h.day === 1) result.push('eidFitr');
  if (h.month === 12 && h.day === 9) result.push('arafah');
  if (h.month === 12 && h.day === 10) result.push('eidAdha');
  if (h.month === 12 && h.day >= 11 && h.day <= 13) result.push('tashriq');
  if (h.month === 1 && h.day === 1) result.push('newYear');
  if (h.month === 1 && (h.day === 9 || h.day === 10)) result.push('ashura');
  if (h.day >= 13 && h.day <= 15 && !(h.month === 12 && h.day === 13)) result.push('whiteDay');
  return result;
}

/** Days when fasting is not allowed: the two Eids and the days of Tashriq (11–13 Dhul Hijjah). */
export function isForbiddenFastDay(day: string): boolean {
  const h = hijriDate(day);
  if (!h) return false;
  return (h.month === 10 && h.day === 1) || (h.month === 12 && h.day >= 10 && h.day <= 13);
}
