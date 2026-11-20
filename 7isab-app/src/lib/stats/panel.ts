/**
 * Figures of the statistics panel, from the filtered entries: money in the
 * main currency (income, expenses, savings), Akhira points, Thanb, sadaqa,
 * zakat and sins; breakdowns by any grouping; time series for the charts; net
 * worth at the end of each bucket; and saved filters.
 */
import { useMemo } from 'react';

import { deterministicId, newId, putDoc, removeDoc, useDocs, type Doc } from '@/lib/data/vault';
import { fixedAccountId, round } from '@/lib/ledger/ledger';
import { RecordTypes, type Account, type Entry, type ExchangeRate } from '@/lib/ledger/types';
import { balanceInMain } from '@/lib/wallet/wallet';

import { bucketOf, weekday, type Bucket, type FilterContext, type GroupBy, type StatsFilter } from './filter';

export type Money = { main: string; rates: ExchangeRate[] };

/** A line's value in the main currency (null for points accounts). */
function lineMoney(account: Account | undefined, amount: number, money: Money): number | null {
  if (!account || account.unit.kind === 'akhira' || account.unit.kind === 'thanb') return null;
  return balanceInMain(account, amount, money.main, money.rates);
}

export type Totals = {
  income: number;
  expense: number;
  net: number;
  savingsRate: number | null;
  earned: number;
  lost: number;
  thanbAdded: number;
  thanbPaid: number;
  sadaqa: number;
  zakat: number;
  sins: number;
  fastTaps: number;
  lent: number;
  borrowed: number;
  count: number;
  biggestExpense: { entry: Entry; value: number } | null;
};

export function totals(entries: Entry[], ctx: FilterContext, money: Money): Totals {
  const akhira = fixedAccountId('akhira');
  const thanb = fixedAccountId('thanb');
  const sadaqaId = fixedAccountId('sadaqa');
  const zakatId = fixedAccountId('zakat');
  const result: Totals = {
    income: 0,
    expense: 0,
    net: 0,
    savingsRate: null,
    earned: 0,
    lost: 0,
    thanbAdded: 0,
    thanbPaid: 0,
    sadaqa: 0,
    zakat: 0,
    sins: 0,
    fastTaps: 0,
    lent: 0,
    borrowed: 0,
    count: entries.length,
    biggestExpense: null,
  };
  for (const entry of entries) {
    if (entry.kind === 'sin') result.sins += 1;
    if (entry.kind === 'fast_tap') result.fastTaps += 1;
    for (const line of entry.lines) {
      const account = ctx.accounts.get(line.account);
      if (line.account === akhira) {
        if (line.amount > 0) result.earned += line.amount;
        else result.lost -= line.amount;
        continue;
      }
      if (line.account === thanb) {
        if (line.amount > 0) result.thanbAdded += line.amount;
        else result.thanbPaid -= line.amount;
        continue;
      }
      const value = lineMoney(account, line.amount, money);
      if (value === null) continue;
      if (entry.kind === 'income') result.income += value;
      else if (entry.kind === 'expense') {
        result.expense -= value;
        if (!result.biggestExpense || -value > result.biggestExpense.value) result.biggestExpense = { entry, value: -value };
      } else if (line.account === sadaqaId && line.amount < 0 && (entry.kind === 'sadaqa' || entry.kind === 'thanb_paid')) {
        result.sadaqa -= value;
      } else if (line.account === zakatId && line.amount < 0 && entry.kind === 'zakat') result.zakat -= value;
      else if (entry.kind === 'loan' && account?.role === 'lent' && line.amount > 0) result.lent += value;
      else if (entry.kind === 'loan' && account?.role === 'borrowed' && line.amount < 0) result.borrowed -= value;
    }
  }
  const r = (key: keyof Totals) => ((result[key] as number) = round(result[key] as number));
  (['income', 'expense', 'earned', 'lost', 'thanbAdded', 'thanbPaid', 'sadaqa', 'zakat', 'lent', 'borrowed'] as const).forEach(r);
  result.net = round(result.income - result.expense);
  result.savingsRate = result.income > 0 ? result.net / result.income : null;
  return result;
}

/** What a breakdown or a chart measures. */
export type Measure = 'money' | 'points';

/** In / out of one entry for a measure: money (income +, expense −) or Akhira points (+ / −). */
function flows(entry: Entry, ctx: FilterContext, money: Money, measure: Measure): { inflow: number; outflow: number } {
  let inflow = 0;
  let outflow = 0;
  if (measure === 'points') {
    const akhira = fixedAccountId('akhira');
    for (const line of entry.lines) {
      if (line.account !== akhira) continue;
      if (line.amount > 0) inflow += line.amount;
      else outflow -= line.amount;
    }
    return { inflow, outflow };
  }
  if (entry.kind !== 'income' && entry.kind !== 'expense') return { inflow, outflow };
  for (const line of entry.lines) {
    const value = lineMoney(ctx.accounts.get(line.account), line.amount, money);
    if (value === null) continue;
    if (value > 0) inflow += value;
    else outflow -= value;
  }
  return { inflow, outflow };
}

export type SeriesPoint = { month: string; inflow: number; outflow: number };

