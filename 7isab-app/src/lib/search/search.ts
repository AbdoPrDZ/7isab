/**
 * Search over the user's own records (decrypted on the phone; nothing is sent
 * anywhere): athkar, Testaments, wallet activity, tasks and programs, notes,
 * accounts / categories / people, alarms and sin types. The Quran has its own
 * offline index (lib/quran/search). Every group is matched with `foldText`, so
 * case, accents and Arabic diacritics don't matter.
 */
import type { Href } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Alarm } from '@/lib/alarms/alarms';
import { ATHKAR_LIST_IDS, BUILT_IN_ATHKAR } from '@/lib/athkar/data';
import type { CustomDhikr } from '@/lib/athkar/athkar';
import { useDocs } from '@/lib/data/vault';
import { useAccounts, useEntries, useLedgerLabels, useSinTypes, useTasks } from '@/lib/ledger/hooks';
import { useReasonName } from '@/lib/ledger/reasons';
import { RecordTypes, type Entry, type Program, type Reason, type Relapse } from '@/lib/ledger/types';
import type { ReportNote } from '@/lib/reports/reports';
import { useTestamentContent, useTestaments } from '@/lib/testaments/testaments';
import { useCategories } from '@/lib/wallet/wallet';

import { foldText, matchesAll } from './normalize';

export type SearchGroupId = 'athkar' | 'testaments' | 'wallet' | 'tasks' | 'notes' | 'accounts' | 'alarms';

export type SearchItem = {
  id: string;
  title: string;
  subtitle?: string;
  /** Shown right-to-left in Arabic (athkar, ayat). */
  arabic?: boolean;
  href: Href;
};

export type SearchGroup = { id: SearchGroupId; items: SearchItem[] };

/** Entry kinds shown in the wallet's activity list. */
export const WALLET_KINDS: Entry['kind'][] = ['income', 'expense', 'transfer', 'loan', 'top_up'];

/** The smallest query that searches (shorter ones match too much). */
export const MIN_QUERY = 2;

export function foldQuery(query: string): string {
  const folded = foldText(query);
  return folded.length >= MIN_QUERY ? folded : '';
}

/** Matches when every word of the query is in one of the fields. */
function hit(query: string, ...fields: (string | undefined | null)[]): boolean {
  return matchesAll(foldText(fields.filter(Boolean).join(' \n ')), query);
}

/** Wallet entries matching the query (note, person, category, accounts, amount), newest first. */
export function useWalletSearch(query: string): Entry[] {
  const { t } = useTranslation();
  const entries = useEntries();
  const accounts = useAccounts();
  const categories = useCategories();
  const { accountName } = useLedgerLabels();
  const folded = foldQuery(query);
  return useMemo(() => {
    if (!folded) return [];
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const categoryName = (id?: string) => {
      const category = categories.find((item) => item.id === id);
      return category ? (category.preset ? t(`wallet.defaultCategories.${category.preset}`) : category.name) : '';
    };
    return entries.filter((entry) => {
      if (!WALLET_KINDS.includes(entry.kind)) return false;
      const names = entry.lines.map((line) => {
        const account = accountById.get(line.account);
        return account ? accountName(account) : '';
      });
      const amounts = entry.lines.map((line) => String(Math.abs(line.amount)));
      return hit(folded, entry.note, entry.person, categoryName(entry.categoryId), t(`hisab.kinds.${entry.kind}`), ...names, ...amounts);
    });
  }, [folded, entries, accounts, categories, accountName, t]);
}

