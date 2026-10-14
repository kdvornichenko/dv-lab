---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '06'
subsystem: ui
tags: [web, forms, payments, cards, revision, conflict, chat]

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 'ревизии карточки и оплаты, PATCH /payments/:id, expectedRevision у archive, restore, opening-balance, delete и assign (23-02); ссылка Edit payment ?tab=payments&payment=<id> и кнопка Ask in chat в шапке профиля (23-01, 23-04)'
provides:
  - 'режим Edit payment у RecordPaymentDialog: та же форма, PATCH той же строки с expectedRevision и expectedDefaultTimeZone'
  - 'кнопка Edit payment в строке оплат профиля; открытие формы по ?tab=payments&payment=<id> с очисткой параметра и строкой P23 для пропавшей оплаты'
  - 'ReloadNotice (apps/web/components/app/reload-notice.tsx): строка P22 с кнопкой Reload, общая для форм'
  - 'expectedRevision во всех писателях карточки и оплаты web: Edit details, начальный баланс, archive, restore, правка, удаление, назначение и валюта оплаты'
  - 'раздел forms в scripts/dev-checks/changes-web.mjs'
affects: [23-07, 23-14]

actuals:
  tokens: 16800
  tasks: 3
  commits: 5
plan_head_before: cfa1999a1259c07abcf2fa65203714f3f34974ff
plan_head_after: bec771d0701b138201a16e3e70acda98e9c9bdd4

tech-stack:
  added: []
  patterns:
    - 'Форма запоминает ревизию при открытии (useState от StudentDetail.revision или PaymentRow.revision), конфликт 409 precondition_failed оставляет черновик и выключает Save до явного Reload; Reload перечитывает ту же цель и заменяет значения, ревизию и фокус'
    - 'Фокус после Reload ставится эффектом от счётчика, а не requestAnimationFrame: поле отключено на время чтения, rAF мог сработать раньше коммита'

key-files:
  created:
    - apps/web/components/app/reload-notice.tsx
  modified:
    - apps/web/app/(app)/students/_components/student-form-dialog.tsx
    - apps/web/app/(app)/students/[id]/_components/overview-tab.tsx
    - apps/web/app/(app)/students/[id]/_components/opening-balance-panel.tsx
    - apps/web/app/(app)/students/[id]/_components/student-profile.tsx
    - apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx
    - apps/web/app/(app)/students/[id]/_components/payments-tab.tsx
    - apps/web/app/(app)/students/[id]/_components/profile-arrival.ts
    - apps/web/app/(app)/students/[id]/page.tsx
    - apps/web/app/(app)/students/[id]/_components/set-currency-dialog.tsx
    - apps/web/app/(app)/students/_components/assign-payment-dialog.tsx
    - apps/web/app/(app)/students/_components/unassigned-payments.tsx
    - scripts/dev-checks/changes-web.mjs

key-decisions:
  - 'Дизайн: артефакт v90 (DR-23-04 получен) применён: описание «The balance is recalculated when you save.», студент строкой с замком и подписью «A payment stays with its student.», строка P22 между полями и кнопками, потерянный ответ — destructive-строка «Could not confirm that the payment was saved…», пропавшая оплата — info-строка с Close и View payments'
  - 'Профильная панель начального баланса держит ревизию от монтирования и пересоздаётся по ключу openingVersion-revision: собственное сохранение из другой формы не даёт ложного конфликта, чужая правка даёт P22'
  - 'Потерянный ответ (статус 0 или 5xx) у правки оплаты и карточки показывается строкой P22-варианта с тем же Reload, повторного сохранения и «saved» по совпадению чисел нет'
  - 'Фокус при конфликте уходит на кнопку Reload: нажатая Save выключается и теряет фокус (activeElement становился body), фокус остаётся внутри формы'

patterns-established:
  - 'ReloadNotice: Banner role="alert" с BannerTitle и BannerAction (иконка RefreshCw) во второй строке, autoFocus на кнопке'

requirements-completed: [CHAT-12]

coverage:
  - id: D1
    description: 'Оплата из чата исправляется формой Edit payment той же строкой: id, source и created_at прежние, ревизия +1, второй строки нет; остаток профиля и Students совпадают'
    requirement: CHAT-12
    verification:
      - kind: automated_ui
        ref: 'node scripts/dev-checks/changes-web.mjs forms light|dark'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Конфликт с правкой из другой вкладки: Edit payment и Edit details сохраняют черновик, выключают Save, перечитывают цель по Reload; устаревшее сохранение ничего не пишет'
    requirement: CHAT-12
    verification:
      - kind: automated_ui
        ref: 'node scripts/dev-checks/changes-web.mjs forms light|dark'
        status: pass
    human_judgment: false
  - id: D3
    description: 'Ссылка ?tab=payments&payment=<id> открывает Edit payment этой оплаты и убирает параметр; неизвестный id даёт строку P23 над списком без редактора'
    requirement: CHAT-12
    verification:
      - kind: automated_ui
        ref: 'node scripts/dev-checks/changes-web.mjs forms light|dark'
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-10-14
status: complete
---

