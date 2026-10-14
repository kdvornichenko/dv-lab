---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '01'
subsystem: chat
tags: [chat, payments, proposals, drizzle, hono, nextjs, base-ui]

requires:
  - phase: 22-chat-with-mentions-and-quick-marks
    provides: chat_actions, runs.ts, tools.ts, publish-gate, блоки ответа и поток
provides:
  - предложение оплаты из чата (kind change в chat_actions) и решение учителя confirm/decline
  - insertPayment в cards/payments.ts — единственная вставка оплаты для формы и чата
  - модуль apps/api/src/chat/changes.ts (proposeChange, confirmChange, declineAction, presentChange)
  - блок change_proposal в контрактах, chatActionResponse, маршрут POST /chat/actions/:id/decline
  - ChangeProposal в web по ChangeCard v89
  - проверки chat-changes.mjs payment и changes-web.mjs payment
affects: [23-05, 23-06, 23-07, 23-09, 23-10, 23-13]

actuals:
  tokens: 25200
  tasks: 3
  commits: 3
plan_head_before: a9a49652625902e9943b84dfba1bfb010a8f7699
plan_head_after: 7747a7b173f3fc20a6bea6e814fc64213a9c2de9

tech-stack:
  added: []
  patterns:
    - 'Предложение — строка chat_actions kind change с target (операция, значения, guard), блок в ответе ассистента; решение — FOR UPDATE строки действия, проверка guard, запись владельцем домена в той же транзакции'
    - 'Состояние предложения читается из result.kind строки действия (proposed, applied, declined, stale, failed) через changeView'

key-files:
  created:
    - apps/api/src/chat/changes.ts
    - packages/db/drizzle/20261014040312_chat_changes/migration.sql
    - apps/web/app/(app)/chat/_components/change-proposal.tsx
    - scripts/dev-checks/chat-changes.mjs
    - scripts/dev-checks/changes-web.mjs
  modified:
    - packages/db/src/chat-schema.ts
    - packages/contracts/src/chat.ts
    - apps/api/src/cards/payments.ts
    - apps/api/src/chat/messages.ts
    - apps/api/src/chat/tools.ts
    - apps/api/src/chat/runs.ts
    - apps/api/src/routes/chat.ts
    - apps/web/app/(app)/chat/_components/messages.tsx
    - apps/web/app/(app)/chat/_components/use-chat.ts
    - apps/web/app/(app)/chat/_components/chat-screen.tsx
    - apps/web/app/(app)/chat/_components/chat-progress.tsx
    - apps/web/lib/api-client.ts
    - scripts/dev-checks/chat-fake-anthropic.mjs
    - scripts/dev-checks/chat-runs.mjs
    - scripts/dev-checks/README.md

key-decisions:
  - 'Предложения живут в chat_actions (kind change), новой таблицы нет; состояние declined/stale хранится в result.kind, строка остаётся в state refused'
  - 'Confirm выбирает владельца по kind: сначала confirmChange, при not_change — confirmCalendarChange; decline разрешён только для kind change, остальные — 409'
  - 'Confirm перед записью проверяет, что блок предложения ещё есть в ответе: удалённый разговор не даёт поздней оплаты'
  - 'Блок построен по ChangeCard v89 (артефакт v90); Edit payment — ссылка на ?tab=payments&payment=<id>, пока 23-06 не даст режим правки PaymentDialog'
  - 'calendarActionResponse оставлен в контрактах: его использует scripts/dev-checks/chat-calendar.mjs'

patterns-established:
  - 'changeView(block, action) в messages.ts — единственная проекция состояния предложения для чтения разговора и ответов confirm/decline'
  - 'Ветки по умолчанию в ChangeProposal (по operation и state) и в stepWords держат сборку web зелёной, пока планы api добавляют операции раньше UI'

requirements-completed: [CHAT-05, CHAT-12]

coverage:
  - id: D1
    description: 'propose_payment сохраняет предложение без записи в payments; Record payment пишет одну оплату через insertPayment; decline, повтор, гонка и устаревшее предложение ничего не пишут'
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs payment'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Оплата из чата записывается тем же владельцем, что и форма Record payment; остаток профиля равен строке «после» блока'
    requirement: CHAT-12
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs payment'
        status: pass
      - kind: automated_ui
        ref: 'node scripts/dev-checks/changes-web.mjs payment light|dark'
        status: pass
    human_judgment: false
  - id: D3
    description: 'Блок ChangeProposal: превью, Record payment / Don''t record this payment, состояния после перезагрузки, ширина 390 px, обе темы'
    verification:
      - kind: automated_ui
        ref: 'playwright:STATE_DIR/changes-payment-{light,dark}-{proposed,declined,applied,phone}.png'
        status: pass
    human_judgment: false

duration: 95min
completed: 2026-10-14
status: complete
---

# Фаза 23, план 01: трассер предложения оплаты из чата — итоги

**Модель вызывает propose_payment, сервер сохраняет предложение в chat_actions без записи оплаты, учитель подтверждает в блоке ChangeProposal, и оплата пишется через insertPayment владельца cards/payments.ts в одной транзакции с переводом действия в applied.**

## Производительность

- **Длительность:** около 95 минут, включая ожидание освобождения порта 4000
- **Задачи:** 3 из 3
- **Изменено файлов:** 21

## Что сделано

