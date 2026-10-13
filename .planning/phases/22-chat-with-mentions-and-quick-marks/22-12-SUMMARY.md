---
phase: 22-chat-with-mentions-and-quick-marks
plan: '12'
status: complete
verification: partial
subsystem: api-db-contracts-web
tags: [chat, budget, nano-usd, reserve, settings-assistant, migration]

requires:
  - phase: 22-11
    provides: 'readAssistantSettings, saveAssistantSettings, resolveModelChoice, GET и PATCH /settings/assistant, колонки chat_* в teacher_settings'
provides:
  - 'db: chat_conversations.model_override и effort_override; таблицы chat_budget_periods и chat_usage_attempts без DELETE и TRUNCATE у dvlab_app'
  - 'contracts: budgetSnapshot, conversationUsage, budgetState, BUDGET_WARNING_PERCENT; AssistantSettingsResponse с budget и usage'
  - 'api chat/budget.ts: usdToNano, nanoToUsd, reserveNano, costNano; reserveAttempt, markDispatched, settleAttempt, markUnknown, release, readBudgetSnapshot, usageByConversation'
  - 'api: GET и PATCH /settings/assistant отдают budget и usage (до 5 разговоров)'
  - 'web: вкладка Settings → Assistant с карточкой Budget (assistant-card.tsx, AssistantCard)'
  - 'scripts: chat-api.mjs budget (CHAT_BUDGET_OK), chat-web.mjs budget light|dark'
affects: [22-13, 22-15, 22-16, 22-17]

actuals:
  tokens: 26000
  tasks: 3
  commits: 3
plan_head_before: c9a84532a3cf7b58477c4732236bcf7bc879d1bb
plan_head_after: ab9923d

tech-stack:
  added: []
  patterns:
    - 'Деньги чата - целые нано-доллары bigint; перевод из десятичной строки и обратно только в chat/budget.ts'
    - 'Период бюджета: INSERT ON CONFLICT DO NOTHING, затем SELECT FOR UPDATE той же строки; резерв, расчёт и освобождение под блокировкой периода'
    - 'Попытка захватывает модель, уровень, тариф и лимиты; расчёт идёт по захваченному тарифу'

key-files:
  created:
    - apps/api/src/chat/budget.ts
    - apps/web/app/(app)/settings/_components/assistant-card.tsx
    - packages/db/drizzle/20261013161230_chat_budget/migration.sql
    - packages/db/drizzle/20261013161230_chat_budget/snapshot.json
    - packages/db/drizzle/20261013161237_chat_budget_revoke_delete/migration.sql
    - packages/db/drizzle/20261013161237_chat_budget_revoke_delete/snapshot.json
  modified:
    - packages/db/src/chat-schema.ts
    - packages/contracts/src/chat-settings.ts
    - apps/api/src/routes/settings.ts
    - apps/web/app/(app)/settings/_components/settings-screen.tsx
    - apps/web/app/(app)/chat/_components/messages.tsx
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-web.mjs
    - scripts/dev-checks/README.md

key-decisions:
  - 'Период - календарный месяц в текущей зоне учителя на момент запроса; в строке периода хранится зона создания. Смена зоны посреди месяца попадает в ту же строку (ключ account_id + starts_on), новая зона определяет границы со следующего месяца'
  - 'settleAttempt принимает попытки reserved, dispatched и unknown: поздний usage после markUnknown рассчитывается в исходном периоде; settled - конечное состояние, повтор без изменений'
  - 'markUnknown переводит reserved и dispatched (резерв остаётся удержанным); release - только reserved'
  - 'Состояние снимка считается от spent + held: reached при spent + held >= cap, warning от 80%; remaining = max(cap - spent - held, 0)'
  - 'Usage by conversation: расход settled-попыток плюс удержанный резерв reserved, dispatched и unknown, released не учитываются; сумма сходится со spent + held периода'
  - 'Карточка Budget по дизайну v65 (DR-22-04): кнопка Save и подписи подвала вместо сохранения на изменение; 80% и 100% в карточке не объявляются (это ChatModelControls в чате, 22-15)'

requirements-completed: [CHAT-11]

duration: ~45 мин
completed: 2026-10-13
---

# Phase 22 Plan 12: Месячный предел и расход по разговорам Summary

Предел расхода чата стал жёстким до вызова модели: `chat/budget.ts` резервирует верхнюю оценку запроса в нано-долларах под блокировкой строки периода месяца учителя, расчёт по usage идёт один раз по тарифу, захваченному в попытке, а Settings → Assistant показывает предел, расход, удержанный резерв и разговоры с наибольшей стоимостью.

