---
phase: 22-chat-with-mentions-and-quick-marks
plan: '13'
status: complete
verification: partial
subsystem: db-api-web
tags: [chat, anthropic-sdk, messages-api, streaming, sse, tools, publish-gate, budget, stop-reply]

requires:
  - phase: 22-09
    provides: 'chat_messages с reply_to, chat_actions, executeLocalAction, undoAction (блок ищется в ответе с reply_to)'
  - phase: 22-10
    provides: 'proposeCalendarChange через executeLocalAction, блок calendar_proposal в ответе с reply_to'
  - phase: 22-11
    provides: '@anthropic-ai/sdk 0.133.0, config.chat, resolveModelChoice, modelCapabilities, selectionAllowed, readAssistantSettings'
  - phase: 22-12
    provides: 'reserveAttempt, markDispatched, settleAttempt, markUnknown, release'
provides:
  - 'db: chat_turns (state, model, effort, issue, requests, seq; один активный ход на разговор частичным уникальным индексом; один ход на сообщение учителя), chat_usage_attempts.turn_id, REVOKE DELETE, TRUNCATE у dvlab_app'
  - 'contracts/chat.ts: chatTurn, chatTurnResponse, chatStreamEvent (snapshot, text, block, state, heartbeat), блоки withheld, stopped, interrupted, код отказа model_refused, turn в sendMessageResponse и chatConversationReadResponse'
  - 'api chat/provider.ts: createChatProvider({ apiKey }) — stream(request, signal) поверх messages.stream с maxRetries 0, availability(modelId) через models.retrieve с кэшем на час, ProviderFault'
  - 'api chat/publish-gate.ts: checkSentence, sentenceSplitter'
  - 'api chat/tools.ts: CHAT_TOOLS (восемь инструментов, strict), runTool; записи только через executeIntent'
  - 'api chat/turns.ts: toTurn, readTurn, activeTurn, turnOfMessage, insertTurn'
  - 'api chat/runs.ts: createChat({ db, logger, provider, calendarCommands }) — admit, startTurn, stopTurn, subscribe, sweepInterrupted, close; turnSnapshot, inputUpperBound'
  - 'api chat/actions.ts: executeIntent(executor, context, source, request, persist?) — общий путь быстрых форм и инструментов; sendMessage(..., turns) запускает ход для свободного текста, 409 busy при активном ходе'
  - 'api routes/chat.ts: GET /chat/turns/:id, POST /chat/turns/:id/stop, GET /chat/turns/:id/stream (SSE)'
  - 'api routes/settings.ts: settingsRoutes({ db, availability? }); AppDeps.chat вместо chatEnabled; server.ts собирает чат при config.chat.enabled'
  - 'web: apiEventStream в api-client.ts; поток, Stop reply и Check status в use-chat.ts; состояния ответа в messages.tsx; Stop reply в composer.tsx'
  - 'scripts/dev-checks: chat-api.mjs runs -> chat-runs.mjs (CHAT_RUNS_OK), chat-fake-anthropic.mjs (preload), chat-web.mjs stream (не исполнялся), проверки Enter в chat-web.mjs composer (не исполнялись)'
affects: [22-14, 22-15, 22-16, 22-17]

actuals:
  tokens: 44238
  tasks: 4
  commits: 5
plan_head_before: 65b7ea38da609e79e666ce1e87a8bdfb030d06b5
plan_head_after: 8b8d4146711635f9650dc4f512ae89907bc9cd26

tech-stack:
  added: []
  patterns:
    - 'Ход модели — строка chat_turns; цикл в процессе api, состояние и каждое опубликованное событие сначала в базе (тело ответа или blocks плюс seq хода в одной транзакции), потом подписчикам'
    - 'Поток на ход: подписка на живые события до чтения снимка, снимок отдаёт seq, события с seq не больше снимка отбрасываются и на сервере, и в браузере'
    - 'Резерв бюджета на каждый запрос с turn_id в той же транзакции, что и счётчик requests хода; отказ после резерва до сети — release, обрыв без usage — markUnknown'
    - 'Инструменты записи идут через executeIntent: эффект, строка chat_actions и блок в ответе ассистента (reply_to = сообщение учителя) одной транзакцией'

