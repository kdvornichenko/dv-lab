# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** The teacher can always see who studies, who attended, who paid, and who owes money.
**Current focus:** Phase 5+: DB-backed lessons/attendance and Google Calendar token-backed sync.

## Current Position

Phase: 5 of 8 (Lessons and Attendance)
Plan: 05-01
Status: Phase 4 complete; lessons/attendance DB-backed services pending
Last activity: 2026-04-25 - Student registry completed with DB-backed student service, Hono query validation, create/edit/profile UI, search/filter table, and archive flow

Progress: [#####-----] 50%

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

### Pending Todos

None yet.

### Blockers/Concerns

- GitNexus CLI through WSL `npx` failed in current `dv-lab` on `status` and `analyze` with `Cannot destructure property 'package' of 'node.target' as it is null`; Windows `cmd.exe` path works.
- Lessons, attendance, payments, dashboard, and calendar route handlers still use a tenant-scoped in-memory store for the prototype; next passes should move them to Supabase Postgres via `packages/db`.
- RBAC now fails closed for missing Supabase roles; production must assign `teacher` or scoped roles through app metadata/profile policy.
- Google OAuth now requests Calendar scopes at login; Phase 6 should add encrypted provider-token storage/refresh, calendar selection persistence, and idempotent event upsert.

## Session Continuity

Last session: 2026-04-25
Stopped at: Phase 4 complete, Phase 5 DB-backed lessons and attendance pending
Resume file: None
