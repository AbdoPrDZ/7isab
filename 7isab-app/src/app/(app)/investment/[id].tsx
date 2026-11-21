import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { HalalRules } from '@/components/investments/halal-rules';
import { useInvestmentMoney } from '@/components/investments/use-investment-money';
import { FlowChart, MeterRow, StatGrid, StatTile } from '@/components/stats/charts';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { today } from '@/lib/dates';
import {
  deleteInvestment,
  deleteRecord,
  RECORD_TYPES,
  setInvestmentClosed,
  sharesProfit,
  useInvestment,
  useInvestmentEntries,
  type RecordType,
} from '@/lib/investments/investments';
import { chartPeriod, investmentStats, type InvestmentRecord } from '@/lib/investments/stats';
import { useAccounts, useLedgerLabels } from '@/lib/ledger/hooks';

/** One investment: figures, expected vs real per period, records and actions. */
export default function InvestmentScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const investment = useInvestment(id);
  const entries = useInvestmentEntries();
  const accounts = useAccounts();
  const { accountName, format } = useLedgerLabels();
  const { money, percent, currencyOf } = useInvestmentMoney();
  const records = useMemo(() => (investment ? (entries.get(investment.id) ?? []) : []), [investment, entries]);
  const stats = useMemo(() => (investment ? investmentStats(investment, records) : null), [investment, records]);

  if (!investment || !stats) {
    return (
      <Screen back title={t('investments.title')}>
        <AppText color="textSecondary">{t('investments.notFound')}</AppText>
      </Screen>
    );
  }

  const value = (amount: number) => money(investment, amount);
  const record = (type: RecordType) =>
    router.push({ pathname: '/investment/record', params: { id: investment.id, type } });
  const unit = chartPeriod(investment.expected?.period ?? 'month');

  const bucketLabel = (start: string, short: boolean) => {
    if (unit === 'year') return format.digits(start.slice(0, 4));
    if (unit === 'month') return short ? format.digits(start.slice(5, 7)) : format.month(start.slice(0, 7));
    return format.day(start, short ? 'short' : 'long');
  };

  const recordLabel = (item: InvestmentRecord) => {
    const other = item.entry.lines.find((line) => line.account !== investment.accountId);
    const account = other ? accounts.find((acc) => acc.id === other.account) : undefined;
    const where =
      item.type === 'profit' && !other
        ? t('investments.record.reinvested')
        : account
          ? accountName(account)
          : item.type === 'capital' || item.type === 'withdraw'
            ? t('investments.record.outside')
            : null;
    return [format.day(item.entry.date), where, item.entry.note].filter(Boolean).join(' · ');
  };

  const removeRecord = (item: InvestmentRecord) =>
    Alert.alert(t('common.delete'), t('investments.record.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void deleteRecord(item.entry) },
    ]);

  const close = () =>
    Alert.alert(
      investment.closedAt ? t('investments.reopen') : t('investments.close'),
      investment.closedAt ? undefined : t('investments.closeHint'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: investment.closedAt ? t('investments.reopen') : t('investments.close'),
          onPress: () => void setInvestmentClosed(investment, investment.closedAt ? null : today()),
        },
      ],
    );

  const remove = () =>
    Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          void deleteInvestment(investment, records).then((done) => (done ? router.back() : Alert.alert(t('investments.deleteHasRecords')))),
      },
    ]);

  const details = [
    [t('investments.form.kind'), t(`investments.kinds.${investment.kind}`)],
    investment.partner ? [t(`investments.form.partner.${investment.kind}`), investment.partner] : null,
    sharesProfit(investment.kind) && investment.profitShare
      ? [t('investments.form.profitShare'), format.digits(`${investment.profitShare}%`)]
      : null,
    investment.capitalShare ? [t('investments.form.capitalShare'), format.digits(`${investment.capitalShare}%`)] : null,
    [t('investments.form.startDate'), format.day(investment.startDate, 'long')],
    investment.closedAt ? [t('investments.closedOn'), format.day(investment.closedAt, 'long')] : null,
    investment.expected
      ? [
          t('investments.expectedPer', { period: t(`investments.periods.${investment.expected.period}`) }),
          value(investment.expected.amount),
        ]
      : null,
    [t('investments.form.currency'), currencyOf(investment)],
  ].filter((item): item is string[] => item !== null);

  return (
    <Screen
      back
      title={investment.name}
      subtitle={[t(`investments.kinds.${investment.kind}`), investment.closedAt ? t('investments.closedBadge') : null]
        .filter(Boolean)
        .join(' · ')}>
      {stats.overdue ? (
        <Card tone="danger">
          <AppText variant="label">{t('investments.overdue', { date: format.day(stats.lastProfit ?? investment.startDate, 'long') })}</AppText>
        </Card>
      ) : null}

      <StatGrid>
        <StatTile label={t('investments.capitalNow')} value={value(stats.capitalNow)} />
        <StatTile label={t('investments.net')} value={value(stats.net)} valueColor={stats.net < 0 ? 'danger' : 'primary'} />
        <StatTile label={t('investments.roi')} value={percent(stats.roi)} />
        <StatTile label={t('investments.annualized')} value={percent(stats.annualized)} />
      </StatGrid>

      {!investment.closedAt ? (
        <View style={styles.actions}>
          {RECORD_TYPES.map((type) => (
            <Button
              key={type}
              title={t(`investments.record.add.${type}`)}
              variant={type === 'profit' ? 'primary' : 'secondary'}
              style={styles.action}
              onPress={() => record(type)}
            />
          ))}
        </View>
      ) : null}

      {investment.expected && stats.expectedToDate !== null ? (
        <Section title={t('investments.vsTitle')}>
          <Card>
            <MeterRow
              label={t('investments.realVsExpected', {
                real: value(stats.net),
                expected: value(stats.expectedToDate),
              })}
              value={percent(stats.achieved)}
              ratio={stats.achieved ?? 0}
              color={(stats.achieved ?? 0) >= 1 ? theme.chartIn : (stats.achieved ?? 0) >= 0.7 ? theme.accent : theme.chartOut}
              note={t('investments.estimateNote')}
            />
          </Card>
          {stats.buckets.length ? (
            <Card>
              <FlowChart
                data={stats.buckets.map((bucket) => ({
                  month: bucket.start,
                  inflow: Math.max(0, bucket.real),
                  outflow: bucket.expected,
                }))}
                inLabel={t('investments.real')}
                outLabel={t('investments.expected')}
                inColor={theme.chartIn}
                outColor={theme.accent}
                formatValue={value}
                monthLabel={bucketLabel}
                netLabel={t('investments.difference')}
              />
            </Card>
          ) : null}
        </Section>
      ) : null}

      <Section title={t('investments.figures')}>
        <Card>
          {[
            [t('investments.capitalIn'), value(stats.capitalIn)],
            [t('investments.capitalOut'), value(stats.capitalOut)],
            [t('investments.profit'), value(stats.profit)],
            [t('investments.reinvested'), value(stats.reinvested)],
            [t('investments.loss'), value(stats.loss)],
            [t('investments.avgCapital'), value(stats.avgCapital)],
            [
              t('investments.perPeriod', { period: t(`investments.periods.${investment.expected?.period ?? 'month'}`) }),
              stats.perPeriod === null ? '—' : value(stats.perPeriod),
            ],
            [t('investments.payback'), percent(stats.payback)],
            [t('investments.goodPeriods'), format.digits(`${stats.goodBuckets} / ${stats.buckets.length}`)],
            [t('investments.daysActive'), format.number(stats.days)],
            [t('investments.lastProfit'), stats.lastProfit ? format.day(stats.lastProfit, 'long') : '—'],
          ].map(([label, text], index) => (
            <Fragment key={label}>
              {index > 0 ? <Divider /> : null}
              <Row title={label} value={text} />
            </Fragment>
          ))}
        </Card>
      </Section>

      <Section title={t('investments.records', { n: stats.records.length })}>
        <Card>
          {stats.records.length ? (
            stats.records.map((item, index) => (
              <Fragment key={item.entry.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable onLongPress={() => removeRecord(item)}>
                  <Row
                    title={t(`investments.record.types.${item.type}`)}
                    subtitle={recordLabel(item)}
                    value={`${item.type === 'withdraw' || item.type === 'loss' ? '−' : '+'}${value(item.amount)}`}
                    valueColor={item.type === 'loss' ? 'danger' : item.type === 'profit' ? 'primary' : 'text'}
                  />
                </Pressable>
              </Fragment>
            ))
          ) : (
            <AppText variant="label" color="textSecondary" align="center">
              {t('investments.noRecords')}
            </AppText>
          )}
        </Card>
        {stats.records.length ? (
          <AppText variant="caption" color="textSecondary">
            {t('investments.record.longPress')}
          </AppText>
        ) : null}
      </Section>

      <Section title={t('investments.details')}>
        <Card>
          {details.map(([label, text], index) => (
            <Fragment key={label}>
              {index > 0 ? <Divider /> : null}
              <Row title={label} value={text} />
            </Fragment>
          ))}
          {investment.note ? (
            <>
              <Divider />
              <AppText variant="label">{investment.note}</AppText>
            </>
          ) : null}
        </Card>
      </Section>

      <HalalRules kind={investment.kind} />

      <View style={styles.footerActions}>
        <Button
          title={t('common.edit')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/investment/form', params: { id: investment.id } })}
        />
        <Button title={investment.closedAt ? t('investments.reopen') : t('investments.close')} variant="secondary" onPress={close} />
        {!records.length ? <Button title={t('common.delete')} variant="ghost" onPress={remove} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: { flexGrow: 1, flexBasis: '45%' },
  footerActions: { gap: Spacing.two },
});
