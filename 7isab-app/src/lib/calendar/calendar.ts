/**
 * Calendar helpers: month grids (weeks start on Saturday), each day's task
 * status from the progress records. Hijri dates are in ./hijri.
 */
import { addDays, today, WEEK_START, weekday } from '@/lib/dates';
import { getProgressValue, isDue, isPeriodTask, progressRatio, taskRange } from '@/lib/ledger/tasks';
import type { Task } from '@/lib/ledger/types';

/** Weeks of a month ("YYYY-MM") as 7 cells each; null outside the month. */
export function monthGrid(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const [year, value] = month.split('-').map(Number);
  const days = new Date(year, value, 0).getDate();
  const lead = (weekday(first) - WEEK_START + 7) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let index = 0; index < days; index += 1) cells.push(addDays(first, index));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/** Weekday numbers (0 = Sunday) in calendar order, Saturday first. */
export function weekOrder(): number[] {
  return Array.from({ length: 7 }, (_, index) => (WEEK_START + index) % 7);
}

/** The 7 days of the week (Saturday → Friday) that holds `day`. */
export function weekDays(day: string): string[] {
  const start = addDays(day, -((weekday(day) - WEEK_START + 7) % 7));
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export type TaskState = 'done' | 'partial' | 'missed' | 'open' | 'upcoming';

export type DayTask = { task: Task; ratio: number; state: TaskState };

function stateOf(ratio: number, day: string, now: string): TaskState {
  if (ratio >= 1) return 'done';
  if (day > now) return 'upcoming';
  if (day === now) return ratio > 0 ? 'partial' : 'open';
  return ratio > 0 ? 'partial' : 'missed';
}

/** Tasks counted on this day itself (daily / chosen days), with their progress. */
export function dayTasks(tasks: Task[], day: string, now: string = today()): DayTask[] {
  return tasks
    .filter((task) => !isPeriodTask(task) && isDue(task, day))
    .map((task) => {
      const ratio = progressRatio(task, getProgressValue(task, day));
      return { task, ratio, state: stateOf(ratio, day, now) };
    });
}

/** Weekly / monthly / yearly tasks whose period holds this day, with the period's progress. */
export function periodTasks(tasks: Task[], day: string, now: string = today()): (DayTask & { end: string })[] {
  return tasks
    .filter((task) => isPeriodTask(task) && isDue(task, day))
    .map((task) => {
      const range = taskRange(task, day);
      const ratio = progressRatio(task, getProgressValue(task, day));
      return { task, ratio, end: range.end, state: stateOf(ratio, range.end, now) };
    });
}

export type DaySummary = { total: number; done: number; ratio: number; missed: number };

export function summarize(items: DayTask[]): DaySummary {
  const total = items.length;
  const done = items.filter((item) => item.state === 'done').length;
  const missed = items.filter((item) => item.state === 'missed').length;
  const ratio = total ? items.reduce((sum, item) => sum + item.ratio, 0) / total : 0;
  return { total, done, ratio, missed };
}
