/** First-time setup and "settings changed" refresh for prayers. */
import { rescheduleAlarms } from '@/lib/alarms/alarms';

import { locateNow, type LocateResult } from './location';
import { requestNotificationAccess, reschedulePrayers } from './notifications';
import { settlePrayers, syncPrayerTasks } from './tasks';

/** Saves the location, asks for notifications, creates the prayer tasks and schedules the athan. */
export async function startPrayers(): Promise<LocateResult> {
  const result = await locateNow();
  if (!result.ok) return result;
  await requestNotificationAccess().catch(() => undefined);
  await applyPrayerSettings();
  return result;
}

/** After any prayer setting changes: tasks on/off and a fresh athan schedule. */
export async function applyPrayerSettings(): Promise<void> {
  await syncPrayerTasks();
  await settlePrayers().catch(() => undefined);
  await reschedulePrayers(true).catch(() => undefined);
  // Alarms set relative to a prayer move with it.
  await rescheduleAlarms(true).catch(() => undefined);
}
