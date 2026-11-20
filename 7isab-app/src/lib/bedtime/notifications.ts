/**
 * "Going to sleep?" at bedtime for the next NIGHTS nights, skipped for nights
 * already marked. Rebuilt (debounced) whenever local data changes, so marking
 * a night or changing the bedtime takes effect without reopening the app.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';
import { addDays, today } from '@/lib/dates';
import { onLocalChange } from '@/lib/data/vault';

import { bedtimeMark, bedtimeOf, getBedtimeSettings, getBedtimeTask } from './bedtime';

const PREFIX = 'bedtime:';
const CHANNEL = 'bedtime';
const NIGHTS = 7;

export async function rescheduleBedtime(): Promise<void> {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );

  const settings = getBedtimeSettings();
  const task = getBedtimeTask();
  if (!settings.enabled || !task || task.archived) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: i18n.t('bedtime.channel'),
      importance: AndroidImportance.HIGH,
    });
  }

  const now = Date.now();
  for (let offset = -1; offset < NIGHTS; offset += 1) {
    const night = addDays(today(), offset);
    const { at } = bedtimeOf(night, settings);
    if (at.getTime() <= now || bedtimeMark(night)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${night}`,
      content: {
        title: i18n.t('bedtime.notifyTitle'),
        body: i18n.t('bedtime.notifyBody'),
        data: { url: '/' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Keeps the bedtime notifications up to date while the vault is open. */
export function watchBedtime(): () => void {
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void rescheduleBedtime().catch(() => undefined), 3000);
  };
  schedule();
  const stop = onLocalChange(schedule);
  return () => {
    stop();
    if (timer) clearTimeout(timer);
  };
}
