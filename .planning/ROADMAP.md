# Roadmap: Teacher English CRM

## Overview

The milestone starts by replacing the current disposable app with a clean monorepo foundation. It then adapts reusable ITS-DOC package patterns, establishes Supabase/Hono auth and API boundaries, and builds the first operational CRM loop: students, lessons, attendance, payments, and dashboard summaries.

## Phases

- [x] **Phase 1: Repository Reset and Monorepo Scaffold** - Wipe legacy app surface and create the Turborepo structure.
- [x] **Phase 2: Shared Packages and Data Model** - Adapt RBAC/DB/API package patterns and define teacher CRM schema.
- [x] **Phase 3: Auth and Hono API Foundation** - Wire Supabase auth/session and typed Hono route foundation.
- [x] **Phase 4: Student Registry** - Build student CRUD, archive, search, and list/profile UI.
- [ ] **Phase 5: Lessons and Attendance** - Build lesson scheduling and attendance marking.
- [ ] **Phase 6: Google Calendar Integration** - Rebuild calendar OAuth and lesson event sync cleanly.
- [ ] **Phase 7: Payments and Ledger** - Build manual payment ledger and balance summaries.
- [ ] **Phase 8: Dashboard and Operational Polish** - Build dashboard, quick actions, responsive QA, and final verification.

## Phase Details

### Phase 1: Repository Reset and Monorepo Scaffold

**Goal**: Current `dv-lab` is reset into a Turborepo monorepo with only Supabase connectivity intentionally preserved.
**Depends on**: Nothing
**Requirements**: FOUND-01, FOUND-02, FOUND-04
**Success Criteria** (what must be TRUE):

1. Legacy wishlist/Google/uploader/schedule app surfaces are removed from the active app.
2. `apps/web`, `apps/api`, and required `packages/*` directories exist with package-local scripts.
3. Root scripts delegate through `turbo run`.
4. Supabase env contract and client/server utility plan are preserved.
5. `turbo run typecheck` or equivalent package checks can be introduced without root-only task logic.
   **Plans**: 3 plans

Plans:

- [x] 01-01: Pre-reset inventory and Supabase preservation list
- [x] 01-02: Turborepo workspace scaffold
- [x] 01-03: Baseline dev scripts, TypeScript configs, lint configs, and empty app shells

### Phase 2: Shared Packages and Data Model

**Goal**: Shared packages exist with teacher CRM domains and a Supabase Postgres schema.
**Depends on**: Phase 1
**Requirements**: FOUND-03, API-03, API-04
**Success Criteria** (what must be TRUE):

1. `packages/rbac` exposes teacher CRM permission domains and roles.
2. `packages/db` exposes Drizzle schema/factory for Supabase Postgres.
3. `packages/api-types` exposes initial shared Zod contracts.
4. ITS-DOC package code is adapted without leaking old product domains.
5. DB schema supports students, lessons, lesson-students, attendance records, payments, and billing summaries.
   **Plans**: 3 plans

Plans:

- [x] 02-01: Port package build patterns from ITS-DOC
- [x] 02-02: Define CRM RBAC and API contract baseline
- [x] 02-03: Define Drizzle schema, migrations, and seed data

### Phase 3: Auth and Hono API Foundation

**Goal**: The web app and API share an authenticated, typed request boundary using Google OAuth through Supabase.
**Depends on**: Phase 2
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, API-01, API-02
**Success Criteria** (what must be TRUE):

1. Teacher/admin can sign in with Supabase Auth through Google OAuth.
2. Next.js protected routes redirect unauthenticated users.
3. Hono API health/auth endpoints work locally.
4. Protected Hono routes reject unauthenticated requests with typed errors.
5. API route inputs and outputs use shared Zod contracts where appropriate.
   **Plans**: 3 plans

Plans:

- [x] 03-01: Supabase SSR clients and Next.js `proxy.ts`
- [x] 03-02: Hono server, middleware, health, error format, and auth extraction
- [x] 03-03: Typed client/API integration in web app shell

### Phase 4: Student Registry

**Goal**: The teacher can manage students and inspect each student's operational state.
**Depends on**: Phase 3
**Requirements**: STUD-01, STUD-02, STUD-03, STUD-04, API-05
**Success Criteria** (what must be TRUE):

