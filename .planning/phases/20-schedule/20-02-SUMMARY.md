---
phase: 20-schedule
plan: 02
subsystem: core
status: complete
tags: [core, contracts, zod, intl, timezone, schedule]
requires: []
provides:
  - "packages/core/src/zoned.ts: zonedParts, zonedInstant, addDays, weekdayOf, mondayOf, firstOnOrAfter, windowDates"
  - "packages/core/src/schedule.ts: SCHEDULE_TIME_ZONE, canChange, occurrenceKey, isSeriesDate, seriesStart, occurrenceAt, scheduleWindow, nextLessons, nextSeriesDate, lastSeriesDateOnOrBefore, overlaps, cutSeries, endSeriesAt, emptySeriesEnd, hasOccurrences"
  - "packages/contracts/src/schedule.ts: запросы и ответы расписания"
  - "коды ошибок lesson_changed и series_ends_before_new_day"
  - "scripts/dev-checks/schedule-core.mjs"
affects: [20-04, 20-05, 20-06, 20-07, 20-08, 21, 24, 25]
tech-stack:
  added: []
  patterns:
    - "видимость вхождения серии только через occurrenceAt; остальные функции не сравнивают originalOn с диапазоном серии"
    - "«сегодня» в коде расписания только через zonedParts(now, SCHEDULE_TIME_ZONE)"
    - "даты YYYY-MM-DD через Date.UTC и toISOString().slice(0, 10)"
key-files:
  created:
    - packages/core/src/zoned.ts
    - packages/core/src/schedule.ts
    - packages/contracts/src/schedule.ts
    - scripts/dev-checks/schedule-core.mjs
  modified:
    - packages/core/src/index.ts
    - packages/contracts/src/auth.ts
    - packages/contracts/src/index.ts
    - packages/contracts/test/auth.test.ts
decisions:
  - "Призрак перенесённого вхождения (блок moved в естественное время) рисуется с длительностью серии, блок назначения — с длительностью исключения"
  - "cutSeries отбирает moved-исключения через occurrenceAt по хвосту старой серии (startsOn = max(startsOn, from)): исключения раньше from не дают строк lessons, даже если api передаст их по ошибке"
  - "cutSeries.newRule имеет тип NewSeriesRule = Omit<SeriesRule, 'id'>: id новой серии выдаёт база"
  - "overlaps — обобщённая функция <T extends OverlapItem>: возвращает элементы исходного типа (ScheduleBlock core или блок web)"
  - "Функции дат серии принимают SeriesTiming (weekday, startTime, startsOn, endsOn), без id и studentId: так cutSeries считает даты нового правила до вставки"
  - "nextLessons учитывает урок, начинающийся ровно в now (startsAt >= now, D-13), а canChange для того же момента даёт false (D-05)"
metrics:
  duration: "~35 мин"
  completed: 2026-10-10
actuals:
  tokens: 8500
  tasks: 3
  commits: 3
requirements-completed: [SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05, CARD-04]
---

# Phase 20 Plan 02: Правило вхождений в core и контракты расписания Summary

Одно правило вхождений серии в `packages/core` (`occurrenceAt`), перевод местного времени Вьетнама в момент, совпадающий с Postgres, окно недели с переносами между неделями и скрытием истории D-16, следующий урок, перекрытия, `canChange`, разрез и окончание серии чистыми функциями; контракты web/api расписания и коды `lesson_changed` (409) и `series_ends_before_new_day` (400).

## Задачи

| Задача | Что сделано | Коммит |
|---|---|---|
| 1 (tracer) | `zoned.ts` (двухпроходный сдвиг из RESEARCH Pattern 5, кэш `Intl.DateTimeFormat`), `schedule.ts` (типы, `canChange`, `occurrenceKey`, `isSeriesDate`, `seriesStart`, `occurrenceAt`, `scheduleWindow`), экспорт в `index.ts`, часть 1 `schedule-core.mjs` | 83cbf4f |
| 2 | `nextSeriesDate`, `lastSeriesDateOnOrBefore`, `nextLessons`, `overlaps`, `emptySeriesEnd`, `hasOccurrences`, `cutSeries`, `endSeriesAt`; сценарии 1-12 в `schedule-core.mjs` | 9a9ccec |
| 3 | `contracts/src/schedule.ts`, коды ошибок в `auth.ts` после `payment_already_assigned`, тот же порядок в `test/auth.test.ts`, экспорт в `index.ts` | 706e5ab |

Tracer-гейт: проверки задачи 1 (typecheck и часть 1 скрипта) прошли до коммита, расширение продолжено.

## Проверки

| Команда | Результат |
|---|---|
| `yarn workspace @dv-lab/core typecheck` (после задач 1 и 2) | код 0 |
| `node scripts/dev-checks/schedule-core.mjs` | 14 строк PASS части 1, `CORE_PART1_OK`, 12 строк PASS сценариев, `CORE_OK`, код 0 |
| `yarn workspace @dv-lab/contracts typecheck` | код 0 |
| `yarn workspace @dv-lab/contracts test` | 2 файла, 48 тестов, все прошли |
| `yarn workspace @dv-lab/api typecheck` (контроль, что новые экспорты contracts ничего не ломают) | код 0 |
| разовая проба схем contracts из временной папки (14 случаев: длина, время 24:00, дата 2026-02-30, weekday 0 и 8, repeats, expectedStartsAt) | 15 PASS |
| `prettier --check` по файлам плана | чисто после `--write` |

Строки PASS части 1 (сверка с SQL на `dvlab_test`):

