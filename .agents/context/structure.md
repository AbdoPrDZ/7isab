# Context Structure Specification

Rules for what lives in `.agents/context/`. This file changes only when the context's organization changes.

## Files

| File | Responsibility | Belongs | Does not belong |
|---|---|---|---|
| `README.md` | Entry point and navigation | What exists, what to read per task type | Project facts (route to other files) |
| `config.md` | How context is maintained | Update mode, detail level, scope, template | Anything else |
| `structure.md` | This specification | File list, responsibilities, creation conditions | Project content |
| `architecture.md` | System shape | Sub-projects, stack, layers, how parts connect, implemented-vs-planned status | Business rules, commands |
| `conventions.md` | Project-specific coding and UI rules | Routing, styling, i18n/RTL, fonts, naming, dependency rules | Generic framework docs; rules already in `7isab-app/AGENTS.md` (link to it) |
| `workflows.md` | Developer workflows | Run, typecheck, lint, build, OTA publish, release steps | Business workflows (those go in domain files) |
| `integrations.md` | External services | What each service is used for, where it's configured, constraints | Secrets, API keys, private URLs |
| `decisions.md` | Important decisions and why | Short decision records: choice, reason, consequences | Implementation detail |
| `api.md` | Server HTTP API concepts | Auth, sync endpoints, admin endpoints, versioning | Per-endpoint inventories |
| `database.md` | Data model concepts | Local SQLite and PostgreSQL entities, record envelope, migrations approach | Column-by-column listings |
| `domains/README.md` | Domain index | One line per domain file | Domain content |
| `domains/*.md` | One meaningful business/technical domain | Purpose, entities, rules, workflows, constraints | Code inventories |

## Creation Conditions

- `api.md`, `database.md`, `domains/quran.md`, `domains/wallet.md`, `domains/sync.md`, `domains/prayer.md`: created (their conditions are met).
- New domain files: only for a meaningful domain, never one per module or table.

## Per-Level Structure

```text
minimal:   README.md, config.md, structure.md, architecture.md
standard:  + conventions.md, workflows.md, integrations.md, decisions.md,
             api.md*, database.md*, domains/   (* when their creation condition is met)
detailed:  + infrastructure.md, deeper domain internals
```

Current level: **standard**.

## Domains (current)

- `ledger.md`: accounts, entries, rates, debt rules (the core of the app).
- `security.md`: end-to-end encryption, keys, app lock.
- `sync.md`: push / pull, conflicts, stable ids.
- `quran.md`: Quran data and rendering, tap reading, athkar.
- `wallet.md`: wallet features on top of the ledger, saving plans, statistics.
- `prayer.md`: prayer times, athan, prayer marks, alarms and the native alarm module, reminders, Hijri dates and the calendar.

## Relationship to the Plan

`.agents/plans/STARTUP.md` is the full product plan. Context files hold the **decided, persistent rules** an agent needs. When a planned feature is implemented, verify it against the code and move its rules into the matching context file. Code wins over both.
