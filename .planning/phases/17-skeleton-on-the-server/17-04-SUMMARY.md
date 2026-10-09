---
phase: 17-skeleton-on-the-server
plan: 04
subsystem: api
tags: [hono, pino, asynclocalstorage, vitest, request-id, logging]

requires:
  - phase: 17-skeleton-on-the-server
    provides: пакет apps/api с зависимостями (17-01)
provides:
  - request-context.ts: currentRequestId, createLogger, requestContext, errorBody
  - app.ts: AppDeps, createApp(deps) с /healthz, onError, notFound, без побочных эффектов импорта
  - скрипты typecheck и test для @dv-lab/api, tsconfig и vitest.config.ts
affects: [17-05, 17-07, 17-09]

actuals:
  tokens: 4500
  tasks: 2
  commits: 3

plan_head_before: 20e032e60dab6c7e3ddc799af7a9345ee82f65bf
plan_head_after: 5bc2adb7ae852b48b830cc93f831c6ba276ca128

tech-stack:
  added: []
  patterns:
    - "request id живёт в AsyncLocalStorage модуля request-context.ts, логгер читает его через pino mixin"
    - "конверт ошибки собирается только в errorBody"
    - "createApp(deps) вызывается явно, на уровне модуля ничего не создаётся и env не читается"

key-files:
  created:
    - apps/api/tsconfig.json
    - apps/api/vitest.config.ts
    - apps/api/src/request-context.ts
    - apps/api/src/app.ts
    - apps/api/test/request-context.test.ts
  modified:
    - apps/api/package.json

key-decisions:
  - "onError внутри области AsyncLocalStorage: допущение A6 подтверждено тестом, правка request-context.ts не понадобилась"
  - "Новая зависимость не добавлялась, yarn.lock и .yarnrc.yml не менялись"

requirements-completed: [INFRA-07]

coverage:
  - id: D1
    description: "Одна JSON-строка доступа на запрос с requestId, method, path, status, durationMs, level; x-request-id возвращается в заголовке"
    requirement: INFRA-07
    verification:
      - kind: unit
        ref: "apps/api/test/request-context.test.ts#writes one access line with the incoming request id and echoes it in the response header"
        status: pass
    human_judgment: false
  - id: D2
    description: "Проверка формата входящего x-request-id (7, 65 символов, пробел, посторонние символы, отсутствие дают UUID; 64 символа сохраняются)"
    requirement: INFRA-07
    verification:
      - kind: unit
        ref: "apps/api/test/request-context.test.ts#replaces the request id with a UUID when the incoming id ..."
        status: pass
    human_judgment: false
  - id: D3
    description: "Ошибка обработчика даёт 500 с конвертом internal_error и строку error с тем же requestId; 404 даёт not_found; текст исключения не попадает в тело"
    requirement: INFRA-07
    verification:
      - kind: unit
        ref: "apps/api/test/request-context.test.ts#answers a handler error with the generic envelope ..."
        status: pass
      - kind: unit
        ref: "apps/api/test/request-context.test.ts#answers an unknown path with the not_found envelope ..."
        status: pass
    human_judgment: false
  - id: D4
    description: "Request id виден фоновой задаче после ответа, контексты параллельных запросов не смешиваются, cookie и authorization скрыты"
    requirement: INFRA-07
    verification:
      - kind: unit
        ref: "apps/api/test/request-context.test.ts#keeps the request id for a background task ..."
        status: pass
      - kind: unit
        ref: "apps/api/test/request-context.test.ts#gives concurrent requests their own request ids ..."
        status: pass
      - kind: unit
        ref: "apps/api/test/request-context.test.ts#replaces cookie and authorization header values with [redacted] in logs"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-09
status: complete
---

# Phase 17 Plan 04: контекст запроса api Summary

**Hono-приложение api с модулем request-context.ts: request id в AsyncLocalStorage, логгер pino с mixin и redact, единый конверт ошибки errorBody и одна JSON-строка доступа на запрос.**

## Performance

