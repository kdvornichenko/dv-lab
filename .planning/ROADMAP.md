# Roadmap: dv-lab

## Milestones

- **v1.0 Teacher CRM Foundation** and **v1.1 Audit Remediation** - Phases 1-16, shipped 2026-05-03, archived in `.planning/milestones/v1.1-ROADMAP.md`
- **v2.0 Unified dv-lab** - Phases 17-26, in progress

## Overview

v2.0 replaces the Supabase-era CRM with a new workspace on the own VPS. The order follows the owner's priority: server and empty skeleton, sign-in ported from ielts, the variant A shell, student cards with the vault import, the schedule and lesson accounting, chat, Google Calendar, and IELTS last. The manual schedule comes before chat because chat marks and moves lessons; Google Calendar comes after chat and builds on the same lesson, series and exception model. Each phase is a vertical slice merged into `master` through a pull request from a `gsd/*` branch after green CI, then deployed by the owner. Old dv-lab code is rewritten from scratch; ielts code is ported as is. Calendar phases follow `.planning/research/CODE-AUDIT.md`.

## Phases

### v2.0 Unified dv-lab (In Progress)

**Phase Numbering:**
- Integer phases (17, 18, 19): planned v2.0 work, continuing from v1.1 (last phase 16)
- Decimal phases (17.1, 17.2): urgent insertions (marked with INSERTED)

- [ ] **Phase 17: Skeleton on the Server** - Clean monorepo on the latest stack, CI on PostgreSQL 18, images in GHCR, HTTPS and backups on the VPS
- [ ] **Phase 18: Accounts and Variant A Shell** - Teacher and student sign-in ported from ielts, inside the variant A shell
- [ ] **Phase 19: Student Cards and Vault Import** - Cards with sections, vocabulary and payments; all 25 vault students imported
- [ ] **Phase 20: Schedule** - Week grid with single lessons, weekly series and occurrence exceptions
- [ ] **Phase 21: Lesson Accounting and Today** - Lesson marks deduct minutes by shared core rules; Today and "pays soon" from real data
- [ ] **Phase 22: Chat with Mentions and Quick Marks** - Conversations, `@student` mentions, instant marks with undo, answers from data, budget cap
- [ ] **Phase 23: Confirmed Chat Changes and Entry Points** - Payments, new students, deletions and bulk moves after confirmation; palette, profile and phone layouts
- [ ] **Phase 24: Google Calendar Connection and Outbound Sync** - Server-side OAuth, deterministic event ids, one queued writer, paginated conflict check
- [ ] **Phase 25: Google Calendar Two-Way Sync** - Push notifications, `syncToken`, `410` resync, event matching, Google wins
- [ ] **Phase 26: IELTS Section** - ielts ported under `/ielts` with its data moved from Neon and Blob

## Phase Details

### Phase 17: Skeleton on the Server

**Goal**: An empty skeleton built from the cleaned monorepo on the latest libraries runs on the OVHcloud VPS behind HTTPS, with CI, published images and restorable backups.
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08
**Success Criteria** (what must be TRUE):
  1. The repository holds only the new skeleton: the Supabase-era apps and packages are gone, the old `packages/db` and its 14 migrations are replaced by a new Drizzle v1 package with a fresh migration history, a search for `supabase` in the code returns nothing, and build, typecheck, lint and tests pass on the latest stable versions (Next 16.4, React 19.3, TypeScript, Turbo, Yarn).
  2. CI runs on every pull request and every push to `master`, including database tests on PostgreSQL 18 under the same non-superuser role as the server, and is green.
  3. A merge to `master` publishes the web and api images to GHCR, and the owner's server pulls and restarts them without building on the server.
  4. `https://dv-lab.dev` serves the web app and the API health check from the VPS over IPv4 and IPv6, only the proxy ports are reachable from outside, HTTP/3 is off, and `ielts.dv-lab.dev` still serves from Vercel.
  5. Postgres backups run on a schedule and the owner has restored the latest one once; the API stops on `SIGTERM` within a bounded time with open WebSocket connections, writes structured logs with request ids, and migrations run as a separate step under the migration role.

