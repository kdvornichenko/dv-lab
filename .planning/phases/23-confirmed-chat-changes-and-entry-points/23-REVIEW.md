---
phase: 23-confirmed-chat-changes-and-entry-points
reviewed: 2026-10-14T12:00:00Z
depth: deep
diff_range: 80fe650..HEAD
files_reviewed: 92
files_reviewed_list:
  - AGENTS.md
  - apps/api/src/auth/middleware.ts
  - apps/api/src/cards/card-rows.ts
  - apps/api/src/cards/cards.ts
  - apps/api/src/cards/payments.ts
  - apps/api/src/chat/actions.ts
  - apps/api/src/chat/budget.ts
  - apps/api/src/chat/bulk-move.ts
  - apps/api/src/chat/calendar.ts
  - apps/api/src/chat/change-cards.ts
  - apps/api/src/chat/change-deletions.ts
  - apps/api/src/chat/changes.ts
  - apps/api/src/chat/command-zone.ts
  - apps/api/src/chat/conversations.ts
  - apps/api/src/chat/essay.ts
  - apps/api/src/chat/mentions.ts
  - apps/api/src/chat/messages.ts
  - apps/api/src/chat/provider.ts
  - apps/api/src/chat/publish-gate.ts
  - apps/api/src/chat/runs.ts
  - apps/api/src/chat/title.ts
  - apps/api/src/chat/tools.ts
  - apps/api/src/routes/chat.ts
  - apps/api/src/routes/payments.ts
  - apps/api/src/routes/students.ts
  - apps/api/src/schedule/calendar-conflicts.ts
  - apps/api/src/schedule/changes.ts
  - apps/api/src/schedule/series.ts
  - apps/api/src/today/today.ts
  - apps/web/app/(app)/(today)/page.tsx
  - apps/web/app/(app)/_components/app-shell.tsx
  - apps/web/app/(app)/_components/command-palette.tsx
  - apps/web/app/(app)/_components/due-list.tsx
  - apps/web/app/(app)/_components/today-lessons.tsx
  - apps/web/app/(app)/_components/today-screen.tsx
  - apps/web/app/(app)/chat/_components/bulk-move-proposal.tsx
  - apps/web/app/(app)/chat/_components/calendar-proposal.tsx
  - apps/web/app/(app)/chat/_components/change-proposal.tsx
  - apps/web/app/(app)/chat/_components/chat-progress.tsx
  - apps/web/app/(app)/chat/_components/chat-screen.tsx
  - apps/web/app/(app)/chat/_components/composer.tsx
  - apps/web/app/(app)/chat/_components/conversation-dialogs.tsx
  - apps/web/app/(app)/chat/_components/conversation-list.tsx
  - apps/web/app/(app)/chat/_components/essay-feedback.tsx
  - apps/web/app/(app)/chat/_components/mention-popup.tsx
  - apps/web/app/(app)/chat/_components/messages.tsx
  - apps/web/app/(app)/chat/_components/use-chat.ts
  - apps/web/app/(app)/chat/page.tsx
  - apps/web/app/(app)/schedule/_components/calendar-lesson-dialog.tsx
  - apps/web/app/(app)/schedule/_components/lesson-dialog.tsx
  - apps/web/app/(app)/schedule/_components/lesson-footer.tsx
  - apps/web/app/(app)/schedule/_components/lesson-mark-row.tsx
  - apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx
  - apps/web/app/(app)/schedule/_components/schedule-loading.tsx
  - apps/web/app/(app)/schedule/_components/schedule-toolbar.tsx
  - apps/web/app/(app)/students/[id]/_components/lessons-tab.tsx
  - apps/web/app/(app)/students/[id]/_components/opening-balance-panel.tsx
  - apps/web/app/(app)/students/[id]/_components/overview-tab.tsx
  - apps/web/app/(app)/students/[id]/_components/payments-tab.tsx
  - apps/web/app/(app)/students/[id]/_components/profile-arrival.ts
  - apps/web/app/(app)/students/[id]/_components/profile-loading.tsx
  - apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx
  - apps/web/app/(app)/students/[id]/_components/set-currency-dialog.tsx
  - apps/web/app/(app)/students/[id]/_components/student-profile.tsx
  - apps/web/app/(app)/students/[id]/page.tsx
  - apps/web/app/(app)/students/_components/assign-payment-dialog.tsx
  - apps/web/app/(app)/students/_components/student-form-dialog.tsx
  - apps/web/app/(app)/students/_components/unassigned-payments.tsx
  - apps/web/app/globals.css
  - apps/web/app/privacy/page.tsx
  - apps/web/components/app/date-field.tsx
  - apps/web/components/app/google-conflicts.tsx
  - apps/web/components/app/layout-parts.tsx
  - apps/web/components/app/markdown-view.tsx
  - apps/web/components/app/reload-notice.tsx
  - apps/web/components/app/time-zone-picker.tsx
  - apps/web/components/ui/button.tsx
  - apps/web/components/ui/dialog.tsx
  - apps/web/components/ui/menu-item.tsx
  - apps/web/components/ui/select/trigger.tsx
  - apps/web/components/ui/switch.tsx
  - apps/web/components/ui/tabs.tsx
  - apps/web/lib/api-client.ts
  - apps/web/lib/schedule-links.ts
  - packages/contracts/src/chat.ts
  - packages/contracts/src/schedule.ts
  - packages/contracts/src/students.ts
  - packages/db/drizzle/20261014040312_chat_changes/migration.sql
  - packages/db/drizzle/20261014044620_card_payment_revision/migration.sql
  - packages/db/src/calendar-values.ts
  - packages/db/src/chat-schema.ts
  - packages/db/src/schema.ts
