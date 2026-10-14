---
phase: 22-chat-with-mentions-and-quick-marks
plan: '15'
status: complete
verification: partial
subsystem: api-web
tags: [chat, model-choice, effort, assistant-settings, budget-notice, settings-ui]

requires:
  - phase: 22-11
    provides: 'readAssistantSettings, resolveModelChoice, modelCapabilities, selectionAllowed, GET и PATCH /settings/assistant'
  - phase: 22-12
    provides: 'budgetSnapshot (state ok, warning, reached), карточка Budget'
  - phase: 22-13
    provides: 'provider.availability, chat_turns с моделью и уровнем хода, заглушка chat-fake-anthropic.mjs'
provides:
  - 'contracts/chat.ts: conversationModelRequest, chatConversation с model, effort (nullable), override'
  - 'api chat/conversations.ts: setConversationModel; все выдачи разговора несут действующие значения'
  - 'api routes/chat.ts: PATCH /chat/conversations/:id/model; chatRoutes получает availability'
  - 'web: чипы модели и effort в композере, уведомление о бюджете, карточки Chat model и Models and limits'
  - 'scripts/dev-checks: chat-api.mjs models (CHAT_MODELS_OK), chat-web.mjs models (не запускался)'
affects: [22-16, 22-17]

actuals:
  tokens: 29200
  tasks: 4
  commits: 8
plan_head_before: dc0d5eb60635a5f16b6d1dca7322f4cd82131587
plan_head_after: 1018e6e2ef73a33cf8d02fefc234ec530013d450

key-files:
  created:
    - apps/web/app/(app)/chat/_components/model-controls.tsx
    - apps/web/app/(app)/chat/_components/budget-notice.tsx
    - apps/web/app/(app)/settings/_components/assistant-models.tsx
    - apps/web/components/app/effort-slider.tsx
    - apps/web/lib/usd-text.ts
  modified:
    - packages/contracts/src/chat.ts
    - apps/api/src/chat/conversations.ts
    - apps/api/src/routes/chat.ts
    - apps/api/src/app.ts
    - apps/web/app/(app)/chat/_components/composer.tsx
    - apps/web/app/(app)/chat/_components/use-chat.ts
    - apps/web/app/(app)/chat/_components/chat-screen.tsx
    - apps/web/app/(app)/settings/_components/assistant-card.tsx
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-web.mjs
    - scripts/dev-checks/chat-fake-anthropic.mjs

key-decisions:
  - 'Выбор разговора проверяется только по modelCapabilities(readAssistantSettings, availability) через selectionAllowed; сброс (model и effort равны null) разрешён всегда, даже если модель учителя недоступна'
  - 'Клиент шлёт null вместо значения, равного значению по умолчанию (модель учителя, ближайший по умолчанию уровень), поэтому чипы без отличий выглядят спокойно и переопределения нет'
  - 'Модель, убранная из списка настроек, остаётся на разговоре и отдаётся как есть (effort может быть null); отправка отказывает model_unavailable, подмены нет'
  - 'В новом чате (разговора ещё нет) выбор держится в состоянии и применяется PATCH сразу после создания разговора на первой отправке; провал применения отменяет отправку'
  - 'Смена модели не меняет updated_at (список не переупорядочивается), но поднимает revision'

requirements-completed: [CHAT-09, CHAT-11, CHAT-01]

duration: ~3 ч
completed: 2026-10-14
---

# Phase 22 Plan 15: Выбор модели и effort, форма настроек моделей Summary

Учитель выбирает модель и effort для разговора чипами композера (сервер проверяет выбор по настройкам и доступности у провайдера, идущий ход сохраняет свой выбор), значения по умолчанию, список моделей, тарифы и лимиты запроса правятся в Settings → Assistant, а у композера стоят строка при 80% и баннер при 100% бюджета.

## Задачи и коммиты

| # | Задача | Коммит |
|---|--------|--------|
| 1 | Переопределение модели и уровня разговора, `chat-api.mjs models` | 98370f0 |
| 2 | Чипы модели и effort, уведомление о бюджете | 2d70e73 |
| 3 | Карточки Chat model и Models and limits | 60e2038 |
| 4 | Раздел `models` в `chat-web.mjs` (не запускался) | ad0849e |
| — | Допроверки на пределе и замена пустой проверки (по ревью) | 1018e6e |
| ui | Фокус поля чата по всему блоку композера (запрос владельца) | 8d477fc |
| ui | Область сообщений прозрачна при открытом списке чатов (запрос ведущей, v78) | 3cc065d |
| ui | Чипы модели и уровня в одну строку (скриншот владельца) | 72634ec |

