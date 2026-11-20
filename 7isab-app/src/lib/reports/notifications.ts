/**
 * Report notifications at the report time (Settings → Reports), on the last
 * day of each period: every day for the day report, Friday for the week
 * (Saturday → Friday), the month's last day, 31 December for the year. The
 * next DAYS days are scheduled; rebuilt (debounced) when local data changes.
 * Tapping one opens that report.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';
import { addDays, fromDay, today } from '@/lib/dates';
import { onLocalChange } from '@/lib/data/vault';

import { getReportSettings, REPORT_PERIODS, reportRange } from './reports';

const PREFIX = 'report:';
const CHANNEL = 'reports';
const DAYS = 8;

export async function rescheduleReports(): Promise<void> {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );

  const settings = getReportSettings();
  if (!REPORT_PERIODS.some((period) => settings.notify[period])) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: i18n.t('report.channel'),
      importance: AndroidImportance.DEFAULT,
    });
  }

  const now = Date.now();
  for (let offset = 0; offset < DAYS; offset += 1) {
    const day = addDays(today(), offset);
    const at = fromDay(day);
    at.setHours(settings.hour, settings.minute, 0, 0);
    if (at.getTime() <= now) continue;
    // The largest period ending today leads; the others are listed in the body.
    const ending = REPORT_PERIODS.filter((period) => settings.notify[period] && reportRange(period, day).end === day);
    if (!ending.length) continue;
    const main = ending[ending.length - 1];
    const names = ending.map((period) => i18n.t(`report.periods.${period}`)).join(i18n.language === 'ar' ? '، ' : ', ');
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${day}`,
      content: {
        title: i18n.t('report.notifyTitle', { period: i18n.t(`report.periodsOf.${main}`) }),
        body: ending.length > 1 ? i18n.t('report.notifyBodyMany', { names }) : i18n.t('report.notifyBody'),
        data: { url: `/report?period=${main}&date=${day}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Keeps the report notifications up to date while the vault is open. */
export function watchReports(): () => void {
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void rescheduleReports().catch(() => undefined), 3000);
  };
  schedule();
  const stop = onLocalChange(schedule);
  return () => {
    stop();
    if (timer) clearTimeout(timer);
  };
}
