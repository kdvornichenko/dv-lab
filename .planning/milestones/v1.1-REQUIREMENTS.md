# Requirements: Teacher English CRM

**Defined:** 2026-04-25
**Core Value:** The teacher can always see who studies, which individual lessons are planned/completed/cancelled/rescheduled, who paid, and who owes money.

## v1 Requirements

## Implementation Snapshot - 2026-04-25

- Complete: FOUND-01, FOUND-02, FOUND-03, FOUND-04, AUTH-01, AUTH-02, AUTH-03, AUTH-04, API-01, API-02, API-03, API-04.
- Complete after v1.0 closure: STUD-01, STUD-02, STUD-03, STUD-04, LESS-01, LESS-02, LESS-03, ATT-01, ATT-02, ATT-03, ATT-04, PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, PAY-08, DASH-01, DASH-02, DASH-03, DASH-04, API-05.
- Pending production pass: follow-up tech-debt and architecture audits will validate implementation quality and convert remaining risks into remediation work.

### Foundation

- [x] **FOUND-01**: Existing `dv-lab` app code is reset into a Turborepo monorepo while preserving Supabase env/client connectivity.
- [x] **FOUND-02**: Repository has `apps/web`, `apps/api`, `packages/db`, `packages/rbac`, and `packages/api-types` with package-local scripts registered in `turbo.json`.
- [x] **FOUND-03**: Shared package candidates from `/mnt/g/its/its-doc` are evaluated and only domain-neutral parts are adapted.
- [x] **FOUND-04**: Developer can run web and API dev servers through Turborepo commands.

### Authentication

- [x] **AUTH-01**: Teacher/admin can sign in with Supabase Auth through Google OAuth.
- [x] **AUTH-02**: Authenticated session persists across refreshes in the Next.js app.
- [x] **AUTH-03**: Protected web routes redirect unauthenticated users to sign-in.
- [x] **AUTH-04**: Hono API rejects unauthenticated protected requests with a typed error.

### Students

- [x] **STUD-01**: User can create a student with first name, last name, special calendar note, status, level, notes, default lesson price, and default lesson duration. Email/phone are not part of the visible v1 student workflow.
- [x] **STUD-02**: User can view, search, and filter students by status and payment/lesson state.
- [x] **STUD-03**: User can edit student details without losing lesson/payment history.
- [x] **STUD-04**: User can archive a student instead of deleting them.

### Lessons

- [x] **LESS-01**: User can create an individual lesson with date, time, duration, topic/notes, one student, and optional weekly repeat generation.
- [x] **LESS-02**: User can view lessons by day/week and by student.
- [x] **LESS-03**: User can reschedule or cancel one lesson with status preserved, and choose whether to apply the change to future lessons in the same student/day/time pattern. Current implementation uses heuristic matching; explicit series metadata remains a follow-up hardening candidate.

### Lesson Status

- [x] **ATT-01**: User can mark an individual lesson as planned, completed, cancelled, or rescheduled.
- [x] **ATT-02**: Group attendance is removed from v1 scope because all lessons are individual.
- [x] **ATT-03**: User can view lesson status history per student.
- [x] **ATT-04**: Dashboard highlights lessons that need schedule/payment attention without using missing attendance marks.

### Google Calendar

- [x] **CAL-01**: User can connect a Google Calendar account through a server-mediated OAuth flow.
- [x] **CAL-02**: User can choose which calendar receives CRM lesson events.
- [x] **CAL-03**: Creating or rescheduling a CRM lesson automatically creates or updates the linked Google Calendar event.
- [x] **CAL-04**: Cancelling a CRM lesson can cancel or remove the linked Google Calendar event according to a recorded sync policy.
- [x] **CAL-05**: User can see calendar sync status without duplicating events; lesson-level sync actions are automatic.
- [x] **CAL-06**: Lesson form warns about Google Calendar busy intervals before save without blocking creation.

### Payments

