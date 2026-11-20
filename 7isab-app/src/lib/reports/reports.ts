/**
 * Day / week / month / year reports, built on the device.
 *
 * Completion comes from the progress records and the prayer / bedtime marks
 * (not from hisab entries, which are written the day after), so today's report
 * is right at the end of the day. Points, sins, sadaqa and zakat come from the
 * entries of the period.
 *
 * Rating (an estimate only): score = completed ÷ (due items + sins).
 *   - due items: tasks (by their progress), prayers (on time / combined = 1,
 *     late = ½, missed = 0), bedtime (on time = 1, late with a Thanb reason or
 *     unmarked = 0; excused nights are left out). Items still open don't count.
 *   - sins: plain sins and fast taps (late prayers and late nights are already
 *     in the completion). Each one counts as one more missed item.
 *   good ≥ goodAt %, normal ≥ normalAt %, else weak (settings, default 80 / 50).
 */
import { useMemo } from 'react';

import type { AthkarDay } from '@/lib/athkar/athkar';
import { bedtimeMark, bedtimeState, getBedtimeTask } from '@/lib/bedtime/bedtime';
import { dayTasks, periodTasks } from '@/lib/calendar/calendar';
import { addDays, addPeriods, daysBetween, periodRange, today } from '@/lib/dates';
import { deterministicId, getDoc, getDocs, putDoc, removeDoc, useDocs, type Doc } from '@/lib/data/vault';
import { fixedAccountId, getSettings, round, updateSettings } from '@/lib/ledger/ledger';
import { useSettings } from '@/lib/ledger/hooks';
import {
  RecordTypes,
  type Entry,
  type Reason,
  type ReportPeriod,
  type ReportSettings,
  type Task,
} from '@/lib/ledger/types';
import { getPrayerSettings, isJumuah, PRAYERS } from '@/lib/prayer/prayer';
import { prayerMark, prayerState } from '@/lib/prayer/tasks';
import type { ReadingDay } from '@/lib/quran/reading';

export type { ReportPeriod, ReportSettings };
export const REPORT_PERIODS: ReportPeriod[] = ['day', 'week', 'month', 'year'];

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  hour: 22,
  minute: 0,
  notify: { day: true, week: true, month: true, year: true },
  goodAt: 80,
  normalAt: 50,
};

function withDefaults(value: Partial<ReportSettings> | undefined): ReportSettings {
  return { ...DEFAULT_REPORT_SETTINGS, ...value, notify: { ...DEFAULT_REPORT_SETTINGS.notify, ...value?.notify } };
}

export function getReportSettings(): ReportSettings {
  try {
    return withDefaults(getSettings().reports);
  } catch {
    return DEFAULT_REPORT_SETTINGS;
  }
}

export function useReportSettings(): ReportSettings {
  return withDefaults(useSettings()?.reports);
}

export async function updateReportSettings(changes: Partial<ReportSettings>): Promise<void> {
  await updateSettings({ reports: { ...getReportSettings(), ...changes } });
}

/** First and last day of the report that holds `day`. Years are Gregorian; weeks start on Saturday. */
export function reportRange(period: ReportPeriod, day: string): { start: string; end: string } {
  return period === 'day' ? { start: day, end: day } : periodRange(day, period);
}

export function shiftReport(period: ReportPeriod, day: string, amount: number): string {
  return period === 'day' ? addDays(day, amount) : addPeriods(day, period, amount);
}

export type Rating = 'good' | 'normal' | 'weak';

export function rate(score: number | null, settings: ReportSettings = getReportSettings()): Rating | null {
  if (score === null) return null;
  if (score * 100 >= settings.goodAt) return 'good';
  if (score * 100 >= settings.normalAt) return 'normal';
  return 'weak';
}

type Count = { done: number; total: number };

export type Report = {
  /** Missing for a free range (statistics). */
  period?: ReportPeriod;
  start: string;
  end: string;
  /** Days of the period up to today (a future period has none). */
  days: number;
  score: number | null;
  rating: Rating | null;
  /** Completion items and sins behind the score. */
  completed: number;
  items: number;
  tasks: { task: Task; done: number; total: number }[];
  /** Plain tasks (no hisab): shown apart, never in the score. */
  plain: TaskCount;
  tasksDone: number;
  tasksTotal: number;
  prayers: {
    onTime: number;
    combined: number;
    late: number;
    missed: number;
    mosque: number;
    home: number;
    khushoo: { good: number; normal: number; weak: number };
    jumuah: { mosque: number; home: number; missed: number };
  };
  bedtime: { onTime: number; late: number; excused: number; missed: number } | null;
  sins: number;
  fastTaps: number;
  earned: number;
  lost: number;
  thanbAdded: number;
  sadaqa: number;
  zakat: number;
  quran: { pages: number; words: number };
  athkar: number;
};

