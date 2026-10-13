---
phase: 22-chat-with-mentions-and-quick-marks
plan: '18'
status: complete
subsystem: api
tags: [schedule, series, google-calendar, inbound, all-from, sync-window, marks]

requires:
  - phase: 22-01
    provides: 'insideSyncWindow, clearsMark, settleMarkAfterMove, правило начавшегося одиночного урока'
provides:
  - 'core: seriesAllFrom(rule, held, lowest) — якорь «all»; cutSeries без отказов from < today и today_passed; новая серия с firstOnOrAfter(newStartsOn ?? from, weekday)'
  - 'rows.ts: heldSeriesDates(executor, seriesId, from?) — единственный загрузчик удерживаемых дат (done, no_show)'
  - 'series.ts: seriesAnchor(executor, rule, connectionId) — единственная сборка allFrom; prepareSeriesChange отказывает precondition_failed или outside_sync_window, если from раньше якоря'
  - 'contracts: calendarSeriesContext.allFrom (calendarDate | null), read-model отдаёт его в неделе'
  - 'inbound-apply.ts: frozenThrough, frozenTail, cutAt и applySplit по seriesAnchor; none и начавшиеся неотмеченные вхождения не замораживают'
  - 'recurring.ts: exclusionFacts(…, notBefore) — EXDATE не раньше начала окна синхронизации'
  - 'scripts/dev-checks/schedule-started-series.mjs: офлайн-приёмка, SCHEDULE_STARTED_SERIES_OK'
affects: [22-02, 22-03, 22-07, 22-08, 22-10]

actuals:
  tokens: 21115
  tasks: 4
  commits: 4
plan_head_before: ef21d6c
plan_head_after: 3616a40

tech-stack:
  added: []
  patterns:
    - 'Якорь серии: seriesAllFrom (чистое правило в core) + heldSeriesDates (загрузчик) + seriesAnchor (сборка с окном синхронизации); web и чат берут allFrom из api'
    - 'Нижнюю границу from проверяет приём (prepareSeriesChange); cutSeries режет с любой даты, которую разрешил вызывающий'

key-files:
  created:
    - scripts/dev-checks/schedule-started-series.mjs
  modified:
    - packages/core/src/schedule-series.ts
    - scripts/dev-checks/schedule-core/series.ts
    - apps/api/src/schedule/rows.ts
    - apps/api/src/schedule/series.ts
    - apps/api/src/calendar/series-observation.ts
    - packages/contracts/src/calendar.ts
    - apps/api/src/calendar/read-model.ts
    - apps/api/src/schedule/inbound-apply.ts
    - apps/api/src/calendar/recurring.ts
    - apps/api/src/calendar/sync.ts
    - scripts/dev-checks/calendar-inbound.mjs
    - scripts/dev-checks/calendar-web-editor.mjs
    - scripts/dev-checks/schedule-started.mjs
    - scripts/dev-checks/README.md
    - AGENTS.md

key-decisions:
  - 'allFrom считается по первой дате окна в поясе серии; если вхождение этой даты начинается раньше windowStart (пояс серии отличается от пояса учителя), якорь сдвигается на следующую дату серии'
  - 'Отказ приёма: from < allFrom или allFrom = null; outside_sync_window, если начало вхождения from (или начало дня from в поясе серии) вне окна, иначе precondition_failed'
  - 'Входящий путь считает якорь на открытой серии (endsOn = null), как прежний nextSeriesDate(open, now): правка мастера применяется и к серии, у которой локально уже стоит ends_on'
  - 'EXDATE мастера применяется не раньше начала окна синхронизации (sync.ts передаёт window.start при полном проходе и windowStart строки при инкрементальном); dispatch по-прежнему передаёт checkedAt: EXDATE собственной записи уже применены локально'

requirements-completed: [CHAT-03]

duration: ~2h
completed: 2026-10-13
---

# Phase 22 Plan 18: Серия с начавшимися вхождениями Summary

