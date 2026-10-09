---
phase: 17-skeleton-on-the-server
plan: 10
subsystem: infra
tags: [github-actions, ci, docker, ghcr, postgres, knip, turbo, prettier, docs]

requires:
  - phase: 17-skeleton-on-the-server
    provides: "turbo, yarn 4.18.1 в .yarn/releases, workspaces web, api, db (17-01, 17-02)"
  - phase: 17-skeleton-on-the-server
    provides: "deploy/postgres/ensure-db.sql с переменными db_name, migrator_password, app_password (17-03, 17-06)"
  - phase: 17-skeleton-on-the-server
    provides: "tsdown собирает apps/api/dist/server.mjs и migrate.mjs и копию миграций apps/api/drizzle (17-05, 17-07)"
  - phase: 17-skeleton-on-the-server
    provides: "deploy/compose.yaml, Caddyfile, deploy.sh с тегами sha-<40 hex> (17-06, 17-08)"
provides:
  - ".github/workflows/ci.yml: job Verify на postgres:18 под ролями dvlab_app и dvlab_migrator и job images (Image web, Image api) с публикацией в GHCR после Verify"
  - "apps/api/Dockerfile и apps/web/Dockerfile: multi-stage на node:24.21.0-slim, turbo prune, закреплённый релиз Yarn, USER node, exec-форма CMD"
  - ".dockerignore без .env*, .git, .planning, deploy, node_modules, .next, dist"
  - "knip.json под apps/web, apps/api, packages/db; yarn knip завершается кодом 0 без ignoreDependencies"
  - "AGENTS.md, CLAUDE.md (@AGENTS.md), README.md под новый скелет без GitNexus"
  - "turbo.json agentGuidance false; packages/db/drizzle в .prettierignore"
affects: [17-12, 17-13, phase-18]

actuals:
  tokens: 9400
  tasks: 3
  commits: 6
plan_head_before: 2a8d3786250f13bed350fff3806215f7d3ee3027
plan_head_after: 041b8e3f44e04b192be52c9ecba82add05df1570

tech-stack:
  added: []
  patterns:
    - "CI готовит базу тем же deploy/postgres/ensure-db.sql, что сервер, двумя прогонами подряд (проверка идемпотентности)"
    - "Синхронность схемы и миграций: yarn db:generate и пустой git status --porcelain --untracked-files=all -- packages/db/drizzle"
    - "Образы вызывают node .yarn/releases/yarn-4.18.1.cjs напрямую, corepack в Dockerfile не используется"
    - "Builder-стадия копирует tsconfig.base.json из контекста: turbo prune его не переносит"

key-files:
  created:
    - .github/workflows/ci.yml
    - apps/api/Dockerfile
    - apps/web/Dockerfile
    - .dockerignore
    - README.md
  modified:
    - knip.json
    - turbo.json
    - .prettierignore
    - AGENTS.md
    - CLAUDE.md
    - apps/api/src/request-context.ts
    - apps/api/src/lifecycle.ts
    - deploy/RUNBOOK.md
    - .planning/phases/17-skeleton-on-the-server/deferred-items.md

key-decisions:
  - "Оба Dockerfile копируют tsconfig.base.json в builder: turbo prune --docker кладёт в out/full только package.json, turbo.json, .yarnrc.yml, .npmrc, .gitignore и workspace, а tsconfig workspace наследуют ../../tsconfig.base.json; без копии tsdown падает с File '../../tsconfig.base.json' not found"
  - "knip.json без ignoreDependencies: knip 6.40.0 сам находит pg, vite, tailwindcss и прочие зависимости через плагины; явные entry оставлены по тексту плана, knip помечает их как redundant (подсказка, код выхода 0)"
  - "Неиспользуемые экспорты убраны из кода: currentRequestId в request-context.ts и тип ManagedHandles в lifecycle.ts стали внутренними"
  - "turbo.json agentGuidance false: ключ есть в схеме turbo 2.11.7; после прогонов turbo из сессии агента AGENTS.md не меняется"
  - "Проверка устаревшего кода в CI различает код выхода git grep: 1 — совпадений нет, 0 и 128 — Verify падает"
  - "yarn format:check в Verify не добавлен: план его не предписывает, и вне .planning он чистый, но по .planning (документы GSD) падает"

