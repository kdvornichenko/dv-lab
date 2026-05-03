# Roadmap: Teacher English CRM

## Overview

The milestone starts by replacing the current disposable app with a clean monorepo foundation. It then adapts reusable ITS-DOC package patterns, establishes Supabase/Hono auth and API boundaries, and builds the first operational CRM loop: students, lessons, attendance, payments, and dashboard summaries.

## Phases

- [x] **Phase 1: Repository Reset and Monorepo Scaffold** - Wipe legacy app surface and create the Turborepo structure.
- [x] **Phase 2: Shared Packages and Data Model** - Adapt RBAC/DB/API package patterns and define teacher CRM schema.
- [x] **Phase 3: Auth and Hono API Foundation** - Wire Supabase auth/session and typed Hono route foundation.
- [x] **Phase 4: Student Registry** - Build student CRUD, archive, search, and list/profile UI.
- [x] **Phase 5: Lessons and Attendance** - Build lesson scheduling and attendance marking.
- [x] **Phase 6: Google Calendar Integration** - Rebuild calendar OAuth and lesson event sync cleanly.
- [x] **Phase 7: Payments and Ledger** - Build manual payment ledger and balance summaries.
- [x] **Phase 8: Dashboard and Operational Polish** - Build dashboard, quick actions, responsive QA, and final verification.
- [x] **Phase 9: Implement website pet widget** - Add an animated pet overlay that can walk, jump to page elements, and rest.
- [x] **Phase 10: Trust Boundaries and API Contracts** - Harden auth roles, route params, and typed web/API responses.
- [x] **Phase 11: Test and CI Reality** - Make DB-backed testing and CI gates explicit enough to catch persistence regressions.
- [x] **Phase 12: Persistence Integrity** - Add transactional and tenant-safe guarantees for payments, lessons, attendance, and packages.
- [x] **Phase 13: Calendar Safety and Service Boundaries** - Harden Google I/O, token provenance, sync semantics, and calendar service seams.
- [x] **Phase 14: Web State Coherence** - Scope CRM cache by auth, make mutations coherent, and standardize date handling.
- [x] **Phase 15: Shared Domain Policy Consolidation** - Consolidate billing/dashboard policy and prepare API contract modularization.
- [x] **Phase 16: Cleanup, Tooling, and Component Decomposition** - Remove dependency drift and split large web/tooling surfaces after invariants are safe.

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

- [x] 05-01: Lessons API/services and schedule UI
- [x] 05-02: Attendance records, statuses, and bulk marking
- [x] 05-03: Student attendance history and corrections

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

- [x] 06-01: Google OAuth and token storage boundary
- [x] 06-02: Calendar selection and lesson event mapping
- [x] 06-03: Sync status, retry, and duplicate-prevention contract tests

### Phase 7: Payments and Ledger

**Goal**: The teacher can record payments and understand balances without losing history.
**Depends on**: Phase 6
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-06, PAY-08
**Success Criteria** (what must be TRUE):

1. User can record a manual payment for a student.
2. User can view payment history by student.
3. User can see balance and overdue/unpaid lesson count.
4. Corrections preserve ledger history or explicit adjustment records.
5. Offer text can be generated in a selected currency using a current exchange-rate API.
6. Package prices derive from student base price, lesson duration, fixed 3-month/5-month discounts, and lesson count.
7. Student profile shows package progress and copyable completed-lesson dates.
8. Payment calculations are covered by focused tests.
   **Plans**: 4 plans

Plans:

- [x] 07-01: Payment ledger schema, API, and service calculations
- [x] 07-02: Payment entry and history UI
- [x] 07-03: Balance/overdue summaries and ledger tests
- [x] 07-04: Currency-aware lesson/package offer text with live exchange rates

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

- [x] 08-01: Dashboard data API and summary cards/tables
- [x] 08-02: Quick actions and empty/loading/error states
- [x] 08-03: Responsive QA, accessibility pass, and final v1 verification

### Phase 9: Implement website pet widget

**Goal:** Add an animated in-app pet overlay that can walk around the CRM shell, jump to explicit page targets, rest on them, respect reduced-motion/privacy settings, and remain non-blocking to normal CRM work.
**Requirements**: API-05
**Success Criteria** (what must be TRUE):

1. User can enable or disable the pet through a persisted setting.
2. The first pet renders from deterministic animated WebP assets in a native `img`; the runtime moves the element and does not switch frames manually.
3. The pet moves inside a fixed overlay without blocking clicks on CRM UI.
4. The pet only jumps to explicitly marked target zones such as `data-pet-target`.
5. Reduced-motion mode shows a static or near-static sleeper state instead of active walking/jumping.
6. Privacy mode switches the pet to a dedicated eyes-covered pose.
7. The implementation follows web app provider/component boundaries and keeps pet engine logic out of `components/ui`.
   **Depends on:** Phase 8
   **Plans:** 4 plans

