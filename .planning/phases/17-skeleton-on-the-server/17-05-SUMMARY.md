---
phase: 17-skeleton-on-the-server
plan: 05
subsystem: database
tags: [drizzle, migrations, tsdown, rolldown, pino, postgres, vitest]

requires:
  - phase: 17-skeleton-on-the-server
    provides: "resolveDatabaseUrl, runMigrations с advisory lock и первая миграция Drizzle v1 (17-03)"
  - phase: 17-skeleton-on-the-server
    provides: "createLogger из apps/api/src/request-context.ts, tsconfig и vitest.config.ts api (17-04)"
provides:
  - "apps/api/src/migrate.ts: единственная точка входа миграций под ролью dvlab_migrator"
  - "apps/api/tsdown.config.ts: сборка dist/migrate.mjs со вшитым @dv-lab/db и копией packages/db/drizzle в apps/api/drizzle"
  - "скрипты @dv-lab/api: build (tsdown) и db:migrate; корневой yarn db:migrate теперь рабочий"
  - "apps/api/test/migrate.test.ts: три теста на собранном бинаре"
  - "новая история миграций применена к dvlab_dev и dvlab_test на домашнем сервере"
affects: [17-06, 17-07, 17-08, 17-10, phase-18]

actuals:
  tokens: 1060
  tasks: 2
  commits: 1
plan_head_before: b19da72
plan_head_after: 4b460992f4abc36dd93fb20e5578b5ecb01a4b1c

tech-stack:
  added: []
  patterns:
    - "Точка входа миграций без экспорта: верхнеуровневый await, лог через createLogger, при ошибке process.exitCode = 1"
    - "tsdown: deps.alwaysBundle [/^@dv-lab\\//] вшивает JIT-пакеты, внешние зависимости остаются импортами"
    - "Миграции едут рядом с бандлом: apps/api/drizzle, migrationsFolder бандла считается от import.meta.url dist/migrate.mjs"

key-files:
  created:
    - apps/api/src/migrate.ts
    - apps/api/tsdown.config.ts
    - apps/api/test/migrate.test.ts
  modified:
    - apps/api/package.json

key-decisions:
  - "copy в tsdown записан как { from: '../../packages/db/drizzle', to: '.' } вместо flatten: false: в tsdown 0.23.0 flatten: false с путём через ../ кладёт файлы в apps/api/packages/db/drizzle"
  - "Тест роли приложения дополнительно проверяет, что URL роли не попадает в вывод процесса"

requirements-completed: [INFRA-07, INFRA-08]

coverage:
  - id: D1
    description: "Сборка api даёт dist/migrate.mjs без импорта @dv-lab/db и копию миграций apps/api/drizzle/*_init/migration.sql, игнорируемую git"
    requirement: INFRA-07
    verification:
      - kind: other
        ref: "yarn workspace @dv-lab/api build && ls apps/api/dist/migrate.mjs apps/api/drizzle/*_init/migration.sql; ! grep -q '@dv-lab/db' apps/api/dist/migrate.mjs; git status --porcelain -- apps/api/drizzle (пусто)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Собранный migrate.mjs под dvlab_migrator завершается кодом 0 и печатает migrations, равное числу папок в packages/db/drizzle"
    requirement: INFRA-07
    verification:
      - kind: integration
        ref: "apps/api/test/migrate.test.ts#migrator role applies migrations"
        status: pass
    human_judgment: false
  - id: D3
    description: "Тот же бинарь с URL роли dvlab_app завершается ненулевым кодом с permission denied и migrations failed, URL в вывод не попадает"
    requirement: INFRA-07
    verification:
      - kind: integration
        ref: "apps/api/test/migrate.test.ts#app role cannot apply migrations"
        status: pass
    human_judgment: false
  - id: D4
    description: "Два одновременных запуска migrate.mjs оба завершаются кодом 0 с одинаковым migrations"
    requirement: INFRA-07
    verification:
      - kind: integration
        ref: "apps/api/test/migrate.test.ts#concurrent runs both succeed"
        status: pass
    human_judgment: false
  - id: D5
    description: "[BLOCKING] Миграции применены под dvlab_migrator к dvlab_dev и dvlab_test, журнал drizzle.__drizzle_migrations совпадает с числом папок"
    requirement: INFRA-08
    verification:
      - kind: other
        ref: "команда verify задачи 2 (scratchpad 17-05-apply-migrations.cjs): '.env dvlab_dev 1 1', '.env.test dvlab_test 1 1', код 0"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-10-09
