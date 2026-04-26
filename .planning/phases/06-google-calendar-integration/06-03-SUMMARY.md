# 06-03 Summary: Sync Status, Retry, and Duplicate Prevention

## Completed

- Added retry action to the Calendar sync ledger.
- Added tooltip for the icon-only retry button.
- Kept retry on the existing `/calendar/sync-events` contract so failed and pending records reuse the same sync path.
- Added smoke coverage that repeated sync calls keep one sync record for the lesson.
- Verified Phase 6 end-to-end checks.
- 2026-04-26 update: lesson create/update now syncs Google Calendar automatically, lesson-level manual sync buttons were removed from the UI, and lesson creation checks Google FreeBusy intervals for non-blocking conflict warnings.
- 2026-04-26 update: calendar event summaries now use the individual student short name plus `special` text (`Имя Ф. - special`) instead of the freeform lesson title.

## Verification

- `yarn --cwd apps/api test`
- `yarn --cwd apps/api typecheck`
- `yarn --cwd apps/web typecheck`
- `yarn test`
- `yarn lint`
- `yarn build`

## Notes

- Local tests cover idempotence through memory fallback; DB idempotence is enforced by the unique `(teacherId, lessonId, provider)` sync row and upsert repository.
- Post-verification OAuth fix: the Supabase callback is kept as a pure session exchange/redirect, and the web app saves Google `provider_token` from the client Supabase session after returning to `/calendar`. This mirrors the earlier working Google API access path while still storing tokens encrypted through the API/DB boundary.
- Live Google API behavior still needs manual verification with a real connected Google account and valid Calendar scopes.
- Retry UI notes above are superseded for lesson cards; the API route remains available for explicit repair flows, but regular lesson sync is automatic.
