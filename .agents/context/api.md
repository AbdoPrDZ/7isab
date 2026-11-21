# Server API

All routes are under `/api/v1`, defined per module in `7isab-server/app/Modules/<Module>/routes.php`. Every response uses the envelope `{ success, message, ...data }`; validation errors are 422 with `errors` (first message per field). Exceptions are rendered as the same envelope (`bootstrap/app.php`).

## Auth model
- **Sanctum tokens with abilities:** `app` (phone) and `admin` (panel). Admin tokens expire (`hisab.admin_token_ttl`); app tokens don't.
- Middleware aliases: `abilities`, `ability`, `active` (blocks disabled accounts), `role` (Spatie, guard `sanctum`), `is_community_member` (active member with every current rule accepted; `:pending_rules` lets members with rules to accept through). Errors that the app maps to its own text carry a `reason` (e.g. `not_member`, `rules_pending`, `banned`, `not_in_space`).
- Community admin routes need `abilities:admin` and an admin role, like the Admin module.
- **Roles are fixed:** `super-admin`, `admin`. App users have no role.
- **The password is never sent:** the phone sends an auth key derived from it (see `domains/security.md`).

## Modules
| Module | Purpose |
|---|---|
| Auth | `prelogin` (KDF params; stable fake ones for unknown emails), register, login, me, logout, logout-all, password change; recovery: params, unlock, reset |
| Vault | Locked data key (`GET vault/key`), replace the recovery key |
| Quran | Public `GET quran/meta` and `GET quran/pages/{page}` (cached), data version in `hisab.quran.version` |
| Sync | `POST sync/push`, `GET sync/pull?since=N` (see `domains/sync.md`) |
| Admin | Panel login/me/logout, stats, app-user management, admin management (super admin only). Never returns user data |
| Community | `/community/*` (joining, spaces, posts, comments, safety, shaykhs and fatwa) and `/admin/community/*` (rules, members, space requests, spaces, reports, shaykhs). Rules in `domains/community.md` |

## Lists
Admin lists use `Model::tablingCollect()`: `page`, `pageSize`, `search` (ilike on filterable fields), `sort[field]=asc|desc`, `filter[field]`. Unknown sort/filter fields return 422. Response: `items`, `itemsCount`, `pagesCount`, `page`.

## Rate limits
`auth`, `recovery`, `api` (120/min per user or IP), defined in `AppServiceProvider`. Community: reports 20/min, fatwa questions 10/hour (route `throttle`).
