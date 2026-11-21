import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { FatwaCard } from '@/components/community/fatwa-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Screen, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getShaykh } from '@/lib/community/api';
import type { PublishedFatwa, ShaykhProfile, TrustFields } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

const FIELDS: (keyof TrustFields)[] = ['manhaj', 'marja', 'studies', 'ijazat', 'teachers', 'institution', 'teaching'];

/** A trusted shaykh's public profile (manhaj, marja' and background) and their published fatwas. */
export default function ShaykhScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [shaykh, setShaykh] = useState<ShaykhProfile | null>(null);
  const [fatwas, setFatwas] = useState<PublishedFatwa[]>([]);

  const load = useCallback(() => {
    let cancelled = false;
    getShaykh(token, Number(id))
      .then((result) => {
        if (cancelled) return;
        setShaykh(result.shaykh);
        setFatwas(result.fatwas);
      })
      .catch(() => !cancelled && router.back());
    return () => {
      cancelled = true;
    };
  }, [token, id]);

  useFocusEffect(load);

  if (!shaykh) {
    return (
      <Screen back title={t('community.fatwa.shaykh')}>
        <ActivityIndicator size="large" color={theme.primary} style={styles.center} />
      </Screen>
    );
  }

  return (
    <Screen back title={`${shaykh.first_name} ${shaykh.last_name}`} subtitle={t('community.fatwa.trustedBadge')}>
      <Card style={styles.gap}>
        {FIELDS.filter((field) => shaykh[field]).map((field) => (
          <View key={field} style={styles.field}>
            <AppText variant="caption" color="textSecondary">
              {t(`community.fatwa.fields.${field}`)}
            </AppText>
            <AppText>{shaykh[field]}</AppText>
          </View>
        ))}
      </Card>
      <Button
        title={t('community.fatwa.askThisShaykh')}
        onPress={() => router.push({ pathname: '/community/fatwa-ask', params: { shaykhId: String(shaykh.id) } })}
      />
      <Section title={t('community.fatwa.published')}>
        {fatwas.length === 0 ? <AppText color="textSecondary">{t('community.fatwa.none')}</AppText> : null}
        {fatwas.map((fatwa) => (
          <FatwaCard key={fatwa.id} fatwa={fatwa} />
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
  gap: { gap: Spacing.three },
  field: { gap: Spacing.half },
});
