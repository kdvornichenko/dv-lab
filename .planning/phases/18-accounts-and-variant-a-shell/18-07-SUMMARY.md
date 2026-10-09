---
phase: 18-accounts-and-variant-a-shell
plan: 07
subsystem: auth
tags: [bootstrap, accounts, advisory-lock, tsdown, postgres]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-01 контракт (normalizeLogin, isTeacherLogin, пределы пароля), 18-02 схема accounts и помощник 18-sql.mjs, 18-04 hashPassword и generatePassword"
provides:
  - "apps/api/src/auth/accounts.ts: createTeacher(db, { login, displayName, passwordHash }) с исходами created и teacher_exists, violatesUnique(error, constraint)"
  - "apps/api/dist/bootstrap-teacher.mjs: CLI первого учителя под ролью приложения (--email, --name, --password-stdin)"
affects: [18-10, 18-15, 18-16]

tech-stack:
  added: []
  patterns:
    - "Разбор нарушений уникальности (код 23505 и имя ограничения по цепочке cause до 5 уровней) живёт только в auth/accounts.ts"
    - "Точка входа CLI читает process.env один раз и печатает пароль только при генерации"

key-files:
  created:
    - apps/api/src/auth/accounts.ts
    - apps/api/src/bootstrap-teacher.ts
  modified:
    - apps/api/tsdown.config.ts

key-decisions:
  - "createTeacher возвращает только логин созданного учителя, отображения строки в AccountSummary нет (D5: оно одно, в account-rows.ts плана 18-06)"
  - "Ключ advisory-блокировки hashtext('dvlab_bootstrap_teacher'); при активном учителе вставка не выполняется, индекс accounts_one_active_teacher_uq остаётся запасным барьером и тоже даёт teacher_exists"
  - "Ошибка скрипта печатается как Bootstrap failed плюс пятизначный код Postgres из цепочки cause, если он есть; текст ошибки и URL не выводятся"

requirements-completed: [ACCT-01, ACCT-05]

actuals:
  tokens: 5500
  tasks: 2
  commits: 2

duration: 20min
completed: 2026-10-09
status: complete
plan_head_before: 6cda5237db332ac61d67889fd4541612b3fc4062
plan_head_after: 99f7e5d8212634a2449caadf02f0bda4542339af
commits: 2
---

# Phase 18 Plan 07: Первый учитель и модуль учётных записей Summary

**Собранный `dist/bootstrap-teacher.mjs` создаёт единственного активного учителя под ролью `dvlab_app` (пароль 12 символов печатается один раз либо берётся из `--password-stdin`), безопасен к повтору и гонке благодаря advisory-блокировке транзакции и частичному уникальному индексу, а `violatesUnique` и `createTeacher` лежат в `apps/api/src/auth/accounts.ts`.**

## Accomplishments

- `apps/api/src/auth/accounts.ts`: `violatesUnique` проходит `cause` до пяти уровней и сверяет `code === '23505'` и `constraint`; `createTeacher` в транзакции берёт `pg_advisory_xact_lock(hashtext('dvlab_bootstrap_teacher'))`, проверяет наличие активного учителя, вставляет строку и возвращает `{ kind: 'created', login }` или `{ kind: 'teacher_exists' }` (в том числе при нарушении `accounts_one_active_teacher_uq`). Ключа `code` в результатах нет.
- `apps/api/src/bootstrap-teacher.ts`: точка входа без экспортов; `parseArgs` с `--email`, `--name`, `--password-stdin`; логин проходит `normalizeLogin` и `isTeacherLogin`, имя `normalizeDisplayName` и длину 1..80; пароль stdin (без одного завершающего перевода строки) 10..128 символов. Отказ аргументов: `Usage: bootstrap-teacher --email <email> --name <name> [--password-stdin]` в stderr, код 2, до подключения к базе. Активный учитель есть: `An active teacher already exists`, код 3. Иная ошибка: `Bootstrap failed` и код Postgres, код 1. База: `createDb(resolveDatabaseUrl('app', process.env))`, пул закрывается в `finally`.
- `apps/api/tsdown.config.ts`: третья точка `bootstrap-teacher`; `apps/api/dist/bootstrap-teacher.mjs` собирается, `@dv-lab/*` вшиты в бандл (в файле нет строки `@dv-lab/`).
- Dockerfile api не менялся и копирует `apps/api/dist` целиком (`git diff --quiet` чисто, строка `COPY --from=builder /repo/apps/api/dist ./apps/api/dist` на месте): скрипт попадает в образ сам.
- Предположение A5 подтверждено: `pg_advisory_xact_lock` доступна `dvlab_app` без грантов (гонка ниже прошла под ролью приложения).

