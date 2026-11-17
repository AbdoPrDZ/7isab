/**
 * Small device preferences (language, theme, digits). Read synchronously so
 * the first frame already uses them. Native: secure store; web: localStorage.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export function readPreference(key: string): string | null {
  try {
    return Platform.OS === 'web' ? localStorage.getItem(key) : SecureStore.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else SecureStore.setItem(key, value);
  } catch {
    // Not critical: defaults are used next time.
  }
}
