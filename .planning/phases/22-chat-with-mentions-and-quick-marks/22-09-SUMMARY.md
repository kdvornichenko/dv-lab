---
phase: 22-chat-with-mentions-and-quick-marks
plan: '09'
status: complete
verification: blocked
subsystem: db-api-web
tags: [chat, messages, actions, undo, revision, idempotency, broadcast-channel, quick-marks]

requires:
  - phase: 22-03
    provides: 'writeMark(executor, accountId, ref, { kind, expectedStartsAt, expectedRevision }, now) с before и ревизией'
  - phase: 22-05
    provides: 'chat_conversations, conversations.ts, use-chat.ts, ChatScreen'
  - phase: 22-06
    provides: 'appendStudentNote, retractStudentNote'
  - phase: 22-07
    provides: 'appendLessonComment, retractLessonComment'
  - phase: 22-08
    provides: 'mentionBinding, validateMentions, parseQuickCommand, resolveLessonTarget, Composer'
provides:
  - 'db: chat_messages (reply_to, request_id/request_digest, уникальный (account_id, request_id)) и chat_actions (kind, state, target/before/after, result, колонки календаря и Undo), REVOKE DELETE, TRUNCATE у dvlab_app'
  - 'contracts/chat.ts: CHAT_MESSAGE_MAX, chatRefusalCode (один перечень кодов чата), sendMessageRequest/Response, chatBlock (action_result | clarify | refused), chatMessage, chatConversationReadResponse, undoRequest/Response, chatMarkEffect'
  - 'api chat/actions.ts: sendMessage, executeLocalAction (единственный исполнитель отметок, заметок и комментариев из чата), undoAction'
  - 'api chat/messages.ts: listMessages, insertMessage, findRequest, replyOf, undoState (Undo выводится при чтении из chat_actions)'
  - 'api routes/chat.ts: GET /chat/conversations/:id отдаёт messages, POST /chat/conversations/:id/messages, POST /chat/actions/:id/undo'
  - 'web: DATA_CHANGED_CHANNEL (dvlab:data-changed) в api-client, refreshReaders в CalendarCommandProvider'
  - 'web /chat: сообщения (messages.tsx), ChatResult (action-result.tsx), Send в композере, New chat без POST, разговор создаётся первым сообщением'
  - 'scripts/dev-checks: chat-api.mjs actions (CHAT_ACTIONS_OK), chat-web.mjs actions (CHAT_WEB_ACTIONS_OK, не исполнялся)'
affects: [22-10, 22-12, 22-13, 22-14, 22-16]

actuals:
  tokens: 32187
  tasks: 4
  commits: 4
plan_head_before: ad3f76b144271eb5ae5a5f617f6896775e6e05a1
plan_head_after: 152f44a

tech-stack:
  added: []
  patterns:
    - 'Отправка: блокировка разговора FOR UPDATE, затем поиск requestId; digest = sha256(conversationId, text, mentions); тот же digest — исходные сообщения (200), другой — 409'
    - 'Эффект владельца в savepoint (tx.transaction); отказ владельца — блок refused, сообщение и отказ сохраняются в той же транзакции'
    - 'Состояние Undo не хранится в blocks: при чтении накладывается из chat_actions (undone -> done, undo_result stale -> stale, иначе available)'
    - 'Другие вкладки узнают об изменении только из BroadcastChannel с сообщением changed и перечитывают своих читателей useCalendarRefresh'

key-files:
  created:
    - packages/db/drizzle/20261013135713_chat_messages_actions/migration.sql
    - packages/db/drizzle/20261013135713_chat_messages_actions/snapshot.json
    - packages/db/drizzle/20261013135720_chat_messages_actions_revoke_delete/migration.sql
    - packages/db/drizzle/20261013135720_chat_messages_actions_revoke_delete/snapshot.json
    - apps/api/src/chat/actions.ts
    - apps/api/src/chat/messages.ts
    - apps/web/app/(app)/chat/_components/messages.tsx
    - apps/web/app/(app)/chat/_components/action-result.tsx
  modified:
    - packages/db/src/chat-schema.ts
    - packages/contracts/src/chat.ts
    - apps/api/src/chat/conversations.ts
    - apps/api/src/chat/quick-command.ts
    - apps/api/src/routes/chat.ts
    - apps/web/lib/api-client.ts
    - apps/web/components/app/calendar-command-provider.tsx
    - apps/web/app/(app)/chat/_components/use-chat.ts
    - apps/web/app/(app)/chat/_components/chat-screen.tsx
    - apps/web/app/(app)/chat/_components/composer.tsx
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-web.mjs
    - scripts/dev-checks/README.md

