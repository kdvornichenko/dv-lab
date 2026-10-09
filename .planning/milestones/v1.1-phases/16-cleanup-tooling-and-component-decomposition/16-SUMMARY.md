# Phase 16: Cleanup, Tooling, and Component Decomposition - Summary

**Completed:** 2026-05-03
**Status:** Complete

## What Changed

- Removed the unused `next/image` import from `AppSidebar`, clearing the pre-existing web lint warning.
- Added `knip.json` with workspace-aware audit configuration and intentional UI/component-library exclusions.
- Changed `audit:dead-code` to check files/dependencies/unlisted dependency issues while excluding exported barrel/UI API noise.
- Confirmed `madge` reports no circular dependencies.
- Moved `date-fns` and `react-hotkeys-hook` from the root package to `apps/web`, where they are imported.
- Added direct `hono` and `postcss` declarations to `apps/web` for imports/config used by the web app.
- Removed unused direct `@teacher-crm/db` dependency from `apps/web`.
- Added `portless` to root devDependencies because the root `dev` script invokes it.

## Tests

- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn audit:dead-code`
- `yarn audit:cycles`
- `git diff --check`

## Notes

- `yarn audit:deps` still reports moderate advisories in current upstream transitive dependencies:
  - `drizzle-kit@0.31.10` depends on deprecated `@esbuild-kit`/old `esbuild`; `drizzle-kit` latest is still `0.31.10`.
  - `next@16.2.4` pulls `postcss@8.4.31` transitively while the direct web PostCSS dependency is current.
- I did not force Yarn resolutions for these because that would override build-tool internals without an upstream-compatible release.
