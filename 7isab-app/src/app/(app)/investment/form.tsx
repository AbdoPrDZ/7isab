import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { HalalRules } from '@/components/investments/halal-rules';
import { useInvestmentMoney } from '@/components/investments/use-investment-money';
import { SwitchRow } from '@/components/prayer/quality-settings';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { AmountInput, Card, Chips, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toDay, today } from '@/lib/dates';
import { parseAmount } from '@/lib/format';
import {
  HALAL_CHECKS,
  INVESTMENT_KINDS,
  PROFIT_PERIODS,
  saveInvestment,
  sharesProfit,
  useInvestment,
  type HalalCheck,
  type InvestmentKind,
  type ProfitPeriod,
} from '@/lib/investments/investments';
import { useAccounts, useLedgerLabels } from '@/lib/ledger/hooks';

/** New investment, or `?id=` to edit one. */
export default function InvestmentFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useInvestment(id);
  return <InvestmentForm key={existing?.id ?? 'new'} id={id} />;
}

function InvestmentForm({ id }: { id?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const existing = useInvestment(id);
  const accounts = useAccounts();
  const { format, mainCurrency } = useLedgerLabels();
  const { accountOf, currencyOf } = useInvestmentMoney();
  const account = existing ? accountOf(existing) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<InvestmentKind>(existing?.kind ?? 'trade');
  const [partner, setPartner] = useState(existing?.partner ?? '');
  const [profitShare, setProfitShare] = useState(existing?.profitShare ? String(existing.profitShare) : '');
  const [capitalShare, setCapitalShare] = useState(existing?.capitalShare ? String(existing.capitalShare) : '');
  const [currency, setCurrency] = useState(existing ? currencyOf(existing) : mainCurrency);
  const [startDate, setStartDate] = useState(existing?.startDate ?? today());
  const [picking, setPicking] = useState(false);
  const [expected, setExpected] = useState(existing?.expected ? String(existing.expected.amount) : '');
  const [period, setPeriod] = useState<ProfitPeriod>(existing?.expected?.period ?? 'month');
  const [zakat, setZakat] = useState(account ? !account.zakatExempt : true);
  const [note, setNote] = useState(existing?.note ?? '');
  const [checks, setChecks] = useState<Record<HalalCheck, boolean>>(
    Object.fromEntries(HALAL_CHECKS.map((check) => [check, !!existing])) as Record<HalalCheck, boolean>,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currencies = [
    ...new Set([
      mainCurrency,
      ...accounts.flatMap((item) => (item.unit.kind === 'money' && item.unit.currency ? [item.unit.currency] : [])),
    ]),
  ];
  const percentOk = (text: string, max: number) => {
    const value = parseAmount(text);
    return value !== null && value > 0 && value <= max;
  };

  const changeKind = (next: InvestmentKind) => {
    setKind(next);
    // An asset rented out: zakat is due on the rent kept, not on the asset.
    if (!existing) setZakat(next !== 'ijara');
  };

  const save = async () => {
    if (!name.trim()) return setError(t('common.nameRequired'));
    if (sharesProfit(kind) && !percentOk(profitShare, 100)) return setError(t('investments.form.profitShareRequired'));
    if (kind === 'musharaka' && !percentOk(capitalShare, 100)) return setError(t('investments.form.capitalShareRequired'));
    const expectedAmount = expected.trim() ? parseAmount(expected) : null;
    if (expected.trim() && (expectedAmount === null || expectedAmount < 0)) return setError(t('investments.form.expectedInvalid'));
    if (!existing && HALAL_CHECKS.some((check) => !checks[check])) return setError(t('investments.form.checksRequired'));
    setSaving(true);
    const saved = await saveInvestment({
      id: existing?.id,
      name: name.trim(),
      kind,
      partner: kind === 'trade' ? undefined : partner.trim() || undefined,
      profitShare: sharesProfit(kind) ? (parseAmount(profitShare) ?? undefined) : undefined,
      capitalShare: kind === 'musharaka' ? (parseAmount(capitalShare) ?? undefined) : undefined,
      startDate,
      expected: expectedAmount ? { amount: expectedAmount, period } : null,
      note: note.trim() || undefined,
      closedAt: existing?.closedAt,
      currency,
      zakat,
    });
    if (existing) router.back();
    else router.replace({ pathname: '/investment/[id]', params: { id: saved.id } });
  };

  return (
    <Screen
      back
      title={existing ? t('investments.form.editTitle') : t('investments.form.newTitle')}
      footer={<Button title={t('common.save')} loading={saving} onPress={() => void save()} />}>
      <TextField
        label={t('investments.form.name')}
        placeholder={t('investments.form.namePlaceholder')}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        error={error}
      />

      <Section title={t('investments.form.kind')}>
        <Chips
          options={INVESTMENT_KINDS.map((value) => ({ value, label: t(`investments.kinds.${value}`) }))}
          value={kind}
          onChange={changeKind}
        />
        <HalalRules kind={kind} initiallyOpen />
      </Section>

      {kind !== 'trade' ? (
        <TextField
          label={t(`investments.form.partner.${kind}`)}
          value={partner}
          onChangeText={setPartner}
        />
      ) : null}
      {sharesProfit(kind) ? (
        <AmountInput
          label={t('investments.form.profitShare')}
          value={profitShare}
          onChangeText={setProfitShare}
          suffix="%"
          placeholder="50"
        />
      ) : null}
      {kind === 'musharaka' ? (
        <AmountInput
          label={t('investments.form.capitalShare')}
          value={capitalShare}
          onChangeText={setCapitalShare}
          suffix="%"
          placeholder="50"
        />
      ) : null}

      <Section title={t('investments.form.currency')}>
        {existing ? (
          <AppText variant="label">{currency}</AppText>
        ) : (
          <Chips options={currencies.map((value) => ({ value, label: value }))} value={currency} onChange={setCurrency} />
        )}
      </Section>

      <Card>
        <Row title={t('investments.form.startDate')} value={format.day(startDate, 'long')} chevron onPress={() => setPicking(true)} />
      </Card>

      <Section title={t('investments.form.expectedTitle')}>
        <AmountInput
          label={t(sharesProfit(kind) ? 'investments.form.expectedShare' : 'investments.form.expected')}
          value={expected}
          onChangeText={setExpected}
          suffix={currency}
          placeholder={t('investments.form.optional')}
        />
        <Chips
          options={PROFIT_PERIODS.map((value) => ({ value, label: t(`investments.periods.${value}`) }))}
          value={period}
          onChange={setPeriod}
        />
        <AppText variant="caption" color="textSecondary">
          {t('investments.form.expectedHint')}
        </AppText>
      </Section>

      <Card>
        <SwitchRow
          label={t('investments.form.zakat')}
          hint={t(kind === 'ijara' ? 'investments.form.zakatHintIjara' : 'investments.form.zakatHint')}
          value={zakat}
          onChange={setZakat}
        />
      </Card>

      <TextField label={t('investments.form.note')} value={note} onChangeText={setNote} multiline />

      {existing ? (
        <AppText variant="caption" color="textSecondary">
          {t('investments.form.confirmedOn', { date: format.day(toDay(new Date(existing.confirmedAt)), 'long') })}
        </AppText>
      ) : (
        <Section title={t('investments.form.checksTitle')}>
          <Card>
            {HALAL_CHECKS.map((check, index) => (
              <View key={check}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.check}>
                  <AppText variant="label" style={styles.flex}>
                    {t(`investments.checks.${check}`)}
                  </AppText>
                  <Switch
                    value={checks[check]}
                    onValueChange={(value) => {
                      setChecks({ ...checks, [check]: value });
                      setError(null);
                    }}
                    trackColor={{ true: theme.primary }}
                  />
                </View>
              </View>
            ))}
          </Card>
          <AppText variant="caption" color="textSecondary">
            {t('investments.form.checksHint')}
          </AppText>
        </Section>
      )}

      <DateRangePicker
        visible={picking}
        single
        title={t('investments.form.startDate')}
        start={startDate}
        end={startDate}
        onCancel={() => setPicking(false)}
        onConfirm={(day) => {
          setStartDate(day);
          setPicking(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
});
