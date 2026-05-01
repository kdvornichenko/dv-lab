# Architecture Research: Teacher English CRM

**Date:** 2026-04-25

## Repository Baseline

Current `/mnt/g/dv-lab` is a single Next.js project with legacy wishlist/schedule/uploader/profile routes, Google API service/store code, Drizzle files, and a minimal Supabase client. The user wants this reset.

Retain:

- Supabase environment contract.
- Supabase client intent.
- Useful shadcn/Tailwind/Next 16 familiarity from existing package setup.

Discard:

- Wishlist domain.
- Google API service/store.
- Current route tree.
- Current Drizzle schema unless a specific table is explicitly preserved later.

## GitNexus and itsdoc-arch Evidence

- `npx gitnexus status` in `/mnt/g/dv-lab` failed with `Cannot destructure property 'package' of 'node.target' as it is null`.
- `npx gitnexus analyze` in `/mnt/g/dv-lab` produced the same failure.
- `npx gitnexus status` in `/mnt/g/its/its-doc` was attempted as requested via `npx`; it did not complete during the research window.
- Because GitNexus did not return graph data, architectural conclusions here are based on direct repository inspection with `rg`, `find`, and file reads. Confidence is medium for local package shape and low for graph/impact relationships.
- `arxitect:architecture-review` was read and applied locally as a read-only lens; sub-agent reviewers were not spawned because this turn did not explicitly request parallel subagents.

## Target Architecture

```text
dv-lab/
  apps/
    web/
      app/
      components/
      features/
      lib/
      styles/
    api/
      src/
        routes/
        services/
        middleware/
        config/
        index.ts
  packages/
    api-types/
      src/
    db/
      src/
        schema.ts
        factory.ts
      drizzle/
    rbac/
      src/
    eslint-config/
    typescript-config/
  turbo.json
  package.json
```

## Layering

### Web

- App Router pages/layouts compose feature containers.
- Feature containers own data loading, mutation orchestration, and UI state.
- Presentation components render view-models and local UI interactions only.
- `components/ui` stays shadcn-only/generic and does not import domain APIs, DB, RBAC, or Supabase transport.
- Tables use stable column definitions and fixed responsive constraints to avoid layout jumps.

### API

- Hono app composes route modules.
- Middleware handles request IDs, CORS, auth session extraction, RBAC guard helpers, and error normalization.
- Route handlers validate input with Zod, call services, and return typed responses.
- Services call `packages/db`; they do not import web code.
- Shared response/request schemas live in `packages/api-types`.

### DB

- `packages/db` owns Drizzle schema and connection factory.
- Schema should be teacher-CRM-specific:
  - `profiles` or `users`
  - `students`
  - `student_contacts`
  - `lessons`
  - `lesson_students`
  - `attendance_records`
- `payments`
- `billing_accounts` or computed ledger view
- `calendar_connections`
- `calendar_sync_events`
- `audit_events` later if needed
- For v1, tenant isolation is enforced in the Hono API and Drizzle repositories through `teacher_id` filters while the server uses privileged database credentials.
- Supabase RLS is deferred until the product introduces direct browser-to-database access or untrusted DB clients. If that changes, add RLS migrations before exposing those clients.

### RBAC

Adapt ITS-DOC `@its-doc/rbac` into teacher CRM domains:

- `students`: `read`, `write`, `archive`
- `lessons`: `read`, `write`, `cancel`
- `attendance`: `read`, `mark`, `edit`
- `payments`: `read`, `write`, `adjust`
- `calendar`: `read`, `connect`, `sync`
- `dashboard`: `read`
- `settings`: `manage`
- `rbac`: `read`, `write`

Initial roles:

- `admin` or `teacher`: all permissions.
- `assistant`: read students/lessons/dashboard and mark attendance, no payment adjustment by default.

## Reuse Assessment: `/mnt/g/its/its-doc`

### `packages/rbac`

Good candidate. It already has permission domain modeling, `ROLE_REGISTRY`, `buildPermissionSet`, `normaliseRoleKeys`, and `can`. Replace domains and role grants, keep pure permission mechanics.

### `packages/db`

Good package shape. Keep factory/build approach, replace schema. ITS-DOC schema is unrelated to teacher CRM.

### `packages/api-types`

Good package shape. Keep Zod contract pattern, replace auth/document-specific types.

### `app/server`

Do not reuse directly. It is Express with middleware/routes for docs/workload/Bitrix24. Use only ideas such as health checks, env validation, contract tests, and logging approach.

## Data Flow

1. Browser requests protected page in `apps/web`.
2. Next `proxy.ts` refreshes Supabase session cookies where needed.
3. Server Component gets session/user state and renders shell.
4. Client feature container calls Hono API for mutations and interactive table data.
5. Hono validates JWT/session, checks RBAC, validates payload via Zod, writes through Drizzle to Supabase Postgres.
6. Lesson mutations trigger idempotent Google Calendar sync through the Hono service boundary.
7. Web refetches affected dashboard/table data.

## Architecture Risks

- Mixing Supabase direct client writes from web with Hono writes can split authorization logic. Pick a primary mutation boundary for each table.
- Copying ITS-DOC packages without deleting domain-specific schema/contracts will drag legacy concepts into the new product.
- Using Server Actions and Hono for the same mutation class can duplicate validation and cache invalidation.
- Payment ledger must be append-friendly; avoid destructive balance overwrites.
- Attendance and payments have business coupling; schema should support corrections without losing history.
- Google Calendar sync must store external event IDs and token metadata server-side; browser code must not own refresh tokens.
