import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { SwitchRow } from '@/components/prayer/quality-settings';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { TrashIcon } from '@/components/ui/icons';
import { Card, Chips, Divider, IconButton, Row, Screen, Section } from '@/components/ui/layout';
import { TimeSpinner } from '@/components/ui/time-spinner';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import type { TestamentCategory } from '@/lib/ledger/types';
import {
  TESTAMENT_CATEGORIES,
  updateTestamentSchedule,
  useTestaments,
  useTestamentSchedule,
} from '@/lib/testaments/testaments';

const RANDOM_COUNTS = [0, 1, 2, 3, 5, 10];

function useClock(): (minutes: number) => string {
  const { format } = useLedgerLabels();
  return (minutes) => {
    const value = ((minutes % 1440) + 1440) % 1440;
    const pad = (n: number) => String(n).padStart(2, '0');
    return format.digits(`${pad(Math.floor(value / 60))}:${pad(value % 60)}`);
  };
}

/** When each category of Testaments notifies: on/off, random reminders in a window, fixed times. */
export default function TestamentSettingsScreen() {
  const { t } = useTranslation();
  return (
    <Screen back title={t('testaments.settings')} subtitle={t('testaments.settingsHint')}>
      <Row title={t('testaments.manage')} chevron onPress={() => router.push('/testaments')} />
      {TESTAMENT_CATEGORIES.map((category) => (
        <CategorySchedule key={category} category={category} />
      ))}
    </Screen>
  );
}

function CategorySchedule({ category }: { category: TestamentCategory }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const clock = useClock();
  const schedule = useTestamentSchedule(category);
  const count = useTestaments().filter((testament) => testament.category === category && testament.enabled).length;
  const [newTime, setNewTime] = useState(12 * 60);
  const update = (changes: Parameters<typeof updateTestamentSchedule>[1]) => void updateTestamentSchedule(category, changes);

  return (
    <Section title={t(`testaments.categories.${category}`)}>
      <Card>
        <SwitchRow
          label={t('testaments.notify')}
          hint={t('testaments.enabledCount', { n: format.number(count) })}
          value={schedule.enabled}
          onChange={(enabled) => update({ enabled })}
        />
      </Card>

      {schedule.enabled ? (
        <>
          <AppText variant="label" color="textSecondary">
            {t('testaments.randomPerDay')}
          </AppText>
          <Chips
            options={RANDOM_COUNTS.map((value) => ({ value, label: format.number(value) }))}
            value={schedule.random}
            onChange={(random) => update({ random })}
          />

          {schedule.random > 0 ? (
            <>
              <AppText variant="label" color="textSecondary">
                {t('testaments.window', { from: clock(schedule.from), to: clock(schedule.to) })}
              </AppText>
              <View style={styles.window}>
                <View>
                  <AppText variant="caption" color="textSecondary" align="center">
                    {t('testaments.from')}
                  </AppText>
                  <TimeSpinner
                    hour={Math.floor(schedule.from / 60)}
                    minute={schedule.from % 60}
                    onChange={(hour, minute) => update({ from: hour * 60 + minute })}
                  />
                </View>
                <View>
                  <AppText variant="caption" color="textSecondary" align="center">
                    {t('testaments.to')}
                  </AppText>
                  <TimeSpinner
                    hour={Math.floor(schedule.to / 60)}
                    minute={schedule.to % 60}
                    onChange={(hour, minute) => update({ to: hour * 60 + minute })}
                  />
                </View>
              </View>
            </>
          ) : null}

          <AppText variant="label" color="textSecondary">
            {t('testaments.fixedTimes')}
          </AppText>
          {schedule.times.length ? (
            <Card>
              {schedule.times.map((minutes, index) => (
                <Fragment key={minutes}>
                  {index > 0 ? <Divider /> : null}
                  <Row
                    title={clock(minutes)}
                    end={
                      <IconButton
                        label={t('common.delete')}
                        size={36}
                        onPress={() => update({ times: schedule.times.filter((value) => value !== minutes) })}>
                        <TrashIcon size={18} color={theme.danger} />
                      </IconButton>
                    }
                  />
                </Fragment>
              ))}
            </Card>
          ) : (
            <AppText variant="caption" color="textSecondary">
              {t('testaments.noFixedTimes')}
            </AppText>
          )}
          <TimeSpinner
            hour={Math.floor(newTime / 60)}
            minute={newTime % 60}
            onChange={(hour, minute) => setNewTime(hour * 60 + minute)}
          />
          <Button
            title={t('testaments.addTime', { time: clock(newTime) })}
            variant="secondary"
            onPress={() => update({ times: [...schedule.times, newTime] })}
          />
        </>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  window: { gap: Spacing.two },
});
