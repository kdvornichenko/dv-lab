---
phase: 21-lesson-accounting-and-today
plan: 16
subsystem: contracts, api
tags: [schedule, outcome, contract, breaking-change]
requires: [21-07, 21-15, 21-17]
provides:
  - "contracts: ScheduleBlock без status и changeable, ScheduleOccurrence без status, тип ScheduleBlockStatus удалён"
  - "api: toWireBlock и ответ markException отдают исход одним полем outcome"
  - "schedule-api.mjs: проверки отсутствия ключей status и changeable"
affects: [21-12]
status: complete
commits: 2
plan_head_before: 2f99f5954b6e209599cfb6d049e3742056cf842a
plan_head_after: 9f6719a4ec85280a309045144947ebcf12def9ea
actuals:
  tokens: 3500
  tasks: 2
  commits: 2
key-files:
  modified:
    - packages/contracts/src/schedule.ts
    - apps/api/src/schedule/schedule.ts
    - apps/api/src/schedule/changes.ts
    - scripts/dev-checks/schedule-api.mjs
key-decisions:
  - "Совместимые поля на один релиз не оставлены (R2): контракт ломающий, клиент и сервер выкатываются вместе, открытые вкладки перезагружаются"
requirements-completed: [LEDG-05, LEDG-08]
---

# Фаза 21, план 16: исход урока одним полем в контракте и api

Из контракта расписания убраны поле статуса блока, флаг изменяемости и поле статуса вхождения; api их больше не пишет. Исход урока клиент читает только из `outcome`, возможности из `actions`, остальное из `ledger` и `mark`. Внутренний статус блока core остаётся: из него core выводит исход.

## Задачи

| Задача | Что сделано | Коммит |
|--------|-------------|--------|
| 1 (tracer) | `ScheduleBlock` без `status` и `changeable`, `ScheduleOccurrence` без `status`, тип `ScheduleBlockStatus` удалён; `toWireBlock` без этих полей (импорт `canChange` убран), `markException` без `status`. `ScheduleLesson.status` не тронут: это хранимое значение строки `lessons` | 55d5b9b |
| 2 | schedule-api.mjs: ожидания по `occurrence.status` переведены на `outcome`, добавлены проверки отсутствия ключей | 9f6719a |

## Изменённые ожидания schedule-api.mjs

Соответствие: `scheduled` -> `planned`, `cancelled` -> `cancelled`, `moved` -> `planned` (перенесённое вхождение без отметки — запланированный урок на новом месте; призрак на старом месте остаётся блоком недели с `outcome: 'moved'`).

- Ответ cancel (вхождение, перенесённое из вчера, и dW+7): `status === 'cancelled'` -> `outcome === 'cancelled'` (2 места).
- Ответ restore, move, move обратно на естественное время и restore после отмены: `status === 'scheduled'` или `'moved'` -> `outcome === 'planned'` (7 мест).
- Перенос будущего вхождения на вчера, на 00:00 и на текущее время: строка `status === 'moved'` удалена, `outcome === 'planned'` в той же проверке уже была.
- Новые проверки: «blocks carry no status or changeable key» (у каждого блока трёх недель раздела read нет ключей `status` и `changeable`, есть `outcome`), «occurrence response carries outcome and no status key» (ответ move) и отсутствие `status` в ответе cancel.
- Файл переформатирован prettier (формат до правки был чистым).

ledger-api.mjs правок не потребовал: разделы marks, past и today не читали удалённые поля.

## Проверки

| Команда | Результат |
|---------|-----------|
| `yarn workspace @dv-lab/contracts typecheck`, `@dv-lab/api typecheck`, `@dv-lab/web typecheck` | код 0 |
| `yarn workspace @dv-lab/contracts test` | 2 файла, 48 тестов зелёные |
| `node scripts/dev-checks/schedule-api.mjs read` | SCHEDULE_API_READ_OK; PASS «week ... blocks carry no status or changeable key» для всех трёх недель |
| `node scripts/dev-checks/schedule-api.mjs changes` | SCHEDULE_API_CHANGES_OK (118 PASS: OCCURRENCE, SINGLE, SERIES, END_KEEPS_MOVED, MOVE_ANYWHERE) |
| `node scripts/dev-checks/ledger-api.mjs marks` | SCHEDULE_LEDGER_MARKS_OK |
| `node scripts/dev-checks/ledger-api.mjs past` | SCHEDULE_LEDGER_PAST_OK |
| `node scripts/dev-checks/ledger-api.mjs today` | SCHEDULE_LEDGER_TODAY_OK |
| `grep -n -e "changeable" -e "status: ScheduleBlockStatus" packages/contracts/src/schedule.ts` | код 1, пусто |
| `git grep -n -F ".changeable" -- apps` | код 1, пусто |
| `git grep -n "ScheduleBlockStatus" -- apps packages scripts` | код 1, пусто |

Скрипты поднимают api на своих портах и работают на `dvlab_test`; сборка api, `yarn test` и реальные данные `dvlab_dev` не использовались. Порт 4000 в конце слушал dev-api соседнего плана 21-09, не этот план.

## Выкат

После выката открытые вкладки перезагрузить: старый клиент ждёт удалённые поля блока недели; совместимых полей на релиз не оставлено (R2).

Порядок выката для плана 21-12:

1. Контракт ломающий: клиент и сервер одного релиза выкатываются вместе (образы web и api из одного `sha-<sha>`), раздельный выкат одной стороны недопустим. Миграций в этом плане нет.
2. Порядок: образ api, затем образ web (или одновременный `docker compose up -d`); смена одной стороны без другой даёт старому web неделю без `status` и `changeable`, новому web не требуется ничего из удалённого.
3. После выката владелец и учительница обновляют открытые вкладки расписания и Today: старый JS в открытой вкладке покажет неверные состояния блоков (угроза T-21-28, принято).
4. Откат тоже парный: возвращать оба образа к предыдущему sha.

## Отклонения от плана

Нет, план выполнен как написан. Параллельные правки одного файла в первый заход дали одну ошибку применения (строка в `ScheduleBlock` уже сместилась), повторено последовательно.

## Известные заглушки

Нет.

## Threat Flags

Нет новой поверхности: удалены поля ответа, добавлений нет.

## Self-Check: PASSED

- Коммиты 55d5b9b и 9f6719a существуют в ветке gsd/phase-21-lesson-accounting-and-today.
- Изменённые файлы найдены, `yarn typecheck` трёх пакетов зелёный, приёмка api зелёная.