export type TaskCount = { rows: ({ task: Task } & Count)[]; completed: number; items: number };

/**
 * Completion of some tasks between start and end (up to today): daily /
 * chosen-day tasks per due day (today's only once done), and weekly / monthly /
 * yearly tasks once per period that ends in the range (or still runs at its
 * end, once done). Rows are sorted weakest first.
 */
export function countTasks(tasks: Task[], start: string, end: string): TaskCount {
  const todayKey = today();
  const last = end < todayKey ? end : todayKey;
  const perTask = new Map<string, { task: Task } & Count>();
  let completed = 0;
  let items = 0;
  const count = (task: Task, ratio: number) => {
    const row = perTask.get(task.id) ?? { task, done: 0, total: 0 };
    row.done += ratio;
    row.total += 1;
    perTask.set(task.id, row);
    completed += ratio;
    items += 1;
  };
  if (start > last) return { rows: [], completed: 0, items: 0 };
  const days = daysBetween(start, last);

  for (const date of days) {
    for (const item of dayTasks(tasks, date)) {
      if (date === todayKey && item.ratio < 1) continue;
      count(item.task, Math.min(1, item.ratio));
    }
  }

  // One count per task per period (a month holds several weeks of a weekly task).
  const seen = new Set<string>();
  const key = (item: { task: Task; end: string }) => `${item.task.id}:${item.end}`;
  for (const item of periodTasks(tasks, last)) {
    if (item.end < start || seen.has(key(item))) continue;
    seen.add(key(item));
    if (item.end > todayKey && item.ratio < 1) continue;
    count(item.task, Math.min(1, item.ratio));
  }
  for (const date of days) {
    for (const item of periodTasks(tasks, date)) {
      if (item.end > last || seen.has(key(item))) continue;
      seen.add(key(item));
      count(item.task, Math.min(1, item.ratio));
    }
  }

  const rows = [...perTask.values()].sort((a, b) => a.done / a.total - b.done / b.total);
  return { rows, completed, items };
}

/** Builds the report of the period that holds `day`. */
export function buildReport(period: ReportPeriod, day: string, now: Date = new Date()): Report {
  const { start, end } = reportRange(period, day);
  return { ...buildRangeReport(start, end, now), period };
}

