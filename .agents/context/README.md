# Project Context

This is AI-readable memory for the 7isab project, kept up to date so agents don't have to re-explore the codebase every session. It is **derived knowledge**: if it disagrees with the code, the code wins, and this context gets corrected.

## How to use
1. Read this file, then [config.md](config.md) (update mode: **ask**), then [structure.md](structure.md).
2. Read only the files relevant to the task (table below).
3. Check against the source code before relying on any claim.
4. After significant changes, follow the update mode: report what changed and which context files are affected, then wait for approval.

## Files
| File | Read for |
|---|---|
| [architecture.md](architecture.md) | Sub-projects, stack, how the parts connect, what is implemented vs planned |
| [conventions.md](conventions.md) | Project rules: i18n/RTL, fonts, design, defaults, working with the user |
| [workflows.md](workflows.md) | Commands, builds, OTA publishing |
| [integrations.md](integrations.md) | OTA server, quran.com data, adhan-js, server |
| [api.md](api.md) | Server API: auth model, modules, list parameters |
| [database.md](database.md) | Local SQLite records and the PostgreSQL tables |
| [decisions.md](decisions.md) | Why things are the way they are |
| [domains/](domains/README.md) | Ledger, security, sync, Quran and athkar, wallet, prayer and alarms |

## Read per task type
- **Any app or UI work:** architecture → conventions (and `7isab-app/AGENTS.md`)
- **Ledger, tasks, debt, sadaqa, zakat:** domains/ledger → decisions
- **Encryption, login, server:** domains/security → api → database
- **Sync:** domains/sync → database
- **Quran reader, tap reading, athkar:** domains/quran
- **Wallet, statistics, saving plans:** domains/wallet → domains/ledger
- **Prayer, athan, alarms, reminders, calendar, Hijri:** domains/prayer → domains/ledger
- **Builds, releases, OTA:** workflows → integrations
- **Features not built yet:** `.agents/plans/STARTUP.md` (the full plan)
- **What's done and what's next:** `.agents/plans.progress/STARTUP.progress.md` (checkbox list)
