---
phase: 21-lesson-accounting-and-today
plan: 17
subsystem: schedule
tags: [schedule, lesson-actions, move-anywhere, lesson-marks, balance, today, design-v38, playwright]
requires:
  - phase: 21-lesson-accounting-and-today
    provides: lessonActions и markEffect (21-02), разрез серии с копией отметки (21-04), зоны и протяжка (21-06), остаток по отметкам и GET /today (21-07), тексты и форма переноса v36 (21-14)
provides:
  - lessonActions: move = countsAsLesson(outcome), mark с исправлением отмеченного урока в любое время, новое действие series
  - markEffect: not_started только у неотмеченного будущего урока
  - api без отказов по времени у переноса; коды lesson_in_past и target_in_past удалены из api, контракта и web
  - ScheduleLessonActions с полем series
  - диалог урока и форма переноса по block.actions без своих проверок времени; вопрос отмены и тосты отмены, возврата, Series added и Series moved только в основной зоне (v38)
  - раздел moves в scripts/dev-checks/ledger-api.mjs, часть partMoveAnywhere в schedule-api.mjs, сценарии s15 и s16 в schedule-core.mjs, часть move-past в разделе changes schedule-web.mjs
affects: [21-08, 21-10, 21-11, 21-12, 21-16]
status: complete
commits: 3
plan_head_before: 7e19ddb4a4ef407fffefd2660723d4de3aa0a551
plan_head_after: a0128b76e64b333fce2b0e4736e99fe3b089cb97
actuals:
  tokens: 12000
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - "Правило переноса, исправления отметки и блока Whole series живёт только в lessonActions (core); api отказывает по нему 409 lesson_changed, web показывает кнопки по block.actions"
key-files:
  created: []
  modified:
    - packages/core/src/schedule.ts
    - packages/core/src/balance.ts
    - packages/contracts/src/schedule.ts
    - packages/contracts/src/auth.ts
    - packages/contracts/test/auth.test.ts
    - apps/api/src/schedule/changes.ts
    - apps/api/src/schedule/rows.ts
    - apps/api/src/routes/schedule.ts
    - apps/web/app/(app)/schedule/_components/lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/lesson-move-form.tsx
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/move-series-dialog.tsx
    - scripts/dev-checks/ledger-core.mjs
    - scripts/dev-checks/schedule-core.mjs
    - scripts/dev-checks/schedule-api.mjs
    - scripts/dev-checks/ledger-api.mjs
    - scripts/dev-checks/schedule-web.mjs
key-decisions:
  - "D-17a: перенос = countsAsLesson(outcome), цель переноса — любые дата и время; отказ «та же точка времени» и запись restored остаются"
  - "D-17b: ключ вхождения при переносе не меняется, отметка едет с уроком, вычет по новой дате относительно opening_balance_on"
  - "D-17c: mark = countsAsLesson(outcome) && (isMarked(outcome) || урок начался); markEffect отдаёт not_started только неотмеченному будущему уроку"
  - "D-17d: cutSeries, endSeriesAt и nextSeriesDate не меняются; блок Whole series по actions.series (не призрак и урок не начался) и nextSeriesDate(series, now) !== null"
  - "D-17e: awaitsMark, needsMark, nextLessons и todayCounts не меняются; зависимые места следуют за новым местом урока"
  - "Метка основной зоны в тостах серии — zoneLabel(SCHEDULE_TIME_ZONE, первый урок серии) из lib/time-zones.ts"
requirements-completed: [LEDG-03, LEDG-05, LEDG-06, LEDG-08, SCHED-02, SCHED-05]
---

# Фаза 21, план 17: перенос любого урока в любой момент (D-17)

Урок, который считается уроком (planned, done, no_show), переносится через api и в web на любые дату и время, в том числе начавшийся, прошедший и в прошлое; отметка остаётся на ключе вхождения и вычитает по новой дате. Отменённый урок и призрак не переносятся (409 `lesson_changed`). Правило одно — `lessonActions` в core; api и web своих проверок времени у переноса не держат. Вопрос отмены и тосты называют время только в основной зоне (v38).

