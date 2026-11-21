/**
 * Testament notifications for the next DAYS days, per category: N random
 * times inside the category's window plus its fixed times, each with a
 * different enabled Testament of that category where possible. Random times
 * and picks are seeded by day and category, so rebuilding (after any local
 * change) keeps the same times. Tapping one opens it in the Testaments screen.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';
import { addDays, fromDay, today } from '@/lib/dates';
import { onLocalChange } from '@/lib/data/vault';
import type { Testament, TestamentCategory } from '@/lib/ledger/types';

import {
  getTestaments,
  getTestamentSchedules,
  MAX_RANDOM,
  TESTAMENT_CATEGORIES,
  testamentContent,
} from './testaments';

const PREFIX = 'testament:';
const CHANNEL = 'testaments';
const DAYS = 4;

/** Small deterministic PRNG (mulberry32) seeded from a string. */
function seeded(seed: string): () => number {
  let state = 0;
  for (let i = 0; i < seed.length; i += 1) state = (Math.imul(state, 31) + seed.charCodeAt(i)) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** The minutes (from the day's 00:00) a category notifies on `day`; may pass 24:00 when the window does. */
export function slotsFor(
  day: string,
  category: TestamentCategory,
  schedule: { random: number; from: number; to: number; times: number[] },
): number[] {
  const random = seeded(`${day}:${category}:times`);
  const end = schedule.to > schedule.from ? schedule.to : schedule.to + 24 * 60;
  const span = end - schedule.from;
  const count = Math.min(Math.max(0, schedule.random), MAX_RANDOM);
  const slots = Array.from({ length: count }, () => schedule.from + Math.floor(random() * span));
  return [...new Set([...slots, ...schedule.times])].sort((a, b) => a - b);
}

/** A seeded shuffle of the pool, repeated as needed to cover `count` picks. */
function picks(pool: Testament[], count: number, seed: string): Testament[] {
  const random = seeded(seed);
  const result: Testament[] = [];
  while (result.length < count) {
    const round = [...pool];
    for (let i = round.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [round[i], round[j]] = [round[j], round[i]];
    }
    result.push(...round);
  }
  return result.slice(0, count);
}

export function notificationContent(testament: Testament): { title: string; body: string } {
  const { text, source } = testamentContent(testament);
  return {
    title: i18n.t(`testaments.notifyTitle.${testament.category}`),
    body: source ? `${text}\n${source}` : text,
  };
}

export async function rescheduleTestaments(): Promise<void> {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );

  const schedules = getTestamentSchedules();
  const testaments = getTestaments().filter((testament) => testament.enabled);
  const active = TESTAMENT_CATEGORIES.filter(
    (category) => schedules[category].enabled && testaments.some((testament) => testament.category === category),
  );
  if (!active.length) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: i18n.t('testaments.channel'),
      importance: AndroidImportance.DEFAULT,
    });
  }

  const now = Date.now();
  for (let offset = 0; offset < DAYS; offset += 1) {
    const day = addDays(today(), offset);
    for (const category of active) {
      const pool = testaments.filter((testament) => testament.category === category);
      const slots = slotsFor(day, category, schedules[category]);
      const chosen = picks(pool, slots.length, `${day}:${category}:picks`);
      for (const [index, minutes] of slots.entries()) {
        const at = fromDay(day);
        at.setHours(0, minutes, 0, 0);
        if (at.getTime() <= now) continue;
        const testament = chosen[index];
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${day}:${category}:${index}`,
          content: { ...notificationContent(testament), data: { url: `/testaments?id=${testament.id}` } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
        });
      }
    }
  }
}

/** Shows one Testament now (the "try it" button). */
export async function sendTestamentNow(testament: Testament): Promise<void> {
  if (Platform.OS === 'web') return;
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: i18n.t('testaments.channel'),
      importance: AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: { ...notificationContent(testament), data: { url: `/testaments?id=${testament.id}` } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, channelId: CHANNEL },
  });
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Keeps the Testament notifications up to date while the vault is open. */
export function watchTestaments(): () => void {
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void rescheduleTestaments().catch(() => undefined), 3000);
  };
  schedule();
  const stop = onLocalChange(schedule);
  return () => {
    stop();
    if (timer) clearTimeout(timer);
  };
}
