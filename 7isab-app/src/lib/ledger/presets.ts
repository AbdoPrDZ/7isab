/**
 * Presets for voluntary prayer (nafilah) and fasting tasks: default targets,
 * the days each fast is due, and the time window of each nafilah from the
 * day's prayer times.
 */
import { addDays } from '@/lib/dates';
import { prayerTimes, type PrayerSettings } from '@/lib/prayer/prayer';

import type { FastingPreset, NafilahType, TaskRepeat, TaskTarget } from './types';

export const NAFILAH_TYPES: NafilahType[] = ['rawatib', 'duha', 'witr', 'qiyam', 'tahajjud', 'other'];

/** Suggested rak'ahs; the user can change the target. */
export const NAFILAH_RAKAHS: Record<NafilahType, number> = {
  rawatib: 12,
  duha: 2,
  witr: 1,
  qiyam: 2,
  tahajjud: 2,
  other: 2,
};

const MINUTE = 60_000;

/**
 * When a nafilah can be prayed on `day`: Duha from ~15 min after sunrise to
 * ~10 min before Dhuhr; Witr and Qiyam from Isha to the next Fajr; Tahajjud in
 * the last third of the night (Maghrib → Fajr). Null for rawatib / other.
 */
export function nafilahWindow(type: NafilahType, settings: PrayerSettings, day: string): { from: Date; to: Date } | null {
  const times = prayerTimes(settings, day);
  if (!times) return null;
  if (type === 'duha') {
    return { from: new Date(times.sunrise.getTime() + 15 * MINUTE), to: new Date(times.dhuhr.getTime() - 10 * MINUTE) };
  }
  if (type === 'witr' || type === 'qiyam' || type === 'tahajjud') {
    const next = prayerTimes(settings, addDays(day, 1));
    if (!next) return null;
    if (type !== 'tahajjud') return { from: times.isha, to: next.fajr };
    const night = next.fajr.getTime() - times.maghrib.getTime();
    return { from: new Date(next.fajr.getTime() - night / 3), to: next.fajr };
  }
  return null;
}

export const FASTING_PRESETS: FastingPreset[] = [
  'ramadan',
  'mondayThursday',
  'whiteDays',
  'arafah',
  'ashura',
  'shawwal',
  'custom',
];

/** The days a fasting preset is due (null for custom: the user picks the repeat). */
export function fastingRepeat(preset: FastingPreset): TaskRepeat | null {
  switch (preset) {
    case 'ramadan':
      return { kind: 'hijri', months: [9], days: [] };
    case 'mondayThursday':
      return { kind: 'weekdays', days: [1, 4] };
    case 'whiteDays':
      return { kind: 'hijri', months: [], days: [13, 14, 15] };
    case 'arafah':
      return { kind: 'hijri', months: [12], days: [9] };
    case 'ashura':
      return { kind: 'hijri', months: [1], days: [9, 10] };
    case 'shawwal':
      return { kind: 'hijriMonth', months: [10] };
    default:
      return null;
  }
}

/** Six days of Shawwal counts days over the month; every other fast is one day. */
export function fastingTarget(preset: FastingPreset): TaskTarget {
  return preset === 'shawwal' ? { unit: 'days', amount: 6 } : { unit: 'check', amount: 1 };
}