key-files:
  created:
    - packages/db/drizzle/20261013163655_chat_turns/migration.sql
    - packages/db/drizzle/20261013163655_chat_turns/snapshot.json
    - packages/db/drizzle/20261013163659_chat_turns_revoke_delete/migration.sql
    - packages/db/drizzle/20261013163659_chat_turns_revoke_delete/snapshot.json
    - apps/api/src/chat/provider.ts
    - apps/api/src/chat/tools.ts
    - apps/api/src/chat/publish-gate.ts
    - apps/api/src/chat/turns.ts
    - apps/api/src/chat/runs.ts
    - scripts/dev-checks/chat-runs.mjs
    - scripts/dev-checks/chat-fake-anthropic.mjs
  modified:
    - packages/db/src/chat-schema.ts
    - packages/contracts/src/chat.ts
    - apps/api/src/chat/actions.ts
    - apps/api/src/chat/budget.ts
    - apps/api/src/schedule/comments.ts
    - apps/api/src/auth/middleware.ts
    - apps/api/src/routes/chat.ts
    - apps/api/src/routes/settings.ts
    - apps/api/src/app.ts
    - apps/api/src/server.ts
    - apps/web/lib/api-client.ts
    - apps/web/app/(app)/chat/_components/use-chat.ts
    - apps/web/app/(app)/chat/_components/messages.tsx
    - apps/web/app/(app)/chat/_components/composer.tsx
    - apps/web/app/(app)/chat/_components/chat-screen.tsx
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-web.mjs
    - scripts/dev-checks/README.md
    - knip.json

key-decisions:
  - 'Любая отправка в разговор с активным ходом (и быстрая форма тоже) отвечает 409 busy и ничего не сохраняет'
  - 'Блок withheld добавляется, если удержано хотя бы одно предложение; опубликованные предложения остаются над ним'
  - 'HTTP-ошибка провайдера до message_start (например billing_error) рассчитывает попытку с нулевым usage; обрыв после начала потока и ошибка соединения оставляют попытку unknown'
  - 'Обрезка истории за ход только растёт: число отброшенных старых сообщений не уменьшается между запросами одного хода'
  - 'Доступность модели для меню настроек и допуска хода — provider.availability (Models API, кэш на час); без ключа все модели недоступны'

requirements-completed: [CHAT-01, CHAT-09, CHAT-11, CHAT-04]

duration: ~3.5h
completed: 2026-10-14
---

# Phase 22 Plan 13: Ответы модели — цикл Messages, поток, Stop Summary

Свободный вопрос в /chat теперь запускает ход модели через официальный SDK (`maxRetries: 0`, резерв бюджета перед каждым запросом, включая продолжение после инструментов); ответ публикуется проверенными предложениями через SSE-поток хода, переживает перезагрузку без нового запроса, останавливается кнопкой Stop reply, а инструменты записи идут тем же исполнителем, что быстрые формы, с квитанцией и Undo. Проверено на заглушке провайдера, к `api.anthropic.com` из проверок не ушло ни одного запроса; браузерные проверки не выполнялись (стенд владельца на 3000 и 4000).

## Задачи и коммиты

| #   | Задача                                                                                       | Коммит  |
| --- | -------------------------------------------------------------------------------------------- | ------- |
| 1   | Таблица ходов, миграции, REVOKE, контракт потока                                             | 202d8c8 |
| 2   | Провайдер, инструменты, проверка публикации, executeIntent                                   | 24a5214 |
| 3   | Бегун ходов, маршруты, сборка сервера, `chat-api.mjs runs`, исключения knip сняты            | 251a0e4 |
| 4   | `apiEventStream`, поток и Stop reply в /chat, Enter в открытом списке, `chat-web.mjs stream` | 9a327d8 |
| —   | Ожидание нового ответа перед Stop reply в `chat-web.mjs stream` (по ревью)                   | 8b8d414 |

