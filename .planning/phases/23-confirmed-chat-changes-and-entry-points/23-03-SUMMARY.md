---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '03'
subsystem: schedule-series
status: complete
tags: [schedule, time-zone, google-commands, chat]
requires: ['23-02']
provides:
  - 'move_series принимает необязательный inputTimeZone (контракт, план команды, prepareSeriesChange)'
  - 'scripts/dev-checks/chat-bulk.mjs, раздел zone, строка CHAT_BULK_ZONE_OK'
affects: ['23-09']
tech-stack:
  added: []
  patterns:
    - 'пояс ввода команды отдельно от проверки настройки учителя (ARCH-A3)'
key-files:
  created:
    - scripts/dev-checks/chat-bulk.mjs
  modified:
    - packages/contracts/src/schedule.ts
    - packages/db/src/calendar-values.ts
    - apps/api/src/schedule/series.ts
    - apps/api/src/schedule/calendar-conflicts.ts
decisions:
  - 'Пояс разреза move_series = inputTimeZone ?? пояс учителя, один и тот же в seriesCutBoundary и в контексте cutSeries; end_series и checkSeriesFrom не меняются'
  - 'Финальная сверка readConflicts сравнивает настройку учителя с expectedDefaultTimeZone запроса, а не с поясом кандидата'
requirements: [CHAT-06]
metrics:
  duration: 25min
  completed: 2026-10-14
actuals:
  tokens: 6500
  tasks: 2
  commits: 5
plan_head_before: 6067b76edfefa892a73b5d8b1d2b1a56a58353b3
plan_head_after: c75de1afaaa079a238f539b617572c93302b879c
---

# Phase 23 Plan 03: Пояс команды переноса серии Summary

Команда `move_series` принимает необязательный `inputTimeZone`: дата `from`, день недели и время читаются в этом поясе, новая серия создаётся в нём, а `expectedDefaultTimeZone` по-прежнему сверяет настоящую настройку учителя через `lockTeacherTimeContext`.

## Производительность

- Начало и конец: 2026-10-14, около 25 минут.
- Задачи: 2 из 2.
- `commits: 5` — измерено `git rev-list --count plan_head_before..HEAD`. В диапазон попали три коммита параллельного плана 23-06 (`9131cee`, `5a04994`, `d6e3375`). Коммиты этого плана — два: `cfa1999`, `c75de1a`.

## Что сделано

- `packages/contracts/src/schedule.ts`: `moveSeriesRequest.inputTimeZone` (`isTimeZone`, необязательное). `moveCalendarSeriesRequest`, `googleConflictRequest` и `validatedCalendarCommand` получают поле через `moveSeriesRequest`.
- `packages/db/src/calendar-values.ts`: вариант `move_series` в `googleCommandInput` принимает `inputTimeZone` (`prepareSeriesCommand` разворачивает весь input в `plan.input`). Миграции нет.
- `apps/api/src/schedule/series.ts`: в `prepareSeriesChange` для `move_series` пояс разреза `inputTimeZone ?? time.context.defaultTimeZone` идёт и в `seriesCutBoundary`, и в контекст `cutSeries`. `packages/core` не менялся.
- `commandHash` хеширует весь разобранный `validatedCalendarCommand`, поэтому `inputTimeZone` входит в хеш и повтор с тем же `requestId` и другим поясом отклоняется (T-23-11).
- `scripts/dev-checks/chat-bulk.mjs zone`: запуск под `calendar-offline.mjs`, `dvlab_test`, синтетическое подключение из `calendar-seed.mjs up test week`, заглушка шлюза по образцу `schedule-started-series.mjs`, карточка `Alex Example 2320`, серия по вторникам 12:00 VN с отметкой done за две недели до текущей недели. Уборка: `calendar-seed.mjs down test` (журнал команд и подключение) и удаление карточки под migrator.

## Коммиты задач

1. Задача 1 — `cfa1999` feat(23-03): Добавил пояс ввода inputTimeZone в перенос серии отдельно от пояса учителя
2. Задача 2 — `c75de1a` feat(23-03): Добавил проверку chat-bulk.mjs zone и сверку пересечений с настройкой учителя, а не с поясом новой серии

## Проверки

