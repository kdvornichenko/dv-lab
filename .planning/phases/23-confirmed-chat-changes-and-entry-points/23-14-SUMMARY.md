---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '14'
subsystem: docs-and-gate
tags: [docs, dev-checks, gate, privacy, runbook, chat]
status: complete

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 'планы 23-01…23-13 и правки чата вне плана (23-CHAT-FIXES.md)'
provides:
  - 'chat-final.mjs прогоняет api-проверки фаз 22 и 23 (28 проверок, CHAT_FINAL_OK)'
  - 'AGENTS.md: владельцы предложений из чата, ревизий, пояса ввода, эссе, точек входа, автоназвания, набранных упоминаний, STRICT_TOOLS'
  - 'scripts/dev-checks/README.md: раздел «Проверки фазы 23» и живые проверки владельца'
  - 'privacy: подтверждаемые изменения из чата и вставленный текст (эссе) уходит Anthropic'
  - 'deploy/RUNBOOK.md: раздел 15 (миграции фазы 23, проверки, откат), миграция student_gender в 14.2'
affects: [выкатка фазы 22-23, сессия владельца]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - AGENTS.md
    - scripts/dev-checks/README.md
    - apps/web/app/privacy/page.tsx
    - scripts/dev-checks/chat-final.mjs
    - deploy/RUNBOOK.md
    - scripts/dev-checks/chat-target.mjs
    - scripts/dev-checks/chat-web.mjs

key-decisions:
  - 'chat-tools-schema.mjs не входит в chat-final: при ключе в корневом .env он шлёт живой запрос к Anthropic, а chat-final закрыт от Google и Anthropic'
  - 'Подзапрос пояса в chat-target.mjs берёт только активного учителя-фикстуру (как calendar-seed.mjs); данные dvlab_test не правились'
  - 'ledger-api.mjs balance не чинился: с 25.1 POST /lessons идёт через журнал команд календаря (202, нужен calendarCommands и expectedVersion из окна недели), правка — не фикстура, а переписывание проверки'
  - 'e2e не запускались: в dvlab_dev текущее подключение Google активное с настоящим токеном, аккаунт не подтверждён как тестовый; прогон на dvlab_test требует перезапуска стека владельца'

requirements-completed: [CHAT-05, CHAT-06, CHAT-10, CHAT-12, SHELL-03, SHELL-04, CARD-05]

actuals:
  tokens: 20300
  tasks: 3
  commits: 4
plan_head_before: 0372253319d0d7b79b4dd81d71131a24f39656c4
plan_head_after: 88c3c7aae0d37e290b6bed6ce05bf1d4686ae402

duration: 55min
completed: 2026-10-14
---

# Фаза 23, план 14: документы и итоговая проверка фазы — итоги

**`chat-final.mjs` прогоняет 28 api-проверок фаз 22 и 23 без Google и Anthropic (`CHAT_FINAL_OK`); typecheck, lint, Prettier по исходникам фазы, knip, `yarn test`, сборки api и web зелёные; браузерные разделы фазы 23 пройдены в обеих темах; AGENTS.md, README проверок, privacy и RUNBOOK описывают фазу 23 фактами.**

## Производительность

- Начало около 15:45 UTC+7, конец около 16:40 UTC+7 (2026-10-14), из них около 15 минут прогон `chat-final.mjs`.
- Задачи: 3 из 3, коммитов задач 4 (измерено `git rev-list --count 0372253..HEAD`).
- Изменено файлов: 7.

## Коммиты

1. `886530e` fix(23-14): подзапрос пояса в `chat-target.mjs` берёт только активного учителя-фикстуру (перенос из 23-07).
2. `c872863` docs(23-14): AGENTS.md, README проверок, privacy (задача 1).
3. `0201f4d` feat(23-14): проверки фазы 23 в `chat-final.mjs`, раздел 15 RUNBOOK (задача 2).
4. `88c3c7a` fix(23-14): ожидаемый список команд чата под `/essay` в `chat-web.mjs` и README (задача 3).

## Что сделано

