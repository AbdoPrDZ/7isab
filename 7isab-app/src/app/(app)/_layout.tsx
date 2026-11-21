import * as Notifications from 'expo-notifications';
import { router, Stack, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';

import { LockScreen } from '@/components/lock-screen';
import { PrayerSheet } from '@/components/prayer/prayer-sheet';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openVault, useVaultStore } from '@/lib/data/vault';
import { DEFAULT_CURRENCY, ensureDefaults } from '@/lib/ledger/ledger';
import { closeFinishedDays } from '@/lib/ledger/tasks';
import { lockNow, useLockStore } from '@/lib/lock/app-lock';
import { useSession } from '@/lib/session/session-provider';
import { startSync } from '@/lib/sync/sync-engine';
import { runDueRecurring } from '@/lib/wallet/recurring';
import { ensureCategories } from '@/lib/wallet/wallet';
import { rescheduleAlarms, setupAlarmCategory, stopAlarm, watchAlarms } from '@/lib/alarms/alarms';
import { watchTaskReminder } from '@/lib/notifications/task-reminder';
import { refreshLocationQuietly } from '@/lib/prayer/location';
import { getPrayerSettings } from '@/lib/prayer/prayer';
import { reschedulePrayers, setupPrayerNotifications } from '@/lib/prayer/notifications';
import { settlePrayers, syncPrayerTasks } from '@/lib/prayer/tasks';
import { settleBedtime, syncBedtimeTask } from '@/lib/bedtime/bedtime';
import { watchBedtime } from '@/lib/bedtime/notifications';
import { watchReports } from '@/lib/reports/notifications';
import { watchTestaments } from '@/lib/testaments/notifications';
import { BedtimeSheet } from '@/components/bedtime/bedtime-sheet';

setupPrayerNotifications();

/** Prayer tasks, a quiet location refresh and the athan schedule. Never blocks the rest of the day's work. */
async function preparePrayers(): Promise<void> {
  try {
    await syncPrayerTasks();
    await settlePrayers();
    const moved = await refreshLocationQuietly().catch(() => false);
    await reschedulePrayers(moved);
    await setupAlarmCategory();
    // Alarms relative to a prayer follow the new times when the location changed.
    await rescheduleAlarms(moved);
  } catch {
    // Notifications or location unavailable (e.g. Expo Go on web): the rest of the app still works.
  }
}

let preparing: Promise<void> | null = null;

/**
 * Daily work after unlocking: defaults, end-of-day check, repeating wallet items.
 * Runs once at a time (app open and coming back to the app can overlap).
 */
function prepareDay(): Promise<void> {
  preparing ??= (async () => {
    try {
      getPrayerSettings(); // applies the Hijri ±days setting before tasks are checked
      await ensureDefaults(DEFAULT_CURRENCY);
      await ensureCategories();
      await closeFinishedDays();
      await runDueRecurring();
      await syncBedtimeTask();
      await settleBedtime();
      await preparePrayers();
    } finally {
      preparing = null;
    }
  })();
  return preparing;
}

/** Locks again after the chosen time in the background, and catches up a new day. */
function useAppStateEffects(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    let backgroundAt = 0;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        if (!backgroundAt) backgroundAt = Date.now();
        return;
      }
      if (state === 'active') {
        const { timeout } = useLockStore.getState();
        if (backgroundAt && Date.now() - backgroundAt >= timeout * 1000) lockNow();
        backgroundAt = 0;
        void prepareDay().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [ready]);
}

/** Screens available only while signed in. Opens the encrypted vault first. */
export default function AppLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user, token, getDataKey } = useSession();
  const status = useVaultStore((state) => state.status);
  const locked = useLockStore((state) => state.locked);
  const [attempt, setAttempt] = useState(0);
  const userId = user?.id;

  useEffect(() => {
    const key = getDataKey();
    if (userId === undefined || !key) return;
    let stop: (() => void) | undefined;
    openVault(userId, key)
      .then(prepareDay)
      .then(() => {
        if (token) stop = startSync(token);
      })
      .catch(() => undefined);
    return () => stop?.();
  }, [userId, token, getDataKey, attempt]);

  useAppStateEffects(status === 'open');

  // The daily task reminder follows the progress (rebuilt a few seconds after each change).
  useEffect(() => {
    if (status !== 'open') return;
    return watchTaskReminder();
  }, [status]);

  // Bedtime notifications follow the marks and the bedtime setting.
  useEffect(() => {
    if (status !== 'open') return;
    return watchBedtime();
  }, [status]);

  // Task alarms follow the tasks' progress (no ring once a task is done).
  useEffect(() => {
    if (status !== 'open') return;
    return watchAlarms();
  }, [status]);

  // Day / week / month / year report notifications.
  useEffect(() => {
    if (status !== 'open') return;
    return watchReports();
  }, [status]);

  // Testament reminders (random and fixed times, per category).
  useEffect(() => {
    if (status !== 'open') return;
    return watchTestaments();
  }, [status]);

  // While the app is open, a prayer whose deadline passes unmarked is counted as missed within a minute.
  useEffect(() => {
    if (status !== 'open') return;
    const timer = setInterval(() => {
      void settlePrayers().catch(() => undefined);
      void settleBedtime().catch(() => undefined);
    }, 60_000);
    return () => clearInterval(timer);
  }, [status]);

  // Tapping an athan or reminder opens the prayer screen; tapping an alarm stops it.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void stopAlarm(response.notification.request.identifier)
        .then((isAlarm) => {
          if (isAlarm) return router.push('/alarms');
          const url = response.notification.request.content.data?.url;
          if (typeof url === 'string') router.push(url as Href);
        })
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  if (status !== 'open') {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {status === 'error' ? (
          <>
            <AppText variant="label" color="danger" align="center">
              {t('common.vaultError')}
            </AppText>
            <Button title={t('common.retry')} variant="secondary" onPress={() => setAttempt((value) => value + 1)} />
          </>
        ) : (
          <ActivityIndicator color={theme.primary} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <PrayerSheet />
      <BedtimeSheet />
      {locked ? <LockScreen /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.five },
});
