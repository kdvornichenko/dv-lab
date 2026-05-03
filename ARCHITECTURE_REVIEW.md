# Architecture Review: apps/api and apps/web

**Date:** 2026-05-03
**Scope:** `apps/api`, `apps/web`, `packages/api-types`, `packages/db`, `packages/rbac`

## Architecture Review Results

### Overall Verdict: CHANGES_REQUESTED

All three reviewers returned `CHANGES_REQUESTED`. There are no critical findings, but each lens found four warnings, which crosses the review workflow threshold.

### Object Oriented Design — CHANGES_REQUESTED

#### OO-001: Calendar service combines provider auth, encryption, transport, persistence, and sync workflows

- **Severity**: WARNING
- **Principle**: SRP, DIP, DRY
- **File(s)**: `apps/api/src/services/calendar-service.ts`
- **Line(s)**: 208-235, 370-427, 501-563, 922-1258
- **Description**: `calendar-service.ts` owns token encryption/decryption, Google token refresh, direct Google HTTP URL construction, DB persistence, calendar block syncing, lesson import, event deletion, and event upsert logic. Provider changes or token semantics require edits across unrelated calendar operations.
- **Recommendation**: Extract `CalendarTokenVault`, `GoogleCalendarGateway`, and a smaller `CalendarSyncService`; keep `calendarService` as a facade.

#### OO-002: Storage selection is duplicated inside high-level services

- **Severity**: WARNING
- **Principle**: DIP, OCP
- **File(s)**: `apps/api/src/services/db-context.ts`, `apps/api/src/services/storage-context.ts`, `apps/api/src/services/student-service.ts`, `apps/api/src/services/lesson-service.ts`, `apps/api/src/services/payment-service.ts`, `apps/api/src/services/settings-service.ts`, `apps/api/src/services/calendar-service.ts`
- **Line(s)**: `db-context.ts` 30-37; `storage-context.ts` 14-20; `student-service.ts` 236-274; `lesson-service.ts` 136-239; `payment-service.ts` 53-119; `settings-service.ts` 116-190; `calendar-service.ts` 593-1258
- **Description**: Each service decides whether to use DB repositories or memory store by calling global context helpers. New service methods repeat backend-selection branches.
- **Recommendation**: Introduce domain ports or a `TeacherCrmStore` abstraction wired at request/app startup.

#### OO-003: Billing policy is duplicated between DB-backed billing and memory store

- **Severity**: WARNING
- **Principle**: DRY, SRP
- **File(s)**: `apps/api/src/services/billing-service.ts`, `apps/api/src/services/memory-store.ts`
- **Line(s)**: `billing-service.ts` 153-222, 224-407, 421-467, 509-595; `memory-store.ts` 95-149, 217-386, 654-828
- **Description**: Package selection, consumed units, package progress, next-payment projection, charge synchronization, and balance assembly are implemented separately for DB and memory paths.
- **Recommendation**: Extract pure billing policy functions over normalized data and call them from both adapters.

#### OO-004: Dashboard summary rules are repeated in server, memory, and client fallback paths

- **Severity**: WARNING
- **Principle**: DRY
- **File(s)**: `apps/api/src/services/dashboard-service.ts`, `apps/api/src/services/memory-store.ts`, `apps/web/lib/crm/api.ts`
- **Line(s)**: `dashboard-service.ts` 8-47; `memory-store.ts` 831-861; `api.ts` 195-227
- **Description**: Active student count, today lessons, missing attendance, overdue students, and monthly income are computed in three places.
- **Recommendation**: Extract a shared summary calculator or avoid client fallback recomputation of server-owned metrics.

#### OO-005: `api-types` is a broad contract barrel with multiple unrelated reasons to change

- **Severity**: SUGGESTION
- **Principle**: SRP, CRP
- **File(s)**: `packages/api-types/src/index.ts`
- **Line(s)**: 34-136, 150-181, 263-620
- **Description**: One 849-line module mixes pricing constants, UI defaults, settings, and all domain schemas.
- **Recommendation**: Split source modules by domain and keep `index.ts` as a compatibility barrel.

### Clean Architecture — CHANGES_REQUESTED

#### CA-001: API services depend on concrete storage instead of application-owned ports

- **Severity**: WARNING
- **Principle**: SDP, SAP, Testability
- **File(s)**: `apps/api/src/services/student-service.ts`, `apps/api/src/services/lesson-service.ts`, `apps/api/src/services/billing-service.ts`
- **Line(s)**: `student-service.ts` 10-23,236-250; `lesson-service.ts` 10-28,136-184; `billing-service.ts` 19-43,469-528
- **Description**: Business services import concrete DB repository functions and branch through global `getDb()` / `getMemoryStore()` lookups.
- **Recommendation**: Introduce service factories that accept ports such as `StudentStore`, `LessonStore`, and `BillingLedgerStore`; implement Postgres and memory adapters outside use-case modules.

#### CA-002: Shared API contract package has unrelated release reasons

- **Severity**: WARNING
- **Principle**: REP, CRP, CCP
- **File(s)**: `packages/api-types/src/index.ts`, `packages/api-types/package.json`
- **Line(s)**: `index.ts` 1-3,30-138,150-181,195-261,265-620; `package.json` 34-37
- **Description**: `@teacher-crm/api-types` exports RBAC schemas, Google scopes, billing calculations, sidebar defaults, pet/theme defaults, and all API schemas from one entrypoint.
- **Recommendation**: Split source modules by closure reason and keep a compatibility barrel.

