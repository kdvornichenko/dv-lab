# Phase 5 Context: Lessons and Attendance

## Scope

Move lessons and attendance from prototype memory-only behavior toward production-shaped API and UI flows.

## Inputs

- Phase 4 established the student service pattern and DB-backed student registry.
- `packages/db` already contains lesson, lesson-student, attendance, and calendar sync schema.
- Existing web UI has a read-only lesson list plus placeholder add/mark actions.

## Decisions

- Lessons and attendance routes use a dedicated service boundary.
- DB-backed route behavior is enabled when `DATABASE_URL` or `POSTGRES_URL` is configured.
- Memory fallback remains for local/test mode without DB.
- Lesson create/edit supports one-on-one and group lessons through `studentIds`.
- Attendance marking supports individual statuses and bulk row submission through the existing API contract.

## Constraints

- Do not start a dev server unless the user asks; ports `3000` and `4000` must stay free.
- Calendar sync records may still be prototype-backed until Phase 6.
- Payments and dashboard may still use memory-backed calculations until their dedicated phases.
