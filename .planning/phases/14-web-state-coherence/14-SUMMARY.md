# Phase 14: Web State Coherence - Summary

**Completed:** 2026-05-03
**Status:** Complete

## What Changed

- Scoped the module-level CRM cache by Supabase user id.
- Split in-flight CRM load dedupe by cache key instead of sharing one global promise.
- Cleared CRM state, calendar options, cache snapshot, and in-flight loads when auth changes or the session disappears.
- Changed mutation refresh behavior from fire-and-forget background refresh to awaited post-mutation refresh.
- Added `awaitSupplements` refresh mode so mutation completion waits for payments, balances, and dashboard summary refresh.
- Added teacher-local date helpers for instant-to-date and same-month checks.
- Updated web fallback summary logic to use teacher-local date/month policy instead of UTC `toISOString().slice(0, 10)` and month-start comparisons.

## Tests

- `yarn --cwd apps/web typecheck`
- `yarn --cwd apps/web lint`

## Notes

- Web lint still reports the pre-existing `apps/web/components/AppSidebar.tsx` unused `Image` warning.
- Cross-user cache isolation is implemented through the Supabase auth subscription; browser-level verification remains useful in a later UI/test pass.