`commits: 5` — мои коммиты с `22-13` в сообщении. `git rev-list --count 65b7ea3..8b8d414` = 16: между моими коммитами в ветку легли 11 коммитов параллельной сессии `ui-skeletons`. `actuals.tokens` — символы `git show` моих пяти коммитов без `snapshot.json` / 4 (176950 / 4).

## Миграции

- `packages/db/drizzle/20261013163655_chat_turns` — `yarn db:generate --name chat_turns`: таблица `chat_turns`, колонка `chat_usage_attempts.turn_id` (RESTRICT), индексы `chat_turns_active_uq` (`conversation_id` где `state in ('accepted','running')`), `chat_turns_teacher_message_uq`, `chat_turns_state_idx`, `chat_usage_attempts_turn_idx`, CHECK состояний, `requests >= 0`, `seq >= 0`.
- `packages/db/drizzle/20261013163659_chat_turns_revoke_delete` — `drizzle-kit generate --custom`, одна инструкция `REVOKE DELETE, TRUNCATE ON "chat_turns" FROM "dvlab_app";`.
- Повторный `yarn db:generate`: «No schema changes». Применены до правки маршрутов к `dvlab_test` (27 миграций) и `dvlab_dev` (30) командой `env -u DATABASE_URL -u MIGRATOR_DATABASE_URL node --env-file=<.env.test|.env> apps/api/src/migrate.ts`. `has_table_privilege('dvlab_app', 'chat_turns', …)` на обеих базах: DELETE и TRUNCATE `false`, INSERT и UPDATE `true`.

## Что построено

