# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** The teacher can always see who studies, who attended, who paid, and who owes money.
**Current focus:** Phase 4+: DB-backed routes, student registry production flows, and Google Calendar token-backed sync.

## Current Position

Phase: 4 of 8 (Student Registry)
Plan: 04-01
Status: Phase 3 complete; production student registry and DB repositories pending
Last activity: 2026-04-25 - Repository reset, Turborepo scaffold, Yarn 4, shared packages, Google-only Supabase auth, Hono auth/RBAC middleware, typed web API client, and API-backed dashboard shell implemented

Progress: [####------] 38%

## Performance Metrics

**Velocity:**

- Total plans completed: 8
- Average duration: n/a
- Total execution time: current autonomous session

**By Phase:**

| Phase | Plans | Total           | Avg/Plan |
| ----- | ----- | --------------- | -------- |
| 1     | 3/3   | current session | n/a      |
| 2     | 3/3   | current session | n/a      |
| 3     | 3/3   | current session | n/a      |

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

### Pending Todos

None yet.

### Blockers/Concerns

- GitNexus CLI through `npx` failed in current `dv-lab` on `status` and `analyze` with `Cannot destructure property 'package' of 'node.target' as it is null`.
- `npx gitnexus status` in `/mnt/g/its/its-doc` was attempted but did not complete during research.
- Hono route handlers currently use a tenant-scoped in-memory store for the prototype; next pass should move feature routes to Supabase Postgres via `packages/db`.
- RBAC now fails closed for missing Supabase roles; production must assign `teacher` or scoped roles through app metadata/profile policy.
- Google OAuth now requests Calendar scopes at login; next pass should add encrypted provider-token storage/refresh, calendar selection persistence, and idempotent event upsert.

## Session Continuity

Last session: 2026-04-25
Stopped at: Phase 1-3 complete, Phase 4 DB-backed student registry pending
Resume file: None
