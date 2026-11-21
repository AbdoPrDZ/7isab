import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { CommunityScreen } from '@/components/community/community-screen';
import { FatwaCard } from '@/components/community/fatwa-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Row, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getFatwas, getMyTrustRequest } from '@/lib/community/api';
import type { PublishedFatwa } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/** Fatwa: published fatwas, asking a question, the member's questions, and for shaykhs their inbox. */
export default function CommunityFatwaScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const [fatwas, setFatwas] = useState<PublishedFatwa[] | null>(null);
  const [isShaykh, setIsShaykh] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    Promise.all([getFatwas(token), getMyTrustRequest(token)])
      .then(([list, trust]) => {
        if (cancelled) return;
        setFatwas(list.fatwas);
        setIsShaykh(trust.is_shaykh);
      })
      .catch(() => !cancelled && setFatwas([]));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useFocusEffect(load);

  return (
    <CommunityScreen title={t('community.tabs.fatwa')} subtitle={t('community.fatwa.subtitle')}>
      <Button title={t('community.fatwa.ask')} onPress={() => router.push('/community/fatwa-ask')} />
      <Section>
        <Row title={t('community.fatwa.myQuestions')} chevron onPress={() => router.push('/community/fatwa-mine')} />
        <Row title={t('community.fatwa.shaykhs')} chevron onPress={() => router.push('/community/shaykhs')} />
        {isShaykh ? (
          <Row title={t('community.fatwa.inbox')} chevron onPress={() => router.push('/community/fatwa-inbox')} />
        ) : (
          <Row title={t('community.fatwa.becomeShaykh')} chevron onPress={() => router.push('/community/fatwa-trust')} />
        )}
      </Section>

      <Section title={t('community.fatwa.published')}>
        {!fatwas ? <ActivityIndicator color={theme.primary} style={styles.center} /> : null}
        {fatwas && fatwas.length === 0 ? (
          <AppText color="textSecondary" align="center" style={styles.center}>
            {t('community.fatwa.none')}
          </AppText>
        ) : null}
        {fatwas?.map((fatwa) => (
          <FatwaCard key={fatwa.id} fatwa={fatwa} />
        ))}
      </Section>
    </CommunityScreen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.five },
});
