---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '09'
subsystem: chat
status: complete
tags: [chat, bulk-move, time-zone, google-commands, calendar]

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 'inputTimeZone у move_series (23-03); диспетчер операций и stage в changes.ts (23-05); журнал команд календаря и Keep (23-07)'
provides:
  - 'операция bulk_move блока change_proposal, состояния pending и partial, issues calendar_changed, connection_required, command_pending, outside_sync_window, provider_unavailable, CHAT_BULK_TARGET_STATES'
  - 'apps/api/src/chat/command-zone.ts: resolveCommandZone (пояс ввода из текста учителя, Вьетнам без названия)'
  - 'apps/api/src/chat/bulk-move.ts: proposeBulkMove, confirmBulk, checkBulk, isBulkMove'
  - 'инструмент propose_bulk_move и шаг в CHAT_STEP_TOOLS'
  - 'checkChange в changes.ts; маршрут POST /chat/actions/:id/check и удаление разговора выбирают владельца по kind'
  - 'разделы proposal и children в scripts/dev-checks/chat-bulk.mjs'
affects: [23-13, 23-14]

tech-stack:
  added: []
  patterns:
    - 'Длинная операция предложения: подтверждение и проверка вне общей транзакции confirmChange; дочерние команды по одной, requestId каждой хранится в target до отправки, состояние детей в result действия'

key-files:
  created:
    - apps/api/src/chat/command-zone.ts
    - apps/api/src/chat/bulk-move.ts
  modified:
    - packages/contracts/src/chat.ts
    - apps/api/src/chat/tools.ts
    - apps/api/src/chat/changes.ts
    - apps/api/src/chat/calendar.ts
    - apps/api/src/chat/messages.ts
    - apps/api/src/routes/chat.ts
    - apps/api/src/chat/runs.ts
    - scripts/dev-checks/chat-bulk.mjs
    - scripts/dev-checks/chat-runs.mjs

key-decisions:
  - 'Предложение bulk_move идёт через общий stage в changes.ts (образец 23-05): proposeBulkMove получает текст учителя строкой и отдаёт { ok, target, change } или отказ; отказы — ошибка инструмента без строки chat_actions'
  - 'from цели = max(from из запроса, allFrom серии); совпадение дня и времени проверяется на вхождении, которое реально отрежет core seriesCutBoundary(rule, from, пояс ввода, from)'
  - 'Версии серий запечатываются при Confirm до первой записи (result.children[].version) вместе с проверкой снимка правила и seriesAnchor; каждая следующая дочерняя команда сверяет правило, отметки и версию с запечатанной, иначе failed calendar_changed'
  - 'Confirm и check bulk_move работают вне транзакции confirmChange: confirmChange получил необязательный commands и до транзакции отправляет действие bulk_move в confirmBulk'
  - 'Следующая дочерняя команда уходит только после applied с confirmedRevision (forwardState); потерянный ответ отправки ищется findRequest по requestId; без команды в журнале дольше 60 с — failed provider_unavailable'
  - 'Итог: все applied — action applied (receipt studentId); сбой с подтверждённым префиксом — refused, result.kind partial; без подтверждённых — failed; повторных отправок нет'

requirements-completed: [CHAT-06]

coverage:
  - id: D1
    description: 'Предложение: MSK — одна цель, inputTimeZone Europe/Moscow, nowStartsAt среда 14:00 MSK; без пояса при настройке учителя MSK — Asia/Ho_Chi_Minh, zoneNamed false; no_matching_lessons, zone_unknown, zone_not_in_message без действий; singlesLeft 1; from = allFrom после отметок, явный from на отмеченной дате — series_marked; команд в журнале до confirm 0'
    requirement: CHAT-06
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-bulk.mjs proposal'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Дочерние команды: confirm шлёт только первую, повтор confirm и decline ничего не шлют, удаление разговора — pending (busy); после applied первой check шлёт вторую; итог applied, новые серии MSK среда 14:00, старые закончены до разреза, строк 4, настройка учителя прежняя; изменённая вторая серия — partial calendar_changed без второй команды; потерянный ответ — findRequest, без двойной отправки; маршрут check отвечает 200 по change-действию и 404 по неизвестному'
    requirement: CHAT-06
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-bulk.mjs children'
        status: pass
    human_judgment: false
  - id: D3
    description: 'Предложения календаря фазы 22 и 23-07, пояс команды 23-03 и прежние операции чата не сломаны'
    requirement: CHAT-06
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-api.mjs calendar; node scripts/dev-checks/chat-bulk.mjs zone; node scripts/dev-checks/chat-runs.mjs; node scripts/dev-checks/chat-changes.mjs payment; node scripts/dev-checks/chat-changes.mjs deletions'
        status: pass
    human_judgment: false

