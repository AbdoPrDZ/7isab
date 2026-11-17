# STARTUP Plan — Progress

Plan: [../plans/STARTUP.md](../plans/STARTUP.md). Tick a step only once it's done **and** verified: typecheck and lint pass, and it was tested in the app where that applies.

**Legend:** `[ ]` to do · `[x]` done · steps marked *(you)* need you to do them.

---

## Phase 0: Setup
- [x] Create the Expo app (SDK 58, expo-router, TypeScript) in `7isab-app/`
- [x] Write the product plan (`.agents/plans/STARTUP.md`)
- [x] Set up the project context (`.agents/context/`)
- [x] Install `expo-updates`, `expo-device`, `expo-ota-client`
- [x] Configure the OTA plugin (server URL, package `com.abdopr.hisab`, runtime `1.0.0`) and wrap the root in `<OTAProvider>`
- [ ] *(you)* Create the app and version `1.0.0` on the OTA server
- [ ] *(you)* Put the OTA server URL and version API key in `7isab-app/.env.local` (`OTA_SERVER_URL`, `OTA_API_KEY`), never in committed files
- [ ] `npx expo-ota-client doctor` passes
- [ ] First development build runs on a device
- [x] Set up git in the project folder (branch `main`, no commits yet)
- [x] Root `README.md` and `AGENTS.md`
- [x] Plan progress file (this file)

## Phase 1: Foundation (app)
- [x] Remove the template screens and components (fixes the 3 template `tsc` errors)
- [x] ~~Install and configure NativeWind (Tailwind)~~ — decided against: the app uses StyleSheet + theme tokens throughout
- [x] Theme tokens for light and dark mode (emerald, gold, ivory, night green)
- [x] Fonts: IBM Plex Sans Arabic, IBM Plex Sans, Amiri Quran (instead of KFGQPC)
- [ ] Islamic decoration components (geometric pattern background, arch card, gold divider; used on Wallet and Hisab) — written, needs device test
- [x] i18next + expo-localization with AR, EN, FR translation files
- [x] Arabic right-to-left switching (React `direction`, no reload) and the digits setting (0–9 / ٠–٩)
- [x] `Intl` formatting helpers for numbers, dates and currency
- [x] expo-sqlite setup, migrations, record format (`id`, `type`, `updatedAt`, `deletedAt`, payload)
- [x] SQLCipher: not used (needs a dev build); every payload is already encrypted with the data key, only sync metadata is plain
- [x] Encryption layer: data key, password-derived key, locking/unlocking, encrypt/decrypt helpers (`@noble/*`)
- [ ] Recovery key: create it, show it once, "Forgot your password?" recovery screen, replace it from Account — written, needs device test
- [ ] Change password (re-locks the data key, signs other devices out) — written, needs device test
- [ ] Option: data key on the phone readable only after a fingerprint check (dev build) — written, needs device test
- [x] Store the key in secure-store
- [ ] App lock: PIN (hashed), fingerprint / Face ID, choosing between them, PIN fallback — written, needs device test
- [ ] App lock rules: lock on open, background timeout, wrong-attempt lockout — written, needs device test
- [ ] Theme switch (system / light / dark), also on sign-in and sign-up — written, needs device test
- [ ] Settings screen: language, theme, digits, main currency, app lock, rates, sync — written, needs device test
- [ ] Base navigation: Today, Quran, Athkar, Wallet, Hisab, Settings — written, needs device test
- [ ] Typecheck and lint pass; tested on a device

## Phase 2: Ledger and Hisab
- [ ] Accounts model: units (currencies, gold grams, Akhira points, Thanb points) — written, needs device test
- [ ] Create the 5 fixed accounts automatically (Akhira, Thanb-Sada9a, Sada9a, Zakat, Cash), not deletable — written, needs device test
- [ ] Multi-account entries model, only ever added to — written, needs device test
- [ ] Rates settings (all default to 1) — written, needs device test
- [ ] Manual exchange rates — written, needs device test
- [ ] Tasks: create and edit (type, target, how often it repeats, reward, penalty) — written, needs device test
- [ ] Weekly / monthly / yearly tasks (target for the whole period, weeks start Saturday, counted the day after the period ends) — written, needs device test
- [ ] End-of-day check, with partial reward and partial penalty, and catch-up for missed days — written, needs device test
- [ ] Fixed entry IDs: `HMAC(userKey, taskId + date)` — written, needs device test
- [ ] Sins log, with preset types and their penalties — written, needs device test
- [ ] Paying a thanb (from Sada9a only) — written, needs device test
- [ ] Giving sadaqa (Sada9a → Akhira points) — written, needs device test
- [ ] Paying zakat (from Zakat only) — written, needs device test
- [ ] Topping up Sada9a / Zakat, by hand and on a weekly/monthly schedule — written, needs device test
- [ ] Warnings when Sada9a or Zakat is below zero — written, needs device test
- [ ] Today screen (tasks, progress, balances) — written, needs device test
- [ ] Hisab screen and monthly report, with Thanb carry-over — written, needs device test
- [ ] Typecheck and lint pass (done); tested on a device

