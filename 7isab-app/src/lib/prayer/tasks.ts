/**
 * The five daily prayer tasks in the hisab. Fixed ids (HMAC of the prayer),
 * so two devices never create them twice. Reward and penalty start at 1 like
 * every other rate; the user can change them in the task editor.
 *
 * Unlike other tasks (counted the next day), each prayer is counted at its
 * own deadline, and can be corrected later (the entry is rewritten).
 */
import i18n from '@/i18n';

import { addDays, daysBetween, fromDay, today } from '@/lib/dates';
import { deterministicId, getDoc, putDoc, removeDoc } from '@/lib/data/vault';
import { fixedAccountId, round } from '@/lib/ledger/ledger';
import { reasonLabel } from '@/lib/ledger/reasons';
import { entryForDay, progressId, taskEntryId } from '@/lib/ledger/tasks';
import {
  RecordTypes,
  type Entry,
  type Khushoo,
  type PrayerName,
  type PrayerPlace,
  type Reason,
  type SinType,
  type Task,
  type TaskProgress,
} from '@/lib/ledger/types';

import { refreshPrayerNudges } from './notifications';
import { getPrayerSettings, isJumuah, prayerDeadline, PRAYERS, prayerTaskId, prayerTimes } from './prayer';

export { prayerTaskId };

export function getPrayerTask(prayer: PrayerName): Task | undefined {
  return getDoc<Task>(RecordTypes.task, prayerTaskId(prayer));
}

