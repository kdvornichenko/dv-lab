---
phase: 20-schedule
plan: 01
subsystem: db
status: complete
tags: [drizzle, postgres, schema, migration, schedule]
requires: []
provides:
  - "таблицы lesson_series, lesson_exceptions, lessons (schema.ts: lessonSeries, lessonExceptions, lessons)"
  - "миграция 20261010075813_schedule в dvlab_dev и dvlab_test"
  - "scripts/dev-checks/schedule-db.mjs (режимы catalog и migrate)"
  - "node_modules в worktree (yarn install --immutable)"
affects: [20-02, 20-03, 20-04, 20-06, 21, 24, 25]
tech-stack:
  added: []
  patterns:
    - "ключ вхождения серии — PK lesson_exceptions (series_id, original_on)"
    - "пустая серия через CHECK ends_on >= starts_on - 1 вместо удаления строки"
key-files:
  created:
    - packages/db/drizzle/20261010075813_schedule/migration.sql
    - packages/db/drizzle/20261010075813_schedule/snapshot.json
    - scripts/dev-checks/schedule-db.mjs
  modified:
    - packages/db/src/schema.ts
decisions:
  - "Postgres 18 отдаёт нарушение FK ON DELETE RESTRICT кодом 23001 (restrict_violation), а не 23503: проба удаления карточки с серией ждёт 23001; api-планам ловить 23001 для RESTRICT"
  - "Проба «moved без starts_at» идёт без времени и без длительности, проба «starts_at без duration_minutes» — на kind cancelled, чтобы каждая ловила своё условие lesson_exceptions_moved_ck"
metrics:
  duration: "~25 мин"
  completed: 2026-10-10
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: 8fee7469328c7247a0225c490ddeb6c2a5a9971a
plan_head_after: dbc141d6b68984e7083e7bbb732c98f64c820d1a
---

# Phase 20 Plan 01: Схема расписания Summary

Три таблицы расписания на Drizzle v1 (серия, исключения с ключом вхождения (series_id, original_on) и видами cancelled | moved | restored, одиночные уроки) одной сгенерированной миграцией `20261010075813_schedule`, применённой к dvlab_dev и dvlab_test; инварианты, FK RESTRICT и права dvlab_app проверяет `schedule-db.mjs`.

## Задачи

| Задача | Что сделано | Коммит |
|---|---|---|
| 1 (tracer) | `yarn install --immutable` (yarn.lock и .yarnrc.yml не изменились); `lessonSeries`, `lessonExceptions`, `lessons` в schema.ts; `db:generate --name schedule`; `schedule-db.mjs` | dbc141d |
| 2 [BLOCKING] | `schedule-db.mjs migrate` против dvlab_dev и dvlab_test, журнал равен папкам | без изменений файлов |

Миграция сгенерирована командой и руками не правилась: три `CREATE TABLE`, четыре индекса (`lesson_exceptions_moved_idx` частичный `WHERE "kind" = 'moved'`), три FK `ON DELETE RESTRICT`; нет DROP, RENAME, CREATE EXTENSION, колонки зоны нет. drizzle-kit rc.4 не пишет явный `NOT NULL` у колонок составного PK `lesson_exceptions` (`series_id`, `original_on`): его даёт сам PRIMARY KEY.

## Проверки

| Команда | Результат |
|---|---|
| `yarn install --immutable` | код 0, только предупреждения peer-зависимостей |
| `yarn workspace @dv-lab/db typecheck` | код 0 |
| `yarn workspace @dv-lab/db test` | 2 файла, 21 тест, все прошли |
| `node scripts/dev-checks/schedule-db.mjs migrate` (задача 1 и повторно задача 2) | `.env dvlab_dev 4 4`, `.env.test dvlab_test 4 4`, `MIGRATE_OK` |
| `node scripts/dev-checks/schedule-db.mjs catalog` | `SCHEDULE_DB_OK` (строки ниже) |
| `yarn workspace @dv-lab/db db:generate` | `No schema changes, nothing to migrate`, папок 4 |
| `grep -n "mode: 'date'" packages/db/src/schema.ts` | совпадений нет |
| `grep -n "time_zone" packages/db/drizzle/*_schedule/migration.sql` | совпадений нет |
| `yarn prettier --check` по файлам плана | чисто после `--write` |

