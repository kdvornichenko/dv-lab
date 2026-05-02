---
phase: 09-implement-website-pet-widget
plan: 02
subsystem: ui-api
tags: [nextjs, react, hono, postgres, settings, pet-widget]
requires:
  - phase: 09-implement-website-pet-widget
    provides: "Animated WebP pet manifest foundation from plan 09-01"
provides:
  - "Authenticated API persistence for pet enabled, sound, and activity settings"
  - "Workspace pet settings page with API-backed controls"
  - "useSyncExternalStore-compatible live pet settings bridge"
affects: [pet-widget, web-ui, api-settings, phase-09]
tech-stack:
  added: []
  patterns:
    - "Pet UI settings persist through teacherCrmSettingsApi and /settings/pet"
    - "Mounted pet providers subscribe to apps/web/lib/pet/pet-settings-store.ts for live updates"
key-files:
  created:
    - apps/web/lib/pet/pet-settings-store.ts
    - apps/web/app/(workspace)/settings/pet/page.tsx
    - apps/web/app/(workspace)/settings/pet/PetSettingsClient.tsx
  modified:
    - packages/api-types/src/index.ts
    - packages/db/src/schema.ts
    - packages/db/src/settings-repository.ts
    - apps/api/src/routes/settings.ts
    - apps/api/src/services/settings-service.ts
    - apps/api/src/app.test.ts
    - apps/web/lib/crm/api.ts
    - apps/web/app/(workspace)/settings/page.tsx
key-decisions:
  - "Pet settings persist through the existing authenticated settings API and DB/memory fallback boundary, never browser-only localStorage."
  - "The web pet settings store is a live in-memory subscriber bridge, not durable persistence."
  - "Sound remains explicit and defaults off."
patterns-established:
  - "Settings clients load persisted state, save through teacherCrmSettingsApi, then publish the saved snapshot to pet-settings-store."
requirements-completed: [API-05]
duration: 18min
completed: 2026-05-02
---

# Phase 9 Plan 02: Persisted Pet Settings API and Workspace Controls Summary

**Authenticated pet settings persistence with workspace controls and a live React subscription bridge for the future mounted provider**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-02T16:28:05Z
- **Completed:** 2026-05-02T16:45:50Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added shared pet settings schemas, response types, API route handlers, settings service methods, DB-backed persistence, memory fallback, and API smoke coverage.
- Added web API methods for `GET /settings/pet` and `PUT /settings/pet`.
- Added a workspace pet settings page with enable, sound, and activity controls.
- Added `pet-settings-store.ts` with `getPetSettingsSnapshot`, `setPetSettingsSnapshot`, and `subscribePetSettings` for future provider live updates without refresh.
- Linked the pet settings page from the workspace settings index for discoverability.

## Task Commits

1. **Task 09-02-01: Add shared pet settings schemas and API route** - `bebe39f` (feat)
2. **Task 09-02-02: Add web pet settings client and API methods** - `dbad9cb` (feat)

## Files Created/Modified

- `packages/api-types/src/index.ts` - Pet settings schema, defaults, response type, and exports.
- `packages/db/src/schema.ts` - DB table for per-teacher pet settings.
- `packages/db/src/settings-repository.ts` - Repository helpers for reading/upserting pet settings.
- `apps/api/src/routes/settings.ts` - Protected `GET /settings/pet` and `PUT /settings/pet` routes.
- `apps/api/src/services/settings-service.ts` - Pet settings normalization and DB/memory fallback service methods.
- `apps/api/src/app.test.ts` - API smoke assertions for pet settings defaults and updates.
- `apps/web/lib/crm/api.ts` - `teacherCrmSettingsApi.getPetSettings` and `savePetSettings`.
- `apps/web/lib/pet/pet-settings-store.ts` - Live settings snapshot and subscriber store.
- `apps/web/app/(workspace)/settings/pet/page.tsx` - Pet settings route.
- `apps/web/app/(workspace)/settings/pet/PetSettingsClient.tsx` - API-backed controls for enabled, sound, and activity level.
- `apps/web/app/(workspace)/settings/page.tsx` - Discoverable settings link.

## Decisions Made

- Kept persistence API-backed and DB-backed with memory fallback, matching the project rule that non-session UI persistence does not use browser storage.
- Kept the web store intentionally small and in-memory so it can notify a mounted `WebsitePetProvider` once plan 09-03 wires the overlay.
- Saved settings before publishing to the live store so subscribers react to confirmed API state.

## Deviations from Plan

None - plan executed as written. The settings index link was added as part of the plan's discoverability requirement.

## Issues Encountered

- Existing unrelated uncommitted edits were present in project docs and calendar/sidebar components. They were left untouched and were not staged.
- GitNexus could not resolve `teacherCrmSettingsApi` as an indexed symbol, so file-level impact analysis was run for `apps/web/lib/crm/api.ts`.

## Verification

- `yarn --cwd apps/web typecheck`
- `yarn --cwd apps/api test && yarn --cwd apps/web typecheck`
- GitNexus impact before edits: `apps/web/lib/crm/api.ts` MEDIUM file-level risk with 11 direct importers; `SettingsPage` LOW with no upstream callers.
- GitNexus staged change detection before commit: low risk, no affected execution flows.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 09-03 can mount the pet provider and subscribe to `pet-settings-store.ts` so saved settings show/hide the animated WebP overlay without a page refresh.

## Self-Check: PASSED

- Summary exists at `.planning/phases/09-implement-website-pet-widget/09-02-SUMMARY.md`.
- Created web pet settings files exist.
- Task commits `bebe39f` and `dbad9cb` exist.
- Pet API methods, live store exports, and `/settings/pet` route references are present.

---
*Phase: 09-implement-website-pet-widget*
*Completed: 2026-05-02*