requirements-completed: [INFRA-02, INFRA-03, INFRA-05]

coverage:
  - id: D1
    description: "Job Verify: pull_request и push в master, concurrency с отменой только для PR, permissions contents read, postgres:18, роли dvlab_app и dvlab_migrator в dvlab_test, все шаги проверок"
    requirement: INFRA-02
    verification:
      - kind: other
        ref: "python3 scratchpad/17-10-verify-ci.py (команда verify задачи 1 дословно) -> ci verify ok"
        status: pass
    human_judgment: false
  - id: D2
    description: "Локальный эквивалент Verify зелёный на dvlab_test: install --immutable, typecheck, lint, test (db 21, api 47), build, knip"
    requirement: INFRA-05
    verification:
      - kind: integration
        ref: "yarn install --immutable && yarn typecheck && yarn lint && yarn test && yarn build && yarn knip"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dockerfile api и web, .dockerignore: turbo prune обоих приложений, структурные проверки, сборка без Docker по шагам Dockerfile"
    requirement: INFRA-03
    verification:
      - kind: other
        ref: "scratchpad/17-10-task2-verify.sh (verify 1 и 2 задачи 2) -> rc=0"
        status: pass
      - kind: other
        ref: "scratchpad/17-10-sim-build.sh api|web: prune, install --immutable, build, workspaces focus --production; server.mjs и migrate.mjs загружают все модули, standalone web отвечает 200 на / и /robots.txt"
        status: pass
    human_judgment: false
  - id: D4
    description: "Job images: needs verify, packages write только у job, вход в GHCR только на push, теги sha long и latest, проверка манифеста на push"
    requirement: INFRA-03
    verification:
      - kind: other
        ref: "python3 scratchpad/17-10-verify-images.py (verify 3 задачи 2) -> ci images ok"
        status: pass
    human_judgment: false
  - id: D5
    description: "Первый прогон workflow на PR зелёный: Verify (включая caddy validate и shellcheck) и сборка обоих образов в Docker"
    requirement: INFRA-02
    verification: []
    human_judgment: true
    rationale: "Docker, shellcheck и actionlint локально отсутствуют; проверяется первым прогоном CI после push владельцем в 17-12"
  - id: D6
    description: "AGENTS.md, CLAUDE.md, README.md без GitNexus и адресов, CLAUDE.md импортирует AGENTS.md"
    verification:
      - kind: other
        ref: "команда verify задачи 3 (scratchpad/17-10-task3-verify.sh) -> rc=0"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-09
status: complete
---

# Phase 17 Plan 10: CI, образы и документация скелета Summary

**Workflow `CI` с job `Verify` на `postgres:18` под ролями сервера (роли готовит тот же `ensure-db.sql` двумя прогонами) и job `images`, который после зелёного `Verify` собирает образы web и api и на push в `master` публикует их в GHCR с тегами `sha-<40 hex>` и `latest`; multi-stage Dockerfile'ы на закреплённом Yarn от пользователя `node`, `.dockerignore` без секретов, чистый `knip`, AGENTS.md/CLAUDE.md/README.md без GitNexus.**

## Performance

