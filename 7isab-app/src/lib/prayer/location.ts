/**
 * The phone's location for prayer times. Asked only when the user taps "Use my
 * location"; afterwards checked quietly when the app opens or comes back (at
 * most once an hour), so the times follow the user when travelling. Rounded to
 * 3 decimals (~100 m) before it is saved.
 */
import * as Location from 'expo-location';

import { getVaultMeta, setVaultMeta } from '@/lib/data/vault';

import { getPrayerSettings, updatePrayerSettings, type PrayerLocation } from './prayer';

/** How often the position is checked quietly. */
const CHECK_MS = 60 * 60 * 1000;
/** Moving less than this barely changes the times (under a minute), so it's ignored. */
const MOVE_KM = 2;
/** Last quiet check, kept on this device only (not synced). */
const CHECK_META = 'prayer_location_check';

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

async function describe(latitude: number, longitude: number) {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    return { city: place?.city ?? place?.subregion ?? place?.region ?? null, countryCode: place?.isoCountryCode ?? null };
  } catch {
    // Offline or no geocoder: times still work; the country is kept from before.
    return null;
  }
}

async function save(latitude: number, longitude: number, previous: PrayerLocation | null): Promise<PrayerLocation> {
  const place = await describe(latitude, longitude);
  const location: PrayerLocation = {
    latitude: round3(latitude),
    longitude: round3(longitude),
    city: place?.city ?? previous?.city ?? null,
    countryCode: place?.countryCode ?? previous?.countryCode ?? null,
    updatedAt: Date.now(),
  };
  await updatePrayerSettings({ location });
  return location;
}

export type LocateResult = { ok: true; location: PrayerLocation } | { ok: false; reason: 'denied' | 'unavailable' };

/** Asks for permission if needed and saves the current location. */
export async function locateNow(): Promise<LocateResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { ok: false, reason: 'denied' };
  try {
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000, requiredAccuracy: 3000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const location = await save(position.coords.latitude, position.coords.longitude, getPrayerSettings().location);
    return { ok: true, location };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** Great-circle distance in km. */
function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** A recent fix if the phone has one, else a fresh low-accuracy fix (gives up after 15 s). */
async function freshPosition(): Promise<Location.LocationObject | null> {
  const recent = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000, requiredAccuracy: 3000 });
  if (recent) return recent;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 15_000));
  return Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }), timeout]);
}

/**
 * On app open and when the app comes back: if permission was already given,
 * check where the phone is (at most once per CHECK_MS, never prompts). When
 * it moved more than MOVE_KM, the new place is saved so the prayer times and
 * the athan follow it. Returns true when the location changed.
 */
export async function refreshLocationQuietly(): Promise<boolean> {
  const current = getPrayerSettings().location;
  if (!current) return false;
  const lastCheck = Number((await getVaultMeta(CHECK_META)) ?? 0);
  if (Date.now() - lastCheck < CHECK_MS) return false;
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return false;

  const position = await freshPosition().catch(() => null);
  if (!position) return false;
  await setVaultMeta(CHECK_META, String(Date.now()));
  if (distanceKm(current, position.coords) < MOVE_KM) return false;

  await save(position.coords.latitude, position.coords.longitude, current);
  return true;
}
