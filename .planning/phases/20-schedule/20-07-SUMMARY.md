---
phase: 20-schedule
plan: 07
subsystem: ui
status: complete
tags: [schedule, week-grid, lesson-block, tooltip, dialog, new-lesson, base-ui, playwright]

requires:
  - phase: 20-02
    provides: SCHEDULE_TIME_ZONE, zonedParts, zonedInstant, mondayOf, addDays, weekdayOf, overlaps в packages/core
  - phase: 20-04
    provides: GET /api/schedule/week, контракты ScheduleBlock и ScheduleWeekResponse
  - phase: 20-05
    provides: WeekGrid, ScheduleToolbar, useSecondZone, lib/time-zones.ts, схема schedule-web.mjs
  - phase: 20-06
    provides: POST /api/schedule/lessons (создание одного урока и серии)
provides:
  - экран /schedule читает недели из api и рисует блоки уроков по полосам без наложения
  - LessonBlock со статусами Planned, Cancelled, Moved, EventTooltip на наведение, LessonDialog просмотра урока
  - NewLessonDialog: кнопка New lesson в шапке и создание по клику на пустое место сетки
  - итог недели в описании PageHeader, загрузка скелетоном, экран ошибки чтения с Refresh
  - apps/web/lib/schedule-format.ts: подписи дат, диапазонов, второй зоны, итог недели
  - раздел read в scripts/dev-checks/schedule-web.mjs
affects: [20-08, 20-09, 20-10, schedule-screens]

requirements-completed: [SCHED-01, SCHED-04]

actuals:
  tokens: 24000
  tasks: 3
  commits: 7

plan_head_before: e55fb7dc286b4d6f208a3945b4cd093567b95a0b
plan_head_after: 14f16fd93ed3a1a705fd4e4cd8de87b23228e3a5

key-files:
  created:
    - apps/web/app/(app)/schedule/_components/lesson-block.tsx
    - apps/web/app/(app)/schedule/_components/event-tooltip.tsx
    - apps/web/app/(app)/schedule/_components/lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx
  modified:
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - apps/web/app/(app)/schedule/_components/week-grid.tsx
    - apps/web/lib/schedule-format.ts
    - scripts/dev-checks/schedule-web.mjs

key-decisions:
  - "Слот блока: data-slot = from у перенесённого урока (исходное место), to у остальных, включая место, куда урок перенесён; data-key = block.key"
  - "Полосы: кластеры по пересечению отображаемых концов, отображаемая длина max(len, 30 мин) до 24:00, left = calc(полоса/полос*100% + 2px), width = calc(100%/полос − 6px)"
  - "EventTooltip полностью управляемый: forceOpen, только мышь, открытие через 200 мс, повторное без паузы в течение 300 мс, скролл закрывает; задержки Base UI в управляемом режиме не работают, поэтому свои"
  - "Кэш недель по понедельникам лежит в ref, reload() очищает его и увеличивает version без мигания загрузки; blocksOn(date) берёт неделю из кэша или GET"
  - "Предупреждение о пересечении в диалоге нового урока никогда не блокирует сохранение, пересекаются только уроки со статусом scheduled"

patterns-established:
  - "Позиция прокрутки недели хранится в scrollTopRef экрана и передаётся в WeekGrid, при смене недели показывается SkeletonTable вместо сетки"
  - "Проверки через Playwright читают блоки по data-key и data-slot, а не по тексту"

duration: "около 4 часов"
completed: 2026-10-10
---

# Phase 20 Plan 07: недели из api на сетке расписания Summary

**Недели расписания читаются из api и рисуются блоками по полосам со статусами и подсказкой на наведение, урок открывается в диалоге просмотра, а новый урок или серия создаются диалогом из шапки или кликом по пустому месту сетки.**

## Задачи

| Задача | Название | Коммит |
| ------ | -------- | ------ |
| 1 | Недели из api на сетку: блоки, полосы, итог недели, загрузка и ошибка | cd121b6 |
| 2 | Подсказка урока на наведение и диалог просмотра урока | 797175e |
| 3 | Диалог нового урока, кнопка в шапке и создание по клику на пустое место | 14f16fd |

