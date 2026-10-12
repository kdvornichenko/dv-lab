# Phase 25: Google Calendar Two-Way Sync — Context

**Gathered:** 2026-10-12
**Status:** Research and UI contract prepared; Phase 24 implementation remains active

<domain>

## Phase Boundary

Google changes reach the app without an open page. Push notifications trigger incremental sync. A real 410 starts a full resync. Matching, Assign/Ignore, occurrence/series projection, Google wins, channel renewal and nightly reconciliation close GCAL-04…08.

Phase 24 already makes Google authoritative for future event reads and confirmed outbound commands. Phase 25 extends that model. It does not create a second schedule engine. Chat22/23 and IELTS26 remain outside this phase.

</domain>

<decisions>

## Locked Decisions

- **D-01:** Phase order is24→25→22→23→26. Existing IDs, marks, payments and accounting history remain intact. Google wins concurrent edits.
- **D-02:** Target is the actual PRIMARY calendar. The prelaunch site and existing database are authorized with synthetic fixtures and a separate TEST Google account. Personal PRIMARY is not a substitute. Server guy owns release/runtime leases and server secrets.
- **D-03:** One stable connection writer owns both outbound and inbound effects. Provider HTTP runs outside SQL transactions. Unknown/partial outbound commands cannot become false Saved confirmations through inbound observations.
- **D-04:** Series rule columns remain immutable after insert. Schedule rows are not physically removed. Research must define how external master changes project into this model while preserving past occurrence identities and marks.
- **D-05:** App-created identity mapping precedes name matching. Matching must be deterministic and account-bound. Ambiguous names or duplicate provider identities require explicit review; no fuzzy guess binds a lesson.
- **D-06:** UI reuses variant A/v40 and existing Phase24 read/write/command owners. Connected, an active watch channel and a complete checked calendar are different facts. Assign/Ignore and sync failures cannot promise effects beyond actual provider/persistence evidence.
- **D-07:** The owner authorized autonomous research/planning/UI/check/implementation and necessary coordinated rollout/testing, without questions while away. New agents usethe session agent model. Missing access or observation remains unverified; independent work continues.

## Unreviewed Defaults

- **UD-01:** Reuse existing pinned Google SDK and pg-boss. Add no dependency unless a concrete unsupported requirement proves it necessary.
- **UD-02:** Preserve provider event data on Ignore. Store a durable disposition bound to a validated provider identity; research determines its invalidation rules.
- **UD-03:** Match only one canonical short-name candidate. Research must recover the actual card-name owner and define normalization without inventing a second name schema.
- **UD-04:** Preserve existing marks/accounting facts when inbound edits affect historical occurrences. Research must resolve the boundary between authoritative future projection and immutable history.

These are technical defaults selected under autonomous authority. The owner has not reviewed them. Research may replace a default with a better evidence-backed implementation before planning.

</decisions>

<specifics>

## Acceptance and Open Facts

SC1: actual notification/incremental delivery and410 resync without duplicate lessons.
SC2: one occurrence changes only itself; master changes project the series.
SC3: stable app mapping, unique name matching, Assign/Ignore and busy-time behavior.
SC4: Google wins alongside immutable outbound journals and honest terminal outcomes.
SC5: watch renewal and nightly reconcile recover missed delivery.

Design preparation is `/Users/kdvornichenko/dv-lab-design/phase-25/25-UI-SPEC.md`. Research must close F01…F09 before dependent plans: DTO/read facts, latency, eligibility/scope, name normalization, review identity/actions, durable Ignore, command/history conflict handling, source signatures and real provider E2E stimulation/evidence.

Assumption A1: Phase24 read/journal/lease/schema owners exist in the current source; their paths are listed below. Assumption A2: plans09…11 are still being implemented; source08/12 is integrated. Planned interfaces are not implementation proof. Rebind final source signatures before execution25.

Stop research when eachSC/F fact has a cited design choice, owner/signature/write map and verification path, with external gaps explicit. No runtime or provider pass is inferred from documents.

</specifics>

<canonical_refs>

## Canonical References

- `AGENTS.md` and `.planning/EXECUTOR-RULES.md` — authority, E2E, privacy, quality and Git boundaries.
- `.planning/ROADMAP.md`, Phase25 and `.planning/REQUIREMENTS.md`, GCAL-04…08 — accepted outcomes.
- `.planning/PROJECT.md` — project boundaries and existing sources.
- `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md` — Google authority, confirmation and phase boundary.
- `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-RESEARCH.md` — provider/command/read invariants.
- `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-UI-SPEC.md` — current presentation contracts and later25 exclusions.
- `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-07-SUMMARY.md` — implemented journal/recovery and actual verification limits.
- `.planning/phases/21.1-default-time-zone/21.1-CONTEXT.md` and `21.1-RESEARCH.md` in the same directory — immutable creation zones and occurrence/cut/history rules.
- `docs/google-calendar/READING.md` and `docs/google-calendar/manifest.json` — primary reference snapshot.
- `docs/google-calendar/articles/guides/sync.md`, `guides/push.md`, `v3/reference/events/watch.md` and `v3/reference/channels/stop.md` — provider facts, verified against current official documentation during research.
- `docs/google-calendar/CALENDAR-FAULT-HANDOFF.md` — actual scoped fault harness and missing runtime proof.
- `/Users/kdvornichenko/dv-lab-design/phase-25/25-UI-SPEC.md` — UI analysis/defaults/F01…09; variantA/v40 references and fingerprints.

</canonical_refs>

<code_context>

## Existing Owners

- `apps/api/src/calendar/credentials.ts`, `lease.ts`, `gateway.ts` — grant refresh, stable connection lease and actual Google transport.
- `apps/api/src/calendar/read-pages.ts`, `read-store.ts`, `read-model.ts`, `event-mapping.ts` — checked snapshots, prefix proof, versioned bindings and history.
- `apps/api/src/calendar/commands.ts`, `journal.ts`, `dispatch.ts`, `recovery.ts`, `worker.ts` — immutable command state, deadline, actual ACK and recovery.
- `apps/api/src/schedule/command-plan.ts`, `command-apply.ts` — pure preparation and confirmed domain effects.
- `packages/db/src/calendar-schema.ts`, `calendar-read-schema.ts`, `calendar-values.ts` and `packages/contracts/src/calendar.ts` — existing schema and shared registry; inspect actual symbols before declaring changes.
- `packages/core/src/schedule.ts`, `zoned.ts` — occurrence visibility, immutable series changes and zones.
- `apps/web/components/app/google-calendar-state.tsx` and Settings/Schedule modules — existing UI owners; they are being completed in24-12.
- Existing `e2e/calendar*.spec.ts`, `e2e/move.spec.ts` and their support modules — durable public journeys. New functional evidence must extend these real application/provider paths.

</code_context>

<deferred>

Chat22/23, IELTS26, alternate calendars, a separate test environment, physical schedule/history deletion and unrelated redesign are excluded. Phase24 Production/day8 and real-clock observations remain separate actual evidence; research25 does not close them.

</deferred>
