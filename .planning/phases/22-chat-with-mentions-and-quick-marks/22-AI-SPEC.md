# AI-SPEC — Phase 22: Chat with Mentions and Quick Marks

**Prepared:** 2026-10-12. Design contract only; provider spike and runtime are UNVERIFIED.

## Scope Card and evidence reuse

Outcome: bind the AI-specific decisions and proof paths for SC1–SC5/F01–F10 before PLAN22. Write set: only this file. Source, environment, provider/model calls, datasets, new services, dependencies, Git, runtime and paid evaluations are excluded here. Framework/docs/domain/risk decisions reuse [22-RESEARCH](22-RESEARCH.md), P1–P9, Models and Messages/Managed comparison. The separate GSD plan-checker checks this contract with the plans; this artifact does not claim four new AI-role runs.

A1: final24/25 interfaces are not yet execution22 inputs; rebind before source work. A2: account model access, key, finite cap and real spike are absent evidence; paid admission stays closed when required configuration is missing. Work map: §§2–4 → F01/F02/F09; §1b/§5 → F03–F06/F10; §§4b/6/7 → F07/F08. Stop: each critical failure has an owner, observable outcome and existing public proof path. No provider-quality PASS follows from synthetic application tests.

The native AI workflow's repeated framework/docs/domain research is replaced by current research evidence under the user's Minimum Sufficient Work rule. The Pydantic template example is adapted to TypeScript/Zod and the shared Registry; no Python dependency or second wire schema is introduced. These are technical workflow choices under current autonomous authority.

## 1. System Classification

Conversational assistant with server-owned retrieval and an allowlist of application tools. The teacher asks about stored student records and records single-lesson outcomes. Conversation, tool, action, event and usage identities belong to persistence.

Critical failures: a wrong student/occurrence changes; replay repeats a write or spend; a model invents a balance/count or Saved; stale Undo overwrites later work; concurrent or unknown usage admits spending beyond the cap.

## 1b. Domain Context

Education with accounting and student records. Incorrect suggestions are visible advice; incorrect tools or financial claims can change records or mislead the teacher. Business effects need deterministic application evidence.

| Dimension | Good                                                      | Bad                                                | Stakes / source                       |
| --------- | --------------------------------------------------------- | -------------------------------------------------- | ------------------------------------- |
| Target    | Exact selected student ID and eligible natural lesson ref | First matching name or nearest lesson guess        | Record integrity; CONTEXT/RESEARCH P3 |
| Action    | One committed owner effect and matching result            | Streamed success, replay or unrelated ACK          | History/accounting; P4/P5             |
| Facts     | Code facts equal Today/Students with source/coverage      | Model arithmetic or stale data as current          | Money/counts; P6                      |
| Advice    | Stored evidence distinct from suggestions                 | Student text becomes an instruction or a new write | Teaching/privacy; P6/P8               |

The teacher judges teaching usefulness. The application verifier judges identity, effects, facts and usage. No external rubric, score threshold, student dataset or legal compliance certification is invented. Existing teacher authority and privacy policies apply.

## 2. Framework Decision

Selected: official `@anthropic-ai/sdk`, Messages API, application conversation store. This implements the accepted server-key SDK decision and preserves local durable controls. Candidate version `0.133.0` comes from research's official registry evidence; it is not installed here. Before the planned install, verify provenance, compatibility and exact age/pin; preserve Yarn1440. Research's legitimacy warning remains a warning, not a fabricated VERIFIED status.

| Alternative                | Disposition                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Managed Agents             | Documented comparison retained; practical write/pause/reload/storage/usage parity UNVERIFIED. Not the initial transport |
| Vercel AI SDK              | Dropped by the accepted decision unless a concrete unsupported SDK requirement proves need                              |
| New retrieval/eval service | No accepted requirement needs another service or dependency                                                             |

Vendor lock-in is accepted for the provider adapter and configured model capabilities; application identities, actions and records remain owned locally.

## 3. Framework Quick Reference

Installation belongs to the explicit dependency task. Constructor key is injected from API configuration, never read in contracts, browser or a new environment owner. `maxRetries: 0` prevents an unadmitted automatic paid retry.

Entry pattern, with application-owned bindings defined by the implementation plan:

```ts
import Anthropic from '@anthropic-ai/sdk'

const provider = new Anthropic({ apiKey: configuredKey, maxRetries: 0 })
for await (const event of provider.messages.stream(admittedRequest, { signal: runSignal })) {
	await captureProviderEvent(event)
}
```

`admittedRequest`, `runSignal` and `captureProviderEvent` are semantic bindings, not implemented source proof. Persist and validate events before public publication. Execute a complete validated tool call, return its matching result/error, and reserve each continuation before the next request. Waiting, quiet stream and abort do not establish completion, rollback or no charge.

