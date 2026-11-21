# 7isab app

The mobile app of [7isab](../README.md): Expo SDK 58, React Native, expo-router and TypeScript, with the React Compiler on.

## Requirements

- Node.js 20+ and npm.
- For Android builds: the Android SDK, JDK 17 and **CMake 3.31+** (see [Windows notes](#windows-notes)).
- A running [7isab server](../7isab-server/README.md) for sign-in and sync. The app works offline once you're signed in.

## Setup

```bash
npm install
cp .env.example .env
```

`.env` (never committed):

| Variable | What |
|---|---|
| `EXPO_PUBLIC_API_URL` | The server API, e.g. `http://192.168.1.10:8000/api/v1` (your computer's LAN IP, so the phone can reach it). |
| `OTA_SERVER_URL`, `OTA_API_KEY` | Optional: an over-the-air updates server. When they're empty, the OTA plugin is left out of the build. |

## Run

```bash
npx expo run:android      # development build (needed: native modules)
npx expo start            # dev server only, once the development build is installed
```

Expo Go works for most screens, but the athan sounds, the full-screen athan and alarm page, and fingerprint protection of the data key need a development or release build.

## Release

Builds go to `release/` (ignored by git), named `<slug>-<runtimeVersion>-<version>`, ready to upload to OTACenter:

```bash
# Production (for upload): .env.deploy ONLY (.env is not read).
# cp .env.deploy.example .env.deploy, then fill it in (it holds secrets; git ignores it).
# Fails if .env.deploy is missing, a required value is empty, or a URL isn't https.
npm run build:deploy:release   # OTA bundle → release/7isab-app-1.2.0-0.1.0.zip   (Version → Add bundle)
npm run build:deploy:apk       # release APK → release/7isab-app-1.2.0-0.1.0.apk  (new native version)
npm run build:deploy:all       # both

# Local test builds: .env only (e.g. your computer's server). Don't upload these.
npm run build:release
npm run build:apk
npm run build:all
```

Both write to the same file names, so a local build overwrites the deploy build of the same version. The `ota` / `publish:*` scripts below always use the deploy environment. `npx expo start` uses `.env`.

Bump `version` in `app.json` for each OTA bundle and add it to [CHANGELOG.md](CHANGELOG.md). Change `runtimeVersion` (and create the matching version in OTACenter) whenever native code changes. For deploy builds the OTA server and key come from `.env.deploy` (`OTA_SERVER_URL`, `OTA_API_KEY`); local builds use `.env`.

The APK is signed with the debug key, so it's fine for your own phone.

### Publish an OTA update from the CLI

Sign in to OTACenter once; the token is saved in `.env.deploy` as `OTA_TOKEN` (never commit it):

```bash
npm run ota:login                            # asks login + password, saves OTA_TOKEN in .env.deploy
npm run ota:doctor                           # checks the app ↔ OTACenter wiring
```

Then, after bumping `version` in `app.json`:

```bash
npm run publish:ota -- -m "What changed"     # build, upload, publish to everyone
npm run publish:demo -- -m "What changed"    # …or to demo testers only
npm run promote -- 1.0.1                     # demo → everyone
```

Extra options go after `--`: `--force-update` (required update), `--file release/<zip>` (upload an existing zip). New APKs are uploaded in the OTACenter dashboard; the CLI only handles bundles.

## Checks

```bash
npx tsc --noEmit
npx expo lint
```

## Project layout

```text
src/app/            screens (expo-router): (tabs) today / quran / athkar / wallet / stats, prayer, qibla, calendar,
                    alarms, bedtime, report, programs, akhira-weeks, testaments, search, investments, settings…
src/components/     UI building blocks (ui/, prayer/, bedtime/, calendar/, stats/, wallet/, task/, quran/, alarms/,
                    search/, testaments/, investments/)
src/lib/            logic, no UI:
  data/             encrypted local vault (SQLite) and record cipher
  ledger/           accounts, entries, tasks, presets (nafilah, fasting), reasons, weekly Akhira points
  prayer/           prayer times, athan scheduling, prayer marks
  alarms/           user alarms and the native alarm bridge
  calendar/         month grids and Hijri dates
  quran/            reader, reading counter, hizb / rub' / thumn
  bedtime/          bedtime task and its notification
  reports/ programs/ day / week / month / year reports, improvement and recovery programs
  wallet/ stats/    finance, saving plans, debts, statistics (filters, charts, CSV export)
  investments/      halal-only investments: capital accounts, records, expected vs real
  testaments/       Testaments, built-in ayat / advice / athkar, scheduled notifications
  search/           text folding (Arabic, Uthmani) and search over local records
  profile/          profile photo (picked, resized, encrypted)
  sync/ session/    sync engine, sign-in, keys, app lock
src/i18n/           Arabic, English, French
modules/hisab-alarm Android native module: athan and alarms as alarm clocks with a full-screen page
assets/athan/       athan recordings, bundled as sounds (see its README)
app.config.js       athan sounds, permissions, build settings, OTA from env
```

## Athan sounds

Put mp3, wav or ogg files in [`assets/athan/`](assets/athan/README.md), named with lowercase letters, digits and `_` (e.g. `makkah.mp3`), then rebuild. They show up in Prayer settings and in the alarm editor.

## Windows notes

- **Long paths:** the native build nests paths past 260 characters. Turn on Windows long paths, and use **CMake 3.31+** from the Android SDK (it ships ninja 1.12). Then point Gradle to it in `android/local.properties`:
  ```
  cmake.dir=C\:/path/to/Android/Sdk/cmake/3.31.6
  ```
  This file is machine-specific and is removed by `expo prebuild --clean`, so add the line back after a clean prebuild.
- **Memory:** `app.config.js` limits Gradle to 4 workers and builds only `arm64-v8a`, so builds don't run Windows out of memory.
