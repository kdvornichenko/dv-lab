---
phase: "21"
slug: "lesson-accounting-and-today"
status: draft
shadcn_initialized: false
preset: "variant A (design system artifact v36, manual copy)"
design_version: "v36"
created: "2026-10-10"
---

# Phase 21 — UI Design Contract

> Визуальный и интерактивный контракт фазы 21 (отметки уроков, остаток, Today, правки дизайна фазы 20). Генерирует gsd-ui-researcher, проверяет gsd-ui-checker.
>
> Контракт расширяет `20-UI-SPEC.md` (он расширяет 19 и 18) и не пересматривает то, что там зафиксировано: токены, шкала отступов, четыре размера и два начертания текста, роли цвета, размеры `Dialog` (`sm` 400 / `lg` 540), правила pending и двойной отправки, механизм тостов, `ReadError`, `ConfirmDialog`, правила клавиатуры и тем. Тексты интерфейса на английском, пояснения на русском.
>
> **Версия дизайна: v36** (`cat ~/dv-lab-design/VERSION`, 2026-10-10: «Phase 21: Today, marks, Pays soon, balance, no-show flag»). Планы записывают эту версию в шапку. Контракт пересобран по README и `preview.html` компонентов TodayPage, LessonMark, StudentBalance, StudentForm, DueList, LessonDialog, EventTooltip, WeekGrid, LessonList, StatusDot, SettingsGeneral, Table, TimeZonePicker, TimePair, Stat, Switch, EmptyState и по `project/principles.md` (глоссарий, решения, «Behaviour contracts»).
>
> Метки источников: **[D-nn]** решение `21-CONTEXT.md` (D-12b и D-12c — решения владельца по размерам и счётчику «To mark»), **[20]** унаследовано из `20-UI-SPEC.md`, **[v36]** README или превью компонента в `~/dv-lab-design/project/components/<Name>/`, **[P]** `principles.md`, **[mem]** память `phase21-design-followups` (пункты 1-18), **[default]** выбрано здесь там, где v36 молчит, мелочь, исполнитель не останавливается; такие места сведены в таблицу «Defaults» в конце раздела «Open Questions», **[OQ-n]** действительно открытый вопрос из раздела «Open Questions».
>
> **Правило фазы (D-12a, `design-system-everywhere`).** Дизайн фазы 21 нарисован (v36); всё, чего в v36 нет, не придумывается: у такого элемента стоит [OQ-n], исполнитель следует указанному там умолчанию и пишет расхождение в SUMMARY для Design dude. Запросов Design dude к UI-C больше нет: DR-9..DR-16 закрыты v36.
>
> **Порядок (D-12).** План UI-A (пункты 1-11) и план UI-B (пункты 12-18) идут первыми. Пункты 12-18 закрыты дизайном v32-v36, `TimeZonePicker` описан полностью. План UI-C (Today, отметки, настройка «Pays soon», флаг неявки, показ долга) идёт после A и B (нужны `TimeZonePicker`, экран Settings, `Switch`) и ответов дизайна больше не ждёт.
>
> **Гигиена данных.** Репозиторий публичный. В файле нет настоящих имён, сумм и дат из vault; примеры: «Anna K.», «Ben R.», нейтральные даты октября 2026.
>
> Состояние кода на момент написания (проверено в рабочем дереве): `apps/web/app/(app)/page.tsx` показывает `PageHeader title="Today"` и `EmptyLine`; маршрута `/settings` и строки «Settings» в сайдбаре нет (`sections.ts`: Today, Chat, Students, Schedule); `Switch`, `EmptyState`, `Stat` в `components/ui` и `components/app` отсутствуют; `LessonList`, `DueList` в репозитории нет; `StatusDot` в `components/app/status-dot.tsx` принимает только `status` ученика (`active`, `archived`, `deactivated`), тонов и `label` у него нет; `lesson-block.tsx` держит собственные `DOT` и `LessonStatus` (planned, cancelled, moved); в таблице учеников колонка называется «Lessons left», ячейка баланса выровнена вправо.

---

## Scope

| Часть | Что входит |
|-------|-----------|
| UI-A | Пункты 1-11 памяти: подсказки End series, «None», время серии по `TimePair`, токены текста тултипа, гаттер, тулбар, короткие блоки, форма переноса и `TimePicker`, фэйды, баг обрезки времени, время VN в тултипе |
| UI-B | Пункты 12-18: протяжка создания урока, метки зон (сокращения вместо `UTC+N`), избранные зоны, `TimeZonePicker`; Settings минимумом (сайдбар, `/settings`, вкладка General, карточка «Time zones» без «Main zone») |
| UI-C | Today (`TodayPage`), отметки Done / No-show (`LessonMark`: диалог урока, тултип, блок сетки, строки Today), карточка «Payments» с порогом «Pays soon», переключатель «No-show deducts a lesson» (`StudentForm`), показ остатка и долга (`StudentBalance`), `DueList` |
| Не входит | Чат и быстрые отметки из чата (22), профиль ученика с вкладкой уроков и рядом `Stat` (23), Today и расписание на телефоне (23), окно ассистента на Today (22), цвета Google (24-25), `ScheduleAgenda`, карточки «Account» и «Appearance» и вкладки «Google Calendar», «Assistant» экрана Settings |

Только десктоп; узкие окна не ломаются, телефонная раскладка в фазе 23 [20].

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (`components.json` отсутствует; ручное копирование из дизайн-системы варианта A); shadcn CLI не используется |
| Preset | not applicable (токены варианта A уже в `apps/web/app/globals.css`) |
| Component library | Base UI (`@base-ui/react@1.8.0`); Radix и `cmdk` запрещены (ESLint) |
| Icon library | `lucide-react@1.53.0` |
| Font | Inter Variable (`--font-sans`); JetBrains Mono на этих экранах не используется |
| Theme | `next-themes`, светлая и тёмная; всё проверяется в обеих |
| Design source | артефакт v36, выгрузка `~/dv-lab-design/` (`VERSION`, `project/principles.md`, `project/components/<Name>/README.md` и `preview.html`, `project/tokens.css`, `project/assets/Reference/`) |

Новых npm-пакетов в фазе нет. Копирование из рабочей копии design-lab (`/Volumes/T7/personal/vault/.claude/worktrees/design-lab`, источник кода для частей, у которых в артефакте нет кода): `Switch` (раздел «Copy list»).

Соответствие кнопок v36 вариантам репозитория (`components/ui/button.tsx`: `primary`, `secondary`, `tertiary`, `ghost`; размеры `default` 36 px, `compact` 28 px, `icon-compact` 28 px): «outline» v36 = `tertiary`, «secondary» = `secondary`, «ghost» = `ghost`, «compact» = `size="compact"` [20].

---

## Component Inventory

Enumerated by `ls apps/web/components/ui apps/web/components/app apps/web/components/sidebar-app | grep -c '\.tsx$'` (запуск из корня рабочего дерева, результат 42) — copied source, not a package — `@base-ui/react@1.8.0` as pinned in `apps/web/package.json` (в рабочем дереве нет `node_modules`, версия взята из пина) — 2026-10-10.

Enumerated by `ls ~/dv-lab-design/project/components | wc -l` (результат 94) — design system artifact `~/dv-lab-design` — v36 (`cat ~/dv-lab-design/VERSION`) — 2026-10-10.

Таблицы ниже — неисчерпывающий список заведомо подходящих компонентов, не закрытый список: проверять компонент вне таблицы нормально.

### Уже в репозитории (использовать как есть)

| Component | Path | Для чего в фазе |
|-----------|------|-----------------|
| `Button` (варианты и размеры выше; `loading`, `leadingIcon`) | `components/ui/button.tsx` | Тулбар, кнопки диалогов, быстрые отметки (`compact`, 28 px) |
| `Dialog*` (`sm` / `lg`) | `components/ui/dialog.tsx` | Диалог урока, диалоги серии, форма ученика |
| `Select*`, `Combobox*`, `Popover*`, `Calendar`, `DateField`, `TimePicker`, `TextField`, `Input` | `components/ui/*`, `components/app/*` | Формы, поле порога |
| `Banner*` | `components/ui/banner.tsx` | Ошибки и предупреждения в диалогах и карточках |
| `Tabs`, `Table*`, `Skeleton*`, `Tooltip`, `ScrollArea`, `Dropdown` / `menu-item` | `components/ui/*` | Список учеников, вкладки Settings, загрузка Today, меню отметки |
| `PageScroll`, `PageHeader` (`eyebrow`, `titleRef`), `Panel`, `Avatar`, `ReadError`, `EmptyLine`, `ConfirmDialog` | `components/app/*` | Каркас экранов |
| `TimePair` | `components/app/time-pair.tsx` | Пара времён: главная строка VN и вторая зона `text-micro` |
| `LessonsText`, `MoneyText`, `useToast`, `Elevated` | `components/app/ledger-text.tsx`, `app/(app)/_components/toasts.tsx`, `lib/elevated` | Остаток, тосты (только успех: заголовок и описание), фрейм |
| `RecordPaymentDialog` | `students/[id]/_components/record-payment-dialog.tsx` | Основа для «Add payment» на Today [OQ-2] |

### Нужно построить по v36 (README и превью дизайна, готового кода нет)