## Phase 3: Quran and Athkar
- [x] Server: Quran tables (surahs, ayahs, words with page + line) and `quran:import` from quran.com v4 (114 / 6236 / 83665 imported)
- [x] Server: public `GET /quran/meta` and `GET /quran/pages/{page}` (cached), with tests
- [ ] App: download pages from the server and cache them on the device for offline reading (versioned) — written, needs device test
- [ ] Page reader with a decorative frame and the Quran font — written (Amiri Quran), needs device test
- [ ] Tap anywhere to move to the next word, current word highlighted, undo — written, needs device test
- [ ] Save the reading position; progress in words, pages, juz and khatma — written, needs device test
- [ ] Link reading progress to Quran tasks — written, needs device test
- [ ] Fast-tap detection: rolling window, expected time from letter count, learns your speed — written, needs device test
- [ ] Fast-tap handling: warning, then words don't count, then a penalty entry; strictness settings — written, needs device test
- [ ] Athkar: built-in lists (morning, evening, after prayer) with target counts — written, needs device test
- [ ] Athkar tap counter, custom athkar, link to tasks — written, needs device test
- [ ] Hizb / rub' / thumn: server lists the 240 quarters and 480 eighths (eighths split at the ayah nearest half); reading counts each word as a fraction of its hizb, rub' and thumn; Quran tasks in hizb / rub / thumn — written, server tested, app needs device test
- [ ] Quran list by surah, juz and hizb (8 thumn buttons per hizb); reader header shows hizb · rub · thumn — written, needs device test
- [ ] Typecheck and lint pass (done); tested on a device

