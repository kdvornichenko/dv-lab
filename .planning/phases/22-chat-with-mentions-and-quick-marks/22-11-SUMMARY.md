---
phase: 22-chat-with-mentions-and-quick-marks
plan: '11'
status: complete
verification: partial
subsystem: api-db-contracts
tags: [chat, anthropic-sdk, assistant-settings, model-config, teacher-settings, migration]

requires:
  - phase: 22-06
    provides: 'chat-schema.ts и entry-schema.ts в drizzle.config.ts, паттерн миграций и dev-checks chat-api.mjs'
provides:
  - 'api: @anthropic-ai/sdk 0.133.0 (точно), ApiConfig.chat = { enabled: false } | { enabled: true, apiKey }'
  - 'db: шесть колонок chat_* в teacher_settings с DEFAULT и CHECK, миграция только ADD COLUMN и ADD CONSTRAINT'
  - 'contracts/chat-settings.ts: chatEffort, chatModelEntry, chatModels, assistantSettings, saveAssistantSettingsRequest, modelCapability, CHAT_SETTINGS_DEFAULT, usdTextToCents'
  - 'api settings/settings.ts: readAssistantSettings, saveAssistantSettings'
  - 'api chat/model-config.ts: resolveModelChoice, modelCapabilities, selectionAllowed'
  - 'api routes/settings.ts: GET и PATCH /settings/assistant'
  - 'scripts/dev-checks/chat-config.mjs (CHAT_CONFIG_OK)'
affects: [22-12, 22-13, 22-15, 22-16, 22-17]

actuals:
  tokens: 21000
  tasks: 5
  commits: 3
plan_head_before: fac3f775aa7484a3f8f452123039a290b4149022
plan_head_after: e12e3fd

tech-stack:
  added: ['@anthropic-ai/sdk 0.133.0']
  patterns:
    - 'Настройки ассистента лежат колонками teacher_settings; список моделей chat_models jsonb null = CHAT_SETTINGS_DEFAULT.models'
    - 'Модель, не вошедшая в список, не подменяется: resolveModelChoice отдаёт unavailable с id'
    - 'selectionAllowed по результату modelCapabilities - единственная проверка выбора модели и уровня'

key-files:
  created:
    - packages/contracts/src/chat-settings.ts
    - packages/db/drizzle/20261013130032_chat_settings/migration.sql
    - packages/db/drizzle/20261013130032_chat_settings/snapshot.json
    - apps/api/src/chat/model-config.ts
    - scripts/dev-checks/chat-config.mjs
  modified:
    - apps/api/package.json
    - yarn.lock
    - apps/api/src/config.ts
    - apps/api/test/config.test.ts
    - packages/db/src/schema.ts
    - packages/contracts/src/index.ts
    - apps/api/src/settings/settings.ts
    - apps/api/src/routes/settings.ts
    - apps/api/src/app.ts
    - apps/api/src/server.ts
    - .env.example
    - deploy/env.example

key-decisions:
  - 'Верхняя граница maxOutputTokens - 128000 (CHAT_MAX_OUTPUT_TOKENS_LIMIT): у всех четырёх моделей по умолчанию документированный максимум выхода 128K, значит наименьший тоже 128K'
  - 'Уровень учителя (settings.effort) относится только к модели учителя (или первой в списке); для другой модели из переопределения берётся её defaultEffort'
  - 'Имя модели по умолчанию без пометки (Default): «Haiku 5.5»; пометку по первой позиции списка рисует интерфейс'
  - 'Тарифы и список моделей хранятся в записи модели (jsonb), предел десятичной строкой numeric(10,2); перевод в нано-доллары остаётся за chat/budget.ts (22-12)'

requirements-completed: [CHAT-09, CHAT-11]

duration: ~50 мин
completed: 2026-10-13
---

# Phase 22 Plan 11: Официальный SDK и настройки ассистента Summary

