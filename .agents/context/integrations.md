# Integrations

| Service | Used for | Where configured | Notes |
|---|---|---|---|
| **OTA server** (self-hosted) | Over-the-air JS updates and native build updates | `expo-ota-client` plugin added by `7isab-app/app.config.js` from `OTA_SERVER_URL` / `OTA_API_KEY` (`.env.local`; left out when empty); `<OTAProvider>` in `src/app/_layout.tsx` | Package `com.abdopr.apps.hisab`, runtime `1.0.0`. `checkAutomatically` stays `NEVER` so the provider controls the update UI. Does nothing in dev builds. See `workflows.md` |
| **quran.com API v4** | Source of the Quran text and Madani page/line layout | `hisab.quran.source_url` / `version` in `7isab-server/config/hisab.php`; `php artisan quran:import` | Called only by the import command, never by the app. The app reads `/api/v1/quran/*` and caches pages (see `domains/quran.md`). PHP needs a CA bundle (`curl.cainfo`) for HTTPS |
| **Laravel server** (`7isab-server/`) | Login, locked keys, Quran pages, sync, admin panel | App: `EXPO_PUBLIC_API_URL` in `7isab-app/.env.local` (dev server on the LAN, port 80) | See `api.md`, `domains/security.md`, `domains/sync.md` |
| **adhan-js** (`adhan`) | Prayer times and qibla, computed on the phone | `7isab-app/src/lib/prayer/prayer.ts` | No network. Method per country (`COUNTRY_METHOD`); Algeria / Morocco / Tunisia are custom angles. See `domains/prayer.md` |
| **Bunny Fonts** | IBM Plex fonts for the admin panel | `vite.config.js` (`laravel-vite-plugin/fonts`), `@fonts` in `admin.blade.php` | The app bundles its fonts with `@expo-google-fonts/*` |

Never record API keys, tokens or passwords here.
