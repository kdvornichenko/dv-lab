# Расписание: правила core, модуль schedule, отметки, комментарии, перенос, серии, Today

## Правила `packages/core`

- `packages/core`: чистые функции денег и уроков, правило остатка (`balance.ts`), исход и действия урока (`schedule.ts`), зоны (`zoned.ts`) и порог Pays soon (`lessons.ts`). `SCHEDULE_TIME_ZONE` = `Asia/Ho_Chi_Minh`. Без Node API и без базы.
- Правило видимости вхождения (дата серии в диапазоне `[starts_on, ends_on]`, исключение учитывается только через `occurrenceAt`, история за концом серии и пустая серия скрыты), разрез и окончание серии (`cutSeries`, `endSeriesAt`) и даты окна (`windowDates`) принадлежат `packages/core` (`schedule.ts`, `zoned.ts`). api и web второго правила не держат, браузер серии не раскрывает.
- Правило остатка — `packages/core/src/balance.ts`: `studentBalance`, `countsAfterOpening`, `lessonDeduction` и `markEffect`. Даты оплат и уроков строго позже даты открытия; дата урока — по Вьетнаму. Done вычитает длительность, No-show — при `noShowDeducts`, включая прошлые неявки; долг не обрезается, `null` («не задан») отличается от нуля. `needsMark` и `todayCounts` владеют отбором ожидающих отметки уроков и счётчиками Today.
- Исход урока и доступность действий — `packages/core/src/schedule.ts`: `lessonOutcome`, `occurrenceOutcome`, `countsAsLesson`, `isMarked`, `lessonActions`, `awaitsMark`, `withOutcomes`. Поставить, исправить и снять отметку можно по полю `mark` результата `lessonActions`; неотмеченный будущий урок отметить нельзя, уже отмеченный можно исправить в любое время.
- «Сегодня» и дата урока по Вьетнаму — `scheduleToday`, `scheduleDate`, `isAfterScheduleToday` из `packages/core/src/schedule.ts`. Порог и слова остатка — `packages/core/src/lessons.ts`: `PAYS_SOON_LESSONS_DEFAULT`, `balanceState`, `paysSoon`, `paysSoonList`, `balancePhrase`. В Pays soon входят активные карточки с остатком не больше порога, включая долг; «не задан» не входит.
- Граница дня учителя — `packages/core/src/schedule-day.ts`: константа `DAY_START_MINUTES` (02:00), `lessonDay`, `startOfLessonDay`, `scheduleWeekRange`. По ней группируют уроки по дням повестка, Today и подсчёт уроков; даты в диалогах и проверках остаются календарными (`scheduleDate`, `scheduleToday`). Окно `/schedule/week` и окно Today идут с 00:00 понедельника до 02:00 следующего понедельника. Колонка сетки недели — календарный день от 00:00 до 02:00 следующего дня, 26 часов (`GRID_MINUTES`, `gridMinutes`, `gridSlot`, `gridPlaces` в `apps/web/app/(app)/schedule/_components/calendar-layout.ts`): событие с 00:00 до 02:00 рисуется внизу колонки вечера и вверху колонки своей даты.

## Таблицы

- `lesson_series`, `lesson_exceptions` (ключ `series_id` + `original_on`, `kind` — `cancelled`, `moved` или `restored`) и `lessons`; внешние ключи `ON DELETE RESTRICT`. Вхождение считается через `occurrenceAt`, а не по наличию строки исключения; время переноса у `cancelled` и `restored` — только история. Пустая серия — `ends_on = starts_on - 1`. Колонки правила серии после вставки не меняются.
- `lesson_marks`: ключ `series_id + original_on` либо `lesson_id`, `kind` = `done | no_show | none`, FK `ON DELETE RESTRICT`. Снятие отметки меняет `kind` на `none`.
- Ключ вхождения стабилен у вхождений с отметкой и у серии после её последнего разреза: разрез даёт новую серию с новыми ключами вхождений хвоста. Разрез может начинаться с начавшегося неотмеченного вхождения после последней отметки, и такие вхождения получают ключи новой серии. Разрез и окончание серии сохраняют перенесённые и отмеченные вхождения хвоста как одиночные уроки, включая отмеченные `restored` и `cancelled`. `apps/api/src/schedule/series.ts` копирует отметки на новые строки `lessons`; отменённые уроки сохраняют статус `cancelled`. `insertDomain` в `cut-apply.ts` переносит комментарии вхождения на новый одиночный урок вместе с отметкой (`lesson_id` нового урока, `series_id` и `original_on` пустые, ревизия растёт); комментарий в хвосте без записи в `lineage` останавливает разрез с `external_change`.

## Чтение недели

- Модуль `apps/api/src/schedule` владеет чтением недели и мутациями расписания. `schedule.ts: readWindow` — единственная сборка блоков для недели и Today; блок контракта несёт `outcome`, `actions`, `ledger` и `mark`, без `status` и `changeable`.
- `rows.ts` загружает строки окна и «от сейчас», держит мапперы и блокировки `lockSeries`, `lockLesson`. Это место встречи contracts и core: `toMarkKind` по `MARK_KINDS`, адаптеры core → контракт через тип `Mirror`, `toBalanceCard`. `apps/api/src/schedule/rows.ts: loadMarkRows` раскрывает отметки через `occurrenceAt` с текущими датой, длительностью и исходом.
- Окно уроков (вхождения, история, покрытие) читает только `apps/api/src/schedule/window-blocks.ts` (`readWindowBlocks`); его зовут чат, вкладка Lessons и планировщик push.

## Отметки

