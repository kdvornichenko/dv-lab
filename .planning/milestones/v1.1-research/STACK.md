# Stack Research: Teacher English CRM

**Date:** 2026-04-25

## Recommended Stack

### Monorepo

- Turborepo with Yarn workspaces or pnpm workspaces.
- Layout:
  - `apps/web` - Next.js 16 App Router UI.
  - `apps/api` - Hono Node.js API.
  - `packages/db` - Drizzle schema, migrations, Supabase Postgres connection helpers.
  - `packages/rbac` - role/permission primitives.
  - `packages/api-types` - Zod schemas and shared request/response types.
  - `packages/ui` - optional shared UI only if more than one UI app appears; otherwise keep shadcn components in `apps/web/components/ui`.

Turborepo docs emphasize workspace structure and package tasks; the local Turborepo skill also requires root scripts to delegate via `turbo run`, with build/lint/typecheck scripts defined inside packages.

### Web

- Next.js 16 App Router with React 19.
- Turbopack is the default dev bundler in Next.js 16; use `next dev` or explicit `next dev --turbopack` if the scaffold does so.
- Server Components by default for data-loading pages.
- Client Components for forms, tables, dialogs, filters, and interactive attendance/payment edits.
- Next.js Server Actions are viable for same-app mutations, but with a separate Hono API the primary mutation path should be typed API calls. Use Server Actions only where they simplify auth-bound form flows.
- `proxy.ts` replaces `middleware.ts` in Next.js 16 and is the right place for Supabase auth token refresh/optimistic redirects, not heavy authorization logic.

### Styling and UI

- Tailwind CSS 4 with `@tailwindcss/postcss` and `@import "tailwindcss"` in global CSS.
- shadcn/ui for accessible primitives and ownership of component source code.
- lucide-react for icons.
- TanStack Table for student/payment/attendance tables when sorting/filtering/column visibility becomes non-trivial.
- React Hook Form plus Zod for complex client forms; plain controlled fields are acceptable for small dialogs.

### API

- Hono on Node.js using `@hono/node-server`.
- Zod validation via `@hono/zod-validator`.
- Hono RPC/types can be considered after route structure is stable. It requires strict TypeScript settings across server and client.
- API should expose health, auth/session, students, lessons, attendance, payments, dashboard summaries.

### Data and Supabase

- Supabase remains the retained backend boundary.
- Use `@supabase/supabase-js` and `@supabase/ssr` in the web app for browser/server clients.
- Use Supabase Postgres as the database.
- Use Drizzle in `packages/db` for schema/migrations/query helpers if we adapt the ITS-DOC DB package; otherwise use Supabase client for simple CRUD. Because Hono server exists, Drizzle is the cleaner server-side DB layer.
- Generate Supabase TypeScript types when the remote/local schema exists.
- Enable RLS on Supabase tables. Even if the Hono API is the main gateway, RLS protects direct Supabase client access.

### Reusable Local Packages

From `/mnt/g/its/its-doc`:

- `packages/rbac` - good structure for permission domains, roles, `can`, and permission-set construction. Needs domain rewrite from docs/workload to teacher CRM domains.
- `packages/db` - useful Drizzle package shape (`schema.ts`, `factory.ts`, tsup build), but schema is ITS-DOC-specific and must be replaced.
- `packages/api-types` - useful package shape for shared Zod contracts. Existing auth shape is ITS-DOC-specific and should be replaced.

Do not copy `app/server` directly: it is Express, not Hono.

## Current Package Direction

- Prefer TypeScript strict mode in all packages.
- Use Zod schemas at API boundary and form boundary.
- Use `drizzle-kit` migrations for Supabase Postgres.
- Keep direct service-role Supabase keys out of browser code.
- Keep `NEXT_PUBLIC_SUPABASE_URL` and a publishable/anon key in web env; server env may use `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and/or JWT verification settings depending on auth implementation.

## Sources Checked

- Next.js 16 release: https://nextjs.org/blog/next-16
- Next.js Proxy docs: https://nextjs.org/docs/app/getting-started/proxy
- Next.js Forms docs: https://nextjs.org/docs/app/guides/forms
- Next.js caching/revalidation docs: https://nextjs.org/docs/app/getting-started/caching-and-revalidating
- Tailwind CSS Next.js guide: https://tailwindcss.com/docs/guides/nextjs
- Tailwind CSS v4 release: https://tailwindcss.com/blog/tailwindcss-v4
- shadcn/ui Next.js install: https://ui.shadcn.com/docs/installation/next
- shadcn/ui forms: https://ui.shadcn.com/docs/forms/react-hook-form
- Supabase Next.js SSR: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase TypeScript types: https://supabase.com/docs/guides/api/rest/generating-types
- Turborepo Next.js guide: https://turborepo.com/repo/docs/guides/frameworks/nextjs
- Turborepo workspaces: https://turborepo.com/repo/docs/handbook/workspaces
- Hono Node.js: https://hono.dev/docs/getting-started/nodejs
- Hono validation: https://hono.dev/guides/validation
- Hono RPC: https://hono.dev/docs/guides/rpc
- TanStack Table React: https://tanstack.com/table/v8/docs/framework/react/react-table