- **Duration:** около 25 мин
- **Started:** 2026-10-09T12:38Z
- **Completed:** 2026-10-09T13:03Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- `.github/workflows/ci.yml`, job `Verify` (имя сохранено): `actions/checkout@v7`; проверка устаревшего кода `git grep` с шаблоном 17-01; граница web и api (нет `apps/web/app/api`, в `apps/web/package.json` нет `@dv-lab/api` и `@dv-lab/db`, остальные пакеты проекта разрешены); совпадение `ARG TURBO_VERSION` в обоих Dockerfile с `devDependencies.turbo`; `corepack enable`, `actions/setup-node@v7` (Node 24, кэш yarn), `yarn install --immutable`; два прогона `psql -X -v ON_ERROR_STOP=1 -d postgres -v db_name=dvlab_test -v migrator_password=… -v app_password=… -f deploy/postgres/ensure-db.sql`; `yarn db:generate` и пустой `git status` по `packages/db/drizzle`; `yarn db:migrate`, `typecheck`, `lint`, `test`, `build`, `knip`; `caddy validate` в `caddy:2.11.7` с томом `deploy/caddy` только для чтения; `bash -n` и `shellcheck -S warning` для `deploy/*.sh deploy/*/*.sh`. Переменной `CI` в env job нет, база называется `dvlab_test`.
- Job `images` (`Image web`, `Image api`): `needs: verify`, матрица `[web, api]`, `fail-fast: false`, права `contents: read` и `packages: write` только у job; `docker/login-action@v4` только при `github.event_name == 'push'`; `metadata-action@v6` с `type=sha,format=long` и `latest` на ветке по умолчанию; `build-push-action@v7` с `push` только на push, `GIT_SHA=${{ github.sha }}`, кэш `type=gha` со scope по приложению; на push — `docker buildx imagetools inspect …:sha-${{ github.sha }}`. `pull_request_target` нет, секретов кроме `GITHUB_TOKEN` нет.
- `apps/api/Dockerfile`: pruner (`ARG TURBO_VERSION=2.11.7`, `turbo prune @dv-lab/api --docker`), builder (`install --immutable`, сборка, `workspaces focus --production`), runner (`ARG GIT_SHA`, `NODE_ENV=production`, только `node_modules`, `apps/api/dist`, `apps/api/drizzle`, `apps/api/package.json`, без chown, `USER node`, `EXPOSE 4000`, `CMD ["node", "--enable-source-maps", "apps/api/dist/server.mjs"]`). Пути совпадают с `deploy/compose.yaml` (`node apps/api/dist/migrate.mjs` у сервиса `migrate`).
- `apps/web/Dockerfile`: standalone Next, `HOSTNAME=0.0.0.0`, `PORT=3000`, `NEXT_TELEMETRY_DISABLED=1`, static и public с `--chown=node:node`, `USER node`, `CMD ["node", "apps/web/server.js"]`.
- `knip.json` переписан: `apps/web` (плагин Next), `apps/api` (entry `src/server.ts`, `src/migrate.ts`), `packages/db` (entry `src/index.ts`, `drizzle.config.ts`). Старые записи (radix, cmdk, api-types, rbac и т.п.) удалены. `ignoreDependencies` не понадобился ни для одной зависимости, обосновывать нечего.
- AGENTS.md переписан на русском под скелет: структура, команды, env и роли, модули-владельцы (`resolveDatabaseUrl`, `loadConfig`, `request-context.ts`, `lifecycle.ts`, префикс `/api` у Caddy, граница web), правила базы, версии с причинами, публичность репозитория, ссылка на `deploy/RUNBOOK.md`. CLAUDE.md — одна строка `@AGENTS.md`. README.md — что это, стек, быстрый старт, ссылки.

## Пункты из прежних находок (project_rules 5)

- **(a) deferred-items.md 1-3:** `packages/db/drizzle` добавлен в `.prettierignore` (коммит `a6eb771`); `knip.json` переписан (`2c48b8d`); `"agentGuidance": false` в `turbo.json` (`2c48b8d`): ключ описан в `node_modules/turbo/schema.json` и `docs/reference/configuration.mdx` turbo 2.11.7, после `yarn typecheck`, `lint`, `test`, `build` из сессии агента `git status` по `AGENTS.md` пуст. Пункты помечены resolved в `deferred-items.md` (`041b8e3`).
- **(b) формат:** `yarn format:check` по всему репозиторию отметил из файлов фазы 17 `apps/api/src/request-context.ts`, `deploy/RUNBOOK.md` и `packages/db/drizzle/.../snapshot.json`. Первые два отформатированы `prettier --write` (только эти файлы; в RUNBOOK изменилось только выравнивание одной таблицы), snapshot исключён через `.prettierignore`. Отдельный коммит `style(17-10)` `a6eb771`.
- **(c) шаги CI против реального deploy/:** `caddy validate` монтирует каталог `deploy/caddy` в `/etc/caddy` только для чтения, как `./caddy:/etc/caddy:ro` в compose; glob `deploy/*.sh deploy/*/*.sh` покрывает `deploy.sh`, `backup/backup.sh`, `backup/restore-check.sh`, `postgres/ensure-db.sh` (в `systemd/` скриптов нет); имена переменных psql совпадают с `ensure-db.sql`. `bash -n` локально прошёл для всех четырёх, директив `shellcheck disable` в `deploy/` нет.
- **(d) граница web/api:** проверка запрещает только `@dv-lab/api` и `@dv-lab/db` во всех секциях зависимостей `apps/web/package.json` и каталог `apps/web/app/api`.

