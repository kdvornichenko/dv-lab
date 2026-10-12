# Phase 22: Chat with Mentions and Quick Marks — Pattern Map

**Mapped:** 2026-10-12  
**Source Root:** `~/.claude/worktrees/phase-24-google-calendar-preparation/dv-lab`  
**HEAD:** `913fc5ae9286aca9a48b5ce4272699c846849874`  
**Inventory:** 73 строки: 71 предполагаемый file target и 2 отдельные строки Parent/RuntimeSource. New 29; Modified 32; Conditional 7; Generated 3; Parent 1; RuntimeSource 1. Все будущие изменения — PROPOSED, а не разрешение mapper на запись source.  
**Analogs:** 54 / 73 строки (exact 45, role-match 9, none 19). Для 71 file target: 54 с аналогом, 17 без аналога. 5 основных образцов; остальные чтения — точные владельцы и необходимые callers, без расширенного поиска.

## Scope Card

Outcome: proposed files/signatures → ближайшие TRACKED source patterns для SC1–SC5/F01–F10 и принятых ARCH-A1–A3 перед planner22. In scope: inventory R22 F09, точные owner/caller seams A1–A3, excerpts/line numbers/fingerprints и будущие public proof paths. Out of scope: implementation, source/shared metadata/прочие документы, env/runtime/provider/DB/browser/dependencies/Git mutations/agents/deletion, новое исследование моделей/цен, полный review25 и quality audit.

Acceptance: C1 — каждый target классифицирован и назначен owner/analog либо none; C2 — SC/F/A имеют producer→consumer delta и public evidence; C3 — все существующие analogs TRACKED, excerpts дословны, snapshot проверяем; C4 — только этот документ записан, внешние пробелы явно сохранены. Verification: root-pin, git ls-files, SHA-256, doc inventory/coverage/excerpt/UI predicate checks. Work map: R22F09→C1; пять образцов и necessary callers→C2/C3; матрицы и fingerprints→C1–C4. Stop: полная статическая карта; Parent потребляет её для PLAN22.

Допущения:

1. Inventory R22 F09 остаётся предложением, не реализованным source; основание — RESEARCH/AI-SPEC. Existing status проверен отдельно.
2. Финальный source24/25 может изменить сигнатуры/пути; основание — ARCH review и25 final index. Rebind обязателен на первом execution gate.
3. Private monthly cap/key/models/credits/spike не наблюдались; основание — AI-SPEC/RESEARCH. Missing configuration закрывает paid admission, но не доказывает verified absence.

AgentFlow SUSPENDED. Работа explicit GSD pattern mapper через work-router без побочных действий. main read-only; Source10 actor outside Root не источник аналогов. Коммиты и сообщения другим задачам не выполняются.

## File Classification

Статус относится к будущему implementation inventory. Conditional требует финального выбора пути/необходимости; Generated — только output существующего generator. Exact означает роль/поток или использование того же владельца, а не наличие всего нового поведения. Role-match — перенос ограниченного pattern; none — новый domain mechanism без полноценного аналога.

| ID  | New/Modified File                                               | Status        | Role      | Data Flow        | Closest TRACKED Analog                                          | Match Quality | Criteria                |
| --- | --------------------------------------------------------------- | ------------- | --------- | ---------------- | --------------------------------------------------------------- | ------------- | ----------------------- |
| I01 | `packages/contracts/src/chat.ts`                                | New           | model     | request-response | `packages/contracts/src/settings.ts`                            | role-match    | SC1–4/F03–06            |
| I02 | `packages/contracts/src/chat-events.ts`                         | New           | model     | streaming        | `packages/contracts/src/settings.ts`                            | role-match    | SC1/3/F02/09/ARCH-A1    |
| I03 | `packages/contracts/src/chat-settings.ts`                       | New           | model     | request-response | `packages/contracts/src/settings.ts`                            | exact         | SC5/F01/07              |
| I04 | `packages/contracts/src/index.ts`                               | Modified      | model     | request-response | `packages/contracts/src/index.ts`                               | exact         | SC1–5/F09               |
| I05 | `packages/contracts/src/schedule.ts`                            | Modified      | model     | request-response | `packages/contracts/src/schedule.ts`                            | exact         | SC3/F05/ARCH-A3         |
| I06 | `packages/contracts/src/students.ts`                            | Modified      | model     | request-response | `packages/contracts/src/students.ts`                            | exact         | SC3/4/F05/ARCH-A2       |
| I07 | `packages/contracts/src/settings.ts`                            | Modified      | model     | request-response | `packages/contracts/src/settings.ts`                            | exact         | SC5/F01/07              |
| I08 | `packages/db/src/chat-schema.ts`                                | New           | model     | CRUD             | `packages/db/src/calendar-schema.ts`                            | exact         | SC1/3/5/F02/05/07/08    |
| I09 | `packages/db/src/schema.ts`                                     | Modified      | model     | CRUD             | `packages/db/src/schema.ts`                                     | exact         | SC1/3/5/F09/ARCH-A2/A3  |
| I10 | `packages/db/src/index.ts`                                      | Modified      | model     | CRUD             | `packages/db/src/index.ts`                                      | exact         | SC1/3/5/F09/ARCH-A2/A3  |
| I11 | `packages/db/drizzle/<generated>/migration.sql`                 | Generated     | migration | batch            | —                                                               | none          | SC1/3/5/F09             |
| I12 | `packages/db/drizzle/<generated>/snapshot.json`                 | Generated     | config    | transform        | —                                                               | none          | SC1/3/5/F09             |
| I13 | `apps/api/src/chat/conversations.ts`                            | New           | service   | CRUD             | `apps/api/src/calendar/journal.ts`                              | role-match    | SC1/F03/08              |
| I14 | `apps/api/src/chat/store.ts`                                    | New           | store     | CRUD             | `apps/api/src/calendar/journal.ts`                              | exact         | SC1/F02/03/08           |
| I15 | `apps/api/src/chat/events.ts`                                   | New           | store     | streaming        | —                                                               | none          | SC1/3/F02/09/ARCH-A1    |
| I16 | `apps/api/src/chat/runs.ts`                                     | New           | service   | event-driven     | `apps/api/src/calendar/worker.ts`                               | exact         | SC1/5/F02/07            |
| I17 | `apps/api/src/chat/provider.ts`                                 | New           | service   | streaming        | —                                                               | none          | SC1/5/F01/02/07         |
| I18 | `apps/api/src/chat/model-config.ts`                             | New           | config    | transform        | `apps/api/src/config.ts`                                        | role-match    | SC5/F01/07              |
| I19 | `apps/api/src/chat/budget.ts`                                   | New           | service   | CRUD             | —                                                               | none          | SC5/F07                 |
| I20 | `apps/api/src/chat/usage.ts`                                    | New           | store     | CRUD             | —                                                               | none          | SC5/F07                 |
| I21 | `apps/api/src/chat/tools.ts`                                    | New           | service   | request-response | —                                                               | none          | SC2–4/F03–06            |
| I22 | `apps/api/src/chat/lesson-target.ts`                            | New           | service   | transform        | —                                                               | none          | SC2/F04                 |
| I23 | `apps/api/src/chat/facts.ts`                                    | New           | service   | request-response | `apps/api/src/cards/card-facts.ts`                              | exact         | SC4/F06                 |
| I24 | `apps/api/src/chat/undo.ts`                                     | New           | service   | CRUD             | —                                                               | none          | SC3/F05/ARCH-A2/A3      |
| I25 | `apps/api/src/chat/calendar.ts`                                 | Conditional   | service   | request-response | `apps/api/src/calendar/commands.ts`                             | role-match    | SC2/3/F04/05            |
| I26 | `apps/api/src/routes/chat.ts`                                   | New           | route     | request-response | `apps/api/src/routes/settings.ts`                               | exact         | SC1–5/F02–09            |
| I27 | `apps/api/src/app.ts`                                           | Modified      | config    | request-response | `apps/api/src/app.ts`                                           | exact         | SC1–5/F09               |
| I28 | `apps/api/src/config.ts`                                        | Modified      | config    | transform        | `apps/api/src/config.ts`                                        | exact         | SC5/F01/07              |
| I29 | `apps/api/src/server.ts`                                        | Modified      | config    | event-driven     | `apps/api/src/server.ts`                                        | exact         | SC1/5/F02/07            |
| I30 | `apps/api/src/lifecycle.ts`                                     | Conditional   | service   | event-driven     | `apps/api/src/lifecycle.ts`                                     | exact         | SC1/F02                 |
| I31 | `apps/api/src/cards/mentions.ts`                                | New           | service   | request-response | `apps/api/src/cards/cards.ts`                                   | exact         | SC2/F03                 |
| I32 | `apps/api/src/cards/notes.ts`                                   | New           | service   | CRUD             | —                                                               | none          | SC3/4/F05/06/ARCH-A2    |
| I33 | `apps/api/src/cards/sections.ts`                                | Modified      | service   | CRUD             | `apps/api/src/cards/sections.ts`                                | exact         | SC3/F05/ARCH-A2         |
| I34 | `apps/api/src/routes/students.ts`                               | Modified      | route     | request-response | `apps/api/src/routes/students.ts`                               | exact         | SC2–4/F03/05/06/ARCH-A2 |
| I35 | `apps/api/src/schedule/marks.ts`                                | Modified      | service   | CRUD             | `apps/api/src/schedule/marks.ts`                                | exact         | SC3/F05/ARCH-A3         |
| I36 | `apps/api/src/schedule/comments.ts`                             | New           | service   | CRUD             | —                                                               | none          | SC3/4/F05/06/ARCH-A2    |
| I37 | `apps/api/src/routes/schedule.ts`                               | Modified      | route     | request-response | `apps/api/src/routes/schedule.ts`                               | exact         | SC3/F05/ARCH-A3         |
| I38 | `apps/api/src/schedule/series.ts`                               | Conditional   | service   | CRUD             | `apps/api/src/schedule/series.ts`                               | exact         | SC3/F05/ARCH-A3         |
| I39 | `apps/api/src/schedule/rows.ts`                                 | Modified      | service   | CRUD             | `apps/api/src/schedule/rows.ts`                                 | exact         | SC3/4/F05/06/ARCH-A3    |
| I40 | `apps/api/src/settings/settings.ts`                             | Modified      | service   | CRUD             | `apps/api/src/settings/settings.ts`                             | exact         | SC5/F01/07              |
| I41 | `apps/api/src/routes/settings.ts`                               | Modified      | route     | request-response | `apps/api/src/routes/settings.ts`                               | exact         | SC5/F01/07              |
| I42 | `apps/web/app/(app)/chat/page.tsx`                              | Modified      | route     | request-response | `apps/web/app/(app)/chat/page.tsx`                              | exact         | SC1/F09                 |
| I43 | `apps/web/app/(app)/chat/_components/chat-screen.tsx`           | New           | component | event-driven     | `apps/web/app/(app)/settings/_components/settings-screen.tsx`   | role-match    | SC1–5/F09               |
| I44 | `apps/web/app/(app)/chat/_components/conversation-list.tsx`     | New           | component | CRUD             | —                                                               | none          | SC1/F03/08/09           |
| I45 | `apps/web/app/(app)/chat/_components/composer.tsx`              | New           | component | event-driven     | —                                                               | none          | SC2/F03/04/09           |
| I46 | `apps/web/app/(app)/chat/_components/messages.tsx`              | New           | component | streaming        | —                                                               | none          | SC1/3/4/F02/05/06/09    |
| I47 | `apps/web/app/(app)/chat/_components/model-controls.tsx`        | New           | component | event-driven     | —                                                               | none          | SC5/F01/09              |
| I48 | `apps/web/app/(app)/chat/_components/use-chat.ts`               | New           | hook      | streaming        | —                                                               | none          | SC1/3/F02/09/ARCH-A1    |
| I49 | `apps/web/lib/api-client.ts`                                    | Modified      | utility   | streaming        | `apps/web/lib/api-client.ts`                                    | role-match    | SC1/F02/09/ARCH-A1      |
| I50 | `apps/web/lib/data-changes.ts`                                  | New           | utility   | pub-sub          | `apps/web/components/app/calendar-command-provider.tsx`         | exact         | SC3/F09/ARCH-A1         |
| I51 | `apps/web/components/app/calendar-command-provider.tsx`         | Modified      | provider  | pub-sub          | `apps/web/components/app/calendar-command-provider.tsx`         | exact         | SC3/F09/ARCH-A1         |
| I52 | `apps/web/app/(app)/_components/use-today.ts`                   | Modified      | hook      | request-response | `apps/web/app/(app)/_components/use-today.ts`                   | exact         | SC3/F09/ARCH-A1         |
| I53 | `apps/web/app/(app)/schedule/_components/use-schedule-week.ts`  | Modified      | hook      | request-response | `apps/web/app/(app)/schedule/_components/use-schedule-week.ts`  | exact         | SC3/F09/ARCH-A1         |
| I54 | `apps/web/app/(app)/settings/_components/settings-screen.tsx`   | Modified      | component | request-response | `apps/web/app/(app)/settings/_components/settings-screen.tsx`   | exact         | SC5/F01/07/09           |
| I55 | `apps/web/app/(app)/settings/_components/assistant-card.tsx`    | New           | component | request-response | `apps/web/app/(app)/settings/_components/settings-screen.tsx`   | exact         | SC5/F01/07/09           |
| I56 | `apps/web/app/(app)/students/[id]/_components/notes-tab.tsx`    | Modified      | component | CRUD             | `apps/web/app/(app)/students/[id]/_components/notes-tab.tsx`    | exact         | SC3/4/F05/06/ARCH-A2    |
| I57 | `apps/web/app/(app)/schedule/_components/lesson-details.tsx`    | Conditional   | component | request-response | `apps/web/app/(app)/schedule/_components/lesson-details.tsx`    | exact         | SC3/4/F05/06            |
| I58 | `apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx`    | Modified      | component | event-driven     | `apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx`    | exact         | SC3/F05/ARCH-A3         |
| I59 | `apps/web/app/(app)/_components/today-mark-controls.tsx`        | Modified      | component | event-driven     | `apps/web/app/(app)/_components/today-mark-controls.tsx`        | exact         | SC3/F05/ARCH-A3         |
| I60 | `apps/web/app/(app)/schedule/_components/schedule-mutations.ts` | Modified      | utility   | request-response | `apps/web/app/(app)/schedule/_components/schedule-mutations.ts` | exact         | SC3/F05/ARCH-A3         |
| I61 | `apps/web/app/privacy/page.tsx`                                 | Modified      | route     | request-response | `apps/web/app/privacy/page.tsx`                                 | exact         | F08                     |
| I62 | `apps/api/package.json`                                         | Modified      | config    | batch            | `apps/api/package.json`                                         | exact         | SC5/F01                 |
| I63 | `yarn.lock`                                                     | Generated     | config    | batch            | —                                                               | none          | SC5/F01                 |
| I64 | `deploy/env.example`                                            | Conditional   | config    | transform        | `apps/api/src/config.ts`                                        | role-match    | SC5/F01/07              |
| I65 | `deploy/compose.yaml`                                           | Conditional   | config    | event-driven     | `apps/api/src/server.ts`                                        | role-match    | SC5/F01/07              |
| I66 | `e2e/chat.spec.ts`                                              | New           | test      | request-response | `e2e/marks.spec.ts`                                             | exact         | SC1–5/F10               |
| I67 | `e2e/marks.spec.ts`                                             | Modified      | test      | request-response | `e2e/marks.spec.ts`                                             | exact         | SC3/F05/10/ARCH-A3      |
| I68 | `e2e/move.spec.ts`                                              | Modified      | test      | request-response | `e2e/move.spec.ts`                                              | exact         | SC2/3/F04/05/10         |
| I69 | `e2e/today.spec.ts`                                             | Modified      | test      | request-response | `e2e/today.spec.ts`                                             | exact         | SC3/4/F06/09/10/ARCH-A1 |
| I70 | `e2e/calendar.spec.ts`                                          | Modified      | test      | request-response | `e2e/calendar.spec.ts`                                          | exact         | SC3/F05/08/10           |
| I71 | `e2e/support/chat.ts`                                           | Conditional   | test      | request-response | `e2e/support/test.ts`                                           | exact         | SC1–5/F10               |
| I72 | `AGENTS.md`                                                     | Parent        | config    | transform        | —                                                               | none          | F09/ARCH-A2/A3          |
| I73 | `Source10 outside Root (actor source; path not supplied)`       | RuntimeSource | utility   | request-response | —                                                               | none          | F10                     |

