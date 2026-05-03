# Teacher English CRM

## What This Is

Teacher English CRM is a private operational web app for an English teacher to control students, lessons, attendance, and payments in one place. The current `dv-lab` product is treated as disposable legacy code; the new product starts as a Turborepo monorepo with a Next.js 16 web app, a Hono API, shared packages, and Supabase as the retained backend connection.

## Core Value

The teacher can always see who studies, who attended, who paid, and who owes money.

## Current Milestone: v1.1 Audit Remediation

**Goal:** Convert the 2026-05-03 tech-debt and architecture audits into a safer production baseline without rewriting the CRM.

**Status:** v1.0 phase work closed on 2026-05-03. v1.1 remediation phases 10-16 are complete across `apps/api`, `apps/web`, and shared packages.

**Target features:**

- Harden auth roles, route params, and web/API typed response parsing.
- Add a reliable DB-backed test and CI path.
- Make payment/package, lesson/status, attendance, and tenant package writes transactionally safe.
- Harden Google Calendar I/O, token provenance, sync failure behavior, and service boundaries.
- Scope web CRM cache by auth session and make mutation feedback coherent.
- Consolidate billing/dashboard domain policy.
- Remove high-value dependency, dead-code, and large-component debt after invariants are safe.

## Requirements

### Validated

(None yet - this is a new product direction.)

### Active

- [ ] API auth trusts only app-controlled roles and safe teacher fallback.
- [ ] API route params and web response payloads are schema-validated at boundaries.
- [ ] CI exercises DB-backed integration tests instead of silently skipping them.
- [ ] Payment/package and lesson/status write paths prevent partial durable state.
- [x] Calendar sync has safe timeout, token, failure, and bidirectional import semantics.
- [x] Web CRM state is auth-scoped and mutation-driven UI state is refreshed coherently.
- [x] Billing/dashboard policy duplication is reduced through shared tested policy.
- [x] Dependency and component debt is cleaned after correctness work is green.

### Out of Scope

- Online card payments and payment provider reconciliation - v1 tracks manual payments only.
- Student portal and parent/student login - v1 is teacher-facing only.
- Homework/LMS content engine - separate product surface, not needed for attendance/payment control.
- Messaging automation - reminders can be future work after the core ledger is stable.
- Native mobile apps - responsive web is sufficient for v1.

## Context

- Current repository at `/mnt/g/dv-lab` is a Next.js app with wishlist, Google API, Drizzle, and Supabase fragments. The user explicitly wants it wiped and rebuilt, keeping only Supabase connectivity.
- Current retained Supabase code is minimal: `libs/supabase/supabaseClient.ts` uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Current Google Calendar integration uses legacy env keys and client/service/store code; the integration stays in v1, but implementation must be rebuilt cleanly.
- Target stack update from user: full Turborepo, web on Next.js 16, server on Hono JS, Tailwind, shadcn.
- Reuse source available in `/mnt/g/its/its-doc`: `packages/rbac`, `packages/db`, `packages/api-types`. These should be adapted/renamed instead of copied blindly.
- ITS-DOC app/server currently uses Express, not Hono; only shared package patterns are candidates for reuse.

## Constraints

- **Tech stack**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Turborepo, Hono, TypeScript - user specified.
- **Backend boundary**: Supabase remains the retained backend connection - user specified.
- **Repository reset**: Existing app code is disposable - do not preserve wishlist/Google/schedule features unless explicitly reintroduced.
- **Monorepo discipline**: Root scripts delegate to `turbo run`; task logic lives in packages/apps.
- **Architecture**: Container/model/presentation split on web; transport and domain policy stay out of `components/ui`.
- **Destructive work**: Actual wipe/scaffold must be executed as Phase 1, with a final pre-reset inventory of Supabase/env files.

## Key Decisions

| Decision                                                           | Rationale                                                                                           | Outcome |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------- |
| Use Turborepo with `apps/web`, `apps/api`, and shared `packages/*` | Separates UI, server, contracts, DB, and RBAC while keeping one repo workflow                       | Done    |
| Use Hono for new API instead of reusing ITS-DOC Express server     | User specified Hono; ITS-DOC server is Express and should not define the new server architecture    | Done    |
| Reuse/adapt ITS-DOC shared packages                                | Existing RBAC/DB/API contracts reduce implementation risk if domain-specific parts are trimmed      | Done    |
| Keep Supabase as auth/data boundary                                | User asked to keep Supabase connection; official SSR flow supports Next App Router                  | Done    |
| Use Google account as both login and calendar identity             | User requested Google auth instead of email and the same account for Calendar                       | Done    |
| Use Yarn 4 stable with node-modules linker                         | User requested latest Yarn; node_modules keeps Next.js and shadcn workflows straightforward         | Done    |
| Manual payment ledger in v1                                        | Solves the teacher's immediate control need without payment provider complexity                     | Done    |
| Rebuild Google Calendar integration in v1                          | Calendar sync is required, but current implementation is not acceptable as an architecture baseline | Done    |
| Use ITS-DOC tooling conventions                                    | User asked to reuse ITS-DOC Turborepo, Prettier, and ESLint configuration                           | Done    |
| Use DB-backed student service before lesson/payment refactors      | Student registry is the first production CRM entity and defines the repository/service pattern      | Done    |
| Use audit remediation as v1.1 phases                               | v1.0 is functionally closed; audit findings need executable GSD work instead of loose TODOs         | Active  |

---

_Last updated: 2026-05-03 after Phase 16 cleanup and final verification_