/** Everything but the Quran, grouped. `only` limits it to one group (per-screen search). */
export function useEverythingSearch(query: string): SearchGroup[] {
  const { t } = useTranslation();
  const { accountName, sinName, format, amount } = useLedgerLabels();
  const reasonName = useReasonName();
  const content = useTestamentContent();
  const folded = foldQuery(query);

  const customAthkar = useDocs<CustomDhikr>(RecordTypes.athkar);
  const testaments = useTestaments();
  const walletEntries = useWalletSearch(query);
  const tasks = useTasks();
  const programs = useDocs<Program>(RecordTypes.program);
  const relapses = useDocs<Relapse>(RecordTypes.relapse);
  const reportNotes = useDocs<ReportNote>(RecordTypes.reportNote);
  const entries = useEntries();
  const reasons = useDocs<Reason>(RecordTypes.reason);
  const accounts = useAccounts();
  const categories = useCategories();
  const alarms = useDocs<Alarm>(RecordTypes.alarm);
  const sinTypes = useSinTypes();

  return useMemo(() => {
    if (!folded) return [];
    const groups: SearchGroup[] = [];
    const add = (id: SearchGroupId, items: SearchItem[]) => items.length && groups.push({ id, items });

    // Athkar: built-in lists and the user's own.
    const athkar: SearchItem[] = [];
    for (const listId of ATHKAR_LIST_IDS) {
      const list =
        listId === 'custom'
          ? customAthkar.map((dhikr) => ({ id: dhikr.id, text: dhikr.text }))
          : BUILT_IN_ATHKAR[listId].map((dhikr) => ({ id: `${listId}:${dhikr.id}`, text: dhikr.text }));
      for (const dhikr of list) {
        if (hit(folded, dhikr.text)) {
          athkar.push({
            id: dhikr.id,
            title: dhikr.text,
            subtitle: t(`athkar.lists.${listId}`),
            arabic: true,
            href: { pathname: '/athkar/[list]', params: { list: listId } },
          });
        }
      }
    }
    add('athkar', athkar);

    add(
      'testaments',
      testaments.flatMap((testament) => {
        const { text, source, arabic } = content(testament);
        return hit(folded, text, source, t(`testaments.categories.${testament.category}`))
          ? [
              {
                id: testament.id,
                title: text,
                subtitle: [t(`testaments.categories.${testament.category}`), source].filter(Boolean).join(' · '),
                arabic,
                href: { pathname: '/testaments', params: { id: testament.id } } as Href,
              },
            ]
          : [];
      }),
    );

    const accountById = new Map(accounts.map((account) => [account.id, account]));
    add(
      'wallet',
      walletEntries.map((entry) => {
        const line = entry.lines[0];
        const account = line ? accountById.get(line.account) : undefined;
        return {
          id: entry.id,
          title: entry.note || entry.person || t(`hisab.kinds.${entry.kind}`),
          subtitle: [format.day(entry.date), t(`hisab.kinds.${entry.kind}`), account && line ? amount(account, line.amount) : null]
            .filter(Boolean)
            .join(' · '),
          href: { pathname: '/wallet', params: { q: query.trim() } } as Href,
        };
      }),
    );

    add('tasks', [
      ...tasks
        .filter((task) => hit(folded, task.title))
        .map((task) => ({
          id: task.id,
          title: task.title,
          subtitle: t('search.task'),
          href: { pathname: '/task/[id]', params: { id: task.id } } as Href,
        })),
      ...programs
        .filter((program) => hit(folded, program.name, program.goal))
        .map((program) => ({
          id: program.id,
          title: program.name,
          subtitle: program.goal || t('search.program'),
          href: { pathname: '/program/[id]', params: { id: program.id } } as Href,
        })),
    ]);

    const programName = new Map(programs.map((program) => [program.id, program.name]));
    add('notes', [
      ...reportNotes
        .filter((note) => hit(folded, note.text))
        .map((note) => ({
          id: note.id,
          title: note.text,
          subtitle: `${t(`report.periods.${note.period}`)} · ${format.day(note.start)}`,
          href: { pathname: '/report', params: { period: note.period, date: note.start } } as Href,
        })),
      ...relapses
        .filter((relapse) => hit(folded, relapse.note))
        .map((relapse) => ({
          id: relapse.id,
          title: relapse.note ?? '',
          subtitle: `${programName.get(relapse.programId) ?? ''} · ${format.day(relapse.date)}`,
          href: { pathname: '/program/[id]', params: { id: relapse.programId } } as Href,
        })),
      ...entries
        .filter((entry) => !WALLET_KINDS.includes(entry.kind) && hit(folded, entry.note))
        .map((entry) => ({
          id: entry.id,
          title: entry.note ?? '',
          subtitle: `${t(`hisab.kinds.${entry.kind}`)} · ${format.day(entry.date)}`,
          href: { pathname: '/stats', params: { section: 'entries' } } as Href,
        })),
      ...reasons
        .filter((reason) => hit(folded, reasonName(reason)))
        .map((reason) => ({
          id: reason.id,
          title: reasonName(reason),
          subtitle: t(`search.reasonScope.${reason.scope}`),
          href: (reason.scope === 'bedtime' ? '/bedtime' : '/prayer-settings') as Href,
        })),
    ]);

    const people = new Map<string, number>();
    for (const entry of entries) {
      const person = entry.person?.trim();
      if (person && hit(folded, person)) people.set(person, (people.get(person) ?? 0) + 1);
    }
    add('accounts', [
      ...accounts
        .filter((account) => hit(folded, accountName(account)))
        .map((account) => ({
          id: account.id,
          title: accountName(account),
          subtitle: t('search.account'),
          href: (account.fixed
            ? { pathname: '/stats', params: { section: 'akhira' } }
            : account.role === 'investment'
              ? '/investments'
              : { pathname: '/wallet/account/[id]', params: { id: account.id } }) as Href,
        })),
      ...categories
        .filter((category) => hit(folded, category.preset ? t(`wallet.defaultCategories.${category.preset}`) : category.name))
        .map((category) => ({
          id: category.id,
          title: category.preset ? t(`wallet.defaultCategories.${category.preset}`) : category.name,
          subtitle: t('search.category'),
          href: '/wallet/categories' as Href,
        })),
      ...[...people].map(([person, count]) => ({
        id: `person:${person}`,
        title: person,
        subtitle: t('search.person', { count: format.number(count) }),
        href: { pathname: '/wallet', params: { q: person } } as Href,
      })),
    ]);

    add('alarms', [
      ...alarms
        .filter((alarm) => hit(folded, alarm.label))
        .map((alarm) => ({
          id: alarm.id,
          title: alarm.label,
          subtitle: t('search.alarm'),
          href: { pathname: '/alarm/[id]', params: { id: alarm.id } } as Href,
        })),
      ...sinTypes
        .filter((sin) => hit(folded, sinName(sin)))
        .map((sin) => ({
          id: sin.id,
          title: sinName(sin),
          subtitle: t('search.sinType'),
          href: { pathname: '/sins', params: { mode: 'edit' } } as Href,
        })),
    ]);

    return groups;
  }, [
    folded,
    query,
    t,
    customAthkar,
    testaments,
    content,
    walletEntries,
    tasks,
    programs,
    relapses,
    reportNotes,
    entries,
    reasons,
    reasonName,
    accounts,
    accountName,
    categories,
    alarms,
    sinTypes,
    sinName,
    format,
    amount,
  ]);
}
