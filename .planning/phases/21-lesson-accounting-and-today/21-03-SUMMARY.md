---
phase: 21-lesson-accounting-and-today
plan: 03
subsystem: ui
tags: [schedule, week-grid, toolbar, tooltip, design-v36, playwright]
requires:
  - phase: 20-schedule
    provides: сетка недели, тулбар, блоки уроков, тултип, проверки schedule-web.mjs
provides:
  - гаттер сетки 100 px по WeekGrid v36 (две колонки по 36 px, зазор 8 px, 12 px до края карточки, 8 px до линии)
  - кнопки тулбара 28 px и rounded-full (Today добавлена к уже круглым)
  - порог одной строки блока 45 минут, сводка недели «No lessons this week · N cancelled»
  - токены текста EventTooltip по v36
  - раздел grid в scripts/dev-checks/schedule-web.mjs, уборка lesson_marks в общей очистке фикстур
affects: [21-06, 21-14, 21-15, 21-16]
status: complete
commits: 2
plan_head_before: 40632349244f946478f47b968764c3f1115fcf01
plan_head_after: 41e56dcc768f772cdc23203254553fd951970975
actuals:
  tokens: 5200
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - "Гаттер: колонка 100px, строка времени pl-[12px] pr-2 gap-2 с двумя span w-[36px] (исключение D-12b)"
key-files:
  created: []
  modified:
    - apps/web/app/(app)/schedule/_components/week-grid.tsx
    - apps/web/app/(app)/schedule/_components/schedule-toolbar.tsx
    - apps/web/app/(app)/schedule/_components/lesson-block.tsx
    - apps/web/app/(app)/schedule/_components/event-tooltip.tsx
    - apps/web/lib/schedule-format.ts
    - scripts/dev-checks/schedule-web.mjs
key-decisions:
  - "Засечка у заголовка дня не добавлялась: у ячейки дня уже есть border-l gcal-line на одной линии с разделителями тела (проверено измерением), в v36 ровно такой же .gd с border-left"
  - "schedule-screen.tsx не правился: сводка недели целиком в weekSummary (lib/schedule-format.ts)"
requirements-completed: [SCHED-04]
---

# Фаза 21, план 03: сетка и тулбар по дизайну v36

Гаттер недели 100 px с двумя колонками времени, тулбар 28 px с круглыми кнопками, короткие блоки до 45 минут в одну строку, сводка недели с отменёнными и токены текста тултипа по дизайн-системе v36, всё проверено скриптом в обеих темах.

## Что сделано

**Задача 1 (tracer), коммит 81b2e1b.** `week-grid.tsx`: `COLUMNS` с 5rem на 100px; строка гаттера `GutterPair` теперь `pl-[12px] pr-2 gap-2` и два `span` по `w-[36px]`, вторая зона слева, VN справа в 8 px от линии; одна колонка VN без второй зоны; угол над гаттером (`MSK` и `VN`) использует ту же пару, поэтому колонки совпадают со строками; часовые линии стартуют с `left-[100px]`. Подписи по правилам зоны на понедельник недели и день недели в полночь второй зоны уже были (`gutterLabel`), измерениями подтверждены. В `schedule-web.mjs` добавлен раздел `grid` (часть 1: геометрия гаттера, угол, линии, засечка заголовка дня, режим без второй зоны) и в общую очистку фикстур добавлено удаление `lesson_marks` первым (под `to_regclass`).

Гейт tracer: раздел `grid` повторно прогнан после задачи 2 в обеих темах, зелёный, расширять было не на чем ломать.

