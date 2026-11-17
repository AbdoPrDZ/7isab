import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setThemePreference, THEME_PREFERENCES, useThemePreference, type ThemePreference } from '@/lib/preferences/theme';

import { AutoThemeIcon, MoonIcon, SunIcon, type IconProps } from './icons';
import { SegmentedControl } from './segmented-control';

const ICONS: Record<ThemePreference, (props: IconProps) => React.ReactNode> = {
  system: AutoThemeIcon,
  light: SunIcon,
  dark: MoonIcon,
};

type ThemeSwitcherProps = {
  /** Compact: three round icon buttons for the emerald header. Full: labelled segments (settings). */
  compact?: boolean;
  style?: ViewStyle;
};

/** System / light / dark. */
export function ThemeSwitcher({ compact = false, style }: ThemeSwitcherProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const preference = useThemePreference();

  if (compact) {
    return (
      <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.theme')} style={[styles.compactGroup, style]}>
        {THEME_PREFERENCES.map((value) => {
          const selected = value === preference;
          const IconComponent = ICONS[value];
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`settings.themes.${value}`)}
              hitSlop={4}
              onPress={() => setThemePreference(value)}
              style={[styles.compactButton, selected && styles.compactSelected]}>
              <IconComponent size={18} color={selected ? theme.hero : theme.onHero} />
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <SegmentedControl<ThemePreference>
      accessibilityLabel={t('settings.theme')}
      value={preference}
      onChange={setThemePreference}
      style={style}
      options={THEME_PREFERENCES.map((value) => ({ value, label: t(`settings.themes.${value}`) }))}
    />
  );
}

const styles = StyleSheet.create({
  compactGroup: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  compactButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactSelected: {
    backgroundColor: '#FFFFFF',
  },
});
