/**
 * Prayer times, computed on the device with adhan-js (astronomical formulas;
 * no network). The location and settings are user data: they live in the
 * encrypted vault like everything else, and the location is rounded to about
 * 100 m before it is saved.
 */
import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
  Qibla,
} from 'adhan';

import { setHijriOffset } from '@/lib/calendar/hijri';
import { addDays, fromDay, toDay } from '@/lib/dates';
import { deterministicId, getDoc, putDoc, useDoc, type Doc } from '@/lib/data/vault';
import { RecordTypes, type PrayerName } from '@/lib/ledger/types';

export const PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export type MethodKey =
  | 'algeria'
  | 'morocco'
  | 'tunisia'
  | 'mwl'
  | 'egyptian'
  | 'karachi'
  | 'ummAlQura'
  | 'dubai'
  | 'kuwait'
  | 'qatar'
  | 'singapore'
  | 'tehran'
  | 'turkey'
  | 'northAmerica'
  | 'moonsighting';

export const METHODS: MethodKey[] = [
  'algeria',
  'morocco',
  'tunisia',
  'mwl',
  'egyptian',
  'ummAlQura',
  'dubai',
  'kuwait',
  'qatar',
  'karachi',
  'turkey',
  'tehran',
  'singapore',
  'northAmerica',
  'moonsighting',
];

/** Method used in each country when the method is "auto"; anything else uses MWL. */
const COUNTRY_METHOD: Record<string, MethodKey> = {
  DZ: 'algeria',
  MA: 'morocco',
  TN: 'tunisia',
  EG: 'egyptian',
  LY: 'egyptian',
  SD: 'egyptian',
  SA: 'ummAlQura',
  YE: 'ummAlQura',
  AE: 'dubai',
  KW: 'kuwait',
  QA: 'qatar',
  PK: 'karachi',
  IN: 'karachi',
  BD: 'karachi',
  AF: 'karachi',
  TR: 'turkey',
  IR: 'tehran',
  SG: 'singapore',
  MY: 'singapore',
  ID: 'singapore',
  BN: 'singapore',
  US: 'northAmerica',
  CA: 'northAmerica',
  GB: 'moonsighting',
};

/** Countries where the Hanafi Asr (shadow ×2) is the norm. */
const HANAFI_COUNTRIES = new Set(['PK', 'IN', 'BD', 'AF', 'TR', 'UZ', 'TJ', 'KZ', 'KG', 'TM']);

export type PrayerLocation = {
  latitude: number;
  longitude: number;
  city?: string | null;
  countryCode?: string | null;
  updatedAt: number;
};

/** 'default' = the phone's notification sound, 'silent' = no sound, else an athan file name. */
export type PrayerSound = string;

export type PrayerSettings = Doc & {
  location: PrayerLocation | null;
  method: 'auto' | MethodKey;
  madhab: 'auto' | 'shafi' | 'hanafi';
  /** Minutes added to each computed time (to match the local mosque). */
  adjust: Record<PrayerName, number>;
  /** Athan on / off per prayer. */
  athan: Record<PrayerName, boolean>;
  sound: PrayerSound;
  /** Fajr athan sound; 'same' uses `sound`. */
  fajrSound: PrayerSound | 'same';
  /** Reminder this many minutes before each athan (0 = off). */
  reminder: number;
  /** Play the athan at alarm volume (heard even when the ringer is low). */
  alarmStream: boolean;
  /** Keep the five daily prayer tasks in the hisab. */
  tasks: boolean;
  /** Days added to Umm al-Qura Hijri dates (moon sighting in your country), −2…+2. */
  hijriOffset: number;
  /**
   * When an unmarked prayer counts as missed: minutes after the athan, or 0 =
   * the end of its time (Fajr → sunrise, Dhuhr → Asr, Asr → Maghrib,
   * Maghrib → Isha, Isha → the middle of the night).
   */
  deadline: Record<PrayerName, number>;
  /** "Did you pray it?" this many minutes after the athan if still unmarked (0 = off). */
  checkIn: number;
  /** "It ends soon" this many minutes before its safe time ends if still unmarked (0 = off). */
  endingSoon: number;
  /** Android: athan as a full-screen page over the lock screen (needs the HisabAlarm module). */
  athanScreen: boolean;
};

