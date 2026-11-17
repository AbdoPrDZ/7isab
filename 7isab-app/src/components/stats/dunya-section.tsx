/**
 * Dunya statistics: optionally for one account; income, expenses and saving,
 * spending grouped several ways, cash flow, the account's own figures, and
 * net worth by account, type or currency.
 */
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BalanceTrend, FlowChart, MeterRow, SegmentedBar, StatGrid, StatTile } from '@/components/stats/charts';
import { AppText } from '@/components/ui/app-text';
import { Card, Chips, Divider, Row, Section } from '@/components/ui/layout';
import { useTheme } from '@/hooks/use-theme';
import { useAccounts, useBalances, useEntries, useExchangeRates, useLedgerLabels } from '@/lib/ledger/hooks';
import { GOLD_CURRENCY, type Account } from '@/lib/ledger/types';
import {
  accountStats,
  change,
  chartMonths,
  dunyaStats,
  groupWorth,
  monthlyFlow,
  worthByAccount,
  type StatsPeriod,
} from '@/lib/stats/stats';
import { netWorth, useBudgets, useCategories } from '@/lib/wallet/wallet';

/** Largest groups shown in the segmented bar; the rest fold into "Other". */
const TOP_GROUPS = 5;

type Grouping = 'category' | 'income' | 'account' | 'currency' | 'weekday';
type WorthGrouping = 'account' | 'role' | 'currency';

/** Accounts that hold money or gold (the ones with Dunya statistics). */
export function statsAccounts(accounts: Account[]): Account[] {
  return accounts.filter(
    (account) =>
      !account.archived &&
      (account.unit.kind === 'money' || account.unit.kind === 'gold') &&
      account.fixed !== 'sadaqa' &&
      account.fixed !== 'zakat',
  );
}

function Empty({ text }: { text: string }) {
  return (
    <AppText variant="label" color="textSecondary" align="center">
      {text}
    </AppText>
  );
}