| Component | Источник [v36] | Target | Для чего |
|-----------|----------------|--------|----------|
| `TodayPage` | `TodayPage/README.md`, `preview.html` | `app/(app)/page.tsx`, `app/(app)/_components/today-*.tsx` | Экран Today: шапка, счётчики, панели «Lessons today», «Earlier, not marked», «Pays soon» |
| `LessonMark` | `LessonMark/README.md`, `preview.html` | `app/(app)/_components/lesson-mark-*.tsx` (кнопки и меню строки), `schedule/_components/lesson-mark-row.tsx` (строка «Mark» диалога), знак на блоке сетки | Отметки Done / No-show в строке Today, в диалоге урока, на блоке и в тултипе |
| `StudentBalance` | `StudentBalance/README.md`, `preview.html` | `components/app/student-balance.tsx` (ячейка таблицы, фраза, точка) | Остаток и долг в таблице учеников, в «Balance now», в сводке профиля, в `DueList` |
| `StudentForm` (доработка) | `StudentForm/README.md`, `preview.html` | `students/_components/student-form-dialog.tsx`, `students/[id]/_components/overview-tab.tsx` | Строка `Switch` «No-show deducts a lesson», поле зоны на `TimeZonePicker`, строка «No-show» в панели Details |
| `StatusDot` (доработка) | `StatusDot/README.md` | `components/app/status-dot.tsx` | Проп `tone` (`red`, `amber`, `blue`, `green`, `gray`) и `label`; цель 24 px с фокусом; статус ученика остаётся (`active` → green, остальные → gray) |
| `Stat` | `Stat/README.md` (`size="display"` для счётчиков страницы) | `components/app/stat.tsx` | Счётчики Today |
| `EmptyState` | `EmptyState/README.md` | `components/app/empty-state.tsx` | Пустые панели Today (заменяет `EmptyLine` только на них) |
| `LessonList`, `DueList` | `LessonList/README.md`, `DueList/README.md` | `app/(app)/_components/` | Панели Today; `DueList` без срока и суммы |
| `TimeZonePicker` | `TimeZonePicker/README.md` (построить один раз) | `components/app/time-zone-picker.tsx` | Тулбар, Settings, форма карточки ученика |
| Settings (General) | `SettingsGeneral/README.md` | `app/(app)/settings/` | Карточки «Time zones» и «Payments»; объём в B4 и C3 |

### Copy list из design-lab (пути относительно `apps/web`)

| Component | Source in design-lab (`src/`) | Target | Для чего |
|-----------|------------------------------|--------|----------|
| `Switch` | `components/ui/switch.tsx` (373 строки; импорты `@base-ui/react/switch`, `framer-motion`, `@/lib/utils`, `@/lib/springs`, `@/lib/size-context`; всё из этого уже есть в репозитории) | `components/ui/switch.tsx` | «No-show deducts a lesson» в форме ученика |

Правила копирования те же, что в 20: правятся только импорты, размеры и язык, без перерисовки; `grep -rn "@radix-ui\|radix-ui\|cmdk" apps/web --include='*.tsx' --include=package.json` после копирования ничего не возвращает.

---

## Spacing Scale

Как в базе [19, 20]: 4 / 8 / 16 / 24 / 32 / 48 / 64, без полушагов, без `3`, `5`, `7`, `28` в новом и правленом коде, кроме перечисленных ниже. Формы `gap-4`; подпись и поле `gap-2`; ряд из двух полей `grid gap-4 sm:grid-cols-2`; блок страницы `gap-4 md:gap-6`; ячейка таблицы `px-4 py-2`.

**Исключения: значения дизайн-системы, принятые владельцем (D-12b).** Это не нарушения шкалы. Основание: правило владельца «дизайн-система на всём сайте, без исключений» и D-19 фазы 20; размеры взяты из v36 как есть, без пересчёта под общие правила чекера (шаг 4/8/16). Каждое значение привязано к источнику.

| Размер | Значение | Где | Источник |
|--------|----------|-----|----------|
| Шаг 12 px | зазор плиток `Stat`, 12 px (`gap-3`, «`space-3` gaps») | Счётчики Today | `Stat/README.md`; единственное место со шагом 12 вне гаттера; D-12b |
| Шаг 12 px | гаттер сетки 100 px = 12 + 36 + 8 + 36 + 8; 12 px слева от колонки второй зоны | WeekGrid | `WeekGrid/README.md`, «Gutter details»; D-12b (в коде сейчас 80 px, `COLUMNS` в `week-grid.tsx`) |
| 12 px | значок галочки или user-x на блоке сетки, 12 px; шеврон триггера тулбара 12 px | Блок сетки, `TimeZonePicker` | `LessonMark/README.md` («On the week grid»), `TimeZonePicker/README.md`; D-12b |
| 2 px, 6 px | поля блока урока и рамки протяжки 2 px 6 px, радиус 6 px | WeekGrid, рамка протяжки | `WeekGrid/README.md`, «The frame» (геометрия блока урока); D-12b |
| 22 px | минимальная высота блока короче 30 минут | WeekGrid | D-12b, `20-UI-SPEC.md` «Blocks»; в README v36 этого числа нет, различие 20 с дизайном остаётся записанным для Design dude |
| 8 px | точка «Needs a mark» на блоке, 8 px с кольцом 1 px | WeekGrid | `LessonMark/README.md`, `StatusDot/README.md` |
| 40 px, 32 px, 88 px, 72 px | строка `LessonList`, строка `DueList`, колонка времени (не меньше 88 px, растёт под «Thu 01:00 NZDT»), колонка даты «Earlier, not marked» | Today | `LessonList/README.md`, `DueList/README.md`, `TodayPage/README.md` |
| 28 px, 32 px, 168 px | кнопки тулбара и строк Today 28 px; пилюли строки «Mark» 32 px; меню отметки 168 px со строками 28 px | Today, диалог урока, тулбар | `LessonMark/README.md`, `ScheduleToolbar/README.md` |
| 96 px | ширина поля порога «Pays soon threshold (lessons)» | Settings | `SettingsGeneral/README.md` |
| 128 px | метка в строках панели Details | Профиль | `StudentForm/README.md` |
| 20 px, 14 px, 24 px | кнопка-звезда избранного 20 px, значок 14 px; цель `StatusDot` 24 px (точка 8 px) | `TimeZonePicker`, `StatusDot` | `TimeZonePicker/README.md`, `StatusDot/README.md` |
| 36 px, 400 / 540 px, 280 px | высота полей и триггеров; ширина диалогов; попап зон от тулбара | как раньше, `TimeZonePicker` | [20], `TimeZonePicker/README.md` |

---

## Typography

Четыре размера и два начертания базы [19, 20]: Display 22/28 (600), Heading 16/22 (600), Body 13/20 (400 и 600), Caption 12/16 (400). Весов ровно два: 400 и 600. `Stat size="display"` = Display, `Stat size="title"` = Heading (16/22). `text-subtitle` в приложении совпадает с body и не используется отдельно.

**Исключение: пятый размер `text-micro` 11/14, 400, `tabular-nums` (D-12b).** Это значение дизайн-системы, принятое владельцем, а не нарушение четырёх размеров. Источник: `TimePair/README.md` v36 («second zone … `micro` size (11/14)»), `TimeZonePicker/README.md` («Favorites» — `micro`, `muted-foreground`; чип рамки протяжки — `micro`), `WeekGrid/README.md` (чип диапазона), `components/app/time-pair.tsx` в репозитории (`--fs-micro: 11px`, `--lh-micro: 14px` в `globals.css`); в `20-UI-SPEC.md` исключение появилось поправкой D-19. Список мест закрыт: строка второй зоны времени (всех строк `TimePair`), заголовок группы «Favorites» в `TimeZonePicker`, чип диапазона рамки протяжки. Нигде больше `text-micro` не применяется.

| Роль | Где в фазе 21 |
|------|----------------|
| Display 22/28, 600 | `h1` Today (полная дата), `h1` Settings; значение счётчика `Stat size="display"` |
| Heading 16/22, 600 | Заголовки панелей Today («Lessons today», «Earlier, not marked», «Pays soon») и карточек Settings, заголовки диалогов, `ReadError` |
| Body 13/20, 400 и 600 | Строки уроков и оплат (имя 600 у следующего урока), кнопки, подписи полей, имя 600 и дата 400 в тултипе, описание `PageHeader` |
| Caption 12/16, 400 | Подпись остатка в строке `DueList` («1 lesson left»), подсказки и ошибки полей, подпись счётчика (hint), подпись панели, строка вычета в тултипе, helper строки «Mark» |
| Micro 11/14, 400 | Вторая зона времени («14:00 MSK»), заголовок группы «Favorites», чип рамки протяжки |

Токены текста EventTooltip (пункт 4, v36 README) — в плане UI-A. Числа, время, счётчики: `tabular-nums`.

---

## Color

Только токены [19]. Сырых цветов нет. Нейтральная палитра; цвет несут только статус-точки 8 px и (на Schedule) цвета Google. Токен `--link` в `globals.css` есть, но в этих экранах не применяется (в `apps/web` ни одного `text-link` / `bg-link`): имя ученика в строке и шапке остаётся ссылкой в цвете текста, как в таблице учеников; отдельного «акцента link» контракт не вводит.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `surface-2` | Карточка контента, тулбар, страница |
| Secondary (30%) | `surface-1` рама; `surface-3` поднятое через `Elevated offset={1}` | `Panel`, `Stat`, рамка сетки, карточки Settings, диалоги |
| Accent (10%) | `--focus-ring`; `--gcal-today`; `--gcal-now` | Список ниже |
| Destructive | `--destructive` | Ошибки полей, `Banner status="error"`, строка «Could not save the mark. Try again.», подпись кнопки «End series», рамка невалидного `TimePicker` и поля порога, точка «Cancelled» и «Owes lessons» |
| Neutral fills | `bg-hover`, `bg-active`, `bg-selected`, `bg-surface-4`, `border-border`, `bg-gcal-line` | Блоки, строки, фон тултипа и меню, правила сетки |

Акцент зарезервирован (исчерпывающий список), без изменений против 20:

1. `--focus-ring`: `:focus-visible` и `ring-2 focus-ring` на кастомных кликабельных частях (блоки, строки Today, ссылки на ученика, кнопки отметок, кнопка-звезда, `StatusDot`).
2. `bg-gcal-today text-gcal-today-ink`: кружок сегодняшней даты в шапке дня сетки, больше нигде.
3. `bg-gcal-now`: линия «сейчас» и её точка в колонке сегодняшнего дня, больше нигде.

### Тона статус-точек (`StatusDot` [v36])

Цвет живёт только в точке 8 px; цвет текста от статуса не меняется, текст рядом не красный. Отметка никогда не передаётся одним цветом: слово, штрих, значок, `aria-label`, подсказка точки без задержки.

| Тон | Токен | Урок (слово) | Остаток (метка) |
|-----|-------|--------------|-----------------|
| blue | `info` | Planned | Pays soon |
| amber | `warning` | Needs a mark; Moved to 10 Oct | No lessons left |
| gray | `muted-foreground` | Done; No-show | нет |
| red | `destructive` | Cancelled | Owes lessons |
| green | `success` | нет | Plenty left |

