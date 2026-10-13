---
phase: 22-chat-with-mentions-and-quick-marks
plan: '01'
status: complete
subsystem: api
tags: [schedule, google-calendar, marks, no-show, done, sync-window, inbound, v1, v5]

requires:
  - phase: 25.1
    provides: 'журнал команд календаря, single-command, occurrence-command, dispatch, inbound-apply, historyEligibility'
provides:
  - 'core: lessonActions.move и cancel = countsAsLesson && outcome !== done'
  - 'contracts: код lesson_done в errorCodes; binding.mark (done | no_show | null) у урока в calendarEventView'
  - 'db: lineage.clearMark (необязательный literal true) в плане команды'
  - 'changes.ts: clearsMark(change, mark, target, now) — одно правило снятия no_show для исходящего и входящего пути'
  - 'projection.ts: insideSyncWindow(sync, startsAt, endsAt) — проверка окна синхронизации для новых мест фазы 22'
  - 'marks.ts: settleMarkAfterMove(executor, ref) — no_show -> none, строка не удаляется, done/none/нет строки без записи'
  - "history.ts: historyEligibility(..., mode: 'read' | 'write'); в write незавершённая команда ключа блокирует запись отметки"
  - 'read-model.ts: eventView(..., marks) и чтение отметок недели одним loadMarks'
  - 'scripts/dev-checks/schedule-started.mjs: офлайн-приёмка правила начавшегося урока, SCHEDULE_STARTED_OK'
affects: [22-02, 22-03, 22-08, 22-10, 22-14, 22-18]

actuals:
  tokens: 10500
  tasks: 5
  commits: 5
plan_head_before: 17c9dd8
plan_head_after: 4af438b

tech-stack:
  added: []
  patterns:
    - 'Решение о снятии отметки принимается при приёме команды и хранится в lineage[0].clearMark; применение после подтверждения Google не пересчитывает now'
    - 'Снятие отметки — UPDATE с условием kind = no_show в той же транзакции применения: гонка с done безопасна без чтения перед записью'

key-files:
  created:
    - scripts/dev-checks/schedule-started.mjs
  modified:
    - packages/core/src/schedule.ts
    - packages/contracts/src/auth.ts
    - packages/contracts/test/auth.test.ts
    - packages/contracts/src/calendar.ts
    - packages/db/src/calendar-values.ts
    - apps/api/src/schedule/changes.ts
    - apps/api/src/schedule/occurrence-change.ts
    - apps/api/src/schedule/single-command.ts
    - apps/api/src/schedule/occurrence-command.ts
    - apps/api/src/schedule/command-plan.ts
    - apps/api/src/schedule/marks.ts
    - apps/api/src/schedule/command-apply.ts
    - apps/api/src/schedule/inbound-apply.ts
    - apps/api/src/calendar/dispatch.ts
    - apps/api/src/calendar/read-model.ts
    - apps/api/src/calendar/projection.ts
    - apps/api/src/calendar/history.ts
    - scripts/dev-checks/calendar-inbound.mjs
    - scripts/dev-checks/calendar-web-grid.mjs
    - scripts/dev-checks/calendar-web-editor.mjs
    - scripts/dev-checks/calendar-web-drag.mjs
    - scripts/dev-checks/README.md
    - AGENTS.md

key-decisions:
  - 'lesson_done отказывает любую операцию над уроком с done, включая restore (prepareLessonChange и occurrenceChange проверяют отметку до lessonActions)'
  - 'clearsMark вынесен в changes.ts и используется приёмом команд и входящим путём Google'
  - 'Окно синхронизации проверяется и для текущего интервала урока, и для интервала цели'

requirements-completed: [CHAT-03]

duration: ~1h
completed: 2026-10-13
---

# Phase 22 Plan 01: Перенос и отмена начавшегося урока Summary

Начавшийся и прошедший урок без `done` переносится и отменяется командой календаря на любые дату и время внутри окна синхронизации, `done` отказывает `409 lesson_done`, `no_show` снимается в `none` одним писателем `settleMarkAfterMove` только при переносе на начало позже текущего момента; то же правило действует для изменений из Google.

## Задачи и коммиты

| Задача | Что сделано                                                                                                                                                                                                                   | Коммит  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1      | core: `move` и `cancel` в `lessonActions` с условием `outcome !== 'done'`; contracts: `lesson_done` в `errorCodes` и в тесте, `binding.mark` у урока; db: `lineage.clearMark`                                                 | da20ae0 |
| 2      | Приём команд: сняты временные ворота, отказ `lesson_done`, `outside_sync_window` через `insideSyncWindow`, `clearMark` в `lineage[0]`                                                                                         | db2de5c |
| 3      | `settleMarkAfterMove`, режим `write` в `historyEligibility`, вызов в `applySingle`, удалены `lessonStartGate` и отказ по наблюдаемому началу в `dispatch.ts`, отметка урока в недельной проекции                              | b6909ac |
| 4      | Входящий путь: `skipped_marked` только для `done`, без `skipped_past`, снятие `no_show` при переносе позже текущего момента; создание урока в прошлом; `schedule-started.mjs`, правка `calendar-inbound.mjs` случая inbound 5 | 49a4a3c |
| 5      | AGENTS.md: правило переноса и `lesson_done`, писатели отметок и режим записи, входящий путь, `mark` в binding недели                                                                                                          | 4af438b |

