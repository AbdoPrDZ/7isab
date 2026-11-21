import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useInvestmentMoney } from '@/components/investments/use-investment-money';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { AmountInput, Card, Chips, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { today } from '@/lib/dates';
import { parseAmount } from '@/lib/format';
import { addRecord, RECORD_TYPES, useInvestment, type RecordType } from '@/lib/investments/investments';
import { useAccounts, useLedgerLabels } from '@/lib/ledger/hooks';

/** Value meaning "no wallet account": money from outside (capital) or kept in the investment (profit). */
const NONE = '__none__';

/** Adds capital, records a profit or a loss, or takes capital back (`?id=&type=`). */
export default function InvestmentRecordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const investment = useInvestment(params.id);
  const accounts = useAccounts();
  const { accountName, format, mainCurrency } = useLedgerLabels();
  const { currencyOf } = useInvestmentMoney();
  const [type, setType] = useState<RecordType>(
    RECORD_TYPES.includes(params.type as RecordType) ? (params.type as RecordType) : 'profit',
  );
  const [amountText, setAmountText] = useState('');
  const [account, setAccount] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!investment) {
    return (
      <Screen back title={t('investments.title')}>
        <AppText color="textSecondary">{t('investments.notFound')}</AppText>
      </Screen>
    );
  }

  const currency = currencyOf(investment);
  // Only wallet accounts in the investment's currency, so no exchange rate is needed.
  const wallets = accounts.filter(
    (item) =>
      !item.archived &&
      item.unit.kind === 'money' &&
      (item.unit.currency ?? mainCurrency) === currency &&
      (item.role === 'wallet' || item.role === 'savings' || item.fixed === 'cash'),
  );
  const noneLabel =
    type === 'profit' ? t('investments.record.keepIn') : type === 'loss' ? null : t('investments.record.outsideOption');
  const options = type === 'loss' ? [] : [...wallets.map((item) => ({ value: item.id, label: accountName(item) }))];
  const selected = type === 'loss' ? NONE : (account ?? wallets[0]?.id ?? NONE);

  const save = async () => {
    const amount = parseAmount(amountText);
    if (amount === null || amount <= 0) return setError(t('investments.record.amountRequired'));
    setSaving(true);
    await addRecord(investment, type, amount, {
      accountId: selected === NONE ? null : selected,
      date,
      note: note.trim(),
    });
    router.back();
  };

  return (
    <Screen
      back
      title={investment.name}
      subtitle={t(`investments.record.add.${type}`)}
      footer={<Button title={t('common.save')} loading={saving} onPress={() => void save()} />}>
      <Chips
        options={RECORD_TYPES.map((value) => ({ value, label: t(`investments.record.types.${value}`) }))}
        value={type}
        onChange={(value) => {
          setType(value);
          setAccount(null);
        }}
      />
      <AppText variant="caption" color="textSecondary">
        {t(`investments.record.hints.${type}`)}
      </AppText>

      <AmountInput
        label={t('common.amount')}
        value={amountText}
        onChangeText={(text) => {
          setAmountText(text);
          setError(null);
        }}
        suffix={currency}
        error={error}
      />

      {type !== 'loss' ? (
        <Section title={t(`investments.record.accountTitle.${type}`)}>
          <Chips
            options={[...options, ...(noneLabel ? [{ value: NONE, label: noneLabel }] : [])]}
            value={selected}
            onChange={setAccount}
          />
          {!wallets.length ? (
            <AppText variant="caption" color="textSecondary">
              {t('investments.record.noAccounts', { currency })}
            </AppText>
          ) : null}
        </Section>
      ) : null}

      <Card>
        <Row title={t('investments.record.date')} value={format.day(date, 'long')} chevron onPress={() => setPicking(true)} />
      </Card>

      <TextField label={t('common.note')} value={note} onChangeText={setNote} />

      <DateRangePicker
        visible={picking}
        single
        title={t('investments.record.date')}
        start={date}
        end={date}
        onCancel={() => setPicking(false)}
        onConfirm={(day) => {
          setDate(day);
          setPicking(false);
        }}
      />
    </Screen>
  );
}
