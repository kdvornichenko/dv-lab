---
phase: 20-schedule
plan: ES
subsystem: schedule
tags: [schedule, end-series, sched-05]
status: complete
requires: [20-REVIEW-FIX]
provides: ["End series переводит перенесённые вхождения после нового ends_on в lessons"]
affects: [packages/core, apps/api, apps/web]
key-files:
  modified:
    - packages/core/src/schedule.ts
    - apps/api/src/schedule/series.ts
    - apps/web/app/(app)/schedule/_components/end-series-dialog.tsx
    - scripts/dev-checks/schedule-core.mjs
    - scripts/dev-checks/schedule-api.mjs
    - scripts/dev-checks/schedule-web.mjs
decisions:
  - "End series переводит в lessons все moved-вхождения с original_on > нового ends_on (в пределах прежнего диапазона серии), как cutSeries при Move series: без фильтра по времени, прошедшие и будущие"
  - "Отменённые вхождения (в том числе с временем переноса) при End series в lessons не переводятся, как в cutSeries (D-04)"
  - "Строки lesson_series и lesson_exceptions не удаляются и не меняются, кроме ends_on (D-16)"
metrics:
  completed: 2026-10-10
  tasks: 1
commits: 1
plan_head_before: 4dea62b
plan_head_after: ee9e9b8
---

# Фаза 20, внеплановая правка ES: End series сохраняет перенесённые уроки

End series теперь делает то же, что Move series для хвоста серии: перенесённые вхождения с исходной датой после нового `ends_on` становятся строками `lessons` на времени переноса в той же транзакции. Урок, перенесённый с поздней даты на уже прошедший день, остаётся на сетке своей недели (пробел SC3 / SCHED-05 из 20-VERIFICATION).

## Что сделано

- `packages/core/src/schedule.ts`: общий `movedLessons(tail, exceptions)` вынесен из `cutSeries`. `endSeriesAt(rule, exceptions, lastOn, now)` принимает полный `SeriesRule` и исключения, результат `ok` — `{ endsOn, lessons }`. Хвост: `startsOn = max(startsOn, endsOn + 1)`, прежний `endsOn` серии сохраняется, поэтому исключения за прежним концом (история прошлых разрезов) не воскрешаются.
- `apps/api/src/schedule/series.ts`: `endSeries` читает исключения с `original_on >= lastOn` (любая дата серии после нового `ends_on` строго позже `lastOn`), ставит `ends_on` и вставляет `result.lessons` со статусом `scheduled`. Ничего не удаляется.
- `end-series-dialog.tsx`: вызов `endSeriesAt(rule, [], lastOn, now)` (подсказке нужен только `endsOn`). Текст подсказки: «The last lesson will be on {date}. Later lessons are removed from the schedule. Earlier lessons and any lessons you moved stay where they are.» и для пустой серии «No lessons of this series will remain. Any lessons you moved stay where they are.»
- `schedule-core.mjs`: s11 под новую сигнатуру (`lessons: []`), новый s14: moved с прошедшей датой переноса и moved в будущее после конца переводятся; moved с `original_on <= ends_on` и cancelled с временем переноса не переводятся; исключение за прежним `ends_on` не переводится; неделя переноса после окончания показывает урок `l:…` и не показывает дубль `s:…`.
- `schedule-api.mjs changes`: новая часть `partEndKeepsMoved` (токен `END_KEEPS_MOVED_OK`): вхождение через неделю после ближайшего перенесено на вчера (SQL), End series с `lastOn = сегодня` даёт `endsOn` = последняя прошедшая дата, строк `lessons` +1, `lesson_series` и `lesson_exceptions` без изменений, урок на вчера остаётся (`ref.kind = single`, `scheduled`), перенесённое вхождение до нового конца остаётся вхождением серии, строки исключений остаются `moved`.
- `schedule-web.mjs`: ожидания двух текстов подсказки.

## Проверки

| Команда | Результат |
|---|---|
| `yarn workspace @dv-lab/core typecheck` | код 0 |
| `yarn workspace @dv-lab/contracts typecheck` | код 0 |
| `yarn workspace @dv-lab/api typecheck` | код 0 |
| `yarn workspace @dv-lab/web typecheck` | код 0 |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `node scripts/dev-checks/schedule-core.mjs` | `CORE_PART1_OK`, s1-s14 PASS, `CORE_OK` |
| `node scripts/dev-checks/schedule-api.mjs read` | `SCHEDULE_API_READ_OK` |
| `node scripts/dev-checks/schedule-api.mjs next` | `SCHEDULE_API_NEXT_OK` |
| `node scripts/dev-checks/schedule-api.mjs changes` | `OCCURRENCE_OK`, `SINGLE_OK`, `SERIES_OK`, `END_KEEPS_MOVED_OK`, «row counts never decreased over 32 samples», `SCHEDULE_API_CHANGES_OK` |
| `node scripts/dev-checks/wait-dev.mjs up` | `DEV_UP_OK` |
| `node scripts/dev-checks/schedule-web.mjs changes` | `SCHEDULE_WEB_CHANGES_OK` (новые тексты подсказки PASS) |
| `node scripts/dev-checks/schedule-web.mjs changes dark` | `SCHEDULE_WEB_CHANGES_OK` |
| `node scripts/dev-checks/wait-dev.mjs down` | `DEV_DOWN_OK`; `lsof` на 3000/4000/4201/4202 пуст |

Dev-стек поднят `env -u DATABASE_URL -u MIGRATOR_DATABASE_URL yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev`, остановлен целиком (yarn-обёртки, `node --watch src/server.ts`, `src/server.ts`, `next dev`, `next-server`). Чужой `node --watch src/server.ts` из worktree фазы 19 не тронут. `apps/web/AGENTS.md`, созданный `next dev`, удалён без коммита.

Не запускались: `yarn test` и `yarn workspace @dv-lab/api build` (не названы в задании), встроенный браузер (приёмка UI шла `schedule-web.mjs` в обеих темах).

## Отклонения

Нет отклонений от задания. Принятые трактовки:

- Без фильтра по времени переноса: в lessons уходят все moved-вхождения после нового конца, в том числе перенесённые на дату позже выбранного последнего дня, так же как в `cutSeries`. Вариант 20-VERIFICATION «startsAt не позже выбранного дня» не взят.
- Отменённые с временем переноса не переводятся (как `cutSeries`, s13 `cutLessons: []`).

## Важно дальше

- Буква D-16 «End series только ставит `ends_on`» теперь неточна: End series ещё вставляет строки `lessons` для перенесённых вхождений после нового конца (как перенос серии). Уточнить `20-CONTEXT.md` D-16 и снять пробел SC3/SCHED-05 в 20-VERIFICATION повторной верификацией — за оркестратором.
- Тексты подсказки End series поменялись: в список Design dude (20-08, EndSeriesDialog).
- Повторный End series той же серии с более ранним `lastOn` не дублирует уроки: исключения, переведённые первым окончанием, лежат за прежним `ends_on`, и хвост их не видит.

## Self-Check: PASSED

- `ee9e9b8` есть в `git log`; все шесть изменённых файлов на месте.
