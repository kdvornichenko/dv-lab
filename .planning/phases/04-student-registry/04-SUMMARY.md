# Phase 4 Summary: Student Registry

**Status:** Complete
**Updated:** 2026-04-25

## Delivered

- Added shared `listStudentsQuerySchema` contract for status/search filtering.
- Added Hono query validation with typed validation error details.
- Added DB-backed student repository functions in `packages/db`.
- Added API student service that resolves Supabase auth users to `teacher_profiles.auth_user_id`.
- Kept tenant-scoped memory fallback for local development and API tests without a DB.
- Updated student routes to use async service methods; archive now flows through `PATCH /students/:studentId` with archive permission enforcement.
- Added API smoke coverage for student create, update, archive, and filtered list.
- Added student search/status filters in the web registry.
- Replaced placeholder add behavior with create/edit dialogs.
- Added student profile pane with contact, billing, notes, lesson count, attendance count, and balance.
- Added Yarn supported architectures for Linux/Windows native packages so WSL and PowerShell installs both work.
- Added Supabase-friendly DB SSL handling for `sslmode=require` connection strings.

## Verification

- `yarn format:check`
- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `TURBO_DAEMON=false yarn build`

## Notes

- Browser smoke was not run because the user asked to stop my dev servers and keep ports free.
- Phase 5 should move lessons/attendance from memory-backed prototype routes to DB-backed services.