Официальный `@anthropic-ai/sdk` 0.133.0 стоит точной версией, ключ читает только `loadConfig`, а модели, тарифы, лимиты запроса и месячный предел стали настройками учителя в `teacher_settings` со значениями по умолчанию ($10, Haiku 5.5 → Sonnet 5.5 → Opus 5.5 → Fable 5.1, 100 000 входа и 16 000 выхода) и маршрутами `GET` и `PATCH /settings/assistant`.

## Задачи и коммиты

| # | Задача | Коммит |
|---|--------|--------|
| 1 | Свежая проверка пакета (только чтение) | без коммита |
| 2 | Подтверждение владельца (получено заранее) | без коммита |
| 3 | Установка SDK и ключ в `loadConfig` | 069ca7b |
| 4 | Колонки настроек, миграция, контракт, чтение и сохранение | 384fcb5 |
| 5 | Выбор модели, маршруты, имя переменной, `chat-config.mjs` | e12e3fd |

`commits: 3` - мои коммиты. `git rev-list --count fac3f77..HEAD` = 5: ещё два коммита параллельного исполнителя 22-07 (722c117 и 95732c4) легли в ветку между моими.

## Задача 1: проверка пакета (2026-10-13, 12:58 UTC)

- Последняя версия: `0.133.0`, опубликована 2026-10-09T15:44:11Z (старше четырёх суток; барьер 1440 минут пройден). Предыдущая `0.132.1` - 2026-10-08.
- Репозиторий: `git+https://github.com/anthropics/anthropic-sdk-typescript.git`. Подпись реестра и провенанс SLSA (`attestations.provenance`) есть.
- Скрипты пакета: `fix`, `lint`, `test`, `build`, `format`, `test:ecosystem`. `preinstall`, `install`, `postinstall` отсутствуют, `prepare` нет.
- Пакет приносит транзитивно пять пакетов: `json-schema-to-ts` 3.1.1, `ts-algebra` 2.0.0, `standardwebhooks` 1.1.1, `@stablelib/base64` 1.0.1, `fast-sha256` 1.3.0 (и расширение диапазона у уже стоявшего `@babel/runtime`). Скриптов установки нет ни у одного (`yarn npm info ... scripts`). `peerDependencies`: `zod` необязательный.
- Совместимость с Node 24 и TypeScript 6.0.3: `yarn workspace @dv-lab/api typecheck` после установки зелёный.
- Других пакетов (Vercel AI SDK, Managed Agents, клиенты MCP) не рассматривалось.

## Задача 2: ответ владельца

Решение владельца 2026-10-13 получено до запуска: брать самую новую версию, закреплять точно, барьер 1440 не отключать, версия не младше суток. Условия остановки (версия младше суток или неожиданные скрипты установки) не наступили, поэтому установка выполнена. `yarn config get npmMinimalAgeGate` = 1440, `.yarnrc.yml` не менялся.

## Что сделано