#### CA-003: Calendar service combines provider integration, token vault, persistence, and use cases

- **Severity**: WARNING
- **Principle**: CCP, SDP, Testability
- **File(s)**: `apps/api/src/services/calendar-service.ts`, `apps/api/src/services/google-calendar-client.ts`
- **Line(s)**: `calendar-service.ts` 1-42,208-234,370-427,501-563,593-743; `google-calendar-client.ts` 11-35
- **Description**: Calendar use cases, encryption, OAuth refresh, Google HTTP calls, DB row mapping, and sync updates live in one module.
- **Recommendation**: Extract provider adapter, token vault, and repository port; keep the service as workflow coordinator.

#### CA-004: Billing rules are duplicated across contract, API, memory, and web layers

- **Severity**: WARNING
- **Principle**: CCP, Maintainability
- **File(s)**: `packages/api-types/src/index.ts`, `apps/api/src/services/billing-service.ts`, `apps/api/src/services/memory-store.ts`, `apps/web/lib/crm/model.ts`
- **Line(s)**: `index.ts` 58-136; `billing-service.ts` 153-195,224-467; `memory-store.ts` 95-149,211-260; `model.ts` 216-258
- **Description**: Package pricing, lesson units, progress, savings, and next-payment projection are spread across layers.
- **Recommendation**: Move pure billing policy into a focused shared domain module with tests.

#### CA-005: Web CRM hook exposes a broad facade and module-level cache

- **Severity**: SUGGESTION
- **Principle**: CRP, Maintainability, Testability
- **File(s)**: `apps/web/hooks/useTeacherCrmData.ts`, `apps/web/hooks/useTeacherCrm.ts`, `apps/web/lib/crm/api.ts`
- **Line(s)**: `useTeacherCrmData.ts` 47-72,121-167,192-206; `useTeacherCrm.ts` 9-54; `api.ts` 236-447
- **Description**: Data loading, cache lifetime, supplemental loading, derived rows, errors, refresh, and command facade converge in one central hook.
- **Recommendation**: Keep facade if useful, but split cache/API orchestration and feature hooks by closure reason.

### API Design — CHANGES_REQUESTED

#### API-001: Calendar routes mix resources with command endpoints

- **Severity**: WARNING
- **Principle**: REST resource conventions
- **File(s)**: `apps/api/src/routes/calendar.ts`, `apps/web/lib/crm/api.ts`
- **Line(s)**: `calendar.ts` 91,149,171; `api.ts` 404,414,419
- **Description**: `/calendar/busy`, `/calendar/sync-events`, and `/calendar/import-events` are command-shaped and weaken resource identity/idempotency.
- **Recommendation**: Model as `busy-interval-queries`, `lesson-syncs/:lessonId`, and `import-jobs`.

#### API-002: Path parameters cross the API boundary without validation

- **Severity**: WARNING
- **Principle**: Type safety and fail-fast request contracts
- **File(s)**: `apps/api/src/routes/students.ts`, `apps/api/src/routes/lessons.ts`, `apps/api/src/routes/payments.ts`, `apps/api/src/routes/errors.ts`, `apps/api/src/routes/calendar.ts`, `packages/api-types/src/index.ts`, `packages/db/src/schema.ts`
- **Line(s)**: `students.ts` 41; `lessons.ts` 40; `payments.ts` 35; `errors.ts` 30; `calendar.ts` 77; `index.ts` 5; `schema.ts` 143
- **Description**: Route params are read directly and can reach services/repositories malformed.
- **Recommendation**: Add shared param schemas and validate with Hono/Zod before handlers.

#### API-003: Error response contract is broader than the shared API type

- **Severity**: WARNING
- **Principle**: Consistent error semantics and trust boundaries
- **File(s)**: `apps/api/src/http/errors.ts`, `apps/api/src/middleware/auth.ts`, `packages/api-types/src/index.ts`
- **Line(s)**: `errors.ts` 14,52; `auth.ts` 153,166; `index.ts` 643
- **Description**: Server allows `error.details?: unknown` and returns authorization internals; shared type only models validation details.
- **Recommendation**: Keep rich diagnostics in logs; define shared discriminated detail schemas by error code.

#### API-004: Client API casts JSON to generic response types without runtime contract checks

- **Severity**: WARNING
- **Principle**: Type safety at external boundaries
- **File(s)**: `apps/web/lib/crm/api.ts`, `packages/api-types/src/index.ts`
- **Line(s)**: `api.ts` 139,155,177; `index.ts` 666
- **Description**: `apiRequest<T>` returns `payload as T` instead of parsing exported Zod response schemas.
- **Recommendation**: Pass response schemas into endpoint wrappers and infer types from schemas.

## Priority Actions

1. Remove role trust from user metadata and narrow forbidden response details.
2. Add route param validation and schema-aware web response parsing.
3. Make DB-backed tests mandatory in CI.
4. Introduce transactional boundaries for lesson, payment/package, and student-delete workflows.
5. Extract pure billing/dashboard policy from duplicated API/memory/web paths.
6. Split calendar provider/token/sync responsibilities.
7. Auth-scope the web CRM cache.

## Metrics

- Object Oriented Design: 0 critical, 4 warnings, 1 suggestion.
- Clean Architecture: 0 critical, 4 warnings, 1 suggestion.
- API Design: 0 critical, 4 warnings, 0 suggestions.