## Места `history_only`

Снятые (время начала):

- `changes.ts`: `!canChange(lesson.startsAt)` в `prepareLessonChange` и `!canChange(target)` в проверке цели. `canChange` остался только внутри `clearsMark`, это не отказ по времени.
- `occurrence-change.ts`: `canChange(occurrence.startsAt)` и `canChange(startsAt)`.
- `single-command.ts`: блок наблюдаемого начала Google в прошлом.
- `command-plan.ts`: `canChange(startsAt)` в `prepareCreateCommand`, урок создаётся в прошлом.
- `dispatch.ts`: `lessonStartGate` с вызовом и константой `LESSON_OPERATIONS` (других пользователей не было), отказ `not_applied` по наблюдаемому прошедшему началу в `checkDispatchWindow`.

Оставленные (нет действующего маппинга Google, локальная история): `single-command.ts` строки 29, 41 и 74 (ref не single, нет активного маппинга), `occurrence-change.ts` (нет `naturalStart`), `series.ts`, `recurring-command.ts`, `instance-observation.ts`, `series-observation.ts`, `event-mapping.ts`, текст в `google-calendar-state.tsx`. Серийный уровень входящего пути (`frozenThrough`, `frozenTail`, `cutAt`, `applySplit`) не менялся, его правит 22-18.

## Ключ вхождения

Перенос вхождения пишет исключение `moved` с той же парой `series_id` + `original_on` (`applyOccurrenceChange`), одиночный урок остаётся строкой `lessons` с тем же id. Отметка, будущие комментарии (22-07) и квитанции чата (22-09) привязаны к ключу; ключ прошлого вхождения стабилен. Новый ключ потребовал бы переноса отметок, маппинга Google и сломал бы Undo. Отметка не удаляется: снятие — запись `kind = 'none'` (у `dvlab_app` нет `DELETE` на `lesson_marks`). Случай 2 `schedule-started.mjs` показывает исключение `moved` на том же ключе и неизменное число строк `lesson_marks`.

## Гонка «отметку поменяли между приёмом и применением»

Решение `clearMark` принимается при приёме команды по отметке и цели и хранится в журнале. Пока команда ключа не `applied` и не `failed`, `markOccurrence` и `markLesson` зовут `historyEligibility(..., 'write')`: проверка незавершённых команд идёт до ветки `mark !== null`, поэтому запись отметки ключа отвечает `409 lesson_changed` и для строки с отметкой, в том числе смена `no_show` на `done`. Режим `read` не менялся: `filterHistoryBlocks`, Today и неделя показывают отмеченный урок с незавершённой командой. Если строка всё же стала `done` в обход (проверено прямым `UPDATE` под мигратором), `settleMarkAfterMove` ничего не пишет (`UPDATE ... where kind = 'no_show'`), команда применяется без `precondition_failed`, отметка остаётся `done`.

## Проверки

- `yarn workspace @dv-lab/contracts typecheck` — без ошибок; `yarn workspace @dv-lab/contracts test` — 48 тестов прошли; `yarn workspace @dv-lab/db typecheck` — без ошибок.
- `yarn workspace @dv-lab/api typecheck` — без ошибок после задач 3 и 4; `yarn workspace @dv-lab/web typecheck` — без ошибок.
- `yarn prettier --check` по всем изменённым файлам — чисто.
- `node scripts/dev-checks/schedule-started.mjs` — `SCHEDULE_STARTED_OK`, все 10 случаев (запуск дважды): перенос начавшегося одиночного урока доходит до `applied` и до `start` в Google; `no_show` вхождения при переносе на завтра становится `none`, строк отметок 7 -> 7, остаток +60; перенос в прошлое оставляет `no_show`; `no_show` одиночного урока: позже текущего момента -> `none`, раньше -> `no_show`; `done`: `move` и `cancel` -> `lesson_done`, строк команд 12 -> 12; отмена и возврат начавшегося урока; будущий урок в прошлое; урок, созданный в прошлом, в Earlier, not marked; цель и начало вне окна -> `outside_sync_window` (одиночный урок и вхождение); `binding.mark` done / no_show / null; запись отметки при незавершённой команде -> `changed`, другой ключ -> `ok`, история видна, после применения `none`, защита гонки -> `applied`, `done`.
- `node scripts/dev-checks/calendar-inbound.mjs inbound` — `CALENDAR_INBOUND_OK`.
- `node scripts/dev-checks/calendar-final.mjs` — 15/15, `CALENDAR_FINAL_OK`.