- [x] **PAY-01**: User can record a manual payment with amount, date, method, student, and comment.
- [x] **PAY-02**: User can see student balance and unpaid/overdue lesson count.
- [x] **PAY-03**: User can view payment history per student.
- [x] **PAY-04**: User can correct payment records without destroying ledger history.
- [x] **PAY-07**: User can preserve historical package terms per payment period when a student changes package cadence or price later.
- [x] **PAY-05**: User can view monthly income summary.
- [x] **PAY-06**: User can generate lesson/package offer text in a selected currency using current exchange rates, with RUB as the base price and API-backed conversion for currencies such as KZT.
- [x] **PAY-08**: Student package pricing is calculated automatically from base lesson price, fixed 3-month/5-month package discounts, lesson duration, and lesson count. Package profile shows completed/remaining lesson units and copyable completed-lesson dates grouped by month.

### Dashboard

- [x] **DASH-01**: User can see today's upcoming lessons.
- [x] **DASH-02**: User can see overdue or low-balance students.
- [x] **DASH-03**: User can see active student count, lesson status counts for the period, and month income.
- [x] **DASH-04**: User can access quick actions for add student, add lesson, calendar sync status, and record payment.

### API and Architecture

- [x] **API-01**: Hono API exposes health, auth, students, lessons, attendance, payments, and dashboard route groups.
- [x] **API-02**: API request bodies and responses are validated or described with shared Zod schemas from `packages/api-types`.
- [x] **API-03**: DB schema and query helpers live in `packages/db` and target Supabase Postgres.
- [x] **API-04**: RBAC domains and `can` checks live in `packages/rbac` and cover teacher CRM permissions.
- [x] **API-05**: Web feature code follows container/model/presentation boundaries and keeps domain logic out of `components/ui`.

## v2 Requirements

## v1.1 Audit Remediation Requirements

### Trust Boundaries

- [x] **AUDIT-01**: API auth roles are derived only from trusted sources (`app_metadata` and configured teacher fallback), never from user-controlled metadata.
- [x] **AUDIT-02**: Protected API routes validate shared route parameter schemas before service calls and return typed validation failures for malformed IDs.
- [x] **AUDIT-03**: Web API calls validate successful response payloads for core CRM load and mutation paths.

### Verification and CI

- [x] **AUDIT-04**: Local and CI verification distinguish memory smoke tests from required DB-backed integration tests, with CI failing when required DB tests cannot run.

### Persistence Integrity

- [x] **AUDIT-05**: Payment/package/ledger writes are atomic or idempotent across failure paths.
- [x] **AUDIT-06**: Lesson/status/billing writes have transactional boundaries that prevent partial durable state.
- [x] **AUDIT-07**: Attendance/status writes enforce that the target student belongs to the target lesson.
- [x] **AUDIT-08**: Payment/package relationships are tenant-scoped through database constraints or repository guards.

### Calendar Safety

- [x] **AUDIT-09**: Google provider calls use timeout/abort behavior and redact provider errors before user-visible storage/logging.
- [x] **AUDIT-10**: Calendar provider tokens are verified for identity and required scopes before being stored or treated as connected.
- [x] **AUDIT-11**: Calendar sync/import flows expose direct sync failures and document the product's bidirectional sync semantics.
- [x] **AUDIT-12**: Calendar service responsibilities are split into smaller provider, token, sync, and facade boundaries.

### Web State and Domain Policy

- [x] **AUDIT-13**: Web CRM cache is scoped by authenticated user/session and clears on auth changes.
- [x] **AUDIT-14**: Web mutations refresh or return all affected durable state before reporting success to the user.
- [x] **AUDIT-15**: Dashboard and schedule date logic uses a shared teacher-local date policy.
- [x] **AUDIT-16**: Billing/package calculations are centralized in one tested shared policy.
- [x] **AUDIT-17**: Dashboard summary calculation is clearly API-owned or consolidated into one pure policy.
- [x] **AUDIT-18**: API contract schemas can be modularized by domain while preserving compatibility exports.

### Cleanup and Maintainability

- [x] **AUDIT-19**: Dead-code, circular-dependency, and dependency-audit commands are configured with intentional exclusions.
- [x] **AUDIT-20**: Direct dependencies live in the package manifests that import them, and unused dependencies/imports are removed where safe.
- [x] **AUDIT-21**: Large web panels/dialogs move projection, validation, and controller logic out of presentation components where feasible.

### Integrations