Done и No-show делят серый намеренно: различает слово, а не цвет. «Not set» без точки (слот 24 px остаётся пустым).

---

## Time and Date Display Rules

Всё из 20 действует; добавляется:

| Правило | Решение |
|---------|---------|
| «Сегодня» и границы даты | Один источник в `packages/core` в зоне `SCHEDULE_TIME_ZONE` [D-15]; на Today заголовок, список «Lessons today», счётчики, «начался» и «следующий» считаются по Вьетнаму, не по зоне браузера |
| Заголовок Today | `h1` полная дата «Thursday, 9 October» (`en-GB`, `weekday: 'long', day: 'numeric', month: 'long'`, зона Вьетнама) [v36 TodayPage]; год не пишется |
| Итоговая строка | `body muted`: «6 lessons · next: Timur A. at 16:30 VN (12:30 MSK)» (встроенная форма `TimePair`); нет урока впереди — «6 lessons»; уроков нет — «No lessons today» [v36] |
| Время в строках | Пара [v36 TimePair]: VN главная строка без метки в строке списка, вторая зона под ней `text-micro`; в предложении, баннере, итоговой строке: «16:30 VN (12:30 MSK)» |
| Сдвиг дня во второй зоне | Вторая строка начинается с короткого дня недели: «Tue 20:00 MSK»; не «-1d» |
| Метки зон | Только сокращения до четырёх заглавных букв (VN, MSK, CET/CEST, NZDT, IST, YEKT, «HOVD»); «UTC+N» нигде не пишется [mem 14, v36] |
| Остаток | Число уроков в формате `formatLessons`: до двух знаков, нули в конце отбрасываются («1.5», «0.5»); минус в предложении не пишется: долг словами «owes 1.5 lessons»; «-1.5» только в `Stat` профиля [v36 StudentBalance, D-06]; минуты не показываются |
| Плюрализация | «1 lesson», «0 lessons», «1.5 lessons», «owes 1 lesson»; единственное число только для ровно 1; одну функцию отдаёт core [D-16], web её не повторяет |

---

## План UI-A — пункты 1-11 (правки дизайна фазы 20)

Файлы указаны от `apps/web`. Версия [v36] выигрывает у текста `20-UI-SPEC.md`, где они расходятся. Каждый пункт записан как **итоговое состояние**, а не история правки. Все пункты проверены по README v36.

### A1. Подсказка End series (EndSeriesDialog [v36])

- Живая подсказка под полем «Last lesson on», `text-caption text-muted-foreground`: «The last lesson will be on Wed 14 Oct. Later lessons are removed from the schedule. Earlier lessons and any lessons you moved stay where they are.»
- Если на дату и раньше нет ни одного урока серии: «No lessons of this series will remain. Any lessons you moved stay where they are.» в `text-caption text-foreground` (последствие нельзя пропустить глазами).
- Описание диалога: «{name}, every Wednesday at 18:00 VN (14:00 MSK).» (скобка отсутствует без второй зоны).
- Файл: `schedule/_components/end-series-dialog.tsx` (подсказка и пустой вариант).

### A2. «None» с заглавной

- «None» везде с заглавной буквы, `text-muted-foreground`: ячейка «Next lesson» без урока, первая строка списка зон. «Not scheduled» не пишется [P, глоссарий].
- В `localStorage` значение остаётся `none` (константа `NONE` в `second-zone-select.tsx`, ключ `dv-lab.schedule.second-zone`).
- Ячейка «Next lesson» в `students/_components/students-screen.tsx` уже выводит «None» muted: проверить в браузере, правок может не потребоваться. Строка «None» в списке зон делается один раз внутри `TimeZonePicker` (UI-B).

### A3. Время серии во второй зоне (TimePair, MoveSeriesDialog, NewLessonDialog [v36])

- Повторяющееся время: «Every Wednesday at 18:00 VN (14:00 MSK)»; если день недели во второй зоне другой: «Every Thursday at 02:00 VN (Wed 22:00 MSK)». Цифра второй зоны считается для ближайшего урока серии (летнее время в другой зоне сдвигает её в течение года).
- Блок «Whole series» в `LessonDialog` столбиком: заголовок `text-body font-semibold`; подпись `text-caption` «Every Wednesday at 18:00 VN · from Wed 7 Oct»; вторая зона `text-micro text-muted-foreground` «Every Wednesday at 14:00 MSK» (другой день: «Every Tuesday at 22:00 MSK»); ряд из двух кнопок `secondary`, `compact`: «Move series» (`CalendarClock`) и «End series» (`CalendarX2`) под текстом, не рядом с ним, при любой ширине.
- «Repeats» в форме нового урока: «Every Wednesday at 18:00 VN until you end the series.»
- Описание Move series: «{name}. Now every Wednesday at 18:00 VN (14:00 MSK).»
- Тосты без второй зоны (только VN).
- Файлы: `schedule/_components/lesson-dialog.tsx` (блок `data-slot="lesson-series"`), `new-lesson-dialog.tsx`, `move-series-dialog.tsx`, `end-series-dialog.tsx`, `lib/schedule-format.ts`.

### A4. Токены текста EventTooltip (v36 README)

| Строка | Токен |
|--------|-------|
| Имя | `text-body font-semibold` |
| Дата («Thursday, 9 October») | `text-body text-muted-foreground` |
| Диапазон VN («16:30–17:30 VN») | `text-body tabular-nums` |
| Вторая зона («12:30–13:30 MSK») | `text-micro text-muted-foreground` (через `TimePair`) |
| Статус (точка и слово) | `text-body` |
| Строка вычета («Deducts 1 lesson») | `text-caption text-muted-foreground` |
| Тема (когда появится) | `text-caption text-muted-foreground` |

В коде сейчас дата, диапазон и статус на `text-caption` (`event-tooltip.tsx`): поднять до `text-body`. Остальные тексты диалогов: подсказки и правило в диалогах серии `text-caption`; строка «First lesson» `text-body`; подпись под Start time `text-caption`. Поверхность (`surface-4`, `shadow-3`, `radius-xl`, 12 px отступ, до 280 px), отступ 8 px от блока и пружина тултипа не меняются [20, v36].

### A5. Гаттер сетки (WeekGrid [v36])

- Две колонки по 36 px с зазором 8 px: **вторая зона слева, VN справа** у линии сетки (как у Google); слева от колонки второй зоны 12 px до края карточки; колонка VN в 8 px от линии сетки; гаттер 100 px; подписи выровнены вправо в своих колонках.
- Подписи считаются для каждого часа по правилам зоны, не прибавлением часов (зона с половиной часа читается «05:30»); смещение второй зоны берётся на понедельник показанной недели. Строка, где вторая зона проходит полночь, показывает день недели нового дня («Thu») вместо «00:00».
- «00:00» первой строки стоит сразу под верхней линией, остальные центрированы на своей часовой линии. Часовые линии начинаются у края сетки и не идут сквозь подписи часов.
- У каждого заголовка дня короткая вертикальная засечка `gcal-line` слева, на одной линии с разделителями дней тела.
- Угол над гаттером называет две колонки: «MSK» слева и «VN» справа (другая вторая зона — её короткая метка, одной строкой, до четырёх заглавных, выровнена вправо: «YEKT», «IST», «CET»; смещение не пишется никогда). Без второй зоны одна колонка VN и одна подпись.
- Колонка времени в `LessonList` не меньше 88 px (ширина растёт под «Thu 01:00 NZDT»).
- Файл: `schedule/_components/week-grid.tsx` (`COLUMNS`, `gap-[12px]`).

### A6. Тулбар (ScheduleToolbar [v36])

- Кнопки тулбара 28 px и круглые (`rounded-full`): «Today» (`tertiary`, `compact`), две шевронные, второй пояс, селект вида («Week»). Сейчас круглые только шевроны.
- Поведение списка зон (прокрутка к выбранной зоне, галочка, «None» сверху) целиком принадлежит `TimeZonePicker` (пункт B3); в UI-A список не переделывается, чтобы не строить его дважды.
- Файл: `schedule/_components/schedule-toolbar.tsx`.

### A7. Короткие блоки и сводка недели

- Блок короче 45 минут: одна строка «Name, HH:MM» [v36 WeekGrid]. В коде порог `durationMinutes <= 30` (`lesson-block.tsx`): заменить на «меньше 45». Минимальная высота 22 px для блока короче 30 минут остаётся (исключение D-12b в разделе Spacing).
- Неделя только с отменёнными: описание `PageHeader` «No lessons this week · 1 cancelled», не «0 lessons with 0 students» [v36 ScheduleToolbar]. Остальные варианты: «{n} lessons with {m} students · {k} cancelled»; пустая неделя «No lessons this week».
- Файлы: `lesson-block.tsx`, `schedule-screen.tsx` (сводка).

### A8. Форма переноса и TimePicker (LessonDialog, MoveSeriesDialog [v36])

- Форма переноса: две строки «было → стало». Первая в VN: «Wed 14 Oct, 18:00 → Thu 15 Oct, 19:00–20:00 VN»; вторая `text-micro text-muted-foreground` в MSK: «Wed 14 Oct, 14:00 → Thu 15 Oct, 15:00–16:00 MSK» (нет без второй зоны). Баннер пересечения называет только время VN.
- `TimePicker` при невалидном значении: красная рамка `destructive` (`aria-invalid`), в Move series у обоих полей (день и время) при ошибке «Choose a different day or time.»
- Триггер `TimePicker` 36 px без заливки; подвал `p-2` (8 px); заголовок колонки с нижним отступом `pb-1` (4 px); фэйд колонок компактный, и его нет у колонки, у которой все строки умещаются.
- Файлы: `schedule/_components/lesson-move-form.tsx`, `move-series-dialog.tsx`, `components/ui/time-picker.tsx`.

### A9. Фэйд выпадающих списков

- `Select`, `Combobox`, `Dropdown`: фэйд 48 px; для списков ниже примерно 200 px компактный 24 px (`[--scroll-fade-size:var(--scroll-fade-size-compact)]`). `DateField` остаётся как есть: триггер «Oct 14, 2026» (en-US), не трогать.
- Файлы: `components/ui/select.tsx`, `combobox.tsx`, `dropdown.tsx`.

