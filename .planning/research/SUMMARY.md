# Research Summary: Teacher English CRM

**Date:** 2026-04-25

## Key Findings

- The target should be a clean Turborepo monorepo, not an in-place refactor of the current single Next app.
- Keep Supabase as the auth/data boundary, but modernize the web integration to `@supabase/ssr` with `proxy.ts`.
- Hono should be the new API surface. ITS-DOC server code is Express and should not be copied directly.
- ITS-DOC `packages/rbac`, `packages/db`, and `packages/api-types` are useful as package patterns and partial code sources.
- v1 should solve manual operational control: students, lessons, attendance marks, manual payments, balances, dashboard.
- Google Calendar must stay in v1, but as a clean server-mediated OAuth and lesson sync integration.
- Online payments, student portal, homework, and messaging automation should stay out of v1.

## Recommended Build Order

1. Reset repository and scaffold Turborepo.
2. Port/adapt shared packages from ITS-DOC.
3. Establish Supabase auth/session and Hono health/auth boundary.
4. Build domain DB schema and seed data.
5. Implement student registry.
6. Implement lessons and attendance.
7. Rebuild Google Calendar connection and idempotent lesson event sync.
8. Implement payments and balance summaries.
9. Build dashboard and polish operational UI.

## Stack Additions

- `turbo`
- `hono`, `@hono/node-server`, `@hono/zod-validator`
- `zod`
- `drizzle-orm`, `drizzle-kit`, `pg`
- `@supabase/supabase-js`, `@supabase/ssr`
- `@tanstack/react-table`
- `react-hook-form`, `@hookform/resolvers`
- Google API client/server integration dependencies after the OAuth implementation plan confirms exact package choice.
- shadcn/ui components as needed: button, input, field/form, table, dialog, sheet, dropdown-menu, select, tabs, badge, card, calendar/date picker, popover, tooltip, skeleton, sonner.

## Watch Outs

- Do not let legacy wishlist/Google/schedule code survive the reset unless explicitly selected.
- Do not preserve the old Google Calendar implementation; preserve the product requirement and env contract, then rebuild the integration.
- Do not mix payment balance overwrites with ledger history.
- Do not put domain API logic into shadcn UI primitives.
- Do not split the same mutation between Server Actions and Hono without a clear reason.
- Do not trust GitNexus graph data for this research pass; CLI did not successfully return status/analyze for `dv-lab`.