key-decisions:
  - 'Ответ ассистента связан с сообщением учителя колонкой reply_to: по ней находятся исходные сообщения при повторе requestId и блок действия при Undo'
  - 'created_at сообщений по умолчанию clock_timestamp(): сообщение учителя и ответ, вставленные в одной транзакции, получают разное время и стабильный порядок'
  - 'cancel и move отвечают out_of_phase (P12) до резолвера и без строки chat_actions; mention_stale и model_unavailable тоже без строки действия: сохранённый результат — блок в ответе'
  - 'Вопрос (clarify) и отказ резолвера или владельца пишут строку chat_actions с state refused и без эффекта'
  - 'Повторный Undo с любым requestId после первой попытки возвращает сохранённый исход и ничего не меняет; Undo вопроса или отказа — 409'

requirements-completed: [CHAT-03, CHAT-04, CHAT-09]

duration: ~2h
completed: 2026-10-13
---

# Phase 22 Plan 09: Отметки, заметки и комментарии из чата с Undo Summary

Строка «@ученик was <дата>» сразу ставит Done точному уроку: эффект, сообщение учителя, строка `chat_actions` и ответ с блоком результата пишутся одной транзакцией, повтор `requestId` безопасен, Undo возвращает прежнюю отметку только при неизменной ревизии, а Today, Schedule и Students в других вкладках перечитываются по `BroadcastChannel`. Браузерная проверка не выполнялась (порты заняты стендом владельца).

## Задачи и коммиты

| # | Задача | Коммит |
|---|--------|--------|
| 1 | Таблицы `chat_messages` и `chat_actions`, миграции, REVOKE, контракт | 4519cfe |
| 2 | `actions.ts`, `messages.ts`, маршруты, `chat-api.mjs actions` | 5a89d7f |
| 3 | `DATA_CHANGED_CHANNEL` и `refreshReaders` | a7f63b7 |
| 4 | Сообщения, ChatResult, Send, New chat, `chat-web.mjs actions` | 152f44a |

`commits: 4` измерено `git rev-list --count ad3f76b..152f44a`. `actuals.tokens` — символы `git log ad3f76b..HEAD -p` без `snapshot.json` / 4 (128748 / 4); снимки drizzle исключены, с ними число в разы больше.

## Миграции

- `packages/db/drizzle/20261013135713_chat_messages_actions` — `yarn db:generate --name chat_messages_actions`.
- `packages/db/drizzle/20261013135720_chat_messages_actions_revoke_delete` — `drizzle-kit generate --custom`, одна инструкция `REVOKE DELETE, TRUNCATE ON "chat_messages", "chat_actions" FROM "dvlab_app";`.
- Повторный `yarn db:generate`: «No schema changes». Применены к `dvlab_test` (23 миграции) и `dvlab_dev` (26) способом 22-03: `env -u DATABASE_URL -u MIGRATOR_DATABASE_URL node --env-file=<.env.test|.env> apps/api/src/migrate.ts`. `has_table_privilege` на обеих базах: DELETE и TRUNCATE `false`, INSERT и UPDATE `true`.

## Что построено

