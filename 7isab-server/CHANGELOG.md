# Changelog: 7isab server

The server has no version number yet; releases are listed by date. A new Docker image is only needed when the server code changes (PHP, migrations, admin panel).

## 2026-11-20

### Changed
- **Docker setup:**
  - Configuration now lives in `.env.docker` (template: `.env.docker.example`, never committed).
  - Compose uses the prebuilt image `ghcr.io/abdoprdz/7isab-server:latest` (`build: .` for local builds).
  - The app joins the shared PostgreSQL `it-pg-db` on the external `it-db-net` network; the bundled `db` service is commented out.
  - It is published on `127.0.0.1:${APP_PORT}` only, for a reverse proxy in front.
  - A health check runs on `/up`.
- **Behind a TLS proxy:** `TRUSTED_PROXIES=*` so URLs and assets are served as https (fixes pages loading without their styles).
- `QUEUE_CONNECTION=sync` in the container.

### Notes
- No API change: the app's new record types (`reason`, `report_note`, `program`, `relapse`, `stats_filter`) are stored like every encrypted record.

## 2026-11-17

First snapshot: auth with a password-derived key, vault (wrapped data keys), encrypted sync (push / pull, tombstones), public Quran API, and the admin panel at `/admin`.
