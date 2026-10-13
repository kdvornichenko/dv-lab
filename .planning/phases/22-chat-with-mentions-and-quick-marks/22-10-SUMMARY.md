---
phase: 22-chat-with-mentions-and-quick-marks
plan: '10'
status: complete
verification: blocked
subsystem: api-web
tags: [chat, calendar, google-commands, confirm, undo, restore-mark, move-series]

requires:
  - phase: 22-01
    provides: 'lessonActions.move/cancel без done, insideSyncWindow, clearsMark, settleMarkAfterMove'
  - phase: 22-03
    provides: 'restoreMark в команде move, ревизия lesson_marks'
  - phase: 22-08
    provides: 'parseQuickCommand, resolveLessonTarget (lesson | series), Composer'
  - phase: 22-09
    provides: 'chat_messages, chat_actions с колонками календаря, executeLocalAction, undoAction, ChatResult'
  - phase: 22-18
    provides: 'seriesAnchor (allFrom), firstOnOrAfter для новой серии'
provides:
  - 'contracts/chat.ts: блок calendar_proposal (операция, Was/Now, clearsNoShow, state proposed|submitting|pending|unknown|applied|failed|stale, accepted, issue, undo, undoIssue), calendarActionResponse; undoResponse принимает и calendar_proposal; refused.kind += calendar'
  - 'api chat/calendar.ts: proposeCalendarChange, confirmCalendarChange, checkCalendarAction, undoCalendarAction поверх CalendarCommands'
  - 'api chat/messages.ts: insertAction (общая вставка chat_actions), calendarProgress, calendarView (состояние блока из chat_actions при чтении)'
  - 'api routes/chat.ts: POST /chat/actions/:id/confirm (202), POST /chat/actions/:id/check (200), POST /chat/actions/:id/undo ветвится по виду; chatRoutes({ db, calendarCommands })'
  - 'web: CalendarProposal (calendar-proposal.tsx), confirmCalendar/checkCalendar в use-chat.ts, опрос check раз в 2 с при pending'
  - 'scripts/dev-checks: chat-api.mjs calendar -> chat-calendar.mjs (CHAT_CALENDAR_OK), chat-web.mjs calendar (CHAT_WEB_CALENDAR_OK, не исполнялся), mark-revision.mjs случай 12'
affects: [22-12, 22-13, 22-16, 22-17]

actuals:
  tokens: 34517
  tasks: 3
  commits: 5
plan_head_before: 7af8dae6f59641a528c2d2a89b83b5db94108236
plan_head_after: ec89d6f33c4f3cff3454a868326be4220df43ff6

tech-stack:
  added: []
  patterns:
    - 'Блок предложения хранится в ответе ассистента в виде proposed; живое состояние (state, accepted, issue, undo, undoIssue) накладывается при чтении из chat_actions.result и undo_result, как Undo у 22-09'
    - 'commandId прямой и обратной команды лежит в jsonb (result.commandId, undo_result.commandId); колонок и миграций нет'
    - 'Подтверждение: блокировка строки действия, сборка команды из сохранённой цели и свежего readCalendarWindow, state submitted, отправка вне транзакции, запись commandId или отказа; потерянная отправка через 60 с возвращает proposed'
    - 'check только читает журнал (readCalendarCommand / findRequest) и переводит строку действия условным UPDATE'

key-files:
  created:
    - apps/api/src/chat/calendar.ts
    - apps/web/app/(app)/chat/_components/calendar-proposal.tsx
    - scripts/dev-checks/chat-calendar.mjs
  modified:
    - packages/contracts/src/chat.ts
    - apps/api/src/chat/actions.ts
    - apps/api/src/chat/messages.ts
    - apps/api/src/routes/chat.ts
    - apps/api/src/app.ts
    - apps/web/app/(app)/chat/_components/messages.tsx
    - apps/web/app/(app)/chat/_components/use-chat.ts
    - apps/web/app/(app)/chat/_components/chat-screen.tsx
    - apps/web/lib/api-client.ts
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-web.mjs
    - scripts/dev-checks/mark-revision.mjs
    - scripts/dev-checks/README.md