Дизайн: v38 (`~/dv-lab-design/VERSION` во время чтения), README LessonDialog, MoveSeriesDialog, NewLessonDialog. К концу работы копия дизайна стала v39 («Chat model and effort controls»): к компонентам этого плана изменение не относится.

## Что сделано

**Задача 1 (fac6cc9), правило в core и api без отказов по времени.**
- `lessonActions`: `move: countsAsLesson(outcome)`, `mark: countsAsLesson(outcome) && (isMarked(outcome) || !upcoming)`.
- `apps/api/src/schedule/changes.ts`: `refusal` — устаревший `expectedStartsAt` или запрещённое `lessonActions` действие дают `CHANGED` (409), иначе `null`; `moveTarget` — только `zonedInstant(date, startTime, SCHEDULE_TIME_ZONE)`; виды `in_past` и `target_in_past` и их константы удалены, импорты `canChange`, `countsAsLesson`, `scheduleToday` убраны. `marks.ts` не правился.
- `apps/api/src/routes/schedule.ts`: из `refused` убраны оба случая отказа по времени.
- Проверки: матрица p2 в ledger-core.mjs, `partMoveAnywhere` в schedule-api.mjs, последний шаг pastFlow и раздел moves (часть 1) в ledger-api.mjs.

**Задача 2 (a06b3b7), зависимые правила и приёмка остатка, Today и ближайшего урока.**
- `markEffect`: после cancelled и moved неотмеченный урок даёт `not_started` до начала и `unmarked` после; отмеченный идёт в ветки no_opening, before_opening, no_show_off, deducts без условия на время.
- `LessonActions.series = outcome !== 'moved' && upcoming`; `ScheduleLessonActions.series: boolean`; `toWireActions` передаёт `series: actions.series` (тип `Mirror` ловит расхождение).
- schedule-core.mjs: s15 (nextLessons с переносом прошлого вхождения на завтра и ближайшего во вчера) и s16 (cutSeries и endSeriesAt превращают вхождение хвоста, перенесённое в прошлое, в урок на его прошлом месте с его originalOn); оба входят в s12.
- ledger-api.mjs, раздел moves, часть 2 на карточках `Alex Example 2116 … 2119` (D = сегодня по Вьетнаму минус 3 дня, открывающий остаток 0 на D).

**Задача 3 (a0128b7), web и контракт.**
- `lesson-dialog.tsx`: подвал Move lesson по `actions.move`, Cancel lesson по `actions.cancel` (вопрос с Keep и Yes, cancel), форма переноса по `actions.move`, Return to schedule по `actions.restore`, блок Whole series по `actions.series`, `series !== null` и `nextSeriesDate(series, now) !== null`. Вычисления по `changeable`, статусу и `canChange` убраны, подпись «This lesson has already taken place and cannot be changed.» удалена, вид `past` удалён из `Notice`, `ActionOutcome` и `FAILURE`. Вопрос отмены — `vnDayAt(start, null)`: «Cancel the lesson on 14 Oct at 18:00 VN?». Проп `today` убран.
- `lesson-move-form.tsx`: у `DateField` нет `min`; проверка «время позже сейчас» и её текст удалены; таблица `MOVE_FAILURE` удалена, отказ — общий «Could not move the lesson. Try again.»; пропсы `now` и `today` убраны.
- `schedule-screen.tsx`: `changeLesson` без ветки `lesson_in_past`; тосты Lesson cancelled и Lesson restored — `vnWhen(…, null, …)`.
- `new-lesson-dialog.tsx` и `move-series-dialog.tsx`: тосты «… every Monday at 09:00 VN.» и «… now meets on Thursdays at 17:00 VN from Thu 15 Oct.», метка — `zoneLabel(SCHEDULE_TIME_ZONE, первый урок серии)`.
- `packages/contracts/src/auth.ts` и `packages/contracts/test/auth.test.ts`: из `errorCodes` убраны `lesson_in_past` и `target_in_past`.
- schedule-web.mjs: обновлены ожидания read, changes, новая часть move-past (карточка `Alex Example 2141 A`, уборка в начале и в `finally`).

