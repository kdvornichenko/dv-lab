# Phase 23: Confirmed Chat Changes and Entry Points — Pattern Map

**Дата:** 2026-10-12. **Root:** `~/.claude/worktrees/phase-24-google-calendar-preparation/dv-lab`.

**HEAD:** `81a11752853260327ba385475547a912b152842b`. **Source pin:** `913fc5ae9286aca9a48b5ce4272699c846849874`; HEAD добавил только docs25.

**Inventory:** 67 targets: New18, Modified26, Conditional21, Generated2. **Analogs:** 45/67 (exact39, role-match6, none22).

**UI:** variant A/v40; final23 SHA-256 `28ca26a976ac47d3bf168d80e0472e458031f3fca1f316993c8ad2ba3b7bf03b`; 9 surfaces/69 native considerations.

Все будущие изменения/signatures — **PROPOSED**. Read snapshot не доказывает runtime/Phase22/24/25 acceptance.

## Scope Card

Результат: R23F09 inventory → TRACKED аналоги/none и producer→consumer карта для SC1–5/F01–10/P1–7/D1–8/ARCH-A1–A3. C1: все necessary targets классифицированы. C2: критерии связаны с owner/pattern/delta/public proof. C3: tracking/fingerprints/verbatim excerpts/69 UI predicates воспроизводимы. Единственная запись — этот23-PATTERNS.md.

В scope: settled CONTEXT/RESEARCH/checked UI/accepted ARCH, exact payment/card/Calendar/form/entry callers. Вне scope: implementation, прочие docs/shared metadata/main/source/env/runtime/provider/DB/browser/dependencies/Git mutations/agents/deletion/external messages, новый research/benchmark/full audit. Workflow: explicit native GSD mapper через work-router без побочных действий; AgentFlow SUSPENDED. Wayfinder не нужен: settled spec/task уже заданы.

Work map: R23F09→C1; пять основных аналогов и necessary callers→C1/C2; criterion matrices + hashes/tracking/excerpts/format→C2/C3. Stop: карта для planner23, без implementation.

Допущения:

1. R23F09 остаётся предложением; source22/25 отсутствует. Основание: CONTEXT/RESEARCH,22-PATTERNS/AI/ARCH и проверки путей. Rebind может заменить proposed имя.
2. Final22/24/25 может предоставить revision/explicit-zone/batch/publication seam. Основание: accepted ARCH23. До source23 write Parent связывает actual exports/Registry/schema/fingerprints/target identities.
3. Actual key/model/cap/credits/live payment DELETE grants/spike/phone runtime не наблюдались. Основание: RESEARCH/UI-CHECK. UNVERIFIED не означает verified absence.

Source10 Root02 и planner22 не получают сообщений/изменений от mapper; main read-only, shared metadata/ARCH23 принадлежат Parent. Нет второго chat engine/ledger/SDK/queue/environment/cut algorithm.

## File Classification

New — absent owner23. Modified — текущий TRACKED target. Conditional — после final rebind или при доказанной необходимости; не безусловная запись. Generated — существующий db:generate output. Exact — та же роль/data flow или расширение самого owner, не наличие нового behavior. Отсутствующие22 dependencies всегда none+PROPOSED, не tracked analog. Final25 resolver/mapping и final24 batch/series owner имеют module binding gate; не guessed source filename.

| ID  | Target                                                                   | Status      | Role      | Data Flow        | Closest TRACKED Analog                                                   | Match      | Criteria                                        | Dependency                   |
| --- | ------------------------------------------------------------------------ | ----------- | --------- | ---------------- | ------------------------------------------------------------------------ | ---------- | ----------------------------------------------- | ---------------------------- |
| I01 | `packages/contracts/src/chat-proposals.ts`                               | New         | model     | request-response | `packages/contracts/src/students.ts`                                     | role-match | SC1/F01/F08/P1/D1                               | —                            |
| I02 | `packages/contracts/src/chat.ts`                                         | Conditional | model     | request-response | —                                                                        | none       | SC1/SC3/F01/F05/P1/P5/D1/D3                     | PROPOSED final22, NOT SOURCE |
| I03 | `packages/contracts/src/chat-events.ts`                                  | Conditional | model     | streaming        | —                                                                        | none       | SC1/SC3/F01/F05/P1/P5/D1/D3                     | PROPOSED final22, NOT SOURCE |
| I04 | `packages/contracts/src/index.ts`                                        | Modified    | model     | transform        | `packages/contracts/src/index.ts`                                        | exact      | F09/SC1/SC4                                     | —                            |
| I05 | `packages/contracts/src/students.ts`                                     | Modified    | model     | request-response | `packages/contracts/src/students.ts`                                     | exact      | SC1/SC3/F02/F03/F05/P2/P3/D2/D3/ARCH-A1/ARCH-A2 | —                            |
| I06 | `packages/contracts/src/calendar.ts`                                     | Modified    | model     | request-response | `packages/contracts/src/calendar.ts`                                     | exact      | SC2/SC3/F04/F05/P4/P5/D4/ARCH-A3                | —                            |
| I07 | `packages/contracts/src/schedule.ts`                                     | Modified    | model     | request-response | `packages/contracts/src/schedule.ts`                                     | exact      | SC2/SC3/F04/F05/P4/P5/D4/ARCH-A3                | —                            |
| I08 | `packages/contracts/src/chat-essay.ts`                                   | New         | model     | streaming        | `packages/contracts/src/students.ts`                                     | role-match | SC4/F06/F08/P6/D5                               | —                            |
| I09 | `packages/db/src/chat-schema.ts`                                         | Conditional | model     | CRUD             | —                                                                        | none       | SC1/SC2/SC3/F01/F04/F09/P1/P5                   | PROPOSED final22, NOT SOURCE |
| I10 | `packages/db/src/schema.ts`                                              | Modified    | model     | CRUD             | `packages/db/src/schema.ts`                                              | exact      | SC1/SC3/F02/F03/F05/F09/ARCH-A1/ARCH-A2         | —                            |
| I11 | `packages/db/src/index.ts`                                               | Modified    | model     | transform        | `packages/db/src/index.ts`                                               | exact      | SC1/SC3/F02/F03/F05/F09/ARCH-A1/ARCH-A2         | —                            |
| I12 | `packages/db/drizzle/<generated>/migration.sql`                          | Generated   | migration | batch            | —                                                                        | none       | SC1/SC2/SC3/F09                                 | —                            |
| I13 | `packages/db/drizzle/<generated>/snapshot.json`                          | Generated   | config    | transform        | —                                                                        | none       | SC1/SC2/SC3/F09                                 | —                            |
| I14 | `apps/api/src/chat/proposals.ts`                                         | New         | service   | request-response | `apps/api/src/calendar/journal.ts`                                       | role-match | SC1/F01/F08/P1/D1                               | —                            |
| I15 | `apps/api/src/chat/decisions.ts`                                         | New         | service   | CRUD             | `apps/api/src/calendar/journal.ts`                                       | role-match | SC1/SC3/F01/F05/F08/P1/D1/ARCH-A1/ARCH-A2       | —                            |
| I16 | `apps/api/src/chat/proposal-store.ts`                                    | New         | store     | CRUD             | `apps/api/src/calendar/journal.ts`                                       | exact      | SC1/F01/P1/D1                                   | —                            |
| I17 | `apps/api/src/chat/money-intents.ts`                                     | New         | service   | transform        | —                                                                        | none       | SC1/SC3/F02/F05/F08/P2/D2/D3                    | —                            |
| I18 | `apps/api/src/chat/card-intents.ts`                                      | New         | service   | request-response | —                                                                        | none       | SC1/F03/F08/P3/D2                               | —                            |
| I19 | `apps/api/src/chat/bulk-plan.ts`                                         | New         | service   | transform        | —                                                                        | none       | SC2/F04/P4/D4/ARCH-A3                           | —                            |
| I20 | `apps/api/src/chat/bulk-commands.ts`                                     | New         | service   | event-driven     | —                                                                        | none       | SC2/SC3/F04/F05/P5/D4/ARCH-A3                   | —                            |
| I21 | `apps/api/src/chat/essay.ts`                                             | New         | service   | streaming        | —                                                                        | none       | SC4/F06/F08/P6/D5                               | —                            |
| I22 | `apps/api/src/chat/tools.ts`                                             | Conditional | service   | request-response | —                                                                        | none       | SC1/SC4/F01/F06/F08/P1/P6/D1/D5                 | PROPOSED final22, NOT SOURCE |
| I23 | `apps/api/src/chat/runs.ts`                                              | Conditional | service   | event-driven     | —                                                                        | none       | SC1/SC4/F01/F06/F08/P1/P6/D1/D5                 | PROPOSED final22, NOT SOURCE |
| I24 | `apps/api/src/routes/chat.ts`                                            | Conditional | route     | request-response | —                                                                        | none       | SC1/SC2/SC4/F01/F04/F06/F08                     | PROPOSED final22, NOT SOURCE |
| I25 | `apps/api/src/app.ts`                                                    | Conditional | config    | request-response | `apps/api/src/app.ts`                                                    | exact      | SC1/SC2/SC4/F09                                 | —                            |
| I26 | `apps/api/src/server.ts`                                                 | Conditional | config    | event-driven     | `apps/api/src/server.ts`                                                 | exact      | SC1/SC2/SC4/F09                                 | —                            |
| I27 | `apps/api/src/cards/payments.ts`                                         | Modified    | service   | CRUD             | `apps/api/src/cards/payments.ts`                                         | exact      | SC1/SC3/F02/F03/F05/P2/P3/D2/D3/ARCH-A1         | —                            |
| I28 | `apps/api/src/cards/payments-write.ts`                                   | Conditional | service   | CRUD             | `apps/api/src/cards/payments.ts`                                         | exact      | SC1/SC3/F02/F05/ARCH-A1                         | —                            |
| I29 | `apps/api/src/routes/payments.ts`                                        | Modified    | route     | request-response | `apps/api/src/routes/payments.ts`                                        | exact      | SC1/SC3/F02/F03/F05/ARCH-A1                     | —                            |
| I30 | `apps/api/src/cards/cards.ts`                                            | Modified    | service   | CRUD             | `apps/api/src/cards/cards.ts`                                            | exact      | SC1/SC3/F02/F03/F05/P2/P3/D2/D3/ARCH-A2         | —                            |
| I31 | `apps/api/src/cards/card-rows.ts`                                        | Modified    | utility   | transform        | `apps/api/src/cards/card-rows.ts`                                        | exact      | SC1/SC3/F02/F03/F05/P2/P3/D2/D3/ARCH-A2         | —                            |
| I32 | `apps/api/src/routes/students.ts`                                        | Modified    | route     | request-response | `apps/api/src/routes/students.ts`                                        | exact      | SC1/SC3/SC5/F03/F05/F07/ARCH-A2                 | —                            |
| I33 | `apps/api/src/cards/student-lessons.ts`                                  | New         | service   | request-response | `apps/api/src/schedule/schedule.ts`                                      | exact      | SC5/F07/P7/D7                                   | —                            |
| I34 | `apps/api/src/schedule/series.ts`                                        | Conditional | service   | CRUD             | `apps/api/src/schedule/series.ts`                                        | exact      | SC2/SC3/F04/F05/P4/P5/D4/ARCH-A3                | —                            |
| I35 | `apps/api/src/schedule/command-plan.ts`                                  | Conditional | service   | transform        | `apps/api/src/schedule/command-plan.ts`                                  | exact      | SC2/SC3/F04/F05/P4/P5/D4/ARCH-A3                | —                            |
| I36 | `apps/api/src/calendar/commands.ts`                                      | Conditional | service   | request-response | `apps/api/src/calendar/commands.ts`                                      | exact      | SC2/SC3/F04/F05/P5/D4/ARCH-A3                   | —                            |
| I37 | `apps/api/src/calendar/journal.ts`                                       | Conditional | service   | CRUD             | `apps/api/src/calendar/journal.ts`                                       | exact      | SC2/SC3/F04/F05/P5/D4/ARCH-A3                   | —                            |
| I38 | `apps/api/src/chat/command-zone.ts`                                      | Conditional | utility   | transform        | —                                                                        | none       | SC2/F04/P4/D4/ARCH-A3                           | —                            |
| I39 | `apps/web/app/(app)/chat/_components/proposal-card.tsx`                  | New         | component | request-response | `apps/web/components/app/confirm-dialog.tsx`                             | role-match | SC1/SC2/F01/F04/P1/P5/D1/D4                     | —                            |
| I40 | `apps/web/app/(app)/chat/_components/proposal-decision.tsx`              | New         | component | event-driven     | `apps/web/components/app/confirm-dialog.tsx`                             | exact      | SC1/F01/F08/P1/D1                               | —                            |
| I41 | `apps/web/app/(app)/chat/_components/essay-feedback.tsx`                 | New         | component | streaming        | —                                                                        | none       | SC4/F06/P6/D5                                   | —                            |
| I42 | `apps/web/app/(app)/chat/_components/messages.tsx`                       | Conditional | component | streaming        | —                                                                        | none       | SC1/SC2/SC4/SC5/F01/F06/F07/D1/D5/D8            | PROPOSED final22, NOT SOURCE |
| I43 | `apps/web/app/(app)/chat/_components/use-chat.ts`                        | Conditional | hook      | streaming        | —                                                                        | none       | SC1/SC2/SC4/SC5/F01/F06/F07/D1/D5/D8            | PROPOSED final22, NOT SOURCE |
| I44 | `apps/web/app/(app)/_components/app-shell.tsx`                           | Modified    | component | event-driven     | `apps/web/app/(app)/_components/app-shell.tsx`                           | exact      | SC5/F07/P7/D6/D8                                | —                            |
| I45 | `apps/web/app/(app)/_components/command-palette.tsx`                     | Modified    | component | event-driven     | `apps/web/app/(app)/_components/command-palette.tsx`                     | exact      | SC5/F07/P7/D6/D8                                | —                            |
| I46 | `apps/web/app/(app)/_components/entry-points.tsx`                        | New         | provider  | event-driven     | `apps/web/app/(app)/_components/app-shell.tsx`                           | role-match | SC5/F07/P7/D6/D7/D8                             | —                            |
| I47 | `apps/web/app/(app)/_components/use-entry-point.ts`                      | New         | hook      | request-response | —                                                                        | none       | SC5/F07/P7/D6/D7                                | —                            |
| I48 | `apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx` | Modified    | component | event-driven     | `apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx` | exact      | SC3/SC5/F02/F05/F07/D3/ARCH-A1                  | —                            |
| I49 | `apps/web/app/(app)/students/[id]/_components/payments-tab.tsx`          | Modified    | component | event-driven     | `apps/web/app/(app)/students/[id]/_components/payments-tab.tsx`          | exact      | SC3/F03/F05/D2/D3/ARCH-A1                       | —                            |
| I50 | `apps/web/app/(app)/students/_components/student-form-dialog.tsx`        | Modified    | component | event-driven     | `apps/web/app/(app)/students/_components/student-form-dialog.tsx`        | exact      | SC3/F02/F05/D3/ARCH-A2                          | —                            |
| I51 | `apps/web/app/(app)/students/[id]/_components/overview-tab.tsx`          | Modified    | component | event-driven     | `apps/web/app/(app)/students/[id]/_components/overview-tab.tsx`          | exact      | SC3/F05/D3/ARCH-A2                              | —                            |
| I52 | `apps/web/app/(app)/students/[id]/_components/student-profile.tsx`       | Modified    | component | event-driven     | `apps/web/app/(app)/students/[id]/_components/student-profile.tsx`       | exact      | SC3/SC5/F03/F05/F07/D7/ARCH-A2                  | —                            |
| I53 | `apps/web/app/(app)/schedule/_components/schedule-screen.tsx`            | Modified    | component | event-driven     | `apps/web/app/(app)/schedule/_components/schedule-screen.tsx`            | exact      | SC5/F07/D8                                      | —                            |
| I54 | `apps/web/app/(app)/schedule/_components/move-series-dialog.tsx`         | Modified    | component | event-driven     | `apps/web/app/(app)/schedule/_components/move-series-dialog.tsx`         | exact      | SC2/SC5/F04/F07/D4/ARCH-A3                      | —                            |
| I55 | `apps/web/app/(app)/schedule/_components/schedule-mutations.ts`          | Modified    | utility   | request-response | `apps/web/app/(app)/schedule/_components/schedule-mutations.ts`          | exact      | SC2/SC3/F04/F05/D4/ARCH-A3                      | —                            |
| I56 | `apps/web/app/(app)/students/[id]/_components/lessons-tab.tsx`           | New         | component | request-response | `apps/web/app/(app)/students/[id]/_components/payments-tab.tsx`          | exact      | SC5/F07/P7/D7                                   | —                            |
| I57 | `apps/web/app/(app)/schedule/_components/schedule-agenda.tsx`            | New         | component | request-response | —                                                                        | none       | SC5/F07/P7/D8                                   | —                            |
| I58 | `apps/web/app/(app)/_components/today-screen.tsx`                        | Conditional | component | request-response | `apps/web/app/(app)/_components/today-screen.tsx`                        | exact      | SC5/F07/D8                                      | —                            |
| I59 | `apps/web/app/(app)/chat/_components/chat-screen.tsx`                    | Conditional | component | streaming        | —                                                                        | none       | SC5/F07/D8                                      | PROPOSED final22, NOT SOURCE |
| I60 | `apps/web/app/(app)/students/_components/assign-payment-dialog.tsx`      | Modified    | component | request-response | `apps/web/app/(app)/students/_components/assign-payment-dialog.tsx`      | exact      | SC3/F02/F05/ARCH-A1                             | —                            |
| I61 | `apps/web/app/(app)/students/[id]/_components/set-currency-dialog.tsx`   | Modified    | component | request-response | `apps/web/app/(app)/students/[id]/_components/set-currency-dialog.tsx`   | exact      | SC3/F02/F05/ARCH-A1                             | —                            |
| I62 | `apps/web/app/(app)/students/[id]/_components/opening-balance-panel.tsx` | Modified    | component | request-response | `apps/web/app/(app)/students/[id]/_components/opening-balance-panel.tsx` | exact      | SC3/F05/ARCH-A2                                 | —                            |
| I63 | `apps/web/app/(app)/students/_components/students-screen.tsx`            | Conditional | component | request-response | `apps/web/app/(app)/students/_components/students-screen.tsx`            | exact      | SC3/SC5/F05/F07/D7                              | —                            |
| I64 | `e2e/chat.spec.ts`                                                       | Conditional | test      | request-response | —                                                                        | none       | SC1–5/F10/E01–11                                | PROPOSED final22, NOT SOURCE |
| I65 | `e2e/support/chat.ts`                                                    | Conditional | test      | request-response | —                                                                        | none       | SC1–5/F10/E01–11                                | PROPOSED final22, NOT SOURCE |
| I66 | `e2e/today.spec.ts`                                                      | Modified    | test      | request-response | `e2e/today.spec.ts`                                                      | exact      | SC3/SC5/F05/F07/F10/E04/E07/E09                 | —                            |
| I67 | `e2e/move.spec.ts`                                                       | Modified    | test      | request-response | `e2e/move.spec.ts`                                                       | exact      | SC2/F04/F10/E05/E06                             | —                            |

