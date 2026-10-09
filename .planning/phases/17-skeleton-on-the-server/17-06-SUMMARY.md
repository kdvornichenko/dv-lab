---
phase: 17-skeleton-on-the-server
plan: 06
subsystem: infra
tags: [docker-compose, caddy, postgres, roles, deploy]

requires:
  - phase: 17-skeleton-on-the-server
    provides: "пакет @dv-lab/db с тестами ролей dvlab_app и dvlab_migrator и первой миграцией (план 17-03)"
provides:
  - "deploy/compose.yaml: сервисы caddy, web, api, migrate (профиль tools), db на postgres:18, общий блок журналов x-logging"
  - "deploy/caddy/Caddyfile: сайт dv-lab.dev, HTTP/3 выключен, X-Request-Id от Caddy, маршруты /healthz, /ws, /api/*, остальное в web"
  - "deploy/postgres/ensure-db.sql: идемпотентные роли dvlab_migrator и dvlab_app, база с владельцем dvlab_migrator, схема extensions с pg_trgm, default privileges"
  - "deploy/postgres/ensure-db.sh: обёртка psql для init-скрипта контейнера и deploy.sh"
  - "deploy/env.example: имена POSTGRES_PASSWORD, MIGRATOR_PASSWORD, APP_PASSWORD без значений"
affects: [17-07, 17-10, 17-11, 17-13]

actuals:
  tokens: 1316
  tasks: 2
  commits: 2
plan_head_before: 20e032e60dab6c7e3ddc799af7a9345ee82f65bf
plan_head_after: 765513f49a7d9cda919de921f78eb17ef8b5e0c9

tech-stack:
  added: []
  patterns:
    - "Пароли попадают в compose только подстановкой ${...:?} из /opt/dv-lab/env/db.env, несекретные переменные api записаны прямо в environment"
    - "Роли и права базы создаёт один идемпотентный ensure-db.sql под суперпользователем: init контейнера, deploy.sh и CI"
    - "Журналы всех контейнеров через якорь x-logging (driver local, max-size 10m, max-file 3)"

key-files:
  created:
    - deploy/compose.yaml
    - deploy/caddy/Caddyfile
    - deploy/env.example
    - deploy/postgres/ensure-db.sql
    - deploy/postgres/ensure-db.sh
  modified: []

key-decisions:
  - "ensure-db.sql на каждом запуске повторяет у обеих ролей ALTER ROLE с LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS вместе с паролем: роль, созданная раньше с другими атрибутами, приводится к раскладке"
  - "Журнал Caddy задан явно как log { format json }: remote_ip IPv6-клиента владелец смотрит в JSON"

requirements-completed: []

coverage:
  - id: D1
    description: "Наружу публикуются только 80 и 443/tcp у caddy; init, stop_grace_period 20s, том PG 18 в /var/lib/postgresql, migrate в профиле tools, роли в URL, x-logging у всех сервисов"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "python3-проверка compose из verify задачи 1 (compose ok)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Caddyfile: protocols h1 h2, header_up X-Request-Id {http.request.uuid}, handle_path /api/*, reverse_proxy web:3000, нет h3, includeSubDomains и email"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "grep-проверки Caddyfile из verify задачи 1"
        status: pass
      - kind: other
        ref: "caddy validate (выполняет CI 17-10, локально caddy нет)"
        status: not_run
    human_judgment: false
  - id: D3
    description: "В deploy/ нет значений секретов и IP-адресов, env.example содержит только имена"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "третья проверка verify задачи 1, перезапущена после коммита задачи 2 по всему deploy/"
        status: pass
    human_judgment: false
  - id: D4
    description: "ensure-db.sql дважды подряд проходит на свежем кластере, после него проходят все 21 тест packages/db"
    requirement: INFRA-02
    verification:
      - kind: integration
        ref: "временный кластер PostgreSQL 17.10 (Homebrew), два прогона ensure-db.sql, yarn workspace @dv-lab/db test (21 из 21)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-09
status: complete
---

# Phase 17 Plan 06: compose, Caddyfile и ensure-db.sql для сервера Summary

**Серверный стек описан в `deploy/`: Caddy 2.11.7 публикует только 80 и 443/tcp с выключенным HTTP/3 и собственным `X-Request-Id`, api ходит в PostgreSQL 18 под `dvlab_app`, миграции идут отдельным сервисом под `dvlab_migrator`, а идемпотентный `ensure-db.sql` создаёт ту же раскладку ролей, на которой 21 тест `packages/db` проходит на свежем кластере.**

## Performance

