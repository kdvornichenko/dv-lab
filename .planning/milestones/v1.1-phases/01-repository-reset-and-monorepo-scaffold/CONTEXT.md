# Phase 1 Context: Repository Reset and Monorepo Scaffold

## Goal

Reset the current `dv-lab` codebase into a Turborepo monorepo while preserving only the Supabase connection contract needed for the new Teacher English CRM.

## Locked Decisions

- Existing wishlist, Google Calendar, uploader, schedule, and profile app code is legacy and should be removed from the active product.
- Keep Supabase connection/auth as the retained backend boundary.
- Target layout:
  - `apps/web`
  - `apps/api`
  - `packages/db`
  - `packages/rbac`
  - `packages/api-types`
- Root scripts delegate to `turbo run`; package-local scripts contain task logic.
- Package manager in this workspace is Yarn 1.22.22, so internal workspace dependencies use `*` instead of `workspace:*`.

## Supabase Preservation Inventory

Existing retained items:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`
- `POSTGRES_HOST`
- `NEXT_PUBLIC_API_KEY` (legacy Google API key; preserve only if still needed after redesign)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_DISCOVERY_DOC` (legacy; likely not needed after redesign)
- `NEXT_PUBLIC_SCOPES` (legacy; replace with server-owned scope config if possible)

Existing Supabase client shape:

- `libs/supabase/supabaseClient.ts`
- Uses `@supabase/supabase-js`
- Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

New intended location:

- `apps/web/lib/supabase/client.ts`
- `apps/web/lib/supabase/server.ts`
- `apps/web/lib/supabase/middleware.ts`
- `packages/db/src/factory.ts`
- `apps/api/src/routes/google-calendar.ts`
- `apps/api/src/services/google-calendar.ts`

## Scope

### In

- Remove legacy app files from active source tree.
- Create monorepo root config.
- Create empty/compilable Next.js and Hono app shells.
- Create shared package directories and basic package metadata.
- Add Supabase utility plan/placeholder files.

### Out

- Full DB schema.
- Full RBAC model.
- Product feature implementation.
- Browser QA.
- Google Calendar implementation.

Those are later phases.

## Verification

- `yarn install`
- `yarn typecheck`
- `yarn lint`
- `yarn build` if feasible after app shells are in place
