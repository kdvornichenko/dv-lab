---
phase: 19-student-cards-and-vault-import
plan: 20
subsystem: ui
status: complete
tags: [forms, fields, combobox, select, date-field, escape, time-zone, design-system]
requires:
  - phase: 19-06
    provides: Select, Combobox, Textarea, Popover, Calendar, DateField
  - phase: 19-11
    provides: StudentFormDialog со списком часовых поясов
  - phase: 19-16
    provides: Record payment, Set currency, CurrencyField
  - phase: 19-18
    provides: Create account из карточки
provides:
  - единый вид полей Input, Textarea, Select, Combobox и поля даты (ответ Design dude, FormFields)
  - одна строка ошибки без отступа, связанная через aria-describedby, ошибка заменяет подсказку
  - Combobox: popup bg-surface-4 rounded-xl p-1 max-h-72 шириной с поле, строки со слотом галочки и деталью, пустой результат emptyTitle и emptyHint
  - поиск часового пояса по имени, городу и смещению UTC, деталь смещения у каждого пояса
  - Esc внутри диалога закрывает только верхний слой
affects: [19-21, 20, 24, 25]
actuals:
  tokens: 8100
  tasks: 3
  commits: 3
plan_head_before: a59ee7f76547ca1750b1da324ff77c6c7f0892eb
plan_head_after: 8ed4639f94f253787ae46c8f5b30fffb0e814732
tech-stack:
  added: []
  patterns:
    - "кольцо поля задаётся литералом const fieldRing = 'ring-1 ring-inset ring-input' в каждом файле поля: prettier-plugin-tailwindcss переставляет ring-inset внутри cn и cva, литерал вне вызова он не трогает"
    - "фокус поля — глобальный :focus-visible (1px focus-ring, смещение 2px); у Combobox контур на InputGroup через focus-within, внутренний input без контура"
    - "Esc поглощает сам слой: Select и Popover через useDismiss Base UI, Combobox — смонтированный Empty плюс stopPropagation при открытом списке и preventBaseUIHandler при закрытом"
key-files:
  created: []
  modified:
    - apps/web/components/ui/input.tsx
    - apps/web/components/ui/textarea.tsx
    - apps/web/components/ui/select.tsx
    - apps/web/components/ui/combobox.tsx
    - apps/web/components/app/date-field.tsx
    - apps/web/components/app/ledger-text.tsx
    - apps/web/app/(app)/students/_components/student-form-dialog.tsx
key-decisions:
  - "Esc: выбран способ «слой сам поглощает Esc»; dialog.tsx и popover.tsx не менялись: Select и календарь DateField уже закрывали только себя, ломался только Combobox"
  - "Кнопка поля даты — обычный PopoverTrigger с видом поля и иконкой календаря справа (16px, text-muted-foreground), а не Button tertiary: у tertiary своя рамка во внутреннем span и иконка слева в цвете текста"
  - "У одиночного Combobox убран фон bg-active у выбранной строки: выбранное показывает галочка в слоте 16px, bg-active — только у подсвеченной строки"
  - "Нулевое смещение показывается как UTC (Intl даёт GMT+0)"
requirements-completed: [CARD-01, LEDG-01]
duration: 95min
completed: 2026-10-10
---

# Phase 19 Plan 20: Единый вид полей форм, пустой результат Combobox и Esc по слоям Summary

**Поля Input, Textarea, Select, Combobox и поле даты выглядят одинаково (прозрачный фон, кольцо ring-input, 36px, радиус 8px, контур фокуса 1px со смещением 2px), ошибка у всех идёт одной строкой от края поля, список часовых поясов показывает смещение UTC, ищется по нему и сообщает о пустом результате, а Esc в диалоге сначала закрывает открытый слой.**

## Что сделано