`commits: 8` — мои коммиты: 98370f0, 2d70e73, 8d477fc, 3cc065d, 60e2038, ad0849e, 72634ec, 1018e6e. `git rev-list --count dc0d5eb..HEAD` = 9: ещё один — 5916256 (`fix(22-08)`) параллельного исполнителя. `actuals.tokens` — символы `git show` моих восьми коммитов / 4 (116888 / 4).

## Что построено

- **Контракт и api.** `chatConversation` получил `model`, `effort` (nullable: у убранной из списка модели уровня нет) и `override`; `conversationModelRequest` (`model`, `effort` — оба обязательные, `null` сбрасывает; `expectedRevision`). `setConversationModel` в `conversations.ts`: блокировка, ревизия, затем `selectionAllowed` по результату `modelCapabilities`; своей проверки списка и уровней нет; эффективная модель при `model: null` — модель учителя или первая. `createConversation`, `listConversations`, `readConversation`, `touchConversation`, `renameConversation` читают `readAssistantSettings` и считают действующие значения через `resolveModelChoice`. Маршрут `PATCH /chat/conversations/:id/model` (400, 404, 409). `chatRoutes` получил `availability` (в `app.ts` берётся из `deps.chat?.availability`, как у `settingsRoutes`; без ключа любой выбор даёт 400).
- **Композер.** `model-controls.tsx`: чип модели с меню вверх 300px (строки 48px: имя, Default, строка описания, цифра выбора на десктопе; недоступная модель на 50% и пропускается; «Use default (...)» только при переопределении; «Other models» для моделей после четвёртой; строка «Costs count toward your monthly budget. $X of $Y used.») и чип effort с поповером 288px (слайдер из пяти точек на Base UI Slider, метка Default или Default · recommended, точки выше потолка модели на 30% без доступа к ним и с подсказкой, строка «... goes up to ...», «Use default (...)»). Выбор сохраняется сразу, без Apply. Смена модели понижает effort до ближайшего допустимого. `budget-notice.tsx`: при `warning` строка с жёлтой точкой и Budget, при `reached` баннер «Monthly budget reached» с Open settings; поле, чипы и Send выключены, плейсхолдер «Monthly budget reached». Модель разговора недоступна: Send закрыт, под композером «... is not available. Choose another model.» с кнопкой, открывающей меню (без подмены). Не удалось прочитать настройки: «Model settings are unavailable. Refresh before sending.» с Refresh.
- **use-chat.ts.** Снимок `GET /settings/assistant` читается при открытии и после каждого хода; `chat.models` отдаёт снимок, разговор, ожидающий выбор и `choose` (PATCH с `expectedRevision`, замена разговора в списке на месте; 409 и 404 перечитывают список).
- **Settings.** Карточка Chat model (Select 260px, слайдер effort 260px, сохранение на изменение, toast «Saved» после ответа сервера, состояние «Models unavailable» с Refresh). Карточка Models and limits: порядок стрелками, Edit, Add model, Remove (последнюю убрать нельзя), уровни чипами, default и recommended, четыре тарифа, переключатель Default model, лимиты входа и выхода, один Save на карточку с полным списком одним PATCH, ошибки у полей (клиент проверяет теми же схемами контракта), 400 сервера — «Could not save the models. Try again.». Начальные значения приходят с сервера.
- **Запросы владельца и ведущей.** Клик в любое место композера (кроме кнопок, ссылок, полей и строк списка упоминаний) ставит фокус в поле, кольцо рисуется на блоке через `focus-within` (8d477fc). Область сообщений получает `opacity-0` при открытом списке чатов: 160 мс вперёд, 120 мс назад, `ease-out`, `motion-reduce:transition-none`, размер сохраняется (3cc065d). Содержимое чипов обёрнуто в `inline-flex items-center gap-1 whitespace-nowrap`, имя модели обрезается `max-w-36` (на узком `max-w-24`) (72634ec). Браузерная проверка этих трёх правок не выполнена.

## Проверки

Выполнено:

