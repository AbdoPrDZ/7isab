/**
 * The statistics panel's sections. Every figure follows the filter bar
 * (period, comparison, filters); groupings are picked per section.
 */
import { router } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { BalanceTrend, FlowChart, MeterRow, StatGrid, StatTile } from '@/components/stats/charts';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Chips, Divider, Row, Section } from '@/components/ui/layout';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDocs } from '@/lib/data/vault';
import { useLedgerLabels, useTasks } from '@/lib/ledger/hooks';
import { deleteEntry, fixedAccountId } from '@/lib/ledger/ledger';
import { RecordTypes, type Entry } from '@/lib/ledger/types';
import { programReport, usePrograms } from '@/lib/programs/programs';
import { buildRangeReport, countTasks } from '@/lib/reports/reports';
import { bedtimeStats, dailyCompletion, jumuahCounts, prayerTable } from '@/lib/stats/deeds';
import { filterTasks, rangeDays, type GroupBy, type StatsFilter } from '@/lib/stats/filter';
import { breakdown, delta, series, thanbBefore, totals, worthSeries, type Measure } from '@/lib/stats/panel';
import { useDebts } from '@/lib/wallet/debts';

import { exportCsv } from './export';
import type { Panel } from './use-panel';

type Props = { panel: Panel; filter: StatsFilter; onFilter: (filter: StatsFilter) => void };

function Empty({ text }: { text: string }) {
  return (
    <AppText variant="label" color="textSecondary" align="center">
      {text}
    </AppText>
  );
}

function useHelpers() {
  const { t } = useTranslation();
  const { format, mainCurrency } = useLedgerLabels();
  return {
    t,
    format,
    money: (value: number) => format.money(value, mainCurrency),
    points: (value: number) => format.points(value),
    percent: (value: number) => format.digits(`${Math.round(value * 100)}%`),
    versus: (percent: string) => t('stats.vsPrevious', { percent }),
  };
}

