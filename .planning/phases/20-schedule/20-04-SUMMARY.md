---
phase: 20-schedule
plan: 04
subsystem: api
status: complete
tags: [api, hono, drizzle, schedule, cards]
requires:
  - phase: 20-01
    provides: таблицы lesson_series, lesson_exceptions, lessons
  - phase: 20-02
    provides: scheduleWindow, nextLessons, nextSeriesDate, canChange, zonedInstant, контракты расписания
provides:
  - "apps/api/src/schedule/rows.ts: loadScheduleRows, toSeriesRule, toSeriesException, toSingleLesson, seriesColumns, exceptionColumns, lessonColumns"
  - "apps/api/src/schedule/schedule.ts: readWeek, createLesson"
  - "GET /api/schedule/week?start=<понедельник>, POST /api/schedule/lessons"
  - "apps/api/src/cards/card-facts.ts: cardFacts, CardFacts, NO_CARD_FACTS"
  - "StudentRow.nextLessonAt (и в StudentDetail через пересечение)"
  - "scripts/dev-checks/schedule-api.mjs: разделы read и next"
affects: [20-05, 20-06, 20-07, 20-08, 21, 24, 25]
tech-stack:
  added: []
  patterns:
    - "один загрузчик надмножества строк расписания для окна недели и для «от сейчас»; видимость решает core"
    - "производные факты карточки (остаток, следующий урок) считает только cardFacts в apps/api/src/cards"
    - "now читается в маршруте или один раз в listCards/toDetail и передаётся вниз"
key-files:
  created:
    - apps/api/src/schedule/rows.ts
    - apps/api/src/schedule/schedule.ts
    - apps/api/src/routes/schedule.ts
    - apps/api/src/cards/card-facts.ts
    - scripts/dev-checks/schedule-api.mjs
  modified:
    - apps/api/src/app.ts
    - apps/api/src/cards/card-rows.ts
    - apps/api/src/cards/cards.ts
    - packages/contracts/src/students.ts
decisions:
  - "Повтор weekly-запроса ищет открытую серию по карточке, weekday, start_time и вычисленному starts_on (без длительности) и отвечает 200 с ней"
  - "Статус ученика в блоках недели сужается локальной функцией в schedule.ts по STUDENT_STATUSES: модуль расписания не импортирует cards"
  - "notFound в routes/schedule.ts не объявлен: маршрутов с id в этом плане нет, 20-06 добавит его вместе с ними"
metrics:
  duration: "~30 мин"
  completed: 2026-10-10
actuals:
  tokens: 9500
  tasks: 2
  commits: 3
requirements-completed: [SCHED-01, SCHED-04, CARD-04]
---

# Phase 20 Plan 04: api недели, создание уроков и следующий урок карточки Summary

Неделя расписания читается из api по одному правилу core (`scheduleWindow` над надмножеством строк одного загрузчика `loadScheduleRows`), `POST /schedule/lessons` создаёт одиночный урок или идемпотентную еженедельную серию, а `nextLessonAt` в списке учеников и карточке считает один владелец фактов `cardFacts` через тот же загрузчик и `nextLessons`.

## Задачи

| Задача | Что сделано | Коммит |
|---|---|---|
| 1 (tracer) | `rows.ts` (загрузчик и мапперы, `HH:MM:SS` → `HH:MM` только здесь), `schedule.ts` (`readWeek`, `createLesson` в транзакции с `for update` карточки), `routes/schedule.ts`, подключение в `app.ts`, раздел `read` в `schedule-api.mjs` | 8b224b7 |
| 2 | `StudentRow.nextLessonAt`, `card-facts.ts` (перенесённый без изменений `cardBalances` и следующий урок), `toCardRow`/`toStudentDetail` принимают `CardFacts`, `cards.ts` зовёт `cardFacts`, раздел `next` | 699f2ef |

Tracer-гейт: после коммита задачи 1 раздел `read` перезапущен и снова дал `SCHEDULE_API_READ_OK`, расширение продолжено.

## Проверки

| Команда | Результат |
|---|---|
| `yarn workspace @dv-lab/api typecheck` (задачи 1 и 2) | код 0 |
| `yarn workspace @dv-lab/contracts typecheck` | код 0 |
| `node scripts/dev-checks/schedule-api.mjs read` (3 прогона: до коммита, tracer-гейт, после задачи 2) | 27 PASS, `SCHEDULE_API_READ_OK`, код 0 |
| `node scripts/dev-checks/schedule-api.mjs next` | 7 PASS, `SCHEDULE_API_NEXT_OK`, код 0 |
| `prettier --write` по файлам плана | применено, typecheck после форматирования код 0 |
| счётчик фикстур `Alex Example 20%` в dvlab_test после прогонов | 0 |
| порт 4201 после прогонов | никто не слушает |

Вывод раздела `read` (последний прогон, uuid серии фикстуры удалённой карточки):

