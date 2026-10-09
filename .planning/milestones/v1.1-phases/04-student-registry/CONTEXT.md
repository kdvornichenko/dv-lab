# Phase 4 Context: Student Registry

## Scope

Make the student registry production-shaped instead of a prototype-only list.

## Inputs

- Phase 3 delivered authenticated Hono routes and a typed web API client.
- `packages/db` already defines `teacher_profiles` and `students`.
- Current route implementation still falls back to a tenant-scoped memory store.

## Decisions

- The Hono student route owns the API boundary and validation.
- `apps/api/src/services/student-service.ts` owns repository selection and hides the memory fallback.
- When `DATABASE_URL` or `POSTGRES_URL` is configured, student operations use Drizzle and Supabase Postgres.
- Incoming Supabase Auth user id is resolved to `teacher_profiles.auth_user_id`; route callers keep using the existing actor scope.
- Web state keeps server data in `useTeacherCrm`; presentation components receive data and callbacks only.

## Constraints

- Local development must still work without a configured database.
- Student archive changes status and preserves history.
- Frontend must not duplicate server-side persistence logic.