actuals:
  tokens: 18500
  tasks: 3
  commits: 3
plan_head_before: ab274d0624860b141eba2127f5148306ded68a9a
plan_head_after: 140255564061de8a3401f2a19f1db7ba9e742713

duration: 50min
completed: 2026-10-14
---

# Фаза 23, план 09: массовый перенос уроков ученика из чата (CHAT-06) — итоги

**«@ученик перенеси все уроки со вторника 12:00 на среду 14:00 MSK» даёт запечатанное предложение bulk_move: сервер берёт пояс ввода из текста учителя (без названия — Вьетнам), находит все серии ученика в это время через core seriesCutBoundary и после Confirm отправляет дочерние move_series с inputTimeZone по одной через журнал команд Google, честно показывая partial при сбое.**

## Производительность

- Около 50 минут, задачи 3 из 3.
- `commits: 3` — `git rev-list --count --grep="(23-09)" ab274d0..HEAD`. Без фильтра диапазон даёт 6: в него попали три коммита параллельного плана 23-10 (`8b0ba07`, `7040945`, `1402555`). `plan_head_after` — HEAD ветки на момент записи SUMMARY (коммит 23-10), последний коммит этого плана до SUMMARY — `eb764a3`.
- `tokens` — символы диффа файлов плана / 4 (74066 / 4).

## Что сделано

- Контракты (`packages/contracts/src/chat.ts`): `CHAT_CHANGE_OPERATIONS` + `bulk_move`; `CHAT_CHANGE_STATES` + `pending`, `partial`; `CHAT_CHANGE_ISSUES` + `calendar_changed`, `connection_required`, `command_pending`, `outside_sync_window`, `provider_unavailable`; `CHAT_BULK_TARGET_STATES` (`planned`, `pending`, `applied`, `failed`, `not_started`); вариант `chatBulkMoveChange` (`studentId`, `studentName`, `inputTimeZone`, `zoneNamed`, `accountTimeZone`, `fromWeekday`/`toWeekday` числом 1–7, `fromTime`, `toTime`, `targets[]` с `seriesId`, `seriesTimeZone`, `from`, `wasStartsAt`, `nowStartsAt`, `durationMinutes`, `state`, `singlesLeft`); шаг `propose_bulk_move`.
- `apps/api/src/chat/command-zone.ts`: `resolveCommandZone(zoneText, teacherText)`. `null` — `SCHEDULE_TIME_ZONE`, `named: false`, настройка учителя не читается. Названный пояс должен стоять в тексте учителя (NFC, без регистра), иначе `zone_not_in_message`; короткие имена MSK, МСК, Moscow, Москва и формы → Europe/Moscow, VN, Vietnam, Вьетнам и формы → Asia/Ho_Chi_Minh; иначе точное IANA через `isTimeZone`/`timeZoneIdentity`; остальное — `zone_unknown`.
- `apps/api/src/chat/bulk-move.ts`:
  - `proposeBulkMove`: карточка активна, подключение и окно синхронизации (`connection_required`, `outside_sync_window`), живые серии ученика (`ends_on` не раньше сегодня в поясе серии), `allFrom` через `seriesAnchor`, вхождение разреза через core `seriesCutBoundary` в поясе ввода, совпадение дня и времени через `zonedParts`, новое первое мгновение `localTimeCandidates(firstOnOrAfter(from, toWeekday), toTime, пояс)[0]` (`nonexistent_local_time`), `singlesLeft` по будущим одиночным урокам, `no_matching_lessons`, `series_marked`. `target` (строгий zod): параметры переноса и `children[]` со снимком правила и `requestId`.
  - `confirmBulk`: транзакция — FOR UPDATE, не `proposed` — текущий блок; без `commands` — `failed connection_required`; сборка всех детей (снимок правила, `seriesAnchor`, окно недели, версия серии), любая изменённая — `stale calendar_changed`, окно не готово — `failed` с issue; действие `submitted`, `result { kind: 'bulk', children: [pending, not_started…] }` с запечатанными версиями. Вне транзакции — `submitCalendarCommand`, затем запись `commandId` или `findRequest` по `requestId`.
  - `checkBulk`: ожидающая дочерняя команда читается `readCalendarCommand`; applied — ребёнок `applied`, следующий строится заново со сверкой правила, отметок и запечатанной версии и отправляется; failed или изменённая серия — этот `failed`, остальные `not_started`, действие `refused` с `partial` или `failed`; все applied — действие `applied`.
