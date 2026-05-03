# Tech Debt Remediation Plan

**Date:** 2026-05-03
**Inputs:**

- `apps/api/TECH_DEBT_AUDIT.md`
- `apps/web/TECH_DEBT_AUDIT.md`
- `ARCHITECTURE_REVIEW.md`

## Goal

Turn the completed v1.0 CRM into a safer, more maintainable system without a rewrite. The priority is correctness at trust boundaries and persistence boundaries first, then architectural consolidation, then cleanup/tooling.

## Strategy

Work in narrow, verifiable slices. Each slice should preserve current behavior unless the audit explicitly identifies the behavior as unsafe. Avoid broad refactors that mix security, persistence, UI state, and dependency cleanup in the same commit.

Before editing code symbols, run GitNexus impact analysis for each target function/class/module-level exported symbol. If impact is HIGH or CRITICAL, stop and reassess scope before editing.

## Phase 1: Trust Boundaries and API Contracts

**Why first:** These fixes reduce security/data-leak risk and create stronger boundaries for later refactors.

### 1.1 Auth role hardening

- Modify `rolesFromUser` in `apps/api/src/middleware/auth.ts`.
- Stop accepting `user_metadata.roles`.
- Keep `app_metadata.roles` and configured teacher-email fallback.
- Narrow `FORBIDDEN` response details to client-safe fields.
- Keep full diagnostics server-side, redacted.

Verification:

- API tests for app metadata roles, user metadata ignored, teacher email fallback, no-role 403.
- `yarn --cwd apps/api test`

### 1.2 Route param validation

- Add shared param schemas in `packages/api-types`.
- Add validation middleware for `studentId`, `lessonId`, `paymentId`, `errorId`, `blockId`.
- Apply to students, lessons, payments, errors, and calendar block routes.

Verification:

- Route tests for malformed IDs returning structured `400 VALIDATION_FAILED`.
- `yarn --cwd apps/api test`

### 1.3 Web API response parsing

- Change `apiRequest` in `apps/web/lib/crm/api.ts` to accept Zod response schemas.
- Update endpoint wrappers incrementally, starting with core load endpoints and mutations.
- Keep error parsing compatible with existing `TeacherCrmApiError`.

Verification:

- Unit tests or focused script tests for invalid payload rejection.
- `yarn --cwd apps/web typecheck`
- `yarn --cwd apps/web test`

## Phase 2: Test and CI Reality

**Why second:** Transactional and persistence fixes need a real DB safety net.

### 2.1 Make DB-backed tests explicit

- Split memory smoke and DB integration scripts.
- Make DB integration fail when required in CI.
- Add documented local command for optional DB integration.

### 2.2 Add CI workflow

- Immutable install.
- Typecheck, lint, format check.
- API memory tests.
- DB integration with Postgres service.
- Web tests including pet tests.
- Build.
- Audit/dependency/dead-code checks as non-blocking first, then gating once cleaned.

Verification:

- Local `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`.
- CI dry-run not available locally; validate YAML syntax and scripts.

## Phase 3: Persistence Integrity

**Why third:** These are correctness risks with real data consequences.

### 3.1 Payment/package transaction

- Create repository/service method that creates package and payment atomically.
- Add idempotency semantics for voided payments.
- Add tests for insert failure or idempotent replay behavior.

### 3.2 Lesson create/update transaction

- Wrap lesson insert/update, attendance sync, and billing charge sync.
- Ensure failure does not leave partial lesson/attendance/charge rows.
- Add DB integration coverage.

### 3.3 Attendance roster enforcement

- Reject attendance records where student is not enrolled in the lesson.
- Add DB/service validation and tests.

### 3.4 Tenant-scoped package relationships

- Add DB migration or repository guards for package relationships on payments/charges.
- Prefer composite tenant-scoped FK if Drizzle/Postgres shape allows.

Verification:

- DB integration test must run and pass.
- Existing memory tests still pass.

## Phase 4: Calendar Safety and Service Boundaries

**Why fourth:** Calendar code has both external I/O risk and architectural concentration.

### 4.1 Google request hardening

- Add timeout/abort support to `googleJson`.
- Redact provider error messages before logging or storing.

### 4.2 Token provenance

