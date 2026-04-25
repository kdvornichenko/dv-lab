# Teacher English CRM

## What This Is

Teacher English CRM is a private operational web app for an English teacher to control students, lessons, attendance, and payments in one place. The current `dv-lab` product is treated as disposable legacy code; the new product starts as a Turborepo monorepo with a Next.js 16 web app, a Hono API, shared packages, and Supabase as the retained backend connection.

## Core Value

The teacher can always see who studies, who attended, who paid, and who owes money.

## Current Milestone: v1.0 Teacher CRM Foundation

**Goal:** Replace the existing wishlist/schedule app with a clean teacher CRM foundation that keeps Supabase connectivity and delivers the first usable control loop for students, attendance, and payments.

**Target features:**
- Reset `dv-lab` into a Turborepo monorepo.
- Build `apps/web` on Next.js 16, Tailwind CSS 4, shadcn/ui, and React 19.
- Build `apps/api` on Hono for typed server routes.
- Add shared packages for DB, RBAC, and API contracts, reusing useful parts from `g:/its/its-doc`.
- Keep Supabase connection/auth as the system boundary.
- Implement v1 student registry, lesson attendance, payment ledger, and dashboard summaries.

## Requirements

### Validated

(None yet - this is a new product direction.)

### Active

- [ ] Preserve only the Supabase connection contract from the current app before resetting the codebase.
- [ ] User can sign in as the teacher/admin and keep a working session across refreshes.
- [ ] User can create and maintain students with contact, status, and billing metadata.
- [ ] User can create lessons and mark attendance for one or multiple students.
- [ ] User can record manual payments and see balances/overdue students.
- [ ] User can scan a dashboard for today's lessons, attendance gaps, and payment risk.
- [ ] Server API exposes typed, validated routes for the web app.
- [ ] Shared DB/RBAC/API packages are package-boundary clean and reusable.

### Out of Scope

- Online card payments and payment provider reconciliation - v1 tracks manual payments only.
- Student portal and parent/student login - v1 is teacher-facing only.
- Homework/LMS content engine - separate product surface, not needed for attendance/payment control.
- Messaging automation - reminders can be future work after the core ledger is stable.
- Native mobile apps - responsive web is sufficient for v1.
- Calendar provider sync - optional future integration after internal lesson model is validated.

## Context

- Current repository at `/mnt/g/dv-lab` is a Next.js app with wishlist, Google API, Drizzle, and Supabase fragments. The user explicitly wants it wiped and rebuilt, keeping only Supabase connectivity.
- Current retained Supabase code is minimal: `libs/supabase/supabaseClient.ts` uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
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

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Turborepo with `apps/web`, `apps/api`, and shared `packages/*` | Separates UI, server, contracts, DB, and RBAC while keeping one repo workflow | Pending |
| Use Hono for new API instead of reusing ITS-DOC Express server | User specified Hono; ITS-DOC server is Express and should not define the new server architecture | Pending |
| Reuse/adapt ITS-DOC shared packages | Existing RBAC/DB/API contracts reduce implementation risk if domain-specific parts are trimmed | Pending |
| Keep Supabase as auth/data boundary | User asked to keep Supabase connection; official SSR flow supports Next App Router | Pending |
| Manual payment ledger in v1 | Solves the teacher's immediate control need without payment provider complexity | Pending |

---
*Last updated: 2026-04-25 after v1.0 milestone initialization*
