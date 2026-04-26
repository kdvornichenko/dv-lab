# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** The teacher can always see who studies, who attended, who paid, and who owes money.
**Current focus:** Phase 5+: DB-backed lessons/attendance, route-level workspaces, and DB-backed ledger operations.

## Current Position

Phase: 5 of 8 (Lessons and Attendance)
Plan: 05-02
Status: Plan 05-01 complete; Plan 05-02 partially complete with DB attendance route/service, bulk mark action, and API smoke coverage
Last activity: 2026-04-26 - Added DB-backed lessons, DB-backed payments with delete, student archive/delete verification, separate workspace routes, student settings page, package pricing fields, skeleton loading, and sidebar DnD settings UI

Progress: [######----] 60%

## Performance Metrics

**Velocity:**

- Total plans completed: 11
- Average duration: n/a
- Total execution time: current autonomous session

**By Phase:**

| Phase | Plans | Total           | Avg/Plan |
| ----- | ----- | --------------- | -------- |
| 1     | 3/3   | current session | n/a      |
| 2     | 3/3   | current session | n/a      |
| 3     | 3/3   | current session | n/a      |
| 4     | 3/3   | current session | n/a      |
| 5     | 1/3   | current session | n/a      |

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

### Pending Todos

None yet.

### Blockers/Concerns

- GitNexus CLI through WSL `npx` failed in current `dv-lab` on `status` and `analyze` with `Cannot destructure property 'package' of 'node.target' as it is null`; Windows `cmd.exe` path works.
- Dashboard summary, calendar route handlers, sidebar settings persistence, and error log persistence still need DB-backed storage. Current sidebar/error persistence should be treated as temporary until the next DB pass.
- RBAC now fails closed for missing Supabase roles; production must assign `teacher` or scoped roles through app metadata/profile policy.
- Google OAuth now requests Calendar scopes at login; Phase 6 should add encrypted provider-token storage/refresh, calendar selection persistence, and idempotent event upsert.

## Session Continuity

Last session: 2026-04-26
Stopped at: Payment deletion fixed against Postgres, migration applied, and Phase 5/UX checkpoint ready for next DB persistence pass
Resume file: None
