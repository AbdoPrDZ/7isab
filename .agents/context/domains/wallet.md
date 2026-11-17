# Wallet (Dunya)

**Status:** written, not yet tested on a device. Built on the ledger (see `ledger.md`): wallet events are ordinary entries.

## Accounts
- Roles: `wallet`, `savings`, `lent` (money owed to the user, e.g. Debts), `borrowed`, plus `fixed` for the five fixed accounts.
- Unit: money (a currency; none = main currency) or gold (grams). Accounts can be archived or hidden from totals.
- **Starter accounts** from the user's notes are created once: CCP (DZD), EUR, Debts (lent), Gold. They are normal accounts (renamable, archivable).

## Entries
- Income / expense: one line on one account, optional category.
- Transfer: two lines; when currencies differ the rate used is stored on the entry. The suggested rate comes from the manual exchange rates (each relative to the main currency).
- Loans: lend / borrow / repay are transfers with kind `loan` and an optional person.
- Sadaqa and Zakat accounts are not used in wallet screens; they are handled in Hisab.

## Features
- **Categories:** built-in presets (translated by key) + custom, with sub-categories and colors. **Budgets:** monthly amount per expense category (main currency).
- **Repeating items** (`lib/wallet/recurring.ts`): weekly or monthly income, expense or transfer (e.g. scheduled Sada9a / Zakat top-ups). Automatic ones are added on app open for every due date with stable entry ids; others wait for confirmation on the Wallet tab.
- **Goals:** a target and the account holding the savings, with an optional **saving plan** (`lib/wallet/saving-plan.ts`): weekly / monthly / yearly, a fixed amount or "reach it in N periods" (amount computed, rounded up). Shows the amount still due this period, how far behind, and an estimated finish. It can also create a confirm-first repeating transfer (removed with the goal). Repeating items also support yearly.
- **Net worth:** money and gold accounts in the main currency (gold via the `XAU_G` per-gram rate); Sadaqa + Zakat shown separately as "owed to the poor".
- **Statistics** (`app/(app)/stats.tsx`, `lib/stats/stats.ts`): month or year; Dunya or Akhira.
  - **Dunya, overall or one account:** income, expenses, saved, savings rate and change vs the previous period. Spending grouped by category (with budgets), income source, account, currency or weekday. Cash flow, and net worth by account, type or currency.
  - **One account:** balance at the start and end of the period, in and out by kind, and a balance trend.
  - **Akhira:** points, task completion, Quran, athkar, sadaqa, zakat and Thanb, and sins.
  - **Charts:** use the validated `chartIn` / `chartOut` colours.
- **Zakat calculator:** zakatable wealth (money and gold, not Sadaqa / Zakat) vs nisab = 85 g × gold price; 2.5 % due; hawl start date with a reminder after 354 days.
