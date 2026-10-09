# dv-lab

## What This Is

dv-lab is the private workspace of an English and IELTS teacher (Vika): student cards, lesson and payment tracking, a chat assistant that records facts and answers from the data, a Google Calendar–synced schedule, and an IELTS practice section for students. One teacher, many students, self-hosted on an OVHcloud VPS. The interface is fully in English.

It merges three sources: the earlier `dv-lab` CRM (skeleton and functional reference only), the working `ielts` app (ported), and the student data and variant A design from `vault`.

## Core Value

The teacher can always see who studies, how many lessons remain for each student, who has to pay soon and what was covered, and can record any of it by writing one line in chat.

## Current Milestone: v2.0 Unified dv-lab

**Goal:** New workspace on the own VPS: student cards, chat, lesson and payment accounting in the variant A design, then IELTS. The old dv-lab code and data do not carry over; only the monorepo skeleton stays.

**Target features:**

- Server and empty skeleton deployed: VPS, PostgreSQL 18, HTTPS proxy, backups, CI to GHCR; all libraries updated to latest.
- Login ported from ielts (one teacher, students).
- Variant A shell (Base UI, English) and `packages/core` with lesson and payment rules.
- Student cards imported from vault into Postgres (all 25 students, no preview).
- Lesson and payment accounting in minutes; unpaid-soon list.
- Chat on `claude-haiku-5-5`: `@student` mentions with quick actions, writes with undo or confirmation, answers from history.
- Schedule and Google Calendar rebuilt: series plus occurrence exceptions, idempotent events, one writer, `events.watch` and `syncToken`.
- IELTS as a `/ielts` section, ported last.

## Requirements

### Validated

(None carried over. The v1.x CRM code is a functional reference and is rewritten.)

### Active

- [ ] Server runs the empty skeleton with Postgres 18, HTTPS, backups and CI/CD.
- [ ] Teacher and students sign in with ielts-style accounts and sessions.
- [ ] Variant A shell is the only interface; every screen is in English.
- [ ] Every student has one card with a stable id, text sections, vocabulary and payments.
- [ ] Balance is tracked in minutes and shown in lessons with fractions; no-shows deduct by default, moves and cancellations do not.
- [ ] Chat records lesson outcomes, moves (one lesson or a series), payments and notes through `@student` mentions.
- [ ] Google Calendar changes flow both ways without duplicates; Google wins conflicts.
- [ ] IELTS tasks, rooms, attempts and grading work under `/ielts` on the new server.

### Out of Scope

- Migrating data from the old dv-lab database — not in use; lessons and history are re-entered and synced with the calendar.
- Porting old dv-lab screens and services as-is — rewritten from variant A components.
- Online card payments and reconciliation — payments are recorded manually.
- Student access beyond `/ielts` (schedule, balance) — students only practice.
- Multi-teacher interface — the schema keeps `teacher_id`, the product has one teacher.
- Speaking audio feedback, live mirroring of the student screen, PWA and push — later.
- The vault note reader — stays a separate site.
- Storing data in markdown or git, and payment-sum previews — all data is written to Postgres directly.

## Context

- Sources: `/Volumes/T7/personal/dv-lab` (skeleton), `/Volumes/T7/personal/ielts` (working app, Next 16.3, Drizzle, Base UI), `/Volumes/T7/personal/vault` (25 student folders in `md/personal/vika/students/`, variant A snapshot `cda53ee` on branch `design/lab`).
- Handoff from the vault session: `/Volumes/T7/personal/vault/.planning/research/DV-LAB-MERGE-HANDOFF.md`. Code audit of the old dv-lab: `.planning/research/CODE-AUDIT.md` (the calendar findings drive the rebuild).
- Server: OVHcloud VPS-2, Beauharnois, Ubuntu 26.04, 4 vCore, 8 GB, 75 GB; profile `~/.claude/servers/dv-lab.md`; the server is operated by a separate session, agents have no direct access.
- Vercel, Supabase and Neon leave the project; DNS stays at Vercel with new IPs. ielts keeps running on Vercel and Neon until its phase because essays are still reviewed and graded there.
- Default time zone is Vietnam; a prompt can name another (for example MSK).
- Network risk: connections to OVH from some Russian networks can be cut; HTTP/3 is off; checking from Russia is postponed until the app is ready.

## Constraints

- **Tech stack**: Yarn 4 + Turborepo skeleton kept, every library at latest (Next 16.4, React 19.3, TypeScript, Turbo, Yarn); Hono API; Drizzle; Tailwind 4; Base UI with shadcn style `base-mira`; Radix is not used.
- **Database**: PostgreSQL 18 on the VPS; CI runs on the same image and role; no Redis; queues through `pg-boss`, events through `LISTEN/NOTIFY`.
- **Hosting**: one domain `dv-lab.dev` behind a reverse proxy; images built by GitHub Actions and pulled by the server; no builds on the server.
- **AI**: `claude-haiku-5-5`, budget about $200; code computes all numbers, the model reads and writes through `packages/core` tools.
- **Delivery**: GSD phases, one branch per phase named `gsd/*`, merged through a pull request after green CI; rewrite over port, port only what works (ielts).
- **Language**: interface and product text in English.

## Key Decisions

| Decision                                                                 | Rationale                                                                                   | Outcome   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------- |
| Rewrite instead of porting old dv-lab; port only ielts                   | Old code is unused; rewriting is cheaper than analysing and fixing it                       | — Pending |
| Keep Turborepo and Yarn 4 skeleton, update all libraries                 | Skeleton works; dependencies are stale                                                      | — Pending |
| Database rewritten from zero on Drizzle v1, old migrations dropped       | Old schema and data are not carried over; fixing old migrations is wasted work              | — Pending |
| Keep Hono for `apps/api`                                                 | Already in place; WebSocket exists; logging, tracing and migrations are closed explicitly   | — Pending |
| Login ported from ielts; Supabase Auth removed                           | ielts auth works and is tested; Supabase leaves the project                                 | — Pending |
| One teacher, `teacher_id` stays in the schema                            | Cheaper than removing; no multi-teacher UI                                                  | — Pending |
| PostgreSQL 18 on own VPS, files on disk                                  | Own server; Neon, Supabase, Vercel Blob leave                                               | — Pending |
| Balance in minutes, shown in lessons with fractions                      | A 90-minute lesson against 60-minute lessons must leave half a lesson                       | — Pending |
| Calendar: series plus occurrence exceptions, deterministic event ids     | The old sync duplicated events; one writer, `events.watch` and `syncToken`, Google wins     | — Pending |
| Chat: lesson marks apply at once with undo; money and deletes confirm    | Fast entry for frequent actions, safety for destructive ones                                | — Pending |
| Variant A components, Base UI                                            | Variant A and ielts already use Base UI; Radix is dropped                                   | — Pending |
| IELTS under `/ielts`, ported last                                        | One app and one login; ielts keeps running on Vercel and Neon until then                    | — Pending |
| Student data from vault goes straight into Postgres                      | Previews and git commits were only needed while data lived in markdown                      | — Pending |
| Default time zone Vietnam, other zones named in the prompt               | Teacher works from Vietnam; students sit in several zones                                   | — Pending |

Superseded by v2.0: Supabase as the auth/data boundary, Google as login identity, reuse of ITS-DOC packages, v1 single-student-per-lesson billing model.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-10-09 after v2.0 milestone start_
