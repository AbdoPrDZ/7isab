/**
 * The "Go to bed" task. Each night (named by the evening's day, YYYY-MM-DD)
 * the user marks the time they went to sleep:
 *
 * - by bedtime + grace: on time, the task's reward (task_done);
 * - later: a reason is required. An excused reason (Work, Illness…) counts
 *   nothing; a Thanb reason (Phone, TV…) adds a "Late bedtime" Thanb
 *   (bedtime_late, penalty from that sin type, the reason as the note);
 * - never marked by the end of the next day: a "Late bedtime" Thanb too.
 *
 * Like the prayers, one entry per night with a fixed id (task + night), so a
 * correction rewrites it and two devices never double it. The task has a
 * fixed id too and is archived when bedtime is switched off.
 */
import i18n from '@/i18n';
import { addDays, daysBetween, fromDay, today } from '@/lib/dates';
import { deterministicId, getDoc, putDoc, removeDoc } from '@/lib/data/vault';
import { fixedAccountId, getSettings, round, updateSettings } from '@/lib/ledger/ledger';
import { reasonLabel } from '@/lib/ledger/reasons';
import { useSettings } from '@/lib/ledger/hooks';
import { entryForDay, progressId, taskEntryId } from '@/lib/ledger/tasks';
import {
  RecordTypes,
  type BedtimeSettings,
  type Entry,
  type Reason,
  type SinType,
  type Task,
  type TaskProgress,
} from '@/lib/ledger/types';

export const DEFAULT_BEDTIME: BedtimeSettings = { enabled: true, hour: 23, minute: 0, grace: 30 };

/** Hours of the evening from which a night can be marked, and the next morning's hour up to which the clock means "after midnight". */
const EVENING_FROM = 18;
const MORNING_UNTIL = 12;
const CATCH_UP_DAYS = 14;
const MINUTE = 60_000;

function withDefaults(value: Partial<BedtimeSettings> | undefined): BedtimeSettings {
  return { ...DEFAULT_BEDTIME, ...value };
}

export function getBedtimeSettings(): BedtimeSettings {
  try {
    return withDefaults(getSettings().bedtime);
  } catch {
    return DEFAULT_BEDTIME;
  }
}

export function useBedtimeSettings(): BedtimeSettings {
  return withDefaults(useSettings()?.bedtime);
}

export async function updateBedtimeSettings(changes: Partial<BedtimeSettings>): Promise<void> {
  await updateSettings({ bedtime: { ...getBedtimeSettings(), ...changes } });
  await syncBedtimeTask();
}

export function bedtimeTaskId(): string {
  return deterministicId('bedtime-task');
}

export function getBedtimeTask(): Task | undefined {
  return getDoc<Task>(RecordTypes.task, bedtimeTaskId());
}

/** Creates the task when bedtime is on (and un-archives it); archives it when off. */
export async function syncBedtimeTask(): Promise<void> {
  const { enabled } = getBedtimeSettings();
  const existing = getBedtimeTask();
  if (enabled && !existing) {
    await putDoc<Task>(RecordTypes.task, {
      id: bedtimeTaskId(),
      title: i18n.t('bedtime.taskTitle'),
      kind: 'bedtime',
      target: { unit: 'check', amount: 1 },
      repeat: { kind: 'daily' },
      reward: 1,
      penalty: 1,
      startDate: today(),
    });
  } else if (existing && existing.archived === enabled) {
    await putDoc<Task>(RecordTypes.task, { ...existing, archived: !enabled });
  }
}

/** The clock time hour:minute in a night: evening hours on the night's day, early hours on the next day. */
export function atNight(night: string, hour: number, minute: number): Date {
  const at = fromDay(night);
  at.setHours(hour, minute, 0, 0);
  if (hour < MORNING_UNTIL) at.setDate(at.getDate() + 1);
  return at;
}

/** Bedtime of a night, and the latest on-time moment (bedtime + grace). */
export function bedtimeOf(night: string, settings: BedtimeSettings = getBedtimeSettings()) {
  const at = atNight(night, settings.hour, settings.minute);
  return { at, onTimeUntil: new Date(at.getTime() + settings.grace * MINUTE) };
}

/** Unmarked after this, the night counts as late (end of the next day). */
export function nightDeadline(night: string): Date {
  return fromDay(addDays(night, 2));
}

/** The night shown now: tonight from the evening, last night in the morning. */
export function currentNight(now: Date = new Date()): string {
  return now.getHours() < MORNING_UNTIL ? addDays(today(), -1) : today();
}

export function bedtimeMark(night: string): TaskProgress | null {
  const progress = getDoc<TaskProgress>(RecordTypes.progress, progressId(bedtimeTaskId(), night));
  return progress && progress.value >= 1 ? progress : null;
}

/** onTime / late: marked. missed: unmarked past its deadline. open: can be marked now. upcoming: not evening yet. */
export type BedtimeState = 'onTime' | 'late' | 'missed' | 'open' | 'upcoming';

export function bedtimeState(night: string, now: Date = new Date()): BedtimeState {
  const mark = bedtimeMark(night);
  if (mark) return mark.status === 'late' ? 'late' : 'onTime';
  if (nightDeadline(night) <= now) return 'missed';
  return atNight(night, EVENING_FROM, 0) <= now ? 'open' : 'upcoming';
}

