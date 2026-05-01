# Tech Debt Audit

Date: 2026-05-01

## Executive Summary

- The biggest real risk is security/config hygiene: the local workspace contains live-looking OAuth, database, JWT, and service-role secrets in `.env.local`; even though the file is ignored, the current working copy is not safe to share or archive as-is.
- Auth/RBAC does not match the planning note that RBAC "fails closed": users without Supabase roles become `teacher`, and the `teacher` role bypasses explicit permission checks.
- The API silently falls back to a global in-memory store whenever `DATABASE_URL`/`POSTGRES_URL` is absent. That is useful for tests, but unsafe as a production default because writes can appear successful and disappear on restart.
- Billing rules exist in at least three places: shared contracts, `billing-service`, and `memory-store`. The duplicated code is already large enough that fixes can drift between DB-backed and memory-backed behavior.
- Critical DB-backed service methods repeatedly load whole tenant tables to handle one payment, student, lesson, or balance request. That is acceptable for a prototype, but it will become the first scaling wall.
- The calendar integration works through server-side tokens, but token capture still starts in browser code and the server accepts a client-provided provider account email.
- There is no integration test that exercises the real Drizzle repositories against Postgres. The large API smoke test intentionally forces `db: null`, so the most important storage path is not covered.
- Several user-facing operations hard-delete business records (`payments`, `students`, `lessons`) instead of recording reversals/corrections. That is weak for a financial/attendance ledger.
- The web app loads CRM data through partial-failure fallbacks that can render empty or stale sections instead of failing visibly.
- The codebase passes `yarn typecheck`, `yarn test`, `yarn lint`, and `yarn npm audit --recursive`, so this audit is about design and operational debt, not current build breakage.

## Architectural Mental Model

This repo is now a Turborepo Teacher CRM. `apps/web` is a Next.js 16 App Router UI with client-heavy CRM screens, Supabase session handling, and a Hono API mounted through `apps/web/app/api/[[...route]]/route.ts`. `apps/api` owns the Hono route modules, auth middleware, services, and Google Calendar integration. `packages/api-types` owns the shared Zod contracts and business constants. `packages/db` owns the Drizzle schema and repository helpers for Supabase Postgres. `packages/rbac` owns static role/permission mechanics.

The intended architecture in docs is API routes validating with Zod, services calling `packages/db`, and user-owned rows protected through Supabase/RBAC. The implementation mostly follows this, but still has a prototype mode running through `memory-store`, duplicated domain rules in web/API/memory code, and a few places where the planning docs say "fails closed" while code fails open.

## Tooling Notes

- `gitnexus analyze` was run directly and refreshed `dv-lab` to HEAD `e580a4c` with 1,261 nodes, 3,622 edges, and 94 flows.
- `npx gitnexus analyze` fails in this workspace with the known WSL/npm path issue already noted in `.planning/STATE.md:86`; direct `gitnexus analyze` works.
- `yarn typecheck`: passed.
- `yarn test`: passed.
- `yarn lint`: passed.
- `yarn npm audit --recursive`: no audit suggestions.
- `knip`, `madge`, and `depcheck` were requested by the audit protocol but are not installed in this workspace; I did not install them globally.

## Findings Table

