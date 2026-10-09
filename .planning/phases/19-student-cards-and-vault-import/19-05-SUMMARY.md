---
phase: 19-student-cards-and-vault-import
plan: 05
subsystem: database
tags: [drizzle, postgres, schema, migration, students, payments]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: таблицы accounts, sessions, sign_in_throttles и две миграции
  - phase: 19-student-cards-and-vault-import
    provides: 19-01 (рабочая копия с node_modules)
provides:
  - таблицы students, student_sections, student_terms, payments в schema.ts (экспорты students, studentSections, studentTerms, payments)
  - столбец accounts.student_id (accounts.studentId) с FK, accounts_student_uq и accounts_student_role_ck
  - миграция packages/db/drizzle/20261009194959_student_cards, применённая к dvlab_dev и dvlab_test
  - помощник SQL фазы SCRATCH/19-sql.mjs
affects: [19-02, 19-07, 19-08, 19-09, 19-10, 19-12, 19-13, 19-14]

actuals:
  tokens: 12000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns: [date в строковом режиме, numeric(7,2) в строковом режиме, именованный составной primaryKey, уникальный индекс по выражению lower(term)]

key-files:
  created:
    - packages/db/drizzle/20261009194959_student_cards/migration.sql
    - packages/db/drizzle/20261009194959_student_cards/snapshot.json
  modified:
    - packages/db/src/schema.ts

key-decisions:
  - "FK student_sections и student_terms на students — ON DELETE RESTRICT по плану (D-24), а не cascade из RESEARCH"
  - "Индекс students_status_idx из примера RESEARCH не добавлен: его нет в плане"
  - "19-sql.mjs дополнительно отказывает (код 2), если файл с именем .env.test указывает не на базу _test, а .env не на базу _dev"

requirements-completed: [CARD-01, CARD-02, CARD-03, CARD-07, ACCT-04, LEDG-01, LEDG-02, LEDG-09]

plan_head_before: 7444bd0
plan_head_after: ee5bf28

duration: 15min
completed: 2026-10-10
status: complete
---

# Phase 19 Plan 05: Схема карточек, секций, словаря и оплат Summary

**Одна добавляющая миграция student_cards создаёт students, student_sections, student_terms, payments и accounts.student_id; инварианты ставки, остатка, несопоставленных оплат, валюты и привязки аккаунта держит база dvlab_dev и dvlab_test.**

## Performance

- **Duration:** около 15 мин
- **Tasks:** 2
- **Files modified:** 3 (schema.ts, migration.sql, snapshot.json) и этот SUMMARY

## Accomplishments

- schema.ts: импорт `date`, `numeric`, `primaryKey`; таблицы `students`, `studentSections`, `studentTerms`, `payments`; в `accounts` столбец `studentId`, частичный уникальный индекс `accounts_student_uq` и CHECK `accounts_student_role_ck`. Все CHECK из плана с явными именами.
- Миграция `packages/db/drizzle/20261009194959_student_cards` создана `yarn workspace @dv-lab/db db:generate --name student_cards`, руками не правилась; в ней только CREATE TABLE, ADD COLUMN, CREATE INDEX и ADD CONSTRAINT.
- Миграция применена под dvlab_migrator к dvlab_dev и dvlab_test; журнал в обеих базах — 3 записи при 3 папках.
- Помощник `SCRATCH/19-sql.mjs` создан для всех следующих планов фазы.

## Task Commits

1. **Задача 1: схема и миграция student_cards, проверка на dvlab_test** - `ee5bf28` (feat)
2. **Задача 2 [BLOCKING]: миграция в dvlab_dev и dvlab_test** - без коммита (файлы не меняются)

**Plan metadata:** коммит `docs(19-05)` с этим файлом.

## Files Created/Modified

