/**
 * The sheet that opens when a prayer is tapped: enter the time you prayed it,
 * and it is on time (before its safe time ends) or late (cause required);
 * or combine it with its pair (jam': Dhuhr ↔ Asr, Maghrib ↔ Isha; never
 * Fajr); or un-mark it. Rendered once in the app layout and opened
 * with openPrayerSheet() from anywhere.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Chips } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { TimeSpinner } from '@/components/ui/time-spinner';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { today } from '@/lib/dates';
import { useDocs } from '@/lib/data/vault';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { RecordTypes, type PrayerName, type TaskProgress } from '@/lib/ledger/types';
import { prayerTimes, usePrayerSettings } from '@/lib/prayer/prayer';
import {
  canMarkPrayer,
  combineTiming,
  COMBINE_PAIRS,
  markPrayer,
  prayedAtFor,
  prayerMark,
  prayerTiming,
  unmarkPrayer,
} from '@/lib/prayer/tasks';

import { usePrayerFormat } from './prayer-format';

type SheetState = { prayer: PrayerName | null; day: string };

const useSheet = create<SheetState>(() => ({ prayer: null, day: today() }));

export function openPrayerSheet(prayer: PrayerName, day: string): void {
  useSheet.setState({ prayer, day });
}

function close() {
  useSheet.setState({ prayer: null });
}

const LATE_CAUSES = ['sleep', 'forgot', 'work', 'travel', 'illness', 'other'] as const;
const COMBINE_CAUSES = ['travel', 'illness', 'rain', 'other'] as const;

type Step = 'mark' | 'combine';

function SheetBody({ prayer, day }: { prayer: PrayerName; day: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const { time: clock } = usePrayerFormat();
  const settings = usePrayerSettings();
  // Re-render when a mark changes.
  useDocs<TaskProgress>(RecordTypes.progress);

  const now = new Date();
  const time = prayerTimes(settings, day)?.[prayer];
  // Default prayed time: now (today, once its time has started), else the athan time.
  const initial = day === today() && (!time || time <= now) ? now : (time ?? now);
  const [step, setStep] = useState<Step>('mark');
  const [hour, setHour] = useState(initial.getHours());
  const [minute, setMinute] = useState(initial.getMinutes());
  const [cause, setCause] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const mark = prayerMark(prayer, day);
  const pair = COMBINE_PAIRS[prayer];
  const canCombine = !!pair && prayerMark(pair, day) === null;
  const ownTimeStarted = !!time && time <= now;
  const name = t(`prayer.names.${prayer}`);
  const at = prayedAtFor(prayer, day, hour, minute);
  const timing = step === 'combine' ? combineTiming(prayer, day, at, now) : prayerTiming(prayer, day, at, now);
  const late = timing.ok && timing.status === 'late';
  const canSave = timing.ok && (!late || cause.trim().length > 0);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      close();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const causeChips = (keys: readonly string[]) => (
    <Chips
      options={keys.map((key) => ({ value: t(`prayer.causes.${key}`), label: t(`prayer.causes.${key}`) }))}
      value={cause}
      onChange={setCause}
    />
  );

  const timeInput = (
    <>
      <AppText variant="label" weight="semibold" align="center">
        {t('prayer.prayedAtQuestion')}
      </AppText>
      <TimeSpinner
        hour={hour}
        minute={minute}
        onChange={(h, m) => {
          setHour(h);
          setMinute(m);
        }}
      />
      <View
        style={[
          styles.status,
          {
            backgroundColor: !timing.ok ? theme.dangerSoft : late ? theme.prayerLateSoft : theme.primarySoft,
            borderColor: !timing.ok ? theme.danger : late ? theme.prayerLate : theme.primary,
          },
        ]}>
        <AppText
          variant="label"
          weight="semibold"
          align="center"
          color={!timing.ok ? 'danger' : late ? 'text' : 'primary'}>
          {!timing.ok
            ? t(timing.reason === 'future' ? 'prayer.timeFuture' : 'prayer.timeBefore')
            : late
              ? t('prayer.lateBy', { time: timing.safeUntil ? clock(timing.safeUntil) : '' })
              : step === 'combine'
                ? t('prayer.combinedOnTime', { time: timing.safeUntil ? clock(timing.safeUntil) : '' })
                : t('prayer.inTime', { time: timing.safeUntil ? clock(timing.safeUntil) : '' })}
        </AppText>
      </View>
    </>
  );

  return (
    <>
      <AppText variant="heading" align="center">
        {name}
        {time ? ` · ${clock(time)}` : ''}
      </AppText>
      <AppText variant="caption" color="textSecondary" align="center">
        {day === today() ? t('prayer.today') : format.day(day, 'long')}
      </AppText>

      {mark ? (
        <>
          <View
            style={[
              styles.status,
              {
                backgroundColor:
                  mark.status === 'late'
                    ? theme.prayerLateSoft
                    : mark.status === 'combined'
                      ? theme.prayerCombinedSoft
                      : theme.primarySoft,
                borderColor:
                  mark.status === 'late'
                    ? theme.prayerLate
                    : mark.status === 'combined'
                      ? theme.prayerCombined
                      : theme.primary,
              },
            ]}>
            <AppText
              variant="label"
              weight="semibold"
              color={mark.status === 'onTime' ? 'primary' : 'text'}
              align="center">
              {mark.status === 'late' && mark.combinedWith
                ? t('prayer.markedLateCombined', { other: t(`prayer.names.${mark.combinedWith}`) })
                : mark.status === 'late'
                  ? t('prayer.markedLate')
                  : mark.status === 'combined' && mark.combinedWith
                    ? t('prayer.markedCombined', { other: t(`prayer.names.${mark.combinedWith}`) })
                    : t('prayer.markedOnTime')}
            </AppText>
            {mark.prayedAt ? (
              <AppText variant="caption" color="textSecondary" align="center">
                {t('prayer.prayedAtLine', { time: clock(new Date(mark.prayedAt)) })}
              </AppText>
            ) : null}
            {mark.cause ? (
              <AppText variant="caption" color="textSecondary" align="center">
                {t('prayer.causeLine', { cause: mark.cause })}
              </AppText>
            ) : null}
          </View>
          <Button
            title={mark.combinedWith ? t('prayer.unmarkBoth') : t('prayer.unmark')}
            variant="secondary"
            loading={busy}
            onPress={() => void run(() => unmarkPrayer(prayer, day))}
          />
        </>
      ) : step === 'mark' && ownTimeStarted ? (
        <>
          {timeInput}
          {late ? (
            <>
              <AppText variant="label" weight="semibold">
                {t('prayer.lateCause')}
              </AppText>
              {causeChips(LATE_CAUSES)}
              <TextField label={t('prayer.causeLabel')} value={cause} onChangeText={setCause} />
            </>
          ) : null}
          <Button
            title={late ? t('prayer.saveLate') : t('prayer.saveOnTime')}
            disabled={!canSave}
            loading={busy}
            onPress={() => void run(() => markPrayer(prayer, day, at, { cause }))}
          />
          {canCombine && canMarkPrayer(prayer, day, now) ? (
            <Button
              title={t('prayer.combineWith', { other: t(`prayer.names.${pair}`) })}
              variant="secondary"
              onPress={() => {
                setCause('');
                setStep('combine');
              }}
            />
          ) : null}
        </>
      ) : canCombine ? (
        <>
          <AppText variant="label" weight="semibold">
            {t('prayer.combineTitle', { a: name, b: pair ? t(`prayer.names.${pair}`) : '' })}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {t('prayer.combineHint')}
          </AppText>
          {timeInput}
          {causeChips(COMBINE_CAUSES)}
          <TextField
            label={late ? t('prayer.causeLabel') : t('prayer.causeOptional')}
            value={cause}
            onChangeText={setCause}
          />
          <Button
            title={late ? t('prayer.saveCombinedLate') : t('prayer.saveCombined')}
            disabled={!canSave}
            loading={busy}
            onPress={() => void run(() => markPrayer(prayer, day, at, { cause, combine: true }))}
          />
          {ownTimeStarted ? <Button title={t('prayer.back')} variant="ghost" onPress={() => setStep('mark')} /> : null}
        </>
      ) : (
        <AppText variant="label" color="textSecondary" align="center">
          {t('prayer.notYet')}
        </AppText>
      )}

      {failed ? (
        <AppText variant="caption" color="danger" align="center">
          {t('prayer.saveFailed')}
        </AppText>
      ) : null}
      <Button title={t('common.cancel')} variant="ghost" onPress={close} />
    </>
  );
}

/** Mount once (app layout). */
export function PrayerSheet() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { prayer, day } = useSheet();

  return (
    <Modal visible={prayer !== null} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Pressable accessibilityRole="button" style={styles.backdrop} onPress={close} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              paddingBottom: insets.bottom + Spacing.four,
            },
          ]}>
          {/* Keyed so the steps and the cause reset for each prayer. */}
          {prayer ? <SheetBody key={`${prayer}:${day}`} prayer={prayer} day={day} /> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  status: { borderRadius: Radius.medium, borderWidth: 1, padding: Spacing.three, gap: 2 },
});
