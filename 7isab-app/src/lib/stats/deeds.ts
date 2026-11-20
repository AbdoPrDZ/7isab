/**
 * Deeds figures for any range, from the marks and progress (not from entries):
 * per-prayer on time / late / missed / mosque / home / khushoo, bedtime average
 * and late reasons, and each day's completion for the heat map.
 */
import { bedtimeMark, bedtimeState, getBedtimeTask } from '@/lib/bedtime/bedtime';
import { dayTasks } from '@/lib/calendar/calendar';
import type { Khushoo, PrayerName, Task } from '@/lib/ledger/types';
import { getPrayerSettings, isJumuah, PRAYERS } from '@/lib/prayer/prayer';
import { prayerMark, prayerState } from '@/lib/prayer/tasks';

import { rangeDays, type Range } from './filter';

export type PrayerRow = {
  prayer: PrayerName;
  onTime: number;
  late: number;
  missed: number;
  mosque: number;
  home: number;
  khushoo: Record<Khushoo, number>;
};

export function prayerTable(range: Range, only: PrayerName[], now: Date = new Date()): PrayerRow[] {
  if (!getPrayerSettings().tasks) return [];
  const prayers = only.length ? PRAYERS.filter((prayer) => only.includes(prayer)) : PRAYERS;
  const days = rangeDays(range);
  return prayers.map((prayer) => {
    const row: PrayerRow = { prayer, onTime: 0, late: 0, missed: 0, mosque: 0, home: 0, khushoo: { good: 0, normal: 0, weak: 0 } };
    for (const day of days) {
      const state = prayerState(prayer, day, now);
      if (state === 'open' || state === 'upcoming') continue;
      if (state === 'prayed' || state === 'combined') row.onTime += 1;
      else if (state === 'late') row.late += 1;
      else row.missed += 1;
      const mark = prayerMark(prayer, day);
      if (mark?.place) row[mark.place] += 1;
      if (mark?.khushoo) row.khushoo[mark.khushoo] += 1;
    }
    return row;
  });
}

export function jumuahCounts(range: Range, now: Date = new Date()) {
  const counts = { mosque: 0, home: 0, missed: 0 };
  if (!getPrayerSettings().tasks) return counts;
  for (const day of rangeDays(range)) {
    if (!isJumuah('dhuhr', day)) continue;
    const state = prayerState('dhuhr', day, now);
    if (state === 'open' || state === 'upcoming') continue;
    const mark = prayerMark('dhuhr', day);
    if (!mark) counts.missed += 1;
    else if (mark.place === 'home') counts.home += 1;
    else counts.mosque += 1;
  }
  return counts;
}

export type BedtimeStats = {
  nights: number;
  onTime: number;
  late: number;
  missed: number;
  /** Average time asleep as minutes after midnight (can be negative: before midnight), null without marks. */
  averageMinutes: number | null;
  reasons: [string, number][];
};

export function bedtimeStats(range: Range, now: Date = new Date()): BedtimeStats | null {
  const task = getBedtimeTask();
  if (!task) return null;
  const result: BedtimeStats = { nights: 0, onTime: 0, late: 0, missed: 0, averageMinutes: null, reasons: [] };
  const reasons = new Map<string, number>();
  let total = 0;
  let marked = 0;
  for (const night of rangeDays(range)) {
    if (night < task.startDate) continue;
    const state = bedtimeState(night, now);
    if (state === 'open' || state === 'upcoming') continue;
    result.nights += 1;
    if (state === 'onTime') result.onTime += 1;
    else if (state === 'late') result.late += 1;
    else result.missed += 1;
    const mark = bedtimeMark(night);
    if (mark?.status === 'late' && mark.cause) reasons.set(mark.cause, (reasons.get(mark.cause) ?? 0) + 1);
    if (mark?.sleptAt) {
      const at = new Date(mark.sleptAt);
      let minutes = at.getHours() * 60 + at.getMinutes();
      if (minutes >= 12 * 60) minutes -= 24 * 60; // evening = before midnight
      total += minutes;
      marked += 1;
    }
  }
  result.averageMinutes = marked ? Math.round(total / marked) : null;
  result.reasons = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
  return result;
}

/** Each day's completion (tasks + prayers + bedtime) for the heat map; null when nothing was due. */
export function dailyCompletion(range: Range, tasks: Task[], now: Date = new Date()): { day: string; ratio: number | null }[] {
  const prayersOn = getPrayerSettings().tasks;
  const bedtime = getBedtimeTask();
  return rangeDays(range).map((day) => {
    let done = 0;
    let due = 0;
    for (const item of dayTasks(tasks, day)) {
      if (item.task.kind === 'prayer' || item.task.kind === 'bedtime') continue;
      done += Math.min(1, item.ratio);
      due += 1;
    }
    if (prayersOn) {
      for (const prayer of PRAYERS) {
        const state = prayerState(prayer, day, now);
        if (state === 'open' || state === 'upcoming') continue;
        due += 1;
        done += state === 'late' ? 0.5 : state === 'missed' ? 0 : 1;
      }
    }
    if (bedtime && !bedtime.archived && day >= bedtime.startDate) {
      const state = bedtimeState(day, now);
      if (state === 'onTime' || state === 'late' || state === 'missed') {
        due += 1;
        if (state === 'onTime') done += 1;
      }
    }
    return { day, ratio: due ? done / due : null };
  });
}
