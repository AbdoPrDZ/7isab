# 7isab app

The mobile app of [7isab](../README.md): Expo SDK 58, React Native, expo-router and TypeScript, with the React Compiler on.

## Requirements

- Node.js 20+ and npm.
- For Android builds: the Android SDK, JDK 17 and **CMake 3.31+** (see [Windows notes](#windows-notes)).
- A running [7isab server](../7isab-server/README.md) for sign-in and sync. The app works offline once you're signed in.

## Setup

```bash
npm install
cp .env.example .env.local
```

`.env.local` (never committed):

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

Release APK (signed with the debug key; fine for your own phone):

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

## Checks

```bash
npx tsc --noEmit
npx expo lint
```

## Project layout

```text
src/app/            screens (expo-router): (tabs), quran, prayer, qibla, calendar, alarms, wallet, stats, settings…
src/components/     UI building blocks (ui/, prayer/, calendar/, stats/, quran/, alarms/)
src/lib/            logic, no UI:
  data/             encrypted local vault (SQLite) and record cipher
  ledger/           accounts, entries, tasks, presets (nafilah, fasting)
  prayer/           prayer times, athan scheduling, prayer marks
  alarms/           user alarms and the native alarm bridge
  calendar/         month grids and Hijri dates
  quran/            reader, reading counter, hizb / rub' / thumn
  wallet/ stats/    finance, saving plans, statistics
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
