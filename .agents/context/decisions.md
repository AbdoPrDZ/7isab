# Decisions

Short records. Each one lists the decision, then why.

1. **Offline first, with the local SQLite database as the source of truth, synced to the server.**
   - Why: the app must work without internet.
   - Why: the encrypted server can't run logic anyway.
2. **End-to-end encryption, done on the phone, with a separate key for each user.**
   - Why: the super admin must never be able to read user data.
   - Consequence: Laravel's server-side encryption isn't enough.
   - Consequence (**accepted by the user**): losing both the password and the recovery key means the data is lost.
3. **All business logic runs on the phone** (ledger, end-of-day check, reports, zakat).
   - Why: this follows from #2.
4. **The server gives each change a sequence number for sync.**
   - Why: phone clocks are unreliable.
5. **Fixed IDs for automatic entries:** `HMAC(userKey, taskId + date)`.
   - Why: no duplicate debt across devices.
   - Why: the ID leaks nothing to the server.
6. **One ledger with point "currencies".**
   - Akhira points and Thanb points are account units, alongside real money (DZD, EUR, gold in grams).
   - Why: the user wants to manage dunya and akhira in one place.
   - See `domains/ledger.md`.
7. **The units are called "points", not "hasanat".**
   - Why: only Allah knows the real reward; the score is personal motivation.
8. **Exchange rates are entered only by hand.**
   - Why: the DZD official rate and the street (square) rate are very different.
9. **Server: Laravel + PostgreSQL. Admin panel: a React SPA (react-router) + Tailwind in the same Laravel project, talking to the JSON API with admin tokens** (not Inertia).
   - Why: one codebase and one login system; the panel uses the same API as everything else.
10. **Quran text is served by the server and cached on the phone** (not bundled).
    - Why: keeps the app small; pages are downloaded once and work offline afterwards.
    - Why: word splitting with page/line layout is needed for tap-anywhere counting.
11. **OTA updates through a self-hosted OTA server (`expo-ota-client`), not EAS Update.**
    - Why: the user's choice.
12. **No NativeWind:** the app uses `StyleSheet` with theme tokens.
    - Why: the UI was already built that way; adding NativeWind would mean rewriting it for no gain.
13. **No SQLCipher:** each record's payload is encrypted with the data key instead.
    - Why: SQLCipher needs a development build; per-record encryption also gives exactly the format sync needs.
14. **Default ledger records are created on the phone** (fixed accounts, settings, sin presets, starter accounts, categories) with stable ids.
    - Why: the server can't read or create user data.
15. **Fixed roles only** (`super-admin`, `admin`), no permission editor.
    - Why: the user's choice; a small admin team.
16. **Prayer times are computed on the phone (adhan-js), not fetched.**
    - Why: works offline and keeps the location private (rounded, encrypted, never sent).
17. **Prayers are counted at their safe time, not at day end, and can be corrected later.**
    - Why: the user wants missed prayers counted right away and forgotten marks fixable; one entry per prayer-day (fixed id) is rewritten, never duplicated.
18. **Missed and late prayers use sin types ("Missed prayer", "Late prayer") for their penalties.**
    - Why: the user asked for two Thanb types; sin types already have a configurable penalty screen.
19. **A local native module (`modules/hisab-alarm`) for the athan and alarms over the lock screen.**
    - Why: expo-notifications can't show a full-screen page or loop a sound; the user wants alarm-clock behaviour with the app closed. Falls back to notifications where the module is missing.
20. **Thumn is split by word count at the nearest ayah.**
    - Why: the Madani data has no thumn marks; this is predictable and documented as approximate.
21. **Secrets come from environment variables** (`.env` for local builds, `.env.deploy` only for deploy builds; both git-ignored), read by `app.config.js` (OTA server URL and key).
    - Why: never commit keys; the build leaves the OTA plugin out when they're missing.
22. **Built-in ayat are copied from the quran.com API, never typed.**
    - Why: Quran text must be exact; typed text differed in diacritic order. Excerpts are exact word runs of the source.
23. **Quran search is offline, with Uthmani-aware folding.**
    - Why: search words stay on the phone; the stored text is Uthmani, so plain typing needs folding (see `domains/search.md`).
24. **Investments are halal-only, with no interest or guaranteed-return field, and are recorded as ledger entries on a per-investment capital account.**
    - Why: the user never invests with riba, qimar or doubtful deals; entries keep net worth, statistics and zakat right without a second money system.
25. **The profile photo is an ordinary encrypted record**, resized to 256 px.
    - Why: it is user data (end-to-end encrypted like everything else) and small enough for one sync record.
