# Phase 10: Trust Boundaries and API Contracts - Summary

**Completed:** 2026-05-03
**Status:** Complete

## What Changed

- Removed `user_metadata.roles` from trusted API role extraction.
- Split server-side permission-denied diagnostic logging from client-safe `FORBIDDEN` response details.
- Added shared CRM route ID param schemas in `packages/api-types`.
- Added API param validation middleware using the existing `VALIDATION_FAILED` response shape.
- Applied malformed ID validation to student, lesson, payment, calendar block, and error routes.
- Added optional schema-aware parsing to the web `apiRequest` wrapper.
- Enabled schema parsing for core CRM load endpoints, payments/dashboard supplements, and selected settings endpoints.

## Tests

- Added auth regression coverage for ignored user metadata roles and safe forbidden details.
- Added malformed route parameter tests for representative protected routes.
- Verified with API tests, web typecheck, root typecheck, root lint, root test, and diff whitespace checks.

## Notes

- GitNexus impact before edits:
  - `rolesFromUser`: LOW.
  - `validateJson`: MEDIUM.
  - `validateQuery`: LOW.
  - dynamic route targets: LOW.
  - `apiRequest`: CRITICAL, so schema parsing was added as an opt-in argument without changing default caller behavior.

## Next

Phase 11 should make DB-backed testing and CI gates explicit so persistence work in Phase 12 has a real safety net.