## Задачи и коммиты

| # | Задача | Коммит |
|---|--------|--------|
| 1 | Колонки переопределения, таблицы периодов и попыток, контракт снимка | 8319dc3 |
| 2 | Владелец бюджета и бюджет в `/settings/assistant` | ba4b5d7 |
| 3 | Карточка Budget, вкладка Assistant, проверки | ab9923d |

## Что сделано

- **База.** `chat_conversations` получила `model_override` и `effort_override` (text null, для 22-13 и 22-15). `chat_budget_periods`: `starts_on`, `ends_before`, `time_zone`, `spent_nano` и `held_nano` (bigint, CHECK >= 0), CHECK `ends_before > starts_on`, уникальный индекс `(account_id, starts_on)`. `chat_usage_attempts`: ссылки на аккаунт, разговор и период с `ON DELETE RESTRICT`, `model`, `effort`, `pricing jsonb`, `max_input_tokens`, `max_output_tokens`, `reserved_nano`, `state` (CHECK пяти состояний), `usage jsonb`, `cost_nano`; индексы `(conversation_id)` и `(period_id, state)`. Миграции: `20261013161230_chat_budget` (`yarn db:generate --name chat_budget`) и `20261013161237_chat_budget_revoke_delete` (`--custom`, одна инструкция `REVOKE DELETE, TRUNCATE ON "chat_budget_periods", "chat_usage_attempts" FROM "dvlab_app";`). Применены к `dvlab_test` (25 миграций) и `dvlab_dev` (28) командой `env -u DATABASE_URL -u MIGRATOR_DATABASE_URL node --env-file=<.env.test|.env> apps/api/src/migrate.ts`.
- **Формулы.** `usdToNano` разбирает десятичную строку до девяти знаков без `Number` и `parseFloat` (экспонента, знак, голая дробь отклоняются); `nanoToUsd` печатает минимум два знака и обрезает хвостовые нули (`0.002`, `10.00`). `reserveNano` = `ceil(maxInputTokens × max(input, cacheWrite5m) + maxOutputTokens × output) / 1M`; `costNano` = `ceil(input × in + cacheCreation × cacheWrite + cacheRead × read + output × out) / 1M`. Значения по умолчанию: резерв Haiku 5.5 - 0.0205 $, Fable 5.1 - 2.05 $.
- **Резерв.** `reserveAttempt(tx, accountId, conversationId, choice, now)`: зона из `readTeacherSettings`, предел из `readAssistantSettings` в той же транзакции; период через `onConflictDoNothing({ target: [accountId, startsOn] })`, затем `.for('update')`; `spent + held >= cap` - `budget_reached`, `spent + held + reserve > cap` - `budget_insufficient` (попытка не пишется), иначе попытка `reserved` с захваченными тарифом и лимитами и `held += reserve`. Возвращает `{ ok: true, attemptId, periodId, reservedNano }` или `{ ok: false, code }`.
- **Жизненный цикл.** `markDispatched` (reserved -> dispatched), `settleAttempt(db, logger, attemptId, usage)` (своя транзакция с блокировкой попытки; usage проверяется схемой `{ inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens }`; `held -= reserved`, `spent += cost` по факту; при `cost > reserved` строка `warn` «chat usage cost above reserve» с id попытки, моделью, резервом, стоимостью и числами токенов строками, без текста), `markUnknown`, `release`. bigint в лог и ответы уходят только строками.
- **Чтение.** `readBudgetSnapshot(executor, accountId, now)` только читает (без вставки периода) и отдаёт `{ budget, periodId }`; `usageByConversation(executor, accountId, periodId, limit)` группирует попытки периода по разговору, сортирует по стоимости. `GET` и `PATCH /settings/assistant` собирают настройки, снимок и расход одним `readSnapshot`; сохранение и проверка предела остались у `saveAssistantSettings`.
- **Web.** Вкладка Assistant после Google Calendar (`?tab=assistant`, `keepMounted` и `Activity` как у Calendar). `AssistantCard` - колонка 720px с карточкой Budget по SettingsAssistant v65: поле «Monthly limit» 120px с `$`, заполнено сохранённым значением; «Estimated usage this month: $X of $Y.», полоса 6px (`selected`/`primary`), «Remaining estimate: …» и «Reserved estimate: …» только при удержанном резерве, «Usage has not been confirmed.» с иконкой при неподтверждённых попытках; строка о пределе ниже расхода; Usage by conversation (до 5 строк, при пустом списке блока нет); «Costs count toward your monthly budget.»; подвал Save со строками «Saved to your account.», «Unsaved changes», «Saving…» и ошибкой. Неверное значение - «Enter a monthly budget above zero.», кольцо `destructive`, Save выключен; 400 сервера показывается этой же строкой. После ответа 200 - тост «Saved» «Monthly limit: $X.». Ошибка чтения - «Budget status unavailable. Refresh before sending.» и Refresh status (P20). Суммы округляются до центов в сторону осторожности: расход и резерв вверх, остаток вниз.
- **P21.** В `messages.tsx` отказ `credits_unavailable` показывается «API credits unavailable» / «The API account cannot admit this request. Check its billing status.», а не текстом настроек модели.

