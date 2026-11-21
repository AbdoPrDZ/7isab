import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { INVESTMENT_KINDS, type InvestmentKind } from '@/lib/investments/investments';

/** What is and isn't allowed, and the rule of each kind. `kind` shows only that kind. */
export function HalalRules({ kind, initiallyOpen = false }: { kind?: InvestmentKind; initiallyOpen?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(initiallyOpen);
  const kinds = kind ? [kind] : INVESTMENT_KINDS;

  return (
    <Card tone="accent">
      <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={styles.gap}>
        <AppText variant="label" weight="semibold">
          {t('investments.rules.title')}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {t('investments.rules.summary')}
        </AppText>
      </Pressable>
      {open ? (
        <View style={styles.gap}>
          {kinds.map((item) => (
            <View key={item} style={styles.item}>
              <AppText variant="label" weight="semibold" color="primary">
                {t(`investments.kinds.${item}`)}
              </AppText>
              <AppText variant="caption">{t(`investments.kindRules.${item}`)}</AppText>
            </View>
          ))}
          <View style={styles.item}>
            <AppText variant="label" weight="semibold" color="danger">
              {t('investments.rules.forbiddenTitle')}
            </AppText>
            <AppText variant="caption">{t('investments.rules.forbidden')}</AppText>
          </View>
          <AppText variant="caption" color="textSecondary">
            {t('investments.rules.ask')}
          </AppText>
        </View>
      ) : (
        <AppText variant="caption" color="primary">
          {t('investments.rules.open')}
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.two },
  item: { gap: 2 },
});