## Task Commits

1. **style: форматирование и `.prettierignore`** — `a6eb771` (style)
2. **Задача 1 (tracer): job Verify, knip.json, turbo agentGuidance, экспорты** — `2c48b8d` (feat)
3. **Задача 2: Dockerfile'ы, .dockerignore, job images** — `31e8274` (feat)
4. **Задача 3: AGENTS.md, CLAUDE.md, README.md** — `4d7ffdd` (docs)
5. **deferred-items.md: пункты 1-3 закрыты** — `041b8e3` (chore)

В диапазоне `plan_head_before..plan_head_after` шесть коммитов: пять перечисленных и `be12cd3` (`docs(18)`) агента фазы 18, сделанный параллельно в той же ветке. Коммит `docs(17-10)` с этим SUMMARY идёт после `plan_head_after`.

## Проверки

| Проверка | Результат |
|----------|-----------|
| Предусловие задачи 1: `.env.test` указывает на `dvlab_test` (печаталось только число совпадений), миграции применены (17-05) | выполнено |
| Verify 1 задачи 1 (структура job Verify) | `ci verify ok` |
| Verify 2 задачи 1: `yarn install --immutable && typecheck && lint && test && build && knip` | код 0; db 21 тест, api 47 тестов; `yarn.lock` и `.yarnrc.yml` не изменились |
| Verify 3 задачи 1: `git grep --untracked … 'supa[b]ase'` | пусто, код 1 |
| Приёмка задачи 1: старых путей в knip.json нет, `shellcheck disable` в deploy нет | PASS |
| Трассерный шлюз (`human_verify_mode` end-of-phase, verify только автоматический) | полный набор перезапущен после коммита задачи 1 и прошёл, контрольная точка не нужна |
| Шаги CI «Legacy code check», «Web and api boundary», «Migrations are in sync», «Turbo version in Dockerfiles» выполнены локально из YAML через `bash -e` | все код 0 |
| Verify 1 задачи 2: `turbo prune` api и web во временный каталог, релиз Yarn, lockfile, миграции, public | код 0 |
| Verify 2 задачи 2: TURBO_VERSION, USER node, пути запуска, .dockerignore, нет corepack и shell-формы | код 0 |
| Verify 3 задачи 2 (структура job images) | `ci images ok` |
| Сборка по шагам Dockerfile без Docker (prune → install --immutable → full → build → focus --production) | api: `node_modules` 39 МБ, `server.mjs` и `migrate.mjs` загружают все модули и падают только на пустом env; web: standalone `server.js` ответил 200 на `/` и `/robots.txt`, процесс остановлен |
| Verify задачи 3 | код 0 |
| `yarn prettier --check` по ci.yml, knip.json, turbo.json, README.md и правленым файлам api | чисто |
| Итоговый прогон после всех коммитов: `install --immutable`, `typecheck`, `lint`, `test`, `build`, `knip` | все код 0 |
| Итоговый `yarn format:check` по всему репозиторию | код 1: только 43 файла в `.planning/` (документы GSD, в том числе STATE.md и ROADMAP.md, которые план трогать не может) и неотслеживаемый `.gsd/`; вне них чисто |

**Не запускалось (бинарей нет локально, ничего не ставилось):** `docker build` обоих образов и `caddy validate` (нет Docker), `shellcheck`, `actionlint`. Их закрывает первый прогон CI на PR в 17-12.

## Decisions Made

