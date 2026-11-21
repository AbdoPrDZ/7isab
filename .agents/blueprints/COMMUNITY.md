# Community (blueprint)

> **Status:** idea under discussion. This file describes what the community is and the rules decided so far. It is **not** an implementation plan: no phases, no code. Open questions, if any, are listed at the end.

## Vision
An Islamic social space inside 7isab: people meet around **groups** and **pages**, not around personal profiles. They share benefit (posts, Testaments, programs, events), talk in chats separated by gender, and can ask **trusted shaykhs** for a fatwa. Everything follows Islamic adab: no mixing of genders in groups or chats, real names, no showing off of deeds.

## Principles
- **Private stays private.** The ledger, tasks, Testaments, programs, progress, Akhira points and Thanb stay end-to-end encrypted and are never shared automatically. Sharing is always an explicit action that publishes a **copy**, never progress.
- **Three levels of data:**
  | Level | What | Who can read it |
  |---|---|---|
  | Private | Everything in the app today | Only the user (the server stores ciphertext) |
  | Community | Groups, pages, posts, comments, shared items, events, public profile, shaykh profiles, fatwas | Members / followers per the rules below; the server can read it to moderate |
  | Chat | Direct and group chats | End-to-end encrypted: only the participants |
- **No riya'.** No reactions on posts, no public leaderboards of deeds or points, no follower counts as a goal, no "who read what".
- **Real people.** Real names only: no pseudonyms, no anonymous posts. **The one exception is the fatwa asker**, who is hidden (see Fatwa).

## Joining
- **Joining is optional.** 7isab works fully without the community; a user can stay out forever, and can **leave** later.
- **The rules are accepted one by one:** before joining, each community rule is shown on its own and the user must agree to it separately (there is no "accept all"). The same in the app and on the web.
- The rules are also public (on the website), so anyone can read them before deciding.
- If the rules change, members are asked to accept the new or changed rules.

## Identity
- The community stores only what it needs: **first name** and **last name** (public), and **gender** (needed for every separation rule; not shown as a profile field, but it decides what each person sees). The **email** is used only to sign in and is **never public**.
- Gender is set once; only an admin can change it.
- Fake names are handled by **reports** from other users (no phone or ID check).
- There are **no personal posts and no personal followers**: a profile is just the name, the groups and pages the person owns, and, for a trusted shaykh, their manhaj and marja'.

## Groups
- A group is a **community of one gender**. Its gender is **the creator's gender**, automatically; it can never be chosen or mixed.
- Only users of that gender can see it, join it and take part.
- **Joining:** the owner chooses per group: **open** (anyone of that gender joins) or **by approval** (the owner or a moderator accepts each member).
- Members post, comment and discuss inside the group.
- The creator becomes the **owner** and can appoint **moderators** (same gender).
- The group's **purpose, goals and what is posted in it** are shown on the group, so members know what belongs there.

## Pages
- A page is a **publishing space** (a shaykh, a mosque, a teacher, a cause).
- **Audience, chosen at creation:**
  - **Open to everyone:** anyone can find and follow it.
  - **The creator's gender only:** completely **hidden** from the other gender (they can't find, follow or read it). A page can never be for the other gender only.
- **Posting:** by default **anyone who can see the page can post** on it. The owner can:
  - turn **public posting off** (only the owner and their moderators post), and / or
  - limit posting to **a specific gender**, and / or
  - require **approval of every post** before it appears (otherwise posts appear directly).
- **Who sees a post:** the person posting chooses the audience: **their own gender only** or **everyone** (on an open page). Mixing is the poster's responsibility.
- **Comments are always separated by gender:** men see the men's comments, women see the women's, on every post.

## Creating a group or page: by request only
Nobody can create a group or page directly. The user sends a **request** with:
- name and type (group or page);
- **purpose** and **goals**;
- **what will be posted** and how often;
- for a group: open or by approval; for a page: open to everyone or to the creator's gender only.

**Only the app's admins** review requests, in the admin panel: **approve**, **reject** (with a reason) or **send back for changes**. On approval the requester becomes the owner. The purpose and goals stay public; content outside them can be reported as "off purpose".

## Posts
- Posts exist **only inside groups and pages**.
- Post types:
  - **Text.**
  - **Ayah card:** an ayah chosen from the Quran, shown from the server's Quran text (always exact) with its reference.
  - **Hadith:** must carry its source (book and number), shown with it.
  - **Shared Testament:** category, text and source; others can **import** it into their private Testaments (it starts switched on and can be turned off).
  - **Shared program:** a **template** (name, goal, category, length, task list), never anyone's progress or relapses; others can **import** it and choose a start date.
  - **Event / lesson** (see below).
- **No reactions on posts:** no likes, no dislikes, no reaction of any kind. People reply with a comment if they have something to say. Posts can be saved.
- People **follow** groups (by joining) and pages, never other users.

## Events and lessons
- A group or page can publish an **event or lesson** (a lecture, a halaqa, a mosque activity): title, date and time, place or link, and details.
- Members and followers can **add it to their reminders** (a notification or an alarm before it), saved privately on their phone like any other alarm.