«All lessons» и «this and following» режут серию с любой даты не раньше `allFrom` (первая дата серии в окне синхронизации после последнего вхождения с `done` или `no_show`), новая серия начинается с `firstOnOrAfter(newStartsOn ?? from, weekday)` даже в прошлом, а правка серии из Google двигает начавшиеся неотмеченные вхождения так же, как будущие.

## Задачи и коммиты

| Задача | Что сделано                                                                                                                                                | Коммит  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1      | core: `seriesAllFrom`; из `cutSeries` убраны отказ `from < today` и вид `today_passed`; `replacementRule` без `nextSeriesDate`; проверка s10 и новая s17   | dcb438b |
| 2      | `heldSeriesDates`, `seriesAnchor`, отказ в `prepareSeriesChange`, подключение из `series-observation.ts`, `allFrom` в контракте и в `seriesContexts`       | 2576716 |
| 3      | `inbound-apply.ts` по якорю; EXDATE внутри окна (`recurring.ts`, `sync.ts`); `calendar-inbound.mjs`: inbound 7, 8, 16 под новое правило и новый inbound 18 | f96cc62 |
| 4      | `schedule-started-series.mjs`, строка в README, AGENTS.md                                                                                                  | 3616a40 |

## Правило якоря

`allFrom` = первая дата серии `d` (`isSeriesDate`), для которой `d >= max(startsOn, первая дата окна синхронизации в поясе серии)` и `d` позже каждой удерживаемой даты (`original_on` вхождений с `done` или `no_show`). Нет такой даты — `null`. Без подключения или строки синхронизации нижняя граница — `startsOn` (так считает проверка конфликтов `calendar-conflicts.ts`, она зовёт `prepareSeriesChange` без подключения).

Разрез один, поэтому в старой серии остаются: вхождения с `done` и `no_show` на старом времени со своим ключом, отметкой и остатком; неотмеченные вхождения раньше последней отметки; вхождения раньше окна синхронизации. Строка `none` дату не удерживает и остаётся на ключе старой серии.

## Сегодняшний урок на прошедшее время

Раньше «all» с переносом сегодняшнего ещё не начавшегося урока на уже прошедшее время сегодня начинал новую серию через неделю (`nextSeriesDate`). Теперь новая серия начинается сегодня, урок стоит в прошлом, неотмеченный и ждёт отметки (случай 5 приёмки: в `readToday().lessons`, `awaitsMark` = true).

## Изменённые ожидания существующих проверок

- `schedule-core/series.ts` s10: `yesterday` было `invalid`, стало `ok` с `startsOn` 2026-10-15; `startedToday` было `today_passed`, стало `ok` с `startsOn` 2026-10-13; `earlierToday` было `startsOn` 2026-10-19, стало 2026-10-12. Добавлена s17 (`seriesAllFrom`: без удерживаемых дат, с удерживаемыми, серия кончилась).
- `calendar-inbound.mjs`:
  - inbound 7 (UNTIL в прошлое): было «ends_on не раньше начавшегося вхождения со строкой `none`», стало «не раньше `done`, раньше начавшегося неотмеченного».
  - inbound 8 (смена времени мастера): новая серия начинается с начавшегося неотмеченного вхождения после `done`, а не с первого будущего; старая кончается после `done`.
  - inbound 16 (EXDATE): отменяются начавшееся неотмеченное и будущее неотмеченное вхождения, оба `done` заморожены (`skipped_marked >= 2`), было — только будущее.
  - Новый inbound 18: мастер меняет время, `done` три недели назад, два начавшихся вхождения без отметки (одно со строкой `none`): новая серия с первого из них, `done` в старой серии на старом времени.
- `scripts/dev-checks/schedule-api/series.ts` (ожидание `series_today_passed`) не менялся и не запускался: раздел ходит в api на порту 4000 (нужен dev-стек), а маршрут `/series/:id/move` с фазы 25.1 принимает только `moveCalendarSeriesRequest` (строгая схема с `requestId` и `expectedVersion`) и подключение Google. Тело проверки без этих полей получает `400 invalid_request` до разреза, то есть раздел был красным до плана из-за правил 25.1. В `apps/api/src` кода `series_today_passed` больше никто не выдаёт.