Трассировочный шов (задача 1) проверен сквозным прогоном до расширения: typecheck, lint и раздел read зелёные, лог `Tracer verified end-to-end — expanding`.

## Что сделано

- **Чтение недель.** `schedule-screen.tsx` держит состояние недели loading, error, ready по понедельнику, защита от устаревшего ответа сравнивает понедельник. Переход между неделями показывает SkeletonTable, прокрутка сохраняется. Ошибка чтения выводит `ReadError` с Refresh.
- **Сетка.** `WeekGrid` принимает блоки, раскладывает их по полосам (`placeDay`), высота блока 0.8 px на минуту, уроки короче 30 минут рисуются как 30. `FRAME_HEIGHT` вынесен в экспорт.
- **Блок.** `LessonBlock` это `button` с `data-key`, `data-slot`, `aria-label` вида «имя, дата, диапазон VN, вторая зона, статус». Planned: `bg-selected`; Cancelled: контур и зачёркнутое имя; Moved: пунктирная рамка и строка «→ 23 Oct». Атрибута `title` нет.
- **Подсказка.** `EventTooltip` справа от блока: имя, полная дата, «диапазон VN · диапазон во второй зоне», статус. Поверхность `bg-surface-4`, `max-w-[280px]`, `rounded-xl`, `shadow-surface-3`.
- **Диалог просмотра.** `LessonDialog` (размер lg): аватар, имя ссылкой на `/students/{id}`, дата и время, статус, кнопки-ссылки пары «moved to …» и «moved from …» (переключают неделю и открывают парный слот), цель ученика, блок Length, Repeats, Series. У прошедшего урока подпись «This lesson has already taken place and cannot be changed.» Кнопок действий нет, их добавляет 20-08.
- **Новый урок.** `NewLessonDialog`: Student (только active, по алфавиту), Date, Start time VN (шаг 15 минут, 24 часа), Length (из карточки ученика, пока не изменена вручную, 15 до 240), Repeats (Once или Every week). Живая строка второй зоны с пометкой «the day before» или «the day after», подсказка серии «Every {Weekday} at {time} until you end the series.», предупреждение о пересечении (не блокирует), ошибки полей по спецификации, баннер сбоя сервера, состояния загрузки, ошибки и отсутствия учеников. Тосты «Lesson added» и «Series added». Кнопка New lesson в `PageHeader` отключена, пока грузится неделя или ученики. По умолчанию время это ближайший целый час по Вьетнаму.
- **Проверки.** В `scripts/dev-checks/schedule-web.mjs` добавлен раздел `read` (96 проверок на тему), к нему pickDate, pickTime, pickOption с повтором, dialogFacts и снимки вечерних недель.

## Проверки

| Команда | Результат |
| ------- | --------- |
| `yarn workspace @dv-lab/web typecheck` | код 0 |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `node scripts/dev-checks/schedule-web.mjs read` светлая тема | 96 PASS, SCHEDULE_WEB_READ_OK |
| то же, тёмная тема | 96 PASS, SCHEDULE_WEB_READ_OK |
| `node scripts/dev-checks/schedule-web.mjs frame` светлая и тёмная | по 244 PASS, SCHEDULE_WEB_FRAME_OK |
| `yarn workspace @dv-lab/web build` | успешно, маршрут /schedule собран |
| grep-ворота: scheduleWindow, nextLessons, occurrenceAt; gcal-event; title= в lesson-block; disabled по overlap/clash | все четыре без совпадений (код 1) |
| grep-ворота: bg-selected в lesson-block (1), bg-surface-4 и max-w-[280px] в event-tooltip (по 1), подпись прошедшего урока в lesson-dialog (1) | выполнены |
| `node scripts/dev-checks/wait-dev.mjs down` | DEV_DOWN_OK |
| `lsof -iTCP:3000 -iTCP:4000 -sTCP:LISTEN` после остановки | пусто, код 1 |

