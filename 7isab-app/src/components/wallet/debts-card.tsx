/**
 * Wallet: what people owe me and what I owe, as two separate totals (never
 * netted), each by person, with the four loan actions.
 */
import { router } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Divider, Row, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { useDebts, type PersonDebt } from '@/lib/wallet/debts';

export function DebtsCard() {
  const { t } = useTranslation();
  const { format, mainCurrency } = useLedgerLabels();
  const debts = useDebts();
  const transaction = (kind: string) => router.push({ pathname: '/wallet/transaction', params: { kind } });

  const people = (rows: PersonDebt[], color: 'primary' | 'danger') =>
    rows.map((row) => (
      <Fragment key={row.person || '-'}>
        <Divider />
        <Row
          title={row.person || t('debts.noName')}
          value={format.money(row.amount, mainCurrency)}
          valueColor={row.amount < 0 ? 'textSecondary' : color}
        />
      </Fragment>
    ));

  return (
    <Section title={t('debts.title')}>
      <View style={styles.totals}>
        <Card style={styles.flex}>
          <AppText variant="caption" color="textSecondary">
            {t('debts.owedToMe')}
          </AppText>
          <AppText variant="heading" color="primary">
            {format.money(debts.owedToMe, mainCurrency)}
          </AppText>
        </Card>
        <Card style={styles.flex}>
          <AppText variant="caption" color="textSecondary">
            {t('debts.iOwe')}
          </AppText>
          <AppText variant="heading" color={debts.iOwe > 0 ? 'danger' : 'text'}>
            {format.money(debts.iOwe, mainCurrency)}
          </AppText>
        </Card>
      </View>

      {debts.owedToMeByPerson.length || debts.iOweByPerson.length ? (
        <Card>
          {debts.owedToMeByPerson.length ? (
            <>
              <AppText variant="label" weight="semibold">
                {t('debts.owedToMe')}
              </AppText>
              {people(debts.owedToMeByPerson, 'primary')}
            </>
          ) : null}
          {debts.owedToMeByPerson.length && debts.iOweByPerson.length ? <View style={styles.gap} /> : null}
          {debts.iOweByPerson.length ? (
            <>
              <AppText variant="label" weight="semibold">
                {t('debts.iOwe')}
              </AppText>
              {people(debts.iOweByPerson, 'danger')}
            </>
          ) : null}
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button title={t('wallet.lend')} variant="secondary" style={styles.action} onPress={() => transaction('lend')} />
        <Button title={t('wallet.repay')} variant="secondary" style={styles.action} onPress={() => transaction('repay')} />
        <Button title={t('wallet.borrow')} variant="secondary" style={styles.action} onPress={() => transaction('borrow')} />
        <Button title={t('wallet.payBack')} variant="secondary" style={styles.action} onPress={() => transaction('payBack')} />
      </View>
      <AppText variant="caption" color="textSecondary">
        {t('debts.hint')}
      </AppText>
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  totals: { flexDirection: 'row', gap: Spacing.two },
  gap: { height: Spacing.three },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: { flexGrow: 1, flexBasis: '45%' },
});
