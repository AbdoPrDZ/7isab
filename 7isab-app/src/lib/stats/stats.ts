/**
 * Statistics for a month ("YYYY-MM") or a year ("YYYY"): Dunya (income,
 * spending, categories, cash flow, net worth) and Akhira (points, tasks, sins,
 * sadaqa, Quran, athkar). Pure functions over decrypted docs; amounts are in
 * the main currency.
 */
import { addMonths, today, WEEK_START, weekday } from '@/lib/dates';
import { fixedAccountId, round } from '@/lib/ledger/ledger';
import type { Account, Entry, ExchangeRate } from '@/lib/ledger/types';
import { balanceInMain, conversionCurrency } from '@/lib/wallet/wallet';

export type StatsPeriod = 'month' | 'year';

/** Key of the period that holds `day`: "YYYY-MM" or "YYYY". */
export function periodKey(day: string, period: StatsPeriod): string {
  return period === 'month' ? day.slice(0, 7) : day.slice(0, 4);
}

export function shiftKey(key: string, period: StatsPeriod, amount: number): string {
  return period === 'month' ? addMonths(key, amount) : String(Number(key) + amount);
}

export function inPeriod(day: string, key: string): boolean {
  return day.startsWith(key);
}

/** Days of the period counted for averages: up to today for the current period. */
export function periodDays(key: string, period: StatsPeriod): number {
  const now = today();
  const [year, month] = key.split('-').map(Number);
  const total =
    period === 'month' ? new Date(year, month, 0).getDate() : new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
  if (!inPeriod(now, key)) return total;
  if (period === 'month') return Number(now.slice(8, 10));
  const start = new Date(year, 0, 1).getTime();
  const [y, m, d] = now.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - start) / 86_400_000) + 1;
}

/** Months shown in charts: the 6 months up to the selected one, or the 12 of the selected year. */
export function chartMonths(key: string, period: StatsPeriod): string[] {
  if (period === 'year')
    return Array.from({ length: 12 }, (_, index) => `${key}-${String(index + 1).padStart(2, '0')}`);
  return Array.from({ length: 6 }, (_, index) => addMonths(key, index - 5));
}

/** Change from `before` to `now` as a fraction (null when there is nothing to compare with). */
export function change(now: number, before: number): number | null {
  if (!before) return null;
  return (now - before) / Math.abs(before);
}

// ---------------------------------------------------------------- Dunya

type MoneyLine = { entry: Entry; account: Account; value: number };

/**
 * Income and expense entries of a period, converted to the main currency
 * (income > 0, expense < 0), optionally only those of one account.
 */
function moneyLines(
  entries: Entry[],
  accounts: Account[],
  key: string,
  main: string,
  rates: ExchangeRate[],
  accountId?: string,
): MoneyLine[] {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const lines: MoneyLine[] = [];
  for (const entry of entries) {
    if ((entry.kind !== 'income' && entry.kind !== 'expense') || !inPeriod(entry.date, key)) continue;
    const line = entry.lines[0];
    const account = line ? byId.get(line.account) : undefined;
    if (!line || !account || (accountId && account.id !== accountId)) continue;
    const value = balanceInMain(account, line.amount, main, rates);
    if (value !== null) lines.push({ entry, account, value });
  }
  return lines;
}

export type DunyaStats = {
  income: number;
  expense: number;
  net: number;
  /** Share of income kept (null without income). */
  savingsRate: number | null;
  dailyExpense: number;
  biggest: { entry: Entry; value: number } | null;
  /** Category id ('' = none) → spent, largest first. */
  byCategory: [string, number][];
  /** Income category id ('' = none) → received, largest first. */
  incomeByCategory: [string, number][];
  /** Account id → spent, largest first. */
  byAccount: [string, number][];
  /** Currency code (or XAU_G for gold) → spent in the main currency, largest first. */
  byCurrency: [string, number][];
  /** Spent per weekday in week order (Saturday first): [weekday 0–6, amount]. */
  byWeekday: [number, number][];
  count: number;
};

function sorted<K>(map: Map<K, number>): [K, number][] {
  return [...map.entries()].map(([key, value]) => [key, round(value)] as [K, number]).sort((a, b) => b[1] - a[1]);
}

