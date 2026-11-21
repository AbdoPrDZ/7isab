/**
 * User alarms: at a clock time, or relative to a prayer (e.g. 30 min before
 * Fajr), once or on chosen weekdays. Stored in the encrypted vault like all
 * user data; the next ALARM_DAYS days are scheduled as Android "alarm clock"
 * notifications (exact, not delayed by battery saving, alarm volume).
 *
 * With the HisabAlarm native module (Android build): a full-screen page over
 * the lock screen, the sound looping until Stop, and Snooze = `ringAgain`.
 * Without it (Expo Go): a notification plays its sound once, so the alarm
 * rings again by itself every `ringAgain` minutes, up to RING_AGAIN_TIMES more
 * times, until it is tapped or stopped; it can't be swiped away.
 */
import * as Notifications from 'expo-notifications';
import { AndroidNotificationPriority } from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';
import { addDays, fromDay, today, toDay, weekday } from '@/lib/dates';
import { deterministicId, getDoc, getDocs, getVaultMeta, newId, onLocalChange, putDoc, removeDoc, setVaultMeta, useDocs, type Doc } from '@/lib/data/vault';
import { getProgressValue, isDue, progressRatio } from '@/lib/ledger/tasks';
import { RecordTypes, type PrayerName, type Task } from '@/lib/ledger/types';
import { nativeAlarm, nativeSound, type NativeRing } from '@/lib/alarms/native-alarm';
import { ensureChannel, usableSound } from '@/lib/prayer/notifications';
import { getPrayerSettings, prayerTimes, type PrayerSettings } from '@/lib/prayer/prayer';

const PREFIX = 'alarm:';
const CATEGORY = 'alarm';
const ALARM_DAYS = 7;
export const RING_AGAIN_TIMES = 3;
const META_KEY = 'alarm_schedule';

export type AlarmTime =
  | { kind: 'clock'; hour: number; minute: number }
  /** Minutes from a prayer (or sunrise): negative = before. */
  | { kind: 'prayer'; prayer: PrayerName | 'sunrise'; offset: number };

export type Alarm = Doc & {
  label: string;
  enabled: boolean;
  time: AlarmTime;
  /** Weekdays it repeats on (0 = Sunday); empty = once, on `onceDate`. */
  days: number[];
  onceDate: string | null;
  /** 'default' = phone sound, else a bundled sound file. */
  sound: string;
  /** Minutes between rings until stopped; 0 = ring once. */
  ringAgain: number;
  /** Bound to a task: rings only on days the task is due and not done yet. */
  taskId?: string;
};

/**
 * A one-time alarm rings today or tomorrow (recomputed on every save, so re-enabling
 * an old one works), unless `onDay` gives its day (e.g. an event reminder).
 */
export type AlarmInput = Omit<Alarm, 'id' | 'createdAt' | 'updatedAt' | 'onceDate'> & { id?: string; onDay?: string };

export function useAlarms(): Alarm[] {
  return useDocs<Alarm>(RecordTypes.alarm);
}

/** When the alarm rings on `day`, or null (no location for a prayer alarm). */
export function occurrenceOn(time: AlarmTime, day: string, settings: PrayerSettings): Date | null {
  if (time.kind === 'clock') {
    const date = fromDay(day);
    date.setHours(time.hour, time.minute, 0, 0);
    return date;
  }
  const times = prayerTimes(settings, day);
  if (!times) return null;
  return new Date(times[time.prayer].getTime() + time.offset * 60_000);
}

function ringsOn(alarm: Pick<Alarm, 'days' | 'onceDate' | 'taskId'>, day: string): boolean {
  if (alarm.taskId) {
    const task = getDoc<Task>(RecordTypes.task, alarm.taskId);
    return !!task && !task.archived && isDue(task, day) && progressRatio(task, getProgressValue(task, day)) < 1;
  }
  return alarm.days.length ? alarm.days.includes(weekday(day)) : alarm.onceDate === day;
}

