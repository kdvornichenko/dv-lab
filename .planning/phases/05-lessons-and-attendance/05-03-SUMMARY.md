# Plan 05-03 Summary: Attendance History and Corrections

## Completed

- Changed lesson attendance completion logic so absent/cancelled/rescheduled rows count as marked, while planned rows still count as missing.
- Added lesson-list attendance breakdown badges for marked count and attended/absent split.
- Reused the attendance dialog for correction of existing attendance rows.
- Added recent student attendance history to the student settings profile pane using server-loaded lessons and attendance records.
- Kept API calls inside `useTeacherCrm` and passed mutation callbacks into presentation components.
- 2026-04-26 update: visible attendance/group controls were removed from the web UI because v1 is now individual lessons only. The lesson UI now uses lesson status, single-student creation, weekly repeat generation, a future-lessons apply switch, and non-blocking overlap warnings.

## Verification

- `yarn --cwd apps/web typecheck`
- `yarn --cwd apps/web lint`
- `yarn test`

## Superseded Scope

- Group attendance and bulk attendance are no longer part of v1.
- Backend attendance tables/routes remain for compatibility until payment charging is moved to lesson-status/billable policy records.
- Future-lessons apply currently matches same student, weekday, and time; explicit lesson series IDs are still needed for robust long-term edits.
