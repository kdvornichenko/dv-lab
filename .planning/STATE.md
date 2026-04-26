# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** The teacher can always see who studies, which individual lessons are planned/completed/cancelled/rescheduled, who paid, and who owes money.
**Current focus:** Phase 7: Payments, package history, and currency-aware offer text.

## Current Position

Phase: 7 of 8 (Payments and Ledger)
Plan: 07-01
Status: Phase 6 complete; current urgent pass is individual-only lesson scheduling and calendar automation before returning to payment ledger hardening
Last activity: 2026-04-26 - Added per-student lesson duration, automatic package pricing from base price/duration, package progress tracking, and copyable completed-lesson date summaries.

Progress: [########--] 80%

## Performance Metrics

**Velocity:**

- Total plans completed: 16
- Average duration: n/a
- Total execution time: current autonomous session

**By Phase:**

| Phase | Plans | Total           | Avg/Plan |
| ----- | ----- | --------------- | -------- |
| 1     | 3/3   | current session | n/a      |
| 2     | 3/3   | current session | n/a      |
| 3     | 3/3   | current session | n/a      |
| 4     | 3/3   | current session | n/a      |
| 5     | 3/3   | current session | n/a      |
| 6     | 3/3   | current session | n/a      |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- Use Turborepo with `apps/web`, `apps/api`, and shared packages.
- Use Hono for new API; do not reuse ITS-DOC Express server directly.
- Adapt ITS-DOC `packages/rbac`, `packages/db`, and `packages/api-types` where useful.
- Keep Supabase as retained backend/auth boundary.
- Google OAuth is the login method; the authenticated Google account is also the Calendar account.
- Use Yarn 4 stable through Corepack with `nodeLinker: node-modules` for Next.js/shadcn compatibility.
- Keep Google Calendar integration in v1, but rebuild it through server-mediated OAuth and sync contracts.
- v1 payments are manual ledger tracking, not online acquiring.
- Use ITS-DOC-style Turborepo, Prettier, and web ESLint configuration.
- Use `tsup` builds with `dist` exports for shared packages and Hono API.
- Use DB-backed student services when `DATABASE_URL` or `POSTGRES_URL` is configured, with memory fallback only for local/test mode.
- Keep dev servers stopped unless explicitly needed; user wants to run visual checks manually.
- Runtime CRM data should come from Postgres; no demo CRM rows should render before API data is loaded.
- Workspace navigation uses route pages (`/lessons`, `/students`, `/payments`, `/calendar`) instead of `?view=...`.
- Student settings are opened through compact per-student route IDs derived from DB IDs to avoid UUID-looking URLs while remaining unique in the loaded student set.
- Payments now use a DB-backed service/repository when Postgres is configured, including DELETE support.
- Non-session UI persistence must go through the API/Postgres boundary. Sidebar settings now persist in `sidebar_settings`; CRM error log entries persist in `crm_error_logs`; browser storage is not used for CRM state.
- Product direction changed on 2026-04-26: v1 is individual lessons only. Group lessons are out of scope, and the visible attendance workflow is replaced by lesson status (`planned`, `completed`, `cancelled`, `rescheduled`) plus future billable/cancelled billing policy.
- Student records now split names into `firstName` and `lastName`, keep a `special` note for calendar labels, and no longer surface email/phone in the student UI.
- Lesson creation titles individual lessons as short student names (`Имя Ф.`). Calendar event titles use `Имя Ф. - special` when the student has a special note.
- Lesson creation supports weekly repeat generation up to 50 lessons. Current implementation creates separate CRM lessons/events for each occurrence.
- Lesson edit has an "apply to future weekly lessons" switch that updates future lessons for the same student/weekday/time using a heuristic series match. Dedicated series metadata is still needed for stronger long-term handling.
- Calendar sync is automatic on lesson create/update. Manual sync buttons were removed from the lesson UI; sync records remain visible as a read-only ledger.
- Lesson form now warns about overlaps with existing CRM lessons and Google Calendar free/busy intervals without blocking save.
- Student billing now stores `defaultLessonDurationMinutes` with a 60-minute default. Package totals are derived from base lesson price, lesson duration, fixed package months, and lesson count instead of being manually entered.
- Current package discounts are derived from the student's base 60-minute price: 3-month package = base minus 200 RUB, 5-month package = base minus 400 RUB. A 90-minute lesson counts as 1.5 lesson units for billing/progress calculations.
- Student profile now shows package unit progress and a copyable grouped list of completed lesson dates by month.
- Phase 6 calendar token boundary is complete: provider tokens are accepted only by the API, encrypted before DB storage, and exposed back to the app only as safe connection state.
- Phase 6 Google event upsert is implemented through server-side REST calls: calendar list uses writable calendars, lesson sync inserts or patches one event, and the sync row stores external IDs.
- Phase 6 sync status and retry are complete: Calendar page exposes retry actions and repeated sync calls reuse one sync record.
- Calendar OAuth callback now only exchanges the Supabase session and redirects back; the web app saves `session.provider_token` to the API/DB after return, matching the pre-CRM working Google token access pattern.
- For currency-aware offer text, use ExchangeRate-API open endpoint (`https://open.er-api.com/v6/latest/RUB`) as the no-key primary candidate with caching/attribution, and keep Bank of Russia official daily KZT/RUB data as a RUB/KZT fallback source.

### Pending Todos

- Phase 7: add currency selector and API-backed exchange rate conversion to lesson/package offer text generation. Example output should support RUB base prices converted to KZT with package variants, monthly totals, and rounded "pretty price" lines for Telegram copy.
- Add explicit lesson series metadata to replace the current heuristic "apply to future weekly lessons" matching.
- Replace attendance-based billing balance calculation with lesson-status/billable-policy-based charges.
- Store payment/package snapshots per payment period so historical package prices remain accurate when a student changes package next month.

### Blockers/Concerns

- GitNexus CLI through WSL `npx` failed in current `dv-lab` on `status` and `analyze` with `Cannot destructure property 'package' of 'node.target' as it is null`; Windows `cmd.exe` path works.
- Live Google Calendar behavior should be manually verified with a real connected Google account and valid Calendar scopes.
- Dashboard summary still needs full DB-backed storage beyond the current prototype coverage.
- Google Calendar conflict warnings use FreeBusy busy intervals and do not expose event titles. If detailed conflict names are required, add an events.list-based read path with explicit UX/privacy handling.
- RBAC now fails closed for missing Supabase roles; production must assign `teacher` or scoped roles through app metadata/profile policy.
- Google OAuth provider-token storage, client-side token capture after callback, refresh use, calendar selection, event insert/patch, retry, and duplicate-prevention smoke coverage are implemented.

## Session Continuity

Last session: 2026-04-26
Stopped at: Phase 6 complete with Calendar OAuth token-capture fix; next step is Phase 7 payment ledger hardening and currency-aware offer text
Resume file: None