Вывод `catalog`:

```
PASS migration file 20261010075813_schedule folders 4
PASS probe series starts_on on a wrong weekday: 23514 lesson_series_starts_on_ck
PASS probe series ends_on = starts_on - 1: ok
PASS probe series ends_on = starts_on - 2: 23514 lesson_series_ends_on_ck
PASS probe series start_time with seconds: 23514 lesson_series_start_time_ck
PASS probe series duration 10: 23514 lesson_series_minutes_ck
PASS probe moved exception without starts_at: 23514 lesson_exceptions_moved_ck
PASS probe starts_at without duration_minutes: 23514 lesson_exceptions_moved_ck
PASS probe cancelled exception keeps moved time as history: ok
PASS probe restored exception without time: ok
PASS probe exception kind skipped: 23514 lesson_exceptions_kind_ck
PASS probe second exception for the same occurrence: 23505 lesson_exceptions_pk
PASS probe lesson status done: 23514 lessons_status_ck
PASS probe delete a card that has a series: 23001 lesson_series_student_id_students_id_fkey
PASS privileges dvlab_app select insert update delete, no truncate
SCHEDULE_DB_OK
```

Пробы идут в `begin; …; rollback;` с вымышленной карточкой `Alex Example 2001`; после проб скрипт проверяет, что таких карточек в dvlab_test 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Код нарушения FK RESTRICT в Postgres 18 — 23001**
- **Found during:** задача 1, первый запуск `catalog`
- **Issue:** план ждал 23503 при удалении карточки с серией; Postgres 18 для `ON DELETE RESTRICT` отдаёт 23001 (restrict_violation), удаление при этом запрещено
- **Fix:** проба ждёт 23001 и печатает имя FK
- **Files modified:** scripts/dev-checks/schedule-db.mjs
- **Commit:** dbc141d

**2. [Rule 1 - Bug] Пробы moved_ck разведены по условиям**
- **Found during:** задача 1, написание проб
- **Issue:** проба «moved без starts_at» с длительностью 60 падала бы и на правиле пары, а «starts_at без duration» на kind moved — на обоих условиях, то есть ни одна не проверяла своё условие отдельно
- **Fix:** «moved без starts_at» — без времени и без длительности; «starts_at без duration_minutes» — на kind cancelled
- **Files modified:** scripts/dev-checks/schedule-db.mjs
- **Commit:** dbc141d

Отметка о рабочем процессе: леджер коммитов и sentinel из промпта исполнителя не запускались (хук изоляции запрещает переменные и `$(...)`), вместо них `scripts/gsd/root-pin.sh` перед правкой и коммитом; `commits` в frontmatter посчитан по `git log` (dbc141d и коммит этого SUMMARY).

## Важно следующим планам

- node_modules стоит, `node_modules/.yarn-state.yml` есть.
- dvlab_dev и dvlab_test на 4 миграциях; новых миграций в волне 1 нет.
- api-планам (20-04, 20-06): удаление строки, на которую ссылается RESTRICT-FK, даёт 23001, не 23503.
- `lesson_exceptions.starts_at` и `duration_minutes` у cancelled и restored могут быть заданы (история переноса); читатели берут время только у moved.

## Known Stubs

Нет.

## Self-Check: PASSED

- FOUND: packages/db/src/schema.ts, packages/db/drizzle/20261010075813_schedule/migration.sql, packages/db/drizzle/20261010075813_schedule/snapshot.json, scripts/dev-checks/schedule-db.mjs
- FOUND: dbc141d
