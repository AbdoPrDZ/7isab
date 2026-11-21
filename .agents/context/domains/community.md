# Community

**Status:** phases 1–5 of `.agents/plans/COMMUNITY.md` built (joining, groups and pages, posts and comments, shared items and events, trusted shaykhs and fatwa). Server: feature tests in `7isab-server/tests/Feature/Community/`. App and admin pages: typecheck, lint and build pass; not yet tested on a device or in a browser. Chats (phase 6), notifications (7) and real time (Reverb) are not built. Design: `.agents/blueprints/COMMUNITY.md`; progress: `.agents/plans.progress/COMMUNITY.progress.md`.

## Rules the server enforces
- **Joining is optional.** `GET community/me` (any signed-in user) returns the profile (or null) and `pending_rules`. Joining needs every current rule accepted in its current version (`RuleBook`). A rule changed "in substance" gets a new version; members must accept it again (`is_community_member` returns 403 `reason: rules_pending`, except for `rules/accept`, `PUT me`, `leave` via `is_community_member:pending_rules`). Rejoining after leaving keeps the gender. Suspended and banned members can't rejoin.
- **Gender** is set once (admins change it). It decides everything a member sees.
- **Spaces:** a group always has the owner's gender; a page is for everyone or the owner's gender. `Space::visibleTo` hides the other gender's spaces (they answer 404). Created only from an admin-approved request.
- **Content is for the people in a space** (user decision): `Post::visibleTo` requires an active membership (group member, page follower, owner, moderator), an active space of the viewer's gender, and audience `everyone` or an author of the viewer's gender. Every post read goes through it (feed, space posts, a post, comments, save, import, report, events). Space descriptions stay visible for discovery. Posting on a page therefore needs following it.
- **Comments** are only ever read, written, replied to and moderated within the viewer's gender (`author_gender`). Replies form a tree (`parent_id`); deleted parents stay as placeholders.
- **Moderators** are of the owner's gender, appointed by the owner. Page settings: public posting, a gender limit, approval of posts (owner and moderators skip it).
- **Members who left:** their posts and comments show as "deleted by author" (`PostPresenter`).
- **Blocks** hide content both ways, **mutes** one way (`Safety`, not cached: controllers outlive a request).
- **Ayah cards** always carry the server's Quran text (`quran_ayahs`), up to 10 ayat. Hadith need a book and number. Events store times in UTC; only future starts.
- **Fatwa:** female shaykhs, their profiles and fatwas are for women only, and only women ask them (`Shaykh::visibleTo`). The asker is never in a response a shaykh gets, only "a brother / a sister" if chosen. An open question stays open after a first answer (several shaykhs answer, one `fatwa_threads` row each). Publishing needs the shaykh's proposal (rewritten text) and the asker's approval. Admins see the asker only through a shaykh's report (`target_type: fatwa_question`).

## Server code (`app/Modules/Community/`)
- Controllers: `JoinController`, `SpaceController`, `SpaceMemberController` (owner / moderator moderation), `PostController`, `CommentController`, `ReportController` (reports, blocks, mutes), `ShaykhController`, `FatwaController`; `Admin/`: `RuleController`, `MemberController`, `SpaceAdminController`, `ReportAdminController`, `ShaykhAdminController`. `ChatController` is still a stub.
- Services: `RuleBook`, `Safety`, `PostPresenter`.
- Seeders: `CommunityRuleSeeder` (six starting rules in AR / EN / FR; never overwrites admin edits). No fake data seeders.

## App code (`7isab-app/src/`)
- `app/(app)/community/_layout.tsx`: `MembershipProvider` + gate (loading, join flow, rules to accept, blocked, error, or the community Stack).
- `app/(app)/community/(tabs)/`: Home (feed), Groups, Pages (`components/community/space-list.tsx`), Fatwa, Chats (placeholder).
- Screens: `space/[slug]`, `space-members`, `space-settings`, `request`, `requests`, `compose`, `post/[id]`, `pending`, `saved`, `events`, `hidden`, `settings`, `rules`, `fatwa-ask`, `fatwa-mine`, `fatwa-thread/[id]`, `fatwa-inbox`, `shaykhs`, `shaykh/[id]`, `fatwa-trust`.
- `components/community/`: `community-screen.tsx` (header with menu side sheet and Back to 7isab), `join-flow.tsx`, `post-card.tsx`, `import-sheet.tsx`, `sheets.tsx` (options, report, event reminder), `fatwa-card.tsx`.
- `lib/community/`: `api.ts` (every call takes the token), `types.ts`, `membership.tsx`, `imports.ts` (Testament / program into the vault, then the count on the server), `events.ts` (local time, reminder alarm via `saveAlarm({ onDay })`), `reverb.ts` (`useReverbChannel`, unused yet).
- Private data leaves the vault only when the user shares it (a Testament, or a program as a template without progress). Imports and event reminders are written to the encrypted vault; the server only records an import count.
- Strings: `community.*` in `i18n/locales/features.{en,ar,fr}.ts`.

## Admin panel (`resources/js/admin/pages/`)
`CommunityRules`, `CommunityMembers`, `SpaceRequests`, `Spaces`, `Reports`, `Shaykhs`; strings under `community`, `spaces`, `reports`, `shaykhs` in `i18n.jsx`.
