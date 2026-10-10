---
gsd_state_version: "1.0"
milestone: v2.0
milestone_name: Unified dv-lab (In Progress)
current_phase: 21
current_phase_name: Lesson Accounting and Today
status: executed
stopped_at: Phase 21 context gathered; next /gsd-plan-phase 21
last_updated: "2026-10-10T14:27:56.151Z"
last_activity: 2026-10-10
last_activity_desc: Phase 20 executed (10/10 plans), review fixes and End series fix applied
state_head: 3be745e60dc05f55e7c2793392d3eac1686c1099
progress:
  total_phases: 10
  completed_phases: 0
  total_plans: 75
  completed_plans: 49
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-09)

**Core value:** The teacher can always see who studies, how many lessons remain for each student, who has to pay soon and what was covered, and can record any of it by writing one line in chat.
**Current focus:** Phase 20 — Schedule (executed; PR and release next, then Phase 21)

## Current Position

Phase: 21 (Lesson Accounting and Today) — READY TO EXECUTE
Plan: 10 of 10
Status: Phase 20 is built and verified by scripts (schedule-db/core/api/web, both themes); review and security (36/36) are closed. Needs the owner and Server guy: manual look at the week grid, the migrations 20261010075813_schedule and 20261010103628_schedule_revoke_delete on the server (see 20-10-SUMMARY, "Для выката"). Phase 19 is released; remaining human steps from before: change the password on dv-lab.dev, set the opening balance on every card, return the apex TTL (RUNBOOK 3.5).
Last activity: 2026-10-10 — Phase 20 executed

Progress: [░░░░░░░░░░] 0% of phases 17-19 executed

## Deferred Verification

| Phase | State | Resume |
|-------|-------|--------|
| 17 | verification_deferred_human | /gsd-verify-work 17 |
| 18 | verification_deferred_human | /gsd-verify-work 18 |
| 19 | verification_deferred_human | /gsd-verify-work 19 |

Phase 19 human items left: the owner sets the opening balance on each card (the import does not fill it). Release and import are done.

Phase 17 human items (see 17-VERIFICATION.md): return the apex TTL to 300-3600 in the Vercel panel (RUNBOOK 3.5); recreate network dv-lab_default once at the next release (commit 2bcd8c0); optional browser look at the stub.

## Performance Metrics

**Velocity:**

- Total plans completed (v2.0): 0
- Average duration: n/a
- Total execution time: n/a

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
| ----- | ----- | ----- | -------- |
| -     | -     | -     | -        |

Phases 1-16 (v1.0, v1.1) are archived in `.planning/milestones/v1.1-ROADMAP.md`.
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 17 P01 | 40min | 3 tasks | 16 files |
| Phase 17 P02 | 15 min | 2 tasks | 9 files |
| Phase 17 P03 | 5 min | 2 tasks | 15 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 roadmap]: Phases 17-26 follow the owner's priority: server and skeleton, accounts and shell, cards and vault import, schedule, lesson accounting, chat (two phases), Google Calendar (two phases), IELTS last.
- [v2.0 roadmap]: The manual schedule (Phase 20) comes before chat because chat marks and moves lessons; Google Calendar (Phases 24-25) builds on the same lesson, series and exception model.
- [v2.0 roadmap]: Requirements placed by their last dependency: ACCT-04 in Phase 19 (cards), CARD-04 in Phase 20 (schedule), SHELL-05 in Phase 21, SHELL-03, SHELL-04 and CARD-05 in Phase 23 (chat entry points).
- [v2.0]: Calendar follows CODE-AUDIT.md: deterministic event ids, one writer per lesson, `events.watch` and `syncToken`, `410` triggers a full resync, series plus occurrence exceptions, Google wins.
- [v2.0]: Every phase is a `gsd/*` branch merged into `master` through a PR after green CI; old dv-lab code is rewritten, ielts is ported as is.
- [Phase 17]: 17-03: resolveDatabaseUrl in packages/db is the only reader of DATABASE_URL and MIGRATOR_DATABASE_URL; under NODE_ENV=test the database must end with _test, no CI exception (CI database is dvlab_test too)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 19] Opening balance is set by the teacher per card (LEDG-09): vault payment files say "lessons covered: to calculate" and lesson history is not imported.
- [Phase 17] Server steps are run by the owner through the "Server guy" session. Traps in `~/.claude/servers/dv-lab.md`: PostgreSQL 18 volume path, Docker ports bypassing ufw, HTTP/3 off, CI trigger on `master` instead of `main`, `next/font/google` downloads at build time, API hang on `SIGTERM`.
- [Phase 24] The Google OAuth app must be in production status; in Testing the refresh token expires after 7 days.
- [Phase 26] No rollout while an ielts room has active students. ielts keeps running on Vercel and Neon until Phase 26; its phase 6.2 UAT is open in the ielts repository.
- [Launch] Access from Russian networks to OVH is checked when the app is ready, before the 12-month commitment.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
| -------- | ---- | ------ | ----------- | --------- |
| _(none)_ |      |        |             |           |

## Session Continuity

Last session: 2026-10-10T05:54:03.047Z
Stopped at: Phase 21 context gathered
Resume file: .planning/phases/21-lesson-accounting-and-today/21-CONTEXT.md