- **Провайдер.** `createChatProvider({ apiKey })`: `new Anthropic({ apiKey, maxRetries: 0 })`; `stream` вызывает `client.messages.stream({ model, max_tokens: maxOutputTokens, output_config: { effort }, cache_control: { type: 'ephemeral' }, system, tools, tool_choice: { type: 'auto' }, messages }, { signal })`, отдаёт дельты текста, конец текстового блока и `finalMessage()`. Ошибки: `billing_error` или 402 — `credits_unavailable`; `NotFoundError`/`PermissionDeniedError` — `model_unavailable`; прочее — `provider_unavailable`; `APIUserAbortError` — прерывание. `availability` — `models.retrieve` (модель `retired` недоступна), ответ 404/403 и успех кэшируются на час, сетевой сбой не кэшируется. Встроенных инструментов сервера нет. Кэш промпта — только 5 минут (без `ttl`).
- **Проверка публикации.** `sentenceSplitter` режет поток по `.`, `!`, `?` с пробелом после и по переводу строки, хвост отдаётся в конце текстового блока. `checkSentence` удерживает предложение с денежным знаком, со ссылкой (`http`, `www.`), с UUID не из контекста хода, с «пол-часа/урока/минуты» и предложение, где число (цифры `\p{Nd}` или слово: zero…ninety, hundred, thousand, dozen, half, once, twice; ноль…тридцать, сорок…девяносто, сто…тысяча, десяток, полтора, половина, пол, дважды, трижды в падежных формах) стоит не дальше пяти слов от слова учёта (lesson, minute, min, hour, hr, balance, left, remain, pay, paid, debt, owe, dollar, dong, ruble; урок, минут, мин, час…, остат, оплат, плат, долг, долж, рубл, доллар, донг, евро, тенге; коды RUB, USD, VND, KZT, EUR). «Unit 5», «band 6.5», «two exercises» публикуются.
- **Инструменты.** `find_students` (до шести активных по подстроке имени), `student_facts` (`readChatFacts`), `student_notes` (заполненные разделы, записи 22-06 и комментарии 22-07 новейшими первыми), `lessons` (`readWindow` за диапазон до 31 дня, по ученику или всем); запись: `mark_lesson`, `add_note`, `add_comment`, `propose_lesson_change` → `executeIntent`. Схемы `strict: true`, все поля обязательные, необязательные — `null`; аргументы проверяются zod до исполнения, ошибка — `tool_result` с `is_error: true` и кодом (`invalid_arguments`, `unknown_tool`, `student_not_found`, `range_too_long`, `tool_failed`). Каждый результат: не больше 30 записей и 8000 символов, текст поля до 2000, новые первыми, обрезанный несёт `truncated: true`. Аккаунт — из хода, не из аргументов. Квитанция модели: `saved`, `needs_clarification` с вариантами, `proposed` («Nothing has changed yet…»), `refused` с кодом.
- **executeIntent.** Вынесен из `sendMessage`: `executor.transaction` (savepoint внутри отправки, настоящая транзакция у инструментов) с `executeLocalAction` и необязательным `persist(tx, block)`. Быстрые формы зовут его из `respond`; инструменты передают `persist`, который дописывает блок в ответ ассистента (`reply_to` = сообщение учителя) и поднимает `seq` хода в той же транзакции. Поэтому Undo блока `action_result` и confirm/check/undo блока `calendar_proposal` находят блок (требование ведущей сессии 4, проверено Undo модельной отметки = 200).
- **Отправка.** `sendMessage(db, context, conversationId, input, turns)`: до транзакции, если текст не быстрая форма, `turns.admit` — `resolveModelChoice(readAssistantSettings, переопределение разговора)`, `modelCapabilities(settings, provider.availability)`, `selectionAllowed`; иначе `refused model_unavailable`. В транзакции: блокировка разговора, повтор `requestId`, активный ход — `busy`, сообщение учителя, ответ ассистента с пустым телом, строка `chat_turns` `accepted`; запуск цикла только после коммита. Нарушение `chat_turns_active_uq` в гонке — 409 `busy`. Без ключа (`chat` не собран) — прежний `refused model_unavailable`.
- **Бегун.** `createChat`: `accepted → running` условным UPDATE; контекст — системная инструкция (роль, язык учителя, без чисел учёта в тексте, текст записей — данные, записи только по явной просьбе, предложение переноса ждёт Confirm), прошлые сообщения разговора текстом (блоки — короткими пометками), текущее сообщение с поясом учителя, «сейчас» и упомянутыми учениками. До шести запросов на ход. Перед каждым: `inputUpperBound` = байты UTF-8 `JSON.stringify({ system, tools, messages })`; больше `maxInputTokens` — отбрасываются старейшие сообщения прошлых ходов целиком (первым остаётся сообщение учителя), не помещается — `refused budget_insufficient`, ход `completed`, ни запроса, ни попытки. Затем `reserveAttempt(..., turnId)` и `requests + 1` одной транзакцией; отказ бюджета — блок `refused` с кодом; Stop или остановка процесса после резерва — `release`; `markDispatched`; поток; `settleAttempt` по `usage`; обрыв — `markUnknown`; HTTP-ошибка до `message_start` — расчёт нулевым usage. `tool_use` — инструменты по очереди (после Stop остальные не исполняются), все `tool_result` одним сообщением пользователя, ответ модели целиком (с блоками thinking) — в шаги хода. `refusal` — `refused model_refused`; `end_turn`/`max_tokens` — `completed` (`max_tokens` в `issue`); шесть запросов без конца — `completed`, `request_limit`. Удержанное предложение — блок `withheld` в конце; пустой ответ без блоков — тоже `withheld`.
- **Stop, восстановление.** `stopTurn` ставит флаг, прерывает запрос (`AbortSignal`) и ждёт конца цикла: ход `stopped`, блок `stopped`, попытка в полёте `unknown`, записанные эффекты остаются. Хода нет в памяти — помечается `stopped` условным UPDATE. `sweepInterrupted` при старте (до `serve`): `accepted`/`running` (кроме своих) → `interrupted` с блоком `interrupted`, их попытки `reserved` → `release`, `dispatched` → `markUnknown`; попытки без `turn_id` не трогаются. `close` прерывает ходы, они кончаются `interrupted`; ресурс `chat` стоит в `lifecycle.manage` перед ресурсами календаря и `pg-pool`. Логи: id хода, разговора и попытки, модель, уровень, `turnState`, `issue`, причина остановки, токены; без текста (поле `state` вырезает redact логгера, поэтому `turnState`).
- **Маршруты.** Под общей проверкой `requireSession` и `requireRole('teacher')`: `GET /chat/turns/:id` → `{ turn }`; `POST /chat/turns/:id/stop` (пустое тело) → `{ turn }`; `GET /chat/turns/:id/stream` — 404 на чужой и неизвестный ход до открытия потока, затем SSE: подписка, снимок (`seq`, ход, сообщение ответа с наложением Undo), живые события с `seq` больше снимка, `heartbeat` раз в 15 с с перепроверкой сессии, закрытие при конечном состоянии, выходе сессии, обрыве или если хода нет в памяти. `Cache-Control: no-store, no-transform`. `GET /chat/conversations/:id` отдаёт активный ход, ответ Send — ход сообщения.
- **Web.** `apiEventStream(path, { signal, schema, onEvent })` в `api-client.ts`: тот же префикс `/api`, `same-origin`, `no-store`, 401 — как `apiRequest`; `ReadableStream` + `TextDecoder` с `stream: true`, кадры `data:` до пустой строки, каждое событие через `chatStreamEvent`, неверное — поток закрывается, событие не применяется. `POST /chat/turns/:id/stop` не рассылает `dvlab:data-changed`. `use-chat.ts`: после Send с ходом и при открытии разговора с активным ходом — поток; события по `seq`; блок `action_result` из потока — `announceChange` и `calendar.store.refresh()`; конец хода — поток закрыт; обрыв — переподключение раз в секунду, после пяти пустых попыток перечитывается разговор; Stop reply — `POST …/stop`, кнопка занята до ответа; Check status — перечитать разговор и ход, без отправки. `messages.tsx`: до первого текста «Reading student records…» (спиннер, `role="status"`), текст с кареткой 2px, «Stopping reply…», `aria-busy` на ответе во время хода; блоки «Reply stopped.», withheld (`warning`, Ask another question — фокус в поле), interrupted (`warning`, Check status). `composer.tsx`: во время ответа поле выключено с подсказкой «Wait for the reply, or stop it», быстрые кнопки скрыты, вместо Send — Stop reply (secondary compact, круглая, иконка Square), затем «Stopping reply…».
- **Enter в открытом списке (решение владельца 2026-10-13).** Ветка `open && Enter` уже ничего не отправляла, но при загрузке строк учеников список скрывался для имени с пробелом (`hidesEmpty` считал пустой ещё не загруженный список «нет совпадений»), и Enter отправлял сообщение. Теперь `hidesEmpty` действует только при загруженных строках: пока список открыт (загрузка, ошибка, «No students found»), Enter ничего не шлёт. В `chat-web.mjs composer` добавлены две проверки (пустой список «@Zzzz» и задержка `/students/options` 4 с с «@Alex Ex»).