- AGENTS.md, «Модули-владельцы»: ревизии `students.revision` и `payments.revision` (писатели, `expectedRevision`, `409 precondition_failed`, `insertPayment`, `PATCH /payments/:id` той же строки, `setCardRate`); хранилище предложений в `chat_actions` kind `change` и модули `changes.ts`, `change-cards.ts`, `change-deletions.ts`, `bulk-move.ts`, `calendar.ts`; копирование значений из текста учителя (`saidIn`, `parseMoney`, `parseLessons`); `command-zone.ts` и `inputTimeZone` команды `move_series`; `essay.ts` и `essay-feedback.tsx`; блоки предложений в web, палитра и прибытия `/?dialog=payment`, `/chat?new=1&student=<id>`, `/students/<id>?tab=lessons|payments&payment=<id>`, `lessons-tab.tsx`, `reload-notice.tsx`. Правки чата вне плана (23-CHAT-FIXES): `typedMentions` в `mentions.ts`, `title.ts` (`nameConversation`), `STRICT_TOOLS` в `tools.ts` с указанием на `chat-tools-schema.mjs`. «Помощники для агентов»: состав `chat-final.mjs` и браузерные скрипты фазы 23.
- README проверок: раздел переименован в «Проверки фазы 23»; добавлены `cards-revision.mjs`, `chat-bulk.mjs` (`zone`, `proposal`, `children`), раздел `essay` у `chat-changes.mjs`, `changes-web.mjs` `forms`, `bulk`, `essay`, `entry-web.mjs lessons` и определение origin dev-api пробой, `phone-web.mjs` (пять разделов, `PHONE_VERBOSE=1`), подраздел «Живые проверки владельца фазы 23»; описание `chat-final.mjs` обновлено (состав, порты до 4246, почему нет `chat-tools-schema.mjs`).
- privacy, раздел Chat assistant: вставленный текст (например, эссе) уходит Anthropic как часть разговора; изменения, которые предлагает ассистент (оплаты, новые ученики, ставки, архив, удаления, переносы уроков), записываются только после подтверждения учителем и становятся обычными записями, которые открываются и исправляются обычными формами. Заголовки разделов не менялись.
- `chat-final.mjs`: после проверок фазы 22 — `cards-revision.mjs`, `chat-changes.mjs` `payment|cards|deletions|essay`, `chat-bulk.mjs` `zone|proposal|children`. Остальное поведение прогона прежнее.
- RUNBOOK: раздел 15 — миграции `20261014040312_chat_changes` и `20261014044620_card_payment_revision` под `dvlab_migrator`, новых переменных нет, compose, поток и Caddy без изменений, проверка колонок, живые сценарии — владелец, откат (образ фазы 22 строго разбирает блоки и не откроет разговоры с `change_proposal` и `essay`). В 14.2 добавлена пропущенная миграция `20261013195421_student_gender`.

## Ворота качества

| Проверка | Результат |
|----------|-----------|
| `node scripts/dev-checks/chat-final.mjs` | `28/28 checks passed`, `CHAT_FINAL_OK` (из них 8 новых проверок фазы 23; `calendar-final` 184 с) |
| `node scripts/dev-checks/chat-api.mjs target` (до chat-final, после правки подзапроса) | `CHAT_TARGET_OK` |
| `yarn typecheck` | код 0, 5 задач |
| `yarn lint` | код 0 |
| Prettier по исходникам фазы (команда плана) | «All matched files use Prettier code style!» |
| `yarn knip` | код 0, только подсказки конфигурации |
| `yarn format:check` | код 1, как и до фазы: только документы `.planning` и пять старых файлов (`apps/web/components/ui/input.tsx`, `textarea.tsx`, `scripts/dev-checks/count-dialog-shot.mjs`, `wait-dev.mjs`, `scripts/privacy-check.mjs`); файлов фазы 23 в списке нет |
| `yarn test` | код 0: contracts 48, db 21, api 47 тестов |
| `yarn workspace @dv-lab/api build` | код 0, 16 файлов в `apps/api/dist` |
| Сборка web | зелёная: `@dv-lab/web:build` внутри `yarn test` (turbo, «Compiled successfully», 13 страниц) и отдельно в копии `apps/web` во временной папке (`next build --webpack`, код 0) |
| Ссылки ответа чата (F-02 из 22-REVIEW-FIX), разовый скрипт вне репозитория, обе темы | путь `/students` — ссылка; `//host`, `https:/host`, внешний адрес — текст; `/\host` разбирается в `/%5Chost` того же origin. `LINKS_OK` |

### Браузерные разделы (стек владельца на 3000 и 4000, обе темы)

