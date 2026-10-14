---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '07'
subsystem: chat
status: complete
tags: [chat, deletions, payments, notes, comments, calendar, end_series, keep]

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 'диспетчер операций changes.ts и образец change-cards.ts (23-05); deletePayment с ревизией и ревизия оплаты (23-02); журнал команд календаря и предложения календаря фазы 22/25.1'
provides:
  - 'операции delete_payment, remove_note, remove_comment в CHAT_CHANGE_OPERATIONS, варианты блока change_proposal и issues payment_changed, entry_changed'
  - 'модуль apps/api/src/chat/change-deletions.ts: чтение оплат для инструмента, превью и применение удалений через deletePayment, retractStudentNote, retractLessonComment'
  - 'инструменты student_payments, propose_payment_delete, propose_entry_removal и шаги для них в CHAT_STEP_TOOLS'
  - 'операция end_series у предложения календаря, цель series_end { from, lastOn }, состояние declined'
  - 'declineAction принимает действия calendar: Keep сохраняется на сервере (state refused, result.state declined)'
  - 'раздел deletions в scripts/dev-checks/chat-changes.mjs, сценарии end_series и Keep в scripts/dev-checks/chat-calendar.mjs'
affects: [23-09, 23-10, 23-13, 23-14]

tech-stack:
  added: []
  patterns:
    - 'Предложения изменений стадируются общей функцией stage в changes.ts; модуль операции отдаёт { kind: ok, target, change } или { kind: refused, code }'
    - 'Цель series у хранимого предложения календаря — объединение { from, weekday, startTime } (move_series) и { lastOn } (end_series)'

key-files:
  created:
    - apps/api/src/chat/change-deletions.ts
  modified:
    - packages/contracts/src/chat.ts
    - apps/api/src/chat/changes.ts
    - apps/api/src/chat/tools.ts
    - apps/api/src/chat/runs.ts
    - apps/api/src/chat/calendar.ts
    - apps/api/src/chat/actions.ts
    - scripts/dev-checks/chat-changes.mjs
    - scripts/dev-checks/chat-calendar.mjs
    - scripts/dev-checks/chat-runs.mjs
    - scripts/dev-checks/README.md

key-decisions:
  - 'Нижняя граница lastOn у end_series — scheduleToday(now, пояс учителя), а не lessonDay: core endSeriesAt сравнивает lastOn со scheduleToday, и между 00:00 и 02:00 lessonDay дал бы вчерашнюю дату и отказ при Confirm'
  - 'target.from у series_end — addDays(lastOn, 1), то есть первый отменяемый день после ограничения сегодняшним днём, а не исходный from намерения'
  - 'Первое отменяемое вхождение для проверки окна синхронизации ищется от max(lastOn + 1, starts_on) серии; серия, уже закончившаяся раньше, даёт отказ not_found'
  - 'Инструмент propose_entry_removal передаёт в changes.ts операцию remove_entry; модуль сам определяет, заметка это или комментарий, и хранит remove_note или remove_comment'
  - 'Комментарий урока ищется прямым запросом по id, ученику и retracted_at is null (как goneSources в messages.ts): listStudentComments с пределом не годится для поиска по id'
  - 'lessonDate у remove_comment допускает null (occurrenceStartsAt может не найти начало вхождения)'
  - 'Тело заметки и комментария в превью обрезается до 300 кодовых точек с многоточием (CHAT_REMOVED_BODY_MAX)'
  - 'Тип ChangeOutcome.ok расширен до блока change_proposal или calendar_proposal, маршрут decline не менялся'

requirements-completed: [CHAT-05]

