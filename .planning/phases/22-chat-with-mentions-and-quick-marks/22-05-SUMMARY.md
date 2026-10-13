---
phase: 22-chat-with-mentions-and-quick-marks
plan: '05'
status: complete
verification: blocked
subsystem: db-api-web
tags: [chat, conversations, tombstone, revision, migration, teacher-only]

requires:
  - phase: 22-04
    provides: 'routes/chat.ts с одним use(noStore, requireSession, requireRole teacher), contracts/chat.ts, ChatScreen, chat-api.mjs и chat-web.mjs с объектом разделов'
provides:
  - 'db: chat_conversations (chat-schema.ts, в массиве schema drizzle.config.ts), REVOKE DELETE, TRUNCATE у dvlab_app'
  - 'contracts/chat.ts: CHAT_TITLE_MAX, chatConversationTitle, chatConversation, renameConversationRequest, deleteConversationRequest, ответы списка и одного разговора'
  - 'api chat/conversations.ts: createConversation, listConversations, readConversation, renameConversation, deleteConversation(executor, accountId, ...)'
  - 'api routes/chat.ts: POST/GET /chat/conversations, GET/PATCH/DELETE /chat/conversations/:id'
  - 'web /chat: use-chat.ts (контроллер экрана), ConversationList, диалоги переименования и удаления, шапка с All chats и New chat, выбор через ?c='
  - 'scripts/dev-checks: chat-api.mjs conversations (CHAT_CONVERSATIONS_OK), chat-web.mjs conversations (CHAT_WEB_CONVERSATIONS_OK, не исполнялся)'
affects: [22-06, 22-07, 22-08, 22-09, 22-11, 22-12, 22-16]

actuals:
  tokens: 16400
  tasks: 3
  commits: 3
plan_head_before: ea437950be8aee3af9c3eab07cec6b8b5ce09f97
plan_head_after: c5c8da77a0e11473b0e1f061d6ff5a03bc02eff5

tech-stack:
  added: []
  patterns:
    - 'Разговор принадлежит аккаунту сессии; чужой, удалённый и неверный id дают одинаковый 404'
    - 'Изменение и удаление: транзакция, select for update, сверка expectedRevision, 409 precondition_failed без изменений'
    - 'Удаление разговора - tombstone: deleted_at, название «Deleted chat», revision + 1; DELETE и TRUNCATE у приложения отозваны'
    - 'Выбор разговора живёт в ?c= и меняется через history.replaceState без серверной навигации'

key-files:
  created:
    - packages/db/src/chat-schema.ts
    - packages/db/drizzle/20261013123301_chat_conversations/migration.sql
    - packages/db/drizzle/20261013123301_chat_conversations/snapshot.json
    - packages/db/drizzle/20261013123305_chat_conversations_revoke_delete/migration.sql
    - packages/db/drizzle/20261013123305_chat_conversations_revoke_delete/snapshot.json
    - apps/api/src/chat/conversations.ts
    - apps/web/app/(app)/chat/_components/use-chat.ts
    - apps/web/app/(app)/chat/_components/conversation-list.tsx
    - apps/web/app/(app)/chat/_components/conversation-dialogs.tsx
  modified:
    - packages/db/src/index.ts
    - packages/db/drizzle.config.ts
    - packages/contracts/src/chat.ts
    - apps/api/src/routes/chat.ts
    - apps/web/app/(app)/chat/page.tsx
    - apps/web/app/(app)/chat/_components/chat-screen.tsx
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-web.mjs
    - scripts/dev-checks/README.md

key-decisions:
  - 'Длина названия считается в code points (Array.from в contracts, char_length в CHECK): 160 эмодзи сохраняются целиком, 161 символ и NUL отвергаются 400 без обрезки'
  - 'Название в запросе обрезается по краям (trim) до проверки длины; пустое после trim - 400'
  - 'Удаление и переименование несуществующего, чужого и уже удалённого разговора - 404, раньше проверки ревизии'
  - 'Переименование без изменения названия в диалоге не шлёт запрос (иначе ревизия и updated_at росли бы впустую)'
  - 'Диалоги берут ревизию из актуального списка: при 409 список перечитывается, повтор в том же диалоге уходит со свежей ревизией'

requirements-completed: [CHAT-01]

duration: ~1h30
completed: 2026-10-13
---

# Phase 22 Plan 05: Разговоры чата Summary

Серверные разговоры без модели: таблица `chat_conversations` с ревизией и tombstone, владелец `chat/conversations.ts`, пять маршрутов `/chat/conversations*`, а на `/chat` шапка с All chats и New chat, список поверх колонки, переименование и удаление.