/** In / out per bucket (the chart's x axis). `month` holds the bucket key. */
export function series(entries: Entry[], list: Bucket[], ctx: FilterContext, money: Money, measure: Measure): SeriesPoint[] {
  const points = list.map((bucket) => ({ month: bucket.key, inflow: 0, outflow: 0 }));
  const index = new Map(list.map((bucket, i) => [bucket.key, i]));
  for (const entry of entries) {
    const bucket = bucketOf(list, entry.date);
    if (!bucket) continue;
    const point = points[index.get(bucket.key)!];
    const { inflow, outflow } = flows(entry, ctx, money, measure);
    point.inflow += inflow;
    point.outflow += outflow;
  }
  return points.map((point) => ({ ...point, inflow: round(point.inflow), outflow: round(point.outflow) }));
}

export type GroupRow = { key: string; inflow: number; outflow: number; count: number };

/** Totals per group (time groups are the buckets). Keys are ids / values; the screen gives them labels. */
export function breakdown(
  entries: Entry[],
  groupBy: GroupBy,
  list: Bucket[],
  ctx: FilterContext,
  money: Money,
  measure: Measure,
): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  const add = (key: string, entry: Entry) => {
    const { inflow, outflow } = flows(entry, ctx, money, measure);
    if (!inflow && !outflow && measure === 'money') return;
    const row = rows.get(key) ?? { key, inflow: 0, outflow: 0, count: 0 };
    row.inflow += inflow;
    row.outflow += outflow;
    row.count += 1;
    rows.set(key, row);
  };
  for (const entry of entries) {
    switch (groupBy) {
      case 'time':
        add(bucketOf(list, entry.date)?.key ?? entry.date, entry);
        break;
      case 'weekday':
        add(String(weekday(entry.date)), entry);
        break;
      case 'category':
        add(entry.categoryId ?? '', entry);
        break;
      case 'person':
        add(entry.person?.trim() ?? '', entry);
        break;
      case 'kind':
        add(entry.kind, entry);
        break;
      case 'task':
        add(entry.taskId ?? '', entry);
        break;
      case 'sinType':
        add(entry.sinTypeId ?? '', entry);
        break;
      case 'account':
      case 'currency': {
        const keys = new Set<string>();
        for (const line of entry.lines) {
          const account = ctx.accounts.get(line.account);
          if (!account || account.fixed === 'akhira' || account.fixed === 'thanb') continue;
          keys.add(groupBy === 'account' ? account.id : (ctx.currencyOf(account) ?? ''));
        }
        for (const key of keys) add(key, entry);
        break;
      }
    }
  }
  const result = [...rows.values()].map((row) => ({ ...row, inflow: round(row.inflow), outflow: round(row.outflow) }));
  if (groupBy === 'time') return result.sort((a, b) => a.key.localeCompare(b.key));
  if (groupBy === 'weekday') return result.sort((a, b) => ((Number(a.key) + 1) % 7) - ((Number(b.key) + 1) % 7));
  return result.sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow));
}

/**
 * Net worth (money and gold accounts, Sadaqa / Zakat left out; the account
 * filter applies) at the end of each bucket, in the main currency.
 */
export function worthSeries(
  allEntries: Entry[],
  accounts: Account[],
  list: Bucket[],
  money: Money,
  only: string[],
): { month: string; balance: number }[] {
  const counted = new Map(
    accounts
      .filter(
        (account) =>
          !account.hidden &&
          (account.unit.kind === 'money' || account.unit.kind === 'gold') &&
          account.fixed !== 'sadaqa' &&
          account.fixed !== 'zakat' &&
          (!only.length || only.includes(account.id)),
      )
      .map((account) => [account.id, account]),
  );
  const sorted = [...allEntries].sort((a, b) => a.date.localeCompare(b.date));
  const balances = new Map<string, number>();
  let index = 0;
  return list.map((bucket) => {
    while (index < sorted.length && sorted[index].date <= bucket.end) {
      for (const line of sorted[index].lines) {
        if (counted.has(line.account)) balances.set(line.account, (balances.get(line.account) ?? 0) + line.amount);
      }
      index += 1;
    }
    let total = 0;
    for (const [id, value] of balances) total += balanceInMain(counted.get(id)!, value, money.main, money.rates) ?? 0;
    return { month: bucket.key, balance: round(total) };
  });
}

/** Thanb balance before a day (what carries over into the range). */
export function thanbBefore(allEntries: Entry[], day: string): number {
  const thanb = fixedAccountId('thanb');
  let total = 0;
  for (const entry of allEntries) {
    if (entry.date >= day) continue;
    for (const line of entry.lines) if (line.account === thanb) total += line.amount;
  }
  return round(total);
}

/** Change from before to now as a fraction (null when there's nothing to compare). */
export function delta(now: number, before: number): number | null {
  if (!before) return null;
  return (now - before) / Math.abs(before);
}

// ---- Saved filters -----------------------------------------------------------------

export type SavedFilter = Doc & { name: string; filter: StatsFilter };

export function useSavedFilters(): SavedFilter[] {
  const saved = useDocs<SavedFilter>(RecordTypes.statsFilter);
  return useMemo(() => [...saved].sort((a, b) => a.name.localeCompare(b.name)), [saved]);
}

export async function saveFilter(name: string, filter: StatsFilter): Promise<void> {
  await putDoc<SavedFilter>(RecordTypes.statsFilter, { id: newId(), name: name.trim(), filter });
}

export async function deleteSavedFilter(id: string): Promise<void> {
  await removeDoc(RecordTypes.statsFilter, id);
}

/** Stable id used to remember the last filter on this phone (encrypted like every record). */
export function lastFilterId(): string {
  return deterministicId('stats-filter:last');
}