## Prayer (added)
- [ ] Prayer times on the device (adhan-js), method automatic by country (Algeria 18°/17°, Morocco, Tunisia, Umm al-Qura…), Asr madhab, per-prayer minute adjustment — written, needs device test
- [ ] Location: asked once, refreshed quietly once a day, rounded to ~100 m, stored in the encrypted vault — written, needs device test
- [ ] Athan notifications for the next 10 days (exact alarms, alarm volume option, separate Fajr sound, reminder X min before); athan files from `assets/athan` — written, needs device test with real athan files
- [ ] Five daily prayer tasks (reward/penalty 1), ticked from the Today card or the prayer screen — written, needs device test
- [ ] Prayer states (prayed / missed / open until … / not yet) on the Today card, prayer screen and calendar; a prayer left unmarked is counted as missed (Thanb) at its deadline (end of its time, or 30 / 60 / 120 min after the athan, per prayer); forgotten marks can be corrected later and the hisab entry is rewritten — written, needs device test
- [ ] Marking a prayer asks the time it was prayed: on time if within its safe time (per-prayer deadline), else late (cause required, "Late prayer" Thanb); jam' of Dhuhr+Asr / Maghrib+Isha (never Fajr, early or late, cause optional); "Missed prayer" / "Late prayer" penalties from Sins; late = dark orange, combined = light orange — written, needs device test
- [ ] Combined prayers judged by the later prayer's safe time (Asr for Dhuhr+Asr, Isha for Maghrib+Isha): on time = light orange; after it both late (cause required, Thanb each); un-marking one un-marks both
- [ ] Prayer nudges: "Did you pray it?" X min after the athan and "Its time ends at …" X min before the safe time ends, only while unmarked (cancelled when marked); daily task reminder at a chosen time listing undone tasks (Settings → Notifications) — written, needs device test
- [ ] Qibla compass (true heading, distance to the Kaaba) — written, needs device test
- [ ] Next prayer and countdown on the Today tab — written, needs device test
- [ ] Calendar (day, week, month, year): tasks done / missed per day as a heat map, week / month / year tasks, prayer times and prayed checks, Hijri dates — written, needs device test
- [ ] Nafilah tasks (rawatib, Duha, Witr, Qiyam, Tahajjud; rak'ahs; time window from prayer times) — written, needs device test
- [ ] Fasting tasks (Ramadan, Monday & Thursday, White Days, Arafah, Ashura, 6 of Shawwal, custom; Hijri repeats; never due on the Eids or Tashriq; suhoor / iftar times) — written, needs device test
- [ ] Ramadan and special days highlighted in the calendar; Hijri ±days setting (moon sighting) — written, needs device test
- [ ] Alarms: at a time or relative to a prayer (e.g. 30 min before Fajr), once or on weekdays, sound, ring again every 5 / 10 min up to 3 times until stopped; Android alarm-clock delivery at alarm volume; encrypted in the vault — written, needs device test
- [ ] Native HisabAlarm module (modules/hisab-alarm, Android): athan and alarms as real alarm clocks (setAlarmClock), full-screen page over the lock screen with Stop / Snooze, sound in a media foreground service (athan once, alarms loop), rescheduled after restart; falls back to notifications in Expo Go — written, not compiled yet, needs device test
- [ ] Reschedule in the background when the app isn't opened for 10+ days (not done)

## Phase 4: Wallet
- [ ] Accounts screen (create, archive, hide; any currency or gold) — written, needs device test
- [ ] Income, expenses and transfers (with exchange rates between currencies) — written, needs device test
- [ ] Categories and sub-categories (icons, colors) — written, needs device test
- [ ] Repeating items (salary, rent, subscriptions; weekly, monthly or yearly; automatic or confirm first) — written, needs device test
- [ ] Monthly budgets per category, with alerts — written, needs device test
- [ ] Loans (money lent through the Debts account, money borrowed) — written, needs device test
- [ ] Savings goals — written, needs device test
- [ ] Saving plans on goals (weekly / monthly / yearly; fixed amount or "reach it in N periods"; this-period amount, behind, finish date; optional repeating transfer) — written, needs device test
- [ ] Statistics screen (month or year; Dunya: income, expenses, saved, savings rate, change vs last period, categories with budgets, cash flow, net worth by account; Akhira: points, task completion, Quran, athkar, sadaqa/zakat/thanb, sins) — written, needs device test
- [ ] Per-account statistics (filter by account: balance at start/end, in/out by kind, balance per month) and more groupings (spending by category, income source, account, currency, weekday; net worth by account, type, currency) — written, needs device test
- [ ] Zakat calculator (nisab 85 g gold, hawl reminder) — written, needs device test
- [ ] Show money owed to the poor as reserved in the balance — written, needs device test
- [ ] Typecheck and lint pass (done); tested on a device

## Phase 5: Server (`7isab-server/`)
- [x] New Laravel project (13.42) with PostgreSQL, Sanctum, Spatie Permission, Laravel Boost
- [x] Base layer `app/Core` (Controller responses, Model, Tabling) and `app/Modules/<Module>` structure
- [x] Sanctum auth: prelogin (KDF params, fake for unknown emails), register, login, logout, logout-all, change password
- [x] Recovery flow: params, unlock, reset (with optional new recovery key)
- [x] Vault endpoints: locked data key, replace recovery key
- [x] Records table and sequence numbers (table + model only)
- [x] `POST /sync/push`, `GET /sync/pull?since=N` (newest edit wins, per-user sequence, storage accounting) with tests
- [x] Rate limiting (auth, recovery, api)
- [x] Fixed admin roles (`super-admin`, `admin`) and super admin seeder
- [ ] Admin panel: React SPA (react-router) + Tailwind, responsive, AR/EN/FR — built (`/admin`), needs a browser test
- [x] Admin API: panel login, user management (list, show, disable, enable, sign out, delete), no access to user data
- [x] Admin API: admin management (super admin only; can't demote, disable or delete self)
- [x] Admin overall stats endpoint
- [x] Server tests pass (63 tests, auth + recovery + vault + admin + seeders + quran + sync)

## Phase 6: Sync
- [x] App login and signup screens (password + recovery key shown at signup)
- [ ] Track local changes to send — written, needs device test
- [ ] Push and pull client, newest-edit-wins conflict handling — written, needs device test
- [ ] Sync triggers (app open, back to the app, after changes, every 5 min, by hand) — written, needs device test
- [ ] Log in on a new device and unlock the data (password flow written; pulls everything on first sync), needs device test
- [ ] Multi-device test (no duplicate entries, deletions sync)
- [ ] First OTA update published and installed