status: complete
---

# Phase 17 Plan 05: миграции отдельным шагом под ролью миграций Summary

**`apps/api/src/migrate.ts` вызывает `runMigrations(resolveDatabaseUrl('migrator', process.env))` и пишет одну строку pino; tsdown собирает его в `dist/migrate.mjs` со вшитым `@dv-lab/db` и копией миграций в `apps/api/drizzle`; три теста на собранном бинаре доказывают успех под `dvlab_migrator`, `permission denied` под `dvlab_app` и безопасный параллельный запуск; новая история применена к `dvlab_dev` и `dvlab_test`.**

## Performance

- **Duration:** около 2 мин
- **Started:** 2026-10-09T12:24:49Z
- **Completed:** 2026-10-09T12:26:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `migrate.ts`: логгер `createLogger('info')`, при успехе `logger.info({ migrations }, 'migrations applied')`, при ошибке `logger.error({ err }, 'migrations failed')` и `process.exitCode = 1`. URL базы в лог не пишется; текст ошибки pg (`permission denied ...`) попадает в строку через сериализатор ошибок pino.
- `tsdown.config.ts`: entry `migrate`, esm, node, `node24`, `dist`, sourcemap, `clean: ['dist', 'drizzle']`, `deps.alwaysBundle: [/^@dv-lab\//]`, `copy: [{ from: '../../packages/db/drizzle', to: '.' }]`. В бандле остаются импорты `drizzle-orm`, `pg`, `zod`, `pino`; `migrationsFolder` равен `new URL("../drizzle", import.meta.url)` от `dist/migrate.mjs`, то есть `apps/api/drizzle`. Допущение плана про `import.meta.url` в rolldown подтверждено тестом на собранном бинаре.
- `package.json`: добавлены только скрипты `build` (`tsdown`) и `db:migrate` (`node --env-file-if-exists=../../.env src/migrate.ts`), зависимости не менялись.
- `migrate.test.ts`: три теста запускают `dist/migrate.mjs` дочерним процессом с env из `.env.test`; URL роли приложения берётся через `resolveDatabaseUrl('app', process.env)`.
- [BLOCKING] Миграции применены под `dvlab_migrator` к `dvlab_dev` и `dvlab_test`; `drizzle-kit push` не использовался.

## Task Commits

1. **Задача 1 (tracer): собранный migrate.mjs под двумя ролями и параллельно** — `4b46099` (feat)
2. **Задача 2 [BLOCKING]: применение миграций к dvlab_dev и dvlab_test** — без коммита: задача файлов не меняет

**Plan metadata:** коммит `docs(17-05)` только с этим SUMMARY.

## Проверки

| Проверка | Результат |
|----------|-----------|
| Предусловие: `.env` и `.env.test` (печатались только имена баз и пользователей) | `.env`: `dvlab_dev` (`dvlab_app`, `dvlab_migrator`); `.env.test`: `dvlab_test` (те же роли) |
| `yarn workspace @dv-lab/api build && ls apps/api/dist/migrate.mjs apps/api/drizzle/*_init/migration.sql` | код 0, оба файла есть |
| `yarn workspace @dv-lab/api typecheck && yarn workspace @dv-lab/api test` | код 0; 2 файла, 15 тестов (12 из 17-04 и 3 новых), все прошли |
| `! grep -q '@dv-lab/db' apps/api/dist/migrate.mjs` | PASS |
| `grep -q "resolveDatabaseUrl('app'" apps/api/test/migrate.test.ts` | PASS |
| `git status --porcelain -- apps/api/drizzle` | пусто |
| `yarn prettier --check` по четырём файлам плана | чисто |
| Трассерный шлюз (`human_verify_mode` = `end-of-phase`, verify только автоматический) | verify перезапущен и прошёл, контрольная точка не нужна |
| Команда verify задачи 2 (сохранена дословно в scratchpad как `17-05-apply-migrations.cjs`, запущена из корня worktree) | `.env dvlab_dev 1 1`, `.env.test dvlab_test 1 1`, код 0 |

