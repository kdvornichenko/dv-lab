# Чат учителя: модуль, инструменты, предложения изменений, команды, ревизия, эссе

## Модуль и маршруты

- Модуль `apps/api/src/chat` владеет чатом учителя, маршруты `/chat` — `apps/api/src/routes/chat.ts`, контракт — `packages/contracts/src/chat.ts` и `chat-settings.ts`. Web-чат — `apps/web/app/(app)/chat`.
- `ANTHROPIC_API_KEY` — ключ модели чата; читает его только `loadConfig`. Без переменной чат работает без модели, пустое значение даёт ошибку запуска. В `.env.test` его нет: проверки чата подменяют Anthropic заглушкой `scripts/dev-checks/chat-fake-anthropic.mjs`.
- Модели, порядок, уровни, тарифы, лимиты запроса и месячный предел — настройки учителя в `teacher_settings`; значения по умолчанию — `CHAT_SETTINGS_DEFAULT` в `packages/contracts/src/chat-settings.ts`.

## Файлы `apps/api/src/chat`

- `facts.ts` — факты карточки, дня и Pays soon для блоков ответа. `balanceEnds` в фактах ученика — урок, на котором остаток доходит до нуля: идёт по запланированным и неотмеченным урокам вперёд на 366 дней, отменённые и перенесённые не считаются; состояния `on` (дата и время), `now` (остатка нет), `beyond` (расписания не хватает). Дату оплаты считает код, модель её не вычисляет. Проверка — `ledger-api.mjs chatends`.
- `conversations.ts` — разговоры (создание, список, переименование, переопределение модели, удаление пометкой со стиранием содержимого).
- `messages.ts` — сообщения, действия и их Undo.
- `mentions.ts` — проверка привязок упоминаний и `typedMentions` (набранное без выбора из списка `@Имя` активной карточки становится привязкой; неоднозначное имя и архивная карточка не привязываются).
- `title.ts` — автоназвание разговора после первого отвеченного хода (`nameConversation`, самая дешёвая модель из настроек, одна попытка бюджета без `turn_id`, применение по ревизии разговора).
- `quick-command.ts` — разбор быстрых форм и `/note`.
- `lesson-target.ts` — выбор урока по упоминанию и дате.
- `actions.ts` — единственный исполнитель записей из чата (`executeIntent`).
- `calendar.ts` — перенос, отмена и возврат урока из чата через `CalendarCommands`.
- `apps/api/src/chat/command-zone.ts` (`resolveCommandZone`) — пояс из текста учителя: без названия пояса — `Asia/Ho_Chi_Minh`, названный пояс должен стоять в сообщении.
- `budget.ts` — периоды и попытки расхода, денежные единицы и формулы (`usdToNano`, `nanoToUsd`, `reserveNano`, `costNano`).
- `model-config.ts` — выбор модели и уровня, проверка выбора (`modelCapabilities`).
- `provider.ts` — Messages API и Models API через SDK.
- `tool-registry.ts` и `tools.ts` — инструменты модели: инструмент — одна запись `chatTool({...})` в `CHAT_TOOL_ENTRIES`, набор strict, пишущие инструменты и набор хода эссе (`ESSAY_TOOLS`) выводятся из записей, режим только для чтения — по объявленному действию (`effect`), инструмент с шагом стоит в `CHAT_STEP_TOOLS` контракта, инструмент со значениями из текста учителя объявлен `cites: true` (реестр сам добавляет поля `source_message` и `replaces` с описаниями и отдаёт их в `run` третьим аргументом `Cited` из `refs.ts`). У API есть предел размера грамматики строгих схем: при новых полях и инструментах — `scripts/dev-checks/chat-tools-schema.mjs` с ключом.
- Необязательные параметры strict-инструмента модель опускает, даже когда значение названо в сообщении (проверено на живых моделях: `paid_on` и `currency` у `propose_payment`; при `strict: false` и при обязательном поле с `null` значение передаётся). В strict-инструменте параметр, который модель должна решить сама, объявляется обязательным с `null` (`nullableString`, `anyOf` с `null` для enum); счёт ограничений strict — `strictBudget`.
- Значения из текста учителя (суммы, числа уроков, ставка, имена, пояс) модель передаёт с `source_message` — id сообщения учителя из строки `[Message m…]` (формат ссылок `m…` и `p…` и маркер — `apps/api/src/chat/refs.ts`). Сервер сверяет значение с текстом этого сообщения и текущего (`teacherText`): сообщение должно быть из этого разговора и не позже текущего, неизвестный id — отказ `source_not_found` с запиской `SOURCE_NOTE` для любой операции. Результаты инструментов, ставка и прошлые чаты источником суммы не служат.
- Ход модели (`runs.ts`): каждое сообщение учителя уходит со своим `[Context]` (Now и Lesson day — время его создания), строкой `[Message m…]` и привязками с полом, одинаково в текущем ходе и в истории, поэтому история между ходами читается из кэша. Точки кэша — конец системной подсказки (`provider.ts`) и конец текущего сообщения учителя, плюс автоматическая на хвосте хода. Прошлые блоки предложений идут в историю со своим `p…` id и значениями оплаты, без состояния; все предложения разговора (`change_proposal` и `calendar_proposal` из уже прочитанных блоков истории) с их текущим состоянием (ждёт, сделано, отклонено, заменено, устарело) — отдельным блоком `[Proposals]` только в текущем сообщении, вне кэшируемого префикса; строку предложения собирает `proposalLine`, состояние — `proposalState`. При превышении `maxInputTokens` (оценка по байтам JSON) история отрезается шагами по 20 сообщений (`DROP_STEP`), чтобы префикс кэша не менялся на каждом ходе. Даты прошлых сообщений учителя известны gate ответа.
- Одинаковое предложение оплаты не создаётся второй раз, если оно из этого же сообщения или всё ещё ждёт подтверждения в разговоре: `alreadyProposed` в `changes.ts` отказывает кодом `already_proposed`; записки к отказам оплаты (`amount_not_in_message`, `source_not_found`, `already_proposed`) — `PAYMENT_REFUSAL_NOTES` в `tools.ts`.
- Поправка заменяет ожидающее предложение только по явной ссылке: модель передаёт в `replaces` `p…` id ожидающего предложения из `[Proposals]`, и `supersede` в `changes.ts` переводит его в `stale` с issue `replaced`, если это ожидающее предложение той же операции в этом разговоре из более раннего сообщения. Новое отдельное предложение (вторая оплата того же ученика, оплата другого ученика) идёт с `replaces` null и ничего не гасит. Массовый перенос и предложения календаря не заменяются. Инструменты `propose_student`, `propose_rate` и `propose_bulk_move` не strict, как остальные пишущие инструменты с необязательными значениями из текста учителя.
- `commands.ts` — команды конструктора: хранение в `chat_commands` (имя после создания не меняется, архив вместо удаления, ревизия), проверка имён (встроенные зарезервированы) и инструментов (`allowedCommandTools`: только `read` и `show`), пределы `strictBudget`; маршруты `/settings/assistant/commands` (список, создание, правка, `archive`, `restore`, `limits`). Ход сохранённой команды — `runs.ts` (`findCommand`, `expandStoredCommand`): текст команды плюс абзац про блоки, набор инструментов команды, схема ответа `output_config.format` из `commandSchema` (ключи `block_N`), JSON разбирается только на `end_turn`, строки блока проходят мягкий gate `checkBlockLine`, один блок `command` на ключ; отказы `command_unavailable`, `command_too_large`, `command_rejected`.
- `chat/prompts.ts` — тексты встроенных команд `/recap` и `/essay` (настройка учителя в `chat_command_prompts`, чтение в ходе — только `readCommandTexts`); маршруты `GET /settings/assistant/prompts` и `PUT /settings/assistant/prompts/:command`.
- `note-writes.ts` и `change-notes.ts` — записи заметок и словаря из чата по правилу «добавление сразу, переписывание и удаление с текстом — через подтверждение».
- `review.ts` — ревизия заметок и словаря командой `/review`.
- `publish-gate.ts` — удержание предложений с числами без источника; `checkBlockLine` — мягкий gate строк блока команды (ссылки и обычные числа проходят, денежный знак и число рядом со словами про баланс, оплату, остаток уроков удерживаются).
- `runs.ts` и `turns.ts` — ходы модели, поток и `sweepInterrupted` при старте.