- `sendMessage(db, context, conversationId, input)`: транзакция, `lockConversation` (удалённый или чужой — 404), `findRequest` по `(account_id, request_id)`; затем сообщение учителя, `respond` и ответ ассистента с `reply_to`, `touchConversation` (растёт `updated_at`). `respond`: `validateMentions` (`stale` -> `refused mention_stale`, P08) -> `parseNoteCommand` (`/note @ученик текст`, раздел `general_info`, текст через `appendStudentNoteRequest`) -> `parseQuickCommand(text, bindings, now, defaultTimeZone)` (нет формы -> `refused model_unavailable`, P20) -> `executeLocalAction`. Гонка двух вставок одного `requestId` ловится `violatesUnique` и отвечает исходными сообщениями или 409.
- `executeLocalAction(tx, context, { conversationId, messageId }, request)`: `cancel`/`move` -> `out_of_phase`; иначе `resolveLessonTarget` с тем же `now`; `clarify` -> блок с вариантами и готовым ответом каждого («was at the lesson 2026-10-12 15:00», «didn't come …», «didn't happen …»); `refused` -> блок с кодом; `done`/`no_show` -> `writeMark(sp, …, { kind, expectedStartsAt: lesson.startsAt, expectedRevision: lesson.markRevision })` в savepoint, `before` и `after` с ревизиями в строке действия, в блоке `effect` (`markEffect` из core) и `lessonMinutes` карточки; `comment` -> `appendLessonComment` (тело обязательно, `appendLessonCommentRequest`), `not_started` -> `lesson_not_started` с временем урока; `note` -> `appendStudentNote`. Ошибка владельца (`changed`, `not_found`, `not_started`) — `refused` (`lesson_changed`, `not_found`, `lesson_not_started`) и строка действия `refused`.
- `undoAction(db, context, actionId, { requestId })`: строка действия `FOR UPDATE` по `account_id`; если попытка уже была — сохранённый исход; иначе в savepoint `writeMark(kind = before?.kind ?? 'none', expectedRevision = after.revision)` или `retractStudentNote`/`retractLessonComment(after.entryId, after.revision)`; успех -> `state = 'undone'`, `undo_result { undo: 'done' }`; несовпадение -> `undo_result { undo: 'stale' }`, данные не меняются. Блок для ответа берётся из ответа ассистента (`reply_to = chat_actions.message_id`).
- `chat_actions.target/before/after` содержат только ключ урока, время, вид и ревизию отметки, id и ревизию записи; текста ученика там нет (проверено).
- web `api-client.ts`: после успешного не-GET запроса вне `UNCHANGED_PATHS` и вне входа/выхода — `API_CACHE_INVALIDATED` в своей вкладке и `postMessage('changed')` в `dvlab:data-changed`. `CalendarCommandProvider`: `refreshReaders()` вызывает читателей `projection`, затем `window`, ошибки гасятся; видимая вкладка перечитывает сразу, скрытая — при `visibilitychange`.
- web `/chat`: New chat -> `select(null)`, очистка черновика и фокус без `POST`; Send без выбранного разговора -> `POST /chat/conversations` (разговор сразу выбран, лента засеяна пустой), затем `POST …/messages`; `requestId` один на черновик и разговор, повтор после сбоя уходит с тем же, черновик очищается только после ответа; Send и Enter выключены при пустом, устаревшем (P08) черновике и во время отправки. Лента: сообщение учителя справа (`active`, `radius-2xl`, 80%, имя ученика 600, время под ним), ответ без пузыря, блоки по `chatBlock`; прокрутка вниз только если пользователь внизу; загрузка — скелетоны, сбой чтения — `ReadError` с Refresh. ChatResult: предложение P10, строка «<имя>, <время в главной зоне> (<вторая зона>). <помощник LessonMark>.», текст заметки или комментария после линии, Undo (`Undo: Lesson marked Done`), «Undoing…» со спиннером, «Change undone.» со строкой «… is back to Scheduled.» / «The comment is removed.» / «The note is removed.», P11 при `stale`; после Undo фокус на блоке. Вопрос P09: до пяти строк-кнопок, выбор подставляет «@имя <ответ>» с привязкой в черновик и ничего не отправляет; «What date and time do you mean?» + «Answer in the message box.». Отказы — Banner `info`/`warning` с текстами ChatNotices.

## Дизайн

Версия `~/dv-lab-design`: v67. Precondition задачи 4 (DR-22-02 отвечен) выполнен: PLAN-INDEX строка 97 и README ChatResult («It replaces the old change card in phase 22»). Построено по README ChatMessage, ChatResult, ChatNotices, ChatComposer (кнопка Send — `primary icon-compact`, круглая, стрелка вверх, справа в нижнем ряду), ChatPage (разговор создаётся первым сообщением), TimePair (строка в предложении — `mainWhen`).