const ZERO: Record<PrayerName, number> = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
const ALL_ON: Record<PrayerName, boolean> = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };

export const DEFAULT_PRAYER_SETTINGS: Omit<PrayerSettings, 'id' | 'createdAt' | 'updatedAt'> = {
  location: null,
  method: 'auto',
  madhab: 'auto',
  adjust: ZERO,
  athan: ALL_ON,
  sound: 'default',
  fajrSound: 'same',
  reminder: 0,
  alarmStream: true,
  tasks: true,
  hijriOffset: 0,
  deadline: ZERO,
  checkIn: 30,
  endingSoon: 15,
  athanScreen: true,
};

/** Fixed id of a prayer's task (HMAC of the prayer), shared by the tasks and the notifications. */
export function prayerTaskId(prayer: PrayerName): string {
  return deterministicId(`prayer-task:${prayer}`);
}

export function prayerSettingsId(): string {
  return deterministicId('prayer-settings');
}

function withDefaults(doc: PrayerSettings | undefined): PrayerSettings {
  // Every Hijri date in the app follows this setting.
  setHijriOffset(doc?.hijriOffset ?? 0);
  return {
    id: prayerSettingsId(),
    createdAt: 0,
    updatedAt: 0,
    ...DEFAULT_PRAYER_SETTINGS,
    ...doc,
    adjust: { ...ZERO, ...doc?.adjust },
    athan: { ...ALL_ON, ...doc?.athan },
    deadline: { ...ZERO, ...doc?.deadline },
  } as PrayerSettings;
}

export function getPrayerSettings(): PrayerSettings {
  return withDefaults(getDoc<PrayerSettings>(RecordTypes.prayerSettings, prayerSettingsId()));
}

export function usePrayerSettings(): PrayerSettings {
  return withDefaults(useDoc<PrayerSettings>(RecordTypes.prayerSettings, prayerSettingsId()));
}

export async function updatePrayerSettings(changes: Partial<Omit<PrayerSettings, keyof Doc>>): Promise<PrayerSettings> {
  const current = getPrayerSettings();
  const { createdAt: _c, updatedAt: _u, ...rest } = current;
  return putDoc<PrayerSettings>(RecordTypes.prayerSettings, { ...rest, ...changes, id: prayerSettingsId() });
}

/** The method actually used (auto → from the location's country). */
export function resolvedMethod(settings: PrayerSettings): MethodKey {
  if (settings.method !== 'auto') return settings.method;
  const country = settings.location?.countryCode?.toUpperCase();
  return (country && COUNTRY_METHOD[country]) || 'mwl';
}

export function resolvedMadhab(settings: PrayerSettings): 'shafi' | 'hanafi' {
  if (settings.madhab !== 'auto') return settings.madhab;
  const country = settings.location?.countryCode?.toUpperCase();
  return country && HANAFI_COUNTRIES.has(country) ? 'hanafi' : 'shafi';
}

function parametersFor(method: MethodKey): CalculationParameters {
  switch (method) {
    // Algeria (Ministry of Religious Affairs): Fajr 18°, Isha 17°.
    case 'algeria':
      return new CalculationParameters('Other', 18, 17);
    // Morocco (Ministry of Habous): Fajr 19°, Isha 17°.
    case 'morocco':
      return new CalculationParameters('Other', 19, 17);
    // Tunisia: Fajr 18°, Isha 18°.
    case 'tunisia':
      return new CalculationParameters('Other', 18, 18);
    case 'egyptian':
      return CalculationMethod.Egyptian();
    case 'karachi':
      return CalculationMethod.Karachi();
    case 'ummAlQura':
      return CalculationMethod.UmmAlQura();
    case 'dubai':
      return CalculationMethod.Dubai();
    case 'kuwait':
      return CalculationMethod.Kuwait();
    case 'qatar':
      return CalculationMethod.Qatar();
    case 'singapore':
      return CalculationMethod.Singapore();
    case 'tehran':
      return CalculationMethod.Tehran();
    case 'turkey':
      return CalculationMethod.Turkey();
    case 'northAmerica':
      return CalculationMethod.NorthAmerica();
    case 'moonsighting':
      return CalculationMethod.MoonsightingCommittee();
    default:
      return CalculationMethod.MuslimWorldLeague();
  }
}

