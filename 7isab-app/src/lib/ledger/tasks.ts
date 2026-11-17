/**
 * Tasks and the end-of-day check.
 *
 * Each day a task is due, its progress (0..1) becomes entries once the day is
 * over: Akhira +reward × progress, and for the missed part Akhira −penalty ×
 * (1 − progress) with Thanb +the same. Entry ids are stable (HMAC of task + day),
 * so running the check twice, or on two devices, never doubles anything.
 *
 * Weekly / monthly / yearly (and Hijri-month) tasks work the same way over a
 * whole period: all progress in the period adds up, and the period is counted
 * the day after it ends. Hijri tasks (Ramadan, White Days…) are due on the
 * matching Hijri days, using the user's Hijri ±days adjustment.
 */
import { addDays, daysBetween, periodRange, today, weekday, type Period } from '@/lib/dates';
import { hijriDate, hijriMonthRange, isForbiddenFastDay } from '@/lib/calendar/hijri';
import { deterministicId, getDoc, getDocs, newId, putDoc, putDocs, removeDoc } from '@/lib/data/vault';

import { fixedAccountId, getSettings, round, updateSettings } from './ledger';
import { RecordTypes, type Entry, type Task, type TaskProgress } from './types';

const PERIODS: Partial<Record<Task['repeat']['kind'], Period>> = { weekly: 'week', monthly: 'month', yearly: 'year' };

/** The calendar period of a weekly / monthly / yearly task, or null for daily ones. */
export function taskPeriod(task: Task): Period | null {
  return PERIODS[task.repeat.kind] ?? null;
}

/** True for tasks whose target covers a whole period (week, month, year or Hijri month). */
export function isPeriodTask(task: Task): boolean {
  return taskPeriod(task) !== null || task.repeat.kind === 'hijriMonth';
}

/** First and last day of the task's period that holds `day` (the day itself for daily tasks). */
export function taskRange(task: Task, day: string): { start: string; end: string } {
  if (task.repeat.kind === 'hijriMonth') return hijriMonthRange(day) ?? { start: day, end: day };
  const period = taskPeriod(task);
  return period ? periodRange(day, period) : { start: day, end: day };
}

/** Days left in the task's period after `day` (0 for daily tasks and on the last day). */
export function daysLeft(task: Task, day: string): number {
  return Math.max(0, daysBetween(day, taskRange(task, day).end).length - 1);
}

export function isDue(task: Task, day: string): boolean {
  if (task.archived || day < task.startDate) return false;
  if (task.kind === 'fasting' && isForbiddenFastDay(day)) return false;
  const repeat = task.repeat;
  if (repeat.kind === 'weekdays') return repeat.days.includes(weekday(day));
  if (repeat.kind === 'hijri' || repeat.kind === 'hijriMonth') {
    const h = hijriDate(day);
    if (!h) return false;
    if (repeat.months.length && !repeat.months.includes(h.month)) return false;
    return repeat.kind === 'hijriMonth' || !repeat.days.length || repeat.days.includes(h.day);
  }
  return true;
}

export function progressId(taskId: string, day: string): string {
  return deterministicId(`progress:${taskId}:${day}`);
}

/** Progress for the day (or the whole period) that holds `day`. */
export function getProgressValue(task: Task, day: string): number {
  const key = taskRange(task, day).start;
  return getDoc<TaskProgress>(RecordTypes.progress, progressId(task.id, key))?.value ?? 0;
}

/** Progress as a fraction 0..1. */
export function progressRatio(task: Task, value: number): number {
  if (task.target.amount <= 0) return value > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, value / task.target.amount));
}

export async function setProgress(task: Task, day: string, value: number): Promise<void> {
  const key = taskRange(task, day).start;
  await putDoc<TaskProgress>(RecordTypes.progress, {
    id: progressId(task.id, key),
    taskId: task.id,
    date: key,
    value: Math.max(0, round(value)),
  });
}

export async function addProgress(task: Task, day: string, amount: number): Promise<void> {
  await setProgress(task, day, getProgressValue(task, day) + amount);
}

/** Adds progress to every due task linked to a source (Quran reading, an athkar list). */
export async function addLinkedProgress(
  match: (task: Task) => boolean,
  unitAmounts: Partial<Record<Task['target']['unit'], number>>,
  day: string = today(),
): Promise<void> {
  const tasks = getDocs<Task>(RecordTypes.task).filter((task) => isDue(task, day) && match(task));
  for (const task of tasks) {
    const amount = unitAmounts[task.target.unit];
    if (amount) await addProgress(task, day, amount);
  }
}

export async function saveTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Task> {
  return putDoc<Task>(RecordTypes.task, { ...task, id: task.id ?? newId() });
}

/** Archive keeps the task's history; delete removes it (entries already made stay). */
export async function archiveTask(task: Task): Promise<void> {
  await putDoc<Task>(RecordTypes.task, { ...task, archived: true });
}

export async function deleteTask(task: Task): Promise<void> {
  await removeDoc(RecordTypes.task, task.id);
}

export function taskEntryId(taskId: string, day: string): string {
  return deterministicId(`task-entry:${taskId}:${day}`);
}

/**
 * The entry a finished day (or a finished period, given its last day) produces
 * for a task (null when nothing changes). The id uses the period's first day.
 */
export function entryForDay(task: Task, day: string): Omit<Entry, 'createdAt' | 'updatedAt'> | null {
  const key = taskRange(task, day).start;
  const ratio = progressRatio(task, getProgressValue(task, day));
  const reward = round(task.reward * ratio);
  const penalty = round(task.penalty * (1 - ratio));
  if (reward === 0 && penalty === 0) return null;

  const akhira = fixedAccountId('akhira');
  const thanb = fixedAccountId('thanb');
  const lines = [
    { account: akhira, amount: round(reward - penalty) },
    { account: thanb, amount: penalty },
  ].filter((line) => line.amount !== 0);

  return {
    id: taskEntryId(task.id, key),
    kind: ratio >= 1 ? 'task_done' : 'task_missed',
    date: day,
    taskId: task.id,
    lines,
  };
}

/**
 * Closes every finished day since the last check (catch-up for days the app
 * wasn't opened). Today stays open until tomorrow.
 */
export async function closeFinishedDays(): Promise<number> {
  const settings = getSettings();
  const yesterday = addDays(today(), -1);
  const tasks = getDocs<Task>(RecordTypes.task);
  if (!tasks.length) {
    if (settings.closedThrough !== yesterday) await updateSettings({ closedThrough: yesterday });
    return 0;
  }

  const firstStart = tasks.reduce((min, task) => (task.startDate < min ? task.startDate : min), yesterday);
  const from = settings.closedThrough ? addDays(settings.closedThrough, 1) : firstStart;
  if (from > yesterday) return 0;

  const entries: Omit<Entry, 'createdAt' | 'updatedAt'>[] = [];
  for (const day of daysBetween(from, yesterday)) {
    for (const task of tasks) {
      if (!isDue(task, day)) continue;
      // Prayer tasks are counted at each prayer's deadline instead (lib/prayer/tasks).
      if (task.kind === 'prayer') continue;
      // Period tasks are counted only on the last day of their period.
      const range = taskRange(task, day);
      if (range.end !== day) continue;
      if (getDoc(RecordTypes.entry, taskEntryId(task.id, range.start))) continue;
      const entry = entryForDay(task, day);
      if (entry) entries.push(entry);
    }
  }

  if (entries.length) await putDocs<Entry>(RecordTypes.entry, entries);
  await updateSettings({ closedThrough: yesterday });
  return entries.length;
}
