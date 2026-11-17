# Conventions

General Expo rules (check SDK 58 docs before using any API, `npx expo install`, expo-router, never edit `ios/` or `android/`) are in [7isab-app/AGENTS.md](../../7isab-app/AGENTS.md). Follow them. This file lists only project-specific rules.

## Working with the user
- **Don't write feature code until the user says to start.** The user has stopped unrequested implementation before. Planning and discussion come first.
- Phases are built in order (see `architecture.md`); confirm before starting each one. (The user approved building all remaining phases at once on 2026-11-14.)
- The user tests on an Android phone (Expo Go) and reports problems with screenshots; fix exactly what they show.
- **Progress tracking:** after finishing a step, tick its checkbox in `.agents/plans.progress/STARTUP.progress.md`. Only tick a step once it's verified (typecheck and lint pass, tested where that applies). Add new steps there when the plan grows.

## Languages and layout
- **Languages:** Arabic, English, French through i18next. Never hard-code UI strings.
- **Arabic:** right-to-left through a React `direction` style on the root view (`useDirection`), **no reload**. Never use `I18nManager.forceRTL` (it caused a reload loop). Icons that point somewhere take a `flip` prop. Quran text is always right-to-left, whatever the UI language.
- **Translations:** base strings in `i18n/locales/{en,ar,fr}.ts`, feature strings in `features.{en,ar,fr}.ts`; types force every language to have every key.
- **Digits:** Western (0–9) by default; Arabic-Indic (٠–٩) is a setting. Format through `useFormat()` (`lib/format.ts`), which applies the digits by hand; parse typed amounts with `parseAmount`.
- **Formatting:** numbers, dates and currency through `Intl` for the active language.

## Fonts (one font per language, never mixed)
- Arabic UI: **IBM Plex Sans Arabic**
- English and French UI: **IBM Plex Sans**
- Quran: **Amiri Quran** (`QURAN_FONT`); ayah numbers and the surah banner use IBM Plex Sans Arabic (see `domains/quran.md`)
- **Never use emoji or Unicode symbols as icons** (they rendered wrong on the user's phone); use the SVG icons in `components/ui/icons.tsx`.

## Design
- Modern Islamic look. The theme tokens (emerald, gold, ivory, night green) are in `.agents/plans/STARTUP.md` §2.
- **Islamic ornaments:** keep them sparse (faint geometric patterns, arch shape only on main cards).
- **Styling:** `StyleSheet` + theme tokens (`constants/theme.ts`, `useTheme()`) in the app; build screens from `components/ui/layout.tsx`. Tailwind v4 in the admin panel, with the same tokens and fonts.
- **Safe areas:** pad the bottom with the safe-area inset on stack screens (the Android navigation bar covered content).
- **Screens:** must work on all sizes (phone, tablet; desktop for the admin panel).

## Data
- **Amounts:** every configurable reward, penalty and rate **defaults to 1**. The user sets real values later. Never use the example numbers from discussions.
- **Main currency defaults to DZD.**
- **User data:** goes through the encryption layer before leaving the device (see `domains/security.md`).

## Never put in code, logs or context
Secrets, API keys, or the user's personal details.