**Задача 2 (auto), коммит 41e56dc.**
- `schedule-toolbar.tsx`: у кнопки Today добавлен `rounded-full`; шевроны, зона и селект вида уже были круглыми, все пять измерены: 28 px, радиус не меньше половины высоты.
- `lesson-block.tsx`: порог одной строки `durationMinutes <= 30` заменён на `< 45`; минимум 22 px у блока короче 30 минут остался (`MIN_DISPLAY_MINUTES`).
- `lib/schedule-format.ts` (`weekSummary`): неделя без запланированных уроков, но с отменёнными, пишет «No lessons this week · N cancelled»; пустая неделя «No lessons this week»; остальное без изменений.
- `event-tooltip.tsx`: дата `text-body text-muted-foreground`, диапазон VN `text-body tabular-nums`, статус `text-body`; имя и вторая зона (`text-micro` через `TimePair`) уже соответствовали; главная строка уже VN (пункт 11 выполнен ранее, проверено).
- `schedule-web.mjs`, раздел `grid`, часть 2: высота и скругление кнопок тулбара, блоки 30, 40, 45 и 60 минут, сводка недели, классы и размеры строк тултипа, неделя только с отменённым уроком.

## Проверки

| Команда | Результат |
|---------|-----------|
| `yarn workspace @dv-lab/web typecheck` | код 0 |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `yarn workspace @dv-lab/web build` | код 0 (после остановки dev-серверов, общий `.next`) |
| `node scripts/dev-checks/schedule-web.mjs grid` (светлая) | `GRID_PART1_OK`, `SCHEDULE_WEB_GRID_OK`, 0 FAIL |
| `node scripts/dev-checks/schedule-web.mjs grid dark` | `GRID_PART1_OK`, `SCHEDULE_WEB_GRID_OK`, 0 FAIL |
| `node scripts/dev-checks/schedule-web.mjs read` | `SCHEDULE_WEB_READ_OK` |
| `node scripts/dev-checks/schedule-web.mjs changes` | `SCHEDULE_WEB_CHANGES_OK` |
| `node scripts/dev-checks/schedule-web.mjs frame` (после задачи 1) | `SCHEDULE_WEB_FRAME_OK`, включая прогон в зоне America/New_York |
| `node scripts/dev-checks/wait-dev.mjs down` | `DEV_DOWN_OK` |
| `grep -n "durationMinutes <= 30"` в `lesson-block.tsx` | код 1 (пусто) |
| grep `@radix-ui`, `radix-ui`, `cmdk` по `apps/web` | код 1 (пусто) |

Строки PASS раздела grid (светлая тема; в тёмной те же): гаттер 100/100 px; строка 08:00 «04:00 | 08:00», колонки 36/36 px, зазор 8 px, VN в 8 px от линии, 12 px от края карточки до второй зоны; угол «MSK VN» с теми же колонками; часовая линия начинается у края сетки; подпись 08:00 по центру линии; у заголовка дня border-l 1 px цвета gcal-line на одной линии с телом; полночь «Mon 04:00»; без второй зоны одна колонка 36 px, подпись «VN», гаттер всё ещё 100 px; тулбар: Today, Previous week, Next week, Second time zone, Calendar view по 28 px и круглые; блок 30 минут «Name, 09:00» высотой 22 px, блок 40 минут одна строка, 45 и 60 минут две строки (диапазон «14:00–14:45», «16:00–17:00»); сводка «5 lessons with 1 student»; тултип: имя body 600 13/20, дата body muted, диапазон body tabular, вторая зона 11/14 muted tabular под главной строкой, статус body; неделя с одним отменённым уроком: «No lessons this week · 1 cancelled».

Фикстуры только `Alex Example 2130 A` и `B`, уборка в `finally` (в логах «fixture cards removed 2», затем 0 при старте). Скриншоты в STATE_DIR (`sched-grid-*`), в репозиторий не попали.

## Изменённые ожидания прежних проверок

- `frame`, `framePart1`: «gutter: Vietnam sits against the grid» (отступ 0..6 px) заменено на «sits 8px from the grid» (8 ± 1 px). Причина: v36, колонка VN в 8 px от линии.
- Прочие проверки фазы 20 (`read`, `changes`, `frame`, `fade`) ожиданий не меняли. `students` и `fade` не перезапускались: код этих экранов план не трогал.

