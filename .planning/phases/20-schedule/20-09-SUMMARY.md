---
phase: 20-schedule
plan: 09
subsystem: ui
status: complete
tags: [students, search, tabs, next-lesson, second-zone, time-zones, playwright]

requires:
  - phase: 20-03
    provides: фэйд 24px у контейнера таблицы, EmptyLine с text, schedule-web.mjs и wait-dev.mjs
  - phase: 20-04
    provides: StudentRow.nextLessonAt из общей раскладки вхождений
  - phase: 20-05
    provides: apps/web/lib/time-zones.ts (listTimeZones, utcOffset, matchesTimeZone, zoneCaption)
  - phase: 20-07
    provides: formatWhen, yearInZone, useSecondZone
provides:
  - список учеников с управляемыми вкладками, поиском по имени на клиенте и колонкой Next lesson со второй зоной
  - secondWhen в schedule-format.ts: вторая строка ячейки «14:00 MSK» или «Thu 00:00 UTC+13»
  - форма карточки ученика на общем модуле зон, локальных копий нет
  - раздел students в scripts/dev-checks/schedule-web.mjs
affects: [20-10]

actuals:
  tokens: 26000
  tasks: 3
  commits: 4

plan_head_before: c406933
plan_head_after: adc1483

key-files:
  created: []
  modified:
    - apps/web/app/(app)/students/_components/students-screen.tsx
    - apps/web/app/(app)/students/_components/student-form-dialog.tsx
    - apps/web/lib/schedule-format.ts
    - scripts/dev-checks/schedule-web.mjs

key-decisions:
  - "Следующий урок в браузере не считается: ячейка форматирует nextLessonAt из GET /students"
  - "Фон TabsList перенесён на обёртку rounded-xl bg-muted, у самого TabsList bg-transparent: маска фэйда не гасит фон"
  - "Фэйд полосы вкладок задан без префикса max-sm: scroll-fade-x и компактный размер всегда, прокрутка и сужение только max-sm"
  - "Вторая зона берётся из useSecondZone экрана расписания (localStorage), подпись из zoneCaption"

duration: "около 1,5 часа"
---

# Phase 20 Plan 09: список учеников с поиском и следующим уроком Summary

Список учеников получил вкладки статуса с поиском по имени на клиенте и колонку Next lesson: главная строка по Вьетнаму, под ней мелко вторая зона из расписания; форма карточки переключена на общий модуль зон.

## Что сделано

- **Задача 1 (5586310).** Колонка Next lesson после Lessons left. Ячейка форматирует `nextLessonAt` через `formatWhen(…, SCHEDULE_TIME_ZONE, текущий год Вьетнама)`; без урока приглушённое «None». Выражений `scheduleWindow`, `nextLessons`, `occurrenceAt` в файле нет.
- **Задача 2 (2af779a).** `Tabs` управляемые (`value`, `onValueChange`, начально `active`). Над панелями `flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between` с вкладками и `Input type="search"` («Search students», `w-full sm:w-72`). Фильтр по `displayName` без регистра после trim, общий для Active и Archived, на Unassigned payments поля нет, на сервер не ходит, в URL не пишется. Описание шапки считает по нефильтрованным спискам. Пустой результат запроса — `EmptyLine text="No students found"`.
- **Задача 3 (c5ee929).** В `student-form-dialog.tsx` удалены локальные `MODERN_TIME_ZONES`, `utcOffset`, `offsetQuery`, `matchesTimeZone`; `buildTimeZones` строится из `listTimeZones(сохранённая зона)` с первым пунктом «Same as teacher». Остался единственный `function matchesTimeZone` и `function utcOffset` в `apps/web/lib/time-zones.ts`.
- **Правка владельца по артефакту v24, TimePair (adc1483).** Ячейка Next lesson: главная строка «Wed 14 Oct, 18:00» без метки зоны, под ней `text-micro` (11/14) `text-muted-foreground` `tabular-nums` вторая зона из `useSecondZone`: «14:00 MSK». Другая дата во второй зоне: «Thu 00:00 UTC+13». Без второй зоны только главная строка. Это заменяет прежний формат ячейки из плана 20-09 («без второй зоны»). Функция `secondWhen` добавлена в `apps/web/lib/schedule-format.ts` (файла нет в `files_modified`, добавка маленькая и нужна форматированию). Вертикальные отступы ячейки `py-1` вместо `py-2`, чтобы строка с двумя линиями осталась в той же высоте (45px).

## Проверка