```
PASS zonedInstant 2026-10-14 18:00 Asia/Ho_Chi_Minh = SQL
PASS zonedParts round trip 2026-10-14 18:00 Asia/Ho_Chi_Minh
PASS zonedInstant 2026-01-01 00:00 Asia/Ho_Chi_Minh = SQL
PASS zonedParts round trip 2026-01-01 00:00 Asia/Ho_Chi_Minh
PASS zonedInstant 2026-12-31 23:45 Asia/Ho_Chi_Minh = SQL
PASS zonedParts round trip 2026-12-31 23:45 Asia/Ho_Chi_Minh
PASS zonedInstant 2026-10-14 18:00 Europe/Moscow = SQL
PASS zonedParts round trip 2026-10-14 18:00 Europe/Moscow
PASS zonedInstant 2026-03-29 12:00 Europe/Berlin = SQL
PASS zonedParts round trip 2026-03-29 12:00 Europe/Berlin
PASS zonedInstant 2026-10-25 12:00 Europe/Berlin = SQL
PASS zonedParts round trip 2026-10-25 12:00 Europe/Berlin
PASS weekdayOf = isodow for 14 days
PASS week window gives one Wednesday block
CORE_PART1_OK
```

Строки PASS сценариев 1-12:

```
PASS s1 empty series has no dates, blocks or next lesson
PASS s2 cancelled exception gives a cancelled block, restored gives scheduled
PASS s3 move inside the week gives a ghost and a destination with one key
PASS s4 move from next Wednesday to this Monday shows in both weeks
PASS s5 history after ends_on stays hidden
PASS s6 next lesson is the minimum of series, moved and single lessons
PASS s7 overlaps skip cancelled and moved, touching ends do not overlap, excludeKey works
PASS s8 series dates at startsOn, endsOn, empty series and a start 300 days ahead
PASS s9 canChange is false at now and true one millisecond later
PASS s10 cutSeries checks, old end, new rule and moved lessons
PASS s11 endSeriesAt checks and resulting ends_on
PASS s12 results do not depend on the process zone
CORE_OK
```

Сценарии части 2 считаются от фиксированного `now` = 2026-10-12 10:00 по Вьетнаму (понедельник), поэтому вывод детерминирован; сценарий 12 запускает скрипт дочерними процессами с `TZ=America/New_York` и `TZ=Asia/Ho_Chi_Minh` и сравнивает JSON обоих с результатом родителя. Данные сценариев вымышленные (`student-alex-0001`, `series-a` и подобные), в базу ничего не пишется: SQL только `select` выражений без таблиц.

Acceptance-grep: зависимостей и Node API в `packages/core/src` нет (код 1), `process.env` нет (код 1), `getDay(`, `getDate(`, `toLocaleDateString`, `localIsoDate` в `zoned.ts` и `schedule.ts` нет (код 1); `function occurrenceAt` и `function canChange` по 1; сравнений `originalOn` с датами нет (код 1); в `contracts/src/schedule.ts` `LESSON_MINUTES_MIN` встречается 2 раза, литералов 15 и 240 нет, чужих импортов нет.

## Что важно следующим планам

- api (20-04, 20-06): `cutSeries` возвращает `invalid` | `changed` | `ends_before_new_day` (с `endsOn` старой серии) | `ok` с `oldEndsOn`, `newRule` без id и `lessons` (студент, начало, длина) для вставки в `lessons`; исключения не трогаются. `endSeriesAt` возвращает `invalid` | `changed` | `ok` с `endsOn`; пустая серия кодируется `emptySeriesEnd` (startsOn - 1). В `cutSeries` можно передавать все исключения серии: отбор `original_on >= from` идёт внутри через `occurrenceAt`.
- `scheduleWindow` и `nextLessons` принимают надмножество строк: история D-16 отсекается в core, фильтров видимости в SQL не нужно. Исключения чужих серий или без серии в `series` пропускаются.
- `SeriesException` несёт `startsAt` и `durationMinutes` только у `moved`; время, оставшееся у `cancelled` и `restored` в базе, в core не передаётся.
- `overlaps(items, candidate, excludeKey)` берёт `excludeKey` строкой (`occurrenceKey`), а не ref; ключ у призрака и места назначения один, поэтому при переносе исключаются оба.
- `ScheduleBlock` в contracts — проводной формат (ISO-строки, `studentName`, `studentStatus`, `studentGoal`, `changeable`); `ScheduleBlock` в core — с `Date`. Имена совпадают, при импорте из обоих пакетов нужен псевдоним.
- `windowDates` для окна недели по Вьетнаму даёт 7 дат; маршрут сам ограничивает границы окна (T-20-05).

## Deviations from Plan

None - план выполнен как написан. Дополнения в рамках плана: экспортированы вспомогательные типы `SeriesTiming`, `ScheduleInput`, `NewSeriesRule`, `CutLesson`, `SeriesChange`, `CutSeriesResult`, `EndSeriesResult`, `LessonRepeats`; сценарий 10 дополнительно проверяет, что moved-исключение раньше from не даёт строки lessons, сценарий 11 — что уже закончившаяся серия даёт `changed`.

## Known Stubs

Нет.

## Self-Check: PASSED

- Файлы на месте: `packages/core/src/zoned.ts`, `packages/core/src/schedule.ts`, `packages/contracts/src/schedule.ts`, `scripts/dev-checks/schedule-core.mjs`.
- Коммиты в истории ветки: 83cbf4f, 9a9ccec, 706e5ab.