## Проверки (вывод разового скрипта `18-07-bootstrap.mjs`, dvlab_test, без паролей)

`yarn workspace @dv-lab/api typecheck` и `yarn workspace @dv-lab/api build` завершились кодом 0 после каждой задачи. `yarn prettier --check --config .prettierrc.json` по трём файлам чисто. Скрипт запускает собранный `dist/bootstrap-teacher.mjs` через spawn с `--env-file=.env.test`, `NODE_ENV=test` и env без `DATABASE_URL` и `MIGRATOR_DATABASE_URL`; логины и имена вымышленные (`teacher@example.test`, `Test Teacher`); SQL идёт через `18-sql.mjs`.

После задачи 1 (`node 18-07-bootstrap.mjs 1`): 11 строк PASS (код 0, одна строка `Password (shown once):`, 12 символов алфавита, пароль в stdout один раз, stderr пуст, роль teacher, логин в нижнем регистре, `verifyPassword` печатаемого пароля против хэша из базы true), `BOOTSTRAP_OK`.

После задачи 2 (полный прогон, итоговый вывод):

```
PASS teachers deactivated before checks ({"rowCount":0})
PASS part1 exit code 0 (code 0)
PASS part1 login line printed in lower case
PASS part1 exactly one password line (lines 1)
PASS part1 password has 12 chars of the generation alphabet (length 12)
PASS part1 password appears once in stdout
PASS part1 stderr empty
PASS part1 one row, role teacher, active
PASS part1 login stored in lower case
PASS part1 stored hash verifies the printed password
PASS part1 stored hash rejects another password
PASS part2.1 repeat exit code 3 (code 3)
PASS part2.1 repeat stderr text
PASS part2.1 repeat prints no password
PASS part2.1 one active teacher (n 1)
PASS part2.2 race exit codes are one 0 and one 3 (codes 0,3)
PASS part2.2 race left one active teacher (n 1)
PASS part2.3 stdin exit code 0 (code 0)
PASS part2.3 no Password (shown once) line
PASS part2.3 supplied password not echoed
PASS part2.3 created line printed
PASS part2.3 stored hash verifies the supplied password
PASS part2.4 no --email: exit code 2 without a database (code 2)
PASS part2.4 no --email: usage in stderr
PASS part2.4 email without @: exit code 2 without a database (code 2)
PASS part2.4 email without @: usage in stderr
PASS part2.4 empty --name: exit code 2 without a database (code 2)
PASS part2.4 empty --name: usage in stderr
PASS part2.4 5 char stdin password: exit code 2 without a database (code 2)
PASS part2.4 5 char stdin password: usage in stderr
PASS part2.4 unknown flag: exit code 2 without a database (code 2)
PASS part2.4 unknown flag: usage in stderr
PASS part2.4 refusals added no rows (before 3 after 3)
PASS part2.5 direct second active teacher rejected ({"code":"23505","constraint":"accounts_one_active_teacher_uq"})
PASS part2.6 teacher created again after deactivation (code 0)
PASS part2.7 first active student login inserted
PASS part2.7 duplicate active login rejected ({"code":"23505","constraint":"accounts_active_login_uq"})
PASS part2.7 login can be taken after deactivation
PASS part2.8 violatesUnique true for the same constraint through the cause chain
PASS part2.8 violatesUnique false for another constraint
PASS part2.8 violatesUnique false for code 23503
PASS part2.8 violatesUnique false for a non-error
PASS cleanup: no active teacher left (n 0)
BOOTSTRAP_OK
```

Отказы аргументов запускались без `--env-file` и без `DATABASE_URL`: код 2 вместо 1 доказывает, что база и конфигурация не трогались. Гонка идёт с двумя разными логинами, чтобы различать результат блокировкой и индексом, а не уникальностью логина. Путь сбоя: запуск собранного скрипта без `DATABASE_URL` печатает `Bootstrap failed` (код 1) без текста ошибки и URL.

В конце скрипт деактивирует учителей и удаляет свои строки (логины `teacher*@example.test` и `v1807.*`) ролью migrator: в dvlab_test после прогона нет активного учителя и нет строк плана.

