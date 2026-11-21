# Plan: Community (server + app)

> **Status:** plan, nothing built. The design and every rule are in [../blueprints/COMMUNITY.md](../blueprints/COMMUNITY.md); this file is **how** and **in which order** to build it. Each phase is confirmed with the user before it starts, and is done only when its tests pass, typecheck and lint are clean, and it was tried on a device.
> Order: the community first, then the public website ([../blueprints/WEBSITE.md](../blueprints/WEBSITE.md)), which will also host the community's web version.

## 1. Ground rules for the build
- **The server enforces every rule.** Gender separation, page audience, posting rights, approval, comment separation, fatwa privacy: all are checked in the API (policies and query scopes), never only in the app. A client must not be able to see or do more by changing a request.
- **Private data stays private.** Nothing from the encrypted vault is sent to the community, except what the user explicitly shares (a copy of a Testament, a program template, an event). Imports go back into the encrypted vault.
- **Community data is server-readable** (it must be moderated), except chat messages, which are end-to-end encrypted.
- **Joining is optional.** The app keeps working fully without the community. Nothing is created on the server until the user joins.
- **Every user-facing text** in AR / EN / FR (app, admin panel, server messages).
- **Server conventions:** a module per area under `app/Modules/<Module>` with its own `routes.php`, Form Requests, Policies, API Resources, PHPUnit feature tests, `pint`.
- **App conventions:** encrypted vault for private data only; community data is fetched from the API with a small cache (it isn't vault data).

## 2. Data model (server)
| Table | Main fields | Notes |
|---|---|---|
| `community_profiles` | user_id, first_name, last_name, gender (`male` / `female`), status (active / suspended / left), joined_at, rules_version | Created on joining. Gender is set once (admin-only change). Email stays on `users`, never exposed |
| `community_rules` | key, version, order, texts (AR / EN / FR) | The rules shown one by one; editable by admins; a new version asks members to accept again |
| `rule_acceptances` | profile_id, rule_key, version, accepted_at | One row per rule accepted |
| `spaces` | type (group / page), name, slug, purpose, goals, content_plan, owner_id, gender (group: owner's; page: null = everyone, or owner's), join_policy (open / approval; groups), posting (public on/off, gender limit, approval required; pages), status | Created only from an approved request |
| `space_requests` | requester_id, type, all the space fields, status (pending / approved / rejected / changes_requested), admin_note, reviewed_by | Reviewed in the admin panel |
| `space_members` | space_id, profile_id, role (owner / moderator / member / follower), status (active / pending / banned) | Group members and page followers |
| `posts` | space_id, author_id, type (text / ayah / hadith / testament / program / event), body, payload (json per type), audience (own gender / everyone), status (published / pending / hidden), edited_at | Audience and status enforced by scopes |
| `comments` | post_id, author_id, author_gender, body, status | Always filtered by the viewer's gender |
| `saved_posts` | profile_id, post_id | |
| `imports` | profile_id, post_id, imported_at | Only a count is shown, never who |
| `shaykh_requests` | profile_id, manhaj, marja, studies, ijazat, teachers, institution, teaching, status, admin_note | |
| `shaykhs` | profile_id, manhaj, marja, … , trusted_at, withdrawn_at | Public profile data |
| `fatwa_questions` | asker_id (hidden), shaykh_gender, target_shaykh_id (nullable = open), body, show_asker_gender, status | Asker never exposed except to admins on a report |
| `fatwa_threads` | question_id, shaykh_id, status (open / answered / declined / referred) | One per shaykh on an open question |
| `fatwa_messages` | thread_id, from (asker / shaykh), body | The back-and-forth |
| `fatwa_publications` | thread_id, question_text, answer_text, shaykh_approved_at, asker_approved_at, published_at | Published only when both approved |
| `chat_keys` | profile_id, public_key | X25519 public key |
| `conversations` | type (direct / group), gender, title, created_by | Same gender always |
| `conversation_members` | conversation_id, profile_id, role | |
| `messages` | conversation_id, sender_id, ciphertext per recipient (json or a `message_copies` table), created_at | Server stores ciphertext only |
| `message_reactions` | message_id, profile_id, emoji | Direct conversations only |
| `blocks`, `mutes` | profile_id, target_id | |
| `reports` | reporter_id, target type + id, reason, details, revealed_content (chat), status, handled_by | Admin queue |
| `notifications` | user_id, type, data, read_at | Laravel's notifications table: what was broadcast on the user channel, so the app can catch up after being closed and show a notifications list |

## 3. API outline (`/api/v1/community/*`, app token, `active` + "is a member" middleware)
- **Joining:** `GET rules`, `POST join` (names, gender, the accepted rule keys and versions; all required), `POST leave`, `GET me`, `PUT me` (names only).
- **Spaces:** `GET spaces` (discover, filtered by gender and audience), `GET spaces/{slug}`, `POST spaces/{id}/join|leave|follow|unfollow`, member approval and moderator management for owners, `POST space-requests`, `GET space-requests/mine`.
- **Posts:** `GET feed` (from joined groups and followed pages), `GET spaces/{id}/posts`, `POST spaces/{id}/posts`, `PUT|DELETE posts/{id}`, `POST posts/{id}/save`, approval queue for owners and moderators, `POST posts/{id}/import` (records the count; the app does the import itself).
- **Comments:** `GET posts/{id}/comments` (only the viewer's gender), `POST`, `DELETE`.
- **Ayah cards:** use the existing Quran API by ayah key, so the text is always the server's exact text.
- **Shaykhs and fatwa:** `POST shaykh-requests`, `GET shaykhs` (female shaykhs only for women), `POST fatwa-questions`, `GET fatwa/mine`, the thread messages, `POST threads/{id}/publish-proposal` (shaykh), `POST publications/{id}/approve|refuse` (asker), `GET fatwas` (published).
- **Chats:** `PUT chat-key`, `GET users/{id}/chat-key`, `POST conversations`, `GET conversations`, `GET|POST conversations/{id}/messages`, reactions on direct conversations.
- **Safety:** `POST reports`, `POST|DELETE blocks|mutes`.
- **Admin (`/api/v1/admin/community/*`):** space requests, shaykh requests, reports queue (with the hidden fatwa asker revealed only from a report), members (suspend, ban, change gender), rules editor, spaces (close, transfer).

## 4. Real time and notifications: Laravel Reverb
- **Server:** **Laravel Reverb** (WebSockets, Pusher protocol) carries every live event and notification, through **broadcast channels**. Events are broadcast from the queue so requests stay fast.
- **Channels** (all private, authorised in `routes/channels.php` through `POST /broadcasting/auth` with the app's Sanctum token; the server checks membership, gender and audience before allowing a channel):
  | Channel | Who can subscribe | Events |
  |---|---|---|
  | `private-users.{userId}` | that user only | personal notifications: a new chat message (no content), fatwa replies and publication proposals / approvals, space request decisions, join requests accepted, a post approved or hidden, a report handled, trust granted / withdrawn |
  | `private-spaces.{spaceId}.{gender}` | members / followers of that space of that gender | new posts and events visible to that gender, posts removed. **Split by gender** so a post for one gender (and comments, which are always per gender) never reaches the other |
  | `private-posts.{postId}.{gender}` | people of that gender who can see the post | new comments for that gender |
  | `private-conversations.{id}` | members of the conversation | new encrypted messages, reactions (direct only), typing |
  | `private-shaykhs.{gender}` | trusted shaykhs of that gender | a new open question for that shaykh gender (the asker never appears) |
  | `private-admin` | admins | live counts: new requests and reports |
- **Server setup:** `laravel/reverb` installed; Reverb runs as an extra service from the same Docker image (like OTACenter's queue and scheduler), plus a **queue worker** service; the host nginx proxies the WebSocket path (`/app`, `/apps`) to Reverb over the same domain and TLS.
- **App:** the **`pusher-js`** client (its React Native build) connects to Reverb: host and port of the server, `wss`, Reverb's app key, and an authorizer that calls `/broadcasting/auth` with the user's token. It subscribes to its user channel, its spaces' channels for its gender, open conversations and, for a shaykh, the shaykhs' channel. Incoming events update the screens and show **local notifications** (`expo-notifications`, already in the app) with the app's own text; chat notifications never contain the message.
- **Limit to know:** a WebSocket only delivers while the app is running (open or recently in the background). When the app is closed, nothing arrives until it opens again and fetches what it missed (`GET notifications` since the last seen id). If closed-app notifications are wanted later, a push service (FCM) can be added then.
- `pusher-js` on React Native uses `@react-native-community/netinfo`, a native module: the community build needs a **new runtime version and APK**.

## 5. Chat encryption (app)
- Each member has an **X25519 key pair** (`@noble/curves`, same family as the `@noble/ciphers` already used). The private key is stored **in the encrypted vault**, so it syncs to the user's other devices and is never readable by the server. The public key is uploaded.
- **Direct message:** a shared key from X25519 between the two, then XChaCha20-Poly1305 per message.
- **Group chat (small groups):** the sender encrypts a random message key once for each member's public key (a size limit keeps this cheap). Sender keys can come later if groups grow.
- **Reporting** a chat sends the messages the reporter chooses, decrypted, with the report.
- The web has **no chat** for now (see the blueprint).

## 6. App structure
- A **Community button on Home** opens a separate navigator `app/(community)/`, a space of its own:
  - **Tabs:** Home (feed), Groups, Pages, Fatwa, Chats.
  - **Drawer:** profile, my groups and pages, my requests, saved posts, events, community settings (who can message me, notifications, leave the community), community rules, and **Back to 7isab**.
  - A **quick button** in the header goes back to 7isab.
- **Join flow:** an intro (what the community is, that it's optional), then **each rule on its own screen** with "I agree" (no "accept all"), then first name, last name and gender (with the note that gender can't be changed later), then joining. "Not now" anywhere returns to the app.
- **Imports:** a shared Testament → `saveTestament` (encrypted, switched on); a shared program → a program and its tasks from the template, with a start date; an event → an alarm or reminder record.
- **Design:** the app's emerald, gold and patterns, the Quran font for ayah cards, right-to-left in Arabic, light and dark.

## 7. Phases
0. **Decisions and setup:** answer the open questions (§9); install Laravel Reverb and a queue worker, `routes/channels.php`, the Docker services and the nginx WebSocket proxy; the community module skeletons; in the app, the API client and the `pusher-js` connection (new runtime).
1. **Joining and profiles:** rules (versioned, admin-editable), the one-by-one join flow, profiles, leave; the community shell in the app (tabs, drawer, back button); admin: rules editor and members list.
2. **Groups and pages:** creation requests and admin review; joining (open or by approval), following, moderators; page posting settings; discovery filtered by gender and audience.
3. **Posts and comments:** text, ayah and hadith posts; audience; comments separated by gender; approval queue; saved posts; reports, blocks and mutes; the admin reports queue.
4. **Shared items and events:** Testament, program and event posts; importing into the app's private data; event reminders.
5. **Trusted shaykhs and fatwa:** trust requests and review; shaykh profiles with manhaj and marja'; open and targeted questions; per-shaykh threads; publishing with both approvals; gender rules for female shaykhs; admin reveal on report.
6. **Chats:** keys, direct chats, small group chats, reactions in direct chats only, real-time delivery, reporting chats.
7. **Notifications:** every personal event on `private-users.{id}` (stored in `notifications` for catch-up), local notifications in the app, a notifications list, per-user settings (what to be notified about), event reminders.
8. **Hardening and release:** rate limits, word and link filters, load checks, a server image and VPS deployment (Reverb and queue services), a new app runtime and APK.

## 8. Tests (each phase)
- **Server:** feature tests for every endpoint and rule, especially the negative cases (a man can't see a women's group or a female shaykh; a hidden page stays hidden; comments of the other gender are never returned; the asker is never exposed; a fatwa isn't public without both approvals; cross-gender chats are refused).
- **App:** typecheck and lint, the join flow, imports, chat encryption round-trips, then device tests.

## 9. Decisions
1. **Closed-app notifications:** catching up when the app opens is enough for now; FCM push later.
2. **Images:** text only for now.
3. **Leaving the community:** posts and comments are hidden (shown as "deleted by author").
4. **Editing and deleting:** yes, members can edit (with an "edited" mark) and delete their posts and comments.
5. **Group chat size:** unlimited.
6. **Comment replies:** a tree (replies to comments, not flat).
7. **Search in the community:** later (phase 8+).
8. **Community name:** the owner names it (space-specific, can be anything).