## Дизайн

Версия `~/dv-lab-design` на исполнении: v68 (план писался под v64). Precondition задачи 4 (DR-22-02 отвечен) выполнен: PLAN-INDEX строка 97, README и превью ChatMessage («Working, stopped, interrupted, withheld») и ChatComposer («A reply is coming…»). Строки взяты из README и превью дословно: «Reading student records…», «Stopping reply…», «Reply stopped.», «This reply was interrupted. Check its status before sending again.», Check status, «Could not verify this answer from the available records.», Ask another question, Stop reply, «Wait for the reply, or stop it». Не построено в этом плане: смена строки на «Checking the calendar…», блок фактов из `student_facts` (22-14), Suggestions, чипы модели и уровня (22-15).

## Проверки

Выполнено:

- `yarn db:generate` дважды (второй «No schema changes»), `git status --porcelain packages/db/drizzle` — только два каталога плана. `yarn workspace @dv-lab/db|contracts|api|web typecheck`, `yarn workspace @dv-lab/web lint`: код 0. `prettier --check` по файлам плана: чисто.
- `node scripts/dev-checks/chat-api.mjs runs` (`dvlab_test`, api в процессе на 4226): `CHAT_RUNS_OK`, 31 PASS, 0 FAIL, четыре прогона (последний после всех коммитов кода). Покрыто всё из задачи 3 плана, плюс: настоящий `createChatProvider` через SDK против `chat-fake-anthropic.mjs` (дельты, `tool_use` в финальном сообщении, `billing_error` → `credits_unavailable` с признаком ответа до потока, прерывание, кэш доступности), список инструментов фазы со `strict` и без серверных, запрос с моделью, уровнем и лимитом выхода из настроек, Undo модельной отметки 200 и отметка `none`, 403/401/404 маршрутов хода, повторный Stop, DELETE и TRUNCATE `chat_turns` под `dvlab_app` — 42501, в логе нет текста и имени. Конкретно: «осталось 3 урока» удержано, «Привет.» и «Unit 5» опубликованы, блок `withheld`; две попытки на ход `settled`; предел $0.01 — `budget_insufficient` без вызова заглушки и попытки; `maxInputTokens` 1000 — то же; история из 12 длинных сообщений при пределе «база + 7000» — в запрос не ушли старые, ответ есть; 35 заметок — 30 записей и `truncated: true`; usage 50 000/100 000 — `cost` по факту больше резерва, `spent` периода вырос на него, строка «chat usage cost above reserve»; поток: `no-store, no-transform`, первый кадр снимок, события с большим `seq`, переподключение — тот же текст, вызовов заглушки ровно два; второй вопрос — 409 `busy`, сообщений не прибавилось; Stop — `stopped`, отметка инструмента `done` осталась, попытки `settled` и `unknown`, последний блок `stopped`, новых вызовов нет; `sweepInterrupted` — ход `interrupted`, `reserved` → `released`, `dispatched` → `unknown`, блок `interrupted`; висящий запрос и `sweepInterrupted` из второго экземпляра, затем `close` первого — `interrupted`, попытка `unknown`, один блок `interrupted`, повторного запроса нет. После прогона в `dvlab_test` 0 ходов, разговоров, попыток, периодов и карточек `Alex Example 223%`; настройки ассистента учителя-фикстуры 10.00/100000.
- Регрессия после правок общих частей: `chat-api.mjs records` (`CHAT_RECORDS_OK`, обход ролей включает три новых маршрута), `conversations`, `actions`, `budget`, `notes`, `comments`, `target`, `calendar` — все `_OK`; `node scripts/dev-checks/chat-config.mjs` — `CHAT_CONFIG_OK`.
- Разовая проверка `server.ts` (скрипт во временной папке): api на 4227 с preload `chat-fake-anthropic.mjs`, `.env.test` и ключом-заглушкой — `/settings/assistant` отдаёт модели доступными, свободный вопрос — ход `completed` с текстом, SIGTERM во время висящего хода — «chat turn finished interrupted», «shutdown complete», код выхода 0; фикстуры удалены.
- Критерии приёмки: `grep -rn "maxRetries" apps/api/src/chat/provider.ts` — `maxRetries: 0`; в `tools.ts` нет вставок в бизнес-таблицы, записи только через `executeIntent`; `server.ts` ставит ресурс чата до `pg-pool`; без `ANTHROPIC_API_KEY` api стартует (все `chat-api.mjs` разделы, кроме `runs`, идут через api без ключа), `/chat` отвечает `model_unavailable`; `grep -rn "fetch(" "apps/web/app/(app)/chat"` пусто.
- Требование ведущей сессии 1: из `knip.json` убраны `ignoreIssues` для `model-config.ts` и `ignoreDependencies` для `@anthropic-ai/sdk`; `yarn knip` — код 0, только прежние подсказки конфигурации. `node scripts/hygiene-check.mjs` — clean.
- Требование 3: в проверках ни одного запроса к `api.anthropic.com`: в процессе — заглушка провайдера, через SDK — подмена `fetch` из `chat-fake-anthropic.mjs`, ключ — строка-заглушка; ключ владельца не читался и не использовался.
- После каждой правки `server.ts`/маршрутов api владельца на 4000 отвечал `/healthz` 200.

