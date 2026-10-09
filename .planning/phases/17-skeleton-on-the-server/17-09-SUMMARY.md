---
phase: 17-skeleton-on-the-server
plan: 09
subsystem: api
tags: [websocket, ws, hono, node-server, sigterm, lifecycle, origin, maxPayload, vitest]

requires:
  - phase: 17-07
    provides: createLifecycle, ManagedServer, composition root server.ts, тест остановки собранного dist/server.mjs
  - phase: 17-04
    provides: errorBody и requestContext
provides:
  - GET /ws — эхо текстовых кадров только для Origin, равного APP_ORIGIN; чужой или пустой Origin получает 403 forbidden_origin до апгрейда
  - WebSocketServer (noServer, maxPayload 65536) в server.ts, передан в serve через websocket.server и в lifecycle.manage
  - lifecycle.ts — необязательный handles.wss, close(1001, 'server shutting down') сразу, terminate на половине срока, wss.close после HTTP-сервера и до ресурсов
  - структурные типы ManagedSocket, ManagedSocketServer, ManagedHandles в lifecycle.ts
  - AppDeps.appOrigin
affects: [17-10, 17-13, 18, 22]

actuals:
  tokens: 3900
  tasks: 2
  commits: 3

plan_head_before: e1132ee1c78f67e373d313475085b820423ed3bd
plan_head_after: 2706173

tech-stack:
  added: []
  patterns:
    - "Проверка Origin — отдельный обработчик маршрута перед upgradeWebSocket: ответ 403 без next() превращается в HTTP 403 на апгрейде"
    - "lifecycle описывает WebSocket-сервер структурным типом (clients, close), а не типом из ws"
    - "Зависший WebSocket-клиент в интеграционном тесте — сырое TCP-соединение с ручным рукопожатием, не отвечающее на кадр close"

key-files:
  created:
    - apps/api/test/ws.test.ts
  modified:
    - apps/api/src/app.ts
    - apps/api/src/server.ts
    - apps/api/src/lifecycle.ts
    - apps/api/test/shutdown.test.ts
    - apps/api/test/lifecycle.test.ts
    - apps/api/test/health.test.ts
    - apps/api/test/request-context.test.ts

key-decisions:
  - "Эхо только для строковых данных (typeof event.data === 'string'): тип WSMessageReceive из hono включает Blob, который send из @hono/node-server не принимает; truth плана говорит о текстовых сообщениях, бинарные кадры не отражаются"
  - "wss.close ожидается через колбэк, колбэк считается завершением независимо от аргумента: @hono/node-server сам вызывает wss.close по событию close HTTP-сервера, поэтому вызов из lifecycle может получить Error('The server is not running')"
  - "Общий помощник запуска процесса для ws.test.ts и shutdown.test.ts не выделялся: файла нет в files_modified, запуск продублирован в ws.test.ts"

patterns-established:
  - "Соединения WebSocket при остановке закрывает только lifecycle.ts; new WebSocketServer есть только в server.ts"

requirements-completed: [INFRA-06]

coverage:
  - id: D1
    description: "SIGTERM при открытом WebSocket: собранный процесс выходит с кодом 0 быстрее 4000 мс при сроке 3000 мс, клиент получает 1001, эхо ping работает до сигнала"
    requirement: INFRA-06
    verification:
      - kind: integration
        ref: "apps/api/test/shutdown.test.ts#SIGTERM with an open WebSocket exits 0 within the deadline and closes it with 1001"
        status: pass
    human_judgment: false
  - id: D2
    description: "WebSocket-клиент, не отвечающий на close, обрывается на половине срока, процесс выходит с кодом 0 в срок"
    requirement: INFRA-06
    verification:
      - kind: integration
        ref: "apps/api/test/shutdown.test.ts#SIGTERM with a WebSocket client that ignores the close frame terminates it at half the deadline and exits 0"
        status: pass
      - kind: unit
        ref: "apps/api/test/lifecycle.test.ts#sends 1001 to WebSocket clients at once and terminates the ones still open at half the deadline"
        status: pass
    human_judgment: false
  - id: D3
    description: "/ws без Origin и с https://evil.example получает 403 и не открывается"
    requirement: INFRA-06
    verification:
      - kind: integration
        ref: "apps/api/test/ws.test.ts#refuses an upgrade without an Origin header with 403"
        status: pass
      - kind: integration
        ref: "apps/api/test/ws.test.ts#refuses an upgrade from a foreign Origin with 403"
        status: pass
    human_judgment: false
  - id: D4
    description: "Кадр 65536 байт возвращается эхом, кадр 65537 байт закрывает соединение кодом 1009"
    verification:
      - kind: integration
        ref: "apps/api/test/ws.test.ts#echoes a text frame of exactly 65536 bytes"
        status: pass
      - kind: integration
        ref: "apps/api/test/ws.test.ts#closes the connection with 1009 when a frame exceeds 65536 bytes"
        status: pass
    human_judgment: false
  - id: D5
    description: "wss закрывается после HTTP-сервера и до ресурсов"
    verification:
      - kind: unit
        ref: "apps/api/test/lifecycle.test.ts#closes the WebSocket server after the HTTP server and before the resources"
        status: pass
    human_judgment: false
  - id: D6
    description: "docker compose stop api при открытом WebSocket завершается раньше stop_grace_period 20s с кодом 0"
    requirement: INFRA-06
    verification:
      - kind: manual
        ref: "17-13, проверка владельцем при первой выкатке"
        status: pending
    human_judgment: true