Official reference facts and pitfalls: [streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview), [effort](https://platform.claude.com/docs/en/build-with-claude/effort). Research contains the current source/date evidence; revalidate changed API inputs before paid execution.

## 4. Implementation Guidance

Models/order/effort/defaults come from validated configuration and actual capability evidence. Haiku/medium is a research-backed technical starting point, not an evaluated quality claim. Each admitted attempt captures model, effort, request, pricing profile and budget period. Changes affect the next explicit Send; no silent model fallback.

P1/P2 own durable run/event/attempt identities and replay. P3 owns exact mention and lesson resolution. P4/P5 adapt existing local owners and the final24/25 verified Calendar writer/Undo. P6 owns code facts and validated narrative slots. P7 owns invalidation and server reread. P8 owns content redaction without business/usage cascade. P9 owns reservations and settlement. New names/signatures remain PROPOSED in the research inventory until rebind.

History/context is bounded by the configured model profile and safe server policy. Include only authorized needed records; retrieved student text is untrusted data. Context overflow refuses admission or uses an explicitly planned bounded representation; no hidden paid summary request or character/token safety multiplier.

## 4b. AI Systems Best Practices

Structured outputs use the proposed shared Zod Registry, not a duplicated Pydantic/wire definition:

```ts
const validated = chatToolCall.safeParse(untrustedCall)
if (!validated.success) return toolError(callId, 'invalid_arguments')
return executeTool(serverContext, validated.data)
```

The named bindings are PROPOSED. Server context supplies actor/authority; model arguments cannot supply session, permission or a replacement target. Partial tool JSON never dispatches. Validation refusal still produces a matching persisted result.

Use asynchronous provider I/O outside SQL transactions. Persist-before-publish and monotonic cursor dedupe survive reload without new generation/tool/charge replay. Publish numeric/financial facts from code templates; validate narrative clauses before streaming. Regex alone cannot establish financial correctness. Unsupported output gives the explicit UI read/verification failure path.

Budget follows P9: account-period lock and a worst-case reservation before every request/continuation; captured category-aware pricing; actual usage settles once. Missing price/cap/profile or possibly dispatched unknown usage closes paid admission. No automatic timeout release. Remaining is an estimate; provider credits and app cap are separate facts. No new amount, latency limit or fixed relative-price multiplier is chosen here.

## 5. Evaluation Strategy

| Dimension            | Observable result                                                                    | Proof owner                           | Priority |
| -------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- | -------- |
| Identity/tool safety | Wrong/ambiguous/stale target produces zero write and an exact clarification/error    | E02–E05/E14; public chat + marks/move | Critical |
| Replay and Undo      | One effect/result; later edits remain; reload does not replay                        | E03/E04/E07/E09                       | Critical |
| Numeric grounding    | Financial/count output equals shared code facts; rejected model totals never publish | E08/E14 + Today/Students              | Critical |
| Calendar truth       | Pending/unknown/partial has no Saved/Undone; same journal recovers                   | E06/E07 + real Calendar path          | Critical |
| Spending             | Two tabs/continuations cannot exceed admission; unknown usage holds reservation      | E10–E12                               | Critical |
| Stream/UI            | One persisted conversation/event sequence, correct focus/IME/themes/narrow controls  | E01/E09/E13                           | High     |

Primary tooling is the existing Playwright/public API/real persistence harness. `e2e/chat.spec.ts` does not exist at the current source pin; a necessary new durable chat journey belongs to the same harness and is written before behavior. Shared effects extend existing marks/move/today/calendar journeys. No isolated suite, new environment, external eval service, LLM judge, mutation/coverage target or speculative dataset is introduced.

Controlled synthetic untrusted model proposals may prove application semantics only under authenticated synthetic target authority. They do not prove actual SDK/model quality, pricing or account access. The real Messages/Managed spike's three checks—write, pause/confirm, reload/resume—plus usage/storage evidence remain NOT RUN. No paid run or arbitrary dataset size is authorized by this artifact. Provider-quality evaluation is separate explicitly scoped work.

Every run needs version/diff fingerprint, scenario/fixture reference, expected/observed, original status, runtime/persistence attestation and rerun command. The implementation planner binds exact title filters and the existing target lease; discovery is not a functional pass.

## 6. Guardrails

| Trigger                                                                        | Required application outcome                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Unvalidated call, out-of-phase payment/bulk tool, untrusted stored instruction | No dispatch; matching refusal/result                                |
| Ambiguous target or changed mention                                            | Clarify actual eligible target; zero guessed write                  |
| Missing/stale facts or invalid narrative/financial clause                      | Honest read/verification failure; no false number                   |
| Pending original/inverse Calendar outcome                                      | Check the same journal; no success or blind replay                  |
| Budget/profile/usage uncertainty                                               | No new paid request; retain liabilities and draft                   |
| Delete with unresolved run/mutation/usage                                      | Refuse content deletion until outcome is known; no business cascade |

No new periodic evaluation or alert thresholds are introduced. Actual regressions are investigated against these owner results and existing public journeys. Teacher review of suggestions does not authorize a new paid evaluation program.

## 7. Production Monitoring

Use existing request-id/pino ownership and safe run/attempt/result identities. Record only necessary status, usage categories, model/effort/profile attribution and timing metadata; no prompts, student records, essays, provider errors or secrets in logs. Observe duplicate effects, unresolved usage, admission refusals and publication errors as concrete events. No invented SLA, sampling quota, cron, external tracing service or new notification channel.

## Checklist

- [x] System and critical failure modes classified.
- [x] Framework/alternatives/domain criteria grounded in current research.
- [x] TypeScript/Zod validation and durable owner boundaries specified.
- [x] Minimum public evidence and guardrail owners mapped.
- [ ] Exact dependency installed and final24/25 signatures rebound.
- [ ] Actual provider/model/account/cap and three-check spike observed.
- [ ] Public application/runtime acceptance executed.

The completed design checklist is not a readiness or provider PASS. Independent PLAN22 verification remains required.