## Chats
- One-to-one and small group chats, **same gender only, always**: a chat between a man and a woman can never be created.
- **Open for now:** a user can start a chat with any user of the same gender. Each user can still limit who may message them, and block.
- **End-to-end encrypted:** each user has a key pair; messages are encrypted for the participants' public keys. The server only passes them on and stores ciphertext.
- **Reactions only in one-to-one chats.** Group chats have no reactions.
- Push notifications for chats never contain the message, only "new message".

## Fatwa and trusted shaykhs
- **Becoming trusted:** a user sends a **trust request** with their **methodology and frame of reference (المنهج والمرجعية)**. This is required and shown **publicly** on their profile. It can include their studies, ijazat, teachers, institution, and where they teach.
- **Only the app's admins** review trust requests. If accepted, the person gets a **trusted shaykh** badge. Trust can be **withdrawn**.
- **Shaykhs and gender:** a trusted shaykh is a man or a woman.
  - A **female** shaykh, her profile and her fatwas are visible only to **women**, and only women can ask her.
  - A **male** shaykh can be seen and asked by **everyone**.
- **The asker is always hidden** from shaykhs and from the public, so anyone can ask without shame and the question is judged on its content. **Only admins** can see who asked (to handle spam or abuse).
- **The asker's gender:** the asker can choose to show their gender on the question ("asked by a brother / a sister"), never their name, since some answers depend on it.
- **Two ways to ask:**
  - **Open question:** sent to the trusted shaykhs (the asker chooses the shaykhs' gender, within the rule above). Several shaykhs can answer it; **each shaykh's answer is a separate thread** with the asker, and each is published (or not) on its own.
  - **To a specific shaykh:** only that shaykh receives it.
- **Visibility:** a question is seen **only by the shaykhs it was sent to**. Nothing is public until a fatwa is published.
- **The fatwa flow (per thread):**
  1. The user asks.
  2. The shaykh **answers**, or **asks for more details** (back and forth with the hidden asker, in the thread).
  3. When the fatwa is done, the shaykh can propose to publish it. He can **rewrite the question and the answer** (e.g. remove personal details).
  4. **Published only when both agree:** the shaykh proposes and the asker approves the rewritten text. If either refuses, it stays private between them.
- Only trusted shaykhs can answer. A shaykh can also decline, or refer the question to another shaykh.
- Every published fatwa is shown with **the shaykh's name, manhaj and marja'**, with the note that it answers that specific question.

## Moderation
- Report a post, comment, group, page, user (including a fake name), shared item, event or fatwa answer. Reports go to a queue in the existing admin panel (hide, warn, suspend, ban; withdraw a shaykh's trust; close a group or page).
- Group and page owners and moderators handle their own space first; admins handle escalations.
- Block and mute; filters for bad words and links.
- Community rules accepted on joining: no fitna or takfir, no sectarian disputes, no haram content, hadith need a source, no selling or ads, stay within the space's purpose.
- **Encrypted chats can't be read by moderators.** Reporting a chat message includes the messages the reporter chooses to reveal.

## Navigation
- A **Community button on Home** opens the community as its **own space, like a separate app**: its own tabs, its own drawer and its own settings.
- A **quick button** in the community returns to 7isab.

## Design
- **Modern and Islamic, like the app:** the same emerald and gold palette, Islamic patterns, the same fonts, light and dark themes, and Arabic (right-to-left), English and French.
- Ayat in the Quran font and always right-to-left; shaykh profiles, fatwas and events have their own clear, calm layouts.
- The same look on the phone and on the web.

## Web access
- The community can also be used **on the web**, signing in with the same account.
- **Community only:** the web never shows the rest of 7isab (ledger, tasks, wallet, Quran reader, Testaments…). That data is end-to-end encrypted on the phone and stays there.
- **No chat on the web for now:** chats are end-to-end encrypted and need the user's keys, which live on the phone. A web solution will be thought about later (see Open questions).
- Everything else works on the web: groups, pages, posts, comments, shared items (importing them happens in the app), events, fatwas and the trusted-shaykh pages.

## Deliberately not included
- Personal posts, personal feeds, following people.
- Pseudonyms and anonymous posting (except the hidden fatwa asker).
- Mixed-gender groups and chats.
- Leaderboards of deeds or points; showing anyone's private progress.
- Likes, dislikes or any reaction on posts and comments, and reactions in group chats.
- Profile photos, phone numbers and ID checks.
- Group khatma, accountability circles, du'a requests, challenges and shared athkar lists (considered and refused).

## Open questions
1. **Chat on the web (later):** how to give the web the chat keys without breaking end-to-end encryption. Possible directions to study when the time comes: linking a browser by scanning a QR code from the phone (as WhatsApp Web does), or a separate chat key unlocked by the password on the web. Not decided.
2. **Importing from the web:** shared Testaments and programs go into the encrypted private data, which the web can't open. Should the web offer "Send to my phone" (the import then happens next time the app opens), or only show them?
