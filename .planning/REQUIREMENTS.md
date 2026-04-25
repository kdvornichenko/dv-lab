# Requirements: Teacher English CRM

**Defined:** 2026-04-25
**Core Value:** The teacher can always see who studies, who attended, who paid, and who owes money.

## v1 Requirements

## Implementation Snapshot - 2026-04-25

- Complete: FOUND-01, FOUND-02, FOUND-03, FOUND-04, AUTH-01, AUTH-02, AUTH-03, AUTH-04, API-01, API-02, API-03, API-04.
- Partial prototype: STUD-01, STUD-02, STUD-04, LESS-01, ATT-02, CAL-01, CAL-02, CAL-03, CAL-05, PAY-01, PAY-02, PAY-05, DASH-01, DASH-02, DASH-03, DASH-04, API-05.
- Pending production pass: DB-backed Hono repositories, typed web API client integration, student edit/profile flows, reschedule/cancel flows, attendance history, Google OAuth/token storage/event upsert, payment corrections.

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

- [ ] **STUD-01**: User can create a student with name, contact info, status, level, notes, and default billing settings.
- [ ] **STUD-02**: User can view, search, and filter students by status and payment/lesson state.
- [ ] **STUD-03**: User can edit student details without losing lesson/payment history.
- [ ] **STUD-04**: User can archive a student instead of deleting them.

### Lessons

- [ ] **LESS-01**: User can create a lesson with date, time, duration, topic/notes, and one or multiple students.
- [ ] **LESS-02**: User can view lessons by day/week and by student.
- [ ] **LESS-03**: User can reschedule or cancel a lesson with status preserved.

### Attendance

- [ ] **ATT-01**: User can mark lesson attendance as planned, attended, absent, cancelled, or rescheduled.
- [ ] **ATT-02**: User can bulk mark attendance for all students in a group lesson.
- [ ] **ATT-03**: User can view attendance history per student.
- [ ] **ATT-04**: Dashboard highlights lessons with missing attendance marks.

### Google Calendar

- [ ] **CAL-01**: User can connect a Google Calendar account through a server-mediated OAuth flow. Current foundation requests Calendar scopes during Google login; production token storage and sync use remain Phase 6 work.
- [ ] **CAL-02**: User can choose which calendar receives CRM lesson events.
- [ ] **CAL-03**: Creating or rescheduling a CRM lesson can create or update the linked Google Calendar event.
- [ ] **CAL-04**: Cancelling a CRM lesson can cancel or remove the linked Google Calendar event according to a recorded sync policy.
- [ ] **CAL-05**: User can see calendar sync status and retry failed syncs without duplicating events.

### Payments

- [ ] **PAY-01**: User can record a manual payment with amount, date, method, student, and comment.
- [ ] **PAY-02**: User can see student balance and unpaid/overdue lesson count.
- [ ] **PAY-03**: User can view payment history per student.
- [ ] **PAY-04**: User can correct payment records without destroying ledger history.
- [ ] **PAY-05**: User can view monthly income summary.

### Dashboard

- [ ] **DASH-01**: User can see today's upcoming lessons.
- [ ] **DASH-02**: User can see overdue or low-balance students.
- [ ] **DASH-03**: User can see active student count, attendance count for the period, and month income.
- [ ] **DASH-04**: User can access quick actions for add student, add lesson, mark attendance, and record payment.

### API and Architecture

- [x] **API-01**: Hono API exposes health, auth, students, lessons, attendance, payments, and dashboard route groups.
- [x] **API-02**: API request bodies and responses are validated or described with shared Zod schemas from `packages/api-types`.
- [x] **API-03**: DB schema and query helpers live in `packages/db` and target Supabase Postgres.
- [x] **API-04**: RBAC domains and `can` checks live in `packages/rbac` and cover teacher CRM permissions.
- [ ] **API-05**: Web feature code follows container/model/presentation boundaries and keeps domain logic out of `components/ui`. Current dashboard shell uses a typed API client; production feature pages still need the same boundary.

## v2 Requirements

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

## Traceability

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| FOUND-01    | Phase 1 | Complete |
| FOUND-02    | Phase 1 | Complete |
| FOUND-03    | Phase 2 | Complete |
| FOUND-04    | Phase 1 | Complete |
| AUTH-01     | Phase 3 | Complete |
| AUTH-02     | Phase 3 | Complete |
| AUTH-03     | Phase 3 | Complete |
| AUTH-04     | Phase 3 | Complete |
| STUD-01     | Phase 4 | Pending  |
| STUD-02     | Phase 4 | Pending  |
| STUD-03     | Phase 4 | Pending  |
| STUD-04     | Phase 4 | Pending  |
| LESS-01     | Phase 5 | Pending  |
| LESS-02     | Phase 5 | Pending  |
| LESS-03     | Phase 5 | Pending  |
| ATT-01      | Phase 5 | Pending  |
| ATT-02      | Phase 5 | Pending  |
| ATT-03      | Phase 5 | Pending  |
| ATT-04      | Phase 8 | Pending  |
| CAL-01      | Phase 6 | Partial  |
| CAL-02      | Phase 6 | Pending  |
| CAL-03      | Phase 6 | Pending  |
| CAL-04      | Phase 6 | Pending  |
| CAL-05      | Phase 6 | Pending  |
| PAY-01      | Phase 7 | Pending  |
| PAY-02      | Phase 7 | Pending  |
| PAY-03      | Phase 7 | Pending  |
| PAY-04      | Phase 7 | Pending  |
| PAY-05      | Phase 8 | Pending  |
| DASH-01     | Phase 8 | Pending  |
| DASH-02     | Phase 8 | Pending  |
| DASH-03     | Phase 8 | Pending  |
| DASH-04     | Phase 8 | Pending  |
| API-01      | Phase 3 | Complete |
| API-02      | Phase 3 | Complete |
| API-03      | Phase 2 | Complete |
| API-04      | Phase 2 | Complete |
| API-05      | Phase 4 | Partial  |

**Coverage:**

- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0

---

_Requirements defined: 2026-04-25_
_Last updated: 2026-04-25 after autonomous foundation implementation_
