import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { AmountInput, Card, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { today } from '@/lib/dates';
import { parseAmount } from '@/lib/format';
import { useAccounts, useBalances, useExchangeRates, useLedgerLabels } from '@/lib/ledger/hooks';
import { round } from '@/lib/ledger/ledger';
import { GOLD_CURRENCY } from '@/lib/ledger/types';
import { NISAB_GOLD_GRAMS, balanceInMain, hawlEnd, saveZakatState, useZakatState } from '@/lib/wallet/wallet';

/**
 * Zakat calculator: zakatable wealth = money and gold you own (not Sadaqa /
 * Zakat, which are already owed, and minus what you borrowed), compared with
 * the nisab (85 g of gold). Zakat due is 2.5% once a lunar year (hawl) passes.
 */
export default function ZakatScreen() {
  const { t } = useTranslation();
  const accounts = useAccounts();
  const balances = useBalances();
  const rates = useExchangeRates();
  const state = useZakatState();
  const { accountName, amount, format, mainCurrency } = useLedgerLabels();
  const goldRate = rates.find((rate) => rate.currency === GOLD_CURRENCY)?.rate;
  const [priceText, setPriceText] = useState(String(state?.goldPrice || goldRate || ''));

  const goldPrice = parseAmount(priceText) ?? 0;
  const included = accounts.filter(
    (account) =>
      !account.archived &&
      (account.unit.kind === 'money' || account.unit.kind === 'gold') &&
      account.fixed !== 'sadaqa' &&
      account.fixed !== 'zakat',
  );
  // Gold uses the price typed here (falls back to the gold exchange rate).
  const zakatRates = goldPrice ? [...rates.filter((r) => r.currency !== GOLD_CURRENCY), { currency: GOLD_CURRENCY, rate: goldPrice }] : rates;
  const values = included.map((account) => ({
    account,
    value: balanceInMain(account, balances.get(account.id) ?? 0, mainCurrency, zakatRates as typeof rates) ?? 0,
  }));
  const wealth = round(values.reduce((sum, item) => sum + item.value, 0));
  const nisab = round(goldPrice * NISAB_GOLD_GRAMS);
  const due = goldPrice > 0 && wealth >= nisab ? round(wealth * 0.025) : 0;
  const hawlDue = state?.hawlStart ? hawlEnd(state.hawlStart) : null;

  return (
    <Screen back title={t('wallet.zakat')}>
      <AmountInput
        label={t('wallet.goldPrice', { currency: mainCurrency })}
        value={priceText}
        onChangeText={setPriceText}
        suffix={mainCurrency}
      />
      <Button title={t('common.save')} variant="secondary" onPress={() => void saveZakatState({ goldPrice }, state)} />

      <Card>
        {values.map(({ account, value }) => (
          <Row
            key={account.id}
            title={accountName(account)}
            subtitle={account.unit.kind === 'gold' || (account.unit.kind === 'money' && account.unit.currency) ? amount(account, balances.get(account.id) ?? 0) : undefined}
            value={format.money(value, mainCurrency)}
            valueColor={value < 0 ? 'danger' : 'text'}
          />
        ))}
        <Divider />
        <AppText variant="label">{t('wallet.zakatable', { amount: format.money(wealth, mainCurrency) })}</AppText>
        <AppText variant="label" color="textSecondary">
          {t('wallet.nisab', { amount: format.money(nisab, mainCurrency) })}
        </AppText>
      </Card>

      <Card tone={due > 0 ? 'accent' : 'surface'}>
        <AppText variant="heading" color={due > 0 ? 'primary' : 'textSecondary'}>
          {due > 0 ? t('wallet.zakatDue', { amount: format.money(due, mainCurrency) }) : t('wallet.belowNisab')}
        </AppText>
        {due > 0 ? (
          <Button
            title={t('wallet.addToZakat')}
            onPress={() => router.push({ pathname: '/hisab/action', params: { kind: 'topUp' } })}
          />
        ) : null}
      </Card>

      <Section title={t('wallet.hawlStart')}>
        <Card>
          <AppText variant="label">{state?.hawlStart ? format.day(state.hawlStart, 'long') : '—'}</AppText>
          {hawlDue ? (
            <AppText variant="caption" color={hawlDue <= today() ? 'danger' : 'textSecondary'}>
              {t('wallet.hawlDue', { date: format.day(hawlDue, 'long') })}
            </AppText>
          ) : null}
          <Button title={t('wallet.setHawl')} variant="ghost" onPress={() => void saveZakatState({ hawlStart: today() }, state)} />
        </Card>
      </Section>
    </Screen>
  );
}