- **Duration:** около 5 мин
- **Started:** 2026-10-09T12:15:00Z
- **Completed:** 2026-10-09T12:20:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `deploy/caddy/Caddyfile`: глобально `servers { protocols h1 h2 }`; сниппет `upstream` с `lb_try_duration 10s`, `lb_try_interval 250ms`, `header_up X-Request-Id {http.request.uuid}`; сайт `dv-lab.dev` с `log { format json }`, `encode zstd gzip`, заголовками (`-Server`, HSTS `max-age=31536000` без `includeSubDomains` и `preload`, `nosniff`, `strict-origin-when-cross-origin`), `request_body max_size 1MB`; `/healthz` и `/ws` идут в `api:4000`, `handle_path /api/*` срезает префикс и идёт в `api:4000` с `flush_interval -1`, остальное в `web:3000`. Глобального `email` нет.
- `deploy/compose.yaml`: `name: dv-lab`, якорь `x-logging` (driver `local`, `max-size '10m'`, `max-file '3'`) у всех пяти сервисов. `caddy` с портами `80:80` и `443:443`, `cap_drop ALL` и `cap_add NET_BIND_SERVICE`, томами в `/opt/dv-lab/data/caddy`. `web` и `api` на образах `ghcr.io/kdvornichenko/dv-lab-*:${APP_TAG:?}`, `init: true`, `mem_limit 512m`, healthcheck через `node -e` с `fetch`. `api` с `stop_grace_period 20s`, несекретными переменными в `environment` и `DATABASE_URL` под `dvlab_app` на базу `dvlab`. `migrate` в профиле `tools`, `restart 'no'`, команда `node apps/api/dist/migrate.mjs`, `MIGRATOR_DATABASE_URL` под `dvlab_migrator` на `${MIGRATE_DB:-dvlab}`. `db` на `postgres:18`, `env_file /opt/dv-lab/env/db.env`, том `/opt/dv-lab/data/pg:/var/lib/postgresql`, `./postgres` в `/deploy/postgres` и `ensure-db.sh` в `/docker-entrypoint-initdb.d/10-ensure-db.sh`. Ни у одного сервиса, кроме `caddy`, нет `ports`.
- `deploy/env.example`: три строки `POSTGRES_PASSWORD=`, `MIGRATOR_PASSWORD=`, `APP_PASSWORD=`.
- `deploy/postgres/ensure-db.sql`: роли `dvlab_migrator` и `dvlab_app` создаются через `format(%I, %L)` и `\gexec`, если их нет; на каждом запуске `ALTER ROLE` с атрибутами и паролем из переменных psql и `SET search_path = public, extensions`; база `:db_name` с `OWNER dvlab_migrator` и `ENCODING UTF8`, если её нет; `REVOKE ALL ON DATABASE ... FROM PUBLIC`, `GRANT CONNECT, TEMPORARY` роли `dvlab_app`; после `\connect` схема `extensions` суперпользователя, `USAGE` обеим ролям, `pg_trgm WITH SCHEMA extensions`, `USAGE ON SCHEMA public` роли `dvlab_app`, default privileges от `dvlab_migrator` на таблицы и последовательности. `citext` нет.
- `deploy/postgres/ensure-db.sh`: `set -Eeuo pipefail`, `psql -X -q -v ON_ERROR_STOP=1` с `db_name`, `migrator_password`, `app_password` из `APP_DB_NAME`, `MIGRATOR_PASSWORD`, `APP_PASSWORD`, без `exec`; режим файла в git `100755`.

## Task Commits

1. **Задача 1: путь запроса Caddy → web и api → db описан в Caddyfile и compose** — `987b15c` (feat, tracer)
2. **Задача 2: идемпотентный ensure-db.sql с раскладкой ролей домашнего сервера** — `765513f` (feat)

**Plan metadata:** коммит `docs(17-06)` только с этим SUMMARY. STATE.md и ROADMAP.md обновляет оркестратор.

Счёт `commits: 2` взят по области `(17-06)`: `git log --oneline 20e032e..HEAD --grep='(17-06)'`. Параллельно в той же ветке коммитит исполнитель 17-04, поэтому `git rev-list --count 20e032e..HEAD` включает и его коммиты. `plan_head_after` — последний коммит этого плана до SUMMARY.

## Проверки

