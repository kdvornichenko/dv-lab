---
phase: 21-lesson-accounting-and-today
plan: 01
subsystem: db
status: complete
tags: [drizzle, migrations, lesson_marks, teacher_settings, ledger]
requires: []
provides:
  - "таблица lesson_marks (ключ series_id + original_on или lesson_id, kind done | no_show | none)"
  - "колонка students.no_show_deducts boolean not null default true"
  - "таблица teacher_settings (account_id pk, pays_soon_lessons 0..20 без DEFAULT)"
  - "scripts/dev-checks/ledger-db.mjs (catalog, migrate)"
affects: [21-02, 21-04, 21-05, 21-07, 21-12]
tech-stack:
  added: []
  patterns:
    - "custom-миграция REVOKE DELETE, TRUNCATE у dvlab_app для таблиц истории"
    - "обычные (не частичные) уникальные индексы по nullable-ключам, upsert без targetWhere"
key-files:
  created:
    - packages/db/drizzle/20261010145713_lesson_marks/migration.sql
    - packages/db/drizzle/20261010145713_lesson_marks/snapshot.json
    - packages/db/drizzle/20261010145724_lesson_marks_revoke_delete/migration.sql
    - packages/db/drizzle/20261010145724_lesson_marks_revoke_delete/snapshot.json
    - scripts/dev-checks/ledger-db.mjs
  modified:
    - packages/db/src/schema.ts
    - scripts/dev-checks/schedule-db.mjs
decisions:
  - "Проба удаления урока или серии с отметкой ждёт 23001 (restrict_violation), а не 23503: так Postgres 18 отвечает на ON DELETE RESTRICT; schedule-db.mjs ждёт тот же код"
  - "Проба teacher_settings создаёт деактивированный аккаунт учителя внутри транзакции, чтобы не задеть индекс единственного активного учителя"
metrics:
  duration: "15 мин"
  completed: 2026-10-10
actuals:
  tokens: 29500
  tasks: 2
  commits: 1
plan_head_before: 11bf4badd3305550113744f89d98814c6f2c0634
plan_head_after: 0e97c01
---

# Фаза 21, план 01: хранение учёта уроков

Добавил таблицу отметок вхождений `lesson_marks` с ключом вхождения (серия и дата либо одиночный урок), флаг `students.no_show_deducts` и таблицу `teacher_settings` с порогом Pays soon. Это две миграции drizzle-kit: добавляющая и custom с отзывом DELETE и TRUNCATE. Обе применены к dvlab_dev и dvlab_test, журнал совпадает с папками (7).

## Задачи

| Задача | Что сделано | Коммит |
|--------|-------------|--------|
| 1 | `yarn install --immutable` (yarn.lock не изменился), схема, две миграции, `ledger-db.mjs`, `EXPECTED_FOLDERS` 5 → 7 в `schedule-db.mjs` | 0e97c01 |
| 2 [BLOCKING] | миграции применены к dvlab_dev и dvlab_test, флаг на всех карточках dev | без коммита: файлы не менялись |

## Папки миграций (для «Для выката» в 21-12)

- `20261010145713_lesson_marks`: `CREATE TABLE "lesson_marks"`, `CREATE TABLE "teacher_settings"`, `ALTER TABLE "students" ADD COLUMN "no_show_deducts" boolean DEFAULT true NOT NULL`, два уникальных индекса, три внешних ключа `ON DELETE RESTRICT`
- `20261010145724_lesson_marks_revoke_delete`: `REVOKE DELETE, TRUNCATE ON "lesson_marks" FROM "dvlab_app";`

Повторный `yarn workspace @dv-lab/db db:generate` выводит `No schema changes, nothing to migrate`.

## Проверки

- `yarn install --immutable`: код 0, `node_modules/.yarn-state.yml` есть, `git status` не показал изменений `yarn.lock` и `.yarnrc.yml`.
- `yarn workspace @dv-lab/db typecheck`: код 0.
- `yarn workspace @dv-lab/db test`: 2 файла, 21 тест, все прошли. Тесты очищают только `app_info`.
- `node scripts/dev-checks/ledger-db.mjs migrate` (дважды: в задаче 1 и в задаче 2):
  ```
  .env dvlab_dev 7 7
  .env.test dvlab_test 7 7
  MIGRATE_OK
  ```
