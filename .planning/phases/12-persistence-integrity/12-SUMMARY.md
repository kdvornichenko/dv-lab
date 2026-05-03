# Phase 12: Persistence Integrity - Summary

**Completed:** 2026-05-03
**Status:** Complete

## What Changed

- Wrapped DB-backed payment/package creation in one Drizzle transaction context.
- Wrapped DB-backed payment void plus package cancellation in one transaction context.
- Wrapped DB-backed lesson create/update, attendance status sync, and billing charge sync in one transaction context.
- Added service-level attendance roster enforcement for memory and DB paths.
- Added API error handling so out-of-roster attendance returns `400 VALIDATION_FAILED`.
- Added memory API regression coverage for rejecting attendance from a student not enrolled in the lesson.

## Tests

- `yarn --cwd apps/api test:memory`
- `yarn --cwd apps/api typecheck`
- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `git diff --check`

## Notes

- DB integration was not run locally because `TEACHER_CRM_TEST_DATABASE_URL` is unset.
- Phase 11 CI wiring makes DB integration required in CI with a Postgres service.
