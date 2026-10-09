---
phase: 17-skeleton-on-the-server
plan: 03
subsystem: database
tags: [drizzle, postgres, pg, zod, vitest, turbo, roles, migrations]

requires:
  - phase: 17-skeleton-on-the-server
    provides: "манифест @dv-lab/db с точными версиями, общий yarn.lock, локальные .env и .env.test (план 17-01)"
provides:
  - "packages/db/src/connection.ts: DbRole, resolveDatabaseUrl, createDb, Database — единственный читатель DATABASE_URL и MIGRATOR_DATABASE_URL"
  - "packages/db/src/migrate.ts: migrationsFolder и runMigrations с pg_advisory_lock(hashtext('dvlab_migrations'))"
  - "packages/db/src/schema.ts: таблица app_info"
  - "Первая миграция Drizzle v1: packages/db/drizzle/20261009120830_init/{migration.sql,snapshot.json}"
  - "DB-тесты на dvlab_test под ролями dvlab_app и dvlab_migrator (21 тест)"
  - "Скрипты @dv-lab/db: typecheck, test, db:generate"
  - ".env.example с заглушками; turbo.json globalPassThroughEnv для DATABASE_URL и MIGRATOR_DATABASE_URL"
affects: [17-05, 17-07, 17-08, 17-10, phase-18]

actuals:
  tokens: 3860
  tasks: 2
  commits: 3
plan_head_before: 257b228
plan_head_after: 42897fd25fe687c4225879466fb38b4b8185e8e1

tech-stack:
  added: []
  patterns:
    - "Выбор URL по роли только через resolveDatabaseUrl(role, env); ошибка содержит имя переменной без значения и без cause"
    - "При NODE_ENV=test база обязана оканчиваться на _test, исключения для CI нет"
    - "Миграции под advisory lock на выделенном клиенте пула; migrate() идёт по тому же клиенту"
    - "Тесты чистят данные TRUNCATE под ролью миграций в beforeEach, файлы тестов идут по одному"
    - "vitest.config.ts грузит .env.test через process.loadEnvFile, переменные процесса главнее файла"

key-files:
  created:
    - packages/db/tsconfig.json
    - packages/db/vitest.config.ts
    - packages/db/drizzle.config.ts
    - packages/db/src/index.ts
    - packages/db/src/connection.ts
    - packages/db/src/schema.ts
    - packages/db/src/migrate.ts
    - packages/db/drizzle/20261009120830_init/migration.sql
    - packages/db/drizzle/20261009120830_init/snapshot.json
    - packages/db/test/global-setup.ts
    - packages/db/test/roles.test.ts
    - packages/db/test/connection.test.ts
    - .env.example
  modified:
    - packages/db/package.json
    - turbo.json

key-decisions:
  - "runMigrations выполняет migrate() на том же клиенте, что держит advisory lock: блокировка и миграция в одной сессии, пулу хватает одного соединения"
  - "Заглушка хоста в .env.example записана как host в нижнем регистре: для схемы postgresql: WHATWG URL не приводит хост к нижнему регистру, и проверка плана (hostname === 'host') с HOST не проходит"

requirements-completed: [INFRA-02, INFRA-08]