```
fixture tails removed 0
PASS weekly create gives 201 series on weekday 3 at 18:00 from the chosen Wednesday
series cc580457-481b-434d-926b-f4ae12a81da4
PASS once create gives 201 lesson
PASS once create in the past gives 201
PASS week 2026-10-12 has one series block at 2026-10-14 18:00
PASS first series block equals SQL instant
PASS week 2026-10-19 has one series block at 2026-10-21 18:00
PASS week 2026-10-26 has one series block at 2026-10-28 18:00
PASS week 2026-10-05 before the series has no series block
PASS single lesson shows only in its week of 4 weeks
PASS past lesson block is not changeable
PASS series start_time is stored as 18:00:00
PASS repeated weekly request gives 200 with the same series and no second row
PASS weekly today at 00:00 starts a week later
PASS weekly on yesterday gives 400
PASS week start on Tuesday gives 400
PASS week start 1999-12-27 gives 400
PASS week start 2101-01-03 gives 400
PASS week start x gives 400
PASS startTime 24:00 gives 400
PASS durationMinutes 10 gives 400
PASS unknown studentId gives 400
PASS POST without Origin gives 403
PASS GET week without cookie gives 401
PASS student session gives 403
PASS archived card gives 400
PASS refused requests stored no lessons
PASS api log has no fixture name
SCHEDULE_API_READ_OK
```

Вывод раздела `next`:

```
fixture tails removed 0
series 40f15139-7c6a-44e9-92c6-b1ed192776f4 moved from 2026-10-14 to 2026-10-13 10:00, cancelled lesson at 2026-10-12T05:00:00.000Z
PASS list gives the moved Tuesday 10:00 as next lesson for the card with lessons
PASS list gives null next lesson for the card without lessons
PASS every list row carries nextLessonAt
PASS card detail gives the same next lesson
PASS earliest future scheduled week block equals nextLessonAt
PASS week shows the cancelled lesson and the moved ghost but neither is next
PASS api log has no fixture name
SCHEDULE_API_NEXT_OK
```

Acceptance-grep: сравнений `originalOn` с `startsOn`/`endsOn` в `rows.ts` нет (код 1); `slice(0, 5)` в `apps/api/src/schedule` только в `rows.ts`; `localIsoDate`/`latestPaymentDate` в модуле расписания и `core/schedule.ts` нет (код 1); `.delete(` в `apps/api/src/schedule` нет (код 1); `function cardBalances` одна, в `card-facts.ts`; `nextLessons(` вызывается только в `card-facts.ts`; `cards/` в `apps/api/src/schedule` нет (код 1).

## Что не запускалось

- `yarn workspace @dv-lab/web typecheck`: скрипт делает `next typegen` в общий `.next`, который держит 20-05. Web `StudentRow` только читает (литералов `StudentRow` в `apps/web` нет, проверено grep), новое поле читателей не ломает.
- `yarn test`: чистит dvlab_test при параллельных исполнителях. Тестов на форму `StudentRow` в `apps/api` нет (grep `balanceMinutes` по `apps/api/test` пуст).
- Сборка api (tsdown) не запускалась по плану.

## Важно следующим планам

- 20-06: мапперы `toSeriesRule`, `toSeriesException`, `toSingleLesson` и колонки `seriesColumns`, `exceptionColumns`, `lessonColumns` экспортированы из `rows.ts`; строки исключений для `cutSeries` берите через них. В `routes/schedule.ts` пока только `invalidRequest`; `notFound` и `lessonChanged` добавить вместе с маршрутами по id. Раздел `changes` добавляется в `SECTIONS` скрипта; обвязка (очистка хвостов `Alex Example 20%` в начале, своих id в finally, проверка логов) общая.
- `createLesson` weekly: `starts_on` = `nextSeriesDate` от выбранной даты; сегодня с прошедшим временем даёт ту же дату через неделю. Повтор с теми же полями возвращает 200 и существующую серию.
- `ScheduleWeekResponse.series` содержит только правила, на которые ссылаются блоки недели (в том числе серии-владельцы переносов из других недель).
- `cardFacts` принимает `now` от вызывающего: `listCards` и `toDetail` читают `new Date()` один раз на вызов. `createCard` отдаёт `NO_CARD_FACTS`.
- `apps/web/AGENTS.md` в рабочем дереве создан `next dev` плана 20-05, этот план его не трогал.

## Deviations from Plan

None - план выполнен как написан. Мелочи в рамках плана: `notFound` в роутере не объявлен (неиспользуемая константа), в разделе `read` добавлены проверки `2101-01-03` (верхняя граница), длительности и `changeable` одиночного урока, отсутствия лишних строк lessons после отказов; в разделе `next` отменённый урок ставится в понедельник 12:00 перед вторником, а если этот момент уже прошёл, во вторник 08:00, чтобы он всегда был раньше переноса и проверял, что отменённое не считается.

Отметка о рабочем процессе: леджер коммитов из промпта исполнителя не запускался (хук изоляции запрещает переменные и `$(...)`), вместо него `scripts/gsd/root-pin.sh` перед правками и каждым коммитом; `commits` посчитан по `git log` (8b224b7, 699f2ef и коммит этого SUMMARY).

## Known Stubs

Нет.

## Self-Check: PASSED

- Файлы на месте: `apps/api/src/schedule/rows.ts`, `apps/api/src/schedule/schedule.ts`, `apps/api/src/routes/schedule.ts`, `apps/api/src/cards/card-facts.ts`, `scripts/dev-checks/schedule-api.mjs`.
- Коммиты в истории ветки: 8b224b7, 699f2ef.
