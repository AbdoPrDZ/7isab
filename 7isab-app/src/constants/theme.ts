/**
 * Design tokens: modern Islamic look (emerald, gold, ivory / night green).
 * Use these through `useTheme()`; never hard-code colors in screens.
 */

export const Colors = {
  light: {
    background: '#FAF7F0',
    surface: '#FFFFFF',
    surfaceMuted: '#F2EDE1',
    border: '#E6DDC8',
    text: '#1B2A24',
    textSecondary: '#5B6B63',
    textOnPrimary: '#FFFFFF',
    primary: '#0F5C45',
    primaryPressed: '#0B4835',
    primarySoft: '#E3EFE9',
    accent: '#C9A227',
    accentSoft: '#F6EDCF',
    danger: '#B4473A',
    /** Chart series (validated pair): in / earned, out / lost. */
    chartIn: '#1BAF7A',
    chartOut: '#EB6834',
    /** Prayer marks: late (dark orange) and combined / jam' (light orange). */
    prayerLate: '#C2410C',
    prayerLateSoft: '#FFE3D1',
    prayerCombined: '#F59E42',
    prayerCombinedSoft: '#FFF1DF',
    dangerSoft: '#F7E3DF',
    pattern: '#0F5C45',
    hero: '#0F5C45',
    onHero: '#FFFFFF',
    onHeroMuted: '#F6EDCF',
  },
  dark: {
    background: '#0B1512',
    surface: '#12201B',
    surfaceMuted: '#182A23',
    border: '#22392F',
    text: '#EEF2EE',
    textSecondary: '#9FB2A8',
    textOnPrimary: '#06110D',
    primary: '#2FA67E',
    primaryPressed: '#268A68',
    primarySoft: '#173A2E',
    accent: '#D9B645',
    accentSoft: '#3A3218',
    danger: '#E07A6A',
    chartIn: '#199E70',
    chartOut: '#D95926',
    prayerLate: '#F07A3A',
    prayerLateSoft: '#3D2416',
    prayerCombined: '#F7B871',
    prayerCombinedSoft: '#34291B',
    dangerSoft: '#3A1D19',
    pattern: '#2FA67E',
    hero: '#10392D',
    onHero: '#EEF2EE',
    onHeroMuted: '#D9C88F',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof ThemeColors;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
} as const;

export const Radius = {
  small: 8,
  medium: 14,
  large: 22,
  pill: 999,
} as const;

export const MaxContentWidth = 560;

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

/**
 * One font family per language, never mixed:
 * Arabic UI uses IBM Plex Sans Arabic, English/French use IBM Plex Sans.
 */
export const FontFamilies = {
  arabic: {
    regular: 'IBMPlexSansArabic_400Regular',
    medium: 'IBMPlexSansArabic_500Medium',
    semibold: 'IBMPlexSansArabic_600SemiBold',
    bold: 'IBMPlexSansArabic_700Bold',
  },
  latin: {
    regular: 'IBMPlexSans_400Regular',
    medium: 'IBMPlexSans_500Medium',
    semibold: 'IBMPlexSans_600SemiBold',
    bold: 'IBMPlexSans_700Bold',
  },
} as const satisfies Record<string, Record<FontWeight, string>>;
