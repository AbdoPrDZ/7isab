# Developer Workflows

All app commands run in `7isab-app/`.

## Daily commands
| Task | Command |
|---|---|
| Start dev server | `npx expo start` |
| Typecheck | `npx tsc --noEmit` |
| Lint | `npx expo lint` |
| Check dependencies | `npx expo-doctor` |
| Add a native package | `npx expo install <pkg>` |

Run the typecheck and lint before calling a task done.

## Native builds
- Day-to-day work runs in **Expo Go**. Native-only features fall back: scrypt runs in JS (slow sign-in), no fingerprint lock, no native splash, no OTA, no bundled athan sounds (phone sound instead), no full-screen athan / alarm page (`modules/hisab-alarm` is missing there).
- **Release APK:** `npx expo prebuild --platform android` then `cd android && ./gradlew assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk` (debug-signed). Use `--clean` when plugins, permissions or native modules change.
- **Windows build setup:**
  - Native paths exceed 260 characters: Windows long paths on, plus **CMake 3.31.6** from the SDK (ninja 1.12 handles long paths).
  - `android/local.properties` holds `cmake.dir=…/cmake/3.31.6`. It is machine-specific and removed by `prebuild --clean`, so add it back after one.
  - `app.config.js` sets `reactNativeArchitectures=arm64-v8a` and `org.gradle.workers.max=4` (a full parallel build ran Windows out of memory).
  - A VS Code Java language server or a running Gradle build can lock `android/` and make `prebuild --clean` fail with EBUSY.
- **Typed routes:** after adding a screen, regenerate `.expo/types` with a short `CI=1 npx expo start` (then stop it).
- A **development build** (`npx expo run:android`, or `eas build --profile development`) enables react-native-quick-crypto, expo-local-authentication, the native splash and OTA.
- Real speed without a release build: `npx expo start --no-dev --minify`.
- Formatting: the app has no Prettier config; match the existing style (single quotes, 120 columns, `bracketSameLine`).

## OTA updates (self-hosted OTA server)
1. **Server setup:**
   - The app on the OTA server must use the package name `com.abdopr.hisab`.
   - Its version name must equal `runtimeVersion` in `app.json` (currently `1.0.0`).
   - The server URL and the version's API key go in `7isab-app/.env.local` as `OTA_SERVER_URL` and `OTA_API_KEY`. Never put them in `app.json` or any committed file. Without them, `app.config.js` leaves the OTA plugin out.
2. **Check:** `npx expo-ota-client doctor`.
3. **Publish:**
   1. `npx expo-ota-client login -u <admin>`
   2. Set `OTA_TOKEN` to the token it prints.
   3. Run `npx expo-ota-client publish --activate`. Use `--demo` to send only to demo testers, then `promote <version>`.
4. **When native code changes:** bump `runtimeVersion`, create the matching version on the OTA server, then rebuild.
5. **Code signing (optional, not set up):** `npx expo-ota-client cert`.

## Server (`7isab-server/`)
- **Docker:** `Dockerfile` (Node stage builds the admin panel; PHP 8.4-FPM + nginx in one container; `docker/entrypoint.sh` migrates, seeds and caches on every start) and `docker-compose.yml` (app + PostgreSQL 17, volumes `pgdata` and `storage`, config from `.env`). Quran import: `docker compose exec app php artisan quran:import`. PHP 8.4.1+ is required (Symfony 8). `*.sh` files are forced to LF in `.gitattributes`.
| Task | Command |
|---|---|
| Tests (Postgres `hisab_test`) | `php artisan test --compact` |
| Format PHP | `vendor/bin/pint --dirty --format agent` |
| Migrate + seed roles and super admin | `php artisan migrate --seed` (super admin from `SUPER_ADMIN_*` env) |
| Import the Quran | `php artisan quran:import` (`--pages=` for a range) |
| Build the admin panel | `npm run build` (dev: `npm run dev`) |

- The admin panel is at `/admin` on the server.
- In tests, call `$this->forgetAuth()` between requests made as different users (the test app keeps the resolved user).
