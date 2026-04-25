# Feature Research: Teacher English CRM

**Date:** 2026-04-25

## Product Shape

This is not a marketing site or an LMS. It is an operational control panel for one teacher or a small teaching operation. The first screen should be the working dashboard, not a landing page.

## Table Stakes

### Students

- Student list with status: active, paused, archived.
- Student profile: name, contacts, timezone, level, notes, default lesson price, billing terms.
- Fast search/filter by name, status, payment risk, next lesson.
- Archive instead of hard delete.

### Lessons and Attendance

- Lesson/session record with date, time, duration, topic/notes, one or multiple students.
- Attendance statuses: planned, attended, absent, cancelled, rescheduled.
- Bulk marking for group lessons.
- Attendance history per student.
- Today's lessons dashboard.

### Payments

- Manual payment entry: amount, date, method, period/lesson reference, comment.
- Balance per student.
- Overdue or low-balance list.
- Payment history with corrections.
- Basic revenue summaries by month.

### Dashboard

- Today: upcoming lessons and missing attendance marks.
- Risk: overdue students and unpaid lessons.
- Summary: active students, attended lessons this period, income this month.
- Quick actions: add student, add lesson, mark attendance, record payment.

### Auth and Access

- Teacher/admin sign-in.
- Optional assistant/manager role later.
- Session persistence and route protection.

## Differentiators Worth Keeping in Mind

- Lesson balance model: payments can be tracked as money balance or prepaid lesson packs. The schema should allow both, even if v1 UI starts with money ledger.
- Per-student billing terms: fixed monthly fee, per-lesson price, package of N lessons, custom discount.
- Attendance-to-payment linkage: an attended billable lesson should affect outstanding balance or unpaid count.
- Simple exports: CSV for payments/attendance may be useful before payment provider integration.

## Anti-Features for v1

- Full online school platform.
- Public registration.
- Student-facing homework.
- Payment acquiring.
- Complex payroll/teacher marketplace logic.
- Calendar sync before the internal lesson model is stable.

## Feature Categories for Requirements

- Foundation
- Authentication
- Students
- Lessons
- Attendance
- Payments
- Dashboard
- API and Architecture