coverage:
  - id: D1
    description: "Миграция под dvlab_migrator создаёт app_info в dvlab_test, dvlab_app вставляет, читает, меняет и удаляет строку"
    requirement: INFRA-02
    verification:
      - kind: integration
        ref: "packages/db/test/roles.test.ts#app role writes and reads app_info"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveDatabaseUrl: выбор переменной по роли, ошибки с именем переменной без пароля, защита _test при NODE_ENV=test"
    requirement: INFRA-02
    verification:
      - kind: unit
        ref: "packages/db/test/connection.test.ts (12 тестов)"
        status: pass
      - kind: other
        ref: "git grep --untracked -n -E 'env\\.(MIGRATOR_)?DATABASE_URL' -- 'apps/*/src/*' 'packages/*/src/*' (код 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "dvlab_app без superuser, CREATEDB, CREATEROLE, BYPASSRLS; CREATE TABLE, TRUNCATE, чтение журнала миграций и runMigrations дают 42501; pg_trgm доступен; dvlab_migrator не суперпользователь и владеет базой"
    requirement: INFRA-02
    verification:
      - kind: integration
        ref: "packages/db/test/roles.test.ts (app role has no elevated attributes, cannot create tables, cannot truncate app_info, cannot read the migrations journal, uses pg_trgm, cannot run migrations, migrator role ...)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Два одновременных runMigrations под ролью миграций завершаются и возвращают число папок миграций; тесты проходят в случайном порядке"
    requirement: INFRA-02
    verification:
      - kind: integration
        ref: "packages/db/test/roles.test.ts#concurrent migrations both finish with one journal entry per migration folder"
        status: pass
      - kind: other
        ref: "yarn workspace @dv-lab/db test --sequence.shuffle"
        status: pass
    human_judgment: false
  - id: D5
    description: "Новая история миграций: одна папка *_init в формате Drizzle v1, без meta/_journal.json и CREATE EXTENSION; повторный generate ничего не создаёт"
    requirement: INFRA-08
    verification:
      - kind: other
        ref: "yarn workspace @dv-lab/db db:generate (No schema changes); ls -d packages/db/drizzle/*/ = 1; test ! -e meta/_journal.json; ! grep -qi 'create extension'"
        status: pass
    human_judgment: false
  - id: D6
    description: ".env.example только с заглушками, turbo.json пробрасывает переменные базы через globalPassThroughEnv без globalEnv"
    requirement: INFRA-02
    verification:
      - kind: other
        ref: "node-проверка env-контракта из verify задачи 2 (env contract ok); ! grep IP в .env.example; yarn turbo run test --filter=@dv-lab/db"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-09
status: complete
---

# Phase 17 Plan 03: packages/db на Drizzle v1 с модулем ролей подключения Summary

**Пакет `@dv-lab/db` написан заново: `resolveDatabaseUrl` один решает, какой URL берёт роль приложения и роль миграций, первая миграция Drizzle v1 создаёт `app_info`, `runMigrations` идёт под advisory lock, а 21 тест на домашнем PostgreSQL 18.6 доказывает права ролей `dvlab_app` и `dvlab_migrator` и защиту базы `_test`.**

## Performance

- **Duration:** около 5 мин
- **Started:** 2026-10-09T12:07:58Z
- **Completed:** 2026-10-09T12:12:21Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- `connection.ts` (D-06): роль `app` читает `DATABASE_URL`, `migrator` читает `MIGRATOR_DATABASE_URL`; значение проверяет zod 4 (`z.url` со схемой `postgres` или `postgresql`). Ошибка содержит только имя переменной, `cause` не заполняется. При `NODE_ENV=test` база обязана оканчиваться на `_test`. `createDb(url)` даёт `Pool` (`max` 10, `connectionTimeoutMillis` 3000) и `drizzle({ client: pool })` без `schema`.
- `migrate.ts`: `migrationsFolder` вычисляется от `import.meta.url` (`../drizzle`). `runMigrations(url)` берёт клиента, `pg_advisory_lock(hashtext('dvlab_migrations'))`, `migrate()` на том же клиенте, `count(*)::int` из `drizzle.__drizzle_migrations`, снятие блокировки, освобождение клиента и `pool.end()` в `finally`. Ошибки не перехватываются.
- `schema.ts`: `app_info(key text primary key, value text not null, updated_at timestamptz not null default now())`.
- Миграция `drizzle/20261009120830_init/` (`migration.sql` и `snapshot.json`) сгенерирована `drizzle-kit generate --name init` и руками не правилась. `meta/_journal.json` и `CREATE EXTENSION` нет, повторный `db:generate` печатает `No schema changes, nothing to migrate`.
- `drizzle.config.ts` без `dbCredentials` и без чтения env.
- Тесты: `global-setup.ts` применяет миграции под ролью миграций с принудительным `NODE_ENV=test`; `roles.test.ts` (9 тестов на настоящей базе) и `connection.test.ts` (12 unit-тестов без базы). `beforeEach` чистит `app_info` командой `TRUNCATE` под `dvlab_migrator`.
- `.env.example`: семь имён с заглушками `CHANGE_ME` и `host`, без адресов и паролей. `turbo.json`: `globalPassThroughEnv` с `DATABASE_URL` и `MIGRATOR_DATABASE_URL`, `globalEnv` нет.

