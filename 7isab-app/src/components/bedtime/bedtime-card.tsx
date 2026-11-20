/**
 * Today tab: tonight's bedtime and its state, and last night when it still
 * needs an answer ("When did you sleep last night?"). Tapping a night opens
 * the bedtime sheet. Hidden while bedtime is off.
 */
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { usePrayerFormat } from '@/components/prayer/prayer-format';
import { Card, Divider, Row, Section } from '@/components/ui/layout';
import {
  bedtimeMark,
  bedtimeOf,
  bedtimeState,
  canMarkNight,
  getBedtimeTask,
  useBedtimeSettings,
  type BedtimeState,
} from '@/lib/bedtime/bedtime';
import { addDays, today } from '@/lib/dates';
import { useDocs } from '@/lib/data/vault';
import { RecordTypes, type Task, type TaskProgress } from '@/lib/ledger/types';

import { openBedtimeSheet } from './bedtime-sheet';

const COLORS: Record<BedtimeState, 'primary' | 'danger' | 'textSecondary' | 'text'> = {
  onTime: 'primary',
  late: 'danger',
  missed: 'danger',
  open: 'text',
  upcoming: 'textSecondary',
};

export function BedtimeCard() {
  const { t } = useTranslation();
  const { time: clock } = usePrayerFormat();
  const settings = useBedtimeSettings();
  // Re-render on marks and when the task is created / archived.
  useDocs<TaskProgress>(RecordTypes.progress);
  useDocs<Task>(RecordTypes.task);

  const task = getBedtimeTask();
  if (!settings.enabled || !task || task.archived) return null;

  const now = new Date();
  const tonight = today();
  const lastNight = addDays(tonight, -1);
  const lastState = bedtimeState(lastNight, now);
  const nights = [
    ...(lastNight >= task.startDate && lastState === 'open' ? [{ night: lastNight, label: t('bedtime.lastNight') }] : []),
    { night: tonight, label: t('bedtime.tonight') },
  ];

  const subtitle = (night: string, state: BedtimeState) => {
    const mark = bedtimeMark(night);
    if (mark?.sleptAt) return t('bedtime.sleptAtLine', { time: clock(new Date(mark.sleptAt)) });
    if (night === lastNight && state === 'open') return t('bedtime.askLastNight');
    const { at, onTimeUntil } = bedtimeOf(night, settings);
    return t('bedtime.bedtimeLine', { time: clock(at), until: clock(onTimeUntil) });
  };

  return (
    <Section title={t('bedtime.title')}>
      <Card>
        {nights.map(({ night, label }, index) => {
          const state = bedtimeState(night, now);
          const canMark = canMarkNight(night, now);
          return (
            <Fragment key={night}>
              {index > 0 ? <Divider /> : null}
              <Row
                title={label}
                subtitle={subtitle(night, state)}
                value={t(`bedtime.states.${state}`)}
                valueColor={COLORS[state]}
                onPress={canMark ? () => openBedtimeSheet(night) : undefined}
                chevron={canMark}
              />
            </Fragment>
          );
        })}
      </Card>
    </Section>
  );
}
