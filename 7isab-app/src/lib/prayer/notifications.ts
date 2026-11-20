/**
 * Athan and reminder notifications. The next DAYS days are scheduled as exact
 * local notifications (nothing leaves the phone); they are rebuilt when the
 * app opens or a prayer setting changes. Our notifications all use ids that
 * start with PREFIX, so other notifications are never touched.
 *
 * Android: a channel's sound can't change once it exists, so each sound (and
 * alarm / notification volume) gets its own channel.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {
  AndroidAudioContentType,
  AndroidAudioUsage,
  AndroidImportance,
  AndroidNotificationPriority,
  AndroidNotificationVisibility,
} from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';
import { addDays, toDay, today } from '@/lib/dates';
import { nativeAlarm, nativeSound, type NativeRing } from '@/lib/alarms/native-alarm';
import { getDoc, getVaultMeta, setVaultMeta } from '@/lib/data/vault';
import { progressId } from '@/lib/ledger/tasks';
import { RecordTypes, type PrayerName, type TaskProgress } from '@/lib/ledger/types';

import {
  getPrayerSettings,
  prayerDeadline,
  prayerNameKey,
  PRAYERS,
  prayerTaskId,
  prayerTimes,
  type PrayerSettings,
  type PrayerSound,
} from './prayer';

const PREFIX = 'prayer:';
const DAYS = 10;
const META_KEY = 'prayer_schedule';
const REMINDER_CHANNEL = 'prayer-reminder';

/** Athan files bundled with the app (from assets/athan, see app.config.ts). */
export function athanSounds(): string[] {
  const sounds = (Constants.expoConfig?.extra as { athanSounds?: unknown } | undefined)?.athanSounds;
  return Array.isArray(sounds) ? sounds.filter((item): item is string => typeof item === 'string') : [];
}

/** A sound that still exists (a removed file falls back to the phone's sound). */
/**
 * Bundled sound files only exist in a real build; Expo Go doesn't have them
 * (a channel pointing at a missing file crashes on Android).
 */
const SOUND_FILES_BUNDLED = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export function usableSound(sound: PrayerSound): PrayerSound {
  if (sound === 'default' || sound === 'silent') return sound;
  return SOUND_FILES_BUNDLED && athanSounds().includes(sound) ? sound : 'default';
}

function soundFor(settings: PrayerSettings, prayer: PrayerName): PrayerSound {
  if (prayer === 'fajr' && settings.fajrSound !== 'same') return usableSound(settings.fajrSound);
  return usableSound(settings.sound);
}

function channelId(sound: PrayerSound, alarm: boolean): string {
  const name = sound.replace(/\.[a-z0-9]+$/, '');
  return `athan-${name}-${alarm ? 'alarm' : 'notify'}`;
}

const created = new Set<string>();

/** Android channel for a sound at alarm or notification volume (shared with user alarms). */
export async function ensureChannel(requested: PrayerSound, alarm: boolean): Promise<string> {
  const sound = usableSound(requested);
  const id = channelId(sound, alarm);
  if (Platform.OS !== 'android' || created.has(id)) return id;
  try {
    await createChannel(id, sound, alarm);
  } catch {
    // A channel that can't be made (e.g. a missing sound file): use the phone's default sound instead.
    if (sound === 'default') throw new Error('Notification channel unavailable');
    return ensureChannel('default', alarm);
  }
  created.add(id);
  return id;
}

async function createChannel(id: string, sound: PrayerSound, alarm: boolean): Promise<void> {
  await Notifications.setNotificationChannelAsync(id, {
    name: i18n.t('prayer.channelAthan', {
      sound: sound === 'default' || sound === 'silent' ? i18n.t(`prayer.sounds.${sound}`) : sound,
    }),
    importance: sound === 'silent' ? AndroidImportance.DEFAULT : AndroidImportance.MAX,
    sound: sound === 'silent' ? null : sound === 'default' ? 'default' : sound,
    audioAttributes: {
      usage: alarm ? AndroidAudioUsage.ALARM : AndroidAudioUsage.NOTIFICATION,
      contentType: AndroidAudioContentType.SONIFICATION,
      flags: { enforceAudibility: false, requestHardwareAudioVideoSynchronization: false },
    },
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
}

async function ensureReminderChannel(): Promise<string> {
  if (Platform.OS === 'android' && !created.has(REMINDER_CHANNEL)) {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: i18n.t('prayer.channelReminder'),
      importance: AndroidImportance.DEFAULT,
    });
    created.add(REMINDER_CHANNEL);
  }
  return REMINDER_CHANNEL;
}

/** Shows athan notifications while the app is open too. Call once at start. */
export function setupPrayerNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type NotificationAccess = { notifications: boolean; exactAlarms: boolean };

