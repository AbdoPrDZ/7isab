/**
 * Theme preference: follow the system, or force light / dark.
 * Applied with Appearance.setColorScheme, so every useColorScheme() follows it.
 */
import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';

import { readPreference, writePreference } from './store';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const KEY = 'hisab.pref.theme';

function isThemePreference(value: string | null): value is ThemePreference {
  return !!value && THEME_PREFERENCES.includes(value as ThemePreference);
}

let current: ThemePreference = isThemePreference(readPreference(KEY)) ? (readPreference(KEY) as ThemePreference) : 'system';
const listeners = new Set<() => void>();

function apply(preference: ThemePreference): void {
  if (Platform.OS === 'web' || typeof Appearance.setColorScheme !== 'function') return;
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

/** Call once at startup, before the first render. */
export function applyStoredThemePreference(): void {
  apply(current);
}

export function getThemePreference(): ThemePreference {
  return current;
}

export function setThemePreference(preference: ThemePreference): void {
  current = preference;
  writePreference(KEY, preference);
  apply(preference);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getThemePreference, getThemePreference);
}
