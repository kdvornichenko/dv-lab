---
phase: 09-implement-website-pet-widget
plan: 03
subsystem: ui
tags: [nextjs, react, animated-webp, requestanimationframe, pet-widget]
requires:
  - phase: 09-implement-website-pet-widget
    provides: 'Animated WebP pet manifest foundation from plan 09-01'
  - phase: 09-implement-website-pet-widget
    provides: 'API-backed pet settings and live settings store from plan 09-02'
provides:
  - 'Workspace-scoped click-through website pet overlay'
  - 'Deterministic pet engine with walking, explicit-target jumping, landing, and timed rest states'
  - 'Explicit [data-pet-target] discovery for eligible workspace landing zones'
  - 'Live settings, privacy-mode, reduced-motion, and visibility gates for pet runtime behavior'
affects: [pet-widget, web-ui, workspace-shell, phase-09]
tech-stack:
  added: []
  patterns:
    - 'Animated WebP pet poses render through native img elements while runtime movement uses translate3d on a fixed overlay.'
    - 'Pet behavior is modeled in apps/web/lib/pet and consumed by workspace-scoped components in apps/web/components/pet.'
key-files:
  created:
    - apps/web/lib/pet/pet-targets.ts
    - apps/web/lib/pet/pet-settings.ts
    - apps/web/components/pet/WebsitePetProvider.tsx
    - apps/web/components/pet/WebsitePetOverlay.tsx
    - apps/web/components/pet/PetImage.tsx
  modified:
    - apps/web/lib/pet/pet-engine.ts
    - apps/web/lib/pet/pet-engine.test.ts
    - apps/web/app/providers.tsx
key-decisions:
  - 'Mount the pet provider inside WorkspaceProviders so the overlay is authenticated-workspace scoped, not global theme scoped.'
  - 'Keep the overlay click-through with pointer-events-none and move it using transform translate3d.'
  - 'Use native animated WebP img rendering from catPetManifest; no Next Image, canvas, background-position, or manual frame timers.'
  - 'Treat privacy mode as the highest pose priority and reduced-motion/coarse-pointer as sleeper mode.'
patterns-established:
  - 'Pet target acquisition only consumes explicit PetTarget[] values discovered from [data-pet-target].'
  - 'Mounted pet runtime subscribes to pet-settings-store for live enable, sound, and activity updates.'
requirements-completed: [API-05]
duration: 31min
completed: 2026-05-02
---

# Phase 9 Plan 03: Pet Engine, Overlay Provider, and Target Discovery Summary

**Workspace-scoped animated WebP pet overlay backed by a deterministic target-only movement engine**

## Performance

- **Duration:** 31 min
- **Started:** 2026-05-02T17:12:00Z
- **Completed:** 2026-05-02T17:42:45Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Expanded the pet engine into a deterministic state machine for walking, target jumps, parabolic arcs, landing, and timed sit/lie/sleep rest behavior.
- Added explicit target discovery with `PET_TARGET_SELECTOR = "[data-pet-target]"`, viewport filtering, and minimum target sizing.
- Mounted `WebsitePetProvider` inside `WorkspaceProviders` so the pet only appears in authenticated workspace routes.
- Added a fixed, `pointer-events-none`, `aria-hidden` overlay that moves with `translate3d(...)`.
- Added `PetImage` with a native `<img>` reading animated WebP sources from `catPetManifest`.
- Wired live settings subscription, API-backed initial settings load, privacy-mode observation, reduced-motion/coarse-pointer override, visibility pause, viewport/target refresh, and animation-frame cleanup.

## Task Commits

Each task was committed atomically:

1. **Task 09-03-01: Implement non-React-frame pet engine and target discovery** - `36c8242` (feat)
2. **Task 09-03-02: Render workspace-scoped click-through pet overlay** - `c4a0ea7` (feat)

## Files Created/Modified

