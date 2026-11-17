/**
 * i18n: Arabic (RTL), English, French.
 *
 * Layout direction is applied by React (a `direction` style on the root view,
 * see useDirection), not by I18nManager.forceRTL: the native flag only takes
 * effect after a full native restart, which made the app reload in a loop.
 * Switching language is instant, with no reload.
 */
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';

import { readPreference, writePreference } from '@/lib/preferences/store';

import ar from './locales/ar';
import en from './locales/en';
import fr from './locales/fr';

export const LANGUAGES = ['ar', 'en', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];

const RTL_LANGUAGES: readonly Language[] = ['ar'];

export function isRtlLanguage(language: string): boolean {
  return RTL_LANGUAGES.includes(language as Language);
}

const LANGUAGE_KEY = 'hisab.pref.language';

function isLanguage(value: string | null | undefined): value is Language {
  return !!value && LANGUAGES.includes(value as Language);
}

/** The language the user picked, read synchronously so the first render is right. */
function storedLanguage(): Language | null {
  const value = readPreference(LANGUAGE_KEY);
  return isLanguage(value) ? value : null;
}

function storeLanguage(language: Language): void {
  writePreference(LANGUAGE_KEY, language);
}

function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    if (isLanguage(locale.languageCode)) return locale.languageCode;
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en }, fr: { translation: fr } },
  lng: storedLanguage() ?? deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/**
 * Keep the native layout LTR so React's `direction` style is the only source of
 * truth (undoes any forceRTL(true) left over from earlier builds). Never reloads.
 */
export function disableNativeRtl(): void {
  if (Platform.OS === 'web') return;
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}

export async function changeLanguage(language: Language): Promise<void> {
  storeLanguage(language);
  await i18n.changeLanguage(language);
}

export default i18n;
