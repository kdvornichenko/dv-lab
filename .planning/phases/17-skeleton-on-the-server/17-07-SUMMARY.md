---
phase: 17-skeleton-on-the-server
plan: 07
subsystem: api
tags: [hono, node-server, zod, pino, drizzle, sigterm, healthz, tsdown, vitest]

requires:
  - phase: 17-03
    provides: resolveDatabaseUrl и createDb из @dv-lab/db
  - phase: 17-04
    provides: createLogger, requestContext, errorBody и createApp
  - phase: 17-05
    provides: tsdown.config.ts со сборкой migrate.mjs
provides:
  - loadConfig(env) и тип ApiConfig без молчаливых подмен PORT и APP_ORIGIN
  - createLifecycle({ deadlineMs, logger, exit }) с isStopping, manage, shutdown; типы Lifecycle, Closable, ManagedServer
  - composition root apps/api/src/server.ts и сборка apps/api/dist/server.mjs
  - /healthz с проверкой базы select 1 и ответами ok, stopping, error
  - скрипты @dv-lab/api start и dev
affects: [17-08, 17-09, 17-10, 18]

actuals:
  tokens: 6100
  tasks: 2
  commits: 4

plan_head_before: 7089097226d9353669e00c5c1be2fd6d31f84993
plan_head_after: ee78b90

tech-stack:
  added: []
  patterns:
    - "Жизненный цикл создаётся до сервера (createLifecycle), сервер и ресурсы подключаются после serve через manage"
    - "Остановка идемпотентна: повторный сигнал возвращает тот же промис, exit вызывается один раз"
    - "Тест остановки запускает собранный dist/server.mjs через spawn(process.execPath), не через yarn"

key-files:
  created:
    - apps/api/src/config.ts
    - apps/api/src/lifecycle.ts
    - apps/api/src/server.ts
    - apps/api/test/shutdown.test.ts
    - apps/api/test/config.test.ts
    - apps/api/test/lifecycle.test.ts
    - apps/api/test/health.test.ts
  modified:
    - apps/api/src/app.ts
    - apps/api/tsdown.config.ts
    - apps/api/package.json
    - apps/api/test/request-context.test.ts

key-decisions:
  - "lifecycle.ts описывает сервер структурным типом ManagedServer (close, closeIdleConnections, closeAllConnections): ServerType из @hono/node-server включает Http2Server без этих методов; server.ts приводит результат serve к http.Server"
  - "AppDeps.db типизирован как Pick<Database, 'execute'>: /healthz нужен только execute, тестам хватает фейка с одним методом"
  - "Жёсткий таймер срока снимается перед exit(0), чтобы после чистой остановки exit(1) не срабатывал"

patterns-established:
  - "Сигналы SIGTERM и SIGINT подписываются только в lifecycle.manage через process.on"
  - "process.env читается в api только в server.ts и migrate.ts"

requirements-completed: [INFRA-06, INFRA-07]

coverage:
  - id: D1
    description: "Собранный dist/server.mjs стартует, пишет listening, отвечает /healthz 200 { status: ok, db: ok, sha } после select 1 под ролью приложения и по SIGTERM выходит с кодом 0 в пределах срока"
    requirement: INFRA-06
    verification:
      - kind: integration
        ref: "apps/api/test/shutdown.test.ts#SIGTERM on an idle server exits 0 within the deadline"
        status: pass
    human_judgment: false
  - id: D2
    description: "При незавершённом запросе lifecycle принудительно закрывает соединения на половине срока и процесс выходит с кодом 0"
    requirement: INFRA-06
    verification:
      - kind: integration
        ref: "apps/api/test/shutdown.test.ts#SIGTERM with an unfinished request forces the connection closed at half the deadline and exits 0"
        status: pass
      - kind: unit
        ref: "apps/api/test/lifecycle.test.ts#forces all connections closed at half the deadline and exits 1 at the deadline when the server hangs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Остановка идемпотентна, ошибка закрытия ресурса пишется в лог с полем resource, остальные ресурсы закрываются"
    requirement: INFRA-06
    verification:
      - kind: unit
        ref: "apps/api/test/lifecycle.test.ts#runs one shutdown for repeated signals and never exits 1 after a clean stop"
        status: pass
      - kind: unit
        ref: "apps/api/test/lifecycle.test.ts#logs a failing resource with its name and still closes the next one"
        status: pass
      - kind: unit
        ref: "apps/api/test/lifecycle.test.ts#closes the server, then the resources in order, and exits 0 once"
        status: pass
    human_judgment: false
  - id: D4
    description: "loadConfig отвергает неверные PORT, APP_ORIGIN, LOG_LEVEL, SHUTDOWN_DEADLINE_MS с именем поля, без значений переменных в тексте ошибки"
    verification:
      - kind: unit
        ref: "apps/api/test/config.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "/healthz отвечает 503 stopping во время остановки и 503 error при недоступной базе, причина только в логе"
    requirement: INFRA-07
    verification:
      - kind: unit
        ref: "apps/api/test/health.test.ts"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-10-09
