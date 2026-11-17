/**
 * Repeating wallet items (salary, rent, subscriptions, scheduled Sadaqa /
 * Zakat top-ups). Automatic ones are added on app open for every due date
 * (stable ids, so nothing is added twice); the others wait for confirmation.
 */
import { addPeriods, today, type Period } from '@/lib/dates';
import { deterministicId, getDoc, getDocs, newId, putDoc, removeDoc } from '@/lib/data/vault';
import { addEntry } from '@/lib/ledger/ledger';
import { RecordTypes } from '@/lib/ledger/types';

import type { Recurring } from './types';

const FREQUENCY_PERIOD: Record<Recurring['frequency'], Period> = { weekly: 'week', monthly: 'month', yearly: 'year' };

export function nextDate(day: string, frequency: Recurring['frequency']): string {
  return addPeriods(day, FREQUENCY_PERIOD[frequency], 1);
}

function entryId(item: Recurring, day: string): string {
  return deterministicId(`recurring:${item.id}:${day}`);
}

async function addOccurrence(item: Recurring, day: string): Promise<void> {
  const id = entryId(item, day);
  if (getDoc(RecordTypes.entry, id)) return;
  if (item.kind === 'transfer' && item.toAccountId) {
    const rate = item.rate ?? 1;
    await addEntry({
      id,
      kind: 'top_up',
      date: day,
      note: item.name,
      rate: rate === 1 ? undefined : rate,
      lines: [
        { account: item.accountId, amount: -item.amount },
        { account: item.toAccountId, amount: item.amount * rate },
      ],
    });
    return;
  }
  await addEntry({
    id,
    kind: item.kind === 'income' ? 'income' : 'expense',
    date: day,
    note: item.name,
    categoryId: item.categoryId,
    lines: [{ account: item.accountId, amount: item.kind === 'income' ? item.amount : -item.amount }],
  });
}

/** Adds every due occurrence of automatic items. */
export async function runDueRecurring(): Promise<void> {
  const now = today();
  for (const item of getDocs<Recurring>(RecordTypes.recurring)) {
    if (!item.auto || item.next > now) continue;
    let day = item.next;
    while (day <= now) {
      await addOccurrence(item, day);
      day = nextDate(day, item.frequency);
    }
    await putDoc<Recurring>(RecordTypes.recurring, { ...item, next: day });
  }
}

/** Items waiting for confirmation (not automatic, due today or earlier). */
export function dueForConfirmation(items: Recurring[]): Recurring[] {
  const now = today();
  return items.filter((item) => !item.auto && item.next <= now);
}

export async function confirmRecurring(item: Recurring): Promise<void> {
  await addOccurrence(item, item.next);
  await putDoc<Recurring>(RecordTypes.recurring, { ...item, next: nextDate(item.next, item.frequency) });
}

export async function skipRecurring(item: Recurring): Promise<void> {
  await putDoc<Recurring>(RecordTypes.recurring, { ...item, next: nextDate(item.next, item.frequency) });
}

export async function saveRecurring(item: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  return putDoc<Recurring>(RecordTypes.recurring, { ...item, id: item.id ?? newId() });
}

export async function deleteRecurring(id: string): Promise<void> {
  await removeDoc(RecordTypes.recurring, id);
}
