/**
 * Today tab: the next prayer with a countdown, and the five prayers of the day
 * with their state: prayed, missed (deadline passed unmarked), open (can still
 * be marked, until its deadline) or not yet. Tapping marks / un-marks it.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { CheckIcon } from '@/components/ui/icons';
import { Card } from '@/components/ui/layout';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toDay, today } from '@/lib/dates';
import { useDocs } from '@/lib/data/vault';
import { RecordTypes, type PrayerName, type Task, type TaskProgress } from '@/lib/ledger/types';
import { nextPrayer, prayerDeadline, prayerNameKey, PRAYERS, prayerTimes, usePrayerSettings } from '@/lib/prayer/prayer';
import { startPrayers } from '@/lib/prayer/setup';
import { canMarkPrayer, prayerState } from '@/lib/prayer/tasks';

import { useNow, usePrayerFormat } from './prayer-format';
import { openPrayerSheet } from './prayer-sheet';

/** One prayer in the day strip: name, time and its state (prayed / missed / open / not yet). */
function PrayerCell({
  prayer,
  time,
  day,
  now,
  tracked,
}: {
  prayer: PrayerName;
  time: Date;
  day: string;
  now: Date;
  /** Prayer tasks on: show states and let the user mark. */
  tracked: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { time: clock } = usePrayerFormat();
  const settings = usePrayerSettings();
  const state = prayerState(prayer, day, now);
  const enabled = tracked && canMarkPrayer(prayer, day, now);
  const prayed = state === 'prayed' || state === 'combined';
  const deadline = prayerDeadline(settings, prayer, day);

  const look = {
    prayed: { background: theme.primarySoft, border: theme.primary, color: 'primary' as const },
    combined: { background: theme.prayerCombinedSoft, border: theme.prayerCombined, color: 'text' as const },
    late: { background: theme.prayerLateSoft, border: theme.prayerLate, color: 'text' as const },
    missed: { background: theme.dangerSoft, border: theme.danger, color: 'danger' as const },
    open: { background: theme.accentSoft, border: theme.accent, color: 'text' as const },
    upcoming: { background: theme.surface, border: theme.border, color: 'textSecondary' as const },
  }[tracked ? state : 'upcoming'];

  const status = !tracked
    ? null
    : state === 'open' && deadline
      ? t('prayer.states.openUntil', { time: clock(deadline) })
      : t(`prayer.states.${state}`);

  return (
    <Pressable
      accessibilityRole={enabled ? 'checkbox' : undefined}
      accessibilityState={{ checked: prayed, disabled: !enabled }}
      accessibilityLabel={`${t(`prayer.names.${prayerNameKey(prayer, day)}`)} ${clock(time)}${status ? `, ${status}` : ''}`}
      disabled={!enabled}
      onPress={() => openPrayerSheet(prayer, day)}
      style={[
        styles.cell,
        {
          backgroundColor: look.background,
          borderColor: look.border,
          borderWidth: state === 'open' && tracked ? 2 : 1,
        },
      ]}>
      <AppText
        variant="caption"
        weight="semibold"
        color={state === 'upcoming' ? 'textSecondary' : 'text'}
        numberOfLines={1}>
        {t(`prayer.names.${prayerNameKey(prayer, day)}`)}
      </AppText>
      <AppText variant="label" weight="bold" numberOfLines={1}>
        {clock(time)}
      </AppText>
      {tracked ? (
        <View
          style={[
            styles.check,
            {
              borderColor: look.border,
              backgroundColor:
                state === 'late'
                  ? theme.prayerLate
                  : state === 'combined'
                    ? theme.prayerCombined
                    : prayed
                      ? theme.primary
                      : state === 'missed'
                        ? theme.danger
                        : 'transparent',
            },
            state === 'upcoming' && styles.dim,
          ]}>
          {prayed || state === 'late' ? <CheckIcon size={14} color={theme.textOnPrimary} /> : null}
          {state === 'missed' ? (
            <AppText variant="caption" weight="bold" style={{ color: theme.textOnPrimary, lineHeight: 16 }}>
              ✕
            </AppText>
          ) : null}
        </View>
      ) : null}
      {status ? (
        <AppText variant="caption" color={look.color} numberOfLines={2} align="center" style={styles.status}>
          {status}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function PrayerCard() {
  const { t } = useTranslation();
  const settings = usePrayerSettings();
  const now = useNow();
  const { time: clock, countdown } = usePrayerFormat();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Re-render when a prayer is checked (progress) or the tasks change.
  useDocs<TaskProgress>(RecordTypes.progress);
  useDocs<Task>(RecordTypes.task);

  if (!settings.location) {
    const start = async () => {
      setBusy(true);
      setError(null);
      const result = await startPrayers();
      setBusy(false);
      if (!result.ok) setError(t(result.reason === 'denied' ? 'prayer.locationDenied' : 'prayer.locationUnavailable'));
    };
    return (
      <Card>
        <AppText variant="heading">{t('prayer.title')}</AppText>
        <AppText variant="caption" color="textSecondary">
          {t('prayer.setupHint')}
        </AppText>
        {error ? (
          <AppText variant="caption" color="danger">
            {error}
          </AppText>
        ) : null}
        <Button title={t('prayer.useLocation')} loading={busy} onPress={() => void start()} />
      </Card>
    );
  }

  const day = today();
  const times = prayerTimes(settings, day);
  const next = nextPrayer(settings, now);
  if (!times || !next) return null;

  return (
    <Card>
      <Pressable accessibilityRole="button" onPress={() => router.push('/prayer')} style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="caption" color="textSecondary">
            {t('prayer.next')}
            {settings.location.city ? ` · ${settings.location.city}` : ''}
          </AppText>
          <AppText variant="heading">
            {t(`prayer.names.${prayerNameKey(next.prayer, toDay(next.time))}`)} · {clock(next.time)}
          </AppText>
        </View>
        <AppText variant="label" weight="semibold" color="primary">
          {countdown(next.time, now)}
        </AppText>
      </Pressable>
      <View style={styles.strip}>
        {PRAYERS.map((prayer) => (
          <PrayerCell key={prayer} prayer={prayer} time={times[prayer]} day={day} now={now} tracked={settings.tasks} />
        ))}
      </View>
      {settings.tasks ? (
        <AppText variant="caption" color="textSecondary">
          {t('prayer.cardHint')}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  strip: { flexDirection: 'row', gap: Spacing.one },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dim: { opacity: 0.35 },
  status: { fontSize: 10, lineHeight: 13 },
});
