/**
 * Investments, halal only. Each investment owns a capital account (role
 * `investment`) and every movement is a normal ledger entry tagged with
 * `investmentId`, so net worth, statistics and zakat see it:
 * - capital added: transfer from a wallet account (or `adjustment` when the
 *   money didn't come from a tracked account) into the capital account;
 * - capital withdrawn: transfer from the capital account to a wallet account;
 * - profit: income into a wallet account, or into the capital account (reinvested);
 * - loss: expense on the capital account (the capital shrinks).
 *
 * Only structures without riba or gambling exist: own trade / production,
 * mudaraba (money + someone else's work, profit by an agreed share of the
 * profit, loss on the capital), musharaka (partnership, loss by capital
 * share) and ijara (an asset rented out). There is no "interest rate" or
 * "guaranteed return" field: expected profit is an estimate only.
 */
import { useMemo } from 'react';

import { getDoc, newId, putDoc, removeDoc, useDocs, type Doc } from '@/lib/data/vault';
import { useEntries } from '@/lib/ledger/hooks';
import { addEntry, deleteEntry, getSettings } from '@/lib/ledger/ledger';
import { RecordTypes, type Account, type Entry } from '@/lib/ledger/types';

export type InvestmentKind = 'trade' | 'mudaraba' | 'musharaka' | 'ijara';
export const INVESTMENT_KINDS: InvestmentKind[] = ['trade', 'mudaraba', 'musharaka', 'ijara'];

export type ProfitPeriod = 'day' | 'week' | 'month' | 'year';
export const PROFIT_PERIODS: ProfitPeriod[] = ['day', 'week', 'month', 'year'];

/** Average days per period, for estimates. */
export const PERIOD_DAYS: Record<ProfitPeriod, number> = { day: 1, week: 7, month: 30.4375, year: 365.25 };

/** Kinds where your profit is an agreed share of the real profit. */
export function sharesProfit(kind: InvestmentKind): boolean {
  return kind === 'mudaraba' || kind === 'musharaka';
}

/** The halal checks confirmed before an investment is saved. */
export const HALAL_CHECKS = ['activity', 'noGuarantee', 'lossShared', 'noGharar', 'noDoubt'] as const;
export type HalalCheck = (typeof HALAL_CHECKS)[number];

export type Investment = Doc & {
  name: string;
  kind: InvestmentKind;
  /** Who works the money / the partner / the tenant (mudaraba, musharaka, ijara). */
  partner?: string;
  /** Its capital account (role `investment`). */
  accountId: string;
  startDate: string;
  /** Your expected profit per period: an estimate to compare with, never a promise. */
  expected: { amount: number; period: ProfitPeriod } | null;
  /** Your agreed share of the profit, in % (mudaraba, musharaka). */
  profitShare?: number;
  /** Your share of the capital, in % (musharaka): losses follow it. */
  capitalShare?: number;
  note?: string;
  closedAt?: string;
  /** When the halal checks were confirmed (ms). */
  confirmedAt: number;
};

export type RecordType = 'capital' | 'profit' | 'loss' | 'withdraw';
export const RECORD_TYPES: RecordType[] = ['capital', 'profit', 'loss', 'withdraw'];

// ---- Reading -------------------------------------------------------------------------

export function useInvestments(): Investment[] {
  const all = useDocs<Investment>(RecordTypes.investment);
  return useMemo(() => [...all].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt - a.createdAt), [all]);
}

export function useInvestment(id: string | undefined): Investment | undefined {
  const all = useDocs<Investment>(RecordTypes.investment);
  return id ? all.find((investment) => investment.id === id) : undefined;
}

/** Entries of every investment, by investment id. */
export function useInvestmentEntries(): Map<string, Entry[]> {
  const entries = useEntries();
  return useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of entries) {
      if (!entry.investmentId) continue;
      const list = map.get(entry.investmentId) ?? [];
      list.push(entry);
      map.set(entry.investmentId, list);
    }
    return map;
  }, [entries]);
}

