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

One container runs PHP-FPM and nginx, and the admin panel is built inside the image. It uses a shared PostgreSQL container (`it-pg-db`) on the external `it-db-net` network; a local `db` service is in `docker-compose.yml`, commented out.

```bash
cp .env.docker.example .env.docker
# In .env.docker set at least (never commit it):
#   APP_KEY=        (php artisan key:generate --show, or any base64:… 32-byte key)
#   APP_URL=https://your-domain   APP_PORT=8080
#   DB_DATABASE, DB_USERNAME, DB_PASSWORD   (a database and user on it-pg-db)
#   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
docker network create it-db-net    # once, if it doesn't exist yet
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker exec app php artisan quran:import   # once: the Quran text
```

- The image is `ghcr.io/abdoprdz/7isab-server:latest`; `--build` builds it from this folder. Rebuild only when the server code changes.
- The app listens on `127.0.0.1:${APP_PORT}` only (default `8080`). Put a reverse proxy with HTTPS in front of it. `TRUSTED_PROXIES=*` makes Laravel trust the proxy's `X-Forwarded-*` headers so URLs are https.
- Production values (`APP_ENV`, `APP_DEBUG`, `DB_HOST`, cache, session, queue) are set in `docker-compose.yml` and override `.env.docker`.
- On every start the container runs the migrations and the seeders (both safe to rerun), then caches the config and routes. A health check runs on `/up`.
- Files live in the `7isab-storage` volume. Logs go to `docker compose logs app`.
- After pulling new code: `docker compose --env-file .env.docker up -d --build`.

See [CHANGELOG.md](CHANGELOG.md) for what changed.

## Tests

PHPUnit runs against a PostgreSQL test database (`hisab_test`, see `phpunit.xml`):

```bash
php artisan test --compact
vendor/bin/pint --dirty     # code style
```
