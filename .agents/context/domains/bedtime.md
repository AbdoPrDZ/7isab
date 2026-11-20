# Bedtime

**Status:** written (`7isab-app/src/lib/bedtime/`, `components/bedtime/`, `app/(app)/bedtime.tsx`), typecheck and lint pass, not yet tested on a device.

## Model
- **Settings:** `settings.bedtime` = `{ enabled, hour, minute, grace }`, default on, 23:00, 30 min (`DEFAULT_BEDTIME`).
- **Task:** one "Go to bed" task, kind `bedtime`, fixed id `bedtime-task`, created / archived by `syncBedtimeTask()` when bedtime is switched on / off. Reward = on-time reward (default 1).
- **Night:** named by the evening's day (`YYYY-MM-DD`). A clock time before 12:00 belongs to the next calendar day (`atNight`). A night can be marked from 18:00.
- **Mark:** the night's `progress` record: `sleptAt`, `status` (`onTime` / `late`), and when late `reasonId` + the reason text in `cause`. "I don't remember" = `late` with no reason.

## Ledger
- One entry per night, fixed id `taskEntryId(task, night)`, rewritten on every correction (`settleNight`).
  - Asleep by bedtime + grace: `task_done`, the task's reward.
  - Late with a Thanb reason, or no reason: `bedtime_late`, penalty of the "Late bedtime" sin type (`sin:lateBedtime`), the reason as the note.
  - Late with an excused reason: no entry.
  - Unmarked when the next day ends (`nightDeadline`): `bedtime_late`, note "Not marked".
- `settleBedtime()` runs on app open and every minute, catching up 14 nights. The day-end check and the task reminder skip the bedtime task.

## Reasons
- `reason` records, scope `bedtime` (`lib/ledger/reasons.ts`), edited with the shared `ReasonsEditor`. Presets: excused = work, illness, travel, family; Thanb = phone, tv, chatting, wastedTime.

## UI
- **Today:** `BedtimeCard` (tonight, and last night while it still needs an answer).
- **Sheet:** `BedtimeSheet` / `openBedtimeSheet(night)`, mounted once in the app layout.
- **Calendar:** the day view shows the night's state, time slept and reason.
- **Notification:** "Going to sleep?" at bedtime for the next 7 nights, skipped for marked nights (`lib/bedtime/notifications.ts`, `watchBedtime`).
