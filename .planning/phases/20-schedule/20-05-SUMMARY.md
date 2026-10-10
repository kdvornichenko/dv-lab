---
phase: 20-schedule
plan: 05
subsystem: ui
status: complete
tags: [schedule, week-grid, toolbar, time-zones, intl, base-ui, playwright]

requires:
  - phase: 20-02
    provides: SCHEDULE_TIME_ZONE, zonedParts, zonedInstant, addDays, mondayOf в packages/core
  - phase: 20-03
    provides: токены gcal-*, scroll-fade, schedule-web.mjs и wait-dev.mjs
provides:
  - /schedule с сеткой суток недели по времени Вьетнама (WeekGrid), панелью (ScheduleToolbar) и eyebrow у PageHeader
  - второй часовой пояс в гаттере, выбор зоны (SecondZoneSelect) с хранением в localStorage
  - apps/web/lib/time-zones.ts (один владелец списка зон, смещения «UTC+N», поиска и подписи зоны)
  - apps/web/lib/schedule-format.ts (подписи периода, недели, меток гаттера)
  - раздел frame в scripts/dev-checks/schedule-web.mjs, timezoneId в launch() web.mjs
affects: [20-07, 20-08, 20-09, schedule-screens]

requirements-completed: [SCHED-04]

actuals:
  tokens: 11000
  tasks: 3
  commits: 3

plan_head_before: a58b348b6cbd28c62f2f1a8968c36d59714d151e
plan_head_after: b8f33a369afc774ee44ed7bd485b83768f477829

key-files:
  created:
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - apps/web/app/(app)/schedule/_components/schedule-toolbar.tsx
    - apps/web/app/(app)/schedule/_components/week-grid.tsx
    - apps/web/app/(app)/schedule/_components/second-zone-select.tsx
    - apps/web/lib/schedule-format.ts
    - apps/web/lib/time-zones.ts
  modified:
    - apps/web/app/(app)/schedule/page.tsx
    - apps/web/components/app/layout-parts.tsx
    - scripts/dev-checks/web.mjs
    - scripts/dev-checks/schedule-web.mjs

key-decisions:
  - "Сегодня и «сейчас» берутся из useSyncExternalStore с минутным таймером (без setState в эффекте); до монтирования экран рисует PageHeader «Schedule» и скелетон той же высоты, после — всё по часам"
  - "Неделя хранится как смещение в неделях от текущей: «сегодня» перескакивает через полночь по Вьетнаму само, кнопка Today сбрасывает смещение в 0"
  - "Выбор второй зоны построен на Base UI Combobox.Trigger и Combobox.Input внутри попапа поверх обёртки components/ui/combobox.tsx (её не правил): обёртка привязана к полю ввода, но Positioner без якоря встаёт под триггер"
  - "Список зон и текст смещения в time-zones.ts; копия в student-form-dialog.tsx остаётся до 20-09"

metrics:
  duration: "около 80 минут"
  completed: 2026-10-10
---

# Phase 20 Plan 05: каркас экрана расписания Summary

**Сетка суток недели по артефакту WeekGrid во времени Вьетнама со второй зоной в гаттере, сегодня и линией «сейчас», панель ScheduleToolbar с клавишами Google Calendar и выбор второй зоны с хранением в браузере.**

## Задачи

| Задача | Что сделано | Коммит |
|---|---|---|
| 1 (tracer) | `page.tsx` отдаёт `ScheduleScreen`; `schedule-format.ts`; `week-grid.tsx` (шапка вне скроллера, гаттер 80px с двумя колонками подписей, час 48px, hairline gcal-line, сегодня, линия «сейчас», scrollTop 336, клик по столбцу даёт дату и время с шагом 15 минут через необязательный `onSlot`); раздел frame часть 1 | 2a29ed3 |
| 2 | `ScheduleToolbar` (Today, два круглых шеврона с подсказками, заголовок периода, select вида с единственным пунктом Week, клавиши t, j и ArrowRight, k и ArrowLeft); eyebrow в `PageHeader`; `timezoneId` в `launch()`; frame часть 2 и прогон в зоне America/New_York | 1b13046 |
| 3 | `time-zones.ts`; `SecondZoneSelect` и хук `useSecondZone`; экран передаёт подпись зоны в сетку; frame часть 3 | b8f33a3 |