duration: 5min
completed: 2026-10-09
status: complete
---

# Phase 17 Plan 09: /ws и остановка api с открытыми WebSocket Summary

**Эхо /ws через встроенный upgradeWebSocket из @hono/node-server 2.1.4 с проверкой Origin и maxPayload 65536; lifecycle.ts закрывает WebSocket кодом 1001, обрывает зависших клиентов на половине срока и закрывает wss до пула; собранный процесс проверен по SIGTERM с открытым и с зависшим соединением**

## Performance

- **Duration:** около 5 мин
- **Started:** 2026-10-09T12:41:30Z
- **Completed:** 2026-10-09T12:46:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `GET /ws`: обработчик перед `upgradeWebSocket` сравнивает заголовок `origin` с `deps.appOrigin` и отвечает `403 errorBody('forbidden_origin', 'Forbidden')`; `setupWebSocket` из `@hono/node-server` превращает этот ответ в HTTP 403 на апгрейде. Обработчик сокета один — `onMessage` с эхом строки; чтения базы и команд нет. `@hono/node-ws` не используется.
- `server.ts`: `new WebSocketServer({ noServer: true, maxPayload: 65536 })`, `serve({ ..., websocket: { server: wss } })`, `createApp({ ..., appOrigin: config.APP_ORIGIN })`, `lifecycle.manage({ server, wss, resources })`.
- `lifecycle.ts`: после `closeIdleConnections` всем `wss.clients` уходит `close(1001, 'server shutting down')`; таймер половины срока делает `terminate` оставшимся клиентам и `closeAllConnections`; после закрытия HTTP-сервера ожидается `wss.close`, затем ресурсы. Сигналы и сроки по-прежнему только здесь.
- Собранный процесс: с открытым WebSocket выходит с кодом 0 за доли секунды, клиент получает 1001; с клиентом, не отвечающим на close, — с кодом 0 примерно через 1,5 с из 3 с.

## Task Commits

1. **Задача 1 (tracer): эхо /ws и остановка с открытым WebSocket** — `5d13701` (feat)
2. **Задача 2: отказ по Origin, лимит кадра и обрыв зависшего клиента** — `2706173` (test)

**Plan metadata:** коммит docs(17-09) с этим файлом.

Между коммитами плана в ветке есть коммиты других исполнителей (`fe4ed85` фазы 18, `f27288f` и `75b125c` от 17-11), поэтому `commits: 3` посчитан по `git log --grep "(17-09)"` плюс docs-коммит, а не по `rev-list plan_head_before..HEAD`.

## Files Created/Modified

- `apps/api/src/app.ts` — `AppDeps.appOrigin`, маршрут `/ws` с проверкой Origin и эхом.
- `apps/api/src/server.ts` — сервер `ws` в composition root, передача в `serve` и `lifecycle.manage`.
- `apps/api/src/lifecycle.ts` — типы `ManagedSocket`, `ManagedSocketServer`, `ManagedHandles`; закрытие WebSocket при остановке.
- `apps/api/test/shutdown.test.ts` — тест с открытым WebSocket (эхо ping, 1001, код 0 < 4000 мс) и тест с зависшим клиентом на сыром TCP.
- `apps/api/test/ws.test.ts` — 403 без Origin и с чужим Origin, эхо кадра 65536 байт, 1009 на 65537 байт; один процесс на файл, остановка SIGTERM в `afterAll` с проверкой кода 0.
- `apps/api/test/lifecycle.test.ts` — фейковые `wss` и сокеты; 1001 сразу, `terminate` и `closeAllConnections` на половине срока, порядок server → wss → ресурсы.
- `apps/api/test/health.test.ts`, `apps/api/test/request-context.test.ts` — в фейковые зависимости добавлено поле `appOrigin`.

## Decisions Made

