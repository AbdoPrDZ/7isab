# Community Phase 4 (shared Testaments and programs): handoff

**Status:** server and app written and verified (server tests 77/77, pint clean on community files; app typecheck clean, lint 0 errors). Waiting for the device test.

## Server
- `Post::visibleTo($profile)`: published, active space open to the viewer's gender, and audience `everyone` or an author of the viewer's gender. Used by `feed`, `spacePosts` and `import`.
- `GET community/feed`: posts from spaces the viewer is an active member of; `{ posts, has_more }`; author is `id, first_name, last_name, gender` only; `imports_count` per post.
- `POST spaces/{id}/posts`: testament and program payloads validated with field rules (422), template rows created in one transaction.
- `POST posts/{id}/import`: testament and program posts only; one `imports` row per profile and post (`firstOrCreate`); returns `payload` and `imports_count`. It no longer copies the post.
- `GET community/rules` and `POST community/join` are outside `is_community_member` (non-members must reach them).
- `CommunityTestSeeder`: local environment only. Sign up in the app as `test@example.com` first (keys are made on the device), then `php artisan db:seed --class=CommunityTestSeeder`.

## App
- `lib/community/api.ts`: every function takes the session token first.
- `lib/community/imports.ts`: `importTestament` / `importProgram` save through the vault, then record the import (failure to record never fails the import). Program end day uses `endFromLength`; tasks are `custom`, `check` target, reward from the payload or 1, penalty 1.
- `components/community/post-card.tsx`, `components/community/import-sheet.tsx` (one sheet for both types), `app/(app)/community/(tabs)/index.tsx` (the community Home tab).
- Strings under `community.*` in `features.{en,ar,fr}.ts`.
- `lib/community/reverb.ts`: `useReverbChannel(name | null, handlers)` and `Channels`; not used by any screen yet.

## Device test
1. Seed as above, sign in as the test user, Home, Community.
2. Import the Testament: it appears in Testaments, switched on or off as chosen.
3. Import the program with Today or Tomorrow: the program and its tasks appear, ending after its length.
4. Pull the feed again: the post shows the import count.

## Known gaps (not Phase 4)
- Chat, report and shaykh controllers are empty stubs; their routes return errors.
- Feed shows the first page only (`has_more` is returned but not used yet).
