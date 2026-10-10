---
phase: 20-schedule
plan: 06
subsystem: api
status: complete
tags: [api, hono, drizzle, schedule, transactions]
requires:
  - phase: 20-01
    provides: таблицы lesson_series, lesson_exceptions, lessons с CHECK и PK (series_id, original_on)
  - phase: 20-02
    provides: occurrenceAt, canChange, cutSeries, endSeriesAt, контракты мутаций и коды lesson_changed, series_ends_before_new_day
  - phase: 20-04
    provides: rows.ts (мапперы, колонки, loadScheduleRows), routes/schedule.ts, schedule-api.mjs
provides:
  - "rows.ts: lockSeries, lockLesson (FOR UPDATE), seriesException, seriesExceptionsFrom"
  - "schedule/changes.ts: moveOccurrence, cancelOccurrence, restoreOccurrence, moveLesson, cancelLesson, restoreLesson, ChangeFailure"
  - "schedule/series.ts: moveSeries, endSeries"
  - "schedule.ts: toWireSeries и toWireLesson экспортированы"
  - "POST /api/schedule/series/:id/occurrences/:originalOn/(move|cancel|restore), /lessons/:id/(move|cancel|restore), /series/:id/move, /series/:id/end"
  - "schedule-api.mjs: раздел changes на порту 4202 (части occurrence, single, series)"
affects: [20-08, 21, 24, 25]
tech-stack:
  added: []
  patterns:
    - "мутация расписания: транзакция, lockSeries или lockLesson первым запросом, решение core, запись результата"
    - "исключение вхождения пишется upsert по (series_id, original_on); cancelled и restored меняют только kind, moved ещё время и длительность"
    - "ответ вхождения считает occurrenceAt по записанной строке исключения"
key-files:
  created:
    - apps/api/src/schedule/changes.ts
    - apps/api/src/schedule/series.ts
  modified:
    - apps/api/src/schedule/rows.ts
    - apps/api/src/schedule/schedule.ts
    - apps/api/src/routes/schedule.ts
    - scripts/dev-checks/schedule-api.mjs
decisions:
  - "toWireSeries и toWireLesson экспортированы из schedule.ts, а не продублированы в changes.ts и series.ts (SQUAD D6)"
  - "Запрос исключений серии с original_on >= from вынесен в rows.ts (seriesExceptionsFrom): строки читаются только через rows.ts"
  - "Тело cancel и restore обязательно JSON (хотя бы {}): без него 400, как у остальных POST"
  - "Порт api в schedule-api.mjs задаётся на раздел: read и next 4201, changes 4202"
metrics:
  duration: "~40 мин"
  completed: 2026-10-10
actuals:
  tokens: 13000
  tasks: 3
  commits: 4
plan_head_before: e55fb7d
requirements-completed: [SCHED-02, SCHED-03, SCHED-05]
---

# Phase 20 Plan 06: мутации расписания в api Summary

Перенос, отмена и возврат одного вхождения серии и одиночного урока, перенос серии разрезом и окончание серии: каждая мутация идёт в транзакции с блокировкой строки через `lockSeries`/`lockLesson` из `rows.ts`, решение принимает core (`occurrenceAt`, `canChange`, `cutSeries`, `endSeriesAt`), api только пишет результат; строки не удаляются, прошлые недели не меняются.

## Задачи

| Задача | Что сделано | Коммит |
|---|---|---|
| 1 (tracer) | `lockSeries`, `lockLesson`, `seriesException` в `rows.ts`; `changes.ts` (вхождения); маршруты `occurrences/:originalOn/(move\|cancel\|restore)`, помощники `notFound`, `lessonChanged`, `refused`; раздел `changes`, часть occurrence | 5aa82de |
| 2 | `moveLesson`, `cancelLesson`, `restoreLesson`; маршруты `/lessons/:id/...`; часть single с гонкой двух вкладок | 4f86b64 |
| 3 | `series.ts` (`moveSeries`, `endSeries`), `seriesExceptionsFrom` в `rows.ts`; маршруты `/series/:id/move` и `/series/:id/end`; часть series | 1f88e6a |

Tracer-гейт: после коммита задачи 1 раздел `changes` перезапущен и снова дал `OCCURRENCE_OK` и `SCHEDULE_API_CHANGES_OK`, расширение продолжено.

## Проверки

| Команда | Результат |
|---|---|
| `yarn workspace @dv-lab/api typecheck` (после каждой задачи) | код 0 |
| `node scripts/dev-checks/schedule-api.mjs changes` (последний прогон) | 87 PASS, 0 FAIL, `OCCURRENCE_OK`, `SINGLE_OK`, `SERIES_OK`, `SCHEDULE_API_CHANGES_OK`, код 0 |
| `node scripts/dev-checks/schedule-api.mjs read` | 27 PASS, `SCHEDULE_API_READ_OK`, код 0 |
| `node scripts/dev-checks/schedule-api.mjs next` | 7 PASS, `SCHEDULE_API_NEXT_OK`, код 0 |
| `yarn prettier --write` по файлам плана | применено, typecheck после него код 0 |
| карточки `Alex Example 20%` в dvlab_test после прогонов | 0 |
| `lsof -nP -iTCP:4202 -sTCP:LISTEN` и `:4201` | пусто (код 1) |

