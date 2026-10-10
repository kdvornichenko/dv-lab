---
phase: 20-schedule
plan: 10
subsystem: verification
tags: [agents-md, knip, privacy, ci-boundaries, acceptance]
requires: [20-01, 20-02, 20-03, 20-04, 20-05, 20-06, 20-07, 20-08, 20-09, 20-TP]
provides: владельцы расписания в AGENTS.md, зелёный полный прогон монорепозитория, приёмка api и core
affects: [21, 24]
key-files:
  modified:
    - AGENTS.md
    - knip.json
status: complete
commits: 2
plan_head_before: 0bc1e1e
plan_head_after: 1d91101
actuals:
  tokens: 1100
  tasks: 2
  commits: 2
---

# Phase 20 Plan 10: итоговая проверка фазы Summary

AGENTS.md знает владельцев расписания, полный прогон репозитория (typecheck, lint, test, build со сборкой api, knip) зелёный, миграции синхронны, границы CI и приватность соблюдены, приёмочные скрипты db, core и api зелёные. Задача 3 (ручная приёмка в браузере) выполняется оркестратором и здесь не выполнялась.

## Что сделано

**Задача 1 (0580fea): AGENTS.md.** В пункт `packages/core` добавлены `zoned.ts`, `schedule.ts` и `SCHEDULE_TIME_ZONE`. В «Модули-владельцы» четыре пункта: правило вхождений и всё, что принадлежит `packages/core` (`occurrenceAt`, `canChange`, `cutSeries`, `endSeriesAt`, `windowDates`); модуль `apps/api/src/schedule` (`rows.ts`, `lockSeries`, `lockLesson`, `FOR UPDATE`, 409 `lesson_changed`, 400 `series_ends_before_new_day`, без удалений); `cards/card-facts.ts`; web (`schedule-format.ts`, `time-zones.ts`, `mutate`, `time-pair.tsx`, вторая зона только в `localStorage`, дизайн расписания и токен `selected`). В «База»: таблицы расписания, ключ исключения, `ON DELETE RESTRICT`, пустая серия, предупреждение для фазы 24 про стабильность ключа вхождения («стабилен только для прошлых вхождений и для серии после её последнего разреза»). В «Помощники для агентов»: скрипты `schedule-*.mjs` и `wait-dev.mjs`. Проверки: `grep -c` по `apps/api/src/schedule`, `card-facts`, `SCHEDULE_TIME_ZONE`, `schedule-web.mjs`, `time-zones.ts`, `cutSeries`, `последнего разреза` печатают по 1; слова «раньше|было|планировали|теперь» не найдены (код 1).

**Задача 2 (1d91101): полный прогон.** Единственная правка по итогам прогона: `knip.json`, корневой workspace, `ignoreDependencies: ["pg"]`. Knip был красным из-за `Unlisted dependencies: pg` в `scripts/dev-checks/sql.mjs`; файл пришёл до фазы 20 (коммит общих скриптов исполнителя), `pg` он берёт через `createRequire` из `packages/db`. Поведение скрипта не менялось, `yarn install` не запускался.

## Результаты

| Проверка | Результат |
| --- | --- |
| `yarn typecheck` | код 0, 5 пакетов |
| `yarn lint` | код 0 |
| `yarn test` | код 0: contracts 48 тестов, db 21, api 47, все зелёные (сборка идёт зависимостью turbo) |
| `yarn build` | код 0, web собран, маршруты `/schedule`, `/students`, `/students/[id]` |
| `yarn workspace @dv-lab/api build` | код 0, `dist/server.mjs`, `migrate.mjs`, `bootstrap-teacher.mjs`, `import-vault.mjs` на месте |
| `yarn knip` | красный до правки (`pg` в sql.mjs), после правки код 0; 18 подсказок конфигурации («Remove from ignore», «redundant entry») остались, это предупреждения до фазы 20 и на код возврата не влияют |
| `yarn db:generate` | «No schema changes, nothing to migrate», `git status --porcelain -- packages/db/drizzle` пуст |
| Шаги CI `Web and api boundary` и `Client address trust` | `CI_STEPS_OK` (шаги выполнены дословно из ci.yml одним разовым скриптом) |
| Приватность | `PRIVACY_OK files=403` (файлы ветки от merge-base с master плюс незакоммиченные, без ROADMAP, REQUIREMENTS и 20-CONTEXT; список имён `~/.claude/private/student-names.txt`) |
| `schedule-db.mjs catalog` | `SCHEDULE_DB_OK` |
| `schedule-core.mjs` | `CORE_OK` |
| `schedule-api.mjs read` | `SCHEDULE_API_READ_OK` |
| `schedule-api.mjs next` | `SCHEDULE_API_NEXT_OK` |
| `schedule-api.mjs changes` | `SCHEDULE_API_CHANGES_OK` (OCCURRENCE_OK, SINGLE_OK, SERIES_OK, число строк по 24 замерам не убывало) |

