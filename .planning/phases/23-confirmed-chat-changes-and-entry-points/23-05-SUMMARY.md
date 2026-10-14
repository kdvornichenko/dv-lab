---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '05'
subsystem: chat
status: complete
tags: [chat, cards, proposals, revision, archive]

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 'хранилище предложений chat_actions kind change и changes.ts (23-01); ревизия карточки, setCardRate и archiveCard с ревизией (23-02)'
provides:
  - 'операции create_card, set_rate, archive_card в CHAT_CHANGE_OPERATIONS и варианты блока change_proposal'
  - 'модуль apps/api/src/chat/change-cards.ts: проверка ввода, превью и применение трёх операций через cards.ts'
  - 'инструменты propose_student, propose_rate, propose_archive и шаги для них в CHAT_STEP_TOOLS'
  - 'диспетчер changes.ts по operation в propose и confirm, общий порядок блокировки и settle'
  - 'receipt.studentId из chat_actions.after для созданной карточки'
  - 'раздел cards в scripts/dev-checks/chat-changes.mjs, строка CHAT_CHANGES_CARDS_OK'
affects: [23-07, 23-09, 23-10, 23-13]

tech-stack:
  added: []
  patterns:
    - 'Новая операция предложения: target-схема и превью/применение в своём модуле chat/change-*.ts, changes.ts только диспетчеризует, блокирует действие и записывает результат'
    - 'Текст учителя передаётся в модуль операции объектом Said (has, hasName без учёта регистра, hasNumber по границам цифр); writtenIn оплаты не менялся'

key-files:
  created:
    - apps/api/src/chat/change-cards.ts
  modified:
    - packages/contracts/src/chat.ts
    - apps/api/src/chat/changes.ts
    - apps/api/src/chat/messages.ts
    - apps/api/src/chat/tools.ts
    - apps/api/src/chat/runs.ts
    - scripts/dev-checks/chat-changes.mjs
    - scripts/dev-checks/chat-runs.mjs
    - scripts/dev-checks/README.md

key-decisions:
  - 'Длина урока от модели, цифр которой нет в тексте учителя, даёт отказ lesson_minutes_not_in_message, а не тихую подстановку 60; null — LESSON_MINUTES_DEFAULT'
  - 'Новая карточка без guard: повтор confirm защищён FOR UPDATE строки действия и state proposed; совпадение имени не блокирует, только duplicateName в превью'
  - 'set_rate с clear true и непустым rate_text — invalid_amount; currency null берёт валюту карточки, нет её — currency_required'
  - 'accountActive читается findStudentAccount из auth/accounts.ts (только status), архив аккаунт не трогает'
  - 'Уже архивная карточка отказывается при propose (already_archived); архив или восстановление формой между propose и confirm дают stale student_changed через ревизию'
  - 'Инструмент lesson_minutes ограничен 1..1440 на входе инструмента, чтобы значение модели не дошло до int4 базы'

requirements-completed: [CHAT-05]

coverage:
  - id: D1
    description: 'propose_student не создаёт карточку до confirm; confirm создаёт одну карточку через createCard с именем, ставкой и длиной урока из текста и значениями формы; повтор не создаёт вторую; совпадение имени — duplicateName и две отдельные карточки; decline ничего не создаёт; имя, ставка без валюты и длина не из текста — ошибка инструмента'
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs cards'
        status: pass
    human_judgment: false
  - id: D2
    description: 'propose_rate: правка карточки до confirm — stale, ставка прежняя; новое предложение меняет только rate_minor/currency, ревизия +1, goals/parent/gender/длина урока прежние, credited_minutes оплат и остаток профиля прежние; clear снимает пару; та же пара — no_change'
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs cards'
        status: pass
    human_judgment: false
  - id: D3
    description: 'propose_archive с requested_deletion: блок с requestedDeletion и accountActive; confirm архивирует ту же карточку, число строк students, payments, student_notes, lesson_series, lessons не меняется, статус аккаунта ученика прежний; повтор — already_archived; decline оставляет карточку активной'
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs cards'
        status: pass
    human_judgment: false
  - id: D4
    description: 'Диспетчер операций не сломал оплату из 23-01/23-02'
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs payment'
        status: pass
      - kind: integration
        ref: 'node scripts/dev-checks/chat-runs.mjs'
        status: pass
    human_judgment: false