Запись вне репозитория: только применение миграций под `dvlab_migrator` к `dvlab_dev` и `dvlab_test` (обе базы уже были на этой истории, журнал содержит одну запись, равную одной папке). Тесты шли по `dvlab_test`. Адреса и пароли нигде не печатались.

## Decisions Made

- Запись `copy` в tsdown 0.23.0 выбрана по исходнику `resolveCopyEntry`: каталог копируется целиком (`fs.cp` с `recursive`), а `flatten` определяет только родительскую папку назначения. При `to: '.'` назначение равно `apps/api/drizzle`, вложенные папки миграций сохраняются.
- Тест роли приложения сверх плана проверяет, что вывод содержит `migrations failed` и не содержит URL роли (подкрепляет требование «URL базы в лог не пишется»).

## Deviations from Plan

### Отклонения от текста плана

**1. [Rule 3 - Blocking] `copy` без `flatten: false`**
- **Found during:** Задача 1, разбор d.ts и реализации tsdown 0.23.0
- **Issue:** план задаёт копию `../../packages/db/drizzle` в `drizzle` с `flatten: false`. В tsdown 0.23.0 при `flatten: false` первый сегмент относительного пути (`..`) заменяется на `to`, и файлы попали бы в `apps/api/packages/db/drizzle`; при `to: 'drizzle'` и `flatten: true` — в `apps/api/drizzle/drizzle`.
- **Fix:** `{ from: '../../packages/db/drizzle', to: '.' }` (план разрешает взять эквивалент из d.ts). Результат тот же, что задуман планом: `apps/api/drizzle/<папка>/migration.sql`.
- **Files modified:** `apps/api/tsdown.config.ts`
- **Verification:** `ls apps/api/drizzle/*_init/migration.sql` после сборки; тест `migrator role applies migrations` на собранном бинаре.
- **Committed in:** `4b46099`

**2. Коммит вместо «Не коммитить»**
- Текст действия задачи 1 говорит «Не коммитить»; по правилам оркестратора для этого проекта задача закоммичена явными путями.

---

**Total deviations:** 1 по Rule 3 и 1 пояснение к тексту плана.
**Impact on plan:** объём работ не расширен.

## Issues Encountered

- Тест параллельного запуска идёт по уже мигрированной `dvlab_test`, поэтому доказывает, что два одновременных процесса оба завершаются с одинаковым числом миграций, но не воспроизводит гонку первого применения на пустой базе (то же ограничение, что у теста 17-03). Сносить схему `drizzle` план не предписывает.
- `yarn workspace @dv-lab/api test` сам сборку не запускает: при прямом запуске сначала нужен `build` (в Turbo это даёт `test.dependsOn build`).

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности сверх threat_model плана: T-17-13 закрыт `resolveDatabaseUrl('migrator')` и тестом отказа под `dvlab_app`, T-17-14 — тестом параллельного запуска, T-17-15 — `clean: ['dist', 'drizzle']` перед копированием.

## User Setup Required

Нет.

## Next Phase Readiness

- 17-06 (одноразовый сервис migrate в compose) и 17-10 (образ api) запускают `node apps/api/dist/migrate.mjs`; рядом с `dist` в образе должен лежать каталог `apps/api/drizzle` (сборка tsdown его создаёт, в research образ копирует `packages/db/drizzle` туда же).
- 17-07 добавляет в `tsdown.config.ts` точку `server` в тот же `entry`.
- 17-08 оборачивает запуск миграций в `flock` в `deploy.sh`.

## Self-Check: PASSED

- Файлы `apps/api/src/migrate.ts`, `apps/api/tsdown.config.ts`, `apps/api/test/migrate.test.ts`, `apps/api/package.json` существуют.
- Коммит `4b46099` есть в `git log`.
- Критерии приёмки задачи 1 и verify обеих задач прошли после коммита.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09*