Tracer-гейт: после коммита задачи 1 проверки задачи (typecheck, lint, frame в обеих темах) прошли до расширения.

## Проверки

| Команда | Результат |
|---|---|
| `yarn workspace @dv-lab/web typecheck`, `lint` | код 0 после каждой задачи и в конце, вывод lint пуст |
| `yarn workspace @dv-lab/web build` | собрался, маршруты `/schedule`, `/students`, `/students/[id]`, `/chat`, `/login` |
| `node scripts/dev-checks/schedule-web.mjs frame` | все PASS, `SCHEDULE_WEB_FRAME_OK`, код 0; последний прогон включает проверку высоты 1080px |
| `node scripts/dev-checks/schedule-web.mjs frame dark` | все PASS (242 строки), `SCHEDULE_WEB_FRAME_OK`, код 0; прогон был до добавления проверки высоты 1080px, она в тёмной теме не запускалась |
| `node scripts/dev-checks/wait-dev.mjs up` | `DEV_UP_OK` (см. «Dev-стек» ниже) |
| `node scripts/dev-checks/wait-dev.mjs down` | `DEV_DOWN_FAIL port 4000 still listening` из-за чужого процесса, см. ниже |

Что проверяет frame (обе темы, при зоне браузера по умолчанию и при `timezoneId` America/New_York с зафиксированными часами Playwright: понедельник 02:00 по Вьетнаму = воскресенье 15:00 в Нью-Йорке, то есть другая неделя и другая дата):

- h1 равен диапазону недели (`5 – 11 Oct`), семь подписей MON..SUN, колонки идут с понедельника, круг сегодня на числе по Вьетнаму и цветом `--gcal-today`, закрашен ровно один круг, столбец сегодня с фоном bg-hover, остальные без фона.
- Час 48px (расстояние между линиями 10:00 и 11:00), угол «VN MSK», у 08:00 VN подпись 04:00, у 04:00 VN вместо 00:00 стоит `Mon`, тело сетки с классом scroll-fade и scrollTop 336, шапка дней вне тела.
- sr-only «Now HH:MM» совпадает со временем Вьетнама, линия «сейчас» стоит на минуте по Вьетнаму (±2px), её высота 2px, она одна.
- Заголовок периода, eyebrow («This week», «Coming weeks», «Past week»), Today disabled на текущей неделе и активна на других, клавиши t, j, k, ArrowRight, ArrowLeft, Ctrl+t не листает, в поле ввода и при открытом диалоге клавиши ничего не делают, смещение scrollTop при смене недель не меняется, линия «сейчас» только на текущей неделе, select вида показывает Week.
- Попап зоны: 280px, ровно 4px под кнопкой, по правому краю кнопки, строки 36px, фэйд списка 24px, первая строка «None» с «Hide the second zone», 424 строки списка без `Asia/Ho_Chi_Minh` и `Asia/Saigon`, пустой результат «No time zones found» и подсказка, Esc закрывает только попап (страница на месте), поиск «berl» ставит Europe/Berlin первым и Enter выбирает его, подпись кнопки и угла по смещению в понедельник недели (при листании на три недели вперёд, через конец летнего времени, смещение и подпись 08:00 VN меняются с +2 на +1), None даёт одну колонку и «No second zone» и переживает перезагрузку, мусор, `Asia/Saigon`, `Asia/Ho_Chi_Minh` и пустая строка в localStorage возвращают MSK, после входа не было ни одного не-GET запроса.
- Ширина 320px: бокового скролла страницы нет. Высота 1080px (экран 1920x1080): второго скролла страницы нет, рамка сетки заканчивается выше нижнего края.
- В `problems` нет ошибок гидратации, консоли и pageerror.