key-decisions:
  - 'Блок предложения не переписывается в chat_messages.blocks: состояние выводится из chat_actions при каждом чтении, поэтому перезагрузка показывает сохранённое состояние'
  - 'expectedVersion одиночного урока: binding.version события с тем же ключом в окне недели прежнего начала, событие должно стоять на прежнем начале, без editBlock и не отменено; серии: version контекста серии той же недели; иначе stale'
  - 'Цель серии переводится в пояс учителя по моменту move.startsAt (день недели и время), новая серия начинается с firstOnOrAfter(from, weekday), чат не передаёт newStartsOn'
  - 'Undo: версия события сейчас должна совпасть с after.version, записанной check при applied; отметка: before no_show R и строка none R+1 -> restoreMark R+1, строка no_show R -> без restoreMark, иначе stale; у остальных операций отметка должна совпасть с before'
  - 'Отказы Undo: command_pending, connection_required, provider_unavailable не записываются, Undo остаётся доступным с строкой причины; остальные (смена версии, отметки, external_change, precondition_failed) пишут undo stale (P11)'
  - 'Без calendarCommands быстрые формы move/cancel отвечают connection_required до резолвера; отмена с формулировкой серии отвечает out_of_phase (P12)'
  - 'POST /chat/actions/:id/check не рассылает dvlab:data-changed (опрос раз в 2 с); рассылку и store.refresh делает use-chat, когда блок стал applied или Undo стал done'

requirements-completed: [CHAT-03, CHAT-04, CHAT-09]

duration: ~2.5h
completed: 2026-10-13
---

# Phase 22 Plan 10: Перенос и отмена урока из чата через календарь Summary

«@ученик moved to <дата> <время>», «didn't happen» и «all lessons» теперь создают блок предложения; изменение уходит в журнал команд 25.1 только после Confirm, Saved появляется только при `applied` команды, а Undo одиночного переноса или отмены отправляет обратную команду с версией события после применения и, если перенос снял `no_show`, с `restoreMark`, который возвращает отметку в транзакции применения. Браузерная проверка не выполнялась (порты заняты стендом владельца).

## Задачи и коммиты

| # | Задача | Коммит |
|---|--------|--------|
| — | Воспроизведение остаточного дефекта 22-03, случай 12 в `mark-revision.mjs` | b24537f |
| 1 | Контракт блока, `chat/calendar.ts`, ветка в `actions.ts`, маршруты confirm/check, Undo по виду | 944d7cd |
| 2 | Блок `CalendarProposal` в /chat, `use-chat.ts`, проброс в `chat-screen.tsx`, исключение check из рассылки | ff8da53 |
| 3 | `chat-api.mjs calendar` (`chat-calendar.mjs`), `chat-web.mjs calendar`, README | 9db6e33 |
| — | Возврат Undo, если обратная команда не записалась (по ревью) | ec89d6f |

`commits: 5` измерено `git rev-list --count 7af8dae..ec89d6f`; коммит `docs(22-10)` с этим SUMMARY в счёт не входит. `actuals.tokens` — символы `git diff 7af8dae..ec89d6f` / 4 (138067 / 4).

## Остаточный дефект 22-03 (restored без отметки в хвосте серии)

Воспроизведён, но не там, где его ждали, поэтому однострочная правка `currentTail` в `cut-apply.ts` не применялась.

- Сценарий (`mark-revision.mjs`, случай 12): вторая недельная серия, будущее вхождение перенесено и возвращено обратно без отметки (исключение `restored`, строки `lesson_marks` нет), затем `move_series` с этой даты и `end_series` до неё.
- Факт: обе команды отказывают при приёме `external_change` (409), строк `google_commands` не добавляется, уроки не меняются. Отказ даёт `validateFamily` в `apps/api/src/calendar/series-observation.ts`: экземпляр, возвращённый на место, в Google остаётся изменённым членом семьи (`singleEvents=false` его отдаёт, заглушка тоже), а в хвосте ему не соответствует сохраняемый одиночный урок (`preservedLessons` пропускает `restored` без отметки). До `currentTail` при применении команда не доходит, предложенная правка на этом пути мёртвая.
- Случай 12 закрепляет текущее поведение (отказ при приёме, ничего не отправлено). Когда разрез научится обрабатывать такие вхождения, ожидание случая нужно перевернуть.
- Настоящая правка многоместная: `validateFamily` и `observeTail` в `series-observation.ts`, `preservedLessons` в `packages/core/src/schedule-series.ts`, `currentTail` в `cut-apply.ts`, `readOldInactive` в `transition-proof.ts` (вхождение надо отменить в старой семье и не превращать в одиночный урок). Это изменение протокола разреза 25.1, в рамках плана не делалось.
- Связь с чатом: Undo переноса одного вхождения серии из чата создаёт ровно это состояние. После такого Undo «all lessons», «every week from …» и окончание серии с этой даты или раньше неё отказывают `external_change`; чат показывает общий текст «Google Calendar did not accept the change. Nothing was changed.».

## Что построено