export type DayTimes = Record<PrayerName | 'sunrise', Date>;

/** The five prayers and sunrise for a day ("YYYY-MM-DD"), or null without a location. */
export function prayerTimes(settings: PrayerSettings, day: string): DayTimes | null {
  const location = settings.location;
  if (!location) return null;
  const coordinates = new Coordinates(location.latitude, location.longitude);
  const params = parametersFor(resolvedMethod(settings));
  params.madhab = resolvedMadhab(settings) === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
  params.adjustments = { ...params.adjustments, ...settings.adjust, sunrise: 0 };
  const times = new PrayerTimes(coordinates, fromDay(day), params);
  return {
    fajr: times.fajr,
    sunrise: times.sunrise,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
  };
}

/** The next prayer from `now` (today's, or tomorrow's Fajr after Isha). */
export function nextPrayer(
  settings: PrayerSettings,
  now: Date = new Date(),
): { prayer: PrayerName; time: Date } | null {
  const day = toDay(now);
  const today = prayerTimes(settings, day);
  if (!today) return null;
  for (const prayer of PRAYERS) if (today[prayer] > now) return { prayer, time: today[prayer] };
  const tomorrow = prayerTimes(settings, addDays(day, 1));
  return tomorrow ? { prayer: 'fajr', time: tomorrow.fajr } : null;
}

/** The prayer whose time has started and not ended (null between sunrise and Dhuhr, or before Fajr). */
export function currentPrayer(times: DayTimes, now: Date = new Date()): PrayerName | null {
  if (now < times.fajr) return null;
  if (now < times.sunrise) return 'fajr';
  if (now < times.dhuhr) return null;
  if (now < times.asr) return 'dhuhr';
  if (now < times.maghrib) return 'asr';
  if (now < times.isha) return 'maghrib';
  return 'isha';
}

const KAABA = { latitude: 21.4225, longitude: 39.8262 };

/** Qibla direction in degrees clockwise from true north. */
export function qiblaBearing(location: PrayerLocation): number {
  return Qibla(new Coordinates(location.latitude, location.longitude));
}

/** Great-circle distance to the Kaaba, in km. */
export function distanceToKaaba(location: PrayerLocation): number {
  const rad = Math.PI / 180;
  const dLat = (KAABA.latitude - location.latitude) * rad;
  const dLon = (KAABA.longitude - location.longitude) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(location.latitude * rad) * Math.cos(KAABA.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** When an unmarked prayer on `day` counts as missed (see PrayerSettings.deadline). */
export function prayerDeadline(settings: PrayerSettings, prayer: PrayerName, day: string): Date | null {
  const times = prayerTimes(settings, day);
  if (!times) return null;
  const minutes = settings.deadline[prayer] ?? 0;
  if (minutes > 0) return new Date(times[prayer].getTime() + minutes * 60_000);
  switch (prayer) {
    case 'fajr':
      return times.sunrise;
    case 'dhuhr':
      return times.asr;
    case 'asr':
      return times.maghrib;
    case 'maghrib':
      return times.isha;
    default: {
      // Isha: until the middle of the night (between Maghrib and the next Fajr).
      const next = prayerTimes(settings, addDays(day, 1));
      if (!next) return null;
      return new Date((times.maghrib.getTime() + next.fajr.getTime()) / 2);
    }
  }
}
