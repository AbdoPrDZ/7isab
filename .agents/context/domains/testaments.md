# Testaments (توصيات)

**Status:** written (`7isab-app/src/lib/testaments/`, `app/(app)/testaments.tsx`, `testament/[id].tsx`, `testament-settings.tsx`), typecheck and lint pass, not yet tested on a device. Shipped in OTA 0.0.4.

## What it is
Short reminders sent as notifications: reminders of **Jannah** and **Nar**, advice for the **Akhira** and the **Dunya**, and **athkar** to say. Each category has its own schedule.

## Code
- `presets.ts`: the built-in Testaments (`TESTAMENT_PRESETS`, 87). Kinds:
  - `ayah`: Quran text, always Arabic, with surah + ayah reference (`testaments.surahs.<n>` for the name). The text is **copied exactly from the quran.com API v4 `text_imlaei`**; excerpts (`... words ...`) are exact word runs of the source. Never type ayat by hand; verify with the API when adding.
  - `advice`: short advice in the user's words, translated (`testaments.advice.<key>`). No hadith and nothing attributed from memory.
  - `dhikr`: athkar, Arabic only; the ones the Athkar screen has are taken from `lib/athkar/data.ts` (`fromAthkar(id)`) so the text is identical.
  - New presets go at the **end** of the list (existing ones keep their order).
- `testaments.ts`: records (`testament`, presets with fixed ids `testament:<key>`, created by `ensureTestamentPresets` from `ensureDefaults`), content in the current language (`testamentContent`), schedules (`settings.testaments[category]`, defaults: on, 1 random a day between 08:00 and 22:00, no fixed time).
- `notifications.ts`: `watchTestaments` (started in `app/(app)/_layout.tsx`) schedules the next 4 days per category: N random times inside the window (may cross midnight) + fixed times. Random times and picks are **seeded by day and category** so rebuilding after any change keeps the same times; picks are a seeded shuffle so a day doesn't repeat one while others are left. Tapping opens `/testaments?id=`. "Send it to me now" fires one in 2 s.

## Rules
- Built-in Testaments can only be switched on / off (never edited), so ayat stay exact. The user's own have category, text, optional source.
- Categories: `jannah`, `nar`, `akhira`, `dunya`, `athkar`.