## Pattern Assignments

Каждый target имеет existing symbol или явный PROPOSED producer и concrete pattern ниже. Таблица именует semantic deltas, не повторяет Registry wire definitions в AGENTS/protocol instructions.

| ID / target                                                                  | Current symbol / PROPOSED producer                                                       | Delta                                                                                                   | Concrete pattern          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------- |
| I01 `packages/contracts/src/chat-proposals.ts`                               | `PROPOSED ChatProposal/ProposalTarget/ProposalDecision/ProposalReceipt`                  | Единственный Registry: strict propose/decision/read; exact identity/digest/versions                     | [registry](#registry)     |
| I02 `packages/contracts/src/chat.ts`                                         | `PROPOSED final22 Registry extension`                                                    | Отсутствующий owner22: rebind до расширения proposal/result/invalidation                                | [dependency](#dependency) |
| I03 `packages/contracts/src/chat-events.ts`                                  | `PROPOSED final22 Registry extension`                                                    | Отсутствующий owner22: rebind до расширения proposal/result/invalidation                                | [dependency](#dependency) |
| I04 `packages/contracts/src/index.ts`                                        | `export *`                                                                               | Экспортировать schemas из одного Registry                                                               | [registry](#registry)     |
| I05 `packages/contracts/src/students.ts`                                     | `saveStudentRequest/recordPaymentRequest/PaymentRow/StudentDetail`                       | Numeric revisions, UpdatePayment/Rate и all ordinary write preconditions                                | [registry](#registry)     |
| I06 `packages/contracts/src/calendar.ts`                                     | `ValidatedCalendarCommand/moveSeriesRequest`                                             | Explicit inputTimeZone отдельно от expectedDefaultTimeZone; sealed targets/result                       | [zone](#zone)             |
| I07 `packages/contracts/src/schedule.ts`                                     | `ValidatedCalendarCommand/moveSeriesRequest`                                             | Explicit inputTimeZone отдельно от expectedDefaultTimeZone; sealed targets/result                       | [zone](#zone)             |
| I08 `packages/contracts/src/chat-essay.ts`                                   | `PROPOSED EssayFeedback`                                                                 | Finite input/output + qualitative/incomplete/task-unassessed; fixed estimate label                      | [essay](#essay)           |
| I09 `packages/db/src/chat-schema.ts`                                         | `PROPOSED final22 schema additions`                                                      | Reuse final22 proposals/targets/child association; пока source отсутствует                              | [dependency](#dependency) |
| I10 `packages/db/src/schema.ts`                                              | `students/payments; schema exports`                                                      | Additive revisions/exports; переиспользовать final22 revision при наличии                               | [schema](#schema)         |
| I11 `packages/db/src/index.ts`                                               | `students/payments; schema exports`                                                      | Additive revisions/exports; переиспользовать final22 revision при наличии                               | [schema](#schema)         |
| I12 `packages/db/drizzle/<generated>/migration.sql`                          | `PROPOSED generated output`                                                              | Только db:generate после final22/24/25 schema rebind, sequence не угадан                                | [schema](#schema)         |
| I13 `packages/db/drizzle/<generated>/snapshot.json`                          | `PROPOSED generated output`                                                              | Только db:generate после final22/24/25 schema rebind, sequence не угадан                                | [schema](#schema)         |
| I14 `apps/api/src/chat/proposals.ts`                                         | `PROPOSED prepareProposal(context,intent)`                                               | Persist metadata/frozen safe preview; без business write/paid Confirm                                   | [proposal](#proposal)     |
| I15 `apps/api/src/chat/decisions.ts`                                         | `PROPOSED confirmProposal(context,id,revision,digest,decisionRequestId)/declineProposal` | One locked decision winner; local owner effect+receipt atomic                                           | [proposal](#proposal)     |
| I16 `apps/api/src/chat/proposal-store.ts`                                    | `PROPOSED readProposal/decision lookup`                                                  | Account scoped id+digest/revision; повтор возвращает receipt/status                                     | [proposal](#proposal)     |
| I17 `apps/api/src/chat/money-intents.ts`                                     | `PROPOSED source-span money resolver`                                                    | Проверить spans teacher text; pure core parse/format; no model money/FX                                 | [money](#money)           |
| I18 `apps/api/src/chat/card-intents.ts`                                      | `PROPOSED typed card/archive/delete resolver`                                            | Exact entity, reserved new ID; distinct archive/payment delete/retraction; no account cascade           | [cards](#cards)           |
| I19 `apps/api/src/chat/bulk-plan.ts`                                         | `PROPOSED prepareBulkMove(context,studentId,commandZone,selection)`                      | Complete sealed target membership/versions/exclusions before write                                      | [bulk](#bulk)             |
| I20 `apps/api/src/chat/bulk-commands.ts`                                     | `PROPOSED run/resumeBulkProposal(context,proposalId)`                                    | Serial final24 writer; child IDs/journal; verified prefix, changed remainder fresh decision             | [bulk](#bulk)             |
| I21 `apps/api/src/chat/essay.ts`                                             | `PROPOSED essay mode/result publication`                                                 | Final22 budget/provider/run; read-only registry; fixed label before publish/reload                      | [essay](#essay)           |
| I22 `apps/api/src/chat/tools.ts`                                             | `PROPOSED final22 tool/run extension`                                                    | Waiting decision returns matching tool result; essay read-only; no second chat engine                   | [dependency](#dependency) |
| I23 `apps/api/src/chat/runs.ts`                                              | `PROPOSED final22 tool/run extension`                                                    | Waiting decision returns matching tool result; essay read-only; no second chat engine                   | [dependency](#dependency) |
| I24 `apps/api/src/routes/chat.ts`                                            | `PROPOSED final22 proposal decision/status/entry APIs`                                   | Rebind absent owner22; Confirm input не заменяет stored payload/actor                                   | [dependency](#dependency) |
| I25 `apps/api/src/app.ts`                                                    | `createApp/AppDeps; composition`                                                         | Только нужная wiring финального chat owner, key/env owner22 без дублирования                            | [shared](#shared)         |
| I26 `apps/api/src/server.ts`                                                 | `createApp/AppDeps; composition`                                                         | Только нужная wiring финального chat owner, key/env owner22 без дублирования                            | [shared](#shared)         |
| I27 `apps/api/src/cards/payments.ts`                                         | `recordPayment/deletePayment/assignPayment`                                              | Executor write+facade, same-ID update/provenance, payment/card CAS including assign/delete              | [payments](#payments)     |
| I28 `apps/api/src/cards/payments-write.ts`                                   | `PROPOSED semantic writer extraction`                                                    | Альтернатива внутри payments owner только если semantic size требует; scalar exports не причина split   | [payments](#payments)     |
| I29 `apps/api/src/routes/payments.ts`                                        | `paymentRoutes({db})`                                                                    | PATCH same ID; pass validated payment/card revisions, keep facade/date/role rules                       | [payments](#payments)     |
| I30 `apps/api/src/cards/cards.ts`                                            | `createCard/updateCard/archiveCard/restoreCard/setOpeningBalance`                        | Narrow setCardRate и одна revision policy all normal writers; publish current revision                  | [cards](#cards)           |
| I31 `apps/api/src/cards/card-rows.ts`                                        | `cardColumns/toCardRow/toStudentDetail`                                                  | Narrow setCardRate и одна revision policy all normal writers; publish current revision                  | [cards](#cards)           |
| I32 `apps/api/src/routes/students.ts`                                        | `studentRoutes; mutateStudent; full/status/opening endpoints`                            | Validated CAS/narrow rate/current lessons endpoint; accounts остаются отдельными                        | [cards](#cards)           |
| I33 `apps/api/src/cards/student-lessons.ts`                                  | `PROPOSED readStudentLessons(executor,context,studentId,window)`                         | Account-week/range current history+confirmed mapping/coverage; no new chronology/math                   | [profile](#profile)       |
| I34 `apps/api/src/schedule/series.ts`                                        | `moveSeries/prepareScheduleCommand`                                                      | After final24 rebind use existing explicit-zone/family cut; retain account guard/history                | [zone](#zone)             |
| I35 `apps/api/src/schedule/command-plan.ts`                                  | `moveSeries/prepareScheduleCommand`                                                      | After final24 rebind use existing explicit-zone/family cut; retain account guard/history                | [zone](#zone)             |
| I36 `apps/api/src/calendar/commands.ts`                                      | `submit/read/resumeCalendarCommand; findRequest/matchingReceipt`                         | Existing serial writer/journal child association; final batch owner rebind, no direct gateway           | [bulk](#bulk)             |
| I37 `apps/api/src/calendar/journal.ts`                                       | `submit/read/resumeCalendarCommand; findRequest/matchingReceipt`                         | Existing serial writer/journal child association; final batch owner rebind, no direct gateway           | [bulk](#bulk)             |
| I38 `apps/api/src/chat/command-zone.ts`                                      | `PROPOSED resolveCommandZone`                                                            | Только если final24 не даёт shared explicit-zone seam; IANA/MSK/Vietnam input policy                    | [zone](#zone)             |
| I39 `apps/web/app/(app)/chat/_components/proposal-card.tsx`                  | `PROPOSED ProposalCard props`                                                            | Approved ChangeCard adaptation, safe frozen preview/receipt; no countdown/mockGit                       | [ui](#ui)                 |
| I40 `apps/web/app/(app)/chat/_components/proposal-decision.tsx`              | `PROPOSED decision props`                                                                | Exact id/revision/digest/decisionRequestId; pending both buttons; stale no automatic new Confirm        | [ui](#ui)                 |
| I41 `apps/web/app/(app)/chat/_components/essay-feedback.tsx`                 | `PROPOSED EssayFeedback props`                                                           | Checked qualitative feedback/approximate label, no mock bands/Overall/official IELTS                    | [essay](#essay)           |
| I42 `apps/web/app/(app)/chat/_components/messages.tsx`                       | `PROPOSED final22 renderer/controller extension`                                         | Rebind source22; replay retains waiting/result/label; owned stream/Registry only                        | [dependency](#dependency) |
| I43 `apps/web/app/(app)/chat/_components/use-chat.ts`                        | `PROPOSED final22 renderer/controller extension`                                         | Rebind source22; replay retains waiting/result/label; owned stream/Registry only                        | [dependency](#dependency) |
| I44 `apps/web/app/(app)/_components/app-shell.tsx`                           | `AppShell({account,children})`                                                           | One palette/overlay owner; async exact-ID Actions→Students→Screens; no navigation Send                  | [palette](#palette)       |
| I45 `apps/web/app/(app)/_components/command-palette.tsx`                     | `CommandPalette({open,onOpenChange,initialQuery})`                                       | One palette/overlay owner; async exact-ID Actions→Students→Screens; no navigation Send                  | [palette](#palette)       |
| I46 `apps/web/app/(app)/_components/entry-points.tsx`                        | `PROPOSED shared entry controller/dialog host`                                           | Close palette → same global payment form/fresh context; stable opener focus                             | [palette](#palette)       |
| I47 `apps/web/app/(app)/_components/use-entry-point.ts`                      | `PROPOSED create/openChatDraft(studentId?)`                                              | Final22 metadata/draft idempotent identity; exact mention, no paid navigation/private URL               | [palette](#palette)       |
| I48 `apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx` | `RecordPaymentDialog + suggestLessonsText`                                               | Create/edit mode, same-ID immutable student/provenance, payment/card revisions; preserve draft on CAS   | [payments](#payments)     |
| I49 `apps/web/app/(app)/students/[id]/_components/payments-tab.tsx`          | `PaymentsTab; remove(payment)`                                                           | Read revision, Edit payment, versioned delete/currency correction; current safe receipt routes          | [payments](#payments)     |
| I50 `apps/web/app/(app)/students/_components/student-form-dialog.tsx`        | `StudentFormDialog({mode,student,onClose,onSaved})`                                      | Full ordinary form CAS; deliberate reload current values, no stale field overwrite                      | [cards](#cards)           |
| I51 `apps/web/app/(app)/students/[id]/_components/overview-tab.tsx`          | `OverviewTab`                                                                            | CAS/rate form entry and current revision passed to opening balance                                      | [cards](#cards)           |
| I52 `apps/web/app/(app)/students/[id]/_components/student-profile.tsx`       | `StudentProfile({id}); changeStatus`                                                     | Lessons/Ask/payment receipt and invalidation; archive/restore CAS; retain tab/range/drafts              | [profile](#profile)       |
| I53 `apps/web/app/(app)/schedule/_components/schedule-screen.tsx`            | `ScheduleScreen`                                                                         | Below-lg agenda uses current model; WeekGrid desktop retained                                           | [phone](#phone)           |
| I54 `apps/web/app/(app)/schedule/_components/move-series-dialog.tsx`         | `MoveSeriesDialog`                                                                       | Explicit preview input/display/creation zones, same current command port                                | [zone](#zone)             |
| I55 `apps/web/app/(app)/schedule/_components/schedule-mutations.ts`          | `useScheduleMutation; move series body`                                                  | Validated input zone adapter; expectedDefaultTimeZone remains actual account guard                      | [zone](#zone)             |
| I56 `apps/web/app/(app)/students/[id]/_components/lessons-tab.tsx`           | `PROPOSED LessonsTab`                                                                    | Same bounded window/range Upcoming/History; loading/error/partial distinct; eligible dialog             | [profile](#profile)       |
| I57 `apps/web/app/(app)/schedule/_components/schedule-agenda.tsx`            | `PROPOSED ScheduleAgenda`                                                                | No current agenda analog; checked v40 composition + actual events/TimePair/read-only status             | [phone](#phone)           |
| I58 `apps/web/app/(app)/_components/today-screen.tsx`                        | `TodayScreen`                                                                            | Only necessary phone scenario failure/integration; preserve existing counters/panels                    | [phone](#phone)           |
| I59 `apps/web/app/(app)/chat/_components/chat-screen.tsx`                    | `PROPOSED final22 phone/layout owner`                                                    | Only if phone proof needs change after final22 rebind; no parallel layout                               | [dependency](#dependency) |
| I60 `apps/web/app/(app)/students/_components/assign-payment-dialog.tsx`      | `AssignPaymentDialog`                                                                    | Pass payment/card revisions to existing assign owner                                                    | [payments](#payments)     |
| I61 `apps/web/app/(app)/students/[id]/_components/set-currency-dialog.tsx`   | `SetCurrencyDialog`                                                                      | Same existing assign endpoint receives payment/card CAS; distinct correction                            | [payments](#payments)     |
| I62 `apps/web/app/(app)/students/[id]/_components/opening-balance-panel.tsx` | `OpeningBalancePanel`                                                                    | All ordinary card writers: capture/pass card revision, preserve zone/date check                         | [cards](#cards)           |
| I63 `apps/web/app/(app)/students/_components/students-screen.tsx`            | `StudentsScreen`                                                                         | Existing list must reread confirmed changes via final22 invalidation; no standalone status writer found | [profile](#profile)       |
| I64 `e2e/chat.spec.ts`                                                       | `PROPOSED final22 durable journey/support extension`                                     | Сейчас отсутствует; extend only after source22 rebind before23 behavior; no new isolated suite          | [dependency](#dependency) |
| I65 `e2e/support/chat.ts`                                                    | `PROPOSED final22 durable journey/support extension`                                     | Сейчас отсутствует; extend only after source22 rebind before23 behavior; no new isolated suite          | [dependency](#dependency) |
| I66 `e2e/today.spec.ts`                                                      | `Existing public Playwright journeys`                                                    | Extend failure-first scoped durable journey through real app/persistence; no fakeGoogleACK/410          | [e2e](#e2e)               |
| I67 `e2e/move.spec.ts`                                                       | `Existing public Playwright journeys`                                                    | Extend failure-first scoped durable journey through real app/persistence; no fakeGoogleACK/410          | [e2e](#e2e)               |

### registry

Единственный wire owner — packages/contracts. Current Zod/type exports дают integer money, nullable paired rate/currency и domain limits. Новые strict proposal/decision/receipt/essay/zone schemas определяются здесь один раз. SDK/tool/public event validators импортируют Registry.
**packages/contracts/src/students.ts:80–98**

```ts
const lessonsHundredths = z.number().int().min(0).max(LESSONS_HUNDREDTHS_MAX)

const amountMinor = z.number().int().min(1).max(AMOUNT_MINOR_MAX)

const currency = z.enum(CURRENCIES)

export const saveStudentRequest = z
	.object({
		displayName: z.string().transform(normalizeDisplayName).refine(isDisplayNameLength),
		rateMinor: amountMinor.nullable(),
		currency: currency.nullable(),
		defaultLessonMinutes: z.number().int().min(LESSON_MINUTES_MIN).max(LESSON_MINUTES_MAX),
		parent: optionalText(STUDENT_TEXT_MAX_LENGTH),
		level: optionalText(STUDENT_TEXT_MAX_LENGTH),
		goals: optionalText(STUDENT_TEXT_MAX_LENGTH),
		timeZone: optionalText(TIME_ZONE_MAX_LENGTH).refine((value) => value === null || isTimeZone(value)),
		noShowDeducts: z.boolean().optional(),
	})
	.refine((value) => (value.rateMinor === null) === (value.currency === null))
```

**packages/contracts/src/students.ts:122–136**

```ts
export const recordPaymentRequest = z.object({
	studentId: z.uuid(),
	paidOn: isoDate,
	expectedDefaultTimeZone: z.string().refine(isTimeZone),
	amountMinor,
	currency,
	lessonsHundredths: lessonsHundredths.nullable(),
	note: optionalText(PAYMENT_NOTE_MAX_LENGTH),
})

export const assignPaymentRequest = z.object({
	studentId: z.uuid(),
	currency: currency.nullable(),
	lessonsHundredths: lessonsHundredths.nullable(),
})
```

Current StudentDetail/PaymentRow не имеют revision (146–176/196–207). Current z.object не доказывает strict confirm validation. UpdatePayment/Rate/preconditions должны иметь producer до callers. Не добавлять numeric cap/score defaults/FX. index.ts existing barrel; absent chat/chat-events —22 dependency.

### schema

Current students/payments: packages/db/src/schema.ts:94–135/178–213. Numeric revisions отсутствуют. Переносить semantic FK/check/import identity, не новый money ledger.
**packages/db/src/schema.ts:178–190**

```ts
export const payments = pgTable(
	'payments',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		studentId: uuid('student_id').references(() => students.id, { onDelete: 'restrict' }),
		paidOn: date('paid_on').notNull(),
		amountMinor: integer('amount_minor').notNull(),
		currency: text('currency'),
		lessonsCount: numeric('lessons_count', { precision: 7, scale: 2 }),
		creditedMinutes: integer('credited_minutes').default(0).notNull(),
		note: text('note'),
		source: text('source').notNull(),
		importKey: text('import_key').unique('payments_import_key_uq'),
```

Proposal/targets/child association расширяют final22 chat-schema, сейчас absent. Additive migrations только db:generate после final schema rebind; sequence не угадан. Same-ID correction сохраняет source/import provenance/student binding. Final22 revision переиспользуется, не вторая колонка/table/epoch. payments-write.ts — conditional semantic extraction; scalar exports не основание split ради <500 или исключения executable code.

### proposal

Partial аналог calendar/journal даёт actor-scoped identity/digest/read result; это не готовый ChatProposal/decision lifecycle.
**apps/api/src/calendar/journal.ts:147–161**

```ts
export async function findRequest(executor: DbExecutor, accountId: string, requestId: string) {
	const [command] = await executor
		.select()
		.from(googleCommands)
		.where(and(eq(googleCommands.accountId, accountId), eq(googleCommands.requestId, requestId)))
	return command
}

export async function readCommand(executor: DbExecutor, accountId: string, commandId: string) {
	const [command] = await executor
		.select()
		.from(googleCommands)
		.where(and(eq(googleCommands.accountId, accountId), eq(googleCommands.id, commandId)))
	if (!command) throw new CommandFault('not_found', 404)
	return command
```

**apps/api/src/calendar/journal.ts:172–175**

```ts
export function matchingReceipt(command: CommandRow, input: ValidatedCalendarCommand) {
	if (command.inputHash !== commandHash(input)) throw new CommandFault('precondition_failed')
	return receipt(command)
}
```

P1 prepareProposal сохраняет exact actor/account/conversation/call, verified teacher spans, normalized payload/target/preconditions/preview/revision/digest; waiting только metadata. Confirm/Decline имеют один locked winner, deterministic row locking и полную проверку перед effect. Browser не заменяет stored payload/actor. Same decision identity/different digest отказывает; repeats читают receipt/status. Decline zero business writes; changed target/body/date/zone/policy → fresh unconfirmed preview.

Local domain effect+decision receipt+invalidation одна DbExecutor transaction; provider I/O вне неё. Reserved new card/payment identity не дублируется. Confirm не требует paid model call; outage/cap не меняет committed outcome. Final22 tool получает matching pending-proposal result/waiting boundary; replay/continuation ordering/usage остаются22. Quoted/model “yes” и untrusted text не authority.

### payments

**Основной аналог1:** cards/payments.ts. Current signatures:

- recordPayment(db:Database,accountId:string,input:RecordPaymentInput):Promise<RecordPaymentResult> —86–90.
- deletePayment(executor:DbExecutor,id:string):Promise<'deleted'|'not_found'> —119.
- assignPayment(db:Database,id:string,input:AssignPaymentInput):Promise<AssignPaymentResult> —133.
  Input types из Registry z.output (18/22). Current own transaction/card shared lock не CAS/atomic proposal receipt.
  **apps/api/src/cards/payments.ts:13–18**

```ts
import { creditedMinutes, decimalToHundredths, hundredthsToDecimal, isAfterScheduleToday } from '@dv-lab/core'
import { type Database, type DbExecutor, payments, students } from '@dv-lab/db'

import { lockTeacherTimeContext } from '../settings/settings.ts'

type RecordPaymentInput = z.output<typeof recordPaymentRequest>
```

**apps/api/src/cards/payments.ts:91–100**

```ts
	return db.transaction(async (tx): Promise<RecordPaymentResult> => {
		const time = await lockTeacherTimeContext(tx, accountId, input.expectedDefaultTimeZone)
		if (!time.ok) return { kind: time.error }
		if (isAfterScheduleToday(input.paidOn, time.context.now, time.context.defaultTimeZone)) return { kind: 'invalid' }
		const [card] = await tx
			.select({ id: students.id, defaultLessonMinutes: students.defaultLessonMinutes })
			.from(students)
			.where(eq(students.id, input.studentId))
			.for('share')
		if (!card) return { kind: 'not_found' }
```

**apps/api/src/cards/payments.ts:103–115**

```ts
			.values({
				studentId: card.id,
				paidOn: input.paidOn,
				amountMinor: input.amountMinor,
				currency: input.currency,
				lessonsCount: input.lessonsHundredths === null ? null : hundredthsToDecimal(input.lessonsHundredths),
				creditedMinutes: creditedMinutes(input.lessonsHundredths, card.defaultLessonMinutes),
				note: input.note,
				source: 'manual',
			})
			.returning()
		if (!row) throw new Error('payment insert returned no row')
		return { kind: 'recorded', payment: toPaymentRow(row) }
```

ARCH-A1 producer: PROPOSED executor writePayment(tx,actor,input,expectedCardRevision), same-ID updatePayment(tx,actor,id,input,expectedRevision), ordinary transaction facade retained. Capture card revision/defaultLessonMinutes/rate/account zone до preview; commit same core conversion/preconditions. Amount/date/lessons/note correction сохраняет ID/source/import/student. Assign отдельная операция, не hidden edit. Edit/assign/delete все numeric payment/card CAS. Rate change не пересчитывает saved creditedMinutes. Payment date actual account day, не bulk Vietnam. Runtime DELETE grants не наблюдались; no privilege changes/mapper deletion.

**Основной аналог2:** RecordPaymentDialog current props extend ScheduleFormContext (41–47), optional student/currentMainTimeZone/onClose/onRecorded/onRefresh. Edit mode/revision отсутствуют.
**apps/web/app/(app)/students/[id]/\_components/record-payment-dialog.tsx:126–139**

```tsx
const amountMinor = parseMoney(amount, currency)
if (amountMinor === null) return amountRef.current?.focus()
const trimmedNote = note.trim()
setPending(true)
saving.current = true
const result = await apiRequest<PaymentResponse>('POST', '/payments', {
	studentId: student.id,
	paidOn,
	expectedDefaultTimeZone: context.mainTimeZone,
	amountMinor,
	currency: currency as Currency,
	lessonsHundredths: lessons.trim() === '' ? null : parseLessons(lessons),
	note: trimmedNote === '' ? null : trimmedNote,
})
```

Ordinary create/edit retains parser/suggestion/validation, immutable student in edit и captured payment/card revisions. Stale Save preserves draft/focus; deliberate Reload updates current form values. Lost response rereads same target/attempt receipt, не recreate или “matching values proves saved”.
**apps/api/src/routes/payments.ts:46–55**

```ts
routes.post('/', async (c) => {
	const input = await readJson(c, recordPaymentRequest)
	if (!input) return invalidRequest(c)
	const result = await recordPayment(db, c.get('session').account.id, input)
	if (result.kind === 'not_found') return notFound(c)
	if (result.kind === 'invalid') return invalidRequest(c)
	if (result.kind === 'default_time_zone_changed')
		return c.json(errorBody(result.kind, 'Default time zone changed elsewhere. Refresh the page and try again.'), 409)
	return c.json({ payment: result.payment } satisfies PaymentResponse, 201)
})
```

A1 callers: PaymentsTab:88–95 remove/read/edit; AssignPaymentDialog:89–95 assign; SetCurrencyDialog:70–75 same assign endpoint; contracts/routes/proposal decisions. Producer до consumers. Typed receipt normal routes reread exact current record, не snapshot/href модели.

### money

Полного teacher-span resolver аналога нет; pure core переиспользуется, arithmetic не копируется.
**packages/core/src/money.ts:8–17**

```ts
export function parseMoney(text: string, currency: string | null): number | null {
	const digits = currencyDigits(currency)
	const match = /^(\d+)(?:[.,](\d+))?$/.exec(text.replace(spaces, ''))
	if (!match) return null
	const whole = match[1]
	const fraction = match[2] ?? ''
	if (fraction.length > digits) return null
	const minor = Number(whole + fraction.padEnd(digits, '0'))
	if (!Number.isSafeInteger(minor) || minor <= 0) return null
	return minor
```

**packages/core/src/lessons.ts:34–46**

```ts
export function suggestLessons(
	amountMinor: number,
	currency: string | null,
	rate: { rateMinor: number; currency: string } | null
): number | null {
	if (rate === null || currency === null || rate.currency !== currency || rate.rateMinor <= 0) return null
	const hundredths = Math.round((amountMinor * 100) / rate.rateMinor)
	return hundredths > maxHundredths ? null : hundredths
}

export function creditedMinutes(hundredths: number | null, lessonMinutes: number): number {
	if (hundredths === null) return 0
	return roundHalfAway((hundredths * lessonMinutes) / 100)
```

P2 verifies spans against persisted teacher instruction/form strings; model не выбирает minor units/rate result/decimal substitution. parseMoney/parseLessons → normalized input → formatMoney/formatHundredths preview. Excess precision/overflow/ambiguous words/currency → refusal/clarification, no FX. Same-currency rate → code suggestion + teacher edit; mismatch/missing → explicit lessons/truthful no credit. Existing RUB/KZT/USD/EUR не сужаются DS mocks. Balance/count/fact selection через core/card-facts единожды.

### cards

**Основной аналог3:** cards/cards.ts. createCard уже external-executor friendly, отдельного create finding нет:
**apps/api/src/cards/cards.ts:56–66**

```ts
export async function createCard(
	executor: DbExecutor,
	input: SaveStudentInput,
	context: CardReadContext
): Promise<StudentDetail> {
	const [row] = await executor
		.insert(students)
		.values({ ...cardValues(input), noShowDeducts: input.noShowDeducts ?? true })
		.returning(cardColumns)
	if (!row) throw new Error('student card insert returned no row')
	return toDetail(executor, row, context)
```

**apps/api/src/cards/cards.ts:97–112**

```ts
export async function updateCard(
	executor: DbExecutor,
	id: string,
	input: SaveStudentInput,
	context: CardReadContext
): Promise<StudentDetail | null> {
	const [row] = await executor
		.update(students)
		.set({
			...cardValues(input),
			...(input.noShowDeducts === undefined ? {} : { noShowDeducts: input.noShowDeducts }),
			updatedAt: sql`now()`,
		})
		.where(eq(students.id, id))
		.returning(cardColumns)
	return row ? toDetail(executor, row, context) : null
```

updateCard(executor,id,input,context):Promise<StudentDetail|null> checks ID only/full cardValues. ARCH-A2 producer: PROPOSED setCardRate(tx,context,id,ratePatch,expectedRevision) узко rate/currency плюс одна numeric revision policy full update/archive/restore/opening. card-rows.ts:13–28 current projection без revision; publish actual revision before forms. Final22 columns reused.

setOpeningBalance(db,accountId,id,{lessonsHundredths,on,expectedDefaultTimeZone}):Promise<OpeningBalanceResult> (147–183) locks account/card, но no revision. archiveCard/restoreCard (115–138) preserve same ID/history/account. importCard:186–199 insert/onConflictDoNothing/read, не existing field writer; не добавлять update flow.
**apps/web/app/(app)/students/\_components/student-form-dialog.tsx:210–224**

```tsx
const result = await apiRequest<StudentResponse>(
	create ? 'POST' : 'PATCH',
	create ? '/students' : `/students/${student?.id}`,
	{
		displayName: name,
		rateMinor: parsed.rateMinor,
		currency: parsed.currency,
		defaultLessonMinutes: parsed.lessonMinutes,
		parent: nullable(values.parent),
		level: nullable(values.level),
		goals: nullable(values.goals),
		timeZone: values.timeZone === SAME_TIME_ZONE ? null : values.timeZone,
		noShowDeducts,
	}
)
```

Chain: schema/Registry+cards/card-rows → routes/students → StudentFormDialog/OverviewTab/OpeningBalancePanel/StudentProfile status → decisions/ordinary correction/E02/E04/E07. New card не создаёт login. Generic deletion resolves exact entity: payment delete; student archive; final22 own-entry retraction; final24 cancel/end retaining rows. Physical student/schedule/history delete unsupported; no implicit account deactivation/cascade. Safe Open record/current list recovery from approved P09. Existing ordinary account controls не новая chat operation.

### zone

**Основной аналог4:** schedule/series.ts + pure core cut. Current moveSeries(db:Database,accountId:string,id:string,input:MoveSeriesInput,now=new Date()):Promise<MoveSeriesResult> (59–65).
**apps/api/src/schedule/series.ts:66–75**

```ts
	return db.transaction(async (tx): Promise<MoveSeriesResult> => {
		const time = await lockTeacherTimeContext(tx, accountId, input.expectedDefaultTimeZone, now)
		if (!time.ok) return { kind: time.error }
		const rule = await lockSeries(tx, id)
		if (rule === null) return { kind: 'not_found' }
		const { naturalCutoff } = seriesCutBoundary(rule, input.from, time.context.defaultTimeZone, 'from')
		const exceptions = await seriesExceptionsFrom(tx, id, naturalCutoff)
		const marks = await seriesMarksFrom(tx, id, naturalCutoff)
		const result = cutSeries(rule, exceptions, input, time.context, marks)
		if (result.kind !== 'ok') return { kind: result.kind }
```

**packages/core/src/schedule-series.ts:113–123**

```ts
	const { weekday, startTime, from } = change
	const candidate = { weekday, startTime, timeZone: context.defaultTimeZone, startsOn: from, endsOn: null }
	const first = firstOnOrAfter(from, weekday)
	if (seriesStart(candidate, first) === null) return { kind: 'nonexistent_local_time' }
	const startsOn = nextSeriesDate(candidate, context.now)
	if (startsOn === null) return { kind: 'invalid' }
	const endsOn = end === null ? null : lastStartBefore({ ...candidate, startsOn }, end.instant)
	if (end !== null && endsOn === null) return { kind: 'ends_before_new_day', endsOn: end.endsOn }
	return {
		kind: 'ok',
		rule: { ...candidate, studentId: rule.studentId, durationMinutes: rule.durationMinutes, startsOn, endsOn },
```

ARCH-A3 separates command input zone, actual account display/default guard/version, old rule creation zone, captured now/cutoff/target provider versions. Omission=Asia/Ho_Chi_Minh независимо от account zone; accepted MSK=Europe/Moscow; exact IANA через existing contract validator. Web display map also labels Minsk MSK, не reverse parser/API list.

Existing cutSeries неизменен; explicit command-zone calculation context отделён от проверяемого expectedDefaultTimeZone. Не подменять guard/настройку учителя/creation policy. Normal form omission account policy; Chat omission Vietnam. Existing gaps refuse; fold selected instant/offset binds visibly to sealed preview under checked ambiguity contract. Final24 explicit-zone/family-cut seam переиспользовать; command-zone.ts conditional только если отсутствует. No second cut algorithm; marks/moved/cancelled exceptions/head/history/lineage принадлежат final24/25.

### bulk

Whole-plan seal/serial bulk orchestration без полного source аналога. Current writer gives immutable command identity; это не all-or-none provider transaction.
**apps/api/src/calendar/commands.ts:33–38**

```ts
	async function submitCalendarCommand(
		context: CalendarReadContext,
		input: ValidatedCalendarCommand
	): Promise<CalendarCommandReceipt> {
		const existing = await findRequest(deps.db, context.accountId, input.input.requestId)
		if (existing) return matchingReceipt(existing, input)
```

**apps/api/src/calendar/commands.ts:47–53**

```ts
const repeated = await findRequest(access.db, context.accountId, input.input.requestId)
if (repeated) return matchingReceipt(repeated, input)
if ((await unresolvedCommands(access.db, context.accountId)).length) throw new CommandFault('command_pending')
if (input.operation === 'move' || input.operation === 'cancel' || input.operation === 'restore')
	return await admitSingle(access, context, input)
if (input.operation !== 'create') throw new CommandFault('history_only')
```

**apps/api/src/calendar/commands.ts:130–139**

```ts
		async readCalendarCommand(context: CalendarReadContext, commandId: string): Promise<CalendarCommandSnapshot> {
			return commandSnapshot(await readCommand(deps.db, context.accountId, commandId))
		},
		async resumeCalendarCommand(context: CalendarReadContext, commandId: string): Promise<CalendarCommandReceipt> {
			const command = await readCommand(deps.db, context.accountId, commandId)
			if (!['partial_recovery', 'recovery_required'].includes(command.state))
				throw new CommandFault('precondition_failed')
			await deps.resume(context.accountId, commandId)
			return receipt(command)
		},
```

Current command-plan.ts:63–80 handles observed single/instance then create; prepareCreateCommand:103–105 weekly creation поддержана. RESEARCH older create-once restriction устарел; series DTO не runtime proof. Outside single move/cancel/restore current admission rejects non-create; final24 bulk/series dependency remains.

readSeriesContexts(transport:ReadTransport,snapshot:MappingSnapshot,now:Date):Promise<CalendarSeriesContext[]> (18–50) builds current master opaque version, не complete arbitrary bulk membership. Seal sorted exact full requested rules/singles/occurrences/versions/bounds/exclusions/before-after instants. Не ограничивать scope visible week. Cross-zone DST partial rule match требует clarification; open-ended rule preview rule count/sample/future occurrences, не finite invented total.

До первого provider write revalidate whole membership/connection/conflicts. Serial same connection writer, durable child ordinal/requestId/commandId до dispatch; unknown child reads original journal, no random replacement. Each next child requires resolved prior+fresh unchanged remaining semantics. Verified prefix retained; changed remainder new preview+explicit decision. Overall Saved только все matching Google ACK+committed projection. No clone, direct gateway/SQL loop, blind compensation/rollback/automatic reconfirm/fake ACK/410. Final25 resolver/association/projection NOT SOURCE; rebind final22/24/25 before execution.

### ui

Base UI/v40/English copy/no eyebrows/Radix/cmdk. Current ConfirmDialog is local pending/error pattern, не durable decision:
**apps/web/components/app/confirm-dialog.tsx:42–50**

```tsx
async function confirm() {
	if (pending) return
	setFailed(false)
	setPending(true)
	const done = await onConfirm()
	setPending(false)
	if (done) onClose()
	else setFailed(true)
}
```

Proposal card/decision uses validated current preview/result and exact Confirm/Decline, waiting/stale/partial safe reread. ChangeCard DS Git hash/countdown/auto-close не копируются. Escape top layer, не decision. Server-known typed receipt routes reread identity/eligibility; unsupported/gone gets safe current list/profile. No new money/rate/bulk Undo; ordinary current-CAS correction, separate22 quick Undo.

### palette

**Основной аналог5:** CommandPalette/AppShell existing Base UI Autocomplete/Dialog/shortcut/mobile Search owner.
**apps/web/app/(app)/\_components/command-palette.tsx:3–12**

```tsx
import { Autocomplete } from '@base-ui/react/autocomplete'

import { LogOut, Monitor, Moon, Search, Sun, type LucideIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

import { sections } from './sections'
import { useSignOut } from './use-sign-out'
```

**apps/web/app/(app)/\_components/command-palette.tsx:64–76**

```tsx
	function run(item: Item) {
		if (item.action.type === 'route') router.push(item.action.href)
		else if (item.action.type === 'theme') setTheme(item.action.theme)
		else void signOut()
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="lg" position="top" showCloseButton={false} className="overflow-hidden p-0" data-palette="">
				<DialogTitle className="sr-only">Search</DialogTitle>
				<DialogDescription className="sr-only">Go to a section, change the theme or sign out.</DialogDescription>
				<Autocomplete.Root open inline items={groups} defaultValue={initialQuery} autoHighlight="always" keepHighlight>
```

**apps/web/app/(app)/\_components/app-shell.tsx:48–59**

```tsx
useEffect(() => {
	function onKeyDown(event: KeyboardEvent) {
		if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return
		event.preventDefault()
		if (document.querySelector("[role='dialog']:not([data-palette])")) return
		setPalette((current) =>
			current.open ? { ...current, open: false } : { open: true, key: current.key + 1, initialQuery: '' }
		)
	}
	document.addEventListener('keydown', onKeyDown)
	return () => document.removeEventListener('keydown', onKeyDown)
}, [])
```

P7 extends one palette Actions→Students→Screens/@ students with existing Theme/Account handlers. exact ID, safe current roster22, async abort/obsolete discard, loading/error/complete-empty distinct, duplicates not first match, IME never activates/sends. entry-points/use-entry-point PROPOSED metadata/draft owner, no existing equivalent. New chat/Ask metadata/exact mention no model/Send; retry original creation identity. Close palette before shared global RecordPaymentDialog/fresh account context; one overlay/stable opener focus. No private essay/text/model URL. Existing registry/type binding at execution; no install/research/new palette now.

### profile

StudentProfile({id}:{id:string}) retains tab/payment counter/drafts and stale guard:
**apps/web/app/(app)/students/[id]/\_components/student-profile.tsx:141–147**

```tsx
const reload = useCallback(async () => {
	const requestId = ++requests.current
	const next = await readStudent(id)
	if (requestId !== requests.current) return false
	setState((previous) => (next.kind === 'ready' ? next : { ...next, data: previous.data }))
	return next.kind === 'ready'
}, [id])
```

Current tabs:270–275 Overview/Notes/Vocabulary/Payments; approved23 Overview/Lessons/Payments/Notes/Vocabulary. New readStudentLessons(executor,context,studentId,window) composes existing readWindow/final confirmed association/coverage for account week/range. No lifelong chronology/fabricated count/math. Eligible Calendar/historical dialog + TimePair, unknown/partial/error ≠No lessons; same ID/marks/history after cut. PaymentsTab read/refresh/error pattern → LessonsTab.

Final22 committed invalidation rereads Students/profile Payments/Lessons/Today/Schedule; retain range/tab/draft/focus. Existing payment counter:308–311. StudentsScreen conditional subscription only for list parity; no current standalone archive writer found. Profile status/opening/full form genuine A2 consumers.

### phone

ScheduleScreen current WeekGrid:165–225; schedule-agenda absent/no genuine analog. Approved ScheduleAgenda below lg uses actual events/provider busy/read-only/recovery/TimePair; no browser series expansion. Today panels/counters exist, changes conditional only for phone proof; final22 chat layout conditional, не parallel layout. E09 proves320/375px/keyboard/dvh/safe-area/5-line composer/reachable Send/decisions/footer/scroll/≥44px targets/themes/reduced motion. No desktop redesign/bottom nav/horizontal body overflow. Runtime NOT RUN.

### essay

Server essay mode/current feedback renderer отсутствуют; no genuine analog. final22 provider/model/effort/run/stream/budget/usage/content/limits reused, no new SDK/IELTS entity/price/cap/credit assumptions. Read-only registry separates essay from instruction: no proposal/approval/write. Fixed server “Approximate estimate — not an official IELTS score.” before first token/block and reload/history; model не removes it. Qualitative default, task criterion unassessed without prompt/type. No mock bands/Overall/official combined score; numeric option requires later validated schema/rules/scoped evidence. Refusal/truncated/malformed incomplete+label; Ask another question focus only, fresh explicit admitted Send. Synthetic application semantics ≠ actual SDK/provider quality; benchmark NOT RUN.

### dependency

Absent source22 conditional rows = none+PROPOSED, never tracked analog.22-PATTERNS/AI/ARCH design input: A1 owned SSE/invalidation; A2 own-entry identity vs base section; A3 mark revision/executor/all cut/remap identities.23 reuses these owners, не повторяет их code/review и не меняет22 docs. Source25 proposed resolver/mapping/recovery until gate. R23 “Existing e2e/chat.spec.ts after22” means future durable journey, сейчас absent; extend after source22 rebind before23 behavior, no isolated test layer.

### shared

Auth/Origin/no-store actor from session; strict shared Registry, no model account/SQL/URL authority. Unknown только unvalidated boundary.
**apps/api/src/auth/middleware.ts:92–103**

```ts
export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T> | null> {
	const contentType = c.req.header('content-type') ?? ''
	if (!contentType.toLowerCase().startsWith('application/json')) return null
	let body: unknown
	try {
		body = await c.req.json()
	} catch {
		return null
	}
	const parsed = schema.safeParse(body)
	return parsed.success ? parsed.data : null
}
```

**apps/api/src/request-context.ts:77–79**

```ts
export const errorBody = (code: ErrorCode, message: string, extra?: { retryAfterSeconds?: number }) => ({
	error: { code, message, requestId: currentRequestId(), ...extra },
})
```

**packages/db/src/connection.ts:28–35**

```ts
export type Database = Omit<ReturnType<typeof createDb>['db'], '$client'>

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export type DbExecutor = Database | Transaction

export function readSnapshot<T>(db: Database, read: (executor: DbExecutor) => Promise<T>): Promise<T> {
	return db.transaction((tx) => read(tx), { isolationLevel: 'repeatable read', accessMode: 'read only' })
```

app/server compose injected deps; loadConfig/env/logger remain existing owners. Safe run/attempt/status metadata only, no prompts/student text/provider raw errors/secrets. Web imports only contracts/core/api-client, no api/db. Current api-client JSON-only; SSE final22 A1. Existing calendar provider refresh registration96–99; final22 extends same account/current guards, router.refresh insufficient. Local effect+receipt same tx/provider HTTP outside; consistent reads readSnapshot. No source readiness/full audit claimed; implementation gates/simplify/no comments/no any apply later.

### e2e

E01–E11 NOT RUN. Existing Playwright target/real persistence/support fixtures, workers1/retries0/light+dark (config10–43); extend final22 chat journey/support after rebind. No new unit/component/contract/integration suites/environment/incident layer.
**e2e/move.spec.ts:57–67**

```ts
test('[calendar] single changes wait for conditional ACK and retain identity through two moves and cancel/restore', async ({
	page,
}) => {
	await singleChanges(page.request)
})

test('[calendar] command races reject a second Save on one base version and retain immutable retry', async ({
	page,
}) => {
	await singleRace(page.request)
})
```

**e2e/support/tz-ledger.ts:267–279**

```ts
async function paymentAfterMidnight(page: Page, card: Card): Promise<string> {
	await setMain(page.request, VN)
	const response = record(await api(page.request, 'GET', '/today'))
	const today = text(response.date)
	const tomorrow = addDays(today, 1)
	const label = (day: string) =>
		new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${day}T12:00Z`))
	await page.clock.install({ time: new Date(`${today}T23:59:58+07:00`) })
	await page.goto(`/students/${card.id}`)
	const opening = await page.locator('#opening-balance-on').innerText()
	await page.getByRole('button', { name: 'Record payment', exact: true }).click()
	await expect(page.locator('#record-payment-date')).toHaveText(label(today))
	await page.clock.setSystemTime(new Date(`${tomorrow}T00:01:00+07:00`))
```

Available exact anchors: today436/448 payment journey entry; tz-ledger267–307 form→POST→UUID/staleDates176; move57/63/84/102 real identity/race/lost PATCH/delayed ACK; no-show8/25 ordinary form/accounting. They do not prove new CAS/full seal. Final22 authorized synthetic model seam only if actual after rebind, application semantics only; Google real owner/fault path, no fake ACK/410.

Future commands, proposed title groups:

- yarn test:e2e e2e/chat.spec.ts --project=light --project=dark --grep "confirmed changes|essay|entry points"
- yarn test:e2e e2e/move.spec.ts --project=light --project=dark --grep "bulk|command recovery"
- yarn test:e2e e2e/today.spec.ts --project=light --project=dark --grep "payment|320px|phone"

Before behavior, exact failure→observable expected/persistence result. Planner binds exact durable titles/runtime lease. Each run records version/diff, scenario/fixture, target/persistence, expected/observed/status/original exit/rerun, no secrets. Runtime/provider quality/grants remain UNVERIFIED.

## SC / F / P / D / ARCH Coverage

| Criterion | Producer → consumer / concrete patterns                                       | Минимальная будущая проверка                                                |
| --------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| SC1       | Registry/proposal/decision + payment/card owners → decision UI/ordinary forms | E01–03/E11: waiting/Decline zero writes; current Confirm one effect         |
| SC2       | zone/full seal/serial final24 writer+25 mapping → bulk preview/recovery       | E05/E06: exact MSK/Vietnam scope/history, real partial journal              |
| SC3       | payments/cards CAS+receipt+final22 invalidation → same ordinary forms/screens | E04/E07: same ID/source/facts, no stale overwrite                           |
| SC4       | final22 admission + read-only essay/label → qualitative feedback              | E10/E11: truthful bounded/unassessed/incomplete, zero business writes       |
| SC5       | palette/entry/profile/agenda + conditional phone22 → safe draft/forms         | E08/E09: exact IDs/no paid navigation/one overlay/phone                     |
| F01       | P1 proposals/decisions/store → D1 UI                                          | E01/E02 identity/digest/current revision/race/repeat receipt                |
| F02       | P2 core teacher spans + payment/narrow rate → D2/D3 forms                     | E01/E03 precision/FX/no-rate/captured lesson length                         |
| F03       | P3 create/archive/exact delete/final22 retraction → D2 target                 | E03/E07/E11 stable ID/history/account, no physical student delete           |
| F04       | P4/P5 command zone/full seal/final writer → D4                                | E05/E06 named/omitted zone/DST/exclusions/verified prefix/changed remainder |
| F05       | P2/P5 same-ID/narrow CAS/typed receipts → D3/D7                               | E04/E07 lost response/current form/concurrent edits                         |
| F06       | P6 final22 read-only essay/schema/label → D5                                  | E10 incomplete/unassessed/budget/no official score                          |
| F07       | P7 existing palette/profile/read lessons/agenda → D6–D8                       | E07–09 exactID/async/IME/draft/range/phone                                  |
| F08       | P1/P6 actor/Origin/strict Registry/source spans/allowlist → decisions/essay   | E02/E03/E10/E11 no forged actor/model approval/private receipt              |
| F09       | I01–I67 proposed targets/signatures → planner                                 | Static coverage/tracking/fingerprints; final rebind before source           |
| F10       | existing public harness + future22 durable chat extension → journeys          | E01–11 real target/DB/provider evidence, no mock success                    |
| P1        | proposal/store/decision producer → final22 run/tool + D1 UI                   | SC1/F01/F08/E01/E02                                                         |
| P2        | payment/card CAS+core spans producer → ordinary correction                    | SC1/SC3/F02/F05/E01/E03/E04                                                 |
| P3        | exact card/archive/delete policy → preview/normal target                      | SC1/F03/E03/E07/E11                                                         |
| P4        | command input zone/full target seal → bulk preview/final command              | SC2/F04/E05                                                                 |
| P5        | durable child association/final journal/typed receipt → recovery/forms        | SC2/SC3/F04/F05/E06/E07                                                     |
| P6        | final22 read-only essay/label/limits → qualitative feedback                   | SC4/F06/F08/E10/E11                                                         |
| P7        | shell/palette/profile/agenda/entry producers → safe phone/navigation          | SC5/F07/E07–09                                                              |
| D1        | ChangeCard+decision adaptation → durable preview/receipt                      | SC1/F01/F08/E01/E02; no countdown/Git receipt                               |
| D2        | StudentForm/archive/payment confirmation → distinct operation titles          | SC1/F02/F03/E03; safe Open record for unsupported removal                   |
| D3        | ordinary Payment/StudentForm CAS → same-ID correction                         | SC3/F05/E04/E07; no recreate                                                |
| D4        | input/display/creation zone+MoveSeries/TimePair/final notice → bulk           | SC2/SC3/F04/E05/E06; partial not full Saved                                 |
| D5        | Chat feedback adaptation → fixed approximate qualitative result               | SC4/F06/E10; no mock bands                                                  |
| D6        | existing Base UI palette/AppShell → Actions/Students/Screens                  | SC5/F07/E08; one overlay/no IME send                                        |
| D7        | profile/Panel/Tabs/Payment+bounded Lessons/Ask → current reads                | SC3/SC5/F05/F07/E07                                                         |
| D8        | existing Today/final22 composer/shell+checked agenda → phone                  | SC5/F07/E09; no bottom nav/redesign                                         |
| ARCH-A1   | executor payment+same-ID/CAS → decision+normal record/edit/assign/delete      | SC1/SC3/F01/F02/F05/F09/E01/E02/E04                                         |
| ARCH-A2   | narrow rate/all ordinary card revision → full form/status/opening             | SC1/SC3/F02/F03/F05/F09/E02/E04/E07; create already executor                |
| ARCH-A3   | separate zone/whole seal/serial final writer → bulk/ordinary preview          | SC2/SC3/F04/F05/F09/E05/E06/E07; reuse final cut                            |

## UI native considerations

Final23 UI-CHECK: B01/B02 RESOLVED; неблокирующие Visuals/Color/Spacing flags сохранены. Mapper не повторяет audit. Research “no23 UI-SPEC yet”/old22 flags — historical snapshot, не current blocker/повод менять inputs. Все69 predicates из UI-SPEC:346–420 идут в planner must_haves; не новый source behavior.

| Surface  | Predicates | Producer/consumer                                                    | Evidence    |
| -------- | ---------: | -------------------------------------------------------------------- | ----------- |
| PROPOSAL |          8 | proposal/store/decision → card/decision/messages                     | E01/E02     |
| PREVIEWS |          8 | money/card intents + Registry/domain owner → exact operation preview | E01/E03/E11 |
| BULK     |          8 | zone/full seal/child journal → result/recovery                       | E05/E06     |
| FORMS    |          5 | payment/card CAS → ordinary dialogs/current reread                   | E04/E07     |
| RECEIPT  |          8 | actual typed receipt → eligible normal navigation                    | E03/E07/E11 |
| ESSAY    |          8 | read-only22 mode+label → qualitative/incomplete feedback             | E10/E11     |
| PALETTE  |          8 | shell/current roster/draft entry → async options/one overlay         | E08/E09     |
| PROFILE  |          8 | bounded lessons/facts → range/tabs/payment/receipt                   | E07/E09     |
| PHONE    |          8 | agenda/current Today/final22 composer/dialog → narrow interaction    | E09         |

## No Analog Found

Не выдавать DS preview, synthetic adapter, missing future file за source analog. Partial reusable technique не означает наличие полного нового domain guarantee.

| ID / target                                                       | Причина                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| I02 `packages/contracts/src/chat.ts`                              | PROPOSED final22 source отсутствует                                                           |
| I03 `packages/contracts/src/chat-events.ts`                       | PROPOSED final22 source отсутствует                                                           |
| I09 `packages/db/src/chat-schema.ts`                              | PROPOSED final22 source отсутствует                                                           |
| I12 `packages/db/drizzle/<generated>/migration.sql`               | Output generator, не рукописный analog                                                        |
| I13 `packages/db/drizzle/<generated>/snapshot.json`               | Output generator, не рукописный analog                                                        |
| I17 `apps/api/src/chat/money-intents.ts`                          | Проверить spans teacher text; pure core parse/format; no model money/FX                       |
| I18 `apps/api/src/chat/card-intents.ts`                           | Exact entity, reserved new ID; distinct archive/payment delete/retraction; no account cascade |
| I19 `apps/api/src/chat/bulk-plan.ts`                              | Complete sealed target membership/versions/exclusions before write                            |
| I20 `apps/api/src/chat/bulk-commands.ts`                          | Serial final24 writer; child IDs/journal; verified prefix, changed remainder fresh decision   |
| I21 `apps/api/src/chat/essay.ts`                                  | Final22 budget/provider/run; read-only registry; fixed label before publish/reload            |
| I22 `apps/api/src/chat/tools.ts`                                  | PROPOSED final22 source отсутствует                                                           |
| I23 `apps/api/src/chat/runs.ts`                                   | PROPOSED final22 source отсутствует                                                           |
| I24 `apps/api/src/routes/chat.ts`                                 | PROPOSED final22 source отсутствует                                                           |
| I38 `apps/api/src/chat/command-zone.ts`                           | Только если final24 не даёт shared explicit-zone seam; IANA/MSK/Vietnam input policy          |
| I41 `apps/web/app/(app)/chat/_components/essay-feedback.tsx`      | Checked qualitative feedback/approximate label, no mock bands/Overall/official IELTS          |
| I42 `apps/web/app/(app)/chat/_components/messages.tsx`            | PROPOSED final22 source отсутствует                                                           |
| I43 `apps/web/app/(app)/chat/_components/use-chat.ts`             | PROPOSED final22 source отсутствует                                                           |
| I47 `apps/web/app/(app)/_components/use-entry-point.ts`           | Final22 metadata/draft idempotent identity; exact mention, no paid navigation/private URL     |
| I57 `apps/web/app/(app)/schedule/_components/schedule-agenda.tsx` | No current agenda analog; checked v40 composition + actual events/TimePair/read-only status   |
| I59 `apps/web/app/(app)/chat/_components/chat-screen.tsx`         | PROPOSED final22 source отсутствует                                                           |
| I64 `e2e/chat.spec.ts`                                            | PROPOSED final22 source отсутствует                                                           |
| I65 `e2e/support/chat.ts`                                         | PROPOSED final22 source отсутствует                                                           |

## Metadata / Fingerprints

5 основных matches: payments owner, RecordPaymentDialog, cards owner, series/core cut, CommandPalette/AppShell. После них поиск остановлен. Остальные чтения — exact necessary callers/shared owners/E2E для C1–C3. Codegraph/project skill dirs отсутствуют, rg без indexing. work-router/gsd-phase-recipe authority reused, конфликтующие Git/deletion/delegation/model defaults подавлены текущим контрактом.

54 current tracked source/config/harness files. Проверен exact git ls-files -- path перед назначением. Future/mirror/install paths не tracked аналоги. Source text прочитан один раз и excerpts получены из этого snapshot; проверки читают bytes для истинности fingerprints/excerpts. Named Read/Write tools отсутствуют; read-only exec и apply_patch единственного документа, без shell/heredoc creation. Main/source/other docs не меняются.

### Protected input fingerprints

| Input                                                                           | SHA-256                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `AGENTS.md`                                                                     | `fbef0e319fe49ffb5ab0067e8feac8093172f958b0a70808ff5a376bbb72c9be` |
| `.planning/EXECUTOR-RULES.md`                                                   | `1eca1fa30e110bd04658cbf885d1b2189ce854f3cd3ed49664194f6121cbd449` |
| `.planning/phases/23-confirmed-chat-changes-and-entry-points/23-CONTEXT.md`     | `09412364bc4839eb1e5039bf30e4cc9a146ea3ea604705eb53de511a74a6184b` |
| `.planning/phases/23-confirmed-chat-changes-and-entry-points/23-RESEARCH.md`    | `f73f6553f9998bc19b45c53e63d190f18f7f19bc6e19e17bdddde62a2184aae1` |
| `.planning/phases/23-confirmed-chat-changes-and-entry-points/23-UI-SPEC.md`     | `28ca26a976ac47d3bf168d80e0472e458031f3fca1f316993c8ad2ba3b7bf03b` |
| `.planning/phases/23-confirmed-chat-changes-and-entry-points/23-UI-CHECK.md`    | `be253636d723340d3ff3b67909fd6f9c3c78ac87ef3454693a84ba355e0a9d6e` |
| `.planning/phases/23-confirmed-chat-changes-and-entry-points/23-ARCH-REVIEW.md` | `49a18e3565550fee8e04000322fcb90317e2cea15e6facb6a60e68edebb01eea` |
| `.planning/phases/22-chat-with-mentions-and-quick-marks/22-PATTERNS.md`         | `07222884659d31b636a7376a994798b3128117475cca2f0d5d19583b411d7093` |
| `.planning/phases/22-chat-with-mentions-and-quick-marks/22-AI-SPEC.md`          | `a399cb8d22a9042f7dfcfd34c710687401f62fe043c36b694709a7e6652709ed` |
| `.planning/phases/22-chat-with-mentions-and-quick-marks/22-ARCH-REVIEW.md`      | `eb55e8cc42ba98894c76a1b406fc09569cf7ed5909e13579d6b92e910dc1ccc8` |

### Tracked source fingerprints

| Source                                                                   | Physical lines | SHA-256                                                            |
| ------------------------------------------------------------------------ | -------------: | ------------------------------------------------------------------ |
| `apps/api/src/cards/payments.ts`                                         |            185 | `8fba4470f5e06ee37bd58156646d118cbd7b9e117e3ed036864b9302fa2f5030` |
| `apps/api/src/cards/cards.ts`                                            |            200 | `9e1884977d1528bd7d2d880d3b61afe636c78d6c4fd7f208782e772be91f5670` |
| `apps/api/src/routes/payments.ts`                                        |             87 | `45203150c34b99de7f3e111f8f386d6d9f9d04b20df3994b954320e3628ceb50` |
| `apps/api/src/cards/card-rows.ts`                                        |             73 | `5fbc2beb98cd5ec3418b1e7b2092e113c2826352e806a908d2bfc6083e91c899` |
| `apps/web/app/(app)/_components/command-palette.tsx`                     |            116 | `978344fa7d2d848128a5024f123ca35655220a25e94d3efdd8844d7c2c8a3dde` |
| `apps/web/app/(app)/_components/app-shell.tsx`                           |             90 | `892ae7295084c9970747853bd3493760163d51a93ef658e5152ac798bba0cbc4` |
| `apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx` |            296 | `ab1e55d1c13b5cbadbcc73a56c51c3020df92349f1e2bfb44d52d3c9078027b4` |
| `apps/web/app/(app)/students/[id]/_components/payments-tab.tsx`          |            197 | `7d3ea2cb1cf3c5363a7517c3974e6164752f815c25e74cc7c5aebba9ecf62409` |
| `apps/web/app/(app)/students/_components/student-form-dialog.tsx`        |            408 | `0ba84d137bbde36df347db527812af21378f112fb0374633fa8da89a87f3ebb1` |
| `apps/web/app/(app)/students/[id]/_components/student-profile.tsx`       |            343 | `59fc03f37e0a4bb6615c34fb0cb15232c5c9a15941043d06ea8959d8f844ae83` |
| `apps/api/src/schedule/series.ts`                                        |            113 | `71c7d5db60cca9545802cf1866ea2504e61f3cd74d6cc2b29e3c40f322670092` |
| `apps/api/src/schedule/command-plan.ts`                                  |            236 | `a828a487fe9784c864f770e6b6c241353167a4a6c62e11a70d414c98365ce6e8` |
| `apps/api/src/calendar/commands.ts`                                      |            143 | `6bb40fba1061b6015f8d5787748ee29782a0950b23f076562b4074a9dab1b5a3` |
| `apps/api/src/calendar/journal.ts`                                       |            226 | `30a73a7a98c0342afdc828997bb097dc8291d18692013d5f46fbca539e603e37` |
| `apps/api/src/calendar/series-context.ts`                                |             52 | `43bc8b864d407e7cef996b97f913afe80107c5011f1fb2ae260aa7ae55a5655f` |
| `packages/core/src/schedule-series.ts`                                   |            184 | `f0b14a9cec1853b43734a0691e836861e727a891e7c322510fdac7868d0450c5` |
| `packages/core/src/zoned.ts`                                             |            137 | `ef89db84efcca1537ca10569d8a238935e035308ebc888ae528ac359b2ed9e58` |
| `packages/contracts/src/students.ts`                                     |            211 | `9569662a23804a1b59e424fd30a63fb8ffbe119b879ea441a4b21153c8e2cb52` |
| `packages/contracts/src/schedule.ts`                                     |            147 | `19110c5db060b92946cdde9a17ea63ac7db8018a5be80c09d002ec10dee1d9c6` |
| `packages/contracts/src/calendar.ts`                                     |            335 | `5e950d4517bb6989e04ea551a1c35c7f9c589e2374566f63ddba3bd139470780` |
| `packages/contracts/src/index.ts`                                        |              8 | `6c7bcb4d755988c6eb422f6685cda144b68ae7aac7ac8a858b8d18f7c695782b` |
| `packages/db/src/schema.ts`                                              |            326 | `3f190ad368cb89b5cabd7a08c57ab94c4c4c815a9aa09d92cc877cb3218551de` |
| `packages/db/src/index.ts`                                               |              7 | `62334d82d655463b34b9cae5f2761f1a8cf043c9877ed09a09b664b7eb20f740` |
| `packages/db/src/calendar-schema.ts`                                     |            368 | `3e0a840276411c7c541c9859a86d57a8d4b2cf7604237d2ba94599a92dcaa2ac` |
| `packages/core/src/money.ts`                                             |             55 | `5ab84457e48cfdc07e9e70612160ae78328a168e90e4d9de844d8a54d90f0f8f` |
| `packages/core/src/lessons.ts`                                           |             92 | `81016e303e08dfb943f4ee9169d56b15d92abb4f6aaca8b64581de15f16cd9ae` |
| `packages/core/src/schedule.ts`                                          |            358 | `2565496fe280152bf35f94d7d56b1b07bdf03f08873d5b3e6f4e6c2a04a99b4a` |
| `apps/api/src/routes/students.ts`                                        |            283 | `d6667d63546062a4964787467fccaf94dd1094546f9d8c15dfa69f64c959afab` |
| `apps/api/src/app.ts`                                                    |            111 | `a6e7ad6dfc55d44f8e3e5e3a43563743b33e41e9c2e4dccde5a5c7dc81c3a8bf` |
| `apps/api/src/server.ts`                                                 |            109 | `ea018ce5ec2a63427e66afbe570f5815b52937bf6cbacdb622ed81dd10a105e1` |
| `apps/api/src/auth/middleware.ts`                                        |            116 | `86e78399ebe845a36f60008e808a34ea9a2bece1e052cae1f621d90a1af88bcf` |
| `apps/api/src/request-context.ts`                                        |             79 | `9eb0c082b19492f9675d1e3e05ba337af75e71a1906ec0f5ddc81082d652c8c6` |
| `apps/api/src/cards/card-facts.ts`                                       |             68 | `d739eef3cc82a2101934626a34072ef41d4d9bfc8bbbe4415a36dc3681a52e44` |
| `apps/api/src/schedule/schedule.ts`                                      |            276 | `1b36727f9ff563a6701286403321db7ccfe37786fcb7bd018959a0ba3e1d326f` |
| `packages/db/src/connection.ts`                                          |             36 | `2bb3e709933b907ddce8f6cb61d5a16231b72e56e72975d500907abc918ff8c2` |
| `apps/api/src/settings/settings.ts`                                      |             70 | `4bdf669819d0ff9ca97e4e2f88742b655b1288caddd96eb4737278969fac96b6` |
| `apps/web/app/(app)/students/[id]/_components/overview-tab.tsx`          |            123 | `b0bf376fb38a2549f574bd99f7500ed295adcd9241830cf505f4fda409b03198` |
| `apps/web/app/(app)/students/[id]/_components/opening-balance-panel.tsx` |            148 | `8166deb713e0af50b1c3c05405fae7250919e4227c9633d64b8823b9503826ba` |
| `apps/web/app/(app)/students/[id]/_components/set-currency-dialog.tsx`   |            156 | `9dd2a515fa3a1bcfb041275e32192c9808a4914976e7b6bb5557180c3231533b` |
| `apps/web/app/(app)/students/_components/assign-payment-dialog.tsx`      |            197 | `f29dc8779bae21ec0b5bff9d5977a80858984de34fe449a6af6dcef76ec1fb9a` |
| `apps/web/app/(app)/schedule/_components/schedule-screen.tsx`            |            279 | `ce524e19720b875cd1e85b5f68739594a469e1cdbbf3c80148d90bbd5199bfee` |
| `apps/web/app/(app)/schedule/_components/move-series-dialog.tsx`         |            266 | `1e39d051684ade6dc20da03b93960a1f52ec8caef679ad694f6c99314ecb1d91` |
| `apps/web/app/(app)/schedule/_components/schedule-mutations.ts`          |            195 | `d0ada3836b04356a3a07debddb579308e9b04f05475d65f2d89155cc0af67501` |
| `apps/web/app/(app)/_components/today-screen.tsx`                        |            443 | `236316f993efa62e5de94c0a2e58578669dc630806c3243b6c0b5a76f34e1cf6` |
| `apps/web/app/(app)/students/_components/students-screen.tsx`            |            261 | `4ff4dc65423929b346a3973e4bb624405b4210e7fc20de8ec3e6c2a939e5df84` |
| `apps/web/components/app/confirm-dialog.tsx`                             |             86 | `b0e8f102a9b713191f802d3f01030e066ec3766530fe42c5f23427590cbc7b5a` |
| `apps/web/components/app/calendar-command-provider.tsx`                  |             99 | `1598c4b7137b213084e77f579aab381e144c908281378a8257e1f14d7ee0f4d0` |
| `apps/web/lib/api-client.ts`                                             |             35 | `fe19848e334e7604c0a8c25edb692c061b87ba3a50170d061dae0bd8ba9a435d` |
| `e2e/today.spec.ts`                                                      |            468 | `e86a5351c1e46e7cefb8f6c4e2d5eb25efded09276b03d6c10f43e154bc13c2a` |
| `e2e/move.spec.ts`                                                       |            498 | `961dbcfa66abaa16974c7e633e00793da83758300537a0bcd6827c209817f389` |
| `e2e/no-show.spec.ts`                                                    |             89 | `5a0f77c5d07478522a5ed75d72ea917535e6197adece29beae0ac1501b1cc99c` |
| `e2e/support/tz-ledger.ts`                                               |            382 | `b28c483352e266d62fba54eef3eeb83b198a160dc0a2dab318091c301d395bce` |
| `e2e/support/test.ts`                                                    |            231 | `bfd358456f7ba065cce2cc99c9390097d582261ec0f63c716d815de93ed4fd6a` |
| `playwright.config.ts`                                                   |             45 | `0154cbcb60ae2c6ff9c7d3127d1cc0fc75c10f5b821f807409113a95a638c420` |

13 source fingerprints ARCH23 сравниваются с current bytes и sourcepin913fc5a. Scope comparison только13 именованных файлов, не wholeRepo audit. No code readiness/quality/format/type/runtime inference from hashes.

## Document checks

Из Root:

- bash scripts/gsd/root-pin.sh ~/.claude/worktrees/phase-24-google-calendar-preparation/dv-lab — exit0/ROOT_PIN_OK перед первой записью.
- yarn prettier --check --embedded-language-formatting=off .planning/phases/23-confirmed-chat-changes-and-entry-points/23-PATTERNS.md — финальный original exit/status в handoff. Embedded code formatting отключён только для этого documentation check, чтобы сохранить дословные excerpts.
- Inline Python stdlib command ниже проверяет67 inventory/assignments, SC/F/P/D/ARCH,69 UI, tracked/SHA/verbatim,13sourcepin и absent dependencies.

````sh
python3 -c 'from pathlib import Path
import hashlib,re,subprocess,json
p=Path(".planning/phases/23-confirmed-chat-changes-and-entry-points/23-PATTERNS.md")
s=p.read_text()
c=s.split("## File Classification",1)[1].split("## Pattern Assignments",1)[0]
a=s.split("## Pattern Assignments",1)[1].split("### registry",1)[0]
rows=re.findall(r"^\|\s*(I\d{2})\s*\|\s*`([^`]+)`\s*\|\s*(New|Modified|Conditional|Generated)\s*\|",c,re.M)
assigned=re.findall(r"^\|\s*(I\d{2})\s+`",a,re.M)
assert len(rows)==67 and len(set(x[0] for x in rows))==67 and assigned==[x[0] for x in rows]
for _,path,status in rows:
 if status=="Modified": assert subprocess.check_output(["git","ls-files","--",path]).decode().strip()==path,path
 if status=="New": assert not Path(path).exists(),path
for prefix,n in [("SC",5),("F",10),("P",7),("D",8),("ARCH-A",3)]:
 for i in range(1,n+1):
  label=prefix+(str(i).zfill(2) if prefix=="F" else str(i))
  assert re.search(r"^\|\s*"+label+r"\s*\|",s,re.M),label
fingerprints=re.findall(r"^\|\s*`([^`]+)`\s*\|(?:\s*\d+\s*\|)?\s*`([a-f0-9]{64})`\s*\|$",s,re.M)
section=s.split("### Tracked source fingerprints",1)[1]
tracked=re.findall(r"^\|\s*`([^`]+)`\s*\|\s*\d+\s*\|\s*`([a-f0-9]{64})`\s*\|$",section,re.M)
for f,h in fingerprints: assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,f
for f,h in tracked: assert subprocess.check_output(["git","ls-files","--",f]).decode().strip()==f,f
texts=[Path(f).read_text() for f,h in tracked]
excerpts=re.findall(r"```(?:ts|tsx)\n(.*?)\n```",s,re.S)
assert len(excerpts)==30
for excerpt in excerpts: assert any(excerpt+"\n" in t for t in texts),excerpt[:80]
ui=Path(p.parent/"23-UI-SPEC.md").read_text()
assert hashlib.sha256(ui.encode()).hexdigest()=="28ca26a976ac47d3bf168d80e0472e458031f3fca1f316993c8ad2ba3b7bf03b"
predicates=re.findall(r"^\|\s*(PROPOSAL|PREVIEWS|BULK|FORMS|RECEIPT|ESSAY|PALETTE|PROFILE|PHONE)\s*\|\s*(empty|loading|error|populated|partial|overflow|zero-one-many|long-text)\s*\|",ui,re.M)
assert len(predicates)==69 and len(set(x[0] for x in predicates))==9
assert not Path("e2e/chat.spec.ts").exists()
assert not Path("apps/api/src/chat/tools.ts").exists()
assert not Path("packages/db/src/chat-schema.ts").exists()
assert ".gsd/"+"capabilities/" not in s
arch=Path(p.parent/"23-ARCH-REVIEW.md").read_text()
anchors=re.findall(r"^\|\s*((?:apps|packages)/[^|]+?)\s*\|\s*([a-f0-9]{64})\s*\|$",arch,re.M)
assert len(anchors)==13
for f,h in anchors:
 assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,f
 assert hashlib.sha256(subprocess.check_output(["git","show","913fc5ae9286aca9a48b5ce4272699c846849874:"+f])).hexdigest()==h,f
assert Path.cwd().resolve()==Path("~/.claude/worktrees/phase-24-google-calendar-preparation/dv-lab")
assert subprocess.check_output(["git","rev-parse","HEAD"]).decode().strip()=="81a11752853260327ba385475547a912b152842b"
print(json.dumps({"status":"PATTERNS_STATIC_OK","inventory":len(rows),"assignments":len(assigned),"tracked":len(tracked),"fingerprints":len(fingerprints),"excerpts":len(excerpts),"UI_predicates":len(predicates),"ARCH_anchors":len(anchors),"sha256":hashlib.sha256(p.read_bytes()).hexdigest()}))
'
````

Финальные original exits/short decisive output и document SHA-256 в handoff. Self-hash внутри файла не записывается. Application/E2E/browser/DB/provider/model/build/type/lint/dependency/quality checks NOT RUN: preparation document-only. Final22/24/25 rebind и actual access/cap/grants/provider/phone evidence остаются execution gates; текущая карта не Phase PASS.
