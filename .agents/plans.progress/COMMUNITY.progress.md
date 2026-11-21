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
- [ ] Creation requests and admin review
- [ ] Joining (open / by approval), following, moderators
- [ ] Page posting settings (public posting, gender limit, approval)
- [ ] Discovery filtered by gender and audience

## Phase 3: posts and comments
- [ ] Text, ayah and hadith posts with audience
- [ ] Comments separated by gender
- [ ] Approval queue, saved posts
- [ ] Reports, blocks, mutes; admin reports queue

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
- [ ] (Deferred to 4b) Event posts and event reminders

## Phase 5: trusted shaykhs and fatwa
- [ ] Trust requests, review, shaykh profiles (manhaj, marja')
- [ ] Open and targeted questions, per-shaykh threads, gender rules
- [ ] Publishing with both approvals; admin reveal on report

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