- `yarn workspace @dv-lab/contracts typecheck`, `@dv-lab/db typecheck`, `@dv-lab/api typecheck` — без ошибок (api повторно после правки `calendar-conflicts.ts`).
- `yarn prettier --check` по пяти файлам плана — чисто.
- `node scripts/dev-checks/chat-bulk.mjs zone` → `CHAT_BULK_ZONE_OK`:
  - case 1: запрос пересечений `move_series` с `inputTimeZone: Europe/Moscow` — `complete`, `checkedRange.timeZone` Europe/Moscow, начало диапазона 14:00 MSK; без поля — `complete`, Asia/Ho_Chi_Minh, 14:00 VN.
  - case 2: `expectedDefaultTimeZone` = Europe/Moscow при настройке VN — `default_time_zone_changed`, строк журнала 1→1.
  - case 3: `inputTimeZone: Europe/Berlin`, 02:30 в ближайшую дату перехода на летнее время (найдена через `localTimeCandidates`) — `nonexistent_local_time`, строк журнала 1→1.
  - case 4: перенос с MSK на среду 14:00 — новая серия `time_zone` Europe/Moscow, 14:00, weekday 3, первое вхождение 18:00 VN, мастер в заглушке Google в Europe/Moscow; старая серия в поясе VN, 12:00, `ends_on` = день до разреза; отметка done на старом ключе; `teacher_settings.default_time_zone` не изменилась.
  - case 5: та же команда без `inputTimeZone` над серией в MSK — новая серия в Asia/Ho_Chi_Minh, 14:00 VN, серия MSK стала пустой, настройка учителя прежняя.
- `node scripts/dev-checks/schedule-started-series.mjs` → `SCHEDULE_STARTED_SERIES_OK` (обычный перенос серии без поля).
- `node scripts/dev-checks/calendar-commands.mjs check` → `CALENDAR_COMMANDS_OK` (check 3 пересечений `create` после правки сверки в `readConflicts`).
- `git diff --stat 6067b76 HEAD -- packages/core` пуст.

## Не запускалось

- `yarn test`, `yarn build`, браузер, dev-серверы: запрещены заданием (параллельный web-план 23-04, порты 3000 и 4000).
- `yarn lint` (только web) и `yarn knip`: web принадлежит 23-04, правок web в плане нет.

## Отклонения от плана

### Автоисправления

**1. [Правило 1] Финальная сверка пояса в `readConflicts` (`apps/api/src/schedule/calendar-conflicts.ts`, файла нет в плане)**
- Найдено в задаче 2: первый прогон `chat-bulk.mjs zone` упал на case 1 — запрос пересечений с `inputTimeZone: Europe/Moscow` вернул `unavailable/external_change`.
- Причина: в конце `readConflicts` настройка учителя сравнивалась с `candidate.timeZone`, а для `move_series` это `newRule.timeZone`. До шва пояс новой серии всегда совпадал с поясом учителя, поэтому сверка означала «настройка не изменилась»; с поясом ввода она отклоняла любой перенос в другом поясе.
- Исправление: сравнение с `request.proposal.input.expectedDefaultTimeZone` (то же значение, что сверяется в начале `candidates`). `checkedRange.timeZone` и `inputKey` остались на `candidate.timeZone`. Для `create` и `move` результат прежний: там `candidate.timeZone` — это и есть настройка учителя, совпавшая с `expectedDefaultTimeZone`.
- Коммит `c75de1a`.

### Прочие отклонения

- В `chat-bulk.mjs` пояс VN старой серии сравнивается через `core.sameTimeZone`: в `lesson_series.time_zone` пояс учителя хранится как `Asia/Saigon`.
- Раздел про `chat-bulk.mjs` в `scripts/dev-checks/README.md` не добавлен (файла нет в плане); его можно дописать вместе с разделами 23-09.
- Фикстура `ledger-api.mjs` не понадобилась и не трогалась.

## Для следующих планов

- 23-09: массовый перенос из чата передаёт в команду `move_series` поле `inputTimeZone` (названный пояс или Asia/Ho_Chi_Minh) и настоящий `expectedDefaultTimeZone` учителя. Тот же input годится для `checkCalendarConflicts`: интервалы и `checkedRange.timeZone` будут в поясе ввода.
- `from` читается в поясе ввода: граница разреза — начало дня `from` в этом поясе. Для MSK при учителе во Вьетнаме это 04:00 VN, так что урок в 00:00–03:59 VN в день `from` уходит в старую серию.
- Новые разделы добавляются в `SECTIONS` и в ветку запуска в конце `chat-bulk.mjs`; заглушка шлюза, `run`, `project` и `moveSeries` уже есть.
- Web (`schedule-mutations.ts`) поле не посылает, обычная форма работает как раньше.

## Self-Check: PASSED

- Файлы: `scripts/dev-checks/chat-bulk.mjs`, `packages/contracts/src/schedule.ts`, `packages/db/src/calendar-values.ts`, `apps/api/src/schedule/series.ts`, `apps/api/src/schedule/calendar-conflicts.ts` — на месте.
- Коммиты `cfa1999`, `c75de1a` — в истории ветки.