status: complete
---

# Phase 17 Plan 07: владелец жизненного цикла и конфигурация api Summary

**Процесс api собирается в dist/server.mjs: loadConfig на zod без подмен, lifecycle.ts с сигналами, сроком SHUTDOWN_DEADLINE_MS, принудительным закрытием соединений на половине срока и закрытием пула pg, /healthz с проверкой select 1 под ролью приложения**

## Performance

- **Duration:** около 4 мин активного исполнения
- **Started:** 2026-10-09T12:32:05Z
- **Completed:** 2026-10-09T12:36:30Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- `loadConfig(env)` — единственный читатель PORT, APP_ORIGIN, LOG_LEVEL, SHUTDOWN_DEADLINE_MS, GIT_SHA и NODE_ENV; URL базы через `resolveDatabaseUrl('app', env)`; неверные значения дают `Invalid environment` с именем поля, `.catch` с подменой нет.
- `createLifecycle` — единственное место с SIGTERM/SIGINT: флаг остановки, лог `shutdown start`, жёсткий таймер на весь срок с `exit(1)`, `server.close` и `closeIdleConnections`, `closeAllConnections` на половине срока, закрытие ресурсов по порядку с логом `resource close failed`, `shutdown complete` и `exit(0)`; повторный сигнал возвращает тот же промис.
- `server.ts` собирает процесс: конфиг, логгер, пул с обработчиком `database pool error`, жизненный цикл, приложение, `serve` с логом `listening`, затем `manage({ server, resources: [pg-pool] })`.
- Собранный процесс проверен по-настоящему: без соединений выходит с кодом 0 за доли секунды, с незавершённым запросом — с кодом 0 примерно через 1,5 с из 3 с срока.

## Task Commits

1. **Задача 1: собранный api стартует, отвечает /healthz с базой и останавливается по SIGTERM** — `39c420e` (feat)
2. **Задача 2: тесты конфигурации, жизненного цикла и /healthz** — `13cc363` (test), дополнительный тест остановки с незавершённым запросом — `ee78b90` (test)

**Plan metadata:** коммит docs(17-07) с этим файлом.

Между коммитами плана в ветке есть коммиты других исполнителей (`f07ca65` от 17-06): поэтому `commits: 4` посчитан по `git log --grep "(17-07)"` плюс docs-коммит, а не по `rev-list plan_head_before..HEAD`.

## Files Created/Modified

- `apps/api/src/config.ts` — zod-схема env и `loadConfig`.
- `apps/api/src/lifecycle.ts` — владелец сигналов, срока и закрытия сервера и ресурсов.
- `apps/api/src/server.ts` — composition root, единственный модуль с побочными эффектами.
- `apps/api/src/app.ts` — `AppDeps { logger, db, gitSha, isStopping }`, `/healthz` с `select 1`.
- `apps/api/tsdown.config.ts` — entry `server` рядом с `migrate`.
- `apps/api/package.json` — скрипты `start` и `dev`.
- `apps/api/test/shutdown.test.ts` — остановка собранного процесса по SIGTERM: без соединений и с незавершённым запросом.
- `apps/api/test/config.test.ts`, `apps/api/test/lifecycle.test.ts`, `apps/api/test/health.test.ts` — тесты из behavior задачи 2.
- `apps/api/test/request-context.test.ts` — вызовы `createApp` переведены на общий помощник `deps(logger)`; проверки 17-04 не менялись.