- `apps/api/src/chat/calendar.ts`: экспорт `weekWindow`, `faultIssue`, `writeIssue`, `forwardState` без изменения поведения.
- `apps/api/src/chat/messages.ts`: `bulkProgress` и ветка `changeView` для `bulk_move` (`bulk` → `pending`, состояния целей из `result.children`, issue у `stale`/`failed`/`partial`, receipt `{ studentId }` только у `applied`).
- `apps/api/src/chat/changes.ts`: ветка `bulk_move` в `prepare`; `confirmChange(db, context, actionId, commands?)` отправляет `bulk_move` в `confirmBulk` до общей транзакции; новый `checkChange`. Decline работает общим путём: до confirm — `declined`, после — текущий блок.
- `apps/api/src/routes/chat.ts`: confirm передаёт `calendarCommands`; `POST /actions/:id/check` — сначала `checkChange`, для не-change — `checkCalendarAction`; удаление разговора проверяет незавершённые действия тем же диспетчером.
- `apps/api/src/chat/tools.ts`: strict-инструмент `propose_bulk_move` (дни `monday…sunday`, время, `time_zone`, `from`), квитанция с числом целей и запретом говорить «moved» и повторять дни, время и счёт.
- `apps/api/src/chat/runs.ts`: строка SYSTEM про `propose_bulk_move` из плана.

## Коммиты задач

1. Задача 1 (пояс ввода, поиск серий, запечатанное предложение) — `26aa2d4` (feat)
2. Задача 2 (подтверждение, дочерние команды по одной, проверка статуса) — `4338edf` (feat)
3. Задача 3 (подсказка модели, раздел `children`) — `eb764a3` (feat)

## Проверки

- `yarn workspace @dv-lab/contracts typecheck` и `yarn workspace @dv-lab/api typecheck` — 0 после каждой задачи.
- `node scripts/dev-checks/chat-bulk.mjs proposal` — `CHAT_BULK_PROPOSAL_OK` (7 случаев, карточки `Alex Example 2380`–`2382`, журнал 4→4).
- `node scripts/dev-checks/chat-bulk.mjs children` — `CHAT_BULK_CHILDREN_OK` (10 случаев, карточки `Alex Example 2385`–`2387`, свой api на порту 4246 для маршрута check).
- `node scripts/dev-checks/chat-bulk.mjs zone` — `CHAT_BULK_ZONE_OK` (после задачи 1 и после задачи 3).
- `node scripts/dev-checks/chat-api.mjs calendar` — `CHAT_CALENDAR_OK` (после задачи 2).
- `node scripts/dev-checks/chat-runs.mjs` — `CHAT_RUNS_OK`; `node scripts/dev-checks/chat-changes.mjs payment` — `CHAT_CHANGES_PAYMENT_OK`; `deletions` — `CHAT_CHANGES_DELETIONS_OK`.
- `grep -n "SCHEDULE_TIME_ZONE" apps/api/src/chat/command-zone.ts` — значение по умолчанию; `grep -n "submitCalendarCommand\|readCalendarCommand" apps/api/src/chat/bulk-move.ts` — отправка и проверка через журнал.
- `npx prettier --check` по файлам плана — чисто; `yarn knip` — код 0, только подсказки конфигурации.
- `git diff ab274d0 HEAD -- apps/api/src/chat/publish-gate.ts packages/core` пуст. Порт 4246 после прогона свободен, 3000 и 4000 не трогались.

## Не запускалось

- `yarn test`, `yarn build`, браузер — по заданию. Блок `bulk_move` в web рисует 23-13.
- `yarn workspace @dv-lab/web typecheck` и lint — web принадлежит 23-10. Новые значения контракта (`bulk_move`, `pending`, `partial`, новые issues, шаг `propose_bulk_move`) web-код должен принять; 23-10 уже обработал `bulk_move` в блоке предложения (`8b0ba07`).
- `ledger-api.mjs balance` и `chat-api.mjs target` — известные красные вне плана, не трогались.

## Отклонения от плана

### Автоисправления

**1. [Правило 1] Своя поломка `scripts/dev-checks/chat-runs.mjs` (файла нет в плане)**
- Список инструментов и их число (17 → 18) обновлены под `propose_bulk_move`. Коммит `26aa2d4`.

