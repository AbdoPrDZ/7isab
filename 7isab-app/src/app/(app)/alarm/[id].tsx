import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { useAlarmLabels } from '@/components/alarms/alarm-labels';
import { TimeSpinner } from '@/components/ui/time-spinner';
import { useNow, usePrayerFormat } from '@/components/prayer/prayer-format';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { MinusIcon, PlusIcon } from '@/components/ui/icons';
import { Chips, IconButton, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteAlarm, nextRing, RING_AGAIN_TIMES, saveAlarm, type Alarm, type AlarmTime } from '@/lib/alarms/alarms';
import { weekOrder } from '@/lib/calendar/calendar';
import { addDays, toDay } from '@/lib/dates';
import { useDoc, useDocs } from '@/lib/data/vault';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { RecordTypes, type PrayerName } from '@/lib/ledger/types';
import { athanSounds } from '@/lib/prayer/notifications';
import { usePrayerSettings } from '@/lib/prayer/prayer';

const PRAYER_POINTS: (PrayerName | 'sunrise')[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const RING_AGAIN = [0, 5, 10];

/** Create or edit an alarm. */
export default function AlarmEditorScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useDoc<Alarm>(RecordTypes.alarm, id === 'new' ? undefined : id);
  useDocs<Alarm>(RecordTypes.alarm);
  const settings = usePrayerSettings();
  const now = useNow();
  const { format } = useLedgerLabels();
  const { time: clock } = usePrayerFormat();
  const { timeText } = useAlarmLabels();
  const sounds = athanSounds();

  const initial: AlarmTime = existing?.time ?? { kind: 'clock', hour: 5, minute: 0 };
  const [label, setLabel] = useState(existing?.label ?? '');
  const [kind, setKind] = useState<AlarmTime['kind']>(initial.kind);
  const [hour, setHour] = useState(initial.kind === 'clock' ? initial.hour : 5);
  const [minute, setMinute] = useState(initial.kind === 'clock' ? initial.minute : 0);
  const [prayer, setPrayer] = useState<PrayerName | 'sunrise'>(initial.kind === 'prayer' ? initial.prayer : 'fajr');
  const [offset, setOffset] = useState(initial.kind === 'prayer' ? initial.offset : -30);
  const [days, setDays] = useState<number[]>(existing?.days ?? []);
  const [sound, setSound] = useState(existing?.sound ?? 'default');
  const [ringAgain, setRingAgain] = useState(existing?.ringAgain ?? 5);
  const [saving, setSaving] = useState(false);

  const time: AlarmTime = kind === 'clock' ? { kind, hour, minute } : { kind, prayer, offset };
  // One-time alarms ring today if the time is still ahead, else tomorrow (as saveAlarm decides).
  const todayKey = toDay(now);
  const preview =
    nextRing({ time, days, onceDate: days.length ? null : todayKey, enabled: true }, settings, now) ??
    nextRing({ time, days, onceDate: addDays(todayKey, 1), enabled: true }, settings, now);

  const save = async () => {
    setSaving(true);
    // A task's alarm keeps its task (it rings on the task's due days, so its weekdays stay all).
    await saveAlarm({
      id: existing?.id,
      label: label.trim(),
      enabled: true,
      time,
      days: existing?.taskId ? [0, 1, 2, 3, 4, 5, 6] : days,
      sound,
      ringAgain,
      taskId: existing?.taskId,
    });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => void deleteAlarm(existing).then(() => router.back()),
      },
    ]);
  };

  const toggleDay = (day: number) =>
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));

  return (
    <Screen
      back
      title={existing ? t('alarm.editTitle') : t('alarm.newTitle')}
      footer={<Button title={t('common.save')} loading={saving} onPress={() => void save()} />}>
      <Section title={t('alarm.when')}>
        <Chips
          options={[
            { value: 'clock' as const, label: t('alarm.kinds.clock') },
            { value: 'prayer' as const, label: t('alarm.kinds.prayer') },
          ]}
          value={kind}
          onChange={setKind}
        />
        {kind === 'clock' ? (
          <TimeSpinner
            hour={hour}
            minute={minute}
            onChange={(h, m) => {
              setHour(h);
              setMinute(m);
            }}
          />
        ) : (
          <>
            <Chips
              options={PRAYER_POINTS.map((value) => ({ value, label: t(`prayer.names.${value}`) }))}
              value={prayer}
              onChange={setPrayer}
            />
            <View style={styles.offsetRow}>
              <IconButton label="−5" onPress={() => setOffset((value) => Math.max(-240, value - 5))}>
                <MinusIcon size={18} color={theme.primary} />
              </IconButton>
              <AppText variant="heading" align="center" style={styles.flex}>
                {timeText({ time })}
              </AppText>
              <IconButton label="+5" onPress={() => setOffset((value) => Math.min(240, value + 5))}>
                <PlusIcon size={18} color={theme.primary} />
              </IconButton>
            </View>
            {!settings.location ? (
              <AppText variant="caption" color="danger">
                {t('alarm.needsLocation')}
              </AppText>
            ) : null}
          </>
        )}
        {preview ? (
          <AppText variant="caption" color="primary" align="center">
            {t('alarm.preview', { day: format.day(toDay(preview), 'long'), time: clock(preview) })}
          </AppText>
        ) : null}
      </Section>

      <TextField
        label={t('alarm.label')}
        placeholder={t('alarm.labelPlaceholder')}
        value={label}
        onChangeText={setLabel}
      />

      {existing?.taskId ? (
        <AppText variant="caption" color="textSecondary">
          {t('alarm.taskBound')}
        </AppText>
      ) : (
        <Section title={t('alarm.repeat')}>
          <Chips
            options={weekOrder().map((value) => ({ value, label: t(`task.days.${value}`) }))}
            value={days}
            onChange={toggleDay}
          />
          <View style={styles.quickRow}>
            <Button
              title={t('alarm.everyDay')}
              variant="ghost"
              style={styles.flex}
              onPress={() => setDays([0, 1, 2, 3, 4, 5, 6])}
            />
            <Button title={t('alarm.once')} variant="ghost" style={styles.flex} onPress={() => setDays([])} />
          </View>
          <AppText variant="caption" color="textSecondary">
            {days.length ? (days.length === 7 ? t('alarm.everyDay') : t('alarm.onDays')) : t('alarm.onceHint')}
          </AppText>
        </Section>
      )}

      <Section title={t('alarm.sound')}>
        <Chips
          options={[
            { value: 'default', label: t('prayer.sounds.default') },
            ...sounds.map((file) => ({ value: file, label: file.replace(/\.[a-z0-9]+$/, '').replace(/_/g, ' ') })),
          ]}
          value={sound}
          onChange={setSound}
        />
      </Section>

      <Section title={t('alarm.ringAgain')}>
        <Chips
          options={RING_AGAIN.map((value) => ({
            value,
            label: value ? t('alarm.everyMinutes', { minutes: format.number(value) }) : t('prayer.off'),
          }))}
          value={ringAgain}
          onChange={setRingAgain}
        />
        <AppText variant="caption" color="textSecondary">
          {ringAgain ? t('alarm.ringAgainHint', { times: format.number(RING_AGAIN_TIMES) }) : t('alarm.ringOnceHint')}
        </AppText>
      </Section>

      {existing ? <Button title={t('common.delete')} variant="ghost" onPress={remove} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  offsetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  quickRow: { flexDirection: 'row', gap: Spacing.two },
});