/** A night can be marked from its evening on (and later, to correct it). */
export function canMarkNight(night: string, now: Date = new Date()): boolean {
  const task = getBedtimeTask();
  if (!task || task.archived || night < task.startDate) return false;
  return atNight(night, EVENING_FROM, 0) <= now;
}

export type SleepTiming = { ok: true; late: boolean; onTimeUntil: Date } | { ok: false; reason: 'future' | 'beforeEvening' };

export function sleepTiming(night: string, at: Date, now: Date = new Date()): SleepTiming {
  if (at > now) return { ok: false, reason: 'future' };
  if (at < atNight(night, EVENING_FROM, 0)) return { ok: false, reason: 'beforeEvening' };
  const { onTimeUntil } = bedtimeOf(night);
  return { ok: true, late: at > onTimeUntil, onTimeUntil };
}

function lateEntry(task: Task, night: string, note: string): Omit<Entry, 'createdAt' | 'updatedAt'> | null {
  const sinTypeId = deterministicId('sin:lateBedtime');
  const penalty = round(getDoc<SinType>(RecordTypes.sinType, sinTypeId)?.penalty ?? 1);
  if (penalty <= 0) return null;
  return {
    id: taskEntryId(task.id, night),
    kind: 'bedtime_late',
    date: night,
    taskId: task.id,
    sinTypeId,
    note,
    lines: [
      { account: fixedAccountId('akhira'), amount: -penalty },
      { account: fixedAccountId('thanb'), amount: penalty },
    ],
  };
}

/** Writes (or rewrites, or removes) the hisab entry of one night. */
async function settleNight(task: Task, night: string, now: Date): Promise<void> {
  const id = taskEntryId(task.id, night);
  const existing = getDoc<Entry>(RecordTypes.entry, id);
  const mark = bedtimeMark(night);

  let entry: Omit<Entry, 'createdAt' | 'updatedAt'> | null = null;
  if (mark?.status === 'late') {
    const reason = mark.reasonId ? getDoc<Reason>(RecordTypes.reason, mark.reasonId) : undefined;
    // Excused: nothing. A Thanb reason, or no reason ("I don't remember"): Late bedtime.
    if (!reason || reason.thanb) entry = lateEntry(task, night, mark.cause || i18n.t('bedtime.noReason'));
  } else if (mark) {
    entry = entryForDay(task, night);
  } else if (nightDeadline(night) <= now) {
    entry = lateEntry(task, night, i18n.t('bedtime.notMarked'));
  }

  if (!entry) {
    if (existing) await removeDoc(RecordTypes.entry, id);
    return;
  }
  const same =
    existing &&
    existing.kind === entry.kind &&
    existing.note === entry.note &&
    JSON.stringify(existing.lines) === JSON.stringify(entry.lines);
  if (!same) await putDoc<Entry>(RecordTypes.entry, entry);
}

async function writeMark(night: string, fields: Pick<TaskProgress, 'value' | 'status' | 'sleptAt' | 'reasonId' | 'cause'>) {
  const task = getBedtimeTask();
  if (!task) return;
  await putDoc<TaskProgress>(RecordTypes.progress, { id: progressId(task.id, night), taskId: task.id, date: night, ...fields });
  await settleNight(task, night, new Date());
}

/**
 * Marks the time the user went to sleep. Late needs a reason (a Reason id of
 * scope bedtime), unless `unknown` ("I don't remember": counted as a Thanb).
 */
export async function markBedtime(
  night: string,
  at: Date | null,
  options: { reasonId?: string; unknown?: boolean } = {},
): Promise<void> {
  if (options.unknown || !at) {
    await writeMark(night, { value: 1, status: 'late', cause: i18n.t('bedtime.dontRemember') });
    return;
  }
  const timing = sleepTiming(night, at);
  if (!timing.ok) throw new Error(timing.reason);
  if (!timing.late) {
    await writeMark(night, { value: 1, status: 'onTime', sleptAt: at.getTime() });
    return;
  }
  const reason = options.reasonId ? getDoc<Reason>(RecordTypes.reason, options.reasonId) : undefined;
  if (!reason) throw new Error('Sleeping late needs a reason');
  await writeMark(night, {
    value: 1,
    status: 'late',
    sleptAt: at.getTime(),
    reasonId: reason.id,
    cause: reasonLabel(reason),
  });
}

export async function unmarkBedtime(night: string): Promise<void> {
  await writeMark(night, { value: 0 });
}

/**
 * Counts every night whose deadline passed unmarked (and any marked but not
 * yet counted). Runs when the app opens and every minute while it is open.
 */
export async function settleBedtime(now: Date = new Date()): Promise<void> {
  const task = getBedtimeTask();
  if (!task || task.archived) return;
  const first = addDays(today(), -CATCH_UP_DAYS);
  for (const night of daysBetween(task.startDate > first ? task.startDate : first, addDays(today(), -1))) {
    if (getDoc<Entry>(RecordTypes.entry, taskEntryId(task.id, night))) continue;
    await settleNight(task, night, now);
  }
}
