import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { AmountInput, Chips, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { parseAmount } from '@/lib/format';
import { useAccounts, useExchangeRates, useLedgerLabels } from '@/lib/ledger/hooks';
import { addIncomeOrExpense, transfer } from '@/lib/ledger/ledger';
import type { Account } from '@/lib/ledger/types';
import { conversionCurrency, useCategories } from '@/lib/wallet/wallet';

/** repay: someone pays me back (owed to me → wallet); payBack: I repay a debt (wallet → I owe). */
type Kind = 'income' | 'expense' | 'transfer' | 'lend' | 'borrow' | 'repay' | 'payBack';
const KINDS: Kind[] = ['income', 'expense', 'transfer', 'lend', 'borrow', 'repay', 'payBack'];

/** Rate to convert 1 unit of `from` into `to`, from the manual rates (both relative to the main currency). */
function suggestedRate(from: string, to: string, main: string, rates: { currency: string; rate: number }[]): number {
  if (from === to) return 1;
  const inMain = (currency: string) => (currency === main ? 1 : (rates.find((r) => r.currency === currency)?.rate ?? 1));
  return Math.round((inMain(from) / inMain(to)) * 10000) / 10000;
}

export default function TransactionScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ kind: string }>();
  const kind: Kind = KINDS.includes(params.kind as Kind) ? (params.kind as Kind) : 'expense';
  const accounts = useAccounts();
  const rates = useExchangeRates();
  const categories = useCategories();
  const { accountName, mainCurrency } = useLedgerLabels();

  // Sadaqa / Zakat / points accounts are handled in Hisab, not here.
  const money = accounts.filter(
    (account) =>
      !account.archived &&
      (account.unit.kind === 'money' || account.unit.kind === 'gold') &&
      account.fixed !== 'sadaqa' &&
      account.fixed !== 'zakat',
  );
  const wallets = money.filter((account) => account.role !== 'lent' && account.role !== 'borrowed');
  const lent = money.filter((account) => account.role === 'lent');
  const borrowed = money.filter((account) => account.role === 'borrowed');
  const cash = wallets.find((account) => account.fixed === 'cash') ?? wallets[0];

  const defaults: Record<Kind, [Account | undefined, Account | undefined]> = {
    income: [cash, undefined],
    expense: [cash, undefined],
    transfer: [cash, wallets.find((account) => account.id !== cash?.id)],
    lend: [cash, lent[0]],
    borrow: [borrowed[0], cash],
    repay: [lent[0] ?? cash, cash],
    payBack: [cash, borrowed[0]],
  };
  const [from, setFrom] = useState(defaults[kind][0]?.id ?? '');
  const [to, setTo] = useState(defaults[kind][1]?.id ?? '');
  const [value, setValue] = useState('');
  const [rateText, setRateText] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [note, setNote] = useState('');
  const [person, setPerson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fromAccount = accounts.find((account) => account.id === from);
  const toAccount = accounts.find((account) => account.id === to);
  const fromCurrency = fromAccount ? conversionCurrency(fromAccount, mainCurrency) : null;
  const toCurrency = toAccount ? conversionCurrency(toAccount, mainCurrency) : null;
  const needsRate = !!fromCurrency && !!toCurrency && fromCurrency !== toCurrency && kind !== 'income' && kind !== 'expense';
  const defaultRate = needsRate ? suggestedRate(fromCurrency!, toCurrency!, mainCurrency, rates) : 1;

  const twoAccounts = kind !== 'income' && kind !== 'expense';
  const titles: Record<Kind, string> = {
    income: t('wallet.income'),
    expense: t('wallet.expense'),
    transfer: t('wallet.transfer'),
    lend: t('wallet.lend'),
    borrow: t('wallet.borrow'),
    repay: t('wallet.repay'),
    payBack: t('wallet.payBack'),
  };
  const fromOptions = { income: wallets, expense: wallets, transfer: money, lend: wallets, borrow: borrowed.length ? borrowed : money, repay: lent.length ? lent : money, payBack: wallets }[kind];
  const toOptions = { income: [], expense: [], transfer: money, lend: lent.length ? lent : money, borrow: wallets, repay: wallets, payBack: borrowed.length ? borrowed : money }[kind];
  const kindCategories = categories.filter((category) => category.kind === (kind === 'income' ? 'income' : 'expense'));

  const save = async () => {
    const amount = parseAmount(value);
    if (!amount || amount <= 0) return setError(t('common.invalidAmount'));
    if (!from || (twoAccounts && (!to || to === from))) return setError(t('common.invalidAmount'));
    setSaving(true);
    const text = note.trim() || undefined;
    if (kind === 'income' || kind === 'expense') {
      await addIncomeOrExpense(kind, from, amount, { categoryId: categoryId || undefined, note: text });
    } else {
      const rate = needsRate ? (parseAmount(rateText) ?? defaultRate) : 1;
      await transfer(from, to, amount, {
        rate,
        note: text,
        kind: kind === 'transfer' ? 'transfer' : 'loan',
        person: person.trim() || undefined,
      });
    }
    router.back();
  };

  const accountChips = (options: Account[]) => options.map((account) => ({ value: account.id, label: accountName(account) }));

  return (
    <Screen
      back
      title={titles[kind]}
      footer={<Button title={t('common.save')} loading={saving} onPress={() => void save()} />}>
      <AmountInput
        label={t('common.amount')}
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setError(null);
        }}
        suffix={fromCurrency === 'XAU_G' ? t('units.grams') : (fromCurrency ?? mainCurrency)}
        error={error}
      />

      <Section title={twoAccounts ? t('wallet.from') : t('wallet.account')}>
        <Chips options={accountChips(fromOptions)} value={from} onChange={setFrom} />
      </Section>

      {twoAccounts ? (
        <Section title={t('wallet.to')}>
          <Chips options={accountChips(toOptions.filter((account) => account.id !== from))} value={to} onChange={setTo} />
        </Section>
      ) : (
        <Section title={t('wallet.category')}>
          <Chips
            options={[
              { value: '', label: t('wallet.noCategory') },
              ...kindCategories.map((category) => ({
                value: category.id,
                label: category.preset ? t(`wallet.defaultCategories.${category.preset}`) : category.name,
              })),
            ]}
            value={categoryId}
            onChange={setCategoryId}
          />
        </Section>
      )}

      {needsRate ? (
        <AmountInput
          label={t('action.rate', { from: fromCurrency, to: toCurrency })}
          value={rateText}
          placeholder={String(defaultRate)}
          onChangeText={setRateText}
        />
      ) : null}

      {kind === 'lend' || kind === 'borrow' || kind === 'repay' || kind === 'payBack' ? (
        <TextField label={t('wallet.person')} value={person} onChangeText={setPerson} />
      ) : null}

      <TextField label={t('common.note')} placeholder={t('common.notePlaceholder')} value={note} onChangeText={setNote} />
      {!money.length ? (
        <AppText variant="caption" color="danger">
          {t('wallet.addAccount')}
        </AppText>
      ) : null}
    </Screen>
  );
}
