import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { AmountInput, Card, Chips, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { today } from '@/lib/dates';
import { useDocs } from '@/lib/data/vault';
import { parseAmount } from '@/lib/format';
import { useAccounts, useLedgerLabels } from '@/lib/ledger/hooks';
import { RecordTypes } from '@/lib/ledger/types';
import { deleteRecurring, saveRecurring } from '@/lib/wallet/recurring';
import type { Recurring, RecurringKind } from '@/lib/wallet/types';
import { useCategories } from '@/lib/wallet/wallet';

/** Salary, rent, subscriptions and scheduled Sadaqa / Zakat top-ups. */
export default function RecurringScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const items = useDocs<Recurring>(RecordTypes.recurring);
  const accounts = useAccounts();
  const categories = useCategories();
  const { accountName, amount: formatAmount, format } = useLedgerLabels();
  const money = accounts.filter((account) => !account.archived && account.unit.kind === 'money');
  const sources = money.filter((account) => account.fixed !== 'sadaqa' && account.fixed !== 'zakat');

  const [name, setName] = useState('');
  const [kind, setKind] = useState<RecurringKind>('expense');
  const [accountId, setAccountId] = useState(sources.find((a) => a.fixed === 'cash')?.id ?? '');
  const [toAccountId, setToAccountId] = useState(money.find((a) => a.fixed === 'sadaqa')?.id ?? '');
  const [value, setValue] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<Recurring['frequency']>('monthly');
  const [auto, setAuto] = useState(true);

  const add = async () => {
    const amount = parseAmount(value);
    if (!name.trim() || !amount || !accountId) return;
    await saveRecurring({
      name: name.trim(),
      kind,
      accountId,
      toAccountId: kind === 'transfer' ? toAccountId : undefined,
      amount,
      categoryId: kind !== 'transfer' && categoryId ? categoryId : undefined,
      frequency,
      next: today(),
      auto,
    });
    setName('');
    setValue('');
  };

  return (
    <Screen back title={t('wallet.recurring')}>
      <Card>
        {items.length ? (
          items.map((item, index) => {
            const account = accounts.find((a) => a.id === item.accountId);
            return (
              <Fragment key={item.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  onLongPress={() =>
                    Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('common.delete'), style: 'destructive', onPress: () => void deleteRecurring(item.id) },
                    ])
                  }>
                  <Row
                    title={item.name}
                    subtitle={`${t('wallet.every')} ${t(`wallet.frequency.${item.frequency}`)} · ${t('wallet.nextDate', { date: format.day(item.next) })}${item.auto ? ` · ${t('wallet.autoAdd')}` : ''}`}
                    value={account ? formatAmount(account, item.kind === 'income' ? item.amount : -item.amount) : ''}
                  />
                </Pressable>
              </Fragment>
            );
          })
        ) : (
          <AppText variant="label" color="textSecondary" align="center">
            {t('wallet.noRecurring')}
          </AppText>
        )}
      </Card>

      <Section title={t('wallet.addRecurring')}>
        <TextField label={t('wallet.goalName')} value={name} onChangeText={setName} />
        <Chips
          options={(['expense', 'income', 'transfer'] as const).map((value) => ({ value, label: t(`wallet.${value}`) }))}
          value={kind}
          onChange={setKind}
        />
        <AmountInput label={t('common.amount')} value={value} onChangeText={setValue} />
        <AppText variant="label" color="textSecondary">
          {kind === 'transfer' ? t('wallet.from') : t('wallet.account')}
        </AppText>
        <Chips options={sources.map((a) => ({ value: a.id, label: accountName(a) }))} value={accountId} onChange={setAccountId} />
        {kind === 'transfer' ? (
          <>
            <AppText variant="label" color="textSecondary">
              {t('wallet.to')}
            </AppText>
            <Chips
              options={money.filter((a) => a.id !== accountId).map((a) => ({ value: a.id, label: accountName(a) }))}
              value={toAccountId}
              onChange={setToAccountId}
            />
          </>
        ) : (
          <Chips
            options={[
              { value: '', label: t('wallet.noCategory') },
              ...categories
                .filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'))
                .map((c) => ({ value: c.id, label: c.preset ? t(`wallet.defaultCategories.${c.preset}`) : c.name })),
            ]}
            value={categoryId}
            onChange={setCategoryId}
          />
        )}
        <AppText variant="label" color="textSecondary">
          {t('wallet.every')}
        </AppText>
        <Chips
          options={(['weekly', 'monthly', 'yearly'] as const).map((value) => ({ value, label: t(`wallet.frequency.${value}`) }))}
          value={frequency}
          onChange={setFrequency}
        />
        <View style={styles.switchRow}>
          <AppText variant="label" style={styles.flex}>
            {t('wallet.autoAdd')}
          </AppText>
          <Switch value={auto} onValueChange={setAuto} trackColor={{ true: theme.primary }} />
        </View>
        <Button title={t('common.add')} variant="secondary" onPress={() => void add()} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