- Ключевые решения перечислены во frontmatter `key-decisions`.
- README.md написан по-русски, как AGENTS.md: язык проекта.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Builder-стадия без `tsconfig.base.json`**
- **Found during:** задача 2, сборка по шагам Dockerfile без Docker
- **Issue:** `turbo prune --docker` не переносит корневой `tsconfig.base.json`, а `apps/api/tsconfig.json` и `apps/web/tsconfig.json` его наследуют; `tsdown` упал с `File '../../tsconfig.base.json' not found`, то же ждало бы `docker build` в CI.
- **Fix:** `COPY tsconfig.base.json ./` в builder обоих Dockerfile после копирования `out/full`.
- **Files modified:** `apps/api/Dockerfile`, `apps/web/Dockerfile`
- **Verification:** повторная сборка по шагам прошла для api и web.
- **Committed in:** `31e8274`

**2. [Rule 1 - Bug] Неиспользуемые экспорты, найденные knip**
- **Found during:** задача 1
- **Issue:** `currentRequestId` (`request-context.ts`) и тип `ManagedHandles` (`lifecycle.ts`) экспортировались, но вне своих файлов не используются.
- **Fix:** убран `export`, по правилу плана «убрать из кода, не прятать конфигурацией».
- **Committed in:** `2c48b8d`

### Отклонения от текста плана

- Шаг «Turbo version in Dockerfiles» записан блочным скаляром `run: |`: однострочный `run:` с `: ` внутри команды node YAML не разбирает.
- Проверка устаревшего кода в CI различает код выхода `git grep` (`|| rc=$?`, падение при rc ≠ 1): в `bash -e` голый `if git grep` пропустил бы ошибку 128.
- Коммиты вместо «Не коммитить»: по правилам оркестратора этого проекта каждая задача закоммичена явными путями.
- Явные `entry` в knip.json оставлены по плану, хотя knip 6.40.0 выдаёт для них подсказку «Remove redundant entry pattern» (код выхода 0).

---

**Total deviations:** 2 по Rule 1, 4 пояснения к тексту плана.
**Impact on plan:** объём не расширен; исправление Dockerfile предотвращает падение первой сборки образов в CI.

## Issues Encountered

- `yarn format:check` по всему репозиторию остаётся красным из-за `.planning/`. Исключать `.planning` из Prettier или переформатировать документы GSD план не предписывает; решение за владельцем.
- Хук изоляции worktree не пропускает команды с переменными и `$(...)`, поэтому команды verify с такими конструкциями сохранены в scratchpad (`17-10-*.sh`, `17-10-*.py`) и запущены по пути. `mktemp -d` из verify 1 задачи 2 создаёт каталог вне scratchpad и удаляет его тем же скриптом.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности сверх threat_model плана: T-17-32 (права workflow, вход только на push, нет `pull_request_target`) и T-17-33 (`.env`, `.env.*` в `.dockerignore`, build-arg только `GIT_SHA`) проверены структурными командами verify; T-17-34 — `needs: verify` и теги `sha-<40 hex>`; T-17-35 — `USER node`, файлы api без chown, exec-форма CMD; T-17-SC — точные теги `node:24.21.0-slim`, `caddy:2.11.7`, `postgres:18`.

## User Setup Required

Нет новых шагов. Пакеты GHCR после первого push в `master` делаются публичными по `deploy/RUNBOOK.md` (Pitfall 7, 17-11).

## Next Phase Readiness

- 17-12: push ветки и PR; первый прогон `CI` проверяет `caddy validate`, `shellcheck -S warning`, сборку обоих образов в Docker и параметры actions (допущение A2). Если `shellcheck` найдёт уровень warning в скриптах `deploy/`, их правят без директив отключения.
- В `.github/workflows/ci.yml` имя job `Verify` подходит для правила защиты ветки.

## Self-Check: PASSED

- Файлы `.github/workflows/ci.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.dockerignore`, `README.md`, `knip.json`, `AGENTS.md`, `CLAUDE.md` существуют.
- Коммиты `a6eb771`, `2c48b8d`, `31e8274`, `4d7ffdd`, `041b8e3` есть в `git log`.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09*