**2. [Правило 3] Вторая серия того же ученика в фикстуре `children` начинается на неделю позже**
- Создание второй еженедельной серии с тем же днём, временем, длительностью и началом отказывает `precondition_failed` (защита от дубля в `recurring-command.ts`). Вторая серия начинается с `next + 7`, вторник 16:00 VN; проверка концов и новых серий считается по `from` каждой цели. Коммит `eb764a3`.

### Прочие отклонения

- Предложение собирается через общий `stage` в `changes.ts`, а не отдельным `proposeBulkMove(db, chat, source, request, persist)`: так сохраняется образец 23-05, `persist` и квитанция общие, и нет цикла импортов. Функция называется `proposeBulkMove(executor, context, teacherText, request)`.
- `changes.ts` правился и в задаче 1 (ветка `bulk_move` в `prepare`), хотя в плане он отнесён к задаче 2.
- Версии серий запечатываются при Confirm и хранятся в `result.children[].version`, а не в `target`: в момент предложения версия в окне может быть ещё не спроецирована, а «до первой записи» выполняется при Confirm. Изменение правила или отметок между предложением и Confirm ловит снимок правила и `seriesAnchor`.
- `from` цели — `max(from запроса, allFrom)` в поясе ввода, а не дата вхождения в поясе ввода: `checkSeriesFrom` сравнивает `from` с `allFrom` серии строкой, и дата вхождения в поясе западнее серии дала бы `precondition_failed`. Вхождение превью — ровно то, которое отрезает core с этим `from`.
- В описание инструмента добавлена фраза про необязательный `from`.
- Раздел `proposal` вызывает `runTool('propose_bulk_move', …)` напрямую с сообщением учителя из `insertMessage`, без заглушки провайдера и хода модели: проверяется тот же путь инструмента, разбор дня, времени и пояса, без настроек ассистента и бюджета.
- Сценарий «серия меняется между детьми» в `children` проверен правкой правила (`ends_on` второй серии), версия Google отдельно не двигалась; сверка версии в коде есть.
- Удаление разговора с ожидающей командой проверено функцией `deleteConversation` (`pending`, маршрут отвечает на это 409 `busy`), а не HTTP: запущенный api с воркером календаря подхватил бы ожидающую команду и отправил её в офлайн-шлюз. Маршрут check проверен HTTP после завершения всех команд.
- `purgeCard` в `chat-bulk.mjs` убирает все карточки с ключом `chat-bulk:%`; разговоры разделов удаляются по списку, настройка пояса учителя восстанавливается в `finally`.

## Важно следующим планам

- 23-13 (web, `BulkMoveProposal`): блок `change_proposal` с `change.operation === 'bulk_move'`; состояния блока `proposed`, `pending` (действие отправлено), `applied`, `partial`, `failed`, `stale`, `declined`; issue у `stale`/`failed`/`partial`. Состояние каждой цели — `targets[].state`: `planned` до Confirm, затем `pending`, `applied`, `failed`, `not_started`. Для P16: confirmed = `applied`, unconfirmed = `pending` + `failed`, remaining = `not_started`. `wasStartsAt` — мгновение вхождения в поясе серии (`seriesTimeZone`), `nowStartsAt` — новое первое мгновение в поясе ввода, `from` — дата начала переноса. `receipt` — `{ studentId }` только у `applied`.
- Проверка статуса: `POST /chat/actions/:id/check` отвечает `chatActionResponse` и для change-действий; confirm и decline — прежние маршруты. Пока действие `submitted`, разговор не удаляется (409 `busy`).
- Отказы инструмента (`no_matching_lessons`, `zone_unknown`, `zone_not_in_message`, `connection_required`, `outside_sync_window`, `series_marked`, `nonexistent_local_time`, `student_not_found`) не создают строки `chat_actions` и блока; модель получает код ошибкой инструмента.
- В `dvlab_dev` нет подключения Google, поэтому `[fake:bulk]` там даёт `connection_required`.
- Описание разделов `proposal` и `children` в `scripts/dev-checks/README.md` не добавлено (файла нет в плане).

## Self-Check: PASSED

- Файлы: `apps/api/src/chat/command-zone.ts`, `apps/api/src/chat/bulk-move.ts`, `scripts/dev-checks/chat-bulk.mjs` — на месте.
- Коммиты `26aa2d4`, `4338edf`, `eb764a3` — в истории ветки.
