import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { JoinFlow } from '@/components/community/join-flow';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MembershipProvider, useMembership } from '@/lib/community/membership';

/**
 * The community: a space of its own inside 7isab. Nothing is created on the
 * server until the user joins; members with changed rules accept them first.
 */
export default function CommunityLayout() {
  return (
    <MembershipProvider>
      <Gate />
    </MembershipProvider>
  );
}

function Gate() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { state, refresh } = useMembership();

  switch (state.status) {
    case 'member':
      return <Stack screenOptions={{ headerShown: false }} />;
    case 'outside':
      return <JoinFlow mode="join" profile={state.profile} />;
    case 'pendingRules':
      return <JoinFlow mode="accept" rules={state.rules} />;
    case 'loading':
      return (
        <Screen back title={t('community.title')}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        </Screen>
      );
    case 'blocked':
      return (
        <Screen back title={t('community.title')}>
          <View style={styles.center}>
            <AppText align="center">{t(`community.blocked.${state.reason}`)}</AppText>
            <Button title={t('community.menu.back')} variant="secondary" onPress={() => router.back()} />
          </View>
        </Screen>
      );
    case 'error':
      return (
        <Screen back title={t('community.title')}>
          <View style={styles.center}>
            <AppText color="textSecondary" align="center">
              {state.network ? t('errors.network') : t('community.loadFailed')}
            </AppText>
            <Button title={t('community.retry')} variant="secondary" onPress={refresh} />
          </View>
        </Screen>
      );
  }
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six, gap: Spacing.three, alignItems: 'center' },
});
