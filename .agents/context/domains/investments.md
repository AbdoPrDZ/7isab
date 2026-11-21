# Investments

**Status:** written (`7isab-app/src/lib/investments/`, `app/(app)/investments.tsx`, `investment/[id].tsx`, `investment/form.tsx`, `investment/record.tsx`, `components/investments/`), typecheck and lint pass, statistics checked on a sample; not yet tested on a device.

## Halal only (the user's firm rule)
- **No riba, no qimar, nothing doubtful.** There is no "interest rate" or "guaranteed return" field anywhere; never add one.
- Only four kinds (`INVESTMENT_KINDS`), each with its rule shown (`investments.kindRules.*`):
  - `trade`: own trade / production.
  - `mudaraba`: the user's money, someone else's work; profit = agreed **% of the real profit** (`profitShare`), loss on the capital unless negligence.
  - `musharaka`: partnership; profit by agreed %, loss by capital share (`capitalShare`).
  - `ijara`: an asset rented out; zakat on the rent, not the asset (capital account `zakatExempt` by default).
- Five halal checks (`HALAL_CHECKS`) must all be on before the first save; `confirmedAt` is stored. The rules card lists what's forbidden and says to ask a scholar when in doubt (a reminder, not a fatwa).

## Model
- `investment` record: name, kind, partner, `accountId`, startDate, `expected` ({amount, period: day | week | month | year} or null; an **estimate**, never a promise), profitShare, capitalShare, note, closedAt, confirmedAt.
- Each investment has a **capital account** (role `investment`, money in its currency). It counts in net worth; it's listed under Investments, not in the wallet accounts list or the transaction screen.
- Records are ordinary **ledger entries** with `investmentId`:
  - capital added: `transfer` wallet → capital (or `adjustment` when not from a tracked account);
  - capital taken back: `transfer` capital → wallet;
  - profit: `income` into a wallet account, or into the capital account (reinvested);
  - loss: `expense` on the capital account.
  So the Statistics tab, net worth and zakat see them. Money moves only between accounts in the investment's currency (no exchange rate).

## Statistics (`stats.ts`, `investmentStats`)
- Capital in / out / now (= capital account balance), profit, reinvested, losses, net.
- Expected so far = estimate ÷ period days (day 1, week 7, month 30.4375, year 365.25) × days active; achieved = net ÷ expected.
- ROI = net ÷ capital added; yearly return = net ÷ time-weighted average capital ÷ years (from 30 days); payback = net ÷ capital added; average profit per period; periods with profit.
- Buckets (chart, last 12): week for daily / weekly estimates, else month / year; expected spread over active days vs real (profit − loss) by entry date.
- Overdue: active and no profit recorded for over 1.5 periods.
- Profit is counted on the date entered (record the period's profit on its last day).