| Проверка | Результат |
|----------|-----------|
| python3-проверка compose (порты, init, stop_grace_period, том PG 18, профиль migrate, роли в URL, образ db, x-logging у всех сервисов) | `compose ok`, код 0 |
| grep-проверки Caddyfile (`protocols h1 h2`, `header_up X-Request-Id`, `handle_path /api/*`, `reverse_proxy web:3000`, нет `h3`, `includeSubDomains`, `email`) | код 0 |
| env.example без значений, в `deploy/` нет IPv6 и IPv4, кроме `127.0.0.1` | код 0 (перезапущено после коммита задачи 2 по всему `deploy/`) |
| `yarn prettier --check deploy/compose.yaml` | чисто после `--write` |
| `bash -n deploy/postgres/ensure-db.sh && test -x deploy/postgres/ensure-db.sh` | код 0 |
| `! grep -q 'exec ' deploy/postgres/ensure-db.sh` | код 0 |
| `grep -q 'WITH SCHEMA extensions'` и `! grep -qi citext` по `ensure-db.sql` | код 0 |
| Временный кластер PostgreSQL 17.10, первый прогон `ensure-db.sql` | код 0 |
| Второй прогон `ensure-db.sql` на том же кластере | код 0, NOTICE `schema "extensions" already exists` и `extension "pg_trgm" already exists` |
| `yarn workspace @dv-lab/db test` против этого кластера | 2 файла, 21 тест, все прошли; журнал кластера показывает ожидаемые `permission denied` от тестов прав `dvlab_app`, значит тесты шли в него, а не в домашнюю базу |
| Кластер остановлен и удалён, порт 55999 свободен | выполнено |

Tracer-гейт задачи 1: полный `<verify>` задачи перезапущен после коммита задачи 2 и прошёл, расширение плана шло на проверенном срезе.

### Не запущено

- `caddy validate`: бинарника `caddy` локально нет. Валидацию выполняет CI (17-10) в контейнере `caddy:2.11.7`.
- `shellcheck` по `ensure-db.sh`: `shellcheck` не установлен; выполняет CI (17-10).
- `docker compose config` и запуск стека (`init`, `stop_grace_period`, `profiles`, `depends_on.condition`, init-скрипт в образе `postgres:18`): Docker локально нет. Первая проверка у владельца на сервере (17-13), допущение A1 исследования.
- Проверка на PostgreSQL 18: локально только 17.10 из Homebrew, PG 18 проверит CI, как и предусматривает план.

## Decisions Made

- `ALTER ROLE` на каждом запуске повторяет атрибуты `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` вместе с паролем. План требует на каждом запуске только смену пароля и `search_path`; атрибуты добавлены, чтобы роль, созданная раньше вручную с другими атрибутами, приводилась к той же раскладке. Пароль подставляется через `%L`, как при создании.
- Директива журнала в блоке сайта записана как `log { format json }`, а не голым `log`: формат JSON задан явно, независимо от того, есть ли у контейнера терминал.

## Deviations from Plan

### Auto-fixed Issues

Нет.

### Отклонения от текста плана

- `deploy/compose.yaml` отформатирован `yarn prettier --write` (переносы массивов `healthcheck.test`), чтобы `format:check` в CI (17-10) не упал на этом файле. Ключи и значения не изменились, проверка compose после форматирования снова печатает `compose ok`.
- Повтор атрибутов в `ALTER ROLE` (см. Decisions Made).

**Total deviations:** 0 автоисправлений, 2 пояснения к тексту плана.
**Impact on plan:** объём работ не расширен.

## Issues Encountered

- Первые два запуска проверки задачи 2 упали на старте `pg_ctl`: в окружении агента `LANG` пустой, PostgreSQL 17.10 из Homebrew пишет `postmaster became multithreaded during startup` и советует задать `LC_ALL`. В скрипте проверки добавлен `export LC_ALL=en_US.UTF-8`, после этого кластер стартует. Файлы `deploy/` это не затрагивает; следующему исполнителю, поднимающему временный кластер на этом Mac, нужно то же.

## User Setup Required

Нет. Серверные шаги (каталоги `/opt/dv-lab`, `env/db.env` с правами 600, пароли `openssl rand -hex 24`) описывают RUNBOOK и планы 17-11 и 17-13.

## Next Phase Readiness

- 17-07 (`deploy.sh`) вызывает `docker compose exec -T db /deploy/postgres/ensure-db.sh` и `run --rm migrate`; compose читает пароли вторым `--env-file /opt/dv-lab/env/db.env`, тег образа из `state/release.env` (`APP_TAG`).
- 17-10 (CI): шаг `psql -f deploy/postgres/ensure-db.sql` с `-v db_name=dvlab_test -v migrator_password=... -v app_password=...`; переменные `migrator_role` и `app_role` из примера исследования больше не нужны, имена ролей зашиты в SQL. Там же `caddy validate` и `shellcheck deploy/postgres/ensure-db.sh`.
- 17-13: проверка снаружи по IPv4 и IPv6 и `remote_ip` IPv6-клиента в JSON-журнале Caddy (допущение A5).

## Self-Check: PASSED

Все пять файлов из `key-files` существуют; коммиты `987b15c` и `765513f` есть в `git log`; проверки обеих задач перезапущены после последнего коммита и проходят.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09*