/** The next time the alarm rings after `from`, looking a week ahead. */
export function nextRing(
  alarm: Pick<Alarm, 'days' | 'onceDate' | 'time' | 'enabled' | 'taskId'>,
  settings: PrayerSettings = getPrayerSettings(),
  from: Date = new Date(),
): Date | null {
  if (!alarm.enabled) return null;
  const start = toDay(from);
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = addDays(start, offset);
    if (!ringsOn(alarm, day)) continue;
    const at = occurrenceOn(alarm.time, day, settings);
    if (at && at > from) return at;
  }
  return null;
}

/** For a one-time alarm: today if its time is still ahead, else tomorrow. */
function onceDateFor(time: AlarmTime): string {
  const now = new Date();
  const at = occurrenceOn(time, today(), getPrayerSettings());
  return at && at > now ? today() : addDays(today(), 1);
}

export async function saveAlarm({ onDay, ...input }: AlarmInput): Promise<Alarm> {
  const alarm = await putDoc<Alarm>(RecordTypes.alarm, {
    ...input,
    id: input.id ?? newId(),
    onceDate: input.days.length ? null : (onDay ?? onceDateFor(input.time)),
  });
  // Saved even if scheduling fails (no permission yet, …); it is retried when the app opens.
  await rescheduleAlarms(true).catch(() => undefined);
  return alarm;
}

export async function setAlarmEnabled(alarm: Alarm, enabled: boolean): Promise<void> {
  const { createdAt: _c, updatedAt: _u, ...rest } = alarm;
  await saveAlarm({ ...rest, enabled });
}

export async function deleteAlarm(alarm: Alarm): Promise<void> {
  await removeDoc(RecordTypes.alarm, alarm.id);
  await rescheduleAlarms(true).catch(() => undefined);
}

/** Registers the Stop button. Call once at start. */
export async function setupAlarmCategory(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: 'stop', buttonTitle: i18n.t('alarm.stop'), options: { opensAppToForeground: true } },
  ]);
}