## Pattern Assignments

Каждая строка Ixx имеет public/cross-module symbol или явно PROPOSED producer. Delta задаёт planner необходимую работу, не проектирует второй Registry. Ссылка Pattern ведёт к конкретным excerpts/владельцам ниже. Новые функции не считаются существующим source.

| ID / file                                                           | Current symbol / PROPOSED producer                                              | Required delta                                                                                                | Pattern                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------- |
| I01 `packages/contracts/src/chat.ts`                                | `PROPOSED ChatConversation/ChatTurn/MentionBinding/ToolOutcome/UndoReceipt`     | Strict schemas; application identity and finite limits; no copied wire declarations                           | [registry](#registry)       |
| I02 `packages/contracts/src/chat-events.ts`                         | `PROPOSED ChatEvent`                                                            | Single Registry defines replay/event validation; no existing SSE schema                                       | [registry](#registry)       |
| I03 `packages/contracts/src/chat-settings.ts`                       | `PROPOSED ModelCapability/BudgetSnapshot`                                       | Configured capability/cap/profile; no fabricated numeric defaults                                             | [registry](#registry)       |
| I04 `packages/contracts/src/index.ts`                               | `Existing export *`                                                             | Export Registry from one owner                                                                                | [registry](#registry)       |
| I05 `packages/contracts/src/schedule.ts`                            | `markLessonRequest/ScheduleMark/ScheduleBlock`                                  | Add revision preconditions and validated read revision; preserve startsAt and eligibility                     | [registry](#registry)       |
| I06 `packages/contracts/src/students.ts`                            | `saveSectionRequest/StudentSection`                                             | Keep base section and append entries distinct; expected revision; entry DTOs                                  | [registry](#registry)       |
| I07 `packages/contracts/src/settings.ts`                            | `updateSettingsRequest/TeacherSettings`                                         | Model/effort/cap preferences through sole Registry                                                            | [registry](#registry)       |
| I08 `packages/db/src/chat-schema.ts`                                | `PROPOSED chat tables + entry tables`                                           | Additive identities/unique constraints/account ownership; do not mechanically split by line count             | [schema](#schema)           |
| I09 `packages/db/src/schema.ts`                                     | `studentSections/lessonMarks/teacherSettings`                                   | Revisions/settings and exports; mark revision travels with actual target identity                             | [schema](#schema)           |
| I10 `packages/db/src/index.ts`                                      | `export *`                                                                      | Revisions/settings and exports; mark revision travels with actual target identity                             | [schema](#schema)           |
| I11 `packages/db/drizzle/<generated>/migration.sql`                 | `Generator output`                                                              | Generate only after final24/25 schema pin; no guessed sequence or handwritten edit                            | [schema](#schema)           |
| I12 `packages/db/drizzle/<generated>/snapshot.json`                 | `Generator output`                                                              | Same generated migration owner; no handwritten edit                                                           | [schema](#schema)           |
| I13 `apps/api/src/chat/conversations.ts`                            | `PROPOSED create/list/rename/deleteConversation`                                | Account-scoped optimistic revision; redaction refuses unresolved liability; no business cascade               | [durability](#durability)   |
| I14 `apps/api/src/chat/store.ts`                                    | `PROPOSED accept/readTurn`                                                      | Request identity+digest; durable lease/outcome; reload never redispatches                                     | [durability](#durability)   |
| I15 `apps/api/src/chat/events.ts`                                   | `PROPOSED readEvents(afterCursor)`                                              | Persist before publish; account cursor/high-water/replay dedupe; no existing durable SSE analog               | [stream](#stream)           |
| I16 `apps/api/src/chat/runs.ts`                                     | `PROPOSED run admission/continuation/cancel`                                    | Use existing queue ownership; no in-memory authoritative history; no automatic uncertain paid retry           | [durability](#durability)   |
| I17 `apps/api/src/chat/provider.ts`                                 | `PROPOSED streamAttempt`                                                        | Official SDK adapter; injected key; maxRetries 0; complete tool blocks; no SDK runtime analog                 | [provider](#provider)       |
| I18 `apps/api/src/chat/model-config.ts`                             | `PROPOSED resolveModelChoice`                                                   | Pure validated configured profiles; no second process.env owner                                               | [provider](#provider)       |
| I19 `apps/api/src/chat/budget.ts`                                   | `PROPOSED reserveAttempt(tx,period,attempt,bound)`                              | New account-period locked admission before each request; unknown liabilities retained                         | [budget](#budget)           |
| I20 `apps/api/src/chat/usage.ts`                                    | `PROPOSED settleAttempt(tx,attempt,usage)`                                      | Category-aware snapshots replace; unique final settlement; no spend analog                                    | [budget](#budget)           |
| I21 `apps/api/src/chat/tools.ts`                                    | `PROPOSED executeTool(context,call)`                                            | New allowlist dispatcher delegates to owners; every call gets durable result; model grants no authority       | [tools](#tools)             |
| I22 `apps/api/src/chat/lesson-target.ts`                            | `PROPOSED resolveLesson(context,binding,date)`                                  | New exact one-lesson resolution; captured account zone/now; preserve originalOn vs actual startsAt            | [facts](#facts)             |
| I23 `apps/api/src/chat/facts.ts`                                    | `PROPOSED readChatFacts`                                                        | Call cardFacts/readToday and core exports; constrain numeric publication; never copy selection/calculation    | [facts](#facts)             |
| I24 `apps/api/src/chat/undo.ts`                                     | `PROPOSED undoAction(context,actionId,revision)`                                | New receipt/current revision inverse; local effect+receipt transaction; final Calendar inverse via one writer | [undo](#undo)               |
| I25 `apps/api/src/chat/calendar.ts`                                 | `PROPOSED adapter filename; existing submit/read/resumeCalendarCommand`         | Bind final24/25 signatures before choosing exact path; no direct SQL/provider fallback                        | [calendar](#calendar)       |
| I26 `apps/api/src/routes/chat.ts`                                   | `PROPOSED teacher chat routes`                                                  | Use protected Hono route+Registry; SSE path uses same session/Origin/no-store policy                          | [http](#http)               |
| I27 `apps/api/src/app.ts`                                           | `createApp(deps: AppDeps); PROPOSED AppDeps.chat`                               | Inject route owner; import has no runtime side effect                                                         | [composition](#composition) |
| I28 `apps/api/src/config.ts`                                        | `loadConfig(env: NodeJS.ProcessEnv): ApiConfig`                                 | Only env reader; inject key/profile; fail closed missing paid configuration                                   | [composition](#composition) |
| I29 `apps/api/src/server.ts`                                        | `Current calendar composition; PROPOSED createChat binding`                     | Compose/start new store/worker/provider; resources before pg-pool shutdown                                    | [composition](#composition) |
| I30 `apps/api/src/lifecycle.ts`                                     | `Closable; Lifecycle.manage/shutdown`                                           | Register Chat resource through existing close contract; edit only if handle shape actually needs change       | [composition](#composition) |
| I31 `apps/api/src/cards/mentions.ts`                                | `PROPOSED searchMentionStudents`                                                | Literal displayName/id stable sort; six safe candidates; avoid all card facts per keystroke                   | [facts](#facts)             |
| I32 `apps/api/src/cards/notes.ts`                                   | `PROPOSED append/read/retractStudentNote`                                       | Own entry id/revision; separate from base Markdown; no genuine append inverse analog                          | [entries](#entries)         |
| I33 `apps/api/src/cards/sections.ts`                                | `saveSection(executor,studentId,kind,body)`                                     | Add base-section CAS; never re-save display concatenation of appended entries                                 | [entries](#entries)         |
| I34 `apps/api/src/routes/students.ts`                               | `studentRoutes; PUT section calls saveSection`                                  | Expose minimal search/entry read; pass base revision; retain session teacher guards                           | [http](#http)               |
| I35 `apps/api/src/schedule/marks.ts`                                | `markOccurrence/markLesson(Database,accountId,...,MarkInput,now)`               | PROPOSED executor writer plus transaction facade; row revision/target identity/effect+receipt atomic          | [marks](#marks)             |
| I36 `apps/api/src/schedule/comments.ts`                             | `PROPOSED append/read/retractLessonComment`                                     | Own entry identity/version and exact lesson reference; no whole-body rollback                                 | [entries](#entries)         |
| I37 `apps/api/src/routes/schedule.ts`                               | `scheduleRoutes; POST mark routes`                                              | Ordinary mark preconditions and comments read/write; retain history guards                                    | [http](#http)               |
| I38 `apps/api/src/schedule/series.ts`                               | `keepCutLessons; moveSeries/endSeries`                                          | Current direct insert at line 50: adapt revision/lineage; rebind final24 cut owner first                      | [marks](#marks)             |
| I39 `apps/api/src/schedule/rows.ts`                                 | `markOf; seriesMarksFrom; loadMarkRows`                                         | Expose revision through owned read/write seam; retain accounting/history logic                                | [marks](#marks)             |
| I40 `apps/api/src/settings/settings.ts`                             | `readTeacherSettings/saveTeacherSettings`                                       | Necessary F09 caller extension for configured model/effort/cap; keep existing time lock                       | [budget](#budget)           |
| I41 `apps/api/src/routes/settings.ts`                               | `settingsRoutes({db})`                                                          | Same authenticated settings owner persists proposed preferences; no second settings route                     | [http](#http)               |
| I42 `apps/web/app/(app)/chat/page.tsx`                              | `export default async function ChatPage()`                                      | Existing teacher placeholder becomes approved composition                                                     | [ui](#ui)                   |
| I43 `apps/web/app/(app)/chat/_components/chat-screen.tsx`           | `PROPOSED ChatScreen props`                                                     | Approved v40 composition; no new UI design                                                                    | [ui](#ui)                   |
| I44 `apps/web/app/(app)/chat/_components/conversation-list.tsx`     | `PROPOSED conversation list props`                                              | New history identity/CRUD states from checked UI; no force-fit unrelated list                                 | [ui](#ui)                   |
| I45 `apps/web/app/(app)/chat/_components/composer.tsx`              | `PROPOSED composer/binding props`                                               | New exact mention/IME/quick intent; selection never sends                                                     | [ui](#ui)                   |
| I46 `apps/web/app/(app)/chat/_components/messages.tsx`              | `PROPOSED persisted message props`                                              | New stream/result renderer; allow only specified safe text/known blocks                                       | [ui](#ui)                   |
| I47 `apps/web/app/(app)/chat/_components/model-controls.tsx`        | `PROPOSED capability/effort props`                                              | Approved v40 controls; no invented ranks/levels/availability                                                  | [ui](#ui)                   |
| I48 `apps/web/app/(app)/chat/_components/use-chat.ts`               | `PROPOSED typed controller/cursor/Send identity`                                | Owned transport+Registry; new durable controller; no raw fetch duplicate                                      | [stream](#stream)           |
| I49 `apps/web/lib/api-client.ts`                                    | `apiRequest<T>(method,path,body?); PROPOSED apiEventStream(path,cursor,signal)` | Preserve shared prefix/cookies/no-store/error; add abort/cursor/validated event parsing                       | [stream](#stream)           |
| I50 `apps/web/lib/data-changes.ts`                                  | `PROPOSED subscribeDataChanges(callback)`                                       | Extend existing reader registration; durable high-water; peers identity only then server reread               | [refresh](#refresh)         |
| I51 `apps/web/components/app/calendar-command-provider.tsx`         | `useCalendarRefresh(refresh,kind); controller.register`                         | Necessary A1 caller/owner bridge; preserve account checks and projection/window order                         | [refresh](#refresh)         |
| I52 `apps/web/app/(app)/_components/use-today.ts`                   | `useToday(minuteNow); reload`                                                   | Subscribe shared committed data changes; retain request counter/account guards                                | [refresh](#refresh)         |
| I53 `apps/web/app/(app)/schedule/_components/use-schedule-week.ts`  | `useScheduleWeek(); reload`                                                     | Same registered refresh; preserve query/revision stale guards                                                 | [refresh](#refresh)         |
| I54 `apps/web/app/(app)/settings/_components/settings-screen.tsx`   | `SettingsScreen({tab})`                                                         | Compose Assistant subset and shared settings persistence                                                      | [ui](#ui)                   |
| I55 `apps/web/app/(app)/settings/_components/assistant-card.tsx`    | `PROPOSED AssistantCard props`                                                  | Server values, usage attribution, unknown reserves distinct; no provider calls for reads                      | [ui](#ui)                   |
| I56 `apps/web/app/(app)/students/[id]/_components/notes-tab.tsx`    | `NotesTab({student,drafts,onDraftChange})`                                      | Separate base draft from displayed append entries; base CAS; render real note entries                         | [entries](#entries)         |
| I57 `apps/web/app/(app)/schedule/_components/lesson-details.tsx`    | `LessonDetails/LessonStatus; selected lesson detail owner`                      | Bind final lesson comment display owner through current dialog host; path is plural details                   | [ui](#ui)                   |
| I58 `apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx`    | `LessonDialogs(props); mark(kind)`                                              | Ordinary mark caller consumes validated target revision; retain server reread and selection guard             | [marks](#marks)             |
| I59 `apps/web/app/(app)/_components/today-mark-controls.tsx`        | `TodayMarkControls(props); save(kind)`                                          | Ordinary quick mark passes new revision via shared mark port; keep pending/stale behavior                     | [marks](#marks)             |
| I60 `apps/web/app/(app)/schedule/_components/schedule-mutations.ts` | `markLesson(block:{ref,startsAt},kind)`                                         | Add revision precondition to common mark request after producer; keep expectedStartsAt                        | [marks](#marks)             |
| I61 `apps/web/app/privacy/page.tsx`                                 | `PrivacyPage(); sections`                                                       | Actual local/Anthropic processing/redaction/liability; no guessed retention or backup erasure                 | [privacy](#privacy)         |
| I62 `apps/api/package.json`                                         | `Dependency manifest`                                                           | Future authorized exact SDK pin; candidate 0.133.0 not installed                                              | [provider](#provider)       |
| I63 `yarn.lock`                                                     | `Yarn generated resolution`                                                     | Future authorized install only; age gate 1440 remains                                                         | [provider](#provider)       |
| I64 `deploy/env.example`                                            | `PROPOSED config variable names`                                                | Names only, never secrets; runtime injection is separate authority                                            | [composition](#composition) |
| I65 `deploy/compose.yaml`                                           | `PROPOSED API secret/config injection`                                          | Bind config owner under authorized future deploy plan; no runtime change now                                  | [composition](#composition) |
| I66 `e2e/chat.spec.ts`                                              | `PROPOSED durable Chat journey`                                                 | Write failure/outcome scenarios before behavior in existing harness; no existing chat spec                    | [e2e](#e2e)                 |
| I67 `e2e/marks.spec.ts`                                             | `Existing dialog corrections/Today quick marks/history tests`                   | Extend public ABA/same-kind/cut identity proof, real persistence                                              | [e2e](#e2e)                 |
| I68 `e2e/move.spec.ts`                                              | `Existing single changes/lost PATCH recovery journeys`                          | Extend exact chat target/inverse through real final Calendar writer                                           | [e2e](#e2e)                 |
| I69 `e2e/today.spec.ts`                                             | `Existing Pays soon/Earlier journeys`                                           | Two open screens reread matching code facts without manual reload                                             | [e2e](#e2e)                 |
| I70 `e2e/calendar.spec.ts`                                          | `Existing ownership/recovery/policy journeys`                                   | No fake ACK/410; real confirmation/recovery/Google wins and privacy assertions                                | [e2e](#e2e)                 |
| I71 `e2e/support/chat.ts`                                           | `PROPOSED necessary durable Chat support`                                       | Only if existing harness cannot express journey; synthetic adapter verifies application semantics only        | [e2e](#e2e)                 |
| I72 `AGENTS.md`                                                     | `PROPOSED owner notes, if Parent needs durable ownership update`                | Parent alone; no duplicated wire fields/schema instructions; mapper does not write                            | [ownership](#ownership)     |
| I73 `Source10 outside Root (actor source; path not supplied)`       | `External runtime authority basis, not a source analog`                         | No read/write/launch; Parent binds exact path/evidence before future application run                          | [ownership](#ownership)     |

### registry

**Источник:** `packages/contracts/src/settings.ts`:1–3,10–24. Zod + локальные `.ts` imports, строгий input и вывод типа из schema. Barrel: `packages/contracts/src/index.ts`:1–8. Для chat/chat-events/chat-settings переносить стиль, а wire definition создать один раз здесь. Tool/SDK/public event parser обращаются к этому Registry.

**Imports excerpt (1–3):**

```ts
import { z } from 'zod'

import { TIME_ZONE_MAX_LENGTH, isTimeZone } from './students.ts'
```

**Strict validation/type excerpt (15–24):**

```ts
	})
	.strict()
	.refine((input) => input.paysSoonLessons !== undefined || input.defaultTimeZone !== undefined)
	.refine((input) =>
		input.defaultTimeZone === undefined
			? input.expectedDefaultTimeZone === undefined
			: input.expectedDefaultTimeZone !== undefined
	)

export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequest>
```

Current mark input, `packages/contracts/src/schedule.ts`:53–56:

```ts
export const markLessonRequest = z.object({
	kind: z.enum(MARK_KINDS),
	expectedStartsAt,
})
```

Current section input, `packages/contracts/src/students.ts`:106–108:

```ts
export const saveSectionRequest = z.object({
	body: z.string().refine((body) => textLength(body) <= SECTION_BODY_MAX_LENGTH),
})
```

Delta: expectedRevision/entry DTO/event schemas ещё отсутствуют. Приведённые mark/section inputs не доказывают CAS. Не объявлять generic notes section существующим.

### schema

**Источник:** `packages/db/src/calendar-schema.ts`:1–26,28–34 — отдельный семантический schema owner, Drizzle pg-core, account FK restrict, типы values отдельно. `packages/db/src/schema.ts`:137–154,293–325 — настоящие section/mark/settings rows; revision пока отсутствует.

**Account identity excerpt, calendar-schema.ts:28–34:**

```ts
export const googleConnections = pgTable(
	'google_connections',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
```

**Mark identity/constraints excerpt, schema.ts:304–312:**

```ts
;(table) => [
	uniqueIndex('lesson_marks_occurrence_uq').on(table.seriesId, table.originalOn),
	uniqueIndex('lesson_marks_lesson_uq').on(table.lessonId),
	check('lesson_marks_kind_ck', sql`${table.kind} in ('done', 'no_show', 'none')`),
	check(
		'lesson_marks_ref_ck',
		sql`(${table.seriesId} is null) = (${table.originalOn} is null) and (${table.seriesId} is null) <> (${table.lessonId} is null)`
	),
]
```

Apply additive R22 table inventory: conversation/turn/message/mention/event/action identities, account-period budget, usage attempts, notes/comments own entries. New table names/invariants остаются proposed; поля здесь повторно не определяются. Schema/Registry имеют одного владельца. `packages/db/src/index.ts`:1–7 — обычные exports. Миграции создаёт `yarn db:generate` только в будущей разрешённой задаче; название/порядковый номер rebound после24/25. Рукописный source <500 — ограничение implementation; scalar exports не основание механически разбивать модуль или исключать executable code.

### durability

**Источник:** `apps/api/src/calendar/journal.ts`:119–174 — scoped identity/hash/read outcome; `calendar/worker.ts`:1–35,135–158 — pg-boss lifecycle. Это partial domain pattern, не готовый Chat store, budget или replay.

**Digest/validated input excerpt, journal.ts:119–125:**

```ts
export function digest(value: string): string {
	return createHash('sha256').update(value).digest('hex')
}

export function commandHash(input: ValidatedCalendarCommand): string {
	return digest(JSON.stringify(validatedCalendarCommand.parse(input)))
}
```

**Identity lookup excerpt, journal.ts:147–153:**

```ts
export async function findRequest(executor: DbExecutor, accountId: string, requestId: string) {
	const [command] = await executor
		.select()
		.from(googleCommands)
		.where(and(eq(googleCommands.accountId, accountId), eq(googleCommands.requestId, requestId)))
	return command
}
```

**Immutable retry excerpt, journal.ts:172–175:**

```ts
export function matchingReceipt(command: CommandRow, input: ValidatedCalendarCommand) {
	if (command.inputHash !== commandHash(input)) throw new CommandFault('precondition_failed')
	return receipt(command)
}
```

Worker current imports `PgBoss`, `Logger`, Zod и injected Database; jobData strict UUID, active Map и AbortController не canonical history. Переносить startup/close через композицию, не создавать новый queue service/environment. Новые Chat lease/event/result/usage persistence нужны независимо от in-memory sets. Reload читает оригинальный turn/action. SQL transaction не охватывает provider HTTP; unknown dispatch не разрешает повтор.

### stream

**Основной аналог 1:** `apps/web/lib/api-client.ts`:1–35. Это JSON-only transport: текущая сигнатура
`apiRequest<T>(method: ApiMethod, path: string, body?: unknown): Promise<ApiResult<T>>`.
ApiMethod = GET|POST|PUT|PATCH|DELETE. Переносить prefix/cookie/no-store/error policy в расширение того же владельца.

**Request/error excerpt (9–24):**

```ts
	let response: Response
	try {
		response = await fetch(`/api${path}`, {
			method,
			credentials: 'same-origin',
			cache: 'no-store',
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
		})
	} catch {
		return { ok: false, status: 0, error: null }
	}
	if (response.status === 204) return { ok: true, status: 204, data: undefined as T }
	if (response.ok) {
		try {
			return { ok: true, status: response.status, data: (await response.json()) as T }
```

**Validated caller excerpt:** `apps/web/components/app/calendar-command-transport.ts`:35–38:

```ts
const result = await apiRequest<unknown>('GET', path)
if (!result.ok) return { kind: result.status === 404 ? 'missing' : 'unavailable' }
const parsed = calendarCommandSnapshot.safeParse(result.data)
return parsed.success ? { kind: 'ready', command: parsed.data } : { kind: 'unavailable' }
```

ARCH-A1 producer: PROPOSED apiEventStream(path,cursor,signal) в api-client, с abort/cursor/framing/Registry validation/error semantics. У SSE persistence/replay/parser нет готового аналога; JSON cast не валидирует event. Chat hook вызывает owned seam, не копирует fetch policy. Complete validated events published after persistence; snapshot high-water + stable identity dedupe. GET/reconnect/reload не вызывает generation/tool. Abort не доказывает rollback/no charge. Safe narrative validation до публикации, не raw token pass-through.

### refresh

**Основной аналог 2:** `apps/web/components/app/calendar-command-provider.tsx`:13–52,96–99. Current registered readers grouped projection/window; account identity и current guards стоят вокруг server reread (16–20). Это существующая registration, не generic durable event bus.

**Register excerpt (39–45):**

```ts
		register(refresh: Reader['refresh'], kind: RefreshKind) {
			const reader = { refresh, kind }
			readers.add(reader)
			return () => {
				readers.delete(reader)
			}
		},
```

**Hook excerpt (96–99):**

```ts
export function useCalendarRefresh(refresh: () => Promise<void>, kind: RefreshKind = 'projection') {
	const controller = useCalendarController()
	useEffect(() => controller.register(refresh, kind), [controller, refresh, kind])
}
```

**Today stale-response excerpt:** `apps/web/app/(app)/_components/use-today.ts`:27–30:

```ts
	const reload = useCallback(async () => {
		const id = ++requests.current
		const result = await apiRequest<TodayResponse>('GET', '/today')
		if (id !== requests.current) return
```

Today calls useCalendarRefresh(reload):42; Schedule uses useCalendarRefresh(refresh,'window'):135 and own read revision guard:63–64. A1 producer extends existing registration and exposes proposed subscribeDataChanges; after local commit/verified Calendar applied durable invalidation triggers these readers. Peer channels carry identity only. Focus/reconnect high-water catches missed notification. Preserve account/current/query/order guards; router.refresh alone insufficient. If final25 already owns this publication, adapt it instead of creating another bus.

### entries

**Основной аналог 3:** `apps/api/src/cards/sections.ts`:1–63. Imports Drizzle eq/sql, contracts SectionKind/StudentSection, db DbExecutor/studentSections/students. Current signature, 32–37:
`saveSection(executor: DbExecutor, studentId: string, kind: SectionKind, body: string): Promise<StudentSection | null>`.

**Full replacement excerpt (38–48):**

```ts
if (!(await cardExists(executor, studentId))) return null
const [row] = await executor
	.insert(studentSections)
	.values({ studentId, kind, body })
	.onConflictDoUpdate({
		target: [studentSections.studentId, studentSections.kind],
		set: { body, updatedAt: sql`now()` },
	})
	.returning(sectionColumns)
if (!row) throw new Error('student section upsert returned no row')
return { kind, body: row.body, updatedAt: row.updatedAt.toISOString() }
```

**Ordinary editor excerpt:** `apps/web/app/(app)/students/[id]/_components/notes-tab.tsx`:104–106:

```ts
const result = await apiRequest<StudentSectionResponse>('PUT', `/students/${student.id}/sections/${section.kind}`, {
	body: draft,
})
```

startEdit copies section.body (82–84); render uses MarkdownView body (164–166); `routes/students.ts`:235–239 validates and calls saveSection. Current section key student/kind does not identify append entry.

ARCH-A2 producer: business-owned append/read/retractStudentNote and append/read/retractLessonComment, own entry identity/revision. Base section gets CAS, ordinary editor reads/saves only base body; appended entries rendered separately and never resaved into Markdown. Undo A preserves distinct B and ordinary base edit S′; equal text entries still distinct; same-entry edit refuses stale inverse. Do not use text search/snapshot rollback/general_info as notes store. Sections is same-role pattern for DB executor/validation/result, not a full append/Undo analog. Necessary producer→callers: schema + Registry → cards/notes/schedule/comments/sections → students/schedule routes → notes-tab/current lesson detail → chat tools/undo/E07.

### marks

**Основной аналог 4:** `apps/api/src/schedule/marks.ts`:1–104. Current signatures:
`markOccurrence(db: Database, accountId: string, seriesId: string, originalOn: string, input: MarkInput, now: Date): Promise<MarkResult>` (45–52);
`markLesson(db: Database, accountId: string, id: string, input: MarkInput, now: Date): Promise<MarkResult>` (78–84).
MarkInput = z.output<typeof markLessonRequest>; MarkResult = ok ScheduleMark | ChangeFailure (20–22).

**Imports/core owner excerpt (9–18):**

```ts
	countsAsLesson,
	lessonActions,
	occurrenceOutcome,
	occurrenceKey,
} from '@dv-lab/core'
import { type Database, lessonMarks } from '@dv-lab/db'

import { historyEligibility, lockHistoryConnection } from '../calendar/history.ts'
import { type ChangeFailure, lockOccurrence, stale } from './changes.ts'
import { lockLesson, markOf, toMarkKind, toWireMark, toWireOutcome } from './rows.ts'
```

**Eligibility/locking excerpt (85–95):**

```ts
	return db.transaction(async (tx): Promise<MarkResult> => {
		await lockHistoryConnection(tx, accountId)
		const lesson = await lockLesson(tx, id)
		if (lesson === null) return NOT_FOUND
		const ref: OccurrenceRef = { kind: 'single', lessonId: id }
		const mark = await markOf(tx, ref)
		const eligible = await historyEligibility(tx, accountId, [{ ...lesson, ref, mark }])
		if (!eligible.has(occurrenceKey(ref))) return CHANGED
		const current = occurrenceOutcome(lesson, mark)
		const refused = markRefusal(current, lesson.startsAt, input.expectedStartsAt, now)
		if (refused !== null) return refused
```

Current upsert only kind/updatedAt (96–102); it does NOT prove revision. `rows.ts`:286–296 markOf selects kind only; seriesMarksFrom (240–252) returns Map<string,MarkKind>. `series.ts`:49–50:

```ts
const mark = marks.get(lesson.originalOn)
if (mark !== undefined) await executor.insert(lessonMarks).values({ lessonId: row.id, kind: mark })
```

ARCH-A3 producer: one mark row revision, executor-based write inside local effect+receipt transaction, ordinary transaction facade keeps same history/temporal guards. All writers increment, including same-kind writes and final24 cut/end copy/remap. Revision binds actual target identity; old receipt never transfers because kind matches. Absent mark requires locked lesson/occurrence before unique insert. No timestamp equality or Calendar revision substitute.

Necessary caller chain: schema/Registry + marks/rows → routes/schedule → web schedule-mutations markLesson → TodayMarkControls and LessonDialogs → chat tools/undo. Current common web signature: markLesson(block:{ref:ScheduleOccurrenceRef;startsAt:string},kind:LessonMarkKind):Promise<MutationResult<ScheduleMarkResponse>> (190–194). It sends kind/expectedStartsAt, not revision. Callers: today-mark-controls.tsx:44–57 and lesson-dialogs.tsx:76–80 preserve pending/stale/reload. Final24/25 may move cut/end writer; first rebind replaces conditional series target and identifies every actual writer.

### facts

Current owners, reuse directly rather than copy calculations:

- `cards/card-facts.ts`:50–54: cardFacts(executor:DbExecutor,cards:readonly FactSource[],context:CardReadContext):Promise<Map<string,CardFacts>>. CardFacts = balanceMinutes:number|null + nextLesson:NextLessonRead (13); CardReadContext = TeacherTimeContext & CalendarReadContext (14).
- `today/today.ts`:39–43: readToday(executor:DbExecutor,context:CardReadContext,paysSoonLessons:number):Promise<TodayResponse>.
- `settings/settings.ts`:7,15–20,23–37 owns captured now/defaultTimeZone and account lock; pure core owns arithmetic/zones/eligibility.

**Reuse excerpt, card-facts.ts:55–60:**

```ts
const balances = await cardBalances(executor, cards, context.defaultTimeZone)
const next = await readNextLessons(
	executor,
	context,
	cards.map((card) => card.id)
)
```

**Stable sort excerpt for mention search only, cards/cards.ts:82–86:**

```ts
const rows = await executor
	.select(cardColumns)
	.from(students)
	.orderBy(sql`lower(${students.displayName})`, students.id)
const facts = await cardFacts(executor, rows, context)
```

New minimal mentions query reuses sort/identity but not listCards/full card facts per keystroke. Six safe choices from R22P3; duplicate names require selection. New lesson-target has no full analog: exact current lesson/occurrence + account zone + captured now, omission only one eligible candidate; zero/many/missing time/DST ambiguous → clarification, zero write. Was→done, No-show→no_show with stored policy, Didn't happen→Calendar cancel, Moved→one occurrence. ReadChatFacts composes owner results/selected stored entries/history and code counts. Source/asOf/coverage/stale/errors explicit; no second filtering/ledger/series expansion. Numeric slots and narrative validation from AI-SPEC, not LLM arithmetic or regex-only validation.

### tools

No complete existing model-tool dispatcher analog. PROPOSED executeTool producer validates shared Registry, obtains session/account from server, resolves exact mention/lesson, delegates local business or confirmed Calendar owner. Persist each complete call identity/result/error/clarification/pending. Partial JSON/model approval/stored text never authorizes write. Allowlist scope from R22P4; Phase23/26/built-in files/bash/MCP/server tools excluded. Unknown inputs stay unknown only until validated. Producer depends on marks/entries/facts/Calendar, not a new engine.

### undo

No complete versioned Chat inverse analog. PROPOSED undoAction reads original persisted action/receipt, checks current target identity/revision and authority, commits inverse + receipt as one local transaction. Mark undo creates a new revision without deleting row; entry undo retracts its own unchanged entry. Calendar inverse is a fresh owner command against unchanged final provider target/generation/version; read pending original journal until known. All later separate entries/ordinary edits remain. E06/E07 + existing mark/cut journeys prove refusal and one effect. No second revision table/cache epoch.

### calendar

Current tracked owner `apps/api/src/calendar/commands.ts`:33–36,130–138:

- submitCalendarCommand(context:CalendarReadContext,input:ValidatedCalendarCommand):Promise<CalendarCommandReceipt>.
- readCalendarCommand(context:CalendarReadContext,commandId:string):Promise<CalendarCommandSnapshot>.
- resumeCalendarCommand(context:CalendarReadContext,commandId:string):Promise<CalendarCommandReceipt>.

**Current admission excerpt (47–53):**

```ts
const repeated = await findRequest(access.db, context.accountId, input.input.requestId)
if (repeated) return matchingReceipt(repeated, input)
if ((await unresolvedCommands(access.db, context.accountId)).length) throw new CommandFault('command_pending')
if (input.operation === 'move' || input.operation === 'cancel' || input.operation === 'restore')
	return await admitSingle(access, context, input)
if (input.operation !== 'create') throw new CommandFault('history_only')
```

This current source supersedes RESEARCH's older create-once restriction. New observation is not final24 acceptance. Resume allows partial_recovery/recovery_required only (135–138). Read owner `calendar/reads.ts`:14–48 injects credentials/gateway and persists read projection. Receipt is accepted identity, not Saved/applied proof.

Conditional `chat/calendar.ts` is a proposed adapter path, not a published symbol. Parent first binds final24/25 command/inverse/authoritative projection/admission/cut/remap/publication exports and fingerprints.25-PLAN-INDEX execution gate remains dependency input, not source proof: shared resolver/admission and canonical Google instance are PROPOSED. Do not handwrite its wire definitions or edit25 plans. No copied marker, guessed stable mapping, direct SQL, fake ACK/410 or local fallback. Actual Google wins and inverse verification stay with final owner.

### provider

No existing Anthropic runtime/stream adapter analog. `apps/api/package.json`:14–27 has Hono/pg-boss/Drizzle/pino/Zod; Anthropic absent. Candidate exact SDK pin0.133.0 from accepted research is NOT installed. Preserve official SDK choice; no repeat model/pricing/provider research. Future authorized dependency task verifies provenance/age1440/compatibility, supplies generated yarn.lock; mapper does not install. Provider injection belongs loadConfig/server; model-config interprets validated profiles rather than reads process.env.

AI-SPEC SDK skeleton is proposed, not existing source excerpt. maxRetries0 prevents unadmitted paid retry; each tool continuation gets fresh budget reservation. Actual key/cap/account model/credits/SDK spike NOT RUN. No fabricated amounts, per-message price/rank, universal level entitlement or safe bound multiplier.

### budget

No existing hard monthly model spend ledger analog. `settings/settings.ts`:23–37 offers only account-lock technique; it is not budget implementation.

**Account lock excerpt (29–31):**

```ts
const [account] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).for('update')
if (!account) throw new Error('Teacher account missing while locking settings')
const settings = await readTeacherSettings(tx, accountId)
```

PROPOSED budget/usage producers from R22P9: finite actual cap/profile/model, unique attempt and original period, worst-case reservation before every dispatch, account-period serialization, category-aware snapshots replace, final settle once. Unknown possibly-dispatched usage retains reservation and closes admission; no timeout release. Monthly cap differs from API credits; remaining estimate differs from guaranteed admission. Current read/saveTeacherSettings signatures serve preferences, not pricing. Necessary F09 implementation also includes existing settings/settings.ts and routes/settings.ts to persist Registry preferences.

### composition

Current `app.ts`:26–38 AppDeps injects db/logger/signIn/calendar owners; createApp(deps) is composition without launch. `config.ts`:54–57:

```ts
export function loadConfig(env: NodeJS.ProcessEnv): ApiConfig {
	const parsed = schema.safeParse(env)
	if (!parsed.success) throw new Error(`Invalid environment\n${z.prettifyError(parsed.error)}`)
	return { ...parsed.data, databaseUrl: resolveDatabaseUrl('app', env), calendar: loadCalendarConfig(env) }
}
```

Apply injected chat/model/key config once, no browser/contract/env duplication; do not copy env error details into chat logs. `server.ts`:60–85 owns worker+commands composition/start and AppDeps injection. `lifecycle.ts`:3 Closable = {name:string;close:()=>Promise<void>}; managed resources closes each before pool; `server.ts`:105–109 already supplies resources. A new Closable normally needs only server registration; lifecycle.ts conditional unless actual handles change. deploy names-only examples/secret injection future owner, not authorization for rollout/env reads.

### http

**Source excerpt:** `apps/api/src/routes/settings.ts`:1–9:

```ts
import type { Context } from 'hono'
import { Hono } from 'hono'

import { type SettingsResponse, updateSettingsRequest } from '@dv-lab/contracts'
import { type Database, readSnapshot } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { errorBody } from '../request-context.ts'
import { readTeacherSettings, saveTeacherSettings } from '../settings/settings.ts'
```

**Guard/read excerpt (15–22):**

```ts
export function settingsRoutes({ db }: SettingsRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/', async (c) => {
		const accountId = c.get('session').account.id
		const settings = await readSnapshot(db, (executor) => readTeacherSettings(executor, accountId))
		return c.json({ settings } satisfies SettingsResponse, 200)
```

Chat HTTP uses same guards, routes without /api prefix, actor from session. Validation from middleware/readJson; mutation Origin from app sameOrigin. New SSE route shares no-store/auth policy, rechecks tools/recovery authority; long stream/error/privacy cannot rely only on initial student selection. Concrete shared excerpts below.

### ui

Current teacher placeholder, `apps/web/app/(app)/chat/page.tsx`:1–10:

```tsx
import type { Metadata } from 'next'

import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { requireTeacherPage } from '@/lib/session'

export const metadata: Metadata = { title: 'Chat' }

export default async function ChatPage() {
	await requireTeacherPage()
```

Apply teacher server guard, alias imports and existing layout; mount approved v40 Chat screen. Existing SettingsScreen({tab}:{tab:string|undefined}):354 uses existing state/slots; AssistantCard new model/budget subset. `lesson-details.tsx`:1–14 imports UI/app owners/contracts/core; `lesson-dialogs.tsx`:49–65 binds local/provider dialog to current selected snapshot. Exact comment display composition rebound there before execution; singular lesson-detail.tsx does NOT exist.

New conversation/composer/messages/model-controls/use-chat have no genuine Chat domain analog; checked22-UI-SPEC is source of composition/states, external design is not TRACKED code. Do not pretend mock previews are implemented sources. No new UI audit/interface design here. Existing component paths in excerpts define import conventions; reuse Base UI/v40, English text, no eyebrows/Radix/cmdk.

Native checked UI inventory: 8 surfaces / 61 explicit predicates / 0 unresolved / 0 unclassified. Source rows295–363 are must_haves for planner. All 61 retained by references, not recopied into wire instructions.

| Surface     | Predicates | Planned producer/consumer                           | Public proof            |
| ----------- | ---------: | --------------------------------------------------- | ----------------------- |
| HISTORY     |          8 | conversations/store + conversation-list/chat-screen | E01/E09/E13             |
| COMPOSER    |          5 | composer/use-chat + admission                       | E01/E02/E05/E09/E13     |
| MENTION     |          8 | Registry/cards mentions/composer                    | E02/E14/E13             |
| TARGET      |          8 | lesson-target/tools + exact choices                 | E03/E05/E06/E14/E13     |
| RESULT      |          8 | action/undo/Calendar owner + messages               | E03/E04/E06/E07/E09/E13 |
| ANSWERS     |          8 | facts + validated messages slots                    | E08/E09/E14/E13         |
| MODELS      |          8 | config/provider/controls                            | E11/E12/E13             |
| PREFERENCES |          8 | settings/budget/usage + assistant-card              | E10/E11/E12/E13         |

### privacy

Tracked owner recovered: `apps/web/app/privacy/page.tsx`:5–58 sections,60–98 renderer. Existing statement local records at31–32 is Calendar-specific; Chat must describe actual Anthropic request processing plus app persistence/redaction/retained liabilities without claiming provider/backups immediate erasure. Current renderer maps text, not raw HTML; preserve layout and English copy. Final24/25 privacy changes must be rebound; no generic new policy page.

### e2e

**Основной аналог 5:** `e2e/marks.spec.ts`:1–20,98–150,354–392. Existing public interface→real API/persistence→cross-screen assertions. Same harness, one worker, light/dark, retries0 in playwright.config.ts:10–43. `e2e/chat.spec.ts` absent: NEW durable journey written before behavior, not a claimed existing file.

**Imports excerpt, marks.spec.ts:3–6:**

```ts
import { calendarHistoryMarks } from './support/calendar-history.ts'
import { BASE, cleanupFixtures } from './support/data.ts'
import { addDays, mondayOf, startedSlotToday, VN, vnToday } from './support/dates.ts'
import { expect, test, type Fx } from './support/test.ts'
```

**One real request excerpt, marks.spec.ts:132–140:**

```ts
	try {
		await start()
		await started
		await blocked()
		expect(posts).toBe(1)
		release()
		expect((await response).status()).toBe(200)
		await settled()
		expect(posts).toBe(1)
```

Route handler:119–124 delays and route.continue(), does not fabricate success. Support/test.ts:23–39 creates card through public API and validates identity; current target/persistence/fixture lease remains authority. New support/chat.ts only when necessary; no new test layer/environment. `calendar-fault-control.ts`:21–33 checks private HTTPS control/runtimeRoot/origin/buildSha/persistence fingerprint; synthetic model adapter remains PROPOSED and limited to authorized synthetic application semantics. It cannot prove actual SDK/model/pricing/quality. Google tests require real owner path; no fake ACK/410.

Existing exact reusable journey anchors:

- marks.spec.ts:354 “dialog corrections recompute the balance everywhere”;394 Today quick marks;436 stale/moved past;443 cut/end lineage.
- move.spec.ts:57 conditional ACK/identity;84 lost PATCH recovery;102 delayed ACK;269 marked started lesson.
- today.spec.ts:324 Pays soon;384 Earlier;38–46 current Calendar facts/unavailable UI.
- calendar.spec.ts:22 retained fixture ownership;48/59 recovery authority;294 public policies.

Future commands only, NOT RUN: `yarn test:e2e e2e/chat.spec.ts --project=light --project=dark`; shared owners: `yarn test:e2e e2e/marks.spec.ts e2e/move.spec.ts e2e/today.spec.ts e2e/calendar.spec.ts --project=light --project=dark`. Planner binds exact title filters and current lease rather than launching whole suites. Each future run records code/diff fingerprint, scenario/fixture, expected/observed, target/persistence, original exit and rerun; no secrets/user content. E2E failure modes precede behavior; no unit/component/contract/integration tests.

### ownership

Parent-only AGENTS ownership note is conditional durable instruction work, not implementation code or mapper write. Do not duplicate machine-owned protocol/wire definitions. Source10 outside Root has no supplied inspectable path: RuntimeSource evidence limitation, never guessed analog or fabricated tracked path. Parent binds current runtime authority separately; this document cannot claim final24/25 passed.

## Shared Patterns

### Authentication and validation

Apply HTTP routes, tool execution and recovery. `apps/api/src/auth/middleware.ts`:75–90 session/role,92–103 input parser. app.ts:58–59 installs requestContext/sameOrigin. Account id from c.get('session').account.id, never model input.

**Validation excerpt (92–103):**

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

### Error, logs and response

Apply routes/services/provider adapter through existing request-context, not new logging envelope. `apps/api/src/request-context.ts`:77–79:

```ts
export const errorBody = (code: ErrorCode, message: string, extra?: { retryAfterSeconds?: number }) => ({
	error: { code, message, requestId: currentRequestId(), ...extra },
})
```

app.ts:102–109 owns centralized error handler. Chat errors/logs need safe run/attempt/result metadata only, no prompts/student text/provider raw errors/secrets. Current Calendar log sanitation is not automatic proof of Chat sanitation.

### Transaction and consistent reads

`packages/db/src/connection.ts`:28–35:

```ts
export type Database = Omit<ReturnType<typeof createDb>['db'], '$client'>

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export type DbExecutor = Database | Transaction

export function readSnapshot<T>(db: Database, read: (executor: DbExecutor) => Promise<T>): Promise<T> {
	return db.transaction((tx) => read(tx), { isolationLevel: 'repeatable read', accessMode: 'read only' })
}
```

Local effect+receipt takes one DbExecutor transaction; facts reads use existing snapshot. Provider I/O outside tx. Shared database URL/env/roles remain existing owners. No second accounting engine.

## SC / F / ARCH Coverage

| Criterion | Pattern producers → consumers                                                  | Minimum future evidence                                                           |
| --------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| SC1       | registry/schema/durability/stream → conversations/use-chat/history             | E01/E09: durable CRUD + reconnect/reload, no generation/effect replay             |
| SC2       | mentions + lesson-target/tools/final calendar → composer/target                | E02/E05: exact selected identity, single target, zero ambiguous write             |
| SC3       | entries/marks/undo/refresh/final calendar → ordinary + Chat screens            | E03/E04/E06/E07: actual effect, safe inverse, open screens reread                 |
| SC4       | existing cardFacts/readToday/core → facts/validated messages                   | E08/E14: same code facts, injection/invalid numbers withheld                      |
| SC5       | config/provider/budget/usage/settings → model-controls/assistant-card          | E10–E12: concurrent admission and continuation cap, held unknown reserve          |
| F01       | registry/provider/config → model controls                                      | E11/E12; actual SDK/account spike remains NOT RUN                                 |
| F02       | store/events/runs/api-client → use-chat                                        | E01/E06/E09: interruption, original outcome, cursor dedupe                        |
| F03       | strict Registry/HTTP/cards mentions → conversation/composer                    | E01/E02/E14: teacher scope, exact IDs, finite validation                          |
| F04       | lesson-target/settings/core/final Calendar                                     | E03/E05: exact natural reference/date/zone, clarify zero/many                     |
| F05       | entries/marks/receipt/undo/final Calendar                                      | E03–E07: one matching result, late edit refusal, real verified inverse            |
| F06       | facts owner reuse + validated narrative slots                                  | E08/E14: code totals/source/asOf/coverage, honest read failure                    |
| F07       | budget period + attempt pricing/usage + settings                               | E10/E11: no overspend race, no fabricated cap/credit/charge                       |
| F08       | conversations redaction/control + privacy                                      | E01/E07/E09: pending deletion refusal; liabilities/business retained              |
| F09       | exact I01–I73 inventory + checked v40 UI predicates                            | E03/E13: existing refresh bridge, narrow/focus/IME/themes                         |
| F10       | existing Playwright/fixtures + NEW durable Chat journey                        | E01–E14, matched fixture/target/version/status evidence                           |
| ARCH-A1   | api-client owned SSE + existing refresh registration → use-chat/Today/Schedule | E09/E03: interrupted/reloaded stream, expired session/lost notification/no replay |
| ARCH-A2   | cards/schedule append entry owner + base-section editor separation             | E07: A/B/Undo A, base edit, equal text identities, same-entry refusal             |
| ARCH-A3   | mark row revision/executor transaction + all ordinary/cut/remap writers        | E06 + marks/cut: ABA, same-kind edit, stale inverse after identity change         |

## No Analog Found

None не заменяется mock или SDK skeleton как “реальным source”. Roles/flows указаны в File Classification; normative proposed behavior — R22P1–P9/AI-SPEC/checked UI. Ни одно none не считается implemented.

| ID / target                                                     | Reason                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| I11 `packages/db/drizzle/<generated>/migration.sql`             | Generated output, не рукописный source analog                                                                 |
| I12 `packages/db/drizzle/<generated>/snapshot.json`             | Generated output, не рукописный source analog                                                                 |
| I15 `apps/api/src/chat/events.ts`                               | Persist before publish; account cursor/high-water/replay dedupe; no existing durable SSE analog               |
| I17 `apps/api/src/chat/provider.ts`                             | Official SDK adapter; injected key; maxRetries 0; complete tool blocks; no SDK runtime analog                 |
| I19 `apps/api/src/chat/budget.ts`                               | New account-period locked admission before each request; unknown liabilities retained                         |
| I20 `apps/api/src/chat/usage.ts`                                | Category-aware snapshots replace; unique final settlement; no spend analog                                    |
| I21 `apps/api/src/chat/tools.ts`                                | New allowlist dispatcher delegates to owners; every call gets durable result; model grants no authority       |
| I22 `apps/api/src/chat/lesson-target.ts`                        | New exact one-lesson resolution; captured account zone/now; preserve originalOn vs actual startsAt            |
| I24 `apps/api/src/chat/undo.ts`                                 | New receipt/current revision inverse; local effect+receipt transaction; final Calendar inverse via one writer |
| I32 `apps/api/src/cards/notes.ts`                               | Own entry id/revision; separate from base Markdown; no genuine append inverse analog                          |
| I36 `apps/api/src/schedule/comments.ts`                         | Own entry identity/version and exact lesson reference; no whole-body rollback                                 |
| I44 `apps/web/app/(app)/chat/_components/conversation-list.tsx` | New history identity/CRUD states from checked UI; no force-fit unrelated list                                 |
| I45 `apps/web/app/(app)/chat/_components/composer.tsx`          | New exact mention/IME/quick intent; selection never sends                                                     |
| I46 `apps/web/app/(app)/chat/_components/messages.tsx`          | New stream/result renderer; allow only specified safe text/known blocks                                       |
| I47 `apps/web/app/(app)/chat/_components/model-controls.tsx`    | Approved v40 controls; no invented ranks/levels/availability                                                  |
| I48 `apps/web/app/(app)/chat/_components/use-chat.ts`           | Owned transport+Registry; new durable controller; no raw fetch duplicate                                      |
| I63 `yarn.lock`                                                 | Generated output, не рукописный source analog                                                                 |
| I72 `AGENTS.md`                                                 | Вне implementation analog denominator; отдельная authority/source binding                                     |
| I73 `Source10 outside Root (actor source; path not supplied)`   | Вне implementation analog denominator; отдельная authority/source binding                                     |

## Metadata

Analog search scope: tracked apps/api/src, apps/web app/lib/components/app, packages/contracts/src, packages/db/src и existing e2e/support. .codegraph/.runtime/skills/.agents/skills отсутствуют в Root; indexing не выполнялся. work-router и gsd-phase-recipe прочитаны; конфликтующие Git/delegation/cleanup/model defaults подавлены текущим контрактом. Новые агенты не создавались.

Files fingerprinted: 50 tracked source/config/harness files + 8 authority/phase inputs. Source lines below describe current read snapshot, not runtime/type/quality proof. Generated apps/web/AGENTS.md read only as instructions, never code analog. Search stopped after 5 primary matches; ancillary reads bound actual seams/callers. Bounded line reads used where Read connector unavailable; no repeated search/provider queries. Write/Read named tools are not exposed in this runtime; authorized sole document written through apply_patch, no shell/heredoc file creation.

**Input fingerprints (SHA-256):**

| Input                                                                      | SHA-256                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `AGENTS.md`                                                                | `fbef0e319fe49ffb5ab0067e8feac8093172f958b0a70808ff5a376bbb72c9be` |
| `.planning/EXECUTOR-RULES.md`                                              | `1eca1fa30e110bd04658cbf885d1b2189ce854f3cd3ed49664194f6121cbd449` |
| `.planning/phases/22-chat-with-mentions-and-quick-marks/22-CONTEXT.md`     | `51b32662f10e30d607d1d7a9e95c7154767d17a2925f58b91343a1bd416ca7e7` |
| `.planning/phases/22-chat-with-mentions-and-quick-marks/22-RESEARCH.md`    | `38e3a5cfbd03fffbc618886e1fc632aadf6ca417e0f3fa76f3705af09565a708` |
| `.planning/phases/22-chat-with-mentions-and-quick-marks/22-AI-SPEC.md`     | `a399cb8d22a9042f7dfcfd34c710687401f62fe043c36b694709a7e6652709ed` |
| `.planning/phases/22-chat-with-mentions-and-quick-marks/22-ARCH-REVIEW.md` | `eb55e8cc42ba98894c76a1b406fc09569cf7ed5909e13579d6b92e910dc1ccc8` |
| `.planning/phases/22-chat-with-mentions-and-quick-marks/22-UI-SPEC.md`     | `418cf3b3b02ae025f06c6eb52f8338a54813efd460aa779d905f83f1959c9f9a` |
| `.planning/phases/25-google-calendar-two-way-sync/25-PLAN-INDEX.md`        | `ff2bbc23f681e1ab3775aae35fa925ef5e01d58b6ad2baa58cc171ff202229a9` |

**Tracked source fingerprints (git ls-files -- path nonempty before assignment):**

| Source                                                          | Physical lines | SHA-256                                                            |
| --------------------------------------------------------------- | -------------: | ------------------------------------------------------------------ |
| `packages/contracts/src/settings.ts`                            |             28 | `b83bf4ce93320616e5551460a33dcde3ce27b43aeda775f01903d12006dec092` |
| `packages/contracts/src/index.ts`                               |              8 | `6c7bcb4d755988c6eb422f6685cda144b68ae7aac7ac8a858b8d18f7c695782b` |
| `packages/contracts/src/schedule.ts`                            |            147 | `19110c5db060b92946cdde9a17ea63ac7db8018a5be80c09d002ec10dee1d9c6` |
| `packages/contracts/src/students.ts`                            |            211 | `9569662a23804a1b59e424fd30a63fb8ffbe119b879ea441a4b21153c8e2cb52` |
| `packages/db/src/calendar-schema.ts`                            |            368 | `3e0a840276411c7c541c9859a86d57a8d4b2cf7604237d2ba94599a92dcaa2ac` |
| `packages/db/src/schema.ts`                                     |            326 | `3f190ad368cb89b5cabd7a08c57ab94c4c4c815a9aa09d92cc877cb3218551de` |
| `packages/db/src/index.ts`                                      |              7 | `62334d82d655463b34b9cae5f2761f1a8cf043c9877ed09a09b664b7eb20f740` |
| `apps/api/src/calendar/journal.ts`                              |            226 | `30a73a7a98c0342afdc828997bb097dc8291d18692013d5f46fbca539e603e37` |
| `apps/api/src/calendar/worker.ts`                               |            225 | `ceb59c0196723cfae435e338947438ce2d2a490a8becadf8c6bd88b80994cc1d` |
| `apps/api/src/config.ts`                                        |             84 | `deebf084be043e6470e4a116bb1fa0228588b26a3fd75bf58083098c6163d1c0` |
| `apps/api/src/cards/card-facts.ts`                              |             68 | `d739eef3cc82a2101934626a34072ef41d4d9bfc8bbbe4415a36dc3681a52e44` |
| `apps/api/src/calendar/commands.ts`                             |            143 | `6bb40fba1061b6015f8d5787748ee29782a0950b23f076562b4074a9dab1b5a3` |
| `apps/api/src/routes/settings.ts`                               |             38 | `e7abdc928efb7d000c14cf00b55645ca355bdb7dac175a33cdc44a9f7cd2544b` |
| `apps/api/src/app.ts`                                           |            111 | `a6e7ad6dfc55d44f8e3e5e3a43563743b33e41e9c2e4dccde5a5c7dc81c3a8bf` |
| `apps/api/src/server.ts`                                        |            109 | `ea018ce5ec2a63427e66afbe570f5815b52937bf6cbacdb622ed81dd10a105e1` |
| `apps/api/src/lifecycle.ts`                                     |            100 | `81eebd2f099c80b943689f6f19b38048372cf2741062bf27b0a2630494a705a1` |
| `apps/api/src/cards/cards.ts`                                   |            200 | `9e1884977d1528bd7d2d880d3b61afe636c78d6c4fd7f208782e772be91f5670` |
| `apps/api/src/cards/sections.ts`                                |             63 | `dedaed280bbab5b2aad5e7b1df0ba381acd621fd8c44e658cd2ce933cfb5d1ca` |
| `apps/api/src/routes/students.ts`                               |            283 | `d6667d63546062a4964787467fccaf94dd1094546f9d8c15dfa69f64c959afab` |
| `apps/api/src/schedule/marks.ts`                                |            104 | `c89a86b02d80456ec0bf62b79fa54f0ffeee71cf7af33385db4c8118e97ebb90` |
| `apps/api/src/routes/schedule.ts`                               |            210 | `1f175cb82f3d45a5e3e8251411d4fe03190148b68db585a714c139a2b32acc55` |
| `apps/api/src/schedule/series.ts`                               |            113 | `71c7d5db60cca9545802cf1866ea2504e61f3cd74d6cc2b29e3c40f322670092` |
| `apps/api/src/schedule/rows.ts`                                 |            421 | `5c807ba53236e73b1d8548cba3ef82078378cc344bea56999c0c0bbdca49069e` |
| `apps/api/src/settings/settings.ts`                             |             70 | `4bdf669819d0ff9ca97e4e2f88742b655b1288caddd96eb4737278969fac96b6` |
| `apps/web/app/(app)/chat/page.tsx`                              |             17 | `de16215b7e435a2cc4936b963a4bc5e5ebd9fef64235e534ae9e2e5c53bd9705` |
| `apps/web/app/(app)/settings/_components/settings-screen.tsx`   |            392 | `ae21e6f23b56bfa9b81cf1e033719ef80800d364b4b592e7aa413117c19894a3` |
| `apps/web/lib/api-client.ts`                                    |             35 | `fe19848e334e7604c0a8c25edb692c061b87ba3a50170d061dae0bd8ba9a435d` |
| `apps/web/components/app/calendar-command-provider.tsx`         |             99 | `1598c4b7137b213084e77f579aab381e144c908281378a8257e1f14d7ee0f4d0` |
| `apps/web/app/(app)/_components/use-today.ts`                   |             83 | `06bb430cc107eb756bbf62041d2bfba4b01ab9037c93f0dba445afe525f10dae` |
| `apps/web/app/(app)/schedule/_components/use-schedule-week.ts`  |            142 | `7d1926bf3f78f2ca3c9dc4c9ff7ef2042353779949291d18b3e9c6251bd5580b` |
| `apps/web/app/(app)/students/[id]/_components/notes-tab.tsx`    |            223 | `20ea049574ef9c873c303eef910cd06015fa45bd804908c2a0c5dd75910be83b` |
| `apps/web/app/(app)/schedule/_components/lesson-details.tsx`    |            166 | `a102e0beab717907e9c641434a27064f1afc2e72a73b24273220a93b503adf0f` |
| `apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx`    |            101 | `2ecebd5763b622fc4426a87018d098f8586c6c08a8196da268fd8094a9951151` |
| `apps/web/app/(app)/_components/today-mark-controls.tsx`        |            122 | `581996e3a6a25d89fa784a2f5ff29ddb1c860f64e3b8876efaa0cdc17715022b` |
| `apps/web/app/(app)/schedule/_components/schedule-mutations.ts` |            195 | `d0ada3836b04356a3a07debddb579308e9b04f05475d65f2d89155cc0af67501` |
| `apps/web/app/privacy/page.tsx`                                 |             98 | `1e1546413bb64a5b0c50b8f5d1a29b098a25992b9f144427bba4e2b26dcbe21f` |
| `apps/api/package.json`                                         |             38 | `d08967e894e007730318f4ba3af0023bb24b87d113994f388dd2ad09a6d695cc` |
| `e2e/marks.spec.ts`                                             |            453 | `796f06a06e7ba07c6fe8a9684ea72a02c98ec56953c5c4d887c050cc8acf63cf` |
| `e2e/move.spec.ts`                                              |            498 | `961dbcfa66abaa16974c7e633e00793da83758300537a0bcd6827c209817f389` |
| `e2e/today.spec.ts`                                             |            468 | `e86a5351c1e46e7cefb8f6c4e2d5eb25efded09276b03d6c10f43e154bc13c2a` |
| `e2e/calendar.spec.ts`                                          |            356 | `93e4280d31b6924f141e0bf96d2fac52079e9e9f0a1be76614c30bea012c8b97` |
| `e2e/support/test.ts`                                           |            231 | `bfd358456f7ba065cce2cc99c9390097d582261ec0f63c716d815de93ed4fd6a` |
| `apps/api/src/auth/middleware.ts`                               |            116 | `86e78399ebe845a36f60008e808a34ea9a2bece1e052cae1f621d90a1af88bcf` |
| `apps/api/src/request-context.ts`                               |             79 | `9eb0c082b19492f9675d1e3e05ba337af75e71a1906ec0f5ddc81082d652c8c6` |
| `packages/db/src/connection.ts`                                 |             36 | `2bb3e709933b907ddce8f6cb61d5a16231b72e56e72975d500907abc918ff8c2` |
| `apps/api/src/today/today.ts`                                   |             91 | `58ec98bd5a9cf5666d0998217df05c0bd5454a8840e5dc41644ae23b151ef008` |
| `apps/web/components/app/calendar-command-transport.ts`         |            106 | `1e15b66c8931e06832c88c11614e8d34087f96ff0ef0a1a82b69f5e87a78f6ea` |
| `apps/api/src/calendar/reads.ts`                                |             66 | `c50033505db90e93281f9c3ba926d1d0fbef1d9e74c2cf69f3bb0d72864952c8` |
| `e2e/support/calendar-fault-control.ts`                         |             77 | `67cb0a8bb73aabd5119613b11aaa2108617d77680acdc9ef054ee944fc23f3aa` |
| `playwright.config.ts`                                          |             45 | `0154cbcb60ae2c6ff9c7d3127d1cc0fc75c10f5b821f807409113a95a638c420` |

**Exact document checks:** root-pin command `bash scripts/gsd/root-pin.sh ~/.claude/worktrees/phase-24-google-calendar-preparation/dv-lab` exit0, ROOT_PIN_OK immediately before write. Tracked-source checks use `git ls-files -- <each analog path>`, matching full path, not mere disk existence. Static checks passed with original exit0: 73 classification/assignment rows, SC1–5/F01–10/ARCH-A1–A3, 58 unchanged fingerprints, 50 tracked sources, 32 verbatim excerpts and 61 UI predicates. Output document SHA-256 reported outside file to avoid recursive hash.

Exact reproducible command from Root (stdlib, read-only; no new checker file):

````sh
python3 -c 'from pathlib import Path
import hashlib,re,subprocess,json
p=Path(".planning/phases/22-chat-with-mentions-and-quick-marks/22-PATTERNS.md")
s=p.read_text()
classification=s.split("## File Classification\n",1)[1].split("## Pattern Assignments\n",1)[0]
assignment=s.split("## Pattern Assignments\n",1)[1].split("### registry\n",1)[0]
rows=re.findall(r"^\| (I\d{2}) \| `([^`]+)` \| ([^|]+) \|",classification,re.M)
assigned=re.findall(r"^\| (I\d{2}) `",assignment,re.M)
assert len(rows)==73 and len(set(x[0] for x in rows))==73 and assigned==[x[0] for x in rows]
for _,path,status in rows:
 if status.strip()=="New": assert not Path(path).exists(),path
 if status.strip()=="Modified": assert subprocess.check_output(["git","ls-files","--",path]).decode().strip()==path,path
assert all("| SC"+str(i)+" |" in s for i in range(1,6))
assert all("| F"+str(i).zfill(2)+" |" in s for i in range(1,11))
assert all("| ARCH-A"+str(i)+" |" in s for i in range(1,4))
fingerprints=re.findall(r"^\| `([^`]+)` \|(?: \d+ \|)? `([a-f0-9]{64})` \|$",s,re.M)
source=s.split("**Tracked source fingerprints",1)[1]
tracked=re.findall(r"^\| `([^`]+)` \| \d+ \| `([a-f0-9]{64})` \|$",source,re.M)
for f,h in fingerprints: assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,f
for f,h in tracked: assert subprocess.check_output(["git","ls-files","--",f]).decode().strip()==f,f
texts=[Path(f).read_text() for f,h in tracked]
excerpts=re.findall(r"```(?:ts|tsx)\n(.*?)\n```",s,re.S)
for excerpt in excerpts: assert any(excerpt+"\n" in text for text in texts),excerpt[:100]
ui=Path(p.parent/"22-UI-SPEC.md").read_text()
predicates=re.findall(r"^\| (HISTORY|COMPOSER|MENTION|TARGET|RESULT|ANSWERS|MODELS|PREFERENCES)\s*\|",ui,re.M)
assert len(predicates)==61 and len(set(predicates))==8
assert not Path("e2e/chat.spec.ts").exists()
assert ".gsd/"+"capabilities/" not in s
assert subprocess.check_output(["git","rev-parse","HEAD"]).decode().strip()=="913fc5ae9286aca9a48b5ce4272699c846849874"
print(json.dumps({"status":"PATTERNS_STATIC_OK","rows":len(rows),"assignments":len(assigned),"fingerprints":len(fingerprints),"tracked_sources":len(tracked),"verbatim_excerpts":len(excerpts),"UI_predicates":len(predicates),"sha256":hashlib.sha256(p.read_bytes()).hexdigest()}))
'
````

Application/E2E/browser/provider/DB/build/lint/type/quality/dependency checks: NOT RUN under read-only mapping contract. No source edit, Git mutation, runtime probe or provider claim. Final24/25 signatures, actual key/model/finite cap/credits and real Messages/Managed spike remain external execution gates; Parent rebinds final source before source22 work. Static mapping complete does not mean Phase24/25 or22 acceptance passed.
