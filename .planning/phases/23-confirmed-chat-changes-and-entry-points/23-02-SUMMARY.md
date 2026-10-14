---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '02'
subsystem: cards
tags: [cards, payments, revision, cas, drizzle, hono, chat]

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 'insertPayment, chat/changes.ts и предложение оплаты из чата (23-01)'
provides:
  - 'колонки revision у students и payments (миграция 20261014044620_card_payment_revision)'
  - 'CAS у updateCard, archiveCard, restoreCard, setOpeningBalance (ревизия необязательна) и узкая setCardRate (ревизия обязательна)'
  - 'updatePayment и PATCH /payments/:id — исправление той же строки; ревизия в deletePayment и assignPayment'
  - 'updateStudentRequest, cardRevisionRequest, updatePaymentRequest, paymentRevisionRequest в контрактах; revision в StudentDetail и PaymentRow'
  - 'readOptionalJson в auth/middleware.ts — пустое тело без content-type читается как {}'
  - 'guard предложения оплаты { cardRevision, timeZone }'
  - 'проверка scripts/dev-checks/cards-revision.mjs'
affects: [23-03, 23-05, 23-06, 23-07, 23-10, 23-14]

actuals:
  tokens: 8200
  tasks: 3
  commits: 3
plan_head_before: b238f68bd127b229d1b9536ad38dcd46a3b7035b
plan_head_after: 48b069abbeb9cfdb62852dbc58cc2af7e5705923

tech-stack:
  added: []
  patterns:
    - 'Писатель карточки — writeCard: UPDATE с revision = revision + 1 и условием revision = expected только при переданной ревизии; ноль строк — перечитать: нет строки — not_found, ревизия другая — changed, иначе текущая карточка (идемпотентный архив и восстановление)'
    - 'Конфликт ревизии — существующий код precondition_failed (409), тексты «The student changed» и «The payment changed»'

key-files:
  created:
    - packages/db/drizzle/20261014044620_card_payment_revision/migration.sql
    - packages/db/drizzle/20261014044620_card_payment_revision/snapshot.json
    - scripts/dev-checks/cards-revision.mjs
  modified:
    - packages/db/src/schema.ts
    - packages/contracts/src/students.ts
    - apps/api/src/auth/middleware.ts
    - apps/api/src/cards/card-rows.ts
    - apps/api/src/cards/cards.ts
    - apps/api/src/cards/payments.ts
    - apps/api/src/routes/students.ts
    - apps/api/src/routes/payments.ts
    - apps/api/src/chat/changes.ts
    - scripts/dev-checks/chat-changes.mjs

key-decisions:
  - 'Ревизия есть только у StudentDetail, не у StudentRow списка: формы правки читают профиль'
  - 'Повторный archive/restore уже архивной (активной) карточки — 200 без продвижения ревизии; с устаревшей ревизией — 409'
  - 'updatePayment не назначает оплату: у неназначенной оплаты PATCH даёт 400, назначение остаётся assignPayment'
  - 'Старые предложения с полевым guard из 23-01 при confirm — stale student_changed, нераспознанный target — failed'
  - 'readOptionalJson положен рядом с readJson в auth/middleware.ts, а не копией в двух файлах маршрутов'

patterns-established:
  - 'CardWrite { ok, detail } | not_found | changed — общий результат писателей карточки, mutateStudent в маршрутах переводит changed в 409'

requirements-completed: [CHAT-12, CHAT-05]

coverage:
  - id: D1
    description: 'Каждый писатель карточки продвигает ревизию; устаревшая полная форма, архив, восстановление и начальный баланс дают 409 без записи; запросы без ревизии работают как раньше; setCardRate меняет только пару ставки'
    requirement: CHAT-12
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/cards-revision.mjs'
        status: pass
    human_judgment: false
  - id: D2
    description: 'PATCH /payments/:id исправляет ту же строку (id, source, studentId, createdAt прежние), кредит пересчитан от текущей длины урока, остаток профиля равен studentBalance core; повтор с прежней ревизией — 409 без второй строки; DELETE и assign с ревизией'
    requirement: CHAT-12
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/cards-revision.mjs'
        status: pass
    human_judgment: false
  - id: D3
    description: 'Предложение оплаты держит ревизию карточки: правка карточки до Record payment делает его stale без оплаты; оплата из чата исправляется PATCH той же строки, блок чата остаётся applied с исходным превью'
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs payment'
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-14
status: complete
---