### A10. Баг: цифры «09:15» обрезаны сверху (New lesson, Start time)

- Правило v36 «Value text is never clipped» (`FormFields/README.md`): значение в любом поле это `body` 13 px на строке 20 px (`leading-5`); если элемент наследует тугую строку (`leading-none`, `leading-tight`) или `overflow-hidden`, `leading-5` ставится на сам элемент значения.
- **Причина не подтверждена.** Гипотеза Design dude: `<span class="truncate">` в `TimePickerValue` (`components/ui/time-picker.tsx`, `cn('truncate', className)`; `truncate` включает `overflow-hidden`). Против гипотезы: `Button` размера `default` уже задаёт `leading-[var(--lh-body,20px)]` (`button.tsx`). Первая задача плана воспроизводит дефект в браузере при масштабе 100 %, смотрит вычисленные `line-height`, `overflow` и `height` у триггера и у `data-slot="time-picker-value"` и только потом правит.
- Правка: `leading-5` на элемент значения `TimePickerValue`; проверить те же элементы `DateField`, `Select`, `Combobox`.
- Приёмка: заполненное «09:15» в Start time целиком видно по высоте каждой цифры при 100 % в обеих темах; то же у значений `DateField`, `Select`, `Combobox`.

### A11. Время VN в тултипе (v27, пункт 11)

- Главная строка тултипа уже VN: `formatRange(start, durationMinutes, SCHEDULE_TIME_ZONE) + ' VN'` (`event-tooltip.tsx`), вторая зона под ней через `TimePair`. **Пункт уже выполнен в коде**; остаётся проверка в браузере и токены A4. Отдельной задачи на содержимое нет.

---

## План UI-B — пункты 12-18 (протяжка, метки зон, TimeZonePicker, Settings)

Пункты 12-18 закрыты дизайном v32-v36; вопросов к Design dude по ним нет.

### B1. Протяжка по пустому месту сетки (Drag to create; итог пунктов 12, 15, 16 по v33-v36, WeekGrid README)

- Нажатие на пустое место колонки дня и движение вверх или вниз: рамка будущего урока по сетке 15 минут. Появляется после 4 px движения (не на нажатии), следует за указателем 1:1 без анимации. Только мышь и перо; на таче тап и прокрутка работают как раньше, протяжки нет. Нажатие на блок урока протяжку не начинает.
- Рамка: геометрия блока урока (радиус 6 px, поля 2 px 6 px, тот же отступ в колонке), заливка `selected` 85 %, внутреннее кольцо 1 px `foreground` 40 %, текст `foreground`, поверх блоков уроков (блок под рамкой слабо виден). Внутри одна строка с диапазоном по Вьетнаму «09:00–10:15» (на конце суток «23:00–24:00»), `text-caption` 12/16, не переносится; без заголовка «New lesson», без длительности, без метки «VN» и второй зоны. Рамка меньше 24 px высотой (рамка в 15 минут, 12 px) строку не вмещает: диапазон в чипе справа от неё («09:00–09:15»; `surface-4`, `shadow-4`, `text-micro`).
- Якорь и направление: слот под нажатием (округление вниз до 15 минут) фиксируется; рамка всегда покрывает слот-якорь и слот под указателем, растёт вверх или вниз от якоря и переворачивается через него. Старт и конец обновляются на лету.
- Длина и сутки: минимум 15 минут, максимум 240 (как поле Length); рамка остаётся в своей колонке и в своих сутках, упирается в 00:00 и 24:00; уход указателя за колонку ничего не меняет и не отменяет. На расстоянии 48 px от верхнего или нижнего края скроллера сетка прокручивается сама, тем быстрее, чем ближе край.
- Завершение и отмена: сетка захватывает указатель (pointer capture), отпускание где угодно фиксирует последнюю рамку. Esc, потеря окна (blur) и `pointercancel` убирают рамку и ничего не открывают. Пока есть рамка, курсор `ns-resize` на всей сетке; до нажатия обычный, пустые ячейки без hover. Клавиатурной протяжки нет; клавиатурный путь — кнопка «New lesson».
- Пересечение с блоками: рамка проходит поверх, не меняет цвет; предупреждение в баннере диалога, сохранение не блокируется [D-09 фазы 20]. Рамки в прошлом разрешены (диалог разрешает).
- После отпускания (решение владельца): рамка остаётся под диалогом, пока он открыт; «Discard changes» убирает её, сохранение заменяет реальным блоком. Простой клик (меньше 4 px) оставляет рамку на 60 минут в кликнутом слоте и открывает диалог на этом времени. Рамка под открытым диалогом статична и не новый жест.
- В `NewLessonDialog` приходят: дата колонки, время начала, длина рамки. Длина из протяжки считается отредактированной: выбор ученика её не заменяет, подсказка под Length остаётся «15 to 240 minutes.».
- Файлы: `schedule/_components/week-grid.tsx`, `new-lesson-dialog.tsx`, `schedule-screen.tsx`.

### B2. Метки зон сокращениями (пункты 13, 14, v32 [v36 TimePair «Zone labels»])

- «UTC+N» и «GMT+N» не пишутся нигде. Везде короткое сокращение до четырёх заглавных букв по правилам на показываемую дату (лето/зима): VN, MSK, CET/CEST, NZDT, IST, YEKT и т.д.; у зоны без привычного сокращения первые четыре буквы города («HOVD» для `Asia/Hovd`). Метка никогда не длиннее четырёх букв и помещается в угловую колонку 36 px.
- Таблица сокращений в коде: `lib/time-zones.ts` (`Intl` отдаёт «GMT+3», таблица обязательна). Таблица из `TimePair/README.md` v36 («Short labels»): Europe — London GMT/BST; Berlin, Paris, Rome, Madrid, Amsterdam, Warsaw CET/CEST; Kyiv, Athens, Helsinki, Bucharest, Kaliningrad EET/EEST; Istanbul TRT; Moscow и Minsk MSK; Samara SAMT. Russia и Asia — Yekaterinburg YEKT, Omsk OMST, Novosibirsk NOVT, Krasnoyarsk KRAT, Irkutsk IRKT, Yakutsk YAKT, Vladivostok VLAT, Magadan MAGT, Kamchatka PETT; Almaty ALMT, Tashkent UZT, Tbilisi GET, Yerevan AMT, Baku AZT, Dubai GST, Kolkata IST, Bangkok ICT, Jakarta WIB, Singapore SGT, Hong Kong HKT, Shanghai CST, Tokyo JST, Seoul KST. Americas и Pacific — New York EST/EDT, Chicago CST/CDT, Denver MST/MDT, Los Angeles PST/PDT, Moncton AST/ADT; Sydney AEST/AEDT, Auckland NZST/NZDT. Решение владельца 2026-10-10: берутся официальные сокращения, согласования таблицы с ним не требуется.
- Поиск зон принимает часть IANA-id, метку или смещение числом («+5»); смещение как подпись нигде не показывается. Подсказка пустого результата: «No time zones found» и «Try a city, a country or an abbreviation like CET.» (заменяет «offset like UTC+7» из 20).
- Затронуто: `lib/time-zones.ts` (`zoneCaption`, `utcOffset`, `matchesTimeZone`; формы `'toolbar'`/`'gutter'` исчезают), `lib/schedule-format.ts`, `week-grid.tsx` и `schedule-screen.tsx` (угол и подписи), `second-zone-select.tsx`, `students/_components/student-form-dialog.tsx` (колонка `detail` с `utcOffset`), Settings и `LessonList`. Отступы гаттера из A5 остаются.

### B3. Избранные зоны и TimeZonePicker (пункты 17, 18, [v36 TimeZonePicker])

Один компонент, один список, одно сохранённое состояние. Строить один раз, после реализации удалить дубли: `schedule/_components/second-zone-select.tsx` и отдельный `Combobox` зон в `student-form-dialog.tsx`.

- Два триггера, один попап. **Триггер тулбара:** круглая outline-кнопка (`tertiary`) 28 px, значок globe, короткая метка («MSK») или «No second zone», шеврон 12 px, `aria-label` «Second time zone». **Триггер поля:** селект `FormFields` 36 px, кольцо 1 px `input`, без заливки, значение «Europe/Moscow» и после него метка `muted-foreground`, «None» `muted-foreground` когда пусто, шеврон 16 px в 12 px от правого края; фокус и открытое состояние — `focus-ring`. Settings и каждая форма используют триггер поля.
- Попап: панель `radius-xl`, в 4 px под триггером, прокрутка с компактным фэйдом, Esc закрывает только попап. От тулбара: 280 px, выровнен вправо по кнопке, `surface-4`, `shadow-4`, строки 28 px. От поля: не уже поля, строки 36 px, поверхность на две ступени выше фона (`surface-5` в карточке настроек, `surface-7` в диалоге), `shadow-4`. Внутри: поле поиска «Search time zones» сверху с линией под ним; строки со слотом галочки 16 px, IANA-id, меткой справа, звездой избранного.
- Список: первая строка «None» с подписью «Hide the second zone», без звезды, только там, где пояс может быть пустым (второй пояс). Затем «Favorites» (`text-micro text-muted-foreground`, 8 px сверху и 4 px снизу, в порядке добавления), затем «All time zones» (A-Z, избранные не повторяются). Из второго пояса исключён основной (Вьетнам); без избранных нет ни «Favorites», ни заголовка «All time zones». При поиске группы пропадают: плоский список совпадений, избранные первыми, звезда у каждой строки. Совпавшая первой строка подсвечена, Enter выбирает её.
- Открытие: список прокручен так, чтобы выбранная зона была видна (по центру в длинном списке), галочка видна; при «None» открывается с верха.
- Звезда: кнопка 20 px, значок 14 px, `aria-pressed`, имя «Add Europe/Moscow to favorites» / «Remove Europe/Moscow from favorites». Избранная: закрашенная звезда `foreground` всегда; остальные: контурная `muted-foreground` только при hover, подсветке, фокусе (на таче всегда). Клик по звезде меняет только избранное: попап не закрывается, выбранная зона не меняется, строка сразу переезжает в свою группу, подсветка остаётся на ней. Клик по строке выбирает зону; звезда отдельный Tab-стоп; Enter по подсвеченной строке выбирает.
- Хранение: в `localStorage` браузера (выбранный второй пояс и избранное; по умолчанию избранные Moscow, затем Almaty), в аккаунт не пишется [D-07 фазы 20]; нечитаемое или неизвестное значение возвращается к умолчанию; триггер рисуется после монтирования. Смена в любом месте сразу меняет остальные (тулбар, гаттер, подсказки форм, Settings). Ключ второго пояса остаётся `dv-lab.schedule.second-zone`; ключ избранного называет планировщик. **Основной пояс не хранится и не выбирается**: расписание, граница даты открытия остатка и «сегодня» фиксированы на `SCHEDULE_TIME_ZONE` [D-05, D-15, D-07 фазы 20]; README v36 допускает выбор основной зоны, фаза его не строит (D-12b).
- **Поле зоны карточки ученика** [решение Design dude v36, StudentForm]: тот же `TimeZonePicker` (триггер поля), первая строка списка и значение по умолчанию «Same as teacher» (пустое значение; в коде `SAME_TIME_ZONE`), отдельной строки «None» нет. Строка «Same as teacher» без звезды, подписи-пояснения у неё нет [default]. Подсказка «Empty means the same as yours.» под полем остаётся.
- Что меняется при выборе: колонка гаттера, тултип урока, шапка диалога урока, живая строка под Start time в формах. Для зоны с летним временем гаттер берёт смещение понедельника показанной недели, тултип и диалог урока точное смещение урока.

