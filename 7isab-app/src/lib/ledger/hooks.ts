/** React hooks over the ledger records in the vault. */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDocs } from '@/lib/data/vault';
import { useFormat } from '@/lib/format';

import { computeBalances, untouchedStarterKey } from './ledger';
import {
  GOLD_CURRENCY,
  RecordTypes,
  type Account,
  type Entry,
  type ExchangeRate,
  type Settings,
  type SinType,
  type Task,
} from './types';

export function useSettings(): Settings | undefined {
  const all = useDocs<Settings>(RecordTypes.settings);
  return all[0];
}

export function useAccounts(): Account[] {
  const accounts = useDocs<Account>(RecordTypes.account);
  return useMemo(() => [...accounts].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt), [accounts]);
}

export function useEntries(): Entry[] {
  const entries = useDocs<Entry>(RecordTypes.entry);
  return useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), [entries]);
}

export function useBalances(): Map<string, number> {
  const entries = useDocs<Entry>(RecordTypes.entry);
  return useMemo(() => computeBalances(entries), [entries]);
}

export function useTasks(): Task[] {
  const tasks = useDocs<Task>(RecordTypes.task);
  return useMemo(() => [...tasks].sort((a, b) => a.createdAt - b.createdAt), [tasks]);
}

export function useSinTypes(): SinType[] {
  const types = useDocs<SinType>(RecordTypes.sinType);
  return useMemo(() => [...types].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt), [types]);
}

export function useExchangeRates(): ExchangeRate[] {
  return useDocs<ExchangeRate>(RecordTypes.exchangeRate);
}

/** Display names and amount formatting for accounts and sin types. */
export function useLedgerLabels() {
  const { t } = useTranslation();
  const format = useFormat();
  const settings = useSettings();
  const main = settings?.mainCurrency ?? 'DZD';

  const accountName = (account: Account) => {
    if (account.fixed) return t(`accounts.${account.fixed}`);
    const starter = untouchedStarterKey(account);
    return starter ? t(`accounts.starter.${starter}`, { defaultValue: account.name }) : account.name;
  };
  const sinName = (sin: SinType) => (sin.preset ? t(`sins.presets.${sin.preset}`, { defaultValue: sin.name }) : sin.name);
  const currencyOf = (account: Account) =>
    account.unit.kind === 'money' ? (account.unit.currency ?? main) : account.unit.kind === 'gold' ? GOLD_CURRENCY : null;

  const amount = (account: Account, value: number) => {
    switch (account.unit.kind) {
      case 'akhira':
        return `${format.points(value)} ${t('units.akhira')}`;
      case 'thanb':
        return `${format.points(value)} ${t('units.thanb')}`;
      case 'gold':
        return `${format.number(value, 3)} ${t('units.grams')}`;
      default:
        return format.money(value, account.unit.currency ?? main);
    }
  };

  return { accountName, sinName, amount, currencyOf, mainCurrency: main, format };
}