Acceptance-проверки:
- `git grep --untracked -n "process.env" -- apps/api/src`: только `server.ts`, `migrate.ts`, `bootstrap-teacher.ts`.
- `grep "AccountSummary" apps/api/src/auth/accounts.ts`: 0 совпадений (D5).
- Комментариев в трёх файлах нет (единственное `//` в tsdown.config.ts принадлежит регулярному выражению `/^@dv-lab\//`).
- `git grep -n "code: " -- apps/api/src`: три строки в `lifecycle.ts` и `request-context.ts` (типы параметров и сигнатура `errorBody` из фазы 17), в файлах этого плана ключа `code:` нет. Критерий плана «только request-context.ts» не совпадает с состоянием кода фазы 17: `lifecycle.ts` с `close: (code: number, ...)` и `exit: (code: number)` это типы, не ключи результата.

## Task Commits

1. **Задача 1: скрипт создания первого учителя и модуль учётных записей** - `f1e5946` (feat)
2. **Задача 2: безопасность к повтору и гонке, пароль из stdin, отказы аргументов** - `99f7e5d` (feat)

## Decisions Made

- Пароль stdin: убирается один завершающий `\r?\n`; длина считается `passwordLength` (кодовые точки), пределы берутся из `@dv-lab/contracts`.
- Имя длиннее 80 кодовых точек отвергается тем же кодом 2, что и логин не-e-mail: границы совпадают с CHECK `accounts_display_name_ck`.
- Проверка на существование активного учителя идёт внутри блокировки; частичный индекс остаётся независимым барьером (прямая вставка отвергается проверкой 2.5).

## Deviations from Plan

### Auto-fixed Issues

**1. [Дисциплина плана] Коммиты задач вместо «Не коммитить»**
- **Found during:** обе задачи
- **Issue:** действия задач заканчиваются «Не коммитить», общие правила фазы 18 требуют атомарный коммит каждой задачи.
- **Fix:** по коммиту на задачу, пути явные.
- **Commits:** `f1e5946`, `99f7e5d`

**2. [Rule 3 - Среда] Часть 1 скрипта запускается отдельным аргументом**
- **Found during:** задача 1
- **Issue:** `<automated>` задачи 1 вызывает скрипт без аргументов, но часть 2 до задачи 2 заведомо не пройдёт.
- **Fix:** тот же скрипт принимает аргумент `1` (только часть 1); без аргумента выполняются обе части, как в задаче 2.

**3. [Форматирование] Prettier переставил импорты в accounts.ts**
- **Fix:** `drizzle-orm` стоит выше `@dv-lab/*` по порядку `importOrder`, логика не менялась.

Других отклонений нет.

## Known Stubs

None.

## Threat Flags

None: новых сетевых точек и путей аутентификации нет, скрипт использует роль приложения и существующие таблицы.

## Issues Encountered

- Хук изоляции worktree отклонил составные команды (`git ... ; echo`, `$?`): проверки запускались отдельными простыми командами.

## User Setup Required

None.

## Next Phase Readiness

- 18-10 добавляет в `auth/accounts.ts` учеников и смену пароля, а в `bootstrap-teacher.ts` режим `--reset-password` (по решению планировщика он перенесён из 18-07); `violatesUnique` готов для `accounts_active_login_uq`.
- 18-15 (ручной список): повторить отказ второго учителя на dvlab_dev; 18-16 добавляет сервис compose и строки RUNBOOK, проверка журнала контейнера `--rm` (A6) остаётся за оператором.
- `dist` в apps/api собран актуальным кодом на момент завершения плана; параллельный 18-06 может пересобирать его позже.

## Self-Check: PASSED

- Файлы на диске: `apps/api/src/auth/accounts.ts`, `apps/api/src/bootstrap-teacher.ts`, `apps/api/dist/bootstrap-teacher.mjs` найдены; `apps/api/tsdown.config.ts` содержит `bootstrap-teacher`.
- Коммиты `f1e5946` и `99f7e5d` есть в `git log`; в диапазоне `6cda523..HEAD` лежит и чужой коммит `5499523` (docs 18-08), поэтому `commits: 2` посчитан по фильтру `(18-07)`.
- Не запускались: `yarn lint` (у api нет скрипта), `yarn knip` (ожидаемо красный до 18-16), тесты api (план их не затрагивает, новые тесты запрещены директивой владельца).

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-09*