- Verify Google token identity/scopes before storing provider tokens.
- Do not mark required scopes granted solely from client submission.

### 4.3 Safe calendar import/sync semantics

- Direct sync failure should surface as failure to direct callers, not just a failed record with HTTP 200.
- Calendar import should not silently overwrite destructive local state; create reconciliation records or require explicit confirmation for destructive changes.

### 4.4 Calendar service split

- Extract token vault/encryption.
- Extract Google provider gateway.
- Extract lesson sync and block sync coordinators.
- Keep compatibility facade to reduce route churn.

Verification:

- API tests with mocked Google responses, timeout, failed sync, token verification.
- `yarn --cwd apps/api test`

## Phase 5: Web State Coherence

**Why fifth:** UI correctness depends on stronger API contracts but can be improved independently.

### 5.1 Auth-scoped CRM cache

- Key module cache by Supabase user/session id.
- Clear on auth state change.
- Avoid rendering prior user's CRM state after account switch.

### 5.2 Coherent mutation responses

- Payment mutation should return enough affected state to update balances/summary.
- Attendance/lesson mutation should return affected lesson/attendance/sync records or force awaited targeted refresh.
- Current-occurrence delete should merge occurrence exceptions or refresh before showing success.

### 5.3 Date/time policy

- Introduce shared local/teacher timezone date helper.
- Replace UTC `toISOString().slice(0, 10)` dashboard fallback logic.

Verification:

- Web hook/model tests.
- Manual smoke for students, lessons, payments, dashboard.

## Phase 6: Shared Domain Policy Consolidation

**Why sixth:** Do this after correctness fixes clarify target behavior.

### 6.1 Billing policy extraction

- Move pure pricing/progress/next-payment calculations into one shared module.
- API DB-backed path, memory path, and web display helpers call the same policy where appropriate.
- Add focused tests for packages, partial payments, voids, KZT/RUB, and duration units.

### 6.2 Dashboard summary extraction

- Extract shared summary calculator or make dashboard summary fully API-owned.
- Remove web fallback recomputation if API summary is required.

### 6.3 `api-types` modularization

- Split source files by domain but keep `index.ts` compatibility exports.
- Do this after schema-aware client work to avoid wide churn.

Verification:

- Existing imports still compile.
- `knip` should not report duplicate/unused exports introduced by split.

## Phase 7: Cleanup, Tooling, and Component Decomposition

**Why last:** These improve maintainability after the invariants are safe.

### 7.1 Dependency and dead-code hygiene

- Add `knip`, `madge`, and `depcheck` scripts/devDeps or equivalent Yarn-native commands.
- Configure intentional shadcn inventory.
- Move `date-fns`, `hono`, and other direct deps to owning package manifests.
- Remove unused web `@teacher-crm/db` dependency if still unused.

### 7.2 Web component decomposition

- Extract `LessonsCalendarPanel` event projection and dialog controllers.
- Extract `LessonFormDialog` validation/conflict model.
- Extract `StudentFormDialog` package form model.

### 7.3 Settings and pet polish

- Make theme provider stale-while-revalidate remote settings.
- Add rollback/pending state for sidebar settings.
- Replace pet target polling with explicit registration or observer-based refresh.

Verification:

- `yarn typecheck`
- `yarn lint`
- `yarn test`
- Browser verification for calendar, payments, students, settings, pet.

## Execution Order for Autonomous Work

1. Phase 1.1, 1.2, 1.3.
2. Phase 2.1, 2.2.
3. Phase 3.1, 3.3.
4. Phase 4.1, 4.2.
5. Phase 5.1, 5.2, 5.3.
6. Phase 6.1.
7. Phase 7.1 quick dependency/lint cleanup.

Defer larger service splits and full `api-types` modularization unless earlier phases are green. They have high blast radius and should be planned as separate GSD phases if the first remediation pass consumes the budget.

## Success Criteria

- No High severity audit finding remains unaddressed or explicitly deferred with rationale.
- Auth and route trust boundaries reject malformed or user-controlled privilege input.
- DB-backed tests run in CI or have a documented required local equivalent.
- Payment/package and lesson/attendance/billing workflows have transaction coverage.
- Web CRM cache is auth-scoped and mutation states are coherent.
- Architecture review warnings are either fixed or converted into concrete follow-up phases.