## Предложения изменений

- Предложения изменений из чата хранятся в `chat_actions` с kind `change`: операция и значения — в `target`, состояние — в `result.kind` (`proposed`, `applied`, `declined`, `stale`, `failed`, `pending`, `partial`).
- Общий порядок предложения, подтверждения, отказа и проверки (`POST /chat/actions/:id/confirm`, `/decline`, `/check`) — `apps/api/src/chat/changes.ts`; состояние блока `change_proposal` при чтении проецирует `changeView` в `messages.ts`.
- Операции: оплата — `changes.ts` (запись через `insertPayment`), новый ученик, ставка и архив — `change-cards.ts`, удаление оплаты и отзыв заметки или комментария — `change-deletions.ts`, переписывание и удаление блоков заметок — `change-notes.ts`, массовый перенос серий — `bulk-move.ts` (дочерние команды `move_series` по одной через журнал команд календаря), конец серии и отказ от предложений календаря — `calendar.ts`.
- Записи идут только через владельцев `cards/` и `schedule/comments.ts` и журнал команд календаря; удаления ученика нет, просьба удалить даёт предложение архива.
- Подтверждение сверяет ревизию цели (карточки, оплаты, заметки или комментария), предложение оплаты — ещё и пояс учителя: изменившаяся цель — `stale`, новое предложение учитель просит новым сообщением.
- Суммы, числа уроков, имена и пояс модель копирует из сообщения учителя: сервер проверяет, что этот текст есть в сообщении (`saidIn`), и разбирает его кодом (`parseMoney`, `parseLessons`).
- Сверка значения из аргументов модели с текстом учителя идёт только по границам числа и слова, не через `includes`: `saidIn` в `apps/api/src/chat/changes.ts` (`has` через `writtenIn`, `hasName`, `hasNumber`) передаётся как `Said` в `apps/api/src/chat/change-cards.ts`, текст суммы и ставки перед разбором нормализует `moneyText` оттуда же, пояс сверяет `wordIn` в `command-zone.ts`.

