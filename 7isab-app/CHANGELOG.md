# Changelog: 7isab app

Each release lists the app `version` (the OTA bundle) and its `runtimeVersion` (the native build it runs on). A new `runtimeVersion` needs a new APK; a new `version` alone can be sent as an OTA update.

## Unreleased: 0.0.5 (runtime 1.2.0, needs a new APK)

### Added
- **Profile photo:** tap the photo in Settings to pick one from the gallery or take one, crop it square, or remove it. It's shrunk to 256×256 and encrypted on the phone like every record. It also shows next to the greeting on Home.
- **Search:**
  - **Global search** (🔍 on Home): Quran, athkar, Testaments, wallet activity, tasks and programs, notes (report, relapse and entry notes, reasons), accounts, categories and people, alarms and sin types, grouped by type.
  - **Search boxes** in the Quran tab (ayat and surah names), the Athkar tab, wallet activity (all months: note, person, category, account, amount) and the Testaments screen.
  - Diacritics, hamza and alef forms don't matter; Quran search also matches Uthmani spelling (ٱلصَّلَوٰة ↔ الصلاة).
  - **Offline Quran search:** the first search downloads the rest of the Quran once (with progress). Searches run on the phone and never leave it.

### Changed
- New native modules `expo-image-picker` and `expo-image-manipulator`, so `runtimeVersion` is now 1.2.0 (create version 1.2.0 in OTACenter and install the new APK).

## 0.0.4 (runtime 1.1.0), 2026-11-21

### Added
- **Testaments (توصيات):** reminders of Jannah and Nar, advice for the Akhira and the Dunya, and athkar to say, sent as notifications.
  - Each category has its own schedule: random reminders per day inside a time window, plus fixed times.
  - 87 built-in Testaments: ayat quoted word for word with their reference, short advice, and athkar and Quran du'as (always in Arabic). They can be switched off.
  - Add your own, with an optional source. "Send it to me now" tries one.
  - Tapping a notification opens that Testament.

### Fixed
- The "Log a sin" button on Home showed its translation key (`hisab.logSin`) instead of its text.

## 0.0.3 (runtime 1.1.0), 2026-11-20

APK build (carries the display name حساب).

### Added
- **Check for updates** in Settings → About: checks OTACenter on tap, installs a waiting update (also after "not now"), and shows progress or the error.

## 0.0.2 (runtime 1.1.0), 2026-11-20

### Added
- **Weekly Akhira points** (Settings → Hisab → Weekly points, off by default). The points shown on Home start again every Saturday at 00:00. Thanb not yet paid with sadaqa carries into the next week as a minus until it's paid. The real Akhira balance, which is never reset, is shown under the weekly one. Nothing in the ledger is reset, so the statistics are unchanged.
- **Week history:** every past week with points carried in, earned and lost, Thanb added and paid, Thanb carried out, and the weekly and real points.

### Changed
- The app's display name is now **حساب**. It shows after installing a new APK; an OTA update can't change it.

## 0.0.1 (runtime 1.1.0), 2026-11-20

### Added
- **Bedtime task:** set a bedtime. If you miss it, pick a reason, and the reason decides whether it counts as a Thanb. The reasons can be edited.
- **Prayer quality:** a khushoo level when marking a prayer (weak counts as a Thanb), and the mosque or home for every prayer, with a reason for praying at home. "Praying at home always gives a Thanb" is on by default. Jumu'ah prayed at home always gives a Thanb.
- **Reports:** daily, weekly, monthly and yearly, with an estimated rating (good, in sha Allah / average / weak), notes, and a notification at a time you choose.
- **Programs:** improvement or recovery plans with their own tasks and report, clean days and relapses.
- **Debts both ways:** a new "Debts I owe" account; owed to me and I owe have separate totals and per-person lists.
- **Statistics tab** with strong filters, a calendar date range, comparison with the previous period, saved filters and CSV export.
- **Plain tasks** that give no hasanat and no Thanb.
- **Alarm on a task:** it rings on the days the task is due and is skipped once the task is done.
- Release tooling: `build:*` and `build:deploy:*` scripts (APK and OTA bundle in `release/`), `.env.deploy` for deploy builds, and `ota:login` / `publish:*` for OTACenter.

### Changed
- The Hisab tab is gone: its quick actions are on Home, and the Statistics tab takes its place.
- Settings now holds only settings; tasks, alarms and programs moved out of it.
- New app icon and splash screen.
- Android package renamed to `com.abdopr.apps.hisab` (installs as a new app).
- Local configuration moved from `.env.local` to `.env`.

## 1.0.0 (runtime 1.0.0), 2026-11-17

First snapshot: encrypted ledger (Akhira, Thanb, wallet), prayer times and athan, Quran reader, athkar, tasks, calendar, alarms, zakat, sync and app lock.
