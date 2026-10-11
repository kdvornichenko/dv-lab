---
phase: 21-lesson-accounting-and-today
plan: 06
subsystem: web
tags: [time-zones, settings, schedule, week-grid, drag]
requires: [21-03, 21-14]
provides:
  - zoneLabel и поиск зон по сокращению и смещению (apps/web/lib/time-zones.ts)
  - единый TimeZonePicker (тулбар, форма карточки, Settings) и useSecondZone
  - экран Settings (вкладка General, карточка Time zones)
  - протяжка нового урока по сетке недели
affects: [21-08, 21-10]
tech-stack:
  added: []
  patterns:
    - localStorage-состояние через useSyncExternalStore с кэшем снимка
    - протяжка на pointer events с захватом, автопрокруткой через rAF
key-files:
  created:
    - apps/web/components/app/time-zone-picker.tsx
    - apps/web/app/(app)/settings/page.tsx
    - apps/web/app/(app)/settings/_components/settings-screen.tsx
  modified:
    - apps/web/lib/time-zones.ts
    - apps/web/lib/schedule-format.ts
    - apps/web/components/ui/combobox.tsx
    - apps/web/app/(app)/_components/sections.ts
    - apps/web/app/(app)/schedule/_components/schedule-toolbar.tsx
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - apps/web/app/(app)/schedule/_components/week-grid.tsx
    - apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/end-series-dialog.tsx
    - apps/web/app/(app)/schedule/_components/move-series-dialog.tsx
    - apps/web/app/(app)/schedule/_components/lesson-move-form.tsx
    - apps/web/app/(app)/students/_components/student-form-dialog.tsx
    - apps/web/app/(app)/students/_components/students-screen.tsx
    - scripts/dev-checks/schedule-web.mjs
  deleted:
    - apps/web/app/(app)/schedule/_components/second-zone-select.tsx
decisions:
  - Метка зоны считается по правилу «смещение на дату против меньшего из январского и июльского»; без привычного сокращения берутся первые четыре буквы города.
  - Избранное зон и второй пояс живут только в localStorage (dv-lab.time-zones.favorites, dv-lab.schedule.second-zone); в аккаунт ничего не пишется.
  - Рамка протяжки использует тот же rounded-md, что и блок урока (8 px в токенах репозитория; в спецификации «6 px» названо номинально).
status: complete
commits: 3
plan_head_before: 56dc8e8
plan_head_after: e3e7df0c69e43488e0e45042c69a51c5c7059fae
actuals:
  tokens: 18500
  tasks: 3
  commits: 3
---

# Phase 21 Plan 06: UI-B (зоны, Settings, протяжка) Summary

Метки зон стали сокращениями на показываемую дату, выбор зоны везде один компонент TimeZonePicker, добавлен минимальный экран Settings, а по сетке недели урок создаётся протяжкой с рамкой по 15 минут.

## Задачи и коммиты

| Задача | Коммит | Что сделано |
|--------|--------|-------------|
| 1 (tracer) | 7df4243 | `zoneLabel`, `listTimeZones`, `zoneMatches`; `TimeZonePicker` с триггерами `toolbar` и `field`, избранное, None; тулбар, форма карточки и места показа переведены на новый модуль; `second-zone-select.tsx` удалён |
| 2 | 8b8a26e | Строка Settings последней в сайдбаре, маршрут `/settings`, вкладка General в адресе, карточка Time zones с полем Second zone |
| 3 | e3e7df0 | Протяжка по колонке дня: порог 4 px, сетка 15 минут, 15..240 минут, якорь и переворот, границы суток, автопрокрутка у краёв, Esc/blur/pointercancel, статичная рамка под диалогом, длина рамки попадает в New lesson |

