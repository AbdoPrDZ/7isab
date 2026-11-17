import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './app-text';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  /** Optional font override (e.g. each language name in its own script). */
  fontFamily?: string;
  accessibilityLabel?: string;
};

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** "onPrimary" for use on the emerald header. */
  tone?: 'surface' | 'onPrimary';
  size?: 'small' | 'medium';
  style?: ViewStyle;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  tone = 'surface',
  size = 'medium',
  style,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const onPrimary = tone === 'onPrimary';

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.group,
        onPrimary
          ? { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.18)' }
          : { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        style,
      ]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            onPress={() => onChange(option.value)}
            style={[
              styles.option,
              size === 'small' && styles.optionSmall,
              selected && (onPrimary ? styles.selectedOnPrimary : { backgroundColor: theme.surface, borderColor: theme.accent }),
            ]}>
            <AppText
              variant={size === 'small' ? 'caption' : 'label'}
              weight={selected ? 'semibold' : 'regular'}
              color={onPrimary ? (selected ? 'hero' : 'onHero') : selected ? 'primary' : 'textSecondary'}
              align="center"
              style={option.fontFamily ? { fontFamily: option.fontFamily } : undefined}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.pill,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  option: {
    flexGrow: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionSmall: {
    flexGrow: 0,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  selectedOnPrimary: {
    backgroundColor: '#FFFFFF',
  },
});
