import { useTranslation } from 'react-i18next';

import { isRtlLanguage } from '@/i18n';

export type Direction = 'rtl' | 'ltr';

/** Layout direction of the active language. Re-renders when the language changes. */
export function useDirection(): { direction: Direction; isRtl: boolean } {
  const { i18n } = useTranslation();
  const isRtl = isRtlLanguage(i18n.language);

  return { direction: isRtl ? 'rtl' : 'ltr', isRtl };
}
