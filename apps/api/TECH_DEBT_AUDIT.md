# Tech Debt Audit: apps/api

**Date:** 2026-05-03
**Scope:** `apps/api`, plus API-facing contracts and persistence in `packages/api-types`, `packages/db`, and `packages/rbac`.

## Executive Summary

- The biggest risk is data integrity around multi-step workflows: lessons, billing charges, payments, package purchases, student deletion, and calendar sync are not consistently transactional.
- Calendar token and sync handling works, but token provenance, scope verification, timeout behavior, and destructive Google import semantics are too trusting.
- Billing is functionally rich but fragile: money uses JS numbers, package/charge relationships are not fully tenant-scoped at the database level, and package cancellation can leave discounted charges behind.
- The memory fallback has become a second backend. It is useful for local smoke tests, but it duplicates production billing/calendar behavior and lets tests pass without exercising Postgres.
- API tests pass, but the default suite mostly covers memory storage; DB integration exits successfully when `TEACHER_CRM_TEST_DATABASE_URL` is unset.
- There are no dependency cycles, and typecheck/lint/test are green, but audit tooling found moderate dependency advisories and a missing CI/dead-code toolchain.
- Route modules are thin enough; the architectural pressure is concentrated in oversized services, especially `calendar-service.ts`, `memory-store.ts`, and billing workflows.
- RBAC fails closed, but role extraction still trusts `user_metadata.roles`, which is not a safe long-term source of authorization truth.
- Observability is ad hoc: request IDs exist, but request logging, permission-denied logs, Google errors, and client-submitted error logs are not consistently structured or redacted.
- Fixes should be staged around invariants first: auth/roles, DB-backed test path, transactions, then service splits.

## Architectural Mental Model

`apps/api` is a Hono API. Requests pass through optional Supabase auth, `requireAuth`, route-level RBAC, route Zod validators, and then route into service singletons. Services select either Drizzle/Postgres repositories through `getDb()` or a memory fallback through `getMemoryStore()`. Shared contracts and business constants live in `packages/api-types`; schema/repository helpers and ledger math live in `packages/db`; role permissions live in `packages/rbac`.

Routes are mostly not the problem. The real architecture is in service workflows: lesson creation can create lessons, attendance, charges, calendar sync records, and Google events; payment creation can create packages and payment rows; student deletion can mutate lessons and calendar state. These workflows cross multiple persistence and external I/O boundaries without a consistent transaction/outbox model.

## Findings Table

