# Quran and Athkar

**Status:** written; reader layout tested on a device, tap reading and athkar not yet.

## Quran data
- Imported on the server from quran.com v4 (Uthmani text, Madani layout: 604 pages, 15 lines). The app downloads pages from `/quran/*` and caches them per data version in `documents/quran/<version>/`, plus the last 30 parsed pages in memory. Not bundled in the app (see `../decisions.md`).
- Words have a type: `word` or `end` (the ayah-number marker).

## Page rendering (`components/quran/mushaf-page.tsx`)
- Font: **Amiri Quran**. Its line box is very tall (ascent 1.82 em, descent 0.63 em), which drives several choices:
  - Words have **no fixed `lineHeight`**, otherwise deep letters are clipped on Android.
  - Ayah numbers and the surah banner use **IBM Plex Sans Arabic**, which centers reliably; markers are moved down by `MARKER_DROP`.
- **Each page is built before it's shown:** every line is measured invisibly, then only lines too wide for the page shrink (per-line scale, cached in `fitCache`). One dense line must never shrink the whole page.
- Pages 1–2 (Al-Fatiha, start of Al-Baqarah): small and centered, as in a printed mushaf (the user asked for this).
- Each line is a memoized component, so moving the tap highlight re-renders only the affected lines.
- Reader: inverted horizontal paging list (page 1 on the right), page size computed from the list height (no `onLayout` per page).

## Tap reading (`lib/quran/reading.ts`)
- Tap anywhere on the page counts the highlighted word (markers excluded) and moves on; finishing a page turns to the next. Undo steps back one word.
- Saved (debounced) as the `reading` record (position, total words, pages done, khatmas, learned speed) and `reading_day` (words and pages per day); these add progress to Quran tasks (`addLinkedProgress`).
- **Fast-tap detection:** rolling window of 12 taps; expected time = letters × learned ms per letter; "too fast" below a share of it that depends on the strictness setting (0 = off … 3 = strict). First time: warning and the window's words are not counted (position goes back). Again the same day: a `fast_tap` entry (penalty = `rates.fastTap`).

## Hizb, rub', thumn (`lib/quran/divisions.ts`)
- The server's `/quran/meta` returns `divisions`: 240 quarters (rub', from quran.com `rub_el_hizb_number`) and 480 eighths (thumn) with their start ayah, page and word count. A hizb is 4 rub' or 8 thumn.
- **Thumn is computed:** this Hafs/Madani data has no thumn marks (a Maghrebi division), so each rub' is split at the ayah boundary closest to half its words (`QuranDivisions` on the server). It can be an ayah away from a printed Warsh mushaf.
- **Reading counts fractions:** each word adds 1 / (words in its thumn, rub' and hizb), so reading a whole rub' gives exactly 1 wherever you start. `tapWord` receives the word keys; rollback and undo subtract them again. Quran tasks can target hizb / rub / thumn.
- The Quran tab lists by surah, juz or hizb (8 thumn buttons per hizb; the ones starting a rub' are bold). The reader header shows hizb · rub' · thumn.

## Athkar (`lib/athkar/`)
- Built-in lists (morning, evening, after prayer) from Hisn al-Muslim in `data.ts`, always shown in Arabic; plus custom athkar (`athkar` records).
- Daily counts per list in `athkar_day`. Each counted tap adds 1 to "count" athkar tasks of that list; completing the list completes its "done / not done" tasks.