findings:
  critical: 2
  warning: 9
  info: 6
  total: 17
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-10-14
**Depth:** deep (api, contracts, db и web; цепочки вызовов chat → cards/payments/schedule/calendar прослежены)
**Files Reviewed:** 92 (`scripts/dev-checks/*` — инструмент проверки, построчно не ревьюились)
**Status:** issues_found

## Summary

Проверен диапазон `80fe650..HEAD` фазы 23 и правки вне планов из `23-CHAT-FIXES.md`. Ядро подтверждения сделано аккуратно: действие блокируется `FOR UPDATE`, `confirm`/`decline` идемпотентны по `state`, повтор подтверждения ничего не пишет, `proposalOf` привязывает действие к блоку ответа, ревизии карточки, оплаты, заметки и комментария проверяются CAS-ом, маршруты чата, карточек и оплат закрыты `requireRole('teacher')`, удаление разговора переводит ждущие `change` в `stale`. Миграции только добавляют.

Главные проблемы:
- редактирование оплаты в форме пересчитывает уже начисленные минуты по текущей длине урока и молча меняет остаток (CR-01);
- массовый перенос по умолчанию берёт `from = seriesAnchor`, то есть до 8 недель назад, и переписывает прошедшие неотмеченные уроки (CR-02, противоречит SC2 «preserves history»);
- проверка «сумма из текста учителя» — проверка подстроки, `150` проходит для `1500` (WR-01);
- после подтверждения блок показывает «Balance is now …» из снимка предложения, а не из текущего остатка (WR-02);
- дочерние команды массового переноса после первой отправляются со старым `context.now`, и срок 30 с в `submitCalendarCommand` даёт ложный `partial` (WR-03);
- метка «approximate estimate» для эссе зависит от того, вызовет ли модель инструмент (WR-04, SC4).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Правка оплаты пересчитывает начисленные минуты по текущей длине урока

