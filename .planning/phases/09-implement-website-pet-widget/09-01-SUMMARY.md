---
phase: 09-implement-website-pet-widget
plan: 01
subsystem: ui
tags: [nextjs, react, animated-webp, testing, tsx]
provides:
  - "Deterministic cat pet animated WebP asset manifest"
  - "Pure pet engine helpers for pose priority and viewport clamping"
  - "Pet-focused TypeScript test command"
affects: [pet-widget, web-ui, phase-09]
key-files:
  created:
    - apps/web/lib/pet/pet-manifest.ts
    - apps/web/lib/pet/pet-manifest.test.ts
    - apps/web/lib/pet/pet-engine.ts
    - apps/web/lib/pet/pet-engine.test.ts
    - apps/web/public/assets/cat-widget/cat-walk.webp
  modified:
    - apps/web/public/assets/cat-widget/cat-sleep.webp
    - apps/web/package.json
    - yarn.lock
key-decisions:
  - "Use standalone animated WebP files rendered through native img elements; runtime movement moves the img and does not switch frames manually."
  - "Use /assets/cat-widget/cat-sleep.webp for sleep/rest and /assets/cat-widget/cat-walk.webp for walk/travel."
  - "Keep non-final pose mappings explicit with temporary/sourcePose metadata until dedicated animated assets exist."
requirements-completed: [API-05]
completed: 2026-05-02
---

# Phase 9 Plan 01: Pet Validation Foundation and Animated WebP Asset Contract Summary

Implemented the pet domain foundation around animated WebP assets instead of sprite-sheet frame coordinates.

## Accomplishments

- Added `catPetManifest` as an animated WebP asset manifest with required pose coverage.
- Verified `cat-sleep.webp` and `cat-walk.webp` are animated WebP files with alpha.
- Removed the active frame-sheet contract from the manifest: no `backgroundPosition`, `frameWidth`, manual frame IDs, or frame scheduler.
- Added pure pet engine helpers for privacy priority, reduced-motion fallback, coarse-pointer reduction, and viewport clamping.
- Added `yarn --cwd apps/web test:pet` with manifest and engine tests.

## Task Commits

1. `ec6d36d` - initial cat WebP manifest foundation.
2. `5c10d93` - initial manifest and engine tests.
3. `1b45db7` - corrective switch from sprite-sheet manifest to animated WebP assets.

## Verification

- `yarn --cwd apps/web test:pet`
- `yarn --cwd apps/web typecheck`
- `gsd-tools verify plan-structure` for all Phase 9 plans.

## Deviations

The original Wave 1 execution started from a sprite-sheet assumption. User clarified mid-execution that the asset strategy is animated WebP in a native `img`; the plan, context, validation, and code were corrected before downstream provider/renderer work.

## Self-Check: PASSED

- Summary exists.
- Required pet files exist.
- Test and typecheck passed.
- Active plans now require animated WebP `img` rendering and forbid manual sprite frame switching.
