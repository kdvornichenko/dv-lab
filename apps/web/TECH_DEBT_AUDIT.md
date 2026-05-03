# Tech Debt Audit: apps/web

**Date:** 2026-05-03
**Scope:** `apps/web`, including CRM data flow, hooks, API client, providers, workspace UI, calendar, payments, students, settings, and pet widget.

## Executive Summary

- The highest-risk web issue is auth/state isolation: CRM data cache is module-global and not keyed by Supabase user/session.
- The app is client-heavy and stateful. Mutations optimistically patch partial state and depend on background refreshes for balances, summaries, sync records, and occurrence exceptions.
- API responses are trusted with generic TypeScript casts; the shared Zod contracts are not parsed on the web boundary.
- Date logic is split between UTC slices and local-calendar helpers, so dashboard/today counts can drift near midnight.
- UI/component quality is improving, but several large components still mix form validation, business calculations, local presentation state, and async side effects.
- Web tests are mostly typecheck/lint. Pet engine tests exist, but there is no coverage for CRM API client, cache behavior, mutation hooks, or selectors.
- Dependency hygiene is noisy: `knip` flags many unused shadcn components/deps, `hono` is used but not declared by `apps/web`, and `@teacher-crm/db` is declared but unused.
- The pet provider is bounded and click-through, but it polls DOM targets every 500ms and has no browser automation test in the normal test script.
- No circular dependencies were found.
- Fixes should focus on data correctness and testability before cosmetic cleanup.

## Architectural Mental Model

`apps/web` is a Next App Router workspace where server code mainly gates authentication and mounts the Hono API under `/api`. Interactive CRM behavior is client-side: `TeacherCrmPageShell` composes `useTeacherCrm`, which combines data loading, mutation commands, calendar helpers, settings providers, and model selectors. The API client obtains a Supabase access token in the browser and calls the mounted API with explicit bearer auth.

The current architecture is pragmatic but overly stateful. The app keeps module-global CRM cache, staged supplemental loads, optimistic local mutation patches, and provider-local settings state. That makes the UI responsive, but correctness depends on later background refreshes and can mix stale slices.

## Findings Table