Dev-стек поднимался на 3000 и 4000 (api на dvlab_dev без DATABASE_URL окружения), остановлен целиком: yarn-обёртки, `node --watch`, `next-server`, родительские оболочки. Api соседнего плана 20-06 на порту 4202 не трогал.

## Не запускалось

- Артефакт дизайна v23: инструмента Artifact в сессии нет, вместо него взяты Amendments из `20-UI-SPEC.md`. Визуально результат смотрел по снимкам Playwright в обеих темах, встроенного браузера нет. Сверка с артефактом остаётся за Design dude.
- Юнит и e2e тесты не добавлял и не запускал (правило фазы), `yarn install` и сборка api не запускались.

## Отклонения от плана

**1. [Rule 3 - Blocking] EventTooltip рисует LessonBlock сам, без cloneElement.**
- **Найдено в:** задача 2.
- **Проблема:** план предполагал оборачивать готовый блок через cloneElement. Правила React Compiler (purity на Date.now, refs) это отвергли, а взаимный импорт week-grid и event-tooltip давал цикл.
- **Решение:** `EventTooltip` получает `block`, `layout` и сам рендерит `LessonBlock`, `WeekGrid` только вызывает `EventTooltip`. Цикла нет.
- **Файлы:** event-tooltip.tsx, week-grid.tsx. **Коммит:** 797175e.

**2. [Rule 1 - Bug] Регрессия кадра 20-05 после асинхронной загрузки.**
- **Проблема:** раздел `frame` ловил состояние до появления сетки, а новое описание в шапке и кнопка New lesson увеличили шапку: вертикальное переполнение страницы 12 px на высоте 1080.
- **Решение:** `settle` в `framePart2` ждёт сетку; `FRAME_HEIGHT` изменён с `100svh-18rem` на `100svh-20rem`.
- **Файлы:** week-grid.tsx, schedule-web.mjs. **Коммит:** 14f16fd.

**3. Утилита тени.** План называл `shadow-3`, в проекте это `shadow-surface-3`; использована фактическая.

**4. Подсказка.** Задержки Base UI в управляемом режиме не действуют, поэтому 200 мс и 300 мс повторного открытия реализованы вручную (модульный `clock.closedAt`).

## Замечания для Design dude

- Блоки Cancelled и Moved нарисованы по Amendments, артефакта v23 не было.
- Однострочный короткий блок «Name, HH:MM» в узких колонках обрезается троеточием.
- Блоки 31 до 44 минут обрезают вторую строку примерно на 2 px.
- Неделя только с отменённым уроком показывает «0 lessons with 0 students · 1 cancelled» (буквально по плану), возможно, нужна иная формулировка.
- Высота сетки теперь `100svh-20rem`, потому что шапка получила описание и кнопку New lesson.
- Подсказка открывается справа от блока.
- Текст триггера DateField остаётся в формате en-US «Oct 14, 2026».
- Кнопки пары в диалоге просмотра сделаны подчёркнутыми текстовыми кнопками.
- Замечания 20-05 остаются в силе.

## Что важно для следующих планов

- 20-08 добавляет в `LessonDialog` кнопки действий и использует `reload()` из `schedule-screen.tsx` после мутаций; `changeable` уже приходит в блоке.
- Чистка фикстур в `schedule-web.mjs` идёт по префиксу `Alex Example 2007%`; чистка хвостов в 20-06 по префиксу `Alex Example 20%` снесёт их, если запускать одновременно.
- Диалог нового урока принимает `seed` (дата, время) от клика по сетке: `WeekGrid` вызывает `onSlot(date, time)`.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности: клиент только читает недели и посылает POST на уже существующий endpoint.

## Self-Check: PASSED

- Файлы lesson-block.tsx, event-tooltip.tsx, lesson-dialog.tsx, new-lesson-dialog.tsx, schedule-screen.tsx, week-grid.tsx, schedule-format.ts, schedule-web.mjs существуют.
- Коммиты cd121b6, 797175e, 14f16fd найдены в `git log`.
- `commits: 7` измерено как `git rev-list --count e55fb7d..HEAD`; из них 3 мои, 4 принадлежат параллельному плану 20-06.
