/**
 * Community events and lessons on the user's phone: shown in its own time zone,
 * and a reminder saved as a private, encrypted one-time alarm (never sent to the server).
 */
import { saveAlarm } from '@/lib/alarms/alarms';
import { toDay } from '@/lib/dates';

import type { EventPayload } from './types';

/** How long before the start the reminder rings. */
export const REMINDER_LEADS = [0, 30, 60, 24 * 60] as const;
export type ReminderLead = (typeof REMINDER_LEADS)[number];

/** "HH:MM" in the phone's time zone, Latin digits (like the app's alarm times). */
export function clockOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** The event's start as a local day ("YYYY-MM-DD") and clock time. */
export function eventStart(payload: EventPayload): { date: Date; day: string; time: string } {
  const date = new Date(payload.starts_at);
  return { date, day: toDay(date), time: clockOf(date) };
}

export function isPast(payload: EventPayload, now: Date = new Date()): boolean {
  return new Date(payload.ends_at ?? payload.starts_at).getTime() < now.getTime();
}

/**
 * Adds a one-time alarm `lead` minutes before the event.
 * Returns false when that moment has already passed.
 */
export async function addEventReminder(payload: EventPayload, lead: ReminderLead): Promise<boolean> {
  const at = new Date(new Date(payload.starts_at).getTime() - lead * 60_000);
  if (at.getTime() <= Date.now()) return false;

  await saveAlarm({
    label: payload.title,
    enabled: true,
    time: { kind: 'clock', hour: at.getHours(), minute: at.getMinutes() },
    days: [],
    onDay: toDay(at),
    sound: 'default',
    ringAgain: 0,
  });
  return true;
}

/**
 * Combines a local day ("YYYY-MM-DD") and time ("HH:MM") into a UTC ISO string,
 * or null when either is invalid.
 */
export function toUtcIso(day: string, time: string): string | null {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!dayMatch || !timeMatch) return null;
  const [, year, month, date] = dayMatch.map(Number);
  const [, hour, minute] = timeMatch.map(Number);
  if (month < 1 || month > 12 || date < 1 || date > 31 || hour > 23 || minute > 59) return null;
  const local = new Date(year, month - 1, date, hour, minute);
  return local.getMonth() === month - 1 ? local.toISOString() : null;
}
