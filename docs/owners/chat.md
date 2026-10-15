# Чат учителя: модуль, инструменты, предложения изменений, команды, ревизия, эссе

## Модуль и маршруты

- Модуль `apps/api/src/chat` владеет чатом учителя, маршруты `/chat` — `apps/api/src/routes/chat.ts`, контракт — `packages/contracts/src/chat.ts` и `chat-settings.ts`. Web-чат — `apps/web/app/(app)/chat`.
- `ANTHROPIC_API_KEY` — ключ модели чата; читает его только `loadConfig`. Без переменной чат работает без модели, пустое значение даёт ошибку запуска. В `.env.test` его нет: проверки чата подменяют Anthropic заглушкой `scripts/dev-checks/chat-fake-anthropic.mjs`.
- Модели, порядок, уровни, тарифы, лимиты запроса и месячный предел — настройки учителя в `teacher_settings`; значения по умолчанию — `CHAT_SETTINGS_DEFAULT` в `packages/contracts/src/chat-settings.ts`.

## Файлы `apps/api/src/chat`

- `facts.ts` — факты карточки, дня и Pays soon для блоков ответа.
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
- `tool-registry.ts` и `tools.ts` — инструменты модели: инструмент — одна запись `chatTool({...})` в `CHAT_TOOL_ENTRIES`, набор strict, пишущие инструменты и набор хода эссе (`ESSAY_TOOLS`) выводятся из записей, режим только для чтения — по объявленному действию (`effect`), инструмент с шагом стоит в `CHAT_STEP_TOOLS` контракта. У API есть предел размера грамматики строгих схем: при новых полях и инструментах — `scripts/dev-checks/chat-tools-schema.mjs` с ключом.
- `chat/prompts.ts` — тексты встроенных команд `/recap` и `/essay` (настройка учителя в `chat_command_prompts`, чтение в ходе — только `readCommandTexts`); маршруты `GET /settings/assistant/prompts` и `PUT /settings/assistant/prompts/:command`.
- `note-writes.ts` и `change-notes.ts` — записи заметок и словаря из чата по правилу «добавление сразу, переписывание и удаление с текстом — через подтверждение».
- `review.ts` — ревизия заметок и словаря командой `/review`.
- `publish-gate.ts` — удержание предложений с числами без источника.
- `runs.ts` и `turns.ts` — ходы модели, поток и `sweepInterrupted` при старте.

## Предложения изменений

- Предложения изменений из чата хранятся в `chat_actions` с kind `change`: операция и значения — в `target`, состояние — в `result.kind` (`proposed`, `applied`, `declined`, `stale`, `failed`, `pending`, `partial`).
- Общий порядок предложения, подтверждения, отказа и проверки (`POST /chat/actions/:id/confirm`, `/decline`, `/check`) — `apps/api/src/chat/changes.ts`; состояние блока `change_proposal` при чтении проецирует `changeView` в `messages.ts`.
- Операции: оплата — `changes.ts` (запись через `insertPayment`), новый ученик, ставка и архив — `change-cards.ts`, удаление оплаты и отзыв заметки или комментария — `change-deletions.ts`, переписывание и удаление блоков заметок — `change-notes.ts`, массовый перенос серий — `bulk-move.ts` (дочерние команды `move_series` по одной через журнал команд календаря), конец серии и отказ от предложений календаря — `calendar.ts`.
- Записи идут только через владельцев `cards/` и `schedule/comments.ts` и журнал команд календаря; удаления ученика нет, просьба удалить даёт предложение архива.
- Подтверждение сверяет ревизию цели (карточки, оплаты, заметки или комментария), предложение оплаты — ещё и пояс учителя: изменившаяся цель — `stale`, новое предложение учитель просит новым сообщением.
- Суммы, числа уроков, имена и пояс модель копирует из сообщения учителя: сервер проверяет, что этот текст есть в сообщении (`saidIn`), и разбирает его кодом (`parseMoney`, `parseLessons`).

## Эссе

Отзыв на эссе — `apps/api/src/chat/essay.ts` (инструмент `essay_feedback`, команда `/essay`): ход `/essay` отправляет модели только этот инструмент, записей не делает (`read_only_essay`), в ответе лежит блок `essay`; подпись о приблизительной оценке в web — `apps/web/app/(app)/chat/_components/essay-feedback.tsx`.

## web

Блоки предложений — `change-proposal.tsx`, `calendar-proposal.tsx` и `bulk-move-proposal.tsx` в `apps/web/app/(app)/chat/_components`.

## Приёмка

`scripts/dev-checks/`, порядок и живая сессия владельца — `README.md`. Без Google и Anthropic.

- `chat-final.mjs` запускает по очереди `schedule-started`, `schedule-started-series`, `schedule-comments-series`, `mark-revision`, `chat-config`, разделы `chat-api.mjs` (`records`, `conversations`, `notes`, `comments`, `target`, `actions`, `calendar`, `budget`, `runs`, `answers`, `models`, `delete`, `title`), `calendar-reads`, `calendar-final`, `cards-revision`, разделы `chat-changes.mjs` (`payment`, `cards`, `deletions`, `essay`) и `chat-bulk.mjs` (`zone`, `proposal`, `children`).
- Отдельно: `chat-notes.mjs`, `chat-review.mjs`, разделы `chat-api.mjs since|prompts`, `chat-changes.mjs details`, проверки реестра инструментов в `chat-tools-schema.mjs` (с ключом шлёт живой запрос, поэтому в `chat-final.mjs` не входит).
- Браузер на dev-стеке: `chat-web.mjs`, `changes-web.mjs`, `entry-web.mjs` и `phone-web.mjs` (`<раздел> light|dark`); разделы `changes-web.mjs facts|details|prompts|notes|review`.
