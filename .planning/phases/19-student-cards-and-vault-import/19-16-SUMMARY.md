---
phase: 19-student-cards-and-vault-import
plan: 16
subsystem: ui
status: complete
tags: [payments, ledger, lessons-prefill, assign, unassigned, set-currency, base-ui]
requires:
  - phase: 19-06
    provides: DateField, Select, Dialog, SkeletonTable
  - phase: 19-10
    provides: /payments (запись, удаление, несопоставленные, assign с установкой валюты)
  - phase: 19-11
    provides: MoneyText, LessonsText, экран Students
  - phase: 19-14
    provides: профиль карточки, ConfirmDialog
provides:
  - диалог Record payment с предзаполнением уроков по ставке
  - вкладка Payments профиля (итоги по валютам, удаление, Set currency)
  - вкладка Unassigned payments на экране Students и диалог Assign payment
  - общие части оплат в ledger-text.tsx (formatDay, DateText, BalanceCaption, CurrencyField, SummaryRow, rateOf)
affects: [19-17, 19-18, 19-19]
actuals:
  tokens: 11500
  tasks: 3
  commits: 3
plan_head_before: 9396dd2a230acc658b575fb63273e4be4d55ee08
plan_head_after: b3612f06782b5641d706d7ecd1f51b465f54ef75
tech-stack:
  added: []
  patterns:
    - "уроки в формах оплаты: черновик lessonsDraft (null = считать автоматически), показываемое значение = черновик ?? предзаполнение, эффектов нет"
    - "правило предзаполнения живёт в одном месте: suggestLessonsText (record-payment-dialog.tsx) поверх suggestLessons из core; Set currency и Assign вызывают его же"
    - "подпись про остаток и подсказка про уроки общие: BalanceCaption и lessonsHelper из ledger-text.tsx"
    - "диалоги списка несопоставленных рисуются вне ранних return, чтобы перечитывание списка не убирало диалог с Banner"
key-files:
  created:
    - apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx
    - apps/web/app/(app)/students/[id]/_components/payments-tab.tsx
    - apps/web/app/(app)/students/[id]/_components/set-currency-dialog.tsx
    - apps/web/app/(app)/students/_components/unassigned-payments.tsx
    - apps/web/app/(app)/students/_components/assign-payment-dialog.tsx
  modified:
    - apps/web/app/(app)/students/[id]/_components/student-profile.tsx
    - apps/web/app/(app)/students/_components/students-screen.tsx
    - apps/web/components/app/ledger-text.tsx
key-decisions:
  - "Подпись «Choose a currency» в Record payment и Assign взята из DR-2 (Currency Select: placeholder и ошибка), отдельной строки в контракте для Record нет"
  - "В Assign дата открытия берётся из GET /students/{id} при выборе карточки (StudentRow её не содержит); сбой чтения только прячет подпись, решение об остатке принимает api"
  - "Правки оплаты нет: действие строки одно, Trash2 (D-11); строка DR-2 про «Pencil and Trash2» не применялась"
requirements-completed: [LEDG-01, LEDG-02, CARD-07]
duration: 35min
completed: 2026-10-10
coverage:
  - id: D1
    description: "Record payment: поля, предзаполнение уроков по ставке, подписи про остаток, POST /payments, остаток в шапке растёт"
    requirement: LEDG-01
    verification:
      - kind: automated_ui
        ref: "SCRATCH/19-16-browser.mjs 1 (light, dark): RECORD_OK; SQL lessons_count 1.50, credited_minutes 90"
        status: pass
    human_judgment: false
  - id: D2
    description: "Вкладка Payments: итоги по валютам, удаление с подтверждением и пересчётом остатка, Set currency для оплаты без валюты"
    requirement: LEDG-02
    verification:
      - kind: automated_ui
        ref: "SCRATCH/19-16-browser.mjs 2 (light, dark): PAYMENTS_TAB_OK"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unassigned payments и Assign payment: счётчик вкладки, валюта по умолчанию из ставки карточки, уроки, 409 из двух вкладок, удаление"
    requirement: CARD-07
    verification:
      - kind: automated_ui
        ref: "SCRATCH/19-16-browser.mjs 3 (light, dark): ASSIGN_OK"
        status: pass
    human_judgment: false
---

# Phase 19 Plan 16: Оплаты в интерфейсе Summary

**Учитель записывает оплату из профиля (уроки предзаполняются суммой и ставкой через core и не перезаписываются после ручной правки), видит и удаляет оплаты карточки с итогами по валютам, ставит валюту оплате из vault без неё и назначает несопоставленные оплаты карточке; остаток в шапке обновляется сразу.**

