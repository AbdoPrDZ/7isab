import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Row, Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getShaykhs } from '@/lib/community/api';
import type { ShaykhProfile } from '@/lib/community/types';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { useSession } from '@/lib/session/session-provider';

/** Trusted shaykhs the member may see (female shaykhs for women only). */
export default function ShaykhsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const { format } = useLedgerLabels();
  const [shaykhs, setShaykhs] = useState<ShaykhProfile[] | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    getShaykhs(token)
      .then((result) => !cancelled && setShaykhs(result.shaykhs))
      .catch(() => !cancelled && setShaykhs([]));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useFocusEffect(load);

  return (
    <Screen back title={t('community.fatwa.shaykhs')}>
      {!shaykhs ? <ActivityIndicator color={theme.primary} style={styles.center} /> : null}
      {shaykhs && shaykhs.length === 0 ? (
        <AppText color="textSecondary" align="center" style={styles.center}>
          {t('community.fatwa.noShaykhs')}
        </AppText>
      ) : null}
      {shaykhs?.map((shaykh) => (
        <Row
          key={shaykh.id}
          title={`${shaykh.first_name} ${shaykh.last_name}`}
          subtitle={t('community.fatwa.manhajLine', { manhaj: shaykh.manhaj, marja: shaykh.marja })}
          value={shaykh.fatwas_count ? t('community.fatwa.fatwasCount', { count: format.number(shaykh.fatwas_count) }) : undefined}
          chevron
          onPress={() => router.push({ pathname: '/community/shaykh/[id]', params: { id: String(shaykh.id) } })}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
});
