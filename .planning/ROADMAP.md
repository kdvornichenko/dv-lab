# Roadmap: dv-lab

## Milestones

- **v1.0 Teacher CRM Foundation** and **v1.1 Audit Remediation** - Phases 1-16, shipped 2026-05-03, archived in `.planning/milestones/v1.1-ROADMAP.md`
- **v2.0 Unified dv-lab** - Phases 17-26, in progress

## Overview

v2.0 replaces the Supabase-era CRM with a new workspace on the own VPS. The order follows the owner's priority: server and empty skeleton, sign-in ported from ielts, the variant A shell, student cards with the vault import, the schedule and lesson accounting, chat, Google Calendar, and IELTS last. The manual schedule comes before chat because chat marks and moves lessons; Google Calendar comes after chat and builds on the same lesson, series and exception model. Each phase is a vertical slice merged into `master` through a pull request from a `gsd/*` branch after green CI, then deployed by the owner. Old dv-lab code is rewritten from scratch; ielts code is ported as is. Calendar phases follow `.planning/research/CODE-AUDIT.md`.

## Phases

### v2.0 Unified dv-lab (In Progress)

**Execution order (owner decision 2026-10-11):** 21 -> 21.1 -> 24 -> 25.1 -> 22 -> 23 -> 26. Phase 21.1 makes the default time zone configurable before Google Calendar. Google Calendar is the source of truth, so the Google phases run before chat and the schedule is checked by hand only after Google sync is ready; existing phase numbers stay as they are. Phase 21 merged through PR #7 after green CI. Implementation of 21.1 and then the prepared Phase 24 is authorized; Phase 21.1 is verified and merged in PR #8 after green CI (c1ddae4).

**Status 2026-10-12:** 17-21.1 are released; 24 has plan 24-14 (live Google check) open; 25 is being reworked into 25.1; 22, 23 and 26 are planned and not started.

**Phase Numbering:**

- Integer phases (17, 18, 19): planned v2.0 work, continuing from v1.1 (last phase 16)
- Decimal phases (17.1, 17.2): urgent insertions (marked with INSERTED)

