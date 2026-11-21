/**
 * Weekly Akhira points. Nothing is reset in the ledger: the weekly figure is
 * derived from the entries, so the real balance and the statistics stay as
 * they are.
 *
 * A week starts on Saturday 00:00 (`periodRange`). Its points start at minus
 * the Thanb still unpaid at that moment (a Thanb never disappears without
 * sadaqa), then add every Akhira line dated in the week. Paying a carried
 * Thanb adds its reward to Akhira, which cancels the carried minus.
 */
import { useMemo } from 'react';

import { addDays, periodRange, today } from '@/lib/dates';

import { useEntries, useSettings } from './hooks';
import { fixedAccountId, round } from './ledger';
import type { Entry } from './types';

export type AkhiraWeek = {
  start: string;
  end: string;
  /** Thanb unpaid when the week started (shown as a minus). */
  carriedIn: number;
  earned: number;
  lost: number;
  thanbAdded: number;
  thanbPaid: number;
  /** Thanb still unpaid at the end of the week (or now, for the current week). */
  carriedOut: number;
  /** The weekly points: −carriedIn + earned − lost. */
  points: number;
  /** The real Akhira balance at the end of the week. */
  real: number;
};

/** Every week from the first entry to the week of `day`, newest first. */
export function akhiraWeeks(entries: Entry[], day: string = today()): AkhiraWeek[] {
  const akhira = fixedAccountId('akhira');
  const thanb = fixedAccountId('thanb');
  const dated = entries.filter((entry) => entry.date <= periodRange(day, 'week').end);
  if (!dated.length) return [];
  const sorted = [...dated].sort((a, b) => a.date.localeCompare(b.date));

  const weeks: AkhiraWeek[] = [];
  let real = 0;
  let unpaid = 0;
  let index = 0;
  for (let start = periodRange(sorted[0].date, 'week').start; start <= day; start = addDays(start, 7)) {
    const end = addDays(start, 6);
    const carriedIn = Math.max(0, unpaid);
    const week = { start, end, carriedIn, earned: 0, lost: 0, thanbAdded: 0, thanbPaid: 0 };
    while (index < sorted.length && sorted[index].date <= end) {
      for (const line of sorted[index].lines) {
        if (line.account === akhira) {
          real += line.amount;
          if (line.amount > 0) week.earned += line.amount;
          else week.lost -= line.amount;
        } else if (line.account === thanb) {
          unpaid += line.amount;
          if (line.amount > 0) week.thanbAdded += line.amount;
          else week.thanbPaid -= line.amount;
        }
      }
      index += 1;
    }
    weeks.push({
      start,
      end,
      carriedIn: round(carriedIn),
      earned: round(week.earned),
      lost: round(week.lost),
      thanbAdded: round(week.thanbAdded),
      thanbPaid: round(week.thanbPaid),
      carriedOut: round(Math.max(0, unpaid)),
      points: round(week.earned - week.lost - carriedIn),
      real: round(real),
    });
  }
  return weeks.reverse();
}

/** Whether Home shows the weekly points (off by default). */
export function useWeeklyAkhiraEnabled(): boolean {
  return useSettings()?.weeklyAkhira ?? false;
}

export function useAkhiraWeeks(): AkhiraWeek[] {
  const entries = useEntries();
  const day = today();
  return useMemo(() => akhiraWeeks(entries, day), [entries, day]);
}

/** This week's points (0 before the first entry). */
export function useWeeklyAkhira(): number {
  return useAkhiraWeeks()[0]?.points ?? 0;
}
