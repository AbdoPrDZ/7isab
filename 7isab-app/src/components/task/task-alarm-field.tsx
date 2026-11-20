/**
 * The alarm of a task, in the task editor: off, at a clock time, or relative
 * to a prayer (or sunrise). It rings on the days the task is due and is
 * skipped once the task is done.
 */
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/app-text';
import { Chips, Section } from '@/components/ui/layout';
import { TimeSpinner } from '@/components/ui/time-spinner';
import type { AlarmTime } from '@/lib/alarms/alarms';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import type { PrayerName } from '@/lib/ledger/types';

export type TaskAlarmState = {
  mode: 'off' | 'clock' | 'prayer';
  hour: number;
  minute: number;
  prayer: PrayerName | 'sunrise';
  offset: number;
};

const POINTS: (PrayerName | 'sunrise')[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const OFFSETS = [-30, -15, -10, 0, 10, 15, 30, 60];

export function alarmStateFrom(time: AlarmTime | undefined): TaskAlarmState {
  if (time?.kind === 'clock') return { mode: 'clock', hour: time.hour, minute: time.minute, prayer: 'fajr', offset: 0 };
  if (time?.kind === 'prayer') return { mode: 'prayer', hour: 7, minute: 0, prayer: time.prayer, offset: time.offset };
  return { mode: 'off', hour: 7, minute: 0, prayer: 'fajr', offset: 0 };
}

export function alarmTimeFrom(state: TaskAlarmState): AlarmTime | null {
  if (state.mode === 'clock') return { kind: 'clock', hour: state.hour, minute: state.minute };
  if (state.mode === 'prayer') return { kind: 'prayer', prayer: state.prayer, offset: state.offset };
  return null;
}

export function TaskAlarmField({ value, onChange }: { value: TaskAlarmState; onChange: (value: TaskAlarmState) => void }) {
  const { t } = useTranslation();
  const { format } = useLedgerLabels();

  return (
    <Section title={t('task.alarm.title')}>
      <Chips
        options={(['off', 'clock', 'prayer'] as const).map((mode) => ({ value: mode, label: t(`task.alarm.modes.${mode}`) }))}
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode })}
      />
      {value.mode === 'clock' ? (
        <TimeSpinner hour={value.hour} minute={value.minute} onChange={(hour, minute) => onChange({ ...value, hour, minute })} />
      ) : null}
      {value.mode === 'prayer' ? (
        <>
          <Chips
            options={POINTS.map((prayer) => ({ value: prayer, label: t(`prayer.names.${prayer}`) }))}
            value={value.prayer}
            onChange={(prayer) => onChange({ ...value, prayer })}
          />
          <Chips
            options={OFFSETS.map((offset) => ({
              value: offset,
              label:
                offset === 0
                  ? t('task.alarm.atTime')
                  : offset < 0
                    ? t('task.alarm.before', { minutes: format.number(-offset) })
                    : t('task.alarm.after', { minutes: format.number(offset) }),
            }))}
            value={value.offset}
            onChange={(offset) => onChange({ ...value, offset })}
          />
        </>
      ) : null}
      {value.mode !== 'off' ? (
        <AppText variant="caption" color="textSecondary">
          {t('task.alarm.hint')}
        </AppText>
      ) : null}
    </Section>
  );
}
