---
phase: 22-chat-with-mentions-and-quick-marks
plan: '16'
status: complete
verification: partial
subsystem: api-web
tags: [chat, delete-conversation, redaction, privacy, google-calendar-policy]

requires:
  - phase: 22-05
    provides: 'tombstone разговора (deleted_at, название Deleted chat)'
  - phase: 22-13
    provides: 'chat_turns, активные ходы accepted и running, заглушка chat-fake-anthropic.mjs'
  - phase: 22-09
    provides: 'chat_actions, команды календаря с состояниями submitted и undo pending'
provides:
  - 'api: deleteConversation отказывает (409 busy) при идущем ходе и незавершённой команде календаря, иначе стирает содержимое и ставит tombstone в одной транзакции'
  - 'db: ограничение chat_messages_body_ck допускает пустой текст у стёртых сообщений учителя'
  - 'web: P05 в диалоге удаления; разделы Chat assistant и актуальные разделы про Google на /privacy'
  - 'scripts/dev-checks: chat-api.mjs delete (CHAT_DELETE_OK), chat-web.mjs delete (не запускался)'
affects: [22-17]

actuals:
  tokens: 12150
  tasks: 3
  commits: 5
plan_head_before: 24c017a1779af745a68edec42820810d8613a68d
plan_head_after: 790d1ee1feba668a74d85f6c9e412cd26ab22644

key-files:
  created:
    - packages/db/drizzle/20261013181712_chat_messages_redacted_body/migration.sql
    - packages/db/drizzle/20261013181712_chat_messages_redacted_body/snapshot.json
  modified:
    - packages/db/src/chat-schema.ts
    - apps/api/src/chat/conversations.ts
    - apps/api/src/chat/messages.ts
    - apps/api/src/chat/runs.ts
    - apps/api/src/routes/chat.ts
    - apps/web/app/(app)/chat/_components/conversation-dialogs.tsx
    - apps/web/app/(app)/chat/_components/use-chat.ts
    - apps/web/app/privacy/page.tsx
    - e2e/calendar.spec.ts
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-web.mjs

key-decisions:
  - 'Удаление блокируют только активный ход и команда календаря в состоянии submitted или с undo pending; попытка расхода unknown не блокирует, её резерв остаётся в пределе месяца'
  - 'Перед транзакцией маршрут вызывает checkCalendarAction для незавершённых команд разговора, чтобы уже выполненная команда не держала удаление'
  - 'Неподтверждённое предложение календаря (state proposed) при удалении закрывается как refused/stale, поэтому confirm по id после удаления даёт 404'
  - 'Различение двух 409 на клиенте идёт по коду ошибки: busy показывает P05, precondition_failed перечитывает список'

requirements-completed: [CHAT-01, CHAT-04, CHAT-11]

duration: ~2 ч
completed: 2026-10-14
---

# Phase 22 Plan 16: Удаление разговора с обязательствами и политика Summary

Удаление разговора отказывает во время хода и незавершённой команды календаря (409 `busy`, Stop и отмену само не делает), иначе одной транзакцией стирает текст, упоминания и блоки сообщений и ставит tombstone; квитанции действий, попытки и расход месяца, заметки, отметки и календарь остаются. Страница privacy описывает чат фактами и приведена к коду 25.1.

## Задачи и коммиты

| # | Задача | Коммит |
|---|--------|--------|
| 1 | Удаление с проверкой обязательств, стирание содержимого, миграция ограничения, `chat-api.mjs delete` | 2371832 |
| 2 | P05 в диалоге удаления, раздел Chat assistant, разделы Google на privacy | 5cf961b |
| fix | Разделы и фразы privacy в e2e календаря (`e2e/calendar.spec.ts`) | 98f4e17 |
| 3 | Раздел `delete` в `chat-web.mjs` (не запускался) | 03d634b |
| по запросу ведущей | Тексты бюджета, порядок моделей и сброс уровня в `chat-web.mjs` под v79 и v80 (не запускался) | 790d1ee |

`commits: 5` — мои; `git rev-list --count 24c017a..HEAD` = 9, ещё четыре (05048d8, 1f56c96, 98bd00a, 6f135cf) принадлежат UI-исполнителю. `actuals.tokens` — символы `git show` моих пяти коммитов без `snapshot.json` / 4 (48618 / 4).

## Что построено

