# Phase 13: Calendar Safety and Service Boundaries - Context

**Started:** 2026-05-03
**Status:** Complete

## Scope

Phase 13 addresses calendar safety findings from the API and architecture audits:

- Google provider I/O should not hang indefinitely.
- Provider error details should not leak raw access tokens into user-visible sync state.
- Provider tokens should be verified for Google identity and required Calendar scopes before durable storage.
- Direct sync failures should be visible to callers instead of being hidden behind `200 OK`.
- Calendar import semantics must be explicit.

## Product Sync Policy

The CRM and Google Calendar are peer systems for this private single-teacher product:

- Changes made on the site sync to Google Calendar.
- Changes made in Google Calendar sync back to the site.
- No manual reconciliation step is required for normal lesson event fields.
- The import path treats Google event fields as authoritative when importing remote changes.

Safety work therefore focuses on trustworthy provider calls, token provenance, sanitized failures, and explicit bidirectional behavior rather than blocking remote changes behind manual approval.

## GitNexus Impact Notes

- `googleJson`: CRITICAL blast radius because all Google Calendar provider operations depend on it. Changes were limited to timeout/abort behavior and sanitized provider errors.
- `saveProviderTokens`: LOW blast radius; direct token storage boundary only.
- `/sync-events` route: LOW route impact; direct sync failures now return an error response.
- `importSyncedLessonsFromCalendar`: LOW blast radius; one direct route consumer.