## Что сделано

- `ledger-text.tsx`: `formatDay` и `DateText` (календарная дата через UTC, без сдвига пояса), `describePayment`, `PaymentLessonsText` («Not counted»), `PaymentNoteText` («—», перенос `wrap-anywhere`), `rateOf`, `lessonsHelper`, `BalanceCaption` (две подписи про остаток из D-09 и D-10), `SummaryRow` (строки `bg-hover rounded-lg px-2 h-9`), `CurrencyField` (Select по CURRENCIES с подписями «RUB ₽», без пункта None).
- `record-payment-dialog.tsx`: Dialog lg; Amount (начальный фокус), Currency (по умолчанию валюта ставки карточки, иначе placeholder), Date (DateField, не позже сегодня), Lessons, Note; уроки = `lessonsDraft ?? suggestLessonsText(...)`, предзаполнение только при ставке и совпадающей валюте, пересчёт по сумме и валюте до первой правки; ошибки по Copywriting Contract; Banner при сбое с сохранением значений; кнопка loading и повторный вызов игнорируется. Кнопка Record payment в шапке профиля (primary, `Wallet`) у активной и архивной карточки.
- `payments-tab.tsx`: вкладка Payments после Overview (и в состоянии загрузки), строка «{k} payments, {итоги через +}» и приглушённая строка про оплаты без валюты, таблица Date, Amount, Lessons, Note, Actions, ячейка Amount с «No currency» и кнопкой «Set currency», удаление через `ConfirmDialog` (фокус на Keep payment), EmptyLine, ReadError, SkeletonTable. Записи из шапки перечитывают открытую вкладку (проп `refreshKey`).
- `set-currency-dialog.tsx`: Dialog sm по DR-2: сводка Date и Amount, валюта не подставляется ниоткуда, подсказка про валюту ставки, уроки по общему правилу предзаполнения, две подписи об остатке; `POST /payments/{id}/assign` с `studentId` самой карточки.
- `unassigned-payments.tsx`, `assign-payment-dialog.tsx`, `students-screen.tsx`: третья вкладка «Unassigned payments ({count})» (без числа при загрузке, `(0)` при нуле), таблица с Assign и Trash2, диалог Assign: Select активных карточек A-Z с начальным фокусом, валюта только у оплаты без неё (по умолчанию валюта ставки выбранной карточки), уроки по общему правилу, подписи об остатке для выбранной карточки (дата открытия читается через `GET /students/{id}`), сбой и 409 дают Banner и перечитывание списка и счётчика.

## Task Commits

1. **Задача 1: запись оплаты из профиля с предзаполненными уроками** - `bdc21eb` (feat)
2. **Задача 2: вкладка Payments с итогами, удалением и Set currency** - `3c9eb18` (feat)
3. **Задача 3: Unassigned payments и Assign payment** - `b3612f0` (feat)