| Раздел | light | dark |
|--------|-------|------|
| `changes-web.mjs forms` | `CHANGES_WEB_FORMS_OK` (23) | OK (23) |
| `changes-web.mjs proposals` | `CHANGES_WEB_PROPOSALS_OK` (43) | OK (43) |
| `changes-web.mjs bulk` | `CHANGES_WEB_BULK_OK` (21) | OK (21) |
| `changes-web.mjs essay` | `CHANGES_WEB_ESSAY_OK` (19) | OK (19) |
| `changes-web.mjs title` | `CHANGES_WEB_TITLE_OK` (18) | OK (18) |
| `entry-web.mjs palette` | `ENTRY_WEB_PALETTE_OK` (21) | OK (21) |
| `entry-web.mjs ask` | `ENTRY_WEB_ASK_OK` (12) | OK (12) |
| `entry-web.mjs lessons` | `ENTRY_WEB_LESSONS_OK` (26) | OK (26) |
| `phone-web.mjs today` | `PHONE_WEB_TODAY_OK` (139) | OK (139) |
| `phone-web.mjs schedule` | `PHONE_WEB_SCHEDULE_OK` (113) | OK (113) |
| `phone-web.mjs chat` | `PHONE_WEB_CHAT_OK` (95) | OK (95) |
| `phone-web.mjs profile` | `PHONE_WEB_PROFILE_OK` (168) | OK (168) |
| `phone-web.mjs palette` | `PHONE_WEB_PALETTE_OK` (37) | OK (37) |
| `chat-web.mjs records` (после правки списка команд) | `CHAT_WEB_RECORDS_OK` | OK |
| `chat-web.mjs composer` (после правки списка команд) | `CHAT_WEB_COMPOSER_OK` | OK |
| `chat-web.mjs delete` (страница privacy) | OK со второго запуска (первый: таймаут 15 с ожидания автоназвания в строке списка) | OK |
| `chat-web.mjs notes` | `CHAT_WEB_NOTES_OK` | OK |
| `chat-web.mjs budget` | `CHAT_WEB_BUDGET_OK` | OK |
| `chat-web.mjs models` | 2 FAIL, известные (ниже) | не запускался |
| `chat-web.mjs answers` | FAIL (ниже) | FAIL |
| `chat-web.mjs comments`, `actions` | FAIL (ниже) | FAIL |

Скрипты запускались без `ANTHROPIC_*` в окружении. После прогонов: свои порты 4241–4299 свободны, процессов не осталось, в `dvlab_test` карточек `Alex Example` нет, в `dvlab_dev` осталась только `Alex Example 2183` (ниже).

## Критерии успеха фазы

| SC | Статус | Доказательство |
|----|--------|----------------|
| SC1: оплата, новый ученик, удаление, ставка — превью, подтверждение, отказ без изменений | Выполнен локально | `chat-final.mjs`: `CHAT_CHANGES_PAYMENT_OK`, `CHAT_CHANGES_CARDS_OK`, `CHAT_CHANGES_DELETIONS_OK`; `changes-web.mjs proposals light|dark` |
| SC2: перенос серий в MSK и во вьетнамском времени без пояса, после подтверждения | Выполнен локально (Google — заглушка) | `chat-final.mjs`: `CHAT_BULK_ZONE_OK`, `CHAT_BULK_PROPOSAL_OK`, `CHAT_BULK_CHILDREN_OK`; `changes-web.mjs bulk light|dark` |
| SC3: изменение из чата исправляется обычными формами, один остаток и расписание | Выполнен локально | `chat-final.mjs`: `CARDS_REVISION_OK`, `CHAT_CHANGES_PAYMENT_OK`; `changes-web.mjs forms light|dark` |
| SC4: отзыв на эссе с пометкой приблизительной оценки | Выполнен локально (модель — заглушка) | `chat-final.mjs`: `CHAT_CHANGES_ESSAY_OK`; `changes-web.mjs essay light|dark` |
| SC5: палитра, профиль, телефон | Выполнен локально (эмуляция ширины) | `entry-web.mjs palette|ask|lessons`, `phone-web.mjs today|schedule|chat|profile|palette`, обе темы |

## NOT RUN