- `yarn workspace @dv-lab/web typecheck` и `lint`: код 0 после каждой задачи и после правки владельца.
- `yarn workspace @dv-lab/web build`: код 0 (после остановки dev-стека, итоговый запуск уже с правкой TimePair).
- `node scripts/dev-checks/schedule-web.mjs students`: 59 PASS, ноль FAIL, `SCHEDULE_WEB_STUDENTS_OK`, свет и тёмная тема (по 59 PASS в каждой).
- Что покрывает раздел: порядок заголовков Student, Status, Rate, Lessons left, Next lesson; ячейка A равна `formatWhen` значения api и первой среде 18:00; B — «None» (приглушено); вторая строка «14:00 MSK» 11px/14px, muted, tabular-nums; другая зона (Pacific/Auckland) даёт «Thu 00:00 UTC+13»; без второй зоны один span; высота строки одинакова (45/45) с второй строкой и без; запрос с пробелами и другим регистром оставляет A и убирает B; Archived хранит запрос и показывает архивную C по «2009 c»; «zz-no-such-student» даёт «No students found» на обеих вкладках; счётчики шапки не меняются; на Unassigned payments поля нет; поиск не отправляет запросов (на вкладке Unassigned фронт читает свои платежи); поле 288px справа от вкладок, нижняя грань общая; 360px — у полосы вкладок `scroll-fade-x`, `--scroll-fade-size` 24px, маска задана, фон на обёртке; у контейнера таблицы 24px; страница вбок не прокручивается; форма карточки: «kolk» находит Asia/Kolkata UTC+5:30, «+7» только зоны UTC+7 с Asia/Ho_Chi_Minh, «utc+5:30» находит Kolkata, «kathm» находит Kathmandu UTC+5:45, нет совпадения — «No time zones found», закрытие без POST.
- Осмотр: скриншоты в `STATE_DIR` (`/var/folders/.../dvlab-dev-checks/sched-students-{light,dark}-*.png`) просмотрены для desktop, narrow, no-match, next-day, zone-search в обеих темах. Во встроенном браузере вручную не открывалось (инструмента нет), осмотр проведён через Playwright-скриншоты. В списке видны реальные карточки dev-базы; в скриншотах и SUMMARY их данных нет.
- Фикстуры `Alex Example 2009 A/B/C` созданы и удалены (3 карточки с серией и архивом), хвостов нет.
- Процессы: dev-стек поднят исполнителем, дважды останавливался; в конце `lsof -iTCP:3000 -iTCP:4000 -sTCP:LISTEN` пуст, `wait-dev.mjs down` код 0. Чужой `node --watch` из worktree фазы 19 не тронут.

## Отклонения от плана

1. **[Правка владельца, v24 TimePair]** Формат ячейки Next lesson заменён на две строки (см. выше). Artifact-инструмента нет, README и preview TimePair не читались: реализовано по тексту сообщения координатора.
2. **[Rule 3 - блокировка]** `max-sm:scroll-fade-x` не работает: `scroll-fade-x` обычный CSS-класс в `globals.css`, а не `@utility`, Tailwind не создаёт вариант и маска не появлялась. Класс и компактный размер заданы без префикса, прокрутка и сужение остаются `max-sm:`. Так сделан и контейнер таблицы (`table.tsx`). На широком экране полоса не переполнена, таймлайн прокрутки неактивен и маска полностью непрозрачна. На 360px полоса вкладок помещается (329/329), так что фэйд проявится при более длинной подписи или узком окне.
3. Артефакт (D-18) инструментом Artifact не читался, использованы Amendments из `20-UI-SPEC.md` и решения владельца D-12, D-13.
4. `text-micro` ранее запрещён UI-SPEC («No text-micro»), но правка владельца v24 прямо требует micro 11/14.
5. `apps/web/AGENTS.md` дважды создан `next dev`/`next build`, удалён без коммита.

## Для Design dude

- Артефакт не читался. По решениям владельца в приложении вкладки Active и Archived без Paused и All, поиск только по имени (D-12), колонки фазы 19 плюс Next lesson (D-13); отличия от принципов артефакта сверьте сами.
- Вторая строка Next lesson для зоны без короткого имени выглядит как «Thu 00:00 UTC+13» (подпись `zoneCaption('toolbar')`), только Москва даёт «MSK». Нужно ли в таблице сокращать до «+13» как в гуттере сетки, как в TimePair?
- Ячейка с двумя строками получила `py-1`, чтобы строка осталась 45px; если TimePair предполагает другой отступ, скажите.
- Полоса вкладок: фон перенесён на обёртку `rounded-xl bg-muted`, чтобы маска фэйда не гасила фон; на 360px полоса сейчас не переполняется, фэйда не видно.

## Известные заглушки

Нет.

## Self-Check: PASSED

- Файлы изменены и закоммитированы: students-screen.tsx, student-form-dialog.tsx, schedule-format.ts, schedule-web.mjs.
- Коммиты на месте: 5586310, 2af779a, c5ee929, adc1483.