/** The same report for any range (start..end, YYYY-MM-DD). */
export function buildRangeReport(start: string, end: string, now: Date = new Date()): Report {
  const last = end < today() ? end : today();
  const days = start <= last ? daysBetween(start, last) : [];
  const allTasks = getDocs<Task>(RecordTypes.task);
  const prayerSettings = getPrayerSettings();

  const taskCount = countTasks(
    allTasks.filter((task) => task.kind !== 'prayer' && task.kind !== 'bedtime' && !task.plain),
    start,
    end,
  );
  let completed = taskCount.completed;
  let items = taskCount.items;

  const prayers: Report['prayers'] = {
    onTime: 0,
    combined: 0,
    late: 0,
    missed: 0,
    mosque: 0,
    home: 0,
    khushoo: { good: 0, normal: 0, weak: 0 },
    jumuah: { mosque: 0, home: 0, missed: 0 },
  };
  const bedtimeTask = getBedtimeTask();
  const bedtime = bedtimeTask ? { onTime: 0, late: 0, excused: 0, missed: 0 } : null;

  for (const date of days) {
    if (prayerSettings.tasks) {
      for (const prayer of PRAYERS) {
        const state = prayerState(prayer, date, now);
        if (state === 'open' || state === 'upcoming') continue;
        const mark = prayerMark(prayer, date);
        if (state === 'prayed') prayers.onTime += 1;
        else if (state === 'combined') prayers.combined += 1;
        else if (state === 'late') prayers.late += 1;
        else prayers.missed += 1;
        completed += state === 'late' ? 0.5 : state === 'missed' ? 0 : 1;
        items += 1;
        if (mark?.place) prayers[mark.place] += 1;
        if (mark?.khushoo) prayers.khushoo[mark.khushoo] += 1;
        if (isJumuah(prayer, date)) {
          if (!mark) prayers.jumuah.missed += 1;
          else if (mark.place === 'home') prayers.jumuah.home += 1;
          else prayers.jumuah.mosque += 1;
        }
      }
    }

    if (bedtime && bedtimeTask && !bedtimeTask.archived && date >= bedtimeTask.startDate) {
      const state = bedtimeState(date, now);
      if (state === 'onTime') {
        bedtime.onTime += 1;
        completed += 1;
        items += 1;
      } else if (state === 'late') {
        const mark = bedtimeMark(date);
        const reason = mark?.reasonId ? getDoc<Reason>(RecordTypes.reason, mark.reasonId) : undefined;
        if (reason && !reason.thanb) bedtime.excused += 1;
        else {
          bedtime.late += 1;
          items += 1;
        }
      } else if (state === 'missed') {
        bedtime.missed += 1;
        items += 1;
      }
    }
  }

  // Entries of the period: points, sins, sadaqa, zakat.
  const akhira = fixedAccountId('akhira');
  const thanb = fixedAccountId('thanb');
  const sadaqaId = fixedAccountId('sadaqa');
  const zakatId = fixedAccountId('zakat');
  let earned = 0;
  let lost = 0;
  let thanbAdded = 0;
  let sadaqa = 0;
  let zakat = 0;
  let sins = 0;
  let fastTaps = 0;
  for (const entry of getDocs<Entry>(RecordTypes.entry)) {
    if (entry.date < start || entry.date > end) continue;
    if (entry.kind === 'sin') sins += 1;
    if (entry.kind === 'fast_tap') fastTaps += 1;
    for (const line of entry.lines) {
      if (line.account === akhira) {
        if (line.amount > 0) earned += line.amount;
        else lost -= line.amount;
      } else if (line.account === thanb && line.amount > 0) thanbAdded += line.amount;
      else if (line.account === sadaqaId && line.amount < 0 && (entry.kind === 'sadaqa' || entry.kind === 'thanb_paid')) {
        sadaqa -= line.amount;
      } else if (line.account === zakatId && line.amount < 0 && entry.kind === 'zakat') zakat -= line.amount;
    }
  }

  const quran = { pages: 0, words: 0 };
  for (const reading of getDocs<ReadingDay>(RecordTypes.readingDay)) {
    if (reading.date < start || reading.date > end) continue;
    quran.pages += reading.pages;
    quran.words += reading.words;
  }
  let athkar = 0;
  for (const athkarDay of getDocs<AthkarDay>(RecordTypes.athkarDay)) {
    if (athkarDay.date < start || athkarDay.date > end) continue;
    athkar += Object.values(athkarDay.counts).reduce((sum, value) => sum + value, 0);
  }

  const denominator = items + sins + fastTaps;
  const score = denominator ? Math.max(0, Math.min(1, completed / denominator)) : null;
  const tasks = taskCount.rows;

  return {
    start,
    end,
    days: days.length,
    score,
    rating: rate(score),
    completed: round(completed),
    items: denominator,
    tasks,
    plain: countTasks(
      allTasks.filter((task) => task.plain),
      start,
      end,
    ),
    tasksDone: round(tasks.reduce((sum, row) => sum + row.done, 0)),
    tasksTotal: tasks.reduce((sum, row) => sum + row.total, 0),
    prayers,
    bedtime,
    sins,
    fastTaps,
    earned: round(earned),
    lost: round(lost),
    thanbAdded: round(thanbAdded),
    sadaqa: round(sadaqa),
    zakat: round(zakat),
    quran,
    athkar,
  };
}

/** The report, rebuilt when any record it reads changes. */
export function useReport(period: ReportPeriod, day: string): { report: Report; previous: Report } {
  const progress = useDocs(RecordTypes.progress);
  const entries = useDocs(RecordTypes.entry);
  const tasks = useDocs(RecordTypes.task);
  const reading = useDocs(RecordTypes.readingDay);
  const athkar = useDocs(RecordTypes.athkarDay);
  const settings = useSettings();
  return useMemo(
    () => ({ report: buildReport(period, day), previous: buildReport(period, shiftReport(period, day, -1)) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt from the vault when these change
    [period, day, progress, entries, tasks, reading, athkar, settings],
  );
}

// ---- Notes ---------------------------------------------------------------------

export type ReportNote = Doc & { period: ReportPeriod; start: string; text: string };

function noteId(period: ReportPeriod, start: string): string {
  return deterministicId(`report-note:${period}:${start}`);
}

export function useReportNote(period: ReportPeriod, start: string): ReportNote | undefined {
  const notes = useDocs<ReportNote>(RecordTypes.reportNote);
  const id = noteId(period, start);
  return notes.find((note) => note.id === id);
}

/** Saves the private note of a report (an empty note is removed). */
export async function saveReportNote(period: ReportPeriod, start: string, text: string): Promise<void> {
  const id = noteId(period, start);
  const value = text.trim();
  if (!value) {
    if (getDoc(RecordTypes.reportNote, id)) await removeDoc(RecordTypes.reportNote, id);
    return;
  }
  await putDoc<ReportNote>(RecordTypes.reportNote, { id, period, start, text: value });
}
