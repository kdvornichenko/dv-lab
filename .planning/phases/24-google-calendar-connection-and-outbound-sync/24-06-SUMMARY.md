---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '06'
subsystem: api-web
tags: [google-calendar, today, students, next-lesson, e2e]
requires:
  - phase: 24-05
    provides: Общий Calendar reader, next proof и historical eligibility
provides:
  - Обязательный NextLessonRead во всех ответах карточек
  - Подтверждённые будущие уроки Today и отдельная локальная история
  - Shared freshness UI и сохранённые локальные marks/accounting
affects: [24-07, 24-12, 24-13, 24-14]
actuals:
  tokens: 13037
  tasks: 3
  commits: 3
plan_head_before: 008aff4edd47dfdd5cdc613e3718fea8dc3d5d42
plan_head_after: d9dc066923c5a1541e9dbefa8d6e316cf5c45662
tech-stack:
  added: []
  patterns:
    - Calendar HTTP выполняется до readSnapshot
    - Receipt сохраняет identity объекта context и проверяет revision
    - Unknown не превращается в отсутствие урока
key-files:
  created:
    - apps/api/src/today/calendar-lessons.ts
    - e2e/support/calendar-today.ts
  modified:
    - packages/contracts/src/students.ts
    - packages/contracts/src/today.ts
    - apps/api/src/cards/card-facts.ts
    - apps/api/src/routes/students.ts
    - apps/api/src/today/today.ts
    - apps/api/src/routes/today.ts
    - apps/web/components/app/google-calendar-state.tsx
    - apps/web/app/(app)/_components/today-screen.tsx
    - apps/web/app/(app)/students/_components/students-screen.tsx
key-decisions:
  - Card reads используют accountId и общий next owner; card mutations читают только сохранённые факты.
  - Today читает неделю общего Calendar owner; после новой window revision старый next не объявляется fresh.
  - История включает startsAt равный asOf; будущие уроки имеют startsAt строго после asOf.
  - Calendar actions Today остаются закрыты до journal/controller 24-07 и 24-12; eligible marks работают.
requirements-completed: [GCAL-02, GCAL-09]
verification-status: partial
completion-scope: source-and-disconnected-public-e2e
coverage:
  - id: C2-cards
    description: Единые next facts во всех card responses
    requirement: GCAL-09
    verification:
      - kind: e2e
        ref: 'e2e/today.spec.ts: [calendar] next C2 cards'
        status: pass
      - kind: e2e
        ref: Connected known/none и изменение Google между тремя экранами
        status: unknown
    human_judgment: false
  - id: C2-today
    description: Google future, сохранённые history и Pays soon
    requirement: GCAL-02
    verification:
      - kind: e2e
        ref: 'e2e/today.spec.ts: [calendar] C2 today'
        status: pass
      - kind: e2e
        ref: Реальный provider outage, partial page и exact-asOf millisecond boundary
        status: unknown
    human_judgment: false
  - id: C2-ui
    description: Unknown и unavailable в Today/Students, рабочие historical marks
    verification:
      - kind: automated_ui
        ref: 'e2e/today.spec.ts: [calendar] C2 UI; light/dark, 1280px/390px'
        status: pass
      - kind: automated_ui
        ref: Connected fresh/last_known/none и реальный pending command
        status: unknown
    human_judgment: false
duration: 16.1min
completed: 2026-10-12
status: complete
---

# Phase 24 Plan 06: Единые будущие факты Today и Students Summary

**Карточки читают общий provider next; Today показывает подтверждённые будущие уроки отдельно от локальной истории и явно сообщает недоступность календаря.**

## Performance

- Начало: 2026-10-11T17:44:48Z.
- Завершение source: 2026-10-11T18:00:55.071059+00:00.
- 3 задачи, 19 source/test файлов. Документ SUMMARY учитывается отдельно.
- Actuals: ceil(52145 символов realized Git diff / 4) = 13037. Ledger измерил 3 task commits до metadata commit.
- Завершён source scope и disconnected public E2E. Полный connected C2/SC4 и phase acceptance требуют последующей проверки.

