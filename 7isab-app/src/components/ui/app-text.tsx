import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { FontFamilies, type FontWeight, type ThemeColor } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { isRtlLanguage } from '@/i18n';

export type AppTextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

export type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  weight?: FontWeight;
  color?: ThemeColor;
  align?: 'start' | 'center' | 'end';
};

const variantStyles: Record<AppTextVariant, TextStyle> = StyleSheet.create({
  display: { fontSize: 34, lineHeight: 46 },
  title: { fontSize: 24, lineHeight: 34 },
  heading: { fontSize: 18, lineHeight: 28 },
  body: { fontSize: 15, lineHeight: 24 },
  label: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 18 },
});

const defaultWeights: Record<AppTextVariant, FontWeight> = {
  display: 'bold',
  title: 'bold',
  heading: 'semibold',
  body: 'regular',
  label: 'medium',
  caption: 'regular',
};

/** The font family for the active language. */
export function useFontFamily(weight: FontWeight = 'regular'): string {
  const { i18n } = useTranslation();
  const families = isRtlLanguage(i18n.language) ? FontFamilies.arabic : FontFamilies.latin;

  return families[weight];
}

/**
 * All text in the app goes through this component: it applies the theme color
 * and the language's font, and aligns to the reading direction.
 */
export function AppText({ variant = 'body', weight, color = 'text', align = 'start', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const { isRtl, direction } = useDirection();
  const fontFamily = useFontFamily(weight ?? defaultWeights[variant]);
  // "start" is the right edge in Arabic, the left edge otherwise.
  const textAlign = align === 'center' ? 'center' : (align === 'end') !== isRtl ? 'right' : 'left';

  return (
    <Text
      style={[variantStyles[variant], { fontFamily, color: theme[color], textAlign, writingDirection: direction }, style]}
      {...rest}
    />
  );
}
