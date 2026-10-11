---
phase: 21-lesson-accounting-and-today
plan: 02
subsystem: core, api
status: complete
tags: [core, balance, schedule, lesson-outcome, today, pays-soon]
requires: []
provides:
  - "core: scheduleDate, scheduleToday, isAfterScheduleToday"
  - "core: MarkKind, LessonOutcome, lessonOutcome, occurrenceOutcome, countsAsLesson, isMarked, lessonActions, awaitsMark, withOutcomes, MARK_LOOKBACK_DAYS"
  - "core: countsAfterOpening, deductedMinutes, lessonDeduction, studentBalance, markEffect, needsMark, todayCounts"
  - "core: PAYS_SOON_LESSONS_DEFAULT, balanceState, paysSoon, paysSoonList, balancePhrase"
  - "scripts/dev-checks/ledger-core.mjs"
affects: [21-04, 21-05, 21-06, 21-07, 21-08, 21-09]
tech-stack:
  added: []
  patterns: ["правило остатка и исхода урока у одного владельца в core", "одна «сегодня» по Вьетнаму для api и core"]
key-files:
  created:
    - scripts/dev-checks/ledger-core.mjs
  modified:
    - packages/core/src/schedule.ts
    - packages/core/src/balance.ts
    - packages/core/src/lessons.ts
    - apps/api/src/schedule/changes.ts
    - apps/api/src/schedule/schedule.ts
    - apps/api/src/schedule/rows.ts
    - apps/api/src/routes/payments.ts
    - apps/api/src/routes/students.ts
decisions:
  - "occurrenceOutcome принимает Pick<Occurrence, 'status'>: SingleLesson подходит без своего правила"
  - "markEffect проверяет not_started раньше unmarked и раньше no_opening: у не начавшегося урока подпись одна"
  - "Тип строки todayCounts не экспортируется, чтобы не добавлять knip лишний экспорт"
metrics:
  duration: "~35 мин"
  completed: 2026-10-10
  tasks: 3
  files: 9
estimate:
  tokens: 90000
actuals:
  tokens: 21000
  tasks: 3
  commits: 3
plan_head_before: 0e97c01475a1024b077a71f2b587869d227af7ff
plan_head_after: 7663b3a750447b8a595b7a8a8d93344cf33efb5a
---

# Phase 21 Plan 02: правило остатка, исход урока и «сегодня» в core — Summary

В core появились одна «сегодня» по Вьетнаму, остаток от сырых оплат и уроков (граница строго после даты открытия, вычет за done и no_show по флагу, долг без обрезки), один владелец исхода урока и его действий, markEffect, счётчики Today, порог Pays soon и слова остатка; api сравнивает даты оплат, открывающего остатка и расписания через `isAfterScheduleToday` и `scheduleToday`, `latestPaymentDate` удалён.

## Задачи

| Задача | Что сделано | Коммит |
|--------|-------------|--------|
| 1 (tracer) | `scheduleDate`, `scheduleToday`, `isAfterScheduleToday`; приватная «сегодня» удалена, четыре вызова переведены; `MarkKind`, `LessonOutcome`, `lessonOutcome`, `occurrenceOutcome`; в balance.ts `countsAfterOpening`, `deductedMinutes`, `lessonDeduction`, `studentBalance` (старая `balanceMinutes` осталась для card-facts.ts до 21-07); ledger-core.mjs часть 1 | 4c18615 |
| 2 | `countsAsLesson`, `isMarked`, `lessonActions`, `awaitsMark`, `withOutcomes`, `MARK_LOOKBACK_DAYS`; `markEffect`, `needsMark`, `todayCounts`; `PAYS_SOON_LESSONS_DEFAULT`, `balanceState`, `paysSoon`, `paysSoonList`, `balancePhrase`; ledger-core.mjs часть 2 и проверка зоны процесса | 38befcd |
| 3 | changes.ts и schedule/schedule.ts сравнивают с `scheduleToday(now)`, rows.ts берёт `scheduleDate(from)`; `latestPaymentDate` удалён, payments.ts и students.ts проверяют дату через `isAfterScheduleToday` | 7663b3a |

## Проверки