| ID     | Category              |                                                File:Line | Severity | Effort | Description                                                                                                                                                                              | Recommendation                                                                                                                |
| ------ | --------------------- | -------------------------------------------------------: | -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| TD-001 | Security hygiene      |                                           `.env.local:2` | Critical | S      | Local env contains a Google OAuth client id. This is not secret by itself, but it anchors the exposed client secret next to it.                                                          | Rotate the OAuth client secret, keep `.env.local` out of shared artifacts, and add a redacted `.env.example`.                 |
| TD-002 | Security hygiene      |                                           `.env.local:3` | Critical | S      | Local env contains a Google OAuth client secret. Do not treat this workspace as sanitized.                                                                                               | Rotate this Google credential before any real use, then replace the local file with fresh private values.                     |
| TD-003 | Security hygiene      |                                           `.env.local:9` | Critical | S      | Local env contains a Postgres connection URL with credentials.                                                                                                                           | Rotate the database password and verify no copied terminal logs or artifacts preserve it.                                     |
| TD-004 | Security hygiene      |                                          `.env.local:14` | Critical | S      | Local env contains the Supabase JWT secret.                                                                                                                                              | Rotate the Supabase JWT secret if this workspace has been shared or synced outside the machine.                               |
| TD-005 | Security hygiene      |                                          `.env.local:19` | Critical | S      | Local env contains a Supabase service-role key.                                                                                                                                          | Rotate the service-role key and never load it into browser-facing code or docs.                                               |
| TD-006 | Auth/RBAC             |                     `apps/api/src/middleware/auth.ts:62` | High     | S      | Missing Supabase roles default to `teacher`, while `.planning/STATE.md:90` says production must assign roles and RBAC fails closed.                                                      | Change the default to no roles or a read-only role in production; only allow demo defaults in explicit test/dev mode.         |
| TD-007 | Auth/RBAC             |                    `apps/api/src/middleware/auth.ts:133` | High     | S      | `teacher` bypasses permission checks even though permissions are already materialized on the user. That makes scoped roles less meaningful and hides policy bugs.                        | Remove the role-name bypass and rely on `can(new Set(user.permissions), domain, action)` for all roles.                       |
| TD-008 | Type debt             |                     `apps/api/src/middleware/auth.ts:85` | Medium   | S      | Hono middleware is typed with `any` generics. Auth is a boundary where weak typing makes context variables and response behavior easier to misuse.                                       | Define a local Hono env type with `Variables` and use it in `createMiddleware`.                                               |
| TD-009 | Config debt           |                                 `apps/api/src/app.ts:20` | Medium   | S      | CORS has hard-coded production domains plus env-derived origins. This creates two sources of truth for deploy environments.                                                              | Move all non-localhost origins into env/config and document them in README or deployment docs.                                |
| TD-010 | Observability         |                                `apps/api/src/app.ts:107` | Medium   | S      | The global error handler logs raw errors and returns a generic body without request id, route, user id, or structured severity.                                                          | Add request IDs and structured error logging with redaction, then include the request id in API errors.                       |
| TD-011 | Architecture          |            `apps/api/src/services/storage-context.ts:13` | High     | M      | If no scoped memory store is present, the API uses the global `memoryStore`. Combined with `getDb()` returning null when DB env is missing, production can run with ephemeral storage.   | Make memory storage an explicit test/dev option; fail startup in production when the DB URL is absent.                        |
| TD-012 | Architecture          |           `apps/api/src/services/student-service.ts:217` | High     | M      | Student writes fall back to memory storage whenever `getDb()` returns null. The same fallback exists across lesson/payment/calendar services.                                            | Centralize storage selection and fail closed outside tests.                                                                   |
| TD-013 | Architectural decay   |              `apps/api/src/services/memory-store.ts:320` | Medium   | L      | `memoryStore` is an 878-line alternate implementation of the CRM backend. It now contains student, lesson, billing, calendar, settings, and error-log logic.                             | Keep memory storage only as a thin fake implementing a repository interface, or delete it once DB integration tests exist.    |
| TD-014 | Consistency rot       |              `apps/api/src/services/memory-store.ts:170` | High     | M      | Package consumption and next-payment logic are duplicated in memory storage and in `billing-service`.                                                                                    | Extract billing calculation into one pure package and have both DB and memory adapters call it.                               |
| TD-015 | Consistency rot       |           `apps/api/src/services/billing-service.ts:196` | High     | M      | `packageProgress` duplicates the same business behavior as `memory-store`, increasing drift risk for payment reminders and balances.                                                     | Move package progress/next-payment calculation into shared tested functions.                                                  |
| TD-016 | Performance           |           `apps/api/src/services/student-service.ts:236` | Medium   | S      | Updating one student loads every student for the teacher, then finds by id in memory.                                                                                                    | Add `getStudentRow(db, teacherId, studentId)` and use it before update.                                                       |
| TD-017 | Performance           |            `apps/api/src/services/payment-service.ts:61` | Medium   | S      | Creating one payment loads all students to find one row.                                                                                                                                 | Add a repository lookup by `(teacherId, studentId)` and return a validation error if missing.                                 |
| TD-018 | Error handling        |            `apps/api/src/services/payment-service.ts:70` | High     | S      | If `studentId` does not exist, DB mode relies on FK failure and memory mode can create a payment with a fallback currency.                                                               | Validate student existence before insert and return a 400/404 with a stable API error code.                                   |
| TD-019 | Performance           |           `apps/api/src/services/billing-service.ts:436` | High     | M      | `syncLessonChargesForLesson` loads all attendance, students, lessons, packages, and charges for the tenant even when syncing one lesson.                                                 | Add repository queries scoped to `lessonId` and affected student/package ids.                                                 |
| TD-020 | Performance           |           `apps/api/src/services/billing-service.ts:490` | Medium   | M      | Listing balances first rewrites/syncs all lesson charges, then loads all tenant rows. A read endpoint has hidden write work.                                                             | Split charge reconciliation into mutation-time work or a bounded job; make balance reads read-only.                           |
| TD-021 | Ledger integrity      |            `apps/api/src/services/payment-service.ts:86` | High     | M      | Deleting a payment hard-deletes ledger history and cancels a package. For financial records, deletion loses auditability.                                                                | Replace delete with reversal/correction records and keep original payments immutable.                                         |
| TD-022 | Ledger integrity      |                          `packages/db/src/schema.ts:289` | Medium   | S      | `correctionOfPaymentId` is just a UUID column with no FK to `payments.id`, so corrections can point nowhere.                                                                             | Add a self-FK and expose correction creation instead of destructive delete.                                                   |
| TD-023 | Data integrity        |               `packages/db/src/lesson-repository.ts:161` | Medium   | S      | Lesson student ids are inserted directly. The Zod schema requires at least one id but does not enforce uniqueness, so duplicate ids can cause DB conflicts.                              | Add `.refine()`/dedupe for unique `studentIds` before repository calls.                                                       |
| TD-024 | Contract debt         |                    `packages/api-types/src/index.ts:311` | Medium   | M      | `repeatCount` is accepted by the API contract, but lesson creation only creates one CRM lesson and passes repeat behavior to calendar sync.                                              | Rename the field to calendar recurrence intent or implement CRM lesson series creation explicitly.                            |
| TD-025 | Architecture          |   `apps/api/src/services/lesson-workflow-service.ts:100` | Medium   | M      | "Apply to future" finds a series using same first student, weekday, hour, and minute. `.planning/STATE.md:80` already calls out missing explicit series metadata.                        | Add `seriesId`/`occurrenceIndex` fields and stop matching future lessons heuristically.                                       |
| TD-026 | Privacy               |          `apps/api/src/services/calendar-service.ts:245` | Medium   | S      | Calendar event descriptions include student full names, topics, and notes in Google Calendar. That may be intentional, but it exports CRM data to a third party.                         | Add an explicit privacy setting for calendar detail level and default descriptions to minimal data.                           |
| TD-027 | Security hygiene      |          `apps/api/src/services/calendar-service.ts:196` | Medium   | S      | Token encryption uses a development fallback key whenever `NODE_ENV` is not production. If deployment env is mis-set, tokens are encrypted with a known key.                             | Require `CALENDAR_TOKEN_ENCRYPTION_KEY` whenever a DB URL is configured, not only when `NODE_ENV === 'production'`.           |
| TD-028 | Security hygiene      |                     `apps/api/src/routes/calendar.ts:32` | Medium   | S      | `/calendar/provider-tokens` accepts provider tokens and an optional email from the client payload.                                                                                       | Ignore payload email and always bind tokens to the authenticated Supabase user email.                                         |
| TD-029 | Performance           |          `apps/api/src/services/calendar-service.ts:749` | Medium   | M      | Calendar import processes sync rows serially and can make multiple Google calls per lesson.                                                                                              | Batch where possible, cap per-run work, and persist a cursor/backoff state.                                                   |
| TD-030 | Resource hygiene      |            `apps/web/hooks/useTeacherCrmCalendar.ts:131` | Medium   | S      | The browser polls calendar import every 60 seconds, plus focus and visibility events, without backoff after repeated failures.                                                           | Add exponential backoff and skip polling when the previous import failed with auth/rate-limit errors.                         |
| TD-031 | API client            |                            `apps/web/lib/crm/api.ts:155` | Medium   | S      | The client refreshes the Supabase token only when API code is `INVALID_TOKEN`, but the server currently returns `UNAUTHENTICATED` for invalid/expired access tokens.                     | Align server error codes or refresh on any 401 once before failing.                                                           |
| TD-032 | Error handling        |                            `apps/web/lib/crm/api.ts:246` | Medium   | S      | `loadTeacherCrm` substitutes empty students/lessons/calendar data after partial load failures, then reports issues asynchronously. Users can see an empty CRM instead of a hard failure. | Show a blocking error state for core resources and reserve partial fallback for non-critical supplements.                     |
| TD-033 | Performance           |                            `apps/web/lib/crm/api.ts:229` | Low      | S      | Initial load calls `/calendar/connection`, then calls the same endpoint again in parallel with students and lessons.                                                                     | Remove the first call or reuse its result unless token-saving has changed state.                                              |
| TD-034 | Observability         |                  `apps/web/hooks/teacherCrmErrors.ts:11` | Medium   | S      | Client error logging stores raw `Error.message` and displays it in toasts. API labels can include endpoints and messages; future errors could include sensitive provider details.        | Add a redaction function for tokens, emails, keys, and URLs before persisting/displaying errors.                              |
| TD-035 | UX/Error handling     |    `apps/web/components/dashboard/PaymentsPanel.tsx:456` | Low      | S      | Payment delete button swallows delete errors with `.catch(() => undefined)`. The parent logs, but the row action itself gives no local feedback.                                         | Surface a toast/error state for failed row deletes and keep the row disabled only during the actual request.                  |
| TD-036 | Test debt             |                             `apps/api/src/app.test.ts:6` | High     | M      | The main API smoke test forces `db: { db: null }`, so it exercises the memory store path rather than the real Drizzle repositories.                                                      | Add Postgres-backed integration tests for students, lessons, attendance, payments, packages, and calendar sync rows.          |
| TD-037 | Test debt             |                       `packages/db/src/ledger.test.ts:5` | Medium   | S      | Ledger unit tests cover only two happy-path balance cases. Package exhaustion, reversal, no-show, mixed duration, and correction behavior are not covered at the pure ledger level.      | Expand ledger tests around package units, corrections, overpayment, non-billable attendance, and currency splits.             |
| TD-038 | Documentation drift   |                  `.planning/research/ARCHITECTURE.md:97` | Medium   | M      | Architecture docs say Supabase RLS policies should protect user-owned rows, but current Drizzle schema/migrations only define tables/relations and app-level tenant filters.             | Add RLS policy migrations or explicitly document that API service-role access is the only tenant boundary for v1.             |
| TD-039 | Architecture          |                      `packages/api-types/src/index.ts:1` | Medium   | M      | `packages/api-types/src/index.ts` is a 699-line mixed module containing constants, business calculations, schemas, response types, and exported inferred types.                          | Split into `constants`, `schemas/student`, `schemas/lesson`, `schemas/payment`, `schemas/calendar`, and pure billing helpers. |
| TD-040 | Frontend architecture |     `apps/web/components/dashboard/PaymentsPanel.tsx:52` | Medium   | M      | `PaymentsPanel` is a 321-line component that owns filtering, sorting, grouping, deletion, animation, and rendering.                                                                      | Extract filter state/model hooks and table row/group components into smaller files.                                           |
| TD-041 | Frontend architecture | `apps/web/components/dashboard/LessonFormDialog.tsx:217` | Medium   | M      | `LessonFormDialog` is a 285-line component with validation, time math, conflict checking, recurrence handling, and rendering.                                                            | Move form schema/time conversion/conflict logic into tested pure helpers.                                                     |
| TD-042 | Frontend architecture |           `apps/web/app/(workspace)/errors/page.tsx:137` | Low      | M      | The error log page is a 222-line client component that owns normalization, filtering, subscription, deletion, and rendering.                                                             | Extract log normalization/filtering into `lib/crm/error-log-model.ts` and keep the page as composition.                       |
| TD-043 | Config debt           |                                           `turbo.json:3` | Medium   | S      | `turbo.json` lists only Google and calendar key env vars as global env. Supabase and database vars are missing, so cached builds/checks can ignore important env changes.                | Add Supabase and DB env names to `globalEnv` or task-specific `env`.                                                          |