## Проверки

Выполнено:

- `yarn db:generate` после двух миграций: «No schema changes»; `git status --porcelain packages/db/drizzle` до коммита - только два новых каталога.
- `has_table_privilege('dvlab_app', …)` на `dvlab_test` и `dvlab_dev`: DELETE и TRUNCATE `false`, INSERT и UPDATE `true` для обеих таблиц.
- `yarn workspace @dv-lab/db|contracts|api typecheck`, `yarn workspace @dv-lab/web typecheck`, `yarn workspace @dv-lab/web lint`: код 0. `prettier --check` по всем файлам плана: чисто.
- `grep -rn "function usdToNano\|function reserveNano\|function costNano\|function nanoToUsd" apps/api/src apps/web/app apps/web/lib packages/*/src`: по одной строке, все в `budget.ts`. `parseFloat` и `Number(` в `budget.ts` нет.
- `node scripts/dev-checks/chat-api.mjs budget` (dvlab_test, порт 4224): `CHAT_BUDGET_OK`, 27 PASS, 0 FAIL. Покрыто: предел $10 по умолчанию; формулы и округление вверх; резерв помещается; период текущего месяца в зоне учителя; `markDispatched` один раз; `release` отказывает dispatched; расчёт дороже резерва (резерв 0.0205 $, факт 0.0504 $) пишет факт в `spent`, строка `warn` уровня 40 только с допустимыми ключами; повторный расчёт без изменений; смена тарифа после резерва не меняет стоимость; `markUnknown` держит резерв и считается в снимке; новый резерв принимается при неподтверждённой попытке; `release` один раз; состояния `ok` (79%), `warning` (89%), `reached`; `budget_insufficient` и `budget_reached` без записи попытки; `GET /settings/assistant` с `budget` и `usage` (суммы по разговорам 0.0709 $ и 0.0006 $), `PATCH` с новым пределом; два параллельных `reserveAttempt` двумя пулами в новом месяце - один период, один принят и один `budget_insufficient` при пределе 3 $, оба приняты при 10 $ без ошибки ключа; переход месяца в зоне учителя (23:30 и 00:30) - разные периоды, поздний расчёт в своём; декабрь кончается 1 января; DELETE и TRUNCATE под `dvlab_app` - 42501. После прогона в `dvlab_test` 0 периодов и 0 попыток, предел учителя-фикстуры 10.00.
- `node scripts/dev-checks/chat-config.mjs` (регрессия 22-11 после расширения ответа): `CHAT_CONFIG_OK`.
- `yarn knip`: код 0, неиспользуемых экспортов и файлов нет (функции резерва видит через `chat-api.mjs`); исключения в `knip.json` не добавлялись.
- `curl` к работающему api владельца: `/healthz` 200, `/settings/assistant` без сессии 401 (после горячей перезагрузки api не упал).

Не выполнено:

- `node scripts/dev-checks/chat-web.mjs budget light` и `dark`, `wait-dev.mjs down`: по распоряжению ведущей сессии стенд на 3000 и 4000 принадлежит владельцу (api с `APP_ORIGIN` из `.env` через ngrok, вход с `http://localhost:3000` даёт 403), свой стек не поднимался, чужой не трогался. Раздел написан и проверен только `node --check`. Прогонит ведущая сессия; сценарий засевает попытки под `dvlab_app` в `dvlab_dev` и возвращает период и предел учителя.
- Карточка в браузере не открывалась: вид в обеих темах и телефон не проверены.
- `yarn build`, `yarn test`, `yarn install`: по распоряжению.

## Deviations from Plan