- `input.tsx`, `textarea.tsx`: убраны `border border-input`, `bg-input/20`, `dark:bg-input/30`, `outline-none` и `focus-visible:ring-*`; поставлены `rounded-md bg-transparent px-3 text-body text-foreground`, кольцо `ring-1 ring-inset ring-input`, `aria-invalid:ring-destructive`. У Textarea сохранены `min-h-16`, `field-sizing-content`, `resize-none`, `py-2`.
- `select.tsx`: у триггера `bordered` то же кольцо и `rounded-md` вместо `shape.input`, контур фокуса глобальный, ошибка через `aria-invalid:ring-destructive`; обёртка `flex flex-col gap-2`, строка ошибки `text-caption text-destructive` без `pl-3`, с `id="{id}-error"` и `aria-describedby` на триггере (если ошибки нет, проходит внешний `aria-describedby`).
- `combobox.tsx`: поле (`InputGroup` и `Chips`) — то же кольцо, `rounded-md`, отступ `px-3` из size-context, контур `focus-within:outline-1 outline-offset-2 outline-focus-ring`, без `focus-within:bg-card`; две строки ошибки без `pl-3` с `id` и `aria-describedby`. Popup: `bg-surface-4 shadow-surface-4 rounded-xl p-1`, `max-h-72`, ширина `w-[var(--anchor-width)]`, отступ от поля 4px. Строка 36px: слот 16px под галочку слева, название, справа приглушённая деталь (новое свойство `detail`, у данных пункта поле `detail`). Подсвеченная строка `bg-active`. `ComboboxList` получил `emptyTitle` и `emptyHint`: блок `ComboboxEmpty` (`px-3 text-center`, `py-6` при содержимом) с заголовком `text-body` и подсказкой `text-caption`, оба `text-muted-foreground`.
- `date-field.tsx`: триггер календаря — поле того же вида, текст даты слева, `CalendarDays` 16px `text-muted-foreground` справа.
- `ledger-text.tsx` (`CurrencyField`): подсказка скрывается при ошибке и связана с триггером через `aria-describedby` (см. отклонения).
- `student-form-dialog.tsx`: пункты поясов `{ value, label, detail }`, деталь — смещение на текущую дату через `Intl.DateTimeFormat(..., { timeZoneName: 'shortOffset' })` с заменой GMT на UTC («UTC+7», «UTC+5:30», «UTC»); в карточку по-прежнему уходит имя IANA. Фильтр `matchesTimeZone`: подстрока имени, имя с `_` как пробелом (город «ho chi»), смещение целиком («UTC+7», «+7», «GMT+7») или с минутами («UTC+5» находит +5:30 и +5:45). Пустой результат «No time zones found» / «Try a city, a country or an offset like UTC+7.». Поле получает `aria-describedby` на свою подсказку.
- Esc: `ComboboxInput` при открытом списке останавливает всплытие Esc (диалог его не получает), при закрытом отключает обработчик Base UI, который очищал выбор и глотал Esc, и событие доходит до диалога.

## Task Commits

1. **Задача 1: единый вид полей и одна строка ошибки** — `d32d1da` (feat)
2. **Задача 2: пустой результат и вид popup у Combobox, поиск пояса по смещению** — `c9ffdb2` (feat)
3. **Задача 3: Esc внутри диалога закрывает только верхний слой** — `8ed4639` (fix)

`commits: 3` — `git rev-list --count a59ee7f..HEAD` до коммита этого SUMMARY (план шёл один в волне).

## Выбор способа для Esc

Воспроизведение до правок (`SCRATCH/19-20-esc-probe.mjs`, `19-20-esc-probe2.mjs`, dvlab_dev, вымышленная карточка):

| Случай | Было |
|--------|------|
| Select Currency в New student и Record payment, открыт мышью или клавишей | первый Esc закрывал только список, фокус на триггере, диалог открыт |
| Календарь поля даты в Record payment | первый Esc закрывал только календарь, фокус на кнопке даты |
| Combobox Time zone, список с результатами | первый Esc закрывал только список |
| Combobox, запрос без результатов («zzzz») | один Esc закрывал и список, и диалог |
| Combobox, список закрыт, в поле выбранный пояс или «Same as teacher» | Esc очищал выбор и останавливал всплытие; так как пустой выбор снова превращается в «Same as teacher», диалог по Esc из этого поля не закрывался никогда |