- `yarn test:e2e`: в `dvlab_dev` текущее подключение Google в состоянии `connected` с активным токеном; что это тестовый аккаунт владельца, проверить нельзя без вывода данных аккаунта, а сценарии e2e пишут уроки через журнал команд. Вариант `E2E_FIXTURE_DATABASE=test` требует перезапустить стек владельца на `.env.test`, это запрещено заданием. Известные падения по 22-17 (диалог `#move-series-*`, удалённый в 25.1): `changeSeries`, `cutSeriesToWednesday`, `calendar-series-ui.ts`, `tz-schedule.ts` `crossZoneTail`, `tz-stale-forms.ts`, `marks.spec.ts` `blockedDialog`/`pendingDialogMark`/`clockPermissions`, `move.spec.ts` `restoredTail`/`staleEmptySeries`/`movedFallback`.
- `changes-web.mjs payment`, `chat-web.mjs stream`, `chat-web.mjs calendar`, `schedule-started-web.mjs`: нужен свободный порт 4000 (стек владельца не останавливается); `stream` к тому же не идёт через `page.route`.
- `chat-web.mjs conversations`: ход идёт в dev-api владельца с настоящим ключом модели.
- `schedule-web.mjs`: разделы с записью идут через журнал команд в подключённый Google `dvlab_dev` (аккаунт не подтверждён как тестовый).
- `chat-tools-schema.mjs`: при ключе в `.env` шлёт живой запрос к Anthropic.
- `ledger-api.mjs balance`: запущен один раз, `FAIL balance crashed single lesson create returned 400` (причина ниже).
- `wait-dev.mjs down`: не применимо, порты 3000 и 4000 занимает стек владельца, он работает (`/login`, `/privacy` 200, `/healthz` 200).

## Живые проверки владельца

- Настоящая модель с ключом владельца: оплата, новый ученик, ставка, архив и удаление, массовый перенос из живого текста (русский и английский), отзыв на эссе `/essay`; расход по `usage`; `chat-tools-schema.mjs` с ключом; полный ход с автоназванием через UI.
- Запись в Google только на тестовом аккаунте владельца: конец серии и массовый перенос с MSK и без пояса, частичный итог при изменении события в Google.
- Экранная клавиатура настоящего телефона в чате (Send и кнопки решения видны), реальные iOS Safari и Android Chrome.
- `yarn test:e2e` на dev-стеке в обеих темах, когда в `dvlab_dev` подключён тестовый аккаунт Google.
- CR-02 из 22-REVIEW-FIX вручную: перенёс вхождение, отменил в чате, Undo даёт `stale`.
- Выкатка — Server guy по разделам 14 и 15 RUNBOOK: миграции `20261013195421_student_gender` (фаза 22), `20261014040312_chat_changes`, `20261014044620_card_payment_revision`, новых переменных окружения нет.

## Отклонения от плана

### Автоисправления

**1. [Правило 3] Подзапрос пояса в `scripts/dev-checks/chat-target.mjs` (файла нет в плане)**
- `chat-api.mjs target` падал на подготовке (SQL 21000): в `dvlab_test` у логина учителя-фикстуры две строки `teacher_settings` (деактивированный и активный аккаунт). Подзапрос теперь берёт `role = 'teacher' and status = 'active'`, как `calendar-seed.mjs`. Без правки `chat-final.mjs` останавливался бы на `target`. Коммит `886530e`.

**2. [Правило 1] Список команд чата в `scripts/dev-checks/chat-web.mjs` и README (файлов нет в плане)**
- 23-13 добавил `/essay`: разделы `records` и `composer` ждали шесть строк и пять команд `/`. Теперь семь строк и шесть команд с `/essay`. Коммит `88c3c7a`.

**3. [Правило 2] RUNBOOK 14.2: миграция `20261013195421_student_gender`**
- Миграция фазы 22 не была перечислена в разделе выкатки; добавлена строкой в 14.2. Коммит `0201f4d`.

### Прочие отклонения

- **`yarn test` собрал web в `apps/web/.next`.** В `turbo.json` задача `test` зависит от `build`, поэтому `yarn test` (команда плана) запустил `@dv-lab/web:build` в рабочем `apps/web/.next`. `next dev` владельца пишет в `apps/web/.next/dev` (Next 16), каталог не тронут, после сборки dev-сервер отвечает 200 на `/login` и `/privacy`, все браузерные разделы после этого прошли на нём. В `apps/web/.next` остались файлы сборки (`BUILD_ID`, `server`, `static`, `standalone`, `types`), они в `.gitignore`; удалять их не стал, решать владельцу. Задание запрещало сборку web в этот каталог; зависимость `test` → `build` в turbo я не учёл до запуска.
- `chat-tools-schema.mjs` в `chat-final.mjs` не добавлен (см. key-decisions); описан в README и AGENTS.md как отдельная проверка с ключом.
- Проверка ссылок F-02 сделана разовым скриптом во временной папке на чтении разговора владельца с подменой текста ответа через `page.route`; в репозиторий не добавлена.
- Фикстура `Alex Example 2182` (архивная, без зависимых строк) удалена из `dvlab_dev`. `Alex Example 2183` оставлена: у неё 5 серий с 5 строками `google_event_mappings` в подключённом календаре, аккаунт ученика, исключение и отметка; удаление оставило бы события в Google.

