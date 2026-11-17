/**
 * Athkar counters: today's count for each dhikr of a list, custom athkar, and
 * the link to athkar tasks (each counted tap adds 1 to "count" tasks of that
 * list; finishing the whole list completes its "done / not done" tasks).
 */
import { useMemo } from 'react';

import { today } from '@/lib/dates';
import { deterministicId, getDoc, getDocs, newId, putDoc, removeDoc, useDoc, useDocs, type Doc } from '@/lib/data/vault';
import { addLinkedProgress, isDue, setProgress } from '@/lib/ledger/tasks';
import { RecordTypes, type Task } from '@/lib/ledger/types';

import { BUILT_IN_ATHKAR, type AthkarListId, type Dhikr } from './data';

export type CustomDhikr = Doc & { text: string; target: number; order: number };
export type AthkarDay = Doc & { listId: AthkarListId; date: string; counts: Record<string, number> };

function dayId(listId: AthkarListId, day: string): string {
  return deterministicId(`athkar-day:${listId}:${day}`);
}

export function useAthkarList(listId: AthkarListId): Dhikr[] {
  const custom = useDocs<CustomDhikr>(RecordTypes.athkar);
  return useMemo(
    () =>
      listId === 'custom'
        ? [...custom].sort((a, b) => a.order - b.order).map(({ id, text, target }) => ({ id, text, target }))
        : BUILT_IN_ATHKAR[listId],
    [custom, listId],
  );
}

export function useAthkarCounts(listId: AthkarListId): Record<string, number> {
  let id: string | undefined;
  try {
    id = dayId(listId, today());
  } catch {
    id = undefined;
  }
  return useDoc<AthkarDay>(RecordTypes.athkarDay, id)?.counts ?? {};
}

function listFor(listId: AthkarListId): Dhikr[] {
  if (listId !== 'custom') return BUILT_IN_ATHKAR[listId];
  return getDocs<CustomDhikr>(RecordTypes.athkar).map(({ id, text, target }) => ({ id, text, target }));
}

export function isListComplete(list: Dhikr[], counts: Record<string, number>): boolean {
  return list.length > 0 && list.every((dhikr) => (counts[dhikr.id] ?? 0) >= dhikr.target);
}

/** Counts one repetition. Returns the new count. */
export async function countDhikr(listId: AthkarListId, dhikr: Dhikr): Promise<number> {
  const day = today();
  const id = dayId(listId, day);
  const existing = getDoc<AthkarDay>(RecordTypes.athkarDay, id);
  const counts = { ...(existing?.counts ?? {}) };
  const before = counts[dhikr.id] ?? 0;
  if (before >= dhikr.target) return before;
  counts[dhikr.id] = before + 1;

  await putDoc<AthkarDay>(RecordTypes.athkarDay, { id, listId, date: day, counts });

  const linked = (task: Task) => task.kind === 'athkar' && (task.athkarListId ?? 'morning') === listId;
  await addLinkedProgress(linked, { count: 1 }, day);
  if (isListComplete(listFor(listId), counts)) {
    for (const task of getDocs<Task>(RecordTypes.task)) {
      if (linked(task) && isDue(task, day) && task.target.unit === 'check') await setProgress(task, day, 1);
    }
  }
  return counts[dhikr.id];
}

export async function resetDhikr(listId: AthkarListId, dhikrId: string): Promise<void> {
  const day = today();
  const id = dayId(listId, day);
  const existing = getDoc<AthkarDay>(RecordTypes.athkarDay, id);
  if (!existing) return;
  await putDoc<AthkarDay>(RecordTypes.athkarDay, { ...existing, counts: { ...existing.counts, [dhikrId]: 0 } });
}

export async function addCustomDhikr(text: string, target: number): Promise<void> {
  const order = getDocs<CustomDhikr>(RecordTypes.athkar).length;
  await putDoc<CustomDhikr>(RecordTypes.athkar, { id: newId(), text, target, order });
}

export async function deleteCustomDhikr(id: string): Promise<void> {
  await removeDoc(RecordTypes.athkar, id);
}
