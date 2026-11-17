# 7isab server

The backend of [7isab](../README.md): Laravel 13 (PHP 8.3+), PostgreSQL and Sanctum, with a React + Tailwind admin panel served at `/admin`.

It never sees user data in clear text. It stores the users' encrypted key bundles and encrypted sync records, and serves the public Quran text.

## Modules (`app/Modules`)

| Module | What |
|---|---|
| **Auth** | Sign-up, sign-in (with a pre-login step for the key-derivation salt), sign-out on this or all devices, password change, and recovery-key unlock and reset. The app sends a key derived from the password, never the password; the server stores only a hash of it. |
| **Vault** | The user's wrapped data key (password and recovery-key wraps), replaced on password or recovery-key change. |
| **Sync** | Push and pull of encrypted records, with a per-user sequence number, the newest edit winning, and tombstones for deletes. |
| **Quran** | Public, cached Quran text page by page (Uthmani, Madani layout), surahs, juz starts, and the 240 rub' and 480 thumn of the hizbs. |
| **Admin** | Users, admins and roles (spatie/laravel-permission), and stats with no user content. React SPA at `/admin`. |

API base: `/api/v1`. App tokens and admin tokens use separate Sanctum abilities.

## Setup

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
```

Set in `.env`:

| Variable | What |
|---|---|
| `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL connection. |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | The first admin, created by the seeder. |
| `QURAN_SOURCE_URL` | Optional: where the Quran text is imported from (default: the quran.com API v4). |

Then:

```bash
php artisan migrate --seed       # tables, roles, the first super admin
php artisan quran:import         # the Quran text (all 604 pages; --pages=1-10 for a part)
npm run build                    # the admin panel
php artisan serve --host=0.0.0.0 # reachable from the phone on your network
```

Or run everything for development with `composer run dev`.

## Docker

One container runs PHP-FPM and nginx; PostgreSQL runs next to it. The admin panel is built inside the image.

```bash
cp .env.example .env
# In .env set at least:
#   APP_KEY=        (php artisan key:generate --show, or any base64:… 32-byte key)
#   APP_ENV=production  APP_DEBUG=false  APP_URL=https://your-domain
#   DB_DATABASE, DB_USERNAME, DB_PASSWORD   (used for both the app and the database container)
#   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
docker compose up -d --build
docker compose exec app php artisan quran:import     # once: the Quran text
```

- The app listens on port `8000` (`APP_PORT` in `.env` changes it). Put HTTPS in front of it (a reverse proxy) for production.
- On every start the container runs the migrations and the seeders (both safe to rerun), then caches the config and routes.
- Data lives in the `pgdata` (database) and `storage` volumes. Logs go to `docker compose logs app`.
- After pulling new code: `docker compose up -d --build`.

## Tests

PHPUnit runs against a PostgreSQL test database (`hisab_test`, see `phpunit.xml`):

```bash
php artisan test --compact
vendor/bin/pint --dirty     # code style
```