## Находки переноса (не закрыты)

- `ledger-api.mjs` (все разделы через `onceLesson`): `POST /lessons` с 25.1 отвечает 202 через журнал команд календаря, без `calendarCommands` — `connection_required`, а `expectedVersion` берётся из окна недели. Нужна переделка проверки под `calendar-offline.mjs` и `calendar-seed.mjs`, как в `chat-target.mjs`.
- `chat-web.mjs comments` и `actions`: уроки фикстур вставляются SQL в `lessons`, а Today с 25.1 читает уроки из проекции календаря, поэтому строка урока не появляется (таймаут ожидания `today-row`). Нужен сид проекции.
- `chat-web.mjs answers`: два `#today-pays-soon` в DOM (у Today панели загрузки и данных с одним id, Next 16 держит прошлое дерево скрытым). С `filter({ visible: true })` раздел доходит до следующего ожидания (`[data-slot="due-list"]` в ответе чата) и падает по таймауту; правка откатана, раздел требует разбора.
- `chat-web.mjs models` (свой api на 4255): два FAIL — «the added model sits in Other models, dimmed and not selectable», «on 375px the effort chip keeps only its meter». К фазе 23 не относятся, с базовой версией не сверялись.
- `chat-web.mjs delete light` один раз упал по таймауту 15 с ожидания автоназвания в строке списка, повтор прошёл.
- `Alex Example 2183` в `dvlab_dev` со связанными событиями Google — решение владельца.
- В `dvlab_dev` список разговоров владельца непустой; разделы `chat-web.mjs`, которые ждут пустой список, от этого зависят.
- У `chatDeletePaymentChange` нет `lessonMinutes`: web выводит длину урока из `creditedMinutes * 100 / lessonsHundredths` (без кредита — 60).
- Edit payment в чате — ссылка на форму профиля; дизайн рисует диалог поверх чата. Кнопки Confirm/Keep у `move`, `cancel`, `restore`, `move_series` не переименованы под дизайн v89.
- Вкладка Lessons: нет слова «Moved from / to» (в окне недели нет исхода «перенесён»), выбор недели из календаря в браузере не нажимался, настоящая неделя с уроками не читалась.
- 23-06: назначение оплаты, Set currency и удаление неназначенных оплат в браузере не проверены (нужна фикстура с `student_id null`), строка потерянного ответа тоже.
- `/students/options` отдаёт только id, имя и длину урока: одинаковые имена в палитре не различаются подписью.
- Маршруты карточки работают в `repeatable read`: параллельные правки одной карточки дают 500 сериализации, а не 409.
- Автоназвание: процесс, оборванный во время запроса названия, оставляет попытку `dispatched` (резерв меньше $0.001); оборванный перезапуском api ход показывает «Model settings are unavailable».
- Колонка времени в строках «All chats» при 320 px обрезается справа.
- `ScheduleBar` используется в Schedule и в профиле: менять пропсы с учётом обоих мест.
- Проверки текста после клиентского перехода: Next 16 держит прошлый маршрут скрытым в DOM, нужен `filter({ visible: true })`.

## Known Stubs

Нет.

## Self-Check: PASSED

- Файлы на месте: `AGENTS.md`, `scripts/dev-checks/README.md`, `apps/web/app/privacy/page.tsx`, `scripts/dev-checks/chat-final.mjs`, `deploy/RUNBOOK.md`.
- Коммиты `886530e`, `c872863`, `0201f4d`, `88c3c7a` — в истории ветки.
- `grep -n "chat/changes.ts" AGENTS.md`, `grep -n "command-zone.ts" AGENTS.md`, `grep -n "Проверки фазы 23" scripts/dev-checks/README.md`, `grep -n "card_payment_revision" deploy/RUNBOOK.md` находят строки.
- Файлы владельца (`apps/web/next.config.ts`, `apps/web/AGENTS.md`, `.planning/state.json`, `.planning/milestone.lock`, неотслеживаемые 22-REVIEW*, 22-SECURITY, 23-14-CARRYOVER) не индексировались и не менялись.