coverage:
  - id: D1
    description: 'Удаление оплаты по точному id: две оплаты с одной суммой и датой различаются по payment_id; до confirm строк столько же; confirm удаляет только выбранную строку, остаток профиля равен balanceAfterMinutes; правка оплаты до confirm — stale payment_changed; оплата другого ученика — payment_not_found; decline оставляет строку'
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs deletions'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Отзыв заметки и комментария: только после confirm, retracted_at заполнен, строка на месте, ревизия +1; отзыв или правка до confirm — stale entry_changed; чужая и отозванная запись — entry_not_found; decline без отзыва'
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs deletions'
        status: pass
    human_judgment: false
  - id: D3
    description: 'Отмена всех уроков серии: предложение end_series с series_end без команды; Confirm — команда end_series через журнал, applied после заглушки и проекции, ends_on = lastOn, строки серии, исключений, отметок и уроков на месте, Undo нет; без Google — connection_required'
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-api.mjs calendar'
        status: pass
    human_judgment: false
  - id: D4
    description: 'Keep у предложения календаря: declined на сервере и после перечитывания разговора, команды нет; Confirm и повтор Keep после него возвращают тот же блок; маршрут decline отвечает 200 с блоком'
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-api.mjs calendar'
        status: pass
    human_judgment: false
  - id: D5
    description: 'Прежние сценарии оплаты, карточек, хода модели и календаря не сломаны'
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs payment; node scripts/dev-checks/chat-changes.mjs cards; node scripts/dev-checks/chat-runs.mjs'
        status: pass
    human_judgment: false

actuals:
  tokens: 22600
  tasks: 3
  commits: 3
plan_head_before: bf8f83f4df6cf9293d8f2235b35e65fff8993781
plan_head_after: bf88dcbaaf136af0d972584b7f8f438363a97522

duration: 25min
completed: 2026-10-14
---

# Фаза 23, план 07: удаления из чата (оплата, заметка или комментарий, конец серии) и сохранённый Keep — итоги

**Модель предлагает удалить одну оплату по payment_id из student_payments, отозвать заметку или комментарий по id из маркера student_notes или закончить серию уроков; запись идёт только после подтверждения через deletePayment, retractStudentNote, retractLessonComment с ревизией и через журнал команд Google для end_series, а Keep у предложения календаря сохраняется на сервере.**

## Производительность

- Начало около 2026-10-14T05:40Z, конец около 2026-10-14T06:05Z.
- Задачи: 3 из 3.
- `commits: 3` — `git rev-list --count bf8f83f..HEAD` до коммита SUMMARY; параллельных исполнителей не было.
- `tokens` — символы диффа плана / 4 (90270 / 4).

## Что сделано

- Контракты (`packages/contracts/src/chat.ts`): операции `delete_payment`, `remove_note`, `remove_comment`; issues `payment_changed`, `entry_changed`; варианты `chatDeletePaymentChange` (дата, сумма, валюта или null, уроки, кредит, заметка, остаток до и после), `chatRemoveNoteChange` (`noteId`, `sectionKind`, обрезанное тело, `createdAt`), `chatRemoveCommentChange` (`commentId`, `lessonRef`, `lessonDate` или null, тело, `createdAt`); константа `CHAT_REMOVED_BODY_MAX`; шаги `student_payments`, `propose_payment_delete`, `propose_entry_removal`; `CHAT_CALENDAR_OPERATIONS` + `end_series`, цель `{ kind: 'series_end', from, lastOn }`, `CHAT_CALENDAR_STATES` + `declined`.
- `apps/api/src/chat/change-deletions.ts` (новый): `paymentRecords` для инструмента, `previewDeletion` (оплата обязана быть в `listCardPayments` названного ученика, иначе `payment_not_found`; заметка — живая из `listStudentNotes`; комментарий — живой этого ученика, иначе `entry_not_found`), `applyDeletion` (`deletePayment` с `paymentRevision`, `retractStudentNote` с ревизией и учеником, `retractLessonComment` с ревизией; иной исход — stale). Строк заметок и комментариев модуль не удаляет и не пишет напрямую.
- `apps/api/src/chat/changes.ts`: общий `stage` вместо `prepareCard`, диспетчер `prepare` по операции, ветка применения удалений, `declineAction` для действий `calendar` вызывает `declineCalendarChange`.
- `apps/api/src/chat/tools.ts`: три strict-инструмента, `student_payments` в ветке чтения через `fit` без блока, квитанции удалений без сумм и с запретом говорить «удалено», описание `propose_lesson_change` дополнено фразой про `cancel` со scope `series`.
- `apps/api/src/chat/runs.ts`: строка SYSTEM про удаление оплаты, отзыв записи и отмену всех уроков серии.
- `apps/api/src/chat/actions.ts`: снят отказ `out_of_phase` для `cancel` со scope `series`.
- `apps/api/src/chat/calendar.ts`: ветка `end_series` в `proposeCalendarChange` (проверка окна синхронизации для первого отменяемого вхождения), `buildCommand` для `end_series` с версией серии из окна недели, `settleForward` читает версию события только у `move` и `cancel`, `prepareUndo` отказывает всем, кроме `move` и `cancel`, экспорт `declineCalendarChange` (`proposed` → `refused` с `{ state: 'declined' }`, иначе текущий блок).
- Проверки: раздел `deletions` в `chat-changes.mjs` (20 проверок, карточки `Alex Example 2350`–`2353`), в `chat-calendar.mjs` 11 новых проверок (`caseEndSeries`, `caseKeep`, маршрут decline), уборка `lesson_comments` в `removeCardRows`.