Строки PASS раздела `changes` по частям:

```
PASS past weeks snapshot holds one S1 block per week
PASS move dW to Friday 10:00 gives 200 moved
PASS week dW has the moved ghost and the Friday destination
PASS next Wednesday is unchanged
PASS move dW+14 to Monday of week dW+7 gives 200
PASS week dW+7 has the destination from dW+14 and its own Wednesday
PASS week dW+14 has the ghost of the moved Wednesday
PASS cancel dW+7 gives 200 cancelled
PASS week dW+7 shows the cancelled Wednesday
PASS second cancel of dW+7 gives 409
PASS restore dW+7 gives 200 scheduled
PASS week dW+7 shows the Wednesday scheduled again
PASS exception row of dW+7 stays with kind restored
PASS restore of a scheduled occurrence gives 409
PASS cancel the moved dW+14 gives 200
PASS week dW+14 shows the cancelled Wednesday on its natural place
PASS week dW+7 no longer has the destination of dW+14
PASS cancelled dW+14 keeps the moved time in its row
PASS restore dW+14 gives the Wednesday on its place
PASS week dW+14 shows the Wednesday scheduled
PASS move dW back to Wednesday 18:00 gives 200 scheduled
PASS exception row of dW has kind restored
PASS week dW shows one Wednesday block
PASS move of a Thursday originalOn gives 409
PASS move of a past Wednesday gives 409
PASS cancel of a past Wednesday gives 409
PASS move into today 00:00 gives 400
PASS cancel with expectedStartsAt one hour early gives 409
PASS move to yesterday gives 400
PASS move to the current time gives 400
PASS move of an unknown series gives 404
PASS move with originalOn abc gives 404
PASS cancel without a JSON body gives 400
PASS S1 keeps 3 exception rows
PASS past weeks snapshot is unchanged after occurrence changes
OCCURRENCE_OK
PASS move L1 to next Thursday 14:00 gives 200
PASS L1 shows only on its new place
PASS move L1 into today 00:00 gives 400
PASS cancel L1 gives 200 cancelled
PASS week shows L1 cancelled
PASS restore L1 gives 200 scheduled
PASS week shows L1 scheduled
PASS cancel L1 with a stale expectedStartsAt gives 409
PASS two parallel cancels of L1 give one 200 and one 409
PASS move of the cancelled L1 gives 409
PASS move of the past L2 gives 409
PASS cancel of the past L2 gives 409
PASS move of an unknown lesson gives 404
PASS restore of an unknown lesson gives 404
PASS cancel of lesson id abc gives 404
PASS past L2 row is unchanged
PASS two parallel cancels of S1 dW+35 give one 200 and one 409
PASS S1 dW+35 exception row is cancelled
SINGLE_OK
PASS move dW to Friday 10:00 again gives 200
PASS move dW+14 to Monday of week dW+7 12:00 again gives 200
PASS move dW+21 to Tuesday 09:00 gives 200
PASS cancel dW+28 gives 200
PASS move S1 from dW+14 to Thursday 17:00 gives 200 with the new series
PASS old series ends on dW+13
PASS cut adds one series and two lessons and keeps every exception row
PASS moved occurrences after From became lessons at their destination times
PASS week dW+21 has no Wednesday, has the new Thursday 17:00 and one Tuesday 09:00 lesson
PASS week dW+28 has no cancelled Wednesday and has the new Thursday
PASS week dW+35 drops the cancelled exception of S1
PASS week dW keeps the moved ghost and the Friday destination of S1
PASS week dW+7 keeps the restored Wednesday and one Monday 12:00 lesson
PASS repeat of the same cut gives 409
PASS repeated cut adds no series
PASS cut with From today after the started lesson of today gives 409
PASS cut to the same day and time gives 400
PASS cut from yesterday gives 400
PASS cut of a series ended last week gives 409
PASS cut of a series that ends before the new day gives 400 series_ends_before_new_day
PASS refused cut keeps S4 and the series count
PASS cut of an unknown series gives 404
PASS End of the new series on its second date gives 200
PASS new series shows on its second date and not after
PASS End with lastOn after the end gives 400
PASS End with lastOn yesterday gives 400
PASS End of an unknown series gives 404
PASS End of a series that starts in two weeks gives endsOn = startsOn - 1
PASS emptied series has no blocks
PASS End keeps the lesson_series rows
PASS past weeks snapshot is unchanged by the cut
PASS past weeks snapshot is unchanged after every change
SERIES_OK
PASS row counts never decreased over 24 samples
PASS api log has no fixture name
SCHEDULE_API_CHANGES_OK
```