- `proposeCalendarChange(executor, context, source, target, studentName)`: без `calendarEnabled` или подключения — `connection_required`; урок вне окна синхронизации — `outside_sync_window`; для серии цель переводится в пояс учителя (день недели и время по `move.startsAt`), первое новое вхождение `firstOnOrAfter(from, weekday)` проверяется по окну; «Was» серии — `seriesStart(rule, from)`. Строка `chat_actions` kind `calendar`, state `proposed`, `target` (операция, ключ, `ref`, `seriesId`, прежнее начало и длительность, пояс, `move`, `series`), `before` (начало, длительность, отметка и ревизия цели 22-08), `calendar_request_id` генерируется сразу. Блок `calendar_proposal` с `clearsNoShow = move && mark no_show && canChange(новое начало)`.
- `confirmCalendarChange(db, commands, context, actionId)`: только `proposed`, иначе отдаёт текущий блок (повтор Confirm — тот же `commandId`). Пояс учителя сменился — `stale`; запись недели заблокирована — `failed` с причиной (`command_pending`, `outside_sync_window`, `connection_required`, иначе `provider_unavailable`); нет события, событие сдвинуто, отменено или с `editBlock` — `stale`; отметка ключа перечитывается в `before`. Команда: `move` (`date`/`startTime` из целевого момента в поясе учителя с проверкой `localTimeCandidates`, `expectedStartsAt` = прежнее начало), `cancel`, `move_series` (`from`, `weekday`, `startTime`, `durationMinutes`). Отправка `submitCalendarCommand` вне транзакции; отказ (`CommandFault`/`CalendarFault`) — `failed` с кодом, если `findRequest` не нашёл команду.
- `checkCalendarAction`: `readCalendarCommand` (или `findRequest` по `calendar_request_id`); `pending`/`dispatching` — `pending`, `projection_pending` — `pending` + `accepted`, `outcome_unknown`/`partial_recovery`/`recovery_required` — `unknown`, `failed` — `failed` с кодом, `applied` с `confirmedRevision` — `applied` и `after.version` из свежего окна недели нового места (перенос) или прежнего (отмена). Для Undo с `restoreMark` выполнено только при строке `no_show` с ревизией `before.markRevision + 2`, иначе `stale`. Нового запроса команды и записей отметок нет.
- `undoCalendarAction`: сначала check; только `applied` одиночный `move`/`cancel` (серия — 409 `not_undoable`); обратная команда `move` на прежние дату, время и длительность или `restore`, новый `undo_calendar_request_id`, `expectedVersion` из текущего окна при совпадении с `after.version`. `chat/calendar.ts` не пишет `google_commands`, `lessons` и `lesson_marks` (grep критерия пуст), `submitCalendarCommand` только в confirm и undo.
- web `CalendarProposal` по README ChatCalendarChange v67: иконка (calendar-check-2, calendar-x-2, repeat), вопрос 600, строки Was/Now с `TimePair` (вторая зона из `useSecondZone`), строка последствия (No-show, отмена, серия с датой `from`), Confirm (primary compact) и Keep (ghost compact); Confirming… со спиннером и «Waiting for Google Calendar to confirm this change…»; `accepted` — «Google Calendar accepted the change. Updating the schedule…»; `unknown` — P16 с Check status (кнопка выключена, пока идёт запрос); `applied` — Saved, «Calendar change saved. …», Undo у одиночных, Undoing…, «Calendar change undone.» и «… lesson is back at …»; Undo `stale` — «This event changed in Google Calendar after your action. Undo is unavailable.»; `failed`/`stale` — Banner `role="alert"`. Блок не ходит в `/api/schedule` и `/api/google`: только маршруты чата и `store.refresh()`.

## Дизайн

Версия `~/dv-lab-design` на исполнении: v67 (план писался под v64). Precondition задачи 2 (DR-22-02 отвечен) выполнен: PLAN-INDEX строка 97, README и превью ChatCalendarChange.

## Проверки

Выполнено:

