# Requirements: Teacher English CRM

**Defined:** 2026-04-25
**Core Value:** The teacher can always see who studies, who attended, who paid, and who owes money.

## v1 Requirements

### Foundation

- [ ] **FOUND-01**: Existing `dv-lab` app code is reset into a Turborepo monorepo while preserving Supabase env/client connectivity.
- [ ] **FOUND-02**: Repository has `apps/web`, `apps/api`, `packages/db`, `packages/rbac`, and `packages/api-types` with package-local scripts registered in `turbo.json`.
- [ ] **FOUND-03**: Shared package candidates from `/mnt/g/its/its-doc` are evaluated and only domain-neutral parts are adapted.
- [ ] **FOUND-04**: Developer can run web and API dev servers through Turborepo commands.

### Authentication

- [ ] **AUTH-01**: Teacher/admin can sign in with Supabase Auth.
- [ ] **AUTH-02**: Authenticated session persists across refreshes in the Next.js app.
- [ ] **AUTH-03**: Protected web routes redirect unauthenticated users to sign-in.
- [ ] **AUTH-04**: Hono API rejects unauthenticated protected requests with a typed error.

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

- [ ] **API-01**: Hono API exposes health, auth, students, lessons, attendance, payments, and dashboard route groups.
- [ ] **API-02**: API request bodies and responses are validated or described with shared Zod schemas from `packages/api-types`.
- [ ] **API-03**: DB schema and query helpers live in `packages/db` and target Supabase Postgres.
- [ ] **API-04**: RBAC domains and `can` checks live in `packages/rbac` and cover teacher CRM permissions.
- [ ] **API-05**: Web feature code follows container/model/presentation boundaries and keeps domain logic out of `components/ui`.

## v2 Requirements

### Integrations

- **INT-01**: User can export attendance and payments to CSV.
- **INT-02**: User can sync lessons with Google Calendar.
- **INT-03**: User can send payment reminders.
- **INT-04**: User can accept online payments through a payment provider.

### Student Portal

- **PORTAL-01**: Student can sign in and see own lessons.
- **PORTAL-02**: Student can see own payment status.
- **PORTAL-03**: Student can receive homework or materials.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Online payment provider | Manual ledger solves v1 control without payment compliance complexity |
| Student portal | Teacher-facing control loop comes first |
| Homework/LMS | Separate product surface, not required for attendance/payment MVP |
| Calendar sync | Internal lesson model should be validated first |
| Mobile app | Responsive web is enough for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 2 | Pending |
| FOUND-04 | Phase 1 | Pending |
| AUTH-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 3 | Pending |
| STUD-01 | Phase 4 | Pending |
| STUD-02 | Phase 4 | Pending |
| STUD-03 | Phase 4 | Pending |
| STUD-04 | Phase 4 | Pending |
| LESS-01 | Phase 5 | Pending |
| LESS-02 | Phase 5 | Pending |
| LESS-03 | Phase 5 | Pending |
| ATT-01 | Phase 5 | Pending |
| ATT-02 | Phase 5 | Pending |
| ATT-03 | Phase 5 | Pending |
| ATT-04 | Phase 7 | Pending |
| PAY-01 | Phase 6 | Pending |
| PAY-02 | Phase 6 | Pending |
| PAY-03 | Phase 6 | Pending |
| PAY-04 | Phase 6 | Pending |
| PAY-05 | Phase 7 | Pending |
| DASH-01 | Phase 7 | Pending |
| DASH-02 | Phase 7 | Pending |
| DASH-03 | Phase 7 | Pending |
| DASH-04 | Phase 7 | Pending |
| API-01 | Phase 3 | Pending |
| API-02 | Phase 3 | Pending |
| API-03 | Phase 2 | Pending |
| API-04 | Phase 2 | Pending |
| API-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-04-25*
*Last updated: 2026-04-25 after v1.0 milestone initialization*
