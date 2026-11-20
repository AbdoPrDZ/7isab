/**
 * The sheet that opens for a night: enter the time you went to sleep. By
 * bedtime + grace it is on time; later, pick a reason (excused or a Thanb).
 * "I don't remember" counts as a late night (Thanb). A marked night can be
 * changed or un-marked. Rendered once in the app layout; opened with
 * openBedtimeSheet() from anywhere.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { usePrayerFormat } from '@/components/prayer/prayer-format';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Chips } from '@/components/ui/layout';
import { TimeSpinner } from '@/components/ui/time-spinner';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  atNight,
  bedtimeMark,
  bedtimeOf,
  markBedtime,
  sleepTiming,
  unmarkBedtime,
  useBedtimeSettings,
} from '@/lib/bedtime/bedtime';
import { today } from '@/lib/dates';
import { useDocs } from '@/lib/data/vault';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { useReasonName, useReasons } from '@/lib/ledger/reasons';
import { RecordTypes, type TaskProgress } from '@/lib/ledger/types';

const useSheet = create<{ night: string | null }>(() => ({ night: null }));

export function openBedtimeSheet(night: string): void {
  useSheet.setState({ night });
}

function close() {
  useSheet.setState({ night: null });
}

function SheetBody({ night }: { night: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const { time: clock } = usePrayerFormat();
  const settings = useBedtimeSettings();
  const reasons = useReasons('bedtime');
  const reasonName = useReasonName();
  useDocs<TaskProgress>(RecordTypes.progress);

  const mark = bedtimeMark(night);
  const now = new Date();
  const { at: bedtime, onTimeUntil } = bedtimeOf(night, settings);
  // Default: the time already marked, else now (if past bedtime), else bedtime.
  const initial = mark?.sleptAt ? new Date(mark.sleptAt) : now > bedtime ? now : bedtime;
  const [editing, setEditing] = useState(!mark);
  const [hour, setHour] = useState(initial.getHours());
  const [minute, setMinute] = useState(initial.getMinutes());
  const [reasonId, setReasonId] = useState<string | undefined>(mark?.reasonId);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const at = atNight(night, hour, minute);
  const timing = sleepTiming(night, at, now);
  const late = timing.ok && timing.late;
  const reason = reasons.find((item) => item.id === reasonId);
  const canSave = timing.ok && (!late || !!reason);

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

  const statusBox = (tone: 'ok' | 'late' | 'error', text: string, lines: string[] = []) => (
    <View
      style={[
        styles.status,
        {
          backgroundColor: tone === 'error' ? theme.dangerSoft : tone === 'late' ? theme.prayerLateSoft : theme.primarySoft,
          borderColor: tone === 'error' ? theme.danger : tone === 'late' ? theme.prayerLate : theme.primary,
        },
      ]}>
      <AppText variant="label" weight="semibold" align="center" color={tone === 'error' ? 'danger' : tone === 'late' ? 'text' : 'primary'}>
        {text}
      </AppText>
      {lines.map((line) => (
        <AppText key={line} variant="caption" color="textSecondary" align="center">
          {line}
        </AppText>
      ))}
    </View>
  );

  return (
    <>
      <AppText variant="heading" align="center">
        {t('bedtime.sheetTitle')}
      </AppText>
      <AppText variant="caption" color="textSecondary" align="center">
        {night === today() ? t('bedtime.tonight') : t('bedtime.nightOf', { day: format.day(night, 'long') })}
        {' · '}
        {t('bedtime.bedtimeLine', { time: clock(bedtime), until: clock(onTimeUntil) })}
      </AppText>

      {mark && !editing ? (
        <>
          {statusBox(
            mark.status === 'late' ? 'late' : 'ok',
            mark.status === 'late' ? t('bedtime.markedLate') : t('bedtime.markedOnTime'),
            [
              ...(mark.sleptAt ? [t('bedtime.sleptAtLine', { time: clock(new Date(mark.sleptAt)) })] : []),
              ...(mark.cause ? [t('bedtime.reasonLine', { reason: mark.cause })] : []),
            ],
          )}
          <Button title={t('bedtime.change')} variant="secondary" onPress={() => setEditing(true)} />
          <Button title={t('bedtime.unmark')} variant="ghost" loading={busy} onPress={() => void run(() => unmarkBedtime(night))} />
        </>
      ) : (
        <>
          <AppText variant="label" weight="semibold" align="center">
            {t('bedtime.sleptQuestion')}
          </AppText>
          <TimeSpinner
            hour={hour}
            minute={minute}
            onChange={(h, m) => {
              setHour(h);
              setMinute(m);
            }}
          />
          {!timing.ok
            ? statusBox('error', t(timing.reason === 'future' ? 'bedtime.timeFuture' : 'bedtime.timeBefore'))
            : late
              ? statusBox('late', t('bedtime.lateBy', { time: clock(timing.onTimeUntil) }))
              : statusBox('ok', t('bedtime.onTime'))}
          {late ? (
            <>
              <AppText variant="label" weight="semibold">
                {t('bedtime.reasonQuestion')}
              </AppText>
              <Chips
                options={reasons.map((item) => ({ value: item.id, label: reasonName(item) }))}
                value={reasonId ?? []}
                onChange={setReasonId}
              />
              {reason ? (
                <AppText variant="caption" color={reason.thanb ? 'danger' : 'primary'}>
                  {reason.thanb ? t('bedtime.reasonThanb') : t('bedtime.reasonExcused')}
                </AppText>
              ) : null}
            </>
          ) : null}
          <Button
            title={late ? t('bedtime.saveLate') : t('bedtime.saveOnTime')}
            disabled={!canSave}
            loading={busy}
            onPress={() => void run(() => markBedtime(night, at, { reasonId: late ? reasonId : undefined }))}
          />
          <Button
            title={t('bedtime.dontRemember')}
            variant="ghost"
            onPress={() => void run(() => markBedtime(night, null, { unknown: true }))}
          />
        </>
      )}

      {failed ? (
        <AppText variant="caption" color="danger" align="center">
          {t('bedtime.saveFailed')}
        </AppText>
      ) : null}
      <Button title={t('common.cancel')} variant="ghost" onPress={close} />
    </>
  );
}

/** Mount once (app layout). */
export function BedtimeSheet() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { night } = useSheet();

  return (
    <Modal visible={night !== null} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.flex}>
        <Pressable accessibilityRole="button" style={styles.backdrop} onPress={close} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.four },
          ]}>
          <ScrollView contentContainerStyle={styles.content}>
            {night ? <SheetBody key={night} night={night} /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    borderWidth: 1,
    padding: Spacing.four,
  },
  content: { gap: Spacing.three },
  status: { borderRadius: Radius.medium, borderWidth: 1, padding: Spacing.three, gap: 2 },
});