## Решения

- **D-17a, перенос.** `move = countsAsLesson(outcome)`: planned, done, no_show переносятся всегда; cancelled и moved — нет (409 `lesson_changed`). Цель — любые дата и время; 400 `invalid_request` при той же точке времени и исключение `restored` при естественном времени вхождения остаются.
- **D-17b, отметка и вычет.** Ключ вхождения при переносе не меняется, отметка едет с уроком; `lessonDeduction` берёт дату урока на новом месте и сравнивает с `opening_balance_on`. Призрак на старом месте — исход moved, вычета нет.
- **D-17c, отмеченный урок в будущем.** Отметка остаётся, урок Done или No-show на новой дате и вычитает (`studentBalance` без «сейчас»). Исправление в любое время: `mark = countsAsLesson(outcome) && (isMarked(outcome) || урок начался)`; неотмеченный будущий урок отметить нельзя (400 `lesson_not_started`). `markEffect` отдаёт `not_started` только неотмеченному будущему уроку.
- **D-17d, серия.** `cutSeries`, `endSeriesAt`, `nextSeriesDate` и `today_passed` не менялись. Блок Whole series — по `actions.series` (не призрак и урок не начался) и пока серия идёт (`nextSeriesDate(series, now) !== null`).
- **D-17e, зависимые места.** `awaitsMark`, `needsMark`, `nextLessons`, `todayCounts` не менялись: неотмеченный урок, уехавший в прошлое, ждёт отметки (Earlier, not marked), уехавший в будущее — нет; nextLessonAt — ближайший неотменённый урок на новом месте; `nextKey` — только planned.

## Изменённые ожидания проверок

ledger-core.mjs:
- `p2 lessonActions matrix at the start boundary`: plannedStarted, doneStarted, noShowStarted — `move` false → true; doneFuture — `move` false → true и `mark` false → true; у всех строк и у `none` добавлен столбец `series` (plannedFuture, doneFuture, cancelledFuture — true; начавшиеся и оба призрака — false).
- `p2 markEffect in the order of LessonMark captions`: `notStartedMarked` (done в будущем без открывающего остатка) `not_started` → `no_opening`; новые строки `futureDoneDeducts` → `deducts 60` и `futureNoShowOff` → `no_show_off`.

schedule-core.mjs:
- новые сценарии s15 и s16 (входят в s12).

schedule-api.mjs:
- `past lesson block cannot be moved but can be cancelled` (move false) → `past lesson block can be moved and cancelled` (move true, cancel true).
- partOccurrence: из списка отказов убраны `move of a past Wednesday` (400 lesson_in_past), `move into today 00:00`, `move to yesterday`, `move to the current time` (400 target_in_past); вместо них часть `partMoveAnywhere` на карточке `Alex Example 2006 P` (13 проверок, MOVE_ANYWHERE_OK).
- partSingle: `move of the past L2` (400 lesson_in_past) → `move of the past L2 one hour earlier` (200), `past L2 row moved one hour earlier`, `move of the past L2 back` (200); `pastAt` округлён до минуты, потому что перенос обратно задаётся датой и временем с точностью до минуты, иначе `past L2 row is unchanged` не сошёлся бы.
- partSingle: `move L1 into today 00:00` (400) удалён без замены: теперь он даёт 200 и сдвинул бы L1, на котором стоят следующие шаги; перенос на сегодня 00:00 проверяет `partMoveAnywhere`.

ledger-api.mjs:
- marks, `week shows the occurrence with outcome done, mark done and actions from core`: `{ move: false, cancel: true, restore: false, mark: true }` → `{ move: true, cancel: true, restore: false, mark: true, series: false }`.
- today, `occurrence moved from today to tomorrow is a ghost without actions`: в ожидание добавлено `series: false`.
- past, последний шаг: `move of the started …` 400 lesson_in_past → `move of the started marked … to today + 2 days` 200, плюс проверки одной строки отметки done, урока на новом месте (done, mark done, move и mark true) и призрака серии (moved, mark done, без действий).
- `noActions` проверяет и `series === false`.
- новый раздел moves (части 1 и 2, MOVES_PART1_OK, MOVES_PART2_OK, SCHEDULE_LEDGER_MOVES_OK).

