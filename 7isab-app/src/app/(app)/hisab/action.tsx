import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { AmountInput, Card, Chips, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { parseAmount } from '@/lib/format';
import { useAccounts, useBalances, useExchangeRates, useLedgerLabels, useSettings } from '@/lib/ledger/hooks';
import { fixedAccountId, giveSadaqa, payThanb, payZakat, round, transfer } from '@/lib/ledger/ledger';

type ActionKind = 'thanb' | 'sadaqa' | 'zakat' | 'topUp';

/** Pay thanb, give sadaqa, pay zakat, or top up Sada9a / Zakat. */
export default function HisabActionScreen() {
  const { t } = useTranslation();
  const { kind: rawKind } = useLocalSearchParams<{ kind: ActionKind }>();
  const kind: ActionKind = ['thanb', 'sadaqa', 'zakat', 'topUp'].includes(rawKind) ? rawKind : 'sadaqa';
  const settings = useSettings();
  const accounts = useAccounts();
  const balances = useBalances();
  const rates = useExchangeRates();
  const { accountName, amount: formatAmount, format, mainCurrency, currencyOf } = useLedgerLabels();

  const moneyAccounts = accounts.filter(
    (account) => account.unit.kind === 'money' && !account.archived && account.fixed !== 'sadaqa' && account.fixed !== 'zakat',
  );
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [from, setFrom] = useState(moneyAccounts.find((a) => a.fixed === 'cash')?.id ?? moneyAccounts[0]?.id ?? '');
  const [to, setTo] = useState<'sadaqa' | 'zakat'>('sadaqa');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const thanbBalance = balances.get(fixedAccountId('thanb')) ?? 0;
  const parsed = parseAmount(value) ?? 0;
  const fromAccount = accounts.find((account) => account.id === from);
  const fromCurrency = fromAccount ? (currencyOf(fromAccount) ?? mainCurrency) : mainCurrency;
  const rate = fromCurrency === mainCurrency ? 1 : (rates.find((item) => item.currency === fromCurrency)?.rate ?? 1);
  const r = settings?.rates;

  const titles: Record<ActionKind, [string, string]> = {
    thanb: [t('action.payThanbTitle'), t('action.payThanbHint')],
    sadaqa: [t('action.sadaqaTitle'), t('action.sadaqaHint')],
    zakat: [t('action.zakatTitle'), t('action.zakatHint')],
    topUp: [t('action.topUpTitle'), t('action.topUpHint')],
  };

  const preview = (() => {
    if (!r || parsed <= 0) return [];
    const akhira = accounts.find((a) => a.fixed === 'akhira');
    const thanb = accounts.find((a) => a.fixed === 'thanb');
    const sadaqa = accounts.find((a) => a.fixed === 'sadaqa');
    const zakat = accounts.find((a) => a.fixed === 'zakat');
    if (!akhira || !thanb || !sadaqa || !zakat) return [];
    switch (kind) {
      case 'thanb':
        return [
          [accountName(thanb), formatAmount(thanb, -parsed)],
          [accountName(sadaqa), formatAmount(sadaqa, -round(parsed * r.thanbCost))],
          [accountName(akhira), `+${formatAmount(akhira, round(parsed * r.thanbReward))}`],
        ];
      case 'sadaqa':
        return [
          [accountName(sadaqa), formatAmount(sadaqa, -parsed)],
          [accountName(akhira), `+${formatAmount(akhira, round(parsed * r.sadaqa))}`],
        ];
      case 'zakat':
        return [
          [accountName(zakat), formatAmount(zakat, -parsed)],
          [accountName(akhira), `+${formatAmount(akhira, round(parsed * r.zakat))}`],
        ];
      default: {
        const target = to === 'sadaqa' ? sadaqa : zakat;
        return fromAccount
          ? [
              [accountName(fromAccount), formatAmount(fromAccount, -parsed)],
              [accountName(target), `+${formatAmount(target, round(parsed * rate))}`],
            ]
          : [];
      }
    }
  })();

  const submit = async () => {
    if (parsed <= 0) return setError(t('common.invalidAmount'));
    setSaving(true);
    const text = note.trim() || undefined;
    if (kind === 'thanb') await payThanb(parsed, text);
    else if (kind === 'sadaqa') await giveSadaqa(parsed, text);
    else if (kind === 'zakat') await payZakat(parsed, text);
    else await transfer(from, fixedAccountId(to), parsed, { rate, note: text, kind: 'top_up' });
    router.back();
  };

  return (
    <Screen
      back
      title={titles[kind][0]}
      subtitle={titles[kind][1]}
      footer={<Button title={t('common.confirm')} loading={saving} onPress={() => void submit()} />}>
      {kind === 'topUp' ? (
        <>
          <Section title={t('action.to')}>
            <Chips
              options={[
                { value: 'sadaqa' as const, label: t('accounts.sadaqa') },
                { value: 'zakat' as const, label: t('accounts.zakat') },
              ]}
              value={to}
              onChange={setTo}
            />
          </Section>
          <Section title={t('action.from')}>
            <Chips
              options={moneyAccounts.map((account) => ({ value: account.id, label: accountName(account) }))}
              value={from}
              onChange={setFrom}
            />
          </Section>
        </>
      ) : null}

      <AmountInput
        label={kind === 'thanb' ? t('action.points') : t('common.amount')}
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setError(null);
        }}
        suffix={kind === 'thanb' ? t('units.thanb') : kind === 'topUp' ? fromCurrency : mainCurrency}
        error={error}
      />
      {kind === 'thanb' && thanbBalance > 0 ? (
        <Button
          title={t('action.payAll', { points: format.points(thanbBalance) })}
          variant="ghost"
          onPress={() => setValue(String(thanbBalance))}
        />
      ) : null}

      <TextField label={t('common.note')} placeholder={t('common.notePlaceholder')} value={note} onChangeText={setNote} />

      {preview.length ? (
        <Section title={t('action.preview')}>
          <Card>
            {preview.map(([name, text], index) => (
              <View key={name}>
                {index > 0 ? <Divider /> : null}
                <Row title={name} value={text} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
      {kind === 'topUp' && rate !== 1 ? (
        <AppText variant="caption" color="textSecondary" style={styles.note}>
          {t('action.rate', { from: fromCurrency, to: mainCurrency })}: {format.number(rate, 4)}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: -Spacing.three },
});
