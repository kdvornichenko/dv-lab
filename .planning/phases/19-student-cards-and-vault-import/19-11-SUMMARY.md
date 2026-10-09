---
phase: 19-student-cards-and-vault-import
plan: 11
subsystem: ui
status: complete
tags: [students, cards, list, dialog, base-ui, combobox, select, money, lessons]
requires:
  - phase: 19-06
    provides: Select, Combobox, StatusDot, apiRequest с PATCH и PUT
  - phase: 19-07
    provides: GET и POST /students для карточек, StudentRow, StudentsResponse, StudentDetail
provides:
  - экран /students со списком карточек, вкладки Active и Archived
  - StudentFormDialog (create и edit) для 19-14
  - MoneyText и LessonsText поверх packages/core
affects: [19-14, 19-16, 19-18, 19-19]
actuals:
  tokens: 6000
  tasks: 3
  commits: 3
plan_head_before: b3981ceff5cef27176f7696bd40c2dce1191600b
plan_head_after: 12e616db58abfe8321f0de02e716e6bc68af6897
tech-stack:
  added: []
  patterns:
    - "строка таблицы ведёт на карточку, имя остаётся настоящим Link; клик по ссылке не дублируется обработчиком строки"
    - "форма карточки проверяет теми же предикатами контракта и core, что сервер (isDisplayNameLength, parseMoney, currencyDigits)"
key-files:
  created:
    - apps/web/app/(app)/students/_components/student-form-dialog.tsx
    - apps/web/components/app/ledger-text.tsx
  modified:
    - apps/web/app/(app)/students/_components/students-screen.tsx
    - packages/contracts/src/auth.ts
key-decisions:
  - "Список часовых поясов: Intl.supportedValuesOf плюс короткий список современных имён IANA, которых в нём нет (Asia/Ho_Chi_Minh, Asia/Kolkata, Europe/Kyiv и ещё четыре); каждое имя проходит isTimeZone"
  - "Диалог сам показывает уведомление и в режиме создания сам переходит на /students/{id}; экран только закрывает диалог и перечитывает список"
  - "Выбор «None» в Currency хранится как значение none, «Same as teacher» в Time zone как same-as-teacher; на сервер уходит null"
requirements-completed: [CARD-01, LEDG-02]
completed: 2026-10-10
duration: 75min
---

# Phase 19 Plan 11: Список карточек и диалог New student Summary

**Экран Students показывает карточки со ставкой и остатком в уроках во вкладках Active и Archived, диалог New student создаёт карточку со всеми полями (форма проверяет теми же правилами, что сервер), StudentListResponse удалён.**

## Что сделано

- `components/app/ledger-text.tsx`: `MoneyText` (formatMoney, без валюты приглушённое « No currency») и `LessonsText` (formatLessons или lessonsPhrase), оба `tabular-nums`; строки денег и уроков формирует только `@dv-lab/core`.
- `students-screen.tsx` переписан под `GET /students`: заголовок Students, описание «{n} active, {m} archived» (SkeletonText при загрузке), кнопка New student с `UserPlus`, вкладки Active и Archived с `aria-label` «Student lists», колонки Student, Status, Rate, Lessons left (последняя выровнена вправо вместе с заголовком). Строка целиком ведёт на `/students/{id}`, имя настоящий `Link` с кольцом фокуса, архивные приглушены, сортировка внутри вкладки по имени без учёта регистра (`Intl.Collator`). Пустая вкладка — `EmptyLine`, сбой чтения — один `ReadError screen="students"` с Refresh и заголовком, загрузка — `SkeletonTable` в каждой вкладке. Таблица аккаунтов, колонки Login и Created, Deactivate и импорт диалогов фазы 18 из экрана убраны.
- `student-form-dialog.tsx`: `StudentFormDialog({ mode, student?, onClose, onSaved })`, `Dialog lg`; Name, Rate per lesson + Currency (`Select`: None, RUB ₽, KZT ₸, USD $, EUR €), Lesson length (min) + Time zone (`Combobox`), Parent + Level, Goals. Тексты, подсказки и ошибки по Copywriting Contract 19-UI-SPEC. Ошибки показываются при отправке или уходе с поля, фокус на первое неверное поле, при отправке кнопка loading и поля отключены, повторная отправка игнорируется (`if (pending) return`). Create: `POST /students`, уведомление «Student created» / «{name} was added.», закрытие и `router.push(/students/{id})`. Edit: `PATCH /students/{id}`, «Changes saved» / «{name} was updated.», `onSaved(student)`; режим подключит 19-14.
- `packages/contracts/src/auth.ts`: удалён `StudentListResponse`, ссылок на него в apps и packages нет. `CreateStudentResponse` и `DeactivateStudentResponse` остаются для 19-18.
- Старые `create-student-dialog.tsx` и `deactivate-student-dialog.tsx` не тронуты (вне `files_modified`): экран их больше не импортирует, их переделают 19-12 и 19-18.