**File:** `apps/api/src/cards/payments.ts:157-171` (`updatePayment`)
**Issue:** `creditedMinutes` хранится в строке оплаты и фиксируется при записи. По этому правилу работают остаток (`card-facts.ts`, `balance.ts`) и обещание в `propose_rate` («Payments already recorded keep their lesson credit»). `updatePayment` читает `students.defaultLessonMinutes` на момент правки и пишет `creditedMinutes(input.lessonsHundredths, card.defaultLessonMinutes)` при любой правке, даже если меняется только комментарий или дата.
**Сценарий:** оплата на 5 уроков записана, когда урок длился 60 мин (300 мин). Позже длина урока карточки стала 90 мин. Учитель открывает Edit payment и меняет только комментарий. Начислено становится 450 мин, остаток вырастает на 150 мин без предупреждения. Форма показывает те же «5 lessons» до и после правки.
**Fix:** пересчитывать начисление, только если изменилось число уроков. Иначе оставлять сохранённое значение или пересчитывать от длины на момент записи:
```ts
const [current] = await tx.select({ studentId: payments.studentId, revision: payments.revision,
  lessonsCount: payments.lessonsCount, creditedMinutes: payments.creditedMinutes })...
const sameLessons = (current.lessonsCount === null ? null : decimalToHundredths(current.lessonsCount)) === input.lessonsHundredths
const credited = sameLessons ? current.creditedMinutes : creditedMinutes(input.lessonsHundredths, card.defaultLessonMinutes)
```
В форме правки при изменении числа уроков показывать, по какой длине урока считается начисление.

### CR-02: Массовый перенос по умолчанию переписывает прошедшие неотмеченные уроки

**File:** `apps/api/src/chat/bulk-move.ts:176-183`, `apps/api/src/schedule/series.ts:22-34`, `apps/api/src/calendar/sync-store.ts:56-58`
**Issue:** если учитель не назвал дату, `from = allFrom = seriesAnchor(...)`. Это первая дата серии после последнего отмеченного или прокомментированного вхождения, но не раньше начала окна синхронизации, а окно начинается за 56 дней до текущего понедельника. Ограничения «не раньше сегодня» нет. Дальше `cutSeries` режет серию с `startOfZonedDay(from)`: прошедшие неотмеченные вхождения уходят из старой серии, а новая серия начинается с `firstOnOrAfter(from, toWeekday)` в прошлом. `nowStartsAt` первой цели тоже может оказаться в прошлом. `proposeBulkMove` и `buildChild` это не проверяют, `cutSeries` тоже.
**Сценарий:** учитель три недели не отмечал уроки по вторникам и пишет «перенеси вторники 16:00 на среды 18:00». В предложении From стоит дата трёхнедельной давности. После Confirm прошедшие вторники в базе и в Google становятся средами, которых не было. Today показывает их как требующие отметки. Требование SC2 и D-06 («preserves history») нарушено, отменить перенос из чата нельзя (это написано в `stayLines`).
**Fix:** для чата нижняя граница — первое вхождение, которое ещё можно менять:
```ts
const today = scheduleToday(context.now, zone.zone)
const floor = allFrom > today ? allFrom : today
const from = request.from !== null && request.from > floor ? request.from : floor
```
Плюс отказ или явная пометка в блоке, если `nowStartsAt < context.now`. То же условие повторить в `buildChild`, потому что между предложением и подтверждением может пройти время.

## Warnings

### WR-01: «Сумма из текста учителя» проверяется как подстрока

**File:** `apps/api/src/chat/changes.ts:122-125, 179-180`, `apps/api/src/chat/change-cards.ts:94`
**Issue:** `writtenIn` проверяет `flat(message).includes(piece)`. `said.has(rateText)` для ставки делает то же. Проверка длины урока (`hasNumber`, `changes.ts:135`) учитывает границы цифр, а суммы, ставки и `lessons_text` — нет.
**Сценарий:** учитель пишет «оплатил 1500». Модель вызывает `propose_payment` с `amount_text: "150"` или `"15"`, и проверка проходит. `lessons_text: "1"` проходит для любого сообщения, где есть цифра 1, например в дате. Подтверждение остаётся последним барьером, но серверная защита «модель не придумывает деньги» (D-03) не работает.
**Fix:** сравнивать с границами чисел, как в `hasNumber`: экранировать `piece` и проверять `(?<![\p{Nd}.,])piece(?![\p{Nd}]|[.,]\p{Nd})` по `flat(message)`. Это нужно для `amountText`, `lessonsText` и `rateText`.

### WR-02: После подтверждения «Balance is now …» берётся из снимка предложения