- **Duration:** около 6 мин
- **Completed:** 2026-10-09
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `request-context.ts` владеет request id, логгером и конвертом ошибки; `createApp(deps)` подключает его первым middleware и отдаёт `/healthz`, `onError` (500, `internal_error`) и `notFound` (404, `not_found`).
- Входящий `x-request-id` принимается только по `^[\w-]{8,64}$`, иначе выдаётся UUID; id возвращается в заголовке ответа (T-17-10).
- 12 тестов Vitest: строка доступа, формат id (5 вариантов отказа и граница 64), ошибка, 404, фоновая задача после ответа, два параллельных запроса, redact cookie и authorization.
- `yarn workspace @dv-lab/api typecheck` и `test` завершаются кодом 0.

## Task Commits

1. **Задача 1 (tracer): запрос к /healthz через контекст** — RED `b98355c` (test: конфиги, заглушка и падающий тест, упал на проверке заголовка x-request-id), GREEN `69855d6` (feat: реализация request-context.ts и app.ts)
2. **Задача 2 (tdd): формат id, ошибки, 404, фон, параллельные запросы, redact** — `5bc2adb` (test)

**Plan metadata:** отдельный коммит `docs(17-04)` с этим файлом.

## Files Created/Modified

- `apps/api/package.json` — скрипты typecheck и test
- `apps/api/tsconfig.json` — наследует tsconfig.base.json, lib ES2023, types node
- `apps/api/vitest.config.ts` — загрузка `.env.test` из корня, include `test/**/*.test.ts`, testTimeout 20000
- `apps/api/src/request-context.ts` — AsyncLocalStorage, createLogger, requestContext, errorBody
- `apps/api/src/app.ts` — createApp, AppDeps
- `apps/api/test/request-context.test.ts` — 12 тестов

## Decisions Made

- Допущение A6 (onError Hono выполняется внутри области ALS) подтверждено: Hono вызывает onError в compose на уровне бросившего обработчика, то есть внутри `storage.run`; строка ошибки несёт тот же requestId, строка доступа идёт после неё со status 500.
- Тест 500 проверяет отсутствие текста исключения в теле ответа, но не проверяет его отсутствие в логе: план требует писать исключение в лог (`logger.error({ err })`, T-17-12), а формулировка prohibition про «текст внутренних исключений в логах» этому противоречит. Выполнено как в действиях плана и модели угроз.

## TDD Gate Compliance

- Задача 1: RED `b98355c` (assertion на заголовок x-request-id, валидный RED: цель падает на проверке нужного поведения), GREEN `69855d6`.
- Задача 2: тесты `5bc2adb` прошли сразу, потому что реализация onError, notFound, проверки формата id и ALS уже была в коде задачи 1 (так расписаны действия задачи 1). Это характеризационные тесты, а не RED. Чтобы убедиться, что они не пустые, regexp VALID_ID временно заменён на `/.*/`: 4 теста формата id упали, после возврата все 12 зелёные. Отдельного refactor-коммита нет.

## Deviations from Plan

None - plan executed exactly as written.

Замечания, не являющиеся отклонениями: отдельный тест на id с переводом строки не написан, потому что `Headers` отвергает такое значение ещё до приложения; пробел и точка со слешем покрывают тот же класс отказов регулярного выражения.

## Issues Encountered

Нет. Параллельный исполнитель 17-06 коммитил в deploy/ в то же время, пересечений файлов не было.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности сверх threat_model плана (T-17-10, T-17-11, T-17-12 закрыты кодом и тестами).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

17-05, 17-07, 17-09 пишут логи только через `createLogger` и собирают ошибки через `errorBody`. Точка входа с `createApp` и чтением config ещё не создана (следующие планы).

## Self-Check: PASSED

- Файлы apps/api/src/request-context.ts, apps/api/src/app.ts, apps/api/test/request-context.test.ts, apps/api/tsconfig.json, apps/api/vitest.config.ts существуют.
- Коммиты b98355c, 69855d6, 5bc2adb найдены в git log.
- Критерии приемки: нет `export const app`, нет `process.env`, нет `hono/request-id` и `hono/context-storage`; `git grep "code: "` в apps/api/src находит только request-context.ts.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09*
