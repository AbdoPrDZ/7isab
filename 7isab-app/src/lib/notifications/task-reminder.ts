/**
 * Daily reminder of the tasks not done yet, at the user's time (Settings).
 * The next REMINDER_DAYS days are scheduled; today's text and whether it is
 * needed at all follow the progress, so it is rebuilt (debounced) whenever
 * local data changes. Prayer tasks have their own nudges and are left out.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';
import { addDays, fromDay, today } from '@/lib/dates';
import { getDocs, onLocalChange } from '@/lib/data/vault';
import { getSettings } from '@/lib/ledger/ledger';
import { getProgressValue, isDue, progressRatio } from '@/lib/ledger/tasks';
import { RecordTypes, type Task } from '@/lib/ledger/types';

const PREFIX = 'task-reminder:';
const CHANNEL = 'task-reminder';
const REMINDER_DAYS = 7;

/** Tasks still to do on `day` (due that day, or a period task not yet complete). */
function openTasks(day: string): Task[] {
  return getDocs<Task>(RecordTypes.task).filter((task) => {
    if (task.kind === 'prayer' || task.kind === 'bedtime' || !isDue(task, day)) return false;
    return progressRatio(task, getProgressValue(task, day)) < 1;
  });
}

export async function rescheduleTaskReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );

  let time: { hour: number; minute: number } | null | undefined;
  try {
    time = getSettings().taskReminder;
  } catch {
    return; // settings not ready yet
  }
  if (!time) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: i18n.t('notify.taskChannel'),
      importance: AndroidImportance.DEFAULT,
    });
  }

  const now = Date.now();
  for (let offset = 0; offset < REMINDER_DAYS; offset += 1) {
    const day = addDays(today(), offset);
    const at = fromDay(day);
    at.setHours(time.hour, time.minute, 0, 0);
    if (at.getTime() <= now) continue;
    const tasks = openTasks(day);
    if (!tasks.length) continue;
    const separator = i18n.language === 'ar' ? '، ' : ', ';
    const names = tasks
      .slice(0, 3)
      .map((task) => task.title)
      .join(separator);
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${day}`,
      content: {
        title: i18n.t('notify.taskTitle', { count: tasks.length }),
        body: tasks.length > 3 ? i18n.t('notify.taskBodyMore', { names, more: tasks.length - 3 }) : names,
        data: { url: '/' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Keeps the reminder up to date while the vault is open (a few seconds after each change). */
export function watchTaskReminder(): () => void {
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void rescheduleTaskReminder().catch(() => undefined), 3000);
  };
  schedule();
  const stop = onLocalChange(schedule);
  return () => {
    stop();
    if (timer) clearTimeout(timer);
  };
}
