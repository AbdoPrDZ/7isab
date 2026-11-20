# Reports and programs

**Status:** written (`7isab-app/src/lib/reports/`, `lib/programs/`, `app/(app)/report.tsx`, `report-settings.tsx`, `programs.tsx`, `program/[id].tsx`), typecheck and lint pass, not yet tested on a device.

## Reports (`lib/reports/reports.ts`)
- **Periods:** day, week (Saturday → Friday), month, year (Gregorian). `reportRange`, `shiftReport`.
- **Built live on the device** (`buildReport`), not from the day-end entries, so today's report is right at the end of the day:
  - `buildRangeReport(start, end)` builds the same report for any range (used by Statistics).
  - **Tasks** (`countTasks`, shared with programs): daily / chosen-day tasks per due day (today's only once done); weekly / monthly / yearly tasks once per period ending in the range. Prayer and bedtime tasks are counted separately.
  - **Prayers** from the marks: on time / combined = 1, late = ½, missed = 0, open ones not counted; mosque / home, khushoo, Jumu'ah.
  - **Bedtime:** on time = 1, late (Thanb reason or none) = 0, missed = 0, excused nights left out.
  - **From entries:** Akhira gained / lost, Thanb added, plain sins and fast taps, sadaqa, zakat. Quran pages / words and athkar counts from their day records.
- **Rating (an estimate only):** score = completed ÷ (due items + sins + fast taps). Good ≥ `goodAt` (80 %), normal ≥ `normalAt` (50 %), else weak. Shown as جيد بإذن الله / متوسط / ضعيف with "estimate only" wording. The screen compares with the previous period.
- **Notes:** `report_note` records, id from `period + start`, saved on blur, empty = removed.
- **Settings** (`settings.reports`): notification time (22:00), which periods notify, thresholds. Screen: Settings → Reports.
- **Notifications** (`lib/reports/notifications.ts`): on the last day of each period at the report time, next 8 days, one per day (the largest period leads), opening `/report?period=…&date=…`.
- **Opened from:** Today, the calendar (any day / week / month / year), notifications.

## Programs (`lib/programs/programs.ts`)
- `program` record: name, category (`improving` / `healing` / `custom` + name), goal, start, optional end (from a length in days), `archived` = finished.
- Tasks join a program with `task.programId` (task editor, or "Add a task" on the program screen, `/task/new?program=<id>`). Deleting a program keeps its tasks, unlinked.
- **Healing:** `relapse` records (date, private note, `thanb`). With `thanb`, a `sin` entry "Relapse" (`sin:relapse`, penalty default 1), id `relapse-entry:<relapse id>`, removed with the relapse. Streaks (`streaks`): clean days since the last relapse (or since the start, counting the start day) and the best streak.
- Plain tasks (`task.plain`) never count in a score: reports list them apart (`report.plain`), program reports skip them.
- **Program report** (`programReport`): its tasks' completion ÷ (due tasks + relapses), same rating; whole program, week or month. Period reports list the programs running in that period.