## Коммиты задач

1. Задача 1 (удаление одной оплаты по точному id) — `fc323ca` (feat)
2. Задача 2 (отзыв заметки или комментария урока) — `3e0755c` (feat)
3. Задача 3 (конец серии из чата и сохранённый Keep) — `bf88dcb` (feat)

## Проверки

- `yarn workspace @dv-lab/contracts typecheck` и `yarn workspace @dv-lab/api typecheck` — 0 после каждой задачи.
- `node scripts/dev-checks/chat-changes.mjs deletions` — `CHAT_CHANGES_DELETIONS_OK` (20 проверок, порт 4241, `dvlab_test`).
- `node scripts/dev-checks/chat-api.mjs calendar` — `CHAT_CALENDAR_OK` (все прежние сценарии и 11 новых, карточек и разговоров после прогона 0), повтор после prettier — тот же результат.
- `node scripts/dev-checks/chat-changes.mjs payment` — `CHAT_CHANGES_PAYMENT_OK`; `cards` — `CHAT_CHANGES_CARDS_OK`; `node scripts/dev-checks/chat-runs.mjs` — `CHAT_RUNS_OK`.
- `grep -n "deletePayment\|retractStudentNote\|retractLessonComment" apps/api/src/chat/change-deletions.ts` — все три вызова; `grep -n "end_series" apps/api/src/chat/calendar.ts` — операция найдена.
- `npx prettier --check` по файлам плана — чисто.
- `yarn knip` — код 0, только подсказки конфигурации.
- `yarn workspace @dv-lab/web typecheck` — код 2, шесть ошибок TS2339 в `apps/web/app/(app)/chat/_components/calendar-proposal.tsx` (цель `series_end` без `startsAt`, `durationMinutes`, `date`). Ожидаемо по плану: первая задача 23-10 восстанавливает сборку web. Других ошибок нет.
- `git diff apps/api/src/chat/publish-gate.ts` за план пуст. Порты 4241 и 4225 после прогонов свободны, 3000 и 4000 не трогались.

## Не запускалось

