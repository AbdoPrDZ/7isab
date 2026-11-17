# Prayer, Alarms, Reminders and the Calendar

**Status:** written, typecheck and lint pass; the native module is not compiled or device-tested yet.

## Prayer times (`lib/prayer/prayer.ts`)
- Computed on the phone with **adhan-js** for the saved location, with no network. The `prayer_settings` record (fixed id, encrypted, synced) holds the location, method, Asr madhab, per-prayer ± minutes, athan switches and sounds, reminders, safe times, nudges and the Hijri offset.
- **Method `auto`:** chosen from the country (`COUNTRY_METHOD`): Algeria 18°/17°, Morocco 19°/17°, Tunisia 18°/18° (custom angles), Egypt, Umm al-Qura, Dubai, Kuwait, Qatar, Karachi, Turkey, Tehran, Singapore, ISNA, Moonsighting; anything else uses MWL. Hanafi Asr is the default for PK/IN/BD/AF/TR and Central Asia.
- **Location (`location.ts`):** asked only on "Use my location", rounded to 3 decimals (~100 m). Re-checked quietly on app open or foreground at most once an hour (last known fix, else a fresh low-accuracy fix with a 15 s limit). It is saved only when the phone moved more than 2 km.
- Qibla bearing and distance to the Kaaba: `qiblaBearing`, `distanceToKaaba`; the compass screen uses `watchHeadingAsync`.

## Athan and reminders (`lib/prayer/notifications.ts`)
- The next **10 days** are scheduled when the app opens or a setting changes. Rescheduling is skipped when a signature of the settings and today is unchanged (`prayer_schedule` vault meta). Our ids start with `prayer:`.
- **Athan path:** with the HisabAlarm native module and `athanScreen` on (and sound ≠ silent), the athan is a native ring (`athan:` ids). Otherwise it's an expo-notifications notification on a per-sound Android channel (channel sounds can't change, so one channel per sound and volume type).
- Athan sounds are the files in `7isab-app/assets/athan/`. `app.config.js` registers them as notification sounds and passes the list as `extra.athanSounds`. Expo Go doesn't have them, so `usableSound` falls back to the phone's sound there; a channel with a missing file crashes on Android.
- Also scheduled: a reminder X min before the athan, and the **nudges** for an unmarked prayer: "Did you pray it?" `checkIn` min after the athan, and "Its time ends at …" `endingSoon` min before its safe time. Marking or un-marking a prayer refreshes its nudges (`refreshPrayerNudges`).

## Prayer marks and the ledger (`lib/prayer/tasks.ts`)
- **Tasks:** five prayer tasks with fixed ids (`prayer-task:<prayer>`), kind `prayer`, created and archived by the `tasks` setting.
- **Safe time** (`prayerDeadline`), set per prayer: the end of its time (Fajr → sunrise, Dhuhr → Asr, Asr → Maghrib, Maghrib → Isha, Isha → the middle of the night), or N min after the athan.
- **Marking:** marking asks the time the prayer was prayed (`prayedAt`).
  - Within its safe time it is `onTime`; after it, `late`, and a cause is required.
  - It can't be marked before the prayer's time or in the future.
  - Past days can be marked too, as corrections.
- **Jam'** (combining):
  - Only Dhuhr+Asr and Maghrib+Isha, never Fajr. It can be early (from the first prayer's time) or late.
  - It is judged by the **later** prayer's safe time: `combined` (on time) or both `late`, with the cause required.
  - The mark is stored on both prayers, with `combinedWith`. Un-marking one un-marks both.
- **Ledger:** one entry per prayer per day (`taskEntryId`), rewritten on every correction.
  - On time or combined: `task_done`, the task's reward.
  - Late: `prayer_late`, penalty from the "Late prayer" sin type (`sin:latePrayer`).
  - Unmarked past the safe time: `prayer_missed`, penalty from `sin:missedPrayer`.
  - The day-end check skips prayer tasks. `settlePrayers()` runs on app open and every minute while the app is open, catching up 14 days.
- **Colours:** prayed = green, late = dark orange (`prayerLate`), combined = light orange (`prayerCombined`), missed = red.

## User alarms (`lib/alarms/alarms.ts`)
- `alarm` records (encrypted, synced):
  - **When:** a clock time, or relative to a prayer or sunrise (± minutes).
  - **Repeat:** on weekdays, or once (`onceDate`; it turns itself off after ringing).
  - Also a label, a sound and `ringAgain` minutes.
- **Scheduling:** the next 7 days. They follow prayer-time changes, since `applyPrayerSettings` reschedules them.
- **With the native module:** one looping ring per occurrence, with Snooze = `ringAgain`.
- **Without it:** a sticky alarm-clock notification that rings again every `ringAgain` min, up to 3 more times. Tapping it or pressing Stop opens the app and cancels the remaining rings (`stopAlarm`).

## Native module `modules/hisab-alarm` (Android, Kotlin, Expo Modules API)
- **Scheduling:** `AlarmManager.setAlarmClock` for exact alarms (`setAndAllowWhileIdle` without the exact-alarm permission). The rings are stored in SharedPreferences and set again by `BootReceiver` (restart, update, time or timezone change).
- **Playing:** `AlarmService` is a `mediaPlayback` foreground service. It plays the sound at `USAGE_ALARM`: athan once, alarms looping, 10 min maximum.
- **The page:** its notification has a full-screen intent to `AlarmActivity`, a native page over the lock screen (time, title, Stop, Snooze). It shows only display text, never vault data.
- **JS bridge:** `lib/alarms/native-alarm.ts` (`requireOptionalNativeModule`, so it is null in Expo Go, on iOS and on the web). `FullScreenWarning` shows when Android 14+ has full-screen intents off, or exact alarms are off.

## Task reminder (`lib/notifications/task-reminder.ts`)
- `settings.taskReminder` (hour, minute) sends one notification a day listing the undone tasks (prayer tasks excluded), for the next 7 days. It is rebuilt 3 s after any local change (`onLocalChange`).

## Hijri dates and the calendar (`lib/calendar/`)
- **Hijri dates (`hijri.ts`):** Umm al-Qura from the phone's `Intl` (`formatToParts`), shifted by `hijriOffset` (−2…+2, for moon sighting), with a per-day cache.
  - It gives the Hijri month ranges (for `hijriMonth` tasks) and the special days: Ramadan, the two Eids, Arafah, Ashura, the White Days, the Islamic New Year, Tashriq.
  - **No fasting** on the Eids or 11–13 Dhul Hijjah.
- **Calendar screen:** day, week, month and year views.
  - The colour shows how much of each day's tasks were done (one green ramp; pale red when none of a past day's tasks were done).
  - Ramadan has a dashed gold border; other special days have a gold dot.
  - The day view shows the prayer times, the marks (with corrections) and the tasks.