Число `commits: 3` посчитано по своим коммитам. `git rev-list --count 56dc8e8..HEAD` показывает 4: в диапазон попал docs-коммит соседнего плана 21-07 (8923cd2).

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn typecheck` | зелёный |
| `yarn lint` | зелёный |
| `yarn workspace @dv-lab/web build` | зелёный, маршрут `/settings` в списке |
| `schedule-web.mjs zones` (светлая и тёмная) | OK |
| `schedule-web.mjs settings` (светлая и тёмная) | OK |
| `schedule-web.mjs drag` (светлая и тёмная) | OK |
| `schedule-web.mjs grid`, `forms`, `read`, `frame`, `changes`, `students`, `fade` | OK |
| greps из плана на `UTC+`, `GMT+`, `'toolbar' | 'gutter'`, `listTimeZones`, `Main zone` | чисто |

Скриншоты проверены глазами: попап зон, прокрутка к выбранной зоне, страница Settings и тост, рамка протяжки, чип одной ячейки, диалог под рамкой, перекрытие с блоком.

Не запускались по правилам задачи: сборка api и `yarn test`.

Данные: фикстуры только `Alex Example 21NN` (в `drag` префикс `Alex Example 2132`), после каждого прогона удаляются; реальные данные `dvlab_dev` не менялись.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Список попапа не прокручивался**
- Найдено в задаче 1: вьюпорт ScrollArea берёт `max-h-[inherit]`, у обёртки не было высоты.
- Исправление: явный `max-h-60` у обёртки, `p-1` у списка.

**2. [Rule 1 - Bug] Выбранная зона прокручивалась не туда**
- Причина: попап масштабируется во время анимации, расчёт по координатам врал.
- Исправление: `scrollIntoView({ block: 'center' })`.

**3. [Rule 3 - Blocking] Две необязательные пропсы у обёртки Combobox**
- В `components/ui/combobox.tsx` добавлены `onOpenChange` и `onInputValueChange` (нужны для прокрутки к выбранной зоне и сброса поиска). Это правка общего компонента, файла нет в `files_modified` плана.

**4. [Rule 2 - Lint] Неиспользуемый импорт `SCHEDULE_TIME_ZONE` в `settings-screen.tsx`** убран в коммите задачи 3.

Остальное: план выполнен как написан.

## Расхождения с дизайном v38 (план сделан по v36)

- В v38 карточка переименована в «Second time zone» и добавлен сохраняемый в аккаунте default zone. D-12b этого не строит, сделана карточка по плану («Second zone», «Saved in this browser.»). Расхождение для Design dude и ревью плана.
- README SettingsGeneral в копии всё ещё показывает Account, Appearance, Main zone; по плану они не строятся.
- Тосты отмены и возврата урока по-прежнему содержат вторую зону. В v36/v38 они только в основной зоне; в тексте 21-06 этого нет, 21-14 отложил на следующий web-план. Не сделано.
- Не проверялось: Tab-стоп звезды избранного, подсветка строки, следящая за переставленным рядом, протяжка касанием (по плану только мышь и перо).
- Высота рамки без -2 (как в превью дизайна). Чип 15-минутной рамки ставится справа от рамки и в колонке воскресенья переворачивается влево.

## Что важно следующим планам

- `useSecondZone` теперь в `@/components/app/time-zone-picker`; `second-zone-select.tsx` нет.
- Подпись зоны: `zoneLabel(zone, instant)` из `apps/web/lib/time-zones.ts`; `zoneCaption(..., 'toolbar')` больше нет.
- Попап TimeZonePicker в диалоге лежит на поверхности на два уровня выше диалога.
- `NewLessonSeed` получил необязательное `durationMinutes`; если оно задано, длина считается «отредактированной» и не подменяется длиной из карточки ученика.
- В рабочем дереве есть чужая правка `.planning/EXECUTOR-RULES.md` (не из этого плана), в коммиты не включалась.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности: новых эндпоинтов, путей авторизации и записи в аккаунт нет; избранное и второй пояс только в localStorage браузера.

## Self-Check: PASSED

- Файлы `time-zone-picker.tsx`, `settings/page.tsx`, `settings-screen.tsx` на месте, `second-zone-select.tsx` отсутствует.
- Коммиты 7df4243, 8b8a26e, e3e7df0 найдены в `git log`.
