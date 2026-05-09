# React useEffect Audit

Date: 2026-05-07
Scope: `apps/web` React/Next.js source files, excluding generated `.next` output.

## Method

- Applied `/mnt/c/Users/Kirill/.codex/skills/react-useeffect/SKILL.md`.
- Queried GitNexus for React hook and client-component execution context.
- Scanned source for `useEffect`, `useLayoutEffect`, `useInsertionEffect`, `useMemo`, `useCallback`, hook disables, and client-side fetch boundaries.
- Ran `yarn --cwd apps/web lint:full` before fixes; it passed.

## Summary

The codebase mostly uses effects as escape hatches for external systems: Supabase auth subscriptions, local storage, browser events, media queries, timers, DOM observers, animation frames, and async API synchronization. Those are valid effect use cases.

The clearest avoidable effect is in the custom calendar context:

- `apps/web/components/calendar/context.tsx` stores `events` state only to mirror the `events` prop.
- No consumer mutates `setEvents`; all usages read `events`.
- This creates an extra render and exposes a context mutation API that is not used.

The modal form reset effects are acceptable trade-offs for draft state:

- `PaymentFormDialog`
- `StudentFormDialog`
- `LessonFormDialog`
- `PersonalBlockDialog`

They intentionally reset local editable draft state when a dialog opens. Replacing them with a `key` reset would require changing caller ownership of dialog identity and would have wider UI behavior impact.

## Findings

### RUE-001: Calendar context mirrors props into state

- Severity: WARNING
- File: `apps/web/components/calendar/context.tsx`
- Lines: 45-49
- Pattern: `useState(defaultEvents)` followed by `useEffect(() => setEvents(defaultEvents), [defaultEvents])`
- Why it matters: This is prop-to-state synchronization without a separate local source of truth. It adds an avoidable render and leaves `setEvents` in context even though consumers do not use it.
- Recommended fix: Use `defaultEvents` directly as the context `events` value and remove `setEvents` from the context API.

### RUE-002: Theme editor resets draft from provider theme

- Severity: NOTE
- File: `apps/web/app/(workspace)/settings/theme/ThemeSettingsClient.tsx`
- Lines: 30-32
- Pattern: `useEffect(() => setDraft(cloneTheme(theme)), [theme])`
- Why it matters: This is prop-to-state synchronization, but the local draft is a deliberate edit buffer. The effect keeps the draft aligned after remote save/reset.
- Recommendation: Keep as-is unless the theme editor is redesigned around keyed remounts or an explicit "load new remote theme" event.

### RUE-003: Dialog forms reset local draft state on open

- Severity: NOTE
- Files:
  - `apps/web/components/students/PaymentFormDialog.tsx`
  - `apps/web/components/students/StudentFormDialog.tsx`
  - `apps/web/components/dashboard/LessonFormDialog.tsx`
  - `apps/web/components/dashboard/LessonsCalendarPanel.tsx`
- Pattern: reset local form state in an `open`-guarded effect.
- Why it matters: These are technically state synchronization effects, but they preserve draft state while the dialog is open and reset only at lifecycle boundaries.
- Recommendation: Keep as-is for now. A `key`-based reset would be cleaner only if dialog callers own a stable form session key.

### RUE-004: External systems effects are appropriate

- Severity: PASS
- Examples:
  - `apps/web/hooks/useTeacherCrmData.ts`: Supabase auth subscription and CRM loading.
  - `apps/web/hooks/useTeacherCrmCalendar.ts`: auth token sync, calendar polling, visibility/focus listeners, retry sync.
  - `apps/web/components/pet/WebsitePetProvider.tsx`: animation frame, DOM observers, pointer/visibility/media-query listeners.
  - `apps/web/components/PrivacyModeProvider.tsx`: keyboard shortcut and local storage.
  - `apps/web/components/ui/sidebar.tsx`: media query, keyboard shortcut, DOM visibility observer.
- Recommendation: Keep effects, continue enforcing cleanup for subscriptions, timers, observers, and async cancellation.

## Fix Plan

1. Remove the mirrored `events` state and effect from `Calendar`.
2. Remove `setEvents` from `ContextType` and provider value.
3. Verify all calendar consumers still typecheck and lint.
4. Run architecture review on the modified files.

## Post-Fix Notes

- Implemented RUE-001 in `apps/web/components/calendar/context.tsx`.
- Removed the `useEffect` import and the `events` mirror state.
- Removed unused `setEvents` from the calendar context API.
- The provider now exposes `events: defaultEvents` directly.

## Review Results

### React Best-Practices Review

Verdict: APPROVED

- Hooks: pass. Removed derived prop-to-state synchronization.
- Component structure: pass. Named exports and colocated internal context type remain unchanged.
- State management: pass. Calendar keeps only true local UI state (`view`, `date`).
- Accessibility/performance/TypeScript: no new issues in the changed file.

### Architecture Review

Overall verdict: APPROVED

Object Oriented Design: APPROVED

- No CRITICAL findings.
- No WARNING findings.
- The change reduces unnecessary mutable state without introducing new abstractions.

Clean Architecture: APPROVED

- No CRITICAL findings.
- No WARNING findings.
- Component dependencies and import direction remain unchanged.

API Design: APPROVED

- No CRITICAL findings.
- No WARNING findings.
- `setEvents` was removed from an internal context type because no consumer used it; the readable `events` context member remains.

## Verification

- `yarn --cwd apps/web lint:full`: passed
- `yarn --cwd apps/web typecheck`: passed