- `yarn workspace @dv-lab/contracts typecheck`, `@dv-lab/api typecheck`, `@dv-lab/web typecheck`, `yarn workspace @dv-lab/web lint`: код выхода 0 (web typecheck красный только между коммитами 944d7cd и ff8da53). `yarn knip`: только подсказки конфигурации. `node scripts/hygiene-check.mjs`: clean. `yarn prettier` по файлам плана.
- `node scripts/dev-checks/chat-api.mjs calendar` (`dvlab_test`, preload `calendar-offline.mjs`, шлюз-заглушка в процессе, `calendar-seed up/down test week`, api на 4225): `CHAT_CALENDAR_OK`, 23 PASS, 0 FAIL, дважды (второй раз после ec89d6f). Покрыто всё из задачи 3 плана: предложение без команды; Confirm — `move` с `requestId` = `calendar_request_id` и версией события, блок `pending` без Saved; заглушка отвечает — `applied` с Undo; повтор Confirm — тот же `commandId`, команд не прибавилось; «didn't happen» — `cancel`, `applied`, Undo — `restore`, урок снова `scheduled`; done — `lesson_done`, предложения нет; `no_show` R с переносом позже текущего момента — `none` R+1, Undo — `move` в прошлое с `restoreMark { no_show, R+1 }`, после `dispatchCommand` без вызова check строка `no_show` R+2, затем check показывает Undo выполненным; ревизия поднята `UPDATE` под мигратором — Undo `stale` без команды; перенос раньше текущего момента оставляет `no_show`, Undo без `restoreMark`, отметка цела; etag события изменён «в Google» — Undo `stale` без команды; незавершённая команда аккаунта — `failed command_pending`, ничего не отправлено; без Google — `connection_required`; цель через 400 дней — `outside_sync_window`; «moved to <день недели> 18:00 all lessons» — `move_series` с `from = allFrom` (сегодняшнее начавшееся неотмеченное вхождение), `applied`, Undo нет, Undo — 409; «all lessons from <раньше отмеченного>» — `series_marked`; маршруты: check 200 и повторный confirm 202 со схемой `calendarActionResponse`, неизвестный id 404, лишнее поле 400, confirm действия отметки 409, в логе api нет имён. Фикстуры удалены (разговоры, сообщения, действия до карточек; 0 карточек `chat-calendar:`), сид снят.
- `chat-api.mjs actions` (`CHAT_ACTIONS_OK`), `records` (`CHAT_RECORDS_OK`, обход ролей включает confirm и check), `target` (`CHAT_TARGET_OK`).
- `node scripts/dev-checks/mark-revision.mjs`: `MARK_REVISION_OK` (случаи 1-12).
- `node scripts/dev-checks/calendar-final.mjs`: 15/15, `CALENDAR_FINAL_OK`.
- `node --check scripts/dev-checks/chat-web.mjs`, без аргументов печатает usage с разделом `calendar`.

Не выполнено, по распоряжению ведущей сессии (порты 3000 и 4000 заняты стендом владельца из этого же worktree, его не останавливали):

- `node scripts/dev-checks/chat-web.mjs calendar light` и `dark`. Раздел написан, ни разу не исполнялся. Вероятные места падения: подмена ответа `POST …/messages` должна пройти строгую схему `sendMessageResponse` (разговор берётся из ответа `POST /chat/conversations`), ожидание текста по `getByText` внутри блока, проверка «unknown сам ничего не шлёт» ждёт 2,5 с.
- `node scripts/dev-checks/wait-dev.mjs down`.
- Ручная проверка блока в /chat в обеих темах: вид Was/Now, строки последствий, Saved, Undo, Banner отказа не сверены с превью. Для UI это значит «не проверено». Нужна запись `unrun-verify` в `.planning/WINDOWS.md` ведущей сессией.
- Живая запись в Google — сессия владельца на тестовом аккаунте (25.1 D-11).
- `yarn build`, `yarn test`, `yarn install` не запускались по распоряжению.

## Deviations from Plan

**1. [Rule 3] Файлы вне `files_modified`.** `apps/api/src/chat/messages.ts` (общая `insertAction`, наложение состояния календарного блока при чтении, `result` в выборке действий), `apps/web/app/(app)/chat/_components/chat-screen.tsx` (проброс обработчиков Confirm и Check), `apps/web/lib/api-client.ts` (`POST /chat/actions/:id/check` не рассылает `dvlab:data-changed`: опрос раз в 2 с иначе перечитывал бы все экраны во всех вкладках; рассылку делает `use-chat.ts`, когда блок стал `applied` или Undo стал `done`), `scripts/dev-checks/README.md`, `scripts/dev-checks/mark-revision.mjs` (случай 12).

**2. [Rule 1] Ожидание `chat-api.mjs actions`.** «moved to» и «didn't happen» больше не `out_of_phase`: на api без Google они отвечают `connection_required`.