Acceptance-grep: зоны браузера в коде экрана нет (код 1); `scroll-fade` в week-grid.tsx 1 строка; `bg-gcal-today` 1 строка; `<h1` в toolbar 0; `tertiary` и `rounded-full` в toolbar больше 0; `apiRequest|fetch(` в second-zone-select.tsx нет (код 1); ключ `dv-lab.schedule.second-zone` 1 раз; `shortOffset` вне `time-zones.ts` нет (код 1), в `time-zones.ts` 1 раз; комментариев в новых файлах нет.

Скриншоты: только в `STATE_DIR` (`tmpdir()/dvlab-dev-checks`, вне репозитория), префикс `sched-frame-*`. Скриншоты с недели и попапа в обеих темах, тёмная None-версия, 320px и панель я просмотрел глазами; Нью-Йорк, высоту 1080px и светлый None смотрел только по проверкам.

## Dev-стек

Порт 4000 был занят чужим api (`node --watch src/server.ts` из `apps/api` этого же worktree, запущен до меня тем же родительским процессом, судя по `yarn workspace @dv-lab/api dev` 18 минут до моего старта). По правилу «порты заняты чужим — остановиться» я его не трогал и не завершал. Чтобы не терять браузерную проверку, поднял свой api на порту 4300 (`env -u DATABASE_URL -u MIGRATOR_DATABASE_URL PORT=4300 yarn workspace @dv-lab/api dev`, dvlab_dev) и web на 3000 с `API_DEV_PROXY_URL` и `API_INTERNAL_URL` на 4300. Оба процесса мои, остановлены, 3000 и 4300 свободны. `wait-dev.mjs up` проходит, потому что чужой api отвечает на 4000; `wait-dev.mjs down` падает по той же причине. Оркестратору: остановить api на 4000 (процесс родом из `yarn workspace @dv-lab/api dev`, pid 45715 при моём запуске) и повторить `down`.

## Отклонения от плана

**1. [Нет инструмента] Артефакт v23 не читал.** Инструмента Artifact у исполнителя нет. Работал по выдержке в `20-UI-SPEC.md` «Amendments».

**2. [Нет инструмента] Осмотр во встроенном браузере не проводился** (инструмента нет). Заменён проверками Playwright и просмотром скриншотов в обеих темах.

**3. [Рамки плана] Порт 4300 вместо 4000** (см. «Dev-стек»).

**4. [Rule 1 - ICU] `Sept` в en-GB.** В Node `Intl` для en-GB даёт `Sept`, а план требует `Sep`. Месяцы и дни недели считаются из en-US с `timeZone: 'UTC'` по календарной дате, строки диапазона собраны вручную; en-GB не используется.

**5. Подпись 00:00 в гаттере.** У первой строки (00:00) подписи не центрируются по линии (иначе половина обрезается верхним краем), а стоят под ней.

**6. Левый отступ подписей.** У подписей гаттера справа 4px до линии дня (`pr-1`); две подписи по 32px с зазором 12px помещаются в 80px вместе с этим отступом.

**7. `useEffectEvent`** (React 19.3) для обработчика клавиш, чтобы подписка на document не пересоздавалась; в списке открытых окон, при которых клавиши отключены, кроме `[role=dialog]` учтены `[role=listbox]` и `[role=menu]`.

## Замечания для Design dude