## Top 5: Fix These First

1. Rotate and sanitize secrets.
   - Rotate Google OAuth secret, Supabase service role/JWT secret, and DB password referenced by `.env.local:3`, `.env.local:9`, `.env.local:14`, `.env.local:19`.
   - Keep only `.env.example` in repo artifacts and never paste local env output into issue/PR logs.

2. Make storage fail closed.
   - Change `getDb()`/service fallback behavior so `NODE_ENV=production` with no DB URL throws during app creation.
   - Keep memory store only for tests through `createApp({ db: { db: null }, memoryStore })`.

3. Fix RBAC defaults.
   - Replace default `['teacher']` in `rolesFromUser` with `[]` outside test/dev demo auth.
   - Remove the `user.roles.includes('teacher')` permission bypass and make permissions the single source of truth.

4. Add DB-backed integration tests.
   - Keep `apps/api/src/app.test.ts` for memory smoke coverage, but add a separate Postgres/Drizzle suite.
   - Cover payment creation/deletion/reversal, package purchase/cancel, attendance charge generation, and tenant isolation.

5. Consolidate billing logic.
   - Extract pure billing functions from `billing-service`/`memory-store` into one shared module.
   - Have DB-backed services load data and call the same functions; have memory tests call the same functions with in-memory data.

## Quick Wins