| ID      | Category              |                                                                                                      File:Line | Severity | Effort | Description                                                                                                                                        | Recommendation                                                                                       |
| ------- | --------------------- | -------------------------------------------------------------------------------------------------------------: | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| API-001 | Security / RBAC       |                                                                           `apps/api/src/middleware/auth.ts:80` | High     | S      | Roles are accepted from both `app_metadata.roles` and `user_metadata.roles`; user metadata is not a safe authorization source.                     | Use only server-controlled `app_metadata` or an API-owned role table.                                |
| API-002 | Calendar security     |                          `apps/api/src/routes/calendar.ts:36`, `apps/api/src/services/calendar-service.ts:725` | High     | M      | Provider tokens are accepted from the web client and required scopes are treated as granted instead of being verified against Google.              | Verify token identity/scopes with Google before persisting and bind it to the authenticated account. |
| API-003 | Data integrity        |                           `apps/api/src/services/lesson-service.ts:222`, `packages/api-types/src/index.ts:434` | High     | M      | Attendance accepts any same-teacher `lessonId` and `studentId`; it does not prove the student belongs to that lesson roster.                       | Validate against `lesson_students` before upsert and add a DB constraint or repository guard.        |
| API-004 | Transactionality      |                   `apps/api/src/services/payment-service.ts:87`, `apps/api/src/services/payment-service.ts:91` | High     | M      | Package purchase creates the package before inserting payment; a failed insert can leave an orphan active package.                                 | Wrap package creation and payment insert in one transaction.                                         |
| API-005 | Transactionality      |                   `apps/api/src/services/lesson-service.ts:181`, `apps/api/src/services/lesson-service.ts:184` | High     | M      | Lesson create persists lesson/attendance before billing sync; later failure can return 500 after partial writes.                                   | Move lesson, attendance, and charge sync into one transactional boundary.                            |
| API-006 | Transactionality      | `apps/api/src/services/student-workflow-service.ts:28`, `apps/api/src/services/student-workflow-service.ts:37` | High     | M      | Student deletion mutates related lessons/calendar state one by one before deleting the student.                                                    | Use DB transaction for local changes and queue external calendar cleanup after commit.               |
| API-007 | Calendar consistency  |               `apps/api/src/services/calendar-service.ts:681`, `apps/api/src/services/calendar-service.ts:684` | High     | M      | Calendar block delete removes the local DB row before deleting the Google event.                                                                   | Delete external event first or soft-delete locally with retryable cleanup state.                     |
| API-008 | Calendar integrity    |               `apps/api/src/services/calendar-service.ts:984`, `apps/api/src/services/calendar-service.ts:990` | High     | M      | Calendar import can overwrite CRM lesson time/duration/status from Google, including cancelled local lessons.                                      | Store proposed external changes and require explicit reconciliation for destructive changes.         |
| API-009 | Tenant boundary       |                                               `packages/db/src/schema.ts:338`, `packages/db/src/schema.ts:379` | High     | M      | `payments.packageId` and `lessonCharges.packageId` reference package id only, not `(teacherId, packageId)`.                                        | Add tenant-scoped composite FKs or repository-level guarded joins plus migration tests.              |
| API-010 | Test debt             |                                          `apps/api/src/db.integration.test.ts:8`, `apps/api/src/app.test.ts:5` | High     | M      | DB integration exits 0 when no test DB is configured, while main smoke tests force memory storage.                                                 | Make DB integration required in CI or split local memory tests from required DB-backed tests.        |
| API-011 | CI gap                |                                                                                              `package.json:18` | High     | S      | There is no visible CI workflow running immutable install, audit, format, DB integration, and builds.                                              | Add CI with Postgres service and make it the merge gate.                                             |
| API-012 | Lesson series         |  `apps/api/src/services/lesson-workflow-service.ts:37`, `apps/api/src/services/lesson-workflow-service.ts:131` | Medium   | M      | “Apply to future” infers a series from first student + weekday + hour + minute.                                                                    | Add explicit `seriesId` and occurrence metadata.                                                     |
| API-013 | Contract debt         |                   `packages/api-types/src/index.ts:401`, `apps/api/src/services/lesson-workflow-service.ts:82` | Medium   | M      | `repeatCount` is accepted, but CRM create persists only the first lesson; recurrence is mostly calendar intent.                                    | Either create CRM occurrences or rename/scope the field to calendar recurrence.                      |
| API-014 | Error semantics       |                        `apps/api/src/routes/calendar.ts:165`, `apps/api/src/services/calendar-service.ts:1245` | Medium   | S      | Manual sync returns HTTP 200 even when Google sync fails and record status becomes `failed`.                                                       | Return non-2xx or `ok: false` for direct sync failure.                                               |
| API-015 | Resource hygiene      |                                                           `apps/api/src/services/google-calendar-client.ts:21` | Medium   | S      | Google API calls have no timeout or abort signal.                                                                                                  | Add `AbortSignal.timeout(...)` or injected timeout fetch wrapper.                                    |
| API-016 | Observability / PII   |                                   `apps/api/src/middleware/auth.ts:154`, `apps/api/src/middleware/auth.ts:164` | Medium   | S      | Permission-denied logs include email, roles, and full permissions.                                                                                 | Log request id, user id, and required permission; redact/omit PII by default.                        |
| API-017 | Observability / PII   |                            `apps/api/src/routes/errors.ts:18`, `apps/api/src/services/error-log-service.ts:47` | Medium   | S      | Client-submitted error messages are stored verbatim.                                                                                               | Apply server-side redaction to source/message before persistence.                                    |
| API-018 | Billing correctness   |                                                                                 `packages/db/src/ledger.ts:48` | Medium   | M      | `unpaidLessonCount` counts all billable charges and only resets when total balance is non-negative; partial payments can overstate unpaid lessons. | Track allocation to charges or rename the field to billable charge count.                            |
| API-019 | Money precision       |                                  `packages/db/src/ledger.ts:51`, `apps/api/src/services/payment-service.ts:30` | Medium   | M      | Numeric DB amounts are converted to JS `number` and summed as floats.                                                                              | Use integer minor units or a decimal library at money boundaries.                                    |
| API-020 | Idempotency           |                      `packages/db/src/payment-repository.ts:25`, `apps/api/src/services/payment-service.ts:73` | Medium   | S      | Idempotency lookup can return voided payments.                                                                                                     | Decide permanent-key semantics; otherwise filter active rows or return conflict.                     |
| API-021 | Package cancellation  |                     `packages/db/src/billing-repository.ts:53`, `apps/api/src/services/billing-service.ts:501` | Medium   | M      | Cancelled package clears `packageId` from charges but keeps discounted amounts.                                                                    | Add explicit repricing/correction policy.                                                            |
| API-022 | Contract drift        |                          `packages/api-types/src/index.ts:346`, `apps/api/src/services/student-service.ts:192` | Medium   | S      | Partial student updates can leave unsupported custom package fields after clearing overrides.                                                      | Add service-level cross-field validation against existing state.                                     |
| API-023 | Migration hygiene     |                                                                    `packages/db/drizzle/meta/_journal.json:55` | Medium   | S      | Journal lists newer migrations without matching snapshots past `0006`.                                                                             | Regenerate/check in snapshots or document manual migration policy.                                   |
| API-024 | Architecture decay    |               `apps/api/src/services/calendar-service.ts:593`, `apps/api/src/services/calendar-service.ts:777` | Medium   | M      | `calendar-service.ts` is 1,259 LOC and repeats token refresh/persistence closures.                                                                 | Split connection, token, lesson sync, block sync, and import services.                               |
| API-025 | Consistency rot       |                    `apps/api/src/services/memory-store.ts:400`, `apps/api/src/services/billing-service.ts:224` | Medium   | L      | Memory fallback duplicates production billing/calendar/settings logic.                                                                             | Restrict it to tests or extract shared pure domain functions.                                        |
| API-026 | Date/time correctness |               `apps/api/src/services/dashboard-service.ts:10`, `apps/api/src/services/dashboard-service.ts:33` | Medium   | S      | Dashboard “today” uses UTC date slices, not teacher/local timezone.                                                                                | Store teacher timezone and compute windows in that zone.                                             |
| API-027 | Performance           |                `apps/api/src/services/dashboard-service.ts:14`, `apps/api/src/services/billing-service.ts:575` | Medium   | M      | Dashboard loads full students/lessons/payments and then balance calculation loads overlapping data again.                                          | Add a dashboard repository query or pass loaded rows into balance calculation.                       |
| API-028 | Contract/performance  |                             `apps/api/src/routes/lessons.ts:21`, `apps/api/src/services/lesson-service.ts:210` | Medium   | S      | Filtered `GET /lessons` still returns all attendance and occurrence exceptions for the teacher.                                                    | Scope related payloads to returned lesson IDs or split endpoints.                                    |
| API-029 | Side-effectful reads  |               `apps/api/src/services/settings-service.ts:124`, `apps/api/src/services/settings-service.ts:174` | Low      | S      | Settings GET endpoints insert default rows.                                                                                                        | Return defaults without writing or seed defaults during profile creation.                            |
| API-030 | Tooling               |                                                                                              `package.json:10` | Medium   | S      | No committed scripts/devDeps for knip/madge/depcheck despite real findings from ad hoc runs.                                                       | Add reproducible debt-check scripts and CI gate.                                                     |