export async function getNotificationAccess(): Promise<NotificationAccess> {
  const permission = await Notifications.getPermissionsAsync();
  let exactAlarms = true;
  if (Platform.OS === 'android' && Platform.Version >= 31) {
    exactAlarms = (await Notifications.getExactAlarmPermissionsAsync()).granted;
  }
  return { notifications: permission.granted, exactAlarms };
}

/**
 * Asks for notification permission (and, on Android 12+, opens the exact
 * alarm setting so the athan comes on the minute). A channel must exist before
 * Android 13 shows the permission prompt.
 */
export async function requestNotificationAccess(): Promise<NotificationAccess> {
  await ensureReminderChannel();
  await Notifications.requestPermissionsAsync();
  const access = await getNotificationAccess();
  if (access.notifications && !access.exactAlarms) {
    // Opens the system setting; the promise may never resolve, so don't wait on it.
    void Notifications.requestExactAlarmPermissionsAsync().catch(() => undefined);
  }
  return access;
}

function signature(settings: PrayerSettings): string {
  const {
    location,
    method,
    madhab,
    adjust,
    athan,
    sound,
    fajrSound,
    reminder,
    alarmStream,
    tasks,
    deadline,
    checkIn,
    endingSoon,
  } = settings;
  return JSON.stringify([
    today(),
    i18n.language,
    location,
    method,
    madhab,
    adjust,
    athan,
    sound,
    fajrSound,
    reminder,
    alarmStream,
    tasks,
    deadline,
    checkIn,
    endingSoon,
    settings.athanScreen,
    athanSounds(),
  ]);
}

async function cancelOurs(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
}