## Проверки

Выполнено:

- `yarn db:generate` после миграций: «No schema changes». `yarn workspace @dv-lab/db|contracts|api|web typecheck` и `yarn workspace @dv-lab/web lint`: код выхода 0. `yarn prettier --write` по файлам плана.
- `node scripts/dev-checks/chat-api.mjs actions` (`dvlab_test`, порт 4224): `CHAT_ACTIONS_OK`, 41 PASS, 0 FAIL, три прогона. Покрыто: «was <дата>» -> Done, ревизия 1, одна строка `chat_actions`, блок с `before none`, `deducts 60`, зоной учителя; разговор поднялся наверх; повтор того же `requestId` -> 200, те же id, ревизия и число действий не изменились; тот же `requestId` с другим текстом и в другом разговоре -> 409; Undo -> `none`, ревизия 2, остаток вернулся, повторный Undo с тем же и с новым `requestId` ничего не меняет, чтение разговора показывает `done`; второй Done из чата -> ревизия 3, затем No-show и Done маршрутом Schedule -> Undo `stale`, отметка `done`/5, чтение показывает `stale`; `/note @<имя> <текст>` -> запись `general_info`, две заметки с одним текстом, Undo отзывает только свою (ревизия 2), вторая цела; комментарий через `executeLocalAction` к начавшемуся уроку и его Undo, к уроку завтра — не результат и без записи; «moved to tomorrow 18:00» и «didn't happen <дата>» -> `out_of_phase`; свободный текст с упоминанием и без -> `model_unavailable`; привязка к неизвестному ученику -> `mention_stale`; счётчики таблиц вне `chat_*` после отказов не изменились; два урока в дне -> `clarify which_lesson` с двумя вариантами, ответ варианта 15:00 ставит No-show своему уроку; остаток 360 -> 300 -> 360 -> 300 -> 240; 400 на пустой текст, пробелы, NUL, 20001 символ, без `requestId`, лишний ключ, 21 привязку; 20000 символов сохраняются целиком; 404 на неизвестный и удалённый разговор; Undo неизвестного действия 404, вопроса 409; у роли приложения DELETE и TRUNCATE на `chat_messages` и `chat_actions` дают 42501; в строках действий нет текста ученика; в логе api нет текста сообщений и имени. Фикстуры удалены (в `dvlab_test` 0 разговоров, сообщений, действий и карточек `Alex Example 22%`).
- `chat-api.mjs records` (`CHAT_RECORDS_OK`, обход ролей включает два новых маршрута), `conversations` (`CHAT_CONVERSATIONS_OK`), `notes` (`CHAT_NOTES_OK`), `comments` (`CHAT_COMMENTS_OK`) после правок общих частей скрипта зелёные.
- Критерии приёмки: `grep -rn "chat/" apps/api/src/schedule apps/api/src/cards` пусто; `grep -n "dvlab:data-changed" apps/web/lib/api-client.ts` находит канал, сообщение — строка `'changed'`; `refreshReaders` в контроллере и в слушателе канала; `chatBlock` — `discriminatedUnion('type', …)` из `strictObject`.
- `node --check scripts/dev-checks/chat-web.mjs`, без аргументов печатает usage с разделом `actions`.

Не выполнено, по распоряжению ведущей сессии (порты 3000 и 4000 заняты стендом владельца из этого же worktree, его не останавливали):