## Отклонения от плана

**1. [Rule 3 - блокер] Нет учётных данных dev-учителя в .env.**
- **Найдено в:** задача 1, первый запуск `schedule-web.mjs grid`: `DEV_TEACHER_LOGIN` не задан (в `.env` основной копии и worktree пять переменных, без `DEV_*`).
- **Что сделано:** через `bootstrap-teacher.ts --reset-password --email <dev-учитель> --password-stdin` сброшен пароль dev-учителя в `dvlab_dev` (тестовая учётка Dev Teacher, `auth_epoch` вырос), пароль сгенерирован случайно, дописан в `.env` worktree (`DEV_TEACHER_LOGIN`, `DEV_TEACHER_PASSWORD`; файл в `.gitignore`), в вывод и файлы репозитория не попал. Старые сессии dev-учителя недействительны. Реальные данные и карточки не менялись.
- **Что важно оркестратору:** в основной копии `.env` по-прежнему без `DEV_*`; другим web-планам и проверкам браузера нужна та же пара (взять из `.env` этого worktree или сбросить повторно той же командой).

**2. Раздел grid собирался в два коммита.** Часть 2 раздела (тулбар, блоки, тултип) вынесена в коммит задачи 2, в коммит задачи 1 попала часть 1 с `GRID_PART1_OK`; итоговый маркер `SCHEDULE_WEB_GRID_OK` печатается после задачи 2.

**3. `schedule-web.mjs` переформатирован prettier.** `yarn prettier --write` перенёс длинные строки раздела grid; прежний код файла отформатирован не был и затронут только там, где правился.

Иначе план выполнен как написан.

## Расхождения с дизайном для Design dude

- `WeekGrid/README.md` v36 не называет число 22 px для блока короче 30 минут; в коде и UI-SPEC оно остаётся (D-12b).
- README v36 описывает засечку у заголовка дня как «short vertical hairline»; в превью это полноразмерный `border-left` ячейки `.gd`, в коде то же самое. Отдельная короткая засечка не рисовалась.
- Угол для второй зоны, отличной от MSK, пока показывает смещение без «UTC» (`zoneCaption` формы `gutter`), как велел план; сокращения («CET», «YEKT») появятся в 21-06.

## Что важно следующим планам

- 21-06: при замене `zoneCaption` угол и ячейка `Second time zone` должны помещаться в колонку 36 px (до четырёх заглавных); `framePart3` в `frame` ещё проверяет прежний вид «UTC+N» и «Try a city, a country or an offset like UTC+7.» и будет обновлён тем же планом.
- 21-14: в `week-grid.tsx` ширина гаттера теперь `100px` в `COLUMNS` и `left-[100px]` у линий; рамка протяжки должна считать отступ от этих же 100 px.
- 21-15: `weekSummary` по-прежнему считает по `status === 'scheduled'`; перевод на исход урока остаётся за 21-15.
- Раздел `grid` в `schedule-web.mjs` расширяемый: фикстуры `Alex Example 2130%`, очистка уже снимает `lesson_marks` первыми, поэтому планы с отметками могут добавлять в этот раздел свои фикстуры.
- Осмотр во встроенном браузере не проводился (у исполнителя его нет); вместо него скриншоты playwright в обеих темах просмотрены глазами: гаттер, блоки, тултип, неделя с отменённым уроком.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности атаки. T-21-07: фикстуры только `Alex Example 2130*`, очистка в `finally`, скриншоты вне репозитория; в SUMMARY только счётчики.

## Self-Check: PASSED

- `week-grid.tsx`, `schedule-toolbar.tsx`, `lesson-block.tsx`, `event-tooltip.tsx`, `schedule-format.ts`, `schedule-web.mjs` существуют и изменены.
- Коммиты 81b2e1b и 41e56dc присутствуют в `git log`.