actuals:
  tokens: 16300
  tasks: 3
  commits: 3
plan_head_before: a8c6438065ba85d30166688f0adc0652aa6a1ed6
plan_head_after: f1b61f2e48626274494744d7111e03f93ba915fd

duration: 20min
completed: 2026-10-14
---

# Фаза 23, план 05: предложения по карточке из чата (новый ученик, ставка, архив) — итоги

**Модель предлагает нового ученика, новую ставку или архив (в том числе вместо удаления) инструментами propose_student, propose_rate и propose_archive; сервер берёт имя, ставку и длину урока только из текста учителя, а запись идёт через createCard, setCardRate и archiveCard с ревизией карточки только после подтверждения.**

## Производительность

- Начало около 2026-10-14T05:20Z, конец 2026-10-14T05:40Z.
- Задачи: 3 из 3.
- `commits: 3` — `git rev-list --count --grep="(23-05)" a8c6438..HEAD`; в том же диапазоне чужих коммитов нет, но параллельно работал 23-08, поэтому счёт отфильтрован по плану.

## Что сделано

- Контракты (`packages/contracts/src/chat.ts`): `CHAT_CHANGE_OPERATIONS` + `create_card`, `set_rate`, `archive_card`; варианты `chatCreateCardChange` (`displayName`, пара ставки, `lessonMinutes`, `noShowDeducts: true`, `timeZone: null`, `gender`, `duplicateName`), `chatSetRateChange` (`before`/`after`, пары nullable вместе), `chatArchiveCardChange` (`requestedDeletion`, `accountActive`); `CHAT_STEP_TOOLS` + `propose_student`, `propose_rate`, `propose_archive`.
- `apps/api/src/chat/change-cards.ts` (новый): `cardTargets` (схемы `target` трёх операций, guard `{ cardRevision }` у ставки и архива), `previewCardChange` (проверка ввода и превью), `applyCardChange` (createCard, setCardRate, archiveCard; `changed` → stale `student_changed`, `not_found` → stale `not_found`). Записи в `students` в модуле нет.
- `apps/api/src/chat/changes.ts`: `storedTarget` — discriminated union оплаты и трёх целей карточки, `legacyTarget` строится от `paymentTarget`; `proposeChange` выбирает `preparePayment` или `prepareCard`; `confirmChange` → `applyChange`: разбор цели, ветка оплаты (тело `applyPayment` прежнее, цель передаётся параметром) или `applyCardChange`, затем `settle`. `saidIn` строит `Said` из текста учителя.
- `apps/api/src/chat/tools.ts`: три strict-инструмента с описаниями «копировать как написал учитель, без записи до подтверждения»; общий `propose` и `changeRequest`; квитанция по операции: имя ученика и заметка «Nothing changes until the teacher confirms in the chat. Do not repeat amounts or numbers: the block shows them.», у архива по просьбе удалить — ещё фраза про недоступное удаление. Квитанция оплаты не менялась.
- `apps/api/src/chat/runs.ts`: строки SYSTEM про propose_student/propose_rate и про удаление → propose_archive; строка `open_page` перечисляет оставшиеся страницы (other profile details, vocabulary, settings); `blockNote` берёт `displayName` у `create_card`.
- `scripts/dev-checks/chat-changes.mjs`: раздел `cards` (26 проверок), общий `askTool` (оплата идёт через него), префикс карточек по разделу, уборка заметок, секций и аккаунтов учеников перед `removeCards`.

## Коммиты задач

1. Задача 1 (новый ученик и ставка) — `e418bbe` (feat)
2. Задача 2 (архив, в том числе вместо удаления) — `d71a59b` (feat)
3. Задача 3 (раздел `cards` проверки) — `f1b61f2` (feat)

## Проверки

