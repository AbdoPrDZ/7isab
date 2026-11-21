/**
 * Figures of one investment, from its entries (all in the investment's
 * currency). Expected profit is the user's own estimate per period, spread
 * evenly over the days the investment was active; "real" is profit minus
 * losses. Nothing here is a promise of return.
 */
import { addDays, daysBetween, periodRange, today } from '@/lib/dates';
import { round } from '@/lib/ledger/ledger';
import type { Entry } from '@/lib/ledger/types';

import { classify, PERIOD_DAYS, type Investment, type ProfitPeriod, type RecordType } from './investments';

export type InvestmentRecord = { entry: Entry; type: RecordType; amount: number };

export type Bucket = { key: string; start: string; end: string; expected: number; real: number };

export type InvestmentStats = {
  records: InvestmentRecord[];
  capitalIn: number;
  capitalOut: number;
  /** Capital still in (added − withdrawn − losses). */
  capitalNow: number;
  profit: number;
  loss: number;
  /** Profit − losses. */
  net: number;
  /** Profit kept in the capital account (reinvested). */
  reinvested: number;
  /** Days active so far (start → today or the close date). */
  days: number;
  /** Expected profit so far (estimate × time active); null without an estimate. */
  expectedToDate: number | null;
  /** Real ÷ expected so far (1 = as expected). */
  achieved: number | null;
  /** Net profit ÷ capital added. */
  roi: number | null;
  /** Time-weighted average capital in. */
  avgCapital: number;
  /** Net profit per year on the average capital. */
  annualized: number | null;
  /** Net profit ÷ capital added: how much of the capital came back as profit. */
  payback: number | null;
  /** Average real profit per expected period. */
  perPeriod: number | null;
  lastProfit: string | null;
  /** Active and no profit recorded for over 1.5 periods. */
  overdue: boolean;
  buckets: Bucket[];
  /** Buckets with a positive result, out of the buckets shown. */
  goodBuckets: number;
};

/** Chart granularity: daily estimates are shown per week. */
export function chartPeriod(period: ProfitPeriod): 'week' | 'month' | 'year' {
  return period === 'day' ? 'week' : period;
}

const MAX_BUCKETS = 12;

export function investmentStats(investment: Investment, entries: Entry[], now: string = today()): InvestmentStats {
  const records = entries
    .map((entry) => {
      const kind = classify(entry, investment.accountId);
      return kind ? { entry, ...kind } : null;
    })
    .filter((record): record is InvestmentRecord => record !== null)
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.entry.createdAt - a.entry.createdAt);

  let capitalIn = 0;
  let capitalOut = 0;
  let profit = 0;
  let loss = 0;
  let reinvested = 0;
  let lastProfit: string | null = null;
  for (const record of records) {
    if (record.type === 'capital') capitalIn += record.amount;
    else if (record.type === 'withdraw') capitalOut += record.amount;
    else if (record.type === 'loss') loss += record.amount;
    else {
      profit += record.amount;
      if (record.entry.lines.some((line) => line.account === investment.accountId)) reinvested += record.amount;
      if (!lastProfit || record.entry.date > lastProfit) lastProfit = record.entry.date;
    }
  }

  const end = investment.closedAt && investment.closedAt < now ? investment.closedAt : now;
  const days = investment.startDate <= end ? daysBetween(investment.startDate, end).length : 0;
  const net = profit - loss;
  const dailyExpected = investment.expected ? investment.expected.amount / PERIOD_DAYS[investment.expected.period] : null;
  const expectedToDate = dailyExpected === null ? null : dailyExpected * days;

  // Time-weighted capital: the capital account balance on each day (reinvested profit works as capital too).
  const changes = new Map<string, number>();
  for (const record of records) {
    const kept = record.type === 'profit' && record.entry.lines.some((line) => line.account === investment.accountId);
    const sign = record.type === 'capital' || kept ? 1 : record.type === 'withdraw' || record.type === 'loss' ? -1 : 0;
    if (sign) changes.set(record.entry.date, (changes.get(record.entry.date) ?? 0) + sign * record.amount);
  }
  let balance = 0;
  let weighted = 0;
  for (const [date, change] of changes) if (date < investment.startDate) balance += change;
  if (days) {
    for (const day of daysBetween(investment.startDate, end)) {
      balance += changes.get(day) ?? 0;
      weighted += Math.max(0, balance);
    }
  }
  const avgCapital = days ? weighted / days : 0;

  // Buckets: the last MAX_BUCKETS periods of the chart granularity, from the start.
  const buckets: Bucket[] = [];
  if (days) {
    const unit = chartPeriod(investment.expected?.period ?? 'month');
    let range = periodRange(end, unit);
    while (buckets.length < MAX_BUCKETS && range.end >= investment.startDate) {
      buckets.unshift({ key: range.start, start: range.start, end: range.end, expected: 0, real: 0 });
      range = periodRange(addDays(range.start, -1), unit);
    }
    for (const bucket of buckets) {
      const from = bucket.start > investment.startDate ? bucket.start : investment.startDate;
      const to = bucket.end < end ? bucket.end : end;
      const active = from <= to ? daysBetween(from, to).length : 0;
      bucket.expected = dailyExpected === null ? 0 : round(dailyExpected * active);
    }
    for (const record of records) {
      if (record.type !== 'profit' && record.type !== 'loss') continue;
      const bucket = buckets.find((item) => record.entry.date >= item.start && record.entry.date <= item.end);
      if (bucket) bucket.real += record.type === 'profit' ? record.amount : -record.amount;
    }
    for (const bucket of buckets) bucket.real = round(bucket.real);
  }

  const periodDays = PERIOD_DAYS[investment.expected?.period ?? 'month'];
  const periods = days / periodDays;
  const since = lastProfit ?? investment.startDate;
  const quietDays = since <= end ? daysBetween(since, end).length - 1 : 0;

  return {
    records,
    capitalIn: round(capitalIn),
    capitalOut: round(capitalOut),
    capitalNow: round(capitalIn - capitalOut - loss + reinvested),
    profit: round(profit),
    loss: round(loss),
    net: round(net),
    reinvested: round(reinvested),
    days,
    expectedToDate: expectedToDate === null ? null : round(expectedToDate),
    achieved: expectedToDate ? net / expectedToDate : null,
    roi: capitalIn > 0 ? net / capitalIn : null,
    avgCapital: round(avgCapital),
    annualized: avgCapital > 0 && days >= 30 ? net / avgCapital / (days / 365.25) : null,
    payback: capitalIn > 0 ? Math.max(0, net) / capitalIn : null,
    perPeriod: periods >= 1 ? round(net / periods) : null,
    lastProfit,
    overdue: !investment.closedAt && quietDays > periodDays * 1.5,
    buckets,
    goodBuckets: buckets.filter((bucket) => bucket.real > 0).length,
  };
}
