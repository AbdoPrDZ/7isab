/**
 * The statistics panel's filter: a period (preset or custom range), compared
 * with the previous range of the same length, multi-select filters (empty =
 * all), a text search, and a grouping. Applied to entries here, and to tasks /
 * prayers in the deeds section.
 */
import { addDays, daysBetween, periodRange, today, weekday, type Period } from '@/lib/dates';
import type { Account, Entry, EntryKind, PrayerName, Task, TaskKind } from '@/lib/ledger/types';

export type RangePreset = 'thisWeek' | 'thisMonth' | 'thisYear' | 'last7' | 'last30' | 'last90' | 'last365' | 'all' | 'custom';
export const RANGE_PRESETS: RangePreset[] = ['thisWeek', 'thisMonth', 'thisYear', 'last7', 'last30', 'last90', 'last365', 'all', 'custom'];

export type GroupBy = 'time' | 'weekday' | 'category' | 'account' | 'currency' | 'person' | 'kind' | 'task' | 'sinType';
export const GROUP_BYS: GroupBy[] = ['time', 'weekday', 'category', 'account', 'currency', 'person', 'kind', 'task', 'sinType'];

export type StatsFilter = {
  preset: RangePreset;
  /** Custom range (YYYY-MM-DD), used when preset is custom. */
  start?: string;
  end?: string;
  accounts: string[];
  currencies: string[];
  categories: string[];
  kinds: EntryKind[];
  people: string[];
  tasks: string[];
  taskKinds: TaskKind[];
  programs: string[];
  prayers: PrayerName[];
  sinTypes: string[];
  search: string;
  groupBy: GroupBy;
};

export const EMPTY_FILTER: StatsFilter = {
  preset: 'thisMonth',
  accounts: [],
  currencies: [],
  categories: [],
  kinds: [],
  people: [],
  tasks: [],
  taskKinds: [],
  programs: [],
  prayers: [],
  sinTypes: [],
  search: '',
  groupBy: 'time',
};

/** The multi-select keys (each an array of ids / values). */
export const LIST_KEYS = [
  'accounts',
  'currencies',
  'categories',
  'kinds',
  'people',
  'tasks',
  'taskKinds',
  'programs',
  'prayers',
  'sinTypes',
] as const;
export type ListKey = (typeof LIST_KEYS)[number];

export function activeFilterCount(filter: StatsFilter): number {
  return LIST_KEYS.reduce((sum, key) => sum + (filter[key].length ? 1 : 0), 0) + (filter.search.trim() ? 1 : 0);
}

export type Range = { start: string; end: string };

/** The dates a filter covers. "all" starts at the first entry (or today). */
export function resolveRange(filter: StatsFilter, firstDay: string | null): Range {
  const day = today();
  const period = (p: Period) => periodRange(day, p);
  switch (filter.preset) {
    case 'thisWeek':
      return period('week');
    case 'thisMonth':
      return period('month');
    case 'thisYear':
      return period('year');
    case 'last7':
      return { start: addDays(day, -6), end: day };
    case 'last30':
      return { start: addDays(day, -29), end: day };
    case 'last90':
      return { start: addDays(day, -89), end: day };
    case 'last365':
      return { start: addDays(day, -364), end: day };
    case 'all':
      return { start: firstDay && firstDay < day ? firstDay : day, end: day };
    case 'custom': {
      const start = filter.start ?? day;
      const end = filter.end ?? start;
      return start <= end ? { start, end } : { start: end, end: start };
    }
  }
}

/** The range of the same length just before. */
export function previousRange(range: Range): Range {
  const length = daysBetween(range.start, range.end).length;
  return { start: addDays(range.start, -length), end: addDays(range.start, -1) };
}

/** Days of a range up to today (the part that has happened). */
export function rangeDays(range: Range): string[] {
  const last = range.end < today() ? range.end : today();
  return range.start <= last ? daysBetween(range.start, last) : [];
}

// ---- Entries ---------------------------------------------------------------------

