# Phase 11: Test and CI Reality - Summary

**Completed:** 2026-05-03
**Status:** Complete

## What Changed

- Split API tests into `test:memory`, `test:db`, and `test:db:optional`.
- Made DB integration tests fail when `TEACHER_CRM_REQUIRE_DB_TESTS=1` or `CI=true` and no test DB URL is configured.
- Added root scripts for API memory tests, API DB tests, web pet tests, dependency audit, cycle audit, and dead-code audit.
- Added `TEACHER_CRM_REQUIRE_DB_TESTS` and `TEACHER_CRM_TEST_DATABASE_URL` to Turbo global env.
- Added `.github/workflows/ci.yml` with Postgres, migrations, immutable install, typecheck, lint, tests, build, and non-blocking audits.

## Tests

- `yarn --cwd apps/api test:memory`
- `yarn --cwd apps/api test:db:optional`
- `TEACHER_CRM_REQUIRE_DB_TESTS=1 yarn --cwd apps/api test:db` expected failure without DB URL
- `yarn typecheck`
- `yarn lint`
- `yarn test`

## Next

Phase 12 can now add transaction and persistence integrity coverage against a required DB path in CI.
