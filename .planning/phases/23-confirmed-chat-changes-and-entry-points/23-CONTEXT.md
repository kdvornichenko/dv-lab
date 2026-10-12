# Phase 23: Confirmed Chat Changes and Entry Points — Context

**Gathered:** 2026-10-12
**Status:** Research and independently checked UI prepared; 69 UI considerations resolved; execution waits for final Phase 22 and rebinding final Phase 24/25 interfaces

## Phase Boundary

Payments, new student cards, deletions, rate changes and bulk schedule moves proposed in chat require explicit teacher confirmation. Regular forms use the same domain owners. Chat, payments and student profiles remain reachable at phone width. Pasted essay feedback is labeled as an approximate estimate.

Requirements: CHAT-05, CHAT-06, CHAT-10, CHAT-12, SHELL-03, SHELL-04, CARD-05. Phase 22 owns conversations, mentions, immediate marks/notes, Undo, stream and budget. Phase 23 extends those owners instead of introducing another chat engine.

## Locked Decisions

- **D-01:** The accepted execution order is 24 → 25 → 22 → 23 → 26. Research, UI and plan preparation may progress independently; final dependency signatures must be rebound before execution.
- **D-02:** A chat proposal is not an applied change. Payment, new card, deletion, rate change and bulk move effects require an explicit confirmation bound to the exact current proposal. Decline leaves business data unchanged.
- **D-03:** Chat and ordinary forms call the same existing domain owners. Current balances, counts, marks and schedule identities remain authoritative. The model does not calculate money or generate provider confirmations.
- **D-04:** CHAT-06 explicitly uses Vietnam time when the prompt names no zone. A named zone, including MSK, controls the proposed bulk move. Existing lesson creation zones and instants follow the accepted core/schedule rules; research must make the preview and conversion observable.
- **D-05:** Google-backed schedule writes use the existing confirmed command, recovery and partial-state path. A confirmed proposal alone cannot claim Saved before actual Google acknowledgement and committed projection.
- **D-06:** Existing history, marks, payment facts and stable card identities remain intact under the applicable domain policy. Schedule rows are not physically removed. Research must distinguish supported deletion/archive operations and name the owner; it must not invent a destructive business operation from a model phrase.
- **D-07:** Essay feedback is an approximate estimate, not an official IELTS result. It uses the Phase 22 configured provider/model/budget path. Phase 26 exam workflow is excluded.
- **D-08:** UI reuses Base UI and variant A/v40. Product copy is English. No eyebrows, Radix or cmdk. Navigation, focus, confirmation and phone interactions require public browser evidence.
- **D-09:** The owner authorized autonomous research/planning/UI/check/implementation and coordinated release/testing without questions while away. New agents use the session agent model. Server guy owns runtime/release leases and secrets. Missing observations remain UNVERIFIED.

## Unreviewed Defaults

- **UD-01:** Reuse the durable proposal/run/tool/usage store designed in Phase 22. A proposal revision and exact target/version bind Confirm; replay and stale confirmations cannot repeat effects.
- **UD-02:** A changed target or changed proposal requires a fresh preview before confirmation. Display actual money/date/zone/student scope; do not expose transport or journal details in the product flow.
- **UD-03:** Reuse existing payment/card forms and shared command palette components where they exist. Research identifies the narrow owner and approved composition before adding a UI surface.

These are technical defaults under autonomous authority. Research may replace them with an evidence-backed implementation within the accepted outcome.

## Acceptance and Facts to Resolve

SC1: every money/new-card/deletion/rate proposal requires Confirm; Decline and stale/replayed confirmation produce no unintended write.
SC2: bulk move previews the exact student/series/occurrences and named zone; no named zone means Vietnam; confirmation uses the same Google writer and preserves history.
SC3: a chat change opens in ordinary forms and has the same balance/schedule; concurrent form changes cannot be overwritten by an old proposal.
SC4: pasted essay feedback visibly states an approximate estimate and respects existing usage/guardrails.
SC5: palette, profile entry points, Today, Schedule and Chat work at phone width with keyboard/focus behavior.

Research facts: F01 proposal/confirm/decline identity and lifecycle; F02 money/rate precision and domain owners; F03 card/archive/deletion boundary and current IDs; F04 bulk target/time-zone/Google partial recovery; F05 correction parity and concurrent edits; F06 essay input/estimate/provider-budget boundary; F07 palette/profile/phone components and routes; F08 teacher authority and untrusted content; F09 exact proposed signatures/write inventory; F10 minimum existing public E2E and real provider evidence.

## Scope Card

Outcome: implementation-ready research, UI contract and checked plans for SC1–SC5/F01–F10.
In scope now: evidence, necessary technical decisions, proposed owners/interfaces, failure modes and minimal verification map.
Out of scope now: source edits, runtime, DB/provider/model calls, secrets, dependency install, Git/deploy, deletion, changes to completed phases, a new environment and Phase 26.
Planned writes: Parent owns this CONTEXT; a separately assigned researcher owns only 23-RESEARCH.md; Design dude owns the external Phase 23 UI-SPEC; later planner/checker writes are separately bounded. Existing source owners are read-only during preparation.
A1: Phase 22 research/UI preparation exists, while final source does not; evidence is 22-CONTEXT/RESEARCH/UI-SPEC. Proposed chat signatures are not implementation proof.
A2: payment/card/schedule/core owners already exist; evidence is AGENTS.md and tracked source recovered during research. Their exact supported operations must be verified before a proposed adapter is planned.
Verification: cited current official provider facts where needed, tracked symbols and fingerprints, complete SC/F-to-task/failure-path map, independent UI/plan checks. No document or test discovery result proves runtime behavior.
Work map: source owner recovery → SC1/2/3 and F01–05/F09; provider/essay/budget evidence → SC4/F06/F08; approved UI/component mapping → SC5/F07; durable public journeys → all SC/F10.
Stop: preparation closes all SC/F design/proof paths with explicit external gaps. Execution stays behind final 24/25/22 dependency rebind.

## Canonical References

- AGENTS.md and .planning/EXECUTOR-RULES.md: authority, privacy, quality, E2E and Git boundaries.
- .planning/ROADMAP.md Phase 23 and .planning/REQUIREMENTS.md: accepted scope and exact requirements.
- .planning/phases/22-chat-with-mentions-and-quick-marks/22-CONTEXT.md, 22-RESEARCH.md and 22-UI-SPEC.md: proposed chat/run/tool/usage/Undo owners and model controls.
- Final Phase 24/25 calendar commands, projection, recovery and inbound binding: required execution dependency, not currently completed proof.
- packages/core and current cards/payments/schedule modules: existing money, balances, marks, rows and zone ownership.
- Existing e2e/spec/support journeys: public application and real persistence verification owners. No new isolated test suite.

## Deferred Ideas

IELTS26 exam features, provider/model quality evaluation beyond the accepted approximate essay feedback, new calendars, new infrastructure, physical schedule/history removal and unrelated redesign are excluded. Missing provider access, monetary cap and actual spike observations are not invented during preparation.