Не запускались: `yarn test` (чистит `dvlab_test`, план его не требует), `yarn lint` (web не менялся, кроме mjs-сценариев), `yarn knip`, браузерные `calendar-web-*.mjs` (нужен dev-стек; web — план 22-02), `yarn workspace @dv-lab/api build` (план его не называет).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `changeRefusal` без ветки `history_only`**

- **Found during:** Task 2
- **Issue:** `prepareLessonChange` больше не возвращает `history_only`, сравнение `failure.kind === 'history_only'` даёт ошибку TS о непересекающихся типах. Критерий плана ожидал `history_only` в `changeRefusal`.
- **Fix:** ветка `history_only` заменена на `lesson_done`; `grep history_only single-command.ts` показывает три строки про маппинг (29, 41, 74).
- **Commit:** db2de5c

**2. [Rule 3 - Blocking] `mark: null` в подменах ответа недели браузерных сценариев**

- **Found during:** Task 3
- **Issue:** web разбирает окно недели строгой схемой (`googleScheduleWindow.safeParse`); подмены binding урока в `calendar-web-grid.mjs`, `calendar-web-editor.mjs` и `calendar-web-drag.mjs` без `mark` перестали бы проходить разбор.
- **Fix:** в четыре подмены добавлено `mark: null`. Файлы вне `files_modified`; сами сценарии не запускались.
- **Commit:** b6909ac

**3. [Rule 1 - Bug] Ожидания `calendar-inbound.mjs` под новое правило**

- **Found during:** Task 4
- **Issue:** строка `none` у одиночного урока и вхождения должна проверяться в inbound 5; добавление строк меняло счётчик отметок серии в inbound 8.
- **Fix:** в `pastFixtures` добавлены строки `none` для начавшегося одиночного урока и для `instances[3]`; inbound 5 ждёт `applied >= 2`, отмену прошедшего вхождения и перенос прошедшего урока при строке `none`, `done` без отметки etag; счётчик inbound 8 считает только `kind = 'done'`.
- **Commit:** 49a4a3c

**4. Данные `schedule-started.mjs`**

- План называл данные `calendar-seed.mjs up test week` + `calendar-commands.mjs fixtures test`. Состояние Google заглушки живёт в процессе, фикстуры другого процесса его теряют, поэтому сценарий берёт `calendar-seed.mjs up test week` и создаёт свою карточку `Alex Example 0004` с уроками командами `create` в процессе (серия с началом 5 недель назад и шесть одиночных уроков, пять из них в прошлом). В конце `calendar-seed.mjs down test` и удаление карточки.

**5. Промежуточное состояние typecheck**

- Между коммитами da20ae0 и b6909ac `yarn workspace @dv-lab/api typecheck` красный в `read-model.ts`: binding урока без обязательного `mark`. Исправлено задачей 3, на HEAD typecheck зелёный.

## Threat Flags

Нет: новых маршрутов, путей входа и доступа к файлам нет; `lesson_done` уходит через существующий `commandRefusal`.

## Known Stubs

Нет.

## Для следующих планов

- 22-18: `exclusionFacts` в `apps/api/src/calendar/recurring.ts` берёт только будущие EXDATE (`start >= now`), поэтому EXDATE начавшегося вхождения без `done` из Google не применяется; inbound 16 по-прежнему ждёт отмену только будущего вхождения. `frozenThrough` и `frozenTail` замораживают по любой строке отметки, включая `none`, и по начавшимся исключениям.
- 22-18, 22-08, 22-10: для окна синхронизации есть `insideSyncWindow` в `calendar/projection.ts`, для снятия отметки — `clearsMark` в `schedule/changes.ts` и `settleMarkAfterMove` в `schedule/marks.ts`.
- 22-03: `settleMarkAfterMove` — третий писатель отметок (вызывается из `command-apply.ts` и `inbound-apply.ts`), ему нужен рост ревизии.
- 22-02: `lessonActions.move` и `cancel` для `done` теперь `false`; `binding.mark` в окне недели; `calendar-web-drag.mjs` содержит сценарий прошедшего урока, рассчитанный на прежние ворота.
- `lesson_done` отказывает и `restore` отменённого урока со старой строкой `done`.

## Self-Check: PASSED

- Файлы: `scripts/dev-checks/schedule-started.mjs` и все изменённые файлы на месте.
- Коммиты da20ae0, db2de5c, b6909ac, 49a4a3c, 4af438b есть в истории ветки.
