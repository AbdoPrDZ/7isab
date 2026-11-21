# Search

**Status:** written (`7isab-app/src/lib/search/`, `lib/quran/search.ts`, `app/(app)/search.tsx`, `components/search/`), typecheck and lint pass, not yet tested on a device.

## Where
- **Global search:** 🔍 in the Home header → `/search`. Groups: Quran, athkar, Testaments, wallet activity, tasks and programs, notes (report, relapse and non-wallet entry notes, reasons), accounts / categories / people, alarms and sin types. Each result opens its screen (wallet results open the Wallet tab with `?q=`).
- **Per screen:** Quran tab (ayat + surah names), Athkar tab, Wallet activity (all months: note, person, category, account, amount; `?q=` prefills it), Testaments screen.

## Matching (`lib/search/normalize.ts`)
- `foldText`: lower case, Latin accents removed, Arabic diacritics / Quran marks / tatweel removed, أإآٱ→ا, ؤ→و, ئى→ي, ة→ه. A query matches when every word is in the text.
- `foldQuran` (Quran only): the stored text is **Uthmani** (from the server), so it also folds Uthmani spelling to plain: small yeh ۧ → ي; small waw/yeh after a pronoun (ۥ ۦ) dropped; waw + dagger alef before ة → alef (ٱلصَّلَوٰة ↔ الصلاة) but elsewhere the waw stays (ٱلسَّمَٰوَٰت, وَٰلِدَيْن); then alef, hamza (ء ئ ؤ) and spaces are ignored on both sides. Tested on 31 ayat against quran.com Uthmani text.

## Quran search is offline
- Pages are only on the phone once read, so the first Quran search offers to **download the missing pages once** (4 at a time, progress shown). Then an in-memory index of the 6236 ayat answers on the phone; search words never leave the device.
- `loadPage` (exported from `lib/quran/hooks.ts`) caches each page; the index is per Quran version.

## Rules
- Everything runs on decrypted local data; nothing is sent to the server. Minimum query: 2 letters.