schedule-web.mjs:
- read: `dialog: a past lesson says it cannot be changed` → `dialog: a past lesson has no line that it cannot be changed`; `dialog: a past lesson has no Move lesson or Cancel lesson` → `dialog: a past lesson has Move lesson and Cancel lesson`.
- read: `new lesson: series toast names the weekday and time` «… every Monday at 09:00.» → «… every Monday at 09:00 VN.».
- changes: вопрос отмены «… at 18:00 VN (14:00 MSK)?» → «… at 18:00 VN?» без MSK при включённой второй зоне; тосты cancel, restore и single cancel «…, 18:00 VN (14:00 MSK).» → «…, 18:00 VN.» без MSK.
- changes: `past: no Move lesson and no Cancel lesson` → `past: Move lesson and Cancel lesson in the footer`.
- changes: `move: days before today cannot be picked` (true) → `move: days before today can be picked` (false).
- changes: `move series: toast names the new day and the first date` «… at 17:00 from …» → «… at 17:00 VN from …».
- changes: новая часть move-past (CHANGES_MOVE_PAST_OK).
- `series: a past lesson has no Whole series box` осталась без изменений.

## Проверки

- `yarn typecheck` (core, contracts, db, api, web) — код 0; `yarn workspace @dv-lab/core typecheck`, `@dv-lab/api typecheck` — код 0.
- `yarn workspace @dv-lab/contracts test` — 2 файла, 48 тестов, все зелёные.
- `yarn workspace @dv-lab/web lint` — код 0; `yarn workspace @dv-lab/web build` — код 0.
- `node scripts/dev-checks/ledger-core.mjs` — LEDGER_CORE_OK, в том числе `PASS p2 lessonActions matrix at the start boundary` и `PASS p2 markEffect in the order of LessonMark captions`.
- `node scripts/dev-checks/schedule-core.mjs` — CORE_OK, `PASS s15 …`, `PASS s16 …`, `PASS s12 results do not depend on the process zone`.
- `ledger-api.mjs` на dvlab_test: moves — SCHEDULE_LEDGER_MOVES_OK (MOVES_PART1_OK, MOVES_PART2_OK), past — SCHEDULE_LEDGER_PAST_OK, marks — SCHEDULE_LEDGER_MARKS_OK, cut — SCHEDULE_LEDGER_CUT_OK, balance — SCHEDULE_LEDGER_BALANCE_OK, today — SCHEDULE_LEDGER_TODAY_OK.
- Шаги 2116: `PASS 2116 moved to today + 2 days: balance -60 in the list and the profile`, `PASS 2116 the marked lesson on today + 2 days stays done and can be moved and corrected`, `PASS 2116 lesson on today + 2 days: nextLessonAt … in the list and the profile`, `PASS 2116 mark none of the future marked lesson gives 200`, `PASS 2116 corrected to none: balance 0 in the list and the profile`, `PASS 2116 mark done of the future unmarked lesson gives 400 lesson_not_started`, `PASS 2116 keeps one mark row`.
- `schedule-api.mjs` на dvlab_test: read — SCHEDULE_API_READ_OK, changes — SCHEDULE_API_CHANGES_OK (OCCURRENCE_OK, SINGLE_OK, SERIES_OK, END_KEEPS_MOVED_OK, MOVE_ANYWHERE_OK, `row counts never decreased over 43 samples`), next — SCHEDULE_API_NEXT_OK.
- `schedule-web.mjs` на dvlab_dev: read — SCHEDULE_WEB_READ_OK; changes светлая — SCHEDULE_WEB_CHANGES_OK; changes тёмная — SCHEDULE_WEB_CHANGES_OK; forms — SCHEDULE_WEB_FORMS_OK. Скриншоты в STATE_DIR.
- `node scripts/dev-checks/wait-dev.mjs down` — DEV_DOWN_OK; `apps/web/AGENTS.md` от next dev удалён.
- Фикстуры убраны: `Alex Example 211%` в dvlab_test — n = 0; `Alex Example 2141%` в dvlab_dev — n = 0.
- Критерии приёмки: `move: countsAsLesson(outcome)` — 1; `canChange|scheduleToday|in_past` в changes.ts и routes/schedule.ts — нет; `series: actions.series` в rows.ts — 1; `canChange|changeable` в lesson-dialog.tsx и lesson-move-form.tsx — нет; `actions.series` в lesson-dialog.tsx — 1; `git grep lesson_in_past target_in_past` в apps, packages, scripts/dev-checks — нет; «later than now», «has already taken place», `min={today}` — нет.