**File:** `apps/web/app/(app)/chat/_components/change-proposal.tsx:374-390`, `apps/api/src/chat/messages.ts` (`changeView`), `apps/api/src/chat/changes.ts:209-250, 357-376`, `apps/api/src/chat/change-deletions.ts:93-117`
**Issue:** `balanceMinutes` и `balanceAfterMinutes` считаются при предложении. `changeView` для `applied` возвращает исходный `change`, а `appliedLine` пишет «Balance is now X». Защита `record_payment` — только `cardRevision`, а другие оплаты, их удаление и отметки уроков ревизию карточки не поднимают. Значит, к моменту Confirm остаток может быть другим, а подтверждение всё равно проходит.
**Сценарий:** предложение оплаты создано, затем в форме записана вторая оплата или отмечен урок. Учитель подтверждает первое предложение, и блок называет текущим остаток, который не совпадает с профилем. Это расходится с D-03 и SC3 («same balance»). С `delete_payment` то же самое.
**Fix:** в `applyPayment` и `applyDeletion` после записи посчитать `cardFacts` в той же транзакции, положить `balanceAfterMinutes` в `after` и показывать его в `changeView`. Или убрать из квитанции фразу «Balance is now» и давать ссылку на профиль.

### WR-03: Дочерние команды массового переноса отправляются со старым `context.now`

**File:** `apps/api/src/chat/bulk-move.ts:404-420, 476-521`, `apps/api/src/calendar/commands.ts:50-58`
**Issue:** `checkBulk` в одном запросе проходит дочерние команды по очереди: `advance` → `submitChild`, и всем передаётся `context` запроса с `now`, зафиксированным в начале запроса. `submitCalendarCommand` считает срок как `context.now + 30000` и после него бросает `CommandFault('not_applied')`.
**Сценарий:** у ученика 3–4 серии в одно время, Google отвечает по нескольку секунд. Через 30 с после начала запроса `/confirm` очередная дочерняя команда сразу получает `not_applied`, `recordChild` не находит запись в журнале и вызывает `stop`, блок становится `partial`. `changeIssue` приводит `not_applied` к `calendar_changed`, и учитель читает неверную причину: «The remaining lessons changed after you asked». `weekWindow(context.now, …)` в `buildChild` тоже работает со старым временем.
**Fix:** перед каждой отправкой и сборкой брать свежее время: `const now = new Date(); submitCalendarCommand({ accountId, now }, …)`, а в `buildChild` передавать `{ ...context, now }`. `not_applied` показывать отдельной причиной, а не `calendar_changed`.

### WR-04: Метка «approximate estimate» для эссе зависит от модели

**File:** `apps/api/src/chat/runs.ts:589-594, 716`, `apps/api/src/chat/provider.ts:73`, `apps/web/app/(app)/chat/_components/messages.tsx` (`ReplyText`)
**Issue:** в ходе `/essay` модели доступен только `essay_feedback`, но `tool_choice` стоит `auto`. Блок `essay` с меткой появляется, только если модель вызвала инструмент. Если ответ пришёл текстом без вызова, web показывает обычный ответ без «Approximate estimate — not an official IELTS score.». Если эссе вставлено без `/essay`, `gate.scores` включается только после вызова инструмента, и баллы, которые модель назвала до вызова, проходят проверку публикации.
**Сценарий:** `/essay <текст>`, модель отвечает разбором без вызова инструмента, и метки нет. SC4 нарушен.
**Fix:** в ходе `/essay` сервер сам добавляет блок `{ type: 'essay', task: null }` до первого текста (или ставит `tool_choice: { type: 'tool', name: 'essay_feedback' }` на первый запрос), а `gate.scores = true` включается с начала хода.

### WR-05: Кнопка «Check status» в состоянии `partial` ничего не делает

