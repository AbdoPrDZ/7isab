import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AuthProgress as Progress } from '@/lib/session/session-provider';

type AuthProgressProps = {
  progress: Progress;
  /** Text for the server step ("Signing you in…" / "Creating your account…"). */
  serverLabel: string;
};

/** Shows which step is running: key encryption (with %) or waiting for the server. */
export function AuthProgress({ progress, serverLabel }: AuthProgressProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const percent = progress.stage === 'keys' ? Math.round(progress.progress * 100) : 100;
  const label = progress.stage === 'keys' ? t('auth.securingPercent', { percent }) : serverLabel;

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: theme.accent }]} />
      </View>
      <AppText variant="label" weight="medium" align="center">
        {label}
      </AppText>
      <AppText variant="caption" color="textSecondary" align="center">
        {t('auth.securing')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  track: {
    height: 6,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
});
