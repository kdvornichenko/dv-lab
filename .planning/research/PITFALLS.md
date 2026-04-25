# Pitfalls Research: Teacher English CRM

**Date:** 2026-04-25

## Stack Pitfalls

- Next.js 16 uses `proxy.ts` terminology. Creating new auth middleware as `middleware.ts` would already be behind current conventions.
- Supabase SSR auth needs separate browser/server clients and cookie handling. Relying on `getSession()` in server code is not a secure authorization check; use verified user/claims flow.
- Tailwind CSS 4 uses CSS-first setup. Bringing old Tailwind 3 config habits can add unnecessary configuration.
- shadcn/ui is source code in the repo, not a runtime component package. Keep generated UI components local and generic.
- Hono RPC type inference requires strict TypeScript across server and client. If strict mode is not enabled consistently, types degrade.
- Turborepo caching requires correct `outputs`; root scripts should delegate to package tasks.

## Domain Pitfalls

- Payment balance as a mutable field is fragile. Prefer ledger entries and computed summaries, with optional cached balances later.
- Attendance correction needs history or at least updated metadata; teachers often fix marks after class.
- Group lessons create many-to-many attendance records. Do not model a lesson as belonging to exactly one student.
- Billing models differ: per lesson, monthly fixed fee, prepaid packages. v1 UI can be simple, but schema should not block packages later.
- Deleting students can corrupt reports. Archive students instead.
- Time zones and lesson dates should be explicit; store timestamps and display in teacher locale.

## Migration/Reuse Pitfalls

- `g:/its/its-doc/packages/db` has a large unrelated schema. Use its package structure and factory pattern, not the schema.
- `g:/its/its-doc/packages/rbac` domain names are docs/workload/integrations-specific. Rename/redefine domains before integrating into the app.
- `g:/its/its-doc/app/server` is Express. Reusing it wholesale would violate the Hono requirement.
- Copying package names as `@its-doc/*` would leak old product identity. Rename to `@teacher-crm/*` or `@repo/*`.

## UX Pitfalls

- Dashboard must be work-first and dense enough for repeated use. Avoid landing-page hero layouts.
- Payment/attendance status needs fast scan patterns: badges, compact tables, filters, and stable columns.
- Do not hide critical debt/absence state behind nested cards.
- Forms need clear defaults and fast entry. The teacher should not fight large modal flows for routine attendance/payment updates.

## Verification Pitfalls

- A green `next build` is not enough. Need package typecheck/lint plus at least contract tests for API schemas and ledger calculations.
- Need manual browser QA for responsive dashboard/table views because this is an operational UI.
- Need seed data for students, lessons, payments, and attendance to test real flows.
