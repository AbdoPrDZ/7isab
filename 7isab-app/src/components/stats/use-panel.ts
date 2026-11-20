/**
 * Everything the statistics panel shares: the filtered entries of the range
 * and of the previous range, the filter context, buckets, and display names
 * for every filter option and group key.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDocs } from '@/lib/data/vault';
import { useAccounts, useEntries, useExchangeRates, useLedgerLabels, useSinTypes, useTasks } from '@/lib/ledger/hooks';
import { RecordTypes, type Entry, type EntryKind, type TaskKind } from '@/lib/ledger/types';
import { PRAYERS } from '@/lib/prayer/prayer';
import { usePrograms } from '@/lib/programs/programs';
import {
  buckets,
  filterEntries,
  previousRange,
  resolveRange,
  type Bucket,
  type FilterContext,
  type GroupBy,
  type ListKey,
  type Range,
  type StatsFilter,
} from '@/lib/stats/filter';
import type { Money } from '@/lib/stats/panel';
import { conversionCurrency, useCategories } from '@/lib/wallet/wallet';

export const ENTRY_KINDS: EntryKind[] = [
  'income',
  'expense',
  'transfer',
  'loan',
  'task_done',
  'task_missed',
  'prayer_late',
  'prayer_missed',
  'bedtime_late',
  'sin',
  'fast_tap',
  'thanb_paid',
  'sadaqa',
  'zakat',
  'top_up',
  'adjustment',
];
export const TASK_KINDS: TaskKind[] = ['quran', 'athkar', 'custom', 'prayer', 'nafilah', 'fasting', 'bedtime'];

export type Option = { value: string; label: string };

export type Panel = {
  range: Range;
  previous: Range;
  list: Bucket[];
  all: Entry[];
  entries: Entry[];
  previousEntries: Entry[];
  ctx: FilterContext;
  money: Money;
  options: Record<ListKey, Option[]>;
  /** Label of a group key for a grouping. */
  groupLabel: (groupBy: GroupBy, key: string) => string;
  /** Label of a bucket key (short for chart axes). */
  bucketLabel: (key: string, short: boolean) => string;
};

export function usePanel(filter: StatsFilter): Panel {
  const { t } = useTranslation();
  const all = useEntries();
  const accounts = useAccounts();
  const tasks = useTasks();
  const sinTypes = useSinTypes();
  const categories = useCategories();
  const programs = usePrograms();
  const rates = useExchangeRates();
  useDocs(RecordTypes.progress);
  const { accountName, sinName, mainCurrency, format } = useLedgerLabels();

  return useMemo(() => {
    const accountMap = new Map(accounts.map((account) => [account.id, account]));
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const categoryName = (id: string) => {
      const category = categories.find((item) => item.id === id);
      return category ? (category.preset ? t(`wallet.defaultCategories.${category.preset}`) : category.name) : t('stats.none');
    };
    const sinLabel = (id: string) => {
      const sin = sinTypes.find((item) => item.id === id);
      return sin ? sinName(sin) : t('stats.none');
    };
    const describe = (entry: Entry) => {
      if (entry.taskId) return taskMap.get(entry.taskId)?.title ?? t(`hisab.kinds.${entry.kind}`);
      if (entry.sinTypeId) return sinLabel(entry.sinTypeId);
      if (entry.categoryId) return categoryName(entry.categoryId);
      return entry.note || t(`hisab.kinds.${entry.kind}`);
    };
    const ctx: FilterContext = {
      accounts: accountMap,
      tasks: taskMap,
      currencyOf: (account) => conversionCurrency(account, mainCurrency),
      describe,
    };

    const first = all.reduce<string | null>((min, entry) => (!min || entry.date < min ? entry.date : min), null);
    const range = resolveRange(filter, first);
    const previous = previousRange(range);
    const list = buckets(range);
    const entries = filterEntries(all, range, filter, ctx).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const previousEntries = filterEntries(all, previous, filter, ctx);

    const currencies = [...new Set(accounts.map((account) => conversionCurrency(account, mainCurrency)).filter(Boolean))] as string[];
    const people = [...new Set(all.map((entry) => entry.person?.trim()).filter(Boolean))].sort() as string[];
    const options: Record<ListKey, Option[]> = {
      accounts: accounts.filter((account) => !account.archived).map((account) => ({ value: account.id, label: accountName(account) })),
      currencies: currencies.map((currency) => ({ value: currency, label: currency === 'XAU_G' ? t('wallet.unitGold') : currency })),
      categories: categories.map((category) => ({ value: category.id, label: categoryName(category.id) })),
      kinds: ENTRY_KINDS.map((kind) => ({ value: kind, label: t(`hisab.kinds.${kind}`) })),
      people: people.map((person) => ({ value: person, label: person })),
      tasks: tasks.map((task) => ({ value: task.id, label: task.title })),
      taskKinds: TASK_KINDS.map((kind) => ({ value: kind, label: t(`task.kinds.${kind}`) })),
      programs: programs.map((program) => ({ value: program.id, label: program.name })),
      prayers: PRAYERS.map((prayer) => ({ value: prayer, label: t(`prayer.names.${prayer}`) })),
      sinTypes: sinTypes.map((sin) => ({ value: sin.id, label: sinName(sin) })),
    };

    const bucketLabel = (key: string, short: boolean) => {
      const bucket = list.find((item) => item.key === key);
      const granularity = bucket?.granularity ?? 'day';
      if (granularity === 'year') return format.digits(key.slice(0, 4));
      if (granularity === 'month') return short ? format.month(key.slice(0, 7)).split(' ')[0] : format.month(key.slice(0, 7));
      if (granularity === 'week') return short ? format.digits(Number(key.slice(8))) : `${format.day(bucket!.start)} – ${format.day(bucket!.end)}`;
      return short ? format.digits(Number(key.slice(8))) : format.day(key, 'long');
    };

    const groupLabel = (groupBy: GroupBy, key: string) => {
      switch (groupBy) {
        case 'time':
          return bucketLabel(key, false);
        case 'weekday':
          return t(`task.days.${key}`);
        case 'category':
          return key ? categoryName(key) : t('stats.none');
        case 'account': {
          const account = accountMap.get(key);
          return account ? accountName(account) : t('stats.none');
        }
        case 'currency':
          return key === 'XAU_G' ? t('wallet.unitGold') : key || t('stats.none');
        case 'person':
          return key || t('debts.noName');
        case 'kind':
          return t(`hisab.kinds.${key}`);
        case 'task':
          return key ? (taskMap.get(key)?.title ?? t('stats.deletedTask')) : t('stats.none');
        case 'sinType':
          return key ? sinLabel(key) : t('stats.none');
      }
    };

    return {
      range,
      previous,
      list,
      all,
      entries,
      previousEntries,
      ctx,
      money: { main: mainCurrency, rates },
      options,
      groupLabel,
      bucketLabel,
    };
  }, [filter, all, accounts, tasks, sinTypes, categories, programs, rates, mainCurrency, t, accountName, sinName, format]);
}
