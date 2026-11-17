/**
 * The HisabAlarm native module (modules/hisab-alarm, Android only): athan and
 * alarms scheduled as real alarm clocks, with a full-screen page over the lock
 * screen and Stop / Snooze, ringing even when the app is closed.
 *
 * Missing in Expo Go, on iOS and on the web: callers then fall back to plain
 * notifications (expo-notifications).
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type NativeRing = {
  /** "athan:…" or "alarm:…" — used to cancel a whole group. */
  id: string;
  /** Unix ms. */
  time: number;
  title: string;
  body: string;
  /** Bundled sound file name without extension (e.g. "makkah"); '' = the phone's alarm sound. */
  sound: string;
  /** Alarms loop until stopped; the athan plays once. */
  loop: boolean;
  /** 0 = no Snooze button. */
  snoozeMinutes: number;
  stopLabel: string;
  snoozeLabel: string;
};

type HisabAlarmModule = {
  schedule(rings: NativeRing[]): void;
  cancelPrefix(prefix: string): void;
  scheduledIds(): string[];
  canScheduleExact(): boolean;
  canUseFullScreen(): boolean;
  openFullScreenSettings(): void;
  openExactAlarmSettings(): void;
  ringNow(ring: NativeRing): void;
};

const module = Platform.OS === 'android' ? requireOptionalNativeModule<HisabAlarmModule>('HisabAlarm') : null;

/** The native alarm module, or null when this build doesn't have it. */
export const nativeAlarm: HisabAlarmModule | null = module ?? null;

/** "makkah.mp3" → "makkah"; 'default' / 'silent' → '' (the phone's alarm sound). */
export function nativeSound(file: string): string {
  if (file === 'default' || file === 'silent') return '';
  return file.replace(/\.[a-z0-9]+$/i, '');
}
