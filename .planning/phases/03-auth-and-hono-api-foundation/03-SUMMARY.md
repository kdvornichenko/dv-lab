# Phase 3 Summary: Auth and Hono API Foundation

**Status:** Complete
**Updated:** 2026-04-25

## Delivered

- Next.js workspace guard is backed by `supabase.auth.getUser()`.
- Login page signs in through Supabase Google OAuth only.
- Google OAuth requests Calendar scopes up front so the signed-in account is the calendar account.
- Hono `optionalAuth` verifies bearer tokens via Supabase Auth.
- Hono `requireAuth` protects route groups and rejects missing/invalid auth.
- Hono protected route groups enforce route-level RBAC permissions.
- API calendar connection derives the account email from the authenticated user, not request body email.
- API calendar connection exposes required/granted scopes and remains `authorization_required` unless Calendar authorization is verified.
- Web dashboard uses a typed Hono API client instead of duplicating CRM mutations in browser state.
- Root workspace uses Yarn 4 through Corepack with `nodeLinker: node-modules`.
- Added API contract smoke test for health, unauthenticated rejection, and explicit demo auth.

## Verification

- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn build`
- API smoke start on `PORT=4100` with `/healthz` returning 200.

## Follow-Up

- Add DB-backed repositories for Hono routes.
- Persist and refresh Google provider tokens for real Calendar event sync in Phase 6.
- Resolve Supabase auth user id to `teacher_profiles.id` before replacing the memory store.