- `yarn workspace @dv-lab/api typecheck`, `@dv-lab/contracts typecheck`, `@dv-lab/web typecheck`: код 0 после каждой задачи и в конце. `yarn workspace @dv-lab/web lint`: чисто. `yarn knip`: код 0. `node scripts/hygiene-check.mjs`: clean. `prettier --check` по `apps/api/src`, `packages/contracts/src` и изменённым файлам web и скриптов: чисто.
- `node scripts/dev-checks/chat-api.mjs models` (dvlab_test, свой api на порту 4232 с заглушкой Anthropic и ключом-заглушкой): `CHAT_MODELS_OK`, 33 PASS, 0 FAIL. Покрыто: умолчания и порядок моделей из настроек; новый разговор без переопределения; выбор сохраняется, ревизия растёт, `updated_at` не меняется; чтение и список дают одно и то же; устаревшая ревизия 409; модель вне настроек 400; тело без `effort` 400; чужой id 404; без сессии 401; переопределение в строке разговора; сброс null и null; модель, которой нет у провайдера (id с `absent` даёт 404 в Models API), `available: false` и 400 при выборе; уровень выше потолка 400, внутри потолка 200, уровень без модели применяется к модели учителя; убранная из списка модель остаётся на разговоре без подмены, выбрать её снова нельзя, Send даёт `model_unavailable` без хода, сброс разрешён; новое значение по умолчанию меняет только разговоры без своего выбора; идущий ход сохраняет модель и уровень после смены, второй Send во время хода 409, следующий Send берёт новый выбор; на пределе бюджета быстрая форма `/today` отвечает блоком не отказом, платный вопрос заканчивается без ответа с блоком `refused`; в логе api нет ключа и имён фикстур. Уборка: настройки учителя-фикстуры, предел и периоды бюджета возвращены, разговоры удалены в порядке `chat_actions` → `chat_usage_attempts` → `chat_turns` → `chat_messages` (сначала с `reply_to`) → `chat_conversations`.
- `node scripts/dev-checks/chat-api.mjs conversations`: `CHAT_CONVERSATIONS_OK` (форма разговора не сломала прежние проверки).
- `grep -rn "claude-" apps/web/app`: пусто.

Не запускалось (записано в `.planning/WINDOWS.md` как `unrun-verify` для `scripts/dev-checks/chat-web.mjs`):

- `node scripts/dev-checks/chat-web.mjs models light|dark` и `node scripts/dev-checks/wait-dev.mjs down`: стенд владельца занимает порты 3000 и 4000, а раздел сам поднимает api на 4000. Раздел написан, проверен `node --check` и `prettier`, в браузере не исполнялся: его селекторы (`data-slot` у чипов, строк меню, карточек) сверены с компонентами только по коду. Обе темы не проверены.
- Браузером не проверены: чипы и меню вживую, ветка «Other models» (подменю), Tooltip поверх `DropdownTrigger`, слайдер (перетаскивание, клавиши, точки выше потолка), кольцо фокуса и клик по блоку композера, прозрачность области сообщений при списке чатов, исправление строки чипов (скриншот владельца), раскладка на 375px, обе карточки настроек.

## Дизайн

Версия на момент чтения: README ChatModelControls, SettingsAssistant, ModelsAndLimits прочитаны до v80; перед сдачей `~/dv-lab-design/VERSION` = v80 («Models by dragging, a visible Close, the budget as one bar»), файлы ModelsAndLimits и SettingsAssistant обновлены в 01:08 после моего чтения. Карточка Models and limits и Budget построены по более раннему тексту: перетаскивание моделей, видимая кнопка Close и бюджет одной полосой из v80 не учтены. Precondition DR-22-04 и DR-22-05 выполнен: строки 98-100 `22-PLAN-INDEX.md` фиксируют ответы v65, README компонентов на месте.

## Deviations from Plan

**1. [Rule 3 - Blocking] Файлы вне `files_modified`.**
- `apps/api/src/app.ts` — `availability` в `chatRoutes` (без этого выбор нельзя проверить по доступности у провайдера).
- `scripts/dev-checks/chat-fake-anthropic.mjs` — id с `absent` получает 404 в Models API (заглушка недоступной модели).
- `apps/web/components/app/effort-slider.tsx` — пятиточечный слайдер общий для композера и настроек; `apps/web/lib/usd-text.ts` — перевод в центы и доллары общий для уведомления и карточки Budget (копия из `assistant-card.tsx` удалена).
- `apps/web/app/(app)/chat/_components/chat-screen.tsx` — строка `models={chat.models}` в вызове Composer и одна правка прозрачности (запрос ведущей), только свои хунки.
- Коммиты: 98370f0, 2d70e73, 60e2038.