## Команды и справка

- Список команд чата один: `CHAT_COMMANDS` в `packages/contracts/src/chat.ts` (имя, описание, нужен ли ученик). Из него строятся меню слэша в `composer.tsx`, список нового чата (`COMMAND_ROWS`, `command-list.tsx`) и блок справки; вставка команды в поле — `commandText` в `composer.tsx` (команда с учеником — `/note @` и список учеников, остальные — команда и пробел).
- `/help` (`HELP_COMMAND_TEXT`) отвечает приложение без хода модели (`helpCommand` в `actions.ts`, рядом с `/today`, `/tomorrow`, `/payments`): ответ — один блок `help` без текста, без хода в `chat_turns` и без попытки бюджета.
- Вопрос словами о возможностях: модель вызывает инструмент `show_help` (`effect` `show`, без шага), он кладёт тот же блок `help`; правило в системной подсказке `runs.ts` — текста к блоку не писать.
- Блок `help` хранит только тип: web рисует его по текущему `CHAT_COMMANDS` и разделам в `chat-help.tsx`, поэтому старые блоки в истории показывают актуальный список. Команды в блоке — кнопки, вставляют команду в поле тем же путём, что список нового чата, и выключены (`aria-disabled`), пока в поле есть текст или идёт ответ.

## Инструмент `today`

