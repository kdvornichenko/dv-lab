# Requirements: dv-lab

**Defined:** 2026-10-09
**Core Value:** The teacher can always see who studies, how many lessons remain for each student, who has to pay soon and what was covered, and can record any of it by writing one line in chat.

## v2.0 Requirements

Requirements for milestone v2.0 Unified dv-lab. Each maps to a roadmap phase. The v1.x requirements are archived in `.planning/milestones/v1.1-REQUIREMENTS.md`.

### Infrastructure

- [ ] **INFRA-01**: The deployed skeleton (web, api, Postgres) answers over HTTPS on `dv-lab.dev` from the OVHcloud VPS.
- [ ] **INFRA-02**: Every pull request and every push to `master` runs CI: typecheck, lint, unit tests and database tests on PostgreSQL 18 under the same non-superuser role as the server.
- [ ] **INFRA-03**: A merge to `master` builds images in GitHub Actions and publishes them to GHCR; the server pulls and restarts them without building on the server.
- [ ] **INFRA-04**: PostgreSQL data is backed up on a schedule, and a restore from the latest backup has been exercised once.
- [ ] **INFRA-05**: All workspace dependencies are at their latest stable versions (Next 16.4, React 19.3, TypeScript, Turbo, Yarn) and build, typecheck and tests pass.
- [ ] **INFRA-06**: The API stops on `SIGTERM` within a bounded time even with open WebSocket connections.
- [ ] **INFRA-07**: The API writes structured logs with request ids, and migrations run as a separate step under the migration role.
- [ ] **INFRA-08**: The old Supabase-era `apps` and `packages` are removed; the repository contains only the new code.

### Accounts

- [ ] **ACCT-01**: The teacher signs in with email and password; the database allows only one active teacher account.
- [ ] **ACCT-02**: The teacher creates a student account (login, name, password), can deactivate it, and deactivation revokes its sessions.
- [ ] **ACCT-03**: Sessions are stored in Postgres with hashed tokens; five failed sign-ins per login and IP within 15 minutes block further attempts for 15 minutes.
- [ ] **ACCT-04**: A student account links to exactly one student card, and a card has at most one account.
- [ ] **ACCT-05**: The first teacher account is created by a bootstrap script, and the teacher can change the own password.

### Shell and Design

- [ ] **SHELL-01**: The app opens in the variant A shell with sidebar sections Today, Chat, Students, Schedule and a search field that opens the palette.
- [ ] **SHELL-02**: Every screen uses Base UI components and variant A tokens, works in light and dark theme, and all text is in English.
- [ ] **SHELL-03**: Today, Schedule and Chat are usable at phone width.
- [ ] **SHELL-04**: The palette finds students and offers "New chat" and "Add payment".
- [ ] **SHELL-05**: The Today screen shows counters, today's lessons and the "pays soon" list from real data.

### Student Cards

- [ ] **CARD-01**: The teacher creates, edits, archives and restores a student card (name, status, lesson rate and currency, default lesson length, parent, level, goals, time zone).
- [ ] **CARD-02**: A card keeps text sections (general info, interests, level, goals, typical mistakes, lesson ideas) as markdown the teacher can edit.
- [ ] **CARD-03**: A card keeps a vocabulary list of terms with notes.
- [ ] **CARD-04**: The students list has status tabs, search, and shows remaining lessons and the next lesson per student.
- [ ] **CARD-05**: The profile shows the student's payments and lessons and an "Ask in chat" action.
- [ ] **CARD-06**: All 25 vault students are imported with stable ids, their sections, vocabulary and payments; the student "Vika" is a card and "Vika" in payment notes is the teacher.
- [ ] **CARD-07**: Imported transfers that match no student appear as unassigned payments the teacher can assign to a student.

### Lessons and Payments

- [ ] **LEDG-01**: The teacher records a payment (date, amount, currency, lessons count, note) for a student; the lessons count defaults to amount divided by the student's rate and can be edited.
- [ ] **LEDG-02**: A student's balance is stored in minutes and shown in lessons with fractions.
- [ ] **LEDG-03**: Marking a lesson done deducts its actual duration: a 60-minute lesson takes 1, a 90-minute lesson takes 1.5.
- [ ] **LEDG-04**: Marking a no-show deducts the lesson duration by default, and this can be turned off per student.
- [ ] **LEDG-05**: Marking a lesson cancelled or moved deducts nothing.
- [ ] **LEDG-06**: The teacher can correct any mark and the balance recomputes.
- [ ] **LEDG-07**: The "pays soon" list shows students with at most N lessons left or none; N is a setting that defaults to 2.
- [ ] **LEDG-08**: Every balance number comes from `packages/core` functions shared by forms and chat tools.

### Schedule