- `node scripts/dev-checks/chat-web.mjs actions light` и `dark`. Раздел написан, ни разу не исполнялся. Скрипт входит dev-учителем, создаёт в `dvlab_dev` карточку `Alex Example 2218` с начальным балансом и уроком 20 минут назад, открывает Today во второй вкладке того же контекста, выбирает ученика из списка и кнопку Was, первый `POST …/messages` перехватывает с 500, затем повтор, Undo, перезагрузка; удаляет действия, сообщения, разговор и карточку. Вероятные места падения при первом запуске: обе вкладки headless могут сообщать `visible` или наоборот (добавлен `bringToFront`), glob `**/api/chat/conversations/*/messages` в `page.route`, имя кнопки `Undo: Lesson marked Done` (на 1280px видна одна из двух кнопок), ожидание `GET /api/today` во второй вкладке.
- `chat-web.mjs conversations` (переписан `readNewConversation`: New chat без `POST`, первое сообщение создаёт разговор) и `chat-web.mjs composer` (проверка «Enter без списка ничего не делает» заменена: Send включён с командой; при сломанной привязке Send выключен и Enter ничего не шлёт) — не исполнялись.
- `node scripts/dev-checks/wait-dev.mjs down` (стенд владельца не трогали).
- Ручная проверка `/chat` в браузере в обеих темах не выполнялась: вид сообщений, ChatResult, вопросов, отказов, кнопки Send и обновления Today не сверены со скриншотами. Для UI это значит «не проверено». Нужна запись `unrun-verify` в `.planning/WINDOWS.md` ведущей сессией.
- `yarn build`, `yarn test`, `yarn install` не запускались по распоряжению.

## Deviations from Plan

**1. [Rule 3] Файлы вне `files_modified`.** `apps/api/src/chat/conversations.ts` (экспорт `lockConversation`, новый `touchConversation`), `apps/api/src/chat/quick-command.ts` (`parseNoteCommand`: `parseQuickCommand` не разбирает `/note`, а у `chatLessonIntent` нет тела), `composer.tsx` (кнопка Send, Enter отправляет), `chat-screen.tsx` (лента, отправка, New chat -> `select(null)`, баннер сбоя отправки вместо баннера создания), `scripts/dev-checks/README.md`. Других web-планов в волне 9 нет.

**2. Схема шире плана.** `chat_messages.reply_to` (ссылка на сообщение учителя, `restrict`, индекс) — находит ответ при повторе `requestId` и блок действия при Undo; `created_at DEFAULT clock_timestamp()` — порядок сообщений одной транзакции. Уникальность колонок календаря и Undo сделана `uniqueIndex` (как принято в схемах проекта), а не `.unique()`.

**3. Контракт шире плана.** `action_result`: `mark`, `before`, `studentName`, `effect` (`chatMarkEffect`), `lessonMinutes`, `text` — нужны строке ChatResult (имя, время, помощник LessonMark, текст записи); `clarify`: `studentId`, `studentName`, у варианта `reply`; `refused`: `kind` (добавлен в коммите задачи 4 вместе с правкой `actions.ts`, чтобы различить текст `lesson_not_started` для отметки и комментария); `chatConversationReadResponse`; `sendMessageResponse` несёт `conversation`; в `chatRefusalCode` входят все коды резолвера 22-08 (с `calendar_unavailable` и `command_pending`) и `lesson_changed`.

**4. Сохранённый результат без строки действия.** `cancel`/`move` (P12), `mention_stale` и `model_unavailable` не пишут `chat_actions`: результатом служит блок в сохранённом ответе. Вопрос и отказы резолвера и владельца пишут строку `refused`.

**5. Комментарий проверен прямым вызовом.** Быстрой формы комментария нет ни в плане 22-08, ни в ChatComposer (четыре кнопки и пять команд), поэтому `chat-api.mjs actions` вызывает `executeLocalAction` с намерением `comment` и сам пишет сообщение учителя и ответ с блоком (как будет делать 22-13). «Комментарий будущему уроку» даёт вопрос, а не `lesson_not_started`: будущие уроки дня приходят только из проекции календаря, локальный будущий урок `readLessonDay` не видит; `lesson_not_started` резолвера для комментария покрыт `CHAT_TARGET_OK` (22-08), блок передаёт код без изменений.

**6. Применение миграций** обходом `migrate.ts`, а не `schedule-db.mjs migrate` (распоряжение ведущей сессии).

**7. [Rule 3] Общие части проверок.** `chat-api.mjs`: `removeChats` удаляет `chat_actions`, затем ответы и сообщения, затем разговоры; раздел `conversations` в начале чистит так же (раньше `delete from chat_conversations` упал бы на внешнем ключе). `chat-web.mjs removeConversations` — так же.