## Задачи и коммиты

| # | Задача | Коммит |
|---|--------|--------|
| 1 | Таблица `chat_conversations`, миграция, отзыв DELETE/TRUNCATE | 75c3d7f |
| 2 | Контракт, владелец разговоров, маршруты, `chat-api.mjs conversations` | 3fd2482 |
| 3 | Список, диалоги, шапка, `use-chat.ts`, `chat-web.mjs conversations`, раздел README | c5c8da7 |

Каталоги миграций: `packages/db/drizzle/20261013123301_chat_conversations` и `packages/db/drizzle/20261013123305_chat_conversations_revoke_delete`. Первая сгенерирована `yarn db:generate --name chat_conversations`, вторая - `drizzle-kit generate --custom` с одной инструкцией `REVOKE DELETE, TRUNCATE ON "chat_conversations" FROM "dvlab_app";`. Руками сгенерированный SQL не правился. Второй `yarn db:generate` печатает «No schema changes».

Миграции применены к `dvlab_test` и `dvlab_dev` способом 22-03 (`node --env-file=<.env.test|.env> apps/api/src/migrate.ts` без `DATABASE_URL` и `MIGRATOR_DATABASE_URL` в окружении), а не `schedule-db.mjs migrate` из плана (по распоряжению ведущей сессии, скрипт устарел).

## Дизайн

Версия `~/dv-lab-design` на исполнении: v67. Построено по `ChatPage/README.md` и превью: колонка 720px, шапка 48px (название разговора `subtitle` 600 в одну строку с многоточием, All chats - ghost compact со значком списка, New chat - outline compact со значком плюса; ниже `md` обе кнопки иконочные 36x28 с `aria-label`), список поверх колонки (`Panel`, вход с прозрачностью и сдвигом 12px на `moderate`, задержка строк 30ms не более 8 шагов, при reduced motion без сдвига и задержки), кнопка All chats с активной заливкой и `aria-expanded`, строка 56px (название `body` 500, под ним «Empty chat», справа время), меню строки «More» с Rename conversation и Delete conversation (подпись destructive), Esc закрывает список, `scroll-fade` на прокрутке списка. Диалоги: P03 (поле «Conversation title», Keep title / Save title, ошибка у поля, черновик сохраняется) и P04 (ConfirmDialog, Keep conversation в фокусе, текст P04, сбой строкой над кнопками).

## Проверки

Выполнено:

- `yarn db:generate`: «No schema changes» после обеих миграций. `git status --porcelain packages/db/drizzle`: только два новых каталога плана.
- `yarn workspace @dv-lab/db typecheck`, `@dv-lab/contracts typecheck`, `@dv-lab/api typecheck`, `@dv-lab/web typecheck`: код выхода 0. `yarn workspace @dv-lab/web lint`: код выхода 0. `prettier --check` по файлам плана: чисто.
- `node scripts/dev-checks/sql.mjs .env.test app "select has_table_privilege('dvlab_app','chat_conversations','DELETE') ..."`: DELETE и TRUNCATE `false`, UPDATE `true`; на `dvlab_dev` DELETE `false`, INSERT `true`.
- `node scripts/dev-checks/chat-api.mjs conversations` (dvlab_test, порт 4224): `CHAT_CONVERSATIONS_OK`, 0 FAIL, повторный прогон тоже. Покрыто: создание (201, `New chat`, ревизия 1, `no-store`, два вызова дают два разговора), порядок списка (новейший первым, после переименования переносится наверх, порядок равен `updated_at desc, id`), чтение одного, неизвестный и неверный id дают 404 `not_found`; переименование с обрезкой пробелов и ревизией 2; устаревшая ревизия при переименовании и удалении дают 409 `precondition_failed` без изменений в строке; пустое, из пробелов, 161 символ, NUL, не строка, нет ревизии, нулевая ревизия, лишний ключ - 400 `invalid_request`; удаление без тела и с лишним ключом - 400; 160 символов кириллицы и 160 эмодзи сохраняются целиком; ученик 403 и без сессии 401 на всех пяти маршрутах, тело отказа без названия; разговор другого аккаунта (строка вставлена SQL на аккаунт ученика) при чтении, переименовании и удалении - 404, в списке не виден, строка не изменена; удаление - 204, строка остаётся с `deleted_at`, название «Deleted chat», ревизия +1, прежнего названия в строке нет; повтор удаления, чтение и переименование удалённого - 404, в списке нет; роль приложения при `DELETE` и `TRUNCATE` получает 42501; другой разговор цел; счётчики строк всех таблиц, кроме `chat_conversations`, до и после не изменились; в логе api нет названий. Фикстуры удалены.
- `node scripts/dev-checks/chat-api.mjs records`: `CHAT_RECORDS_OK`, 0 FAIL. Обход маршрутов `/chat` теперь включает пять новых маршрутов: каждому ученик 403, без сессии 401.
- Критерии приёмки: `conversations.ts` импортирует только `drizzle-orm`, `@dv-lab/contracts` и `@dv-lab/db` (ничего из `calendar/`, `schedule/`, `cards/`); в `routes/chat.ts` пять маршрутов `/conversations`.

