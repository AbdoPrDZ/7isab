# Architecture

**7isab (حساب)** manages "الدنيا والآخرة": Islamic habits (Quran reading, athkar, tasks, sins, sadaqa, zakat), tracked as points in a ledger, plus a full personal wallet.

## Sub-projects

| Folder | What | Status |
|---|---|---|
| `7isab-app/` | Expo mobile app (SDK 58, expo-router, TypeScript, React Compiler, typed routes) | Phases 1–4, the sync client, and the added features written (prayer and athan, alarms, calendar, nafilah and fasting tasks, hizb / rub' / thumn, saving plans, statistics); typecheck and lint pass; many screens not yet tested on a device |
| `7isab-app/modules/hisab-alarm` | Local Expo native module (Android, Kotlin): alarm-clock scheduling and a full-screen athan / alarm page | Written, not compiled yet (see `domains/prayer.md`) |
| `7isab-server/` | Laravel 13 API + PostgreSQL + admin panel (React SPA + Tailwind v4, served by Laravel) | Auth, vault, Quran (with hizb divisions), sync, admin API and panel built; 64 PHPUnit tests pass |
| `.agents/plans/` | Product plan (`STARTUP.md`) | Complete design |

Progress per step: `.agents/plans.progress/STARTUP.progress.md`.

## How the parts connect

```text
Phone (Expo)                                   Server (Laravel + PostgreSQL)
 UI ── vault (memory) ── local SQLite           Sanctum tokens (abilities: app / admin)
        every record encrypted with the DEK      vault: locked data keys
        └── sync push / pull ────────────────►   sync_records: encrypted payloads + seq
 Quran pages ◄── GET /quran/* (cached on phone)  quran tables (imported from quran.com)
                                                 /admin: React SPA, users & admins only
OTA updates ◄── self-hosted OTA server (Expo Updates protocol; URL and key from env)
```

- **Offline first:** all business logic (ledger, end-of-day check, reports, zakat) runs on the phone. The server stores only encrypted payloads plus metadata. See [domains/security.md](domains/security.md) and [domains/sync.md](domains/sync.md).

## App layout (`7isab-app/src/`)

| Path | What |
|---|---|
| `app/_layout.tsx` | Root: fonts, theme, `SessionProvider`, branded splash, `Stack.Protected` guards (signed out → sign-in/sign-up; just signed up → recovery-key; signed in → `(app)`) |
| `app/(app)/_layout.tsx` | Opens the vault, runs the daily work (defaults, end-of-day check, repeating items, prayers: tasks, settlement, location, athan / nudges / alarms schedule), starts sync, shows the lock screen, mounts the prayer sheet, the task reminder and the 1-minute prayer check |
| `app/(app)/(tabs)/` | Tabs: Today (`index`), Quran, Athkar, Wallet, Hisab, with a custom themed tab bar |
| `app/(app)/…` | Stack screens: settings, account, security, rates, sins, tasks, `task/[id]`, `hisab/action`, `quran/[page]`, `athkar/[list]`, `wallet/*`, stats, calendar, prayer, prayer-settings, qibla, alarms, `alarm/[id]` |
| `lib/data/` | `database.ts` (SQLite, migrations), `cipher.ts` (record encryption, stable ids), `vault.ts` (in-memory store + hooks + sync helpers) |
| `lib/ledger/` | Types, rules and actions (`ledger.ts`), tasks and end-of-day check (`tasks.ts`), hooks |
| `lib/wallet/`, `lib/athkar/`, `lib/quran/`, `lib/stats/` | Feature logic (see domain files) |
| `lib/prayer/`, `lib/alarms/`, `lib/notifications/`, `lib/calendar/` | Prayer times, athan and marks; user alarms and the native bridge; task reminder; Hijri dates and calendar helpers (see `domains/prayer.md`) |
| `lib/sync/sync-engine.ts` | Push / pull client and triggers |
| `lib/lock/app-lock.ts` | PIN / fingerprint lock |
| `lib/session/`, `lib/crypto/`, `lib/api/` | Sign-in, key derivation, HTTP client |
| `lib/preferences/` | Per-device prefs (language, theme, digits) read synchronously from secure-store |
| `lib/format.ts`, `lib/dates.ts` | Intl formatting with the digits preference; local `YYYY-MM-DD` days |
| `components/ui/` | Themed building blocks (`layout.tsx`: Screen, Card, Row, Chips, AmountInput…; SVG `icons.tsx`) |
| `components/quran/mushaf-page.tsx` | Mushaf page renderer |
| `components/prayer/`, `components/calendar/`, `components/stats/`, `components/alarms/` | Prayer card and mark sheet, calendar views, chart pieces, alarm labels and full-screen warning |
| `i18n/` | i18next; `locales/{en,ar,fr}.ts` + `features.{en,ar,fr}.ts` |

## Server layout (`7isab-server/`)

- `app/Core`: base Controller (JSON envelope `{success, message, …}`), Model, `Tabling` (list/search/sort/paginate).
- `app/Modules/<Module>/routes.php` + `Http/Controllers`, `Actions`: **Auth, Vault, Admin, Quran, Sync**. All under `/api/v1` (`routes/api.php`).
- `resources/js/admin/`: admin SPA (react-router); `routes/web.php` serves `admin.blade.php` for every `/admin/*` path.
- Details: [api.md](api.md), [database.md](database.md).

## Build phases

1. Foundation · 2. Ledger/Hisab · 3. Quran + athkar · 4. Wallet · 5. Server · 6. Sync. Details in `.agents/plans/STARTUP.md`.