export type FilterContext = {
  accounts: Map<string, Account>;
  tasks: Map<string, Task>;
  /** Currency (or "XAU_G") of each money / gold account. */
  currencyOf: (account: Account) => string | null;
  /** Text shown for an entry (task title, sin name, note…), searched too. */
  describe: (entry: Entry) => string;
};

/** True when the entry passes every active filter (the date is checked separately). */
export function matchEntry(entry: Entry, filter: StatsFilter, ctx: FilterContext): boolean {
  if (filter.kinds.length && !filter.kinds.includes(entry.kind)) return false;
  if (filter.accounts.length && !entry.lines.some((line) => filter.accounts.includes(line.account))) return false;
  if (filter.currencies.length) {
    const ok = entry.lines.some((line) => {
      const account = ctx.accounts.get(line.account);
      const currency = account ? ctx.currencyOf(account) : null;
      return !!currency && filter.currencies.includes(currency);
    });
    if (!ok) return false;
  }
  if (filter.categories.length && !(entry.categoryId && filter.categories.includes(entry.categoryId))) return false;
  if (filter.people.length && !filter.people.includes(entry.person?.trim() ?? '')) return false;
  if (filter.sinTypes.length && !(entry.sinTypeId && filter.sinTypes.includes(entry.sinTypeId))) return false;
  const task = entry.taskId ? ctx.tasks.get(entry.taskId) : undefined;
  if (filter.tasks.length && !(entry.taskId && filter.tasks.includes(entry.taskId))) return false;
  if (filter.taskKinds.length && !(task && filter.taskKinds.includes(task.kind))) return false;
  if (filter.programs.length && !(task?.programId && filter.programs.includes(task.programId))) return false;
  if (filter.prayers.length && !(task?.prayer && filter.prayers.includes(task.prayer))) return false;
  const search = filter.search.trim().toLowerCase();
  if (search) {
    const text = [entry.note, entry.person, ctx.describe(entry)].filter(Boolean).join(' ').toLowerCase();
    if (!text.includes(search)) return false;
  }
  return true;
}

export function filterEntries(entries: Entry[], range: Range, filter: StatsFilter, ctx: FilterContext): Entry[] {
  return entries.filter((entry) => entry.date >= range.start && entry.date <= range.end && matchEntry(entry, filter, ctx));
}

/** Tasks the deeds section counts: the task, task-kind and program filters (empty = all). */
export function filterTasks(tasks: Task[], filter: StatsFilter): Task[] {
  return tasks.filter(
    (task) =>
      (!filter.tasks.length || filter.tasks.includes(task.id)) &&
      (!filter.taskKinds.length || filter.taskKinds.includes(task.kind)) &&
      (!filter.programs.length || (!!task.programId && filter.programs.includes(task.programId))),
  );
}

// ---- Time buckets ----------------------------------------------------------------

export type Granularity = 'day' | 'week' | 'month' | 'year';
export type Bucket = { key: string; start: string; end: string; granularity: Granularity };

/** At most ~31 bars: days up to a month, weeks up to ~7 months, months up to 3 years, then years. */
export function autoGranularity(range: Range): Granularity {
  const days = daysBetween(range.start, range.end).length;
  if (days <= 31) return 'day';
  if (days <= 210) return 'week';
  if (days <= 1100) return 'month';
  return 'year';
}

export function buckets(range: Range, granularity: Granularity = autoGranularity(range)): Bucket[] {
  const result: Bucket[] = [];
  let day = range.start;
  while (day <= range.end) {
    const span = granularity === 'day' ? { start: day, end: day } : periodRange(day, granularity);
    const start = span.start < range.start ? range.start : span.start;
    const end = span.end > range.end ? range.end : span.end;
    result.push({ key: start, start, end, granularity });
    day = addDays(span.end, 1);
  }
  return result;
}

export function bucketOf(list: Bucket[], day: string): Bucket | undefined {
  return list.find((bucket) => day >= bucket.start && day <= bucket.end);
}

export { weekday };
