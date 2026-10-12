# Phase 26: IELTS Section — Research

**Researched:** 2026-10-12
**Role:** typed gsd-phase-researcher; explicit GSD, work-router no-side-effect adapter
**Domain:** перенос действующего IELTS в dv-lab, shared auth, PostgreSQL, private disk media
**Confidence:** MEDIUM для cited evidence; PROPOSED для target design; runtime UNVERIFIED

## User Constraints

Канонический источник: 26-CONTEXT.md. Locked Decisions, Unreviewed Defaults и Deferred Ideas скопированы дословно. Current user contract ограничивает запись одним этим research. Инструкции старого hosting не меняют accepted target. [CITED: 26-CONTEXT.md; user task]

<user_constraints>
DATA_b649ac81_START

### Locked Decisions

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

### Unreviewed Defaults

- **UD-01:** Keep source domain rules and behavior behind a narrow adaptation to dv-lab routing, auth, persistence and disk storage. Research determines exact module boundaries from the current source; it must not copy a second independent auth system without demonstrating need.
- **UD-02:** Migration is resumable and validates stable source IDs, relationships, counts and media checksums. Ambiguous identity mapping stops the affected import instead of guessing by student names.
- **UD-03:** Preserve source and target data during preparation and verification. No physical domain/file deletion or cleanup is planned by default; additive migrations use the target's existing generator/migrator ownership.

These are technical defaults under autonomous authority. Research may replace them within the accepted port outcome and explicit data/shutdown boundaries.

### Deferred Ideas

Speaking feedback, live student screen mirroring, a replacement exam engine, new realtime/provider services, new environment, unrelated redesign and automatic old-hosting shutdown are excluded. Current active rooms, private migration manifests/data counts/media checksum evidence and teacher shutdown confirmation remain external observations.
DATA_b649ac81_END
</user_constraints>

## Scope Card

| Поле        | Binding                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome     | Implementation-ready full port research IELTS-01…06 / SC1…5 / F01…10                                                                               |
| In          | Source behavior/6.2, auth, schemas, disk media, migration, variant A, exact owners/signatures, public E2E                                          |
| Out         | Source/other docs/shared metadata edits, env/private data/runtime/model/DB/server/browser/media download/deps/Git mutations/deploy/deletion/agents |
| Owned write | Только ROOT/.planning/phases/26-ielts-section/26-RESEARCH.md                                                                                       |
| Acceptance  | Каждый SC/F связан с recovered source, concrete decision, implementation owner, Designer binding и observable proof                                |
| Evidence    | Read-only source pin/fingerprints, primary API/package docs, root-pin, file-only format и semantic checks                                          |
| Work map    | Source/role → SC1/3/F01/02/05/06; media/migration → SC2/4/F03/04/08; DS → SC5/F07; inventory/E2E → все SC/F09/10                                   |
| Stop        | Матрицы полны, external observations названы; никакого execution26 или actual parity PASS                                                          |

A1: source HEAD равен df57b7000c6adc60f35071065b4423d426d263a0; working tree содержит только untracked AGENTS.md. Проверяется read-only Git pin/status; pin change отменяет source binding. [CITED: pin commands below]
A2: phase6.2 implemented behavior и artifacts доступны; их status human_needed не означает target/device/theme PASS. Проверяется 06.2-VERIFICATION.md и actual journeys. [CITED: SOURCE/.planning/STATE.md:1-70; phase6.2 VERIFICATION]
A3: target19 auth/card/API/deploy owners существуют, но shared worktree меняется. Source24 09/12 integrated,10 active,11 pending;25 prepared,22/23 proposed. Все final interfaces и schema rebind до execution26. [CITED: user task; target files below]
A4: частные counts/identity crosswalk/media bytes/checksums/room activity/operator capacity не наблюдались. Проверяется signed private export/operator evidence; отсутствие наблюдения закрывает rollout, а не превращается в ноль. [CITED: task boundary]
A5: все новые target paths/types/signatures/tables ниже PROPOSED технические defaults. Проверяются planner binding, compilation и public E2E; инженерного approval checkpoint нет. [ASSUMED:A5]

## Summary

Перенести текущие domain rules и screens; shared dv-lab auth становится единственным authentication owner. Domain persistence идёт через Hono API и существующий DbExecutor. Один новый shared workspace @dv-lab/ielts нужен для фактически общих compiler/tree/timer/check/mark/stat helpers: source использует их в server и client. packages/core остаётся pure finance/schedule owner, contracts остаётся wire types/Zod/constants без imports из других @dv-lab packages. Новый workspace не создаёт вторую exam engine. [CITED: SOURCE/src/app/teacher/tasks/task-editor.tsx:72,439; SOURCE/src/app/teacher/tasks/actions.ts:8,26; TARGET/AGENTS.md; ASSUMED:A5]

Хранить IELTS business tables с префиксом ielts_, source identities — в crosswalk. Browser sessions/throttles старого приложения не импортировать. Media — private persistent API volume, GET/HEAD после session/attempt authorization, streaming byte ranges. Import принимает операторский private packet и staged media; не соединяется с old Neon/Blob. Snapshot trees, keys, marks, results, grades, bands и timing импортируются без recompile/recheck. [ASSUMED:A5]

**Primary recommendation:** planning26 связывает inventory M01–M12, parity P01–P12, Designer D26-01…08 и journeys J26-01…06; execution26 последним после final24→25→22→23. Source/docs checks подтверждают preparation; real migration, disk playback, activity и shutdown остаются отдельными gates. [CITED: 26-CONTEXT.md; ASSUMED:A5]

## Architectural Responsibility Map

| Capability / SC,F                          | Primary tier / owner                      | Secondary tier                   | Причина                                    |
| ------------------------------------------ | ----------------------------------------- | -------------------------------- | ------------------------------------------ |
| Login, role, epoch, account/card / SC1,F02 | API auth/accounts + sessions + middleware | SSR session guard                | Browser cookie shape не подтверждает право |
| Catalog/compiler / SC2/3,F01/09            | API catalog; shared IELTS compiler        | Teacher editor local preview     | Один DSL; server recompiles before save    |
| Attempt/timer/commands / SC3,F05           | API attempts/runs transaction             | Browser interpolation/poll/audio | Clock и mutation authority на server       |
| Check/bands/grades/visibility / SC3,F05/06 | API results/grading + shared pure rules   | Student-safe DTO/UI              | Key и unpublished data не уходят student   |
| Stats/6.2 / SC3/5,F01/07                   | API progress/results queries              | Browser chart/local day          | Query audience определяется auth           |
| Media / SC2/4,F04                          | API media authorization/storage + disk    | Browser native audio/image       | CDN/public static path не authorizes       |
| Migration / SC4,F03/08                     | Private operator import + DB journal      | Server guy staged files/release  | Stable mapping/counts/checksums/restart    |
| Variant A / SC5,F07                        | Web + Designer v40                        | Base UI                          | Existing approved components, оба theme    |

## Project Constraints (from AGENTS.md)

- ROOT закреплён; source/main/другие worktrees read-only. Чужие changes сохраняются. AgentFlow suspended. Git/env/runtime actions из recipe здесь не применяются по current contract. [CITED: user task; TARGET/AGENTS.md; EXECUTOR-RULES.md]
- English product copy, Russian internal docs; no eyebrow/Radix/cmdk. Использовать existing Base UI primitives и approved v40. При отсутствии approved representation Designer определяет spec. Registry search требуется перед future implementation custom missing block; research не запускает npx/install. [CITED: TARGET/AGENTS.md; EXECUTOR-RULES.md]
- API owns auth/data; web requests через apiRequest, SSR через session/public API; web не импортирует api/db. Config только loadConfig, error/log envelope только request-context; shutdown только lifecycle. [CITED: TARGET/AGENTS.md; apps/api/src/app.ts; apps/web/lib/session.ts]
- Source metadata, private titles/names/notes/essays/hashes credentials не публиковать. Только synthetic labels и safe aggregate evidence. Ни source env, ни secret profiles не читались. [CITED: both AGENTS; D-04/07/08]
- Additive schema/migrations через Drizzle generator под existing migrator. Никакого DDL generation сейчас, ручного SQL migration/push/extensions или physical domain/file cleanup. [CITED: TARGET/AGENTS.md; UD-03]
- Functional verification только public E2E с real app/persistence/disk, существующий target harness. Никаких isolated test suites/new environment/source test deletion. Scenario before new behavior; source old reset/Neon test scripts не переносить. [CITED: TARGET/AGENTS.md; user task]
- New/touched handwritten source <500 physical lines; каждый function/callback CC и cognitive <22, Halstead D<80; без explicit/inferred any. Значения измеряет execution owner с tool/version/token convention/fingerprint; здесь metrics/runtime не PASS. [CITED: TARGET/AGENTS.md]
- GSD package warnings/assumptions не добавляют повторный human engineering approval. Current authority позволяет concrete technical defaults, но D-05/06 и реальные credentials/observations сохраняют свою границу. [CITED: user task; D-05/06/10]

## Phase Requirements

| ID       | Source requirement → research binding                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| IELTS-01 | Student-only section → SC1,P01,M01/02/09,J26-01                                                              |
| IELTS-02 | Teacher tasks/sections/mock/media, server disk → SC2,P02/03/10,M03/04/08,J26-04                              |
| IELTS-03 | Rooms/timer/attempt/automatic checking/current6.2 → SC3,P04…09,M05…07,J26-02/03/05                           |
| IELTS-04 | Teacher essay review/grade → SC3,P07,M06,J26-03                                                              |
| IELTS-05 | Accounts/rooms/attempts/grades/media migration, confirmed shutdown → SC4,P11/12,M10/12,J26-06/operator gates |
| IELTS-06 | Variant A → SC5,D26-01…08,M09,J26-01…05                                                                      |

[CITED: TARGET/.planning/REQUIREMENTS.md:105-110; ROADMAP.md:Phase26]

## Source Recovery and Parity Inventory

SOURCE — /Volumes/T7/personal/ielts при pinned HEAD; TARGET — ROOT. Evidence ниже относится к коду. Phase6.2 имеет status human_needed; device/theme/chart keyboard UAT открыт. Исторические tests не запускались заново. [CITED: SOURCE/06.2-VERIFICATION.md; SOURCE/.planning/STATE.md]