Не выполнено:

- `node scripts/dev-checks/chat-web.mjs stream light|dark`: раздел поднимает свой `server.ts` на 4000 с preload, а порт занят стендом владельца (его не останавливали). Написан, проверен `node --check` и разбором аргументов. Вероятные места падения при первом запуске: Next dev-прокси `/api/*` может буферизовать SSE (тогда текст появится сразу целиком и проверка роста упадёт), `page.reload()` во время хода и ожидание `REPLY_TEXT` после него, ожидание `SEND` после конца ответа.
- Новые проверки Enter в `chat-web.mjs composer` (пустой список, загрузка): не исполнялись по той же причине; `MentionPopup` в состоянии загрузки рендерит `data-slot="mention-popup"`, ожидание списка должно сработать.
- `node scripts/dev-checks/wait-dev.mjs down` (стенд владельца не трогали).
- Ручная проверка /chat в браузере в обеих темах: рост ответа, каретка, Stop reply, «Reply stopped.», withheld и interrupted не сверены с превью. Для UI это «не проверено». Нужны записи `unrun-verify` в `.planning/WINDOWS.md` ведущей сессией.
- `yarn build`, `yarn test`, `yarn install` — по распоряжению.

## Deviations from Plan

**1. [Rule 3] Файлы вне `files_modified`.** `apps/api/src/chat/turns.ts` (новый: чтение и вставка ходов для `actions.ts`, маршрутов и бегуна); `apps/api/src/chat/budget.ts` (шестой аргумент `turnId` у `reserveAttempt`, по умолчанию `null`); `apps/api/src/auth/middleware.ts` (`noStore` не перезаписывает уже стоящий `no-store`, иначе поток терял `no-transform`); `apps/api/src/schedule/comments.ts` (`listStudentComments` для `student_notes`: у владельца комментариев был только список по уроку); `composer.tsx`, `chat-screen.tsx` (Stop reply, проброс состояния ответа); `scripts/dev-checks/chat-runs.mjs` (новый дочерний скрипт `chat-api.mjs runs`, как `chat-calendar.mjs`); `scripts/dev-checks/README.md`; `knip.json` (требование ведущей сессии). `routes/settings.ts` перенесён из задачи 2 в коммит задачи 3 (вместе с `app.ts`, чтобы стенд владельца не терял доступность моделей между коммитами), `chat-fake-anthropic.mjs` — из задачи 4 в задачу 3 (им проверяется провайдер в `runs`).