/** Creates the prayer tasks when they're turned on (and un-archives them); archives them when turned off. */
export async function syncPrayerTasks(): Promise<void> {
  const enabled = getPrayerSettings().tasks;
  for (const prayer of PRAYERS) {
    const existing = getPrayerTask(prayer);
    if (enabled && !existing) {
      await putDoc<Task>(RecordTypes.task, {
        id: prayerTaskId(prayer),
        title: i18n.t(`prayer.names.${prayer}`),
        kind: 'prayer',
        prayer,
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
}

/** The prayer can be combined (jam') with this one: Dhuhr ↔ Asr, Maghrib ↔ Isha. Never Fajr. */
export const COMBINE_PAIRS: Partial<Record<PrayerName, PrayerName>> = {
  dhuhr: 'asr',
  asr: 'dhuhr',
  maghrib: 'isha',
  isha: 'maghrib',
};

/** The prayer it can be combined with on `day`: none on Friday for Dhuhr / Asr (Jumu'ah is never combined). */
export function combinePair(prayer: PrayerName, day: string): PrayerName | undefined {
  const pair = COMBINE_PAIRS[prayer];
  if (!pair) return undefined;
  return isJumuah(prayer, day) || isJumuah(pair, day) ? undefined : pair;
}

/** How a prayer was marked on a day (null when not marked). */
export function prayerMark(prayer: PrayerName, day: string): TaskProgress | null {
  const task = getPrayerTask(prayer);
  if (!task) return null;
  const progress = getDoc<TaskProgress>(RecordTypes.progress, progressId(task.id, day));
  return progress && progress.value >= 1 ? progress : null;
}

export function isPrayed(prayer: PrayerName, day: string): boolean {
  return prayerMark(prayer, day) !== null;
}

/**
 * prayed / combined: marked in its time (or with its pair). late: prayed after
 * its time (qada). missed: not marked and its deadline has passed. open: its
 * time has started and it can still be prayed. upcoming: not time yet.
 */
export type PrayerState = 'prayed' | 'combined' | 'late' | 'missed' | 'open' | 'upcoming';

export function prayerState(prayer: PrayerName, day: string, now: Date = new Date()): PrayerState {
  const mark = prayerMark(prayer, day);
  if (mark) return mark.status === 'late' ? 'late' : mark.status === 'combined' ? 'combined' : 'prayed';
  const settings = getPrayerSettings();
  const deadline = prayerDeadline(settings, prayer, day);
  if (deadline && deadline <= now) return 'missed';
  const start = prayerTimes(settings, day)?.[prayer];
  return start && start <= now ? 'open' : 'upcoming';
}

function started(prayer: PrayerName, day: string, now: Date): boolean {
  const start = prayerTimes(getPrayerSettings(), day)?.[prayer];
  return !!start && start <= now;
}

/**
 * A prayer can be marked once its time has started (also on past days, to
 * correct them). Asr / Isha can also be marked early, combined with Dhuhr /
 * Maghrib (jam' taqdim), once the first prayer's time has started.
 */
export function canMarkPrayer(prayer: PrayerName, day: string, now: Date = new Date()): boolean {
  const task = getPrayerTask(prayer);
  if (!task || task.archived || day < task.startDate) return false;
  const pair = combinePair(prayer, day);
  return started(prayer, day, now) || (!!pair && started(pair, day, now));
}

/** Its deadline has passed: marking it now is either "prayed late" or a correction. */
export function isPastDeadline(prayer: PrayerName, day: string, now: Date = new Date()): boolean {
  const deadline = prayerDeadline(getPrayerSettings(), prayer, day);
  return !!deadline && deadline <= now;
}

/** The Thanb entry for a missed / late prayer, from its sin type's penalty (null when the penalty is 0). */
function thanbEntry(
  task: Task,
  day: string,
  kind: 'prayer_missed' | 'prayer_late',
  cause?: string,
): Omit<Entry, 'createdAt' | 'updatedAt'> | null {
  const sinTypeId = deterministicId(`sin:${kind === 'prayer_missed' ? 'missedPrayer' : 'latePrayer'}`);
  const penalty = round(getDoc<SinType>(RecordTypes.sinType, sinTypeId)?.penalty ?? 1);
  if (penalty <= 0) return null;
  return {
    id: taskEntryId(task.id, day),
    kind,
    date: day,
    taskId: task.id,
    sinTypeId,
    note: cause || undefined,
    lines: [
      { account: fixedAccountId('akhira'), amount: -penalty },
      { account: fixedAccountId('thanb'), amount: penalty },
    ],
  };
}

/**
 * Writes the hisab entry of one prayer on one day: the task's reward when
 * prayed on time or combined; the "late prayer" penalty when prayed late; the
 * "missed prayer" penalty once its deadline passes unmarked; nothing while
 * it is still open. The entry id is fixed (task + day), so a correction
 * replaces the earlier entry instead of adding a second one.
 */
async function settlePrayerDay(task: Task, prayer: PrayerName, day: string, now: Date): Promise<void> {
  const id = taskEntryId(task.id, day);
  const existing = getDoc<Entry>(RecordTypes.entry, id);
  const mark = prayerMark(prayer, day);

  let entry: Omit<Entry, 'createdAt' | 'updatedAt'> | null = null;
  if (mark?.status === 'late') entry = thanbEntry(task, day, 'prayer_late', mark.cause);
  else if (mark) {
    const done = entryForDay(task, day);
    entry = done ? { ...done, note: mark.cause || undefined } : null;
  } else if (isPastDeadline(prayer, day, now)) entry = thanbEntry(task, day, 'prayer_missed');

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

/** How it was prayed, beyond the time: khushoo and place (with the reason when at home). */
export type PrayerQuality = {
  khushoo?: Khushoo;
  place?: PrayerPlace;
  /** A Reason id (scope homePrayer); required when place is home. */
  placeReasonId?: string;
};

type MarkFields = Pick<
  TaskProgress,
  'value' | 'status' | 'cause' | 'combinedWith' | 'prayedAt' | 'khushoo' | 'place' | 'placeReasonId' | 'placeReason'
>;

function qualityFields(quality: PrayerQuality): Partial<MarkFields> {
  const reason =
    quality.place === 'home' && quality.placeReasonId
      ? getDoc<Reason>(RecordTypes.reason, quality.placeReasonId)
      : undefined;
  if (quality.place === 'home' && !reason) throw new Error('A prayer at home needs a reason');
  return {
    khushoo: quality.khushoo,
    place: quality.place,
    placeReasonId: reason?.id,
    placeReason: reason ? reasonLabel(reason) : undefined,
  };
}

/** A Thanb entry from a sin type (null when its penalty is 0). Not linked to the task, so it reads as that sin. */
function sinEntry(
  id: string,
  day: string,
  preset: 'weakKhushoo' | 'homePrayer' | 'missedJumuah',
  note: string,
): Omit<Entry, 'createdAt' | 'updatedAt'> | null {
  const sinTypeId = deterministicId(`sin:${preset}`);
  const penalty = round(getDoc<SinType>(RecordTypes.sinType, sinTypeId)?.penalty ?? 1);
  if (penalty <= 0) return null;
  return {
    id,
    kind: 'sin',
    date: day,
    sinTypeId,
    note,
    lines: [
      { account: fixedAccountId('akhira'), amount: -penalty },
      { account: fixedAccountId('thanb'), amount: penalty },
    ],
  };
}

async function writeEntry(id: string, entry: Omit<Entry, 'createdAt' | 'updatedAt'> | null): Promise<void> {
  const existing = getDoc<Entry>(RecordTypes.entry, id);
  if (!entry) {
    if (existing) await removeDoc(RecordTypes.entry, id);
    return;
  }
  const same =
    existing &&
    existing.sinTypeId === entry.sinTypeId &&
    existing.note === entry.note &&
    JSON.stringify(existing.lines) === JSON.stringify(entry.lines);
  if (!same) await putDoc<Entry>(RecordTypes.entry, entry);
}

/**
 * The Thanb entries of how a prayer was prayed, each with a fixed id so a
 * correction rewrites it: weak khushoo; prayed at home (always for Jumu'ah;
 * for the others when "always Thanb" is on or the reason counts as Thanb).
 */
async function settlePrayerQuality(task: Task, prayer: PrayerName, day: string): Promise<void> {
  const mark = prayerMark(prayer, day);
  const name = i18n.t(`prayer.names.${isJumuah(prayer, day) ? 'jumuah' : prayer}`);

  const khushooId = deterministicId(`prayer-khushoo:${task.id}:${day}`);
  await writeEntry(khushooId, mark?.khushoo === 'weak' ? sinEntry(khushooId, day, 'weakKhushoo', name) : null);

  const placeId = deterministicId(`prayer-place:${task.id}:${day}`);
  let place: Omit<Entry, 'createdAt' | 'updatedAt'> | null = null;
  if (mark?.place === 'home') {
    const note = mark.placeReason ? `${name} · ${mark.placeReason}` : name;
    if (isJumuah(prayer, day)) place = sinEntry(placeId, day, 'missedJumuah', note);
    else {
      const reason = mark.placeReasonId ? getDoc<Reason>(RecordTypes.reason, mark.placeReasonId) : undefined;
      if (getPrayerSettings().homeAlwaysThanb || (reason?.thanb ?? true)) place = sinEntry(placeId, day, 'homePrayer', note);
    }
  }
  await writeEntry(placeId, place);
}

async function writeMark(prayer: PrayerName, day: string, mark: MarkFields) {
  const task = getPrayerTask(prayer);
  if (!task) return;
  await putDoc<TaskProgress>(RecordTypes.progress, {
    id: progressId(task.id, day),
    taskId: task.id,
    date: day,
    ...mark,
  });
  await settlePrayerDay(task, prayer, day, new Date());
  await settlePrayerQuality(task, prayer, day);
  // Marked: no more "did you pray?" nudges; un-marked: they come back.
  await refreshPrayerNudges(prayer, day).catch(() => undefined);
}

/**
 * The moment "hour:minute" on a prayer's day. Isha prayed after midnight
 * (an hour before Maghrib's) belongs to the next calendar day.
 */
export function prayedAtFor(prayer: PrayerName, day: string, hour: number, minute: number): Date {
  const at = fromDay(day);
  at.setHours(hour, minute, 0, 0);
  const maghrib = prayerTimes(getPrayerSettings(), day)?.maghrib;
  if (prayer === 'isha' && maghrib && hour < maghrib.getHours() - 6) at.setDate(at.getDate() + 1);
  return at;
}

export type PrayerTiming =
  { ok: true; status: 'onTime' | 'late'; safeUntil: Date | null } | { ok: false; reason: 'beforeTime' | 'future' };

/**
 * On time if prayed before the prayer's safe time ends (its deadline), else
 * late. Not valid before its time starts (except combined early) or in the future.
 */
export function prayerTiming(prayer: PrayerName, day: string, at: Date, now: Date = new Date()): PrayerTiming {
  const settings = getPrayerSettings();
  if (at > now) return { ok: false, reason: 'future' };
  const start = prayerTimes(settings, day)?.[prayer];
  if (start && at < start) return { ok: false, reason: 'beforeTime' };
  const safeUntil = prayerDeadline(settings, prayer, day);
  return { ok: true, status: safeUntil && at > safeUntil ? 'late' : 'onTime', safeUntil };
}

/**
 * Combining is valid from the first prayer's time (Dhuhr / Maghrib) and not in
 * the future; it is on time until the later prayer's safe time ends, else late.
 */
export function combineTiming(prayer: PrayerName, day: string, at: Date, now: Date = new Date()): PrayerTiming {
  if (at > now) return { ok: false, reason: 'future' };
  const settings = getPrayerSettings();
  const first = prayer === 'asr' ? 'dhuhr' : prayer === 'isha' ? 'maghrib' : prayer;
  const last = prayer === 'dhuhr' ? 'asr' : prayer === 'maghrib' ? 'isha' : prayer;
  const start = prayerTimes(settings, day)?.[first];
  if (start && at < start) return { ok: false, reason: 'beforeTime' };
  // On time while the later prayer's safe time lasts (Asr for Dhuhr + Asr, Isha for Maghrib + Isha).
  const safeUntil = prayerDeadline(settings, last, day);
  return { ok: true, status: safeUntil && at > safeUntil ? 'late' : 'onTime', safeUntil };
}

/**
 * Marks a prayer prayed at `at` (today, or a correction for an earlier day).
 * The status comes from the time: on time before its safe time ends, else
 * late (a cause is required). `combine` marks it and its pair together
 * (jam': Dhuhr ↔ Asr, Maghrib ↔ Isha), judged by the later prayer's safe time.
 */
export async function markPrayer(
  prayer: PrayerName,
  day: string,
  at: Date,
  options: {
    cause?: string;
    combine?: boolean;
    /** Khushoo and place of this prayer (the place is shared when combined). */
    quality?: PrayerQuality;
    /** Combined: the pair's own khushoo. */
    pairKhushoo?: Khushoo;
  } = {},
): Promise<void> {
  const text = options.cause?.trim() || undefined;
  const prayedAt = at.getTime();
  const quality = qualityFields(options.quality ?? {});
  if (options.combine) {
    const pair = combinePair(prayer, day);
    if (!pair) throw new Error('This prayer cannot be combined');
    const timing = combineTiming(prayer, day, at);
    if (!timing.ok) throw new Error(timing.reason);
    if (timing.status === 'late' && !text) throw new Error('A late prayer needs a cause');
    // Late combined: both are late (Thanb each), still linked as a pair.
    const status = timing.status === 'late' ? 'late' : 'combined';
    await writeMark(prayer, day, { value: 1, status, cause: text, combinedWith: pair, prayedAt, ...quality });
    await writeMark(pair, day, {
      value: 1,
      status,
      cause: text,
      combinedWith: prayer,
      prayedAt,
      ...quality,
      khushoo: options.pairKhushoo,
    });
    return;
  }
  const timing = prayerTiming(prayer, day, at);
  if (!timing.ok) throw new Error(timing.reason);
  if (timing.status === 'late' && !text) throw new Error('A late prayer needs a cause');
  await writeMark(prayer, day, { value: 1, status: timing.status, cause: text, prayedAt, ...quality });
}

/**
 * Corrects the khushoo and place of a prayer already marked (its time and
 * status stay). The place is shared by a combined pair, so it changes on both.
 */
export async function setPrayerQuality(prayer: PrayerName, day: string, quality: PrayerQuality): Promise<void> {
  const mark = prayerMark(prayer, day);
  if (!mark) throw new Error('The prayer is not marked');
  const fields = qualityFields(quality);
  const { id: _id, taskId: _t, date: _d, createdAt: _c, updatedAt: _u, ...rest } = mark;
  await writeMark(prayer, day, { ...rest, ...fields });
  const pair = mark.combinedWith;
  const pairMark = pair ? prayerMark(pair, day) : null;
  if (pair && pairMark?.combinedWith === prayer) {
    const { id: _pi, taskId: _pt, date: _pd, createdAt: _pc, updatedAt: _pu, ...pairRest } = pairMark;
    await writeMark(pair, day, {
      ...pairRest,
      place: fields.place,
      placeReasonId: fields.placeReasonId,
      placeReason: fields.placeReason,
    });
  }
}

/** Removes the mark (and its pair's, when they were combined). */
export async function unmarkPrayer(prayer: PrayerName, day: string): Promise<void> {
  const mark = prayerMark(prayer, day);
  await writeMark(prayer, day, { value: 0 });
  if (mark?.combinedWith && prayerMark(mark.combinedWith, day)?.combinedWith === prayer) {
    await writeMark(mark.combinedWith, day, { value: 0 });
  }
}

const CATCH_UP_DAYS = 14;

/**
 * Counts every prayer whose deadline passed without a mark (and any that are
 * marked but not yet counted). Runs when the app opens and every minute while
 * it is open; catches up the last CATCH_UP_DAYS days.
 */
export async function settlePrayers(now: Date = new Date()): Promise<void> {
  const settings = getPrayerSettings();
  if (!settings.tasks || !settings.location) return;
  const first = addDays(today(), -CATCH_UP_DAYS);
  for (const prayer of PRAYERS) {
    const task = getPrayerTask(prayer);
    if (!task || task.archived) continue;
    for (const day of daysBetween(task.startDate > first ? task.startDate : first, today())) {
      if (getDoc<Entry>(RecordTypes.entry, taskEntryId(task.id, day))) continue;
      await settlePrayerDay(task, prayer, day, now);
    }
  }
}