- [ ] Remove hard-coded production CORS domains from `apps/api/src/app.ts:20`.
- [ ] Align 401 retry codes between `apps/api/src/middleware/auth.ts:95` and `apps/web/lib/crm/api.ts:155`.
- [ ] Add uniqueness validation for `studentIds` in `packages/api-types/src/index.ts:297`.
- [ ] Ignore client-provided email in `apps/api/src/routes/calendar.ts:74`.
- [ ] Add Supabase/DB env vars to `turbo.json:3`.
- [ ] Add error redaction before `saveCrmError` in `apps/web/hooks/teacherCrmErrors.ts:11`.
- [ ] Add `getStudentRow` repository helper and stop list-then-find in `apps/api/src/services/student-service.ts:236`.
- [ ] Add `getStudentRow` use in `apps/api/src/services/payment-service.ts:61`.

## Things That Look Bad But Are Actually Fine

- `packages/db/src/billing-repository.ts:61` does not update `amount`, `currency`, or `lessonUnits` on lesson-charge conflict. That looks suspicious, but `apps/api/src/app.test.ts:599` through `apps/api/src/app.test.ts:621` explicitly asserts historical charge immutability after a student rate change. Keep it, but add an explicit correction mechanism.
- `.gitignore:35` through `.gitignore:38` correctly ignores env files. The problem is the current local `.env.local` contents and possible leakage through logs/artifacts, not that Git is set up to track it.
- `packages/db/src/schema.ts:294` creates a unique index on nullable `idempotencyKey`. In Postgres, multiple `NULL` values are allowed, so optional idempotency keys do not block normal payments.
- `apps/api/src/services/calendar-service.ts:204` uses AES-256-GCM with a random IV and auth tag. The crypto primitive is fine; the debt is the development fallback key and env gating.
- `apps/web/app/api/[[...route]]/route.ts:6` forces the Hono API route to `nodejs`. That is appropriate because the API imports Node crypto, async hooks, and DB clients.
- `packages/api-types/src/index.ts:30` asks for broad Google Calendar scopes. That is broad, but currently needed for read/write calendar list, busy checks, insert/patch, and import behavior. The privacy issue is what data is written, not just the scope list.