Отметки принадлежат `apps/api/src/schedule/marks.ts`: `POST /schedule/series/:id/occurrences/:originalOn/mark` и `POST /schedule/lessons/:id/mark`. `kind: none` снимает отметку; строки `lesson_marks` не удаляются. Неотмеченный будущий урок даёт `400 lesson_not_started`. Писатели отметок — `markOccurrence`, `markLesson`, `settleMarkAfterMove`, `restoreMarkAfterMove` (`marks.ts`; возврат `no_show` обратным переносом по `restoreMark` журнала команды) и `insertDomain` (`cut-apply.ts`). Пока команда календаря ключа не `applied` и не `failed`, запись отметки этого ключа отвечает `409 lesson_changed` и для строки с отметкой (`historyEligibility` в режиме `write`).

## Комментарии урока

Комментарии урока принадлежат `apps/api/src/schedule/comments.ts` (`appendLessonComment`, `listLessonComments`, `retractLessonComment`): только к начавшемуся уроку (`400 lesson_not_started` у порта чата, отменённый начавшийся урок принимает), ключ урока тот же, что у отметки (`series_id` и `original_on` либо `lesson_id`), отзыв по ревизии (`409 precondition_failed`), строки не удаляются. Маршруты: `GET /schedule/lessons/:id/comments`, `GET /schedule/series/:id/occurrences/:originalOn/comments`, `POST /schedule/comments/:commentId/retract`; создаёт комментарий только чат.

## Перенос, отмена, возврат

Перенос, отмена и возврат в `schedule/changes.ts` следуют `lessonActions` из core; маршруты — `apps/api/src/routes/schedule.ts`.

- Начавшийся и прошедший урок без `done` переносится на любые дату и время и отменяется; урок с `done` не переносится и не отменяется (`409 lesson_done`).
- Отметка едет с уроком на том же ключе: перенос на начало позже текущего момента переводит `no_show` в `none`, перенос на начало не позже текущего момента оставляет `no_show` (`settleMarkAfterMove` в `marks.ts`, решение `clearMark` хранится в журнале команды).
- Вне окна синхронизации перенос, отмена и возврат дают `409 outside_sync_window` (`insideSyncWindow` в `calendar/projection.ts`).
- Урок можно создать в прошлом: он ждёт отметки как прошедший. Вычет считается по новой дате, призрак на старом месте не вычитает.
- Мутации идут в транзакциях с `FOR UPDATE`: запрещённое действие, призрак или устаревший `expectedStartsAt` дают `409 lesson_changed`. Отменённый урок можно вернуть, но нельзя перенести или отменить повторно.

## Разрез и окончание серии

- Разрез и окончание серии в `schedule/series.ts` используют `cutSeries` и `endSeriesAt` из core. Разрез принимает `from` не раньше `allFrom` и окна синхронизации: иначе `409 precondition_failed` (разрез забрал бы вхождение с отметкой или комментарием) или `409 outside_sync_window`.
- `allFrom` — первая дата серии не раньше её начала и первого дня окна синхронизации и позже последнего вхождения с `done`, `no_show` или неотозванным комментарием; правило — `seriesAllFrom` в core, удерживаемые даты читает только `heldSeriesDates` в `rows.ts`, якорь собирает только `seriesAnchor` в `series.ts`, неделя календаря отдаёт его в контексте серии (`allFrom`).
- Новая серия начинается с `firstOnOrAfter(newStartsOn ?? from, weekday)`, даже если это время уже прошло: такой урок ждёт отметки. Дата окончания серии (`endSeriesAt`) — не раньше сегодня. `400 series_ends_before_new_day` означает, что серия заканчивается до первого урока на новом дне. Повторный разрез пустой серии возвращает `409 lesson_changed` по `hasOccurrences` из core.
- Пояс ввода переноса серии — необязательное поле `inputTimeZone` команды `move_series` (`moveSeriesRequest` в `packages/contracts/src/schedule.ts`): `prepareSeriesChange` в `schedule/series.ts` режет серию и строит новое правило в этом поясе, пояс учителя сверяется по `expectedDefaultTimeZone`.

## Today и настройки учителя

- `apps/api/src/today/today.ts: readToday` собирает schedule, cards и settings для `GET /today`: уроки дня, Earlier, not marked и Pays soon. Чтение одного дня уроков для Today и чата — `readLessonDay` там же.
- `apps/api/src/settings/settings.ts` владеет `teacher_settings` (`readPaysSoonLessons`, `savePaysSoonLessons`, `readAssistantSettings`, `saveAssistantSettings`); `GET /settings` и `PATCH /settings` берут id аккаунта только из сессии учителя.
- `teacher_settings`: ключ `account_id`, `pays_soon_lessons` — целое 0..20 без DEFAULT в базе. Без строки действует `PAYS_SOON_LESSONS_DEFAULT` из core.

## Приёмка

`scripts/dev-checks/`, описание — `README.md`.

- Расписание: `schedule-db.mjs` (`catalog`), `schedule-core.mjs`, `schedule-api.mjs` (разделы `read`, `next`, `changes`), `schedule-web.mjs` (разделы `fade`, `frame`, `read`, `changes`, `students`, `grid`, `forms`, `zones`, `settings`, `drag`, тема светлая или тёмная) и `wait-dev.mjs` (`up` — ждать dev-стек на портах 3000 и 4000, `down` — порты свободны).
- Учёт уроков: `ledger-db.mjs` (`catalog`; `migrate` вызывает `schedule-db.mjs migrate`, число папок миграций задаёт `schedule-db.mjs`), `ledger-core.mjs`, `ledger-api.mjs` (разделы `marks`, `past`, `moves`, `cut`, `race`, `balance`, `flag`, `today`), `ledger-settings.mjs` и `ledger-web.mjs` (разделы `marks`, `students`, `settings`, `today`, `today-marks`, `today-payment`; сценарии в `scripts/dev-checks/ledger-web/`).
