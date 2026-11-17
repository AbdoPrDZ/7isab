import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { FullScreenWarning } from '@/components/alarms/full-screen-warning';
import { useNow, usePrayerFormat } from '@/components/prayer/prayer-format';
import { openPrayerSheet } from '@/components/prayer/prayer-sheet';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { AlertIcon, BackIcon, CheckIcon } from '@/components/ui/icons';
import { Card, Divider, IconButton, Row, Screen, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { addDays, toDay, today } from '@/lib/dates';
import { useDocs } from '@/lib/data/vault';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { RecordTypes, type Task, type TaskProgress } from '@/lib/ledger/types';
import { locateNow } from '@/lib/prayer/location';
import {
  getNotificationAccess,
  requestNotificationAccess,
  reschedulePrayers,
  type NotificationAccess,
} from '@/lib/prayer/notifications';
import {
  currentPrayer,
  nextPrayer,
  prayerDeadline,
  prayerTimes,
  resolvedMadhab,
  resolvedMethod,
  usePrayerSettings,
} from '@/lib/prayer/prayer';
import { startPrayers } from '@/lib/prayer/setup';
import { canMarkPrayer, prayerState } from '@/lib/prayer/tasks';

/** Prayer times for a day, the prayed checks, location and notification status. */
export default function PrayerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isRtl } = useDirection();
  const settings = usePrayerSettings();
  const now = useNow();
  const { time: clock, countdown } = usePrayerFormat();
  const { format } = useLedgerLabels();
  const [day, setDay] = useState(today());
  const [access, setAccess] = useState<NotificationAccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDocs<TaskProgress>(RecordTypes.progress);
  useDocs<Task>(RecordTypes.task);

  // Re-check notification access each time the screen is shown (the user may come back from system settings).
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

  const locate = async (first: boolean) => {
    setBusy(true);
    setError(null);
    const result = first ? await startPrayers() : await locateNow();
    if (result.ok && !first) await reschedulePrayers(true).catch(() => undefined);
    setBusy(false);
    if (!result.ok) setError(t(result.reason === 'denied' ? 'prayer.locationDenied' : 'prayer.locationUnavailable'));
  };

  const enableNotifications = async () => {
    const value = await requestNotificationAccess();
    setAccess(value);
    if (value.notifications) await reschedulePrayers(true).catch(() => undefined);
  };

  const location = settings.location;
  const times = prayerTimes(settings, day);
  const isToday = day === today();
  const next = isToday ? nextPrayer(settings, now) : null;
  const current = isToday && times ? currentPrayer(times, now) : null;

  return (
    <Screen back title={t('prayer.title')} subtitle={location?.city ?? undefined}>
      {!location ? (
        <Card>
          <AppText variant="label">{t('prayer.setupHint')}</AppText>
          {error ? (
            <AppText variant="caption" color="danger">
              {error}
            </AppText>
          ) : null}
          <Button title={t('prayer.useLocation')} loading={busy} onPress={() => void locate(true)} />
        </Card>
      ) : (
        <>
          {access && (!access.notifications || !access.exactAlarms) ? (
            <Card tone="danger" style={styles.warning}>
              <AlertIcon size={20} color={theme.danger} />
              <View style={styles.flex}>
                <AppText variant="label" color="danger">
                  {t(access.notifications ? 'prayer.exactOff' : 'prayer.notificationsOff')}
                </AppText>
                <Button title={t('prayer.enable')} variant="secondary" onPress={() => void enableNotifications()} />
              </View>
            </Card>
          ) : null}

          <FullScreenWarning />

          {next ? (
            <Card tone="accent">
              <AppText variant="caption" color="textSecondary" align="center">
                {t('prayer.next')}
              </AppText>
              <AppText variant="title" color="primary" align="center">
                {t(`prayer.names.${next.prayer}`)} · {clock(next.time)}
              </AppText>
              <AppText variant="label" align="center">
                {countdown(next.time, now)}
              </AppText>
            </Card>
          ) : null}

          <View style={styles.dayRow}>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setDay(addDays(day, -1))}>
              <BackIcon size={22} color={theme.primary} flip={isRtl} />
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.flex} onPress={() => setDay(today())}>
              <AppText variant="heading" align="center">
                {isToday ? t('prayer.today') : format.day(day, 'long')}
              </AppText>
            </Pressable>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setDay(addDays(day, 1))}>
              <BackIcon size={22} color={theme.primary} flip={!isRtl} />
            </Pressable>
          </View>

          {times ? (
            <Card>
              {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((name, index) => {
                const time = times[name];
                const isPrayer = name !== 'sunrise';
                const tracked = isPrayer && settings.tasks;
                const state = tracked ? prayerState(name, day, now) : null;
                const prayed = state === 'prayed' || state === 'combined' || state === 'late';
                // Past days too: marking a forgotten prayer corrects its hisab entry.
                const canCheck = tracked && canMarkPrayer(name, day, now);
                const deadline = tracked ? prayerDeadline(settings, name, day) : null;
                const subtitle = state
                  ? state === 'open' && deadline
                    ? t('prayer.states.openUntil', { time: clock(deadline) })
                    : t(`prayer.states.${state}`)
                  : name === current
                    ? t('prayer.now')
                    : undefined;
                return (
                  <Fragment key={name}>
                    {index > 0 ? <Divider /> : null}
                    <Row
                      title={t(`prayer.names.${name}`)}
                      subtitle={subtitle}
                      value={clock(time)}
                      valueColor={
                        state === 'missed'
                          ? 'danger'
                          : name === current
                            ? 'primary'
                            : name === 'sunrise'
                              ? 'textSecondary'
                              : 'text'
                      }
                      end={
                        isPrayer && settings.tasks ? (
                          <IconButton
                            label={t('prayer.prayed')}
                            tone={prayed ? 'solid' : 'soft'}
                            size={34}
                            onPress={() => {
                              if (canCheck) openPrayerSheet(name, day);
                            }}>
                            <CheckIcon
                              size={18}
                              color={prayed ? theme.textOnPrimary : canCheck ? theme.primary : theme.border}
                            />
                          </IconButton>
                        ) : undefined
                      }
                    />
                  </Fragment>
                );
              })}
            </Card>
          ) : null}

          <AppText variant="caption" color="textSecondary">
            {t('prayer.methodLine', {
              method: t(`prayer.methods.${resolvedMethod(settings)}`),
              madhab: t(`prayer.madhabs.${resolvedMadhab(settings)}`),
            })}
            {settings.method === 'auto' ? ` · ${t('prayer.auto')}` : ''}
          </AppText>

          <Section>
            <View style={styles.actions}>
              <Button title={t('prayer.qibla')} style={styles.flex} onPress={() => router.push('/qibla')} />
              <Button
                title={t('prayer.settings')}
                variant="secondary"
                style={styles.flex}
                onPress={() => router.push('/prayer-settings')}
              />
            </View>
            <Button title={t('alarm.listTitle')} variant="secondary" onPress={() => router.push('/alarms')} />
            <Button
              title={t('prayer.updateLocation')}
              variant="ghost"
              loading={busy}
              onPress={() => void locate(false)}
            />
            {error ? (
              <AppText variant="caption" color="danger" align="center">
                {error}
              </AppText>
            ) : null}
            <AppText variant="caption" color="textSecondary" align="center">
              {t('prayer.locationLine', {
                place:
                  location.city ?? `${format.number(location.latitude, 3)}, ${format.number(location.longitude, 3)}`,
                date: format.day(toDay(new Date(location.updatedAt))),
              })}
            </AppText>
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
