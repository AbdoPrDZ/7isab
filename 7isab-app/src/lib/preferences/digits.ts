/**
 * Digits preference: Western (0–9, default) or Arabic-Indic (٠–٩). Per device.
 */
import { useSyncExternalStore } from 'react';

import { readPreference, writePreference } from './store';

export const DIGIT_PREFERENCES = ['latn', 'arab'] as const;
export type DigitPreference = (typeof DIGIT_PREFERENCES)[number];

const KEY = 'hisab.pref.digits';

let current: DigitPreference = readPreference(KEY) === 'arab' ? 'arab' : 'latn';
const listeners = new Set<() => void>();

export function getDigitPreference(): DigitPreference {
  return current;
}

export function setDigitPreference(value: DigitPreference): void {
  current = value;
  writePreference(KEY, value);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDigitPreference(): DigitPreference {
  return useSyncExternalStore(subscribe, getDigitPreference, getDigitPreference);
}