**3. Контракт шире плана.** В блоке `accepted` (команда в `projection_pending`, текст «Google Calendar accepted the change…»), `undoIssue`, `clearsNoShow`; `undo` равен `null`, пока Undo неприменим (не `applied` или серия); состояние `failed` использует закрытый перечень `CHAT_CALENDAR_ISSUES` (`command_pending`, `connection_required`, `precondition_failed`, `outside_sync_window`, `lesson_done`, `provider_unavailable`, `external_change`; `reconnect_required`/`permission_required` сворачиваются в `connection_required`, прочие коды — в `precondition_failed`). `calendarActionResponse`, `undoResponse` принимает оба вида блока, `chatRefusedBlock.kind` += `calendar`. `ChatContext.calendarEnabled` вместо параметра `calendarCommands` в `executeLocalAction`.

**4. Опрос и Check status.** План: статус и Check status при `pending` и `unknown`, опрос раз в 2 с. Сделано: `pending` (и Undo `pending`) опрашивается раз в 2 с, пока вкладка видна, кнопки нет; `unknown` — только кнопка Check status (P16 и превью: «No automatic second request»).

**5. `failed` без черновика новой попытки.** README ChatCalendarChange: «No retry button: the teacher asks again.» Показаны отказ и причина.

**6. Отказы Undo.** Временные причины (`command_pending`, `connection_required`, `provider_unavailable`) не записываются: Undo остаётся доступным, под Saved строка причины. Остальные пишут `stale` (P11).

**7. Самодельные строки и решения вида (EXECUTOR-RULES 8, вопрос Design dude).**
- «Calendar change saved. {имя}'s lesson on {день}, {время} is cancelled.» — Saved отмены (в превью только перенос и серия).
- «Connect Google Calendar to use the calendar.» и «Google Calendar is unavailable. Calendar changes are disabled.» — вторые строки отказа `connection_required` и `provider_unavailable`; `command_pending`, `outside_sync_window`, `lesson_done` — тексты ChatNotices из `messages.tsx`.
- Устаревшее предложение (`stale`) — пара строк `lesson_changed` («This lesson changed after you asked. Nothing was changed.» / «Ask again to use its current time.»), Banner `warning`.
- `aria-label` Undo — «Undo: Calendar change saved».
- `failed` нарисован готовым Banner `error` с `role="alert"` вместо тонированного блока превью (как отказы 22-09).

## Known Stubs

- Keep только в браузере: блок сворачивается в «Kept as it was. Nothing changed.», но после перезагрузки предложение снова с Confirm (README хочет сохранённое состояние, маршрута Keep в плане нет).
- После Undo переноса вхождения серии из чата разрез серии с этой даты и окончание серии до неё отказывают `external_change` (раздел про остаточный дефект). Кандидат в запись `deviation` в `.planning/WINDOWS.md` ведущей сессией.
- `clarifyReply` для `move` даёт «<дата> <время>», которое `parseQuickCommand` не разбирает (из 22-09, не менялось).

## Threat Flags

Нет новых поверхностей вне модели угроз плана: confirm/check принимают только id действия и пустое тело (T-22-22), Saved только при `applied` с `confirmedRevision` (T-22-23), Undo с версией после применения и `restoreMark` по точной ревизии (T-22-24).

## Для следующих планов

- 22-13 (`propose_lesson_change` модели): `proposeCalendarChange(tx, context, { conversationId, messageId }, target, studentName)` принимает результат `resolveLessonTarget` вида `lesson` или `series`; блок `calendar_proposal` нужно сохранить в `blocks` ответа ассистента с `reply_to` = сообщение учителя, иначе confirm/check/undo отвечают 404. `context.calendarEnabled` передавать как в `routes/chat.ts`.
- 22-16 (удаление разговора): строки `chat_actions` kind `calendar` с `submitted` (`result.state` `submitting`/`pending`/`unknown`) или Undo `pending` — незавершённая мутация (P05).
- Проверки: `chat-calendar.mjs` меняет синтетическое подключение в `dvlab_test` (`calendar-seed up/down test week`), не запускать параллельно с `chat-target.mjs`, `mark-revision.mjs`, `schedule-started*.mjs`.
- `mark-revision.mjs` случай 12 закрепляет отказ `external_change` при разрезе через `restored` без отметки; при исправлении протокола разреза его нужно перевернуть.

## Self-Check: PASSED

Файлы на месте: `apps/api/src/chat/calendar.ts`, `apps/web/app/(app)/chat/_components/calendar-proposal.tsx`, `scripts/dev-checks/chat-calendar.mjs`. Коммиты b24537f, 944d7cd, ff8da53, 9db6e33, ec89d6f есть в ветке (`git rev-list --count 7af8dae..ec89d6f` = 5). Рабочее дерево чисто по файлам плана (остался только `apps/web/next.config.ts` владельца), `apps/web/AGENTS.md` нет, порты 4203 и 4225 свободны, процессов не оставлено.