### B4. Settings: минимум, который нужен фазе

В репозитории нет экрана Settings, а порог «Pays soon» (D-09) и пункт 18 (карточка «Time zones») оба требуют его. Объём (решение Design dude v36 и D-12b):

- Строка «Settings» последней в сайдбаре учителя; значок `Settings` из lucide [default: v36 значок не называет]; маршрут `/settings`; `PageHeader` с `h1` «Settings»; `Tabs` с одной вкладкой «General» (вкладки «Google Calendar» и «Assistant» не рисуются, их строят фазы 24-25 и 22; вкладка в адресе).
- Вкладка General — стопка поднятых карточек `Panel`; каждый элемент сохраняется при изменении с коротким тостом «Saved», кнопки Save нет [v36].
- В фазе две карточки. **«Time zones»**: описание «Lesson times are shown in Vietnam time (VN), with a second zone (MSK) beside it.»; одно поле «Second zone» (`TimeZonePicker`, триггер поля, подпись «Shown next to the main zone», с «None», основной пояс исключён); строка под карточкой «Saved in this browser.» Поля «Main zone» нет. **«Payments»**: порог «Pays soon» (C3).
- Карточки «Account» и «Appearance» из v36 не строятся (смена пароля и тема уже доступны из меню аккаунта в сайдбаре).
- Расхождение артефакта: README и превью `SettingsGeneral` v36 всё ещё рисуют «Account», «Appearance», «Main zone» и три вкладки; решение Design dude v36 и D-12b ограничивают фазу двумя карточками. SUMMARY просит Design dude привести README к решению.

---

## План UI-C — экраны фазы 21 (после A и B)

Таблица сопоставляет каждый элемент с компонентом v36. Запросов к дизайну по UI-C нет.

| Элемент | Компонент v36 | Статус |
|---------|---------------|--------|
| Каркас Today | `TodayPage`: `PageHeader`, `Stat size="display"`, `Panel`, `LessonList`, `DueList`, `EmptyState`, `ReadError`, `Skeleton` | Нарисован; C1 |
| Строки уроков, быстрые Done / No-show, меню отметки | `LessonList`, `LessonMark` | Нарисованы; C1, C2 |
| «Pays soon» по урокам | `DueList` (без срока и суммы) | Нарисован; C1 |
| Строка «Mark» в `LessonDialog` | `LessonDialog`, `LessonMark` | Нарисована; C2 |
| Статус и вычет в `EventTooltip` | `EventTooltip`, `LessonMark` | Нарисованы (тултип не интерактивен); C2 |
| Знаки на блоке сетки | `WeekGrid`, `LessonMark` | Нарисованы; C2 |
| Порог «Pays soon» | `SettingsGeneral`, карточка «Payments» | Нарисована; C3 |
| Флаг «No-show deducts a lesson» | `StudentForm`, `Switch` | Нарисован; C4 |
| Остаток и долг | `StudentBalance`, `Table`, `StatusDot`, `Stat size="title"` | Нарисованы; C5 |

### C1. Today (экран `/`, `TodayPage` [v36])

**Данные и правила** [D-08, D-10, D-11]. Всё считается функциями `packages/core` по дате Вьетнама, теми же, что использует чат [D-15, D-16]; экран только показывает, значения не набираются руками.

- Шапка: `h1` полная дата (Time and Date Display Rules); под ней итоговая строка; в конце шапки одно действие **Add payment** (`tertiary`, `compact`, значок `Wallet`), открывает диалог оплаты [OQ-2]. Окно ассистента справа появится в фазе 22; здесь только колонка контента.
- Четыре счётчика `Stat size="display"` (`shadow-1`, значения 22/28, подписи и подсказки `caption muted`), сетка: четыре в ряд, когда колонка контента не уже 640 px, иначе 2 на 2; ширина колонки, а не окна (контейнерный запрос, `@container` и `@min-[40rem]:grid-cols-4`), потому что справа появится окно ассистента. Зазор 12 px (исключение D-12b).

| Метка | Значение | Подсказка |
|-------|----------|-----------|
| Today | уроки сегодня, которые считаются: запланированный, проведён, неявка; отменённые и перенесённые в другой день не считаются | «3 still to come»; «All started», когда не осталось |
| Done | уроки сегодня с отметкой Done | «of 3 started» (3 — начавшиеся из считающихся) |
| To mark | начавшиеся уроки без отметки, сегодня и в прошлые дни, не отменённые и не перенесённые [D-10, D-12c] | «1 today, 2 earlier»; при нуле «0» без подсказки |
| Pays soon | длина списка «Pays soon» | «{N} lessons or fewer left», N из Settings («1 lesson or fewer left» при N = 1) |

- Панель **«Lessons today»** (`Panel`; справа в заголовке `ghost` `compact` «Week», открывает `/schedule`): строки по времени, 40 px (`LessonList`): колонка времени не меньше 88 px (VN, под ним вторая зона `text-micro`), короткое имя ученика («Anna K.», как в списке учеников), в конце элементы отметки или пометка статуса. Скроллера внутри панели нет: длинный день растёт, прокручивается страница.
- Панель **«Earlier, not marked»** (D-12c, владелец принял): `Panel` под «Lessons today», только пока такие уроки есть; подпись «Lessons that took place and still need a mark.»; те же строки с приглушённой колонкой даты («Wed 8 Oct», 72 px) перед временем; старые выше; не больше 8 строк, затем строка «+3 more», которая открывает расписание (`/schedule`; недели в адресе нет, открывается текущая [default, расхождение с README v36 «that week»]). Отмеченная строка уходит сразу (затухание на `duration-fast`), панель исчезает вместе с последней строкой.
- Панель **«Pays soon»** (`Panel`, подпись «{N} lessons or fewer left, or owing»): строки `DueList`, наименьший остаток выше (долг первым), затем по имени, не больше 8, затем «+3 more», открывает Students. В списке активные ученики с остатком не больше N, включая долг; остаток «не задан» не входит [D-08]. Отметка урока обновляет список.
- Окна ассистента (22) и телефонной раскладки (23) нет.

**Строка урока (`LessonList` [v36 LessonList, LessonMark])**

| Состояние | Вид | В конце строки |
|-----------|-----|----------------|
| Не начался | обычный текст | нет элемента (причину называет диалог) |
| Следующий | фон `active`, имя 600 | нет элемента |
| Начался, без отметки | полный цвет (учителю нужно) | кнопки **Done** (`secondary`, `compact`, `Check`) и **No-show** (`tertiary`, `compact`, `UserX`), клик сохраняет, диалога нет |
| С отметкой | приглушён (`muted-foreground`), без зачёркивания | одна кнопка `tertiary` `compact`: «Done» или «No-show» с шевроном, открывает меню (168 px, строки 28 px, `surface-4`, `shadow-4`): **Done**, **No-show** (текущий с галочкой), после линии **Clear mark** (возврат к Scheduled) |
| Отменён | приглушён, имя зачёркнуто | слово «Cancelled», без элемента |
| Перенесён | приглушён | «Moved to 10 Oct», без элемента |

- Зачёркивание означает только Cancelled [v36].
- Имена кнопок: «Mark Anna K., 15:00, as done» и «… as no-show»; кнопка меню: «Anna K., 15:00: Done. Change the mark». Доступное имя строки читает урок словами.
- Строка открывает `LessonDialog`; hover — `hover`. Строка не может быть буквальным `<button>` вокруг кнопок отметок: основная кнопка строки растягивается на строку (`after:absolute after:inset-0`), кнопки отметок и меню — её соседи с `relative z-10`, не потомки; так клик по ним не открывает диалог. Тот же приём у `DueList` (строка-ссылка и фокусируемая `StatusDot`).
- Сохранение: на нажатой кнопке спиннер, обе кнопки недоступны, ничего в строке не сдвигается; после успеха строка принимает вид «с отметкой», счётчики обновляются сразу, **тоста нет** [v36]. Ошибка: строка возвращается, во второй строке ячейки имени `text-caption text-destructive` «Could not save the mark. Try again.», держится до следующей попытки.
- Один путь на два входа: быстрые кнопки и диалог зовут одну мутацию; экран перечитывается после неё, оптимистичных обновлений нет [19, D-11].

**Время.** «Сегодня», «начался», «следующий» считаются по Вьетнаму [D-15]. Состояния «следующий» и «начался» меняются, когда часы проходят начало урока, без перезагрузки; после полуночи Вьетнама экран меняет дату и списки.

**Состояния**

