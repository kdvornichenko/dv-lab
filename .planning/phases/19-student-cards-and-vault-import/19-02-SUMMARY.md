---
phase: 19-student-cards-and-vault-import
plan: 02
subsystem: database
tags: [postgres, drizzle, errors, refactor]

requires:
  - phase: 19-student-cards-and-vault-import
    provides: "19-05: миграция student_cards на dvlab_test (порядок запуска тестов db и api)"
provides:
  - "@dv-lab/db: тип DbExecutor (база или транзакция) в connection.ts"
  - "@dv-lab/db: violatesUnique(error, constraint), postgresCode(error), postgresErrorFields(error) в postgres-errors.ts, обход cause до пяти звеньев"
  - "api (accounts, bootstrap-teacher, sessions, throttle, middleware, request-context) на импортах из @dv-lab/db, локальных копий нет"
affects: [19-07, 19-09, 19-10, 19-12, 19-13]

actuals:
  tokens: 6600
  tasks: 2
  commits: 2

plan_head_before: beb8d747541315bbd6d7fbd885b740ff3e9ef090
plan_head_after: d0842779aedca699e84d4a62769a49ada0d825c3

tech-stack:
  added: []
  patterns:
    - "Тип исполнителя запросов и разбор ошибок Postgres берутся только из @dv-lab/db"

key-files:
  created:
    - packages/db/src/postgres-errors.ts
  modified:
    - packages/db/src/connection.ts
    - packages/db/src/index.ts
    - apps/api/src/auth/accounts.ts
    - apps/api/src/bootstrap-teacher.ts
    - apps/api/src/auth/sessions.ts
    - apps/api/src/auth/throttle.ts
    - apps/api/src/auth/middleware.ts
    - apps/api/src/request-context.ts

key-decisions:
  - "Три функции разбора ошибок идут через один приватный обход causeChain (до 5 звеньев, только экземпляры Error)"
  - "postgresErrorFields обходит цепочку с самой ошибки запроса, а не только err.cause: у DrizzleQueryError нет .code, поэтому первое звено с кодом остаётся ошибкой драйвера, вывод журнала прежний"

patterns-established:
  - "Модули api берут DbExecutor, violatesUnique, postgresCode, postgresErrorFields из @dv-lab/db"

requirements-completed: [ACCT-04, CARD-06]

coverage:
  - id: D1
    description: "Разбор ошибок Postgres (violatesUnique, postgresCode, postgresErrorFields) живёт в @dv-lab/db и распознаёт синтетическую цепочку и настоящий 23505"
    requirement: ACCT-04
    verification:
      - kind: integration
        ref: "node SCRATCH/19-02-errors.mjs (ERRORS_OK, 20 PASS)"
        status: pass
      - kind: other
        ref: "yarn workspace @dv-lab/db typecheck && yarn workspace @dv-lab/api typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "DbExecutor экспортирует @dv-lab/db, api на него переведён; журнал ошибки запроса без текста запроса и параметров"
    requirement: CARD-06
    verification:
      - kind: unit
        ref: "yarn workspace @dv-lab/api test (7 файлов, 47 тестов)"
        status: pass
      - kind: integration
        ref: "yarn workspace @dv-lab/db test (2 файла, 21 тест)"
        status: pass
      - kind: other
        ref: "yarn workspace @dv-lab/api build; node apps/api/dist/bootstrap-teacher.mjs -> Usage:, код 2"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-10
status: complete
---

# Phase 19 Plan 02: DbExecutor и разбор ошибок Postgres в @dv-lab/db Summary

**Тип «база или транзакция» и разбор ошибок Postgres (уникальность, код, поля для журнала с обходом cause до 5 звеньев) переехали из auth/ в @dv-lab/db; четыре копии в api удалены**

## Performance

- **Duration:** около 10 мин
- **Completed:** 2026-10-09T19:57:05Z
- **Tasks:** 2
- **Files modified:** 9 (1 создан)

