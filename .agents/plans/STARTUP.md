# 7isab (حساب) — Startup Plan

An app to manage **الدنيا والآخرة** (this life and the next):
- **Akhira:** Quran reading, athkar, planned tasks, sins (ذنوب), sadaqa and zakat, all tracked with points.
- **Dunya:** full wallet management (accounts, income, expenses, budgets, …).

> Status: design done, no feature code written yet.
> `7isab-app/` has a fresh Expo SDK 58 scaffold (template screens only) plus `@react-native-async-storage/async-storage` and `zustand`. Those two may be replaced by expo-sqlite and kept or removed.
> `7isab-server/` is empty.

---

## 1. Stack

| Part | Choice |
|---|---|
| Mobile | Expo SDK 58, expo-router, TypeScript, NativeWind (Tailwind) |
| Local DB | expo-sqlite (works offline; the phone's copy is what the app reads and writes) |
| Server | Laravel API + PostgreSQL, Sanctum tokens |
| Admin panel | React SPA (react-router) + Tailwind v4, served by the Laravel project, talking to the JSON API with admin tokens. Modern and responsive on phone, tablet and desktop |
| Crypto | `@noble/ciphers` (XChaCha20-Poly1305) + `@noble/hashes` (scrypt/Argon2), `expo-crypto` for random bytes, `expo-secure-store` for keys |
| i18n | `expo-localization` + `i18next`. Arabic, English, French. Arabic is right-to-left |
| App lock | `expo-local-authentication` (fingerprint / Face ID) + PIN |
| OTA updates | `expo-ota-client` (+ `expo-updates`, `expo-device`) → a self-hosted OTA server (URL and key from `OTA_SERVER_URL` / `OTA_API_KEY` in `.env.local`). Package `com.abdopr.apps.hisab`, runtime `1.0.0`, `<OTAProvider>` wraps the root layout. Needs a dev/EAS build (not Expo Go). Publish: `npx expo-ota-client publish --activate` |

> Before using any Expo API, check the versioned docs for SDK 58 (see `7isab-app/AGENTS.md`).

---

## 2. Design

**Style:** modern Islamic, calm and readable.

| Token | Light | Dark |
|---|---|---|
| Background | Ivory `#FAF7F0` | Night green `#0B1512` |
| Primary | Emerald `#0F5C45` | Soft emerald `#2FA67E` |
| Accent | Gold `#C9A227` (sparingly) | Gold `#D9B645` |
| Danger / debt | `#B4473A` | `#E07A6A` |

- **Islamic touches:** faint geometric patterns (eight-point stars, girih) behind headers and empty screens. A mihrab-arch shape on the main cards only. Thin gold dividers. A decorative frame around Quran pages.
- **General look:** clean cards, generous spacing, soft shadows, smooth animations.

**Fonts: one font per language, never mixed**
| Use | Font |
|---|---|
| Arabic UI | IBM Plex Sans Arabic |
| English / French UI | IBM Plex Sans |
| Quran text | KFGQPC Uthmanic Hafs (matching Uthmani Hafs text) |

- **Digits:** Western (0–9) by default; Arabic-Indic (٠–٩) is an option in settings.
- **Formatting:** numbers, dates and currency use `Intl` for the chosen language.
- **Admin panel:** same colors and fonts.

---

## 3. Accounts and ledger (core model)

Everything is an **entry** that changes one or more **accounts**. Each account has a unit (a currency or a type of points).

### Fixed accounts (created automatically, cannot be deleted)
| Account | Unit |
|---|---|
| Akhira | Akhira points (نقاط الآخرة · Points Akhira) |
| Thanb-Sada9a | Thanb points (نقاط الذنوب · Points Thanb) |
| Sada9a | Main currency (e.g. DZD) |
| Zakat | Main currency |
| Cash | Main currency |

### User accounts (examples)
CCP (DZD), EUR bank (EUR), Debts / loans given (DZD), Gold (grams), …

### Entry types
| Event | Changes |
|---|---|
| Task done (fully or partly) | Akhira **+reward × progress** |
| Task missed (fully or partly) | Akhira **−penalty × (1 − progress)**, Thanb-Sada9a **+same** |
| ذنب (sin) | Akhira **−penalty**, Thanb-Sada9a **+penalty** |
| Fast-tapping (cheating while reading) | Same as a ذنب, with its own penalty |
| Paying a thanb as sadaqa | Thanb-Sada9a **−T**, Sada9a **−T × cost rate**, Akhira **+T × reward rate** |
| Giving sadaqa | Sada9a **−X**, Akhira **+X × sadaqa rate** |
| Paying zakat | Zakat **−X**, Akhira **+X × zakat rate** |
| Topping up Sada9a / Zakat | Any money account → Sada9a / Zakat (by hand or on a weekly/monthly schedule) |
| Income / expense | One money account ± |
| Transfer | Account A → Account B (manual exchange rate if the currencies differ) |
| Lending / repayment | Cash ↔ Debts |
| Buying / selling gold | Money account ↔ Gold (grams) |

### Rules
- Thanb and sadaqa are paid **only from the Sada9a account**. Zakat is paid **only from the Zakat account**.
- Sada9a and Zakat **may go below zero**. The user fixes this by transferring money in. The UI shows a clear warning while they are negative.
- Akhira may go below zero.
- Thanb-Sada9a should reach 0. Any unpaid balance carries over to the next month.
- Partial progress gives a partial reward and a partial penalty.

### Configurable rates, **all default to 1** (user changes them later)
| Setting | Default |
|---|---|
| Points per task done (per task) | 1 |
| Penalty per task missed (per task) | 1 |
| Penalty per ذنب (per type) | 1 |
| Fast-tapping penalty | 1 |
| Sadaqa: 1 currency unit = | 1 Akhira point |
| Zakat: 1 currency unit = | 1 Akhira point |
| Paying a thanb: 1 Thanb point costs | 1 currency unit, and gives 1 Akhira point |

---

## 4. Features

### 4.1 Today / Tasks
- **Tasks:** type (Quran, athkar, custom), target (pages, words, count, or done/not done), how often it repeats (daily, weekly, chosen days), reward and penalty.
- **End-of-day check:** turns each task's progress into ledger entries. Missed past days are caught up on the next app open.
- **No duplicate entries:** each entry gets a fixed ID = `HMAC(userKey, taskId + date)`, so it is never created twice across devices and leaks nothing to the server.

### 4.2 Quran reader
- **Text:** full Uthmani Hafs text with word splitting, bundled in the app for offline use. Reference API: `api.quran.com/api/v4/verses/by_page/{page}?words=true`.
- **Reading:** page view with the current word highlighted. **Tap anywhere** to count it and move to the next word. Undo with a button or a swipe back.
- **Progress:** the word position is saved; progress counts as words, pages, juz and khatma.
- **Fast-tap detection:**
  - Uses a rolling window of 10–15 words, with the expected time based on letter count.
  - Learns the user's own reading speed over the first few pages.
  - First time: a gentle warning. If it keeps happening: those words don't count, and a fast-tapping ذنب entry is added.
  - Strictness and penalty are configurable.

### 4.3 Athkar
- A big tap counter for each dhikr, with its target count.
- Built-in lists (morning, evening, after prayer) plus custom athkar.
- Can be linked to tasks.

### 4.4 Sins (ذنوب)
- Quick log with preset types, each with its default penalty. Optional private note.

### 4.5 Hisab (حساب)
- Akhira and Thanb balances, sadaqa and zakat history, monthly report and carry-over.

### 4.6 Wallet (Dunya)
- **Accounts:** any currency, can be archived or hidden.
- **Transactions:** income, expenses and transfers, with categories and sub-categories (icons and colors).
- **Repeating items:** salary, rent, subscriptions, scheduled sadaqa/zakat top-ups. Entered automatically or after confirmation.
- **Budgets:** per category per month, with alerts.
- **Loans:** money lent to people (Debts account) and money borrowed.
- **Savings goals.**
- **Reports:** by month and category, cash flow, net worth.
- **Multi-currency:** one main currency per user and **manual** exchange rates (EUR, gold DZD/g, …).
- **Zakat calculator:** nisab (85 g gold), hawl reminder, based on account balances.

### 4.7 Settings
- Language, digits, theme, main currency, rates, task and sin presets, app lock, sync, recovery key.

### 4.8 Bedtime (added)
- **Automatic task** "Go to bed", created once like the prayer tasks (reward / penalty default 1). Bedtime and a grace period are configurable (Settings → Bedtime); it can be switched off.
- **Marking, like prayers:** at bedtime a notification asks "Going to sleep?". Marking it records the time slept. Within bedtime + grace = on time (reward). Later = missed: a **reason is required**.
- **Unmarked:** the next morning the app asks for the time slept (or "I don't remember"); unanswered by the end of that day counts as missed with no reason (Thanb).
- **Reasons:** an editable preset list. Each reason has "counts as Thanb" on/off; the penalty is the "Late bedtime" sin type's (default 1, Sins screen). Presets: excused = Work, Illness, Travel, Family need; Thanb = Phone / social media, TV / games, Chatting, Wasted time. Excused = no reward and no penalty; Thanb = "Late bedtime" entry (Akhira −penalty, Thanb-Sada9a +penalty), the reason as the entry note.
- Corrections rewrite the hisab entry (same fixed-ID rule as prayers). Shown on the Today card, the calendar and in reports.

### 4.9 Reports (added)
- **Periods:** day, week (Saturday–Friday), month, year. Built on the device from tasks, prayers, bedtime, Quran, athkar, sins, Akhira / Thanb points, sadaqa and zakat, programs.
- **Notifications** at a configurable time (default end of day): the daily report every day; the weekly report on its last day, the monthly report on the month's last day, the yearly report on the year's last day. Each can be switched off.
- **Rating (an estimate only):** score = share of due tasks and prayers completed, lowered by sins and Thanb. **جيد بإذن الله** ≥ 80 %, **متوسط** ≥ 50 %, else **ضعيف**; both thresholds configurable. Always shown with "estimate only — Allah knows best" wording, never as a judgement.
- **Notes:** a private note per report (day / week / month / year), encrypted and synced like every record.
- **Report screen:** summary, rating, change vs the previous period, done / missed lists, the note; past reports browsable from the calendar.

### 4.10 Programs (added)
- **Program:** a named plan with a **category** (Improving, Healing, plus custom categories), start date, optional end date or length, goal, and its own tasks (any task kind; a task belongs to at most one program).
- **Healing programs** also track a habit: **clean days** (current and best streak) and **relapses** (logged with an optional private note; can add a Thanb, penalty default 1; resets the streak).
- **Report per program:** for its whole length and per week / month: task completion, rating (same estimate as §4.9), and for healing programs streaks and relapses. Programs appear in the period reports too.
- Archive or finish a program; its history stays.

### 4.12 Debts both ways (added)
- A default **"Debts I owe"** account (role `borrowed`, main currency), created for new and existing users; the starter "Debts" account is shown as **"Owed to me"**. Borrowing defaults to it and only offers `borrowed` accounts.
- Wallet **Debts** card: **Owed to me** and **I owe** as two separate totals (never netted), each broken down by person. Net worth is unchanged (debts still count against it). Loans already recorded are left as they are.

### 4.13 Statistics tab (added; replaces the Hisab tab)
- **Tabs:** Today · Quran · Athkar · Wallet · Statistics. The Hisab tab is removed: its quick actions (pay Thanb, sadaqa, zakat, top up, log a sin) and the negative Sada9a / Zakat warning move to Today; its month summary and entries list move to Statistics. `/hisab/action` stays.
- **One filter bar for everything:** period (this week / month / year, last 7 / 30 / 90 / 365 days, all time, custom from–to with a calendar range picker), compared with the previous period of the same length; multi-select filters (accounts, currencies, categories, entry kinds, people, tasks, task kinds, programs, prayers, sin types) and a text search in notes; group by day / week / month / year / weekday / category / account / task / sin type / person. Saved filters.
- **Sections:** Overview, Dunya (income, expenses, savings, cash flow, net worth, budgets, accounts), Akhira (points, Thanb with carry-over, sadaqa, zakat, sins), Deeds (task completion and heat map, prayers on-time / mosque / khushoo / Jumu'ah, bedtime on-time / average time / reasons, Quran, athkar, programs), Entries (filtered list with totals, long-press delete).
- **CSV export** of the filtered entries through the share sheet, with a warning that the file leaves the encrypted vault.

### 4.14 Settings, plain tasks, task alarms (added)
- **Settings holds configuration only:** account, appearance, daily task reminder, prayer settings (incl. quality and home-prayer reasons), bedtime, reports, Hisab (rates, fast-tap, sin types and penalties), wallet (categories, exchange rates), security, sync, about. Tasks, alarms and programs leave Settings (they stay on Today). Logging a sin is the Home quick action.
- **Plain tasks:** "Counts in hisab" off = no reward, no penalty, never an entry, never in the rating; shown on Today / calendar, and as a separate "Plain tasks" list (done / due) in Statistics and reports.
- **Task alarm:** optional alarm on a task (clock time or relative to a prayer, sound, ring again), on the days the task is due, skipped on days it is already done (rescheduled when progress changes); removed with the task; listed with the alarms under the task's name.

### 4.15 Weekly Akhira points (added)
- **Option** (Settings → Hisab → Weekly points, off by default): the shown Akhira points start again every **Saturday 00:00**.
- **Unpaid Thanb carries over:** the week starts at minus the Thanb not yet paid with sadaqa (e.g. 2700 earned + 200 unpaid Thanb = 2500; next week starts at −200). It never disappears without being paid; paying it brings the weekly points back up.
- **Real points vs weekly points:** the real (never reset) Akhira balance is shown under the weekly one; the statistics always use the real entries. Nothing in the ledger is reset: the weekly figure is derived from the entries.
- **History:** every past week with points carried in, earned, lost, Thanb added / paid, Thanb carried out, weekly and real points.

### 4.11 Prayer quality: khushoo and Jumu'ah (added)
- **Khushoo level** when marking a prayer as prayed: **حاضر (good)**, **متوسط (normal)**, **ضعيف (weak)**. Stored on the prayer mark (encrypted like every record); can be changed later as a correction.
  - **Weak** adds a Thanb: "Weak khushoo" sin type (`sin:weakKhushoo`, penalty default 1), Akhira −penalty / Thanb-Sada9a +penalty. Good and normal add nothing.
  - Settings → Prayer: ask khushoo on/off (off = no question, no Thanb). On a combined prayer it is asked for each of the two prayers.
  - Reports (§4.9) show the khushoo levels per prayer and over the period.
- **Place, for every prayer:** marking asks **at the mosque** or **at home**. Stored on the mark; can be corrected later.
  - At the mosque: nothing more.
  - At home: a **reason is required**, from an editable list like the bedtime reasons (§4.8). Each reason has "counts as Thanb" on/off; the penalty is the "Prayer at home" sin type's (default 1, Sins screen). Presets: excused = Illness, Travel, Rain / danger, Work, No mosque nearby; Thanb = Laziness, Busy / distracted, Overslept. A Thanb reason adds a "Prayer at home" entry (`sin:homePrayer`), the reason as the note.
  - Settings → Prayer → **"Praying at home always gives a Thanb"** (default **on**). On: every home prayer adds the "Prayer at home" Thanb (`sin:homePrayer`, penalty default 1) whatever the reason; the reason is still required and kept as the note. Off: the reason's "counts as Thanb" switch decides, as above.
  - Settings → Prayer: ask the place on/off (off = no question, no Thanb).
  - A combined prayer asks once for both prayers.
- **Jumu'ah:** on Fridays Dhuhr is shown as **Jumu'ah**.
  - At the mosque: a normal prayed mark.
  - At home: the prayer counts as prayed (as Dhuhr, no missed-prayer penalty) and **always** adds a Thanb: "Missed Jumu'ah" (`sin:missedJumuah`, penalty default 1), whatever the reason. The reason is still asked and kept as the note; it never removes the Thanb, and the "Prayer at home" Thanb isn't added on top.
  - Jumu'ah can't be combined with Asr.
- Reports (§4.9) also show mosque vs home per prayer and over the period.

---

## 5. Security

### End-to-end encryption (the server can never read user data)
1. At signup the phone creates a random **data key** (DEK).
2. The password is turned into a master key with scrypt or Argon2, using the account's KDF parameters (salt, cost). Two keys are derived from it (HKDF):
   - an **auth key**: the only thing sent to the server as the "password" (the server stores a hash of it);
   - a **key-encryption key (KEK)**: never leaves the phone.
   Before login the phone calls `prelogin` to get the KDF parameters. Unknown emails get stable fake parameters, so emails can't be probed.
3. The KEK locks the DEK. The locked DEK is uploaded to the server.
4. A **recovery key** is shown once at signup. It also locks a copy of the DEK.
5. On a new device: log in, download the locked DEK, unlock it with the password (or the recovery key).
6. Changing the password only re-locks the DEK.
7. **All user content is encrypted before it leaves the phone.** The server sees only the email, record IDs, record type, timestamps and sizes.
8. **Accepted:** losing both the password and the recovery key means the data is lost. The admin cannot recover it.
9. **Local DB:** check whether expo-sqlite supports encrypted storage (SQLCipher) and use it if it does.

### App lock
- The user chooses **PIN** or **fingerprint / Face ID**. If the fingerprint fails, it falls back to the PIN.
- **When it locks:** on app open, and after a set time in the background (1 min, 5 min, …).
- **PIN:** stored hashed in secure-store.
- **Wrong attempts:** a short lockout after several; after many more, the account password is required.
- **Option:** the DEK in secure-store can require fingerprint authentication to be read.

---

## 6. Sync (offline first)

- **Every record has:** a UUID made on the phone, `type`, `updatedAt`, `deletedAt` (records are marked deleted, not erased) and an encrypted payload.
- **Push:** the phone sends its local changes since the last sync.
- **Pull:** the phone asks for "changes since server sequence #N". The server assigns the sequence numbers, so phone clocks don't matter.
- **Conflicts:** the newest edit wins for each record. Ledger entries are only ever added, so conflicts are rare.
- **Sync triggers:** app open, coming back online, after changes (debounced), or by hand.

---

## 7. Server (`7isab-server/`)

**Laravel API**
- Auth: register, login, logout, change password (uploads the re-locked DEK).
- Endpoints for the locked DEK and the recovery copy.
- `POST /sync/push`, `GET /sync/pull?since=N`.
- Rate limiting.

**PostgreSQL tables**
- `users`
- `user_keys` (locked DEK copies)
- `records` (`id`, `user_id`, `type`, `seq`, `updated_at`, `deleted_at`, `payload` as bytea/base64)
- `admins` / roles
- `personal_access_tokens`

**Admin panel (React SPA + Tailwind)**
- **Super admin can:** list users (email, signup date, last sync, storage used); disable, delete or force-logout users; manage admins; see global stats.
- **Super admin can never:** read user data.
- Translated into Arabic, English and French, and responsive.

---

## 8. Phases

1. **Foundation (app):** theme, fonts, NativeWind; translations + right-to-left; SQLite schema + migrations; encryption layer; app lock; settings; base navigation.
2. **Ledger + Hisab:** accounts, entries, rates, tasks, end-of-day check, sins, sadaqa and zakat flows, monthly report.
3. **Quran reader + athkar:** bundled text, tap-anywhere reading, fast-tap detection, athkar counters.
4. **Wallet:** transactions, categories, repeating items, budgets, loans, goals, reports, multi-currency, zakat calculator.
5. **Server:** Laravel auth, key storage, sync endpoints, admin panel.
6. **Sync:** push and pull, conflict handling, background sync, multi-device testing.

**Every phase ends with:** `npx tsc --noEmit` and `npx expo lint` passing, and a test on a device or Expo Go.