- **Установка.** `yarn workspace @dv-lab/api add --exact @anthropic-ai/sdk@0.133.0`; `apps/api/package.json` получил одну строку `"@anthropic-ai/sdk": "0.133.0"`, `yarn.lock` - записи SDK и пяти транзитивных пакетов. Других установок нет.
- **Конфигурация.** `ApiConfig.chat`: нет `ANTHROPIC_API_KEY` - `{ enabled: false }`; пустая или из пробелов строка - ошибка запуска `Invalid ANTHROPIC_API_KEY` без значения; иначе `{ enabled: true, apiKey }` (обрезан по краям). `ANTHROPIC_API_KEY` в `apps/api/src` встречается только в `config.ts`. `server.ts` передаёт `chatEnabled: config.chat.enabled` в `createApp`, `app.ts` - в `settingsRoutes`. Ключ не логируется и не уходит в ответы.
- **База.** Каталог миграции `packages/db/drizzle/20261013130032_chat_settings` (`yarn db:generate --name chat_settings`, SQL руками не правился): шесть `ADD COLUMN` (`chat_monthly_cap_usd numeric(10,2) default 10.00`, `chat_max_input_tokens default 100000`, `chat_max_output_tokens default 16000`, `chat_models jsonb`, `chat_model text`, `chat_effort text`) и четыре `ADD CONSTRAINT` (`teacher_settings_chat_cap_ck` > 0, `..._chat_input_ck` 1000..100000, `..._chat_output_ck` >= 1000, `..._chat_effort_ck` пять уровней или null). Второй `yarn db:generate`: «No schema changes». Миграция применена к `dvlab_test` (21 миграция) и `dvlab_dev` (24).
- **Контракт.** `chat-settings.ts`: строгие схемы; id модели `claude-[a-z0-9-]+` до 64 символов; 1..12 моделей с уникальными id; `defaultEffort` и `recommendedEffort` из `efforts`; цены - десятичные строки больше нуля до шести знаков; предел 0.01..10000 USD десятичной строкой (`usdTextToCents` считает целые центы разбором строки, без `Number` и `parseFloat` в `settings.ts`); `maxInputTokens` 1000..100000; `maxOutputTokens` 1000..128000; `model` и `effort` сбрасываются `null`; `models: null` возвращает список по умолчанию. `CHAT_SETTINGS_DEFAULT` содержит четыре модели таблицы objective в её порядке.
- **Чтение и сохранение.** `readAssistantSettings` отдаёт `CHAT_SETTINGS_DEFAULT`, если строки нет; `chat_models = null` - список по умолчанию; сохранённый jsonb разбирается `chatModels` (неверный - ошибка, не подмена). `saveAssistantSettings` - одна транзакция с блокировкой аккаунта, upsert; итоговое состояние проверяется целиком: модель есть в списке, уровень среди уровней модели (или первой модели, если `model = null`), иначе `{ ok: false, error: 'invalid' }` без записи. Удаление модели учителя из списка сбрасывает `model` и `effort`; если модель осталась, а её уровень пропал из `efforts` - сбрасывается только `effort`.
- **Выбор модели.** `resolveModelChoice(settings, override)`: модель переопределения, иначе `settings.model`, иначе первая; вне списка - `{ kind: 'unavailable', modelId }`; уровень понижается до ближайшего поддерживаемого не выше прежнего (если ниже ничего нет - самый низкий поддерживаемый). Результат несёт запись модели с тарифом и лимиты из настроек. `modelCapabilities(settings, available)` - проекция без тарифов в порядке списка; `selectionAllowed(capabilities, modelId, effort)` - допустимость выбора по её результату.
- **Маршруты.** `GET /settings/assistant` -> `{ settings, capabilities }` (учитель под сессией; `no-store`); `PATCH` -> 200 тем же видом; неверное тело, не-JSON и `invalid` -> 400 `invalid_request`. Доступность (`available`) сейчас равна `chatEnabled`: без ключа все модели недоступны.
- **Имя переменной.** `ANTHROPIC_API_KEY=` дописано в конец `.env.example` и `deploy/env.example` (только имя). Пояснительные комментарии не добавлены: в обоих файлах комментариев нет, правило проекта - без комментариев. Что значение лежит в `.env` локально и в `api.env` на сервере (Server guy), а модели и предел задаются в Settings, зафиксировано здесь. `deploy/compose.yaml` не менялся.

## Граница maxOutputTokens

`CHAT_MAX_OUTPUT_TOKENS_LIMIT = 128000`. Источник: официальная документация Claude API (навык `claude-api`, разделы Common Pitfalls «128K output tokens» и описания моделей, кэш от 2026-10-06): Fable 5.1, Opus 5.5, Sonnet 5.5 и Haiku 5.5 поддерживают до 128K `max_tokens`, то есть наименьший документированный максимум выхода среди моделей по умолчанию тоже 128K. Значение по умолчанию остаётся 16 000. Запросы с большим `max_tokens` SDK требует делать потоково (22-13). Проверка через Models API (`max_tokens`) не выполнялась: ключа в среде проверок нет.

## Проверки

Выполнено:

- `yarn workspace @dv-lab/db|contracts|api typecheck`: код выхода 0 после каждой задачи и в конце. `prettier --check` по `apps/api/src`, `packages/contracts/src`, `packages/db/src`, `chat-config.mjs`: чисто.
- `yarn db:generate` дважды: второй раз «No schema changes»; `git status --porcelain packages/db/drizzle`: только новый каталог плана.
- `yarn workspace @dv-lab/api exec vitest run test/config.test.ts`: 15 тестов, зелёные (в ожидаемый объект добавлено `chat: { enabled: false }`). Файл не трогает базу.
- `node scripts/dev-checks/chat-config.mjs` (dvlab_test, порт 4231, api стартует без ключа): `CHAT_CONFIG_OK`, 84 PASS, 0 FAIL. Покрыто: ключ (нет, пустой, из пробелов, значение не в тексте ошибки, обрезка, в `config.chat` только `enabled` и `apiKey`); значения по умолчанию без строки и у существующей строки учителя, колонки и их DEFAULT в `information_schema`, `chat_models` остаётся `null`; сохранение смены порядка, тарифа, лимитов и предела (`'25.5'` читается `'25.50'`); отказ `invalid` без записи (модель вне списка, уровень вне уровней модели) со сверкой строки до и после; отказ схемы (повтор id, `defaultEffort` вне `efforts`, пустой и 13-элементный список, нулевой тариф, id не `claude-*`, вход 150 000 и 999, выход выше границы, предел 0, 0.00, 10000.01, три знака, экспонента, неизвестный уровень и ключ, пустое тело); границы принимаются; сброс выбора при удалении модели, сброс уровня при потере уровня, `models: null`; CHECK базы при прямом `UPDATE` (предел 0, вход 100001 и 999, выход 999, неизвестный уровень); `resolveModelChoice` для первой модели, модели и уровня учителя, переопределения, неутечки уровня на другую модель, отсутствующей модели (разговора и учителя), понижения (вверх до `high`, вниз до `low`, нет ниже - самый низкий); `modelCapabilities` и `selectionAllowed`; HTTP: GET 200 и `no-store`, без ключа все модели `available: false`, в ответе нет поля ключа, семь неверных тел PATCH дают 400 `invalid_request`, строка не изменилась, `text/plain` даёт 400, верный PATCH 200 и чтение назад, `GET /settings` прежней формы, без сессии 401, ученик 403 на GET и PATCH; в логе api нет значения ключа. Строка `teacher_settings` учителя-фикстуры возвращена в исходное состояние.
- `grep -rn "CHAT_MODEL_PROFILES_JSON" apps .env.example deploy`: пусто. `grep` по `Number(` и `parseFloat` в `settings.ts`: пусто.
- `git show --stat` коммита задачи 5 не содержит `deploy/compose.yaml`.

Не запускалось:

- `yarn workspace @dv-lab/api test` целиком (чистит `dvlab_test` через TRUNCATE, параллельно работает 22-07). Его гонит итоговый план 22-17. Из набора выполнен только `config.test.ts` отдельно.
- `yarn build`, `yarn knip`, `yarn lint`, web typecheck - по распоряжению и правилам фазы (knip до итогового плана может быть красным: SDK пока нигде не импортируется).
- Реальный вызов Messages API и проверка доступности моделей у провайдера: ключа в среде проверок нет, транспорт и `provider.availability` добавляет 22-13.
- Браузер: UI в плане нет.

## Deviations from Plan

**1. [Rule 3] `app.ts` и `server.ts` вне `files_modified`.** Маршруту настроек нужен признак `config.chat.enabled` для `available` в `capabilities`; через `AppDeps.chatEnabled` (необязательное поле, по умолчанию `false`) он доходит до `settingsRoutes`. Правка - три строки.

**2. Уровень учителя не переносится на другую модель.** План: уровень - переопределения, иначе `settings.effort`, иначе `defaultEffort` модели. Реализовано: `settings.effort` берётся, только если выбранная модель - модель учителя (или первая в списке при `settings.model = null`); для остальных моделей из переопределения - `defaultEffort`. Иначе `max`, выбранный учителем для Haiku, при переключении разговора на Fable 5.1 тихо давал бы самый дорогой режим. Если 22-13/22-15 ждут буквального порядка, правка в одном месте `resolveModelChoice`.