**1. [Дизайн v65] Сохранение кнопкой Save, а не на изменение.** План: «сохранение на изменение, toast Saved по ответу». README SettingsAssistant (v65, ответ DR-22-04, `22-PLAN-INDEX.md`): у Budget одна кнопка Save и подписи подвала. Сделано по дизайну, тост «Saved» добавлен после ответа 200.

**2. [Дизайн v65] Нет строк warning/reached и «Back on {resetOn}» в карточке.** README: «Reaching 80% and 100% is shown in the chat (ChatModelControls), not here.» Состояние видно по полосе (при `reached` полная) и атрибуту `data-budget-state`; строка о пределе ниже расхода - из дизайна. `state` и `resetOn` остаются в `budgetSnapshot` для 22-15.

**3. Остаток.** В первом варианте превью числа не сходятся (6.20 + 3.80 = 10 при резерве 0.40); взята формула варианта P19: `remaining = cap - spent - held`, совпадающая с правилом допуска.

**4. [Rule 2] P21 в `messages.tsx` (вне `files_modified`).** Must-have плана требует «API credits unavailable» для исчерпания кредитов; до плана код `credits_unavailable` показывал текст настроек модели. Отдельный `case` с текстами P21.

**5. [Rule 3] `scripts/dev-checks/README.md` (вне `files_modified`).** Описаны разделы `budget` обоих сценариев, как у прошлых разделов. `removeChats` (`chat-api.mjs`) и `removeConversations` (`chat-web.mjs`) сначала удаляют `chat_usage_attempts`: без этого ссылка RESTRICT ломает уборку разговоров.

**6. Перенос типа ответа.** `AssistantSettingsResponse` с `budget` и `usage` вошёл в коммит задачи 2 вместе с маршрутом, чтобы typecheck api был зелёным на каждом коммите; схемы снимка - в задаче 1.

**7. `markUnknown` из reserved.** План описывает переход для ушедшего запроса; переход разрешён и из `reserved` (резерв остаётся удержанным - безопасная сторона), `release` по-прежнему только из `reserved`.

## Known Stubs

Нет. Попытки пишет только 22-13 (бегун); до него период и попытки появляются лишь в проверках, а снимок без периода отдаёт нули и предел из настроек.

## Threat Flags

Новых поверхностей нет: `/settings/assistant` под `requireSession` и `requireRole('teacher')`, браузер получает суммы строками и названия своих разговоров, ключ API не участвует. T-22-27 (резерв до сети под блокировкой периода), T-22-28 (расчёт один раз по состоянию, тариф захвачен) закрыты кодом и `chat-api.mjs budget`.

## Для следующих планов

- **22-13:** `reserveAttempt` зовётся внутри транзакции бегуна и коммитится до сети; при `{ ok: false, code }` - блок `refused` с этим кодом. Порядок: `markDispatched` перед `provider.stream`, `settleAttempt(db, logger, attemptId, { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens })` по `usage` SDK (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, null -> 0), обрыв без usage - `markUnknown`, отказ до сети - `release`. `sweepInterrupted`: `dispatched` -> `markUnknown`, `reserved` -> `release`. Тип usage в `budget.ts` не экспортирован (knip); экспортировать при первом внешнем использовании.
- **22-15:** `GET /settings/assistant` уже несёт `budget` (`state`, `resetOn`, `unknownAttempts`) и `usage`; карточки Chat model и Models and limits дописываются в `assistant-card.tsx` над Budget (`AssistantCard`, хук `useAssistantSettings` читает весь ответ). Колонки `model_override` и `effort_override` готовы.
- **22-16:** удаление разговора упирается в `chat_usage_attempts` (RESTRICT): попытки не удаляются (REVOKE), разговор только помечается `deleted_at`. `usageByConversation` показывает и удалённые разговоры по их названию.
- **22-17:** `chat-api.mjs budget` чистит периоды и попытки учителя-фикстуры в `dvlab_test`; `chat-web.mjs budget light|dark` не прогонялся.

## Self-Check: PASSED

Файлы на месте: `apps/api/src/chat/budget.ts`, `apps/web/app/(app)/settings/_components/assistant-card.tsx`, каталоги `packages/db/drizzle/20261013161230_chat_budget` и `20261013161237_chat_budget_revoke_delete`. Коммиты 8319dc3, ba4b5d7, ab9923d есть в ветке (`git rev-list --count c9a8453..ab9923d` = 3). Рабочее дерево чисто по файлам плана (остался только `apps/web/next.config.ts` владельца; `apps/web/AGENTS.md` от `next dev` удалён), своих процессов не оставлено, стек владельца не трогался.
