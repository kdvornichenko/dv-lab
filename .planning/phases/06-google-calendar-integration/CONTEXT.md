# Phase 6 Context: Google Calendar Integration

## Goal

The teacher can use the same Google account from login for Calendar sync without duplicating events or leaking tokens.

## Current State

- Google OAuth sign-in already requests Calendar scopes through Supabase.
- Calendar API routes exist, but they still use the in-memory prototype store.
- Drizzle schema already contains `calendar_connections` and `calendar_sync_events`.
- Lesson create/update currently creates in-memory sync records after lesson mutations.

## Boundaries

- Runtime CRM state must come from Postgres when DB is configured.
- OAuth provider tokens must never be returned to the web client.
- Calendar sync must be idempotent by `(teacherId, lessonId, provider)`.
- Local/test mode may keep memory fallback for fast smoke tests.

## Risks

- Supabase provider tokens are only available immediately after OAuth exchange.
- Production token encryption must not silently use a development key.
- Event sync should not fake success before Google API upsert is implemented.

## Verification

- API smoke tests should cover connection, provider-token save, calendar selection, and sync record creation.
- Typecheck, lint, unit tests, and build must pass before phase summary is marked complete.