## Task Commits

1. **Задача 1: список карточек со ставкой и остатком в уроках** - `ab049bc` (feat)
2. **Задача 2: диалог New student** - `d6b3601` (feat)
3. **Задача 3: удалить StudentListResponse** - `12e616d` (refactor)

`commits: 3` посчитано по `git log --grep "(19-11)"`: в той же рабочей копии параллельно коммитят 19-09 и 19-10, поэтому `git rev-list` от `plan_head_before` даёт 7.

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web typecheck` | код 0 |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `yarn workspace @dv-lab/contracts typecheck`, `@dv-lab/api typecheck` | код 0 |
| `yarn workspace @dv-lab/web build` | код 0, 7 страниц |
| `git grep StudentListResponse -- apps packages` | пусто |
| Prettier по файлам плана | чисто |
| grep: нет `Intl.NumberFormat`, `toFixed`, `/ 60`, `Login`, `Created`, `Create student account` в students-screen.tsx | пусто |
| grep: `isDisplayNameLength` и `CURRENCIES` в форме, литералов 80 нет | выполнено |

Браузер: dev-стек (`yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev`, база dvlab_dev), вход dev-учителем, Chromium через playwright-core. Скрипты `SCRATCH/19-web-lib.mjs`, `19-11-part1.mjs`, `19-11-part2.mjs`, `19-11-browser.mjs all [dark]`; итоговый прогон на собранном коммите `12e616d`:

- светлая тема: `LIST_OK` и `FORM_OK`, ни одной строки FAIL;
- тёмная тема: `LIST_OK` и `FORM_OK`, ни одной строки FAIL.

Список (часть 1, вымышленные карточки Alex Example 1911 A, B, 0): колонки и заголовок, описание из двух целых чисел, строка A «₽1,500 / lesson» и «1.5» без минут, карточка без ставки «No rate» и «Set opening balance», порядок по имени без учёта регистра, точки Active и Archived (разный цвет, подсказка и `aria-label`), архивное имя приглушено, кольцо фокуса на имени, клик по ячейке и по имени ведёт на `/students/{id}`, пустые вкладки («Nothing here yet», кнопка New student остаётся), сбой чтения (один ReadError, в заголовке только h1, Refresh возвращает список), загрузка со скелетоном, в консоли нет ошибок кроме подставленного 500.

Форма (часть 2): фокус в Name, порядок подписей, описание и подсказки, нет поля Status; ошибки «Enter the student's name.», «Use at most 2 decimal places.» (1500.555 с RUB), «Enter a rate greater than 0.», «Enter the rate or set the currency to None.», «Choose a currency.», «Use 15 to 240 minutes.» (14 и 241), «Use 80 characters or fewer.», «Use 200 characters or fewer.», значения при ошибках сохраняются; поиск «ho_chi» и «HO_CHI» оставляет одну строку Asia/Ho_Chi_Minh; сбой сервера даёт Banner, диалог открыт, значения целы; при отправке «Creating…», все поля отключены, ушёл ровно один POST; после успеха уведомление, переход на `/students/{id}`, сохранённая карточка совпадает с формой (ставка, валюта, длина урока, пояс, Parent, Level, Goals; остаток null), в списке новая карточка в Active со ставкой и «Set opening balance»; Discard changes и Esc возвращают фокус на New student.

Backstop «часовые пояса без задержки»: список из 426 строк открывается за 238–290 мс (все строки в DOM, виртуализации нет), поиск и прокрутка (высота прокрутки 15344 px при окне 300 px) отзываются без заметной задержки.

Скриншоты (только в SCRATCH): `19-11-{light,dark}-list-active.png`, `list-archived`, `list-empty`, `list-readerror`, `list-loading`, `form-empty`, `form-name-error`, `form-currency-error`, `form-timezone-search`, `form-filled`, `form-banner`, `form-pending`, `after-create`. После прогонов фикстур в dvlab_dev нет (счёт 0). Порты 3000 и 4000 свободны, процессы остановлены.

Не запускалось: `yarn knip` (красный до 19-19), `yarn test` (новых тестов нет, существующие не затронуты), проверка на ширине 320 px и с 60- и 300-символьными именами (длинный текст и переполнение остаются на проверку 19-14, 19-19), режим правки диалога (подключит 19-14, в браузере не проверялся), клавиатурный проход по Select и Combobox кроме Esc.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] В списке часовых поясов нет Asia/Ho_Chi_Minh**
- **Found during:** Задача 2, проверка поиска «ho_chi»
- **Issue:** `Intl.supportedValuesOf('timeZone')` отдаёт старые канонические имена (Asia/Saigon, Asia/Calcutta, Europe/Kiev), поэтому учитель, который ищет Ho Chi Minh, Kolkata или Kyiv, ничего не находил, а проверка плана («ho_chi» находит Asia/Ho_Chi_Minh) не могла пройти.
- **Fix:** к списку Intl добавлен короткий перечень современных имён IANA (Asia/Ho_Chi_Minh, Asia/Kolkata, Asia/Kathmandu, Asia/Yangon, Europe/Kyiv, America/Argentina/Buenos_Aires, Atlantic/Faroe); имя попадает в список только если проходит `isTimeZone` из контрактов (то же, что проверяет сервер); сохранённый пояс карточки, которого нет в списке, тоже добавляется (нужно режиму правки).
- **Files modified:** apps/web/app/(app)/students/_components/student-form-dialog.tsx
- **Committed in:** d6b3601

**2. [Rule 3 - Blocking] React Compiler отклонил useMemo**
- **Found during:** Задача 2, lint
- **Issue:** `react-hooks/preserve-manual-memoization` на зависимости `student?.timeZone`.
- **Fix:** сборка списка вынесена в чистую функцию `buildTimeZones(saved)`, зависимость стала `savedTimeZone`.
- **Committed in:** d6b3601

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** на вид и контракт не влияют; первое меняет только состав списка поясов.

## Наблюдения для дизайна и следующих планов

- `Select` и `Combobox` варианта A используют `bordered` с прозрачным фоном и кольцом, а `Input` проекта — с заливкой `bg-input/20`: в одном ряду формы поля выглядят чуть по-разному. Это копии без перестилизации по правилу плана; если Design dude нужна единая заливка, вопрос к нему.
- Ошибка `Select` и `Combobox` рисуется самим компонентом (подпись с отступом `pl-3`), ошибка `TextField` без отступа: сдвиг в 12 px между соседними полями. Свой вид не придумывался.
- Подсказки полей `Select` и `Combobox` (у Currency подсказки нет, у Time zone «Empty means the same as yours.») оформлены локальной обёрткой `FieldFrame` с той же разметкой, что у `TextField`.
- Список поясов без пустого состояния: при поиске без совпадений выпадающий список пуст, текста для этого случая в 19-UI-SPEC нет, свой не добавлялся.
- 19-14 подключает `StudentFormDialog mode="edit" student={...}`: проп `student` — `StudentDetail`, `onSaved` получает карточку из ответа; уведомление диалог показывает сам, навигации в режиме правки нет.
- Экран, перейдя по `/students/{id}`, до 19-14 показывает «Page not found» (по плану).

## Issues Encountered

- Dev-api под `--watch` перезапускается, когда параллельные 19-09 и 19-10 сохраняют файлы api: один прогон упал на ожидании заголовка, повтор прошёл без правок.
- Фикстуры первой версии скрипта с именем в нижнем регистре не удалялись `like`; очистка переведена на `ilike` (только карточки без `import_key`).

## Known Stubs

Нет. Колонка «Lessons left» и ставка берут данные из ответа api; «Set opening balance» в списке намеренно приглушённый текст, не кнопка (UI-SPEC).

## Threat Flags

Новой поверхности сверх `<threat_model>` нет. T-19-45: `page.tsx` по-прежнему вызывает `requireTeacherPage`, api отвечает 403 ученику (19-07). T-19-46: форма использует те же предикаты, что сервер. T-19-47: кнопка loading, поля отключены, повтор игнорируется (в браузере ушёл один POST). T-19-48: скриншоты только в SCRATCH, проверки на вымышленных карточках.

## Self-Check: PASSED

- `apps/web/app/(app)/students/_components/student-form-dialog.tsx`, `apps/web/components/app/ledger-text.tsx`, `students-screen.tsx`, `packages/contracts/src/auth.ts` на месте; коммиты ab049bc, d6b3601, 12e616d есть в ветке.
- typecheck (contracts, api, web), lint и build web — код 0; браузерные проверки в обеих темах пройдены.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
