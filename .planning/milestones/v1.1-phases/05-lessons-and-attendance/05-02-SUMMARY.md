# Plan 05-02 Summary: Attendance Records and Bulk Marking

## Completed

- Added a lesson attendance dialog with one row per lesson student.
- Supported explicit attendance statuses, billable toggles, and optional correction notes.
- Wired the dialog through `LessonsPanel` using a transport-free `onMarkAttendance` prop.
- Kept the mark-all-attended quick action as a separate icon button with tooltip.
- Preserved DB-backed bulk attendance upsert through the existing `/lessons/attendance` route.

## Verification

- `yarn --cwd apps/web typecheck`
- `yarn --cwd apps/web lint`
- `yarn test`