/** Group-by chips + bars for a breakdown. */
function Breakdown({
  panel,
  entries,
  groupBy,
  groupings,
  measure,
  onGroupBy,
  inLabel,
  outLabel,
  formatValue,
}: {
  panel: Panel;
  entries: Entry[];
  groupBy: GroupBy;
  groupings: GroupBy[];
  measure: Measure;
  onGroupBy: (groupBy: GroupBy) => void;
  inLabel: string;
  outLabel: string;
  formatValue: (value: number) => string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const current = groupings.includes(groupBy) ? groupBy : groupings[0];
  const rows = breakdown(entries, current, panel.list, panel.ctx, panel.money, measure);
  const max = Math.max(1, ...rows.flatMap((row) => [row.inflow, row.outflow]));
  return (
    <>
      <Chips options={groupings.map((value) => ({ value, label: t(`stats.groupBy.${value}`) }))} value={current} onChange={onGroupBy} />
      <Card>
        {rows.length ? (
          rows.map((row, index) => (
            <Fragment key={row.key || '-'}>
              {index > 0 ? <Divider /> : null}
              {row.inflow ? (
                <MeterRow
                  label={panel.groupLabel(current, row.key)}
                  value={`+${formatValue(row.inflow)}`}
                  ratio={row.inflow / max}
                  color={theme.chartIn}
                  note={row.outflow ? undefined : t('stats.entriesCount', { count: row.count })}
                />
              ) : null}
              {row.outflow ? (
                <MeterRow
                  label={row.inflow ? outLabel : panel.groupLabel(current, row.key)}
                  value={`−${formatValue(row.outflow)}`}
                  ratio={row.outflow / max}
                  color={theme.chartOut}
                  note={t('stats.entriesCount', { count: row.count })}
                />
              ) : null}
              {!row.inflow && !row.outflow ? (
                <Row title={panel.groupLabel(current, row.key)} value={t('stats.entriesCount', { count: row.count })} />
              ) : null}
            </Fragment>
          ))
        ) : (
          <Empty text={t('stats.noData')} />
        )}
      </Card>
      <AppText variant="caption" color="textSecondary">
        {`${inLabel} / ${outLabel}`}
      </AppText>
    </>
  );
}

// ---- Overview ----------------------------------------------------------------------

export function OverviewSection({ panel }: Props) {
  const { t, money, points, percent, versus } = useHelpers();
  const now = totals(panel.entries, panel.ctx, panel.money);
  const before = totals(panel.previousEntries, panel.ctx, panel.money);
  const report = useMemo(() => buildRangeReport(panel.range.start, panel.range.end), [panel.range]);
  const reportBefore = useMemo(() => buildRangeReport(panel.previous.start, panel.previous.end), [panel.previous]);

  return (
    <>
      <StatGrid>
        <StatTile
          label={t('stats.rating')}
          value={report.rating ? t(`report.ratings.${report.rating}`) : '—'}
          valueColor={report.rating === 'weak' ? 'danger' : 'primary'}
          delta={report.score !== null && reportBefore.score !== null ? report.score - reportBefore.score : null}
          deltaLabel={versus}
        />
        <StatTile label={t('stats.score')} value={report.score === null ? '—' : percent(report.score)} />
        <StatTile label={t('stats.income')} value={money(now.income)} valueColor="primary" delta={delta(now.income, before.income)} deltaLabel={versus} />
        <StatTile
          label={t('stats.expenses')}
          value={money(now.expense)}
          valueColor={now.expense ? 'danger' : 'text'}
          delta={delta(now.expense, before.expense)}
          deltaLabel={versus}
          goodWhenUp={false}
        />
        <StatTile label={t('stats.saved')} value={money(now.net)} valueColor={now.net < 0 ? 'danger' : 'primary'} />
        <StatTile
          label={t('stats.netPoints')}
          value={`${now.earned - now.lost > 0 ? '+' : ''}${points(now.earned - now.lost)}`}
          valueColor={now.earned - now.lost < 0 ? 'danger' : 'primary'}
          delta={delta(now.earned - now.lost, before.earned - before.lost)}
          deltaLabel={versus}
        />
        <StatTile
          label={t('stats.thanbAdded')}
          value={points(now.thanbAdded)}
          valueColor={now.thanbAdded ? 'danger' : 'text'}
          delta={delta(now.thanbAdded, before.thanbAdded)}
          deltaLabel={versus}
          goodWhenUp={false}
        />
        <StatTile
          label={t('stats.sinsCount')}
          value={String(now.sins + now.fastTaps)}
          valueColor={now.sins ? 'danger' : 'text'}
          delta={delta(now.sins, before.sins)}
          deltaLabel={versus}
          goodWhenUp={false}
        />
      </StatGrid>

      <Section title={t('stats.moneyFlow')}>
        <Card>
          <FlowChart
            key={`m-${panel.range.start}-${panel.range.end}`}
            data={series(panel.entries, panel.list, panel.ctx, panel.money, 'money')}
            inLabel={t('stats.income')}
            outLabel={t('stats.expenses')}
            netLabel={t('stats.saved')}
            formatValue={money}
            monthLabel={panel.bucketLabel}
          />
        </Card>
      </Section>

      <Section title={t('stats.pointsFlow')}>
        <Card>
          <FlowChart
            key={`p-${panel.range.start}-${panel.range.end}`}
            data={series(panel.entries, panel.list, panel.ctx, panel.money, 'points')}
            inLabel={t('stats.earned')}
            outLabel={t('stats.lost')}
            netLabel={t('stats.netPoints')}
            formatValue={points}
            monthLabel={panel.bucketLabel}
          />
        </Card>
      </Section>
    </>
  );
}

// ---- Dunya -------------------------------------------------------------------------

export function DunyaSection({ panel, filter, onFilter }: Props) {
  const { t, money, percent, versus, format } = useHelpers();
  const theme = useTheme();
  const debts = useDebts();
  const now = totals(panel.entries, panel.ctx, panel.money);
  const before = totals(panel.previousEntries, panel.ctx, panel.money);
  const days = Math.max(1, rangeDays(panel.range).length);
  const worth = useMemo(
    () => worthSeries(panel.all, [...panel.ctx.accounts.values()], panel.list, panel.money, filter.accounts),
    [panel, filter.accounts],
  );

  return (
    <>
      <StatGrid>
        <StatTile label={t('stats.income')} value={money(now.income)} valueColor="primary" delta={delta(now.income, before.income)} deltaLabel={versus} />
        <StatTile
          label={t('stats.expenses')}
          value={money(now.expense)}
          valueColor={now.expense ? 'danger' : 'text'}
          delta={delta(now.expense, before.expense)}
          deltaLabel={versus}
          goodWhenUp={false}
        />
        <StatTile label={t('stats.saved')} value={money(now.net)} valueColor={now.net < 0 ? 'danger' : 'primary'} delta={delta(now.net, before.net)} deltaLabel={versus} />
        <StatTile label={t('stats.savingsRate')} value={now.savingsRate === null ? '—' : percent(now.savingsRate)} />
        <StatTile label={t('stats.dailyExpense')} value={money(now.expense / days)} />
        <StatTile label={t('stats.transactions')} value={format.number(now.count)} />
      </StatGrid>
      {now.biggestExpense ? (
        <AppText variant="caption" color="textSecondary">
          {t('stats.biggestExpense', {
            amount: money(now.biggestExpense.value),
            what: panel.ctx.describe(now.biggestExpense.entry),
            date: format.day(now.biggestExpense.entry.date),
          })}
        </AppText>
      ) : null}

      <Section title={t('stats.cashFlow')}>
        <Card>
          <FlowChart
            key={`d-${panel.range.start}-${panel.range.end}`}
            data={series(panel.entries, panel.list, panel.ctx, panel.money, 'money')}
            inLabel={t('stats.income')}
            outLabel={t('stats.expenses')}
            netLabel={t('stats.saved')}
            formatValue={money}
            monthLabel={panel.bucketLabel}
          />
        </Card>
      </Section>

      <Section title={t('stats.breakdown')}>
        <Breakdown
          panel={panel}
          entries={panel.entries}
          groupBy={filter.groupBy}
          groupings={['category', 'account', 'currency', 'person', 'weekday', 'time']}
          measure="money"
          onGroupBy={(groupBy) => onFilter({ ...filter, groupBy })}
          inLabel={t('stats.income')}
          outLabel={t('stats.expenses')}
          formatValue={money}
        />
      </Section>

      <Section title={t('stats.netWorth')}>
        <Card>
          <BalanceTrend key={`w-${panel.range.start}-${panel.range.end}`} data={worth} formatValue={money} monthLabel={panel.bucketLabel} />
        </Card>
      </Section>

      <Section title={t('debts.title')}>
        <StatGrid>
          <StatTile label={t('debts.owedToMe')} value={money(debts.owedToMe)} valueColor="primary" />
          <StatTile label={t('debts.iOwe')} value={money(debts.iOwe)} valueColor={debts.iOwe > 0 ? 'danger' : 'text'} />
          <StatTile label={t('stats.lentInRange')} value={money(now.lent)} />
          <StatTile label={t('stats.borrowedInRange')} value={money(now.borrowed)} />
        </StatGrid>
        {[...debts.owedToMeByPerson.map((row) => ({ ...row, side: 'in' })), ...debts.iOweByPerson.map((row) => ({ ...row, side: 'out' }))].length ? (
          <Card>
            {debts.owedToMeByPerson.map((row) => (
              <MeterRow
                key={`in-${row.person}`}
                label={`${row.person || t('debts.noName')} · ${t('debts.owedToMe')}`}
                value={money(row.amount)}
                ratio={row.amount / Math.max(1, debts.owedToMe, debts.iOwe)}
                color={theme.chartIn}
              />
            ))}
            {debts.iOweByPerson.map((row) => (
              <MeterRow
                key={`out-${row.person}`}
                label={`${row.person || t('debts.noName')} · ${t('debts.iOwe')}`}
                value={money(row.amount)}
                ratio={row.amount / Math.max(1, debts.owedToMe, debts.iOwe)}
                color={theme.chartOut}
              />
            ))}
          </Card>
        ) : null}
      </Section>
    </>
  );
}

// ---- Akhira ------------------------------------------------------------------------

export function AkhiraSection({ panel, filter, onFilter }: Props) {
  const { t, money, points, versus } = useHelpers();
  const theme = useTheme();
  const now = totals(panel.entries, panel.ctx, panel.money);
  const before = totals(panel.previousEntries, panel.ctx, panel.money);
  const carry = useMemo(() => thanbBefore(panel.all, panel.range.start), [panel.all, panel.range.start]);
  const sinRows = breakdown(
    panel.entries.filter((entry) => entry.kind === 'sin' || entry.kind === 'fast_tap' || entry.kind === 'prayer_late' || entry.kind === 'prayer_missed' || entry.kind === 'bedtime_late'),
    'sinType',
    panel.list,
    panel.ctx,
    panel.money,
    'points',
  );
  const sinMax = Math.max(1, ...sinRows.map((row) => row.count));

  return (
    <>
      <StatGrid>
        <StatTile label={t('stats.earned')} value={points(now.earned)} valueColor="primary" delta={delta(now.earned, before.earned)} deltaLabel={versus} />
        <StatTile
          label={t('stats.lost')}
          value={points(now.lost)}
          valueColor={now.lost ? 'danger' : 'text'}
          delta={delta(now.lost, before.lost)}
          deltaLabel={versus}
          goodWhenUp={false}
        />
        <StatTile
          label={t('stats.netPoints')}
          value={`${now.earned - now.lost > 0 ? '+' : ''}${points(now.earned - now.lost)}`}
          valueColor={now.earned - now.lost < 0 ? 'danger' : 'primary'}
        />
        <StatTile label={t('hisab.carryOver')} value={points(carry)} valueColor={carry > 0 ? 'danger' : 'text'} />
        <StatTile label={t('stats.thanbAdded')} value={points(now.thanbAdded)} valueColor={now.thanbAdded ? 'danger' : 'text'} />
        <StatTile label={t('hisab.thanbPaid')} value={points(now.thanbPaid)} valueColor="primary" />
        <StatTile label={t('stats.thanbEnd')} value={points(carry + now.thanbAdded - now.thanbPaid)} valueColor={carry + now.thanbAdded - now.thanbPaid > 0 ? 'danger' : 'text'} />
        <StatTile label={t('hisab.sadaqaGiven')} value={money(now.sadaqa)} delta={delta(now.sadaqa, before.sadaqa)} deltaLabel={versus} />
        <StatTile label={t('hisab.zakatPaid')} value={money(now.zakat)} />
        <StatTile label={t('stats.sinsCount')} value={String(now.sins + now.fastTaps)} valueColor={now.sins ? 'danger' : 'text'} />
      </StatGrid>

      <Section title={t('stats.pointsFlow')}>
        <Card>
          <FlowChart
            key={`a-${panel.range.start}-${panel.range.end}`}
            data={series(panel.entries, panel.list, panel.ctx, panel.money, 'points')}
            inLabel={t('stats.earned')}
            outLabel={t('stats.lost')}
            netLabel={t('stats.netPoints')}
            formatValue={points}
            monthLabel={panel.bucketLabel}
          />
        </Card>
      </Section>

      <Section title={t('stats.breakdown')}>
        <Breakdown
          panel={panel}
          entries={panel.entries}
          groupBy={filter.groupBy}
          groupings={['kind', 'task', 'sinType', 'weekday', 'time']}
          measure="points"
          onGroupBy={(groupBy) => onFilter({ ...filter, groupBy })}
          inLabel={t('stats.earned')}
          outLabel={t('stats.lost')}
          formatValue={points}
        />
      </Section>

      <Section title={t('stats.sins')}>
        <Card>
          {sinRows.length ? (
            sinRows.map((row, index) => (
              <Fragment key={row.key || '-'}>
                {index > 0 ? <Divider /> : null}
                <MeterRow
                  label={panel.groupLabel('sinType', row.key)}
                  value={t('stats.times', { count: row.count })}
                  ratio={row.count / sinMax}
                  color={theme.danger}
                  note={row.outflow ? `−${points(row.outflow)}` : undefined}
                />
              </Fragment>
            ))
          ) : (
            <Empty text={t('stats.noSins')} />
          )}
        </Card>
      </Section>
    </>
  );
}

// ---- Deeds -------------------------------------------------------------------------

function HeatMap({ days }: { days: { day: string; ratio: number | null }[] }) {
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const [selected, setSelected] = useState<string | null>(null);
  const picked = days.find((item) => item.day === selected);
  return (
    <>
      <View style={styles.heat}>
        {days.map((item) => (
          <Pressable
            key={item.day}
            accessibilityRole="button"
            accessibilityLabel={`${format.day(item.day)}: ${item.ratio === null ? '—' : `${Math.round(item.ratio * 100)}%`}`}
            onPress={() => setSelected(item.day)}
            style={[
              styles.heatCell,
              {
                backgroundColor: item.ratio === null ? theme.surfaceMuted : theme.primary,
                opacity: item.ratio === null ? 1 : 0.2 + 0.8 * item.ratio,
                borderColor: item.day === selected ? theme.accent : 'transparent',
              },
            ]}
          />
        ))}
      </View>
      {picked ? (
        <AppText variant="caption" color="textSecondary">
          {`${format.day(picked.day, 'long')} · ${picked.ratio === null ? '—' : format.digits(`${Math.round(picked.ratio * 100)}%`)}`}
        </AppText>
      ) : null}
    </>
  );
}

export function DeedsSection({ panel, filter }: Props) {
  const { t, percent, format } = useHelpers();
  const theme = useTheme();
  const allTasks = useTasks();
  const programs = usePrograms();
  useDocs(RecordTypes.relapse);
  const tasks = filterTasks(allTasks, filter);
  const regular = tasks.filter((task) => task.kind !== 'prayer' && task.kind !== 'bedtime' && !task.plain);
  const plainTasks = tasks.filter((task) => task.plain);
  const counted = useMemo(() => countTasks(regular, panel.range.start, panel.range.end), [regular, panel.range]);
  const plain = useMemo(() => countTasks(plainTasks, panel.range.start, panel.range.end), [plainTasks, panel.range]);
  const report = useMemo(() => buildRangeReport(panel.range.start, panel.range.end), [panel.range]);
  const prayers = prayerTable(panel.range, filter.prayers);
  const jumuah = jumuahCounts(panel.range);
  const bedtime = bedtimeStats(panel.range);
  const heat = dailyCompletion(panel.range, regular);
  const shownPrograms = programs.filter(
    (program) =>
      (!filter.programs.length || filter.programs.includes(program.id)) &&
      program.startDate <= panel.range.end &&
      (!program.endDate || program.endDate >= panel.range.start),
  );
  const clock = (minutes: number) => {
    const value = (minutes + 24 * 60) % (24 * 60);
    return format.digits(`${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`);
  };
  const days = Math.max(1, rangeDays(panel.range).length);

  return (
    <>
      <StatGrid>
        <StatTile label={t('stats.completion')} value={counted.items ? percent(counted.completed / counted.items) : '—'} />
        <StatTile label={t('stats.tasksDone')} value={t('stats.doneOf', { done: format.number(counted.completed, 1), total: format.number(counted.items) })} />
        <StatTile label={t('stats.quranPages')} value={format.number(report.quran.pages)} />
        <StatTile label={t('stats.quranPerDay')} value={format.number(Math.round(report.quran.words / days))} />
        <StatTile label={t('stats.athkarCount')} value={format.number(report.athkar)} />
        <StatTile label={t('stats.sinsCount')} value={format.number(report.sins + report.fastTaps)} valueColor={report.sins ? 'danger' : 'text'} />
      </StatGrid>

      <Section title={t('stats.heatMap')}>
        <Card>
          {heat.length ? <HeatMap days={heat} /> : <Empty text={t('stats.noData')} />}
        </Card>
      </Section>

      <Section title={t('stats.tasks')}>
        <Card>
          {counted.rows.length ? (
            counted.rows.map((row, index) => (
              <Fragment key={row.task.id}>
                {index > 0 ? <Divider /> : null}
                <MeterRow
                  label={row.task.title}
                  value={t('stats.doneOf', { done: format.number(row.done, 1), total: format.number(row.total) })}
                  ratio={row.done / row.total}
                  color={row.done >= row.total ? theme.accent : theme.primary}
                  note={t(`task.kinds.${row.task.kind}`)}
                />
              </Fragment>
            ))
          ) : (
            <Empty text={t('stats.noTasks')} />
          )}
        </Card>
      </Section>

      {plain.rows.length ? (
        <Section title={t('stats.plainTasks')}>
          <Card>
            {plain.rows.map((row, index) => (
              <Fragment key={row.task.id}>
                {index > 0 ? <Divider /> : null}
                <MeterRow
                  label={row.task.title}
                  value={t('stats.doneOf', { done: format.number(row.done, 1), total: format.number(row.total) })}
                  ratio={row.done / row.total}
                  color={theme.textSecondary}
                />
              </Fragment>
            ))}
          </Card>
          <AppText variant="caption" color="textSecondary">
            {t('stats.plainHint')}
          </AppText>
        </Section>
      ) : null}

      {prayers.length ? (
        <Section title={t('stats.prayers')}>
          <Card>
            {prayers.map((row, index) => {
              const total = row.onTime + row.late + row.missed;
              return (
                <Fragment key={row.prayer}>
                  {index > 0 ? <Divider /> : null}
                  <MeterRow
                    label={t(`prayer.names.${row.prayer}`)}
                    value={total ? percent(row.onTime / total) : '—'}
                    ratio={total ? row.onTime / total : 0}
                    color={theme.primary}
                    note={[
                      t('stats.prayerLine', { onTime: row.onTime, late: row.late, missed: row.missed }),
                      row.mosque + row.home ? t('stats.mosqueLine', { mosque: row.mosque, home: row.home }) : null,
                      row.khushoo.good + row.khushoo.normal + row.khushoo.weak
                        ? t('stats.khushooLine', { good: row.khushoo.good, normal: row.khushoo.normal, weak: row.khushoo.weak })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                </Fragment>
              );
            })}
          </Card>
          {jumuah.mosque + jumuah.home + jumuah.missed ? (
            <AppText variant="caption" color="textSecondary">
              {t('stats.jumuahLine', jumuah)}
            </AppText>
          ) : null}
        </Section>
      ) : null}

      {bedtime && bedtime.nights ? (
        <Section title={t('bedtime.title')}>
          <StatGrid>
            <StatTile label={t('stats.onTimeNights')} value={percent(bedtime.onTime / bedtime.nights)} valueColor="primary" />
            <StatTile label={t('stats.averageSleep')} value={bedtime.averageMinutes === null ? '—' : clock(bedtime.averageMinutes)} />
            <StatTile label={t('bedtime.states.late')} value={format.number(bedtime.late)} valueColor={bedtime.late ? 'danger' : 'text'} />
            <StatTile label={t('bedtime.states.missed')} value={format.number(bedtime.missed)} valueColor={bedtime.missed ? 'danger' : 'text'} />
          </StatGrid>
          {bedtime.reasons.length ? (
            <Card>
              {bedtime.reasons.map(([reason, count], index) => (
                <Fragment key={reason}>
                  {index > 0 ? <Divider /> : null}
                  <MeterRow label={reason} value={t('stats.times', { count })} ratio={count / bedtime.reasons[0][1]} color={theme.chartOut} />
                </Fragment>
              ))}
            </Card>
          ) : null}
        </Section>
      ) : null}

      {shownPrograms.length ? (
        <Section title={t('programs.title')}>
          <Card>
            {shownPrograms.map((program, index) => {
              const result = programReport(program, panel.range.start, panel.range.end);
              return (
                <Fragment key={program.id}>
                  {index > 0 ? <Divider /> : null}
                  <Row
                    title={program.name}
                    subtitle={[
                      result.rating ? t(`report.ratings.${result.rating}`) : t('report.noData'),
                      ...(program.category === 'healing' ? [t('programs.relapsesIn', { relapses: format.number(result.relapses) })] : []),
                    ].join(' · ')}
                    value={result.score === null ? '—' : percent(result.score)}
                    chevron
                    onPress={() => router.push(`/program/${program.id}`)}
                  />
                </Fragment>
              );
            })}
          </Card>
        </Section>
      ) : null}
    </>
  );
}

// ---- Entries -----------------------------------------------------------------------

const PAGE = 100;

export function EntriesSection({ panel }: Props) {
  const { t, money, points, format } = useHelpers();
  const [shown, setShown] = useState(PAGE);
  const [exporting, setExporting] = useState(false);
  const now = totals(panel.entries, panel.ctx, panel.money);
  const akhira = fixedAccountId('akhira');

  const value = (entry: Entry) => {
    const pointsLine = entry.lines.find((line) => line.account === akhira);
    if (pointsLine) return { text: `${pointsLine.amount > 0 ? '+' : ''}${points(pointsLine.amount)}`, positive: pointsLine.amount > 0 };
    const line = entry.lines[0];
    if (!line) return { text: '', positive: true };
    const account = panel.ctx.accounts.get(line.account);
    const currency = account ? panel.ctx.currencyOf(account) : null;
    return {
      text: currency === 'XAU_G' ? `${format.number(line.amount, 3)} ${t('units.grams')}` : format.money(line.amount, currency ?? panel.money.main),
      positive: line.amount > 0,
    };
  };

  const remove = (entry: Entry) =>
    Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void deleteEntry(entry.id) },
    ]);

  const exportFile = () =>
    Alert.alert(t('stats.export.title'), t('stats.export.warning', { count: panel.entries.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('stats.export.confirm'),
        onPress: () => {
          setExporting(true);
          void exportCsv(panel)
            .catch(() => Alert.alert(t('stats.export.title'), t('stats.export.failed')))
            .finally(() => setExporting(false));
        },
      },
    ]);

  return (
    <>
      <StatGrid>
        <StatTile label={t('stats.transactions')} value={format.number(panel.entries.length)} />
        <StatTile label={t('stats.income')} value={money(now.income)} valueColor="primary" />
        <StatTile label={t('stats.expenses')} value={money(now.expense)} valueColor={now.expense ? 'danger' : 'text'} />
        <StatTile label={t('stats.netPoints')} value={points(now.earned - now.lost)} />
      </StatGrid>
      <Button title={t('stats.export.button')} variant="secondary" loading={exporting} disabled={!panel.entries.length} onPress={exportFile} />

      <Card>
        {panel.entries.length ? (
          panel.entries.slice(0, shown).map((entry, index) => {
            const shownValue = value(entry);
            return (
              <Fragment key={entry.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable onLongPress={() => remove(entry)}>
                  <Row
                    title={panel.ctx.describe(entry)}
                    subtitle={[format.day(entry.date), t(`hisab.kinds.${entry.kind}`), entry.person, entry.note && entry.note !== panel.ctx.describe(entry) ? entry.note : null]
                      .filter(Boolean)
                      .join(' · ')}
                    value={shownValue.text}
                    valueColor={shownValue.positive ? 'primary' : 'danger'}
                  />
                </Pressable>
              </Fragment>
            );
          })
        ) : (
          <Empty text={t('stats.noData')} />
        )}
      </Card>
      {panel.entries.length > shown ? (
        <Button
          title={t('stats.showMore', { count: Math.min(PAGE, panel.entries.length - shown) })}
          variant="ghost"
          onPress={() => setShown(shown + PAGE)}
        />
      ) : null}
      <AppText variant="caption" color="textSecondary">
        {t('stats.entriesHint')}
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  heat: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  heatCell: { width: 18, height: 18, borderRadius: Radius.small / 2, borderWidth: 2 },
  gap: { gap: Spacing.two },
});
