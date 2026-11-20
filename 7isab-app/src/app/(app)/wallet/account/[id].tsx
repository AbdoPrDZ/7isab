import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Chips, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDoc } from '@/lib/data/vault';
import { useAccounts, useBalances, useEntries, useLedgerLabels } from '@/lib/ledger/hooks';
import { RecordTypes, type Account, type AccountRole } from '@/lib/ledger/types';
import { saveAccount } from '@/lib/wallet/wallet';

const ROLES: AccountRole[] = ['wallet', 'savings', 'lent', 'borrowed'];

/** Create or edit a wallet account, and see its latest entries. */
export default function AccountScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useDoc<Account>(RecordTypes.account, id === 'new' ? undefined : id);
  const accounts = useAccounts();
  const balances = useBalances();
  const entries = useEntries();
  const { accountName, amount, format, mainCurrency } = useLedgerLabels();

  const fixed = !!existing?.fixed;
  const [name, setName] = useState(existing && !existing.fixed ? existing.name : '');
  const [role, setRole] = useState<AccountRole>(existing?.role === 'fixed' ? 'wallet' : (existing?.role ?? 'wallet'));
  const [unit, setUnit] = useState<'money' | 'gold'>(existing?.unit.kind === 'gold' ? 'gold' : 'money');
  const [currency, setCurrency] = useState(
    existing?.unit.kind === 'money' ? (existing.unit.currency ?? mainCurrency) : mainCurrency,
  );
  const [hidden, setHidden] = useState(existing?.hidden ?? false);
  const [error, setError] = useState<string | null>(null);

  const history = existing ? entries.filter((entry) => entry.lines.some((line) => line.account === existing.id)).slice(0, 30) : [];

  const save = async (changes: Partial<Account> = {}) => {
    if (!fixed && !name.trim()) return setError(t('common.nameRequired'));
    const code = currency.trim().toUpperCase();
    if (unit === 'money' && !/^[A-Z]{3}$/.test(code)) return setError(t('settingsExtra.mainCurrencyHint'));
    await saveAccount({
      ...(existing ?? {}),
      id: existing?.id,
      name: fixed ? existing!.name : name.trim(),
      role: fixed ? 'fixed' : role,
      fixed: existing?.fixed,
      unit: fixed ? existing!.unit : unit === 'gold' ? { kind: 'gold' } : { kind: 'money', currency: code === mainCurrency ? undefined : code },
      hidden,
      archived: existing?.archived,
      order: existing?.order ?? 20 + accounts.length,
      ...changes,
    });
    router.back();
  };

  return (
    <Screen
      back
      title={existing ? accountName(existing) : t('wallet.addAccount')}
      subtitle={existing ? amount(existing, balances.get(existing.id) ?? 0) : undefined}
      footer={<Button title={t('common.save')} onPress={() => void save()} />}>
      {!fixed ? (
        <>
          <TextField label={t('wallet.accountName')} value={name} onChangeText={setName} error={error} />
          <Section title={t('wallet.role')}>
            <Chips options={ROLES.map((value) => ({ value, label: t(`wallet.roles.${value}`) }))} value={role} onChange={setRole} />
          </Section>
          <Section title={t('wallet.unit')}>
            <Chips
              options={[
                { value: 'money' as const, label: t('wallet.unitMoney') },
                { value: 'gold' as const, label: t('wallet.unitGold') },
              ]}
              value={unit}
              onChange={setUnit}
            />
            {unit === 'money' ? (
              <TextField
                label={t('wallet.currency')}
                value={currency}
                maxLength={3}
                autoCapitalize="characters"
                onChangeText={(text) => setCurrency(text.toUpperCase())}
              />
            ) : null}
          </Section>
        </>
      ) : null}

      <View style={styles.switchRow}>
        <AppText variant="label" style={styles.flex}>
          {t('wallet.hidden')}
        </AppText>
        <Switch value={hidden} onValueChange={setHidden} trackColor={{ true: theme.primary }} />
      </View>

      {existing && !fixed ? (
        <Button
          title={existing.archived ? t('wallet.unarchive') : t('wallet.archive')}
          variant="secondary"
          onPress={() => void save({ archived: !existing.archived })}
        />
      ) : null}

      {existing && existing.fixed !== 'sadaqa' && existing.fixed !== 'zakat' && (existing.unit.kind === 'money' || existing.unit.kind === 'gold') ? (
        <Button
          title={t('stats.openStats')}
          variant="ghost"
          onPress={() => router.push({ pathname: '/stats', params: { section: 'dunya', account: existing.id } })}
        />
      ) : null}

      {history.length ? (
        <Section title={t('wallet.transactions')}>
          <Card>
            {history.map((entry, index) => {
              const line = entry.lines.find((item) => item.account === existing!.id)!;
              return (
                <Fragment key={entry.id}>
                  {index > 0 ? <Divider /> : null}
                  <Row
                    title={entry.note || t(`hisab.kinds.${entry.kind}`)}
                    subtitle={format.day(entry.date)}
                    value={amount(existing!, line.amount)}
                    valueColor={line.amount < 0 ? 'danger' : 'primary'}
                  />
                </Fragment>
              );
            })}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