## Accomplishments

- `packages/db/src/postgres-errors.ts`: `violatesUnique(error, constraint)`, `postgresCode(error)`, `postgresErrorFields(error)`; реэкспорт из `packages/db/src/index.ts`.
- `packages/db/src/connection.ts`: `export type DbExecutor = Database | Transaction` (тип `Transaction` приватный).
- `accounts.ts` и `bootstrap-teacher.ts` без локальных `CAUSE_DEPTH`, `violatesUnique`, `postgresCode`; `sessions.ts` без локальных `Transaction`/`DbExecutor`; `throttle.ts` и `middleware.ts` берут `DbExecutor` из `@dv-lab/db`.
- `request-context.ts`: ветка ошибки запроса строит `{ type, message: 'Failed query', ...postgresErrorFields(err) }`, тип `QueryCause` удалён.

## Новые экспорты @dv-lab/db

- `DbExecutor` (тип)
- `violatesUnique`, `postgresCode`, `postgresErrorFields`

## Task Commits

1. **Задача 1: разбор ошибок Postgres в @dv-lab/db** — `71e428d` (refactor)
2. **Задача 2: DbExecutor в @dv-lab/db, request-context на общем разборе** — `d084277` (refactor)

## Проверки

- `yarn workspace @dv-lab/db typecheck`, `yarn workspace @dv-lab/api typecheck` — код 0 (после каждой задачи).
- `node SCRATCH/19-02-errors.mjs` — 20 PASS и `ERRORS_OK` до и после задачи 2: синтетика (23505 с `x`/`y`, 23503, ошибка без кода, не-Error, глубина 5 находится, глубина 6 нет, код не по формату), настоящий 23505 на `dvlab_test` под `dvlab_app` (две вставки в `sign_in_throttles` в транзакции, `DrizzleQueryError` → `violatesUnique(…, 'sign_in_throttles_pkey')` true, `postgresCode` `23505`, `postgresErrorFields` `{ code, constraint }`), журнал pino через `createLogger` даёт ровно `type, message, code, constraint` без текста запроса и ключа, после отката строк 0.
- `yarn workspace @dv-lab/api build` — сборка прошла (12 файлов в dist).
- `yarn workspace @dv-lab/api test` — 7 файлов, 47 тестов, все прошли.
- `yarn workspace @dv-lab/db test` — 2 файла, 21 тест, все прошли.
- `node apps/api/dist/bootstrap-teacher.mjs` без аргументов — `Usage:`, код выхода 2.
- Критерии приёмки: копий `CAUSE_DEPTH`/`function violatesUnique`/`function postgresCode` в `apps/api/src` нет; `function violatesUnique` только в `packages/db/src/postgres-errors.ts`; `export type DbExecutor` только в `packages/db/src/connection.ts`; импорта `DbExecutor` из `./sessions.ts` нет; `packages/db/test/roles.test.ts` не изменён.
- `yarn prettier --check` по изменённым файлам — чисто.

## Не запускалось

- `yarn knip`, `yarn lint` (lint только у web, knip по правилам фазы красный до 19-19).

## Decisions Made

- Общий приватный обход `causeChain` для трёх функций; поведение `violatesUnique` и `postgresCode` прежнее.
- `postgresErrorFields` начинает обход с самой ошибки запроса: у `DrizzleQueryError` нет строкового `.code`, поэтому поля берутся из ошибки драйвера, как раньше из `err.cause`; проверено на настоящем 23505.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Модуль карточек (19-07, 19-09, 19-10, 19-12) и импорт (19-13) импортируют `DbExecutor`, `violatesUnique`, `postgresCode` из `@dv-lab/db`.
- `sessions.ts` больше не экспортирует `DbExecutor`.

## Self-Check: PASSED

- `packages/db/src/postgres-errors.ts` существует; коммиты `71e428d` и `d084277` в истории ветки.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