Acceptance-grep: `.delete(` в `apps/api/src/schedule` нет (код 1); `occurrenceAt` в `changes.ts` 3, `canChange` 5; `isSeriesDate|weekdayOf(` в `changes.ts` нет (код 1); сравнений с `now` в `changes.ts` и `series.ts` нет (код 1); `for('update')` в `changes.ts` 0, в `series.ts` 0, в `rows.ts` 2; `lockLesson` в `changes.ts` 4; `cutSeries` и `endSeriesAt` в `series.ts` по 2; `lastSeriesDateOnOrBefore|firstOnOrAfter|nextSeriesDate` в `series.ts` нет (код 1); `set({` с колонками правила в `series.ts` нет (код 1).

## Для фазы 24

Ключ вхождения (серия + исходная дата) стабилен только для прошлых вхождений и для серии после её последнего разреза; разрез создаёт новую серию с новыми ключами будущих вхождений, а перенесённые вхождения становятся одиночными уроками, поэтому синхронизации с Google нужен маппинг или пересборка событий при разрезе.

## Что не запускалось

- `yarn workspace @dv-lab/api build`: план сборку не называет (tsdown стирает `dist`).
- `yarn test`: чистит dvlab_test при параллельном исполнителе; тестов на маршруты расписания нет.
- Lint: у `@dv-lab/api` нет скрипта lint; форматирование проверено prettier.
- web не трогался; dev-стек 20-07 на 3000 и 4000 не останавливался.

## Важно следующим планам

- 20-08: маршруты мутаций и формы ответов: вхождение `{ occurrence: { seriesId, originalOn, status, startsAt } }`, урок `{ lesson }`, серия `{ series }` (после переноса серии это новая серия). 404 `not_found` для неверных и неизвестных id и дат в пути, 409 `lesson_changed` для начавшегося, уже отменённого или изменённого в другой вкладке урока, 400 `invalid_request` для цели в прошлом, совпадающего времени и From/Last lesson on раньше сегодня, 400 `series_ends_before_new_day` для серии, которая кончается раньше первого урока на новом дне. Тело cancel и restore — JSON, хотя бы `{}`; `expectedStartsAt` (ISO) сверяется по моменту: для restore вхождения это естественное время.
- Перенос вхождения на его естественное время записывает `kind restored`; отмена перенесённого вхождения оставляет время переноса в строке, возврат ставит урок на естественное место.
- После разреза moved-исключения с `original_on >= from` становятся одиночными уроками, все исключения старой серии остаются в базе; опустевшая серия получает `ends_on = starts_on - 1`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Экспорт `toWireSeries` и `toWireLesson` из `schedule.ts`**
- **Found during:** задача 1
- **Issue:** проводные мапперы лежали в `schedule.ts` неэкспортированными, а файла нет в `files_modified`; `changes.ts` и `series.ts` без них дублировали бы мапперы (SQUAD D6)
- **Fix:** добавлено слово `export` у двух функций, больше `schedule.ts` не менялся
- **Files modified:** apps/api/src/schedule/schedule.ts
- **Commit:** 5aa82de

**2. [Rule 1 - Bug] Подготовка части series под состояние после части occurrence**
- **Found during:** задача 3
- **Issue:** план ждёт в разрезе lessons на месте назначения dW+14 (понедельник недели dW+7 12:00) и в неделе dW пятничное место назначения, но часть occurrence по тому же плану возвращает dW+14 и dW на исходные места (kind restored), так что эти проверки были бы ложными
- **Fix:** часть series перед разрезом снова переносит dW на пятницу 10:00 и dW+14 на понедельник недели dW+7 12:00 (вместе с плановыми переносом dW+21 и отменой dW+28); проверки недели dW (призрак и пятница остаются у старой серии) и недели dW+7 (восстановленная среда dW+7 и ровно один одиночный урок в понедельник 12:00) идут как в плане
- **Files modified:** scripts/dev-checks/schedule-api.mjs
- **Commit:** 1f88e6a

Дополнения в рамках плана: `seriesExceptionsFrom` в `rows.ts` вместо запроса в `series.ts`; проверка, что снимок прошлых недель непустой (3 блока S1); проверка 400 без JSON-тела; 404 для неизвестной серии в move и end; проверка, что строка прошлого L2 не изменилась.

Отметка о рабочем процессе: леджер коммитов из промпта исполнителя не запускался (хук изоляции запрещает переменные и `$(...)`), вместо него `scripts/gsd/root-pin.sh` перед правками и каждым коммитом; `plan_head_before` взят из `git log` (e55fb7d), `commits` — три коммита задач и коммит этого SUMMARY.

## Known Stubs

Нет.

## Self-Check: PASSED

- Файлы на месте: `apps/api/src/schedule/changes.ts`, `apps/api/src/schedule/series.ts`, `apps/api/src/schedule/rows.ts`, `apps/api/src/routes/schedule.ts`, `scripts/dev-checks/schedule-api.mjs`.
- Коммиты в истории ветки: 5aa82de, 4f86b64, 1f88e6a.