- `apps/web/lib/pet/pet-engine.ts` - Pet movement state machine, pose priority, activity tuning, target jump/rest behavior, and runtime setters.
- `apps/web/lib/pet/pet-engine.test.ts` - Assertions for walking, explicit target jumps, jump arc, landing clamp, rest transitions, privacy, reduced motion, and empty target behavior.
- `apps/web/lib/pet/pet-targets.ts` - Explicit `[data-pet-target]` DOM discovery with viewport and size filtering.
- `apps/web/lib/pet/pet-settings.ts` - Provider-facing settings loader and re-exported live settings store subscription helpers.
- `apps/web/components/pet/WebsitePetProvider.tsx` - Workspace runtime provider with settings, rAF, privacy, reduced motion, visibility, cursor, viewport, and target synchronization.
- `apps/web/components/pet/WebsitePetOverlay.tsx` - Fixed click-through overlay shell using `translate3d`.
- `apps/web/components/pet/PetImage.tsx` - Native animated WebP `<img>` renderer for the current pose.
- `apps/web/app/providers.tsx` - Mounts `WebsitePetProvider` inside `WorkspaceProviders`.

## Decisions Made

- Used a pure engine snapshot API so React renders only the overlay state and the engine owns movement calculations outside component code.
- Added small engine control methods for activity level, viewport, and image bounds so the mounted provider can react to live settings and resize without recreating or leaking animation loops.
- Kept `soundEnabled` subscribed in the provider dependency set even though audio playback remains deferred, so settings changes apply to the running provider immediately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added live runtime setters beyond the initial engine method list**

- **Found during:** Task 09-03-02 (Render workspace-scoped click-through pet overlay)
- **Issue:** The planned provider needed live activity-level and viewport updates, but the required Task 09-03-01 engine method list only named privacy, reduced-motion, targets, and cursor setters.
- **Fix:** Added `setActivityLevel`, `setViewport`, and `setImageBounds` to the engine API.
- **Files modified:** `apps/web/lib/pet/pet-engine.ts`
- **Verification:** `yarn --cwd apps/web test:pet && yarn --cwd apps/web typecheck`
- **Committed in:** `36c8242`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** The additions are narrow runtime controls required by the planned live provider behavior. No architecture change or scope expansion.

## Issues Encountered

- GitNexus reported the index was stale. WSL `npx gitnexus analyze` hit the known project blocker (`Cannot destructure property 'package' of 'node.target' as it is null`), so the index refresh was retried successfully through Windows `cmd.exe` from `G:\dv-lab`.
- Parallel `git add` attempts collided on Git's index lock. The lock cleared after the successful add process exited; remaining staging was completed serially.
- Existing unrelated dirty files were present in `.planning/config.json`, `AGENTS.md`, `CLAUDE.md`, calendar/sidebar components, and `apps/web/public/assets/cat-widget/cat-widget-animations.json`. They were left untouched and were not staged.

## GitNexus Checks

- `clampPetPosition`, `shouldUseReducedPetMotion`, `selectPetPose`, and `clamp` impact checks were LOW risk with no affected execution flows.
- `WorkspaceProviders` impact check was LOW risk with no direct callers/importers and no affected execution flows.
- Pre-commit staged detect-changes for Task 09-03-01 was low risk with no affected execution flows.
- Pre-commit staged detect-changes for Task 09-03-02 was low risk with no affected execution flows.

## Verification

- `yarn --cwd apps/web test:pet`
- `yarn --cwd apps/web test:pet && yarn --cwd apps/web typecheck`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 09-04 can add explicit `data-pet-target` zones to workspace surfaces and optionally wire sound behavior. The provider already ignores unmarked elements and will discover eligible targets as they are added.

## Self-Check: PASSED

- Summary exists at `.planning/phases/09-implement-website-pet-widget/09-03-SUMMARY.md`.
- Created pet target, provider, overlay, image, and settings files exist.
- Task commits `36c8242` and `c4a0ea7` exist.
- Static artifact checks found `WebsitePetProvider`, `pointer-events-none`, native `<img`, `PET_TARGET_SELECTOR = "[data-pet-target]"`, `subscribePetSettings`, and `createPetEngine`.

---

_Phase: 09-implement-website-pet-widget_
_Completed: 2026-05-02_
