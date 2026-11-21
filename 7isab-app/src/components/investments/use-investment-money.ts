import { useAccounts, useExchangeRates, useLedgerLabels } from '@/lib/ledger/hooks';
import type { Account } from '@/lib/ledger/types';
import type { Investment } from '@/lib/investments/investments';
import { balanceInMain } from '@/lib/wallet/wallet';

/** Formatting for an investment's figures (its own currency) and conversion to the main currency. */
export function useInvestmentMoney() {
  const accounts = useAccounts();
  const rates = useExchangeRates();
  const { format, mainCurrency } = useLedgerLabels();
  const accountOf = (investment: Investment): Account | undefined =>
    accounts.find((account) => account.id === investment.accountId);
  const currencyOf = (investment: Investment): string => {
    const unit = accountOf(investment)?.unit;
    return unit?.kind === 'money' && unit.currency ? unit.currency : mainCurrency;
  };
  return {
    accountOf,
    currencyOf,
    money: (investment: Investment, value: number) => format.money(value, currencyOf(investment)),
    mainMoney: (value: number) => format.money(value, mainCurrency),
    percent: (ratio: number | null) => (ratio === null ? '—' : format.digits(`${Math.round(ratio * 100)}%`)),
    /** A value of this investment in the main currency (0 when no rate is set). */
    toMain: (investment: Investment, value: number) => {
      const account = accountOf(investment);
      return account ? (balanceInMain(account, value, mainCurrency, rates) ?? 0) : value;
    },
    format,
  };
}