| Состояние | Контракт |
|-----------|----------|
| Загрузка | Настоящие `h1` с датой и «Add payment»; итоговая строка, четыре плитки и строки — `Skeleton` (5 строк в «Lessons today», 3 в «Pays soon»); кнопки отметок недоступны [v36] |
| Ошибка чтения | Один экран: `h1` и «Add payment» остаются, содержимое — один `ReadError` «Could not load Today» / «Nothing was changed. Try again.» / «Refresh»; ни счётчиков, ни частичных списков [D-42, v36] |
| Тихий день | Счётчики 0 (у «Pays soon» подсказка остаётся); «Lessons today» — `EmptyState`: «No lessons today» / «Add a lesson in the schedule.» + вторичное действие «Open schedule» (`secondary`, ссылка на `/schedule`); итоговая строка «No lessons today» |
| Некому платить | `EmptyState` в «Pays soon»: «Nobody needs to pay soon» / «Students appear here when they have {N} lessons left or fewer, or owe lessons.» (при N = 1 «1 lesson left»); действия нет |
| Остаток не задан | Ученик в «Pays soon» не входит; «Set opening balance» остаётся в профиле [19] |

### C2. Отметки: LessonDialog, EventTooltip, блок сетки (`LessonMark` [v36])

**Правила** [D-01, D-04, D-07, D-11]:

- Три значения: Scheduled (нет отметки), Done, No-show. Отметка не заменяет отмену и перенос: Cancelled и Moved остаются статусами расписания. Вычитают только Done и No-show.
- Отметить можно, когда урок начался (`starts_at <= now`, зона Вьетнама), не отменён и не перенесён; будущий отметить нельзя. Исправить или снять отметку можно всегда, в том числе у отмеченного урока, перенесённого в будущее: пилюли доступны, строка под ними — по вычету [D-04, D-17].
- Отмена отмеченного урока: отметка хранится, вычета нет, при Restore вычет возвращается [D-07]. Перенос отмеченного урока: отметка едет с уроком, вычет считается по новой дате относительно даты открытия, призрак на старом месте ничего не вычитает [D-17].
- Любой урок, который считается уроком, переносится и отменяется в любой момент, в том числе начавшийся и прошедший, и на любые дату и время, в том числе в прошлое [D-17, решение владельца 2026-10-10, план 21-17]: у начавшегося урока тот же подвал «Move lesson» / «Cancel lesson», что у будущего, и активна строка «Mark». Отменённый урок и призрак перенесённого не переносятся. Блок «Whole series» — только у будущего урока серии (`actions.series`).

**Строка «Mark» в `LessonDialog`** (заменяет пару «Held / Cancelled»; сразу под строкой статуса):

- Подпись «Mark» (`body muted`) и радиогруппа из трёх пилюль **Scheduled**, **Done**, **No-show**: 32 px, `radius-md`, кольцо 1 px `input` без заливки; выбранная — фон `active`, вес 600, без кольца. `role="radiogroup"` с именем «Mark», стрелки двигают выбор. Ниже одна строка `caption muted`.
- Выбор сохраняется сразу, кнопки Save нет; во время сохранения пилюли недоступны, строка читает «Saving…». Ошибка: `Banner status="error"` над строкой «Could not save the mark. Try again.», выбор возвращается. Stale (409/404): «This lesson was changed elsewhere. The schedule has been refreshed.» и перечитывание [20]. Тоста нет.
- Слово статуса рядом с точкой следует за отметкой: Planned, Needs a mark, Done, No-show, Cancelled.
- Состояния и строка-пояснение (порядок приоритета):

| Состояние | Строка под пилюлями |
|-----------|---------------------|
| Не начался, без отметки (пилюли недоступны, 50 %, выбрана Scheduled) | «You can mark a lesson once it has started.» |
| Scheduled, начался | «Not marked yet. Nothing is deducted until you mark it.» |
| У ученика нет открывающего остатка | «Not counted: this student has no opening balance yet.» |
| Урок в день открытия остатка или раньше | «Not counted: it falls on or before the opening balance date (5 Oct).» |
| No-show при выключенном флаге | «Deducts nothing: No-show deducts a lesson is off for this student.» |
| Иначе | «Deducts 1 lesson (60 min).» / «Deducts 1.5 lessons (90 min).»: длительность урока, делённая на обычную длину урока ученика, в формате `formatLessons` |
| Отменён (пилюли недоступны, 50 %, сохранённая отметка выбрана; без отметки выбрана Scheduled) | «Cancelled lessons deduct nothing. The mark is kept and counts again if you return the lesson to the schedule.» |
| Перенесён | «This lesson was moved to 10 Oct, so nothing is deducted here. Mark it at its new time.» |

- Подпись начавшегося урока «This lesson has already taken place and cannot be changed.» (`lesson-dialog.tsx`) больше не верна [OQ-4].

**`EventTooltip`** (не интерактивен, без фокуса, только наведение мыши) [v36]: под статусом (точка и слово: Planned, Needs a mark, Done, No-show, Cancelled, Moved to 10 Oct) для отмеченного урока, который считается, одна строка `caption muted`: «Deducts 1 lesson» («Deducts 1.5 lessons») или «Deducts nothing» (No-show при выключенном флаге, урок в день открытия остатка или раньше, нет открывающего остатка). У урока без отметки вместо неё «Click to mark it.». У отменённого и перенесённого ни той ни другой, даже если отметка хранится. Кнопок в тултипе нет: отметка живёт в диалоге и на Today.

**Блок сетки** [v36 WeekGrid, LessonMark]:

| Состояние | Обработка |
|-----------|-----------|
| Начался, без отметки | полный цвет, точка 8 px `warning` в правом верхнем углу (кольцо 1 px цвета сетки), имя «Needs a mark» в тултипе |
| Done | непрозрачность 60 %, галочка 12 px справа сверху |
| No-show | непрозрачность 60 %, значок user-x 12 px справа сверху |
| Cancelled | контур, имя зачёркнуто, знака отметки нет, даже если она хранится |
| Moved | пунктир, стрелка на новую дату, знака отметки нет |
| Planned, будущий | как прежде |

- Знак никогда не закрывает название: справа от названия при знаке свободно 16 px (WeekGrid) [OQ-3]. `aria-label` блока называет статус: к статусам 20 добавляются «needs a mark», «done», «no-show». Цвет блока не меняется от статуса; точка и значки `aria-hidden`, смысл несёт `aria-label` и тултип.
- Статус урока в коде определяет один владелец в core (исход вхождения, D-14); `lesson-block.tsx` перестаёт держать собственные `DOT` и `LessonStatus` и читает исход оттуда, точку рисует `StatusDot`.

### C3. Порог «Pays soon» в Settings → General (карточка «Payments» [v36 SettingsGeneral], LEDG-07, LEDG-08)

- Карточка «Payments» в стопке General, название «Payments», описание «Decide when a student counts as paying soon.»
- Строка «Pays soon threshold (lessons)» с подсказкой «Students with this many lessons left or fewer appear in Pays soon on Today.» и полем числа 96 px справа (вид `FormFields`, `tabular-nums`, выравнивание вправо). Под полем «Saved to your account.».
- По умолчанию 2; допустимы целые 0-20 (0 — только ученики без остатка и в долге). Значение сохраняется **в аккаунт** (не в браузер) по blur или Enter, тост «Saved»; Today и Students читают сохранённое значение сразу. Чат фазы 22 читает те же данные [D-09].
- Ошибка: пустое, дробное или вне диапазона значение — красная рамка `destructive` и строка «Use a whole number from 0 to 20.» под строкой; ничего не сохраняется; уход из поля с неверным значением возвращает последнее сохранённое после того, как ошибка побыла видна «некоторое время» (2 с [default]).
- Загрузка: поле недоступно, пока не пришло значение. Сбой записи: поле возвращается к сохранённому значению, `Banner status="error"` в карточке «Could not save the setting. Try again.» [default: в v36 нет].
- Название карточки, поля, счётчика и панели Today везде «Pays soon» [P].

### C4. Переключатель «No-show deducts a lesson» (`StudentForm` [v36], LEDG-04, D-03)

- Поле `students.no_show_deducts`, по умолчанию включено, и для нового ученика. Копия `Switch` из design-lab.
- В форме «Edit details» (`lg`, `surface-5`) и «New student»: строка сразу под «Lesson length, min»: слева подпись «No-show deducts a lesson» (`body`), справа переключатель, под подписью helper `caption muted`: «A no-show takes the lesson's length from the balance. Turn this off to deduct nothing for any no-show of this student, past ones too; the balance is recalculated.»
- **Переключатель не сохраняется сам**: он часть формы и сохраняется кнопкой «Save changes» («Add student» при создании); подтверждения нет, действие обратимо. Выключение действует на все неявки ученика, прошлые тоже; отметки не меняются; включение возвращает вычеты. Остаток на профиле, в таблице, на Today и в чате пересчитывается сразу после сохранения [D-03].
- Панель **Details** профиля (`overview-tab.tsx`): новая строка **No-show** между «Lesson length» и «Parent»: «Deducts a lesson» (`foreground`) или «Deducts nothing» (`muted-foreground`). Метка 128 px `muted-foreground`, значение вправо.
- Подпись в диалоге урока при выключенном флаге: C2.
- Состояния формы (pending, ошибка сохранения, значения остаются) — правила диалогов 20.

### C5. Показ остатка и долга (`StudentBalance` [v36], D-06, LEDG-08)

**Одно правило, пять состояний** (b — остаток в уроках, N — порог): Plenty left, b > N; Pays soon, 0 < b ≤ N; No lessons left, b = 0; Owes lessons, b < 0; Not set, когда открывающего остатка нет (не равно нулю, D-08). Состояние считает core [D-16]; список «Pays soon» — все состояния, кроме Plenty left и Not set.