## Decisions Made

- Структурный тип `ManagedServer` в lifecycle.ts вместо `ServerType`: в `@hono/node-server` 2.1.4 `ServerType = Server | Http2Server | Http2SecureServer`, у `Http2Server` нет `closeIdleConnections` и `closeAllConnections`. `serve` без `createServer` возвращает `http.Server`, `server.ts` приводит тип к нему (оговорка плана из «Flagged assumptions»).
- `AppDeps.db` — `Pick<Database, 'execute'>` вместо полного `Database`: модулю нужен один метод.
- Таймер половины срока тоже `unref`, жёсткий таймер снимается перед `exit(0)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] request-context.test.ts переведён на новый AppDeps в задаче 1**
- **Found during:** Задача 1
- **Issue:** файл по плану относится к задаче 2, но новый `AppDeps` ломает typecheck и тесты 17-04, а verify задачи 1 требует `typecheck && test`.
- **Fix:** добавлен помощник `deps(logger)` с фейковым db, `gitSha` и `isStopping`; все восемь вызовов `createApp({ logger })` заменены на `createApp(deps(logger))`; prettier переставил импорты и убрал завершающую запятую в одном вызове.
- **Files modified:** apps/api/test/request-context.test.ts
- **Verification:** 8 тестов 17-04 проходят без изменения проверок.
- **Committed in:** 39c420e

**2. [Rule 2 - Missing Critical] тест остановки с незавершённым запросом**
- **Found during:** Задача 2
- **Issue:** тест плана проверял только остановку без соединений; путь `closeAllConnections` на половине срока в собранном процессе ничем не проверялся (в lifecycle.test.ts — только на фейковом сервере).
- **Fix:** второй тест в shutdown.test.ts открывает TCP-соединение с недописанными заголовками запроса, шлёт SIGTERM и проверяет код 0, время от 1400 до 4000 мс и `shutdown complete`.
- **Files modified:** apps/api/test/shutdown.test.ts
- **Verification:** тест проходит (около 1,5 с после сигнала).
- **Committed in:** ee78b90

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** оба изменения в файлах плана, без расширения объёма.

## TDD Gate Compliance

Задача 2 помечена `tdd="true"`, но по плану реализацию делает tracer-задача 1, поэтому коммит `feat(17-07)` (39c420e) предшествует `test(17-07)` (13cc363). Все тесты задачи 2 прошли с первого запуска, красных тестов не было и код api по ним не правился. Чтобы проверить, что тесты не пустые, проведены временные мутации, откаченные `git checkout -- <файл>`: без проверки `isStopping` в `/healthz` падает тест 503 stopping; без идемпотентности `shutdown` и без снятия жёсткого таймера падает тест «runs one shutdown for repeated signals and never exits 1 after a clean stop».

## Issues Encountered

- `yarn prettier --check` по `apps/api/src` сообщает о `request-context.ts` из 17-04 (порядок импортов и завершающие запятые). Файл не входит в этот план и не трогался; формат всех файлов 17-07 приведён prettier.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 17-09 добавляет WebSocket поверх `lifecycle.ts`: закрытие клиентов с кодом 1001 и `terminate` на половине срока встраиваются в `stop` рядом с `server.close`.
- 17-08 и 17-10 могут запускать api командой `node --enable-source-maps apps/api/dist/server.mjs` и проверять `/healthz`.

## Self-Check: PASSED

- Файлы на месте: apps/api/src/config.ts, apps/api/src/lifecycle.ts, apps/api/src/server.ts, apps/api/test/shutdown.test.ts, apps/api/test/config.test.ts, apps/api/test/lifecycle.test.ts, apps/api/test/health.test.ts, apps/api/dist/server.mjs, apps/api/dist/migrate.mjs.
- Коммиты найдены: 39c420e, 13cc363, ee78b90.
- `yarn workspace @dv-lab/api build`, `typecheck`, `test`: код 0, 6 файлов, 39 тестов.
- SIGTERM/SIGINT только в lifecycle.ts; `process.env` только в server.ts и migrate.ts; `.catch(` в config.ts нет.
- После тестов `pgrep -fl dist/server.mjs` пуст, слушателей на портах тестов нет.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09*