function add<K>(map: Map<K, number>, key: K, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

export function dunyaStats(
  entries: Entry[],
  accounts: Account[],
  key: string,
  period: StatsPeriod,
  main: string,
  rates: ExchangeRate[],
  accountId?: string,
): DunyaStats {
  let income = 0;
  let expense = 0;
  let biggest: DunyaStats['biggest'] = null;
  const categories = new Map<string, number>();
  const incomeCategories = new Map<string, number>();
  const byAccount = new Map<string, number>();
  const byCurrency = new Map<string, number>();
  const byWeekday = new Map<number, number>();

  const lines = moneyLines(entries, accounts, key, main, rates, accountId);
  for (const { entry, account, value } of lines) {
    if (value > 0) {
      income += value;
      add(incomeCategories, entry.categoryId ?? '', value);
      continue;
    }
    const spent = -value;
    expense += spent;
    add(categories, entry.categoryId ?? '', spent);
    add(byAccount, account.id, spent);
    add(byCurrency, conversionCurrency(account, main) ?? main, spent);
    add(byWeekday, weekday(entry.date), spent);
    if (!biggest || spent > biggest.value) biggest = { entry, value: round(spent) };
  }

  const net = income - expense;
  return {
    income: round(income),
    expense: round(expense),
    net: round(net),
    savingsRate: income > 0 ? net / income : null,
    dailyExpense: round(expense / Math.max(1, periodDays(key, period))),
    biggest,
    byCategory: sorted(categories),
    incomeByCategory: sorted(incomeCategories),
    byAccount: sorted(byAccount),
    byCurrency: sorted(byCurrency),
    byWeekday: Array.from({ length: 7 }, (_, index) => {
      const day = (WEEK_START + index) % 7;
      return [day, round(byWeekday.get(day) ?? 0)] as [number, number];
    }),
    count: lines.length,
  };
}

/** Income and expenses per month, in the main currency. */
export function monthlyFlow(
  entries: Entry[],
  accounts: Account[],
  months: string[],
  main: string,
  rates: ExchangeRate[],
  accountId?: string,
) {
  return months.map((month) => {
    let inflow = 0;
    let outflow = 0;
    for (const { value } of moneyLines(entries, accounts, month, main, rates, accountId)) {
      if (value > 0) inflow += value;
      else outflow -= value;
    }
    return { month, inflow: round(inflow), outflow: round(outflow) };
  });
}

/** Each counted account's balance in the main currency, largest first (hidden, archived and reserved left out). */
export function worthByAccount(
  accounts: Account[],
  balances: Map<string, number>,
  main: string,
  rates: ExchangeRate[],
) {
  const rows: { account: Account; value: number }[] = [];
  for (const account of accounts) {
    if (account.hidden || account.archived) continue;
    if (account.fixed === 'sadaqa' || account.fixed === 'zakat') continue;
    const value = balanceInMain(account, balances.get(account.id) ?? 0, main, rates);
    if (value !== null && value !== 0) rows.push({ account, value: round(value) });
  }
  return rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/** Net worth grouped by account type (role) or by currency, in the main currency, largest first. */
export function groupWorth(rows: { account: Account; value: number }[], by: 'role' | 'currency', main: string) {
  const groups = new Map<string, number>();
  for (const { account, value } of rows) {
    add(groups, by === 'role' ? account.role : (conversionCurrency(account, main) ?? main), value);
  }
  return [...groups.entries()]
    .map(([group, value]) => [group, round(value)] as [string, number])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}

export type AccountStats = {
  /** Balance before the period starts and at its end (or today), in the account's own unit. */
  opening: number;
  closing: number;
  /** Everything that came in / went out in the period, in the account's unit. */
  in: number;
  out: number;
  /** In / out by entry kind (income, expense, transfer, loan, top_up, …), largest first. */
  inByKind: [string, number][];
  outByKind: [string, number][];
  /** Balance at the end of each chart month. */
  trend: { month: string; balance: number }[];
};

/** One account over a period, in its own unit (DZD, EUR, grams…). */
export function accountStats(entries: Entry[], accountId: string, key: string, months: string[]): AccountStats {
  let opening = 0;
  let closing = 0;
  let incoming = 0;
  let outgoing = 0;
  const inByKind = new Map<string, number>();
  const outByKind = new Map<string, number>();
  const monthly = new Map<string, number>();

  const start = key.length === 4 ? `${key}-01-01` : `${key}-01`;
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.account !== accountId) continue;
      if (entry.date < start) opening += line.amount;
      if (entry.date < start || inPeriod(entry.date, key)) closing += line.amount;
      add(monthly, entry.date.slice(0, 7), line.amount);
      if (!inPeriod(entry.date, key)) continue;
      if (line.amount > 0) {
        incoming += line.amount;
        add(inByKind, entry.kind, line.amount);
      } else {
        outgoing -= line.amount;
        add(outByKind, entry.kind, -line.amount);
      }
    }
  }

  const trend = months.map((month) => {
    let balance = 0;
    for (const [m, value] of monthly) if (m <= month) balance += value;
    return { month, balance: round(balance) };
  });

  return {
    opening: round(opening),
    closing: round(closing),
    in: round(incoming),
    out: round(outgoing),
    inByKind: sorted(inByKind),
    outByKind: sorted(outByKind),
    trend,
  };
}

// ---------------------------------------------------------------- Akhira

export type AkhiraStats = {
  earned: number;
  lost: number;
  net: number;
  thanbAdded: number;
  thanbPaid: number;
  sadaqa: number;
  zakat: number;
  /** Task id → days (or periods) fully done / counted. */
  tasks: Map<string, { done: number; total: number }>;
  tasksDone: number;
  tasksTotal: number;
  /** Sin type id → times logged. */
  sins: [string, number][];
  sinCount: number;
  fastTaps: number;
};