function clock(date: Date): string {
  try {
    return new Intl.DateTimeFormat(`${i18n.language}-u-nu-latn`, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

/** Rebuilds the alarm notifications for the next ALARM_DAYS days (skipped when nothing changed today). */
export async function rescheduleAlarms(force = false): Promise<void> {
  if (Platform.OS === 'web') return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  const settings = getPrayerSettings();
  const alarms = getDocs<Alarm>(RecordTypes.alarm);
  const signature = JSON.stringify([
    today(),
    i18n.language,
    settings.location,
    settings.method,
    settings.madhab,
    settings.adjust,
    alarms.map((alarm) => [alarm.id, alarm.updatedAt]),
    // Task alarms follow the task's progress: which of the next days still ring.
    alarms
      .filter((alarm) => alarm.taskId)
      .map((alarm) => Array.from({ length: ALARM_DAYS }, (_, offset) => (ringsOn(alarm, addDays(today(), offset)) ? 1 : 0)).join('')),
  ]);
  if (!force && (await getVaultMeta(META_KEY)) === signature) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );

  const now = new Date();
  nativeAlarm?.cancelPrefix(PREFIX);
  const nativeRings: NativeRing[] = [];
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const channel = nativeAlarm ? null : await ensureChannel(usableSound(alarm.sound), true);
    let future = false;
    for (let offset = 0; offset < ALARM_DAYS; offset += 1) {
      const day = addDays(today(), offset);
      if (!ringsOn(alarm, day)) continue;
      const at = occurrenceOn(alarm.time, day, settings);
      if (!at) continue;
      if (nativeAlarm) {
        // Native: one ring that loops until Stop, with Snooze (the "ring again" minutes).
        if (at.getTime() > now.getTime()) {
          future = true;
          nativeRings.push({
            id: `${PREFIX}${alarm.id}:${day}`,
            time: at.getTime(),
            title: alarm.label || i18n.t('alarm.title'),
            body: clock(at),
            sound: nativeSound(usableSound(alarm.sound)),
            loop: true,
            snoozeMinutes: alarm.ringAgain,
            stopLabel: i18n.t('alarm.stop'),
            snoozeLabel: i18n.t('alarm.snooze', { minutes: alarm.ringAgain }),
          });
        }
        continue;
      }
      const rings = alarm.ringAgain > 0 ? RING_AGAIN_TIMES + 1 : 1;
      for (let ring = 0; ring < rings; ring += 1) {
        const when = new Date(at.getTime() + ring * alarm.ringAgain * 60_000);
        if (when <= now) continue;
        future = true;
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${alarm.id}:${day}:${ring}`,
          content: {
            title: alarm.label || i18n.t('alarm.title'),
            body: i18n.t('alarm.body', { time: clock(at) }),
            categoryIdentifier: CATEGORY,
            sticky: true,
            priority: AndroidNotificationPriority.MAX,
            data: { alarm: alarm.id, day },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
            channelId: channel ?? undefined,
            delivery: 'alarmClock',
          },
        });
      }
    }
    // A one-time alarm whose time has passed turns itself off.
    if (!alarm.days.length && !future && alarm.onceDate && alarm.onceDate <= today()) {
      const { createdAt: _c, updatedAt: _u, ...rest } = alarm;
      await putDoc<Alarm>(RecordTypes.alarm, { ...rest, enabled: false });
    }
  }
  if (nativeRings.length) nativeAlarm?.schedule(nativeRings);
  await setVaultMeta(META_KEY, signature);
}

/**
 * The user tapped an alarm or its Stop button: stop the rest of that
 * occurrence (scheduled repeats and the ones already showing).
 * Returns false when the notification isn't an alarm.
 */
export async function stopAlarm(identifier: string): Promise<boolean> {
  if (!identifier.startsWith(PREFIX)) return false;
  const [, alarmId, day] = identifier.split(':');
  const occurrence = `${PREFIX}${alarmId}:${day}:`;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(occurrence))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
  const presented = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(
    presented
      .filter((item) => item.request.identifier.startsWith(occurrence))
      .map((item) => Notifications.dismissNotificationAsync(item.request.identifier)),
  );
  return true;
}

// ---- Task alarms ---------------------------------------------------------------------

/** Fixed id of a task's alarm (one per task). */
export function taskAlarmId(taskId: string): string {
  return deterministicId(`task-alarm:${taskId}`);
}

export function getTaskAlarm(taskId: string): Alarm | undefined {
  return getDoc<Alarm>(RecordTypes.alarm, taskAlarmId(taskId));
}

/**
 * Sets (or with `time` null, removes) a task's alarm. It repeats every day,
 * and `ringsOn` keeps only the days the task is due and not yet done.
 */
export async function saveTaskAlarm(
  task: Pick<Task, 'id' | 'title'>,
  time: AlarmTime | null,
  options: { sound?: string; ringAgain?: number } = {},
): Promise<void> {
  const existing = getTaskAlarm(task.id);
  if (!time) {
    if (existing) await deleteAlarm(existing);
    return;
  }
  await saveAlarm({
    id: taskAlarmId(task.id),
    label: task.title,
    enabled: true,
    time,
    days: [0, 1, 2, 3, 4, 5, 6],
    sound: options.sound ?? existing?.sound ?? 'default',
    ringAgain: options.ringAgain ?? existing?.ringAgain ?? 5,
    taskId: task.id,
  });
}

let alarmTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Keeps task alarms in step with progress while the vault is open: a few
 * seconds after any change, alarms are rescheduled (a no-op unless something
 * they depend on changed, e.g. a task was just done).
 */
export function watchAlarms(): () => void {
  const schedule = () => {
    if (alarmTimer) clearTimeout(alarmTimer);
    alarmTimer = setTimeout(() => void rescheduleAlarms().catch(() => undefined), 3000);
  };
  const stop = onLocalChange(schedule);
  return () => {
    stop();
    if (alarmTimer) clearTimeout(alarmTimer);
  };
}
