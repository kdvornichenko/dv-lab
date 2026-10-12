---
gsd_state_version: '1.0'
milestone: v2.0
milestone_name: Unified dv-lab (In Progress)
current_phase: 24
current_phase_name: Google Calendar Connection and Outbound Sync
status: paused
stopped_at: Phase 24 plans 01-13 done; 24-14 (live Google check on the owner test account) waits for a local OAuth client; Phase 25 is to be rewritten as 25.1
last_updated: '2026-10-12T13:00:00.000Z'
last_activity: 2026-10-12
last_activity_desc: Status synced with master after PRs 10-29 made outside GSD plans
state_head: 09211e81b3037e6b78d10bda00ba2009a96b48af
progress:
  total_phases: 11
  completed_phases: 6
  total_plans: 189
  completed_plans: 103
  percent: 54
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-09)

**Core value:** The teacher can always see who studies, how many lessons remain for each student, who has to pay soon and what was covered, and can record any of it by writing one line in chat.
**Current focus:** Phase 24 — Google Calendar Connection and Outbound Sync

## Current Position

Phase: 24 (Google Calendar Connection and Outbound Sync) — PAUSED, 13 of 14 plans done
Plan: 14 of 14 (13 done; 24-14 is the live Google check)
Status: Paused; live provider verification pending on the owner test account
Last activity: 2026-10-12 — status synced with master

Progress: [█████░░░░░] 54%

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

- [Owner, 2026-10-12]: Claude only, no Codex or other runtimes. Questions to the owner go through the chat, not a blind autonomous run. Design dude owns design, Server guy owns the server and releases; agents never reach prod.
- [Owner, 2026-10-12, D1-D10]: order Google account switch -> design part 2 -> rework of Phase 25 sync; split integrate/calendar into PRs; rewrite the background sync (one task, no shared lock, version grows only on change, bounded window, cleanup, no extra tables); Phase 25.1 core = create any event, move and resize with the mouse, delete one/series/this and following, repeats, colors, description and place, calendar choice inside the account, store only needed Google fields; day/month views are not in the core (week only); history is not rewritten, legacy runtime paths are removed from documents by a script; Phase 25 documents are shortened while planning 25.1.
- [Owner, 2026-10-12]: Live Google tests only locally on the owner test account (needs a local OAuth client with its own redirect, secrets not committed). Prod holds the teacher's working calendar and is never used for live writes; releases go to prod without live testing there. Supersedes the earlier decision to use dv-lab.dev as the prelaunch test target.
- [Owner, 2026-10-12]: Lesson length has no upper limit (the 15-240 CHECK is removed by a migration); the schedule day runs 02:00-02:00; frequent actions are automated (overlap check runs by itself, no `c` shortcut, no New lesson button on the laptop toolbar).
- [v2.0 roadmap, owner decision 2026-10-11]: After Phase 21, default time zone becomes a setting before Google Calendar (24-25), then chat (22-23), then IELTS (26). Calendar UAT waits for full Google sync.
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
- [Phase 24] OAuth client and Calendar scopes are configured on prod; the app remains in Testing. Plan 24-14 (real consent, refresh, revoke, fault and student cases) waits for a local OAuth client for the owner test account; Broken Windows 7-11 stay open until then.
- [Phase 26] No rollout while an ielts room has active students. ielts keeps running on Vercel and Neon until Phase 26; its phase 6.2 UAT is open in the ielts repository.
- [Launch] Access from Russian networks to OVH is checked when the app is ready, before the 12-month commitment.

### Work outside GSD plans (PRs 10-29, all merged and released)

Count lessons by range, one week at a time, dialog v42 and Copy icon (10, 11, 13-15, 28); Google account switch with connection history (12, 19); phase-24 fixes and security: REVOKE DELETE, Caddy defer, restored lessons, strict zone check (16-18); calendar design v44, laptop layout, zone picker, cancelled events hidden, week cache and week picker, 02:00 day with lanes, New lesson dialog with automatic overlap check, second-zone button (20-27, 29). Open: week range label (PR 30), HH:MM length without upper limit (branch feat/length-hhmm).

### Next steps

1. Rewrite Phase 25 into 25.1 per D5-D10 (plan, shorten documents, remove legacy runtime paths by script), then execute.
2. Plan 24-14 live check after the local OAuth client for the test account exists.
3. Then 22 -> 23 -> 26.

### Roadmap Evolution

- Phase 25 is reworked into 25.1 after the code review of integrate/calendar (2026-10-12).

- Phase 21.1 inserted after Phase 21: Default Time Zone before Google Calendar; parallel planning authorized 2026-10-11

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
| -------- | ---- | ------ | ----------- | --------- |
| _(none)_ |      |        |             |           |

## Session Continuity

Last session: 2026-10-12T13:00:00.000Z
Stopped at: Phase 24 plans 01-13 done; status synced; next is the Phase 25.1 rewrite
Resume file: .planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md