- [x] **Phase 17: Skeleton on the Server** - Clean monorepo on the latest stack, CI on PostgreSQL 18, images in GHCR, HTTPS and backups on the VPS (released; human acceptance deferred)
- [x] **Phase 18: Accounts and Variant A Shell** - Teacher and student sign-in ported from ielts, inside the variant A shell (released; human acceptance deferred)
- [x] **Phase 19: Student Cards and Vault Import** - Cards with sections, vocabulary and payments; all 25 vault students imported (released; human acceptance deferred)
- [x] **Phase 20: Schedule** - Week grid with single lessons, weekly series and occurrence exceptions (merged in PR 6)
- [x] **Phase 21: Lesson Accounting and Today** - Lesson marks deduct minutes by shared core rules; Today and "pays soon" from real data (completed 2026-10-11)
- [x] **Phase 21.1: Default Time Zone** - Account setting, per-lesson and per-series zones, consistent display and accounting dates (completed 2026-10-11)
- [x] **Phase 22: Chat with Mentions and Quick Marks** - Conversations, `@student` mentions, instant marks with undo, answers from data, budget cap
- [x] **Phase 23: Confirmed Chat Changes and Entry Points** - Payments, new students, deletions and bulk moves after confirmation; palette, profile and phone layouts
- [ ] **Phase 24: Google Calendar Connection and Outbound Sync** - Server-side OAuth, deterministic event ids, one queued writer, paginated conflict check (13 of 14 plans; live provider check pending)
- [~] **Phase 25: Google Calendar Two-Way Sync** - Superseded by 25.1 (documents archived in `.planning/archive/phase-25-superseded`)
- [x] **Phase 25.1: Google Calendar Core** - Any event created, moved, resized, edited and deleted in the app; push and incremental sync rewritten as one task per connection; calendar choice; Google wins
- [ ] **Phase 25.2: Polish before IELTS** - Dialog kinds, Firefox fade, chat fixes, notes/vocabulary/review from chat, card edits from chat, Students table, student profile tabs, installable PWA with push
- [ ] **Phase 25.3: Chat Command Builder** - Commands stored in the database and edited in Settings, `/edvibe` (waits for the owner's Edvibe template examples)
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

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 17-02-PLAN.md — Web placeholder on Next 16.4 standalone, web/api boundary (W2)
- [x] 17-03-PLAN.md — `packages/db` on Drizzle v1: DB role module, first migration, role tests on PostgreSQL (W2)
- [x] 17-04-PLAN.md — API request context: request id, JSON access log, error envelope (W2)

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 17-05-PLAN.md — Migrations as a separate step (`dist/migrate.mjs`), applied to dev and test DBs [BLOCKING] (W3)
- [x] 17-06-PLAN.md — Server stack: compose, Caddyfile, idempotent `ensure-db.sql` (W3)

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 17-07-PLAN.md — API process: config, lifecycle owner, `/healthz`, SIGTERM shutdown (W4)
- [x] 17-08-PLAN.md — `deploy.sh` with migration rehearsal and rollback, nightly backup with 14+8 retention, restore check (W4)

**Wave 5** _(blocked on Wave 4 completion)_

- [x] 17-09-PLAN.md — `/ws` echo with Origin check, shutdown with open WebSockets (W5)
- [x] 17-11-PLAN.md — `RUNBOOK.md` and VPS preparation by the owner (W5)

**Wave 6** _(blocked on Wave 5 completion)_

- [x] 17-10-PLAN.md — CI on PostgreSQL 18, Dockerfiles, GHCR images, knip, agent docs (W6)

**Wave 7** _(blocked on Wave 6 completion)_

- [x] 17-12-PLAN.md — PR green, merge, images published to GHCR (owner) (W7)

**Wave 8** _(blocked on Wave 7 completion)_

- [x] 17-13-PLAN.md — DNS cutover, first deploy, backups and restore, outside checks (owner) (W8)

**Notes**: The operator is Server guy (VPS access by key; DNS through the owner's personal Vercel CLI) or the owner. Steps that print a password or require a token (RUNBOOK 10.3, 10.5, 4.2) are performed by the owner. Traps and the bio-exam reference setup are in `~/.claude/servers/dv-lab.md`.

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

**Plans**: 20/20 plans executed

Plans:
**Wave 1**

- [x] 19-01-PLAN.md — All phase dependencies in one install: `packages/core` skeleton, pinned react-markdown, remark-gfm, react-day-picker (W1)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 19-02-PLAN.md — `packages/db` owns `DbExecutor` and Postgres error parsing; four copies moved (W2)
- [x] 19-03-PLAN.md — Contracts: name predicate, currencies, section kinds, request schemas, 409 codes (W2)
- [x] 19-04-PLAN.md — `packages/core` money, lessons and balance functions; knip and CI boundary (W2)
- [x] 19-05-PLAN.md — Schema for cards, sections, terms, payments, account link; migration applied [BLOCKING] (W2)
- [x] 19-06-PLAN.md — Variant A Select, Combobox, Textarea, DateField copies, MarkdownView (DR-1), StatusDot (W2)

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 19-07-PLAN.md — Cards module and `/students` routes, opening balance, account and card names split (W3)
- [x] 19-08-PLAN.md — `import-vault parse`: packet from the vault, ignore masks (W3)

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 19-09-PLAN.md — Sections and vocabulary in the cards module and routes (W4)
- [x] 19-10-PLAN.md — Payments: record, delete, unassigned, assign (W4)
- [x] 19-11-PLAN.md — Students screen: card list and New student dialog (W4)

**Wave 5** _(blocked on Wave 4 completion)_

- [x] 19-12-PLAN.md — Account link to a card: create from card, link existing, deactivate (W5)
- [x] 19-13-PLAN.md — `import-vault apply` through the cards module, run on `dvlab_dev` (W5)
- [x] 19-14-PLAN.md — Profile: header, Overview, archive and restore, opening balance (W5)

**Wave 6** _(blocked on Wave 5 completion)_

- [x] 19-15-PLAN.md — `import` compose service and RUNBOOK section 11 (W6)
- [x] 19-16-PLAN.md — Payments UI: Record payment, Payments tab, Unassigned payments and Assign (W6)

**Wave 7** _(blocked on Wave 6 completion)_

- [x] 19-17-PLAN.md — Notes and Vocabulary tabs (W7)

**Wave 8** _(blocked on Wave 7 completion)_

- [x] 19-18-PLAN.md — Account panel: create, link, deactivate from the card (W8)

**Wave 9** _(blocked on Wave 8 completion)_

- [x] 19-20-PLAN.md — Form fields: one look, one error line, Combobox empty state and time zone offsets, per the Design session (W9)

**Wave 10** _(blocked on Wave 9 completion)_

- [x] 19-19-PLAN.md — Final verification: AGENTS.md, full checks, privacy, six criteria by hand (W10)

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

**Plans**: 10/10 plans executed

Plans:
**Wave 1**

- [x] 20-01-PLAN.md — Schema for series, exceptions and single lessons, `yarn install`, migration applied [BLOCKING] (W1)
- [x] 20-02-PLAN.md — `packages/core` zones and the one occurrence rule, schedule contracts and `lesson_changed` (W1)
- [x] 20-03-PLAN.md — Web base: fade and gcal tokens, page and table fades, DateField `min`, EmptyLine text, TimePicker copy (W1)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 20-04-PLAN.md — API week read and lesson creation, one rows loader, `nextLessonAt` through the card facts owner (W2)
- [x] 20-05-PLAN.md — Schedule frame per the design artifact v23: WeekGrid, ScheduleToolbar with the second-zone selector, today and now line, shared time-zones module (W2)

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 20-06-PLAN.md — API changes: occurrence and single move, cancel, restore; series cut and end without deletes (W3)
- [x] 20-07-PLAN.md — Lesson blocks in `selected`, EventTooltip, LessonDialog view, NewLessonDialog (W3)

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 20-08-PLAN.md — LessonDialog actions through one mutate helper: Cancel lesson, Return to schedule, inline move form, Whole series with MoveSeriesDialog and EndSeriesDialog (W4)

**Wave 5** _(blocked on Wave 4 completion)_

- [x] 20-09-PLAN.md — Students list: search, controlled tabs, Next lesson column; student form on the shared time-zones module (W5)

**Wave 6** _(blocked on Wave 5 completion)_

- [x] 20-10-PLAN.md — Final verification: AGENTS.md, full checks, privacy, five criteria by hand (W6)

**UI hint**: yes

### Phase 21: Lesson Accounting and Today

**Goal**: Marking lessons keeps every student's remaining lessons right through one set of rules in `packages/core`, and Today shows who studies and who pays soon.
**Depends on**: Phase 20
**Requirements**: LEDG-03, LEDG-04, LEDG-05, LEDG-06, LEDG-07, LEDG-08, SHELL-05
**Success Criteria** (what must be TRUE):

1. Marking a 60-minute lesson done takes 1 lesson from the balance, and a 90-minute lesson takes 1.5.
2. A no-show deducts the lesson duration unless the teacher turned that off for the student. A cancelled lesson, move ghost or unmarked move deducts nothing; under D-17, a moved marked lesson keeps its mark and deducts by its new date.
3. Correcting any mark (for example done to cancelled) recomputes the balance at once on every screen that shows it.
4. The "pays soon" list shows students with at most N lessons left or none, N is a setting with default 2, and Today shows counters, today's lessons and this list from real data.
5. The students list, the profile, Today and "pays soon" show the same balance because they call the same `packages/core` functions. Existing checks and durable E2E cover those rules; the accepted policy adds no unit or integration suites.

**Plans**: 18/18 plans complete

**Verification:** passed, 37/37 active truths. The owner accepted real VN midnight and final Earlier panel removal as deferred manual verification after Phase 25. They remain unverified; see `21-VERIFICATION.md` and `21-VERIFICATION-EVIDENCE.md`.

Plans:

**Wave 1**

- [x] 21-01-PLAN.md — Schema: `lesson_marks`, `teacher_settings`, `students.no_show_deducts`, revoke migration, `yarn install`, migrations applied [BLOCKING] (W1)
- [x] 21-02-PLAN.md — `packages/core`: one Vietnam "today", balance rule from raw rows, lesson outcome and actions, needs-mark rule, threshold and balance words, `ledger-core.mjs` (W1)
- [x] 21-03-PLAN.md — UI-A1: phase 20 design fixes 4 (tooltip), 5, 6, 7, 11 per design v36 (gutter, toolbar, short blocks, week summary, tooltip tokens) (W1)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 21-04-PLAN.md — API marks: `POST …/mark`, week with outcome and actions, cancel and restore of started lessons, marks survive series cuts, concurrent requests (W2)
- [x] 21-05-PLAN.md — API settings: Pays soon threshold on the teacher account, `GET/PATCH /settings` (W2)
- [x] 21-14-PLAN.md — UI-A2: phase 20 design fixes 1-3, 4 (dialogs), 8-10 per design v36 (series texts, First lesson and Start time caption, move form, fields, fades) (W2)

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 21-06-PLAN.md — UI-B: phase 20 design fixes 12-18 (zone labels, TimeZonePicker with favorites, Settings General, drag to create) (W3)
- [x] 21-07-PLAN.md — API: balance by marks through core, no-show flag, `GET /today` (W3)

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 21-17-PLAN.md — Move of any lesson allowed like in Google Calendar (D-17), v38 toasts (W4)

**Wave 5** _(blocked on Wave 4 completion)_

- [x] 21-08-PLAN.md — UI-C schedule: Mark row in LessonDialog, signs on blocks, tooltip deduction (W5)

**Wave 6** _(blocked on Wave 5 completion)_

- [x] 21-15-PLAN.md — Web on lesson outcome: overlaps and week summary by outcome, Vietnam dates from core, no block status reads (W6)

**Wave 7** _(blocked on Wave 6 completion)_

- [x] 21-09-PLAN.md — UI-C students and settings: balance and debt words with status dots, no-show switch, Payments card (W7)
- [x] 21-16-PLAN.md — API and contract: block status and changeable flag removed, reload-tabs rollout (W7)

**Wave 8** _(blocked on Wave 7 completion)_

- [x] 21-10-PLAN.md — UI-C Today: header, four counters, Lessons today, Earlier not marked, Pays soon (W8)

**Wave 9** _(blocked on Wave 8 completion)_

- [x] 21-11-PLAN.md — UI-C Today actions: quick Done and No-show, shared lesson dialog host, isolated Add payment with a Student field (W9)

**Wave 10** _(blocked on Wave 9 completion)_

- [x] 21-12-PLAN.md — Docs: RUNBOOK operator line, AGENTS.md owners, release notes for Server guy (W10)

**Wave 11** _(blocked on Wave 10 completion)_

- [x] 21-13-PLAN.md — Final verification: full checks, privacy, AGENTS.md against code, all acceptance scripts, five criteria by hand (W11)

**Wave 12** _(blocked on Wave 11 completion)_

- [x] 21-18-PLAN.md — e2e: Playwright suite for marks, no-show flag, move of a started lesson, Today (W12)

**UI hint**: yes

### Phase 21.1: Default Time Zone (INSERTED)

**Goal:** The teacher chooses the default time zone in Settings. Existing lessons keep their instants and creation zones, new lessons use the setting, and schedule, Today and accounting use the selected display and day boundaries consistently.
**Requirements**: TZ-01, TZ-02, TZ-03, TZ-04, TZ-05
**Depends on:** Phase 21
**Success Criteria**:

1. The setting defaults to `Asia/Ho_Chi_Minh`, persists on the teacher account after confirmation, and survives reload. Cancel and failed save keep the saved value. Students cannot read or change teacher settings.
2. Each lesson and series stores its creation zone. Existing rows retain Vietnam time and all existing instants and occurrence identities. New rows use the current setting. Changing the setting never rewrites a series rule or shifts a lesson.
3. Schedule, Today, next lesson, lesson dialogs and time labels use the default zone. A different creation zone appears in lesson/series details. Recurrences preserve wall time in their stored zone across daylight saving changes.
4. Today and lesson dates used at the opening-balance boundary use the account zone. A near-midnight lesson can change accounting day after a zone change; forms and API agree. Payment date-only values remain dates.
5. The second zone remains a browser preference and differs from the default. Choosing the second zone as default makes the old default second, only after a successful save. Settings and the schedule toolbar stay synchronized.
   **Plans:** 13/13 plans complete, 9 waves; independently verified
   **UI hint:** yes
   **Design:** Accepted default-zone design introduced in v37; current local copy v40, `SettingsGeneral`, `ZoneChangeDialog`, `TimePair`, `WeekGrid`, `LessonDialog`, `TimeZonePicker`. The old “after 23” note in the design is superseded by this execution order.

Plans:
**Wave 1**

- [x] 21.1-01-PLAN.md — Аддитивное хранение зон и восстановление состояния проверок

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 21.1-02-PLAN.md — Поведенческий контракт зон в существующих durable E2E

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 21.1-03-PLAN.md — Account settings, optimistic guard и общий read snapshot
- [x] 21.1-04-PLAN.md — Единый pure owner зон, recurrence windows и cut/end

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 21.1-05-PLAN.md — Schedule API: immutable creation zone, coherent read и date-sensitive writes

**Wave 5** _(blocked on Wave 4 completion)_

- [x] 21.1-06-PLAN.md — Series mutations: cross-zone граница и сохранение отмеченного хвоста
- [x] 21.1-08-PLAN.md — Settings UI и единый browser second-zone store

**Wave 6** _(blocked on Wave 5 completion)_

- [x] 21.1-07-PLAN.md — Today, карточки и ledger используют один account day
- [x] 21.1-09-PLAN.md — Schedule display и lesson details в authoritative main zone

**Wave 7** _(blocked on Wave 6 completion)_

- [x] 21.1-10-PLAN.md — Создание и перенос уроков из main zone, DST helpers и stale forms
- [x] 21.1-12-PLAN.md — Адаптация существующих проверок к явной зоне

**Wave 8** _(blocked on Wave 7 completion)_

- [x] 21.1-11-PLAN.md — Today, Students и формы ledger в account zone

**Wave 9** _(blocked on Wave 8 completion)_

- [x] 21.1-13-PLAN.md — Единственный final gate: quality, regression и public E2E

### Phase 22: Chat with Mentions and Quick Marks

**Goal**: The teacher records lesson outcomes by writing one line in chat and gets answers about any student from stored data, within the monthly budget.
**Depends on**: Phase 25.1 (runs after the Google phases by owner decision 2026-10-11; Phase 25 is superseded by Phase 25.1); Phase 21
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-07, CHAT-08, CHAT-09, CHAT-11
**Success Criteria** (what must be TRUE):

1. The teacher starts, lists, renames and deletes conversations, and replies stream onto the screen as they are generated.
2. Typing `@` lists students, and after a mention the quick actions "was", "didn't happen", "no-show" and "moved to <date>" mark or move that student's lesson.
3. Lesson marks, comments and notes written in chat apply at once with an "Undo" button, and an open Schedule or Today screen updates without a reload.
4. Questions about a student (what was covered, weak points, next lesson ideas) are answered from stored data, and any balance, count or "pays soon" list in an answer matches the numbers on the Today and Students screens.
5. Token usage is recorded per conversation, and once the monthly cap is reached chat stops calling the model and says why.

**Plans**: 18/18 plans executed / 64 tasks / 17 waves; planned 2026-10-13 against the Phase 25.1 code and the owner answers of 2026-10-13 (decisions in 22-CONTEXT); review squad pending
- [x] 22-01-PLAN.md
- [x] 22-02-PLAN.md
- [x] 22-03-PLAN.md
- [x] 22-04-PLAN.md
- [x] 22-05-PLAN.md
- [x] 22-06-PLAN.md
- [x] 22-07-PLAN.md
- [x] 22-08-PLAN.md
- [x] 22-09-PLAN.md
- [x] 22-10-PLAN.md
- [x] 22-11-PLAN.md
- [x] 22-12-PLAN.md
- [x] 22-13-PLAN.md
- [x] 22-14-PLAN.md
- [x] 22-15-PLAN.md
- [x] 22-16-PLAN.md
- [x] 22-17-PLAN.md
- [x] 22-18-PLAN.md

Plan graph and ownership: [.planning/phases/22-chat-with-mentions-and-quick-marks/22-PLAN-INDEX.md](.planning/phases/22-chat-with-mentions-and-quick-marks/22-PLAN-INDEX.md)
**UI hint**: yes
**Notes**: Model `claude-haiku-5-5`. Owner decision 2026-10-10: use the official Anthropic SDK (`@anthropic-ai/sdk`) with a server-side API key from the Console organization already linked to the Claude plan API credits (https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers); the key lives only on the server (env var, never in the browser or the repository). Vercel AI SDK is dropped unless the spike shows a need. Reference implementation reviewed: github.com/ThariqS/ai-newtab (Claude Managed Agents, beta `managed-agents-2026-04-01`). The spike compares two transports on the same three checks (write-tool call, pause for confirmation, resume after page reload), plus per-conversation token usage and where the student data is stored: (a) Messages API with tool use and our own conversation store; (b) Managed Agents session as in ai-newtab. Lessons from ai-newtab to apply either way: every tool call must always get a result (errors become `is_error` results); open the event stream before sending and dedupe replayed events; idle is not done (stop only on `end_turn`/terminated, not `requires_action`); cache agent and environment IDs and fingerprint the agent definition; keep dangerous built-in tools (bash) off; treat stored student text as untrusted input to the model; delete server-side sessions and files when done. Owner request 2026-10-10: the teacher can choose the chat model (Haiku may not cope with some questions) and the effort level, like the Claude app composer (model menu with a Default mark, effort slider from faster to smarter). The default is a teacher setting in `teacher_settings` and the choice can be overridden per conversation; the list and order of models, their prices, the per-request input and output limits and the monthly cap are teacher settings with defaults (owner decision 2026-10-13), not constants; token usage is recorded per conversation together with the model and effort. Effort is `output_config.effort` (`low`, `medium`, `high`, `xhigh`, `max`; GA, no beta header) on Haiku 5.5, Sonnet 5.5, Opus 5.5 and Fable 5.1; per-message change keeps the prompt cache and needs the beta header `mid-conversation-output-config-2026-07-01`; on Haiku 5.5 `low` skips checks in long tool prompts. Support under Managed Agents is checked in the spike. The API does not expose the remaining credit balance (only Console, Settings > Billing; the Usage & Cost Admin API needs a separate admin key and shows spend with a few minutes lag), so the monthly cap is our own: spend from response `usage` per conversation, the remaining amount shown as an estimate, and the "credit balance too low" API error maps to the "Monthly budget reached" state. Design: artifact v39 (copy in `~/dv-lab-design`): `ChatModelControls` (composer chips, model menu, effort popover with five levels, unavailable model and budget states), Settings > Assistant "Chat model" card; open for the owner: level names and the "Recommended" mark, model order from teacher settings, optional relative cost like "x3". Credits do not roll over and exhausting them stops API requests; the in-app monthly cap (criterion 5) stays below the credit amount.

### Phase 23: Confirmed Chat Changes and Entry Points

**Goal**: Money, new students, deletions and bulk moves can be done from chat after an explicit confirmation, and chat, payments and students are one step away from anywhere, including a phone.
**Depends on**: Phase 22
**Requirements**: CHAT-05, CHAT-06, CHAT-10, CHAT-12, SHELL-03, SHELL-04, CARD-05
**Success Criteria** (what must be TRUE):

1. A payment, a new student, a deletion or a rate change written in chat shows the proposed change and applies only after the teacher confirms; declining leaves the data unchanged.
2. "@Alex Example move all lessons from Tuesday 12:00 to Wednesday 14:00 MSK" proposes the series move in MSK and applies it after confirmation; without a named zone the times are read as Vietnam time.
3. A change made in chat can be opened and corrected in the regular forms and dialogs, and both paths give the same balance and schedule.
4. A pasted essay gets feedback labeled as an approximate estimate.
5. The palette finds students and offers "New chat" and "Add payment"; a student profile shows payments, lessons and "Ask in chat"; Today, Schedule and Chat are usable at phone width.

**Plans**: 14/14 plans executed / 39 tasks / 9 waves; replanned 2026-10-14 against the Phase 22 code (decisions in 23-CONTEXT, accepted ARCH-A1..A3)

- [x] 23-01-PLAN.md — Tracer: payment proposal in chat → Record payment / Don't record
- [x] 23-02-PLAN.md — Card and payment revisions, same-row payment correction
- [x] 23-03-PLAN.md — Input time zone for series moves, separate from the teacher zone
- [x] 23-04-PLAN.md — Palette (students, New chat, Add payment) and Ask in chat
- [x] 23-05-PLAN.md — Proposals: new student, rate change, archive instead of deletion
- [x] 23-06-PLAN.md — Ordinary forms with revisions and Edit payment
- [x] 23-07-PLAN.md — Deletions: payment, note or comment, end of series; saved Keep
- [x] 23-08-PLAN.md — Lessons tab in the student profile
- [x] 23-09-PLAN.md — Bulk move of a student's lessons (CHAT-06)
- [x] 23-10-PLAN.md — Proposal blocks for all operations and result links
- [x] 23-11-PLAN.md — Essay feedback labeled as an approximate estimate (api)
- [x] 23-12-PLAN.md — Phone width: Today, Schedule, Chat, profile, palette
- [x] 23-13-PLAN.md — Bulk move and essay blocks, /essay command
- [x] 23-14-PLAN.md — Final checks and documents

Plan graph and ownership: [.planning/phases/23-confirmed-chat-changes-and-entry-points/23-PLAN-INDEX.md](.planning/phases/23-confirmed-chat-changes-and-entry-points/23-PLAN-INDEX.md)

**UI hint**: yes

### Phase 24: Google Calendar Connection and Outbound Sync

**Goal**: Google Calendar is the source of calendar events. The teacher views its events and sends confirmed commands through dv-lab; schedule features require a working Google connection, and local state never claims a save before Google confirms it.
**Depends on**: Phase 21.1 (stored creation zones and configurable account zone), Phase 21 (lesson, series and exception model, marks); runs before the chat phases
**Requirements**: GCAL-01, GCAL-02, GCAL-03, GCAL-09, GCAL-10
**Success Criteria** (what must be TRUE):

1. The teacher connects Google Calendar through Google consent handled by the server; the refresh token is stored encrypted and never reaches the browser, and with the Google OAuth app in production status the connection still works 8 days later without reconnecting.
2. The calendar reads every Google page for the selected window and shows the provider events. Creating, moving, cancelling or restoring a single lesson, series or occurrence succeeds only after Google confirms the result; retries/restarts retain one active representation and preserve local marks/history.
3. Every Google command goes through one serialized writer. Confirmed local projection follows the provider result. Concurrent edits use explicit preconditions; a delayed response never confirms a different command. Lost replies remain pending/unknown until reconciled.
4. Without a connected Google Calendar, schedule operations are blocked and Settings offers connection/reconnect. During temporary Google failure, the last known state is read-only and new offline edits are rejected. Reconnect to the same target resolves previously dispatched work before new edits.
5. The conflict check when planning a lesson or a series lists overlapping calendar events across the whole range, including those beyond the first page of results.
6. The public homepage describes the app and links to public privacy policy and terms pages. The privacy policy describes the actual use, storage and sharing of Google Calendar data. Google OAuth Branding uses these pages, and publication to Production is verified after they are deployed.

**Plans**: 13/14 plans executed / 40 tasks / 13 waves; source implementation in progress, connected provider verification pending

Plans:
**Wave 1**

- [x] 24-01-PLAN.md — Публичный tracer, privacy и точный E2E target
- [x] 24-02-PLAN.md — Google source DTO и durable command/read schema

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 24-03-PLAN.md — Разрешённые зависимости и миграции очереди/journal

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 24-04-PLAN.md — OAuth, refresh и разрешимый Disconnect

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 24-05-PLAN.md — Атомарные Google reads, next index и граница истории

**Wave 5** _(blocked on Wave 4 completion)_

- [x] 24-06-PLAN.md — C2: единые будущие факты Today и Students

**Wave 6** _(blocked on Wave 5 completion)_

- [x] 24-07-PLAN.md — Сквозная команда: prepare→Google ACK→projection

**Wave 7** _(blocked on Wave 6 completion)_

- [x] 24-08-PLAN.md — Single edits, tombstone restore и precondition recovery

**Wave 8** _(blocked on Wave 7 completion)_

- [x] 24-09-PLAN.md — Recurring masters и canonical instances

**Wave 9** _(blocked on Wave 8 completion)_

- [x] 24-10-PLAN.md — Cut/end: partial Google state и однократный domain apply

**Wave 10** _(blocked on Wave 9 completion)_

- [x] 24-12-PLAN.md — UI: Google read-only, pending Save и recovery

**Wave 11** _(blocked on Wave 10 completion)_

- [x] 24-11-PLAN.md — Полный conflict check и сохранение открытой формы

**Wave 12** _(blocked on Wave 11 completion)_

- [x] 24-13-PLAN.md — Readiness и воспроизводимая external evidence

**Wave 13** _(blocked on Wave 12 completion)_

- [ ] 24-14-PLAN.md — Публичный Production и реальный восьмой день

**UI hint**: yes
**Notes**: Owner decision 2026-10-11 supersedes the offline/local-first design. Initial connection reads Google; it does not publish the existing local schedule automatically. Ordinary window reads belong to Phase 24; watch/incremental sync and event matching remain Phase 25. Built on AUD-CAL-1..10 in `.planning/research/CODE-AUDIT.md`: event id derived from the lesson, series or exception id in Google's id alphabet, one writer per lesson through `pg-boss`, event time zone taken from the lesson, not from the server.
**OAuth setup**: Calendar API is enabled. The web client uses `https://dv-lab.dev/api/google/callback`; the server must implement this exact callback. The declared Calendar scopes are `calendar.events` and `calendar.calendarlist.readonly`. Credentials are stored outside the repository. The app remains in Testing while Branding is incomplete; public privacy policy and terms pages belong to this phase. Publication and the connection test are still pending.

### Phase 25: Google Calendar Two-Way Sync

Superseded by Phase 25.1 (owner decisions D5-D10, 2026-10-12). Its research and design analysis are archived in `.planning/archive/phase-25-superseded` and used only as provider reference.

### Phase 25.1: Google Calendar Core

**Goal**: The schedule is a two-way Google Calendar for any event: the teacher creates, moves, resizes, edits and deletes events in the app, sees Google changes without an open page, and Google wins on conflicts.
**Depends on**: Phase 24
**Requirements**: GCAL-04, GCAL-05, GCAL-06, GCAL-07, GCAL-08
**Success Criteria** (what must be TRUE):

1. An event created, moved, edited or deleted in Google appears shortly after with no page open; a `410` leads to a full resync with no duplicate lessons; a change made while notifications were not delivered appears after the nightly reconcile.
2. Moving one occurrence changes only that occurrence; moving a master changes the series; delete works for one occurrence, a series, and this and following.
3. Any event can be created, moved and resized by mouse, edited (color, description, place, repeat) and deleted in the app, and the result is what Google holds.
4. App-created events map back by id; title matches are suggested with Assign or Ignore; other events are plain events with their Google color.
5. Google wins on concurrent edits; marks and accounting of past lessons stay as they were.
6. The account can pick a calendar inside the connected Google account.
7. One sync task per connection survives restart and does not block week reads; the week version grows only when something changed.

**Plans**: 12/12 plans executed, 43 tasks, 8 waves. Research, UI contract (design v53), plan check, squad review and the owner's plan review are done; execution has not started.
- [x] 25.1-01-PLAN.md
- [x] 25.1-02-PLAN.md
- [x] 25.1-03-PLAN.md
- [x] 25.1-04-PLAN.md
- [x] 25.1-05-PLAN.md
- [x] 25.1-06-PLAN.md
- [x] 25.1-07-PLAN.md
- [x] 25.1-08-PLAN.md
- [x] 25.1-09-PLAN.md
- [x] 25.1-10-PLAN.md
- [x] 25.1-11-PLAN.md
- [x] 25.1-12-PLAN.md

**UI hint**: yes

### Phase 25.2: Polish before IELTS

**Goal**: The built product is polished to the closed design (v96-v101): consistent dialogs, working fade in Firefox, a cleaner chat, notes, vocabulary and card edits from chat, a sortable and filterable Students table, a useful student profile, and an installable PWA with push reminders.
**Depends on**: Phase 23; Phase 25.1
**Requirements**: none new (polish of built requirements)
**Success Criteria** (what must be TRUE):

1. Every dialog follows one of two kinds (asking without corner X, showing with corner X and no footer Close).
2. Scroll fades work in Firefox; long titles never widen dialogs.
3. Chat has no ready-answer suggestions, edits Details, notes and vocabulary by the owner's rules, and searches the calendar by title and dates.
4. Students shows the four-column table with sorting, filters in the URL and the payment ring; the profile has Overview, Lessons (date range, outcomes, totals) and Payments (Opening balance).
5. The app installs as a PWA and sends "lesson soon" and "student about to pay" pushes.

**Plans**: 18 plans, 50 tasks, 10 waves; execution pending. See [25.2-PLAN-INDEX.md](phases/25.2-polish/25.2-PLAN-INDEX.md).
- [ ] 25.2-01-PLAN.md — dependencies, Firefox for checks, schema M1-M9
- [ ] 25.2-02-PLAN.md — dialog kinds, Firefox fade, long titles, chat small fixes
- [ ] 25.2-03-PLAN.md — core: chronological ledger (ARCH-A1), short balance, title matching
- [ ] 25.2-04-PLAN.md — note blocks with revision (ARCH-A2), vocabulary Removed, recent comments
- [ ] 25.2-05-PLAN.md — ledger loader, Last payment, Lessons route, since_payment, follow-up
- [ ] 25.2-06-PLAN.md — Students table: columns, palette, sort and filters in URL, ring
- [ ] 25.2-07-PLAN.md — chat tool registry (ARCH-A3)
- [ ] 25.2-08-PLAN.md — profile: Lessons tab, Overview, Opening balance in Payments
- [ ] 25.2-09-PLAN.md — Details from chat, calendar search, /recap and /essay prompts in the database
- [ ] 25.2-10-PLAN.md — Notes blocks and Vocabulary Removed (web)
- [ ] 25.2-11-PLAN.md — notes and vocabulary from chat by the diff rule
- [ ] 25.2-12-PLAN.md — chat facts v94, follow-up, ChangeCardDetails, Settings prompts and privacy
- [ ] 25.2-13-PLAN.md — notes review: turn mode, one transaction, review offer
- [ ] 25.2-14-PLAN.md — ChatNoteChange, empty chat, long essay (web)
- [ ] 25.2-15-PLAN.md — push: VAPID, subscriptions, presence, scheduler, delivery
- [ ] 25.2-16-PLAN.md — ChatReview, Review now (web)
- [ ] 25.2-17-PLAN.md — PWA: manifest, service worker, notification settings, presence
- [ ] 25.2-18-PLAN.md — docs, build, knip, full check pass
**UI hint**: yes
**Notes**: `/edvibe` and the command builder are Phase 25.3 and wait for the owner's template examples.

### Phase 25.3: Chat Command Builder

**Goal**: The owner creates chat commands in Settings with their own prompt and tool set; `/edvibe` produces copy blocks in Edvibe format. The prompt text of built-in `/recap` and `/essay` already moves to the database in Phase 25.2.
**Depends on**: Phase 25.2
**Plans**: not planned; waits for the owner's list of Edvibe templates with examples
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

**Plans**: 40 plans,112 tasks,35 waves; independently checked full scope; execution pending final24/25/22/23 source joins and migration/operator gates. See [26-PLAN-INDEX.md](phases/26-ielts-section/26-PLAN-INDEX.md).
**UI hint**: yes
**Notes**: ielts code is ported as is. A rollout is not started while an ielts room has active students.

## Backlog

- **Base time zone as a setting**: promoted to Phase 21.1; requirements and accepted behavior are recorded there.
- **Move form info line (design v40, optional)**: under the preview row of `LessonMoveForm` a caption for a marked lesson: "The mark stays: Done, deducts 1 lesson at the new time." (No-show with the flag off: "The mark stays: No-show, deducts nothing."; on or before the opening balance date: "The mark stays but is not counted: the new date is on or before the opening balance date (5 Oct)."). Not part of Phase 21 plans; add as a small plan after 21-08 or with the Google phases.

## Progress

**Execution Order:**
17 → 18 → 19 → 20 → 21 → 21.1 → 24 → 25 → 22 → 23 → 26

| Phase                                            | Milestone | Plans Complete | Status      | Completed  |
| ------------------------------------------------ | --------- | -------------- | ----------- | ---------- |
| 17. Skeleton on the Server                       | v2.0      | 13/13          | In Progress |            |
| 18. Accounts and Variant A Shell                 | v2.0      | 16/16          | In Progress |            |
| 19. Student Cards and Vault Import               | v2.0      | 20/20          | In Progress |            |
| 20. Schedule                                     | v2.0      | 10/10          | In Progress |            |
| 21. Lesson Accounting and Today                  | v2.0      | 18/18          | Complete    | 2026-10-11 |
| 21.1. Default Time Zone                          | v2.0      | 13/13          | Complete    | 2026-10-11 |
| 22. Chat with Mentions and Quick Marks           | v2.0      | 18/18          | Complete    | 2026-10-14 |
| 23. Confirmed Chat Changes and Entry Points      | v2.0      | 14/14          | Complete    | 2026-10-14 |
| 24. Google Calendar Connection and Outbound Sync | v2.0      | 13/14          | In Progress | -          |
| 25. Google Calendar Two-Way Sync                 | v2.0      | 0/12           | Planned     | -          |
| 25.2. Polish before IELTS                        | v2.0      | 0/18           | Planned     | -          |
| 25.3. Chat Command Builder                       | v2.0      | 0/0            | Not planned | -          |
| 26. IELTS Section                                | v2.0      | 0/40           | Planned     | -          |