**2. Схема шире плана.** `chat_turns.seq` — курсор опубликованных событий (снимок и живые события сверяются по нему); уникальный индекс одного хода на сообщение учителя, индекс по `state` для `sweepInterrupted`, индекс `chat_usage_attempts.turn_id`.

**3. Контракт шире плана.** `chatTurnResponse`, `CHAT_TURN_ISSUES`, `turn` в ответах Send и чтения разговора, код отказа `model_refused` (у Messages API `stop_reason: 'refusal'`, а в перечне кодов чата такого не было).

**4. `withheld` при частичном удержании.** План: блок, когда удержано всё содержательное; дизайн: текст не показывается. Сделано: блок добавляется, если удержано хоть одно предложение, а опубликованные остаются над ним — учитель видит, что часть ответа скрыта, и не принимает неполный текст за полный.

**5. `busy` для любой отправки.** План говорит о втором ходе; во время хода 409 `busy` отвечает и быстрая форма — поле композера в это время всё равно выключено, а один активный ответ на разговор держит порядок сообщений и Undo.

**6. Ошибка провайдера до потока.** HTTP-ответ с ошибкой до `message_start` (кредиты, модель, перегрузка) рассчитывается нулевым usage, а не `unknown`: запрос отклонён до генерации, иначе каждый такой отказ навсегда держал бы резерв в пределе.

**7. `createChat` без `config`.** Сигнатура плана `createChat({ db, config, logger, provider, calendarCommands? })`; конфигурация нужна только провайдеру (`apiKey`), поэтому `config` не передаётся.

**8. [Rule 1] Сравнение `created_at` с микросекундами.** Первый прогон `runs` не находил сообщение учителя: `clock_timestamp()` хранит микросекунды, а `Date` в JS — миллисекунды. История берётся подзапросом `created_at` в SQL.

