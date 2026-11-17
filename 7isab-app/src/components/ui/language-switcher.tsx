import { useTranslation } from 'react-i18next';
import type { ViewStyle } from 'react-native';

import { FontFamilies } from '@/constants/theme';
import { changeLanguage, LANGUAGES, type Language } from '@/i18n';

import { SegmentedControl } from './segmented-control';

type LanguageSwitcherProps = {
  tone?: 'surface' | 'onPrimary';
  size?: 'small' | 'medium';
  style?: ViewStyle;
};

/** AR / EN / FR. Each name is shown in its own language and script. */
export function LanguageSwitcher({ tone, size, style }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();

  return (
    <SegmentedControl<Language>
      accessibilityLabel={t('language.label')}
      value={i18n.language as Language}
      onChange={(language) => void changeLanguage(language)}
      tone={tone}
      size={size}
      style={style}
      options={LANGUAGES.map((language) => ({
        value: language,
        label: t(`language.${language}`),
        fontFamily: (language === 'ar' ? FontFamilies.arabic : FontFamilies.latin).medium,
      }))}
    />
  );
}