## Top 5 If You Fix Nothing Else

1. Remove user-controlled role trust.
   - Change `rolesFromUser()` to ignore `user_metadata.roles`.
   - Add tests for app metadata, teacher email fallback, and no-role denial.

2. Make DB-backed integration real.
   - Add CI Postgres.
   - Make `TEACHER_CRM_TEST_DATABASE_URL` required in CI.
   - Keep memory tests as separate smoke tests.

3. Introduce transactional workflow boundaries.
   - Payment package purchase: package + payment in one transaction.
   - Lesson create/update: lesson + attendance + charges in one transaction.
   - Student delete: local DB transaction plus post-commit calendar cleanup.

4. Add explicit lesson series modeling.
   - Add `lesson_series` or `series_id` on lessons.
   - Replace weekday/hour heuristic.
   - Update delete/update current/future semantics and tests.

5. Split calendar service around token/session and sync use cases.
   - Token verification and refresh helper.
   - Lesson sync service.
   - Calendar block sync service.
   - Import/reconciliation service.
   - Add timeouts and redaction.

## Quick Wins

- [ ] Remove `user_metadata.roles` from auth role extraction.
- [ ] Add timeout wrapper to `googleJson`.
- [ ] Redact permission-denied and provider error logs.
- [ ] Make web/API dead-code checks reproducible in package scripts.
- [ ] Fix settings GET side effects.
- [ ] Add `isNull(voidedAt)` to idempotency lookup or return conflict.
- [ ] Gate Hono `logger()` by env and include request id.
- [ ] Move root-only dependency drift into the owning package manifests.