Не выполнено, по распоряжению ведущей сессии (порты 3000 и 4000 заняты стендом владельца из этого же worktree, его не останавливали):

- `node scripts/dev-checks/chat-web.mjs conversations light` и `dark`. Раздел написан, проходит `node --check`, без аргументов печатает usage (код 2), но ни разу не исполнялся: при первом запуске вероятны ошибки селекторов (особенно `openList` с `:visible`, наведение на строку и клик «More: ...», Escape с фокусом на строке, ожидание `detached` у диалогов). Запуск владельцем вместе с ведущей сессией на поднятом стенде (`node scripts/dev-checks/wait-dev.mjs up`): `node scripts/dev-checks/chat-web.mjs conversations light`, затем `dark`. Скрипт входит dev-учителем из `.env`, создаёт разговоры в `dvlab_dev` через интерфейс (названия «Chat check Alpha» и «Chat check Beta») и в конце удаляет созданные по id, пишет скриншоты в `STATE_DIR`, печатает `CHAT_WEB_CONVERSATIONS_OK`. Ожидаемо проверит: New chat и `?c=` в адресе и после перезагрузки, Empty chat в строке, переименование (пустое название, 161 символ, сбой 500 с сохранением черновика, успех, Keep title), порядок списка, удаление (фокус на Keep conversation, сбой 500, Keep conversation, успех, tombstone в базе, фокус на All chats), ошибку списка с Refresh, телефон 390px без горизонтальной прокрутки.
- `node scripts/dev-checks/wait-dev.mjs down` (стенд владельца не трогали).
- Ручная проверка вида `/chat` с шапкой и списком в обеих темах: не выполнялась, экран в браузере не открывался.
- DELETE с JSON-телом через `next dev` rewrite `/api/*` и через Caddy `handle_path` не проверялся: в проверке api для DELETE пришлось задать `content-length` явно (см. отклонение 3). Первый запуск `chat-web.mjs conversations` покажет, доходит ли тело DELETE до api; если нет, ревизию придётся передавать иначе (например, заголовком `If-Match` или `PATCH` с `deleted`), это решение планировщика.
- `yarn build` и `yarn test` не запускались по распоряжению.

## Deviations from Plan

**1. Применение миграций.** Вместо `node scripts/dev-checks/schedule-db.mjs migrate` использован `node --env-file=<.env.test|.env> apps/api/src/migrate.ts` без `DATABASE_URL` в окружении (распоряжение ведущей сессии, способ 22-03).

**2. [Rule 2] Создание разговора на сервере при нажатии New chat против README ChatPage v67.** README: «The conversation is created when the first message is sent; an empty "New chat" is never saved by itself». План и UD6 требуют `POST /chat/conversations` без модели, что построено. Расхождение осталось открытым: пока сообщений нет, каждое нажатие New chat сохраняет пустой разговор. Решить в 22-06...22-08 (композер и первое сообщение): оставить немедленное создание или перенести его на первый Send. Вопрос к Design dude и владельцу.

**3. [Rule 3] Проверка api: `send()` с явным `content-length` для DELETE.** Node `http` без `content-length` и `transfer-encoding` отправляет тело DELETE без обрамления, сервер отвечает 400 до приложения. В `chat-api.mjs` добавлена функция `send(api, method, path, options)`: для DELETE с телом выставляет `content-length`. Она же применена в обходе маршрутов раздела `records` (иначе обход упал бы на новом DELETE с телом `{}`). Планам 22-09 и 22-12, добавляющим DELETE или тела у DELETE, использовать `send`, а не `call`, для запросов с телом.

**4. Самодельные строки интерфейса (EXECUTOR-RULES 8, открытый вопрос Design dude).** В UI-SPEC P01-P05 и README ChatPage v67 нет текста для следующих состояний, строки предложены мной и не являются дизайном:

