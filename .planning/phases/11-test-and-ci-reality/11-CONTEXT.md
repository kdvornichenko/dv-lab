# Phase 11: Test and CI Reality - Context

**Gathered:** 2026-05-03
**Status:** Ready for execution
**Mode:** Audit-driven autonomous remediation

<domain>
## Phase Boundary

Make the project verification path explicit enough that DB-backed persistence regressions cannot be mistaken for green memory-only tests.
</domain>

<decisions>
## Implementation Decisions

- Keep local `yarn test` developer-friendly by running memory tests plus optional DB integration.
- Add a required DB integration script for CI and explicit local use.
- Make CI set `TEACHER_CRM_REQUIRE_DB_TESTS=1` so missing DB configuration fails.
- Add audit scripts as non-blocking commands first; cleanup/gating belongs to later phases.
  </decisions>

<code_context>

## Existing Code Insights

- `apps/api/src/db.integration.test.ts` currently skips when `TEACHER_CRM_TEST_DATABASE_URL` is missing.
- `apps/api/package.json` currently exposes one `test` script that runs both memory and optional DB integration.
- There is no existing `.github/workflows` CI workflow.
- `packages/db` already has Drizzle migrations and `db:migrate`.
  </code_context>

<specifics>
## Specific Work

1. Split API memory, optional DB, and required DB test scripts.
2. Fail DB integration when `TEACHER_CRM_REQUIRE_DB_TESTS=1` or `CI=true` and no test DB URL exists.
3. Add root convenience scripts for API DB tests, pet tests, dependency audit, cycle audit, and dead-code audit.
4. Add CI workflow with Postgres, immutable Yarn install, migration, typecheck, lint, memory tests, DB tests, web pet tests, full test, build, and non-blocking audit commands.
   </specifics>

<deferred>
## Deferred Ideas

- Making `knip`, `madge`, and dependency audit hard gates is deferred until Phase 16 cleanup reduces known findings.
  </deferred>