- [ ] **SCHED-01**: The teacher creates single lessons and weekly series for a student.
- [ ] **SCHED-02**: The teacher moves or cancels a single occurrence without touching the rest of the series.
- [ ] **SCHED-03**: The teacher moves a whole series (new weekday and time) from the schedule.
- [ ] **SCHED-04**: The schedule shows a week grid with week navigation and displays Vietnam time by default with a second zone available.
- [ ] **SCHED-05**: Past lessons are kept intact when a series is changed or ended.

### Google Calendar

- [ ] **GCAL-01**: The teacher connects Google Calendar through a server-side OAuth flow with calendar scopes, and the refresh token is stored encrypted.
- [ ] **GCAL-02**: Each lesson, series and occurrence exception has a deterministic Google event id derived from its own id, so a retry never creates a second event.
- [ ] **GCAL-03**: Writes to Google go through a queue with a single writer per lesson.
- [ ] **GCAL-04**: Changes made in Google reach the schedule through push notifications (`events.watch`) and incremental sync with `syncToken`; a `410` response triggers a full resync.
- [ ] **GCAL-05**: Watch channels renew before they expire, and a nightly reconcile catches missed notifications.
- [ ] **GCAL-06**: Events created by the app carry the lesson id; other events whose title matches a student's short name become lessons; unmatched events are listed to assign or ignore; all other events count only as busy time.
- [ ] **GCAL-07**: When the same lesson changed in both places, the Google version wins.
- [ ] **GCAL-08**: Moving one occurrence in Google moves exactly that occurrence in the schedule, and moving a series in Google moves the series.
- [ ] **GCAL-09**: The connection screen shows expired or revoked authorization and offers reconnect.
- [ ] **GCAL-10**: The conflict check lists overlaps with calendar events beyond the first page of results.

### Chat Assistant

- [ ] **CHAT-01**: The teacher starts, lists, renames and deletes conversations.
- [ ] **CHAT-02**: Typing `@` lists students, and a mention binds the message to that student's card.
- [ ] **CHAT-03**: After a mention the teacher can use quick actions "was", "didn't happen", "no-show" and "moved to <date>" with an optional date.
- [ ] **CHAT-04**: Lesson marks, comments and notes written in chat apply at once and show an "Undo" button.
- [ ] **CHAT-05**: Payments, a new student, deletions and rate changes written in chat show the proposed change and apply only after confirmation.
- [ ] **CHAT-06**: A prompt can move all lessons of a student (for example "@annie move all lessons from Tuesday 12:00 to Wednesday 14:00 MSK"); times default to Vietnam time unless a zone is named; this bulk change needs confirmation.
- [ ] **CHAT-07**: The teacher asks about a student (what was covered, weak points, next lesson ideas) and gets answers from stored data.
- [ ] **CHAT-08**: Balances, counts and the "pays soon" list in answers are computed by code, not generated by the model.
- [ ] **CHAT-09**: Replies stream to the screen as they are generated, and the schedule updates when chat changes data.
- [ ] **CHAT-10**: The teacher pastes an essay and gets feedback labeled as an approximate estimate.
- [ ] **CHAT-11**: Token usage is recorded per conversation, and a monthly cap stops spending beyond the budget.
- [ ] **CHAT-12**: A change made in chat can be corrected through the same forms and dialogs, which call the same core functions.

### IELTS

- [ ] **IELTS-01**: A signed-in student sees only the IELTS section.
- [ ] **IELTS-02**: The teacher manages tasks, sections, mock tests and media on the new server, with files stored on disk.
- [ ] **IELTS-03**: Rooms with a timer, attempts and automatic checking work as they do in ielts today, including the phase 6.2 behavior.
- [ ] **IELTS-04**: The teacher reviews and grades student essays.
- [ ] **IELTS-05**: Existing ielts accounts, rooms, attempts, grades and media move from Neon and Blob to the new server, and the old deployment is switched off only after the teacher confirms.
- [ ] **IELTS-06**: IELTS screens use the variant A look.

## Future Requirements

Deferred, tracked but not in the current roadmap.

- **FUT-01**: Speaking feedback from audio.
- **FUT-02**: Live mirroring of the student's screen in ielts.
- **FUT-03**: Student-facing schedule and balance.
- **FUT-04**: Multi-teacher interface.
- **FUT-05**: PWA and push notifications.
- **FUT-06**: Online payments.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Migrating data from the old dv-lab database | Not in use; lessons and history are re-entered and synced with the calendar |
| Porting old dv-lab screens and services as-is | Rewritten from variant A components; old code is only a functional reference |
| Storing data in markdown or git | All data is written to Postgres directly |
| Payment-sum previews before import | Needed only while data lived in markdown |
| The vault note reader | Stays a separate site |
| Redis | `pg-boss` and `LISTEN/NOTIFY` cover queues and events on one server |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
| ----------- | ----- | ------ |

**Coverage:**

- v2.0 requirements: 66 total
- Mapped to phases: 0
- Unmapped: 66 ⚠️

---

_Requirements defined: 2026-10-09_
_Last updated: 2026-10-09 after v2.0 milestone start_