**2. [Rule 2 - Missing] Поле Short description в форме модели.** Контракт требует `description` (1-120 символов), а в README ModelsAndLimits поля нет; без него нельзя добавить модель. Поле стоит под Name и Model id в том же виде. Нужен запрос к Design dude, чтобы поле попало в макет.

**3. [Конфликт плана и дизайна] Успех в Models and limits без toast.** План пишет «toast Saved» для карточки, README ModelsAndLimits: «There is no toast on success: the caption returns to "Saved to your account."». Принят README; toast «Saved» только у карточки Chat model.

**4. [Конфликт плана и дизайна] 100% бюджета.** Must-have плана: «поле и чипы выключены; история и быстрые формы работают». README ChatModelControls: поле, чипы и Send выключены, плейсхолдер «Monthly budget reached». Построено по README (поле выключено), поэтому `/today` и «was» из чата на пределе недоступны в интерфейсе; на сервере быстрые формы не платные (не проходят через `admit`) и работают, это проверено `chat-api.mjs models`. «История» и остальное приложение работают. Решение за владельцем: если быстрые формы на пределе нужны из композера, поле нужно оставить включённым.

**5. [Мелкие отличия]**
- В карточке Models and limits Save выключен, пока форма не валидна (по README), а ошибки поля видны после ухода из поля; свежая пустая строка не объясняет причину до первого blur.
- Цена должна быть больше нуля (схема контракта `priceText`), README говорит «zero or more»; следовал контракту.
- `effort: null` уходит в PATCH только при смене модели по умолчанию; `model` уходит всегда явным id.
- Строка стоимости в меню модели показывает `spentUsd`, строка при 80% — потраченное плюс удержанное.
- В Select карточки Chat model пункт — одна строка «Имя · описание» (компонент Select берёт подпись из строки), а не имя и серый тег.
- Над слайдером одна метка: Default (или Default · recommended), отдельной метки Recommended в поповере композера нет; в карточке Chat model метка Recommended.
- Выход со страницы с несохранёнными изменениями Models and limits вопроса не задаёт (общего механизма в проекте нет).
- Фокус по клику ставится на корневой блок композера (включая подсказку и уведомления), кольцо `focus-within` на самом блоке; оно загорается и при фокусе на кнопках чипов и быстрых действий, у которых есть свой `focus-visible`-контур (двойное кольцо).
- Дата цен «as of 12 Oct 2026» статична, хранения даты правки («edited on ...») нет.

## Known Stubs

- Подпись цен в Models and limits («as of 12 Oct 2026») зашита в компонент, правка тарифа дату не меняет (колонки под дату нет).
- Раздел `models` в `chat-web.mjs` не исполнялся.

## Threat Flags

Нет. Новая поверхность — один маршрут `PATCH /chat/conversations/:id/model` под сессией учителя; выбор принимается только из настроек и доступных у провайдера моделей (T-22-37); форма настроек шлёт полный список одним запросом, проверка схемой на клиенте и сервере (T-22-45). Установок пакетов нет.

## Для следующих планов

- **22-16.** Любая выдача `ChatConversation` теперь читает настройки ассистента; новые пути создания разговора должны идти через `conversations.ts`, иначе схема ответа не сойдётся. Порядок уборки фикстур прежний.
- **22-17.** `chat-api.mjs models` занимает порт 4232 и сам поднимает api с `chat-fake-anthropic.mjs` (ключ-заглушка, `CHAT_FAKE_DELAY_MS=5`), не параллелить с `budget` и `chat-config.mjs` (меняют настройки и периоды учителя-фикстуры); id с `absent` в общей заглушке всегда 404. `chat-web.mjs models` сбрасывает настройки ассистента dev-учителя к умолчаниям, засевает период бюджета и возвращает всё в конце; ему нужен свободный порт 4000 и `next dev` на 3000; до первого запуска он числится как `unrun-verify`.
- **Дизайн v80.** Models and limits (перетаскивание, видимый Close) и Budget одной полосой не реализованы; нужен короткий UI-план или правка перед финальной приёмкой. Поле Short description нужно согласовать с Design dude.
- Файл `.planning/WINDOWS.md` изменён записью `unrun-verify` и остался в рабочем дереве (в commit `docs` идёт только SUMMARY).

## Self-Check: PASSED

Файлы из `key-files.created` существуют; коммиты 98370f0, 2d70e73, 8d477fc, 3cc065d, 60e2038, ad0849e, 72634ec, 1018e6e есть в `git log`.