- **INT-01**: User can export attendance and payments to CSV.
- **INT-02**: User can send payment reminders.
- **INT-03**: User can accept online payments through a payment provider.

### Student Portal

- **PORTAL-01**: Student can sign in and see own lessons.
- **PORTAL-02**: Student can see own payment status.
- **PORTAL-03**: Student can receive homework or materials.

## Out of Scope

| Feature                 | Reason                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| Online payment provider | Manual ledger solves v1 control without payment compliance complexity |
| Student portal          | Teacher-facing control loop comes first                               |
| Homework/LMS            | Separate product surface, not required for attendance/payment MVP     |
| Mobile app              | Responsive web is enough for v1                                       |
| Group lessons           | Current product direction is individual private lessons only          |

## Traceability

| Requirement | Phase    | Status   |
| ----------- | -------- | -------- |
| FOUND-01    | Phase 1  | Complete |
| FOUND-02    | Phase 1  | Complete |
| FOUND-03    | Phase 2  | Complete |
| FOUND-04    | Phase 1  | Complete |
| AUTH-01     | Phase 3  | Complete |
| AUTH-02     | Phase 3  | Complete |
| AUTH-03     | Phase 3  | Complete |
| AUTH-04     | Phase 3  | Complete |
| STUD-01     | Phase 4  | Complete |
| STUD-02     | Phase 4  | Complete |
| STUD-03     | Phase 4  | Complete |
| STUD-04     | Phase 4  | Complete |
| LESS-01     | Phase 5  | Complete |
| LESS-02     | Phase 5  | Complete |
| LESS-03     | Phase 5  | Complete |
| ATT-01      | Phase 5  | Complete |
| ATT-02      | Phase 5  | Complete |
| ATT-03      | Phase 5  | Complete |
| ATT-04      | Phase 8  | Complete |
| CAL-01      | Phase 6  | Complete |
| CAL-02      | Phase 6  | Complete |
| CAL-03      | Phase 6  | Complete |
| CAL-04      | Phase 6  | Complete |
| CAL-05      | Phase 6  | Complete |
| CAL-06      | Phase 6  | Complete |
| PAY-01      | Phase 7  | Complete |
| PAY-02      | Phase 7  | Complete |
| PAY-03      | Phase 7  | Complete |
| PAY-04      | Phase 7  | Complete |
| PAY-05      | Phase 8  | Complete |
| PAY-06      | Phase 7  | Complete |
| PAY-07      | Phase 7  | Complete |
| PAY-08      | Phase 7  | Complete |
| DASH-01     | Phase 8  | Complete |
| DASH-02     | Phase 8  | Complete |
| DASH-03     | Phase 8  | Complete |
| DASH-04     | Phase 8  | Complete |
| API-01      | Phase 3  | Complete |
| API-02      | Phase 3  | Complete |
| API-03      | Phase 2  | Complete |
| API-04      | Phase 2  | Complete |
| API-05      | Phase 4  | Partial  |
| AUDIT-01    | Phase 10 | Complete |
| AUDIT-02    | Phase 10 | Complete |
| AUDIT-03    | Phase 10 | Complete |
| AUDIT-04    | Phase 11 | Complete |
| AUDIT-05    | Phase 12 | Complete |
| AUDIT-06    | Phase 12 | Complete |
| AUDIT-07    | Phase 12 | Complete |
| AUDIT-08    | Phase 12 | Complete |
| AUDIT-09    | Phase 13 | Complete |
| AUDIT-10    | Phase 13 | Complete |
| AUDIT-11    | Phase 13 | Complete |
| AUDIT-12    | Phase 13 | Complete |
| AUDIT-13    | Phase 14 | Complete |
| AUDIT-14    | Phase 14 | Complete |
| AUDIT-15    | Phase 14 | Complete |
| AUDIT-16    | Phase 15 | Complete |
| AUDIT-17    | Phase 15 | Complete |
| AUDIT-18    | Phase 15 | Complete |
| AUDIT-19    | Phase 16 | Complete |
| AUDIT-20    | Phase 16 | Complete |
| AUDIT-21    | Phase 16 | Complete |

**Coverage:**

- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0

---

_Requirements defined: 2026-04-25_
_Last updated: 2026-05-03 after v1.0 phase closure and audit handoff_