function clock(date: Date): string {
  try {
    return new Intl.DateTimeFormat(`${i18n.language}-u-nu-latn`, { hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

const NATIVE_PREFIX = 'athan:';

/** The athan goes through the native alarm module (full-screen page) when it is in this build and turned on. */
function athanIsNative(settings: PrayerSettings, sound: PrayerSound): boolean {
  return !!nativeAlarm && settings.athanScreen && sound !== 'silent';
}

function athanRing(id: string, prayer: PrayerName, time: Date, sound: PrayerSound, city: string): NativeRing {
  return {
    id,
    time: time.getTime(),
    title: i18n.t('prayer.athanTitle', { prayer: i18n.t(`prayer.names.${prayerNameKey(prayer, toDay(time))}`) }),
    body: city
      ? i18n.t('prayer.athanBodyCity', { time: clock(time), city })
      : i18n.t('prayer.athanBody', { time: clock(time) }),
    sound: nativeSound(sound),
    loop: false,
    snoozeMinutes: 0,
    stopLabel: i18n.t('alarm.stop'),
    snoozeLabel: '',
  };
}

/** True when the prayer is already marked (prayed, late or combined) on that day. */
function isMarked(prayer: PrayerName, day: string): boolean {
  return (getDoc<TaskProgress>(RecordTypes.progress, progressId(prayerTaskId(prayer), day))?.value ?? 0) >= 1;
}

function nudgeIds(prayer: PrayerName, day: string): string[] {
  return [`${PREFIX}${day}:${prayer}:checkin`, `${PREFIX}${day}:${prayer}:ending`];
}

/**
 * For an unmarked prayer: "Did you pray it?" `checkIn` minutes after the
 * athan, and "It ends at …" `endingSoon` minutes before its safe time ends.
 */
async function scheduleNudges(settings: PrayerSettings, prayer: PrayerName, day: string, now: number): Promise<void> {
  if (!settings.tasks || isMarked(prayer, day)) return;
  const times = prayerTimes(settings, day);
  const deadline = prayerDeadline(settings, prayer, day);
  if (!times) return;
  const start = times[prayer].getTime();
  const end = deadline?.getTime() ?? null;
  const name = i18n.t(`prayer.names.${prayerNameKey(prayer, day)}`);
  const [checkInId, endingId] = nudgeIds(prayer, day);

  const checkInAt = start + settings.checkIn * 60_000;
  if (settings.checkIn > 0 && checkInAt > now && (end === null || checkInAt < end)) {
    await Notifications.scheduleNotificationAsync({
      identifier: checkInId,
      content: {
        title: i18n.t('prayer.checkInTitle', { prayer: name }),
        body: i18n.t('prayer.checkInBody'),
        data: { url: '/prayer' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: checkInAt,
        channelId: await ensureReminderChannel(),
      },
    });
  }

  const endingAt = end === null ? null : end - settings.endingSoon * 60_000;
  if (settings.endingSoon > 0 && endingAt !== null && end !== null && endingAt > now && endingAt > start) {
    await Notifications.scheduleNotificationAsync({
      identifier: endingId,
      content: {
        title: i18n.t('prayer.endingTitle', { prayer: name, time: clock(new Date(end)) }),
        body: i18n.t('prayer.endingBody'),
        data: { url: '/prayer' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: endingAt,
        channelId: await ensureReminderChannel(),
      },
    });
  }
}

/** After a prayer is marked or un-marked: drop its nudges, or put them back when it is unmarked again. */
export async function refreshPrayerNudges(prayer: PrayerName, day: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all(
    nudgeIds(prayer, day).map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)),
  );
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  await scheduleNudges(getPrayerSettings(), prayer, day, Date.now());
}

/**
 * Rebuilds the athan and reminder notifications for the next DAYS days.
 * Skips the work when nothing changed since the last run today, unless forced.
 */
export async function reschedulePrayers(force = false): Promise<void> {
  if (Platform.OS === 'web') return;
  const settings = getPrayerSettings();
  const access = await Notifications.getPermissionsAsync();
  if (!access.granted) return;

  const sig = signature(settings);
  if (!force && (await getVaultMeta(META_KEY)) === sig) return;

  await cancelOurs();
  nativeAlarm?.cancelPrefix(NATIVE_PREFIX);
  const nativeRings: NativeRing[] = [];
  if (settings.location) {
    const now = Date.now();
    const city = settings.location.city ?? '';
    const reminderChannel = settings.reminder > 0 ? await ensureReminderChannel() : null;

    for (let offset = 0; offset < DAYS; offset += 1) {
      const day = addDays(today(), offset);
      const times = prayerTimes(settings, day);
      if (!times) break;
      for (const prayer of PRAYERS) {
        await scheduleNudges(settings, prayer, day, now);
        if (!settings.athan[prayer]) continue;
        const time = times[prayer];
        const name = i18n.t(`prayer.names.${prayerNameKey(prayer, day)}`);

        const sound = soundFor(settings, prayer);
        if (time.getTime() > now && athanIsNative(settings, sound)) {
          // Full-screen athan over the lock screen, ringing even with the app closed.
          nativeRings.push(athanRing(`${NATIVE_PREFIX}${day}:${prayer}`, prayer, time, sound, city));
        } else if (time.getTime() > now) {
          const channel = await ensureChannel(sound, settings.alarmStream);
          await Notifications.scheduleNotificationAsync({
            identifier: `${PREFIX}${day}:${prayer}`,
            content: {
              title: i18n.t('prayer.athanTitle', { prayer: name }),
              body: city
                ? i18n.t('prayer.athanBodyCity', { time: clock(time), city })
                : i18n.t('prayer.athanBody', { time: clock(time) }),
              sound: sound === 'silent' ? false : sound === 'default' ? 'default' : sound,
              priority: AndroidNotificationPriority.MAX,
              data: { url: '/prayer' },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: time, channelId: channel },
          });
        }

        const remindAt = time.getTime() - settings.reminder * 60_000;
        if (reminderChannel && remindAt > now) {
          await Notifications.scheduleNotificationAsync({
            identifier: `${PREFIX}${day}:${prayer}:reminder`,
            content: {
              title: i18n.t('prayer.reminderTitle', { prayer: name, minutes: settings.reminder }),
              body: i18n.t('prayer.athanBody', { time: clock(time) }),
              data: { url: '/prayer' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: remindAt,
              channelId: reminderChannel,
            },
          });
        }
      }
    }
  }
  if (nativeRings.length) nativeAlarm?.schedule(nativeRings);
  await setVaultMeta(META_KEY, sig);
}

/** Plays the chosen athan in a few seconds, to try the sound and volume. */
export async function testAthan(prayer: PrayerName = 'dhuhr'): Promise<void> {
  const settings = getPrayerSettings();
  const sound = soundFor(settings, prayer);
  if (athanIsNative(settings, sound)) {
    // Shows the full-screen page right away (lock the phone first to see it over the lock screen).
    nativeAlarm?.ringNow({
      ...athanRing(`${NATIVE_PREFIX}test`, prayer, new Date(), sound, ''),
      body: i18n.t('prayer.testBody'),
    });
    return;
  }
  const channel = await ensureChannel(sound, settings.alarmStream);
  await Notifications.scheduleNotificationAsync({
    identifier: `${PREFIX}test`,
    content: {
      title: i18n.t('prayer.athanTitle', { prayer: i18n.t(`prayer.names.${prayer}`) }),
      body: i18n.t('prayer.testBody'),
      sound: sound === 'silent' ? false : sound === 'default' ? 'default' : sound,
      priority: AndroidNotificationPriority.MAX,
      data: { url: '/prayer' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: Date.now() + 5000, channelId: channel },
  });
}