`commits: 3` посчитано по `git log --grep "(19-16)"`: параллельно коммитит 19-15 (deploy), поэтому `git rev-list` от `plan_head_before` покажет больше.

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web typecheck` | код 0 после каждой задачи |
| `yarn workspace @dv-lab/web lint` | код 0 после каждой задачи |
| `yarn workspace @dv-lab/web build` (задача 3, dev-серверы остановлены) | код 0, маршруты `/students` и `/students/[id]` |
| Prettier по файлам плана | чисто |
| Приёмка задачи 1: `suggestLessons` есть в диалоге, `Math.round`, `toFixed`, `parseFloat` нет | код 0 |
| Приёмка задачи 2: нет `'PATCH'` и `'PUT'` в payments-tab; «Set currency», «/assign», «Save currency» на месте; нет `defaultCurrency` и `student.currency` в set-currency-dialog | код 0 |
| Приёмка задачи 3: `payment.currency === null` в assign-payment-dialog | найдено (строка 58) |

Браузер: dev-стек на dvlab_dev (`yarn workspace @dv-lab/api dev`, `yarn workspace @dv-lab/web dev`), вход dev-учителем, Chromium через playwright-core, `SCRATCH/19-16-browser.mjs` (части 1, 2, 3 и `all`), обе темы. Итоговый прогон `all` на коде коммита `b3612f0` (запущен до коммита, сборка web после него): светлая и тёмная темы без единой строки FAIL; `RECORD_OK`, `PAYMENTS_TAB_OK`, `ASSIGN_OK` в обеих темах. Проверки шли только на вымышленных карточках Alex Example 1916 (A, B, C, Z) и пробных оплатах с заметкой `probe 1916 …`; после каждого прогона в dvlab_dev карточек 1916 и пробных оплат нет (счёт 0).

- Record payment (часть 1): описание «{name}. ₽1,500 per lesson.» и «No rate is set.», начальный фокус в Amount, валюта по умолчанию RUB у карточки со ставкой и placeholder без неё; сумма 3750 RUB даёт Lessons 2.5, KZT очищает поле, возврат на RUB возвращает 2.5; ручное 1.5 переживает смену суммы и валюты; подсказка переключается между «Amount divided by the rate…» и «Leave empty…»; дата на день открытия показывает «This date is on or before …», дата сегодня подпись убирает, будущая дата в календаре недоступна; карточка без открывающего остатка показывает «The opening balance is not set…»; ошибки «Enter an amount greater than 0.», «Choose a currency.», «Use at most 2 decimal places.», «Enter 0 or more lessons, up to two decimals.», «Use 500 characters or fewer.», фокус на первом неверном поле; сбой сервера даёт Banner и значения остаются; при отправке «Saving…», поля отключены, ушёл один POST; уведомление «Payment recorded» / «₽4,500 for {name}.», шапка «4.5 lessons left»; фокус возвращается на Record payment; у архивной карточки кнопка есть, оплата без уроков хранится как null и 0 минут. SQL последней оплаты карточки A: `lessons_count 1.50`, `credited_minutes 90`.
- Payments (часть 2): пустая вкладка (EmptyLine, строки итогов нет); запись из шапки на открытой вкладке даёт «1 payment, ₽4,500»; колонки и строка Date, Amount, Lessons, Note; подтверждение удаления (заголовок, текст, фокус на Keep payment, цвет destructive у Delete payment, Esc оставляет оплату); сбой удаления даёт Banner; при удалении «Deleting…» и ровно один DELETE; уведомление «Payment deleted» / «The balance was recalculated.», шапка снова «3 lessons left»; итоги «3 payments, ₽3,500 + ₸90,000», порядок по дате убывания, остаток 5.5 (оплата на день открытия и раньше не считается); заметка из 300 символов переносится, при 1280 и 320 px страница вбок не прокручивается, при 320 px таблица прокручивается внутри рамки; оплата без валюты: «1,200 No currency», кнопка Set currency с нужным `aria-label`, строка «2 payments have no currency and are not totalled.»; диалог Set currency: валюта не выбрана и без пункта None, подсказка про валюту ставки, сохранение без выбора даёт «Choose a currency.» с фокусом и `aria-invalid`, RUB даёт Lessons 0.8, KZT очищает; сбой даёт Banner, при отправке поля и обе кнопки отключены и ушёл один запрос; уведомление «Currency set» / «₽1,200 on {name}'s card.», шапка «3.8 lessons left», строка показывает ₽1,200 и 0.8, итоги учитывают оплату; SQL: RUB, `0.80`, 48 минут; подпись «on or before» для оплаты на день открытия; карточка без ставки: нет подсказки про ставку, валюта не подставлена, подпись про незаданный остаток, уроки пустые.
- Unassigned и Assign (часть 3): при загрузке метка вкладки без числа; число во вкладке равно `select count(*) from payments where student_id is null`, строк столько же; колонки, строки не ссылки; Assign: сводка Date, Amount, Note, начальный фокус на Student, поле Currency видно у оплаты без валюты и не выбрано, без выбора карточки ошибки «Choose a student.» и «Choose a currency.»; в Select только активные карточки A-Z (число равно SQL, архивная карточка отсутствует); выбор карточки ставит валюту RUB и Lessons 0.8, KZT очищает уроки; сбой даёт Banner; при отправке «Assigning…», одна отправка; уведомление «Payment assigned» / «₽1,200 is now on {name}'s card.», счётчик уменьшился и равен SQL, оплата на карточке (RUB, `0.80`, 48), шапка «3.8 lessons left»; две вкладки браузера: вторая получает 409, Banner «Could not assign the payment. Try again.», диалог остаётся, список и счётчик второй вкладки перечитаны, оплата на одной карточке; у оплаты с валютой поля Currency нет; удаление несопоставленной (текст, фокус на Keep payment, Esc, уведомление «Payment deleted» / «The payment was removed.», счётчик); сбой чтения вкладки (один ReadError, Refresh возвращает список); нуль даёт «(0)» и EmptyLine; при 320 px страница вбок не прокручивается. Реальная несопоставленная оплата vault не тронута: `count(*) where student_id is null and source = 'vault'` до и после равно 1.

Скриншоты (только в SCRATCH): `19-16-{light,dark}-record-*`, `payments-*`, `delete-*`, `nocurrency-*`, `setcurrency-*`, `unassigned-*`, `assign-*`. Dev-серверы остановлены, слушателей на портах 3000 и 4000 нет, `apps/web/AGENTS.md` удалён и не коммитился.

Не запускалось: `yarn knip` (красный до 19-19), `yarn test` (новых тестов нет, существующие не затронуты), реальные карточки vault в браузере не открывались (только счётчики SQL), клавиатурный проход по Select и календарю кроме Esc и Enter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Три вкладки списка расширяли страницу вправо при 320 px**
- **Found during:** Задача 3, проверка узкой ширины
- **Issue:** `TabsList` (`inline-flex`) с вкладкой «Unassigned payments (N)» шире экрана, ScrollArea растягивался на 41 px.
- **Fix:** у `TabsList` экрана Students добавлено `max-sm:w-0 max-sm:min-w-full max-sm:overflow-x-auto` (тот же приём, что у рамки таблицы): список прокручивается внутри себя только на узких экранах, на широких вид прежний.
- **Files modified:** apps/web/app/(app)/students/_components/students-screen.tsx
- **Committed in:** b3612f0

**2. [Rule 2 - Missing functionality] Диалог Assign не должен пропадать при перечитывании списка**
- **Found during:** Задача 3
- **Issue:** при 409 список перечитывается, оплата исчезает, и ранний `return` с EmptyLine убрал бы диалог вместе с Banner.
- **Fix:** диалоги `UnassignedPayments` рендерятся вне ранних return; у `AssignPaymentDialog` добавлен проп `onFailed` (перечитать список и счётчик).
- **Committed in:** b3612f0

**3. Уточнения к контракту без смены вида**
- `PaymentsTab` получил проп `refreshKey` (запись оплаты из шапки перечитывает открытую вкладку).
- Заметка в таблице получила `min-w-64` (при 320 px заметка из 300 символов без пробелов занимала 496 px высоты, с `min-w-64` 296 px; таблица прокручивается в рамке).
- Правило предзаполнения вынесено в `suggestLessonsText` (record-payment-dialog.tsx), его же используют Set currency и Assign; общие подписи и поля вынесены в `ledger-text.tsx` (файл есть в `files_modified`).

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing functionality) и 3 уточнения.
**Impact on plan:** на контракт и вид экранов не влияет.

## Наблюдения для следующих планов и дизайна

- `opening-balance-panel.tsx` (19-14) держит приватную копию `formatDay`; теперь есть общая в `ledger-text.tsx`. Убрать дубль можно в 19-19 (файл вне `files_modified` этого плана).
- Ошибки «Choose a date.» у Record и Set currency нет: `DateField` не позволяет очистить значение. Сумма больше `AMOUNT_MINOR_MAX` клиентом не проверяется (текста в контракте нет): сервер ответит 400, диалог покажет Banner.
- В DR-2 в строке про Actions написано «Pencil and Trash2», в UI-SPEC (Payments) и D-11 правки оплаты нет; построено Trash2 без Pencil. Вопрос к Design dude, если правка оплаты всё же нужна.
- Esc при открытом списке Select внутри Dialog, по-видимому, закрывает и диалог (замечено косвенно: сценарий проверки потерял диалог; отдельно не исследовалось, поведение копий Select и Dialog не менялось).
- Скриншоты вкладки Unassigned в SCRATCH включают строку реальной оплаты vault: в репозиторий и отчёты не попадают.

## Known Stubs

Нет.

## Threat Flags

Новой поверхности сверх `<threat_model>` нет. T-19-70: кнопки loading и отключены, `if (pending) return`, в браузере ушёл один POST и один DELETE. T-19-71: 409 из двух вкладок даёт Banner и перечитывание списка и счётчика. T-19-72: деньги, уроки и предзаполнение считает только `@dv-lab/core` (`parseMoney`, `parseLessons`, `suggestLessons`), минуты считает api. T-19-73: проверки только на карточках Alex Example 1916, реальная несопоставленная оплата не тронута (счёт 1 до и после), скриншоты в SCRATCH. T-19-74: заметка выводится как текст React.

## Self-Check: PASSED

- Файлы record-payment-dialog.tsx, payments-tab.tsx, set-currency-dialog.tsx, unassigned-payments.tsx, assign-payment-dialog.tsx на месте, student-profile.tsx, students-screen.tsx и ledger-text.tsx изменены; коммиты bdc21eb, 3c9eb18, b3612f0 есть в ветке.
- typecheck, lint и build web — код 0; браузерные проверки в обеих темах пройдены.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
