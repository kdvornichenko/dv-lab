---
phase: 20-schedule
plan: 03
subsystem: ui
tags: [tailwind, scroll-fade, base-ui, time-picker, design-tokens, playwright]

requires:
  - phase: 19-students
    provides: ScrollArea, Table, DateField, EmptyLine, Button, Popover, фэйд лаборатории в globals.css
provides:
  - токены фэйда --scroll-fade-size 48px и --scroll-fade-size-compact 24px в :root, неслоёное правило удалено
  - токены сетки --gcal-line, --gcal-today, --gcal-today-ink, --gcal-now в обеих темах и цвета --color-gcal-* в @theme
  - фэйд тела каждой страницы (PageScroll) и горизонтальный фэйд таблиц с компактным размером
  - DateField с min, EmptyLine с text
  - TimePicker и InputGroup варианта A в apps/web/components/ui с английскими подписями и фэйдом библиотеки в колонках
  - scripts/dev-checks/wait-dev.mjs (up/down) и scripts/dev-checks/schedule-web.mjs (раздел fade, очистка фикстур)
affects: [20-05, 20-07, 20-08, 20-09, schedule-screens]

actuals:
  tokens: 21000
  tasks: 3
  commits: 3

plan_head_before: 8fee7469328c7247a0225c490ddeb6c2a5a9971a
plan_head_after: cdd8991

tech-stack:
  added: []
  patterns:
    - "Компактный фэйд: scroll-fade [--scroll-fade-size:var(--scroll-fade-size-compact)] на самом скроллере"
    - "schedule-web.mjs: раздел первым аргументом, тема аргументом dark, очистка фикстур Alex Example 20% в начале и в finally"

key-files:
  created:
    - apps/web/components/ui/time-picker.tsx
    - apps/web/components/ui/input-group.tsx
    - scripts/dev-checks/wait-dev.mjs
    - scripts/dev-checks/schedule-web.mjs
  modified:
    - apps/web/app/globals.css
    - apps/web/components/app/layout-parts.tsx
    - apps/web/components/ui/table.tsx
    - apps/web/components/app/date-field.tsx
    - apps/web/components/app/empty-line.tsx
    - apps/web/lib/popup.ts

key-decisions:
  - "Размер фэйда задан токеном в :root, а не неслоёным правилом: утилита на элементе теперь работает (D-14, Pitfall 5)"
  - "Переопределение 32px у списков Select, Combobox и Dropdown убрано из popup.ts: до правки его перебивало неслоёное правило, фактически списки всегда были 48px"
  - "Статичная маска колонок TimePicker и prop fade удалены, колонки получили scroll-fade 24px (DR-5, principles.md)"

patterns-established:
  - "Копия компонента из лаборатории: разбор через TypeScript printer без комментариев, затем замены по списку UI-SPEC, затем prettier"

requirements-completed: [SCHED-04, CARD-04]

duration: 63min
completed: 2026-10-10
status: complete
---

# Phase 20 Plan 03: общая web-база расписания Summary

**Токены фэйда 48/24px и сетки gcal в обеих темах, фэйд тела страницы и таблиц, DateField.min, EmptyLine.text и копия TimePicker с InputGroup из варианта A с фэйдом библиотеки в колонках.**

## Performance

- **Duration:** около 63 минут
- **Tasks:** 3 из 3
- **Files modified:** 11 (4 создано, 7 изменено)

## Accomplishments

- В :root заданы `--scroll-fade-size: 48px` и `--scroll-fade-size-compact: 24px`, правило `.scroll-fade, .scroll-fade-x { --scroll-fade-size: 48px }` удалено в той же правке. Фэйды Select, Combobox, Dropdown, сайдбара и тела страницы остаются 48px, таблица и колонки TimePicker получают 24px через `[--scroll-fade-size:var(--scroll-fade-size-compact)]`.
- Токены `--gcal-line`, `--gcal-today`, `--gcal-today-ink`, `--gcal-now` в :root и .dark (значения совпадают с tokens.css варианта A) и `--color-gcal-*` в `@theme inline`. Токенов `gcal-event-*` нет (D-11).
- `PageScroll` передаёт `viewportClassName="scroll-fade"`. Контейнер таблицы получил `scroll-fade-x` с компактным размером, рамка Elevated осталась на обёртке экрана.
- `DateField` принимает `min` (YYYY-MM-DD) рядом с `max`, дни вне границ отключаются массивом matcher react-day-picker; без границ `disabled` остаётся `undefined`. `EmptyLine` принимает `text` (по умолчанию «Nothing here yet»).
- `TimePicker` и `InputGroup` скопированы из `design-lab` (снимок cda53ee) с правками UI-SPEC: `cn` из `@/lib/utils`, импорты `@/components/ui/*`, варианты `tertiary` и `primary`, размер кнопки `compact`, ключ `icon-sm` переименован в `icon-compact`, `text-xs` в `text-caption`, `font-medium` в `font-semibold`, английские подписи, без комментариев. Статичная маска колонок, prop `fade`, поле контекста `fade` и вычисление переполнения (`syncOverflow`) удалены, списку колонки добавлен `scroll-fade [--scroll-fade-size:var(--scroll-fade-size-compact)]`. `isTimeDisabled` оставлен в копии, расписание его не использует (D-09).
- `wait-dev.mjs up|down` и `schedule-web.mjs fade` (обе темы, очистка фикстур `Alex Example 20%` без `import_key` в порядке lesson_exceptions, lessons, lesson_series, students; таблицы расписания пропускаются, если их ещё нет).

