/** Local calendar days as "YYYY-MM-DD" strings (what the ledger uses). */

export function toDay(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

export function addDays(day: string, amount: number): string {
  const date = fromDay(day);
  date.setDate(date.getDate() + amount);
  return toDay(date);
}

export function today(): string {
  return toDay();
}

export function weekday(day: string): number {
  return fromDay(day).getDay();
}

/** "YYYY-MM" of a day. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function addMonths(month: string, amount: number): string {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(year, value - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Days from `from` to `to` inclusive (empty when from > to). */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** A calendar period. Weeks start on Saturday (السبت), months and years on the 1st. */
export type Period = 'week' | 'month' | 'year';

/** First weekday of a week: 6 = Saturday. */
export const WEEK_START = 6;

/** First and last day of the period that contains `day`. */
export function periodRange(day: string, period: Period): { start: string; end: string } {
  const date = fromDay(day);
  if (period === 'week') {
    const start = addDays(day, -((date.getDay() - WEEK_START + 7) % 7));
    return { start, end: addDays(start, 6) };
  }
  if (period === 'month') {
    return {
      start: toDay(new Date(date.getFullYear(), date.getMonth(), 1)),
      end: toDay(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    };
  }
  return { start: `${date.getFullYear()}-01-01`, end: `${date.getFullYear()}-12-31` };
}

/** Moves a day by whole periods (months keep the day of the month, capped at the month's end). */
export function addPeriods(day: string, period: Period, amount: number): string {
  if (period === 'week') return addDays(day, amount * 7);
  const date = fromDay(day);
  const months = period === 'month' ? amount : amount * 12;
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return toDay(target);
}

/** Number of periods from the one holding `from` to the one holding `to`, both counted (0 when to < from). */
export function periodsCount(from: string, to: string, period: Period): number {
  if (to < from) return 0;
  const a = periodRange(from, period).start;
  const b = periodRange(to, period).start;
  if (period === 'week') return Math.round((fromDay(b).getTime() - fromDay(a).getTime()) / (7 * 86_400_000)) + 1;
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return period === 'month' ? (by - ay) * 12 + (bm - am) + 1 : by - ay + 1;
}

/** Days left in the period after `day` (0 on its last day). */
export function daysLeftInPeriod(day: string, period: Period): number {
  const { end } = periodRange(day, period);
  return Math.round((fromDay(end).getTime() - fromDay(day).getTime()) / 86_400_000);
}