Plans:

- [x] 09-01-PLAN.md — Wave 0 pet validation, WebP manifest, and pure engine contracts
- [x] 09-02-PLAN.md — Persisted pet settings API and workspace controls
- [x] 09-03-PLAN.md — Pet engine, overlay provider, and target discovery
- [x] 09-04-PLAN.md — Pet target rollout, sound guardrails, and browser verification

### Phase 10: Trust Boundaries and API Contracts

**Goal:** Security-sensitive request boundaries no longer trust user-controlled privilege data, malformed route IDs are rejected consistently, and the web client validates API responses where it relies on typed contracts.
**Depends on:** Phase 9
**Requirements:** AUDIT-01, AUDIT-02, AUDIT-03
**Success Criteria** (what must be TRUE):

1. API auth role extraction ignores `user_metadata.roles` and accepts only trusted role sources plus the configured teacher-email fallback.
2. Forbidden responses expose only client-safe denial details while server logs retain redacted diagnostics.
3. Route params for student, lesson, payment, error, block, and calendar-resource IDs are validated through shared schemas before service calls.
4. Core web API wrapper paths can parse expected Zod response schemas and reject malformed successful payloads.
5. Existing auth, route, and web API behavior remains covered by focused tests.
   **Plans:** 3 plans

Plans:

- [x] 10-01: Auth role hardening and forbidden response narrowing
- [x] 10-02: Shared route parameter schemas and validation middleware
- [x] 10-03: Schema-aware web API response parsing

### Phase 11: Test and CI Reality

**Goal:** The project has a reliable local and CI verification path that distinguishes memory smoke tests from DB-backed integration tests.
**Depends on:** Phase 10
**Requirements:** AUDIT-04
**Success Criteria** (what must be TRUE):

1. API test scripts clearly separate memory-only smoke coverage from DB integration coverage.
2. DB integration tests fail loudly when CI requires Postgres but the database URL is missing.
3. A CI workflow installs immutably and runs typecheck, lint, tests, build, and required DB integration checks.
4. Dead-code/dependency audit commands are available as documented non-blocking checks.
   **Plans:** 2 plans

Plans:

- [x] 11-01: Split memory and DB integration test scripts
- [x] 11-02: Add CI workflow and audit command surface

### Phase 12: Persistence Integrity

**Goal:** Payment/package, lesson/status, attendance, and package relationship writes cannot leave durable partial state across failure paths.
**Depends on:** Phase 11
**Requirements:** AUDIT-05, AUDIT-06, AUDIT-07, AUDIT-08
**Success Criteria** (what must be TRUE):

1. Payment/package creation and related ledger changes are atomic or explicitly idempotent.
2. Lesson create/update paths wrap lesson, status/attendance, billing-charge, and calendar-sync persistence in coherent transaction boundaries where applicable.
3. Attendance/status writes reject students that are not linked to the target lesson.
4. Payment/package relationships are tenant-scoped through database constraints or repository-level guards.
5. DB-backed tests cover failure and rollback behavior for the above workflows.
   **Plans:** 4 plans

Plans:

- [x] 12-01: Atomic payment/package and ledger writes
- [x] 12-02: Transactional lesson/status/billing persistence
- [x] 12-03: Attendance roster enforcement
- [x] 12-04: Tenant-scoped package relationship guards

### Phase 13: Calendar Safety and Service Boundaries

**Goal:** Google Calendar integration fails safely, stores only validated token state, and separates external provider I/O from CRM sync orchestration.
**Depends on:** Phase 12
**Requirements:** AUDIT-09, AUDIT-10, AUDIT-11, AUDIT-12
**Success Criteria** (what must be TRUE):

1. Google REST calls have timeout/abort behavior and sanitized provider-error handling.
2. Provider tokens are verified for identity/scope before durable storage or before marking calendar state connected.
3. Direct lesson sync failures are visible to direct callers instead of being hidden behind successful HTTP responses.
4. Destructive calendar import or reconciliation paths require explicit safe semantics.
5. Calendar service responsibilities are split or wrapped behind smaller internal boundaries without route churn.
   **Plans:** 4 plans

Plans:

- [x] 13-01: Google request timeout and error redaction
- [x] 13-02: Token provenance and scope verification
- [x] 13-03: Safe calendar sync/import semantics
- [x] 13-04: Calendar service boundary extraction