## Task Commits

1. **Задача 1 (tracer): токены фэйда и gcal, фэйд тела страницы, wait-dev.mjs, schedule-web.mjs** - `b346de5` (feat)
2. **Задача 2: фэйд таблицы, min у DateField, текст у EmptyLine** - `01115f3` (feat)
3. **Задача 3: TimePicker и InputGroup** - `cdd8991` (feat)

Раздел fade 2 части schedule-web.mjs (таблица) лежит в коммите задачи 1: файл писался целиком. Коммит документации с этим SUMMARY идёт отдельно.

## Verification

- `yarn workspace @dv-lab/web typecheck`: код 0 после каждой задачи и в конце.
- `yarn workspace @dv-lab/web lint`: код 0, вывод пустой.
- `yarn workspace @dv-lab/web build`: собрался, маршруты `/`, `/chat`, `/login`, `/schedule`, `/students`, `/students/[id]`.
- `node scripts/dev-checks/wait-dev.mjs up`: `DEV_UP_OK`. После остановки обоих dev-серверов `wait-dev.mjs down`: `DEV_DOWN_OK`, на 3000 и 4000 никто не слушает.
- `node scripts/dev-checks/schedule-web.mjs fade` и `… fade dark`: все PASS, `FADE_PART1_OK`, `SCHEDULE_WEB_FADE_OK`, код 0, без ошибок консоли. Проверено: `--scroll-fade-size` 48px, `--scroll-fade-size-compact` 24px, `--gcal-today`, `--gcal-today-ink`, `--gcal-now`, `--gcal-line` в обеих темах, класс scroll-fade и непустая mask-image у viewport PageScroll, 48px у списка Select в диалоге New student, у контейнера таблицы при ширине 360px класс scroll-fade-x, 24px, scrollWidth больше clientWidth, mask-image задана. Хвостов фикстур в начале прогона не было (0), прогон создаёт одну вымышленную карточку и удаляет её.
- Критерии приёмки задач 1 и 2 (grep): неслоёного правила нет, `scroll-fade-size-compact: 24px` 1 раз, `gcal-event` нет, `gcal-today-ink` 3 раза, `scroll-fade-x` и `scroll-fade-size-compact` в table.tsx по 1, `min?: string` 1, «Nothing here yet» 1.
- Критерии приёмки задачи 3 (все пять гейтов): нет комментариев, нет кириллицы, нет пакета `cn`, каталога lab и статической маски, нет Radix и cmdk, нет fetch, eval, process.env, import(). `scroll-fade-size-compact` в time-picker.tsx встречается 1 раз (класс списка колонки). Замыкание импортов: `@/components/ui/{button,input,input-group,popover,textarea}` и `@/lib/utils`, все существуют. Директива `'use client'` в обоих файлах на месте. Классов `gap-1.5`, `px-3`, `px-5`, `text-sm`, `text-xs`, `font-medium` в копии нет.
- Разовая проба (не закоммичена, страница удалена): TimePicker в обоих режимах (триггер и `TimePickerInput`) при `minuteStep=15` в обеих темах: колонки получили 24px и маску, выбор минут и кнопка Done меняют значение, ввод «1030» и Enter даёт 10:30, ошибок консоли нет.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Переопределение 32px у списков в popup.ts**
- **Found during:** задача 1, первый прогон `schedule-web.mjs fade`
- **Issue:** `popupViewportClass` задаёт `[--scroll-fade-size:32px]`. Раньше его перебивало неслоёное правило с 48px, поэтому списки Select, Combobox и Dropdown фактически были 48px. После удаления правила переопределение ожило, список Select стал 32px и нарушил условие плана «существующие фэйды остаются 48px».
- **Fix:** убрал мёртвое переопределение из `apps/web/lib/popup.ts`, видимый размер остался прежним (48px).
- **Files modified:** `apps/web/lib/popup.ts` (вне `files_modified` плана)
- **Commit:** `b346de5`