| ID      | Category                   |                                                                                                          File:Line | Severity | Effort | Description                                                                                                                           | Recommendation                                                                                                               |
| ------- | -------------------------- | -----------------------------------------------------------------------------------------------------------------: | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| WEB-001 | Architecture / security    |                                                                           `apps/web/hooks/useTeacherCrmData.ts:49` | High     | M      | CRM cache is module-global and not keyed by user/session; a same-browser account switch can briefly reuse prior CRM state.            | Key cache by Supabase user id/session or move to an auth-scoped query cache.                                                 |
| WEB-002 | Test debt                  |                                                                                         `apps/web/package.json:13` | High     | M      | Web `test` is typecheck+lint only; pet tests are separate, and CRM API/cache/hooks/selectors have no tests.                           | Add unit tests for `lib/crm/api.ts`, `lib/crm/model.ts`, `payments-model.ts`, and hooks. Include `test:pet` in default test. |
| WEB-003 | State consistency          |                                                                          `apps/web/hooks/useTeacherCrmData.ts:133` | Medium   | M      | Core refresh replaces students/lessons but preserves old payments/balances until supplements finish.                                  | Version snapshots or load core+billing atomically; mark billing stale while refreshing.                                      |
| WEB-004 | Contract debt              |                                                                                      `apps/web/lib/crm/api.ts:155` | Medium   | M      | API responses are cast to `T`; shared Zod response schemas are not parsed on the web boundary.                                        | Add schema-aware request helpers and parse responses before returning.                                                       |
| WEB-005 | Date drift                 |                                                     `apps/web/lib/crm/api.ts:200`, `apps/web/lib/crm/model.ts:111` | Medium   | S      | Fallback dashboard summary uses UTC date slices while UI helpers compare local calendar days.                                         | Use one date-only/timezone helper shared by fallback and selectors.                                                          |
| WEB-006 | Business logic duplication |                                                                                    `apps/web/lib/crm/model.ts:295` | Medium   | M      | Web recomputes package progress when backend progress is absent, duplicating ledger behavior.                                         | Make backend package progress mandatory or extract shared pure helper with tests.                                            |
| WEB-007 | Optimistic state debt      |                                                                `apps/web/hooks/useTeacherCrmPaymentCommands.ts:20` | Medium   | S      | Recording a payment appends payment only; balances/summary update later in background.                                                | Return affected balances/summary from API or await targeted billing refresh.                                                 |
| WEB-008 | Optimistic state debt      |                                                                 `apps/web/hooks/useTeacherCrmLessonCommands.ts:83` | Medium   | S      | Attendance mutation merges attendance only; lesson status, charges, balances, and summary can remain stale.                           | Return full side effects or await dependent refresh.                                                                         |
| WEB-009 | Series/delete stale state  |                                                                 `apps/web/hooks/useTeacherCrmLessonCommands.ts:59` | Medium   | S      | Deleting `scope: current` leaves local lessons/attendance/sync records unchanged and occurrence exceptions invisible until refresh.   | Return/merge occurrence exceptions or force awaited refresh.                                                                 |
| WEB-010 | Provider drift             |                                                                 `apps/web/components/ThemeSettingsProvider.tsx:41` | Medium   | M      | If local theme exists, remote settings are never loaded, so other-device/user settings cannot win.                                    | Apply local immediately, then stale-while-revalidate from API with timestamp/version.                                        |
| WEB-011 | Payment contract drift     |                                                                            `apps/web/lib/crm/payments-model.ts:13` | Medium   | S      | Web has only `PaymentStatus = 'recorded'` while API exposes `voidedAt` and corrections.                                               | Derive row status from `voidedAt` and `correctionOfPaymentId`.                                                               |
| WEB-012 | Dependency manifest        |                                             `apps/web/app/api/[[...route]]/route.ts:1`, `apps/web/package.json:51` | Medium   | S      | Web route imports `hono`, but `apps/web` does not declare it; `@teacher-crm/db` is declared but unused.                               | Add direct `hono` dep or hide Hono behind API exports; remove unused DB dep.                                                 |
| WEB-013 | Dependency manifest        |                                                 `package.json:32`, `apps/web/components/calendar/navigation.tsx:4` | Medium   | S      | Web imports packages such as `date-fns` from root dependencies instead of declaring direct app deps.                                  | Move direct runtime dependencies into `apps/web/package.json`.                                                               |
| WEB-014 | Dead code                  |                                     `apps/web/components/ui/alert-dialog.tsx`, `apps/web/components/ui/widget.tsx` | Medium   | M      | `knip` reports 29 unused files and 98 unused exports, mostly local UI components and CRM helpers.                                     | Add `knip` config, mark intentional shadcn inventory, delete or quarantine real dead code.                                   |
| WEB-015 | Large component / cohesion |                                                        `apps/web/components/dashboard/LessonsCalendarPanel.tsx:44` | Medium   | M      | Calendar panel owns recurrence expansion, event mapping, block dialogs, drop behavior, and shell rendering in one 551-line component. | Extract event model helpers and dialog controllers; keep component presentational.                                           |
| WEB-016 | Large component / cohesion | `apps/web/components/dashboard/LessonFormDialog.tsx:103`, `apps/web/components/dashboard/LessonFormDialog.tsx:214` | Medium   | M      | Lesson form mixes validation, conflict detection, debounced Google checks, local overlap logic, and rendering.                        | Extract form model/hooks and test validation/conflict logic separately.                                                      |
| WEB-017 | Large component / cohesion | `apps/web/components/students/StudentFormDialog.tsx:112`, `apps/web/components/students/StudentFormDialog.tsx:154` | Medium   | M      | Student form duplicates billing/package calculations already shared elsewhere and owns extensive command conversion.                  | Extract student form model and reuse shared package-pricing helpers through tested adapters.                                 |
| WEB-018 | Resource hygiene           |                                                                      `apps/web/hooks/useTeacherCrmCalendar.ts:114` | Low      | M      | Calendar import/list effects use cancellation flags but do not abort fetches.                                                         | Thread `AbortSignal` through `apiRequest` and abort effect-owned calls.                                                      |
| WEB-019 | Pet runtime perf           |                                                               `apps/web/components/pet/WebsitePetProvider.tsx:181` | Low      | S      | Pet runtime polls DOM targets every 500ms during animation.                                                                           | Use explicit registration or MutationObserver/ResizeObserver with throttling.                                                |
| WEB-020 | Optimistic persistence     |                                                               `apps/web/components/SidebarSettingsProvider.tsx:97` | Low      | S      | Sidebar changes save optimistically; failures toast but do not roll back or show unsaved state.                                       | Track pending/error state and rollback on failure.                                                                           |
| WEB-021 | Observability semantics    |                                                                                  `apps/web/lib/crm/error-log.ts:7` | Low      | M      | Error-log “live” updates are same-tab custom events, not server/live updates across tabs.                                             | Rename semantics or add polling/realtime.                                                                                    |
| WEB-022 | Docs drift / consistency   |                                           `apps/web/app/(workspace)/errors/page.tsx:192`, `apps/web/AGENTS.md:101` | Low      | S      | Error log table uses raw `overflow-x-auto` despite local UI rules preferring `ScrollArea`.                                            | Replace with local scroll wrapper or document exception.                                                                     |
| WEB-023 | Lint hygiene               |                                                                             `apps/web/components/AppSidebar.tsx:5` | Low      | S      | `next/image` import is unused; lint reports warning.                                                                                  | Remove unused import and consider making unused vars an error in CI.                                                         |
| WEB-024 | Test/tooling               |                                                  `apps/web/package.json:13`, `apps/web/lib/pet/pet-engine.test.ts` | Medium   | S      | Pet tests exist but are not included in default web test.                                                                             | Wire `test:pet` into `test` or root CI.                                                                                      |

