# Phase 13: Calendar Safety and Service Boundaries - Summary

**Completed:** 2026-05-03
**Status:** Complete

## What Changed

- Added timeout/abort handling around Google Calendar REST requests.
- Added Google provider error sanitization before messages are stored or returned.
- Verified provider tokens against Google's token info endpoint before storing them as connected.
- Checked token identity against the authenticated Google account email when Google returns an email.
- Required all configured Calendar scopes before treating provider tokens as usable.
- Made direct lesson sync failures visible to the `/calendar/sync-events` caller instead of returning `200 OK` with a failed sync record.
- Preserved the intended bidirectional sync semantics: site changes sync to Google, and imported Google changes update CRM lessons directly.
- Kept calendar provider I/O behind `google-calendar-client.ts` and token/sync orchestration behind calendar-service helpers without route churn.

## Product Sync Policy

Google Calendar and the CRM have equal authority for lesson calendar fields in this private teacher workflow. The implementation intentionally applies imported Google event changes to CRM lessons immediately when import runs; it does not require manual approval.

## Tests

- `yarn --cwd apps/api test:memory`
- `yarn --cwd apps/api typecheck`

## Notes

- Local verification did not exercise live Google I/O.
- DB-backed calendar integration assertions require `TEACHER_CRM_TEST_DATABASE_URL` and real/faked Google responses in an integration harness.