**2. [Rule 3 - Blocking] Раскладка триггера TimePicker под Button репозитория**
- **Found during:** задача 3, проба на временной странице
- **Issue:** Button репозитория оборачивает дочерние элементы в собственные span, поэтому `justify-between` из лаборатории ничего не делал: значение и иконка шли столбиком, иконка рисовалась 24px.
- **Fix:** содержимое триггера обёрнуто в `span.flex.w-full.justify-between`, в `TRIGGER_CLASS` добавлены селекторы `[&>span:last-child]` и `[&>span:last-child>span]` на всю ширину, у `ClockIcon` заданы `size={16}` и `strokeWidth={1.5}`. Это выходит за «только импорты, размеры и язык».
- **Files modified:** `apps/web/components/ui/time-picker.tsx`
- **Commit:** `cdd8991`

**3. [Rule 2 - малое] Подпись second**
- В список подписей плана `second` не входил; для единообразия с Hours и Minutes поставил «Seconds». Секундная колонка расписанию не нужна (`granularity` минуты).

**4. Хеш-запись #fff**
- Браузер отдаёт `--gcal-today-ink` светлой темы как `#fff` (минификация CSS). Проверка в `schedule-web.mjs` приводит трёхзначную запись к шестизначной; значение в globals.css `#ffffff`, как в tokens.css.

### Отклонения процесса

- Инструмент Artifact исполнителю недоступен: строку ScrollFade из `project/principles.md` и описание компонентов взял из выдержки в `20-UI-SPEC.md` (Amendments, DR-5 RESOLVED), артефакт не читал.
- Осмотр во встроенном браузере не проводился (инструмента нет). Заменено автоматическими проверками значений и просмотром скриншотов Playwright (таблица на 360px, список Select, TimePicker в обеих темах) из STATE_DIR; в репозиторий скриншоты не попали.
- Папка `apps/web/AGENTS.md`, созданная `next dev`, удалена и не коммитилась.

## Замечания для Design dude

1. **Списки Select, Combobox, Dropdown:** в variant A `popup.ts` указывает фэйд 32px, фактически на сайте всегда было 48px. Я оставил 48px (видимый вид не менялся). Нужно решение: 48px как есть или 32px по варианту A (тогда вернуть переопределение и принять смену вида всех выпадающих списков).
2. **TimePicker, триггер:** потребовалась перестройка раскладки под repo Button (см. отклонение 2). Button добавляет `[text-box:trim-both_cap_alphabetic]` на span подписи, это может чуть сдвигать время по вертикали: посмотреть в форме переноса (20-08).
3. **TimePickerInput:** поле `InputGroup` высотой 28px (`h-7`), с фоном `bg-input/20`, а триггер и Input в формах 36px. Для форм расписания логичнее `TimePickerTrigger`. Popup у `TimePickerInput` привязан к кнопке часов и открывается под ней, а не под началом поля.
4. **Полшаги интервала:** в копии остались `p-1.5` (подвал) и `pb-1.5` (заголовок колонки), шкала UI-SPEC шагов 6px не допускает. План велел копировать без перестилизации, не менял.
5. **Колонки TimePicker:** фэйд теперь зависит от позиции прокрутки (как везде), а не от переполнения; если строк мало (минуты при шаге 15), маска не действует.

## Для следующих планов

- `schedule-web.mjs`: разделы 20-05, 20-07, 20-08, 20-09 добавляются в объект `sections`; общая функция `cleanupFixtures(label)` экспортирована из файла (внутри, не из web.mjs). Тема через аргумент `dark`, вход dev-учителем.
- `wait-dev.mjs up|down` для подъёма и проверки остановки dev-стека (api 4000, web 3000). Dev-стек перезапускается сам, когда соседние планы правят файлы api (`tsx watch`): прогон, попавший на перезапуск, может упасть на входе, повтор помогает.
- TimePicker: `value` строка `HH:MM`, `hourCycle` по умолчанию 24, `minuteStep={15}` проверено; для форм использовать `TimePickerTrigger` с `className="w-full"`.
- `DateField min`: сравнение идёт по локальному `Date` календарной даты, зона Вьетнама считается вызывающим кодом (min = сегодня во Вьетнаме).

## Known Stubs

Нет. Новые компоненты (`TimePicker`, `InputGroup`, `EmptyLine.text`, `DateField.min`) пока не используются экранами: это база для 20-05, 20-07, 20-08, 20-09.

## Threat Flags

Нет. Копия лаборатории прошла гейт реестра (нет fetch, eval, import(), process.env), Radix и cmdk не появились, пакетов не добавлено.

## Self-Check: PASSED

- Файлы созданы: time-picker.tsx, input-group.tsx, wait-dev.mjs, schedule-web.mjs, 20-03-SUMMARY.md.
- Коммиты найдены: b346de5, 01115f3, cdd8991.