**File:** `apps/web/app/(app)/chat/_components/bulk-move-proposal.tsx:408`, `apps/api/src/chat/bulk-move.ts:282-290, 335-351, 484-485`
**Issue:** `stop` переводит действие в `state: 'refused'` с `kind: 'partial'`. `checkBulk` работает только через `running()`, а тот возвращает `null`, если `state !== 'submitted'`. Кнопка видна при `summary.unconfirmed > 0`, то есть при дочерней команде `failed`, но `/check` состояние уже не меняет.
**Сценарий:** вторая серия получила `failed`, потому что отправка упала по таймауту, но в Google команда применилась. Учитель нажимает «Check status», ничего не меняется, блок навсегда пишет «Unconfirmed», хотя урок перенесён.
**Fix:** для `partial` с `commandId !== null` у упавшей дочерней команды разрешить в `checkChange` перечитать её через `readCalendarCommand` и обновить состояние этой цели. Если сверять нечего, кнопку не показывать.

### WR-06: Блок массового переноса в состоянии «unknown» не даёт никакого действия

**File:** `apps/web/app/(app)/chat/_components/bulk-move-proposal.tsx:306-312, 349-358`
**Issue:** если `decideChange` вернул `false` (POST и перечитывание разговора не прошли), блок показывает «Could not load this change's status.» и `Scope`, но ни Refresh, ни Confirm/Decline. В `ChangeProposal` для этого случая есть «Refresh status». `onRefresh` приходит в компонент через `{...changes}`, но не используется.
**Сценарий:** короткий обрыв сети при Confirm, и до перезагрузки страницы с блоком ничего нельзя сделать.
**Fix:** добавить такую же кнопку «Refresh status», которая вызывает `onRefresh` и сбрасывает `unknown` при успехе.

### WR-07: CAS карточки под `repeatable read` даёт 500 вместо 409 при настоящей гонке

**File:** `apps/api/src/routes/students.ts:95-110`, `apps/api/src/cards/cards.ts:128-146`
**Issue:** `mutateStudent` выполняет `UPDATE … WHERE revision = expected` в транзакции `repeatable read`. Если другая транзакция зафиксировала изменение строки после снимка, Postgres бросает `40001 could not serialize access`, а не обновляет 0 строк. В api нет обработки `40001` (поиск `40001`/`serialization` по `apps/api/src` пуст), поэтому ответ — 500. Форма карточки показывает notice `lost`, диалог архивации — общую ошибку вместо «changed elsewhere».
**Сценарий:** учитель подтверждает в чате `set_rate`, и одновременно в другой вкладке сохраняется Edit details.
**Fix:** для CAS-записей карточки уровень `read committed` достаточен: условие по ревизии само защищает от потерянного обновления. Либо ловить `postgresCode(error) === '40001'` в `mutateStudent` и отвечать `{ kind: 'changed' }`.

### WR-08: Вкладка Lessons открывает неделю по UTC-дате `asOf`

**File:** `apps/web/app/(app)/students/[id]/_components/lessons-tab.tsx:173`
**Issue:** `mondayOf(asOf)` получает ISO-мгновение, а `dateParts` берёт первые 10 знаков, то есть дату в UTC. Неделя учителя считается в `mainTimeZone`. `currentMonday` в той же функции считается правильно через `scheduleToday`.
**Сценарий:** в понедельник до 07:00 по Вьетнаму профиль открывает Lessons на прошлой неделе. Кнопка Today показывает другую неделю, чем открылась первой.
**Fix:** `useState(() => mondayOf(scheduleToday(new Date(asOf), mainTimeZone)))`.

### WR-09: В блоке удаления оплаты нет длины урока, web восстанавливает её из оплаты

**File:** `packages/contracts/src/chat.ts` (`chatDeletePaymentChange`), `apps/api/src/chat/change-deletions.ts:95-117`, `apps/web/app/(app)/chat/_components/change-proposal.tsx:231-235, 274-296, 385-390`
**Issue:** `chatRecordPaymentChange` передаёт `lessonMinutes`, а `chatDeletePaymentChange` — нет. `lessonMinutesOf` вычисляет длину как `creditedMinutes * 100 / lessonsHundredths`, то есть длину урока на момент записи этой оплаты. Если оплата без уроков, берётся `LESSON_MINUTES_DEFAULT`. Остаток в минутах переводится в уроки по этой длине, а профиль переводит по текущей длине урока карточки.
**Сценарий:** длина урока карточки менялась, или оплата без уроков у ученика с уроком 90 мин: «Balance» и «Balance is now» в чате показывают другое число уроков, чем профиль.
**Fix:** добавить `lessonMinutes: card.defaultLessonMinutes` в `previewPayment` и в контракт, `lessonMinutesOf` удалить.

