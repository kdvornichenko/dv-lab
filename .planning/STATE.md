---
gsd_state_version: '1.0'
milestone: v2.0
milestone_name: Unified dv-lab (In Progress)
current_phase: 24
current_phase_name: Google Calendar Connection and Outbound Sync
status: executing
stopped_at: Phase24 plans01–07 source integrated; plan08 and remaining12/13 active
last_updated: '2026-10-11T20:45:29.099Z'
last_activity: 2026-10-12
last_activity_desc: Autonomous GSD for24→25→22→23→26; plan07 source complete; provider proof pending
state_head: 4d1e1ee50538c97cef1314e577e15f1ed144ce9f
progress:
  total_phases: 11
  completed_phases: 2
  total_plans: 104
  completed_plans: 98
  percent: 18
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-09)

**Core value:** The teacher can always see who studies, how many lessons remain for each student, who has to pay soon and what was covered, and can record any of it by writing one line in chat.
**Current focus:** Phase 24 — Google Calendar Connection and Outbound Sync

## Current Position

Phase: 24 (Google Calendar Connection and Outbound Sync) — EXECUTING
Plan: 9 of 14
Status: Executing; connected provider verification pending
Last activity: 2026-10-12 — Plans01–07 source complete;08 active;12 controller and13 remote faults in progress; connected provider verification pending

Progress: [██░░░░░░░░] 18%

## Deferred Verification

| Phase | State                                                    | Resume                                                                   |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| 17    | verification_deferred_human                              | /gsd-verify-work 17                                                      |
| 18    | verification_deferred_human                              | /gsd-verify-work 18                                                      |
| 19    | verification_deferred_human                              | /gsd-verify-work 19                                                      |
| 21    | Two manual scenarios accepted as deferred after Phase 25 | Real VN midnight and final Earlier panel removal; see 21-VERIFICATION.md |

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
| 21    | 18    | -     | -        |
| 21.1  | 13    | -     | -        |

Phases 1-16 (v1.0, v1.1) are archived in `.planning/milestones/v1.1-ROADMAP.md`.
**Per-Plan Metrics:**

| Plan         | Duration | Tasks   | Files    |
| ------------ | -------- | ------- | -------- |
| Phase 17 P01 | 40min    | 3 tasks | 16 files |
| Phase 17 P02 | 15 min   | 2 tasks | 9 files  |
| Phase 17 P03 | 5 min    | 2 tasks | 15 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Owner, 2026-10-12]: Autonomous GSD covers24→25→22→23→26: research, plans, UI analysis/spec, plan checks, implementation and verification. No questions while the owner is away. Coordinate Design dude and Server guy as needed; deploy and test the necessary work on the existing authorized site. New agents use gpt-6.1-sol. Preserve external access, privacy, data and deletion boundaries; inaccessible proof stays unverified.

- [v2.0 roadmap, owner decision 2026-10-11]: After Phase 21, default time zone becomes a setting before Google Calendar (24-25), then chat (22-23), then IELTS (26). Calendar UAT waits for full Google sync.
- [Phase 24, owner decision 2026-10-12]: Current dv-lab.dev and its database are the authorized prelaunch test target. Use synthetic fixtures and a separate Google PRIMARY account after exact build/persistence attestation. A separate test environment is deferred until Calendar and chat are fully tested. Server guy owns target preparation and coordinated release.
- [v2.0 roadmap]: The manual schedule (Phase 20) comes before chat because chat marks and moves lessons; Google Calendar (Phases 24-25) builds on the same lesson, series and exception model.
- [v2.0 roadmap]: Requirements placed by their last dependency: ACCT-04 in Phase 19 (cards), CARD-04 in Phase 20 (schedule), SHELL-05 in Phase 21, SHELL-03, SHELL-04 and CARD-05 in Phase 23 (chat entry points).
- [v2.0]: Calendar follows CODE-AUDIT.md: deterministic event ids, one writer per lesson, `events.watch` and `syncToken`, `410` triggers a full resync, series plus occurrence exceptions, Google wins.
- [v2.0]: Every phase is a `gsd/*` branch merged into `master` through a PR after green CI; old dv-lab code is rewritten, ielts is ported as is.
- [Phase 17]: 17-03: resolveDatabaseUrl in packages/db is the only reader of DATABASE_URL and MIGRATOR_DATABASE_URL; under NODE_ENV=test the database must end with _test, no CI exception (CI database is dvlab_test too)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 19] Opening balance is set by the teacher per card (LEDG-09): vault payment files say "lessons covered: to calculate" and lesson history is not imported.
- [Phase 17] The operator is Server guy (VPS access by key; DNS through the owner's personal Vercel CLI) or the owner. Steps that print a password or require a token (RUNBOOK 10.3, 10.5, 4.2) are performed by the owner. Traps in `~/.claude/servers/dv-lab.md`: PostgreSQL 18 volume path, Docker ports bypassing ufw, HTTP/3 off, CI trigger on `master` instead of `main`, `next/font/google` downloads at build time, API hang on `SIGTERM`.
- [Phase 24] OAuth client and Calendar scopes are configured; the app remains in Testing. Public homepage, privacy policy and terms pages are accepted phase-24 work before retrying Production publication. The callback is fixed in ROADMAP; connection runtime is pending.
- [Phase 26] No rollout while an ielts room has active students. ielts keeps running on Vercel and Neon until Phase 26; its phase 6.2 UAT is open in the ielts repository.
- [Launch] Access from Russian networks to OVH is checked when the app is ready, before the 12-month commitment.

### Roadmap Evolution

- Phase 21.1 inserted after Phase 21: Default Time Zone before Google Calendar; parallel planning authorized 2026-10-11

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
| -------- | ---- | ------ | ----------- | --------- |
| _(none)_ |      |        |             |           |

## Session Continuity

Last session: 2026-10-11T17:42:00Z
Stopped at: Phase24 Plan05 source integrated;06 next; live prelaunch target preparation active
Resume file: .planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md