- Эхо только строк: `ws.send(event.data)` не проходит typecheck (`Blob` в `WSMessageReceive`), план требует эха текстовых сообщений; приведение типов не используется.
- `wss.close` в lifecycle ожидается через колбэк, ошибка в колбэке не считается сбоем: к этому моменту `@hono/node-server` уже вызвал `wss.close` по событию `close` HTTP-сервера.
- `wss` в `manage` необязателен, поэтому прежние тесты lifecycle не менялись.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] фейковые AppDeps в тестах 17-04 и 17-07 дополнены appOrigin**
- **Found during:** Задача 1
- **Issue:** новое обязательное поле `AppDeps.appOrigin` ломает typecheck `health.test.ts` и `request-context.test.ts`, которых нет в files_modified плана.
- **Fix:** в оба фейка добавлена строка `appOrigin: 'http://localhost:3000'`; проверки не менялись.
- **Files modified:** apps/api/test/health.test.ts, apps/api/test/request-context.test.ts
- **Verification:** typecheck и все прежние тесты проходят.
- **Committed in:** 5d13701

**2. [Rule 2 - Missing Critical] интеграционный тест зависшего WebSocket-клиента и тест порядка закрытия wss**
- **Found during:** Задача 2
- **Issue:** обрыв клиента на половине срока по плану проверялся только на фейке в lifecycle.test.ts; клиент `ws` сам отвечает на close, поэтому путь `terminate` в собранном процессе ничем не покрывался. Порядок «wss после HTTP-сервера и до ресурсов» из action задачи 1 тоже не проверялся.
- **Fix:** в shutdown.test.ts тест с сырым TCP-соединением, которое проходит рукопожатие с правильным Origin и не отвечает на кадр close (код 0, время от 1400 до 4000 мс); в lifecycle.test.ts тест порядка server → wss → pg-pool; в ws.test.ts дополнительно эхо кадра ровно 65536 байт как граница лимита.
- **Files modified:** apps/api/test/shutdown.test.ts, apps/api/test/lifecycle.test.ts, apps/api/test/ws.test.ts
- **Verification:** тесты проходят; без `terminate` интеграционный тест падает с кодом выхода 1 (сработал жёсткий срок).
- **Committed in:** 2706173

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** изменения в тестовых файлах api, без расширения объёма кода.

## TDD Gate Compliance

Задача 2 помечена `tdd="true"`, но реализацию по плану делает tracer-задача 1, поэтому `feat(17-09)` (5d13701) предшествует `test(17-09)` (2706173), как в 17-07. Тесты задачи 2 прошли с первого запуска, код api по ним не правился. Чтобы проверить, что тесты не пустые, проведены временные мутации, откаченные `git checkout -- <файл>`:
- сравнение Origin заменено на всегда ложное — падают оба теста 403 (получен `{ status: 101, opened: true }`);
- убран `terminate` на половине срока — падают тест lifecycle и интеграционный тест зависшего клиента (код выхода 1);
- `maxPayload` поднят до 1048576 — падает тест 1009.

Tracer-гейт: после коммита задачи 1 verify (`build && typecheck && test`) перезапущен и прошёл, затем начата задача 2.

## Issues Encountered

- Первая версия помощника `rejectedStatus` в ws.test.ts при мутации ждала таймаута 20 с, если апгрейд проходил; помощник переделан так, что событие `open` сразу завершает проверку с `{ status: 101, opened: true }`.

## Deferred Items

- Запуск собранного процесса (spawn, ожидание `listening`, случайный порт) продублирован в `shutdown.test.ts` и `ws.test.ts`: общего модуля нет в files_modified плана. Кандидат на вынос в общий тестовый помощник api.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Остановка контейнера `docker compose stop api` с открытым WebSocket (stop_grace_period 20s) проверяется владельцем при первой выкатке в 17-13.
- Фаза 18 добавит вход: до этого `/ws` остаётся публичным эхом, отключение — удаление одного маршрута.

## Self-Check: PASSED

- Файлы на месте: apps/api/src/app.ts, apps/api/src/server.ts, apps/api/src/lifecycle.ts, apps/api/test/ws.test.ts, apps/api/test/shutdown.test.ts, apps/api/test/lifecycle.test.ts.
- Коммиты найдены: 5d13701, 2706173.
- `yarn workspace @dv-lab/api build`, `typecheck`, `test`: код 0, 7 файлов, 47 тестов (два прогона подряд).
- `git grep --untracked '@hono/node-ws' -- apps` пуст; `git grep --untracked -n 'new WebSocketServer' -- apps/api/src` — одна строка `apps/api/src/server.ts:32`.
- После тестов `pgrep -fl dist/server.mjs` пуст, слушателей node на портах тестов нет.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09*