# Фаза 23, план 02: ревизии карточки и оплаты, исправление оплаты той же строкой — итоги

**У карточки и оплаты появилась числовая ревизия, все писатели её продвигают и отказывают устаревшей правке 409 precondition_failed, оплата исправляется PATCH той же строки, а предложение оплаты из чата сверяет ревизию карточки при Record payment.**

## Производительность

- **Начало:** 2026-10-14T04:46:07Z, **конец:** 2026-10-14T04:55Z (около 9 минут исполнения)
- **Задачи:** 3 из 3
- **Изменено файлов:** 13

## Что сделано

- Схема: `students.revision` и `payments.revision` (`integer not null default 1`, CHECK `revision >= 1`). Миграция `20261014044620_card_payment_revision` сгенерирована `yarn db:generate --name card_payment_revision`, SQL только добавляет две колонки и два CHECK, второй запуск — «No schema changes». Применена к `dvlab_test` и `dvlab_dev`, колонки на месте в обеих базах.
- Контракты: поля карточки вынесены в `studentFields`; `saveStudentRequest` и `updateStudentRequest` (+ необязательная `expectedRevision`) с тем же refine пары ставки; `cardRevisionRequest`; `openingBalanceRequest` и `assignPaymentRequest` с необязательной ревизией; `updatePaymentRequest` (ревизия обязательна) и `paymentRevisionRequest`. Новых кодов ошибок нет.
- `cards.ts`: общий `writeCard`; `updateCard`, `archiveCard`, `restoreCard` возвращают `CardWrite`; `setOpeningBalance` сверяет ревизию под `FOR UPDATE` и продвигает её; новая `setCardRate(executor, id, rate, expectedRevision, context)`. `createCard` и `importCard` не менялись.
- `routes/students.ts`: PATCH разбирает `updateStudentRequest`; archive и restore читают необязательное тело; `changed` → 409 «The student changed» (PATCH, archive, restore, opening-balance).
- `payments.ts`: `updatePayment` в одной транзакции (пояс учителя, дата не в будущем, оплата `FOR UPDATE`, неназначенная — invalid, ревизия, карточка `FOR SHARE`, `creditedMinutes` от текущей длины урока, `revision + 1`); `deletePayment` с необязательной ревизией (`deleted | not_found | changed`); `assignPayment` блокирует оплату, сверяет и продвигает ревизию.
- `routes/payments.ts`: `PATCH /payments/:id` (200, 400, 404, 409 `precondition_failed` или `default_time_zone_changed`); DELETE с необязательным телом; assign → 409 при `changed`.
- `chat/changes.ts`: guard `{ cardRevision, timeZone }`, ревизия читается вместе с карточкой при propose и сверяется под `FOR SHARE` при confirm.
- `chat-changes.mjs payment`: сценарий «длина урока изменилась» (сырой SQL) заменён на PATCH goals между предложением и confirm; добавлены «исправление после чата» и «старый полевой guard». Проверок стало 33 (было 31).

## Коммиты задач

1. **Задача 1 (ревизия карточки)** — `1fa27d5` (feat)
2. **Задача 2 (исправление оплаты, удаление и назначение с ревизией, cards-revision.mjs)** — `596a297` (feat)
3. **Задача 3 (предложение оплаты держит ревизию карточки)** — `48b069a` (feat)

Счёт коммитов: `git rev-list --count --grep="(23-02)" b238f68..HEAD` — 3. В ветку параллельно коммитит 23-04, поэтому счёт отфильтрован по плану.

## Проверки

- `yarn workspace @dv-lab/db typecheck`, `@dv-lab/contracts typecheck`, `@dv-lab/api typecheck` — 0.
- `yarn db:generate` второй раз — «No schema changes, nothing to migrate».
- `node scripts/dev-checks/cards-revision.mjs` — `CARDS_REVISION_OK` (21 проверка, порт 4242, `dvlab_test`, карточки `Alex Example 2310`, `2311`).
- `node scripts/dev-checks/chat-changes.mjs payment` — `CHAT_CHANGES_PAYMENT_OK` (33 проверки).
- `node scripts/dev-checks/chat-api.mjs records` — `CHAT_RECORDS_OK` без правок.
- `node scripts/dev-checks/chat-runs.mjs` — `CHAT_RUNS_OK` (PATCH карточек без ревизии работает).
- `grep -n setCardRate apps/api/src/cards/cards.ts` — экспорт найден; `grep -c precondition_failed apps/api/src/routes/students.ts` — 3; `grep -n cardRevision apps/api/src/chat/changes.ts` — guard найден.
- Все писатели строки `students` — только `cards.ts` (`grep "update(students)"`: две точки, обе продвигают ревизию).

