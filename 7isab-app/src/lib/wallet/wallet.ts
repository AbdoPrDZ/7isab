/** Wallet (Dunya): categories, budgets, goals, totals and zakat calculation. */
import { useMemo } from 'react';

import { addDays, monthOf } from '@/lib/dates';
import { deterministicId, getDoc, getVaultMeta, newId, putDoc, putDocs, removeDoc, setVaultMeta, useDocs } from '@/lib/data/vault';
import { round, toMain } from '@/lib/ledger/ledger';
import { GOLD_CURRENCY, RecordTypes, type Account, type Entry, type ExchangeRate } from '@/lib/ledger/types';

import type { Budget, Category, Goal, ZakatState } from './types';

export const DEFAULT_CATEGORIES: { preset: string; kind: Category['kind']; color: string }[] = [
  { preset: 'food', kind: 'expense', color: '#C9A227' },
  { preset: 'transport', kind: 'expense', color: '#2F7FA6' },
  { preset: 'housing', kind: 'expense', color: '#0F5C45' },
  { preset: 'bills', kind: 'expense', color: '#8A5A9E' },
  { preset: 'health', kind: 'expense', color: '#B4473A' },
  { preset: 'education', kind: 'expense', color: '#3A7D5C' },
  { preset: 'family', kind: 'expense', color: '#D9822B' },
  { preset: 'clothes', kind: 'expense', color: '#6B7FD1' },
  { preset: 'leisure', kind: 'expense', color: '#2FA67E' },
  { preset: 'other', kind: 'expense', color: '#7A8A82' },
  { preset: 'salary', kind: 'income', color: '#0F5C45' },
  { preset: 'gifts', kind: 'income', color: '#C9A227' },
];

export const CATEGORY_COLORS = ['#0F5C45', '#2FA67E', '#C9A227', '#D9822B', '#B4473A', '#8A5A9E', '#2F7FA6', '#6B7FD1', '#7A8A82'];

/** Gold nisab in grams. */
export const NISAB_GOLD_GRAMS = 85;
/** A lunar year (hawl) in days. */
export const HAWL_DAYS = 354;

export async function ensureCategories(): Promise<void> {
  if (await getVaultMeta('default_categories')) return;
  const missing = DEFAULT_CATEGORIES.filter(({ preset }) => !getDoc(RecordTypes.category, deterministicId(`category:${preset}`)));
  if (missing.length) {
    await putDocs<Category>(
      RecordTypes.category,
      missing.map(({ preset, kind, color }) => ({
        id: deterministicId(`category:${preset}`),
        name: '',
        preset,
        kind,
        color,
        order: DEFAULT_CATEGORIES.findIndex((item) => item.preset === preset),
      })),
    );
  }
  await setVaultMeta('default_categories', '1');
}

export function useCategories(): Category[] {
  const all = useDocs<Category>(RecordTypes.category);
  return useMemo(() => [...all].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt), [all]);
}

export function useBudgets(): Budget[] {
  return useDocs<Budget>(RecordTypes.budget);
}

export function useGoals(): Goal[] {
  return useDocs<Goal>(RecordTypes.goal);
}

export async function saveCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  return putDoc<Category>(RecordTypes.category, { ...category, id: category.id ?? newId() });
}

export async function setBudget(categoryId: string, amount: number | null, budgets: Budget[]): Promise<void> {
  const existing = budgets.find((budget) => budget.categoryId === categoryId);
  if (!amount) {
    if (existing) await removeDoc(RecordTypes.budget, existing.id);
    return;
  }
  await putDoc<Budget>(RecordTypes.budget, { id: existing?.id ?? newId(), categoryId, amount });
}

export async function saveGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  return putDoc<Goal>(RecordTypes.goal, { ...goal, id: goal.id ?? newId() });
}

export async function saveAccount(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  return putDoc<Account>(RecordTypes.account, { ...account, id: account.id ?? newId() });
}

/** Currency of an account for conversions (gold counts as grams with a per-gram rate). */
export function conversionCurrency(account: Account, main: string): string | null {
  if (account.unit.kind === 'money') return account.unit.currency ?? main;
  if (account.unit.kind === 'gold') return GOLD_CURRENCY;
  return null;
}

/** Balance of an account in the main currency (null for points accounts). */
export function balanceInMain(
  account: Account,
  balance: number,
  main: string,
  rates: ExchangeRate[],
): number | null {
  const currency = conversionCurrency(account, main);
  return currency ? toMain(balance, currency, main, rates) : null;
}

/**
 * Net worth in the main currency: every money and gold account that isn't
 * hidden or archived; money borrowed counts against it. Sadaqa and Zakat are
 * shown separately as reserved (owed to the poor).
 */
export function netWorth(accounts: Account[], balances: Map<string, number>, main: string, rates: ExchangeRate[]) {
  let total = 0;
  let reserved = 0;
  for (const account of accounts) {
    if (account.hidden || account.archived) continue;
    const value = balanceInMain(account, balances.get(account.id) ?? 0, main, rates);
    if (value === null) continue;
    if (account.fixed === 'sadaqa' || account.fixed === 'zakat') {
      reserved += value;
      continue;
    }
    total += value;
  }
  return { total: round(total), reserved: round(reserved) };
}

/** Expense totals per category for a month, in the main currency. */
export function spendingByCategory(
  entries: Entry[],
  accounts: Account[],
  month: string,
  main: string,
  rates: ExchangeRate[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== 'expense' || monthOf(entry.date) !== month) continue;
    const line = entry.lines[0];
    const account = accounts.find((item) => item.id === line?.account);
    if (!line || !account) continue;
    const value = balanceInMain(account, -line.amount, main, rates) ?? 0;
    const key = entry.categoryId ?? '';
    totals.set(key, round((totals.get(key) ?? 0) + value));
  }
  return totals;
}

/** Income and expenses per month (main currency), for the cash-flow report. */
export function cashFlow(entries: Entry[], accounts: Account[], months: string[], main: string, rates: ExchangeRate[]) {
  return months.map((month) => {
    let inflow = 0;
    let outflow = 0;
    for (const entry of entries) {
      if ((entry.kind !== 'income' && entry.kind !== 'expense') || monthOf(entry.date) !== month) continue;
      const line = entry.lines[0];
      const account = accounts.find((item) => item.id === line?.account);
      if (!line || !account) continue;
      const value = balanceInMain(account, line.amount, main, rates) ?? 0;
      if (value > 0) inflow += value;
      else outflow -= value;
    }
    return { month, inflow: round(inflow), outflow: round(outflow) };
  });
}

export function zakatStateId(): string {
  return deterministicId('zakat-state');
}

export function useZakatState(): ZakatState | undefined {
  return useDocs<ZakatState>(RecordTypes.zakatState)[0];
}

export async function saveZakatState(changes: Partial<Pick<ZakatState, 'goldPrice' | 'hawlStart'>>, current?: ZakatState) {
  await putDoc<ZakatState>(RecordTypes.zakatState, {
    id: zakatStateId(),
    goldPrice: current?.goldPrice ?? 0,
    hawlStart: current?.hawlStart ?? null,
    ...changes,
  });
}

export function hawlEnd(start: string): string {
  return addDays(start, HAWL_DAYS);
}