- «No chats yet.» - пустой список разговоров (`conversation-list.tsx`).
- «Could not create a chat. Try again.» - сбой New chat, баннер под шапкой (`chat-screen.tsx`).
- «Enter a title.» - пустое название при Save title (`conversation-dialogs.tsx`).
- «Use 160 characters or fewer.» - слишком длинное название (README: «says so at the field», текст не задан) (`conversation-dialogs.tsx`).
- «Deleting…» - подпись кнопки во время удаления (`conversation-dialogs.tsx`).
- `aria-label` меню строки «More: <название>» вместо «More» из README (имя уточнено названием разговора, чтобы строки различались).

**5. Дата и время строки списка.** `conversationTime` (`conversation-list.tsx`) форматирует `updated_at` через `Intl` в часовом поясе браузера (сегодня - часы:минуты, до семи дней - день недели, иначе день и месяц), а не в явной зоне, как требует AGENTS.md для дат расписания. Это не дата расписания, а подсказка давности строки, поэтому зона учителя не нужна; решение за планировщиком, если время должно идти в зоне настроек. На touch время скрыто целиком (на его месте кнопка More, README: «On touch the menu button is always there»).

**6. P05 (удаление отключено при неподтверждённом запросе) не построено.** Запросов к модели и расходов пока нет, условия блокировки нет. Добавляет 22-12/22-16 вместе с проверкой незавершённых обязательств.

**7. Раздел `conversations` в `chat-api.mjs` чистит `chat_conversations` в `dvlab_test` целиком** в начале (`delete from chat_conversations` под ролью миграций, база `_test`) и свои строки в конце. Параллельных исполнителей в волне 5 нет; следующие планы, пишущие в эту таблицу в тестовой базе, должны об этом знать.

**8. Страница: PageHeader заменён собственной шапкой.** `h1` теперь название выбранного разговора, а без выбора «Chat» (раздел `records` из 22-04 ищет `h1` «Chat» без `?c=` и остаётся корректным). Пока список разговоров грузится, при `?c=` в шапке скелетон с `aria-label="Chat"`.

## Known Stubs

- «Empty chat» в каждой строке списка - `conversation-list.tsx`, строка 135. Сообщений пока нет; предпросмотр последнего сообщения и «Waiting for a decision» добавляет 22-12 (сообщения) вместе с полем в `chatConversation`.
- Тело страницы при выбранном разговоре - `EmptyLine «What do you want to ask?»` из 22-04 (`chat-screen.tsx`), блок фактов остаётся при `?student=`. Приветствие с подсказками, сообщения и composer добавляют 22-06...22-08 и 22-12.
- Фокус в поле ввода после New chat и после открытия разговора (UI-SPEC: «New chat focus → textarea») не реализован: поля ввода ещё нет. Закрывает композер.

## Для следующих планов

- Идентичность и ревизия разговора принадлежат серверу. Новые поля разговора (последнее сообщение, состояние ожидания) добавлять в `chatConversation` в `contracts/chat.ts` и в `columns`/`toConversation` в `chat/conversations.ts`; схему в `chat-schema.ts` (новые таблицы чата дописывать в тот же файл, `drizzle.config.ts` его уже читает).
- Ревизия растёт при каждом переименовании и удалении. Если сообщения будут менять `updated_at` разговора, менять `revision` не обязательно: `expectedRevision` защищает только переименование и удаление.
- Удалённый разговор остаётся строкой с `deleted_at` и названием «Deleted chat»; содержимое сообщений (когда оно появится) вычищает 22-16 по правилам T-22-11.
- Выбор разговора: `useChat(initialConversationId)` в `use-chat.ts` отдаёт `list`, `selectedId`, `select`, `create`, `rename`, `remove`, `reload`; адрес меняется `history.replaceState`, страница читает `?c=` один раз при загрузке. Упоминание 22-08 с `?student=` не мешает: параметры независимы.
- Новые маршруты чата уже попадают в обход ролей `chat-api.mjs records` без правок; запросы с телом у DELETE отправлять через `send`.
- Если `chat-web.mjs conversations` покажет, что тело DELETE не доходит через прокси, потребуется другой способ передать ревизию.

## Self-Check: PASSED

Файлы плана найдены (`chat-schema.ts`, оба каталога миграций с `migration.sql` и `snapshot.json`, `conversations.ts`, `use-chat.ts`, `conversation-list.tsx`, `conversation-dialogs.tsx`), коммиты 75c3d7f, 3fd2482 и c5c8da7 есть в ветке, `git rev-list --count ea437950..HEAD` = 3 на момент записи, рабочее дерево чисто по файлам плана (остался только `apps/web/next.config.ts` владельца).
