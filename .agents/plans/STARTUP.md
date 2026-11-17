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
| OTA updates | `expo-ota-client` (+ `expo-updates`, `expo-device`) → a self-hosted OTA server (URL and key from `OTA_SERVER_URL` / `OTA_API_KEY` in `.env.local`). Package `com.abdopr.hisab`, runtime `1.0.0`, `<OTAProvider>` wraps the root layout. Needs a dev/EAS build (not Expo Go). Publish: `npx expo-ota-client publish --activate` |

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
