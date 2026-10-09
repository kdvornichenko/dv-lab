# Phase 10: Trust Boundaries and API Contracts - Context

**Gathered:** 2026-05-03
**Status:** Ready for execution
**Mode:** Audit-driven autonomous remediation

<domain>
## Phase Boundary

Harden the first trust boundary pass identified by `apps/api/TECH_DEBT_AUDIT.md`, `apps/web/TECH_DEBT_AUDIT.md`, `ARCHITECTURE_REVIEW.md`, and `TECH_DEBT_REMEDIATION_PLAN.md`.

This phase is limited to:

- API auth role extraction and forbidden response details.
- Shared API route parameter validation for high-value dynamic IDs.
- Additive schema-aware response parsing in the web API client.

It should not perform large calendar-service, persistence-transaction, or component-decomposition refactors. Those are later phases.
</domain>

<decisions>
## Implementation Decisions

- `rolesFromUser` must ignore `user_metadata.roles`; only `app_metadata.roles` and configured teacher-email fallback are trusted.
- Forbidden responses may include method, path, and required permission, but must not return user ID, email, role list, or permission list to clients.
- Server-side permission denial logs can keep diagnostic detail, but existing sanitization/redaction conventions must be preserved.
- Route param validation should reuse Zod and existing `VALIDATION_FAILED` error shape.
- Web response parsing must be opt-in/additive to avoid breaking all `apiRequest` callers in one change.
  </decisions>

<code_context>

## Existing Code Insights

- `apps/api/src/middleware/auth.ts`
  - `rolesFromUser` currently combines `app_metadata.roles` and `user_metadata.roles`.
  - `requirePermission` returns the same diagnostic object to logs and client.
- `apps/api/src/http/validation.ts`
  - Existing `validateJson` and `validateQuery` use `@hono/zod-validator` and `VALIDATION_FAILED`.
- `apps/web/lib/crm/api.ts`
  - `apiRequest<T>` is used broadly by CRM load, hooks, settings, pet, theme, and error-log flows.
  - GitNexus marks `apiRequest` as CRITICAL risk, so default behavior must stay backward compatible.

## GitNexus Impact Notes

- `rolesFromUser`: LOW risk; direct caller is `apiUserFromSupabase`.
- `validateJson`: MEDIUM risk; direct route users include students, settings, payments, lessons, errors, and calendar.
- `validateQuery`: LOW risk; direct route users include students and lessons.
- `apiRequest`: CRITICAL risk; affected flows include `useTeacherCrmData`, `useTeacherCrmCommands`, `useTeacherCrmCalendar`, settings, pet, theme, and error-log imports. Treat changes as additive and schema opt-in.
  </code_context>

<specifics>
## Specific Work

1. Harden trusted role extraction and permission-denied client details.
2. Add param validation helper(s) and shared param schemas.
3. Apply param validation to routes with dynamic IDs where direct malformed IDs currently reach services.
4. Add optional response schema parsing to `apiRequest`.
5. Start response parsing with core load endpoints and one or two representative mutation/settings paths.
6. Add or update focused tests.
   </specifics>

<deferred>
## Deferred Ideas

- Full API types modularization belongs to Phase 15.
- Full web client schema coverage for every endpoint can continue incrementally after the wrapper contract exists.
- Calendar token provenance and sync safety belong to Phase 13.
  </deferred>