- Расширен CHECK `chat_actions_kind_ck` (`change`), миграция `20261014040312_chat_changes` сгенерирована и применена к `dvlab_test` и `dvlab_dev`.
- Контракты: `CHAT_CHANGE_OPERATIONS`, `CHAT_CHANGE_STATES`, `CHAT_CHANGE_ISSUES`, `chatChangeProposalBlock`, `chatActionResponse`, `propose_payment` в `CHAT_STEP_TOOLS`.
- `insertPayment(executor, card, input)` вынесен из `recordPayment`; обычный `POST /payments` вызывает его без изменения поведения.
- `apps/api/src/chat/changes.ts`: сумма и уроки должны дословно стоять в сообщении учителя (NFC, схлопывание пробелов), разбираются `parseMoney`/`parseLessons` и `recordPaymentRequest`; уроки по ставке через `suggestLessons`; остаток через `cardFacts`; guard (длина урока, ставка, пояс) сверяется при confirm.
- Инструмент `propose_payment` со своей веткой в `runTool`, квитанция без суммы и числа уроков; ветка `blockNote` и строка SYSTEM в `runs.ts`.
- Маршруты: confirm выбирает владельца по kind, новый `POST /chat/actions/:id/decline`.
- Чтение разговора проецирует состояние предложения, удаление разговора делает ожидающие предложения `stale`.
- Web: `ChangeProposal`, `decideChange` и `refreshThread` в `use-chat.ts`; при потерянном ответе тред перечитывается, при неудаче — «Could not load this change's status.» с Refresh status; decline не рассылает обновление данных (`STATUS_CHECK`).
- Фейк провайдера: маркер `[fake:payment]`.

## Коммиты задач

1. **Задача 1 (трассер api)** — `47e91d4` (feat)
2. **Задача 2 (блок и состояние после перезагрузки)** — `ef72636` (feat)
3. **Задача 3 (шаг, тихий decline, браузерная проверка)** — `7747a7b` (feat)

## Проверки

- `yarn workspace @dv-lab/db|contracts|api|web typecheck` — 0; `yarn workspace @dv-lab/web lint` — 0; `yarn knip` — 0.
- Второй `yarn db:generate` — «No schema changes»; SQL меняет один CHECK.
- `node scripts/dev-checks/chat-changes.mjs payment` — `CHAT_CHANGES_PAYMENT_OK` (31 проверка).
- `node scripts/dev-checks/chat-runs.mjs` — `CHAT_RUNS_OK`.
- `node scripts/dev-checks/changes-web.mjs payment light` и `dark` — `CHANGES_WEB_PAYMENT_OK` в обеих темах; скриншоты просмотрены.
- `grep -c insertPayment apps/api/src/cards/payments.ts` — 2; `insert(payments)` в `changes.ts` нет; `git diff apps/api/src/chat/publish-gate.ts` пуст.
- После прогона на порту 4000 никто не слушает; `next dev` на 3000 запущен не исполнителем и оставлен по указанию координатора.
- Ворота трассера: после коммита задачи 1 все проверки `<verify>` повторены и зелёные.

## Отклонения от плана

### Автоисправления

**1. [Правило 3] Проекция состояния перенесена из задачи 2 в задачу 1**
- `<verify>` задачи 1 (applied и declined в ответе confirm/decline) без `changeView` не проходит; задача 2 подключила его в `actionsOf`, `withUndo` и `redactConversationContent`. Коммит `47e91d4`.

**2. [Правило 1] Своя поломка `chat-runs.mjs`**
- Проверка списка инструментов и их числа (10 → 11) обновлена под `propose_payment`. Коммит `47e91d4`.

**3. [Правило 2] Confirm проверяет наличие блока предложения перед записью**
- Без этого confirm по id из удалённого разговора мог бы записать оплату. Коммит `47e91d4`.

**4. [Правило 3] Шум консоли страницы `/login` в браузерной проверке**
- Next dev пишет ошибку prerender про `searchParams` на `/login` (не код плана); добавлена в ожидаемый шум `changes-web.mjs` со счётчиком в выводе. Коммит `7747a7b`.

### Прочие отклонения

- В описании инструмента добавлено «the number without the currency», чтобы модель не копировала символ валюты в `amount_text`.
- Пример в строке SYSTEM про `open_page` заменён на фразу про профиль.
- Ответ Design dude уже был: ChangeCard v89 (артефакт v90). Использован вместо наброска плана: колонка подписей 104 px, вопрос «Record {name}'s payment?», строка applied со значениями и остатком, declined с прозрачными строками, stale и failed баннером, неизвестный исход с Refresh status.
- `/decline` отвечает 409 и для kind calendar; добавлен код отказа `invalid_lessons`.
- `calendarActionResponse` не удалён: на него ссылается `chat-calendar.mjs`.
- Добавлен раздел «Проверки предложений чата фазы 23» в `scripts/dev-checks/README.md`.

## Проблемы

- Браузерная проверка ждала освобождения порта 4000 (dev-api владельца); после разрешения владельца координатор остановил его.

## Для следующих планов

- Новые операции добавляются в `CHAT_CHANGE_OPERATIONS`, вариант `chatChange`, `storedTarget` и ветку применения в `changes.ts`; `changeView` и маршруты общие.
- 23-06: параметр `payment` в `/students/:id?tab=payments&payment=<id>` уже ставит ссылка Edit payment.
- `cardFacts` в превью читает и следующий урок; для остатка достаточно, но это лишнее чтение.

## Self-Check: PASSED

- Файлы: `apps/api/src/chat/changes.ts`, `apps/web/app/(app)/chat/_components/change-proposal.tsx`, `scripts/dev-checks/chat-changes.mjs`, `scripts/dev-checks/changes-web.mjs`, `packages/db/drizzle/20261014040312_chat_changes/migration.sql` — на месте.
- Коммиты `47e91d4`, `ef72636`, `7747a7b` — в истории ветки.
