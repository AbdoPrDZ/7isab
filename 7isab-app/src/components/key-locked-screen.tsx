import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FingerprintIcon } from '@/components/ui/icons';
import { IslamicPattern } from '@/components/ui/islamic-pattern';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session/session-provider';

/** Shown when the data key is fingerprint-protected and the check didn't pass. */
export function KeyLockedScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { retryUnlock, signOut } = useSession();

  return (
    <View style={[styles.root, { backgroundColor: theme.hero }]}>
      <IslamicPattern color="#FFFFFF" opacity={0.06} />
      <SafeAreaView style={styles.inner}>
        <FingerprintIcon size={64} color={theme.accent} />
        <AppText variant="title" color="onHero" align="center">
          {t('account.keyLockedTitle')}
        </AppText>
        <AppText variant="label" color="onHeroMuted" align="center">
          {t('account.keyLockedHint')}
        </AppText>
        <Button title={t('account.unlock')} onPress={() => void retryUnlock()} style={styles.button} />
        <Button title={t('lock.signOut')} variant="ghost" onPress={() => void signOut()} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four, padding: Spacing.five },
  button: { alignSelf: 'stretch' },
});