## Проверки

- `yarn workspace @dv-lab/core typecheck`, `@dv-lab/contracts typecheck`, `@dv-lab/api typecheck`, `@dv-lab/web typecheck`, затем `yarn typecheck` — без ошибок.
- `node scripts/dev-checks/schedule-core.mjs` — `CORE_OK`.
- `node scripts/dev-checks/calendar-inbound.mjs inbound` — `CALENDAR_INBOUND_OK` (inbound 0-19).
- `node scripts/dev-checks/schedule-started-series.mjs` — `SCHEDULE_STARTED_SERIES_OK` (дважды подряд): случай 1 `allFrom` = вчера; 3 `precondition_failed`, строк команд 2 -> 2; 4 `outside_sync_window`; 2 `applied`, новая серия со вчера, `done` и `no_show` на старой серии, старое время, остаток без изменений; 2b `newStartsOn` даёт `firstOnOrAfter(newStartsOn, weekday)`; 5 урок сегодня в прошлом ждёт отметки; 6 входящий мастер с новым временем: новая серия с начавшегося неотмеченного вхождения, включая сегодняшнее, `done` на старом времени.
- `node scripts/dev-checks/schedule-started.mjs` — `SCHEDULE_STARTED_OK` (10 случаев).
- `node scripts/dev-checks/calendar-final.mjs` — 15/15, `CALENDAR_FINAL_OK`.
- `yarn prettier --check` по изменённым файлам — чисто.
- `grep today_passed packages/core/src/schedule-series.ts`, `grep nextSeriesDate apps/api/src/schedule/inbound-apply.ts`, `grep -e series_today_passed -e "только от сегодня" AGENTS.md` — пусто; `grep seriesAllFrom AGENTS.md` — строка 88.

Не запускались: `yarn test` (чистит `dvlab_test`, план не требует), `yarn lint` (web не менялся), `yarn knip`, `schedule-api.mjs changes` (см. выше), браузерные `calendar-web-*.mjs` (нужен dev-стек; web — план 22-02), `yarn workspace @dv-lab/api build`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] EXDATE начавшегося вхождения (задание оркестратора, отчёт 22-01)**

- **Found during:** Task 3
- **Issue:** `exclusionFacts` оставлял только EXDATE с `start >= now`, поэтому отмена начавшегося вхождения без `done` в Google не доходила до `applyOccurrence`.
- **Fix:** параметр `now` заменён на `notBefore`; `sync.ts` передаёт начало окна синхронизации (полный проход — `window.start`, инкрементальный — `current.windowStart`). `dispatch.ts` не менялся. inbound 16 ждёт отмену начавшегося и будущего вхождений.
- **Files modified:** `apps/api/src/calendar/recurring.ts`, `apps/api/src/calendar/sync.ts` (вне `files_modified`)
- **Commit:** f96cc62

**2. [Rule 3 - Blocking] `allFrom` в подмене недели `calendar-web-editor.mjs`**

- **Found during:** Task 2
- **Issue:** web разбирает окно недели строгой схемой; подмена `json.series` без `allFrom` перестала бы проходить разбор.
- **Fix:** в подмену добавлено `allFrom: originalOn`. Сценарий не запускался (нужен dev-стек).
- **Commit:** 2576716

**3. [Rule 3 - Blocking] Расхождение часов с базой `dvlab_test` в офлайн-сценариях**

- **Found during:** Task 4
- **Issue:** часы базы отстают от локальных примерно на 60 мс. `dispatched_at` пишется временем процесса, `acknowledged_at` и `applied_at` — `now()` базы; заглушка шлюза отвечает мгновенно, и `google_commands_time_ck` отказывает. `schedule-started.mjs` (22-01) падал на первом `create` с `outcome_unknown`; путь `create` правками плана не затронут, причину показал разбор ошибки (нарушение `google_commands_time_ck`), расхождение измерено отдельным запросом `clock_timestamp()`.
- **Fix:** заглушки шлюза в `schedule-started.mjs` и `schedule-started-series.mjs` отвечают через 300 мс; новый сценарий после диспетчеризации повторяет `projectCommand`, если команда осталась `projection_pending` (так делает и воркер на следующем такте). Код api не менялся.
- **Files modified:** `scripts/dev-checks/schedule-started.mjs` (вне `files_modified`), `scripts/dev-checks/schedule-started-series.mjs`
- **Commit:** 3616a40

