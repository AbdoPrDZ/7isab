# Progress: Community

Plan: [../plans/COMMUNITY.md](../plans/COMMUNITY.md). Design: [../blueprints/COMMUNITY.md](../blueprints/COMMUNITY.md). A step is ticked only when verified (tests pass, typecheck and lint clean, tried on a device where it applies). Each phase is confirmed with the user before it starts.

## Phase 0: decisions and setup
- [ ] Open questions answered (plan §9)
- [ ] Laravel Reverb + queue worker installed; `routes/channels.php` with the channel rules
- [ ] Docker services (Reverb, queue) and the nginx WebSocket proxy on the VPS
- [ ] Community module skeletons on the server
- [ ] App: community API client and the `pusher-js` connection (new runtime)

## Phase 1: joining and profiles
- [x] Versioned, admin-editable rules; acceptance per rule (server: `RuleBook`, join must cover every current rule, changed rules block members until accepted, rejoin keeps gender, banned / suspended can't rejoin; six starting rules seeded in AR / EN / FR; tests)
- [ ] Join flow in the app: intro, each rule on its own screen, names and gender; leave — written (gate in `community/_layout.tsx`, `join-flow.tsx`, `settings.tsx`), needs device test
- [ ] Community shell: tabs, drawer, back-to-7isab button — written (`community/(tabs)`, side-sheet menu instead of a drawer package, Home button in the header), needs device test
- [x] Admin API: rules (list, add, edit with "changed in substance" version bump, delete), members (list with exact gender / status filters, suspend, ban, reactivate, change gender); community admin routes now require an admin role; tests
- [ ] Admin panel pages: Community rules, Community members — written, `npm run build` passes, needs a browser test

## Phase 2: groups and pages
- [x] Creation requests and admin review (server: request, resubmit after "changes requested", approve creates the space with the owner as `owner` member; a group always takes the owner's gender; admin close / reopen / transfer to the same gender; tests)
- [x] Joining (open / by approval), following, moderators (server: groups joined, pages followed, owner can't leave, removed people can't return until allowed, moderators of the owner's gender appointed by the owner only; tests)
- [x] Page posting settings (public posting, gender limit, approval) enforced on `POST spaces/{id}/posts`; owner and moderators skip approval; a one-gender page can't be limited to the other gender; tests
- [x] Content is for the people in a space (user decision): posts, comments, saving, importing and reporting need an active membership (group) or follow (page); discovery and the description stay visible to the space's gender. Posting on a page therefore needs following it (the blueprint said "anyone who can see the page"). `Post::visibleTo` enforces it; tests
- [x] Discovery filtered by gender and audience (`Space::visibleTo`; fixed a search that leaked the other gender's groups; the other gender's spaces answer 404 everywhere; tests)
- [ ] App: Groups and Pages tabs (mine / discover), space screen, members, settings, request form, My requests — written, typecheck and lint clean, needs device test
- [ ] Admin panel: Space requests and Groups and pages — written, `npm run build` passes, needs a browser test

## Phase 3: posts and comments
- [x] Text, ayah and hadith posts with audience (server: ayah cards always carry the server's Quran text, up to 10 ayat; hadith need book and number; edit with "edited" mark; author deletes, owner or moderator hides; "deleted by author" for members who left; tests)
- [x] Comments separated by gender (server: reads, writes, replies and moderation only within the viewer's gender; reply tree via parent_id; deleted parents stay as placeholders; tests)
- [x] Approval queue, saved posts (server: managers' queue skips posts meant only for the other gender; the author sees their own pending posts; tests)
- [x] Reports, blocks, mutes; admin reports queue (server: report only what you can see; mute hides one way, block both ways; admin hide / suspend / ban / dismiss closes every pending report on the same target; tests)
- [ ] App: post card (ayah in the Quran font, hadith source), post screen with comment tree, compose (text, ayah, hadith, share a Testament or program), approval queue, saved posts, report sheet, muted and blocked list — written, typecheck and lint clean, needs device test
- [ ] Admin panel: Reports page — written, `npm run build` passes, needs a browser test

## Phase 4: shared items and events
- [x] Server: TestamentTemplate and ProgramTemplate models with migrations
- [x] Server: PostController.store() creates templates when posting testament/program types
- [x] Server: Import endpoint records imports and returns template data
- [x] Tests: 6 feature tests all passing for creation and import validation
- [x] App: Fixed import/export errors in PostCard, TestamentImportFlow, ProgramImportFlow
- [x] App: Created community feed screen with post loading and display
- [x] App: Added import buttons and TestamentImportFlow/ProgramImportFlow modals
- [x] App: Wired Community button on home tab (now opens `/community`, the membership gate)
- [x] Fixes: join routes reachable by non-members; CommunityRule / RuleAcceptance models; `Post::visibleTo` scope (space gender, audience by author gender) used by feed, space posts and import; payload validation returns 422; import only records the count (no copied post); feed limited to joined spaces and author names only; tests 77/77, pint clean
- [x] App fixes: every API call sends the token; feed reads `{ posts, has_more }`; import sheet (one modal, app sheet style) with local start day and `endFromLength`; imports in `lib/community/imports.ts` and recorded on the server; all strings in AR / EN / FR; theme colors (light and dark); `useReverbChannel` hook rewritten; typecheck and lint clean
- [ ] App: Device test — post testament/program, import, verify in vault
- [x] 4b server: event posts (title, start, optional end, place, https link, details; stored in UTC; future starts only) and `GET community/events` (upcoming, from joined spaces, soonest first); tests
- [ ] 4b app: event in compose, event card in the phone's time zone, "Remind me" (a private one-time alarm: at the start, 30 min, 1 hour or 1 day before; `saveAlarm` takes `onDay`), Events screen in the menu — written, typecheck and lint clean, needs device test

## Phase 5: trusted shaykhs and fatwa
- [x] Trust requests, review, shaykh profiles (server: manhaj and marja' required and public; one request per member, resent after a rejection; admin approve / reject / withdraw; a withdrawn shaykh can't answer and disappears; tests)
- [x] Open and targeted questions, per-shaykh threads, gender rules (server: female shaykhs, their profiles and fatwas for women only, only women ask them; the asker never appears in a shaykh's responses, only "a brother / a sister" when chosen; open questions stay available after a first answer so several shaykhs answer, one thread each; decline, refer to a shaykh the asker may ask; asker can close; 10 questions an hour; tests)
- [x] Publishing with both approvals; admin reveal on report (server: the shaykh proposes a rewritten question and answer, published only when the asker approves, refusal keeps it private; published fatwas show the shaykh's name, manhaj and marja'; a shaykh reports a question and only then admins see the asker; tests)
- [ ] App: Fatwa tab (published fatwas, ask, my questions, shaykhs, inbox or trust request), ask, my questions, thread (messages, answered mark, propose, refer, decline, report; asker approves or refuses), shaykh profile, trust request — written, typecheck and lint clean, needs device test
- [ ] Admin panel: Trusted shaykhs page (requests, withdraw) and fatwa report labels — written, `npm run build` passes, needs a browser test

## Phase 6: chats
- [ ] Chat keys (X25519 in the vault)
- [ ] Direct chats, small group chats, reactions in direct chats only
- [ ] Real-time delivery over Reverb; reporting chats

## Phase 7: notifications
- [ ] Personal events on `private-users.{id}`, stored for catch-up
- [ ] Local notifications, notifications list, per-user settings

## Phase 8: hardening and release
- [ ] Rate limits, word and link filters, load checks
- [ ] Server image and VPS deployment (Reverb and queue services)
- [ ] App runtime and APK
