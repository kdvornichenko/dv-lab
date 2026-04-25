# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** The teacher can always see who studies, who attended, who paid, and who owes money.
**Current focus:** Phase 1: Repository Reset and Monorepo Scaffold

## Current Position

Phase: 1 of 7 (Repository Reset and Monorepo Scaffold)
Plan: Not started
Status: Ready to plan
Last activity: 2026-04-25 - Milestone v1.0 initialized with research, requirements, and roadmap

Progress: [----------] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: n/a
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- Use Turborepo with `apps/web`, `apps/api`, and shared packages.
- Use Hono for new API; do not reuse ITS-DOC Express server directly.
- Adapt ITS-DOC `packages/rbac`, `packages/db`, and `packages/api-types` where useful.
- Keep Supabase as retained backend/auth boundary.
- v1 payments are manual ledger tracking, not online acquiring.

### Pending Todos

None yet.

### Blockers/Concerns

- GitNexus CLI through `npx` failed in current `dv-lab` on `status` and `analyze` with `Cannot destructure property 'package' of 'node.target' as it is null`.
- `npx gitnexus status` in `/mnt/g/its/its-doc` was attempted but did not complete during research.
- Actual repository wipe is intentionally deferred to Phase 1 implementation.

## Session Continuity

Last session: 2026-04-25
Stopped at: Milestone artifacts created; Phase 1 ready for `$gsd-plan-phase 1`
Resume file: None
