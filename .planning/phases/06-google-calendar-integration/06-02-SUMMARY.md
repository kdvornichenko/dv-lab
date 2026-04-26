# 06-02 Summary: Calendar Selection and Lesson Event Mapping

## Completed

- Added public `CalendarListEntry` API type.
- Added DB helpers for calendar sync lookup and lesson calendar context.
- Added Google Calendar REST integration in the API service:
  - list writable calendars from `users/me/calendarList`;
  - refresh access token with stored refresh token when needed;
  - map CRM lessons to Google event payloads;
  - insert or patch a lesson event and persist external event/calendar IDs.
- Added `/calendar/calendars` endpoint.
- Added Calendar page target-calendar selector using the existing shadcn Select component.
- Added API smoke coverage for the calendar list route in memory fallback mode.

## Verification

- `yarn --cwd packages/db typecheck`
- `yarn --cwd apps/api typecheck`
- `yarn --cwd apps/web typecheck`
- `yarn --cwd apps/api test`
- `yarn test`
- `yarn lint`
- `yarn build`

## Notes

- Live Google API calls are implemented but not exercised by local smoke tests because test mode uses memory fallback.
- 06-03 should add stronger duplicate-prevention and retry contract coverage around repeated sync attempts and changed calendar selection.
