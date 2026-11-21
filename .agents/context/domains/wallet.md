# Wallet (Dunya)

**Status:** written, not yet tested on a device. Built on the ledger (see `ledger.md`): wallet events are ordinary entries.

## Accounts
- Roles: `wallet`, `savings`, `lent` (money owed to the user, e.g. Debts), `borrowed`, `investment` (an investment's capital: listed under Investments, not in the wallet list or the transaction screen), plus `fixed` for the five fixed accounts.
- Unit: money (a currency; none = main currency) or gold (grams). Accounts can be archived or hidden from totals.
- **Starter accounts** from the user's notes are created once: CCP (DZD), EUR, Debts (lent), Gold, and "Debts I owe" (borrowed; added later, created once for existing users too through the `starter_owe` vault flag). They are normal accounts (renamable, archivable); while a starter keeps its original name it is shown translated (`untouchedStarterKey`: Debts → "Owed to me", Debts I owe → "I owe").

## Entries
- Income / expense: one line on one account, optional category.
- Transfer: two lines; when currencies differ the rate used is stored on the entry. The suggested rate comes from the manual exchange rates (each relative to the main currency).
- Loans are transfers with kind `loan` and an optional person: **lend** (wallet → lent), **got repaid** (`repay`: lent → wallet), **borrow** (borrowed → wallet), **pay back** (`payBack`: wallet → borrowed). Borrowing and paying back only offer `borrowed` accounts, so the two sides never mix.
- **Debts card** (Wallet, `lib/wallet/debts.ts`): **owed to me** (sum of `lent` balances) and **I owe** (minus the `borrowed` balances) as two totals that are never netted, each by person (from the loan entries). Net worth still counts both.
- Sadaqa and Zakat accounts are not used in wallet screens; they are handled by the Hisab quick actions on Today (`/hisab/action`).

## Features
- **Categories:** built-in presets (translated by key) + custom, with sub-categories and colors. **Budgets:** monthly amount per expense category (main currency).
- **Repeating items** (`lib/wallet/recurring.ts`): weekly or monthly income, expense or transfer (e.g. scheduled Sada9a / Zakat top-ups). Automatic ones are added on app open for every due date with stable entry ids; others wait for confirmation on the Wallet tab.
- **Goals:** a target and the account holding the savings, with an optional **saving plan** (`lib/wallet/saving-plan.ts`): weekly / monthly / yearly, a fixed amount or "reach it in N periods" (amount computed, rounded up). Shows the amount still due this period, how far behind, and an estimated finish. It can also create a confirm-first repeating transfer (removed with the goal). Repeating items also support yearly.
- **Net worth:** money and gold accounts in the main currency (gold via the `XAU_G` per-gram rate); Sadaqa + Zakat shown separately as "owed to the poor".
- **Statistics:** the Statistics tab, see `statistics.md`. An account's screen opens it filtered to that account.
- **Investments** (Wallet → Investments): halal only, see `investments.md`.
- **Search:** wallet activity can be searched across all months (see `search.md`).
- **Zakat calculator:** zakatable wealth (money and gold, not Sadaqa / Zakat, not `zakatExempt` accounts such as an asset rented out) vs nisab = 85 g × gold price; 2.5 % due; hawl start date with a reminder after 354 days.
