---
phase: 20-schedule
plan: TP
subsystem: web
tags: [schedule, time-zones, design-system, D-19]
requires: [20-05, 20-07, 20-08, 20-09]
provides: TimePair и порядок колонок гаттера по D-19 (артефакт v25)
affects: [20-10]
key-files:
  created:
    - apps/web/components/app/time-pair.tsx
  modified:
    - apps/web/app/(app)/schedule/_components/week-grid.tsx
    - apps/web/app/(app)/schedule/_components/event-tooltip.tsx
    - apps/web/app/(app)/schedule/_components/lesson-block.tsx
    - apps/web/app/(app)/schedule/_components/lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/lesson-move-form.tsx
    - apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - apps/web/app/(app)/students/_components/students-screen.tsx
    - apps/web/lib/schedule-format.ts
    - scripts/dev-checks/schedule-web.mjs
    - .planning/phases/20-schedule/20-UI-SPEC.md
status: complete
commits: 2
plan_head_before: 70572ba
actuals:
  tasks: 2
  commits: 2
---

# Phase 20 Plan TP: внеплановая правка времени по D-19 Summary

Гаттер WeekGrid с второй зоной слева и Вьетнамом справа без прозрачности, общий `TimePair` (главная строка Вьетнам, вторая зона `text-micro` под ней) во всех текстах с временем урока и скобочная форма «18:00 VN (14:00 MSK)» в предложениях, тостах и баннерах.

## Что сделано

**Задача 1 (418fb1b): гаттер.** `GutterPair` рисует вторую зону первой, Вьетнам вторым, обе колонки `w-8 text-right` одного размера, веса и цвета, `opacity-70` убран. Строки часов и угол идут через один компонент, поэтому подписи угла («MSK VN», «+2 VN») и день недели вместо «00:00» оказались в левой колонке без других правок. Без второй зоны одна колонка VN вправо. Вьетнам стоит в 4px от сетки (`pr-1` остался).

**Задача 2 (a59e9a7): TimePair.**
- `components/app/time-pair.tsx`: главная строка и вторая строка `text-micro text-muted-foreground tabular-nums` (11/14), без второй зоны только главная; корень `div` или `span` (`as`), чтобы вставляться и в `<p>` описания диалога.
- `schedule-format.ts`: `secondRange` теперь ставит день недели перед всем диапазоном при другой дате («Thu 00:00–01:00 UTC+13»); новые `withSecond`, `vnWhen`, `vnDayTime`, `vnDayAt`, `vnRange` собирают скобочную форму поверх существующих `secondWhen` и `secondRange` (второго форматтера нет).
- Стеком: шапка LessonDialog («Wednesday, 14 October · 18:00–19:00 VN» и «14:00–15:00 MSK»), EventTooltip (имя 600, дата, диапазон VN, micro вторая зона, статус), строка переноса в форме переноса урока (старое и новое время), ячейка Next lesson переведена на тот же компонент (DOM из двух `span` сохранён).
- В скобках: тосты Lesson cancelled / restored / moved / added, вопрос об отмене, кнопки «moved to / moved from», баннер пересечения и строка конфликта в форме переноса, `aria-label` блока.
- Подпись под Start time в NewLessonDialog теперь идёт через `secondWhen`: «Fri 22:00 MSK» при другой дате вместо «22:00 MSK, the day before».
- UI-SPEC: одна пометка D-19 в начале Amendments.

## Проверки

| Проверка | Результат |
| --- | --- |
| `yarn workspace @dv-lab/web typecheck` | успешно |
| `yarn workspace @dv-lab/web lint` | код 0, предупреждений нет |
| `yarn workspace @dv-lab/web build` (после остановки dev) | успешно |
| `schedule-web.mjs frame`, `read`, `changes`, `students`, светлая тема | все `_OK` |
| то же, тёмная тема | все `_OK` |
| `lsof -iTCP:3000 -iTCP:4000 -sTCP:LISTEN` после остановки | пусто, `wait-dev.mjs down` код 0 |

Правки проверок в `schedule-web.mjs`: frame (порядок колонок, гаттер и угол одной ширины, размера, веса и цвета, нет прозрачности, Вьетнам в 4px от сетки; ожидание `Mon 04:00`, `MSK VN`, `+2 VN`), read (тултип и шапка диалога через `pairOf` и `checkPair`: 11/14, muted, tabular, под главной строкой; блок без второй зоны; Auckland: день недели перед диапазоном; скобки в `aria-label`, кнопках «moved to/from», тосте, баннере пересечения; подпись под Start time с днём недели из фикстуры), changes (вопрос об отмене, тосты cancel/restore/move, строка конфликта, старое и новое время в форме переноса), students без правок. В frame добавлено `waitFor` сетки перед чтением угла после «Next week»: прежнее чтение попадало в скелетон и давало редкий ложный FAIL.

## Deviations from Plan

**1. [Rule 1 - Bug] Нестабильная проверка frame.** Чтение угла сразу после трёх нажатий «Next week» один раз попало в состояние загрузки (пустой угол). Добавлено ожидание `[data-slot="week-grid"]`. Файл: `scripts/dev-checks/schedule-web.mjs`, коммит 418fb1b.

**2. Решение при неоднозначности.** Подпись под Start time переведена на `secondWhen` вместо сохранения «, the day before / the day after» (D-19: день недели в начале второй строки). Если Design dude хочет оставить текстовые «day before / day after» в форме, это одна строка в `secondZoneLine`.

**3. Расширение списка мест.** «Сентенции» с временем урока, не названные явно в задании, приведены к скобочной форме: вопрос об отмене, кнопки «moved to/from», баннер пересечения и строка конфликта, `aria-label` блока. В них появилась метка «VN» (раньше диапазоны и время были без метки зоны).

**4.** `schedule-mutations.ts` не менялся: в нём нет текстов с временем урока (только тексты stale).

## Что не сделано намеренно

Фразы серий не трогались: «Every Wednesday at 18:00 VN» (шапка Move/End series, блок Whole series), тосты «Series added», «Series moved», «Series ended». Время правила серии во второй зоне зависит от даты (переход на летнее время зоны), шаблона в D-19 для него нет.

## Замечания для Design dude

1. Серии (см. выше): нужна форма для повторяющегося времени во второй зоне или решение оставить только VN.
2. Подпись под Start time: «Fri 22:00 MSK» вместо «22:00 MSK, the day before»; подпись остаётся `text-caption` (помощник поля), а не `text-micro`, как у остальных полей формы.
3. Вьетнам в гаттере стоит в 4px от сетки (`pr-1` из v23), не в 0. Если «вплотную» значит 0, это `pr-1` у `GutterPair`.
4. В тултипе и шапке диалога TimePair стоит стеком, в форме переноса старое и новое время — две стопки по обе стороны стрелки; в баннере пересечения у каждого урока скобки с диапазоном второй зоны (длинно при трёх уроках).
5. В Next lesson главная строка без метки VN (как в 20-09), в предложениях и подписях метка VN есть: единообразие нужно подтвердить.

## Self-Check: PASSED

- `apps/web/components/app/time-pair.tsx` существует.
- Коммиты 418fb1b и a59e9a7 в `git log`.
- Рабочее дерево чисто по файлам плана; `apps/web/AGENTS.md` удалён; процессы остановлены.