**4. Контракт: `calendarDate`, а не `isoDate`**

- В `packages/contracts/src/calendar.ts` нет `isoDate`; `allFrom` объявлен как `calendarDate.nullable()`, тип `CalendarSeriesContext` расширен вручную.

**5. Данные приёмки «вчерашнее и сегодняшнее начавшиеся вхождения»**

- У недельной серии не бывает вхождений вчера и сегодня одновременно. Случаи 1-4 идут на серии с днём недели вчерашней даты: `done` две недели назад, `no_show` неделю назад, вчерашнее неотмеченное (`allFrom` = вчера). Случай 6 и inbound 18 идут на серии, где после `done` стоят два начавшихся неотмеченных вхождения (в сценарии второе из них — сегодняшнее в 00:00). Сегодняшний урок, перенесённый на прошедшее время, — случай 5. Перенос серии в сценарии проходит через `executeTransition`, как у воркера; заглушке добавлены `familyEvents`, `identityEvents`, `cancelledEvent`, `cancelledInstance`.

## Наблюдения

- Удаление мастера в Google (или правило, переставшее быть недельным) теперь заканчивает серию днём перед `allFrom`: неотмеченные вхождения в окне синхронизации после последней отметки скрываются вместе с будущими. Это решение владельца (вопрос 4), но у серии без отметок за 8 недель это заметная часть истории.
- При разрезе из Google (смена времени мастера) исключения хвоста старой серии (`cancelled`, `moved`) не материализуются (25.1-09, решение 6). Если начавшееся вхождение хвоста было отменено, а Google оставил отменённый экземпляр со старым `originalStartTime`, новая серия покажет это вхождение неотменённым: строка Google не сопоставится по естественному началу новой серии. Раньше так вели себя только будущие вхождения; теперь — и начавшиеся после последней отметки.

## Для следующих планов

- 22-02: `calendar-lesson-dialog.tsx:103` берёт начало «all» из `nextSeriesDate(rule, now)` — заменить на `series.allFrom` из контекста серии недели (`calendarSeriesContext.allFrom`, `null` — область «all» недоступна). `this and following` допустим для любой даты вхождения не раньше `allFrom`; иначе api ответит `409 precondition_failed` или `409 outside_sync_window`. Контекст серии строится только при свежем чтении и наличии следующего вхождения (`seriesContexts`, без изменений).
- 22-08, 22-10: резолвер чата берёт якорь через `seriesAnchor(executor, rule, connectionId)` из `apps/api/src/schedule/series.ts`, своей границы не считает.
- 22-07: даты вхождений с неотозванными комментариями дописываются в `heldSeriesDates` (`apps/api/src/schedule/rows.ts`); `seriesAnchor`, приём и входящий путь подхватят их без правок.
- 22-03: `settleMarkAfterMove` и писатели отметок не менялись.
- Офлайн-сценарии с заглушкой шлюза на этом стенде нуждаются в задержке ответа заглушки (часы базы отстают): см. отклонение 3.

## Known Stubs

Нет.

## Threat Flags

Нет: новых маршрутов и путей входа нет; `allFrom` — производное поле существующего ответа недели, отказ идёт через существующий `commandRefusal`.

## Self-Check: PASSED

- Файлы: `scripts/dev-checks/schedule-started-series.mjs` и этот SUMMARY на месте.
- Коммиты dcb438b, 2576716, f96cc62, 3616a40 есть в истории (4 из 4).
- `actuals.tokens` — символы `git diff ef21d6c..HEAD` / 4 (84461 / 4).
