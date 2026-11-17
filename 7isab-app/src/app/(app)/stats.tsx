import { useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { FlowChart, MeterRow, StatGrid, StatTile } from '@/components/stats/charts';
import { DunyaSection } from '@/components/stats/dunya-section';
import { AppText } from '@/components/ui/app-text';
import { BackIcon } from '@/components/ui/icons';
import { Card, Chips, Divider, Screen, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { today } from '@/lib/dates';
import { useDocs } from '@/lib/data/vault';
import type { AthkarDay } from '@/lib/athkar/athkar';
import { useEntries, useLedgerLabels, useSinTypes, useTasks } from '@/lib/ledger/hooks';
import { RecordTypes } from '@/lib/ledger/types';
import type { ReadingDay } from '@/lib/quran/reading';
import {
  akhiraStats,
  athkarStats,
  change,
  chartMonths,
  monthlyAkhira,
  periodKey,
  readingStats,
  shiftKey,
  type StatsPeriod,
} from '@/lib/stats/stats';

type Tab = 'dunya' | 'akhira';

function PeriodNav({
  label,
  onPrev,
  onNext,
  canNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
}) {
  const theme = useTheme();
  const { isRtl } = useDirection();
  return (
    <View style={styles.periodRow}>
      <Pressable accessibilityRole="button" hitSlop={10} onPress={onPrev}>
        <BackIcon size={22} color={theme.primary} flip={isRtl} />
      </Pressable>
      <AppText variant="heading" align="center" style={styles.flex}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        hitSlop={10}
        disabled={!canNext}
        onPress={onNext}
        style={{ opacity: canNext ? 1 : 0.3 }}>
        <BackIcon size={22} color={theme.primary} flip={!isRtl} />
      </Pressable>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <AppText variant="label" color="textSecondary" align="center">
      {text}
    </AppText>
  );
}

/** Statistics for a month or a year: Dunya (money) and Akhira (deeds). */
export default function StatsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const params = useLocalSearchParams<{ tab?: Tab; account?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'akhira' ? 'akhira' : 'dunya');
  const [accountId, setAccountId] = useState(params.account ?? '');
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const [key, setKey] = useState(periodKey(today(), 'month'));

  const entries = useEntries();
  const tasks = useTasks();
  const sinTypes = useSinTypes();
  const readingDays = useDocs<ReadingDay>(RecordTypes.readingDay);
  const athkarDays = useDocs<AthkarDay>(RecordTypes.athkarDay);
  const { format, mainCurrency, sinName } = useLedgerLabels();

  const changePeriod = (next: StatsPeriod) => {
    setPeriod(next);
    setKey(periodKey(today(), next));
  };
  const currentKey = periodKey(today(), period);
  const previousKey = shiftKey(key, period, -1);
  const periodLabel = period === 'month' ? format.month(key) : format.digits(key);
  const versus = (percent: string) => t(period === 'month' ? 'stats.vsLastMonth' : 'stats.vsLastYear', { percent });
  const money = (value: number) => format.money(value, mainCurrency);
  const percent = (value: number) => `${format.number(Math.round(value * 100))}%`;
  const monthLabel = (month: string, short: boolean) =>
    short
      ? period === 'year'
        ? format.number(Number(month.slice(5)))
        : format.month(month).split(' ')[0]
      : format.month(month);

  // ------------------------------------------------------------ Akhira
  const akhira = akhiraStats(entries, key);
  const akhiraBefore = akhiraStats(entries, previousKey);
  const points = monthlyAkhira(entries, chartMonths(key, period));
  const reading = readingStats(readingDays, key, period);
  const readingBefore = readingStats(readingDays, previousKey, period);
  const athkar = athkarStats(athkarDays, key);
  const completion = akhira.tasksTotal ? akhira.tasksDone / akhira.tasksTotal : null;
  const completionBefore = akhiraBefore.tasksTotal ? akhiraBefore.tasksDone / akhiraBefore.tasksTotal : null;
  const taskRows = [...akhira.tasks.entries()]
    .map(([id, row]) => ({ id, ...row, title: tasks.find((task) => task.id === id)?.title ?? t('stats.deletedTask') }))
    .sort((a, b) => a.done / a.total - b.done / b.total);
  const sinMax = Math.max(1, ...akhira.sins.map(([, count]) => count));

  return (
    <Screen back title={t('stats.title')}>
      <Chips
        options={[
          { value: 'dunya' as Tab, label: t('stats.dunya') },
          { value: 'akhira' as Tab, label: t('stats.akhira') },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Chips
        options={[
          { value: 'month' as StatsPeriod, label: t('stats.month') },
          { value: 'year' as StatsPeriod, label: t('stats.year') },
        ]}
        value={period}
        onChange={changePeriod}
      />
      <PeriodNav
        label={periodLabel}
        onPrev={() => setKey(previousKey)}
        onNext={() => setKey(shiftKey(key, period, 1))}
        canNext={key < currentKey}
      />

      {tab === 'dunya' ? (
        <DunyaSection
          periodKey={key}
          previousKey={previousKey}
          period={period}
          accountId={accountId}
          onAccountChange={setAccountId}
          versus={versus}
          monthLabel={monthLabel}
          percent={percent}
        />
      ) : (
        <>
          <StatGrid>
            <StatTile
              label={t('stats.earned')}
              value={format.points(akhira.earned)}
              valueColor="primary"
              delta={change(akhira.earned, akhiraBefore.earned)}
              deltaLabel={versus}
            />
            <StatTile
              label={t('stats.lost')}
              value={format.points(akhira.lost)}
              valueColor={akhira.lost > 0 ? 'danger' : 'text'}
              delta={change(akhira.lost, akhiraBefore.lost)}
              deltaLabel={versus}
              goodWhenUp={false}
            />
            <StatTile
              label={t('stats.netPoints')}
              value={`${akhira.net > 0 ? '+' : ''}${format.points(akhira.net)}`}
              valueColor={akhira.net < 0 ? 'danger' : 'primary'}
            />
            <StatTile
              label={t('stats.completion')}
              value={completion === null ? '—' : percent(completion)}
              delta={completion !== null && completionBefore !== null ? completion - completionBefore : null}
              deltaLabel={versus}
            />
          </StatGrid>

          <Section title={t('stats.pointsByMonth')}>
            <Card>
              <FlowChart
                key={`${period}-${key}`}
                data={points}
                inLabel={t('stats.earned')}
                outLabel={t('stats.lost')}
                netLabel={t('stats.netPoints')}
                formatValue={format.points}
                monthLabel={monthLabel}
              />
            </Card>
          </Section>

          <Section title={t('stats.tasks')}>
            <Card>
              {taskRows.length ? (
                taskRows.map((row, index) => (
                  <Fragment key={row.id}>
                    {index > 0 ? <Divider /> : null}
                    <MeterRow
                      label={row.title}
                      value={t('stats.doneOf', { done: format.number(row.done), total: format.number(row.total) })}
                      ratio={row.done / row.total}
                      color={row.done === row.total ? theme.accent : theme.primary}
                    />
                  </Fragment>
                ))
              ) : (
                <Empty text={t('stats.noTasks')} />
              )}
            </Card>
          </Section>

          <Section title={t('stats.quran')}>
            <StatGrid>
              <StatTile
                label={t('stats.wordsRead')}
                value={format.number(reading.words)}
                delta={change(reading.words, readingBefore.words)}
                deltaLabel={versus}
              />
              <StatTile label={t('stats.pagesRead')} value={format.number(reading.pages)} />
              <StatTile
                label={t('stats.readingDays')}
                value={t('stats.daysOf', { days: format.number(reading.active), total: format.number(reading.days) })}
              />
              <StatTile label={t('stats.dailyWords')} value={format.number(reading.dailyWords)} />
            </StatGrid>
            {reading.best ? (
              <AppText variant="caption" color="textSecondary">
                {t('stats.bestDay', { date: format.day(reading.best.date), words: format.number(reading.best.words) })}
              </AppText>
            ) : null}
          </Section>

          <Section title={t('stats.athkar')}>
            <Card>
              <MeterRow
                label={t('stats.athkarDays')}
                value={t('stats.daysOf', { days: format.number(athkar.days), total: format.number(reading.days) })}
                ratio={athkar.days / Math.max(1, reading.days)}
                color={theme.primary}
              />
              {athkar.perList.map(([listId, days]) => (
                <Fragment key={listId}>
                  <Divider />
                  <MeterRow
                    label={t(`athkar.lists.${listId}`, { defaultValue: listId })}
                    value={t('stats.daysOf', { days: format.number(days), total: format.number(reading.days) })}
                    ratio={days / Math.max(1, reading.days)}
                    color={theme.accent}
                  />
                </Fragment>
              ))}
            </Card>
          </Section>

          <Section title={t('stats.charity')}>
            <StatGrid>
              <StatTile label={t('hisab.sadaqaGiven')} value={money(akhira.sadaqa)} />
              <StatTile label={t('hisab.zakatPaid')} value={money(akhira.zakat)} />
              <StatTile label={t('hisab.thanbAdded')} value={format.points(akhira.thanbAdded)} />
              <StatTile label={t('hisab.thanbPaid')} value={format.points(akhira.thanbPaid)} />
            </StatGrid>
          </Section>

          <Section title={t('stats.sins')}>
            <Card>
              {akhira.sins.length ? (
                akhira.sins.map(([id, count], index) => {
                  const sin = sinTypes.find((item) => item.id === id);
                  return (
                    <Fragment key={id || 'none'}>
                      {index > 0 ? <Divider /> : null}
                      <MeterRow
                        label={sin ? sinName(sin) : t('hisab.kinds.sin')}
                        value={t('stats.times', { count: format.number(count) })}
                        ratio={count / sinMax}
                        color={theme.danger}
                      />
                    </Fragment>
                  );
                })
              ) : (
                <Empty text={t('stats.noSins')} />
              )}
              {akhira.fastTaps ? (
                <>
                  <Divider />
                  <AppText variant="caption" color="textSecondary">
                    {t('stats.fastTaps', { count: format.number(akhira.fastTaps) })}
                  </AppText>
                </>
              ) : null}
            </Card>
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.two },
});
