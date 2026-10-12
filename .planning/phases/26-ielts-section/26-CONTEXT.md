# Phase 26: IELTS Section — Context

**Gathered:** 2026-10-12
**Status:** Research, architecture, patterns and independently checked UI prepared; 82 UI considerations resolved; plans next, execution remains last with final24/25/22/23 rebind and migration/operator gates

## Phase Boundary

Port the existing IELTS application into the `/ielts` section of dv-lab on its current server. Preserve existing accounts, rooms, attempts, grades, media and the implemented phase 6.2 behavior. IELTS screens adopt variant A in both themes. The old Vercel/Neon deployment stays available until the teacher explicitly confirms shutdown after parity is demonstrated.

Requirements: IELTS-01…06. This phase is a port of the existing product, not a new exam engine or speaking-feedback feature. Phase 19 account/card boundaries are a dependency; accepted execution order places 26 after 24 → 25 → 22 → 23.

## Locked Decisions

- **D-01:** A signed-in student lands on `/ielts` and cannot open any other section. Teacher and student permissions apply to both pages and public API routes; a hidden navigation link alone is not authorization.
- **D-02:** The teacher manages tasks, sections, mock tests and media under `/ielts`. Uploaded media is stored on the server disk and plays for authorized students.
- **D-03:** Existing rooms, timer controls, attempts, automatic checking and teacher essay review/grading preserve current IELTS behavior, including phase 6.2. Existing product rules must be recovered from source and acceptance artifacts before planning.
- **D-04:** Existing accounts, rooms, attempts, grades and media migrate with matching counts and validated identities/references. No real student data, essays, credentials or private server addresses enter the public repository, planning files or logs.
- **D-05:** A rollout does not start while an IELTS room has active students. Actual activity/quiescence is an operator observation, not an assumed empty state from local source.
- **D-06:** Vercel/Neon shutdown requires the teacher's explicit confirmation after migration/parity evidence. The autonomous research/implementation/rollout instruction does not replace this specific shutdown condition. Keep the old deployment until that confirmation exists.
- **D-07:** Source IELTS is read-only at `/Volumes/T7/personal/ielts`, current commit `df57b7000c6adc60f35071065b4423d426d263a0`. Its `.env.local`/Neon main database is production, not a fixture target. Research does not read secrets, connect to that database or run destructive old tests.
- **D-08:** The accepted dv-lab target supersedes old IELTS hosting-only Vercel/Blob constraints for this port. Other source behavior and data boundaries remain input. Server guy owns actual server/database/media operations, runtime leases and secrets; private profile addresses stay outside repositories.
- **D-09:** Reuse dv-lab Base UI, variant A and shared auth/contracts/core boundaries. Product copy is English; no eyebrows, Radix or cmdk. Screen changes must preserve the existing IELTS interactions.
- **D-10:** The owner authorized autonomous research/planning/UI/check/implementation and necessary coordinated rollout/testing without questions while away. New agents use gpt-6.1-sol. Missing observations remain UNVERIFIED; no new paid provider or environment is implied.

## Unreviewed Defaults

- **UD-01:** Keep source domain rules and behavior behind a narrow adaptation to dv-lab routing, auth, persistence and disk storage. Research determines exact module boundaries from the current source; it must not copy a second independent auth system without demonstrating need.
- **UD-02:** Migration is resumable and validates stable source IDs, relationships, counts and media checksums. Ambiguous identity mapping stops the affected import instead of guessing by student names.
- **UD-03:** Preserve source and target data during preparation and verification. No physical domain/file deletion or cleanup is planned by default; additive migrations use the target's existing generator/migrator ownership.

These are technical defaults under autonomous authority. Research may replace them within the accepted port outcome and explicit data/shutdown boundaries.

## Acceptance and Facts to Resolve

SC1: student login/default route and page/API isolation hold for direct navigation and requests.
SC2: teacher CRUD and authenticated disk-media playback work under `/ielts`.
SC3: current room/timer/attempt/checking/essay-grade journeys and phase 6.2 behavior retain observable parity.
SC4: migration validates actual counts, stable identity/reference mapping and media checksums; active rooms block rollout; old hosting remains until explicit teacher confirmation.
SC5: IELTS uses approved variant A in light/dark themes without losing functional behavior.

Research facts: F01 source feature/phase6.2 inventory and actual owners; F02 account/card/role/route adaptation; F03 schema/identity/migration ownership and resumability; F04 private media/disk/streaming/upload boundaries; F05 room/timer/attempt/checking parity; F06 essay-review/grading parity; F07 approved UI adaptation surfaces; F08 quiescence, coordinated rollout/parity/rollback and shutdown gate; F09 exact proposed write inventory/signatures/dependency needs; F10 minimum existing public E2E and real migration evidence.

## Scope Card

Outcome: implementation-ready research, UI contract and checked plans for IELTS-01…06/SC1–SC5/F01–F10.
In scope now: read-only source recovery, necessary adaptation decisions, migration/proof design, proposed owners/signatures and UI/failure map.
Out of scope now: source edits, env/data/media reads, runtime or DB connections, old deployment changes, dependency install, Git/deploy, deletion, new infrastructure and future speaking/live-mirror features.
Planned writes: Parent owns this CONTEXT; a separately assigned researcher owns only 26-RESEARCH.md; Design dude owns external Phase26 UI-SPEC; later planner/checker writes are separately bounded. Both application sources remain read-only during preparation.
A1: the source project exists and is a Git repository at the pinned commit; evidence is Codex project metadata and `git rev-parse HEAD`. Only untracked source `AGENTS.md` is present; preserve it.
A2: phase6.2 acceptance artifacts exist at `.planning/phases/06.2-progress-statistics-and-lesson-first-teacher-ux/` in IELTS; this is input for behavior recovery, not target runtime proof.
A3: target role/account, core and deployment owners exist per dv-lab AGENTS; exact symbols, migration readiness and real active-room/data counts require research/operator evidence.
Verification: tracked source/feature fingerprints, exact source-to-target parity matrix, cited current primary storage/runtime facts where needed, complete SC/F-to-owner/failure/E2E map, independent UI/plan checks. No local document or discovery check proves production migration or room inactivity.
Work map: source/role recovery → SC1/3/F01/02/05/06; migration/media adaptation → SC2/4/F03/04/08; approved design mapping → SC5/F07; exact ownership and existing durable public journeys → all SC/F09/10.
Stop: preparation closes design/proof paths and records actual external gates. Execution stays last; shutdown stays behind teacher confirmation and active-room/parity evidence.

## Canonical References

- dv-lab AGENTS.md, .planning/EXECUTOR-RULES.md, PROJECT, ROADMAP26 and REQUIREMENTS IELTS-01…06.
- Read-only IELTS AGENTS.md, .planning/PROJECT.md, STATE.md, ROADMAP.md and phase6.2 CONTEXT/VERIFICATION/relevant summaries.
- Current IELTS tracked task/media/room/attempt/grading/auth/UI source and existing public E2E owners, recovered narrowly during research.
- dv-lab Phase19 account/card owners and existing contracts/core/API/web/deploy boundaries.
- deploy/RUNBOOK.md and Server guy's private operator profiles: actual migration/quiescence/release evidence belongs to the server owner, without addresses or secrets in planning.

## Deferred Ideas

Speaking feedback, live student screen mirroring, a replacement exam engine, new realtime/provider services, new environment, unrelated redesign and automatic old-hosting shutdown are excluded. Current active rooms, private migration manifests/data counts/media checksum evidence and teacher shutdown confirmation remain external observations.
