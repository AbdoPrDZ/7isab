# AGENTS.md

Instructions for AI coding agents working in this repository.

## Read first
1. **Project context:** start at [.agents/context/README.md](.agents/context/README.md).
   - It is maintained by the `project-context` skill ([.agents/skills/project-context/SKILL.md](.agents/skills/project-context/SKILL.md)).
   - Update mode is **ask**: after significant changes (Level 2–3), report what changed and which context files are affected, then wait for approval before editing the context.
   - The code always wins over the context. Fix the context when it's wrong.
2. **Plan:** [.agents/plans/STARTUP.md](.agents/plans/STARTUP.md) is the full product plan (stack, design, ledger model, features, security, sync, server, phases).
3. **Progress:** [.agents/plans.progress/STARTUP.progress.md](.agents/plans.progress/STARTUP.progress.md) has a checkbox for every step.
   - After finishing a step, tick it.
   - Only tick a step once it's verified (typecheck and lint pass, tested where that applies).
   - Add new steps when the plan grows.
4. **Sub-project rules:** the Expo rules are in [7isab-app/AGENTS.md](7isab-app/AGENTS.md). Read them before touching the app.

## Working rules
- **Don't write feature code until the user asks.** Discuss and plan first. Build phases in order, and confirm before starting each one.
- `rukes.md` holds the user's original notes on the ledger. **Its numbers are examples only.** Every configurable reward, penalty and rate defaults to **1**.
- **User data:** must go through the end-to-end encryption layer before it leaves the device. The server and the admin must never be able to read it.
- **UI strings:** never hard-code them. Use i18n (AR/EN/FR). Arabic is right-to-left, and Quran text is always right-to-left.
- **Never put** secrets, API keys or personal details in code, commits, logs or context files.

## Layout
```text
7isab-app/      Expo mobile app (SDK 58)
7isab-server/   Laravel + PostgreSQL API + React/Tailwind admin SPA (/admin)
.agents/        context, plans, progress, skills
rukes.md        user's original ledger notes
```
