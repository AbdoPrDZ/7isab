import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Fragment, useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { SearchBox } from '@/components/search/search-box';
import { AppText } from '@/components/ui/app-text';
import { ArchCard } from '@/components/ui/decor';
import { Button } from '@/components/ui/button';
import { BackIcon } from '@/components/ui/icons';
import { AddRow, Card, Divider, Row, Screen, Section, SectionAction } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { addMonths, monthOf, today } from '@/lib/dates';
import { useDocs } from '@/lib/data/vault';
import { DebtsCard } from '@/components/wallet/debts-card';
import { useAccounts, useBalances, useEntries, useExchangeRates, useLedgerLabels } from '@/lib/ledger/hooks';
import { deleteEntry } from '@/lib/ledger/ledger';
import { RecordTypes, type Entry } from '@/lib/ledger/types';
import { confirmRecurring, dueForConfirmation, skipRecurring } from '@/lib/wallet/recurring';
import type { Recurring } from '@/lib/wallet/types';
import { netWorth, useCategories } from '@/lib/wallet/wallet';
import { foldQuery, useWalletSearch, WALLET_KINDS } from '@/lib/search/search';

export default function WalletScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isRtl } = useDirection();
  const accounts = useAccounts();
  const balances = useBalances();
  const entries = useEntries();
  const rates = useExchangeRates();
  const categories = useCategories();
  const recurring = useDocs<Recurring>(RecordTypes.recurring);
  const { accountName, amount, format, mainCurrency } = useLedgerLabels();
  const [month, setMonth] = useState(monthOf(today()));
  // Search over every month; global search opens the wallet with `q` filled in.
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [linkedQuery, setLinkedQuery] = useState(params.q);
  if (linkedQuery !== params.q) {
    setLinkedQuery(params.q);
    setQuery(params.q ?? '');
  }
  const deferredQuery = useDeferredValue(query);
  const found = useWalletSearch(deferredQuery);
  const searching = !!foldQuery(deferredQuery);

  // Investment capital accounts are listed under Investments (they still count in net worth).
  const moneyAccounts = accounts.filter(
    (account) => (account.unit.kind === 'money' || account.unit.kind === 'gold') && account.role !== 'investment',
  );
  const active = moneyAccounts.filter((account) => !account.archived);
  const archived = moneyAccounts.filter((account) => account.archived);
  const worth = useMemo(() => netWorth(accounts, balances, mainCurrency, rates), [accounts, balances, mainCurrency, rates]);
  const due = dueForConfirmation(recurring);
  const monthEntries = searching
    ? found
    : entries.filter((entry) => WALLET_KINDS.includes(entry.kind) && monthOf(entry.date) === month);

  const categoryName = (id?: string) => {
    const category = categories.find((item) => item.id === id);
    return category ? (category.preset ? t(`wallet.defaultCategories.${category.preset}`) : category.name) : null;
  };

  const describe = (entry: Entry) => {
    if (entry.note) return entry.note;
    if (entry.kind === 'transfer' || entry.kind === 'top_up' || entry.kind === 'loan') {
      const [from, to] = entry.lines;
      const a = accounts.find((item) => item.id === from?.account);
      const b = accounts.find((item) => item.id === to?.account);
      return `${a ? accountName(a) : ''} → ${b ? accountName(b) : ''}`;
    }
    return categoryName(entry.categoryId) ?? t(`hisab.kinds.${entry.kind}`);
  };

  const entryValue = (entry: Entry) => {
    const line = entry.lines[0];
    const account = accounts.find((item) => item.id === line?.account);
    if (!line || !account) return '';
    return amount(account, entry.kind === 'expense' || entry.kind === 'income' ? line.amount : Math.abs(line.amount));
  };

  const links: [string, Href][] = [
    [t('investments.title'), '/investments'],
    [t('wallet.goals'), '/wallet/goals'],
    [t('wallet.recurring'), '/wallet/recurring'],
    [t('stats.title'), { pathname: '/stats', params: { section: 'dunya' } }],
    [t('wallet.zakat'), '/wallet/zakat'],
  ];

  const transaction = (kind: string) => router.push({ pathname: '/wallet/transaction', params: { kind } });
  const addAccount = () => router.push({ pathname: '/wallet/account/[id]', params: { id: 'new' } });

  return (
    <Screen inTabs title={t('wallet.title')} subtitle={t('wallet.subtitle')}>
      <ArchCard>
        <AppText variant="label" color="textSecondary" align="center">
          {t('wallet.netWorth')}
        </AppText>
        <AppText variant="title" color="primary" align="center">
          {format.money(worth.total, mainCurrency)}
        </AppText>
        <AppText variant="caption" color={worth.reserved < 0 ? 'danger' : 'textSecondary'} align="center">
          {t('wallet.reserved')}: {format.money(worth.reserved, mainCurrency)}
        </AppText>
      </ArchCard>

      <View style={styles.quick}>
        <Button title={t('wallet.expense')} style={styles.flex} onPress={() => transaction('expense')} />
        <Button title={t('wallet.income')} variant="secondary" style={styles.flex} onPress={() => transaction('income')} />
        <Button title={t('wallet.transfer')} variant="secondary" style={styles.flex} onPress={() => transaction('transfer')} />
      </View>

      {due.map((item) => (
        <Card key={item.id} tone="accent">
          <AppText variant="label" weight="semibold">
            {t('wallet.dueConfirm', { name: item.name })}
          </AppText>
          <View style={styles.quick}>
            <Button title={t('wallet.confirmAdd')} style={styles.flex} onPress={() => void confirmRecurring(item)} />
            <Button title={t('wallet.skip')} variant="ghost" style={styles.flex} onPress={() => void skipRecurring(item)} />
          </View>
        </Card>
      ))}

      <Section
        title={t('wallet.accounts')}
        action={<SectionAction label={t('wallet.addAccount')} onPress={addAccount} />}>
        <Card>
          {active.map((account, index) => {
            const value = balances.get(account.id) ?? 0;
            return (
              <Fragment key={account.id}>
                {index > 0 ? <Divider /> : null}
                <Row
                  title={accountName(account)}
                  subtitle={[
                    t(`wallet.roles.${account.role}`),
                    account.unit.kind === 'money' ? (account.unit.currency ?? mainCurrency) : t('wallet.unitGold'),
                    account.hidden ? t('wallet.hidden') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  value={amount(account, value)}
                  valueColor={value < 0 ? 'danger' : 'text'}
                  chevron
                  onPress={() => router.push({ pathname: '/wallet/account/[id]', params: { id: account.id } })}
                />
              </Fragment>
            );
          })}
          {active.length ? <Divider /> : null}
          <AddRow label={t('wallet.addAccount')} onPress={addAccount} />
        </Card>
        {archived.length ? (
          <AppText variant="caption" color="textSecondary">
            {t('wallet.archived')}: {archived.map(accountName).join('، ')}
          </AppText>
        ) : null}
      </Section>

      <DebtsCard />

      <Card>
        {links.map(([label, href], index) => (
          <Fragment key={label}>
            {index > 0 ? <Divider /> : null}
            <Row title={label} chevron onPress={() => router.push(href)} />
          </Fragment>
        ))}
      </Card>

      <Section title={t('wallet.transactions')}>
        <SearchBox value={query} onChangeText={setQuery} placeholder={t('search.walletPlaceholder')} />
        {searching ? (
          <AppText variant="caption" color="textSecondary">
            {t('search.walletFound', { n: format.number(found.length) })}
          </AppText>
        ) : (
          <View style={styles.monthRow}>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setMonth(addMonths(month, -1))}>
              <BackIcon size={22} color={theme.primary} flip={isRtl} />
            </Pressable>
            <AppText variant="heading" align="center" style={styles.flex}>
              {format.month(month)}
            </AppText>
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              disabled={month >= monthOf(today())}
              onPress={() => setMonth(addMonths(month, 1))}
              style={{ opacity: month >= monthOf(today()) ? 0.3 : 1 }}>
              <BackIcon size={22} color={theme.primary} flip={!isRtl} />
            </Pressable>
          </View>
        )}
        <Card>
          {monthEntries.length ? (
            monthEntries.map((entry, index) => (
              <Fragment key={entry.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  onLongPress={() =>
                    Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('common.delete'), style: 'destructive', onPress: () => void deleteEntry(entry.id) },
                    ])
                  }>
                  <Row
                    title={describe(entry)}
                    subtitle={`${format.day(entry.date)} · ${t(`hisab.kinds.${entry.kind}`)}${entry.person ? ` · ${entry.person}` : ''}`}
                    value={entryValue(entry)}
                    valueColor={entry.kind === 'income' ? 'primary' : entry.kind === 'expense' ? 'danger' : 'text'}
                  />
                </Pressable>
              </Fragment>
            ))
          ) : (
            <AppText variant="label" color="textSecondary" align="center">
              {searching ? t('search.noResults') : t('wallet.noTransactions')}
            </AppText>
          )}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  quick: { flexDirection: 'row', gap: Spacing.two },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.two },
});
