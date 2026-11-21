# Website (blueprint)

> **Status:** idea, to build **after the community** (see [../plans/COMMUNITY.md](../plans/COMMUNITY.md)). This file describes the public website and the decisions so far; its implementation plan will be written when it's the website's turn.

## Vision
A public website for 7isab on the existing server: what the project is, its features, its privacy promise, the community rules, how to get the app, and a way to contact the team. Modern and Islamic in style, like the app. The community's web version will live on the same site (community only, never the rest of the app; no chat on the web for now).

## Decisions
- **Languages:** Arabic (default, right-to-left), English and French, with a language switch; the language is part of the address (`/ar`, `/en`, `/fr`).
- **Look:** the app's emerald, gold and ivory / night colours, the eight-point-star pattern, IBM Plex Sans (Latin and Arabic), a Quran font for ayat, light and dark themes. Shared with the admin panel so they never drift apart.
- **No tracking:** no analytics, no third-party scripts, no cookies except the language and theme choice.
- **Fast and simple:** server-rendered pages (good for search engines, works without JavaScript).

## Pages
| Page | Content |
|---|---|
| **Home** | The name حساب and the idea in one line (keeping the account of this life and the next), one ayah, the main pillars (Akhira ledger, prayer, Quran, Testaments, wallet and halal investments, privacy), a short privacy promise, the community, download buttons |
| **Features** | One section per area: Akhira ledger (tasks, sins, Thanb and sadaqa, weekly points, reports, programs), prayer, Quran and athkar, Testaments, wallet (accounts, debts, budgets, goals, zakat), halal investments, statistics, search, calendar and alarms, languages and themes |
| **About** | Why the project exists and its values: end-to-end privacy, halal only, no ads, no selling data, rewards and penalties set by the user |
| **Privacy** | What stays on the phone; end-to-end encryption; what the server stores and can never read; community data (server-readable, per its rules); no trackers; deleting an account; privacy requests |
| **Community rules** | The community rules, public, so anyone can read them before joining; joining is optional |
| **Download** | How to get the app (Android APK with its version; store links later) and how to install an APK |
| **Contact** | A form: name, email, subject (question, suggestion, problem, other), message |

## Contact messages
- Saved in the database and listed on a **Messages** page in the admin panel (read, mark handled, delete; a count on the dashboard).
- Protected against spam (hidden field, minimum fill time, rate limit). No IP address or browser data stored.

## Search engines and sharing
- A title, description and sharing preview per page and language; a sitemap; `/admin` and `/api` not indexed; the app icon as favicon.

## Open questions
1. **Screenshots** on Home and Features (to be provided), or icons only?
2. **About:** show the author's name, or "the 7isab team"?
3. **Download link:** from OTACenter's latest native build, or set by hand?
4. **Domain:** keep `abdopr-7isba.duckdns.org`, or a proper domain later?
5. **Contact notifications** by email (needs a mail server), or the admin list only?