- **api.** `deleteConversation` (`conversations.ts`): блокировка разговора, затем ходы `accepted` и `running` и действия с `state = 'submitted'` или `undo_result->>'undo' = 'pending'` (`FOR UPDATE`, порядок разговор, ход, действие); найдено — `{ kind: 'pending' }`. Иначе `redactConversationContent` (`messages.ts`) и tombstone. Стирание: `body = ''`, `mentions = []`, `blocks = []`, `redacted_at = now()` у всех сообщений разговора; строки остаются, `.delete(` в `conversations.ts` и `messages.ts` нет. Маршрут `DELETE /chat/conversations/:id`: `pending` — 409 `busy`; повтор — 404; перед транзакцией незавершённые команды проходят `checkCalendarAction` вне транзакции. `runs.ts`: `writeText` пишет в сообщение только при `redacted_at is null` (иначе предложение удержано, в поток не уходит).
- **db.** Миграция `20261013181712_chat_messages_redacted_body`: `chat_messages_body_ck` допускает у учителя пустой текст, если `redacted_at` не null. Применена к `dvlab_test` (28 миграций) и `dvlab_dev` (31). `yarn db:generate` после неё: «No schema changes».
- **web.** `use-chat.ts`: `remove` возвращает `DeleteOutcome` (`deleted`, `busy`, `failed`), `busy` по коду ошибки 409. `conversation-dialogs.tsx`: при `busy` диалог остаётся открытым с текстом P05 «This chat has an unconfirmed request or usage record. Check its status before deleting.», при других сбоях прежний общий текст; `chat-screen.tsx` не менялся.
- **privacy.** Новый раздел «Chat assistant» (что уходит в Anthropic, где хранится разговор, что делает удаление, без сроков и ZDR у провайдера).

### Изменённые утверждения про Google (решение владельца 2026-10-13, вопрос 11)

| Раздел | Было | Стало (источник в коде) |
|--------|------|-------------------------|
| описание страницы | «connects their primary calendar» | «connects a Google calendar» (D-04) |
| Calendar access | список нужен, чтобы найти основной календарь | список предлагает календари аккаунта с правом записи, основной по умолчанию, другой выбирается в Settings (`connection.ts`, `gateway-sync.ts`) |
| Information sent to Google | имя ученика, время, зона, повтор, отмена, внутренние id | добавлены название любого события, цвет, описание и место, закрытые свойства (id урока, серии или события, вид, id команды, digest), запись id урока при Assign, возврат прочих настроек события без изменений (`command-result.ts`, `calendar-values.ts`, D-18) |
| Calendar information read and stored | «permitted titles», в видах нет описаний и мест | копия событий выбранного календаря: название, описание, место, цвет, повтор, статус, доступность, тип, id урока из метки; палитра и цвет календаря, id игнорируемых событий; вложения, участники и ссылки не запрашиваются (`ITEM_FIELDS`, `calendar-sync-schema.ts`) |
| Calendar view metadata | метаданные просмотров | заменён на «Background updates from Google»: канал уведомлений по HTTPS, уведомление без содержимого, sync token, ночная сверка, хранимые поля канала, продление и остановка (`watch.ts`, `google-notifications.ts`, `sync.ts`) |
| Last checked view and retention | последний просмотр остаётся и не удаляется | заменён на «Stored copy and retention»: окно около 8 недель назад и года вперёд, при полной сверке вне окна и отсутствующее в Google удаляется, кроме событий, связанных с уроками; копия остаётся после Disconnect и смены календаря (`sync-store.ts`) |
| Data recipients | только Google | Google шлёт уведомления; Anthropic обрабатывает вопросы чата; браузер получает разговоры |
| Operational records | без названий событий | добавлен текст сообщений чата (подтверждено проверками логов) |
| Disconnecting | «last checked view» | останавливает и каналы уведомлений, «the stored copy» |
| Refreshing the view | нет фоновой доставки, внешние события только чтение | «Changes made in Google»: просмотр читает копию и Google не вызывает, изменения приходят по уведомлениям и ночной сверке, обычные события создаются, двигаются, меняются и удаляются, совпадение названия с именем только предлагается (Assign) (D-06, D-07) |

Разделы вход, форма, авторизация, запись запросов и локальные записи не менялись: расхождений с кодом не найдено.

## Проверки

Выполнено:

- `yarn workspace @dv-lab/api typecheck`, `@dv-lab/db typecheck`, `@dv-lab/web typecheck`: код 0. `yarn workspace @dv-lab/web lint`: чисто. `yarn knip`: код 0. `node scripts/hygiene-check.mjs`: clean. `prettier --check` по изменённым файлам: чисто. `node --check` для обоих скриптов.
- `node scripts/dev-checks/chat-api.mjs delete` (dvlab_test, свой api на порту 4233 с заглушкой Anthropic и ключом-заглушкой): `CHAT_DELETE_OK`, 22 PASS, 0 FAIL. Покрыто: удаление во время хода даёт 409 `busy` и ничего не меняет, ход не остановлен; 409 `busy` при незавершённой команде календаря и при незавершённом откате; устаревшая ревизия даёт 409 `precondition_failed`, не `busy`; после завершения хода 204; строки сообщений на месте, все стёрты (`body = ''`, пустые упоминания и блоки, `redacted_at`), название `Deleted chat`; квитанции действий не изменились; неподтверждённое предложение календаря закрыто (`refused`, `stale`), его confirm даёт 404; ходы и попытки на месте (в том числе в `unknown`), суммы `spent` и `held` периода не изменились; заметка и отметка из чата остались; GET даёт 404, в списке нет, чужой разговор цел; повтор Delete даёт 404, Send в удалённый разговор 404; в логе api нет текста заметки и имён. Уборка: разговоры по порядку `chat_actions` → `chat_usage_attempts` → `chat_turns` → `chat_messages` → `chat_conversations`, карточки, период бюджета; в `dvlab_test` осталось 0 разговоров, 0 сообщений, 0 фикстурных карточек.
- `node scripts/dev-checks/chat-api.mjs conversations`: `CHAT_CONVERSATIONS_OK` (прежний сценарий удаления остался зелёным).
- Критерии: `grep "Anthropic" apps/web/app/privacy/page.tsx` находит раздел; четыре устаревшие фразы Task 2 не находятся; `.delete(` в `conversations.ts` и `messages.ts` нет.