## Task Commits

1. **C2 cards** — `25b7d72`: обязательный next contract и все card producers.
2. **C2 Today backend** — `65b778f`: shared window, provider mapping, локальная история.
3. **C2 UI** — `d9dc066`: status/next UI, read-only calendar actions, исправление границы asOf и совместимые ISO fixtures.

Metadata commit содержит только этот SUMMARY. STATE, ROADMAP, HANDOFF, WINDOWS и plan inventory принадлежат parent.

## Files Created/Modified

| Файл                                                          | Причина                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/contracts/src/students.ts`                          | Обязательный `StudentRow.nextLesson`.                                        |
| `packages/contracts/src/today.ts`                             | Обязательные `calendarRead/calendarWrite`.                                   |
| `apps/api/src/cards/card-facts.ts`                            | Общий next reader с account context; локальный balance сохранён.             |
| `apps/api/src/cards/card-rows.ts`                             | `nextLessonAt` выводится из того же next fact.                               |
| `apps/api/src/cards/cards.ts`                                 | Context и next facts во всех card responses; явный список card IDs.          |
| `apps/api/src/routes/students.ts`                             | Refresh next до snapshot; mutation responses без Google HTTP.                |
| `apps/api/src/routes/today.ts`                                | Shared next/window refresh до snapshot; identity context сохранена.          |
| `apps/api/src/app.ts`                                         | Один CalendarReads instance передаётся Students и Today.                     |
| `apps/api/src/schedule/schedule.ts`                           | Существующий formatter блоков открыт как `wireBlocks`.                       |
| `apps/api/src/today/calendar-lessons.ts`                      | Confirmed timed lesson bindings связываются с локальными карточками по refs. |
| `apps/api/src/today/today.ts`                                 | Google future, eligible local history, статусы и включённая граница asOf.    |
| `apps/web/components/app/google-calendar-state.tsx`           | Shared notice и typed next display; connection hook сохранён.                |
| `apps/web/app/(app)/_components/today-screen.tsx`             | Unavailable не показывает пустой день; calendar actions диалога закрыты.     |
| `apps/web/app/(app)/_components/today-lessons.tsx`            | Read-only для будущих заблокированных строк; marks сохранены.                |
| `apps/web/app/(app)/_components/use-today.ts`                 | Обновление при наступлении урока вместо сравнения заблокированных actions.   |
| `apps/web/app/(app)/students/_components/students-screen.tsx` | Known/none/unknown и явный Refresh вместо `null → None`.                     |
| `e2e/support/calendar-next.ts`                                | Действительный PATCH route, независимая авторизация и card-only assertions.  |
| `e2e/support/calendar-today.ts`                               | Durable API/UI journeys, owned ISO fixtures и observable boundary assertion. |
| `e2e/today.spec.ts`                                           | C2 Today/UI сценарии подключены к существующему harness.                     |

## Decisions Made

- Маппинг Today использует только проверенный lesson binding и локальные IDs. Titles не сопоставляются; external, transition и all-day события не превращаются в уроки.
- Время и длительность будущего урока приходят из normalized provider event. Локальное время не служит fallback.
- Next refresh и window refresh могут иметь разные global revisions. Read model оставляет старый next unknown/last_known; никакого искусственного fresh.
- Legacy future скрыт из Today. Historical eligibility 24-05, balances и Pays soon сохраняют своих владельцев.
- На точной границе `startsAt === asOf` урок принадлежит истории. Half-open local window завершается в `asOf + 1ms`; future reader исключает `startsAt <= asOf`.
- Until 24-12, диалог Today имеет только допустимые локальные marks. Старый mutation shortcut не включён.

## Verification

Все команды выполнялись из worktree. API/web использовали существующую local_dev persistence, Google был disabled. `_test`, основной HTTPS runtime и Google не использовались.

| Команда                                                                                                                                                                                                                                                          | Exit | Решающий результат                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------- |
| `yarn workspace @dv-lab/api typecheck`                                                                                                                                                                                                                           | 0    | Ошибок нет.                                                                 |
| `yarn workspace @dv-lab/web typecheck`                                                                                                                                                                                                                           | 0    | Route types generated; tsc без ошибок.                                      |
| `yarn playwright test e2e/today.spec.ts --grep '\[calendar\] next C2 cards' --project=light --no-deps`                                                                                                                                                           | 0    | 1 passed; все card responses содержат validated correlated next.            |
| `yarn playwright test e2e/today.spec.ts --grep '\[calendar\] (C2 today\|next)' --project=light --no-deps`                                                                                                                                                        | 0    | 2 passed, 5.9s; backend Task 2.                                             |
| `yarn playwright test e2e/today.spec.ts --grep '\[calendar\] C2 UI' --project=light --project=dark --no-deps`                                                                                                                                                    | 0    | 2 passed, 15.4s; light/dark и 390px.                                        |
| `yarn playwright test e2e/today.spec.ts --grep '\[calendar\] (C2 today\|C2 UI)' --project=light --project=dark --no-deps`                                                                                                                                        | 0    | 4 passed, 16.0s после ISO fixtures и boundary correction.                   |
| `yarn tsc --noEmit --strict --target ES2024 --module ESNext --moduleResolution Bundler --allowImportingTsExtensions --allowJs --skipLibCheck --types node e2e/support/calendar-today.ts`                                                                         | 0    | Harness types без ошибок. Та же команда для calendar-next.ts прошла Task 1. |
| `yarn workspace @dv-lab/web exec eslint 'components/app/google-calendar-state.tsx' 'app/(app)/_components/today-screen.tsx' 'app/(app)/_components/today-lessons.tsx' 'app/(app)/_components/use-today.ts' 'app/(app)/students/_components/students-screen.tsx'` | 0    | Ошибок/предупреждений нет.                                                  |
| Scoped `yarn prettier --check` по task write sets                                                                                                                                                                                                                | 0    | All matched files use Prettier code style.                                  |
| `git diff --check`                                                                                                                                                                                                                                               | 0    | Ошибок нет.                                                                 |
| `node scripts/dev-checks/wait-dev.mjs down`                                                                                                                                                                                                                      | 0    | DEV_DOWN_OK после остановки своих API/web процессов.                        |

RED до поведения: cards — отсутствующий next schema; Today — отсутствующий calendarRead; UI — отсутствующий unavailable status. Полный GSD machine TDD gate не заявлен: TDD_MODE=false; native commits сделаны по задаче согласно authority.

Первый Task 1 запуск с setup dependency остановился на старом Schedule week-grid ожидании. Это не RED продукта. C2 helpers выполняют public sign-in/sign-out и owned cleanup; `--no-deps` используется явно.

### Quality / simplify

Simplify применён к каждому owned diff. Комментарии не добавлялись. Confirmed dead/redundant findings не осталось. Подтверждённая inferred any в промежуточном JSX local исправлена явным ReactElement. Unknown в сохранённом connection hook — только непроверенный HTTP JSON до schema parsing.

Инструмент: `scripts/dev-checks/calendar-quality.ts`; Node 24.17.0, TypeScript 6.0.3, ESLint 10.12.0. Полные аргументы воспроизведения сохранены в private STATE_DIR/`phase24-06-quality-rerun.txt`. Все три scoped runs: exit 0, PASS.

| Scope  | Functions checked | Max CC | Max cognitive | Max Halstead D | Max physical lines |
| ------ | ----------------: | -----: | ------------: | -------------: | -----------------: |
| Task 1 |                52 |      6 |             5 |         25.742 |                283 |
| Task 2 |                75 |      9 |             6 |         28.989 |                464 |
| Task 3 |                95 |     13 |            16 |         28.989 |                468 |

Функции учитываются внутри scope каждой задачи; повторно затронутые файлы входят в несколько строк. CC — ESLint classic AST convention. Cognitive — DVLab nesting/control/logical-sequence v1, не Sonar. Halstead D — executable AST leaves: identifiers/literals/JSX text operands; keyword/punctuation operators; trivia, imports и erased type syntax исключены; nested functions учитываются отдельно. Пороги CC/cognitive <22, D<80, handwritten source/tooling <500 соблюдены. Это не полный quality audit или доказательство test stability.

Изменения CC существующих функций: `toDetail` 2→1; `listCards.map` 2→1; Today GET callback 1→3; `LessonRow` 11→13; `Counters` 5→7; `Panels` 4→5; `LoadedToday` 9→8; `StudentsTable.map` 4→3; C2 Today callback 4→6. Новые функции и fingerprints перечислены в machine reports.

Private evidence: `phase24-06-cards-e2e.json`, `phase24-06-today-e2e.json`, `phase24-06-ui-e2e.json` и `phase24-06-task{1,2,3}-quality-final.json`. Они содержат code/diff fingerprints, persistence fingerprint, fixtures, expected/observed, exits и rerun commands без secrets или user content.

## Deviations from Plan

1. **[Rule 3 — Blocking]** Добавлены два Today helpers и открыт общий formatter schedule; иначе mapped event за пределами старого локального времени не связывался бы с карточкой. Files: calendar-lessons.ts, calendar-today.ts, schedule.ts. Commit: `65b778f`.
2. **[Rule 1 — Bug]** Исправлены PATCH вместо несуществующего PUT в C2 card journey и преждевременные Today assertions. Commit: `25b7d72`.
3. **[Rule 1 — Bug]** `use-today.ts` больше не считает intentionally blocked future actions поводом для повторного чтения. Commit: `d9dc066`.
4. **[Rule 1 — Bug]** Review выявил пропуск exact-asOf из двух half-open ветвей. Ожидание включённой границы записано до исправления. E2E observed strictly-before; exact equality не возникла. Commit: `d9dc066`.
5. **[Rule 3 — Blocking]** Fixtures используют canonical absolute ISO INSERT, совместимый с ограниченным prelaunch SQL. Сам prelaunch target не запускался. Commit: `d9dc066`.
6. **[Rule 2 — Project policy]** Сохранён generated `apps/web/AGENTS.md`, существовавший до Task 2. Его удаление не авторизовано; он не включён в task commits.

## Deferred Verification

**Authored and executed:** disconnected cards, Today, UI, local history marks/Pays soon, narrow/light/dark. Boundary assertion выполнен для strictly-before; stdout: `C2 exact-asOf boundary: NOT_OBSERVED`. Exact equality остаётся UNVERIFIED.

**Не написаны в 24-06 и не выполнены:** connected provider edit с проверкой Schedule→Today→Students; live failed pagination; proven none; last_known UI; pending real command вместе с eligible marks. Эти пути требуют реальных observed provider fixtures и согласованного runtime lease; fake provider success не использовался.

**Не выполнены PLAN HTTPS verify commands:** те же три target grep группы с `E2E_TARGET_ORIGIN=https://dv-lab.dev`. Runtime lease, consent/candidate и build+DB attestation не переданы этому executor. Local PASS не заменяет HTTPS/Google proof. Full build/test/knip принадлежат final regression owner 24-13.

Cross-phase defect register принадлежит parent. Передать туда unrun HTTPS verification и точную непроверенную границу; этот executor не меняет WINDOWS.md.

## Known Stubs

Новых data/UI заглушек нет. Search input `placeholder` — обычный HTML attribute, не stub. Calendar mutation controls Today намеренно закрыты до 24-07/24-12, как требует план. Shared connection hook, observer hooks и остальные владельцы сохранены.

## Security Surface

Новых endpoints, auth paths, schema objects или secret/file access production-кода нет. Новые DB selects читают локальные IDs из account-bound normalized Calendar window. Существующие session/teacher/Origin и snapshot boundaries сохранены.

## Self-Check: PASSED

Проверены 19 source/test путей: все существуют. Коммиты `25b7d72`, `65b778f`, `d9dc066` входят в ancestry HEAD. Ledger base и measured commit count согласованы. Task commits не содержат удаления файлов. Собственные процессы остановлены; owned fixture cleanup завершён.