- `yarn test`, `yarn build`, lint web, браузер — по заданию и потому что web-части у плана нет; блоки `delete_payment`, `remove_note`, `remove_comment`, `end_series` и `declined` в web рисует 23-10.
- `node scripts/dev-checks/ledger-api.mjs balance` — известный красный с фазы 25.1, не трогался.
- `node scripts/dev-checks/chat-api.mjs target` запускался как дополнительная проверка и падает на подготовке: `sql helper error 21000`. Причина вне плана: в `dvlab_test` у логина учителя-фикстуры два аккаунта с `teacher_settings` (деактивированный старый и активный, созданный в 04:08, до начала плана), подзапрос `chat-target.mjs` (строка 702) возвращает две строки. Код плана `chat-target.mjs` не затрагивает. Данные базы не менялись.

## Отклонения от плана

### Автоисправления

**1. [Правило 1] Нижняя граница `lastOn` — `scheduleToday`, а не `lessonDay`**
- План называл `lessonDay(now, пояс)`, но `endSeriesAt` в core отказывает `lastOn < scheduleToday`; ночью (00:00–02:00) `lessonDay` дал бы вчерашнюю дату и `precondition_failed` при Confirm. Коммит `bf88dcb`.

**2. [Правило 1] Своя поломка `scripts/dev-checks/chat-runs.mjs` (файла нет в плане)**
- Список инструментов и их число (14 → 17) обновлены под новые инструменты. Коммиты `fc323ca`, `3e0755c`.

**3. [Правило 3] Уборка `lesson_comments` в `removeCardRows` (`chat-changes.mjs`)**
- Без неё `removeCards` падал бы на внешнем ключе комментариев к урокам фикстуры. Коммит `3e0755c`.

**4. [Правило 3] Сценарий «отмени все уроки серии» вызывает `executeIntent`, а не `sendMessage`**
- Быстрых форм для отмены серии нет, а в `chat-calendar.mjs` нет модели; `executeIntent` с намерением `cancel`/`series` — ровно путь инструмента `propose_lesson_change`, ответ ассистента с блоком пишется через `insertMessage`. Коммит `bf88dcb`.

### Прочие отклонения

- `lessonDate` у `remove_comment` — `calendarDate | null`, а не обязательная дата.
- `target.from` у `series_end` — `lastOn + 1`.
- Разделы проверок описаны в `scripts/dev-checks/README.md` (файла нет в плане), строка `FIXTURES` в `chat-calendar.mjs` теперь говорит о 10 карточках.
- Проверка «правка комментария до confirm» продвигает ревизию комментария SQL-ом: формы правки комментария нет, ревизию в жизни двигает разрез серии.

## Для следующих планов

- 23-10 (web): `ChangeProposal` получает `delete_payment` (`paidOn`, `amountMinor`, `currency` или null, `lessonsHundredths`, `creditedMinutes`, `note`, `balanceMinutes`, `balanceAfterMinutes`), `remove_note` (`sectionKind`, `body` до 300 знаков, `createdAt`) и `remove_comment` (`lessonRef`, `lessonDate` или null, `body`, `createdAt`); stale-issues `payment_changed`, `entry_changed`. `CalendarProposal` получает `operation: 'end_series'` с `target.kind === 'series_end'` (`from` — первый отменяемый день, `lastOn` — последний оставшийся), `lesson.startsAt` — первое отменяемое вхождение, `undo: null`; состояние `declined` (Keep, `POST /chat/actions/:id/decline` отвечает 200 с блоком календаря). Сейчас `calendar-proposal.tsx` не собирается (шесть TS2339).
- После применения удаления `receipt` — `{ studentId }` без `paymentId`.
- `remove_entry` — операция только запроса инструмента; в хранилище и блоке её нет.
- В `dvlab_test` два аккаунта учителя-фикстуры с одним логином и настройками ломают `chat-api.mjs target`; чинить фикстуру или подзапрос — вне этого плана.

## Self-Check: PASSED

- Файлы: `apps/api/src/chat/change-deletions.ts`, `scripts/dev-checks/chat-changes.mjs`, `scripts/dev-checks/chat-calendar.mjs` — на месте.
- Коммиты `fc323ca`, `3e0755c`, `bf88dcb` — в истории ветки.
