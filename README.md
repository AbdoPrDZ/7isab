# 7isab (حساب)

An app to keep the account of **الدنيا والآخرة** (this life and the next) in one place.

- **Akhira:** a ledger of deeds and sins. Done or missed tasks, prayers, sins and fast-tapping move **Akhira** points and **Thanb** (ذنب) points, and Thanb is paid back as sadaqa.
- **Dunya:** a full wallet with multi-currency and gold accounts, budgets, loans, savings plans, statistics and zakat.

It works offline, syncs between devices, and is **end-to-end encrypted**: the server and its admins only ever see ciphertext.

## Projects

| Folder | What | Stack |
|---|---|---|
| [`7isab-app/`](7isab-app/) | Mobile app (Android first) | Expo SDK 58, React Native, expo-router, TypeScript |
| [`7isab-server/`](7isab-server/) | Sync API, public Quran API, admin panel | Laravel 13, PostgreSQL, Sanctum; React + Tailwind admin at `/admin` |
| [`.agents/`](.agents/) | Project context, plan and progress (for AI coding agents) | Markdown |

## Features

**Prayer**
- Prayer times calculated on the phone from your location (adhan-js). The method follows your country automatically (Algeria, Morocco, Umm al-Qura and others), with a ± minute adjustment per prayer.
- Athan at alarm volume with your own recordings. On Android it can show a full-screen page over the lock screen. There's also a reminder before the athan, a qibla compass, and a Hijri calendar with a ± day setting.
- Marking a prayer asks the time you prayed it. Within its "safe time" it counts as on time, after it as late (cause required), and unmarked as missed. Dhuhr+Asr and Maghrib+Isha can be combined (jam'). Every mark can be corrected later.

**Akhira**
- **Quran:** a word-by-word reader with fast-tap detection. Browse by surah, juz and hizb; progress is counted in pages, words, hizb, rub' and thumn.
- **Athkar:** built-in and custom counters.
- **Tasks:** daily, chosen days, weekly, monthly, yearly, or by Hijri dates. Partial progress gives a partial reward and penalty. Task types include Quran, athkar, nafilah prayers and fasting (Ramadan, Monday & Thursday, the White Days, Arafah, Ashura, six of Shawwal).
- **Sins** with configurable penalties, and paying Thanb back as sadaqa.

**Dunya**
- Accounts in any currency or in gold grams, with manual exchange rates.
- Income, expenses, transfers, loans, recurring items, budgets, and savings goals with weekly, monthly or yearly plans.
- Zakat calculator (nisab and hawl).
- Statistics by month or year, per account or overall, grouped by category, account, currency or weekday.

**Everywhere**
- A calendar with day, week, month and year views of tasks and prayers, and Ramadan highlighted.
- User alarms, set at a time or relative to a prayer (e.g. 30 min before Fajr).
- Reminders to mark a prayer, and a daily task reminder.
- Arabic (right-to-left), English and French. Light and dark themes.
- PIN or fingerprint app lock, a recovery key, and an optional fingerprint-protected data key.

Every configurable reward, penalty and rate starts at **1**.

## Security model (short)

- **Encryption on the device:** a data key is created on the phone and wrapped with a key derived from your password, plus a recovery key. Records are encrypted on the device (XChaCha20-Poly1305) before they're stored or synced.
- **What the server stores:** opaque encrypted records, ids, types and timestamps. It can't read your data, and neither can the admin panel.
- **Prayer location:** used on the phone only, rounded to about 100 m, and stored encrypted like everything else.

## Getting started

Server: see [7isab-server/README.md](7isab-server/README.md). App: see [7isab-app/README.md](7isab-app/README.md).

Quick version:

```bash
# Server
cd 7isab-server
composer install && npm install
cp .env.example .env && php artisan key:generate   # then set the DB_* and SUPER_ADMIN_* values
php artisan migrate --seed
php artisan quran:import          # the Quran text, once
npm run build && php artisan serve --host=0.0.0.0

# App (another terminal)
cd 7isab-app
npm install
cp .env.example .env              # set EXPO_PUBLIC_API_URL to the server
npx expo run:android              # a development build: the app has native modules
```

## Status

All the features above are written. Server tests pass, and the app typechecks and lints clean. On-device testing is ongoing; see [the progress file](.agents/plans.progress/STARTUP.progress.md).