## Top 5 If You Fix Nothing Else

1. Auth-scope the CRM cache.
   - Include Supabase user id in cache key.
   - Clear cache on auth state change.
   - Add a regression test for account switching.

2. Add schema-aware API client parsing.
   - Export response schemas where missing.
   - Change `apiRequest<T>` to accept a schema.
   - Start with core load and mutation responses.

3. Make CRM mutations return coherent state.
   - Payment mutations return balances/summary.
   - Lesson/attendance mutations return affected lessons, attendance, charges, sync records, and summary.
   - Stop relying on background refresh for correctness.

4. Extract and test form/model logic.
   - `LessonFormDialog` validation/conflict model.
   - `StudentFormDialog` package-pricing model.
   - `LessonsCalendarPanel` event projection model.

5. Clean dependency/tooling drift.
   - Add direct `hono`, `date-fns`, and other app-owned deps.
   - Remove unused `@teacher-crm/db` from web.
   - Add knip config and mark intentional shadcn inventory.

## Quick Wins

- [ ] Remove unused `Image` import from `AppSidebar`.
- [ ] Add `test:pet` to `apps/web` default `test`.
- [ ] Add `hono` to `apps/web` dependencies or remove direct Hono import.
- [ ] Remove unused `@teacher-crm/db` from web dependencies.
- [ ] Make `no-unused-vars` an error after current warning is fixed.
- [ ] Replace UTC date slices in fallback summary with shared local date helper.
- [ ] Add `AbortSignal` support to `apiRequest`.
- [ ] Add stale marker while supplemental billing data loads.

## Things That Look Bad But Are Actually Fine

- `apps/web/lib/crm/api.ts:153`: `credentials: 'omit'` is fine because requests use explicit Supabase bearer tokens.
- `apps/web/lib/supabase/server.ts:19`: swallowing cookie writes in Server Components is intentional; session refresh is handled in middleware/proxy flow.
- `apps/web/app/api/[[...route]]/route.ts:6`: forcing `nodejs` is appropriate because the mounted API uses Node/server dependencies.
- Broad Google Calendar scopes in the auth flow match the required calendar read/write behavior.
- `components/ui/*` unused files are not automatically debt if they are an intentional shadcn inventory, but that intent needs `knip` config or deletion.

## Open Questions

- Is account switching in the same browser a supported user flow? If yes, cache scoping is urgent.
- Should dashboard “today” use teacher timezone, browser timezone, or a configured app timezone?
- Should package progress always be API-owned, or is offline/client recomputation a product requirement?
- Are shadcn component files intended as a reusable inventory, or should unused ones be deleted now?
- Should pet browser verification be automated with Playwright/Browser Use before every release?

## Tooling Notes

- `yarn typecheck`, `yarn lint`, and `yarn test` passed.
- `yarn lint` / `yarn test` reported one warning: `apps/web/components/AppSidebar.tsx:5` unused `Image`.
- `yarn npm audit --all --recursive` reported moderate advisories in transitive/dev chains.
- `npx madge --circular ...` found no circular dependencies.
- `npx knip --no-progress` found unused files, dependencies, and exports.
