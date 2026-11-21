/**
 * Today: warnings while Sadaqa or Zakat is below zero, the Thanb still to pay,
 * and the Akhira quick actions (pay Thanb, give sadaqa, pay zakat, top up, log
 * a sin). Moved here from the old Hisab tab.
 */
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { AlertIcon } from '@/components/ui/icons';
import { Card, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccounts, useBalances, useLedgerLabels } from '@/lib/ledger/hooks';

export function NegativeWarnings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const accounts = useAccounts();
  const balances = useBalances();
  const { accountName } = useLedgerLabels();
  const negatives = accounts.filter(
    (account) => (account.fixed === 'sadaqa' || account.fixed === 'zakat') && (balances.get(account.id) ?? 0) < 0,
  );
  return (
    <>
      {negatives.map((account) => (
        <Card key={account.id} tone="danger" style={styles.warning}>
          <AlertIcon size={20} color={theme.danger} />
          <AppText variant="label" color="danger" style={styles.flex}>
            {t('hisab.negative', { account: accountName(account) })}
          </AppText>
        </Card>
      ))}
    </>
  );
}

export function HisabQuickActions() {
  const { t } = useTranslation();
  const accounts = useAccounts();
  const balances = useBalances();
  const { format } = useLedgerLabels();
  const thanb = balances.get(accounts.find((account) => account.fixed === 'thanb')?.id ?? '') ?? 0;
  const action = (kind: string) => router.push({ pathname: '/hisab/action', params: { kind } });

  return (
    <Section title={t('hisab.actions')}>
      {thanb > 0 ? (
        <AppText variant="caption" color="textSecondary">
          {t('hisab.thanbDue', { points: format.points(thanb) })}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button title={t('hisab.payThanb')} style={styles.action} onPress={() => action('thanb')} />
        <Button title={t('hisab.giveSadaqa')} style={styles.action} variant="secondary" onPress={() => action('sadaqa')} />
        <Button title={t('hisab.payZakat')} style={styles.action} variant="secondary" onPress={() => action('zakat')} />
        <Button title={t('hisab.topUp')} style={styles.action} variant="secondary" onPress={() => action('topUp')} />
        <Button title={t('today.logSin')} style={styles.action} variant="secondary" onPress={() => router.push('/sins')} />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: { flexGrow: 1, flexBasis: '45%' },
});