export function akhiraStats(entries: Entry[], key: string): AkhiraStats {
  const akhira = fixedAccountId('akhira');
  const thanb = fixedAccountId('thanb');
  const sadaqaId = fixedAccountId('sadaqa');
  const zakatId = fixedAccountId('zakat');
  const stats: AkhiraStats = {
    earned: 0,
    lost: 0,
    net: 0,
    thanbAdded: 0,
    thanbPaid: 0,
    sadaqa: 0,
    zakat: 0,
    tasks: new Map(),
    tasksDone: 0,
    tasksTotal: 0,
    sins: [],
    sinCount: 0,
    fastTaps: 0,
  };
  const sins = new Map<string, number>();

  for (const entry of entries) {
    if (!inPeriod(entry.date, key)) continue;
    for (const line of entry.lines) {
      if (line.account === akhira) {
        if (line.amount > 0) stats.earned += line.amount;
        else stats.lost -= line.amount;
      } else if (line.account === thanb) {
        if (line.amount > 0) stats.thanbAdded += line.amount;
        else stats.thanbPaid -= line.amount;
      } else if (
        line.account === sadaqaId &&
        line.amount < 0 &&
        (entry.kind === 'sadaqa' || entry.kind === 'thanb_paid')
      ) {
        stats.sadaqa -= line.amount;
      } else if (line.account === zakatId && line.amount < 0 && entry.kind === 'zakat') {
        stats.zakat -= line.amount;
      }
    }

    const taskKind =
      entry.kind === 'task_done' ||
      entry.kind === 'task_missed' ||
      entry.kind === 'prayer_missed' ||
      entry.kind === 'prayer_late';
    if (taskKind && entry.taskId) {
      const row = stats.tasks.get(entry.taskId) ?? { done: 0, total: 0 };
      row.total += 1;
      if (entry.kind === 'task_done') row.done += 1;
      stats.tasks.set(entry.taskId, row);
      stats.tasksTotal += 1;
      if (entry.kind === 'task_done') stats.tasksDone += 1;
    }
    // Missed / late prayers are Thanb types too.
    if (entry.kind === 'sin' || entry.kind === 'prayer_missed' || entry.kind === 'prayer_late') {
      const id = entry.sinTypeId ?? '';
      sins.set(id, (sins.get(id) ?? 0) + 1);
      stats.sinCount += 1;
    }
    if (entry.kind === 'fast_tap') stats.fastTaps += 1;
  }

  stats.earned = round(stats.earned);
  stats.lost = round(stats.lost);
  stats.net = round(stats.earned - stats.lost);
  stats.thanbAdded = round(stats.thanbAdded);
  stats.thanbPaid = round(stats.thanbPaid);
  stats.sadaqa = round(stats.sadaqa);
  stats.zakat = round(stats.zakat);
  stats.sins = [...sins.entries()].sort((a, b) => b[1] - a[1]);
  return stats;
}

/** Akhira points earned and lost per month. */
export function monthlyAkhira(entries: Entry[], months: string[]) {
  const akhira = fixedAccountId('akhira');
  return months.map((month) => {
    let earned = 0;
    let lost = 0;
    for (const entry of entries) {
      if (!inPeriod(entry.date, month)) continue;
      for (const line of entry.lines) {
        if (line.account !== akhira) continue;
        if (line.amount > 0) earned += line.amount;
        else lost -= line.amount;
      }
    }
    return { month, inflow: round(earned), outflow: round(lost) };
  });
}

/** Quran reading in a period, from the per-day reading records. */
export function readingStats(days: { date: string; words: number; pages: number }[], key: string, period: StatsPeriod) {
  let words = 0;
  let pages = 0;
  let active = 0;
  let best: { date: string; words: number } | null = null;
  for (const day of days) {
    if (!inPeriod(day.date, key) || day.words <= 0) continue;
    words += day.words;
    pages += day.pages;
    active += 1;
    if (!best || day.words > best.words) best = { date: day.date, words: day.words };
  }
  return {
    words,
    pages,
    active,
    best,
    days: periodDays(key, period),
    dailyWords: Math.round(words / Math.max(1, periodDays(key, period))),
  };
}

/** Days in a period with athkar read, per list. */
export function athkarStats(days: { listId: string; date: string; counts: Record<string, number> }[], key: string) {
  const perList = new Map<string, Set<string>>();
  const anyDay = new Set<string>();
  for (const day of days) {
    if (!inPeriod(day.date, key)) continue;
    if (!Object.values(day.counts).some((count) => count > 0)) continue;
    const set = perList.get(day.listId) ?? new Set<string>();
    set.add(day.date);
    perList.set(day.listId, set);
    anyDay.add(day.date);
  }
  return {
    days: anyDay.size,
    perList: [...perList.entries()]
      .map(([listId, set]) => [listId, set.size] as [string, number])
      .sort((a, b) => b[1] - a[1]),
  };
}