- `node scripts/dev-checks/ledger-db.mjs catalog`:
  ```
  PASS migration files 20261010145713_lesson_marks 20261010145724_lesson_marks_revoke_delete
  PASS probe series occurrence mark: ok
  PASS probe single lesson mark: ok
  PASS probe mark kind none: ok
  PASS probe mark with both keys: 23514 lesson_marks_ref_ck
  PASS probe mark with no key: 23514 lesson_marks_ref_ck
  PASS probe series_id without original_on: 23514 lesson_marks_ref_ck
  PASS probe original_on without series_id: 23514 lesson_marks_ref_ck
  PASS probe mark kind held: 23514 lesson_marks_kind_ck
  PASS probe second mark for the same occurrence: 23505 lesson_marks_occurrence_uq
  PASS probe second mark for the same lesson: 23505 lesson_marks_lesson_uq
  PASS probe delete a lesson that has a mark: 23001 lesson_marks_lesson_id_lessons_id_fkey
  PASS probe delete a series that has a mark: 23001 lesson_marks_series_id_lesson_series_id_fkey
  PASS probe teacher_settings pays_soon_lessons 21: 23514 teacher_settings_pays_soon_ck
  PASS probe teacher_settings pays_soon_lessons -1: 23514 teacher_settings_pays_soon_ck
  PASS probe teacher_settings pays_soon_lessons 0: ok
  PASS probe teacher_settings pays_soon_lessons 20: ok
  PASS probe teacher_settings without pays_soon_lessons: 23502
  PASS probe second teacher_settings row for the account: 23505 teacher_settings_pkey
  PASS probe new card gets no_show_deducts true: ok
  PASS privileges dvlab_app lesson_marks select insert update, no delete, no truncate
  PASS privileges dvlab_app teacher_settings select insert update
  LEDGER_DB_OK
  ```
  Пробы идут на dvlab_test, каждая одной командой `begin; …; rollback;`. После проб вымышленных карточек и аккаунтов не осталось (0).
- `node scripts/dev-checks/schedule-db.mjs catalog`: `PASS migration files … folders 7`, 13 проб PASS, `SCHEDULE_DB_OK`.
- dvlab_dev: `students where no_show_deducts is distinct from true` = 0. Журнал 7, `lesson_marks` 0 строк, `teacher_settings` 0 строк, у `dvlab_app` нет DELETE на `lesson_marks`. Данные dev план не писал.
- Критерии приёмки: `grep student_id` по `*_lesson_marks/migration.sql` ничего не нашёл, `student_id` нет ни в одной таблице этой миграции. `grep "mode: 'date'"` по `schema.ts` ничего не нашёл (код 1). В `ledger-db.mjs` `schedule-db.mjs` встречается 1 раз, `migrate.ts` 0 раз.
- `yarn prettier --check` по изменённым файлам: без замечаний.

Объём (chars/4 по диффу коммита 0e97c01): около 29500 токенов, из них около 26700 приходится на два сгенерированных `snapshot.json`.

## Не запускалось

- `yarn test` в корне и сборка api: план их не называет, параллельные исполнители работают с `dvlab_test`. Запускался только `yarn workspace @dv-lab/db test`: его называет `<verify>` плана, и он очищает только `app_info`.

## Отклонения от плана

**1. [Правило 1, ошибка в плане] Код пробы удаления с отметкой: 23001 вместо 23503**
- **Задача:** 1
- **Что:** план ждёт 23503 на удаление урока с отметкой. Postgres 18 отвечает на `ON DELETE RESTRICT` кодом 23001 (restrict_violation), как и в пробе `delete a card that has a series` в `schedule-db.mjs`.
- **Решение:** проба ждёт 23001. Добавил такую же пробу для удаления серии с отметкой. Инвариант тот же: удалить урок или серию с отметкой база не даёт.
- **Файл:** `scripts/dev-checks/ledger-db.mjs`, коммит 0e97c01.

Кроме плана добавлены пробы `mark kind none` (ok) и `original_on without series_id` (23514).

## Для следующих планов

- 21-02 и 21-03: `node_modules/.yarn-state.yml` создан.
- 21-04, 21-05, 21-07: таблицы и колонка есть в dvlab_dev и dvlab_test. Upsert отметки серии: `target: [lessonMarks.seriesId, lessonMarks.originalOn]`, одиночного урока: `target: lessonMarks.lessonId`, оба без `targetWhere`. У `pays_soon_lessons` нет DEFAULT в базе: модуль settings всегда пишет явное значение, а при отсутствии строки берёт `PAYS_SOON_LESSONS_DEFAULT` из core.
- Импорт vault (Pitfall 7): `no_show_deducts` — NOT NULL с DEFAULT true. Вставка без колонки проходит, но тип insert в Drizzle теперь включает `noShowDeducts`.
- Экспорты `lessonMarks` и `teacherSettings` из `schema.ts`. `packages/db/src/index.ts` не менял: схема уходит наружу так же, как раньше.

## Known Stubs

Нет.

## Threat Flags

Нет. Угрозы T-21-01..T-21-04 закрыты так, как требует план: REVOKE, внешние ключи RESTRICT, CHECK, уникальные индексы, все пробы через `sql.mjs`.

## Self-Check: PASSED

- FOUND: packages/db/drizzle/20261010145713_lesson_marks/migration.sql
- FOUND: packages/db/drizzle/20261010145724_lesson_marks_revoke_delete/migration.sql
- FOUND: scripts/dev-checks/ledger-db.mjs
- FOUND: коммит 0e97c01