**3. Дополнительный экспорт `selectionAllowed`.** План требует, чтобы проверку выбора держал один модуль и результат `modelCapabilities`; функция оформлена как `selectionAllowed` в `model-config.ts`, чтобы 22-13 и 22-15 вызывали её, а не писали свои проверки.

**4. Имя модели без «(Default)».** В таблице objective `Haiku 5.5 (Default)`; в `CHAT_SETTINGS_DEFAULT` имя `Haiku 5.5`, потому что порядок списка меняется учителем, а пометка по умолчанию принадлежит первой позиции (рисует интерфейс, 22-15).

**5. Комментарии в env-примерах не добавлены** (см. выше): в файлах их нет, правило проекта запрещает комментарии.

**6. Транзитивные зависимости.** Must-have «установлен ровно один пакет» понят как один прямой пакет: Yarn добавил пять транзитивных пакетов SDK без скриптов установки (см. Задачу 1).

## Known Stubs

Нет. `available` в `capabilities` пока равна только наличию ключа: проверка модели у провайдера - 22-13 (так задумано планом).

## Threat Flags

Новых поверхностей сверх threat_model плана нет: `/settings/assistant` под `requireSession` и `requireRole('teacher')`, тело строго валидируется, тарифы видит только учитель под своей сессией.

## Для следующих планов

- **22-12 (бюджет):** предел и тарифы читать из `readAssistantSettings`: `monthlyCapUsd` строка с центами (`'10.00'`), цены в `settings.models[i].pricing` десятичные строки USD за 1M токенов (вход, запись кэша 5 мин, чтение кэша, выход); перевод в нано-доллары - `usdToNano` в `chat/budget.ts`, на момент попытки. `resolveModelChoice(...).model.pricing` уже несёт тариф выбранной модели, `maxInputTokens`/`maxOutputTokens` - лимиты резерва.
- **22-13 (Messages):** `config.chat` - `{ enabled, apiKey }` для `new Anthropic({ apiKey })`; `output_config.effort` брать из `resolveModelChoice(...).effort`; перед запуском хода проверять выбор `selectionAllowed(await modelCapabilities(settings, provider.availability), ...)`; запросы с `max_tokens` выше 16 000 и до 128 000 делать потоково. Fable 5.1 требует хранения данных 30 дней (политика, 22-16).
- **22-15 (форма настроек и меню):** `GET /settings/assistant` отдаёт и `settings` (с тарифами, редактируемыми учителем), и `capabilities` (меню). `PATCH` принимает любое непустое подмножество полей; `models: null` сбрасывает список к умолчанию; изменение списка само сбрасывает `model`/`effort`, если они выпали. Ошибка 400 не различает причины (`invalid_request`); текст ошибки формы - за дизайном.
- **22-17 (итог):** `yarn workspace @dv-lab/api test` и `yarn knip` не запускались здесь; knip увидит `@anthropic-ai/sdk` неиспользуемым, пока 22-13 его не импортирует. `chat-config.mjs` меняет и возвращает строку `teacher_settings` учителя-фикстуры в `dvlab_test`.
- Ключ `ANTHROPIC_API_KEY` в локальном `.env` уже есть (значение не читалось): dev-api с `.env` стартует с `chat.enabled = true`; `.env.test` ключа не содержит.

## Self-Check: PASSED

Файлы найдены: `packages/contracts/src/chat-settings.ts`, `apps/api/src/chat/model-config.ts`, `scripts/dev-checks/chat-config.mjs`, `packages/db/drizzle/20261013130032_chat_settings/migration.sql` и `snapshot.json`. Коммиты 069ca7b, 384fcb5 и e12e3fd есть в ветке. Рабочее дерево чисто по файлам плана (остался только `apps/web/next.config.ts` владельца), процессов не оставлено (api проверки остановлен самим скриптом).