1. **Select вида:** единственный пункт «Week» (D-10, других видов в фазе нет). Круглый, w-28, высота 28px.
2. **Шкала шрифта:** дата 24px артефакта -> `text-display` (22px), подписи 11px и 10px -> `text-caption` (12px). Две подписи гаттера по 32px: 5 знаков 12px в 32px умещаются впритык (1px заступа влево в зазор).
3. **Столбец сегодня:** `bg-hover` (D-10, в артефакте об этом ничего нет).
4. **Сетка суток 00:00 до 24:00**, открытие со scrollTop 336 (08:00 на 48px ниже верха) вместо 9:00-22:00 артефакта (D-10).
5. **Первая строка гаттера (00:00):** подписи стоят под линией, не по центру (см. отклонение 5).
6. **Выбор второй зоны:** `components/ui/combobox.tsx` построен на поле ввода как якоре и кнопки-триггера с поиском внутри попапа не даёт. Собрал на Base UI `Combobox.Trigger` (кнопка `tertiary` compact, `rounded-full`, Globe слева, шеврон 12px) и `Combobox.Input` внутри попапа, остальное (список, строки, пустое состояние) из обёртки; `combobox.tsx` не менял. Попап шириной 280px, `p-0`, поле поиска 36px с hairline под ним, список с отступом 4px и фэйдом 24px.
7. **Попап списка зон при открытии** стоит на первой строке («None», затем Africa/…), к выбранной зоне (Europe/Moscow) не прокручивается: галочка у текущей зоны видна только при прокрутке. Нужно решение, прокручивать ли к выбранной.
8. **Узкая ширина (320px):** круг даты 44px заступает в соседние столбцы, числа сжимаются плотно. Телефонный вид отложен на фазу 23.
9. **Шапка дней:** у каждого дня слева hairline gcal-line (вертикальные засечки) в высоту шапки, чтобы совпадали с разделителями тела.

## Что важно следующим планам

- 20-07: `WeekGrid({ monday, today, now, secondZone: { id, caption } | null, onSlot? })` в `week-grid.tsx`; экспортируются `HOUR_HEIGHT` (48), `OPEN_SCROLL_TOP` (336), тип `SecondZone`. Колонки дня: `data-slot="week-grid-column"` с `data-date`; блоки добавляются внутрь колонки (она `relative`), клик по пустому месту фильтруется по `event.target === event.currentTarget`, поэтому блоки не должны проваливать клик. Линия часа (`week-grid-line`, `data-hour`) лежит поверх колонок с `pointer-events-none`. Тело сетки `data-slot="week-grid-body"` не перемонтируется при смене недели (scrollTop сохраняется), ключа по неделе на нём быть не должно.
- `ScheduleScreen` держит `offset` недели; `LoadedSchedule` получает `now` (Date, обновляется раз в минуту) и считает `today`, `monday`, `secondZone`. Строка итогов в `PageHeader` (description) и кнопка New lesson в `actions` добавляются здесь. `ScheduleToolbar` принимает слот `zoneControl`; клавиши ожидают, что при открытом `[role=dialog]` они выключены.
- `useSecondZone()` из `second-zone-select.tsx` возвращает `[zoneId | null, set]` (null = нет второй зоны), подписка на `storage` и собственное событие; `zoneCaption(zone, at, 'toolbar' | 'gutter')` и `utcOffset(zone, at)` из `lib/time-zones.ts` — единственный владелец текста смещения («UTC+N»), `at` берётся как полдень понедельника недели по Вьетнаму.
- 20-09: форма карточки ученика ещё держит свою копию `MODERN_TIME_ZONES`, `utcOffset`, `buildTimeZones`, `matchesTimeZone`; переключается на `lib/time-zones.ts` там (поведение перенесено без изменений).
- `schedule-web.mjs`: раздел `frame`, вспомогательные `openSchedule`, `framePart1(page, label, at?)`, `framePart2`, `framePart3`, `expectedRange`, `expectedTitle`; `launch({ timezoneId })` в `web.mjs`. Для проверок с неделей и данными можно переиспользовать `page.clock.setFixedTime`.

## Known Stubs

Нет. `onSlot` пока не передаётся из экрана (New lesson подключит 20-07), это задумано планом.

## Threat Flags

Нет. T-20-14 закрыт: сохранённое значение проходит `isTimeZone`, вьетнамские алиасы и мусор заменяются на Europe/Moscow, значение идёт только в `Intl`, запросов в api нет (проверено). T-20-15: скриншоты только в `STATE_DIR`, в SUMMARY нет данных учеников.

## Self-Check: PASSED

- Файлы на месте: schedule-screen.tsx, schedule-toolbar.tsx, week-grid.tsx, second-zone-select.tsx, schedule-format.ts, time-zones.ts, 20-05-SUMMARY.md.
- Коммиты найдены: 2a29ed3, 1b13046, b8f33a3.
- Процессы: мои api (4300) и web (3000) остановлены; `apps/web/AGENTS.md` удалён, не закоммичен.