- **Слова.** Выше нуля: «8 lessons left», «1.5 lessons left», «1 lesson left» (единственное число только для ровно 1). Ноль: «0 lessons left». Долг: «owes 1.5 lessons», «owes 1 lesson», строчными и без минуса. Формат `formatLessons`; фраза строится одной функцией core [D-16] (нынешний `lessonsPhrase` даёт «-1.5 lessons», для долга не годится).
- **Ячейка таблицы учеников**: колонка называется **«Balance»** (сейчас «Lessons left»; v36 Table); в ячейке `StatusDot` в слоте 24 px слева и текст `foreground`, вертикально по центру, цифры `tabular-nums`, колонка выравнивается влево (у «Not set» слот 24 px остаётся пустым). Тона и метки: green «Plenty left», blue «Pays soon», amber «No lessons left», red «Owes lessons». Текст не красный. «Not set» — текст `muted-foreground` без точки (вместо нынешнего «Set opening balance» в ячейке). Вход в ввод открывающего остатка остаётся в профиле [19].
- **Сводка профиля** (`SummaryLine` в `PageHeader`): фаза 21 заменяет в ней фрагмент остатка на те же слова с точкой; кнопка `ghost` «Set opening balance» остаётся для «Not set». Ряд `Stat` профиля с «Lessons left» (`Stat size="title"`: значение «-1.5» дефисом-минусом, не цветное, подсказка с точкой «Owes 1.5 lessons» красной, «No lessons left» amber, «Pays soon» blue, для Plenty left «As of 2 Oct»; «Not set» muted с подсказкой «Enter the opening balance») принадлежит профилю фазы 23 вместе с остальными плитками [OQ-1]; «-1.5» с минусом в фазе 21 нигде не пишется.
- **«Balance now»** в панели открывающего остатка (`opening-balance-panel.tsx`): те же слова без точки («owes 1.5 lessons», «3 lessons left», «Not set» muted).
- Подпись остатка в форме оплаты (`ledger-text.tsx`) берёт правило и фразу из core [D-13].
- Остаток читается из текущих данных: смена длины урока, исправленная отметка, удалённая оплата пересчитывают все места сразу (LEDG-06). Денег в остатке нет, только уроки.

**`DueList`** [v36]: строка 32 px, имя (ссылка на профиль), `caption muted` «0.5 lessons left», «1 lesson left», «0 lessons left», «owes 1.5 lessons», в конце `StatusDot`: red Owes lessons, amber No lessons left (ровно 0), blue Pays soon (0 < b ≤ N). Срока, слова срочности и суммы нет: правило считает уроки. Порядок: меньший остаток выше, затем по имени. Строка целиком открывает профиль. Пусто — `EmptyState` (C1). В блоках чата те же строки без `Panel`.

---

## Required Edits To Existing Files

Закрытый список для планов UI-A/B/C. Каждая строка — задача.

| # | File | Edit | План |
|---|------|------|------|
| R1 | `apps/web/app/(app)/_components/sections.ts` и `app-sidebar.tsx` | Строка «Settings» последней в сайдбаре, значок `Settings` | B4 |
| R2 | `apps/web/app/(app)/settings/` (новый) | `page.tsx` и клиентский экран: `PageHeader` «Settings», `Tabs` с «General», карточки «Time zones» и «Payments» | B4, C3 |
| R3 | `apps/web/lib/time-zones.ts` | Таблица сокращений, метка на дату, поиск по id/метке/смещению; формы `'toolbar'`/`'gutter'` убрать | B2 |
| R4 | `apps/web/components/app/time-zone-picker.tsx` (новый) | `TimeZonePicker` по B3; хранение в `localStorage` | B3 |
| R5 | `second-zone-select.tsx`, `student-form-dialog.tsx` | После R4 удалить собственные списки зон, импортировать `TimeZonePicker`; первая строка поля ученика «Same as teacher» | B3 |
| R6 | `components/ui/time-picker.tsx` | `leading-5` на значении после подтверждения причины; красная рамка при невалидном; триггер 36 px, подвал `p-2`, `pb-1`, фэйд по высоте | A8, A10 |
| R7 | `components/ui/select.tsx`, `combobox.tsx`, `dropdown.tsx` | Размер фэйда 48/24 по высоте списка | A9 |
| R8 | `week-grid.tsx`, `lesson-block.tsx`, `schedule-screen.tsx`, `schedule-toolbar.tsx`, `event-tooltip.tsx`, `lesson-dialog.tsx`, `lesson-move-form.tsx`, `new-lesson-dialog.tsx`, `move-series-dialog.tsx`, `end-series-dialog.tsx`, `lib/schedule-format.ts` | По пунктам A1-A8 и B1; строка «Mark», знаки и вычет в C2 | A, B, C |
| R9 | `components/ui/switch.tsx` (копия), `components/app/stat.tsx`, `components/app/empty-state.tsx` | Новые части по README v36 | C |
| R10 | `apps/web/app/(app)/page.tsx` и `_components/` | Экран Today вместо заглушки | C1 |
| R11 | `components/app/status-dot.tsx` | Проп `tone` и `label`, цель 24 px с фокусом и подсказкой без задержки; вызовы со `status` ученика не ломаются | C2, C5 |
| R12 | `components/app/ledger-text.tsx`, `students-screen.tsx` (колонка «Balance»), `student-profile.tsx` (`SummaryLine`), `opening-balance-panel.tsx` | Долг словами и точка состояния; фраза из core | C5 |
| R13 | `students/_components/student-form-dialog.tsx`, `students/[id]/_components/overview-tab.tsx` | Строка `Switch` «No-show deducts a lesson», строка «No-show» в Details | C4 |
| R14 | `students/[id]/_components/record-payment-dialog.tsx` | Вариант без предустановленного ученика (поле Student) для «Add payment» на Today; решает [OQ-2] | C1 |

---

## Copywriting Contract

Английский, sentence case, многоточие `…` только в процессных подписях («Saving…»). `{name}` — короткое имя ученика, `{N}` — порог.

| Element | Copy |
|---------|------|
| Primary CTA (Today) | Основной кнопки в шапке нет; «Add payment» (`tertiary`, `Wallet`) — действие шапки [OQ-2]; быстрые «Done» и «No-show» в строках; «Open schedule» в пустом дне |
| Empty state (lessons today) | «No lessons today» / «Add a lesson in the schedule.» + «Open schedule» |
| Empty state (Pays soon) | «Nobody needs to pay soon» / «Students appear here when they have {N} lessons left or fewer, or owe lessons.» |
| Error state | `ReadError`: «Could not load Today» / «Nothing was changed. Try again.» / «Refresh»; запись отметки: «Could not save the mark. Try again.» (вторая строка ячейки имени на Today, `Banner` в диалоге); stale: «This lesson was changed elsewhere. The schedule has been refreshed.»; поле порога: «Use a whole number from 0 to 20.» |
| Destructive confirmation | Новых разрушительных действий нет: отметка обратима («Clear mark»), ничего не удаляется [D-01]; переключатель флага без подтверждения (helper говорит последствия, действие обратимо). Существующие без изменений [20, v36]: «End series» (обводка и подпись `destructive`, не заливка), «Cancel lesson» (вопрос в подвале «Keep» / «Yes, cancel») |
| Today | Заголовок «Thursday, 9 October»; итог «6 lessons · next: Timur A. at 16:30 VN (12:30 MSK)» / «6 lessons» / «No lessons today»; счётчики «Today», «Done», «To mark», «Pays soon»; подсказки «3 still to come», «All started», «of 3 started», «1 today, 2 earlier», «{N} lessons or fewer left»; панели «Lessons today» (кнопка «Week»), «Earlier, not marked» («Lessons that took place and still need a mark.», «+3 more»), «Pays soon» («{N} lessons or fewer left, or owing») |
| Отметки | «Done», «No-show», «Clear mark», «Mark», «Scheduled», «Saving…»; слова статуса Planned, Needs a mark, Done, No-show, Cancelled, Moved to 10 Oct; «Deducts 1 lesson», «Deducts nothing», «Click to mark it.»; тостов нет |
| Остаток | «{n} lessons left» · «1 lesson left» · «0 lessons left» · «owes {n} lessons» · «owes 1 lesson» · «Not set» (muted) · метки точек «Plenty left», «Pays soon», «No lessons left», «Owes lessons»; «Balance» (колонка); «None» для отсутствующего следующего урока |
| Settings | «Settings»; «General»; «Time zones»; «Second zone»; «Saved in this browser.»; «Payments»; «Pays soon threshold (lessons)»; «Saved to your account.»; тост «Saved»; «Search time zones»; «No time zones found»; «Try a city, a country or an abbreviation like CET.»; «Favorites»; «All time zones»; «None» / «Hide the second zone»; «No second zone»; «Second time zone» |
| Ученик | «No-show deducts a lesson»; «Same as teacher»; строка Details «No-show»: «Deducts a lesson» / «Deducts nothing» |

---

## Interaction Contract

- **Диалоги.** Правила 20 без изменений: начальный фокус на первом пустом или безопасной кнопке, pending блокирует поля и повторную отправку, ошибки под полем при submit или blur, `Banner` для сбоев сервера, значения сохраняются, Esc и клик снаружи закрывают, если не pending; Esc закрывает один слой (попап зон закрывается раньше диалога).
- **Отметки.** Одно действие по клику (без подтверждения: обратимо); `loading` на нажатой кнопке, остальные кнопки строки или диалога недоступны до ответа; после успеха чтение перезапрашивается, нет оптимистичных обновлений [19]; stale 409/404: баннер и перечитывание. Меню отметки: стрелки двигают выбор, Esc закрывает только меню.
- **Today.** Строки урока, кнопки отметок и ссылки ученика достижимы Tab (кнопки отметок отдельные Tab-стопы, соседи основной кнопки строки); Enter на строке открывает диалог; фокус после закрытия диалога возвращается на строку. Хоткеев нет. Экран перечитывается после своих мутаций; обновление без перезагрузки (чат) появится в фазе 22.
- **Протяжка и зоны.** Только мышь и перо; клавиатурный путь создания урока — кнопка «New lesson»; звезда избранного отдельный Tab-стоп.
- **Поле порога.** Сохранение по blur или Enter; при неверном значении ничего не уходит на сервер.
- **Переключатель флага.** Часть формы, сохраняется кнопкой формы.
- **Роль.** Только учитель; ученик остаётся на своей странице [19].
- **Движение и тема.** Registry defaults через `useReducedMotion`; рамка протяжки без анимации; всё проверяется в светлой и тёмной темах.
- **Фэйд.** Скроллеры используют `scroll-fade` и `scroll-fade-x`; 48 px для длинных, 24 px для списков ниже примерно 200 px [P]; поля ввода исключены. Страница Today прокручивается с фэйдом страницы.
- **Данные.** Остаток, исход вхождения, «сегодня», порог N, «Pays soon» и счётчики считает только `packages/core` [D-13..D-16]; web не повторяет арифметику.