`today` (`effect` `show`, без шага) читает уроки учебного дня и список Pays soon одним снимком и кладёт два блока (`lessons`, `pays_soon`) тем же чтением, что `/today` и `/payments`; в ходе блоки публикуются сразу оба (`published` в `tool()` — список). Использование usage по попытке — `usageOf` (разбивка записи кэша 5m/1h и thinking-токены), строка лога `chat attempt settled` с `conversationId`, `command`, `requestIndex`; диагностика кэша — переменная `CHAT_CACHE_DIAGNOSTICS=1`.

## Эссе

Отзыв на эссе — `apps/api/src/chat/essay.ts` (инструмент `essay_feedback`, команда `/essay`): ход `/essay` отправляет модели только этот инструмент, записей не делает (`read_only_essay`), в ответе лежит блок `essay`; подпись о приблизительной оценке в web — `apps/web/app/(app)/chat/_components/essay-feedback.tsx`.

## web

Блоки предложений — `change-proposal.tsx`, `calendar-proposal.tsx` и `bulk-move-proposal.tsx` в `apps/web/app/(app)/chat/_components`. Заменённое предложение (`stale` с issue `replaced`) — нейтральный блок «Replaced by the proposal below.» / «Nothing was changed.» без кнопок (ChangeCard, дизайн v132).

## Приёмка

`scripts/dev-checks/`, порядок и живая сессия владельца — `README.md`. Без Google и Anthropic.

- `chat-final.mjs` запускает по очереди `schedule-started`, `schedule-started-series`, `schedule-comments-series`, `mark-revision`, `chat-config`, разделы `chat-api.mjs` (`records`, `conversations`, `notes`, `comments`, `target`, `actions`, `calendar`, `budget`, `runs`, `answers`, `models`, `delete`, `title`), `calendar-reads`, `calendar-final`, `cards-revision`, разделы `chat-changes.mjs` (`payment`, `cards`, `deletions`, `essay`) и `chat-bulk.mjs` (`zone`, `proposal`, `children`).
- Отдельно: `chat-notes.mjs`, `chat-review.mjs`, разделы `chat-api.mjs since|prompts`, `chat-changes.mjs details`, проверки реестра инструментов в `chat-tools-schema.mjs` (с ключом шлёт живой запрос, поэтому в `chat-final.mjs` не входит).
- Живой набор контекста и памяти — `chat-context-eval.mjs [--models haiku,sonnet] [--runs 3] [--only S01,S04] [--label <имя>] [--parallel 4]`: 29 сценариев (ссылки назад, поправки, подтверждения, местоимения, прошлые чаты, провокационные числа, повторы, даты словом; S26–S28 — шаблоны настоящих диалогов) на живых моделях с ключом из `.env`, база `dvlab_test`, порт 4293, карточки `Alex Example 9400`–`9999`. Сценарий проходит, когда ожидающие подтверждения предложения разговора ровно совпадают с ожидаемыми (вид, ученик, сумма, валюта, дата, уроки) и каждый ход завершён в бюджете: не больше 4 запросов, не больше 30 000 входных токенов на запрос, ход не дороже $0.004 на Haiku и $0.06 на Sonnet. Ответы для слепого сравнения — `STATE_DIR/chat-context-eval-<label>-<время>.jsonl`, имена заменены на `<a>`–`<d>`. Печатает таблицу сценариев, расход по моделям и `CHAT_CONTEXT_EVAL_OK`. Полный прогон двух моделей по 3 раза стоит около $5, в `chat-final.mjs` не входит.
- Браузер на dev-стеке: `chat-web.mjs`, `changes-web.mjs`, `entry-web.mjs` и `phone-web.mjs` (`<раздел> light|dark`); разделы `changes-web.mjs facts|details|prompts|notes|review`; справка — `chat-help-web.mjs light|dark`.
