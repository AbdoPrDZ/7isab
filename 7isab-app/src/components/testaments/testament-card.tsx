import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { QURAN_FONT } from '@/components/quran/mushaf-page';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Testament } from '@/lib/ledger/types';
import { setTestamentEnabled, useTestamentContent } from '@/lib/testaments/testaments';

/** One Testament: its text (ayat in the Quran font, always right-to-left), source and on/off switch. */
export function TestamentCard({
  testament,
  highlighted = false,
  onPress,
}: {
  testament: Testament;
  highlighted?: boolean;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const content = useTestamentContent()(testament);

  return (
    <Card tone={highlighted ? 'accent' : 'surface'}>
      <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={styles.gap}>
        <View style={styles.header}>
          <AppText variant="caption" weight="semibold" color="primary" style={styles.flex}>
            {t(`testaments.categories.${testament.category}`)}
            {testament.preset ? ` · ${t('testaments.builtIn')}` : ''}
          </AppText>
          <Switch
            value={testament.enabled}
            onValueChange={(enabled) => void setTestamentEnabled(testament, enabled)}
            trackColor={{ true: theme.primary }}
          />
        </View>
        {content.ayah ? (
          <AppText style={[styles.ayah, { fontFamily: QURAN_FONT, color: theme.text }]}>{content.text}</AppText>
        ) : content.arabic ? (
          <AppText variant="body" weight="semibold" style={styles.arabic}>
            {content.text}
          </AppText>
        ) : (
          <AppText variant={highlighted ? 'body' : 'label'}>{content.text}</AppText>
        )}
        {content.source ? (
          <AppText variant="caption" color="textSecondary">
            {content.source}
          </AppText>
        ) : null}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  ayah: { fontSize: 20, lineHeight: 38, writingDirection: 'rtl', textAlign: 'right' },
  arabic: { fontSize: 18, lineHeight: 30, writingDirection: 'rtl', textAlign: 'right' },
});