- Шаг 2118 «прошлый урок → сегодня 23:45 по Вьетнаму» в первых двух прогонах moves печатал SKIP (23:45 уже прошло); после полуночи по Вьетнаму раздел moves прогнан ещё раз: `PASS 2118 the past lesson moved to tonight is in lessons, cannot be marked yet and is not in earlier`, SCHEDULE_LEDGER_MOVES_OK.

## Не запускалось

- `yarn workspace @dv-lab/api build` и `yarn test` — по правилу плана.

## Отклонения от плана

1. **[Rule 3] `zoneCaption` нет в `apps/web/lib/time-zones.ts`.** План называл `zoneCaption(SCHEDULE_TIME_ZONE, момент, 'toolbar')`; после 21-06 метку зоны даёт `zoneLabel(zone, at)` (для `Asia/Ho_Chi_Minh` — `VN`). Тосты серии используют её. Коммит a0128b7.
2. **[Rule 1] schedule-api.mjs, partSingle: удалён отказ `move L1 into today 00:00`.** План о нём не говорил; после D-17 он даёт 200 и сдвинул бы L1, на котором стоят следующие проверки части. Покрыт `partMoveAnywhere`. Коммит fac6cc9.
3. **[Rule 1] schedule-api.mjs, partSingle: `pastAt` округлён до минуты**, чтобы пара переносов L2 на час раньше и обратно возвращала строку ровно на прежний `starts_at`. Коммит fac6cc9.
4. **[Rule 1] schedule-web.mjs: `move: days before today cannot be picked` → `can be picked`.** План этот шаг не называл; это прямое следствие снятия `min` у DateField. Коммит a0128b7.
5. **Тост новой серии в schedule-web.mjs** проверяется на «every Monday at 09:00 VN.» (фикстура раздела read — понедельник 09:00), а не на «every Wednesday at 18:00 VN.» из текста плана.
6. Подвал диалога: Move lesson и Cancel lesson показываются каждая по своему действию; у отменённого прошедшего урока теперь есть Return to schedule (раньше web скрывал его проверкой времени, api разрешал с D-12d).

## Для Design dude

Не блокирует, новых текстов план не вводит:
1. У начавшегося и прошедшего урока подвал тот же, что у будущего (Move lesson и Cancel lesson); у отменённого прошедшего урока — Return to schedule, как у будущего.
2. В форме переноса можно выбрать прошлую дату и время.
3. Отмеченный урок, перенесённый в будущее, показывается Done или No-show, пилюли Mark доступны для исправления, строка вычета «Deducts …». Это состояние в v38 не нарисовано.

## Для следующих планов

- **21-08:** Move lesson есть и у начавшегося урока; блок Whole series по `actions.series`; отказа lesson-in-past больше нет; пилюли отмеченного будущего урока доступны (`actions.mark` true, markEffect не отдаёт not_started отмеченному).
- **21-10 и 21-11:** у прошедшего урока в диалоге есть Move lesson.
- **21-12:** AGENTS.md: перенос в любое время, исправление отметки в любое время, разрез серии только от сегодня, коды отказа по времени удалены.
- **21-16:** в `ScheduleLessonActions` появилось поле `series`.

## Known Stubs

Нет.

## Self-Check: PASSED

- Коммиты fac6cc9, a06b3b7, a0128b7 есть в `git log`; удалённых файлов в диапазоне 7e19ddb..a0128b7 нет.
- Все файлы из key-files существуют и изменены этим планом.