### Phase 14: Web State Coherence

**Goal:** The web app does not leak CRM state across sessions and mutation feedback reflects the durable state users rely on.
**Depends on:** Phase 13
**Requirements:** AUDIT-13, AUDIT-14, AUDIT-15
**Success Criteria** (what must be TRUE):

1. CRM module/global cache is keyed by authenticated user or session and clears on auth changes.
2. Payment, lesson/status, and delete mutations update or refresh all affected balance/summary/sync state before reporting success.
3. Dashboard and schedule fallback date logic uses a shared teacher-local date policy instead of UTC string slicing.
4. Focused web tests or model tests cover cross-user cache isolation and stale mutation prevention.
   **Plans:** 3 plans

Plans:

- [x] 14-01: Auth-scoped CRM cache
- [x] 14-02: Coherent mutation refresh and response handling
- [x] 14-03: Shared teacher-local date/time helpers

### Phase 15: Shared Domain Policy Consolidation

**Goal:** Pricing, package progress, dashboard summary, and API contract policy are centralized enough to remove duplicated divergent behavior.
**Depends on:** Phase 14
**Requirements:** AUDIT-16, AUDIT-17, AUDIT-18
**Success Criteria** (what must be TRUE):

1. Billing/package calculations are extracted into one tested policy used by API DB paths, memory paths, and web display helpers where appropriate.
2. Dashboard summary calculation is clearly API-owned or shares one pure summary policy without web fallback divergence.
3. `packages/api-types` can be split by domain while preserving existing index exports and import compatibility.
4. Existing billing, dashboard, and typecheck tests remain green after consolidation.
   **Plans:** 3 plans

Plans:

- [x] 15-01: Shared billing/package policy extraction
- [x] 15-02: Dashboard summary policy consolidation
- [x] 15-03: API types modularization with compatibility exports

### Phase 16: Cleanup, Tooling, and Component Decomposition

**Goal:** After correctness work is green, dependency drift and high-churn web surfaces are reduced without changing product behavior.
**Depends on:** Phase 15
**Requirements:** AUDIT-19, AUDIT-20, AUDIT-21
**Success Criteria** (what must be TRUE):

1. `knip`, `madge`, and dependency-audit commands are configured and documented with intentional exclusions.
2. Direct dependencies live in the package manifests that import them, and unused dependencies/imports are removed where safe.
3. Large web panels/dialogs move state projection and validation models out of presentation components.
4. Settings and pet surfaces avoid stale remote state and polling where a direct registration/observer path is feasible.
5. `yarn typecheck`, `yarn lint`, and `yarn test` pass after cleanup.
   **Plans:** 3 plans

Plans:

- [x] 16-01: Dependency and dead-code hygiene
- [x] 16-02: Web component/model decomposition
- [x] 16-03: Settings and pet runtime polish

## Progress

| Phase                                             | Milestone | Plans Complete | Status      | Completed  |
| ------------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Repository Reset and Monorepo Scaffold         | v1.0      | 3/3            | Complete    | 2026-04-25 |
| 2. Shared Packages and Data Model                 | v1.0      | 3/3            | Complete    | 2026-04-25 |
| 3. Auth and Hono API Foundation                   | v1.0      | 3/3            | Complete    | 2026-04-25 |
| 4. Student Registry                               | v1.0      | 3/3            | Complete    | 2026-04-25 |
| 5. Lessons and Attendance                         | v1.0      | 3/3            | Complete    | 2026-04-26 |
| 6. Google Calendar Integration                    | v1.0      | 3/3            | Complete    | 2026-04-26 |
| 7. Payments and Ledger                            | v1.0      | 4/4            | Complete    | 2026-05-03 |
| 8. Dashboard and Operational Polish               | v1.0      | 3/3            | Complete    | 2026-05-03 |
| 9. Implement website pet widget                   | v1.0      | 4/4            | Complete    | 2026-05-03 |
| 10. Trust Boundaries and API Contracts            | v1.1      | 3/3            | Complete    | 2026-05-03 |
| 11. Test and CI Reality                           | v1.1      | 2/2            | Complete    | 2026-05-03 |
| 12. Persistence Integrity                         | v1.1      | 4/4            | Complete    | 2026-05-03 |
| 13. Calendar Safety and Service Boundaries        | v1.1      | 0/4            | Not Started |            |
| 14. Web State Coherence                           | v1.1      | 0/3            | Not Started |            |
| 15. Shared Domain Policy Consolidation            | v1.1      | 0/3            | Not Started |            |
| 16. Cleanup, Tooling, and Component Decomposition | v1.1      | 0/3            | Not Started |            |