- `packages/db/src/schema.ts` - четыре новые таблицы и ссылка аккаунта на карточку
- `packages/db/drizzle/20261009194959_student_cards/migration.sql` - DDL миграции
- `packages/db/drizzle/20261009194959_student_cards/snapshot.json` - снимок drizzle-kit

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/db typecheck` | без ошибок |
| `yarn workspace @dv-lab/db test` | 2 файла, 21 тест, все прошли |
| `yarn workspace @dv-lab/api typecheck` | без ошибок (api вставляет аккаунты без student_id, столбец nullable) |
| папки `packages/db/drizzle` | 3: `20261009120830_init`, `20261009150610_accounts`, `20261009194959_student_cards` |
| migration.sql | есть `CREATE UNIQUE INDEX "accounts_student_uq"` и `CREATE TABLE "payments"`; совпадений `drop `, `rename `, `create extension` — 0 |
| повторный `db:generate` | `No schema changes, nothing to migrate`, папок по-прежнему 3 |
| `! grep -n "mode: 'date'" packages/db/src/schema.ts` | код 0 (совпадений нет) |
| `yarn prettier --check packages/db/src/schema.ts` | после `--write` чисто |
| `19-05-migrate-test.cjs` (dvlab_test до каталога) | `.env.test dvlab_test 3 3` |
| `19-05-catalog.mjs` | `CATALOG_OK` |
| `19-05-apply-both.cjs` (команда verify задачи 2 дословно) | `.env dvlab_dev 3 3`, `.env.test dvlab_test 3 3`, код 0 |
| dvlab_dev после миграции (роль app) | аккаунтов со student_id — 0, students — 0, payments — 0 |

Вывод `19-05-catalog.mjs`:

```
1 CREATE UNIQUE INDEX accounts_student_uq ON public.accounts USING btree (student_id) WHERE ((student_id IS NOT NULL) AND (status = 'active'::text))
1 CREATE UNIQUE INDEX student_terms_term_uq ON public.student_terms USING btree (student_id, lower(term))
1 CREATE UNIQUE INDEX students_import_key_uq ON public.students USING btree (import_key)
1 CREATE UNIQUE INDEX payments_import_key_uq ON public.payments USING btree (import_key)
1 CREATE INDEX payments_student_paid_idx ON public.payments USING btree (student_id, paid_on)
2 unassigned payment with credited minutes: 23514 payments_unassigned_ck
2 student payment without currency with lessons: 23514 payments_currency_ck
2 negative opening balance: 23514 students_opening_ck
2 rate without currency: 23514 students_rate_ck
2 teacher account linked to a card: 23514 accounts_student_role_ck
2 two active student accounts on one card: 23505 accounts_student_uq
2 deactivated and active student accounts on one card: passes
2 terms Word and word on one card: 23505 student_terms_term_uq
2 section with empty body: passes
2 probe rows after: 0
3 dvlab_app students: delete=true insert=true select=true truncate=false update=true
3 dvlab_app student_sections: delete=true insert=true select=true truncate=false update=true
3 dvlab_app student_terms: delete=true insert=true select=true truncate=false update=true
3 dvlab_app payments: delete=true insert=true select=true truncate=false update=true
CATALOG_OK
```

Пробы шли под migrator, каждая одной командой `begin; …; rollback;`, с вымышленным именем Alex Example 0501 и фиксированными uuid `00000000-0000-4000-8000-0000001905NN`; после проб строк не осталось.

Помощник SQL (`19-05-helper-guard.sh`):

```
refused: database name must end with _dev or _test        (SCRATCH/19-05-foreign.env, app: код 2; migrator: код 2)
refused: .env.test must point to a database ending with _test   (файл .env.test на dvlab_dev: код 2)
refused: .env must point to a database ending with _dev         (файл .env на dvlab_test: код 2)
{"command":"SELECT","rowCount":1,"rows":[{"?column?":1}]}       (.env.test app 'select 1': код 0)
```

Не запускалось: `yarn knip` (ожидаемо красный до 19-19), lint и build (не нужны плану: web не менялся, сборку api план не запускает), тесты apps/api и contracts (их гоняет 19-02 после этого SUMMARY), новые тесты (директива владельца).

## Decisions Made

- Внешние ключи секций и словаря — RESTRICT, как в плане (карточки только архивируются, D-24); RESEARCH предлагал cascade.
- Индекс `students_status_idx` из примера RESEARCH не добавлен: план его не перечисляет.
- В `accounts` новые ограничения стоят первыми в массиве; на SQL это не влияет.

## Deviations from Plan

None - план выполнен как написан. Уточнение помощника: проверка «.env.test → _test, .env → _dev» срабатывает по имени файла (basename), остальные env-файлы проверяются только по суффиксу _dev или _test.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Threat Flags

Нет новой поверхности сверх threat_model плана: T-19-12..T-19-17 закрыты пробами каталога и отказами помощника.

## Next Phase Readiness

- 19-02 может запускать тесты db и api на dvlab_test: миграция уже применена.
- Модуль карточек (19-07) и импорт (19-13) работают с `students`, `studentSections`, `studentTerms`, `payments`, `accounts.studentId` из `@dv-lab/db`.
- `lessons_count` и даты возвращаются строками (`'1.25'`, `'YYYY-MM-DD'`).
- Для `student_terms` конфликт ловится `onConflictDoNothing()` без target: индекс по выражению `lower(term)`.
- Разовый SQL фазы: `node SCRATCH/19-sql.mjs ENV_FILE app|migrator 'SQL'`.
- Аккаунт ученика в dvlab_dev не привязан к карточке (привяжут 19-12 и 19-18).

## Self-Check: PASSED

- Файлы schema.ts, migration.sql и snapshot.json папки `20261009194959_student_cards` существуют.
- Коммит ee5bf28 есть в `git log`.
- Коммиты плана до SUMMARY: 1 (ee5bf28, родитель 7444bd0 — коммит параллельного плана 19-06).

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