1. User can add and edit student profile data.
2. User can search/filter active, paused, and archived students.
3. User can archive a student without deleting historical records.
4. Student profile view shows relevant lesson/payment placeholders or summaries.
5. Feature follows container/model/presentation boundaries.
   **Plans**: 3 plans

Plans:

- [x] 04-01: Student API/services and DB queries
- [x] 04-02: Student list/table with filters and archive state
- [x] 04-03: Student create/edit/profile flows

### Phase 5: Lessons and Attendance

**Goal**: The teacher can schedule lessons and mark attendance reliably.
**Depends on**: Phase 4
**Requirements**: LESS-01, LESS-02, LESS-03, ATT-01, ATT-02, ATT-03
**Success Criteria** (what must be TRUE):

1. User can create one-on-one or group lessons.
2. User can view lessons by day/week and student.
3. User can reschedule or cancel a lesson.
4. User can mark attendance for one student or bulk mark group attendance.
5. Student profile shows attendance history.
   **Plans**: 3 plans

Plans:

- [ ] 05-01: Lessons API/services and schedule UI
- [ ] 05-02: Attendance records, statuses, and bulk marking
- [ ] 05-03: Student attendance history and corrections

### Phase 6: Google Calendar Integration

**Goal**: The teacher can use the same Google account from login for Calendar sync without duplicating events or leaking tokens.
**Depends on**: Phase 5
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05
**Success Criteria** (what must be TRUE):

1. User can connect Google Calendar through the authenticated Google OAuth account.
2. User can select the target calendar for lesson events.
3. Creating or rescheduling a lesson can upsert the linked Google Calendar event.
4. Cancelling a lesson applies the configured calendar sync policy.
5. Sync status and retry are visible without creating duplicate events.
   **Plans**: 3 plans

Plans:

- [ ] 06-01: Google OAuth and token storage boundary
- [ ] 06-02: Calendar selection and lesson event mapping
- [ ] 06-03: Sync status, retry, and duplicate-prevention contract tests

### Phase 7: Payments and Ledger

**Goal**: The teacher can record payments and understand balances without losing history.
**Depends on**: Phase 6
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04
**Success Criteria** (what must be TRUE):

1. User can record a manual payment for a student.
2. User can view payment history by student.
3. User can see balance and overdue/unpaid lesson count.
4. Corrections preserve ledger history or explicit adjustment records.
5. Payment calculations are covered by focused tests.
   **Plans**: 3 plans

Plans:

- [ ] 07-01: Payment ledger schema, API, and service calculations
- [ ] 07-02: Payment entry and history UI
- [ ] 07-03: Balance/overdue summaries and ledger tests

### Phase 8: Dashboard and Operational Polish

**Goal**: The first screen becomes a useful teacher control panel for daily work.
**Depends on**: Phase 7
**Requirements**: ATT-04, PAY-05, DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):

1. Dashboard shows today's lessons.
2. Dashboard highlights missing attendance and payment risk.
3. Dashboard shows active students, period attendance count, and month income.
4. Quick actions cover add student, add lesson, mark attendance, and record payment.
5. Desktop and mobile layouts are manually verified in browser with seed data.
   **Plans**: 3 plans

Plans:

- [ ] 08-01: Dashboard data API and summary cards/tables
- [ ] 08-02: Quick actions and empty/loading/error states
- [ ] 08-03: Responsive QA, accessibility pass, and final v1 verification

## Progress

| Phase                                     | Milestone | Plans Complete | Status                    | Completed  |
| ----------------------------------------- | --------- | -------------- | ------------------------- | ---------- |
| 1. Repository Reset and Monorepo Scaffold | v1.0      | 3/3            | Complete                  | 2026-04-25 |
| 2. Shared Packages and Data Model         | v1.0      | 3/3            | Complete                  | 2026-04-25 |
| 3. Auth and Hono API Foundation           | v1.0      | 3/3            | Complete                  | 2026-04-25 |
| 4. Student Registry                       | v1.0      | 3/3            | Complete                  | 2026-04-25 |
| 5. Lessons and Attendance                 | v1.0      | 0/3            | Prototype UI only         | -          |
| 6. Google Calendar Integration            | v1.0      | 0/3            | Schema/API prototype only | -          |
| 7. Payments and Ledger                    | v1.0      | 0/3            | Ledger helper + UI proto  | -          |
| 8. Dashboard and Operational Polish       | v1.0      | 0/3            | Prototype UI only         | -          |