- `yarn workspace @dv-lab/core typecheck` — код 0 (после каждой задачи).
- `yarn workspace @dv-lab/api typecheck` — код 0 (после задач 1 и 3).
- `node scripts/dev-checks/ledger-core.mjs`:
  - часть 1: `PASS p1 scheduleDate gives the Vietnam date`, `PASS p1 isAfterScheduleToday on both sides of Vietnam midnight`, `PASS p1 studentBalance cases`, `PASS p1 a 00:30 Vietnam lesson is still the opening day in Moscow and UTC`, `PASS p1 scheduleDate = SQL at time zone for every case`, `cards 25 equal 25`, `PASS p1 dvlab_dev balances equal the current SQL rule`, `LEDGER_CORE_PART1_OK`;
  - часть 2: 13 строк PASS p2 (исход блока и вхождения, isMarked и countsAsLesson, матрица lessonActions на границе начала, awaitsMark, needsMark, withOutcomes, markEffect по порядку подписей, todayCounts на дне и без урока впереди, balanceState на границах, paysSoonList, balancePhrase, независимость от зоны процесса America/New_York и Asia/Ho_Chi_Minh), `LEDGER_CORE_OK`.
- `node scripts/dev-checks/schedule-core.mjs` — `CORE_OK` (перевод на `scheduleToday` ничего не сломал).
- `node scripts/dev-checks/schedule-api.mjs changes` — `SCHEDULE_API_CHANGES_OK`.
- `node scripts/dev-checks/schedule-api.mjs read` — `SCHEDULE_API_READ_OK`.
- Критерии приёмки: `todayOf` в schedule.ts — 0; импортов `node:`, `pg`, `@dv-lab/` и `process.env` в packages/core/src нет; по одному `function lessonActions`, `canChange`, `isMarked` в schedule.ts и `needsMark` в balance.ts; `minutes / ` в lessons.ts только в `formatLessons`; `latestPaymentDate` в apps нет; `zonedParts(…SCHEDULE_TIME_ZONE).date` в apps/api нет; `> scheduleToday(` в apps/api нет; `isAfterScheduleToday` есть в payments.ts и students.ts.

Сверка с dvlab_dev шла только чтением под ролью приложения; вывод — только счётчики.

## Что не запускалось

- `yarn test` — по заданию (21-01 работает с dvlab_test).
- Сборка api и web typecheck — план их не называет, web ведёт 21-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Format] Prettier в задаче 2 переформатировал чужой участок schedule.ts**
- **Found during:** задача 2
- **Issue:** `prettier --write` свернул в одну строку объявление `EndSeriesResult`, которое план не трогал.
- **Fix:** в коммите задачи 3 вернул прежний вид; в changes.ts тот же откат для `ChangeFailure` сделан до коммита.
- **Files modified:** packages/core/src/schedule.ts, apps/api/src/schedule/changes.ts
- **Commit:** 7663b3a

### Уточнения к плану

- В students.ts одна проверка даты (дата открывающего остатка), отдельной проверки даты оплаты там нет; всего проверок две (payments.ts и students.ts). `git grep isAfterScheduleToday` находит по две строки в каждом файле (импорт и вызов).
- В сортировке `paysSoonList` деление записано как `(card.balanceMinutes ?? 0) / card.defaultLessonMinutes`, поэтому `grep "minutes / "` находит только `formatLessons`. В `balanceState` деления нет.

## Для следующих планов

- 21-07: card-facts.ts всё ещё зовёт старую `balanceMinutes`; переключить на `studentBalance` и удалить старую функцию. Фильтр `credited_minutes > 0` в новом правиле не нужен: на 25 карточках dvlab_dev результат совпал.
- 21-04: `lessonActions(...).mark` — единственное правило для done, no_show и none; у призрака (`moved`) все действия false. Для одиночного урока исход даёт `occurrenceOutcome(lesson, mark)`.
- Поведение изменилось сознательно (D-12i): дата оплаты и дата открывающего остатка позже сегодняшней по Вьетнаму отклоняются; раньше пропускалась дата до «UTC + 1 сутки».
- knip может показывать новые экспорты core неиспользуемыми, пока их не подключат 21-04…21-09.

## Known Stubs

Нет.

## Self-Check: PASSED

- Файлы на месте: packages/core/src/schedule.ts, balance.ts, lessons.ts, scripts/dev-checks/ledger-core.mjs, пять файлов api.
- Коммиты есть в истории: 4c18615, 38befcd, 7663b3a.