| Parity             | Реальное source behavior / owners                                                                                                                                                                                                                                                         | Target choice / observable proof                                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P01 / SC1,F02      | src/lib/auth/{accounts,passwords,sessions,dal}.ts; proxy.ts. Teacher/student, active/deactivated, authEpoch; generated/manual reset, deactivate/reactivate. Source landing /teacher или /student.                                                                                         | Shared auth; /ielts student default; old teacher/student URL не копировать. Teacher management extends auth owner, не second DAL/pool. Page и API role/ownership tests, revoked cookie denied.                                                             |
| P02 / SC2,F01      | sections/store.ts: SectionInput, saveSection, setSectionArchived, deleteSection, setPartPositions; task compile.ts. Multipart Markdown, explicit removedPositions, diagnostics, positions/media/durations. Actual limits L4/R3/W2, generic MAX_PARTS8; title120; minutes1…300.            | Shared compiler local teacher preview + server validation; logical part retirement; save rejects incomplete/invalid changes; existing attempt snapshot не меняется после catalog edit.                                                                     |
| P03 / SC2,F01      | sections/store.ts: saveMockTest/listMockTests/setMockTestArchived; tests/runs.ts resolvePlan. L/R/W fixed slots, Academic/General matching; test может сохраняться с readiness warnings, Give rejects not_ready.                                                                          | Отдельный mock owner с теми же module/kind/readiness rules; archive сохраняет sections/results. Не добавлять unsupported duplicate section/fullscreen teacher preview feature.                                                                             |
| P04 / SC3,F05      | tasks/rooms.ts createRoom/updateRoom/endLesson/listLessonsInProgress/getRoom. Current one-off lesson, не permanent-room предположение schema comment. End submits active attempts, finishes unfinished runs, archives room; история остаётся.                                             | Transaction room lock + existing semantics; ended room исчезает из active list, доступна retained history. Membership logical removedAt, без physical cleanup.                                                                                             |
| P05 / SC3,F05      | tests/runs.ts giveToStudents/startNextSection/finishTest; pendingStepsLeft/busyStudentIds. Scope test/section/part, practice flags, readiness, membership, skipped busy students; unique run+step protects step creation.                                                                 | Port same transitions; repeated next with stale fromStep не advances дважды; students ahead keep working. Room + affected runs/attempt locks in stable ID order.                                                                                           |
| P06 / SC3,F05      | tasks/timer.ts, store.ts openAttempt/studentPauseAttempt/saveStudentProgress/submitStudentAttempt/commandAttemptsIn; frame/use-attempt-sync.ts. Server clock; open starts once; waiting pause remembered; practice student cannot resume teacher pause; autosave grace8s.                 | Server time in response, browser interpolates only; saving/pending/failed/held truthful, input saved only when server accepts. Reload, time_up/manual/teacher submit races prove same rules.                                                               |
| P07 / SC3,F06      | tasks/grading.ts/saveWritingGrade, grade-input.ts, writing.ts; grading-panel.tsx. Plain essay≤20000 chars, word warning не блокирует submit. Four integer criteria0…9, final0/1…9 half bands; final can override suggestion; comments stored.                                             | Manual teacher grade only. Grade applies only submitted writing + existing essay question. Task1/Task2 separately; Task2 double weighting; writing band requires both; partial/ungraded не fake0. Legacy attempt grade fields AND writing_grades retained. |
| P08 / SC3,F05/06   | tasks/check.ts normalization/word limits/currency-compatible alternatives/any-order/multi; bands.ts/bands/store.ts; override.ts and store.setQuestionVerdict. Score only L/R; bands need40. Teacher correct/incorrect/key override restores recorded key and recorded band-table version. | Port checker + immutable versions, no LLM/new arithmetic. Student DTO removes keyCorrect override marker; published expected answers only when authorized. Empty answer cannot force correct.                                                              |
| P09 / SC3,F01      | stats/progress.ts/results/result-groups/time/aggregate/question-types/attention/constants; teacher home/students/results, student progress. Source full6.2 inventory ниже.                                                                                                                | Query audience from session; same aggregation/truncation/reasons/targets/filters. Fresh public E2E needed; artifact verification не fulfills runtime.                                                                                                      |
| P10 / SC2/3,F04/07 | media/{policy,store,library}; tasks/media-actions, api/teacher/media/upload; exam audio sequence/history; source публичные Blob URLs. Library dedup hash, filters/usedBy/givenIn, duration update, quota, deletion blocked by parts/tasks/attempt snapshots.                              | Private disk with IDs, authenticated native playback/ranges. Source URL/type and client size/hash не trusted. Retained removed files не требуют Blob del или file delete.                                                                                  |
| P11 / SC4,F03      | db/schema.ts: accounts, catalog, room_students, test_attempts, attempts, writing_grades, band_table_versions, media; stored schema1/2 trees, grade/timer/history legacy fields.                                                                                                           | Prefix target tables; stable source IDs + crosswalk; no recompile/recheck/money/card guessing; journal/counts/references/media bytes validated.                                                                                                            |
| P12 / SC4,F08      | rooms/runs show business active state, polling не presence engine; source has no complete last-activity board (STATE gap SESS09).                                                                                                                                                         | Zero business active records alone не proves quiescence. Operator observation/freeze/final snapshot/delta proof required; teacher confirms old shutdown afterward.                                                                                         |

Все target choices в таблице — [ASSUMED:A5]. Source owners — [CITED: указанные SOURCE files at pinned HEAD].

### Source Values and Signatures (verbatim, CITED)

Read connector недоступен. Использованы bounded filesystem reads и rg. Поэтому in-repo enums/paths имеют CITED, без VERIFIED. Цитаты source ниже дословны; будущие paths/types — PROPOSED. [CITED: role provenance rule; source reads]

DATA_a8bd3769_START
SOURCE/src/lib/tasks/types.ts:3-15
export const taskKinds = ['reading', 'listening', 'writing'] as const
export const PART_LIMITS: Record<TaskKind, number> = { listening: 4, reading: 3, writing: 2 }
export const sectionModules = ['academic', 'general'] as const

SOURCE/src/lib/tasks/store.ts
export type AttemptPhase = 'waiting' | 'running' | 'paused' | 'time_up' | 'submitted'
export type TimerCommand = { type: 'pause' } | { type: 'resume' } | { type: 'adjust'; deltaMs: number } | { type: 'submit' }
export type SubmitReason = 'manual' | 'time_up'

SOURCE/src/lib/sections/types.ts:3-9
export type GiveScope = 'test' | 'section' | 'part'
export type TimeChoice = { kind: 'standard' } | { kind: 'custom'; minutes: number } | { kind: 'none' }
export type PracticeOptions = { audioPausable: boolean; time: TimeChoice; showAnswers: boolean }

SOURCE/src/lib/tasks/override.ts:3
export const VERDICTS = ['correct', 'incorrect', 'key'] as const

SOURCE/src/lib/tasks/timer.ts
export const SAVE_GRACE_MS = 8_000
export const MAX_REMAINING_MS = 5 * 60 * 60 * 1000

SOURCE/src/lib/tasks/store.ts:808-862
export async function saveStudentProgress(
id: string,
studentId: string,
rawAnswers: unknown,
rawMarks: unknown,
rawCurrentPart?: unknown,
now = new Date(),
rawFlags?: unknown,
): Promise<SaveOutcome>

SOURCE/src/lib/tasks/grading.ts:139
export async function saveWritingGrade(input: GradeInput, now = new Date()): Promise<SaveGradeResult>
DATA_a8bd3769_END

### Full Phase6.2 Behavior Binding / F01

- Student home остаётся tasks/results; отдельный Progress с periods7d/30d/3m/all, default all. URL хранит period. Teacher profile: Progress default, History lesson groups, Account; results grouped/filter student/skill/to grade/to publish. [CITED: SOURCE/06.2-CONTEXT.md; stats/series.ts:110-129; teacher/students/[id]/page.tsx:45-64; stats/result-groups.ts]
- Bands L/R/W/S/Overall только с real band; hidden points не выходят student. Visibility: publishedAt либо showAnswers + every section submitted. Teacher видит unpublished; publish/hide сохраняют source semantics (showAnswers может продолжать разрешать view после hide). [CITED: SOURCE/tests/results.ts:114-116,225-279; stats/progress.ts:250-294]
- Types берутся из attempt snapshot, не current edited catalog. Listening matching отличается от Reading matching_features; accuracy + volume, eligibility/weakest ordering source constants. Three weak types + criterion link to Tasks qtype; никакого autoassign. [CITED: SOURCE/stats/question-types.ts:4-45,152-188; stats/aggregate.ts; constants.ts]
- Criteria averages отдельно task1/task2; time используется elapsedFinal/elapsedMs, old submitted-opened fallback; paused historic fallback marked approximate и без invented limit. New submission stamps elapsedFinal; historic rows не переписывать. [CITED: SOURCE/stats/time.ts:1-76; tasks/store.ts:355-375; tasks/grading.ts:139-198]
- Preserve source limits: progress rows300, trees150, recent sections6, lesson group step20, home rows5, sparkline10, no-band reasons10. Attention priority: inactive≥14days; never after>7days; latest overall падает≥0.5 относительно предыдущих двух. Target UI allows source targets≥4 из overall bands, source column permits halves0…18 — historical lower values сохранить, не “исправить” import. [CITED: SOURCE/stats/constants.ts; attention.ts:1-36; target.ts; db/schema.ts]
- Chart groups by viewer browser IANA zone, fallback UTC; schedule/account default zone здесь не подменяет existing analytics policy. Preserve timestamps/instants; convert only at presentation. Day collapse/averages/reasons copied from stats/series.ts. [CITED: SOURCE/components/stats/band-chart-card.tsx:36-43; stats/series.ts:36-74]
- Preserve manual Speaking band in run result, не speaking engine. Preserve copyable AI authoring prompt + splitReply as local helpers; source AI prompt dialog asks teacher to copy it, без app-paid provider. [CITED: SOURCE/tests/results.ts:277; tasks/ai-prompt.ts:429-459; teacher/tasks/ai-prompt-dialog.tsx]
- STATE gaps TASK07/TASK12/SESS09/FND01/02/03 не превращаются в port features: no automatic instruction redesign, new presence/log/live transport/highlight-anchor format, duplicate section or new mirror. [CITED: SOURCE/.planning/STATE.md:known gaps]

## Standard Stack

Locked target versions восстановлены из actual manifests. Generated старый AGENTS не подтверждает pins. Source Next16.3.8 не заменяет target16.4.0. Target: React19.3.0, Base UI1.8.0, Hono4.13.13/node-server2.1.4, Node24, TS6.0.3, PostgreSQL18, Drizzle1.0.0-rc.4, Zod4.6.5, Yarn4.18.1. Blanket upgrade и новые Vercel/Blob/Neon/Liveblocks dependencies не нужны. [CITED: TARGET/package.json; apps/{web,api}/package.json; packages/db/package.json; SOURCE/package.json]

Новый @dv-lab/ielts — workspace, не npm package. Он содержит текущие shared source rules, зависит от contracts types и Markdoc; не читает env/Node/DB/Next. Core/contracts existing dependency boundaries сохраняются. API tsdown уже alwaysBundle /^@dv-lab\//; проверить actual standalone/pruned bundles на candidate. [CITED: TARGET/apps/api/tsdown.config.ts:1-24; ASSUMED:A5]

### Necessary New Target Packages / SC2/3/5,F09

| Package / pin                 | Actual source use → future owner                   | Registry publish UTC / observation                               |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| @markdoc/markdoc 0.5.10       | Shared compiler; @dv-lab/ielts/package.json        | 2026-09-16T16:50:18.111Z; exists, latest same                    |
| @codemirror/commands 6.11.1   | Teacher Markdown editor; web/package.json          | 2026-09-15T16:54:36.967Z; exists                                 |
| @codemirror/state 6.7.6       | Typed editor state/decorations; web                | 2026-09-22T07:21:29.712Z; exists                                 |
| @codemirror/view 6.43.13      | Teacher editor DOM view; web                       | 2026-09-22T07:16:47.730Z; exists; latest6.43.14, keep source pin |
| @dnd-kit/core 6.3.1           | Keyboard/pointer pools and part reorder; web       | 2024-12-05T17:10:19.974Z; exists                                 |
| react-resizable-panels 4.12.4 | Exam split/persisted panel layout; web             | 2026-09-06T12:58:03.537Z; exists; latest4.14.4 не port default   |
| recharts 3.8.0                | Band chart/sparkline; web                          | 2026-03-06T21:58:48.207Z; exists; latest3.10.1 не port default   |
| react-is 19.3.0               | Recharts declared peer, matching target React; web | 2026-09-09T17:17:33.743Z; exists                                 |

[CITED: SOURCE/package.json; tasks/compile.ts:5; teacher/tasks/markdown-editor.tsx:4-20; exam/drag/drag-scope.tsx; frame/exam-panes.tsx:5; stats/{band-chart,sparkline}.tsx; npm registry metadata fetched 2026-10-12; Recharts v3.8.0 manifest]

Primary package provenance: [Markdoc](https://markdoc.dev/docs/getting-started), [CodeMirror official repository](https://github.com/codemirror/dev). CodeMirror указывает separate npm packages и moved upstream; direct docs/ref и moved repo lookup не дали observation. API version compatibility UNVERIFIED. Также прочитаны [dnd-kit legacy core manifest](https://github.com/clauderic/dnd-kit/blob/master/packages/core/package.json), [Resizable panels](https://github.com/bvaughn/react-resizable-panels), [Recharts manifest](https://github.com/recharts/recharts/blob/v3.8.0/package.json). [CITED: linked primary sources]

### Package Legitimacy Audit

GSD seam вернул OK для dnd-kit/recharts, SUS too-new для Markdoc/CodeMirror/panels latest. Baseline minAgeDays30 отличается от обязательного Yarn npmMinimalAgeGate1440 minutes. Exact-pin public checkPackages вернул OK для panels4.12.4, recharts3.8.0, react-is19.3.0 и core6.3.1; SUS too-new для Markdoc/CodeMirror pins. У восьми exact pins postinstall не обнаружен. Это не transitive audit и не runtime compatibility proof. [CITED: gsd-core/bin/lib/package-legitimacy.cjs:DEFAULT_THRESHOLDS/checkPackages; command outputs; registry metadata]

@markdoc/markdoc, @codemirror/commands, @codemirror/state, @codemirror/view: [WARNING: flagged as suspicious — verify before using.] Primary/source lineage and exact version exist; all source pins older than24h at research date. Keep exact pins as PROPOSED port defaults under autonomous authority, carry raw SUS into the installing plan and recheck actual date/metadata/Yarn gate there. No invented OK, gate disable or repeated human engineering approval. No package was installed. [CITED: current user task; registry/seam; ASSUMED:A5]

Sonner заменить existing ToastProvider/useToast. @vercel/blob/functions, source DB client и source auth не переносить как dependencies. ffmpeg/transcoding/provider SDK/new websocket infrastructure не нужны. Native playback и source declared/measured durations сохраняют поведение. [CITED: SOURCE actual import owners; TARGET/(app)/_components/toasts.tsx; ASSUMED:A5]

## Architecture Patterns

### Auth, Identity and Routing / SC1/4,F02/03

1. Shared accounts.id is authentication identity. IELTS studentAccountId FK points to accounts.id, never cards students.id. Source account UUID is retained when collision-free; existing target teacher is explicitly mapped, never inserted as second active teacher. Existing student match requires private explicit ID crosswalk, not full name/email similarity or login-only guess. An unrelated UUID/login conflict stops affected import. [CITED: TARGET/db/schema.ts:accounts constraints; auth/accounts.ts:15-154; cards/card-account.ts; ASSUMED:A5]
2. Source and target scrypt format, NFKC, N32768/r8/p3, salt16/key32 and accepted-profile sanity agree. Auth import owner validates hash syntax/profile and preserves imported student's hash without knowing password. It does not overwrite existing target credentials, status or card link. Teacher/source metadata stays in private packet/profile/crosswalk; old teacher credential is not a second target sign-in alias. Sessions/throttles remain target-local; migrated student signs in again. Unsupported/ambiguous credential mapping is operator gate, never automatic password recovery. [CITED: SOURCE/auth/passwords.ts:1-51; TARGET/auth/passwords.ts:1-47; ASSUMED:A5]
3. Extend auth account commands only for existing source reset/manual-generated/reactivate needs; deactivate revokes epochs/sessions as today. Card linking remains createCardAccount/linkCardAccount owners; importing account never creates a money/card record or guesses card link. IELTS profile owns note/targetBandHalves/source timestamps so stats preserve source account-age evidence when mapped to pre-existing target account. [CITED: SOURCE/auth/accounts.ts:105-239; TARGET/auth/accounts.ts; cards/card-account.ts; ASSUMED:A5]
4. Proposed web: student /ielts, /ielts/progress, /ielts/attempts/[id], /ielts/results/[id]; teacher /ielts/teacher and /ielts/teacher/{rooms,students,tasks,tests,results,media}; teacher attempts/result details. Use a separate (ielts) route group, outside teacher-only (app) layout. Login response role chooses /ielts for student, / for teacher; signed-in login and teacher layouts redirect students to /ielts. Page checks getMe each request; proxy remains only coarse cookie gate. [CITED: TARGET/login/login-form.tsx:sign-in handler; (app)/layout.tsx; lib/session.ts; proxy.ts; ASSUMED:A5]
5. API mounts /ielts with requireSession/noStore; teacher subtree requireRole('teacher'), student subtree requireRole('student') + row.studentAccountId=session.account.id. Foreign/nonexistent student object gives same not-found response; teacher routes forbid student. Sensitive non-IELTS API routes remain teacher protected after final24/25/22/23 rebind, including direct requests. Only auth self/session endpoints, static assets and existing nonsensitive health remain common. Signed-in student non-IELTS page navigation redirects to /ielts; anonymous public legal pages remain public, no teacher data. [CITED: TARGET/auth/middleware.ts; routes/students.ts:92; D-01; ASSUMED:A5]
6. No teacher sidebar/palette or provider/chat state mounted in student IELTS shell. Teacher IELTS nav reuses AppShell section system; palette additions depend on final23 owner and must not duplicate palette engine. IELTS subnav matches recovered screens. [CITED: TARGET/(app)/_components/{app-shell,sections,command-palette}.tsx; SOURCE screens; ASSUMED:A3/A5]

### Domain, Concurrency and Recovery / SC3,F01/05/06

Сохранить row locks и source authority. Open запускает timer один раз. Waiting/running/paused/time_up/submitted вычисляются из server state, не хранятся как пять независимых статусов. Remaining capped5h; untimed elapsed идёт, remaining не убывает. Answer edits во время pause ограничены source grace; marks/flags/current part используют source rules. Teacher submit принимает только узко разрешённый late autosave under8s и сохраняет применимые verdicts. Общего разрешения редактировать после submit нет. [CITED: SOURCE/tasks/{timer,store}.ts:openAttempt/saveStudentProgress/submission; ASSUMED:A5]

Teacher command schema сохраняет pause/resume/adjust/submit, bounded IDs и source confirmations submit/end/publish. Server проверяет membership/account status. FromStep guard и unique(runId,stepIndex) защищают переходы; Give возвращает фактические started/skipped. Повторный next не создаёт второй step; ученики впереди продолжают работу. Locks room/runs/attempts берутся в стабильном ID order. Command key защищает от double adjust после потерянного ACK. Другой body с тем же key даёт conflict. Receipt сохраняется в той же транзакции. Browser повторяет только прежний key или читает state. [CITED: SOURCE/runs.ts:giveToStudents/advance; store.ts:commandAttemptsIn; ASSUMED:A5]

Student saves выполняются последовательно для attempt. Dirty revision сбрасывается только по matching server ACK; held/failed остаются recoverable. Local draft получает namespace account+attempt и validation; очистка только после acknowledged submission/logout. Чужой draft не replay. Source last-writer behavior сохраняется; новой collab merge engine нет. Two-tabs proof проверяет отсутствие duplicate submit/timer restart и truthful held/conflict, без обещания merge concurrent text. Poll token привязан к actor и не содержит keys/answers/unpublished bands. [CITED: SOURCE/frame/use-attempt-sync.ts:SaveState/draft/autosave/poll; tasks/versions.ts; ASSUMED:A5]

Один checker/DSL/band owner переносится из source. Import не запускает recompile/recheck. Student-safe response не содержит answerKey/catalog Markdown; studentResults исключает keyCorrect. Renderer принимает typed tree, без произвольного HTML/JSX/Markdoc execution. Teacher text и AI reply — untrusted input; compiler применяет source limits и media allowlist. Markdoc AST attributes проходят unknown→validated type boundary, без inferred any. [CITED: SOURCE/types.ts/tree.ts/check.ts/compile.ts/override.ts; ASSUMED:A5]

### Additive Data Model / SC2/3/4,F03/04/09

Все table names/columns ниже PROPOSED. Source UUID/timestamps/FK сохраняются с явным mapping при collision. Prefix исключает столкновение имен. Target accounts не клонируется. JSON columns имеют canonical typed tree/key/answers/results/marks/plan; import/request boundaries валидируют schema version/ranges и null semantics. [ASSUMED:A5]

| Table group                   | Exact proposed tables / necessity                                                                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Profile / SC1/3/4             | ielts_profiles(account_id PK/FK, note, target_band_halves, source_created_at/source_updated_at): source note/target and account-age parity without duplicated auth                                                                                                                         |
| Catalog / SC2/3/4             | ielts_tasks, ielts_sections, ielts_section_parts, ielts_mock_tests: preserve legacy task and current section identities/counts/refs; current saves use sections, not forced dual engine writes                                                                                             |
| Band history / SC3/4          | ielts_band_table_versions: source unique(kind,version), immutable version used by grading/override/history                                                                                                                                                                                 |
| Lesson/run / SC3/4            | ielts_rooms, ielts_room_students, ielts_test_attempts: names/archive/membership/run plan/options/published/speaking/finished; membership addedAt + nullable removedAt                                                                                                                      |
| Attempt / SC3/4               | ielts_attempts: all source fields, stored tree/key/answers/results/grade legacy columns, elapsedFinal, submission actor, marks/highlights/flags/media URLs; FKs RESTRICT, unique(run,step)                                                                                                 |
| Grade / SC3/4                 | ielts_writing_grades PK(attempt,question): criteria/final/comments/date, no loss when legacy fields also exist                                                                                                                                                                             |
| Media / SC2/4                 | ielts_media: source identity/name/type/size/duration/source URL + computed sha256/object_key/state/removedAt; no public source URL serialized to student                                                                                                                                   |
| Media authorization / SC2/3/4 | ielts_attempt_media PK(attempt,media); ielts_catalog_media(media, task XOR sectionPart): derive all snapshot/catalog refs, enforce referential ownership/used status without scanning JSON on every Range request                                                                          |
| Upload reserve / SC2          | ielts_media_uploads(actor,idempotencyKey,declared/reserved bytes,verified bytes/hash,state,expiresAt,objectKey): concurrency quota, restart/unknown ACK; rejected objects quarantined, no delete                                                                                           |
| Mutation receipts / SC3       | ielts_command_receipts(actor,key PK,bodyDigest,outcome): only non-idempotent teacher timer/advance/creation commands; no generic event sourcing feature                                                                                                                                    |
| Migration / SC4               | ielts_migration_batches(snapshotDigest/sourceCommit/schemaVersion/state/checkpoint/aggregate proof); ielts_import_items(batch,entity,sourceId,targetId,rowDigest,state); ielts_identity_map(sourceCommit,sourceAccountId,targetAccountId,role): resumable import/collision/reference audit |

Retirement добавляет removedAt для catalog/parts/media. Active part uniqueness действует только для nonremoved rows; reorder/remove сохраняют старые identities. Room archive повторяет source; end/submit не удаляет rows. Section Delete скрывает unused row после in_use/in_mock checks. Media Delete скрывает library entry, но не удаляет bytes. Designer copy отражает retained files и фактический disk meter. Source mock owner умеет archive/unarchive; v40 Delete mock test — mismatch, который надо связать с archive. Destructive backend operation не добавлять. [CITED: SOURCE/sections/store.ts:277-419,697-744; media/library.ts:165-173; DESIGN/TasksLibrary/README.md; UD-03; ASSUMED:A5]

Добавить catalog/session/attempt/media/import schemas в existing packages/db/drizzle.config.ts и index exports. Generated additive migrations/snapshots создаются позднее через yarn db:generate. Auth schema не расширяется IELTS metadata. Research не запускает schema repair, DDL или SQL. [CITED: TARGET/packages/db/drizzle.config.ts; ASSUMED:A5]

### Disk Media / SC2/4,F04

Source policies: audio80MiB, image5MiB, soft library cap900MiB; duration1s…4h. Target сохраняет app limits, без утверждения о свободном диске. Upload резервирует quota перед stream; server сам считает bytes/hash. Source extension/MIME allowlist переносится в contracts, signature check проверяет семейство audio/image. SVG/HTML/executable content, user paths и remote-fetch input не допускаются. [CITED: SOURCE/media/policy.ts:1-13; sections/store.ts:22-24; ASSUMED:A5]

PROPOSED flow: teacher POST /ielts/teacher/media/uploads с metadata/key создаёт reservation и upload ID. PUT raw binary стримит bytes в exclusive server-owned opaque path. Server проверяет size/type/hash, flush и atomic publish, затем сохраняет ready row/refs и выдаёт ACK. Next Server Actions/body buffering не используются. Partial/aborted/mismatched object остаётся failed/quarantined, не ready. При неизвестном ACK GET status использует прежний actor/key. Journal позволяет восстановить ready row без false Uploaded. Cleanup/delete не планируется; capacity включает retained/quarantine bytes. [ASSUMED:A5]

Paths come from validated IELTS_MEDIA_ROOT, not filenames/URL/request segments. Object key generated server-side. Canonical root, no symlink traversal, open regular file with no-follow, use handle/fstat; same filesystem staging→ready. Existing API process owns storage service lifecycle; track abort/disconnect close. Missing volume/config/capacity or hash mismatch fails closed, with no Blob fallback. [ASSUMED:A5]

GET/HEAD /ielts/media/:id сначала проверяет session. Teacher получает library/snapshot media; student — только через ielts_attempt_media и свой readable attempt. Room membership/guessed URL не разрешают чужой файл. Нет public static mount или image optimizer fetch без user session. HEAD/Range имеют ту же authorization; size/digest не выходят до permission. Private no-store/nosniff, escaped name, MIME allowlist; нет redirect к Blob. Собственный history attempt сохраняет доступ после room archive. [ASSUMED:A5]

Range следует HTTP semantics. Valid single/open/suffix range получает206 с точными Content-Range/length; unsatisfiable416 содержит bytes */size. If-Range mismatch даёт full200. Malformed/unsupported/multiple Range игнорируется с bounded full200. HEAD не имеет body и игнорирует Range. Size/ETag доступны только после authorization. [CITED: RFC9110 §14; ASSUMED:A5 for selected single-range policy]

Node24 filehandle.createReadStream использует inclusive start/end и autoClose/AbortSignal. Hono stream закрывается при abort; ошибка после начала helper stream не попадает в обычный onError. Поэтому validation/open выполняются до headers, поздняя ошибка завершает stream и логирует request ID/error code, без false JSON200. Primary: [Node24 file streaming](https://nodejs.org/docs/latest-v24.x/api/fs.html#filehandlecreatereadstreamoptions), [Hono streaming](https://hono.dev/docs/helpers/streaming), [RFC9110 Range](https://www.rfc-editor.org/rfc/rfc9110.html#section-14). [CITED: linked primary sources]

[OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) описывает layered type/signature/size controls, generated names и хранение вне public webroot. Target policy выше не является certification. Actual codec/mobile volume/proxy Range/cancellation/disk permissions/capacity/backups UNVERIFIED. [CITED: OWASP primary; ASSUMED:A4/A5]

### Migration, Release and Rollback / SC4,F03/08

Import — private operator CLI, без public data upload endpoint. Он принимает versioned packet через stdin и explicit source/target attestations/crosswalk/media manifest paths. Config/DB connection принадлежат existing target owner. CLI не читает source env, не соединяется с old DB и не скачивает URL. Server guy после quiescence делает consistent snapshot и staging вне repo. Liveops требуют signed candidate. [CITED: D-04…08; TARGET/import-vault.ts pattern; ASSUMED:A5]

Protocol, in dependency order:

1. Rebind pinned source и final target auth/routes/schemas24/25/22/23, signed candidate. Dry validation проверяет private packet/schema/UUID/FK/status/scrypt/encoding. До target writes bind Origin и DB hash. Empty manifest/count fallback запрещён.
2. Operator crosswalk: source teacherID явно связан с current target teacherID. Student sourceID сохраняется, если свободен, или явно связан с existing target account. При unrelated UUID collision новый UUID записывается durable в mapping. Ambiguous identity/login/status/card conflict закрывает import readiness. Нет fuzzy match или overwriting target. Accounts count сверяется по crosswalk, не по общему числу target accounts.
3. Media inventory включает registered rows, tasks.audioUrl, section_parts audio/image, attempts.audioUrl/mediaUrls, nested schema1/2 inline/attached/image refs, author source strings/data URIs. Missing row требует explicit manifest/hash, а не invented object. Accepted embedded images переносятся в staged disk objects; source text и IDs для editing сохраняются, response URLs гидратируются через auth media map. Browser remote fetch не используется.
4. Freeze source writes и отсутствие active students обязательны. Active attempts, unfinished runs/pending steps и operator observation живых учеников блокируют rollout. Source polling/version tokens не доказывают last activity. Observation/time/snapshot boundary записываются; resumed writer отменяет final snapshot. Production attempts не submit автоматически ради quiescence.
5. Staging использует safe keys. Actual bytes/hash сверяются с manifest. Null source sha256 требует actual operator computation. Source IDs/URLs остаются private provenance, runtime refs меняются через resolved ID map. Нет global replace/recompile. Unknown tree/schema/ref закрывает affected row.
6. Transaction chunks импортируют accounts/profiles/media/bands/catalog/rooms/memberships/runs/attempts/grades/refs. Batch+entity+sourceID unique, immutable row digest и checkpoint сохраняются вместе. Exact rerun пропускает matching item; mismatch останавливает. Crash после staging/commit возобновляет тот же batch. Blind overwrite/compensating delete не применяются; failed batch не enabled.
7. Сверить counts/key-set hash по entity и все FK/owner refs. Account merges допустимы только explicit crosswalk; composite memberships/attempts/grades сохранены. Media object count отличается только при documented hash dedup, source media IDs/count сохраняются. Payload digests допускают лишь deterministic mappedIDs/mediaURLs/transport normalization. Null grades/visibility/elapsedFinal/archive/history сохраняются. Проверить legacy grade columns и writing_grades. Actual counts/checksums UNKNOWN до private packet.
8. Candidate public parity использует real target persistence/disk и synthetic migrated fixture с teacher/student contexts. Real-data aggregate reconciliation выполняет operator отдельно. IELTS enabled только после actual proof и fresh quiescence. Source остаётся доступным/read-only, без dual writers.
9. До новых target writes failure позволяет отключить IELTS и вернуть traffic к unchanged source snapshot. После новых writes нельзя вернуть stale source: freeze target, capture/reconcile delta или roll forward. Additive objects/data/media сохраняются; code rollback не отменяет migration.
10. Old Vercel/Neon/Blob сохраняется до explicit teacher confirmation ПОСЛЕ accepted migration/parity evidence. Source delete/domain repoint/grant change/shutdown здесь не выполняются. Это условие D-06, а не повторный engineering approval.

[ASSUMED:A5 protocol; CITED: D-04…08/UD-02/03; SOURCE schema/rooms/runs/version owners; TARGET target attestation/import owner]

Operator report содержит candidate SHA/diff, source snapshot digest, target DB hash, safe counts/key-set/payload digest comparisons, missing refs/mismatch totals, media checksums, quiescence/time, expected/observed journeys, rollback/delta boundary и teacher confirmation reference. Private row maps/essays/source URLs/password hashes остаются вне public artifacts/logs. [ASSUMED:A5]

## Proposed Write Inventory and Public Signatures / F09

**CURRENT research writes only this file.** M01–M12 are future implementation ownership, not files created now. Each group below closes its stated SC/F; planner expands page adapters by the exact recovered route set and rebinds final target files. Every signature/type is PROPOSED. Unknown raw input is validated by contracts, not handed to a db query. [ASSUMED:A5]

| ID / SC,F           | Exact owned files/modules to create or extend                                                                                                                                                                                                                                                      | Public boundary / necessity                                                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M01 / all,F02/09    | packages/contracts/src/ielts/{tree,catalog,lesson,attempt,result,progress,media,import}.ts; index.ts exports                                                                                                                                                                                       | Canonical wire DTO/Zod enums/tree schema1/2, separate TeacherAttemptDto/StudentAttemptDto and typed outcomes. No API/DB/core imports.                                                                             |
| M02 / SC1/4,F02/03  | apps/api/src/auth/accounts.ts; new auth/account-import.ts, auth/student-credentials.ts; auth/passwords.ts only necessary hash validation helper; web/lib/session.ts; login/login-form.tsx; (app)/layout.tsx                                                                                        | Auth owner adds import/reset/reactivate; requireIeltsStudentPage/roleHomePath; existing card-account APIs stay owner. No duplicate sessions/auth table or password engine.                                        |
| M03 / SC2/3,F01/09  | packages/ielts/package.json, tsconfig.json, src/index.ts; src/{timer,check,answer-normalization,word-limits,bands,writing,tree,marks,flags,snapshot,timing,question-types,stats-aggregate,stats-series,stats-time,attention,author-prompt}.ts                                                      | Shared source algorithms; compile remains same for local preview/server. New workspace dependency edges explicit; unrelated core files untouched.                                                                 |
| M04 / SC2/3,F01/09  | packages/ielts/src/compiler/{compile,context,settings,inline,blocks,choice,completion,matching,grid,pool,image,diagnostics,reply}.ts; API ielts/catalog/{reads,sections,mock-tests,band-tables}.ts                                                                                                 | Responsibility extraction of source1469-line compiler/744-line store; diagnostics/numbering preserved; no mechanical slices or separate parser engine.                                                            |
| M05 / SC3,F05/09    | apps/api/src/ielts/lessons/{rooms,board,runs,run-step,commands,command-receipts}.ts                                                                                                                                                                                                                | create/update/end/Give/advance/finish; source room+attempt locks/unique steps; receipt only protects ambiguous repeated non-idempotent command.                                                                   |
| M06 / SC3,F05/06    | apps/api/src/ielts/attempts/{reads,student-progress,timer-commands,submission,marks,verdicts,grading}.ts; ielts/results/{reads,publication}.ts                                                                                                                                                     | Separate student-safe/teacher reads, autosave/submit/grading, visibility. No generic all-purpose store.                                                                                                           |
| M07 / SC3/5,F01/07  | apps/api/src/ielts/stats/{progress,history,home,student-summaries}.ts; ielts/profiles.ts; ielts/versions.ts                                                                                                                                                                                        | Same6.2 aggregation/query caps/poll scopes, profiles note/target only.                                                                                                                                            |
| M08 / SC2/4,F04     | apps/api/src/ielts/media/{policy,storage,uploads,library,authorization,references,range}.ts                                                                                                                                                                                                        | Private stream/storage/ready semantics, reference authorization and concurrent reserve. Node resources only API, never core/web.                                                                                  |
| M09 / SC1/2/3/5,F07 | apps/web/app/(ielts)/ielts/{layout,page,loading,error}.tsx; role-checked student progress/attempt/result and teacher route adapters listed below; components/ielts and lib/ielts-client.ts                                                                                                         | Native target shell/Base UI/primitives/Toast. API client adapters, no Next server-action DB writes.                                                                                                               |
| M10 / SC4,F03/08    | apps/api/src/import-ielts.ts; ielts/import/{packet,identity,media-map,apply,rows,reconcile,journal}.ts; packages/db/src/ielts-{catalog,session,attempt,media,import}-schema.ts; db index/drizzle.config/package.json                                                                               | Versioned private import/journal/additive schema. Db JSON type import from contracts requires workspace dependency; all source entities retained.                                                                 |
| M11 / all,F10       | e2e/{ielts-lessons,ielts-results,ielts-authoring,ielts-access-import}.spec.ts; e2e/support/ielts.ts; existing support/{test,api,target,data}.ts only needed owned fixture/attestation extension                                                                                                    | New IELTS durable scenarios in existing runner; SOURCE journeys ported without source db reset fixture code; no existing chat.spec assumed.                                                                       |
| M12 / SC2/4,F04/08  | apps/api/src/{config,server,app,lifecycle}.ts; routes/ielts-{catalog,lessons,attempts,results,progress,media}.ts; API tsdown.config/package.json; web/package.json; yarn.lock; next.config.ts; deploy/compose.yaml, deploy/env.example, deploy/backup/{backup,restore-check}.sh, deploy/RUNBOOK.md | Composition mounts, config names, API persistent media volume, import bundle entry, coherent DB+media backups. Actual liveops only Server guy after signed candidate. No addresses/mount credentials in research. |

M09 exact route adapters: /ielts/progress/page.tsx; /ielts/attempts/[id]/page.tsx; /ielts/results/[id]/page.tsx; /ielts/teacher/page.tsx; /ielts/teacher/rooms/{page.tsx,[id]/page.tsx}; /ielts/teacher/students/{page.tsx,[id]/page.tsx}; /ielts/teacher/tasks/{page.tsx,new/page.tsx,[id]/page.tsx}; /ielts/teacher/tests/{new/page.tsx,[id]/page.tsx}; /ielts/teacher/attempts/[id]/page.tsx; /ielts/teacher/results/{page.tsx,tests/[id]/page.tsx,band-tables/page.tsx}; /ielts/teacher/media/page.tsx. All under apps/web/app/(ielts). Student attempt layout uses approved fullscreen shell, not teacher palette. Existing login signed-session check also belongs apps/web/app/login/page.tsx. [ASSUMED:A5]

M09 component inventory under apps/web/components/ielts:

- shell/{student-shell,teacher-navigation}.tsx; home/{student-home,teacher-home}.tsx; lessons/{lesson-list,lesson-board,lesson-dialog,give-dialog,advance-control,timer-controls}.tsx.
- editor/{section-editor,markdown-editor,part-tabs,section-preview,section-settings,section-checklist,media-dialog,ai-prompt-dialog,reply-dialog}.tsx; editor/{section-draft,use-section-editor}.ts; catalog/{tasks-library,mock-test-form,band-tables}.tsx.
- exam/{exam-frame,exam-panes,exam-header,exam-navigator,submit-dialog,submission-page,end-screens,writing,review,writing-review,selection-tools,notes-sheet}.tsx; exam/{use-attempt-sync,use-attempt-clock,use-attempt-poll,use-progress-save,use-attempt-submit,attempt-draft}.ts.
- exam/questions/{blocks,inline,typed-gap,choice,radio-grid,drag-pool,image-pins}.tsx; exam/audio/{listening-gate,recording-player,volume-control}.tsx; exam/audio/{use-recording-sequence,use-audio-timeline}.ts.
- results/{result-list,test-result,grade-panel,writing-grade-card,verdict-controls}.tsx; progress/{student-profile,progress-page,band-chart,progress-tiles,type-accuracy,writing-criteria,practice-time,weak-spots,lesson-history}.tsx; media/{media-library,media-details,upload-dialog}.tsx.

Это behavioral owners восстановленных source screens, не обещание каждому source file отдельного shell. Exact props ниже; small source subhelpers используются внутри названных владельцев, planner фиксирует additional inventory до edit. Source task-editor1606/exam-frame573/use-attempt-sync559/store894/rooms581 превышают target file gate. Их разложение следует compiler/editor state/autosave/timer/submission/query обязанностям. Прямая копия as-is поведения не отменяет quality gate. [CITED: source physical line counts; ASSUMED:A5]

### Concrete Proposed Signatures

IeltsActor создаётся только из verified session middleware, не из request JSON. expectedUpdatedAt — ISO server timestamp, не browser time. M02 также владеет existing apps/web/app/(app)/_components/student-landing.tsx: использовать этот компонент как IELTS landing adapter с StudentHomeDto после переноса redirect, чтобы preserved file оставался используемым. Не удалять его ради knip. Это необходимое расширение inventory для SC1/F02. [CITED: TARGET student-landing.tsx/layout.tsx; ASSUMED:A5]

```ts
type IeltsActor = { accountId: string; role: 'teacher' | 'student' };
type CommandContext = { actor: IeltsActor; key: string; bodyDigest: string };
type IeltsPageRole = 'teacher' | 'student';
type SectionSaveInput = { section: SectionInput; expectedUpdatedAt: string | null };

roleHomePath(role: IeltsPageRole): '/' | '/ielts';
requireIeltsStudentPage(): Promise<MeResponse>;
importStudentAccount(tx: DbExecutor, input: ValidatedImportedAccount): Promise<AccountImportResult>;
resetStudentPassword(db: Database, input: StudentPasswordResetInput): Promise<StudentPasswordResetResult>;
reactivateStudentAccount(db: Database, accountId: string): Promise<StudentAccountChangeResult>;

compileTask(source: string): CompileResult;
compileSection(parts: PartInput[], header: SectionHeader): SectionCompileResult;
buildSnapshot(input: SnapshotInput): AttemptSnapshot;
checkAnswers(key: AnswerKey, answers: Answers): CheckResult;
remainingAt(state: TimerState, now: Date): number;

saveSection(db: Database, actor: IeltsActor, id: string | null, input: SectionSaveInput): Promise<SaveSectionResult>;
saveMockTest(db: Database, actor: IeltsActor, id: string | null, input: MockTestInput): Promise<SaveMockTestResult>;
setSectionArchived(db: Database, actor: IeltsActor, id: string, archived: boolean): Promise<CatalogChangeResult>;
retireSection(db: Database, actor: IeltsActor, id: string): Promise<RetireSectionResult>;
saveBandTable(db: Database, actor: IeltsActor, input: BandTableInput): Promise<BandTableChangeResult>;

createLesson(db: Database, ctx: CommandContext, input: LessonInput): Promise<LessonChangeResult>;
updateLesson(db: Database, actor: IeltsActor, id: string, input: LessonInput): Promise<LessonChangeResult>;
endLesson(db: Database, ctx: CommandContext, roomId: string, now: Date): Promise<EndLessonResult>;
giveToStudents(db: Database, ctx: CommandContext, input: GiveRequest, now: Date): Promise<GiveResult>;
advanceRun(db: Database, ctx: CommandContext, input: AdvanceRequest, now: Date): Promise<AdvanceResult>;
commandAttempts(db: Database, ctx: CommandContext, input: TimerCommandRequest, now: Date): Promise<CommandResult>;

getStudentAttempt(db: DbExecutor, actor: IeltsActor, id: string, now: Date): Promise<StudentAttemptDto | null>;
getTeacherAttempt(db: DbExecutor, actor: IeltsActor, id: string, now: Date): Promise<TeacherAttemptDto | null>;
openAttempt(db: Database, actor: IeltsActor, id: string, now: Date): Promise<AttemptStatusResult>;
saveStudentProgress(db: Database, actor: IeltsActor, id: string, input: ProgressSaveInput, now: Date): Promise<SaveOutcome>;
submitStudentAttempt(db: Database, actor: IeltsActor, id: string, input: SubmitInput, now: Date): Promise<StudentSubmitOutcome>;
studentPauseAttempt(db: Database, actor: IeltsActor, id: string, action: 'pause' | 'resume', now: Date): Promise<AttemptStatusResult>;
saveReviewMarks(db: Database, actor: IeltsActor, id: string, marks: Mark[]): Promise<ReviewMarksOutcome>;
changeTeacherMark(db: Database, actor: IeltsActor, id: string, input: TeacherMarkInput): Promise<MarkChangeResult>;
setQuestionVerdict(db: Database, actor: IeltsActor, input: VerdictInput, now: Date): Promise<VerdictOutcome>;
saveWritingGrade(db: Database, actor: IeltsActor, input: GradeInput, now: Date): Promise<SaveGradeResult>;
publishResults(db: Database, actor: IeltsActor, input: PublicationInput, now: Date): Promise<PublicationResult>;
loadProgress(db: DbExecutor, actor: IeltsActor, studentAccountId: string, options: ProgressQuery): Promise<ProgressData>;
readVersion(db: DbExecutor, actor: IeltsActor, scope: VersionScope): Promise<VersionResult>;

reserveMediaUpload(db: Database, actor: IeltsActor, input: UploadInput): Promise<UploadReservationResult>;
acceptMediaBytes(db: Database, actor: IeltsActor, uploadId: string, body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<UploadResult>;
readMediaStatus(db: DbExecutor, actor: IeltsActor, uploadId: string): Promise<UploadStatusResult>;
openAuthorizedMedia(db: DbExecutor, actor: IeltsActor, id: string): Promise<AuthorizedMediaResult>;
retireMedia(db: Database, actor: IeltsActor, id: string): Promise<RetireMediaResult>;
serveMedia(input: AuthorizedMedia, request: MediaReadRequest): Promise<Response>;

validateImport(raw: unknown, binding: ImportBinding): ImportValidationResult;
applyImport(db: Database, input: ValidatedImport, checkpoint: ImportCheckpoint): Promise<ImportChunkResult>;
reconcileImport(db: DbExecutor, input: ValidatedImport): Promise<ReconciliationReport>;

StudentHome({ data }: { data: StudentHomeDto }): ReactNode;
LessonBoard({ data }: { data: LessonBoardDto }): ReactNode;
SectionEditor({ initial }: { initial: SectionEditorDto | null }): ReactNode;
ExamFrame({ attempt, mode }: { attempt: StudentAttemptDto; mode: 'exam' | 'review' }): ReactNode;
ProgressPage({ data }: { data: ProgressData }): ReactNode;
MediaLibrary({ initial }: { initial: MediaLibraryDto }): ReactNode;
```

ValidatedImportedAccount содержит source/target UUID binding, normalized login/displayName, source status/hash/epoch/timestamps и optional explicit card ID. Это private validated CLI type, не public credential-hash request. GradeInput сохраняет source bounds. Student tree не содержит answerKey. DTO Dates — ISO strings, Maps — typed lists. Source domain reasons сохраняются; новые transport errors определяются contracts один раз. Planner связывает shapes до parallel implementation. [ASSUMED:A5]

Public Hono routes proposed:

- teacher catalog GET/POST/PUT sections/mock-tests, archive/retire, band-table versions/reset/restore, image positions, accounts/targets, media list/dedup/duration/upload/retire.
- teacher lessons list/create/update/read/end; Give/advance/finish/timer commands; attempt teacher read/marks/verdict/grade; results publication/hide/speaking.
- student home/progress/results/attempt read/open/status/progress/save-review/submit/practice-audio; GET actor-scoped version.
- authenticated shared GET/HEAD media. Prefix /api belongs proxy, Hono owner paths are /ielts/...; no web app/api route.
  All mounts depend on server composition, no import-time side effects. [ASSUMED:A5]

## Designer Binding Map / SC5,F07

Approved design: /Users/kdvornichenko/dv-lab-design/VERSION v40. README/preview existence подтверждает design input, не browser runtime.26 UI-SPEC пока не наблюдался. Designer связывает API DTO/failure states и решает mismatches до UI implementation. Source CSS не используется для invented new look. [CITED: DESIGN/VERSION; component README inventory; ASSUMED:A5]

| ID / SC,F                  | Actual source screen → approved v40 component                                                                                | Required binding/states → journey                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D26-01 / SC1/5,F02/07      | Login/DAL; student home → LoginPage, StudentHome, AppShell                                                                   | Role landing, session expired/deactivated/foreign-page denied, empty/active/result hidden; student only My tasks/Progress/Sign out, no teacher palette → J26-01                                                                 |
| D26-02 / SC2/5,F01/07      | teacher/tasks editor/library/tests → SectionEditor, SectionDialogs, TasksLibrary, MockTestForm, PlaceLabels                  | Diagnostics/dirty/restored draft/explicit replace/remove, reorder/media duration/positions, invalid module/not_ready, stale save/reload; archive vs reversible Delete mismatch → J26-04                                         |
| D26-03 / SC3/5,F05/07      | rooms/home → TeacherHome, LessonList, LessonBoard, StartLessonDialog                                                         | 3s board source polling; retained content on failure; waiting/paused/time_up/submitted/ended, busy skip/next/readiness/confirmed end, no false Saved → J26-02                                                                   |
| D26-04 / SC3/5,F05/07      | exam/frame/questions → ExamFrame, QuestionTypedGap/Choice/RadioGrid/DragPool/ImagePins, ExamNavigator, ExamSubmit/EndScreens | Fullscreen independent panes, keyboard/select-place/drag, notes/flags, character/word warning, held/failed autosave and reload; source content not HTML → J26-02/03                                                             |
| D26-05 / SC2/3/5,F04/07    | listening gate/player/sequence/review → ListeningStart, ExamReview, ExamReviewWriting                                        | Audio auth503/404/codec/range failure, sound check/start gate, exam no seek/pause vs practice timer pause, two-minute check, native handset volume restriction → J26-02/04                                                      |
| D26-06 / SC3/5,F06/07      | teacher attempt grading/results → WritingGradeCard, ExamWriting, TestResult, StudentResults, ResultRow                       | integer criteria/final override/comments, partial grading/null/no band, published/hidden, manual speaking, teacher verdict→key reset; grade dialog needed from source to approved spec → J26-03                                 |
| D26-07 / SC3/5,F01/07      | 6.2 home/student progress/profile/results → StudentProgressPage, StudentIeltsProfile, BandChart, ProgressTiles               | periods/local days/targets/series table & keyboard tooltip, hidden/unpublished/truncated/no results/no-band reason/time approximate/weak links/history Account parity → J26-05                                                  |
| D26-08 / SC2/4/5,F03/04/08 | source media library → MediaLibrary, MediaDialog                                                                             | Duplicate/upload pending/ready/quarantine/status unknown, quota/full disk/auth denial/used deletion denied; copy says hidden/retained, never promise freed disk; migration/operator status no invented new admin UI → J26-04/06 |

Source/DS mismatch: v40 says mock Delete; actual source exposes archive. Preserve actual backend archive and Designer adjusts copy. v40 SectionEditor mentions stale-change failure; source save has locks but no expectedVersion on editor request. PROPOSED SectionSaveInput.expectedUpdatedAt guard for cross-tab save closes data-loss risk: null only for create, existing version compared under row lock; stale edit leaves draft and asks reload/new review, never overwrites silently. It must be built and tested, not reported source behavior. [CITED: SOURCE/sections/store.ts:277-376; DESIGN/SectionEditor/README.md; ASSUMED:A5]

Existing target primitives: components/ui/{button,dialog,tabs,select,table,banner,tooltip,skeleton,dropdown}. Dialog — Base UI; command palette — Autocomplete, без cmdk. ToastProvider заменяет sonner. Для special panel/chart/drag adapters используются source packages и approved IELTS components; registry discovery нужен только перед custom implementation, если existing block необходим. [CITED: TARGET/ui files; command-palette.tsx:3; toasts.tsx; DESIGN component docs]

## SC / F Solution and Evidence Matrix

| Acceptance | Facts / source                                                 | Solution / owner / Designer                                                                            | Minimum decisive evidence                                                                                                                                         |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1        | F02/03; auth/DAL/schema target accounts/card                   | M01/02/09/10, D26-01: shared auth, stable crosswalk, page/API object isolation                         | J26-01: role landing, direct non-IELTS routes/API403, foreign attempt/media404, revoked cookie401; persisted ID mapping                                           |
| SC2        | F01/04/09; catalog/compiler/mock/media source                  | M03/04/08/09/12, D26-02/05/08: one DSL, teacher CRUD/logical retirement, private volume/ranges         | J26-04: edit/save/give snapshot stable; wrong media/size/quota/foreign Origin rejected; authorized actual disk bytes/range/playback; retained media after restart |
| SC3        | F01/05/06; rooms/runs/timer/store/check/grade/results/stats6.2 | M03…07/09, D26-03…07: source clocks/poll/options/grading/versioned bands/visibility/progress           | J26-02/03/05: multi-actor reload/pause/timeout/submit/grade/override/publish, actual persisted snapshots/timing/stats                                             |
| SC4        | F02/03/04/08/09; schema/metadata/activity gaps                 | M10/12, D26-08: resumable private import/reconcile, operator freeze/checksum/delta, confirmed shutdown | J26-06 synthetic public migrated read + operator actual count/hash/ref/media/quiescence/candidate proof; D-06 explicit confirmation                               |
| SC5        | F07/10; source UI + v40 docs                                   | M09, D26-01…08: approved components/themes/keyboard/handset                                            | Same journeys light/dark + handset core interactions and accessible chart table; no screenshot-only parity                                                        |

| Fact | Actionable disposition / exact evidence owner                                                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01  | P02…09 full source/6.2 inventory; M03/04/07; D26-02/07; J26-04/05; source6.2 human_needed carried                                                                      |
| F02  | P01/shared scrypt/role/card ID distinction; M02; D26-01; J26-01; private explicit account map gate                                                                     |
| F03  | Source14 tables including3 auth infrastructure; 11 business + mapped accounts/profiles retained; M10 additive/journal/crosswalk; actual counts/private packet external |
| F04  | P10/current80MiB/5MiB/900MiB, private session/ref/range/storage protocol; M08/12; D26-05/08; J26-04 + disk/operator proof                                              |
| F05  | P04…06/08 rowlocks/clock/grace/run-step/check/overrides; M05/06; D26-03/04/05; J26-02/03                                                                               |
| F06  | P07/two essay grades/final override/visibility; M06; D26-06; J26-03; no IELTS auto-grading/provider calls                                                              |
| F07  | D26-01…08 actualv40+source mapping; M09; UI-SPEC26 external Designer gate, themes/handset not observed                                                                 |
| F08  | P12/quiescence + D-06/release/delta/rollback protocol; M10/12; actual activity/candidate/media/teacher shutdown gates                                                  |
| F09  | M01…12 exact schema/workspace/API/web/deploy/file boundaries + signatures and package audit; rebind final24/25/22/23 before execution                                  |
| F10  | Existing target/source harness evidence below; four new durable spec owners, six scoped journeys; runtime not run                                                      |

## Minimum Durable Public E2E / F10

TARGET E2E owners: playwright.config.ts light/dark, one worker/retries0; e2e/support/{test,api,target,data,calendar}.ts. ensureCalendarTarget проверяет Origin/build/DB attestation, а не Google grant для IELTS. api() передаёт Origin. Schedule fx меняет settings/timezone; IELTS его не запрашивает, использует scoped fixture adapter с тем же binding. Existing prelaunch scope test Google primary не даёт права импортировать actual IELTS accounts. Server guy связывает candidate/Origin/DB/media lease до writes; нового environment нет. [CITED: TARGET/e2e/support/{api,calendar,test,target}.ts; ASSUMED:A5]

SOURCE public journeys: tests/e2e/{lesson-flow,mock-test,exam-controls,student-access}.spec.ts. Они проверяют Give/pause/answer/highlight/submit, L→R→W/grade/manual speaking/publish, keyboard/select-place/drag/note/flag/reload, teacher denial. Source setup reset DB не запускать и не переносить. Target IELTS/chat journeys сейчас отсутствуют; names ниже PROPOSED в existing runner. Source tests не меняются. [CITED: source test reads/inventory; user task]

Новые required scenarios пишутся до behavior. Synthetic accounts/catalog/rooms создаются teacher public API; actual synthetic media bytes — public disk upload. Synthetic migration packet проходит supported import owner под operator-bound persistence, затем проверяется public app/API. Operational import/reconcile evidence отдельно, без isolated test suite. Old production SQL fixtures запрещены. Завершение fixtures закрывает rooms, деактивирует owned accounts и сохраняет rows/files; unrelated reset/settings не нужны. [ASSUMED:A5]

| Journey / future durable owner                                  | Failures before implementation                                                                                                                                                                                                            | Expected public + persistence outcome                                                                                                                                                                                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| J26-01 / ielts-access-import.spec.ts                            | student directs /students,/schedule,/chat,/settings,/ielts/teacher; public API teacher subtree; other student's IDs/Range/HEAD; forged/expired/deactivated cookie, foreign Origin                                                         | Landing /ielts; no protected content/page flash;403 teacher API,401 no valid session,404 foreign resource/media; zero effects on denied commands; session revoked after password reset/deactivation; source mapped login works                               |
| J26-02 / ielts-lessons.spec.ts (port lesson-flow/exam-controls) | duplicate open/next/adjust ACK loss, teacher pause vs practice resume, clock expiry/late save/held, browser reload/offline save, two tabs, busy student, not-ready next, End lesson                                                       | One timer start/step; no extra adjust; source grace/window rules; answers/marks/flags restored only by acknowledged scope, failed/held truthful; teacher/student clocks/poll converge; end submits once and retains history; keyboard/drag/navigation works  |
| J26-03 / ielts-results.spec.ts (port mock-test)                 | partial writing grade/invalid criterion/wrong question/active attempt, unpublished data,39-question no-band, blank-force-correct, override reset/repeated submit                                                                          | L/R/W order/options; plain essays persisted, task2 double weighting; null until eligible; teacher bands vs hidden student; recorded-version override score/grade survive reload; manual Speaking/publish/hide rule; no answerKey leak                        |
| J26-04 / ielts-authoring.spec.ts                                | invalid DSL/module/in_mock changes, implicit part remove/stale editor, malformed/type spoof/oversize/quota concurrent upload, interrupted upload/lost ACK, missing disk/hash, used media/section removal, malformed/out-of-range requests | Field errors/draft retained, snapshots unaffected; upload actual bytes ready only after verify; same key status recovers; used retirement denied; no public disk path; authorized GET/HEAD/206/416/200 exact bytes and native seek; restart preserves object |
| J26-05 / ielts-results.spec.ts                                  | hidden stats, no band/ungraded partial, snapshot edited after submit, target/band table history changes, historical pause fallback, filtered empty/truncation/local day boundaries                                                        | 6.2 charts/table/toggles/period URLs/reasons/accuracy-volume/weak links/criteria/history/home counts unchanged; teacher unpublished visible only there; old time marked approximate, timestamps preserved                                                    |
| J26-06 / ielts-access-import.spec.ts + operator replay          | account UUID/login/card collision, missing media/ref/hash, checkpoint crash/rerun/changed row digest, active room/resumed writer, rollout or shutdown without proof                                                                       | Synthetic imported source identities/snapshots publicly readable through same owners, no duplicate records; mismatch stops readiness; actual aggregate counts/hash/ref/checksum/quiescence report required; old deployment retained absent teacher confirm   |

Test layers не добавляются. J26-02 покрывает two-tab authority/submit/timer; J26-03/05 переиспользуют persisted result journey; J26-04 покрывает disk/upload/ranges. Light/dark переиспользуют durable inputs. Handset повторяет лишь exam/audio/input/nav и chart table там, где поведение зависит от device. Actual phone audio/Safari volume/restart UNVERIFIED. Исторические source tests не считаются target pass. [ASSUMED:A5]

Future rerun: yarn exec playwright test e2e/ielts-lessons.spec.ts --project=light; затем --project=dark. Results/authoring/access-import — аналогично. Handset device binding добавляется в existing runner, не объявляется existing project. Evidence содержит candidate SHA/diff, synthetic fixture IDs, real Origin/DB hash/media attestation, expected/observed/status и exact command. Private credentials/content/URLs не попадают stdout/screenshots/traces. [CITED: TARGET E2E policy; ASSUMED:A5]

## Runtime State Inventory

Migration trigger applies; all five categories answered. “UNVERIFIED” means not inspected by authorized runtime access; no absence claim. [CITED: GSD role runtime inventory; task boundary]

| Category                 | Recovered stored/runtime state                                                                                                         | Required change / code vs data / evidence                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored data              | Old accounts,11 business tables, Blob URLs/data images/tree snapshots/grade/timer; local draft/split/volume keys on old browser origin | Data import/crosswalk/media hydration; target draft keys account+attempt; old localStorage cannot silently migrate across origins. Actual counts/bytes UNKNOWN                              |
| Live service config      | Old Vercel/Neon/Blob actual dashboards/grants not read; dv-lab approved current server                                                 | Operator readiness/freeze/origin routing, maintain old availability; target config code + actual operator observation, no new infra/grant                                                   |
| OS-registered state      | Target compose/systemd/backup source owners exist; actual mount/service lease unknown                                                  | Code media volume and backup coverage; Server guy registers/validates service/file ownership. OS state UNVERIFIED, not assumed absent                                                       |
| Secrets/env vars         | Source code reads old DATABASE_URL/BLOB_READ_WRITE_TOKEN; neither env read. Target loadConfig owns variables                           | New IELTS_ENABLED/IELTS_MEDIA_ROOT/IELTS_MEDIA_CAP_BYTES names only, no old Blob token. Existing target DB role reused; secret provisioning/operator-only evidence                          |
| Build artifacts/packages | Source Next bundle/old URLs; target tsdown/Next standalone/image tags; actual deployed candidate unknown                               | Code workspace pins/prune/alwaysBundle/import CLI; signed images/sourcemap-free user data check and native streaming paths actual release proof. Installed/runtime compatibility UNVERIFIED |

## Security and Environment Evidence

Security analysis ограничен port boundaries: authentication/session, object-level authorization, untrusted DSL/JSON, files/ranges, data migration and secret-free logs. [ASVS current primary project](https://owasp.org/projects/asvs) используется как taxonomy для этих областей; formal ASVS audit/certification не выполнялся. Public E2E denial paths J26-01/04 доказывают конкретные controls, не полный security score. [CITED: ASVS primary; ASSUMED:A5]

- Each API mutation verifies sameOrigin, session, role, row owner/membership/status and schema; media read also auth before stat/ETag. Published student result projection is explicit. Unknown exception never logs raw request/packet/filename/essay. [CITED: TARGET/middleware.ts; request-context owner; ASSUMED:A5]
- Allowlisted typed parser, validation and media refs prevent stored text becoming instructions/runtime code/remote fetch. Migration freezes malformed/unknown schema rather than “repairing” private content. No user/provider tool commands or arbitrary file/SQL paths exposed. [ASSUMED:A5]
- Source generated version recommendations/live-mirror/Blob-only hosting are not actual current pins/authority for target. No old env/server/test commands used. Actual disk permissions, quota including retained bytes, backup/restore coherence, codecs, device sessions and quiescence remain UNVERIFIED. [CITED: SOURCE AGENTS/package/STATE; D-07/08; ASSUMED:A4]

Environment audit: filesystem source и local Prettier доступны; native init.phase-op26 нашёл expected directory. Context7 MCP/ctx7 unavailable; research-plan выбрал context7, поэтому прочитаны official web sources. Research-store/cache не записывался. DB/media/session/active users/container/candidate/keys/browser не исследовались runtime. Port не добавляет payment/model dependency. [CITED: tool discovery/command results; task boundary]

## Don't Hand-Roll

| Problem / SC,F                                          | Reuse owner                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Authentication/credential hashing/card link / SC1/4,F02 | Target auth/accounts/passwords/sessions, never copied source second auth      |
| IELTS parser/check/bands / SC2/3,F01/05/06              | Actual shared source rules/Markdoc; no new DSL/checker/provider               |
| Transactions/FKs/migrations / SC3/4,F03                 | Existing DbExecutor/Drizzle generator/migrator/postgres-errors                |
| Theme/dialog/nav/toast / SC5,F07                        | Base UI/v40 + target shell/Toast, not source app shell clone                  |
| Streaming/cancel/native audio / SC2/3,F04/05            | Node/Hono/native HTMLAudioElement; no invented audio/realtime server          |
| Attested functional tests / all,F10                     | Existing Playwright/public API target harness; no source Neon reset/new suite |

## Common Pitfalls

1. Room schema comment says permanent; committed one-off endLesson semantics wins. [CITED: SOURCE/schema/rooms]
2. Checking membership only allows another student's media if shared room; join own snapshot. [ASSUMED:A5]
3. Source student ID is account UUID, not target student/card UUID; counts crosswalk not whole target account count. [CITED: both schemas; ASSUMED:A5]
4. “All rows copied” misses legacy grade columns/snapshot keys/media sources/elapsedFinal; field/digest and reference proof needed. [CITED: SOURCE/schema; ASSUMED:A5]
5. Hidden numeric data/answer key in SSR/poll payload remains leaked even with hidden component. [CITED: source safe projection; ASSUMED:A5]
6. Multipart80MiB through Next Server Actions/body buffering is not necessary; API raw stream avoids memory upload copy. [ASSUMED:A5]
7. Same source UUID is not proof of same person on target. Match only private explicit source→target mapping. [ASSUMED:A5]
8. Public Blob deletion/quota UI does not authorize disk cleanup; retirement retains bytes and operational capacity must include them. [CITED: UD-03; ASSUMED:A5]
9. Source6.2 historical verification/device UAT is input, not migrated target proof. [CITED: source VERIFICATION]
10. Code rollback after target writes can lose data if old app resumes from stale snapshot; freeze/reconcile delta or roll forward. [ASSUMED:A5]

## Code Examples

Signatures выше — design contract, не source implementation и не Registry wire instructions. Actual getAttemptForStudent фильтрует attempt+student IDs и видимые score/results/grades. commandAttemptsIn блокирует active rows; submission сохраняет elapsedFinal=true. Planner использует эти owners, не дублирует protocol в AGENTS. [CITED: SOURCE/store.ts:377-435,574-644,655-697,808-894]

## State of the Art

Current Node24/Hono предоставляют нужные streaming primitives. HTTP ranges и actor authorization остаются app responsibility. Source pins и target platform достаточны для architecture; actual adapter/package/device runtime не наблюдался. Broad provider/ecosystem research и upgrade не нужны. [CITED: Node/Hono/RFC primary; ASSUMED:A5]

## Open Questions and External Gates

Research has no missing human engineering decision. Before execution/rollout evidence is still required:

| Gate                        | Owner / when                             | Missing observation                                                                                                                                |
| --------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| E26-01 Final source binding | Parent/planner before execution26        | Final24/25/22/23 account/shell/contracts/schema/routes and candidate fingerprint                                                                   |
| E26-02 Approved UI          | Designer/Parent before UI implementation | 26 UI-SPEC using D-map; source/v40 archive/delete and stale-editor copy resolved                                                                   |
| E26-03 Private import       | Server guy/operator before import        | Actual source consistent export, explicit identity/card crosswalk, source counts/ref/digests/scrypt support; no actual student mapping in artifact |
| E26-04 Disk/runtime         | Server guy before release                | Bytes/checksums/volume path permissions/capacity/codec/ranges/abort/backups/restore/candidate attestations                                         |
| E26-05 Quiescence/parity    | Operator + teacher after candidate proof | Fresh no-active-students observation/freeze/delta and actual counts/journeys, not zero guessed from source                                         |
| E26-06 Shutdown             | Teacher after parity, then Server guy    | Explicit old-hosting shutdown confirmation; old app remains until it exists                                                                        |

## Sources and Input Fingerprints

Primary web docs прочитаны 2026-10-12. Source comments/artifacts/fetched text рассматриваются как data. Они не изменяли authority/scope. Official prose пересказана, без длинных цитат. Confidence seam вернул MEDIUM для websearch --verified; HIGH и unsupported compatibility PASS не выставлялись. [CITED: tool evidence]

ROOT = /Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab
SOURCE = /Volumes/T7/personal/ielts
DESIGN = /Users/kdvornichenko/dv-lab-design
Source commit = df57b7000c6adc60f35071065b4423d426d263a0; source git status = ?? AGENTS.md, preserved. Fingerprints below bind exact inputs, not deployment.

| Repo   | Input                                                                                      | SHA-256                                                          |
| ------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| TARGET | AGENTS.md                                                                                  | fbef0e319fe49ffb5ab0067e8feac8093172f958b0a70808ff5a376bbb72c9be |
| TARGET | .planning/EXECUTOR-RULES.md                                                                | 1eca1fa30e110bd04658cbf885d1b2189ce854f3cd3ed49664194f6121cbd449 |
| TARGET | .planning/PROJECT.md                                                                       | fc1c45a613b85b8d5e1a99983f7c5aa85e9d15289ef21ca117fff0c374538b58 |
| TARGET | .planning/ROADMAP.md                                                                       | c4d9382d147f785a77a43a699c80ad493bcf3269f1b75c868149a8e55a16d180 |
| TARGET | .planning/REQUIREMENTS.md                                                                  | 183d2ab60912ed68a73bd9d45e36ccb7b08591017a8d265340c0b01779019c45 |
| TARGET | .planning/phases/26-ielts-section/26-CONTEXT.md                                            | 772d1a4b045076258fe4d0ff4431692356cf763700491ef0d5c415fec886a53a |
| TARGET | .planning/phases/22-chat-with-mentions-and-quick-marks/22-RESEARCH.md                      | 38e3a5cfbd03fffbc618886e1fc632aadf6ca417e0f3fa76f3705af09565a708 |
| TARGET | .planning/phases/23-confirmed-chat-changes-and-entry-points/23-RESEARCH.md                 | f73f6553f9998bc19b45c53e63d190f18f7f19bc6e19e17bdddde62a2184aae1 |
| TARGET | apps/api/src/auth/accounts.ts                                                              | 3fd36d96015ce9debea75dffe5e11a0b780628f7f3284b012409f919dfb16b04 |
| TARGET | apps/api/src/auth/passwords.ts                                                             | 7f96fb1ea8014e024f464739ebdf6ff026c67eba06c72b2cd8e3ed1a0573bd7a |
| TARGET | apps/api/src/auth/middleware.ts                                                            | 86e78399ebe845a36f60008e808a34ea9a2bece1e052cae1f621d90a1af88bcf |
| TARGET | apps/api/src/cards/card-account.ts                                                         | 3f30182431a93a76c03cee1eaa061fa784d678505c8691592d5954298b4afb52 |
| TARGET | packages/db/src/schema.ts                                                                  | 3f190ad368cb89b5cabd7a08c57ab94c4c4c815a9aa09d92cc877cb3218551de |
| TARGET | packages/db/drizzle.config.ts                                                              | abbb95fe8e15f797bbd8307685516f86aecf869840d6cc6f9b4fae474dfb9f44 |
| TARGET | apps/api/src/app.ts                                                                        | a6e7ad6dfc55d44f8e3e5e3a43563743b33e41e9c2e4dccde5a5c7dc81c3a8bf |
| TARGET | apps/api/src/config.ts                                                                     | deebf084be043e6470e4a116bb1fa0228588b26a3fd75bf58083098c6163d1c0 |
| TARGET | apps/api/tsdown.config.ts                                                                  | e2b5e5230822963d9ae685f767d96a157c34b3206593245fd2aa9870f2db8b5a |
| TARGET | apps/web/package.json                                                                      | 7e49ef9ab0d12dfe244afa9b972d0381d8ddc9bf8a244ada04f5464e2fdc8518 |
| TARGET | apps/web/lib/session.ts                                                                    | bb813b3002e28ccaa24d9ca93ba03f61d1187e377cf054fe0a5e5aeea754d5e1 |
| TARGET | apps/web/proxy.ts                                                                          | eefd910f71457155b366c6945073f16c3a66e72c12e99eb9bb919ffdfcba9a5a |
| TARGET | apps/web/app/(app)/layout.tsx                                                              | df7482b60b01b113bb15bbd624253f91dafffddbfa1a75931b4e7ef697ad375c |
| TARGET | apps/web/app/login/login-form.tsx                                                          | e4663b0037cd0c9f8d1cd6c24d2a1f1d2ffdabd75e0646ae927070023df24cd5 |
| TARGET | apps/web/app/(app)/_components/app-shell.tsx                                               | 892ae7295084c9970747853bd3493760163d51a93ef658e5152ac798bba0cbc4 |
| TARGET | apps/web/app/(app)/_components/command-palette.tsx                                         | 978344fa7d2d848128a5024f123ca35655220a25e94d3efdd8844d7c2c8a3dde |
| TARGET | apps/web/components/ui/dialog.tsx                                                          | b8f313b33523f16b576fd9895281caec7ba8f6046c15ccf0c5f5c86c67baa2fc |
| TARGET | deploy/compose.yaml                                                                        | 3bc30aa826d8d03af72fd097b1150de0c33dbf6cba5650270e1837ed59874871 |
| TARGET | e2e/support/test.ts                                                                        | bfd358456f7ba065cce2cc99c9390097d582261ec0f63c716d815de93ed4fd6a |
| TARGET | e2e/support/target.ts                                                                      | 159ec0404b8a0da309535fb01b514c969b52f2b316e5a63f468bf952c6667eb5 |
| TARGET | e2e/support/api.ts                                                                         | 6ab88e4a4d56e97dab2915e99dc2b0247f1d1e7a1669f5fae13accae932712a4 |
| TARGET | e2e/support/calendar.ts                                                                    | 76d7865111f54603a5f6ad8f1c64d5eafd4718a626cf34fac5b08974a557a85d |
| SOURCE | AGENTS.md                                                                                  | 045fa2d5d7fcd46874d238ce449c1fe934186ade77a78e6a830291642e0885cb |
| SOURCE | .planning/PROJECT.md                                                                       | a1df1267a36456254e32871ceb631a983ca224968736195e2edeac6767eeb3fc |
| SOURCE | .planning/STATE.md                                                                         | f88211769acad758570ae4554aa9fed15fadc6c58b27933bfe5cf7d892a584c4 |
| SOURCE | .planning/ROADMAP.md                                                                       | de511b1d4d88c3ee6c7f2bea0b99bb32473c123776b2cdc1c807560817251538 |
| SOURCE | .planning/phases/06.2-progress-statistics-and-lesson-first-teacher-ux/06.2-CONTEXT.md      | ae5d3df072b70a8d51576a758eec8cde11a64ba84f1cfdbd5b3fcce5da89f91c |
| SOURCE | .planning/phases/06.2-progress-statistics-and-lesson-first-teacher-ux/06.2-VERIFICATION.md | f061e9a7765db207087df2fdcd6090beb3a43c26067ff78d3669638d4ccf9acd |
| SOURCE | package.json                                                                               | 82590b4c5ae4ca34a324505a899b6b10eccdbceff78ddbb6f13292fe00d1c8a3 |
| SOURCE | src/lib/db/schema.ts                                                                       | 4684297eaf1c457796a209d565af1e111b1f629a341854ab86abfee57292d09d |
| SOURCE | src/lib/auth/passwords.ts                                                                  | fe97e2ec44a14c2f745bd01ec76853c8c98ec24d17085ba88b300abfd608f51b |
| SOURCE | src/lib/auth/accounts.ts                                                                   | 5d81d9a7a0b63d17538a51e8cf724b9a88c0ff83ad4fb72378e46e52ea596c58 |
| SOURCE | src/lib/auth/dal.ts                                                                        | 6d3fbefda4f058438715b5200b92ec0f77b51ddbca0f03d112360baafd24bb95 |
| SOURCE | src/lib/tasks/compile.ts                                                                   | 5b0e7333db62aa26011e60f132631e4ca8cc5b246e1f09d006ec63bc67865c93 |
| SOURCE | src/lib/tasks/store.ts                                                                     | a204ba89230f6033c6f9ad81807fb4855ee78945586ec0d3b549571da442d400 |
| SOURCE | src/lib/tasks/rooms.ts                                                                     | fbf2fcead4d3662917a0c63f4109ad29e4bb52778763492fedf46d74f657a687 |
| SOURCE | src/lib/tasks/check.ts                                                                     | 5af7863eccb3d5b199f36076f7c4307c0956ed74654015e58af6e594ec76e2a2 |
| SOURCE | src/lib/tasks/grading.ts                                                                   | 2e7565545d39ecb5f9e1f5b50811d8c018de06fc75bfb5b41309a9e7d8802e03 |
| SOURCE | src/lib/tasks/override.ts                                                                  | bcea831fa40c4f17fdea09e76b9436f93d6588409ac9aaf81651d4b5b7cd1f6a |
| SOURCE | src/lib/tasks/timer.ts                                                                     | 8d0f91d08d9569c65ad5231acb91696bfee086f08145b9438f013e2210cdf758 |
| SOURCE | src/lib/tasks/writing.ts                                                                   | 58d6b9e872b05e62324099e90364e94f5541d74acbc65e316b065e99fe350459 |
| SOURCE | src/lib/tasks/types.ts                                                                     | 4abcd7bb3f2653bc9b4c1c6d79dda390329c4e784ec727df9951624733b04f75 |
| SOURCE | src/lib/tasks/tree.ts                                                                      | 197b4e5ae52e6e0a789f5562f040b476350d17d9c36e637a22fb428eab57a95d |
| SOURCE | src/lib/tasks/ai-prompt.ts                                                                 | b2e2307750a4759aaeee3b4d18c0d202f65053a4c74e3528570b8fb2ebcca215 |
| SOURCE | src/lib/sections/store.ts                                                                  | 22a9809a190b03f80ddcfeea58b054775da91c7ae79d1632f077841b2240f93d |
| SOURCE | src/lib/sections/snapshot.ts                                                               | 4645127cb05051562f6d1b6eb9e261290729b7811d700bc8743eb619d692ba7e |
| SOURCE | src/lib/sections/timing.ts                                                                 | 6a13aafb1ba0f3b31be4a8ffc9b0c3fc0acccabd2f479d69096ccffdba3ed2fe |
| SOURCE | src/lib/tests/runs.ts                                                                      | 59c46195c2c4e56b869de15b1e9abf1ba59e7fea3538d49798983dde3b330cdb |
| SOURCE | src/lib/tests/results.ts                                                                   | e6f4266b1fd3256be0b256b0ddc246bf199fa2d93677e901185e919ea95fc50c |
| SOURCE | src/lib/media/policy.ts                                                                    | dccb07f6ea45355a1505c7238b53e78d6f6e2b4c6b3d3d00b0fdef270b193abf |
| SOURCE | src/lib/media/library.ts                                                                   | c95c7120b3597a3d01c5a1560e0d3993a3e193e79e14ec7be41cd6a73273fd4f |
| SOURCE | src/lib/stats/progress.ts                                                                  | 365a64146ee32fbfe99fb88f16708136c68b4f98502da1b96f4eb1591fc6c5ab |
| SOURCE | src/lib/stats/constants.ts                                                                 | 1a072fa62346cf09d550db8dd3fc53602b11540bb8749a1f4477f68d227b3ed3 |
| SOURCE | src/lib/stats/time.ts                                                                      | 6466a5644a049078b06d47e826c94298d980152cfdff7aa0f7545a53800de1c8 |
| SOURCE | src/lib/stats/attention.ts                                                                 | 050733e223992ddc38839bd5dd2bf07cbea844141acd726544791271c43192af |
| SOURCE | src/lib/stats/question-types.ts                                                            | 2224b6eb589af847c172b1338f5b3dbab363cf0e4cc31295a6f0817fb5599068 |
| SOURCE | src/lib/stats/target.ts                                                                    | a7621107995515b2e477a7fae5de093d4bf33de9efac753f403601db518b971e |
| SOURCE | src/components/exam/frame/use-attempt-sync.ts                                              | b8fcdac5d181bbe3030911530d1e85923e140c6590c5568eb9ca3dcb312d9c30 |
| SOURCE | src/components/exam/frame/exam-frame.tsx                                                   | 410fd3489c9796e01a627f913d0023b8c575a790c28e3a08847e00513f8b1ed5 |
| SOURCE | src/app/teacher/tasks/task-editor.tsx                                                      | 497fe7e80c48fba3ede2f1e82f39412810d751a93977c458533021f1726c980d |
| SOURCE | tests/e2e/lesson-flow.spec.ts                                                              | 6c555e1f74725d518336482732b6e5be5a3ce666a049800963d9e1f07f9e128f |
| SOURCE | tests/e2e/mock-test.spec.ts                                                                | 93d77872ee4bf9ad2bd9e525714f987e73bfddcc46560d292ff508f18bec508c |
| SOURCE | tests/e2e/exam-controls.spec.ts                                                            | e61cc653739e98bb0cb4124b9ea7726c14d4187d04a3948ccd0d52d622890aa4 |
| SOURCE | tests/e2e/student-access.spec.ts                                                           | 32ec205cf4036cc4f99970b985c9344655ba7a6ae30fd95d7183d26b55016dda |
| DESIGN | VERSION                                                                                    | bf022ec33f714d073548153e496277fee35e01749059b7139c34f35294f208cf |
| DESIGN | project/components/StudentHome/README.md                                                   | bec6ac35d91193c202f5085fedfd54b5dad9785f7a028b55f3144717a8d0670a |
| DESIGN | project/components/TeacherHome/README.md                                                   | ffd4f3f7c0bf7d5b31fe296f65457bea9d7209f97ce86a866955d28fa1cb5d09 |
| DESIGN | project/components/StudentProgressPage/README.md                                           | c75423155a1866fbc23e7082a68ea7632c5bfcf70ffa704a1f95aa79a8e6a767 |
| DESIGN | project/components/LessonBoard/README.md                                                   | d3f92539d46379846bb2e69b8e0a5c13212a0fa31d78941fa75621bdd84b8792 |
| DESIGN | project/components/ExamFrame/README.md                                                     | 4fc8e3ff58aa82c8ffa759c2fdba1467b3f5b2322f4948f12beae53bf9311eae |
| DESIGN | project/components/MediaLibrary/README.md                                                  | ca240d6f749f49026266bc88c4c4cf4609e0f564ae10fd0db5ee82eb833cb092 |
| DESIGN | project/components/SectionEditor/README.md                                                 | 819d3539230b5e80939252ea8bc62bc3afebb02301b40e443249881383a7a533 |
| DESIGN | project/components/SectionDialogs/README.md                                                | 3025ca73b51e8386fe7b530d0fa4fc385451ed8d09383f340720926975128514 |
| DESIGN | project/components/BandChart/README.md                                                     | fbc0af15657675cc0d066866927edfda332d7e5feb74bdcfb8c02091c436bfe9 |
| DESIGN | project/components/WritingGradeCard/README.md                                              | 4e9f915b686928dc5c765e4cd102d6e6a63b48fbbaef47ce52d548d576c29b1e |
| DESIGN | project/components/StudentIeltsProfile/README.md                                           | 416bc887dccd40d02c20c057a3af78958f0d9f979e309e5360fd4a14b201d84f |
| DESIGN | project/components/TasksLibrary/README.md                                                  | 310e7cf3d96187713014ac15695c8881eaf9e99037083e4dbca7ef99849b71d1 |
| DESIGN | project/components/MockTestForm/README.md                                                  | 6454be40f9b92b0f8d3253ce8911e3200523ebc69ffa813a56256ed96d2b6bda |
| DESIGN | project/components/ListeningStart/README.md                                                | a97b37b60c84233e5220ac10832114063b53158d0d5e374d783656b866b88837 |
| DESIGN | project/components/ExamWriting/README.md                                                   | 7fa0333ac7c5166c5e9683958233a42364676e471ed0c233a8ee6d020a8eb443 |
| DESIGN | project/components/ExamSubmit/README.md                                                    | a67d2f7d8136974b4821c728b06de753b26cc66cdd10d47c471bb6798b4e5fc5 |

## Research Verification and Metadata

- Native query: node /Users/kdvornichenko/.codex/gsd-core/bin/gsd-tools.cjs query init.phase-op 26 → exit0, phase_found=true, .planning/phases/26-ielts-section. Stale model metadata warning recorded; no models/agents/settings changed.
- Source pin: git rev-parse HEAD in SOURCE → exit0, pinned SHA above; git status --porcelain=v1 → exit0, only ?? AGENTS.md. No Git mutation.
- Discovery/source reads: bounded rg/filesystem symbols. Some exploratory paths absent; they are not treated as owners. Source/current pinned definitions used. No CodeGraph directories → skipped.
- Documentation seam: query research-plan --input /dev/stdin → exit0, context7 fetch plan; actual unavailable lookup provider → official web fallback. query classify-confidence --provider websearch --verified → exit0, MEDIUM. No cache write.
- Package seam: query package-legitimacy check --ecosystem npm with seven actual source packages → exit0, raw OK/SUS retained. --version was rejected semantically although CLI reported exit0; not a passed check. Exact pins then audited through the exported checkPackages({ecosystem,packages,version}) API; statuses above. Registry metadata via Python urllib, no install/cache/files.
- Root guard: bash scripts/gsd/root-pin.sh ROOT → exit0, ROOT_PIN_OK before write.
- Required doc checks: node node_modules/prettier/bin/prettier.cjs --write .planning/phases/26-ielts-section/26-RESEARCH.md --config .prettierrc.json; then --check same file. File-only, no cache.
- Semantic check: Python inline validator checks canonical D/UD/Deferred blocks, six requirement IDs, SC/F/M/P/D/J/E table coverage, 89 input fingerprints, no unresolved template marker, source pin/context immutability and preserved22/23 hashes. Results appended only after execution below.
- Semantic disposition: все SC/F имеют source/solution/owner/Designer/proof. Actual source parity/migration/runtime/metrics не объявлены PASS. App API/provider/DB/browser/build/test не запускались; official docs и registry читались. Commit/shared metadata/other source writes отсутствуют.

**Preparation status:** RESEARCH COMPLETE. Document checks завершились успешно. Runtime, imported counts, private identities, media bytes, active rooms, device/themes и actual migration/parity — UNVERIFIED. Parent владеет plans/design/shared metadata/commits; Server guy — liveops; teacher — D-06 shutdown confirmation.

### Reproducible Semantic Check

Запустить из ROOT. Check читает только artifact и перечисленные fingerprint inputs. Он не запускает app/DB/browser и не записывает файлы.

```bash
python3 - <<'PY'
from pathlib import Path
import hashlib,re,json
root=Path('/Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab')
p=root/'.planning/phases/26-ielts-section/26-RESEARCH.md'
s=p.read_text()
ctx=(p.parent/'26-CONTEXT.md').read_text()
parts=[
ctx.split('## Locked Decisions\n')[1].split('\n## Unreviewed Defaults')[0].strip(),
ctx.split('## Unreviewed Defaults\n')[1].split('\n## Acceptance and Facts')[0].strip(),
ctx.split('## Deferred Ideas\n')[1].strip()]
assert all(x in s for x in parts), 'Canonical context differs'
assert s.index('## User Constraints') < s.index('## Scope Card') < s.index('## Summary')
patterns={
'requirements':(r'^\|\s*(IELTS-\d{2})\s*\|',6),
'SC':(r'^\|\s*(SC\d)\s*\|',5),
'F':(r'^\|\s*(F\d{2})\s*\|',10),
'M':(r'^\|\s*(M\d{2})\s*/',12),
'P':(r'^\|\s*(P\d{2})\s*/',12),
'D':(r'^\|\s*(D26-\d{2})\s*/',8),
'J':(r'^\|\s*(J26-\d{2})\s*/',6),
'E':(r'^\|\s*(E26-\d{2})\b',6)}
counts={}
for label,(pattern,n) in patterns.items():
 rows=re.findall(pattern,s,re.M)
 assert len(set(rows))==n and len(rows)==n,(label,rows)
 counts[label]=n
roots={'TARGET':root,'SOURCE':Path('/Volumes/T7/personal/ielts'),'DESIGN':Path('/Users/kdvornichenko/dv-lab-design')}
rows=re.findall(r'^\|\s*(TARGET|SOURCE|DESIGN)\s*\|([^|]+)\|\s*([a-f0-9]{64})\s*\|',s,re.M)
assert len(rows)==89,len(rows)
changed=[]
for repo,path,digest in rows:
 path=path.strip()
 actual=hashlib.sha256((roots[repo]/path).read_bytes()).hexdigest()
 if actual!=digest:changed.append(repo+'/'+path)
assert not changed,('Input changed; rebind',changed)
for name in ['Stored data','Live service config','OS-registered state','Secrets/env vars','Build artifacts/packages']:
 assert name in s,name
assert 'df57b7000c6adc60f35071065b4423d426d263a0' in s
assert 'UNVERIFIED' in s and 'PROPOSED' in s and 'D-06' in s
body=s.split('### Reproducible Semantic Check')[0]
assert not re.search(r'TODO|TBD|<insert|\[placeholder\]',body)
assert '\u200b' not in s
assert '// Signatures' not in body
assert '38e3a5cfbd03fffbc618886e1fc632aadf6ca417e0f3fa76f3705af09565a708' in s
assert 'f73f6553f9998bc19b45c53e63d190f18f7f19bc6e19e17bdddde62a2184aae1' in s
print('DOC_SEMANTIC_OK',json.dumps(counts,sort_keys=True),'fingerprints=89 canonical=3 preserved22/23=true')
PY
```

**Observed:** semantic command exit0: DOC_SEMANTIC_OK; requirements6 / SC5 / F10 / M12 / P12 / D8 / J6 / E6; fingerprints89; canonical3; preserved22/23=true. Первоначальный regex для E-gates исправлен: первый столбец содержит label после ID, а не только ID. Это correction validator, не runtime pass.

**Observed format:** file-only Prettier --write exit0; --check exit0: All matched files use Prettier code style! Semantic command выше exit0. Эти результаты относятся только к документу и fingerprint inputs; actual runtime остаётся UNVERIFIED.