export function DunyaSection({
  periodKey: key,
  previousKey,
  period,
  accountId,
  onAccountChange,
  versus,
  monthLabel,
  percent,
}: {
  periodKey: string;
  previousKey: string;
  period: StatsPeriod;
  accountId: string;
  onAccountChange: (id: string) => void;
  versus: (percent: string) => string;
  monthLabel: (month: string, short: boolean) => string;
  percent: (value: number) => string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const entries = useEntries();
  const accounts = useAccounts();
  const balances = useBalances();
  const rates = useExchangeRates();
  const categories = useCategories();
  const budgets = useBudgets();
  const { accountName, amount, format, mainCurrency } = useLedgerLabels();
  const [grouping, setGrouping] = useState<Grouping>('category');
  const [worthGrouping, setWorthGrouping] = useState<WorthGrouping>('account');

  const choices = statsAccounts(accounts);
  const account = choices.find((item) => item.id === accountId);
  const filter = account?.id;
  const money = (value: number) => format.money(value, mainCurrency);
  const own = (value: number) => (account ? amount(account, value) : money(value));
  const inMain = !account || (account.unit.kind === 'money' && (account.unit.currency ?? mainCurrency) === mainCurrency);

  const dunya = dunyaStats(entries, accounts, key, period, mainCurrency, rates, filter);
  const before = dunyaStats(entries, accounts, previousKey, period, mainCurrency, rates, filter);
  const flow = monthlyFlow(entries, accounts, chartMonths(key, period), mainCurrency, rates, filter);
  const single = (filter ? accountStats(entries, filter, key, chartMonths(key, period)) : null);

  const worth = netWorth(accounts, balances, mainCurrency, rates);
  const worthRows = worthByAccount(accounts, balances, mainCurrency, rates);

  // ---- Labels and colours for each grouping
  const category = (id: string) => categories.find((item) => item.id === id);
  const categoryLabel = (id: string) => {
    const item = category(id);
    if (!item) return t('wallet.noCategory');
    return item.preset ? t(`wallet.defaultCategories.${item.preset}`) : item.name;
  };
  const currencyLabel = (code: string) => (code === GOLD_CURRENCY ? t('wallet.unitGold') : code);
  const accountLabel = (id: string) => {
    const item = accounts.find((a) => a.id === id);
    return item ? accountName(item) : '—';
  };
  const budgetFor = (id: string) => {
    const budget = budgets.find((item) => item.categoryId === id)?.amount;
    return budget ? budget * (period === 'year' ? 12 : 1) : null;
  };

  const groupings: Grouping[] = filter
    ? ['category', 'income', 'weekday']
    : ['category', 'income', 'account', 'currency', 'weekday'];
  const activeGrouping = groupings.includes(grouping) ? grouping : 'category';

  const rows: { key: string; label: string; value: number; color: string }[] = (() => {
    switch (activeGrouping) {
      case 'income':
        return dunya.incomeByCategory.map(([id, value]) => ({
          key: id || 'none',
          label: categoryLabel(id),
          value,
          color: category(id)?.color ?? theme.chartIn,
        }));
      case 'account':
        return dunya.byAccount.map(([id, value]) => ({ key: id, label: accountLabel(id), value, color: theme.primary }));
      case 'currency':
        return dunya.byCurrency.map(([code, value]) => ({
          key: code,
          label: currencyLabel(code),
          value,
          color: theme.primary,
        }));
      case 'weekday':
        return dunya.byWeekday.map(([day, value]) => ({
          key: String(day),
          label: t(`task.days.${day}`),
          value,
          color: theme.chartOut,
        }));
      default:
        return dunya.byCategory.map(([id, value]) => ({
          key: id || 'none',
          label: categoryLabel(id),
          value,
          color: category(id)?.color ?? theme.textSecondary,
        }));
    }
  })();
  const groupTotal = activeGrouping === 'income' ? dunya.income : dunya.expense;
  const groupMax = Math.max(1, ...rows.map((row) => row.value));
  const showSegments = activeGrouping === 'category' || activeGrouping === 'income';
  const segments = [
    ...rows.slice(0, TOP_GROUPS).map((row) => ({ key: row.key, value: row.value, color: row.color })),
    ...(rows.length > TOP_GROUPS
      ? [{ key: 'other', value: rows.slice(TOP_GROUPS).reduce((sum, row) => sum + row.value, 0), color: theme.textSecondary }]
      : []),
  ];

  const worthGroups =
    worthGrouping === 'account'
      ? worthRows.map((row) => ({
          key: row.account.id,
          label: accountName(row.account),
          value: row.value,
          detail:
            row.account.unit.kind === 'money' && (row.account.unit.currency ?? mainCurrency) === mainCurrency
              ? null
              : amount(row.account, balances.get(row.account.id) ?? 0),
        }))
      : groupWorth(worthRows, worthGrouping, mainCurrency).map(([group, value]) => ({
          key: group,
          label: worthGrouping === 'role' ? t(`wallet.roles.${group}`) : currencyLabel(group),
          value,
          detail: null,
        }));
  const worthMax = Math.max(1, ...worthGroups.map((row) => Math.abs(row.value)));

  return (
    <>
      <Section title={t('stats.account')}>
        <Chips
          options={[
            { value: '', label: t('stats.allAccounts') },
            ...choices.map((item) => ({ value: item.id, label: accountName(item) })),
          ]}
          value={accountId}
          onChange={onAccountChange}
        />
      </Section>

      {account && single ? (
        <Section title={accountName(account)}>
          <StatGrid>
            <StatTile label={t('stats.opening')} value={own(single.opening)} />
            <StatTile
              label={t('stats.closing')}
              value={own(single.closing)}
              valueColor={single.closing < 0 ? 'danger' : 'text'}
            />
            <StatTile label={t('stats.moneyIn')} value={own(single.in)} valueColor="primary" />
            <StatTile label={t('stats.moneyOut')} value={own(single.out)} valueColor={single.out > 0 ? 'danger' : 'text'} />
          </StatGrid>
          <Card>
            <Row
              title={t('stats.change')}
              value={`${single.closing - single.opening > 0 ? '+' : ''}${own(single.closing - single.opening)}`}
              valueColor={single.closing - single.opening < 0 ? 'danger' : 'primary'}
            />
            {single.inByKind.length || single.outByKind.length ? <Divider /> : null}
            {single.inByKind.map(([kind, value]) => (
              <MeterRow
                key={`in-${kind}`}
                label={`${t('stats.in')} · ${t(`hisab.kinds.${kind}`)}`}
                value={own(value)}
                ratio={value / Math.max(1, single.in, single.out)}
                color={theme.chartIn}
              />
            ))}
            {single.outByKind.map(([kind, value]) => (
              <MeterRow
                key={`out-${kind}`}
                label={`${t('stats.out')} · ${t(`hisab.kinds.${kind}`)}`}
                value={own(value)}
                ratio={value / Math.max(1, single.in, single.out)}
                color={theme.chartOut}
              />
            ))}
          </Card>
          <Card>
            <AppText variant="label" weight="semibold">
              {t('stats.balanceTrend')}
            </AppText>
            <BalanceTrend key={`${period}-${key}-${account.id}`} data={single.trend} formatValue={own} monthLabel={monthLabel} />
          </Card>
        </Section>
      ) : null}

      <StatGrid>
        <StatTile
          label={t('stats.income')}
          value={money(dunya.income)}
          delta={change(dunya.income, before.income)}
          deltaLabel={versus}
        />
        <StatTile
          label={t('stats.expenses')}
          value={money(dunya.expense)}
          delta={change(dunya.expense, before.expense)}
          deltaLabel={versus}
          goodWhenUp={false}
        />
        <StatTile
          label={t('stats.saved')}
          value={money(dunya.net)}
          valueColor={dunya.net < 0 ? 'danger' : 'primary'}
          delta={change(dunya.net, before.net)}
          deltaLabel={versus}
        />
        <StatTile
          label={t('stats.savingsRate')}
          value={dunya.savingsRate === null ? '—' : percent(dunya.savingsRate)}
          valueColor={(dunya.savingsRate ?? 0) < 0 ? 'danger' : 'text'}
        />
      </StatGrid>
      {!inMain ? (
        <AppText variant="caption" color="textSecondary">
          {t('stats.convertedNote', { currency: mainCurrency })}
        </AppText>
      ) : null}
      {dunya.expense > 0 ? (
        <Card>
          <AppText variant="caption" color="textSecondary">
            {t('stats.dailySpending', { amount: money(dunya.dailyExpense) })}
          </AppText>
          {dunya.biggest ? (
            <AppText variant="caption" color="textSecondary">
              {t('stats.biggestExpense', {
                name: dunya.biggest.entry.note || categoryLabel(dunya.biggest.entry.categoryId ?? ''),
                amount: money(dunya.biggest.value),
                date: format.day(dunya.biggest.entry.date),
              })}
            </AppText>
          ) : null}
          <AppText variant="caption" color="textSecondary">
            {t('stats.transactions', { count: format.number(dunya.count) })}
          </AppText>
        </Card>
      ) : null}

      <Section title={activeGrouping === 'income' ? t('stats.incomeBy') : t('stats.spendingBy')}>
        <Chips
          options={groupings.map((value) => ({ value, label: t(`stats.groupings.${value}`) }))}
          value={activeGrouping}
          onChange={setGrouping}
        />
        <Card>
          {rows.some((row) => row.value > 0) ? (
            <>
              {showSegments ? <SegmentedBar parts={segments} /> : null}
              {rows.map((row, index) => {
                const budget = activeGrouping === 'category' ? budgetFor(row.key === 'none' ? '' : row.key) : null;
                const over = budget !== null && row.value > budget;
                const color = showSegments && index >= TOP_GROUPS ? theme.textSecondary : row.color;
                return (
                  <Fragment key={row.key}>
                    {index > 0 ? <Divider /> : null}
                    <MeterRow
                      label={row.label}
                      value={`${money(row.value)} · ${percent(row.value / Math.max(1, groupTotal))}`}
                      ratio={
                        budget ? row.value / budget : activeGrouping === 'weekday' ? row.value / groupMax : row.value / Math.max(1, groupTotal)
                      }
                      color={over ? theme.danger : color}
                      swatch={showSegments ? color : undefined}
                      note={
                        budget
                          ? over
                            ? t('wallet.overBudget', { amount: money(row.value - budget) })
                            : t('wallet.budgetLeft', { left: money(budget - row.value), total: money(budget) })
                          : undefined
                      }
                      noteColor={over ? 'danger' : 'textSecondary'}
                    />
                  </Fragment>
                );
              })}
            </>
          ) : (
            <Empty text={t('wallet.noTransactions')} />
          )}
        </Card>
      </Section>

      <Section title={t('wallet.cashFlow')}>
        <Card>
          <FlowChart
            key={`${period}-${key}-${filter ?? 'all'}`}
            data={flow}
            inLabel={t('stats.income')}
            outLabel={t('stats.expenses')}
            netLabel={t('stats.saved')}
            formatValue={money}
            monthLabel={monthLabel}
          />
        </Card>
      </Section>

      {!account ? (
        <Section title={t('wallet.netWorth')}>
          <Chips
            options={(['account', 'role', 'currency'] as WorthGrouping[]).map((value) => ({
              value,
              label: t(`stats.worthGroupings.${value}`),
            }))}
            value={worthGrouping}
            onChange={setWorthGrouping}
          />
          <Card>
            <AppText variant="title" color={worth.total < 0 ? 'danger' : 'primary'}>
              {money(worth.total)}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {t('stats.netWorthNote', { reserved: money(worth.reserved) })}
            </AppText>
            {worthGroups.map((row) => (
              <MeterRow
                key={row.key}
                label={row.label}
                value={row.detail ? `${row.detail} ≈ ${money(row.value)}` : money(row.value)}
                ratio={Math.abs(row.value) / worthMax}
                color={row.value < 0 ? theme.danger : theme.primary}
                note={worth.total > 0 && row.value > 0 ? percent(row.value / worth.total) : undefined}
              />
            ))}
          </Card>
        </Section>
      ) : null}
    </>
  );
}