Наблюдение 19-16 про Select в текущем коде не повторилось. Причина обоих сбоев Combobox в Base UI 1.8: `AriaCombobox.setOpen` разрешает всплытие Esc, когда список пуст и `Combobox.Empty` не смонтирован, а `ComboboxInput` при закрытом списке очищает значение и вызывает `stopPropagation`. Выбран способ «слой сам поглощает Esc»: Select и Popover уже делают это через `useDismiss`, правка нужна только в `combobox.tsx` (смонтированный Empty, `stopPropagation` при открытом списке, `preventBaseUIHandler` при закрытом). Второй способ (Dialog не закрывается, пока внутри открыт слой) потребовал бы общего реестра открытых слоёв между копиями Dialog, Select, Combobox и Popover, а портальные слои Base UI не входят в FloatingTree диалога; `dialog.tsx` и `popover.tsx` не менялись. Цена: Esc в закрытом Combobox больше не очищает выбор (очистка остаётся у пункта списка и кнопки Clear при `clearable`).

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web typecheck`, `lint`, `build` (после каждой задачи, dev-сервер web остановлен перед сборкой) | код 0 |
| Prettier по файлам плана | чисто |
| `! grep -nE "bg-input/20\|bg-input/30"` в input.tsx и textarea.tsx | пусто |
| `! grep -n "pl-3 text-"` в select.tsx и combobox.tsx | пусто |
| `grep -c "ring-1 ring-inset ring-input"` в input, select, combobox, textarea | по 1 в каждом |
| «No time zones found» и подсказка в student-form-dialog.tsx; `bg-surface-4` и `max-h-72` в combobox.tsx | найдено |
| Импортов `radix-ui`, `@radix-ui/*`, `cmdk` в apps/web | нет |

Браузер: dev-стек на dvlab_dev (`yarn workspace @dv-lab/api dev`, `yarn workspace @dv-lab/web dev`), вход dev-учителем, Chromium через playwright-core и `SCRATCH/19-web-lib.mjs`, скрипт `SCRATCH/19-20-browser.mjs` (части 1, 2, 3, `all`), обе темы. Итоговый прогон `all` на коде коммита `8ed4639`: светлая и тёмная темы без строк FAIL, `FIELDS_OK`, `COMBOBOX_OK`, `ESC_LAYERS_OK` в каждой. Проверки сравнивают вычисленные стили и геометрию, скриншоты лежат только в SCRATCH (`19-20-{light,dark}-*.png`).

- Часть 1 (вид полей): экран входа (Login, Password), New student (Name, Rate, Currency, Lesson length, Time zone, Goals), Record payment (Amount, Currency, Date, Lessons, Note), Set currency (Currency, Lessons), Create account (Login, Password) — у всех полей высота 36, фон прозрачный, радиус 8px, рамки нет, одинаковая тень-кольцо `inset`; шевроны и иконка календаря 16px справа, приглушённые, у даты 12px от края; контур фокуса `solid 1px`, смещение 2px, цвет focus-ring у Input, триггера Select, поля Time zone (на группе, внутренний input без контура) и кнопки даты; ошибки Name, Currency (New student, Record payment, Set currency), Amount, Login (вход и Create account) начинаются от левого края поля и стоят на 8px ниже, шрифт и цвет ошибки Select совпадают с ошибкой Input, кольцо невалидного Select совпадает с кольцом невалидного Input, `aria-describedby` триггера указывает на строку ошибки; подсказка Rate и подсказка Currency в Set currency пропадают при ошибке; подсказка Time zone у края поля.
- Часть 2 (Combobox): popup на 4px ниже поля, той же ширины и с того же левого края, радиус 14px (`rounded-xl`), `p-1`, `max-height 288px`; строка 36px, слот 16px слева, деталь справа; «ho_chi» и «ho chi» находят Asia/Ho_Chi_Minh с UTC+7, первая строка подсвечена (`data-highlighted`, фон `bg-active`); «UTC+7» — 15 поясов, все UTC+7; «UTC+5:30» — Asia/Kolkata и соседи; «UTC» — пояса с нулевым смещением, показанные как UTC; «zzzz» — popup открыт той же ширины, блок «No time zones found» и подсказка, отступы 24/24/12 px, по центру, 13px и 12px; выбор Enter ставит в поле Asia/Ho_Chi_Minh, созданная карточка хранит `timeZone` = `Asia/Ho_Chi_Minh` (GET /students/{id}).
- Часть 3 (Esc): Time zone со списком, Time zone с «zzzz», Currency в New student, Currency в Record payment, календарь Date в Record payment — первый Esc закрывает только слой, диалог открыт, фокус на поле; второй Esc закрывает диалог; Esc без открытого слоя (фокус в Name) закрывает диалог сразу.

Данные: проверки создавали только вымышленные карточки Alex Example 1920 (F, R, E, TZ), одну пробную оплату без валюты и пробные аккаунты `v1920.*`; после каждого прогона их счёт в dvlab_dev 0, импортированных карточек 25 (не менялись, открывались только как фон списка на скриншотах). Dev-серверы остановлены, слушателей на портах 3000 и 4000 нет, `apps/web/AGENTS.md` удалён и не коммитился.

Не запускалось: `yarn test` (новых тестов нет, файлы тестов не затронуты), `yarn knip`, подсказки (Tooltip) внутри диалога в сочетании с Esc (в формах фазы 19 их нет), `ComboboxChips` в браузере (в приложении не используется), узкая ширина 320 px.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Подсказка CurrencyField не скрывалась при ошибке**
- **Found during:** Задача 1, проверка Set currency
- **Issue:** правило дизайна «ошибка заменяет подсказку»; `CurrencyField` в `ledger-text.tsx` показывал подсказку про валюту ставки вместе с ошибкой «Choose a currency.», подсказка не была связана с полем.
- **Fix:** подсказка показывается только без ошибки и передаётся в `aria-describedby` триггера. Файл вне `files_modified`; план шёл в волне один, правка в две строки.
- **Files modified:** apps/web/components/app/ledger-text.tsx
- **Commit:** d32d1da

**2. [Rule 1 - Bug] Esc в закрытом Combobox не давал закрыть диалог**
- **Found during:** Задача 3, воспроизведение
- **Issue:** см. таблицу выше: Esc в поле Time zone с закрытым списком очищал выбор и глотал событие, диалог не закрывался.
- **Fix:** `preventBaseUIHandler` для Esc при закрытом списке.
- **Commit:** 8ed4639

**3. Поле даты без Button tertiary**
- План говорил «остаётся tertiary h-9 px-3 с тем же кольцом». У tertiary рамка рисуется тенью внутреннего span (кольцо удвоилось бы), а иконка задаётся `leadingIcon` слева в цвете текста; ответ дизайна требует иконку справа, 16px, `text-muted-foreground`. Триггер стал обычным `PopoverTrigger` с классами поля.

**4. Литерал кольца вынесен в константу**
- `prettier-plugin-tailwindcss` в `cn` и `cva` переставляет `ring-inset` в конец, и строка `ring-1 ring-inset ring-input` из приёмки исчезает. Кольцо задано константой `fieldRing` в input, textarea, select и combobox: формат остаётся чистым, grep приёмки проходит.

**5. Фон выбранной строки в одиночном Combobox убран**
- В копии выбранная строка имела фон `bg-active`, ответ дизайна отдаёт `bg-active` подсвеченной строке, а выбранное показывает галочкой. Два одинаковых фона в одном списке путались бы, поэтому фон выбранной строки снят (у `multiple` подложки выделения не менялись).

**6. text-field.tsx не менялся**
- `TextField` уже соответствовал пункту 2: обёртка `flex flex-col gap-2`, ошибка `text-caption text-destructive` с `aria-describedby`, подсказка скрывается при ошибке.

---

**Total deviations:** 2 auto-fixed (1 missing functionality, 1 bug) и 4 уточнения исполнения.
**Impact on plan:** тексты ошибок и подсказок не менялись, новых токенов и зависимостей нет.

## Наблюдения для дизайна и следующих планов

- Тёмная тема: popup Combobox по ответу дизайна `bg-surface-4` (#2c2c2c), диалог — уровень 6 (#3a3a3a), поэтому внутри диалога список темнее диалога; у Select popup считается от уровня подложки (`Elevated`) и внутри диалога светлее. В светлой теме разницы нет. Вопрос к Design dude: фиксированный surface-4 или «на 2 уровня выше подложки».
- `hover:bg-hover` у триггера Select и кнопки даты и `hover:bg-muted/50` у поля Combobox остались из копий: в ответе дизайна про hover ничего нет, у Input заливки при наведении нет.
- Шеврон Combobox стоит в кнопке 24px, поэтому от правого края 16px, у Select 12px.
- Поиск по стране в подсказке («a country») работает только там, где страна есть в имени IANA (America/Argentina/…); отдельного словаря стран нет.
- `ComboboxChips` получил тот же вид и строку ошибки, но поглощение Esc добавлено только в `ComboboxInput` (Chips в приложении не используется).

## Дополнение после ответа дизайна

Design dude ответил на вопросы раздела выше; применено в коммитах `4523916` и `20230fd` (оба `fix(19-20)`).

- Popup поля (Select, Combobox, календарь поля даты) стоит на два уровня выше подложки через `Elevated offset={2} shadowLevel={4}`: на странице (surface-2) это surface-4, в диалоге (уровень 6) уровень 8. Фиксированный `bg-surface-4` у Combobox убран, popup и тень задаёт `Elevated`, прежний вид (`rounded-xl p-1 max-h-72`, строки 36px, пустой результат, Esc) сохранён.
- `select.tsx`: тень popup поднята с уровня 3 до 4 по ответу дизайна (уровень фона уже считался от подложки).
- `popover.tsx` (вне перечня плана): popup календаря поля даты был `bg-popover shadow-md ring-1` и в тёмной теме темнее диалога; теперь тот же `Elevated`. Единственный потребитель Popover — `date-field.tsx`, он не менялся.
- Шеврон Combobox стоит в 12px от правого края (кнопка 24px получила `-mr-1`, у compact `-mr-px`), у Select и иконки календаря уже было 12px.
- Hover: у Combobox `hover:bg-muted/50` заменён на `hover:bg-hover` (оба варианта поля); у Select и кнопки даты `hover:bg-hover` уже был, у Input и Textarea заливки при наведении нет.
- `link-account-dialog.tsx`: после 409 (`account_already_linked`, `card_has_account`) остаётся только Banner; ошибка поля «Choose an account.» показывается при пустом выборе и отсутствии Banner (`failure === null`). Повторная отправка без выбора снова даёт ошибку поля и убирает Banner.

Проверки: `typecheck`, `lint`, `build` web — код 0 (dev-серверы были остановлены). Браузер, обе темы, dev-стек на dvlab_dev, `SCRATCH/19-20f-browser.mjs`, всё PASS: New student — список Time zone и список Currency, Record payment — Currency и календарь: в тёмной теме popup `rgb(72,72,72)` светлее диалога `rgb(58,58,58)`, тень задана, в светлой всё белое с тенью; Esc закрывает только слой; шеврон Time zone, шеврон Select и иконка даты в 12px от края; hover Combobox, Select и даты `rgba(255,255,255,0.06)` (тёмная) и `rgba(0,0,0,0.04)` (светлая), у Name заливки нет; настоящий 409 (второй клиент привязал аккаунт к другой карточке до отправки) показывает только Banner. Данные: карточки Alex Example 1921 и аккаунт `v1921.free1`, после прогонов удалены (0), импортированных карточек 25. Скриншоты — только в SCRATCH (`19-20f-{light,dark}-*.png`).

Не менялось: `dropdown.tsx` (меню): тень popup там уровня 3, ответ дизайна называет и меню; в формах фазы 19 его нет, при необходимости отдельная правка.

## Known Stubs

Нет.

## Threat Flags

Новой поверхности сверх `<threat_model>` нет. T-19-88: данные менялись только на карточках Alex Example 1920, импортированные карточки не тронуты (25 до и после). T-19-89: скриншоты только в SCRATCH, в SUMMARY нет имён, сумм и текста vault. T-19-SC: новых зависимостей нет.

## Self-Check: PASSED

- Изменённые файлы на месте; коммиты d32d1da, c9ffdb2, 8ed4639 есть в ветке.
- typecheck, lint и build web — код 0; браузерные проверки в обеих темах пройдены.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
