# 06-01 Summary: Google OAuth and Token Storage Boundary

## Completed

- Added DB-backed calendar repository for `calendar_connections` and `calendar_sync_events`.
- Added API calendar service with Postgres support and memory fallback for local/test mode.
- Added AES-GCM encryption for Google provider access/refresh tokens before DB storage.
- Added `/calendar/provider-tokens` endpoint for the Next.js OAuth callback.
- Updated `/calendar/connection`, `/calendar/connections`, `/calendar/sync-events`, and lesson create/update hooks to use the calendar service.
- Updated Supabase OAuth callback to forward Google provider tokens to the API after session exchange.
- Added API smoke coverage for provider-token save, connected state, calendar selection, and sync route.

## Verification

- `yarn --cwd packages/db typecheck`
- `yarn --cwd apps/api typecheck`
- `yarn --cwd apps/web typecheck`
- `yarn --cwd apps/api test`
- `yarn test`
- `yarn lint`
- `yarn build`
- `git diff --check`

## Notes

- Google Calendar event upsert is intentionally still pending for 06-02.
- `npx gitnexus detect-changes` failed with `Cannot destructure property 'package' of 'node.target' as it is null`; no commit was created.
