# Phase 3 Context: Auth and Hono API Foundation

## Scope

Establish authenticated web and API boundaries on top of retained Supabase connectivity.

## Delivered Scope

- Supabase browser/server clients for Next.js App Router.
- `proxy.ts` session refresh integration.
- Supabase Google OAuth login with Calendar scopes requested at sign-in.
- Server-side workspace route guard that redirects unauthenticated users to `/login`.
- Hono app with CORS, logging, health, auth, students, lessons, payments, calendar, and dashboard route groups.
- Hono auth middleware verifies Supabase bearer tokens and allows explicit `x-demo-user` only outside production.
- Protected Hono routes reject unauthenticated requests and enforce route-level RBAC permissions.
- Calendar connection uses the authenticated Google account email instead of a separately entered email.
- Calendar connection exposes required/granted scopes and does not report `connected` without verified token availability.
- Web workspace dashboard uses typed Hono API calls for read/mutation flows.

## Still Pending

- Production RBAC role assignment must be defined in Supabase metadata or a teacher profile table.
- Phase 6 must persist/use Google provider tokens server-side and perform idempotent event upserts.