# Фаза 23, план 06: обычные формы с ревизией и Edit payment — итоги

**Изменение из чата исправляется обычными формами той же строкой: Edit payment делает PATCH оплаты, Edit details — карточки, все писатели карточки и оплаты в web посылают ревизию, конфликт с другой вкладкой сохраняет черновик и требует явного Reload.**

## Что сделано

- `RecordPaymentDialog` получил проп `payment`: режим Edit payment с теми же полями, парсером и расчётом. Сумма, валюта, дата, уроки и заметка заполнены из оплаты, ученик показан строкой без выбора. Уроки сохраняют записанное число и начинают следовать сумме только после её изменения. Отправка — `PATCH /payments/:id` с `expectedRevision` и `expectedDefaultTimeZone`, тост «Payment saved». Ответы: 409 `precondition_failed` — строка P22 и Reload payment details; 404 — info-строка P23 без полей, с Close и View payments; статус 0 или 5xx — строка о неподтверждённом сохранении; `default_time_zone_changed` — прежний `TimeZoneStaleNotice`.
- Вкладка Payments: кнопка Edit payment (Pencil, Tooltip, `aria-label` «Edit payment of …») перед Delete; удаление шлёт `expectedRevision`, 409 меняет текст отказа ConfirmDialog. Проп `openPaymentId` открывает форму один раз после загрузки списка, пропавший id даёт info-строку P23 над списком (и над пустым списком).
- `profile-arrival.ts` и `page.tsx`: параметр `payment` (только UUID) выбирает вкладку Payments; `StudentProfile` держит его локально и убирает из адреса после открытия.
- `StudentFormDialog` (edit): ревизия запоминается при открытии, 409 даёт P22 с Reload student details, Save выключен, Reload перечитывает `GET /students/:id`, заменяет значения и ревизию, пересоздаёт поле длины урока, фокус на Name. Создание карточки не менялось.
- Начальный баланс, archive и restore: `expectedRevision`; архив и восстановление берут ревизию в момент открытия подтверждения, 409 даёт текст «This student changed elsewhere. Reload the page and try again.».
- Валюта и назначение оплаты: `expectedRevision`, 409 — «This payment changed elsewhere. Close this dialog and try again.»; удаление неназначенной оплаты — с ревизией.
- `ReloadNotice` — общая строка P22, чтобы не копировать разметку в три формы.

## Коммиты

1. `9131cee` — Edit details, начальный баланс и ReloadNotice
2. `5a04994` — Edit payment, вкладка Payments, прибытие по `payment=`, archive и restore с ревизией
3. `d6e3375` — валюта, назначение и удаление неназначенных оплат с ревизией
4. `81ac36b` — исправление фокуса после конфликта и Reload (найдено проверкой)
5. `bec771d` — раздел `forms` в `changes-web.mjs`

Счёт: `git rev-list --count --grep="(23-06)" cfa1999..HEAD` — 5; ветка коммитится параллельно 23-03 и review-правками фазы 22, поэтому счёт отфильтрован по плану.

## Проверки

- `yarn workspace @dv-lab/web typecheck` — 0, `yarn workspace @dv-lab/web lint` — 0, `prettier --check` по изменённым файлам — чисто.
- `node scripts/dev-checks/changes-web.mjs forms light` и `forms dark` — `CHANGES_WEB_FORMS_OK` в обеих темах (последний прогон каждой темы после финального кода зелёный, до этого дважды прогнаны подряд обе темы без сбоев). Раздел проходит: запись оплаты формой, Edit payment (ученик без выбора, значения, фокус на Amount, уроки следуют сумме после правки суммы), та же строка в базе (id, source, created_at прежние, ревизия +1, одна строка), одинаковый остаток на профиле и в Students, конфликт оплаты (черновик, Save выключен, ничего не записано, фокус в диалоге, Reload подставляет значения и фокус на Amount, повторное сохранение той же строки), то же для Edit details с Reload student details и фокусом на Name (после Reload правка другой вкладки сохраняется), archive и restore, удаление оплаты с ревизией, ссылка `?tab=payments&payment=<id>` (форма открыта, `payment` из адреса убран), неизвестный id (строка P23, редактора нет), телефон 390 (одна колонка, футер виден, горизонтальной прокрутки нет), консоль без неожиданных ошибок. Скриншоты `changes-forms-*` в `STATE_DIR`, просмотрены: конфликт оплаты (тёмная), Edit payment (светлая), конфликт карточки (светлая), телефон (светлая).
- Проверка шла против dev-стека владельца на 3000 и 4000, процессы не останавливались и не запускались.

