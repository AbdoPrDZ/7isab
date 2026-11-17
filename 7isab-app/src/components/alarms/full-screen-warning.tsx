import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { AlertIcon } from '@/components/ui/icons';
import { Card } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { nativeAlarm } from '@/lib/alarms/native-alarm';

type Access = { fullScreen: boolean; exact: boolean };

function read(): Access | null {
  if (!nativeAlarm) return null;
  try {
    return { fullScreen: nativeAlarm.canUseFullScreen(), exact: nativeAlarm.canScheduleExact() };
  } catch {
    return null;
  }
}

/**
 * Android may block the athan / alarm page over the lock screen (Android 14+
 * "full-screen notifications") or exact timing ("Alarms & reminders"). Shows
 * what is off with a button to the right system setting; re-checked when the
 * user comes back to the app.
 */
export function FullScreenWarning() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [access, setAccess] = useState<Access | null>(null);

  useFocusEffect(
    useCallback(() => {
      setAccess(read());
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') setAccess(read());
      });
      return () => subscription.remove();
    }, []),
  );

  if (!access || (access.fullScreen && access.exact)) return null;
  return (
    <Card tone="danger" style={styles.row}>
      <AlertIcon size={20} color={theme.danger} />
      <View style={styles.flex}>
        <AppText variant="label" color="danger">
          {t(access.fullScreen ? 'alarm.exactOff' : 'alarm.fullScreenOff')}
        </AppText>
        <Button
          title={t('prayer.enable')}
          variant="secondary"
          onPress={() =>
            access.fullScreen ? nativeAlarm?.openExactAlarmSettings() : nativeAlarm?.openFullScreenSettings()
          }
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
});
