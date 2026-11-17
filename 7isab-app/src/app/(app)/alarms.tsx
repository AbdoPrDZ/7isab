import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { FullScreenWarning } from '@/components/alarms/full-screen-warning';
import { useAlarmLabels } from '@/components/alarms/alarm-labels';
import { useNow, usePrayerFormat } from '@/components/prayer/prayer-format';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { AlertIcon } from '@/components/ui/icons';
import { AddRow, Card, Divider, Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { nextRing, setAlarmEnabled, useAlarms } from '@/lib/alarms/alarms';
import { toDay } from '@/lib/dates';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { getNotificationAccess, requestNotificationAccess, type NotificationAccess } from '@/lib/prayer/notifications';
import { usePrayerSettings } from '@/lib/prayer/prayer';

/** All alarms, each with an on/off switch and when it rings next. */
export default function AlarmsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const alarms = useAlarms();
  const settings = usePrayerSettings();
  const now = useNow();
  const { time: clock, countdown } = usePrayerFormat();
  const { format } = useLedgerLabels();
  const { timeText, repeatText } = useAlarmLabels();
  const [access, setAccess] = useState<NotificationAccess | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getNotificationAccess()
        .then((value) => {
          if (active) setAccess(value);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  const sorted = [...alarms].sort(
    (a, b) => (nextRing(a, settings, now)?.getTime() ?? Infinity) - (nextRing(b, settings, now)?.getTime() ?? Infinity),
  );
  const open = (id: string) => router.push({ pathname: '/alarm/[id]', params: { id } });

  return (
    <Screen back title={t('alarm.listTitle')}>
      {access && (!access.notifications || !access.exactAlarms) ? (
        <Card tone="danger" style={styles.warning}>
          <AlertIcon size={20} color={theme.danger} />
          <View style={styles.flex}>
            <AppText variant="label" color="danger">
              {t(access.notifications ? 'alarm.exactOff' : 'alarm.notificationsOff')}
            </AppText>
            <Button
              title={t('prayer.enable')}
              variant="secondary"
              onPress={() => void requestNotificationAccess().then(setAccess)}
            />
          </View>
        </Card>
      ) : null}

      <FullScreenWarning />

      <Card>
        {sorted.map((alarm, index) => {
          const next = nextRing(alarm, settings, now);
          return (
            <Fragment key={alarm.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable accessibilityRole="button" onPress={() => open(alarm.id)} style={styles.row}>
                <View style={styles.flex}>
                  <AppText variant="title" color={alarm.enabled ? 'text' : 'textSecondary'}>
                    {timeText(alarm)}
                  </AppText>
                  <AppText variant="label" color={alarm.enabled ? 'text' : 'textSecondary'}>
                    {[alarm.label, repeatText(alarm)].filter(Boolean).join(' · ')}
                  </AppText>
                  {next ? (
                    <AppText variant="caption" color="primary">
                      {t('alarm.next', { day: format.day(toDay(next)), time: clock(next), in: countdown(next, now) })}
                    </AppText>
                  ) : alarm.enabled && alarm.time.kind === 'prayer' && !settings.location ? (
                    <AppText variant="caption" color="danger">
                      {t('alarm.needsLocation')}
                    </AppText>
                  ) : null}
                </View>
                <Switch
                  value={alarm.enabled}
                  onValueChange={(on) => void setAlarmEnabled(alarm, on)}
                  trackColor={{ true: theme.primary }}
                />
              </Pressable>
            </Fragment>
          );
        })}
        {sorted.length ? <Divider /> : null}
        <AddRow label={t('alarm.add')} onPress={() => open('new')} />
      </Card>
      <AppText variant="caption" color="textSecondary">
        {t('alarm.hint')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
});