## Не запускалось

- Назначение оплаты, Set currency и удаление неназначенных оплат в браузере: для карточек без оплат с `student_id null` нужна фикстура с прямой вставкой в базу, вне плана. Покрыто typecheck и серверной проверкой `cards-revision.mjs` из 23-02 (assign и delete с ревизией). Строки отказа 409 этих трёх диалогов в браузере не проверены.
- Строка «Could not confirm that the payment was saved…» (потерянный ответ) в браузере не проверена: потерю ответа скрипт не имитирует; код и текст соответствуют v90.
- `node scripts/dev-checks/wait-dev.mjs down`: acceptance-пункт плана «после проверки порты свободны» не применим, потому что задание запрещает останавливать dev-серверы владельца (3000 и 4000); оба остались как были.
- `yarn test`, `yarn build`, `yarn knip`, `db:*` — запрещены заданием и принадлежат 23-14.

## Отклонения от плана

**1. [Правило 2] Новый файл `apps/web/components/app/reload-notice.tsx` (нет в `files_modified`)**
- Одна и та же строка P22 с кнопкой Reload нужна в трёх формах (оплата, карточка, начальный баланс); без общего компонента разметка копировалась бы три раза. Коммит `9131cee`.

**2. [Правило 1] Фокус при конфликте**
- Первый прогон показал, что после нажатия Save при 409 фокус уходит на `body`: кнопка выключается и теряет его. P22 требует «фокус остаётся в форме». Строка P22 ставит фокус на свою кнопку Reload (`autoFocus`); после Reload фокус ставится эффектом, а не `requestAnimationFrame` (поле отключено на время чтения, rAF гонялся с коммитом, в тёмной теме падало 2 из 3 прогонов). Дизайн v90 говорит «фокус остаётся там, где был»; отличие: фокус уходит с выключаемой Save на Reload внутри той же формы. Коммит `81ac36b`.

**3. [Правило 3] Правки archive и restore лежат в коммите задачи 2**
- `student-profile.tsx` меняется и задачей 1 (archive и restore), и задачей 2 (аргументы `PaymentsTab`, `payment=`); один файл без интерактивного `git add -p` разнести нельзя, оба изменения в `5a04994`.

**4. [Правило 3] Определение origin dev-api в проверке `forms`**
- Dev-api владельца в ходе работы перезапускался с `APP_ORIGIN`, равным адресу web, и перестал принимать `APP_ORIGIN` из `.env` (403 `forbidden_origin` на входе). `forms` пробует адрес web и `APP_ORIGIN` из `.env` одним безобидным POST входа с заведомо неверным логином и берёт тот, что не получил `forbidden_origin`. `entry-web.mjs` (23-04) всегда берёт `APP_ORIGIN` из `.env` и при таком перезапуске api тоже получит 403; чинит 23-14 или следующий план, файл вне плана.

## Для следующих планов

- 23-07: `PaymentsTab` теперь принимает `mainTimeZone`, `asOf`, `openPaymentId`, `onOpened`; прежние вызовы без них не соберутся (других нет). Вкладка Lessons рядом не затронута; порядок кнопок шапки (Ask in chat, Archive, Record payment) не менялся.
- 23-14: в `scripts/dev-checks/README.md` нет записи о разделе `forms` (файл вне плана 23-06): `changes-web.mjs forms light|dark` нужен dev-стек на 3000 и 4000 (свой api не поднимает), карточка `Alex Example 2360`, печатает `CHANGES_WEB_FORMS_OK`. Раздел `payment` по-прежнему поднимает свой api с фейком модели и требует свободный 4000.
- `ReloadNotice` и общий приём «ревизия при открытии, Reload заменяет черновик» годятся другим формам с ревизией (разделы, заметки).

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности: параметр `payment` разбирается только как UUID, форма открывается для оплаты из ответа сервера по этому ученику, чужой или пропавший id даёт P23 (T-23-21); ревизия посылается всеми писателями, конфликт сохраняет черновик (T-23-20); правка идёт в ту же строку без удаления (T-23-22).

## Self-Check: PASSED

- Файлы: `apps/web/components/app/reload-notice.tsx`, `scripts/dev-checks/changes-web.mjs`, `23-06-SUMMARY.md` на месте.
- Коммиты `9131cee`, `5a04994`, `d6e3375`, `81ac36b`, `bec771d` — в истории ветки.