## Open Questions For The Maintainer

- Is hard deletion of students/payments an intentional admin-only escape hatch, or should all financial and attendance changes be append-only?
- Should Google Calendar events include student names/topics/notes by default, or should the default be a privacy-preserving title only?
- Is the in-memory store meant to remain a supported local/demo mode, or can it become test-only?
- Should `repeatWeekly` mean a recurring Google event only, or actual CRM lesson-series records?
- Are Supabase RLS policies planned, or is the Hono API with service credentials the only tenant boundary for v1?
- Do you want GitNexus direct CLI documented somewhere, since `npx gitnexus` is known broken in this WSL path?

## Remediation Status

Updated: 2026-05-01

- TD-001..TD-005: scoped to env guardrails, not rotation. `.env.local` remains local/ignored; `.env.example`, startup validation, redaction, and Turbo env tracking were added.
- TD-006..TD-012 and TD-043: auth/RBAC fail-closed and production storage guardrails were implemented. Memory storage remains explicit for test/dev.
- TD-016..TD-023, TD-036..TD-037: repository lookups, payment student validation, payment voiding, duplicate lesson student validation, DB integration harness, and expanded ledger tests were added.
- TD-024..TD-030 and TD-033: calendar recurrence semantics remain unchanged, but event payload privacy, token email binding, encryption-key gating, import cap, duplicate connection load, and browser import backoff were addressed.
- TD-031..TD-035: API 401 retry, blocking core load failure, request ids, redaction, and visible payment delete errors were addressed.
- TD-038: v1 Hono API tenant-boundary decision documented; RLS remains deferred until direct DB access exists.
- TD-039..TD-042: large module/component decomposition remains deferred after behavioral fixes. Public exports were kept stable.