/** What an entry is to its investment, and its amount (positive) in the investment's currency. */
export function classify(entry: Entry, accountId: string): { type: RecordType; amount: number } | null {
  const own = entry.lines.find((line) => line.account === accountId);
  if (entry.kind === 'income') {
    return { type: 'profit', amount: Math.abs(entry.lines.reduce((sum, line) => sum + line.amount, 0)) };
  }
  if (entry.kind === 'expense') return { type: 'loss', amount: Math.abs(own?.amount ?? 0) };
  if (!own) return null;
  return own.amount >= 0 ? { type: 'capital', amount: own.amount } : { type: 'withdraw', amount: -own.amount };
}

// ---- Writing -------------------------------------------------------------------------

export type InvestmentInput = Omit<Investment, 'id' | 'createdAt' | 'updatedAt' | 'accountId' | 'confirmedAt'> & {
  id?: string;
  /** Currency of the capital (missing = main currency). */
  currency?: string;
  /** Counted in zakat (an asset rented out is not: zakat is due on the rent kept). */
  zakat: boolean;
};

/** Creates or updates an investment and its capital account. */
export async function saveInvestment(input: InvestmentInput): Promise<Investment> {
  const existing = input.id ? getDoc<Investment>(RecordTypes.investment, input.id) : undefined;
  const accountId = existing?.accountId ?? newId();
  const account = getDoc<Account>(RecordTypes.account, accountId);
  await putDoc<Account>(RecordTypes.account, {
    ...account,
    id: accountId,
    name: input.name,
    role: 'investment',
    // The currency can't change once money is recorded in it.
    unit: account?.unit ?? { kind: 'money', currency: input.currency && input.currency !== getSettings().mainCurrency ? input.currency : undefined },
    zakatExempt: !input.zakat,
    archived: !!input.closedAt,
    order: account?.order ?? 500,
  });
  const { currency: _currency, zakat: _zakat, id: _id, ...fields } = input;
  return putDoc<Investment>(RecordTypes.investment, {
    ...existing,
    ...fields,
    id: existing?.id ?? newId(),
    accountId,
    confirmedAt: existing?.confirmedAt ?? Date.now(),
  });
}

export async function setInvestmentClosed(investment: Investment, closedAt: string | null): Promise<void> {
  await putDoc<Investment>(RecordTypes.investment, { ...investment, closedAt: closedAt ?? undefined });
  const account = getDoc<Account>(RecordTypes.account, investment.accountId);
  if (account) await putDoc<Account>(RecordTypes.account, { ...account, archived: !!closedAt });
}

/** Deletes an investment with no records (otherwise close it). */
export async function deleteInvestment(investment: Investment, records: Entry[]): Promise<boolean> {
  if (records.length) return false;
  await removeDoc(RecordTypes.investment, investment.id);
  await removeDoc(RecordTypes.account, investment.accountId);
  return true;
}

/**
 * Records a movement. `accountId` is the wallet account the money comes from /
 * goes to; null = outside the tracked accounts (capital) or reinvested (profit).
 */
export async function addRecord(
  investment: Investment,
  type: RecordType,
  amount: number,
  options: { accountId: string | null; date: string; note?: string },
): Promise<Entry> {
  const capital = investment.accountId;
  const base = { investmentId: investment.id, date: options.date, note: options.note || undefined };
  switch (type) {
    case 'capital':
      return options.accountId
        ? addEntry({
            ...base,
            kind: 'transfer',
            lines: [
              { account: options.accountId, amount: -amount },
              { account: capital, amount },
            ],
          })
        : addEntry({ ...base, kind: 'adjustment', lines: [{ account: capital, amount }] });
    case 'withdraw':
      return options.accountId
        ? addEntry({
            ...base,
            kind: 'transfer',
            lines: [
              { account: capital, amount: -amount },
              { account: options.accountId, amount },
            ],
          })
        : addEntry({ ...base, kind: 'adjustment', lines: [{ account: capital, amount: -amount }] });
    case 'profit':
      return addEntry({ ...base, kind: 'income', lines: [{ account: options.accountId ?? capital, amount }] });
    case 'loss':
      return addEntry({ ...base, kind: 'expense', lines: [{ account: capital, amount: -amount }] });
  }
}

export async function deleteRecord(entry: Entry): Promise<void> {
  await deleteEntry(entry.id);
}
