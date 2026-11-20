# Statistics

**Status:** written (`7isab-app/src/app/(app)/(tabs)/stats.tsx`, `components/stats/`, `lib/stats/`), typecheck and lint pass, not yet tested on a device.

## The tab
- Replaces the old Hisab tab and the old statistics screen. Opened from the tab bar, Today's balances (Akhira section), the Wallet, and an account's screen (filtered to that account) with `?section=` / `?account=`.
- One **filter bar** for every section; five **sections**: Overview, Dunya, Akhira, Deeds, Entries.

## Filter (`lib/stats/filter.ts`)
- **Period presets:** this week / month / year, last 7 / 30 / 90 / 365 days, all time (from the first entry), custom range (calendar range picker, `components/ui/date-range-picker.tsx`).
- **Comparison:** the previous range of the same length (`previousRange`); tiles show the change.
- **Multi-select filters** (empty = all): accounts, currencies, categories, entry kinds, people, tasks, task kinds, programs, prayers, sin types; plus a text search (note, person, description). Applied to entries by `matchEntry`; tasks / programs filters apply to the deeds section (`filterTasks`).
- **Group by:** time (auto buckets: days up to a month, weeks up to ~7 months, months up to 3 years, then years), weekday, category, account, currency, person, kind, task, sin type.
- **Saved filters:** `stats_filter` records (name + filter), applied from the filters sheet, long-press to delete.

## Figures
- From the filtered entries (`lib/stats/panel.ts`): money in the main currency (income, expenses, saved, savings rate, daily spend, biggest expense, lent / borrowed in range), Akhira points, Thanb added / paid, carry-over before the range (`thanbBefore`), sadaqa, zakat, sins; series per bucket; breakdowns; net worth at each bucket end (`worthSeries`, account filter applies).
- From marks and progress (`lib/stats/deeds.ts`, `buildRangeReport`, `countTasks`): task completion and per task, the day-by-day heat map, per-prayer on time / late / missed / mosque / home / khushoo, Jumu'ah, bedtime on-time rate / average time / late reasons, Quran, athkar, programs, and the rating (same rule as reports). Plain tasks are a separate list.

## Entries and export
- The filtered entries, long-press to delete, paged by 100.
- **CSV export** (`components/stats/export.ts`): one row per entry line (date, kind, description, person, note, account, amount, currency, amount in the main currency), written to the cache folder and shared with `expo-sharing`. The screen warns first: the file is **not encrypted** and leaves the vault.