## Не запускалось

- `node scripts/dev-checks/ledger-api.mjs balance` — падает до раздела оплат: `single lesson create returned 400`. Причина не в плане: `createCalendarLessonRequest` с фазы 25.1 требует `requestId` и `expectedVersion` (`calendarCommandMeta`), а `scripts/dev-checks/ledger-api/context.ts` (`createLesson`) их не шлёт. Отложено, файл вне плана.
- `yarn workspace @dv-lab/web typecheck`, lint, браузер, `yarn knip`, `yarn build`, `yarn test` — web и порты 3000/4000 у соседнего 23-04, `yarn test` и `yarn build` — только 23-14. Правки контрактов в web только добавляют поле `revision` в типы ответов; объектов `StudentDetail` и `PaymentRow` web не собирает (проверено grep).
- e2e (`e2e/support/*`) не запускались: пишут без ревизии, сервер это принимает; прогон — 23-14.

## Отклонения от плана

### Автоисправления

**1. [Правило 3] `revision` в `toPaymentRow` перенесён в задачу 1**
- `PaymentRow.revision` появился в контрактах задачи 1, без строки в `toPaymentRow` typecheck api задачи 1 не проходил. Коммит `1fa27d5`.

**2. [Правило 3] `readOptionalJson` в `apps/api/src/auth/middleware.ts` (файла нет в плане)**
- `readJson` отказывает без `content-type`, а web шлёт POST archive/restore и DELETE оплаты без тела. Помощник положен рядом с `readJson`, чтобы разбор тела остался в одном модуле. Есть заголовок — обычный `readJson`, нет заголовка и пустое тело — схема от `{}`, иначе 400. Коммит `1fa27d5`.

**3. [Правило 2] `assignPayment` блокирует строку оплаты `FOR UPDATE`**
- Без блокировки сверка ревизии гонялась бы с параллельным исправлением. Коммит `596a297`.

### Прочие отклонения

- Проверка `cards-revision.mjs` дополнительно вызывает `setCardRate` в процессе (маршрута у неё нет до 23-05): устаревшая ревизия — changed, свежая меняет только пару ставки, очистка пары, неизвестный id — not_found.
- В `chat-changes.mjs` добавлен сценарий старого полевого guard (target правится SQL в фикстуре) — stale без оплаты.

## Для следующих планов

- 23-05: `setCardRate(executor, id, { rateMinor, currency } | { rateMinor: null, currency: null }, expectedRevision, context)` возвращает `CardWrite`; `archiveCard(executor, id, context, expectedRevision?)` — тот же результат. В чате ревизию передавать всегда.
- 23-06: формы шлют `expectedRevision` из `StudentDetail.revision` и `PaymentRow.revision`; конфликт — 409 `precondition_failed` («The student changed» / «The payment changed»). `PATCH /payments/:id` требует `expectedDefaultTimeZone` и `expectedRevision`. Список `GET /students` (`StudentRow`) ревизии не несёт.
- 23-07: `deletePayment(executor, id, expectedRevision?)` → `'deleted' | 'not_found' | 'changed'`. DELETE с JSON-телом из node `http.request` без `content-length` приходит пустым (400) — в проверках слать `content-length`, как `chat-changes.mjs` при удалении разговора; браузерный fetch ставит его сам.
- Маршруты карточки идут в `repeatable read`: параллельные правки одной карточки в проверках делать последовательно, иначе вторая получит ошибку сериализации (500), а не 409.
- Отложено: `scripts/dev-checks/ledger-api/context.ts` (`createLesson`) не шлёт `requestId` и `expectedVersion`, `ledger-api.mjs` красный с фазы 25.1.

## Self-Check: PASSED

- Файлы: `packages/db/drizzle/20261014044620_card_payment_revision/migration.sql`, `snapshot.json`, `scripts/dev-checks/cards-revision.mjs` — на месте.
- Коммиты `1fa27d5`, `596a297`, `48b069a` — в истории ветки.