## Info

### IN-01: «Your draft has been kept» в остатке на дату открытия не соответствует поведению

**File:** `apps/web/app/(app)/students/[id]/_components/opening-balance-panel.tsx:58, 145-152`, `apps/web/app/(app)/students/[id]/_components/overview-tab.tsx:111`
**Issue:** панель смонтирована с `key={`${openingVersion}-${student.revision}`}`. Reload поднимает ревизию и пересоздаёт панель, черновик теряется. Фоновое обновление профиля по `DATA_CHANGED_CHANNEL` тоже молча сбрасывает введённое.
**Fix:** убрать из текста «Your draft has been kept» или держать черновик выше ключа и брать ревизию из пропса при сохранении.

### IN-02: Отмена серии «с сегодня» оставляет сегодняшний урок

**File:** `apps/api/src/chat/calendar.ts:253-255`
**Issue:** `lastOn = max(from - 1, today)`, потому что `endSeriesAt` не принимает `lastOn < today`. Если урок серии сегодня вечером, он остаётся. Блок честно пишет «No lessons from <следующая дата>», но модель могла пообещать отмену с сегодняшнего дня.
**Fix:** в квитанции модели (`receipt` для `calendar_proposal`) передавать `from` первого отменяемого вхождения или отдельно предлагать отмену сегодняшнего урока.

### IN-03: Попытка автоназвания не освобождается после падения процесса

**File:** `apps/api/src/chat/title.ts:132-141`, `apps/api/src/chat/runs.ts:859`
**Issue:** у попытки `turn_id = null`, а `sweepInterrupted` проходит только попытки ходов. После падения во время запроса резерв остаётся в `dispatched`. Записано в `23-CHAT-FIXES.md`, но не исправлено.
**Fix:** при запуске освобождать или помечать `unknown` попытки с `turn_id is null` в состоянии `reserved`/`dispatched` старше таймаута 30 с.

### IN-04: Поля, которые не сверяются с текстом учителя

**File:** `apps/api/src/chat/changes.ts:183-198`, `apps/api/src/chat/change-cards.ts:130-143, 183-191`
**Issue:** `paid_on`, `note`, `currency` (у оплаты и ставки), `gender` и `clear` модель передаёт без проверки по сообщению. Дату модель считает сама («вчера»), то есть вопреки D-03 «модель не считает». Блок показывает значения, решение за подтверждением.
**Fix:** как минимум сверять `currency` и `note` через `said.has`/`hasName`, а `paid_on` вне сегодняшнего дня выделять в блоке.

### IN-05: `singlesLeft` считает одиночные уроки до даты `from`

**File:** `apps/api/src/chat/bulk-move.ts:149-155, 229`
**Issue:** `singlesAt` берёт все будущие одиночные уроки в это время, не учитывая `request.from`. Если учитель назвал `from`, фраза «N single lessons at this time are not moved» может включать уроки, которые и так не попадали в перенос.
**Fix:** фильтровать `startsAt >= startOfZonedDay(from, zone)`.

### IN-06: Вставленное эссе без `/essay` может вызвать немедленные записи до `essay_feedback`

**File:** `apps/api/src/chat/tools.ts:862-864`, `apps/api/src/chat/runs.ts:745-748`
**Issue:** режим только чтения включается после вызова `essay_feedback`. Если вставленный текст ученика уговорит модель сначала вызвать `mark_lesson`, `add_note` или `add_comment`, запись пройдёт (у неё есть Undo). Ход `/essay` защищён.
**Fix:** если в сообщении учителя длинный вставленный текст без `@`-упоминаний, предлагать `/essay` или до `essay_feedback` разрешать только чтение.

---

_Reviewed: 2026-10-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
