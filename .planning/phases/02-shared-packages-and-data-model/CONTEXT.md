# Phase 2 Context: Shared Packages and Data Model

## Scope

Adapt domain-neutral package patterns from `/mnt/g/its/its-doc` into the new Teacher English CRM namespace.

## Delivered Scope

- `packages/api-types`: shared Zod schemas and inferred types for students, lessons, attendance, payments, dashboard, and calendar sync.
- `packages/rbac`: teacher CRM permission domains, `teacher` and `assistant` roles, and `can` helpers.
- `packages/db`: Drizzle schema for Supabase Postgres, DB factory, and ledger calculation helper.
- Package builds use ITS-DOC-style `tsup` ESM/CJS + declarations.

## Out of Scope for This Phase

- Applying migrations to a live Supabase project.
- Replacing the API memory store with DB repositories. That belongs to the next data-backed feature pass.