Не запускалось (запись `unrun-verify` в `.planning/WINDOWS.md`):

- `node scripts/dev-checks/chat-web.mjs delete light|dark` и `node scripts/dev-checks/wait-dev.mjs down`: стенд владельца занимает порты 3000 и 4000, раздел сам поднимает api на 4000. Раздел написан по образцу `stream` и `conversations`, проверен `node --check` и `prettier`, в браузере не исполнялся. Диалог с P05, удаление, фокус на All chats и открытие `/privacy` без входа не проверены ни в одной теме.
- Страница `/privacy` в браузере не открывалась.
- Обновлённые по запросу ведущей части `budget` и `models` в `chat-web.mjs` (тексты «$X used», «$Y left», «held by a request in progress», порядок моделей клавишами на ручке «Reorder Opus 5.5») не исполнялись; селекторы сверены только по отчёту `22-UI-V79-V80.md`.
- e2e (`e2e/calendar.spec.ts`) не запускался.

## Deviations from Plan

**1. [Rule 3 - Blocking] Миграция ограничения `chat_messages_body_ck`.** План требует `body = ''` у стёртых сообщений, а ограничение запрещало пустой текст у учителя. Ограничение заменено (DROP и ADD) на таблице, которая существует только в этой ещё не выкаченной фазе, поэтому правило «миграции релиза только добавляют» не нарушено по существу; изменение ослабляет проверку и совместимо со старым кодом. Применено к `dvlab_test` и `dvlab_dev` (как в 22-13). Файлы вне `files_modified`: `packages/db/src/chat-schema.ts` и каталог миграции. Коммит 2371832.

**2. [Rule 2 - Missing] Закрытие неподтверждённых предложений календаря.** Без этого confirm по id мог бы отправить изменение календаря из уже удалённого разговора. При удалении предложения `proposed` становятся `refused` с `stale`. Коммит 2371832.

**3. [Rule 2 - Missing] Предварительная проверка команд календаря.** План говорит «по checkCalendarAction»; она пишет через `db`, а не в транзакцию, поэтому вызывается из маршрута до транзакции, внутри транзакции только блокировка и осмотр состояния. `unsettledActionIds` и `redactConversationContent` лежат в `messages.ts`. Коммит 2371832.

**4. [Rule 3 - Blocking] `use-chat.ts` не в `files_modified`.** Нужен, чтобы отличить 409 `busy` от 409 `precondition_failed`; правка одним хунком, файл больше никем не менялся. Коммит 5cf961b.

**5. [Rule 1 - Bug] `e2e/calendar.spec.ts`.** Проверял прежние заголовки и фразы privacy; обновлён минимально (заголовки, две фразы). Коммит 98f4e17.

**6. По запросу ведущей:** тексты и селекторы `budget` и `models` в `chat-web.mjs` приведены к правкам v79 и v80 (коммит 790d1ee). Кнопка «Use default (...)» в меню модели (не поповер Effort) оставлена как была.

## Known Stubs

Нет. Раздел `delete` в `chat-web.mjs` не исполнялся (см. выше).

## Threat Flags

Нет новой поверхности: меняется существующий маршрут удаления под сессией учителя. T-22-38 (409 до завершения, Stop не делается неявно), T-22-39 (стирание текста, упоминаний и блоков), T-22-40 (политика без обещаний о сроках и ZDR у провайдера) закрыты. Установок пакетов нет.

## Для следующих планов

- **22-17.** `chat-api.mjs delete` занимает порт 4233 и стартует свой api с заглушкой; не параллелить с другими разделами, меняющими периоды бюджета учителя-фикстуры (он удаляет попытки и периоды учителя в начале и в конце). `chat-web.mjs delete light|dark` требует свободных 3000 и 4000, до первого запуска числится как `unrun-verify` (вместе с обновлёнными `budget` и `models`).
- Ограничение, оставленное намеренно: откат (`undo`) применённого действия по id после удаления разговора остаётся технически возможным (блоки стёрты, но запись действия цела); из интерфейса он недоступен.
- Миграция применена к `dvlab_dev`: api владельца на 4000 может принимать удаление сразу.
- `.planning/WINDOWS.md` изменён записью `unrun-verify` и остался в рабочем дереве (в commit `docs` идёт только SUMMARY).

## Self-Check: PASSED

Файлы: `packages/db/drizzle/20261013181712_chat_messages_redacted_body/migration.sql`, `snapshot.json` и все изменённые файлы из `key-files` на месте. Коммиты 2371832, 5cf961b, 98f4e17, 03d634b, 790d1ee есть в `git log`.