**8. Самодельные строки и решения вида (EXECUTOR-RULES 8, вопрос Design dude).**
- «Could not send the message. Try again.» — сбой Send (баннер над композером).
- «Could not find this lesson. Nothing was changed.» — `not_found` для отметки и комментария; для заметки — P08.
- `lesson_not_started` для отметки — существующая строка приложения «You can mark a lesson once it has started.»; `calendar_unavailable` — предложение `provider_unavailable` из CalendarReadNotice; `command_pending` без кнопки Check status; `connection_required` — кнопка Connect Google Calendar ведёт на `/settings`; `budget_*`, `credits_unavailable`, `provider_unavailable` — тексты P20 (уточнят 22-12/22-13).
- `aria-label="Loading messages"` у скелетона ленты; сбой чтения разговора — `ReadError` («Could not load this conversation»).
- Отказы нарисованы готовым `Banner` варианта A (тон 14%, без `shadow-2`), а не панелью ChatNotices (12% поверх `surface-3`).
- Время сообщения учителя — `conversationTime` в зоне браузера (как строки списка 22-05).

## Known Stubs

- Нижний ряд композера: только Send; чипы модели и effort — 22-12/22-14.
- Приветствие New chat без кнопок-подсказок (README ChatPage) — только «What do you want to ask?».
- «Empty chat» в строках списка разговоров не меняется (предпросмотр — 22-12).
- `clarifyReply` для намерения `comment` даёт «<дата> <время>», которое `parseQuickCommand` не разбирает; достижимо только путём модели (22-13).
- Состояние Undo при чтении не сверяется с текущей ревизией: Undo остаётся `available`, пока попытка не вернула `stale`.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: data-at-rest | packages/db/src/chat-schema.ts | `chat_messages.body`, `mentions` и `blocks` хранят имена учеников и текст заметок и комментариев. Удаление разговора (22-16, T-22-11) должно вычищать все три поля. |

## Для следующих планов

- 22-13: `undoAction` ищет блок в ответе ассистента с `reply_to = chat_actions.message_id`; путь модели должен сохранить блок `action_result` в `blocks` этого ответа, иначе Undo отвечает 409. `executeLocalAction(tx, context, { conversationId, messageId }, { kind: 'lesson', intent, body? } | { kind: 'note', studentId, body })` — общий исполнитель; тело комментария обязательно и проходит `appendLessonCommentRequest`, тело заметки — `appendStudentNoteRequest` до вызова. Ветка свободного текста в `respond` (`model_unavailable`) заменяется вызовом модели.
- 22-10: колонки `calendar_request_id`, `undo_calendar_request_id`, состояния `proposed`/`submitted` есть и не используются; `undoAction` отвергает `kind = 'calendar'`; ветка `cancel`/`move` в `executeLocalAction` сейчас отвечает `out_of_phase`.
- 22-12/22-14: коды `budget_*`, `credits_unavailable`, `provider_unavailable` объявлены в `chatRefusalCode`, тексты в `messages.tsx` временные (P20).
- 22-16: удаление разговора должно учитывать `chat_messages` (`body`, `mentions`, `blocks`, `redacted_at`) и `chat_actions`; `listMessages` уже скрывает строки с `redacted_at`.
- Проверки: в `dvlab_test` чистить `chat_actions`, затем `chat_messages` (сначала с `reply_to`), затем `chat_conversations`, до удаления карточек (`removeChats` в `chat-api.mjs`, `removeConversations` в `chat-web.mjs`).

## Self-Check: PASSED

Файлы найдены: оба каталога миграций (`migration.sql`, `snapshot.json`), `apps/api/src/chat/actions.ts`, `apps/api/src/chat/messages.ts`, `apps/web/app/(app)/chat/_components/messages.tsx`, `action-result.tsx`. Коммиты 4519cfe, 5a89d7f, a7f63b7, 152f44a есть в ветке (`git rev-list --count ad3f76b..152f44a` = 4). Рабочее дерево чисто по файлам плана (остался только `apps/web/next.config.ts` владельца), `apps/web/AGENTS.md` нет, порт 4224 свободен, процессов не оставлено.
