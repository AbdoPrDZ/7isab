/**
 * Programs: a named plan (improving, healing, or a custom category) with its
 * own tasks (task.programId). Healing programs also track a habit:
 *
 * - relapses (date, optional private note); with "Thanb" on, each adds a
 *   "Relapse" Thanb entry (sin type `relapse`, penalty default 1) whose id is
 *   fixed from the relapse, so deleting the relapse deletes its entry;
 * - clean days: the current streak since the last relapse (or the start), and
 *   the best streak.
 *
 * A program's report uses the same rules as the period reports: completion of
 * its tasks ÷ (its due tasks + relapses), rated good / normal / weak.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { addDays, daysBetween, today } from '@/lib/dates';
import { deterministicId, getDoc, getDocs, newId, putDoc, putDocs, removeDoc, useDocs } from '@/lib/data/vault';
import { fixedAccountId, round } from '@/lib/ledger/ledger';
import { RecordTypes, type Entry, type Program, type Relapse, type SinType, type Task } from '@/lib/ledger/types';
import { countTasks, rate, type Rating, type TaskCount } from '@/lib/reports/reports';

export function usePrograms(): Program[] {
  const programs = useDocs<Program>(RecordTypes.program);
  return useMemo(() => [...programs].sort((a, b) => b.startDate.localeCompare(a.startDate) || a.createdAt - b.createdAt), [programs]);
}

export function isActive(program: Program, day: string = today()): boolean {
  return !program.archived && program.startDate <= day && (!program.endDate || program.endDate >= day);
}

export function useCategoryLabel(): (program: Program) => string {
  const { t } = useTranslation();
  return (program) =>
    program.category === 'custom' ? program.customCategory || t('programs.categories.custom') : t(`programs.categories.${program.category}`);
}

export type ProgramInput = Omit<Program, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export async function saveProgram(input: ProgramInput): Promise<Program> {
  return putDoc<Program>(RecordTypes.program, { ...input, id: input.id ?? newId() });
}

/** Deletes a program, its relapses (and their Thanb entries); its tasks stay, without a program. */
export async function deleteProgram(program: Program): Promise<void> {
  // Plain tasks never count in a rating.
  const tasks = getDocs<Task>(RecordTypes.task).filter((task) => task.programId === program.id && !task.plain);
  if (tasks.length) await putDocs<Task>(RecordTypes.task, tasks.map(({ programId: _p, ...task }) => task));
  for (const relapse of getDocs<Relapse>(RecordTypes.relapse).filter((item) => item.programId === program.id)) {
    await deleteRelapse(relapse);
  }
  await removeDoc(RecordTypes.program, program.id);
}

// ---- Relapses --------------------------------------------------------------------

export function useRelapses(programId: string): Relapse[] {
  const relapses = useDocs<Relapse>(RecordTypes.relapse);
  return useMemo(
    () => relapses.filter((item) => item.programId === programId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [relapses, programId],
  );
}

function relapseEntryId(relapse: Pick<Relapse, 'id'>): string {
  return deterministicId(`relapse-entry:${relapse.id}`);
}

export async function logRelapse(program: Program, date: string, note: string, thanb: boolean): Promise<void> {
  const relapse = await putDoc<Relapse>(RecordTypes.relapse, {
    id: newId(),
    programId: program.id,
    date,
    note: note.trim() || undefined,
    thanb,
  });
  if (!thanb) return;
  const sinTypeId = deterministicId('sin:relapse');
  const penalty = round(getDoc<SinType>(RecordTypes.sinType, sinTypeId)?.penalty ?? 1);
  if (penalty <= 0) return;
  await putDoc<Entry>(RecordTypes.entry, {
    id: relapseEntryId(relapse),
    kind: 'sin',
    date,
    sinTypeId,
    note: relapse.note ? `${program.name} · ${relapse.note}` : program.name,
    lines: [
      { account: fixedAccountId('akhira'), amount: -penalty },
      { account: fixedAccountId('thanb'), amount: penalty },
    ],
  });
}

export async function deleteRelapse(relapse: Relapse): Promise<void> {
  if (getDoc(RecordTypes.entry, relapseEntryId(relapse))) await removeDoc(RecordTypes.entry, relapseEntryId(relapse));
  await removeDoc(RecordTypes.relapse, relapse.id);
}

/**
 * Clean days of a healing program up to `day` (or its end): the current
 * streak (days since the last relapse, or since the start counting the start
 * day) and the best streak.
 */
export function streaks(program: Program, relapses: Relapse[], day: string = today()): { current: number; best: number } {
  const last = program.endDate && program.endDate < day ? program.endDate : day;
  if (program.startDate > last) return { current: 0, best: 0 };
  const dates = [...new Set(relapses.map((item) => item.date).filter((date) => date >= program.startDate && date <= last))].sort();
  let best = 0;
  let from = program.startDate;
  let includeFrom = true;
  for (const date of dates) {
    const clean = daysBetween(from, date).length - 1 - (includeFrom ? 0 : 1);
    best = Math.max(best, clean);
    from = date;
    includeFrom = false;
  }
  const current = daysBetween(from, last).length - (includeFrom ? 0 : 1);
  return { current: Math.max(0, current), best: Math.max(best, current) };
}

// ---- Report ----------------------------------------------------------------------

export type ProgramReport = TaskCount & {
  start: string;
  end: string;
  relapses: number;
  score: number | null;
  rating: Rating | null;
};

/** The program's tasks and relapses between start and end (clamped to the program's dates). */
export function programReport(program: Program, start: string, end: string): ProgramReport {
  const from = start > program.startDate ? start : program.startDate;
  const to = program.endDate && program.endDate < end ? program.endDate : end;
  const tasks = getDocs<Task>(RecordTypes.task).filter((task) => task.programId === program.id);
  const counted = from <= to ? countTasks(tasks, from, to) : { rows: [], completed: 0, items: 0 };
  const relapses =
    program.category === 'healing'
      ? getDocs<Relapse>(RecordTypes.relapse).filter(
          (item) => item.programId === program.id && item.date >= from && item.date <= to && item.date <= today(),
        ).length
      : 0;
  const denominator = counted.items + relapses;
  const score = denominator ? Math.max(0, Math.min(1, counted.completed / denominator)) : null;
  return { ...counted, start: from, end: to, relapses, score, rating: rate(score) };
}

/** The program's whole length so far (start → its end or today). */
export function programWholeRange(program: Program): { start: string; end: string } {
  const end = program.endDate && program.endDate < today() ? program.endDate : today();
  return { start: program.startDate, end };
}

/** Last day of a program that lasts `days` days from `start`. */
export function endFromLength(start: string, days: number): string {
  return addDays(start, Math.max(1, days) - 1);
}

/** Report hook, rebuilt when progress, tasks or relapses change. */
export function useProgramReport(program: Program | undefined, start: string, end: string): ProgramReport | null {
  const progress = useDocs(RecordTypes.progress);
  const tasks = useDocs(RecordTypes.task);
  const relapses = useDocs(RecordTypes.relapse);
  return useMemo(
    () => (program ? programReport(program, start, end) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt from the vault when these change
    [program, start, end, progress, tasks, relapses],
  );
}