**Plans**: 13/13 plans executed

Plans:
**Wave 1**
- [x] 17-01-PLAN.md — Clean repo, pinned toolchain and manifests, one `yarn.lock` review, local `.env` files (W1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 17-02-PLAN.md — Web placeholder on Next 16.4 standalone, web/api boundary (W2)
- [x] 17-03-PLAN.md — `packages/db` on Drizzle v1: DB role module, first migration, role tests on PostgreSQL (W2)
- [x] 17-04-PLAN.md — API request context: request id, JSON access log, error envelope (W2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 17-05-PLAN.md — Migrations as a separate step (`dist/migrate.mjs`), applied to dev and test DBs [BLOCKING] (W3)
- [x] 17-06-PLAN.md — Server stack: compose, Caddyfile, idempotent `ensure-db.sql` (W3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 17-07-PLAN.md — API process: config, lifecycle owner, `/healthz`, SIGTERM shutdown (W4)
- [x] 17-08-PLAN.md — `deploy.sh` with migration rehearsal and rollback, nightly backup with 14+8 retention, restore check (W4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 17-09-PLAN.md — `/ws` echo with Origin check, shutdown with open WebSockets (W5)
- [x] 17-11-PLAN.md — `RUNBOOK.md` and VPS preparation by the owner (W5)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 17-10-PLAN.md — CI on PostgreSQL 18, Dockerfiles, GHCR images, knip, agent docs (W6)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 17-12-PLAN.md — PR green, merge, images published to GHCR (owner) (W7)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 17-13-PLAN.md — DNS cutover, first deploy, backups and restore, outside checks (owner) (W8)

**Notes**: Server steps are run by the owner through the separate "Server guy" session; agents have no server access. Traps and the bio-exam reference setup are in `~/.claude/servers/dv-lab.md`.

### Phase 18: Accounts and Variant A Shell

**Goal**: The teacher signs in with an ielts-style account and works inside the variant A shell; student accounts can be created and deactivated.
**Depends on**: Phase 17
**Requirements**: ACCT-01, ACCT-02, ACCT-03, ACCT-05, SHELL-01, SHELL-02
**Success Criteria** (what must be TRUE):
  1. After the bootstrap script creates the teacher, the teacher signs in on `dv-lab.dev` with email and password and can change the own password; adding a second active teacher account is rejected by the database.
  2. The teacher creates a student account (login, name, password), the student can sign in, and deactivating the account signs the student out of every open session.
  3. Sessions live in Postgres with only token hashes stored and survive an API restart; five failed sign-ins for one login from one IP within 15 minutes block further attempts for 15 minutes.
  4. After sign-in the teacher lands in the variant A shell with the sidebar sections Today, Chat, Students and Schedule and a search field that opens the palette.
  5. Every screen of the shell uses Base UI components and variant A tokens, switches between light and dark themes, and shows only English text.

**Plans**: TBD
- [x] 18-01-PLAN.md
- [x] 18-02-PLAN.md
- [x] 18-04-PLAN.md
- [x] 18-05-PLAN.md
- [x] 18-06-PLAN.md
- [x] 18-07-PLAN.md
- [x] 18-08-PLAN.md
- [x] 18-09-PLAN.md
- [x] 18-10-PLAN.md
- [x] 18-11-PLAN.md
- [x] 18-12-PLAN.md
- [x] 18-13-PLAN.md
- [x] 18-14-PLAN.md
- [x] 18-15-PLAN.md
- [x] 18-16-PLAN.md
- [x] 18-17-PLAN.md

**UI hint**: yes

### Phase 19: Student Cards and Vault Import

**Goal**: Every vault student has one card in Postgres with info, vocabulary and payment history, and the teacher maintains cards and records payments.
**Depends on**: Phase 18
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-06, CARD-07, ACCT-04, LEDG-01, LEDG-02, LEDG-09
**Success Criteria** (what must be TRUE):
  1. The teacher creates, edits, archives and restores a card with name, status, lesson rate and currency, default lesson length, parent, level, goals and time zone, and edits its markdown sections (general info, interests, level, goals, typical mistakes, lesson ideas) and its vocabulary terms with notes.
  2. After the import all 25 vault students exist with stable ids, their sections, vocabulary and payments; running the import again creates no duplicates; "Vika" is a student card, and "Vika" in payment notes is not linked to that card.
  3. Transfers that match no student (for example the 2026-06-22 transfer from Evgeniy) appear as unassigned payments, and the teacher can assign one to a student.
  4. The teacher records a payment (date, amount, currency, lessons count, note); the lessons count is prefilled as the amount divided by the student's rate and can be edited, and the student's balance is stored in minutes and shown in lessons with fractions.
  5. A student account links to exactly one card; linking a second account to the same card, or one account to two cards, is rejected.
  6. The teacher sets an opening balance (lessons left) on each card, and the balance shown after the import is counted from that opening balance, not from every lesson ever paid.

**Plans**: 16/20 plans executed

Plans:
**Wave 1**
- [x] 19-01-PLAN.md — All phase dependencies in one install: `packages/core` skeleton, pinned react-markdown, remark-gfm, react-day-picker (W1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 19-02-PLAN.md — `packages/db` owns `DbExecutor` and Postgres error parsing; four copies moved (W2)
- [x] 19-03-PLAN.md — Contracts: name predicate, currencies, section kinds, request schemas, 409 codes (W2)
- [x] 19-04-PLAN.md — `packages/core` money, lessons and balance functions; knip and CI boundary (W2)
- [x] 19-05-PLAN.md — Schema for cards, sections, terms, payments, account link; migration applied [BLOCKING] (W2)
- [x] 19-06-PLAN.md — Variant A Select, Combobox, Textarea, DateField copies, MarkdownView (DR-1), StatusDot (W2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 19-07-PLAN.md — Cards module and `/students` routes, opening balance, account and card names split (W3)
- [x] 19-08-PLAN.md — `import-vault parse`: packet from the vault, ignore masks (W3)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 19-09-PLAN.md — Sections and vocabulary in the cards module and routes (W4)
- [x] 19-10-PLAN.md — Payments: record, delete, unassigned, assign (W4)
- [x] 19-11-PLAN.md — Students screen: card list and New student dialog (W4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 19-12-PLAN.md — Account link to a card: create from card, link existing, deactivate (W5)
- [x] 19-13-PLAN.md — `import-vault apply` through the cards module, run on `dvlab_dev` (W5)
- [x] 19-14-PLAN.md — Profile: header, Overview, archive and restore, opening balance (W5)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 19-15-PLAN.md — `import` compose service and RUNBOOK section 11 (W6)
- [x] 19-16-PLAN.md — Payments UI: Record payment, Payments tab, Unassigned payments and Assign (W6)

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 19-17-PLAN.md — Notes and Vocabulary tabs (W7)

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 19-18-PLAN.md — Account panel: create, link, deactivate from the card (W8)

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 19-20-PLAN.md — Form fields: one look, one error line, Combobox empty state and time zone offsets, per the Design session (W9)

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 19-19-PLAN.md — Final verification: AGENTS.md, full checks, privacy, six criteria by hand (W10)

**Notes**: The release and the server import are run later by the Server guy session (RUNBOOK 11) after the owner accepts the import on `dvlab_dev`.
**UI hint**: yes

### Phase 20: Schedule

**Goal**: The teacher plans lessons on a week schedule built from single lessons, weekly series and occurrence exceptions, and sees each student's next lesson and remaining lessons.
**Depends on**: Phase 19
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05, CARD-04
**Success Criteria** (what must be TRUE):
  1. The teacher creates a single lesson and a weekly series for a student and sees every occurrence on the week grid while moving between weeks.
  2. Moving or cancelling one occurrence changes only that occurrence; the rest of the series stays where it was, and later changes to the series keep that exception.
  3. Moving a whole series to a new weekday and time changes only future occurrences; past lessons, including those of an ended series, stay exactly as they were.
  4. The grid shows Vietnam time by default and can show a second time zone next to it.
  5. The students list has status tabs and search and shows each student's remaining lessons and next lesson.

**Plans**: TBD
**UI hint**: yes

### Phase 21: Lesson Accounting and Today

**Goal**: Marking lessons keeps every student's remaining lessons right through one set of rules in `packages/core`, and Today shows who studies and who pays soon.
**Depends on**: Phase 20
**Requirements**: LEDG-03, LEDG-04, LEDG-05, LEDG-06, LEDG-07, LEDG-08, SHELL-05
**Success Criteria** (what must be TRUE):
  1. Marking a 60-minute lesson done takes 1 lesson from the balance, and a 90-minute lesson takes 1.5.
  2. A no-show deducts the lesson duration unless the teacher turned that off for the student; a cancelled or moved lesson deducts nothing.
  3. Correcting any mark (for example done to cancelled) recomputes the balance at once on every screen that shows it.
  4. The "pays soon" list shows students with at most N lessons left or none, N is a setting with default 2, and Today shows counters, today's lessons and this list from real data.
  5. The students list, the profile, Today and "pays soon" show the same balance because they call the same `packages/core` functions, and those rules are covered by unit tests.

**Plans**: TBD
**UI hint**: yes

### Phase 22: Chat with Mentions and Quick Marks

**Goal**: The teacher records lesson outcomes by writing one line in chat and gets answers about any student from stored data, within the monthly budget.
**Depends on**: Phase 21
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-07, CHAT-08, CHAT-09, CHAT-11
**Success Criteria** (what must be TRUE):
  1. The teacher starts, lists, renames and deletes conversations, and replies stream onto the screen as they are generated.
  2. Typing `@` lists students, and after a mention the quick actions "was", "didn't happen", "no-show" and "moved to <date>" mark or move that student's lesson.
  3. Lesson marks, comments and notes written in chat apply at once with an "Undo" button, and an open Schedule or Today screen updates without a reload.
  4. Questions about a student (what was covered, weak points, next lesson ideas) are answered from stored data, and any balance, count or "pays soon" list in an answer matches the numbers on the Today and Students screens.
  5. Token usage is recorded per conversation, and once the monthly cap is reached chat stops calling the model and says why.

**Plans**: TBD
**UI hint**: yes
**Notes**: Model `claude-haiku-5-5`. The transport choice (Vercel AI SDK with `@ai-sdk/anthropic` or `@anthropic-ai/sdk`) is settled by a spike covering a write-tool call, a pause for confirmation and resuming after a page reload.

### Phase 23: Confirmed Chat Changes and Entry Points

**Goal**: Money, new students, deletions and bulk moves can be done from chat after an explicit confirmation, and chat, payments and students are one step away from anywhere, including a phone.
**Depends on**: Phase 22
**Requirements**: CHAT-05, CHAT-06, CHAT-10, CHAT-12, SHELL-03, SHELL-04, CARD-05
**Success Criteria** (what must be TRUE):
  1. A payment, a new student, a deletion or a rate change written in chat shows the proposed change and applies only after the teacher confirms; declining leaves the data unchanged.
  2. "@annie move all lessons from Tuesday 12:00 to Wednesday 14:00 MSK" proposes the series move in MSK and applies it after confirmation; without a named zone the times are read as Vietnam time.
  3. A change made in chat can be opened and corrected in the regular forms and dialogs, and both paths give the same balance and schedule.
  4. A pasted essay gets feedback labeled as an approximate estimate.
  5. The palette finds students and offers "New chat" and "Add payment"; a student profile shows payments, lessons and "Ask in chat"; Today, Schedule and Chat are usable at phone width.

**Plans**: TBD
**UI hint**: yes

### Phase 24: Google Calendar Connection and Outbound Sync

**Goal**: Lessons, series and occurrence exceptions from the schedule appear in the teacher's Google Calendar exactly once, written by one queued writer over a server-side connection.
**Depends on**: Phase 20 (lesson, series and exception model); runs after Phase 23 by priority
**Requirements**: GCAL-01, GCAL-02, GCAL-03, GCAL-09, GCAL-10
**Success Criteria** (what must be TRUE):
  1. The teacher connects Google Calendar through Google consent handled by the server; the refresh token is stored encrypted and never reaches the browser, and with the Google OAuth app in production status the connection still works 8 days later without reconnecting.
  2. Creating, moving or cancelling a single lesson, a series or one occurrence leaves exactly one matching event in Google (a series is one recurring event with its exceptions), and retries or an API restart in the middle of a write never create a second event.
  3. Every write to Google goes through the queue with one writer per lesson, so two quick edits of the same lesson end as the last edit in Google.
  4. When authorization expires or is revoked, the connection screen says so and offers reconnect, and queued writes continue after reconnecting.
  5. The conflict check when planning a lesson or a series lists overlapping calendar events across the whole range, including those beyond the first page of results.

**Plans**: TBD
**UI hint**: yes
**Notes**: Built on AUD-CAL-1..10 in `.planning/research/CODE-AUDIT.md`: event id derived from the lesson, series or exception id in Google's id alphabet, one writer per lesson through `pg-boss`, event time zone taken from the lesson, not from the server.

### Phase 25: Google Calendar Two-Way Sync

**Goal**: Changes the teacher makes in Google reach the schedule on their own, without duplicates, and Google wins when both sides changed.
**Depends on**: Phase 24
**Requirements**: GCAL-04, GCAL-05, GCAL-06, GCAL-07, GCAL-08
**Success Criteria** (what must be TRUE):
  1. An event moved, edited or deleted in Google shows up in the schedule shortly after through push notifications and incremental sync, with no app page open; a `410` from Google leads to a full resync that leaves no duplicate lessons.
  2. Moving one occurrence in Google moves exactly that occurrence in the schedule, and moving the whole series in Google moves the series.
  3. Events created by the app map back to their lessons by id; other events whose title matches a student's short name become lessons; unmatched events are listed to assign or ignore; all other events only count as busy time.
  4. When the same lesson changed in the app and in Google, the Google version is what remains after sync.
  5. Watch channels are renewed before they expire, and a change made while notifications were not delivered (for example while the API was stopped) appears after the nightly reconcile.

**Plans**: TBD
**UI hint**: yes

### Phase 26: IELTS Section

**Goal**: ielts runs as the `/ielts` section of dv-lab on the new server with its existing data, and the old Vercel and Neon deployment can be switched off.
**Depends on**: Phase 19 (student accounts linked to cards); runs last by priority
**Requirements**: IELTS-01, IELTS-02, IELTS-03, IELTS-04, IELTS-05, IELTS-06
**Success Criteria** (what must be TRUE):
  1. A signed-in student lands on `/ielts` and cannot open any other section.
  2. The teacher manages tasks, sections, mock tests and media under `/ielts`, and uploaded files are stored on the server disk and play for students.
  3. Rooms with a timer, attempts and automatic checking behave as in ielts today, including the phase 6.2 behavior, and the teacher reviews and grades student essays.
  4. Existing ielts accounts, rooms, attempts, grades and media are on the new server with matching counts, and the Vercel and Neon deployment is switched off only after the teacher confirms.
  5. IELTS screens use the variant A look in light and dark themes.

**Plans**: TBD
**UI hint**: yes
**Notes**: ielts code is ported as is. A rollout is not started while an ielts room has active students.

## Progress

**Execution Order:**
Phases execute in numeric order: 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 17. Skeleton on the Server | v2.0 | 13/13 | In Progress|  |
| 18. Accounts and Variant A Shell | v2.0 | 16/16 | In Progress|  |
| 19. Student Cards and Vault Import | v2.0 | 16/20 | In Progress|  |
| 20. Schedule | v2.0 | 0/TBD | Not started | - |
| 21. Lesson Accounting and Today | v2.0 | 0/TBD | Not started | - |
| 22. Chat with Mentions and Quick Marks | v2.0 | 0/TBD | Not started | - |
| 23. Confirmed Chat Changes and Entry Points | v2.0 | 0/TBD | Not started | - |
| 24. Google Calendar Connection and Outbound Sync | v2.0 | 0/TBD | Not started | - |
| 25. Google Calendar Two-Way Sync | v2.0 | 0/TBD | Not started | - |
| 26. IELTS Section | v2.0 | 0/TBD | Not started | - |
