# Ledger (Hisab)

**Status:** written (`7isab-app/src/lib/ledger/`), typecheck and lint pass, not yet tested on a device.

## Code
- `types.ts`: record types, `Account`, `Entry` (kind, date `YYYY-MM-DD`, lines `{account, amount}`), `Task`, `TaskProgress`, `Settings` (main currency, rates, `closedThrough`, fast-tap strictness), `SinType`, `ExchangeRate`.
- `ledger.ts`: `ensureDefaults`, balances (sum of lines), actions (`logSin`, `payThanb`, `giveSadaqa`, `payZakat`, `transfer`, `addIncomeOrExpense`, `logFastTap`).
- `tasks.ts`: `isDue`, progress per task per day, `closeFinishedDays` (end-of-day check), `addLinkedProgress` (Quran / athkar).
- `weekly.ts`: weekly Akhira points (`akhiraWeeks`, `useAkhiraWeeks`, `useWeeklyAkhira`, `useWeeklyAkhiraEnabled`); screen `app/(app)/akhira-weeks.tsx`.

## Purpose
- One ledger for both dunya and akhira.
- Every event is an **entry** that changes one or more **accounts**.
- Each account holds one **unit**: a real currency, gold grams, or a points unit.

## Fixed accounts
Created automatically. They can't be deleted.

| Account | Unit |
|---|---|
| Akhira | Akhira points (نقاط الآخرة) |
| Thanb-Sada9a | Thanb points (نقاط الذنوب) |
| Sada9a | Main currency |
| Zakat | Main currency |
| Cash | Main currency |

**User accounts:** any other account, in any currency or in gold grams. Starter accounts CCP, EUR, Debts and Gold are created once (see `wallet.md`).

**Sin presets:** missed prayer, delayed prayer, backbiting, lying, anger, not lowering the gaze, wasted time, weak khushoo, prayer at home, missed Jumu'ah, late bedtime, relapse (penalty 1 each; names translated by preset key).

## Entry types
- **Task done**
  - Akhira **+** reward × progress
- **Task missed or partly done**
  - Akhira **−** penalty × (1 − progress)
  - Thanb-Sada9a **+** the same amount
- **ذنب (sin)**
  - Akhira **−** penalty
  - Thanb-Sada9a **+** penalty
- **Late bedtime** (`bedtime_late`): same as a sin, penalty of the "Late bedtime" sin type; see `bedtime.md`
- **Prayer missed / prayed late** (`prayer_missed`, `prayer_late`)
  - Same as a sin, with the penalty of the "Missed prayer" / "Late prayer" sin type; the cause is the entry note. See `prayer.md`
- **Fast tapping while reading Quran**
  - Same as a sin, with its own penalty
- **Paying a thanb**, from the **Sada9a account only**
  - Thanb-Sada9a **−** T
  - Sada9a **−** T × cost rate
  - Akhira **+** T × reward rate
- **Giving sadaqa**
  - Sada9a **−** X
  - Akhira **+** X × sadaqa rate
- **Paying zakat**, from the **Zakat account only**
  - Zakat **−** X
  - Akhira **+** X × zakat rate
- **Topping up**
  - Any money account → Sada9a or Zakat
  - Entered by hand, or scheduled weekly or monthly
- **Income, expense or transfer**
  - Normal wallet entries
  - Transfers between currencies save the manual exchange rate used

## Rules
- **Partial progress:** gives a partial reward **and** a partial penalty.
- **Sada9a and Zakat can go below zero.** The user covers them by transferring money in; the UI warns while they're negative.
- **Akhira** can go below zero.
- **Thanb-Sada9a** should reach 0. Any unpaid balance carries over to the next month.
- **Defaults:** every reward, penalty and rate defaults to **1** and the user configures it. Never hard-code other values.
- **Fixed IDs for automatic entries:** see `../decisions.md` #5.
- **End-of-day check:** turns each task's progress into entries the day after (today stays open). Missed past days are caught up on the next app open, from `settings.closedThrough`. Prayer tasks are excluded: they are counted at each prayer's safe time (`prayer.md`).
- **Weekly points** (`settings.weeklyAkhira`, off by default): Home shows the Akhira points of the week (Saturday 00:00, `periodRange`) instead of the real balance, with the real balance under it. Derived only, nothing is written or reset, so the real balance and the statistics are unchanged. Week points = −(Thanb-Sada9a balance at the week start, floored at 0) + the Akhira lines dated in the week. A Thanb is never cleared by the reset: it carries week to week until paid, and paying it adds its reward to Akhira (cancels the carried minus exactly while the Thanb reward rate is 1). The week history lists every week from the first entry (carried in, earned, lost, Thanb added / paid, carried out, weekly and real points).
- **Plain tasks** (`task.plain`, "Counts in hisab" off): reward and penalty 0, `entryForDay` returns nothing, never in a rating (reports, programs and statistics list them apart).
- **Task kinds:** quran, athkar, custom, prayer (automatic), bedtime (automatic, `bedtime.md`; skipped by the day-end check), nafilah (rawatib, duha, witr, qiyam, tahajjud; counted in rak'ahs; time window from the prayer times), fasting (presets in `lib/ledger/presets.ts`).
- **Repeats:** daily; chosen weekdays; weekly / monthly / yearly (weeks start on Saturday; the target covers the whole period, which is counted the day after it ends); `hijri` (matching Hijri months and days, e.g. Ramadan = month 9, the White Days = days 13–15); `hijriMonth` (target over a whole Hijri month, e.g. six days of Shawwal). Period progress is stored on the period's first day.
- **Units:** check, count, pages, words, hizb / rub / thumn (Quran fractions, `quran.md`), rak'ahs, days.
- **Corrections:** entries are deleted whole (long-press in Hisab / Wallet), never edited.

## Related plan sections
`.agents/plans/STARTUP.md` §3 (model) and §4.1 / 4.5 / 4.6 (features).
