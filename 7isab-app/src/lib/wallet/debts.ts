/**
 * Debts both ways, never netted against each other:
 * - owed to me: the balances of `lent` accounts (positive = people owe me);
 * - I owe: the balances of `borrowed` accounts (negative = I owe), shown positive.
 * Both in the main currency, each broken down by the person written on the
 * loan entries ("" when none was given).
 */
import { useMemo } from 'react';

import { useAccounts, useBalances, useEntries, useExchangeRates, useLedgerLabels } from '@/lib/ledger/hooks';
import { round } from '@/lib/ledger/ledger';
import type { Account, Entry, ExchangeRate } from '@/lib/ledger/types';

import { balanceInMain } from './wallet';

export type PersonDebt = { person: string; amount: number };

export type Debts = {
  owedToMe: number;
  iOwe: number;
  owedToMeByPerson: PersonDebt[];
  iOweByPerson: PersonDebt[];
};

export function computeDebts(
  accounts: Account[],
  balances: Map<string, number>,
  entries: Entry[],
  main: string,
  rates: ExchangeRate[],
): Debts {
  const lent = new Map(accounts.filter((account) => account.role === 'lent' && !account.archived).map((a) => [a.id, a]));
  const borrowed = new Map(
    accounts.filter((account) => account.role === 'borrowed' && !account.archived).map((a) => [a.id, a]),
  );
  const inMain = (account: Account, value: number) => balanceInMain(account, value, main, rates) ?? 0;

  let owedToMe = 0;
  for (const account of lent.values()) owedToMe += inMain(account, balances.get(account.id) ?? 0);
  let iOwe = 0;
  for (const account of borrowed.values()) iOwe -= inMain(account, balances.get(account.id) ?? 0);

  const toMe = new Map<string, number>();
  const byMe = new Map<string, number>();
  for (const entry of entries) {
    const person = entry.person?.trim() ?? '';
    for (const line of entry.lines) {
      const lentAccount = lent.get(line.account);
      if (lentAccount) toMe.set(person, (toMe.get(person) ?? 0) + inMain(lentAccount, line.amount));
      const borrowedAccount = borrowed.get(line.account);
      if (borrowedAccount) byMe.set(person, (byMe.get(person) ?? 0) - inMain(borrowedAccount, line.amount));
    }
  }
  const rows = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([person, amount]) => ({ person, amount: round(amount) }))
      .filter((row) => Math.abs(row.amount) > 0.0001)
      .sort((a, b) => b.amount - a.amount);

  return {
    owedToMe: round(owedToMe),
    iOwe: round(iOwe),
    owedToMeByPerson: rows(toMe),
    iOweByPerson: rows(byMe),
  };
}

export function useDebts(): Debts {
  const accounts = useAccounts();
  const balances = useBalances();
  const entries = useEntries();
  const rates = useExchangeRates();
  const { mainCurrency } = useLedgerLabels();
  return useMemo(
    () => computeDebts(accounts, balances, entries, mainCurrency, rates),
    [accounts, balances, entries, mainCurrency, rates],
  );
}