## Task Commits

1. **Задача 1: миграция под ролью миграций, запись и чтение под ролью приложения** — `b512a35` (feat, tracer)
2. **Задача 2: права ролей, защита тестовой базы, параллельные миграции и контракт env** — `5228997` (test), `42897fd` (feat)

**Plan metadata:** коммит `docs(17-03)` с этим SUMMARY, STATE.md, ROADMAP.md и deferred-items.md.

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/db typecheck` | код 0 |
| `yarn workspace @dv-lab/db test` | 2 файла, 21 тест, все прошли |
| `yarn workspace @dv-lab/db test --sequence.shuffle` | 21 тест прошёл (прогоны с seed 1791547869296, 1791547891694, 1791547931529) |
| `yarn turbo run test --filter=@dv-lab/db` (строгий режим Turbo) | 21 тест прошёл |
| повторный `db:generate` и `ls -d packages/db/drizzle/*/` | `No schema changes`, одна папка `20261009120830_init/` |
| `*_init/migration.sql` есть, `meta/_journal.json` нет, `CREATE EXTENSION` нет | выполнено |
| `! grep -q dbCredentials packages/db/drizzle.config.ts` | выполнено |
| имена переменных есть в `connection.ts`, нет в `migrate.ts` и `global-setup.ts` | выполнено |
| `git grep --untracked -n -E 'env\.(MIGRATOR_)?DATABASE_URL' -- 'apps/*/src/*' 'packages/*/src/*'` | пусто, код 1 |
| node-проверка env-контракта | `env contract ok` |
| `! grep -Eq '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' .env.example` | выполнено |
| `yarn prettier --check` по исходникам, тестам, конфигам пакета и `turbo.json` | чисто (кроме сгенерированного `snapshot.json`, см. Issues) |
| Проба базы до начала работы (только чтение) | PostgreSQL 18.6; `dvlab_migrator` и `dvlab_app` без superuser, владелец `dvlab_test` — `dvlab_migrator`, `search_path` `public, extensions`, `pg_trgm` в схеме `extensions`, таблиц не было |

Тесты шли под ролями `dvlab_app` и `dvlab_migrator` на базе `dvlab_test`; `dvlab_dev` не затрагивалась. Адреса и пароли нигде не печатались.

## TDD Gate Compliance

Задача 2 помечена `tdd="true"`, но всё поведение из её `<behavior>` план отдал трассеру (задача 1): `resolveDatabaseUrl` с защитой `_test`, `runMigrations` с advisory lock, роли и права на сервере уже существовали. Поэтому RED-прогон тестов задачи 2 сразу прошёл: `gsd-tools check tdd-red-evidence` вернул `INVALID_RED (unexpected_green)`. Причина установлена: поведение уже есть по замыслу плана, а не тесты проверяют не то.

- Чтобы убедиться, что тесты способны упасть, проведена мутационная проверка: условие `endsWith('_test')` временно заменено на `includes('_test')`, тест `test environment rejects database dvlab_test2` упал (1 из 12), изменение откачено до коммита.
- Реализационная часть задачи 2 (`.env.example` и `turbo.json`) проверяется node-командой env-контракта: до изменений она завершилась кодом 1, после — `env contract ok`.
- Порядок коммитов соблюдён: `test(17-03)` (`5228997`) раньше `feat(17-03)` (`42897fd`).
- Ограничение теста параллельных миграций: база к его запуску уже мигрирована (`global-setup`), поэтому он доказывает, что два одновременных вызова оба завершаются и возвращают число папок, но гонку при первом применении на пустой базе не воспроизводит. Временные базы недоступны (решение владельца 5), сносить схему `drizzle` в `dvlab_test` план не предписывает.

## Decisions Made

- `migrate()` выполняется на клиенте, который держит advisory lock (`drizzle({ client })`, тип `NodePgClient` допускает `PoolClient`). Блокировка и миграция идут в одной сессии, пулу `runMigrations` хватает `max: 1`.
- Проверка кода ошибки в тестах ищет поле `code` у ошибки и по цепочке `cause` (у `DrizzleQueryError` код лежит в `cause`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Заглушка `HOST` не проходила проверку плана**
- **Found during:** Задача 2, проверка env-контракта
- **Issue:** действие плана задаёт `postgresql://...:CHANGE_ME@HOST:5432/dvlab_dev`, а проверка требует `new URL(...).hostname === 'host'`. Для схемы `postgresql:` (не special scheme) WHATWG URL не меняет регистр хоста, `hostname` остаётся `HOST`, и проверка печатала `real value in DATABASE_URL`.
- **Fix:** заглушка записана как `host` в нижнем регистре; смысл (не адрес, а место для подстановки) не изменился.
- **Files modified:** `.env.example`
- **Verification:** `env contract ok`, IP-адресов в файле нет.
- **Committed in:** `42897fd`

### Отклонения от текста плана

- Сверх плана для проверки строгого режима Turbo запущен `yarn turbo run test --filter=@dv-lab/db`. turbo 2.11.7 при запуске агентом дописал в `AGENTS.md` блок `turborepo-agent-rules`; изменение откачено (`git checkout -- AGENTS.md`), в коммиты не попало (см. deferred-items.md).
- Требования INFRA-02 и INFRA-08 в REQUIREMENTS.md не отмечены: `requirements.ready-ids` вернул 0 из 2, их объявляют и другие планы фазы, которые ещё не завершены.

**Total deviations:** 1 автоисправление (Rule 1) и 2 пояснения к тексту плана.
**Impact on plan:** объём работ не расширен.

## Issues Encountered

- Сгенерированный `packages/db/drizzle/20261009120830_init/snapshot.json` не проходит `prettier --check` (drizzle-kit пишет отступ в два пробела). Файл не правился: сгенерированные файлы руками не трогаются. Нужна строка `packages/db/drizzle` в `.prettierignore`, иначе `format:check` в CI (17-10) упадёт. Записано в `deferred-items.md`.
- `knip.json` по-прежнему описывает удалённые файлы старого `packages/db`, `packages/api-types` и `packages/rbac`; файл переписывает 17-10. Записано в `deferred-items.md`.

## User Setup Required

Нет. База `dvlab_test`, роли и `.env.test` уже подготовлены владельцем (17-01, задача 3).

## Next Phase Readiness

- 17-05 (api) импортирует `resolveDatabaseUrl`, `createDb`, `runMigrations` из `@dv-lab/db`; `migrationsFolder` из бандла api указывает на `apps/api/drizzle` рядом с `dist`, каталог уже в `.gitignore`.
- 17-10 (CI): база CI тоже должна называться `dvlab_test`, иначе защита `_test` остановит тесты; в `.prettierignore` нужен `packages/db/drizzle`; стоит решить про `"agentGuidance": false` в `turbo.json`.
- 17-04 этим планом не затронут.

## Self-Check: PASSED

Все файлы из `key-files` существуют; коммиты `b512a35`, `5228997`, `42897fd` есть в `git log`; критерии приёмки обеих задач и `<verification>` плана перезапущены после последнего коммита и проходят.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09*