**9. [Rule 1] Поле лога `state` вырезается redact-конфигом логгера.** В логе хода поле называется `turnState`.

**10. Самодельные строки (EXECUTOR-RULES 8, вопрос Design dude).** «The assistant declined to answer this request.» — отказ модели (`model_refused`), Banner `info`. Строка `budget_insufficient` в чате осталась временной из 22-09 («Not enough budget for this request.»).

## Known Stubs

- Нет строки «Checking the calendar…» во время инструментов: всё время до первого текста — «Reading student records…».
- `student_facts` возвращает факты модели, блока фактов в ответе нет (22-14).
- `inputUpperBound` не учитывает скрытую системную подсказку инструментов, которую добавляет API; накладные расходы JSON её, по всей видимости, покрывают, но это не доказано.
- Если обрезка истории растёт посреди хода (результаты инструментов вытесняют старые сообщения), повторно отправляемый ответ модели с блоками thinking оказывается за изменённым префиксом; у текущих моделей это может дать 400 (preserved thinking). Случается только когда результаты инструментов выталкивают вход за `maxInputTokens`.
- При SIGTERM открытые SSE-соединения держат `server.close()` до половины срока остановки: `chat.close()` идёт после закрытия сервера, и поток кончается только по нему.

## Threat Flags

| Flag                     | File                        | Description                                                                                                                                                                                               |
| ------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| threat_flag: endpoint    | apps/api/src/routes/chat.ts | Новый долгоживущий `GET /chat/turns/:id/stream`: сессия и роль учителя, свой ход, `no-store, no-transform`, перепроверка сессии на каждом heartbeat                                                       |
| threat_flag: data-egress | apps/api/src/chat/tools.ts  | `student_notes`, `lessons`, `find_students` отдают провайдеру тексты записей и список активных учеников (внутри заявленной границы api → Anthropic, ограничено 30 записями и 8000 символами на результат) |

## Для следующих планов

- **Ведущей сессии сегодня.** Api владельца на 4000 перезагрузил `server.ts` с ключом из `.env`: свободный текст в его /chat теперь делает платные запросы Messages API, а `GET /settings/assistant` вызывает Models API этим ключом (кэш на час).
- **22-14:** блок фактов — по результату `student_facts` (сейчас только `tool_result`); удержанные предложения уже считаются, числа в ответе должны прийти блоками кода. `checkSentence` и `sentenceSplitter` — в `chat/publish-gate.ts`.
- **22-15:** `available` в `/settings/assistant` теперь `provider.availability`; переопределения разговора читаются бегуном из `chat_conversations.model_override/effort_override` при каждом Send.
- **22-16:** `chat_turns` ссылается на сообщения (RESTRICT) и у `dvlab_app` нет DELETE: удаление разговора — только пометка и вычистка; разговор с активным ходом удалять нельзя. Порядок уборки в проверках: `chat_actions` → `chat_usage_attempts` → `chat_turns` → `chat_messages` (сначала с `reply_to`) → `chat_conversations` (`removeChats` в `chat-api.mjs` и `chat-runs.mjs`, `removeConversations` в `chat-web.mjs`).
- **22-17:** `chat-api.mjs runs` гонять не параллельно с другими разделами, меняющими настройки ассистента и периоды учителя-фикстуры (`budget`, `chat-config.mjs`); `chat-web.mjs stream light|dark` требует свободного порта 4000 и `next dev` на 3000.

## Self-Check: PASSED

Файлы на месте: `apps/api/src/chat/provider.ts`, `tools.ts`, `publish-gate.ts`, `turns.ts`, `runs.ts`, `scripts/dev-checks/chat-runs.mjs`, `chat-fake-anthropic.mjs`, каталоги `packages/db/drizzle/20261013163655_chat_turns` и `20261013163659_chat_turns_revoke_delete`. Коммиты 202d8c8, 24a5214, 251a0e4, 9a327d8, 8b8d414 есть в ветке. Рабочее дерево чисто по файлам плана (остался только `apps/web/next.config.ts` владельца), `apps/web/AGENTS.md` нет, порты 4226 и 4227 свободны, процессов не оставлено.