Гейты: `@radix-ui|radix-ui|cmdk` в `apps/web` не найдено (код 1); `teaching breaks|gcal-event` в `apps` и `packages` не найдено (код 1); `.delete(` в `apps/api/src/schedule` не найдено; сравнения с `now` в `apps/api/src/schedule` не найдены; `slice(0, 5)` только в `rows.ts`; `matchesTimeZone` и `utcOffset` определены только в `apps/web/lib/time-zones.ts`; комментариев в файлах фазы нет (список из плана плюс `schedule-mutations.ts`, `time-zones.ts`, `time-pair.tsx`).

## Приватность

Имён учеников, адресов серверов и секретов в файлах фазы нет: сканер выдал 0 совпадений, в тексте этого SUMMARY только счётчики и хеши. Фикстуры скриптов приёмки названы `Alex Example NNNN`, `schedule-api.mjs` убирает их сам («fixture tails removed 0» при последнем запуске).

## Ручная приёмка за оркестратором

Задача 3 плана (dev-стек, десять запусков `schedule-web.mjs fade|frame|read|changes|students` в светлой и тёмной теме и ручная сверка в браузере) в этом прогоне не выполнялась. Порты 3000, 4000, 4201 и 4202 свободны, dev-стек исполнителем не поднимался. Чек-лист пяти критериев ROADMAP (значения PASS и FAIL, наблюдения и пути скриншотов в STATE_DIR вписывает оркестратор):

| Критерий | Требования | Результат |
| --- | --- | --- |
| 1. SCHED-01 | одиночный урок и серия из New lesson и пустой клетки; вхождения серии на трёх неделях подряд, стрелки и Today | ручная приёмка за оркестратором |
| 2. SCHED-02 | перенос и отмена одного вхождения меняют только его; после переноса серии перенесённое вхождение остаётся на своём времени (D-04) | ручная приёмка за оркестратором |
| 3. SCHED-03, SCHED-05 | перенос серии меняет только будущие недели; End series у серии с прошлыми вхождениями не меняет прошлые недели | ручная приёмка за оркестратором |
| 4. SCHED-04 | Вьетнам по умолчанию, вторая зона слева в гаттере и под временем (D-19: MSK слева, VN справа), None, зона с летним временем; при зоне браузера America/New_York круг сегодня, края недели и линия «сейчас» по Вьетнаму | ручная приёмка за оркестратором |
| 5. CARD-04 | вкладки Active и Archived, поиск, остаток и Next lesson | ручная приёмка за оркестратором |

Пункты 6-8 задачи 3 (backstop UI-SPEC, сверка с артефактом v23 и «Amendments» v25 по D-19, серия на сегодня и повторное Add series) и очистка фикстур `Alex Example 20%` (`sql.mjs .env migrator`, ожидается n = 0) тоже за оркестратором. Фазе до этих пунктов остаётся статус human_needed.

## Для выката

1. Откат релиза кодом безопасен: таблицы расписания остаются, старый код их не читает.
2. Восстановление базы из дампа до выката теряет всё расписание, созданное после выката: делать только осознанно.
3. После деплоя проверить авторизованный `GET /api/schedule/week` текущего понедельника (200 и JSON с `blocks`); строку передать Server guy для его чек-листа.

## Deviations from Plan

**1. [Rule 3 - Blocking] knip: `pg` в `scripts/dev-checks/sql.mjs`.** Найдено на задаче 2. Файл вне `files_modified` плана и вне кода фазы 20; правка в `knip.json` (`ignoreDependencies` корневого workspace), а не добавление `pg` в корневой `package.json`, потому что последнее требует `yarn install`, а план его не называет. Коммит 1d91101.

**2. Задача 3 не выполнялась по указанию оркестратора** (ручная приёмка в браузере за ним), поэтому десять запусков `schedule-web.mjs` в этом плане не шли; их последний зелёный прогон обеих тем записан в `20-TP-SUMMARY.md`.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности: изменены AGENTS.md и конфигурация knip.

## Self-Check: PASSED

- AGENTS.md и knip.json изменены, `git status` чист по файлам плана, `apps/web/AGENTS.md` не создавался.
- Коммиты 0580fea и 1d91101 есть в `git log`.
- Процессов не оставлено: порты 3000, 4000, 4201, 4202 пусты; чужой turbo фазы 19 не трогался.