- `yarn workspace @dv-lab/contracts typecheck` и `yarn workspace @dv-lab/api typecheck` — 0 (после задач 1 и 2).
- `node scripts/dev-checks/chat-changes.mjs cards` — `CHAT_CHANGES_CARDS_OK` (26 проверок, порт 4241, `dvlab_test`); после прогона карточек `Alex Example 234%` в базе 0.
- `node scripts/dev-checks/chat-changes.mjs payment` — `CHAT_CHANGES_PAYMENT_OK` (до и после задачи 3).
- `node scripts/dev-checks/chat-runs.mjs` — `CHAT_RUNS_OK` (порт 4226).
- `npx prettier --check` по всем файлам плана — чисто.
- `grep -n "createCard\|setCardRate\|archiveCard" apps/api/src/chat/change-cards.ts` — все три вызова; `grep -n "insert(students)\|update(students)\|delete(students)"` по `change-cards.ts` и `changes.ts` — пусто.
- `git diff apps/api/src/chat/publish-gate.ts` за план пуст.
- Порты 4241 и 4226 после прогонов свободны; 3000 и 4000 не трогались.

## Не запускалось

- `yarn workspace @dv-lab/web typecheck`, lint, браузер, `yarn knip`, `yarn build`, `yarn test` — web и порты 3000/4000 у соседнего 23-08, `yarn test`/`yarn build` по заданию не запускаются. Web проверен grep: `change-proposal.tsx` сужает по `operation === 'record_payment'` и имеет ветки по умолчанию, `chat-progress.tsx` — `default: 'Preparing a change'`, `receipt.studentId` по-прежнему есть у всех применённых блоков. Блок ChangeProposal для новых операций (P05–P07, P09) — работа web-плана.
- `ledger-api.mjs balance` — известный красный с фазы 25.1 (фикстура без `requestId`/`expectedVersion`), не трогался.

## Отклонения от плана

### Автоисправления

**1. [Правило 3] `apps/api/src/chat/messages.ts` (файла нет в плане)**
- `changeView` читал `block.change.studentId`, которого нет у `create_card`, — typecheck api не проходил. `changeAfter` получил `studentId`, receipt берёт `after.studentId`, иначе `studentId` из превью; без обоих receipt `null`. Коммит `e418bbe`.

**2. [Правило 1] Своя поломка `scripts/dev-checks/chat-runs.mjs` (файла нет в плане)**
- Проверка списка инструментов и их числа (11 → 14) обновлена под новые инструменты. Коммиты `e418bbe`, `d71a59b`.

**3. [Правило 3] Повторный архив в проверке без упоминания**
- Архивную карточку нельзя упомянуть (`mention_stale`, хода нет), поэтому сценарий `already_archived` шлёт текст без `@`; модель-заглушка передаёт `student_id` сама. Коммит `f1b61f2`.

### Прочие отклонения

- Длина урока не из текста — отказ `lesson_minutes_not_in_message`, а не подстановка 60 (план допускал оба прочтения; отказ не даёт модели выдумать значение).
- Добавлены коды отказа `invalid_name`, `invalid_card`, `lesson_minutes_not_in_message`; `already_archived` и `no_change` — по плану.
- Квитанция архива по просьбе удалить добавляет фразу «Permanent deletion is not available; the block offers to archive the student instead.»
- В проверке ставка карточки 2341 сначала заполняется PATCH (parent, goals, gender), затем оплата, чтобы доказать, что `setCardRate` не трогает другие поля и кредит оплат.
- Раздел `cards` описан в `scripts/dev-checks/README.md`.

## Для следующих планов

- Новая операция: схема цели в своём модуле (`cardTargets` как образец) добавляется в `storedTarget` (`changes.ts`), превью и применение — ветки в `prepareCard`/`applyChange` или свой `prepare*`; `settle`, `changeView`, маршруты confirm/decline общие. Результат применения — `{ kind: 'applied', after } | { kind: 'stale', issue } | { kind: 'failed' }`, `after.studentId` попадает в receipt.
- Текст учителя для проверки значений — `saidIn(message)` в `changes.ts` (`has` дословно после NFC и схлопывания пробелов, `hasName` без учёта регистра, `hasNumber` по границам цифр).
- Web (ChangeProposal): `create_card` без `studentId` в превью, id новой карточки — `receipt.studentId`; `set_rate` — `before`/`after` с парами `null`; `archive_card` — `requestedDeletion` (текст P09) и `accountActive` (строка P07 про вход).
- Архивного ученика нельзя упомянуть в чате; модель находит его только по `student_id` из прошлых результатов.

## Self-Check: PASSED

- Файлы: `apps/api/src/chat/change-cards.ts`, `scripts/dev-checks/chat-changes.mjs` — на месте.
- Коммиты `e418bbe`, `d71a59b`, `f1b61f2` — в истории ветки.