---

## Open Questions

Дизайн ответил на DR-9..DR-16 (v36); остаются вопросы, на которые v36 или принципы не отвечают. Ни один не блокирует UI-A и UI-B; в UI-C исполнитель берёт умолчание и пишет расхождение в SUMMARY.

| ID | Вопрос | Кому | Умолчание в плане |
|----|--------|------|-------------------|
| OQ-1 | «Next payment» в профиле: `principles.md` («Behaviour contracts › Profile») говорит, что при учёте оплат только в уроках плитка «Next payment» теряет смысл и исчезает; ряд из четырёх `Stat` профиля (с «Lessons left» «-1.5») принадлежит профилю фазы 23 | Владелец | Фаза 21 ряд `Stat` в профиле не строит; остаток в `SummaryLine` словами с точкой (C5); «Next payment» нигде не рисуется |
| OQ-2 | Действие «Add payment» в шапке Today нарисовано во всех состояниях, но не входит в LEDG-03..08, а `RecordPaymentDialog` требует предустановленного ученика (поле Student `PaymentDialog` v36 «only when not preset» не построено) | Владелец | Строить: R14 добавляет поле Student; если владелец откладывает, кнопка убирается из шапки во всех состояниях (загрузка, ошибка) |
| OQ-3 | Зазор названия справа от знака отметки на блоке сетки: WeekGrid говорит 16 px, LessonMark 20 px | Design dude | 16 px (WeekGrid владеет геометрией блока) |
| OQ-4 | Подпись начавшегося урока в `LessonDialog`: «This lesson has already taken place and cannot be changed.» неверна (отметку менять можно), v36 нового текста не даёт; превью показывает только строку «Mark» | Design dude | Подпись убирается (план 21-17): у начавшегося урока те же Move / Cancel, что у будущего [D-17], строка «Mark» с helper объясняет остальное; нового текста не придумывается |

### Defaults (мелочи, исполнитель не останавливается, SUMMARY просит Design dude подтвердить)

| Что | Умолчание |
|-----|-----------|
| Значок строки «Settings» в сайдбаре | lucide `Settings` |
| «+3 more» в «Earlier, not marked» | открывает `/schedule` (текущая неделя), номера недели в адресе нет |
| Подпись «Pays soon» при N = 0 и N = 1 | «0 lessons or fewer left» оставляется как у остальных чисел; при N = 1 «1 lesson or fewer left» |
| Задержка возврата значения в поле порога | 2 с |
| Сбой записи порога и ошибка сохранения флага | `Banner status="error"` «Could not save the setting. Try again.» |
| Тост «Saved» | заголовок «Saved», описание называет настройку («Pays soon threshold: 2 lessons.»), механизм тостов 20 |
| Пояснение у строки «Same as teacher» | нет |

### Расхождения артефакта v36 с решениями и кодом (для SUMMARY Design dude)

1. README и превью `SettingsGeneral` рисуют «Account», «Appearance», «Main zone» и три вкладки; построены «Time zones» (только «Second zone») и «Payments» (решение Design dude v36, D-12b).
2. README `TimeZonePicker` хранит основной пояс в браузере; в продукте он фиксирован (B3).
3. README `TodayPage` «+3 more … on that week»: недели в адресе расписания нет.
4. Высота короткого блока 22 px и поля блока 2/6 px: в README v36 есть только 2 px 6 px; 22 px записано в `20-UI-SPEC.md` и D-12b.

---

## UI Considerations

Applicable state considerations resolved: 29 covered, 6 backstop, 4 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Today без уроков | ✅ covered | `EmptyState` «No lessons today», счётчики 0 (C1) |
| empty | «Pays soon» пусто | ✅ covered | `EmptyState` «Nobody needs to pay soon» [v36] |
| empty | «Earlier, not marked» пусто | ✅ covered | Панель не рисуется [D-12c, v36] |
| empty | Остаток «не задан» | ✅ covered | «Not set» muted без точки; в «Pays soon» не входит [D-08, v36] |
| loading | Today | ✅ covered | Настоящие `h1` и «Add payment», `Skeleton` для итога, плиток и строк |
| loading | Settings, поле порога | ✅ covered | Поле недоступно до загрузки значения (C3) |
| error | Чтение Today | ✅ covered | Один `ReadError`, ни частичных списков, ни счётчиков |
| error | Запись отметки | ✅ covered | Вторая строка ячейки на Today, Banner в диалоге, значения возвращаются |
| error | Stale отметка (409/404) | ✅ covered | Banner «This lesson was changed elsewhere…» и перечитывание |
| error | Сохранение порога или флага | ✅ covered | Неверное значение: «Use a whole number from 0 to 20.»; сбой записи: Banner [default] |
| populated | Статусы блока Done / No-show / Cancelled / Moved / Needs a mark | ✅ covered | Знак, слово, штрих, пунктир, `aria-label`; не только цвет (C2) |
| populated | Отметка и отмена вместе | ✅ covered | Отметка хранится, вычета нет, пилюли недоступны, helper называет причину [D-07, v36] |
| populated | Долг | ✅ covered | «owes 1.5 lessons» с красной точкой; «-1.5» только в `Stat` профиля [D-06, v36, OQ-1] |
| populated | Правка длительности и исправление отметки | ✅ covered | Остаток пересчитывается на всех экранах сразу [D-02, D-03] |
| populated | Флаг «No-show deducts a lesson» выключен | ✅ covered | «Deducts nothing» в Details, helper и тултипе; остаток пересчитан |
| populated | Много уроков в день | ✅ covered | Панель растёт, прокручивается страница, внутри панели скроллера нет |
| zero-one-many | «1 lesson» / «0 lessons» / «1.5 lessons» / «owes 1 lesson» | ✅ covered | Одна функция core [D-16] |
| zero-one-many | «+3 more» в «Earlier, not marked» и «Pays soon» | ✅ covered | Не больше 8 строк, затем строка «+N more» |
| scope | «To mark»: охват | ✅ covered | Прошлые и сегодняшние начавшиеся без отметки; панель «Earlier, not marked» [D-10, D-12c] |
| scope | Отметка на отменённом или перенесённом уроке | ✅ covered | Пилюли недоступны, отметка показана и хранится, на Today и блоке знака нет [v36 LessonMark] |
| scope | Охват Settings | ✅ covered | Две карточки, одна вкладка, без «Main zone», «Account», «Appearance» [D-12b] |
| scope | Допустимые значения порога | ✅ covered | Целые 0-20, по умолчанию 2 [v36 SettingsGeneral] |
| scope | Настройка порога требует экран Settings | ✅ covered | Required Edits R1-R2, B4 |
| time zone | Today, «сегодня», граница даты открытия | ✅ covered | Зона Вьетнама через core [D-15]; проверить с браузером в чужой зоне |
| time zone | Метки зон сокращениями | ✅ covered | Таблица в коде, запасной вариант четыре буквы города |
| destructive | End series, Cancel lesson | ✅ covered | Не меняются [20, v36] |
| destructive | Снятие отметки, выключение флага | ✅ covered | Обратимо, без подтверждения; helper называет последствия |
| keyboard | Протяжка без указателя | ✅ covered | Кнопка «New lesson»; протяжка мыши и пера |
| keyboard | Кнопки отметок внутри строки | ✅ covered | Отдельные Tab-стопы, соседи основной кнопки строки (C1) |
| scroll | Фэйд списков, диалогов, сетки | 🧪 backstop | Визуальная проверка 24 и 48 px в обеих темах [P ScrollFade] |
| overflow | Узкие окна до 320 px | 🧪 backstop | Today и Settings не ломаются: колонки сжимаются, текст обрезается, боковой скролл страницы не появляется (телефонная раскладка — фаза 23) |
| long-text | Длинное имя в строке Today, в «Pays soon», в диалоге | 🧪 backstop | Обрезка в строках, перенос в заголовках диалогов; проверка 60 и 300 символов |
| theme | Светлая и тёмная | 🧪 backstop | Рамка протяжки, 60 % непрозрачности блока Done / No-show, точки, баннеры |
| clock | Полночь Вьетнама | 🧪 backstop | После полуночи Today меняет дату и списки без перезагрузки страницы |
| clock | Начало урока при открытом Today | 🧪 backstop | Кнопки отметки появляются, а «следующий» сдвигается, когда урок начался (`starts_at <= now`) без перезагрузки |
| scope | «Next payment» и ряд `Stat` профиля | ⚠ unresolved | OQ-1: вопрос владельцу; умолчание ряд не строится |
| scope | «Add payment» в шапке Today | ⚠ unresolved | OQ-2: вопрос владельцу; умолчание строить с полем Student |
| populated | Зазор названия справа от знака на блоке: 16 или 20 px | ⚠ unresolved | OQ-3: Design dude; умолчание 16 px |
| populated | Подпись начавшегося урока в диалоге | ⚠ unresolved | OQ-4: Design dude; умолчание подпись убирается |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (нет CLI, нет `components.json`) | not required |
| design-lab (рабочая копия design, одобренный владельцем источник) | `ui/switch` | grep passed — no flags — 2026-10-10: `grep -nE 'fetch\(\|XMLHttpRequest\|sendBeacon\|process\.env\|eval\(\|new Function\|Function\(\|import\(' src/components/ui/switch.tsx` вернул 0 совпадений (exit 1); `grep -lE '@radix-ui\|radix-ui\|from "cmdk"'` по тому же файлу 0 совпадений (exit 1); импорты: `@base-ui/react/switch`, `framer-motion`, `@/lib/utils`, `@/lib/springs`, `@/lib/size-context` |
| third-party registries | none | not applicable |

Радикс-проверка перед слиянием: `grep -rn "@radix-ui\|radix-ui\|cmdk" apps/web --include='*.tsx' --include=package.json` не возвращает ничего. Новых npm-пакетов нет.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending
