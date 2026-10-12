# Phase 26: IELTS Section — Pattern Map

**Дата:** 2026-10-12. **TARGET:** `/Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab`; HEAD `81a11752853260327ba385475547a912b152842b`, source pin `913fc5ae9286aca9a48b5ce4272699c846849874`.
**SOURCE:** `/Volumes/T7/personal/ielts`; HEAD `df57b7000c6adc60f35071065b4423d426d263a0`; read-only, untracked AGENTS сохранён.
**Inventory:** 224 targets; New193, Modified23, Conditional5, Generated3. **Analog:** exact106, role-match104, none14 —210/224.
**UI26:** APPROVED independent UI-CHECK; Parent bound 82 native considerations. Runtime и source22/23/25 implementation остаются UNVERIFIED.

## Scope Card

Результат: full R26 M01–M12/F09 inventory → tracked Source/Target analogs/none; producer→consumer SC1–5/F01–10/P01–12/M01–12/ARCH-A1–4/J26-01–06/E26-01–06. C1: каждый target classified. C2: точные owners/excerpts/signatures/deltas/proof paths. C3: current fingerprints/tracked/doc checks воспроизводимы. Единственная запись — этот26-PATTERNS.md.

В scope: recovered Source6.2 domain/auth/media/migration и necessary Target19/current auth/schema/contracts/composition seams. Вне scope: other docs/shared metadata/source/main/env/DB/media/network/browser/runtime/deps/Git mutations/agents/deletion/external messages, implementation/full research redo/audit/new feature/benchmark. Explicit native GSD mapper через work-router; AgentFlow SUSPENDED. Settled spec, без нового interview/Wayfinder. Source/Target codegraph отсутствуют, rg без indexing.

Work map: inventory→C1; five primary analogs и exact named owner reads→C2; coverage/hash/excerpt/tracking/format→C3. Stop: карта для planner; Parent отдельно связывает finalUI. Старые tests reference-only; Neon main никогда не fixture/reset/TRUNCATE target.

Допущения:

1. Source pin содержит текущий продукт, включая6.2; основание — source code и06.2 CONTEXT/02/07 plans/VERIFICATION. Source verification status human_needed, не Target pass.
2. Final22/23/24/25 меняет Target seam; основание — CONTEXT/ARCH26. Rebind actual account/shell/Registry/schema/API candidate перед execution.
3. Actual counts/media/crosswalk/quiescence/parity неизвестны; основание — R26 external gates. Без них import/rollout enable закрыт. Shutdown требует отдельного teacher confirmation после parity.
4. UI26 не final; основание — текущий task/Parent/Designer. Partial Source UI analog не утверждает final v40 props, state или appearance.

## File Classification

SOURCE/TARGET задают Git root для analog tracking, не путь установки. New = absent proposed Target; Modified = current tracked Target; Conditional = только необходимый helper/attestation delta после rebind; Generated = generator/lock output. Exact = existing role/flow/rule owner, не гарантия готового target поведения. Role-match для Source UI parent означает partial behavioral pattern, не копию всего monolith/Radix/Server Actions. Конкретные direct leaf owners назначены при однозначном имени; остальные связываются с finalUI до implementation.

| ID   | Module | Target                                                            | Status      | Role       | Data Flow        | Tracked analog (repo:path)                                       | Match      | Producer / delta link                                               |
| ---- | ------ | ----------------------------------------------------------------- | ----------- | ---------- | ---------------- | ---------------------------------------------------------------- | ---------- | ------------------------------------------------------------------- |
| I001 | M01    | `packages/contracts/src/ielts/tree.ts`                            | New         | model      | request-response | `SOURCE:src/lib/tasks/types.ts`                                  | role-match | [PROPOSED tree schemas/DTO](#registry)                              |
| I002 | M01    | `packages/contracts/src/ielts/catalog.ts`                         | New         | model      | request-response | `SOURCE:src/lib/tasks/types.ts`                                  | role-match | [PROPOSED catalog schemas/DTO](#registry)                           |
| I003 | M01    | `packages/contracts/src/ielts/lesson.ts`                          | New         | model      | request-response | `SOURCE:src/lib/tasks/types.ts`                                  | role-match | [PROPOSED lesson schemas/DTO](#registry)                            |
| I004 | M01    | `packages/contracts/src/ielts/attempt.ts`                         | New         | model      | request-response | `SOURCE:src/lib/tasks/types.ts`                                  | role-match | [PROPOSED attempt schemas/DTO](#registry)                           |
| I005 | M01    | `packages/contracts/src/ielts/result.ts`                          | New         | model      | request-response | `SOURCE:src/lib/tasks/types.ts`                                  | role-match | [PROPOSED result schemas/DTO](#registry)                            |
| I006 | M01    | `packages/contracts/src/ielts/progress.ts`                        | New         | model      | request-response | `SOURCE:src/lib/tasks/types.ts`                                  | role-match | [PROPOSED progress schemas/DTO](#registry)                          |
| I007 | M01    | `packages/contracts/src/ielts/media.ts`                           | New         | model      | request-response | `SOURCE:src/lib/tasks/types.ts`                                  | role-match | [PROPOSED media schemas/DTO](#registry)                             |
| I008 | M01    | `packages/contracts/src/ielts/import.ts`                          | New         | model      | request-response | `SOURCE:src/lib/tasks/types.ts`                                  | role-match | [PROPOSED import schemas/DTO](#registry)                            |
| I009 | M01    | `packages/contracts/src/index.ts`                                 | Modified    | model      | transform        | `TARGET:packages/contracts/src/index.ts`                         | exact      | [export *](#registry)                                               |
| I010 | M02    | `apps/api/src/auth/accounts.ts`                                   | Modified    | service    | CRUD             | `TARGET:apps/api/src/auth/accounts.ts`                           | exact      | [createStudent/deactivateStudent](#auth)                            |
| I011 | M02    | `apps/api/src/auth/account-import.ts`                             | New         | service    | CRUD             | `TARGET:apps/api/src/auth/accounts.ts`                           | exact      | [PROPOSED importStudentAccount](#auth)                              |
| I012 | M02    | `apps/api/src/auth/student-credentials.ts`                        | New         | service    | CRUD             | `SOURCE:src/lib/auth/accounts.ts`                                | exact      | [PROPOSED resetStudentPassword/reactivateStudentAccount](#auth)     |
| I013 | M02    | `apps/api/src/auth/passwords.ts`                                  | Conditional | utility    | transform        | `TARGET:apps/api/src/auth/passwords.ts`                          | exact      | [verifyPassword/hashPassword; PROPOSED hash validator](#auth)       |
| I014 | M02    | `apps/web/lib/session.ts`                                         | Modified    | utility    | request-response | `TARGET:apps/web/lib/session.ts`                                 | exact      | [getMe/requireTeacherPage; PROPOSED requireIeltsStudentPage](#auth) |
| I015 | M02    | `apps/web/app/login/login-form.tsx`                               | Modified    | component  | request-response | `TARGET:apps/web/app/login/login-form.tsx`                       | exact      | [LoginForm; PROPOSED roleHomePath](#auth)                           |
| I016 | M02    | `apps/web/app/login/page.tsx`                                     | Modified    | route      | request-response | `TARGET:apps/web/app/login/page.tsx`                             | exact      | [LoginPage](#auth)                                                  |
| I017 | M02    | `apps/web/app/(app)/layout.tsx`                                   | Modified    | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | exact      | [AppLayout](#auth)                                                  |
| I018 | M02    | `apps/web/app/(app)/_components/student-landing.tsx`              | Modified    | component  | request-response | `TARGET:apps/web/app/(app)/_components/student-landing.tsx`      | exact      | [PROPOSED IELTS StudentHome adapter](#auth)                         |
| I019 | M03    | `packages/ielts/package.json`                                     | New         | config     | transform        | `TARGET:packages/core/package.json`                              | role-match | [PROPOSED @dv-lab/ielts workspace](#pure)                           |
| I020 | M03    | `packages/ielts/tsconfig.json`                                    | New         | config     | transform        | `TARGET:packages/core/tsconfig.json`                             | role-match | [PROPOSED @dv-lab/ielts workspace](#pure)                           |
| I021 | M03    | `packages/ielts/src/index.ts`                                     | New         | config     | transform        | `TARGET:packages/core/package.json`                              | role-match | [PROPOSED @dv-lab/ielts workspace](#pure)                           |
| I022 | M03    | `packages/ielts/src/timer.ts`                                     | New         | utility    | transform        | `SOURCE:src/lib/tasks/timer.ts`                                  | exact      | [PROPOSED preserved timer exports](#pure)                           |
| I023 | M03    | `packages/ielts/src/check.ts`                                     | New         | utility    | transform        | `SOURCE:src/lib/tasks/check.ts`                                  | exact      | [PROPOSED preserved check exports](#pure)                           |
| I024 | M03    | `packages/ielts/src/answer-normalization.ts`                      | New         | utility    | transform        | `SOURCE:src/lib/tasks/check.ts`                                  | exact      | [PROPOSED preserved answer-normalization exports](#pure)            |
| I025 | M03    | `packages/ielts/src/word-limits.ts`                               | New         | utility    | transform        | `SOURCE:src/lib/tasks/check.ts`                                  | exact      | [PROPOSED preserved word-limits exports](#pure)                     |
| I026 | M03    | `packages/ielts/src/bands.ts`                                     | New         | utility    | transform        | `SOURCE:src/lib/tasks/bands.ts`                                  | exact      | [PROPOSED preserved bands exports](#pure)                           |
| I027 | M03    | `packages/ielts/src/writing.ts`                                   | New         | utility    | transform        | `SOURCE:src/lib/tasks/writing.ts`                                | exact      | [PROPOSED preserved writing exports](#pure)                         |
| I028 | M03    | `packages/ielts/src/tree.ts`                                      | New         | utility    | transform        | `SOURCE:src/lib/tasks/tree.ts`                                   | exact      | [PROPOSED preserved tree exports](#pure)                            |
| I029 | M03    | `packages/ielts/src/marks.ts`                                     | New         | utility    | transform        | `SOURCE:src/lib/sections/marks.ts`                               | exact      | [PROPOSED preserved marks exports](#pure)                           |
| I030 | M03    | `packages/ielts/src/flags.ts`                                     | New         | utility    | transform        | `SOURCE:src/lib/tasks/store.ts`                                  | role-match | [PROPOSED preserved flags exports](#pure)                           |
| I031 | M03    | `packages/ielts/src/snapshot.ts`                                  | New         | utility    | transform        | `SOURCE:src/lib/sections/snapshot.ts`                            | exact      | [PROPOSED preserved snapshot exports](#pure)                        |
| I032 | M03    | `packages/ielts/src/timing.ts`                                    | New         | utility    | transform        | `SOURCE:src/lib/sections/timing.ts`                              | exact      | [PROPOSED preserved timing exports](#pure)                          |
| I033 | M03    | `packages/ielts/src/question-types.ts`                            | New         | utility    | transform        | `SOURCE:src/lib/stats/question-types.ts`                         | exact      | [PROPOSED preserved question-types exports](#pure)                  |
| I034 | M03    | `packages/ielts/src/stats-aggregate.ts`                           | New         | utility    | transform        | `SOURCE:src/lib/stats/aggregate.ts`                              | exact      | [PROPOSED preserved stats-aggregate exports](#pure)                 |
| I035 | M03    | `packages/ielts/src/stats-series.ts`                              | New         | utility    | transform        | `SOURCE:src/lib/stats/series.ts`                                 | exact      | [PROPOSED preserved stats-series exports](#pure)                    |
| I036 | M03    | `packages/ielts/src/stats-time.ts`                                | New         | utility    | transform        | `SOURCE:src/lib/stats/time.ts`                                   | exact      | [PROPOSED preserved stats-time exports](#pure)                      |
| I037 | M03    | `packages/ielts/src/attention.ts`                                 | New         | utility    | transform        | `SOURCE:src/lib/stats/attention.ts`                              | exact      | [PROPOSED preserved attention exports](#pure)                       |
| I038 | M03    | `packages/ielts/src/author-prompt.ts`                             | New         | utility    | transform        | `SOURCE:src/lib/tasks/ai-prompt.ts`                              | exact      | [PROPOSED preserved author-prompt exports](#pure)                   |
| I039 | M04    | `packages/ielts/src/compiler/compile.ts`                          | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler compile producer](#catalog)                      |
| I040 | M04    | `packages/ielts/src/compiler/context.ts`                          | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler context producer](#catalog)                      |
| I041 | M04    | `packages/ielts/src/compiler/settings.ts`                         | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler settings producer](#catalog)                     |
| I042 | M04    | `packages/ielts/src/compiler/inline.ts`                           | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler inline producer](#catalog)                       |
| I043 | M04    | `packages/ielts/src/compiler/blocks.ts`                           | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler blocks producer](#catalog)                       |
| I044 | M04    | `packages/ielts/src/compiler/choice.ts`                           | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler choice producer](#catalog)                       |
| I045 | M04    | `packages/ielts/src/compiler/completion.ts`                       | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler completion producer](#catalog)                   |
| I046 | M04    | `packages/ielts/src/compiler/matching.ts`                         | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler matching producer](#catalog)                     |
| I047 | M04    | `packages/ielts/src/compiler/grid.ts`                             | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler grid producer](#catalog)                         |
| I048 | M04    | `packages/ielts/src/compiler/pool.ts`                             | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler pool producer](#catalog)                         |
| I049 | M04    | `packages/ielts/src/compiler/image.ts`                            | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler image producer](#catalog)                        |
| I050 | M04    | `packages/ielts/src/compiler/diagnostics.ts`                      | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler diagnostics producer](#catalog)                  |
| I051 | M04    | `packages/ielts/src/compiler/reply.ts`                            | New         | utility    | transform        | `SOURCE:src/lib/tasks/compile.ts`                                | exact      | [PROPOSED compiler reply producer](#catalog)                        |
| I052 | M04    | `apps/api/src/ielts/catalog/reads.ts`                             | New         | service    | CRUD             | `SOURCE:src/lib/sections/store.ts`                               | exact      | [PROPOSED reads API owner](#catalog)                                |
| I053 | M04    | `apps/api/src/ielts/catalog/sections.ts`                          | New         | service    | CRUD             | `SOURCE:src/lib/sections/store.ts`                               | exact      | [PROPOSED sections API owner](#catalog)                             |
| I054 | M04    | `apps/api/src/ielts/catalog/mock-tests.ts`                        | New         | service    | CRUD             | `SOURCE:src/lib/sections/store.ts`                               | exact      | [PROPOSED mock-tests API owner](#catalog)                           |
| I055 | M04    | `apps/api/src/ielts/catalog/band-tables.ts`                       | New         | service    | CRUD             | `SOURCE:src/lib/bands/store.ts`                                  | exact      | [PROPOSED band-tables API owner](#catalog)                          |
| I056 | M05    | `apps/api/src/ielts/lessons/rooms.ts`                             | New         | service    | CRUD             | `SOURCE:src/lib/tasks/rooms.ts`                                  | exact      | [PROPOSED rooms owner](#timer)                                      |
| I057 | M05    | `apps/api/src/ielts/lessons/board.ts`                             | New         | service    | CRUD             | `SOURCE:src/lib/tasks/rooms.ts`                                  | exact      | [PROPOSED board owner](#timer)                                      |
| I058 | M05    | `apps/api/src/ielts/lessons/runs.ts`                              | New         | service    | CRUD             | `SOURCE:src/lib/tests/runs.ts`                                   | exact      | [PROPOSED runs owner](#timer)                                       |
| I059 | M05    | `apps/api/src/ielts/lessons/run-step.ts`                          | New         | service    | CRUD             | `SOURCE:src/lib/tests/runs.ts`                                   | exact      | [PROPOSED run-step owner](#timer)                                   |
| I060 | M05    | `apps/api/src/ielts/lessons/commands.ts`                          | New         | service    | CRUD             | `SOURCE:src/lib/tasks/store.ts`                                  | exact      | [PROPOSED commands owner](#timer)                                   |
| I061 | M05    | `apps/api/src/ielts/lessons/command-receipts.ts`                  | New         | store      | CRUD             | —                                                                | none       | [PROPOSED command-receipts owner](#timer)                           |
| I062 | M06    | `apps/api/src/ielts/attempts/reads.ts`                            | New         | service    | CRUD             | `SOURCE:src/lib/tasks/store.ts`                                  | exact      | [PROPOSED reads owner](#timer)                                      |
| I063 | M06    | `apps/api/src/ielts/attempts/student-progress.ts`                 | New         | service    | CRUD             | `SOURCE:src/lib/tasks/store.ts`                                  | exact      | [PROPOSED student-progress owner](#timer)                           |
| I064 | M06    | `apps/api/src/ielts/attempts/timer-commands.ts`                   | New         | service    | CRUD             | `SOURCE:src/lib/tasks/store.ts`                                  | exact      | [PROPOSED timer-commands owner](#timer)                             |
| I065 | M06    | `apps/api/src/ielts/attempts/submission.ts`                       | New         | service    | CRUD             | `SOURCE:src/lib/tasks/store.ts`                                  | exact      | [PROPOSED submission owner](#timer)                                 |
| I066 | M06    | `apps/api/src/ielts/attempts/marks.ts`                            | New         | service    | CRUD             | `SOURCE:src/lib/tasks/store.ts`                                  | exact      | [PROPOSED marks owner](#timer)                                      |
| I067 | M06    | `apps/api/src/ielts/attempts/verdicts.ts`                         | New         | service    | CRUD             | `SOURCE:src/lib/tasks/override.ts`                               | exact      | [PROPOSED verdicts owner](#grading)                                 |
| I068 | M06    | `apps/api/src/ielts/attempts/grading.ts`                          | New         | service    | CRUD             | `SOURCE:src/lib/tasks/grading.ts`                                | exact      | [PROPOSED grading owner](#grading)                                  |
| I069 | M06    | `apps/api/src/ielts/results/reads.ts`                             | New         | service    | CRUD             | `SOURCE:src/lib/tests/results.ts`                                | exact      | [PROPOSED reads result owner](#grading)                             |
| I070 | M06    | `apps/api/src/ielts/results/publication.ts`                       | New         | service    | CRUD             | `SOURCE:src/lib/tests/results.ts`                                | exact      | [PROPOSED publication result owner](#grading)                       |
| I071 | M07    | `apps/api/src/ielts/stats/progress.ts`                            | New         | service    | request-response | `SOURCE:src/lib/stats/progress.ts`                               | role-match | [PROPOSED progress query](#stats)                                   |
| I072 | M07    | `apps/api/src/ielts/stats/history.ts`                             | New         | service    | request-response | `SOURCE:src/lib/stats/progress.ts`                               | role-match | [PROPOSED history query](#stats)                                    |
| I073 | M07    | `apps/api/src/ielts/stats/home.ts`                                | New         | service    | request-response | `SOURCE:src/lib/stats/progress.ts`                               | role-match | [PROPOSED home query](#stats)                                       |
| I074 | M07    | `apps/api/src/ielts/stats/student-summaries.ts`                   | New         | service    | request-response | `SOURCE:src/lib/stats/progress.ts`                               | role-match | [PROPOSED student-summaries query](#stats)                          |
| I075 | M07    | `apps/api/src/ielts/profiles.ts`                                  | New         | service    | CRUD             | `SOURCE:src/lib/auth/accounts.ts`                                | role-match | [PROPOSED profiles owner](#stats)                                   |
| I076 | M07    | `apps/api/src/ielts/versions.ts`                                  | New         | service    | request-response | `SOURCE:src/lib/tasks/store.ts`                                  | role-match | [PROPOSED versions owner](#stats)                                   |
| I077 | M08    | `apps/api/src/ielts/media/policy.ts`                              | New         | service    | CRUD             | `SOURCE:src/lib/media/policy.ts`                                 | role-match | [PROPOSED policy owner](#media)                                     |
| I078 | M08    | `apps/api/src/ielts/media/storage.ts`                             | New         | service    | file-I/O         | —                                                                | none       | [PROPOSED storage owner](#media)                                    |
| I079 | M08    | `apps/api/src/ielts/media/uploads.ts`                             | New         | service    | CRUD             | —                                                                | none       | [PROPOSED uploads owner](#media)                                    |
| I080 | M08    | `apps/api/src/ielts/media/library.ts`                             | New         | service    | CRUD             | `SOURCE:src/lib/media/library.ts`                                | role-match | [PROPOSED library owner](#media)                                    |
| I081 | M08    | `apps/api/src/ielts/media/authorization.ts`                       | New         | service    | CRUD             | —                                                                | none       | [PROPOSED authorization owner](#media)                              |
| I082 | M08    | `apps/api/src/ielts/media/references.ts`                          | New         | service    | transform        | `SOURCE:src/lib/sections/snapshot.ts`                            | role-match | [PROPOSED references owner](#media)                                 |
| I083 | M08    | `apps/api/src/ielts/media/range.ts`                               | New         | service    | file-I/O         | —                                                                | none       | [PROPOSED range owner](#media)                                      |
| I084 | M09    | `apps/web/app/(ielts)/ielts/layout.tsx`                           | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED IELTS layout.tsx](#ui)                                    |
| I085 | M09    | `apps/web/app/(ielts)/ielts/page.tsx`                             | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED IELTS page.tsx](#ui)                                      |
| I086 | M09    | `apps/web/app/(ielts)/ielts/loading.tsx`                          | New         | component  | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED IELTS loading.tsx](#ui)                                   |
| I087 | M09    | `apps/web/app/(ielts)/ielts/error.tsx`                            | New         | component  | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED IELTS error.tsx](#ui)                                     |
| I088 | M09    | `apps/web/app/(ielts)/ielts/progress/page.tsx`                    | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED progress/page.tsx adapter](#ui)                           |
| I089 | M09    | `apps/web/app/(ielts)/ielts/attempts/[id]/page.tsx`               | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED attempts/[id]/page.tsx adapter](#ui)                      |
| I090 | M09    | `apps/web/app/(ielts)/ielts/results/[id]/page.tsx`                | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED results/[id]/page.tsx adapter](#ui)                       |
| I091 | M09    | `apps/web/app/(ielts)/ielts/teacher/page.tsx`                     | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/page.tsx adapter](#ui)                            |
| I092 | M09    | `apps/web/app/(ielts)/ielts/teacher/rooms/page.tsx`               | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/rooms/page.tsx adapter](#ui)                      |
| I093 | M09    | `apps/web/app/(ielts)/ielts/teacher/rooms/[id]/page.tsx`          | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/rooms/[id]/page.tsx adapter](#ui)                 |
| I094 | M09    | `apps/web/app/(ielts)/ielts/teacher/students/page.tsx`            | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/students/page.tsx adapter](#ui)                   |
| I095 | M09    | `apps/web/app/(ielts)/ielts/teacher/students/[id]/page.tsx`       | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/students/[id]/page.tsx adapter](#ui)              |
| I096 | M09    | `apps/web/app/(ielts)/ielts/teacher/tasks/page.tsx`               | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/tasks/page.tsx adapter](#ui)                      |
| I097 | M09    | `apps/web/app/(ielts)/ielts/teacher/tasks/new/page.tsx`           | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/tasks/new/page.tsx adapter](#ui)                  |
| I098 | M09    | `apps/web/app/(ielts)/ielts/teacher/tasks/[id]/page.tsx`          | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/tasks/[id]/page.tsx adapter](#ui)                 |
| I099 | M09    | `apps/web/app/(ielts)/ielts/teacher/tests/new/page.tsx`           | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/tests/new/page.tsx adapter](#ui)                  |
| I100 | M09    | `apps/web/app/(ielts)/ielts/teacher/tests/[id]/page.tsx`          | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/tests/[id]/page.tsx adapter](#ui)                 |
| I101 | M09    | `apps/web/app/(ielts)/ielts/teacher/attempts/[id]/page.tsx`       | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/attempts/[id]/page.tsx adapter](#ui)              |
| I102 | M09    | `apps/web/app/(ielts)/ielts/teacher/results/page.tsx`             | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/results/page.tsx adapter](#ui)                    |
| I103 | M09    | `apps/web/app/(ielts)/ielts/teacher/results/tests/[id]/page.tsx`  | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/results/tests/[id]/page.tsx adapter](#ui)         |
| I104 | M09    | `apps/web/app/(ielts)/ielts/teacher/results/band-tables/page.tsx` | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/results/band-tables/page.tsx adapter](#ui)        |
| I105 | M09    | `apps/web/app/(ielts)/ielts/teacher/media/page.tsx`               | New         | route      | request-response | `TARGET:apps/web/app/(app)/layout.tsx`                           | role-match | [PROPOSED teacher/media/page.tsx adapter](#ui)                      |
| I106 | M09    | `apps/web/components/ielts/shell/student-shell.tsx`               | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED student-shell props](#ui)                                 |
| I107 | M09    | `apps/web/components/ielts/shell/teacher-navigation.tsx`          | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED teacher-navigation props](#ui)                            |
| I108 | M09    | `apps/web/components/ielts/home/student-home.tsx`                 | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED student-home props](#ui)                                  |
| I109 | M09    | `apps/web/components/ielts/home/teacher-home.tsx`                 | New         | component  | event-driven     | `SOURCE:src/app/teacher/(home)/home-view.tsx`                    | role-match | [PROPOSED teacher-home props](#ui)                                  |
| I110 | M09    | `apps/web/components/ielts/lessons/lesson-list.tsx`               | New         | component  | event-driven     | `SOURCE:src/app/teacher/rooms/rooms-view.tsx`                    | role-match | [PROPOSED lesson-list props](#ui)                                   |
| I111 | M09    | `apps/web/components/ielts/lessons/lesson-board.tsx`              | New         | component  | event-driven     | `SOURCE:src/app/teacher/rooms/[id]/room-board.tsx`               | role-match | [PROPOSED lesson-board props](#ui)                                  |
| I112 | M09    | `apps/web/components/ielts/lessons/lesson-dialog.tsx`             | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED lesson-dialog props](#ui)                                 |
| I113 | M09    | `apps/web/components/ielts/lessons/give-dialog.tsx`               | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED give-dialog props](#ui)                                   |
| I114 | M09    | `apps/web/components/ielts/lessons/advance-control.tsx`           | New         | component  | event-driven     | `SOURCE:src/app/teacher/rooms/[id]/advance-control.tsx`          | exact      | [PROPOSED advance-control props](#ui)                               |
| I115 | M09    | `apps/web/components/ielts/lessons/timer-controls.tsx`            | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED timer-controls props](#ui)                                |
| I116 | M09    | `apps/web/components/ielts/editor/section-editor.tsx`             | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED section-editor props](#ui)                                |
| I117 | M09    | `apps/web/components/ielts/editor/markdown-editor.tsx`            | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/markdown-editor.tsx`               | exact      | [PROPOSED markdown-editor props](#ui)                               |
| I118 | M09    | `apps/web/components/ielts/editor/part-tabs.tsx`                  | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/part-tabs.tsx`                     | exact      | [PROPOSED part-tabs props](#ui)                                     |
| I119 | M09    | `apps/web/components/ielts/editor/section-preview.tsx`            | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED section-preview props](#ui)                               |
| I120 | M09    | `apps/web/components/ielts/editor/section-settings.tsx`           | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED section-settings props](#ui)                              |
| I121 | M09    | `apps/web/components/ielts/editor/section-checklist.tsx`          | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/section-checklist.tsx`             | exact      | [PROPOSED section-checklist props](#ui)                             |
| I122 | M09    | `apps/web/components/ielts/editor/media-dialog.tsx`               | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED media-dialog props](#ui)                                  |
| I123 | M09    | `apps/web/components/ielts/editor/ai-prompt-dialog.tsx`           | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/ai-prompt-dialog.tsx`              | exact      | [PROPOSED ai-prompt-dialog props](#ui)                              |
| I124 | M09    | `apps/web/components/ielts/editor/reply-dialog.tsx`               | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED reply-dialog props](#ui)                                  |
| I125 | M09    | `apps/web/components/ielts/catalog/tasks-library.tsx`             | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/tasks-view.tsx`                    | role-match | [PROPOSED tasks-library props](#ui)                                 |
| I126 | M09    | `apps/web/components/ielts/catalog/mock-test-form.tsx`            | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED mock-test-form props](#ui)                                |
| I127 | M09    | `apps/web/components/ielts/catalog/band-tables.tsx`               | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED band-tables props](#ui)                                   |
| I128 | M09    | `apps/web/components/ielts/exam/exam-frame.tsx`                   | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | exact      | [PROPOSED exam-frame props](#ui)                                    |
| I129 | M09    | `apps/web/components/ielts/exam/exam-panes.tsx`                   | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-panes.tsx`                | exact      | [PROPOSED exam-panes props](#ui)                                    |
| I130 | M09    | `apps/web/components/ielts/exam/exam-header.tsx`                  | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-header.tsx`               | exact      | [PROPOSED exam-header props](#ui)                                   |
| I131 | M09    | `apps/web/components/ielts/exam/exam-navigator.tsx`               | New         | component  | event-driven     | `SOURCE:src/components/exam/navigator/navigator.tsx`             | role-match | [PROPOSED exam-navigator props](#ui)                                |
| I132 | M09    | `apps/web/components/ielts/exam/submit-dialog.tsx`                | New         | component  | event-driven     | `SOURCE:src/components/exam/navigator/submit-dialog.tsx`         | exact      | [PROPOSED submit-dialog props](#ui)                                 |
| I133 | M09    | `apps/web/components/ielts/exam/submission-page.tsx`              | New         | component  | event-driven     | `SOURCE:src/components/exam/navigator/submission-page.tsx`       | exact      | [PROPOSED submission-page props](#ui)                               |
| I134 | M09    | `apps/web/components/ielts/exam/end-screens.tsx`                  | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/end-screens.tsx`               | exact      | [PROPOSED end-screens props](#ui)                                   |
| I135 | M09    | `apps/web/components/ielts/exam/writing.tsx`                      | New         | component  | event-driven     | `SOURCE:src/components/exam/questions/essay.tsx`                 | role-match | [PROPOSED writing props](#ui)                                       |
| I136 | M09    | `apps/web/components/ielts/exam/review.tsx`                       | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED review props](#ui)                                        |
| I137 | M09    | `apps/web/components/ielts/exam/writing-review.tsx`               | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED writing-review props](#ui)                                |
| I138 | M09    | `apps/web/components/ielts/exam/selection-tools.tsx`              | New         | component  | event-driven     | `SOURCE:src/components/exam/marks/selection-tools.tsx`           | exact      | [PROPOSED selection-tools props](#ui)                               |
| I139 | M09    | `apps/web/components/ielts/exam/notes-sheet.tsx`                  | New         | component  | event-driven     | `SOURCE:src/components/exam/marks/notes-sheet.tsx`               | exact      | [PROPOSED notes-sheet props](#ui)                                   |
| I140 | M09    | `apps/web/components/ielts/exam/questions/blocks.tsx`             | New         | component  | event-driven     | `SOURCE:src/components/exam/questions/blocks.tsx`                | exact      | [PROPOSED blocks props](#ui)                                        |
| I141 | M09    | `apps/web/components/ielts/exam/questions/inline.tsx`             | New         | component  | event-driven     | `SOURCE:src/components/exam/questions/inline.tsx`                | exact      | [PROPOSED inline props](#ui)                                        |
| I142 | M09    | `apps/web/components/ielts/exam/questions/typed-gap.tsx`          | New         | component  | event-driven     | `SOURCE:src/components/exam/questions/typed-gap.tsx`             | exact      | [PROPOSED typed-gap props](#ui)                                     |
| I143 | M09    | `apps/web/components/ielts/exam/questions/choice.tsx`             | New         | component  | event-driven     | `SOURCE:src/components/exam/questions/choice.tsx`                | exact      | [PROPOSED choice props](#ui)                                        |
| I144 | M09    | `apps/web/components/ielts/exam/questions/radio-grid.tsx`         | New         | component  | event-driven     | `SOURCE:src/components/exam/questions/grid.tsx`                  | role-match | [PROPOSED radio-grid props](#ui)                                    |
| I145 | M09    | `apps/web/components/ielts/exam/questions/drag-pool.tsx`          | New         | component  | event-driven     | `SOURCE:src/components/exam/drag/drag-pool.tsx`                  | exact      | [PROPOSED drag-pool props](#ui)                                     |
| I146 | M09    | `apps/web/components/ielts/exam/questions/image-pins.tsx`         | New         | component  | event-driven     | `SOURCE:src/components/exam/questions/image-block.tsx`           | role-match | [PROPOSED image-pins props](#ui)                                    |
| I147 | M09    | `apps/web/components/ielts/exam/audio/listening-gate.tsx`         | New         | component  | event-driven     | `SOURCE:src/components/exam/listening/listening-gate.tsx`        | exact      | [PROPOSED listening-gate props](#ui)                                |
| I148 | M09    | `apps/web/components/ielts/exam/audio/recording-player.tsx`       | New         | component  | event-driven     | `SOURCE:src/components/exam/listening/listening-gate.tsx`        | role-match | [PROPOSED recording-player props](#ui)                              |
| I149 | M09    | `apps/web/components/ielts/exam/audio/volume-control.tsx`         | New         | component  | event-driven     | `SOURCE:src/components/ui/volume-control.tsx`                    | exact      | [PROPOSED volume-control props](#ui)                                |
| I150 | M09    | `apps/web/components/ielts/results/result-list.tsx`               | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED result-list props](#ui)                                   |
| I151 | M09    | `apps/web/components/ielts/results/test-result.tsx`               | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED test-result props](#ui)                                   |
| I152 | M09    | `apps/web/components/ielts/results/grade-panel.tsx`               | New         | component  | event-driven     | `SOURCE:src/app/teacher/attempts/[id]/grading-panel.tsx`         | role-match | [PROPOSED grade-panel props](#ui)                                   |
| I153 | M09    | `apps/web/components/ielts/results/writing-grade-card.tsx`        | New         | component  | event-driven     | `SOURCE:src/components/task/writing-grade-card.tsx`              | exact      | [PROPOSED writing-grade-card props](#ui)                            |
| I154 | M09    | `apps/web/components/ielts/results/verdict-controls.tsx`          | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED verdict-controls props](#ui)                              |
| I155 | M09    | `apps/web/components/ielts/progress/student-profile.tsx`          | New         | component  | event-driven     | `SOURCE:src/app/teacher/students/[id]/student-tabs.tsx`          | role-match | [PROPOSED student-profile props](#ui)                               |
| I156 | M09    | `apps/web/components/ielts/progress/progress-page.tsx`            | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED progress-page props](#ui)                                 |
| I157 | M09    | `apps/web/components/ielts/progress/band-chart.tsx`               | New         | component  | event-driven     | `SOURCE:src/components/stats/band-chart-card.tsx`                | role-match | [PROPOSED band-chart props](#ui)                                    |
| I158 | M09    | `apps/web/components/ielts/progress/progress-tiles.tsx`           | New         | component  | event-driven     | `SOURCE:src/components/stats/progress-tiles.tsx`                 | exact      | [PROPOSED progress-tiles props](#ui)                                |
| I159 | M09    | `apps/web/components/ielts/progress/type-accuracy.tsx`            | New         | component  | event-driven     | `SOURCE:src/components/stats/type-accuracy-card.tsx`             | role-match | [PROPOSED type-accuracy props](#ui)                                 |
| I160 | M09    | `apps/web/components/ielts/progress/writing-criteria.tsx`         | New         | component  | event-driven     | `SOURCE:src/components/stats/writing-criteria-card.tsx`          | role-match | [PROPOSED writing-criteria props](#ui)                              |
| I161 | M09    | `apps/web/components/ielts/progress/practice-time.tsx`            | New         | component  | event-driven     | `SOURCE:src/components/stats/practice-time-card.tsx`             | role-match | [PROPOSED practice-time props](#ui)                                 |
| I162 | M09    | `apps/web/components/ielts/progress/weak-spots.tsx`               | New         | component  | event-driven     | `SOURCE:src/components/exam/frame/exam-frame.tsx`                | role-match | [PROPOSED weak-spots props](#ui)                                    |
| I163 | M09    | `apps/web/components/ielts/progress/lesson-history.tsx`           | New         | component  | event-driven     | `SOURCE:src/components/stats/lesson-group-list.tsx`              | role-match | [PROPOSED lesson-history props](#ui)                                |
| I164 | M09    | `apps/web/components/ielts/media/media-library.tsx`               | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED media-library props](#ui)                                 |
| I165 | M09    | `apps/web/components/ielts/media/media-details.tsx`               | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED media-details props](#ui)                                 |
| I166 | M09    | `apps/web/components/ielts/media/upload-dialog.tsx`               | New         | component  | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED upload-dialog props](#ui)                                 |
| I167 | M09    | `apps/web/components/ielts/editor/section-draft.ts`               | New         | store      | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED section-draft controller](#ui)                            |
| I168 | M09    | `apps/web/components/ielts/editor/use-section-editor.ts`          | New         | hook       | event-driven     | `SOURCE:src/app/teacher/tasks/task-editor.tsx`                   | role-match | [PROPOSED use-section-editor controller](#ui)                       |
| I169 | M09    | `apps/web/components/ielts/exam/use-attempt-sync.ts`              | New         | hook       | event-driven     | `SOURCE:src/components/exam/frame/use-attempt-sync.ts`           | exact      | [PROPOSED use-attempt-sync controller](#ui)                         |
| I170 | M09    | `apps/web/components/ielts/exam/use-attempt-clock.ts`             | New         | hook       | event-driven     | `SOURCE:src/components/exam/frame/use-attempt-sync.ts`           | role-match | [PROPOSED use-attempt-clock controller](#ui)                        |
| I171 | M09    | `apps/web/components/ielts/exam/use-attempt-poll.ts`              | New         | hook       | event-driven     | `SOURCE:src/components/exam/frame/use-attempt-sync.ts`           | role-match | [PROPOSED use-attempt-poll controller](#ui)                         |
| I172 | M09    | `apps/web/components/ielts/exam/use-progress-save.ts`             | New         | hook       | event-driven     | `SOURCE:src/components/exam/frame/use-attempt-sync.ts`           | role-match | [PROPOSED use-progress-save controller](#ui)                        |
| I173 | M09    | `apps/web/components/ielts/exam/use-attempt-submit.ts`            | New         | hook       | event-driven     | `SOURCE:src/components/exam/frame/use-attempt-sync.ts`           | role-match | [PROPOSED use-attempt-submit controller](#ui)                       |
| I174 | M09    | `apps/web/components/ielts/exam/attempt-draft.ts`                 | New         | store      | event-driven     | `SOURCE:src/components/exam/frame/use-attempt-sync.ts`           | role-match | [PROPOSED attempt-draft controller](#ui)                            |
| I175 | M09    | `apps/web/components/ielts/exam/audio/use-recording-sequence.ts`  | New         | hook       | event-driven     | `SOURCE:src/components/exam/listening/use-recording-sequence.ts` | exact      | [PROPOSED use-recording-sequence controller](#ui)                   |
| I176 | M09    | `apps/web/components/ielts/exam/audio/use-audio-timeline.ts`      | New         | hook       | event-driven     | `SOURCE:src/components/exam/listening/use-audio-timeline.ts`     | exact      | [PROPOSED use-audio-timeline controller](#ui)                       |
| I177 | M09    | `apps/web/lib/ielts-client.ts`                                    | New         | utility    | request-response | `TARGET:apps/web/lib/api-client.ts`                              | exact      | [PROPOSED IELTS API adapter](#shared)                               |
| I178 | M10    | `apps/api/src/import-ielts.ts`                                    | New         | controller | batch            | `TARGET:apps/api/src/import-vault.ts`                            | exact      | [PROPOSED CLI entry](#import)                                       |
| I179 | M10    | `apps/api/src/ielts/import/packet.ts`                             | New         | model      | transform        | —                                                                | none       | [PROPOSED packet import owner](#import)                             |
| I180 | M10    | `apps/api/src/ielts/import/identity.ts`                           | New         | service    | batch            | —                                                                | none       | [PROPOSED identity import owner](#import)                           |
| I181 | M10    | `apps/api/src/ielts/import/media-map.ts`                          | New         | service    | transform        | —                                                                | none       | [PROPOSED media-map import owner](#import)                          |
| I182 | M10    | `apps/api/src/ielts/import/apply.ts`                              | New         | service    | batch            | `TARGET:apps/api/src/import/apply-packet.ts`                     | role-match | [PROPOSED apply import owner](#import)                              |
| I183 | M10    | `apps/api/src/ielts/import/rows.ts`                               | New         | service    | batch            | `TARGET:apps/api/src/import/apply-packet.ts`                     | role-match | [PROPOSED rows import owner](#import)                               |
| I184 | M10    | `apps/api/src/ielts/import/reconcile.ts`                          | New         | service    | batch            | —                                                                | none       | [PROPOSED reconcile import owner](#import)                          |
| I185 | M10    | `apps/api/src/ielts/import/journal.ts`                            | New         | store      | batch            | —                                                                | none       | [PROPOSED journal import owner](#import)                            |
| I186 | M10    | `packages/db/src/ielts-catalog-schema.ts`                         | New         | model      | CRUD             | `SOURCE:src/lib/db/schema.ts`                                    | exact      | [PROPOSED catalog schema](#schema)                                  |
| I187 | M10    | `packages/db/src/ielts-session-schema.ts`                         | New         | model      | CRUD             | `SOURCE:src/lib/db/schema.ts`                                    | exact      | [PROPOSED session schema](#schema)                                  |
| I188 | M10    | `packages/db/src/ielts-attempt-schema.ts`                         | New         | model      | CRUD             | `SOURCE:src/lib/db/schema.ts`                                    | exact      | [PROPOSED attempt schema](#schema)                                  |
| I189 | M10    | `packages/db/src/ielts-media-schema.ts`                           | New         | model      | CRUD             | `SOURCE:src/lib/db/schema.ts`                                    | exact      | [PROPOSED media schema](#schema)                                    |
| I190 | M10    | `packages/db/src/ielts-import-schema.ts`                          | New         | model      | CRUD             | `SOURCE:src/lib/db/schema.ts`                                    | exact      | [PROPOSED import schema](#schema)                                   |
| I191 | M10    | `packages/db/src/index.ts`                                        | Modified    | config     | transform        | `TARGET:packages/db/src/index.ts`                                | exact      | [existing schema/bundle exports](#schema)                           |
| I192 | M10    | `packages/db/drizzle.config.ts`                                   | Modified    | config     | transform        | `TARGET:packages/db/drizzle.config.ts`                           | role-match | [existing schema/bundle exports](#schema)                           |
| I193 | M10    | `packages/db/package.json`                                        | Modified    | config     | transform        | `TARGET:packages/db/package.json`                                | role-match | [existing schema/bundle exports](#schema)                           |
| I194 | M10    | `packages/db/drizzle/<generated>/migration.sql`                   | Generated   | migration  | batch            | —                                                                | none       | [PROPOSED generator output](#schema)                                |
| I195 | M10    | `packages/db/drizzle/<generated>/snapshot.json`                   | Generated   | config     | batch            | —                                                                | none       | [PROPOSED generator output](#schema)                                |
| I196 | M11    | `e2e/ielts-lessons.spec.ts`                                       | New         | test       | request-response | `SOURCE:tests/e2e/lesson-flow.spec.ts`                           | role-match | [PROPOSED durable ielts-lessons journey](#e2e)                      |
| I197 | M11    | `e2e/ielts-results.spec.ts`                                       | New         | test       | request-response | `SOURCE:tests/e2e/mock-test.spec.ts`                             | role-match | [PROPOSED durable ielts-results journey](#e2e)                      |
| I198 | M11    | `e2e/ielts-authoring.spec.ts`                                     | New         | test       | request-response | —                                                                | none       | [PROPOSED durable ielts-authoring journey](#e2e)                    |
| I199 | M11    | `e2e/ielts-access-import.spec.ts`                                 | New         | test       | request-response | `SOURCE:tests/e2e/student-access.spec.ts`                        | role-match | [PROPOSED durable ielts-access-import journey](#e2e)                |
| I200 | M11    | `e2e/support/ielts.ts`                                            | New         | test       | request-response | `TARGET:e2e/support/target.ts`                                   | role-match | [PROPOSED scoped fixture/attestation](#e2e)                         |
| I201 | M11    | `e2e/support/test.ts`                                             | Conditional | test       | request-response | `TARGET:e2e/support/test.ts`                                     | exact      | [existing support boundary](#e2e)                                   |
| I202 | M11    | `e2e/support/api.ts`                                              | Conditional | test       | request-response | `TARGET:e2e/support/api.ts`                                      | exact      | [existing support boundary](#e2e)                                   |
| I203 | M11    | `e2e/support/target.ts`                                           | Conditional | test       | request-response | `TARGET:e2e/support/target.ts`                                   | exact      | [existing support boundary](#e2e)                                   |
| I204 | M11    | `e2e/support/data.ts`                                             | Conditional | test       | request-response | `TARGET:e2e/support/data.ts`                                     | exact      | [existing support boundary](#e2e)                                   |
| I205 | M12    | `apps/api/src/config.ts`                                          | Modified    | config     | transform        | `TARGET:apps/api/src/config.ts`                                  | exact      | [existing composition/deploy owner](#deploy)                        |
| I206 | M12    | `apps/api/src/server.ts`                                          | Modified    | config     | transform        | `TARGET:apps/api/src/server.ts`                                  | exact      | [existing composition/deploy owner](#deploy)                        |
| I207 | M12    | `apps/api/src/app.ts`                                             | Modified    | config     | transform        | `TARGET:apps/api/src/app.ts`                                     | exact      | [existing composition/deploy owner](#deploy)                        |
| I208 | M12    | `apps/api/src/lifecycle.ts`                                       | Modified    | config     | transform        | `TARGET:apps/api/src/lifecycle.ts`                               | exact      | [existing composition/deploy owner](#deploy)                        |
| I209 | M12    | `apps/api/tsdown.config.ts`                                       | Modified    | config     | transform        | `TARGET:apps/api/tsdown.config.ts`                               | exact      | [existing composition/deploy owner](#deploy)                        |
| I210 | M12    | `apps/api/package.json`                                           | Modified    | config     | transform        | `TARGET:apps/api/package.json`                                   | exact      | [existing composition/deploy owner](#deploy)                        |
| I211 | M12    | `apps/web/package.json`                                           | Modified    | config     | transform        | `TARGET:apps/web/package.json`                                   | exact      | [existing composition/deploy owner](#deploy)                        |
| I212 | M12    | `apps/web/next.config.ts`                                         | Modified    | config     | transform        | `TARGET:apps/web/next.config.ts`                                 | exact      | [existing composition/deploy owner](#deploy)                        |
| I213 | M12    | `deploy/compose.yaml`                                             | Modified    | config     | transform        | `TARGET:deploy/compose.yaml`                                     | exact      | [existing composition/deploy owner](#deploy)                        |
| I214 | M12    | `deploy/env.example`                                              | Modified    | config     | transform        | `TARGET:deploy/env.example`                                      | exact      | [existing composition/deploy owner](#deploy)                        |
| I215 | M12    | `deploy/backup/backup.sh`                                         | Modified    | config     | file-I/O         | `TARGET:deploy/backup/backup.sh`                                 | exact      | [existing composition/deploy owner](#deploy)                        |
| I216 | M12    | `deploy/backup/restore-check.sh`                                  | Modified    | config     | file-I/O         | `TARGET:deploy/backup/restore-check.sh`                          | exact      | [existing composition/deploy owner](#deploy)                        |
| I217 | M12    | `deploy/RUNBOOK.md`                                               | Modified    | config     | transform        | `TARGET:apps/api/src/import-vault.ts`                            | role-match | [existing composition/deploy owner](#deploy)                        |
| I218 | M12    | `apps/api/src/routes/ielts-catalog.ts`                            | New         | route      | request-response | `TARGET:apps/api/src/auth/middleware.ts`                         | role-match | [PROPOSED /ielts/catalog Hono routes](#shared)                      |
| I219 | M12    | `apps/api/src/routes/ielts-lessons.ts`                            | New         | route      | request-response | `TARGET:apps/api/src/auth/middleware.ts`                         | role-match | [PROPOSED /ielts/lessons Hono routes](#shared)                      |
| I220 | M12    | `apps/api/src/routes/ielts-attempts.ts`                           | New         | route      | request-response | `TARGET:apps/api/src/auth/middleware.ts`                         | role-match | [PROPOSED /ielts/attempts Hono routes](#shared)                     |
| I221 | M12    | `apps/api/src/routes/ielts-results.ts`                            | New         | route      | request-response | `TARGET:apps/api/src/auth/middleware.ts`                         | role-match | [PROPOSED /ielts/results Hono routes](#shared)                      |
| I222 | M12    | `apps/api/src/routes/ielts-progress.ts`                           | New         | route      | request-response | `TARGET:apps/api/src/auth/middleware.ts`                         | role-match | [PROPOSED /ielts/progress Hono routes](#shared)                     |
| I223 | M12    | `apps/api/src/routes/ielts-media.ts`                              | New         | route      | request-response | `TARGET:apps/api/src/auth/middleware.ts`                         | role-match | [PROPOSED /ielts/media Hono routes](#shared)                        |
| I224 | M12    | `yarn.lock`                                                       | Generated   | config     | batch            | —                                                                | none       | [PROPOSED dependency resolution](#deploy)                           |

## Pattern Assignments

Каждый inventory target получает producer/delta по своему M и concrete link. Public signatures R26:322–398 — PROPOSED, не existing wire/API. Registry определяет DTO/enums/schema один раз; инструкции не дублируют wire definitions. Parent before additional implementation file updates inventory; подготовка не пишет ни один Target/Source file.

| Module | Producer → consumer / exact signatures or proposed boundary                                           | Required delta / criteria                                                                                                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M01    | IELTS tree/catalog/lesson/attempt/result/progress/media/import Registry → shared pure package/API/web | Separate TeacherAttemptDto/StudentAttemptDto, Date ISO/Maps lists, strict unknown validation; SC1–5/F02/F09                                                                                                     |
| M02    | auth/accounts import/lifecycle → import CLI/IELTS management/page guards                              | PROPOSED importStudentAccount(tx,input), resetStudentPassword(db,input), reactivateStudentAccount(db,id), roleHomePath(role), requireIeltsStudentPage(); SC1/4/F02/03/A1                                        |
| M03    | same source timer/check/bands/tree/writing/snapshot/stats exports → M04–M09                           | Pure source rules, no second checker/math/engine/DB/env/Node; SC2/3/5                                                                                                                                           |
| M04    | same compiler responsibility modules+saveSection/saveMockTest/band versions → authoring/Give          | PROPOSED saveSection(db,actor,id,input), saveMockTest(db,actor,id,input); immutable snapshots/readiness/diagnostics; SC2/3                                                                                      |
| M05    | room/run/step/command receipt → lesson board/teacher commands                                         | PROPOSED createLesson/endLesson/giveToStudents/advanceRun/commandAttempts(db,ctx,input,now); key/digest effect+receipt before ACK; SC3/A2                                                                       |
| M06    | student/teacher reads+progress/timer/submission/verdict/grading/publication → exam/results            | PROPOSED getStudentAttempt/getTeacherAttempt/openAttempt/saveStudentProgress/submitStudentAttempt/studentPauseAttempt/saveReviewMarks/changeTeacherMark/setQuestionVerdict/saveWritingGrade/publishResults; SC3 |
| M07    | query audience/profiles/versions → progress/history/home/profile                                      | PROPOSED loadProgress(db,actor,studentAccountId,options), readVersion(db,actor,scope); same6.2 caps/visibility/local-day; SC3/5                                                                                 |
| M08    | reservation/storage/reference/authorization/range owner → authoring/exam/import/library               | PROPOSED reserveMediaUpload/acceptMediaBytes/readMediaStatus/openAuthorizedMedia/retireMedia/serveMedia; authenticated identity, server bytes/hash; SC2/4/A3/A4                                                 |
| M09    | role-checked routes/typed ielts-client and behavior controllers → approved UI26                       | PROPOSED StudentHome/LessonBoard/SectionEditor/ExamFrame/ProgressPage/MediaLibrary props from R26; final appearance/state gates pending; SC1/2/3/5                                                              |
| M10    | validated packet/crosswalk/media-map+rows/journal/reconcile → operator CLI/public migrated read       | PROPOSED validateImport(raw,binding), applyImport(db,input,checkpoint), reconcileImport(db,input); stable mapped IDs/references/digests; SC4/A1/A3                                                              |
| M11    | existing attested public runner+new four specs/scoped support → six journeys                          | Failure-first J26-01–06 before behavior; no Source reset/new isolated suite; all/F10                                                                                                                            |
| M12    | existing config/composition/build/deploy/DB+media backup → enabled IELTS app/import/storage           | Same DB roles, IELTS config names/mount/entry, signed candidate/operator readiness; SC2/4/A4                                                                                                                    |

### registry

SOURCE tasks/types current task kinds/part limits/modules define semantic values; Target contracts style owns Zod/type boundary. Tree schema1/2 preserve old IDs, optional fields and key separation. Actor only verified session, never request JSON. StudentAttemptDto removes answerKey/teacher override marker/unpublished/private fields. Raw input unknown only until validated; public error enums once in Registry. Future22/23/25 paths NOT SOURCE, не analog/dependency implementation proof.
**SOURCE/src/lib/tasks/types.ts:3–15**

```ts
export const taskKinds = ['reading', 'listening', 'writing'] as const
export type TaskKind = (typeof taskKinds)[number]

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
	reading: 'Reading',
	listening: 'Listening',
	writing: 'Writing',
}

export const PART_LIMITS: Record<TaskKind, number> = { listening: 4, reading: 3, writing: 2 }

export const sectionModules = ['academic', 'general'] as const
export type SectionModule = (typeof sectionModules)[number]
```

### auth

**Primary1:** Target auth/accounts and Source account lifecycle. Source/Target scrypt profiles match; no second hash/session engine.
**SOURCE/src/lib/auth/passwords.ts:15–19**

```ts
const SCRYPT_PROFILE = Object.freeze({ N: 2 ** 15, r: 8, p: 3 })
const SCRYPT_KEY_BYTES = 32
const SCRYPT_SALT_BYTES = 16
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024
const HASH_PATTERN = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/
```

**TARGET/apps/api/src/auth/passwords.ts:8–12**

```ts
const SCRYPT_PROFILE = Object.freeze({ N: 2 ** 15, r: 8, p: 3 })
const SCRYPT_KEY_BYTES = 32
const SCRYPT_SALT_BYTES = 16
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024
const HASH_PATTERN = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/
```

Current Target createStudent(executor:DbExecutor,input:CreateStudentInput):Promise<CreateStudentResult> (82) supports studentId:null but generates ID/hash; not verified legacy hash import. deactivateStudent(db,input:{accountId,studentId}):Promise<DeactivateStudentResult> (161) binds card:
**TARGET/apps/api/src/auth/accounts.ts:163–175**

```ts
const [locked] = await tx
	.select({ id: accounts.id })
	.from(accounts)
	.where(
		and(
			eq(accounts.id, input.accountId),
			eq(accounts.studentId, input.studentId),
			eq(accounts.role, 'student'),
			eq(accounts.status, 'active')
		)
	)
	.for('update')
if (!locked) return { kind: 'not_found' }
```

A1 producer extends same auth/accounts sole writer with strict validated import/lifecycle. Preserve card facade binding; IELTS-only lifecycle account-level. Source resetStudentPassword:180/deactivateStudent:204/reactivateStudent:219 specify status/epoch/revoke session; use target epoch/session owner. Import validates known scrypt profile/encoding, source status/login/timestamps and explicit private legacyUser→targetAccount→optionalCard crosswalk; UUID/login/card collision stops affected readiness. Never match name or guess UUID/overwrite unrelated account. Credential hash type is CLI-private, not public request.

Target getMe/requireTeacherPage and login signed session currently student routes to /. PROPOSED roleHomePath teacher /, student /ielts; root non-IELTS AppLayout and API reject student before data, teacher-only IELTS subtree likewise. Student object-owned attempt/result/progress/media; backend401/403/foreign404 including HEAD/Range before stat/ETag. Keep student-landing.tsx as used adapter, no deletion for knip. J01/J06 prove mapped login, null-card reset/reactivation/deactivation, revoked sessions and collisions.

### pure

Shared package adapts source dependencies/types, not independent exam engine. Current SOURCE timer constants/grace/writing/check/tree/bands/snapshot/timing/marks/flags/question-types/aggregate/series/time/attention/prompt preserve semantics. No Node/db/env in pure paths; @markdoc is explicit compiler dependency. Existing core remains money/schedule owner, no unrelated changes.
**SOURCE/src/lib/tasks/timer.ts:44–47**

```ts
export function adjust(state: TimerState, deltaMs: number, now: Date): TimerState {
	const remaining = state.untimed
		? state.remainingMs
		: Math.min(MAX_REMAINING_MS, Math.max(0, remainingAt(state, now) + deltaMs))
	return withUntimed(state, {
		remainingMs: remaining,
		runningSince: state.runningSince === null ? null : now,
		elapsedMs: elapsedAt(state, now),
	})
}
```

Source adjust is non-idempotent by itself. New command receipt, not arithmetic rewrite. Stored snapshots/recorded keys/band-table versions remain authoritative; import never recompile/recheck. Author prompt/splitReply is copy-only teacher helper, no paid AI/ML app call. Package exact pins use research evidence/age1440, not install/compatibility PASS.

### catalog

**Primary2:** SOURCE sections/store and compiler. CompileTask(source:string):CompileResult; compileSection(parts,header):SectionCompileResult; splitReply/readiness/schema remain same.
**SOURCE/src/lib/tasks/compile.ts:1214–1216**

```ts
export function compileTask(source: string): CompileResult {
	return run(source).result
}
```

**SOURCE/src/lib/sections/snapshot.ts:46–63**

```ts
	const { header, positions } = input
	const wanted = positions === null ? null : new Set(positions)
	const chosen = input.parts
		.filter((part) => wanted === null || wanted.has(part.position))
		.sort((a, b) => a.position - b.position)
	const offsets = partStartOffsets(chosen.map((part) => (part.audioUrl === null ? null : part.audioDurationMs)))
	const answerKey: AnswerKey = {}
	const mediaUrls: string[] = []
	const addUrl = (url: string | null) => {
		if (url !== null && !mediaUrls.includes(url)) mediaUrls.push(url)
	}
	const trees = chosen.map((part, order) => {
		const read = readPartTree(part.tree, header.skill, part.position)
		const placed = applyPositions(read, part.positions)
		const numbers = new Set(placed.numbers.map(String))
		for (const [number, entry] of Object.entries(part.answerKey)) if (numbers.has(number)) answerKey[number] = entry
		addUrl(part.audioUrl)
		addUrl(part.imageUrl)
```

744-line sections/store and1469-line compiler split by compile context/settings/inline/block/question/layout/media/diagnostic/reply and reads/sections/mock/band-table responsibilities, not mechanical slices. Section save preserves explicit removedPositions, multipartL4/R3/W2/MAX_PARTS8, minutes1…300/title120, field diagnostics and immutable historical snapshots. Mock slots L→R→W/module/kind/readiness; save can keep warnings, Give refuses not_ready. Logical retirement/archiving retains parts/attempts/refs; no physical cleanup. Local preview/server same compiler. A3 replaces public playback projection, not canonical author provenance/IDs/tree.

### timer

**Primary3:** Source tasks/store + room/run locks, open/FromStep. Current commandAttemptsIn(tx,ids,TimerCommand,now):Promise<number>; commandAttempts(ids,command,now):Promise<number>. No key/receipt:
**SOURCE/src/lib/tasks/store.ts:437–440**

```ts
export async function commandAttempts(ids: string[], command: TimerCommand, now = new Date()): Promise<number> {
	if (ids.length === 0) return 0
	return getDb().transaction((tx) => commandAttemptsIn(tx, ids, command, now))
}
```

**SOURCE/src/app/teacher/rooms/use-command.ts:17–28**

```ts
	const run = async (ids: string[], command: LessonCommand) => {
		if (ids.length === 0) return
		setBusy(true)
		try {
			const result = await commandAttemptsAction(ids, command)
			if (!result.ok) toast('Something went wrong. Try again in a moment.')
			router.refresh()
		} catch (error) {
			if (handleActionError(error) === 'handled') return
			toast('Something went wrong. Check your connection and try again.')
		} finally {
			setBusy(false)
```

A2 producer: same command key+body digest, atomic effect+receipt+result. Repeat reads original result, changed-body same-key refuses; browser lost ACK reads status/same identity, no fresh delta. Timer controls/room board/teacher attempt all use one command port. Lock affected rows deterministic order; include Give/advance/end identity where ambiguous replay could affect state, no generic receipt unrelated feature.

Give assigns waiting attempt; timer starts once on Open:
**SOURCE/src/lib/tasks/store.ts:655–668**

```ts
export async function openAttempt(id: string, studentId: string, now = new Date()): Promise<AttemptStatus | null> {
	await getDb().transaction(async (tx) => {
		const [row] = await tx
			.select({ status: attempts.status, openedAt: attempts.openedAt, pausedAt: attempts.pausedAt })
			.from(attempts)
			.where(and(eq(attempts.id, id), eq(attempts.studentId, studentId)))
			.for('update')
		if (!row || row.status !== 'active' || row.openedAt !== null) return
		await tx
			.update(attempts)
			.set({ openedAt: now, runningSince: row.pausedAt === null ? now : null, updatedAt: now })
			.where(eq(attempts.id, id))
	})
	return getAttemptStatus(id, studentId, now)
```

Room lock/readiness precedes assignment (runs:208–234). Preserve busy students/unique run+step/fromStep, students ahead continue; practice cannot resume teacher pause;8s autosave grace, waiting paused state, remaining/elapsed source arithmetic. Server clock authoritative; browser interpolation only. Autosave pending/failed/held truthful; reload/offline restores only acknowledged scope. End submits active/finishes runs/archive room retaining history, not quiescence hack. Source store894/rooms581/sync559 split reads/clock/poll/save/submit/marks/query owners; no grandfather <500/noAny/CC+cognitive<22/HalsteadD<80.

### grading

Source saveWritingGrade(input:GradeInput,now):Promise<SaveGradeResult> (139) deep owner reused; no separate finding/AI grading.
**SOURCE/src/lib/tasks/grading.ts:129–137**

```ts
export function attemptBandHalves(
	essayNumbers: number[],
	tasks: Map<number, 1 | 2 | null>,
	overallByNumber: Map<number, number>
): number | null {
	const pair = taskPair(essayNumbers, tasks)
	if (pair === null) return null
	const one = overallByNumber.get(pair.one)
	const two = overallByNumber.get(pair.two)
	if (one === undefined || two === undefined) return null
	const band = writingBand(halvesToBand(one), halvesToBand(two))
	return band === null ? null : bandToHalves(band)
}
```

**SOURCE/src/lib/tests/results.ts:114–116**

```ts
export function runResultVisible(
	run: { publishedAt: Date | null; showAnswers: boolean },
	everySubmitted: boolean
): boolean {
	return run.publishedAt !== null || (run.showAnswers && everySubmitted)
}
```

Separate task1/task2 grades + manual final override/comments; Task2 double weight, band null until both eligible; plain essays≤20000, word warning non-blocking. Legacy attempt grade fields AND writing_grades retained. L/R auto-check only; score band requires40,39-question missing band not0. Teacher correct/incorrect/key overrides preserve recorded key/band-version, blank cannot force correct; student strips keyCorrect. Manual Speaking band, publish/hide/showAnswers visibility preserved; no speaking engine/new AI exam/official-score invention.

Review mode preserves Source non-Writing student highlights/notes editing, answers read-only; teacher marks separate. Writing review follows original permitted scope. Continue without recording warning/action retained, account controls reachable; no answerKey leak in DTO/student props.

### stats

**Primary4:** full6.2 query/aggregation and visible results, not current catalog.
**SOURCE/src/lib/stats/progress.ts:250–267**

```ts
export async function loadProgress(studentId: string, audience: ProgressAudience, options: { period: Period; now?: Date }): Promise<ProgressData> {
	const now = options.now ?? new Date()
	const [rows, account] = await Promise.all([rowsOf(studentId), getStudentAccount(studentId)])
	const all: KeptRow[] = []
	let hasHidden = false
	for (const row of rows) {
		if (row.submittedAt === null) continue
		const visible = runResultVisible(row, row.everySubmitted === true)
		if (!visible && audience === 'student') {
			hasHidden = true
			continue
		}
		all.push({ ...row, visible, at: row.submittedAt })
	}
	const since = periodSince(options.period, now)
	const inPeriod = since === null ? all : all.filter((row) => row.at >= since)
	const opened = inPeriod.filter((row) => row.openedAt !== null)
	const [runBandPoints, answers, essays] = await Promise.all([runPoints(all), typeAnswers(opened), gradedEssays(opened)])
```

**SOURCE/src/lib/stats/series.ts:58–71**

```ts
		row.counts[point.series] = (row.counts[point.series] ?? 0) + 1
		const key = `${day}|${point.series}`
		const at = Date.parse(point.at)
		const current = latest.get(key)
		if (current === undefined || at >= current) {
			latest.set(key, at)
			row.values[point.series] = point.band
			row.hollow[point.series] = !point.published
		}
	}
	for (const result of noBand) {
		days.get(dayKey(result.at, timeZone))?.noBand.push(result)
	}
	return [...days.values()].sort((a, b) => a.ts - b.ts)
```

Last skill band per viewer-local browser IANA day (fallbackUTC), not account schedule zone or arbitrary mean. Preserve timestamps/publish flags/day counts/no-band reasons. Student excludes hidden data before aggregate; teacher unpublished audience explicit. Student home tasks/results + Progress separate; periods7d/30d/3m/all defaultall/URL. Type accuracy+volume derives snapshot, Listening matching differs from Reading features; weak3/type task filter links not autoassign; criteria task1/task2 separate; historical paused time fallback approximate, no import rewrite elapsedFinal.

Source constants query caps300/trees150/recent6/step20/home5/sparkline10/reasons10, inactivity≥14d/never>7d/drop≥0.5 prior2 retained. Teacher home lessons/essays/to publish/attention, student cards/targets/history/account and grouped results/filter scope retain source behavior. Plans06.2-02/07 are semantic proof input; old unit/integration requirements remain in Source only. human_needed device/theme/chart keyboard UAT not target PASS.

### media

**Primary5:** SOURCE media library/policy/catalog snapshots; target disk protocol is NEW, no genuine ready-publication/private Range analog.
**SOURCE/src/lib/media/library.ts:34–36**

```ts
const partCount = sql<number>`(select count(*) from section_parts sp where sp.audio_url = ${media.url} or sp.image_url = ${media.url})::int`
const snapshotUse = sql<number>`(case when exists (select 1 from tasks t where t.audio_url = ${media.url})
	or exists (select 1 from attempts a where a.audio_url = ${media.url} or ${media.url} = any(a.media_urls)) then 1 else 0 end)::int`
```

**SOURCE/src/app/api/teacher/media/upload/route.ts:26–38**

```ts
			onBeforeGenerateToken: async (pathname, clientPayload) => {
				const policy = uploadTokenPolicy(pathname)
				if (!policy) throw new UploadRefused('Only audio and image files can be uploaded.')
				const size = Number(clientPayload)
				const declared = Number.isFinite(size) && size > 0 ? size : policy.maximumSizeInBytes
				if (!fitsQuota(await mediaUsedBytes(), declared)) {
					throw new UploadRefused('Storage is almost full (1 GB limit). Remove unused files first.')
				}
				return {
					allowedContentTypes: policy.allowedContentTypes,
					maximumSizeInBytes: policy.maximumSizeInBytes,
					addRandomSuffix: true,
				}
```

A3 producer private manifest+reference resolver, identity ≠URL. Include media rows/tasks.audioUrl/parts audio+image/attempt audio+mediaUrls/nested schema1/2/inline/attached/image refs/source text/data URIs. Runtime hydration gives authorized ID endpoint; historical access survives archive. Never global replacement/recompile/recheck. No public Blob redirect/static volume/image optimizer bypass. Teacher catalog/snapshot; student only own readable attempt via attempt-media refs; GET/HEAD/Range same authorization before bytes metadata.

A4 producer reservation→server measured bytes/hash/type/size→staging verified publish→ready receipt, DB/media journal replay same actor/key. Current Source quota check lacks reservation and client declared size/hash isn't authoritative. Preserve80MiB audio/5MiB image/900MiB soft library cap and duration1s–4h as source limits, not real disk capacity. Retained/quarantine bytes count. Exclusive safe opaque keys/canonical root/no-follow regular handle/same-filesystem publication; no client paths/remote fetch/SVG/HTML/executable. Lost reply/status/restart mismatch never false ready. Files preserved; cleanup/delete not authorized.

Range protocol R26: single/open/suffix206; unsatisfiable416; If-Range mismatch200; malformed/multiple ignored bounded200; HEAD no body/ignoresRange. Auth/no-store/nosniff first, handle fstat/abort close; error afterheaders ends stream no JSON200 fallback. Actual codecs/seek/Safari/permissions/capacity/restart/backup UNVERIFIED. Native audio/practice sequence/volume/Continue without recording preserved.

### ui

Source UI exact leaf imports/props/ranges are tracked behavioral anchors below; parent role-match rows deliberately partial, not final UI availability. Target Base UI/v40/English copy/no eyebrow/Radix/cmdk wins over old source shadcn imports. No Source Server Action DB/session/old host paths copied. Route adapters separate signed student /ielts from teacher /ielts/teacher; fullscreen exam uses student shell, not teacher palette. Target client only shared Registry/apiRequest/pure IELTS; no web api/db imports.

Monolith task-editor1606/exam-frame573/use-sync559 by editor state/compile preview/poll/clock/save/submit/controller responsibilities, all handwritten targets <500 physical lines. Simplify applies to future owned diff, noAny/cognitive/CC<22/D80 validation method; no metrics/legacy exceptions fabricated here. Final26 UI-SPEC/checked predicates pending E26-02; Parent binds it separately. These Source props do not prove variant A/palette/theme/phone/chart accessibility approval.

### import

Source14 tables/11 business plus auth identity mapping/profile semantics; target shared accounts/sessions not clone of old auth. Additive prefixed IELTS catalog/session/attempt/media/import schemas; JSON types from canonical contracts. SourceIDs retained where available, explicit durable crosswalk on collision, no fuzzy mapping. Profile targetBand/source lower historical values stay intact.

Target private CLI import-vault gives stdin/parse/DB-role pattern, not implemented resumable IELTS protocol:
**TARGET/apps/api/src/import-vault.ts:1–8**

```ts
import { parseArgs } from 'node:util'

import { createDb, postgresCode, resolveDatabaseUrl } from '@dv-lab/db'

import { applyPacket } from './import/apply-packet.ts'
import { type ImportPacket, importPacket } from './import/packet.ts'
import { VaultParseError, parseVault } from './import/parse-vault.ts'
import type { ParseSummary } from './import/parse-vault.ts'
```

M10 packet/identity/media-map/rows/apply/reconcile/journal NEW guarantees: actor/source/target attestations, private crosswalk/media manifest, batch+entity+sourceID unique immutable digest, checkpoint in same chunk tx. Exact replay skips matching; changed digest stops. No public credential packet upload/source env/old DB/connect/download. Source/target private row contents/hash credentials/manifests outside repo/logs. Missing ref/object/hash/schema closes readiness; no invented empty counts. Real staging/media operator, not mapper. Existing auth solewriter before rows; refs/media verified before enabled/public parity.

Reconciliation exact counts/key sets/owner/FK/payload digests, both grading representations/null/archive/elapsedFinal and dedup mapping retained. Media object dedup only documented, source media identities/counts intact. New target writes require delta reconciliation before rollback; no blind overwrite/compensating deletion. Import replay/row mapping/media hydration no calculation/filter reimplementation.

### schema

SOURCE db/schema.ts is actual14-table relationship pattern; TARGET existing accounts/card schema is lifecycle binding. New ielts schema files responsibility-owned, generator migration+snapshot after final22/23/24/25 Target schema rebind. No CREATE EXTENSION/handwritten generated edit/drop/rename/new grant. Prefix business tables, stable source key/reference mappings; no guessed migration sequence. Existing app/migrator roles/DbExecutor/connection/error owner reused. Schema/Registry single owners, no wire projections copied into AGENTS. Actual production counts/permission/quiescence not inferred from source constraints.

### shared

Target auth/middleware/request-context/config/app/server/lifecycle API boundaries preserved; App import has no launch. Auth/session/Origin/object role before queries/media; actor never client supplied. requestId/safe error categories, no raw packet/student/essay/path/provider tokens. IELTS config names R26 only: IELTS_ENABLED/IELTS_MEDIA_ROOT/IELTS_MEDIA_CAP_BYTES; no secrets/fake values. Future22/23/24/25 paths PROPOSED absent, never TRACKED analog; E26-01 before source edit. Pure IELTS/check/stat/math owners no second copied engine.

### deploy

M12 future only: tsdown entry for import IELTS/workspace alwaysBundle, packages manifests/next config needed dependency graph; Yarn exact researchpins/1440 with no install now.
**TARGET/apps/api/tsdown.config.ts:14–21**

```ts
	format: 'esm',
	platform: 'node',
	target: 'node24',
	outDir: 'dist',
	sourcemap: true,
	clean: ['dist', 'drizzle'],
	deps: { alwaysBundle: [/^@dv-lab\//] },
	copy: [{ from: '../../packages/db/drizzle', to: '.' }],
```

Persistent API media volume/resource close/backup DB+media consistency through existing compose/backup/restore/RUNBOOK owner. Source Vercel/Blob-only restrictions superseded target port, not product history/auth safety. Operator owns signed candidate/real leases/secrets/path permissions/restore and readiness; no liveops/test/build/media command from mapper. No automatic old-hosting shutdown/repoint/cleanup.

### e2e

Four NEW durable target specs + scoped support reuse existing runner, not Source setup/db reset. J26-01…06 before behavior, public API/full app/real persistence/actual synthetic media bytes; no unit/component/contract/integration suite/new environment. Source tests reference-only at pinned commit; never old Neon PROD fixtures/TRUNCATE. Role/student/teacher IDs seeded via public teacher API under actual operator binding, no import actual accounts from fixture convenience. Preserve rows/files when closing synthetic rooms/deactivating own accounts, no delete authority.

Target support Origin/build/DB attestation doesn't prove Google grant; IELTS doesn't request schedule fx/settings/timezone resets. Synthetic migrated packet supported import+public read; actual data/operator counts and media/quiescence proof separate. Same runner light/dark worker1/retries0; handset scenario owner bound later, not invented existing project. Native real playback/bytes/Range/restart/quota race/new receipt failure proof NOT RUN. Evidence candidate/source snapshot/Origin/DB/media fingerprints, fixture/scenario, expected/observed/original exit/rerun, no secrets/content/screenshots/traces.

Future exact rerun only after titles/fixture/runtime exist: yarn exec playwright test e2e/ielts-lessons.spec.ts --project=light; --project=dark; other three specs аналогично. Six journey contracts below, never discovery =PASS.

## Coverage: SC / F / P / M / ARCH

| Criterion | Producer → consumer                                                                       | Public evidence                                         |
| --------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| SC1       | M01/M02 actor+account/crosswalk/page+API guards → M09/M11                                 | J26-01/06 landing/isolation/foreign resource/revocation |
| SC2       | M03/M04 catalog/compiler+M08 private media+M12 → author/exam                              | J26-04 CRUD/snapshot/playback/ready/ranges              |
| SC3       | M03/M05/M06/M07 source rules/clock/grade/stats → lesson/exam/results                      | J26-02/03/05 parity/persisted scope                     |
| SC4       | M02/M08/M10/M12 import/identity/media/quiescence → actual candidate                       | J26-06+E26-03…06 counts/checksum/freeze/shutdown        |
| SC5       | M09 same Source interactions → final26UI BaseUI/light+dark                                | J26-01…05+E26-02/device evidence; pending               |
| F01       | P02–09 M03/M04/M07 source6.2 owner inventory → full parity                                | J26-04/05; Source human_needed remains                  |
| F02       | P01 M02 shared auth/hash/account-vs-card → role projection                                | J26-01/06+A1                                            |
| F03       | P11 M10 prefixed business/schema/journal+account map → import                             | J26-06 actual counts/refs/checkpoints                   |
| F04       | P10 M08/M12 reserve/private refs/disk → native playback                                   | J26-04+A3/A4+E26-04                                     |
| F05       | P04–06/P08 M05/M06 rowlocks/command receipt/clock/check → lesson                          | J26-02/03+A2                                            |
| F06       | P07 M06 separate Writing/manual Speaking/visibility → result                              | J26-03 no new AI evaluator                              |
| F07       | M09 Source behavior → approvedv40UI separate binding                                      | E26-02+theme/handset/chart table, no mock assertion     |
| F08       | P12 M10/M12 freeze/parity/delta/operator protocol → enable/shutdown                       | E26-03–06 actual observation                            |
| F09       | I001–I224/M01–12 → planner ownership/signatures                                           | Static current source/target binding; rebindE26-01      |
| F10       | M11 current harness+four new specs → six scoped journeys                                  | J26-01…06 public evidence, no new environment           |
| P01       | Source account lifecycle + Target auth producer → IELTS-only optional-card controls       | M02/J01/J06/A1                                          |
| P02       | sections/compiler same validation/snapshot → editor/catalog/Give                          | M03/M04/J04                                             |
| P03       | mock module/kind/readiness producer → save/Give L→R→W                                     | M04/M05/J03/J04                                         |
| P04       | room membership/end transactions → board/history                                          | M05/J02                                                 |
| P05       | Give/unique run step/busy/fromStep → advance/reload                                       | M05/J02/J03                                             |
| P06       | open/progress/grace/pause/submit/receipt → source clocks/ack UI                           | M05/M06/J02/A2                                          |
| P07       | separate Writing grade/manual override → grades/results                                   | M06/J03                                                 |
| P08       | recorded checker/key/band versions/verdict → L/R result/student projection                | M03/M06/J03                                             |
| P09       | same6.2 query/visibility/localday/snapshot types → stats/home/history                     | M03/M07/M09/J05                                         |
| P10       | complete reference resolver/private publication → catalog/exam/library                    | M08/M09/J04/A3/A4                                       |
| P11       | exact sourceIDs/profile/snapshots/grades+crosswalk → import/reconcile                     | M10/J06/A1/A3                                           |
| P12       | real operator observation/freeze/delta → coordinated enable/shutdown                      | M10/M12/E26-05/06                                       |
| M01       | canonical Registry → all M02–12 caller validation                                         | F02/F09                                                 |
| M02       | account-level lifecycle/import/page role → M09/M10                                        | F02/F03/A1                                              |
| M03       | pure Source rules → compiler/attempts/results/stats/UI                                    | F01/F05/F06                                             |
| M04       | responsibility compiler/catalog/bands → author/Give                                       | F01/F09                                                 |
| M05       | room/run/step/receipt → lesson commands                                                   | F05/A2                                                  |
| M06       | actor-safe reads/progress/submit/marks/grade/publication → exam/review                    | F05/F06/A2                                              |
| M07       | query/profile/version → source6.2 progress/home/history                                   | F01/F07                                                 |
| M08       | private reference/upload/storage/range → media+import                                     | F04/A3/A4                                               |
| M09       | role routes/client/controllers → finalUI binding                                          | F07                                                     |
| M10       | private packet/crosswalk/media-map/journal/reconcile → import CLI                         | F03/F08/A1/A3                                           |
| M11       | durable public scenario/target attestation → proof                                        | F10                                                     |
| M12       | config/build/routes/persistent volume/backup → candidate                                  | F04/F08/A4                                              |
| ARCH-A1   | auth/accounts solewriter + strict legacy hash import → IELTS lifecycle/crosswalk          | SC1/4 M02/M10 J01/J06                                   |
| ARCH-A2   | keyed command/digest/effect+receipt → all timer callers                                   | SC3 M05/M06 J02                                         |
| ARCH-A3   | media reference identity+private manifest/runtime hydration → all historical reads/import | SC1/2/4 M01/M04/M08/M10 J01/J04/J06                     |
| ARCH-A4   | quota reservation/serverbytes/hash/journal/verifiedready → library/editor/import/runtime  | SC2/4 M08/M12 J04/J06                                   |

## Journeys and external gates

| ID     | Owner / failures                                                                                                    | Expected acceptance                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| J26-01 | access-import; wrong role/direct teacher routes/foreign object/HEAD/Range/stale cookie/Origin                       | /ielts student landing; API403/session401/foreign404; no private content/effect; revoked session                 |
| J26-02 | lessons; lost ACK/same key changed digest/two tabs/open-next-pause-adjust/expiry/autosave/End                       | one effect/start/step/delta, truthful pending/held, retained history/source clocks                               |
| J26-03 | results; partial grades/39 questions/blank override/active essay/hidden/manual Speaking/repeat submit               | L→R→W/source option/grade weighting, null missing bands, visible authorized result/no key leak                   |
| J26-04 | authoring; invalid DSL/stale editor/removed part/type/size/quota concurrent/interruption/lost ACK/hash/ref/range    | immutable history; actual verified bytes/native seek/auth exact206/416/200; restart retains file; no false ready |
| J26-05 | results; hidden/ungraded/no band/historical time/period/localday/edited catalog/weak links                          | Source6.2 chart/table/toggle/caps/reasons/accuracy+volume/localday lastband/history/home unchanged               |
| J26-06 | access-import+operator; UUID/login/card conflict/missing refs/checksum/digest/checkpoint crash/active source writer | same mapped IDs/no duplicates; mismatch closes ready; actual reconciliation/freeze/parity; oldhost retained      |
| E26-01 | Parent before source execution                                                                                      | final22/23/24/25 account/shell/Registry/schema/API and signed candidate rebind                                   |
| E26-02 | Designer/Parent before UI implementation                                                                            | final26UI source/v40 behavior/stale/archive/retire copy; pending now                                             |
| E26-03 | operator before import                                                                                              | private consistent packet/counts/crosswalk/ref/digests/hash evidence                                             |
| E26-04 | Server guy before release                                                                                           | actual bytes/permissions/capacity/codec/range/abort/DB+media restore/candidate                                   |
| E26-05 | operator+teacher after candidate                                                                                    | fresh no-active-students observation/freeze/delta+actual parity, not local zero                                  |
| E26-06 | teacher after parity then Server guy                                                                                | explicit shutdown confirmation; no inferred autonomy consent                                                     |

All J/E are NOT RUN/UNVERIFIED here. Actual students not enabled until acceptance. Current source polling is not presence board; active record count alone not quiescence. No automatic production attempt submission to manufacture freeze. Old Vercel/Neon/Blob remains; code rollback after new target writes requires freeze/delta reconciliation, not stale source traffic.

## No Analog Found

| Target                                           | Role / flow           | Reason                                                                                                       |
| ------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/ielts/lessons/command-receipts.ts` | store/CRUD            | Preserve Give/open/FromStep locks; atomic command key/digest/effect receipt                                  |
| `apps/api/src/ielts/media/storage.ts`            | service/file-I/O      | Private authenticated ID/media hydration; quota reservation/server hash/verified ready; no publicBlob/delete |
| `apps/api/src/ielts/media/uploads.ts`            | service/CRUD          | Private authenticated ID/media hydration; quota reservation/server hash/verified ready; no publicBlob/delete |
| `apps/api/src/ielts/media/authorization.ts`      | service/CRUD          | Private authenticated ID/media hydration; quota reservation/server hash/verified ready; no publicBlob/delete |
| `apps/api/src/ielts/media/range.ts`              | service/file-I/O      | Private authenticated ID/media hydration; quota reservation/server hash/verified ready; no publicBlob/delete |
| `apps/api/src/ielts/import/packet.ts`            | model/transform       | Strict private crosswalk/manifest/digest/checkpoint; no guessed name/ID or recompile                         |
| `apps/api/src/ielts/import/identity.ts`          | service/batch         | Strict private crosswalk/manifest/digest/checkpoint; no guessed name/ID or recompile                         |
| `apps/api/src/ielts/import/media-map.ts`         | service/transform     | Strict private crosswalk/manifest/digest/checkpoint; no guessed name/ID or recompile                         |
| `apps/api/src/ielts/import/reconcile.ts`         | service/batch         | Strict private crosswalk/manifest/digest/checkpoint; no guessed name/ID or recompile                         |
| `apps/api/src/ielts/import/journal.ts`           | store/batch           | Strict private crosswalk/manifest/digest/checkpoint; no guessed name/ID or recompile                         |
| `packages/db/drizzle/<generated>/migration.sql`  | migration/batch       | db:generate after final schema pin; no handwritten sequence                                                  |
| `packages/db/drizzle/<generated>/snapshot.json`  | config/batch          | db:generate after final schema pin; no handwritten sequence                                                  |
| `e2e/ielts-authoring.spec.ts`                    | test/request-response | Failure-first public app/persistence; no Source reset fixture/isolated suite                                 |
| `yarn.lock`                                      | config/batch          | Future authorized exact R26 package pins/age1440; no install now                                             |

## Exact analog excerpt index

Existing names only. Direct Source UI leaf snippets bind imports/current exported symbols; they do not approve copying Radix/Next server action transport or finalUI. Source comments are excluded from new excerpts; old code remains unchanged. Main patterns above give the larger relevant behavior, signatures and owned deltas.
**TARGET:packages/contracts/src/index.ts:1–3**

```ts
export * from './session.ts'
export * from './identity.ts'
export * from './auth.ts'
```

**SOURCE:src/lib/auth/accounts.ts:38–40**

```ts
export function violatesUnique(error: unknown, constraint: string): boolean {
	let current: unknown = error
	for (let depth = 0; depth < 5 && current !== null && typeof current === 'object'; depth += 1) {
```

**TARGET:apps/web/lib/session.ts:8–10**

```ts
export const getMe = cache(async (): Promise<MeResponse | null> => {
	const token = (await cookies()).get(SESSION_COOKIE)?.value
	if (!token) return null
```

**TARGET:apps/web/app/login/login-form.tsx:22–24**

```tsx
export function LoginForm({ expired }: { expired: boolean }) {
	const router = useRouter()
	const [login, setLogin] = useState('')
```

**TARGET:apps/web/app/login/page.tsx:9–11**

```tsx
export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string | string[] }> }) {
```

**TARGET:apps/web/app/(app)/layout.tsx:12–14**

```tsx
export default async function AppLayout({ children }: { children: ReactNode }) {
	const me = await getMe()
	if (!me) redirect('/login?reason=expired')
```

**TARGET:apps/web/app/(app)/\_components/student-landing.tsx:12–14**

```tsx
export function StudentLanding({ account }: { account: AccountSummary }) {
	const { signOut, pending } = useSignOut()
	return (
```

**TARGET:packages/core/package.json:1–3**

```json
{
	"name": "@dv-lab/core",
	"version": "0.1.0",
```

**TARGET:packages/core/tsconfig.json:1–3**

```json
{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
```

**SOURCE:src/lib/tasks/check.ts:10–12**

```ts
export function normalizeAnswer(value: string): string {
	return value
		.replace(/(\d)[\u00a0\u2009\u202f](?=\d{3}(?!\d))/g, '$1')
```

**SOURCE:src/lib/tasks/bands.ts:13–15**

```ts
export const LISTENING_BANDS: BandTable = {
	id: 'listening-v1',
	skill: 'listening',
```

**SOURCE:src/lib/tasks/writing.ts:4–6**

```ts
export const ESSAY_MAX_CHARS = 20_000

export type EssayInfo = { q: number; minWords: number | null; task: 1 | 2 | null }
```

**SOURCE:src/lib/tasks/tree.ts:22–24**

```ts
export function answerSlots(tree: Content): { key: string; size: number }[] {
	const slots: { key: string; size: number }[] = []
	const inline = (nodes: Inline[]) => {
```

**SOURCE:src/lib/sections/marks.ts:5–7**

```ts
export const WORD_ID = /^t\d{1,6}\.\d{1,5}$/
export const MARK_ID = /^[\w.-]{1,40}$/
```

**SOURCE:src/lib/sections/timing.ts:4–6**

```ts
export const LISTENING_CHECK_MS = 120_000
export const LISTENING_PART_EXTRA_MS = 60_000
export const READING_PART_MINUTES = 20
```

**SOURCE:src/lib/stats/question-types.ts:4–6**

```ts
export const QUESTION_TYPES = [
	'matching_headings',
	'tfng',
```

**SOURCE:src/lib/stats/aggregate.ts:17–19**

```ts
export function answersFromResults(
	results: readonly { number: number; correct: boolean }[],
	types: ReadonlyMap<number, QuestionType>,
```

**SOURCE:src/lib/stats/time.ts:19–21**

```ts
export function timeUsed(input: TimeInput): TimeUsed | null {
	if (input.openedAt === null || input.submittedAt === null) return null
	const usedMs = input.elapsedFinal ? Math.max(0, input.elapsedMs) : Math.max(0, msOf(input.submittedAt) - msOf(input.openedAt))
```

**SOURCE:src/lib/stats/attention.ts:1–3**

```ts
export const INACTIVE_DAYS = 14
export const NEW_ACCOUNT_DAYS = 7
export const FALL_DELTA = 0.5
```

**SOURCE:src/lib/tasks/ai-prompt.ts:429–431**

```ts
export function buildSectionPrompt(header: { skill: TaskKind; module: SectionModule | null }, sourceText: string): string {
	const { skill, module } = header
	const source = sourceText.trim()
```

**SOURCE:src/lib/sections/store.ts:18–20**

```ts
export const MIN_RECORDING_MS = 1_000
export const MAX_RECORDING_MS = 14_400_000
export const MAX_PARTS = 8
```

**SOURCE:src/lib/tasks/rooms.ts:21–23**

```ts
export async function listRoomOptions(roomId?: string): Promise<RoomOption[]> {
	const db = getDb()
	const roomFilter = roomId === undefined ? eq(rooms.archived, false) : and(eq(rooms.archived, false), eq(rooms.id, roomId))
```

**SOURCE:src/lib/tests/runs.ts:36–38**

```ts
export const pendingStepsLeft = sql`(select count(*) from ${attempts} where ${attempts.testAttemptId} = ${testAttempts.id}) < jsonb_array_length(${testAttempts.plan})`
const MAX_CUSTOM_MINUTES = 300
```

**SOURCE:src/lib/tasks/override.ts:3–5**

```ts
export const VERDICTS = ['correct', 'incorrect', 'key'] as const

export type Verdict = (typeof VERDICTS)[number]
```

**SOURCE:src/lib/media/policy.ts:1–3**

```ts
export const AUDIO_TYPES = [
	'audio/mpeg',
	'audio/mp3',
	'audio/mp4',
	'audio/x-m4a',
	'audio/aac',
	'audio/wav',
	'audio/x-wav',
	'audio/ogg',
	'audio/webm',
] as const

export const AUDIO_EXTENSIONS = /\.(mp3|m4a|mp4|aac|wav|ogg|oga|webm)$/i
```

**SOURCE:src/components/exam/frame/exam-frame.tsx:111–113**

```tsx
export function ExamFrame({ attempt, version, mode }: ExamFrameProps) {
	const review = mode === 'review'
	const parts = attempt.tree.parts
```

**SOURCE:src/app/teacher/(home)/home-view.tsx:121–123**

```tsx
export function HomeView({
	version,
	lessons,
```

**SOURCE:src/app/teacher/rooms/rooms-view.tsx:12–14**

```tsx
export function RoomsView({ lessons, students, version }: { lessons: LessonSummary[]; students: StudentChoice[]; version: string }) {
	const { start, dialog } = useStartLesson(students)

```

**SOURCE:src/app/teacher/rooms/[id]/room-board.tsx:54–56**

```tsx
type RoomBoardProps = {
	version: string
	room: RoomBoardData
```

**SOURCE:src/app/teacher/rooms/[id]/advance-control.tsx:29–31**

```tsx
export function advanceLabels(kinds: TaskKind[], fromStep: number) {
	const current = kinds[fromStep]
	const next = kinds[fromStep + 1]
```

**SOURCE:src/app/teacher/tasks/task-editor.tsx:389–391**

```tsx
export function SectionEditor({ section }: { section: LoadedSection }) {
	const router = useRouter()
	const sectionId = section?.id ?? null
```

**SOURCE:src/app/teacher/tasks/markdown-editor.tsx:39–41**

```tsx
type MarkdownEditorProps = {
	value: string
	onChange: (value: string) => void
```

**SOURCE:src/app/teacher/tasks/part-tabs.tsx:36–38**

```tsx
export function questionCount(count: number): string {
	return count === 1 ? '1 question' : `${count} questions`
}
```

**SOURCE:src/app/teacher/tasks/section-checklist.tsx:51–53**

```tsx
export function SectionChecklist({
	items,
	onAction,
```

**SOURCE:src/app/teacher/tasks/ai-prompt-dialog.tsx:17–19**

```tsx
type AiPromptDialogProps = {
	skill: TaskKind
	module: SectionModule | null
```

**SOURCE:src/app/teacher/tasks/tasks-view.tsx:121–123**

```tsx
export function TasksView({ sections, tests }: { sections: SectionListRow[]; tests: MockTestRow[] }) {
	const pathname = usePathname()
	const router = useRouter()
```

**SOURCE:src/components/exam/frame/exam-panes.tsx:39–41**

```tsx
export function useWideLayout(): boolean {
	return useSyncExternalStore(subscribeWide, wideNow, () => true)
}
```

**SOURCE:src/components/exam/frame/exam-header.tsx:64–66**

```tsx
export function ExamHeader(props: ExamHeaderProps) {
	const { name, moduleLabel, timer, saveState, status, volume, onNotes, options, review } = props
	return (
```

**SOURCE:src/components/exam/navigator/navigator.tsx:39–41**

```tsx
export function ExamNavigator(props: NavigatorProps) {
	const { model, skill, showFlags, reviewMode, review } = props
	const navRef = useRef<HTMLElement>(null)
```

**SOURCE:src/components/exam/navigator/submit-dialog.tsx:47–49**

```tsx
export function submitLabel(skill: TaskKind, scope: GiveScope, essayCount: number): string {
	if (skill === 'writing') return scope === 'part' || essayCount === 1 ? 'Submit essay' : 'Submit essays'
	return scope === 'part' ? 'Submit answers' : 'Submit section'
```

**SOURCE:src/components/exam/navigator/submission-page.tsx:72–74**

```tsx
export function SubmissionPage(props: SubmissionPageProps) {
	const { model, skill, scope, essays, onBack, onJump, onSubmit } = props
	const [open, setOpen] = useState(false)
```

**SOURCE:src/components/exam/frame/end-screens.tsx:31–33**

```tsx
export function SubmittedScreen({ attemptId, version, reviewReady = false }: { attemptId: string; version: string; reviewReady?: boolean }) {
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-6 py-12 text-center">
```

**SOURCE:src/components/exam/questions/essay.tsx:20–22**

```tsx
export function EssayAnswer({ block, value, onChange, mode, flagShort }: EssayAnswerProps) {
	const editable = (mode === 'answer' || mode === 'preview') && onChange !== undefined
	const words = wordCount(value)
```

**SOURCE:src/components/exam/marks/selection-tools.tsx:81–83**

```tsx
export function SelectionTools({ containerRef, author, marks, otherMarks, onChange, disabled }: SelectionToolsProps) {
	const [popup, setPopup] = useState<Popup | null>(null)
	const popupRef = useRef<HTMLDivElement>(null)
```

**SOURCE:src/components/exam/marks/notes-sheet.tsx:11–13**

```tsx
export function NotesSheet({ open, onOpenChange, marks, textOf, onDelete, onJump }: NotesSheetProps) {
	const notes = marks.filter((mark) => mark.note !== undefined && mark.note.trim() !== '')

```

**SOURCE:src/components/exam/questions/blocks.tsx:176–178**

```tsx
export const Blocks = memo(function Blocks({ blocks, compact = false }: { blocks: Block[]; compact?: boolean }) {
	return (
		<>
```

**SOURCE:src/components/exam/questions/inline.tsx:27–29**

```tsx
export function InlineImage({ node }: { node: ImageNode }) {
	if (!SAFE_IMAGE.test(node.src)) return null
	return (
```

**SOURCE:src/components/exam/questions/typed-gap.tsx:30–32**

```tsx
export function TypedGapField({ q, variant }: { q: number; variant: TypedGapVariant }) {
	const context = useRenderContext()
	const key = String(q)
```

**SOURCE:src/components/exam/questions/choice.tsx:30–32**

```tsx
export function keepAnswer(event: MouseEvent<HTMLElement>) {
	event.preventDefault()
}
```

**SOURCE:src/components/exam/questions/grid.tsx:166–168**

```tsx
export function GridQuestion({ block }: { block: GridBlock }) {
	return (
		<div className="flex flex-col gap-4">
```

**SOURCE:src/components/exam/drag/drag-pool.tsx:67–69**

```tsx
export function DragPool({ pool }: DragPoolProps) {
	const state = useDragState()
	const interactive = state?.interactive ?? false
```

**SOURCE:src/components/exam/questions/image-block.tsx:224–226**

```tsx
export function ImageBlock({ block }: { block: ImageBlockData }) {
	const context = useRenderContext()
	const url = context.attached?.image?.url ?? null
```

**SOURCE:src/components/exam/listening/listening-gate.tsx:65–67**

```tsx
export function ListeningGate({ open, mode, sequence, volume, onVolumeChange, skipSoundCheck, onPlay, startFailed, onSkip }: ListeningGateProps) {
	const [step, setStep] = useState<Step>(() => (skipSoundCheck ? 'play' : 'check'))
	const [starting, setStarting] = useState(false)
```

**SOURCE:src/components/ui/volume-control.tsx:218–220**

```tsx
export interface VolumeControlProps extends Omit<
  ComponentProps<"div">,
  "defaultValue" | "onChange"
```

**SOURCE:src/app/teacher/attempts/[id]/grading-panel.tsx:51–53**

```tsx
type GradingPanelProps = {
	attemptId: string
	studentName: string
```

**SOURCE:src/components/task/writing-grade-card.tsx:10–12**

```tsx
type WritingGradeCardProps = {
	grade: WritingGrade | null
	essayTask: 1 | 2 | null
```

**SOURCE:src/app/teacher/students/[id]/student-tabs.tsx:28–30**

```tsx
export function StudentTabs({ tab, progress, history, account }: { tab: StudentTab; progress: ReactNode; history: ReactNode; account: ReactNode }) {
	const router = useRouter()
	const pathname = usePathname()
```

**SOURCE:src/components/stats/band-chart-card.tsx:78–80**

```tsx
export function BandChartCard({
	points,
	noBand,
```

**SOURCE:src/components/stats/progress-tiles.tsx:45–47**

```tsx
export function ProgressTiles({
	overall,
	target,
```

**SOURCE:src/components/stats/type-accuracy-card.tsx:46–48**

```tsx
export function TypeAccuracyCard({ skill, stats, subjectName }: { skill: QuestionSkill; stats: TypeStat[]; subjectName: string | null }) {
	const skillLabel = TASK_KIND_LABELS[skill]
	const rows = stats.filter((stat) => stat.total > 0)
```

**SOURCE:src/components/stats/writing-criteria-card.tsx:69–71**

```tsx
export function WritingCriteriaCard({ criteria }: { criteria: CriteriaStats }) {
	return (
		<Card className="min-w-0">
```

**SOURCE:src/components/stats/practice-time-card.tsx:62–64**

```tsx
export function PracticeTimeCard({ time }: { time: TimeSummary }) {
	return (
		<Card>
```

**SOURCE:src/components/stats/lesson-group-list.tsx:12–14**

```tsx
export function LessonGroupList({ groups, showStudent, hasMore, moreHref, empty }: { groups: LessonGroup[]; showStudent: boolean; hasMore: boolean; moreHref: string; empty: ReactNode }) {
	if (groups.length === 0) return <>{empty}</>
	return (
```

**SOURCE:src/components/exam/frame/use-attempt-sync.ts:107–109**

```ts
export function useAttemptSync(input: AttemptSyncInput) {
	const router = useRouter()
	const { attemptId, enabled } = input
```

**SOURCE:src/components/exam/listening/use-recording-sequence.ts:54–56**

```ts
export function useRecordingSequence(options: RecordingSequenceInput): RecordingSequenceState {
	const { mode, phase, elapsedMs, syncedAt, volume, muted } = options
	const timelineKey = JSON.stringify(options.parts.map((part) => ({ url: part.url, startMs: part.startMs, durationMs: part.durationMs ?? 0 })))
```

**SOURCE:src/components/exam/listening/use-audio-timeline.ts:10–12**

```ts
export function useAudioTimeline(declared: DeclaredAudio[], active: boolean): AudioTimeline {
	const key = JSON.stringify(declared.map((part) => ({ url: part.url, startMs: part.startMs, durationMs: part.durationMs })))
	const [measured, setMeasured] = useState<MeasuredDurations>({})
```

**TARGET:apps/web/lib/api-client.ts:8–10**

```ts
export async function apiRequest<T>(method: ApiMethod, path: string, body?: unknown): Promise<ApiResult<T>> {
	let response: Response
	try {
```

**TARGET:apps/api/src/import/apply-packet.ts:33–35**

```ts
export function applyPacket(db: Database, packet: ImportPacket): Promise<ApplyResult> {
	return db.transaction(async (tx): Promise<ApplyResult> => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext('dvlab_import_vault'))`)
```

**SOURCE:src/lib/db/schema.ts:8–10**

```ts
export const accountRoles = ['teacher', 'student'] as const
export const accountStatuses = ['active', 'deactivated'] as const
```

**TARGET:packages/db/drizzle.config.ts:3–5**

```ts
export default defineConfig({
	dialect: 'postgresql',
	schema: ['./src/schema.ts', './src/calendar-schema.ts', './src/calendar-read-schema.ts'],
```

**TARGET:packages/db/package.json:1–3**

```json
{
	"name": "@dv-lab/db",
	"version": "0.1.0",
```

**SOURCE:tests/e2e/lesson-flow.spec.ts:60–62**

```ts
test('teacher gives a section, pauses it; the student answers, highlights and submits; both see the score', async ({
	page,
	browser,
```

**SOURCE:tests/e2e/mock-test.spec.ts:89–91**

```ts
test('a full mock runs from the sound check to published bands', async ({ page, browser, extraHTTPHeaders }) => {
	test.setTimeout(300_000)
	const headers = extraHTTPHeaders ?? {}
```

**SOURCE:tests/e2e/student-access.spec.ts:1–3**

```ts
import type { Page } from '@playwright/test'

import { closeE2ePool, resetStudents, SESSION_COOKIE, seedStudent } from './support/db'
```

**TARGET:e2e/support/target.ts:9–11**

```ts
export const PRELAUNCH_SCOPE = 'prelaunch-main-synthetic-fixtures-test-google-primary'
export const FIXTURE_DATABASE = fixtureDatabase()
export const ENV_FILE = FIXTURE_DATABASE === 'test' ? '.env.test' : '.env'
```

**TARGET:e2e/support/test.ts:199–201**

```ts
export const test = base.extend<{ fx: Fx }>({
	page: async ({ page }, use, testInfo) => {
		await ensureCalendarTarget()
```

**TARGET:e2e/support/api.ts:19–21**

```ts
export async function api(
	request: APIRequestContext,
	method: string,
```

**TARGET:e2e/support/data.ts:20–22**

```ts
export const RESULTS_DIR = resolve(PRIVATE_DIR, 'results', randomUUID())
export const AUTH_FILE = resolve(PRIVATE_DIR, 'auth.json')
const SETTINGS_FILE = resolve(PRIVATE_DIR, 'settings.json')
```

**TARGET:apps/api/src/config.ts:54–56**

```ts
export function loadConfig(env: NodeJS.ProcessEnv): ApiConfig {
	const parsed = schema.safeParse(env)
	if (!parsed.success) throw new Error(`Invalid environment\n${z.prettifyError(parsed.error)}`)
```

**TARGET:apps/api/src/server.ts:1–3**

```ts
import { serve } from '@hono/node-server'

import type { Server } from 'node:http'
```

**TARGET:apps/api/src/app.ts:56–58**

```ts
export function createApp(deps: AppDeps) {
	const app = new Hono<AppEnv>()
	app.use('*', requestContext(deps.logger))
```

**TARGET:apps/api/src/lifecycle.ts:39–41**

```ts
export function createLifecycle({ deadlineMs, logger, exit }: Options): Lifecycle {
	let stopping = false
	let running: Promise<void> | undefined
```

**TARGET:apps/api/package.json:1–3**

```json
{
	"name": "@dv-lab/api",
	"version": "0.1.0",
```

**TARGET:apps/web/package.json:1–3**

```json
{
	"name": "@dv-lab/web",
	"version": "0.1.0",
```

**TARGET:apps/web/next.config.ts:1–3**

```ts
import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
```

**TARGET:deploy/compose.yaml:104–106**

```yaml
import:
  image: ghcr.io/kdvornichenko/dv-lab-api:${APP_TAG:?}
  profiles: ['tools']
```

**TARGET:deploy/env.example:1–3**

```ts
POSTGRES_PASSWORD=
MIGRATOR_PASSWORD=
APP_PASSWORD=
```

**TARGET:deploy/backup/backup.sh:2–4**

```sh
set -Eeuo pipefail
umask 077

```

**TARGET:deploy/backup/restore-check.sh:2–4**

```sh
set -Eeuo pipefail

ROOT="${DV_LAB_ROOT:-/opt/dv-lab}"
```

**TARGET:apps/api/src/auth/middleware.ts:28–30**

```ts
export function originMatches(c: Context, appOrigin: string): boolean {
	return c.req.header('origin') === appOrigin
}
```

**SOURCE:src/lib/bands/store.ts:9–11**

```ts
export type BandTableVersionRow = {
	id: string
	kind: BandTableKind
	version: number
	rows: BandRow[]
	note: string | null
	createdAt: Date
}

export type SaveBandTableResult = { ok: true; version: number } | { ok: false; errors: string[] }
```

**TARGET:packages/db/src/index.ts:1–3**

```ts
export * from './connection.ts'
export * from './schema.ts'
export * from './migrate.ts'
```

## Metadata and verification

5 primary role families: shared account lifecycle; catalog/compiler snapshot; commands/timer; grading/stats6.2; media library/reference/publication. Exact leaf/import/Target composition reads only necessary inventory owners, not extra analog hunt or full quality audit. Research89 input fingerprints reused as upstream evidence; current bytes below independently bind inspected Source/Target. Design fingerprints are research provenance only: finalUI26 pending, not re-read/verified approval. Source old isolated tests stay unchanged/reference-only, not target copies or commands.

Source/Target tracked gate uses git ls-files -- path from matching root. Untracked Source AGENTS only authority input, never source analog. Source snapshot118 code/config/harness files plus10 protected inputs; content hashes are current read evidence, not data counts/runtime. Source media/assets/env never read. New targets/generated placeholders do not pretend to exist. No source/otherdocs/Git/env/runtime/provider/network/deps/DB/agents/deletion/write to main.

Native Read/Write names unavailable; read-only exec + apply_patch sole artifact creation, no shell/heredoc creation. Existing artifact formatting uses Prettier only this file, embedded-language formatting off to preserve verbatim source fragments. Source legacy comments shown in current source are not rewritten/copied as new implementation comments. Target code gates/simplify apply to future owned diff; no <500/complexity/type exception or oldtest grandfather.

### Protected inputs

| Repo   | Input                                                                                        | SHA-256                                                            |
| ------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| TARGET | `AGENTS.md`                                                                                  | `fbef0e319fe49ffb5ab0067e8feac8093172f958b0a70808ff5a376bbb72c9be` |
| TARGET | `.planning/EXECUTOR-RULES.md`                                                                | `1eca1fa30e110bd04658cbf885d1b2189ce854f3cd3ed49664194f6121cbd449` |
| TARGET | `.planning/phases/26-ielts-section/26-CONTEXT.md`                                            | `772d1a4b045076258fe4d0ff4431692356cf763700491ef0d5c415fec886a53a` |
| TARGET | `.planning/phases/26-ielts-section/26-RESEARCH.md`                                           | `f1c7427347407e4ff64ae3e1e984a79a89cc7408ed9e710f09337f3f8091c919` |
| TARGET | `.planning/phases/26-ielts-section/26-ARCH-REVIEW.md`                                        | `0d8fc6412f856a3825c900de21959e26f7607514d82aa7194f6b7b54e9601d8c` |
| SOURCE | `AGENTS.md`                                                                                  | `045fa2d5d7fcd46874d238ce449c1fe934186ade77a78e6a830291642e0885cb` |
| SOURCE | `.planning/phases/06.2-progress-statistics-and-lesson-first-teacher-ux/06.2-CONTEXT.md`      | `ae5d3df072b70a8d51576a758eec8cde11a64ba84f1cfdbd5b3fcce5da89f91c` |
| SOURCE | `.planning/phases/06.2-progress-statistics-and-lesson-first-teacher-ux/06.2-VERIFICATION.md` | `f061e9a7765db207087df2fdcd6090beb3a43c26067ff78d3669638d4ccf9acd` |
| SOURCE | `.planning/phases/06.2-progress-statistics-and-lesson-first-teacher-ux/06.2-02-PLAN.md`      | `aa83caf8b7bfa3dfd119f040ed7553f8eb05cc80d6a9a05e190a42da879d47f6` |
| SOURCE | `.planning/phases/06.2-progress-statistics-and-lesson-first-teacher-ux/06.2-07-PLAN.md`      | `b8df2f3164daa187c84b31bbd1cdc5ffb073af9c119f557c4e4f738a640139e3` |

### Current tracked fingerprints

| Repo   | Source                                                    | Lines | SHA-256                                                            |
| ------ | --------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| SOURCE | `src/lib/auth/accounts.ts`                                |   231 | `5d81d9a7a0b63d17538a51e8cf724b9a88c0ff83ad4fb72378e46e52ea596c58` |
| SOURCE | `src/lib/auth/passwords.ts`                               |    76 | `fe97e2ec44a14c2f745bd01ec76853c8c98ec24d17085ba88b300abfd608f51b` |
| SOURCE | `src/lib/tasks/store.ts`                                  |   894 | `a204ba89230f6033c6f9ad81807fb4855ee78945586ec0d3b549571da442d400` |
| SOURCE | `src/lib/tasks/timer.ts`                                  |    69 | `8d0f91d08d9569c65ad5231acb91696bfee086f08145b9438f013e2210cdf758` |
| SOURCE | `src/lib/sections/store.ts`                               |   744 | `22a9809a190b03f80ddcfeea58b054775da91c7ae79d1632f077841b2240f93d` |
| SOURCE | `src/lib/sections/snapshot.ts`                            |    95 | `4645127cb05051562f6d1b6eb9e261290729b7811d700bc8743eb619d692ba7e` |
| SOURCE | `src/lib/media/library.ts`                                |   185 | `c95c7120b3597a3d01c5a1560e0d3993a3e193e79e14ec7be41cd6a73273fd4f` |
| SOURCE | `src/lib/media/policy.ts`                                 |   108 | `dccb07f6ea45355a1505c7238b53e78d6f6e2b4c6b3d3d00b0fdef270b193abf` |
| SOURCE | `src/lib/media/store.ts`                                  |    45 | `5fc7743849359c37e174d0a47f1c9c9aa63e3bfaba13918808eb7b2b9d039e0e` |
| SOURCE | `src/app/api/teacher/media/upload/route.ts`               |    54 | `f7a8adce04f92cc7d6984940ec26154e5f4d73797a318ebe70c7ef96019305b8` |
| SOURCE | `src/app/teacher/tasks/use-media-upload.ts`               |   167 | `9e2e069c6ed22656a820d2ef260858855c940f805ce74cdbec6d2c91e56e0d66` |
| SOURCE | `src/app/teacher/tasks/media-actions.ts`                  |    76 | `529c6e5cd6fe8c3f8debcfa8762edb2bc357a4d82b6bd54e89b91368db085b51` |
| SOURCE | `src/app/teacher/rooms/use-command.ts`                    |    33 | `6ffbf9300c9283ea12acbc1082ba2856b007751a53eab93f7af735ef1f21c3f8` |
| SOURCE | `src/lib/tasks/compile.ts`                                |  1469 | `5b0e7333db62aa26011e60f132631e4ca8cc5b246e1f09d006ec63bc67865c93` |
| SOURCE | `src/lib/tasks/grading.ts`                                |   185 | `2e7565545d39ecb5f9e1f5b50811d8c018de06fc75bfb5b41309a9e7d8802e03` |
| SOURCE | `src/lib/tests/results.ts`                                |   285 | `e6f4266b1fd3256be0b256b0ddc246bf199fa2d93677e901185e919ea95fc50c` |
| SOURCE | `src/lib/tests/runs.ts`                                   |   394 | `59c46195c2c4e56b869de15b1e9abf1ba59e7fea3538d49798983dde3b330cdb` |
| SOURCE | `src/lib/stats/series.ts`                                 |   132 | `d8780cf90715aade98d76a87e930086a77bae07b0a8e0f48ca1e3d7bacfc5741` |
| SOURCE | `src/lib/stats/progress.ts`                               |   291 | `365a64146ee32fbfe99fb88f16708136c68b4f98502da1b96f4eb1591fc6c5ab` |
| SOURCE | `src/lib/stats/aggregate.ts`                              |   169 | `1cbabb9ec765fb48a5a34ec5e091e734f57eb3853c0bfeeecd481885413a858c` |
| SOURCE | `src/lib/stats/time.ts`                                   |    71 | `6466a5644a049078b06d47e826c94298d980152cfdff7aa0f7545a53800de1c8` |
| SOURCE | `src/lib/tasks/types.ts`                                  |   188 | `4abcd7bb3f2653bc9b4c1c6d79dda390329c4e784ec727df9951624733b04f75` |
| SOURCE | `src/lib/db/schema.ts`                                    |   435 | `4684297eaf1c457796a209d565af1e111b1f629a341854ab86abfee57292d09d` |
| SOURCE | `src/components/exam/frame/exam-frame.tsx`                |   573 | `410fd3489c9796e01a627f913d0023b8c575a790c28e3a08847e00513f8b1ed5` |
| SOURCE | `src/components/exam/frame/use-attempt-sync.ts`           |   559 | `b8fcdac5d181bbe3030911530d1e85923e140c6590c5568eb9ca3dcb312d9c30` |
| SOURCE | `src/app/teacher/tasks/task-editor.tsx`                   |  1606 | `497fe7e80c48fba3ede2f1e82f39412810d751a93977c458533021f1726c980d` |
| SOURCE | `src/lib/tasks/check.ts`                                  |   194 | `5af7863eccb3d5b199f36076f7c4307c0956ed74654015e58af6e594ec76e2a2` |
| SOURCE | `src/lib/tasks/writing.ts`                                |   139 | `58d6b9e872b05e62324099e90364e94f5541d74acbc65e316b065e99fe350459` |
| SOURCE | `src/lib/tasks/tree.ts`                                   |   342 | `197b4e5ae52e6e0a789f5562f040b476350d17d9c36e637a22fb428eab57a95d` |
| SOURCE | `src/lib/tasks/override.ts`                               |    53 | `bcea831fa40c4f17fdea09e76b9436f93d6588409ac9aaf81651d4b5b7cd1f6a` |
| SOURCE | `src/lib/tasks/bands.ts`                                  |   136 | `683b1d866471f6e56a6b5993bf6b4085dbff6c510e9ea13fca27b077a870c8d6` |
| SOURCE | `src/lib/tasks/answer-forms.ts`                           |   386 | `97a2c648af7fd19c36c44c8becdf3a72c026dcc93bbf253fe372f1f68008d74f` |
| SOURCE | `src/lib/sections/marks.ts`                               |   114 | `6f7a32741f9568fdd8f8271a23d2549759585ef2ed8551a5e4f2c71d3f83f490` |
| SOURCE | `src/lib/sections/timing.ts`                              |    49 | `6a13aafb1ba0f3b31be4a8ffc9b0c3fc0acccabd2f479d69096ccffdba3ed2fe` |
| SOURCE | `src/lib/stats/question-types.ts`                         |   198 | `2224b6eb589af847c172b1338f5b3dbab363cf0e4cc31295a6f0817fb5599068` |
| SOURCE | `src/lib/stats/attention.ts`                              |    95 | `050733e223992ddc38839bd5dd2bf07cbea844141acd726544791271c43192af` |
| SOURCE | `src/lib/tasks/ai-prompt.ts`                              |   452 | `b2e2307750a4759aaeee3b4d18c0d202f65053a4c74e3528570b8fb2ebcca215` |
| SOURCE | `src/lib/tasks/rooms.ts`                                  |   581 | `fbf2fcead4d3662917a0c63f4109ad29e4bb52778763492fedf46d74f657a687` |
| SOURCE | `tests/e2e/lesson-flow.spec.ts`                           |   255 | `6c555e1f74725d518336482732b6e5be5a3ce666a049800963d9e1f07f9e128f` |
| SOURCE | `tests/e2e/mock-test.spec.ts`                             |   236 | `93d77872ee4bf9ad2bd9e525714f987e73bfddcc46560d292ff508f18bec508c` |
| SOURCE | `tests/e2e/student-access.spec.ts`                        |   121 | `32ec205cf4036cc4f99970b985c9344655ba7a6ae30fd95d7183d26b55016dda` |
| SOURCE | `tests/e2e/exam-controls.spec.ts`                         |   249 | `e61cc653739e98bb0cb4124b9ea7726c14d4187d04a3948ccd0d52d622890aa4` |
| SOURCE | `src/app/teacher/(home)/home-view.tsx`                    |   174 | `509aa4692ffbe41c073f9a604b249268432d17b6de5735870997bef0bdb6cd11` |
| SOURCE | `src/app/teacher/rooms/rooms-view.tsx`                    |    51 | `20d6d2b1aa2e60988b1800a819386e24300a74e49e31e17121a39444bdcf8f11` |
| SOURCE | `src/app/teacher/rooms/[id]/room-board.tsx`               |   700 | `09c9c3ac99c810354ce37b3b0f05de5c3731a106af2d6d33f074f95682f674c2` |
| SOURCE | `src/app/teacher/rooms/[id]/advance-control.tsx`          |   151 | `30c732cab7c0ada600c723874afeaa681dd9800c32f157ea6c0b4ccae2554ce6` |
| SOURCE | `src/app/teacher/tasks/markdown-editor.tsx`               |   413 | `909a23f29cb24310c6285580ba0d0455a6d7ab1b26c17c6c9eb0f94c1fd550e8` |
| SOURCE | `src/app/teacher/tasks/part-tabs.tsx`                     |   214 | `bccddb480a6d9ab1b3483bcc14c3ce26dcbeba55a61acf6581472f17cbe51bee` |
| SOURCE | `src/app/teacher/tasks/section-checklist.tsx`             |   133 | `9a44d358f2da32c5a4b5cd1ebe297616d83fb85b96c6e2932d55c3baf1bf2e3a` |
| SOURCE | `src/app/teacher/tasks/ai-prompt-dialog.tsx`              |    90 | `432b3f76362379c8aa75a969ce1ad7d6e419215097992a706ad1c2b09d06d553` |
| SOURCE | `src/app/teacher/tasks/tasks-view.tsx`                    |   538 | `b16325f35b1a09bd5d1e7a60a7d06808fa453f152d77498f705143a80e1e5c7c` |
| SOURCE | `src/components/exam/frame/exam-panes.tsx`                |   168 | `56ccbc5e9b50c5223420cd706d124a9ae12e5f791dfd685ee51415c5c19b076b` |
| SOURCE | `src/components/exam/frame/exam-header.tsx`               |   132 | `97456330d5b2e27f6774b8b180d882216198ed8dd6262d2a8b47dd3129458ed1` |
| SOURCE | `src/components/exam/navigator/navigator.tsx`             |   157 | `8a6a7e0130ff1b351ba15feef4d72961ed373be51fbc64837b30b7b167219f75` |
| SOURCE | `src/components/exam/navigator/submit-dialog.tsx`         |   133 | `84dd552aa352ab7d1a8f3923f9b2520d9693626355316673c34f3665fa991e78` |
| SOURCE | `src/components/exam/navigator/submission-page.tsx`       |   144 | `68dfda9af7288af8d4b77a0a77d57ee668b4e0d0fd165e33e6a7f3b6b3bc7639` |
| SOURCE | `src/components/exam/frame/end-screens.tsx`               |    72 | `a56e178f3090d2ecae2c79d052bbc205017bacf8bd5f70f14239e76e9c8f325c` |
| SOURCE | `src/components/exam/questions/essay.tsx`                 |    75 | `77e8cf1608b6ad970d532bfe0b24fd59db7cf72e46028dd604d827c9d6ea1d2f` |
| SOURCE | `src/components/exam/marks/selection-tools.tsx`           |   294 | `8e4a899c6b2f69ef37773ef4b7087e9448ace358585ca540491748163156494f` |
| SOURCE | `src/components/exam/marks/notes-sheet.tsx`               |    62 | `5bf7e516d08e6bb01f2f7ee549fdeb7c2a25fa499411524a74eb200ba888e801` |
| SOURCE | `src/components/exam/questions/blocks.tsx`                |   229 | `984c6a42fa659655500ac3153de68f46864640af492ee626e935b8c1bc7256a1` |
| SOURCE | `src/components/exam/questions/inline.tsx`                |   159 | `de5e75c5eb1b9f5342b8dbffde2a9f83f54cff815de22be8dcf9184b48dc04a7` |
| SOURCE | `src/components/exam/questions/typed-gap.tsx`             |    83 | `b45aa218a7c255a7c061acaf9096c4b014c6169b5d1d56503da164bbfeb15d7b` |
| SOURCE | `src/components/exam/questions/choice.tsx`                |   109 | `77d4d6ebd3a7c0d54cc0748e2ad6efc0e9d703d5fc329c77cc0832dc9bdaa52c` |
| SOURCE | `src/components/exam/questions/grid.tsx`                  |   197 | `ee07e62f970eeec5a2107828b8ff5b26b5bb7a81aa411b33188b0cf5b62b1b83` |
| SOURCE | `src/components/exam/drag/drag-pool.tsx`                  |   107 | `d3808401bda189cb8c9161496adb58fdd96a554899203f1f2e4cd3d607010a26` |
| SOURCE | `src/components/exam/questions/image-block.tsx`           |   236 | `2f8776567e853716267416477ad10c0a9b806a1db536f8d3642babf41f5bf716` |
| SOURCE | `src/components/exam/listening/listening-gate.tsx`        |   153 | `e08d2d16f07744c2237d8c0fa5906b5d35109e7d588cfdf083811d8a78e32c7e` |
| SOURCE | `src/components/ui/volume-control.tsx`                    |   361 | `4fd179570b15d41dc26e55421526d34907b69897339a2daab2ecc9eaa9444998` |
| SOURCE | `src/app/teacher/attempts/[id]/grading-panel.tsx`         |   460 | `341d8d785d6fe2a0d97a33219e506cee53284d937fad6fa4fefdf6b9081225c7` |
| SOURCE | `src/components/task/writing-grade-card.tsx`              |    70 | `437a1a84af48558e5ea8dcd31cc20ac337d5a356a4686a61165416b152ce7adc` |
| SOURCE | `src/app/teacher/students/[id]/student-tabs.tsx`          |    65 | `7217807ec1a02a884930f37f33b8ebc04f66c7e05a9aa5d37b8cf6514b1d0129` |
| SOURCE | `src/components/stats/band-chart-card.tsx`                |   196 | `7411385d4f29042720908d40d98ca475a88ddbe9e27c8a7a768e94dead1392fb` |
| SOURCE | `src/components/stats/progress-tiles.tsx`                 |    85 | `3523c15e522dcafb077999f7c814f4474473b66b7f153fde8391b579d745cec8` |
| SOURCE | `src/components/stats/type-accuracy-card.tsx`             |    82 | `6fe478b85d7e20d5645fa4437cfdab9c8bea4e6944927c0a1d2dce4b54b7f8c5` |
| SOURCE | `src/components/stats/writing-criteria-card.tsx`          |    91 | `de3c50eda32d43d53c8e5d69b5f7482790cd2c5d4e5eb41828d94882af50d4dc` |
| SOURCE | `src/components/stats/practice-time-card.tsx`             |   121 | `37d6406bb027a4a178cbe0b0da282afebf611e51fdfbdbdce4d4e3ed6a427061` |
| SOURCE | `src/components/stats/lesson-group-list.tsx`              |    50 | `0553d64eb84c26b46ebec5d005e9b1880b31faafb9f1069f5e225035c28c0f43` |
| SOURCE | `src/components/exam/listening/use-recording-sequence.ts` |   402 | `9da109509b230196c24d330a4e70cc8dad9ed83a1893a25ea7f26fca6524e950` |
| SOURCE | `src/components/exam/listening/use-audio-timeline.ts`     |    49 | `13e5bed0579a05ccc3f961fdb00288939e943fb89d6d614354f2e56673d9d3d4` |
| SOURCE | `src/lib/bands/store.ts`                                  |    85 | `afb2d4dbfe802e0dc5aba6d07e54c5e611281b92ebf80cc36fcd431fa3b44e07` |
| TARGET | `apps/api/src/auth/accounts.ts`                           |   237 | `3fd36d96015ce9debea75dffe5e11a0b780628f7f3284b012409f919dfb16b04` |
| TARGET | `apps/api/src/auth/passwords.ts`                          |    59 | `7f96fb1ea8014e024f464739ebdf6ff026c67eba06c72b2cd8e3ed1a0573bd7a` |
| TARGET | `apps/api/src/cards/card-account.ts`                      |    60 | `3f30182431a93a76c03cee1eaa061fa784d678505c8691592d5954298b4afb52` |
| TARGET | `apps/web/lib/session.ts`                                 |    27 | `bb813b3002e28ccaa24d9ca93ba03f61d1187e377cf054fe0a5e5aeea754d5e1` |
| TARGET | `apps/web/app/login/login-form.tsx`                       |   108 | `e4663b0037cd0c9f8d1cd6c24d2a1f1d2ffdabd75e0646ae927070023df24cd5` |
| TARGET | `apps/web/app/login/page.tsx`                             |    24 | `0c563faef70c7e2f553d0d7502975bf1dc80a1be57af4872fe0f34ebb0c6e5fb` |
| TARGET | `apps/web/app/(app)/layout.tsx`                           |    31 | `df7482b60b01b113bb15bbd624253f91dafffddbfa1a75931b4e7ef697ad375c` |
| TARGET | `apps/web/app/(app)/_components/student-landing.tsx`      |    27 | `952b7f554347f5d11b0b918bbe87ecbbd8f95eebcbdd1cd4584f7a5a506e5078` |
| TARGET | `packages/contracts/src/auth.ts`                          |   107 | `c95327e66143ce30f2285f3ad4bf725c186c115e5c4c414f5978e5b080096290` |
| TARGET | `apps/api/src/import-vault.ts`                            |   109 | `b6e86520dd31aa81bedba6918faa7ca0c5320bcf7c5f0b071c0be666db3925fe` |
| TARGET | `apps/api/src/import/apply-packet.ts`                     |    61 | `096b8fe69a9794c2667a9e1e4ae875e17bce682259e814962697ebd7dc191bc7` |
| TARGET | `packages/db/drizzle.config.ts`                           |     7 | `abbb95fe8e15f797bbd8307685516f86aecf869840d6cc6f9b4fae474dfb9f44` |
| TARGET | `packages/db/package.json`                                |    27 | `23d95bdd008f69ce8b06a5d56c9f68c265b52b0a77f38d87a88ba7ddd0338bec` |
| TARGET | `apps/api/tsdown.config.ts`                               |    22 | `e2b5e5230822963d9ae685f767d96a157c34b3206593245fd2aa9870f2db8b5a` |
| TARGET | `apps/web/next.config.ts`                                 |    16 | `0780c61c3e6b96eeeaadbc38541827abfdd8475c47a5bbc3cc8b62fb8cd4c738` |
| TARGET | `deploy/compose.yaml`                                     |   140 | `3bc30aa826d8d03af72fd097b1150de0c33dbf6cba5650270e1837ed59874871` |
| TARGET | `deploy/env.example`                                      |     9 | `08f73144bdf934ca84b9ca4e2599ce9138e34946d453a4f9aaacf3d581e69e43` |
| TARGET | `deploy/backup/backup.sh`                                 |    40 | `1f588fd1891532b7cad9088c1ab463f1fdd4eb54bd99e64776770465aada90b8` |
| TARGET | `deploy/backup/restore-check.sh`                          |    59 | `7da8a52a6355cfc0e13d3c468d4a2ce31c0e1c6c0e300e8ac2f1248eddc6d3c3` |
| TARGET | `apps/api/src/auth/middleware.ts`                         |   116 | `86e78399ebe845a36f60008e808a34ea9a2bece1e052cae1f621d90a1af88bcf` |
| TARGET | `packages/db/src/schema.ts`                               |   326 | `3f190ad368cb89b5cabd7a08c57ab94c4c4c815a9aa09d92cc877cb3218551de` |
| TARGET | `packages/contracts/src/index.ts`                         |     8 | `6c7bcb4d755988c6eb422f6685cda144b68ae7aac7ac8a858b8d18f7c695782b` |
| TARGET | `apps/api/package.json`                                   |    38 | `d08967e894e007730318f4ba3af0023bb24b87d113994f388dd2ad09a6d695cc` |
| TARGET | `apps/api/src/app.ts`                                     |   111 | `a6e7ad6dfc55d44f8e3e5e3a43563743b33e41e9c2e4dccde5a5c7dc81c3a8bf` |
| TARGET | `apps/api/src/server.ts`                                  |   109 | `ea018ce5ec2a63427e66afbe570f5815b52937bf6cbacdb622ed81dd10a105e1` |
| TARGET | `apps/api/src/lifecycle.ts`                               |   100 | `81eebd2f099c80b943689f6f19b38048372cf2741062bf27b0a2630494a705a1` |
| TARGET | `apps/api/src/config.ts`                                  |    84 | `deebf084be043e6470e4a116bb1fa0228588b26a3fd75bf58083098c6163d1c0` |
| TARGET | `playwright.config.ts`                                    |    45 | `0154cbcb60ae2c6ff9c7d3127d1cc0fc75c10f5b821f807409113a95a638c420` |
| TARGET | `e2e/support/test.ts`                                     |   231 | `bfd358456f7ba065cce2cc99c9390097d582261ec0f63c716d815de93ed4fd6a` |
| TARGET | `e2e/support/api.ts`                                      |   121 | `6ab88e4a4d56e97dab2915e99dc2b0247f1d1e7a1669f5fae13accae932712a4` |
| TARGET | `e2e/support/target.ts`                                   |   121 | `159ec0404b8a0da309535fb01b514c969b52f2b316e5a63f468bf952c6667eb5` |
| TARGET | `e2e/support/data.ts`                                     |   309 | `8baf45d414685ea419c2e16ff715128e5619c09fa0da1ea03c88ce43cbee2773` |
| TARGET | `packages/core/package.json`                              |    15 | `d4b64b406ba6aa18413266b4007d9def8935183925e9da63c66da13e7c55c9b8` |
| TARGET | `packages/core/tsconfig.json`                             |     8 | `402418150f2086901aaf0e0f58674ee5a45c7b83cd37c5ad5af5833091daaab5` |
| TARGET | `apps/web/lib/api-client.ts`                              |    35 | `fe19848e334e7604c0a8c25edb692c061b87ba3a50170d061dae0bd8ba9a435d` |
| TARGET | `apps/web/package.json`                                   |    42 | `7e49ef9ab0d12dfe244afa9b972d0381d8ddc9bf8a244ada04f5464e2fdc8518` |
| TARGET | `packages/db/src/index.ts`                                |     7 | `62334d82d655463b34b9cae5f2761f1a8cf043c9877ed09a09b664b7eb20f740` |

## Exact document checks

From Target Root:

- bash scripts/gsd/root-pin.sh /Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab — ROOT_PIN_OK/exit0 before first write.
- yarn prettier --write --embedded-language-formatting=off .planning/phases/26-ielts-section/26-PATTERNS.md — format only existing owned artifact.
- yarn prettier --check --embedded-language-formatting=off .planning/phases/26-ielts-section/26-PATTERNS.md — final original status in handoff.
- Python stdlib command below: inventory/M/P/SC/F/ARCH/J/E, Source/Target tracked/SHA/excerpts,12Source+3Target ARCH anchors and source pins. No runtime/build/type/E2E proof inferred.

````sh
python3 -c 'from pathlib import Path
import hashlib,re,subprocess,json
roots={"SOURCE":Path("/Volumes/T7/personal/ielts"),"TARGET":Path("/Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab")}
p=roots["TARGET"]/".planning/phases/26-ielts-section/26-PATTERNS.md"
s=p.read_text()
c=s.split("## File Classification",1)[1].split("## Pattern Assignments",1)[0]
rows=re.findall(r"^\|\s*(I\d{3})\s*\|\s*(M\d{2})\s*\|\s*`([^`]+)`\s*\|\s*(New|Modified|Conditional|Generated)\s*\|",c,re.M)
assert len(rows)==224 and len(set(x[0] for x in rows))==224
assert len(set(x[2] for x in rows))==224
for _,m,f,status in rows:
 if status=="New": assert not (roots["TARGET"]/f).exists(),f
 if status=="Modified": assert subprocess.check_output(["git","ls-files","--",f],cwd=roots["TARGET"]).decode().strip()==f,f
for prefix,n in [("SC",5),("F",10),("P",12),("M",12),("ARCH-A",4),("J26-",6),("E26-",6)]:
 for i in range(1,n+1):
  label=prefix+(str(i).zfill(2) if prefix in ["F","P","M","J26-","E26-"] else str(i))
  assert re.search(r"^\|\s*"+label+r"\s*\|",s,re.M),label
analogs=re.findall(r"`(SOURCE|TARGET):([^`]+)`",c)
assert len(analogs)==210
for repo,f in set(analogs): assert subprocess.check_output(["git","ls-files","--",f],cwd=roots[repo]).decode().strip()==f,(repo,f)
fps=re.findall(r"^\|\s*(SOURCE|TARGET)\s*\|\s*`([^`]+)`\s*\|(?:\s*\d+\s*\|)?\s*`([a-f0-9]{64})`\s*\|$",s,re.M)
for repo,f,h in fps: assert hashlib.sha256((roots[repo]/f).read_bytes()).hexdigest()==h,(repo,f)
tracked=s.split("### Current tracked fingerprints",1)[1]
tfps=re.findall(r"^\|\s*(SOURCE|TARGET)\s*\|\s*`([^`]+)`\s*\|\s*\d+\s*\|\s*`([a-f0-9]{64})`\s*\|$",tracked,re.M)
for repo,f,h in tfps: assert subprocess.check_output(["git","ls-files","--",f],cwd=roots[repo]).decode().strip()==f,(repo,f)
texts=[(roots[repo]/f).read_text() for repo,f,h in tfps]
body=s.split("## Metadata and verification",1)[0]
excerpts=re.findall(r"```(?:ts|tsx|json|yaml|sh)\n(.*?)\n```",body,re.S)
assert len(excerpts)==110,len(excerpts)
for snippet in excerpts: assert any(snippet+"\n" in text for text in texts),snippet[:100]
arch=(p.parent/"26-ARCH-REVIEW.md").read_text()
anchors=re.findall(r"^\|\s*(SOURCE|TARGET)\s*\|\s*([^|]+?)\s*\|\s*([a-f0-9]{64})\s*\|$",arch,re.M)
assert len(anchors)==15
pins={"SOURCE":"df57b7000c6adc60f35071065b4423d426d263a0","TARGET":"913fc5ae9286aca9a48b5ce4272699c846849874"}
for repo,f,h in anchors:
 assert hashlib.sha256((roots[repo]/f).read_bytes()).hexdigest()==h
 assert hashlib.sha256(subprocess.check_output(["git","show",pins[repo]+":"+f],cwd=roots[repo])).hexdigest()==h
assert subprocess.check_output(["git","rev-parse","HEAD"],cwd=roots["SOURCE"]).decode().strip()==pins["SOURCE"]
assert subprocess.check_output(["git","rev-parse","HEAD"],cwd=roots["TARGET"]).decode().strip()=="81a11752853260327ba385475547a912b152842b"
assert not Path("/Volumes/T7/personal/ielts/.codegraph").exists()
assert not (roots["TARGET"]/".codegraph").exists()
assert not (roots["TARGET"]/"e2e/chat.spec.ts").exists()
assert "PENDING" in s and "UNVERIFIED" in s
assert ".gsd/"+"capabilities/" not in s
assert not subprocess.check_output(["git","ls-files","--","AGENTS.md"],cwd=roots["SOURCE"]).strip()
print(json.dumps({"status":"PATTERNS_STATIC_OK","inventory":len(rows),"analogs":len(analogs),"unique_analogs":len(set(analogs)),"tracked_files":len(tfps),"fingerprints":len(fps),"excerpts":len(excerpts),"ARCH_source_target":len(anchors),"UI":"PENDING","sha256":hashlib.sha256(p.read_bytes()).hexdigest()}))
'
````

Final original exits/decisive output и doc SHA-256 возвращаются в handoff; self-hash не записан. E2E/build/type/lint/quality/runtime/network/provider/DB/media/old deployment checks NOT RUN. Current map feeds planner; actual counts/crosswalk/checksums/quiescence/parity и finalUI remain external gates. No source code ready/release/shutdown PASS.

## Current final UI binding

Parent bound independently approved26 UI source SHA-256 `af71092c2ccd26dd2e34e1b88a6e2f00c6acc8be57b6b0ecc39949a7a26fc8e8`; native writeback full SHA-256 was `4dc19f2edb95cbb3109d9e3552d824bcfd9fa35c2e107254e3afc9b934725f84`; UI-CHECK `a1e7980405aac9a954b719de5fd33268a39e93053269494f1a3057d66ff9ec4a`. The prior metadata-rebind full UI SHA-256 was `7d3dff8bced59464ce0bdb8931db010b308faf2903082d92ff43bd2cd28e8ed2` after two input-fingerprint and two approval-status substitutions. Exact reverse reproduces the previous native-writeback bytes; product content and all82 UI predicates are unchanged. B01 resolved through existing Recording/MediaDialog Choose file and actual duration readiness. 82/82 explicit, unresolved0/unclassified0; ui-plan-gate26 exit0/blockfalse. The224 target mappings, source fingerprints and excerpts remain unchanged.

Earlier PENDING descriptions and mapper command output identify its pre-UI input state. This current binding closes E26-02 design input for planner/M09; it does not verify target implementation, device/media behavior, migration, Source/Target parity or shutdown. All224 target mappings,128 source/target fingerprints,110 excerpts and15 ARCH anchors are unchanged. Final target24/25/22/23 signatures still require execution rebind.

Current UI full SHA-256 is `c3cf226baf9d763a229da662ecc58694323cb6d276ea2317be0ecb28632695da` after the sole RESEARCH fingerprint row rebind. RESEARCH trailing spaces were removed with identical line counts and non-whitespace tokens; native82 UI predicates, approved product text,224 mappings and excerpts remain unchanged.