## Things That Look Bad But Are Actually Fine

- `packages/db/src/schema.ts:350`: unique index on nullable idempotency key is acceptable in Postgres because multiple `NULL` values are allowed.
- `apps/api/src/services/calendar-service.ts:216`: AES-256-GCM with random IV/auth tag is sound; the concern is token provenance and env discipline, not the encryption primitive.
- `apps/api/src/routes/calendar.ts:36`: provider-token schema still accepts email, but the route binds tokens to authenticated user email rather than trusting the submitted email.
- `apps/api/src/app.ts:55`, `apps/api/src/config/env.ts:50`, and `apps/api/src/services/storage-context.ts:17`: production memory fallback appears blocked; remaining issue is duplication/test realism.
- `apps/api/src/services/calendar-service.ts:247`: Google event payloads use minimal title/description and no longer export lesson notes/topics.

## Open Questions

- Should Google Calendar import ever be allowed to mutate CRM source-of-truth fields automatically, or should all imports become reconciliation proposals?
- Is `unpaidLessonCount` meant to represent actual unpaid lessons after payment allocation or simply billable charge count?
- Are package purchases required to preserve exact historical terms even if a student changes package settings later?
- Should memory fallback remain a first-class local runtime, or become test-only?

## Tooling Notes

- `gitnexus analyze` succeeded without `npx`; MCP `detect_changes(scope: all)` reported no changed symbols/flows for documentation-only edits.
- `yarn typecheck`, `yarn lint`, and `yarn test` passed.
- `yarn lint` / `yarn test` reported one web warning outside API scope: unused `Image` in `apps/web/components/AppSidebar.tsx:5`.
- `yarn npm audit --all --recursive` reported moderate advisories in dev/transitive dependencies (`esbuild`, deprecated `@esbuild-kit/*`, and `postcss` through Next).
- `npx madge --circular ...` found no circular dependencies.
- `npx knip --no-progress` found unused files/deps/exports, mostly web UI and API helper exports.
