---
phase: 17-skeleton-on-the-server
plan: 08
subsystem: infra
tags: [deploy, bash, docker-compose, ghcr, postgres, backup, systemd]

requires:
  - phase: 17-skeleton-on-the-server
    provides: "deploy/compose.yaml (сервисы db, api, web, caddy, migrate в профиле tools, MIGRATE_DB), deploy/postgres/ensure-db.sh (план 17-06)"
provides:
  - "deploy/deploy.sh: ручная выкатка по тегу sha-<полный sha> с блокировкой, ожиданием образов в GHCR, ensure-db, дампом перед выкаткой, репетицией миграций на копии dvlab_migcheck_<epoch>, миграциями, переключением с пересозданием caddy, проверкой /healthz и откатом"
  - "deploy/backup/backup.sh: ночной pg_dump -Fc с проверкой .part до переименования, weekly жёсткой ссылкой, хранение 14 daily и 8 weekly по количеству"
  - "deploy/backup/restore-check.sh: восстановление последнего daily в dvlab_restorecheck, сверка журнала миграций и count(*) таблиц public, RESTORE_OK"
  - "deploy/systemd/dv-lab-backup.service и dv-lab-backup.timer (03:30, Persistent=true)"
affects: [17-10, 17-11, 17-13, 26]

actuals:
  tokens: 1941
  tasks: 2
  commits: 2
plan_head_before: d7e8a8569dc03fd5040ca62bf5b64c3219b19279
plan_head_after: 17a4c90692ad9d6647cfeec222a3ba6863c52ffc

tech-stack:
  added: []
  patterns:
    - "Скрипты deploy/ вызывают compose через функцию dc с путями в кавычках, а не через переменную COMPOSE: строка без кавычек дала бы SC2086 в shellcheck CI"
    - "Корень /opt/dv-lab переопределяется через DV_LAB_ROOT, поэтому backup.sh проверяется локально на заглушке docker"
    - "Внутри цикла while read вызовы docker compose exec получают stdin из /dev/null: exec -T держит stdin открытым и иначе съел бы оставшиеся строки цикла"

key-files:
  created:
    - deploy/deploy.sh
    - deploy/backup/backup.sh
    - deploy/backup/restore-check.sh
    - deploy/systemd/dv-lab-backup.service
    - deploy/systemd/dv-lab-backup.timer
  modified: []

key-decisions:
  - "В deploy.sh дамп перед выкаткой проверяется pg_restore --list над .part до mv, как в backup.sh; trap EXIT удаляет оставшийся .part"
  - "Каталог дампов создаётся install -d -m 700 вместо umask 077 на весь deploy.sh: umask на весь скрипт сделал бы файлы git checkout недоступными пользователю postgres в контейнере (init-скрипт ensure-db.sh)"
  - "Этап cleanup снимает trap ERR: после успешной выкатки ошибка очистки не должна возвращать клон на PREV"
  - "deploy.sh в начале делает unset MIGRATE_DB: случайно экспортированная переменная не уведёт настоящие миграции во временную базу"

requirements-completed: [INFRA-03, INFRA-04, INFRA-01]

coverage:
  - id: D1
    description: "deploy.sh: этапы lock, current, fetch, images, db-up, ensure-db, pre-dump, dry-run, migrate, switch (с up -d --force-recreate --no-deps caddy), smoke, cleanup; DEPLOY_OK, DEPLOY_FAILED, DEPLOY_STOPPED с кодом 75, DEPLOY_SKIPPED; нет сборки образов, latest, TEMPLATE, grep -q, exec без -T"
    requirement: INFRA-03
    verification:
      - kind: other
        ref: "bash -n, test -x и три grep-проверки verify задачи 1, перезапущены после коммита задачи 2"
        status: pass
    human_judgment: false
  - id: D2
    description: "Выкатка на сервере: ожидание образов, репетиция миграций, переключение, проверка https://dv-lab.dev/healthz, откат, flock при втором запуске"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "запуск deploy.sh владельцем на VPS (17-13)"
        status: unknown
    human_judgment: true
    rationale: "Docker, flock, /run/lock и GHCR локально недоступны; поведение проверяет только запуск владельца на сервере"
  - id: D3
    description: "backup.sh оставляет 14 daily и 8 weekly, удаляет самый старый daily, печатает BACKUP_OK; при ошибке pg_restore --list не оставляет ни .part, ни daily; повторный запуск в тот же день не создаёт второй weekly"
    requirement: INFRA-04
    verification:
      - kind: integration
        ref: "прогон из verify задачи 2 с заглушкой docker (scratchpad 17-08-backup-mock.sh) и дополнительный прогон пути ошибки (17-08-backup-fail.sh)"
        status: pass
    human_judgment: false
  - id: D4
    description: "restore-check.sh и юниты systemd: восстановление в dvlab_restorecheck, RESTORE_OK, таймер 03:30 с Persistent=true"
    requirement: INFRA-04
    verification:
      - kind: other
        ref: "grep-проверки verify задачи 2 (ключи юнитов, нет restic, EnvironmentFile, AWS_)"
        status: pass
      - kind: manual_procedural
        ref: "systemctl list-timers dv-lab-backup.timer и restore-check.sh на сервере (17-13)"
        status: unknown
    human_judgment: true
    rationale: "Восстановление дампа и работа таймера проверяются только на сервере с Docker и systemd"

duration: 3min
completed: 2026-10-09
status: complete
---

# Phase 17 Plan 08: deploy.sh, ночной бэкап и проверка восстановления Summary

**`deploy/deploy.sh` выкатывает образы `sha-<полный sha>` из GHCR без сборки на сервере: ждёт оба образа до 10 минут, достраивает базу `ensure-db`, снимает дамп, прогоняет миграции на восстановленной копии `dvlab_migcheck_<epoch>`, применяет их к `dvlab`, переключает api и web, пересоздаёт caddy, сверяет `/healthz` с sha и `db: ok` и при ошибке возвращает клон и образ на предыдущий релиз; ночной `backup.sh` хранит 14 daily и 8 weekly на диске сервера, `restore-check.sh` восстанавливает последний дамп во временную базу и печатает `RESTORE_OK`.**

## Performance

- **Duration:** около 3 мин
- **Started:** 2026-10-09T12:28:15Z
- **Completed:** 2026-10-09T12:30:15Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `deploy/deploy.sh`: `ROOT` из `DV_LAB_ROOT` (по умолчанию `/opt/dv-lab`); compose через функцию `dc` с `-f $REPO/deploy/compose.yaml --env-file $ROOT/env/db.env`, `APP_TAG` экспортируется после выбора цели, поэтому первая выкатка без `state/release.env` работает. Этапы по порядку: `lock` (`exec 9> /run/lock/dv-lab-deploy.lock`, `flock -n 9`, `DEPLOY_STOPPED` и `exit 75`), `current` (PREV из `release.env`, если файл есть), `fetch` (полный sha `REF`, `DEPLOY_SKIPPED` при совпадении и без `FORCE=1`, `checkout --detach`), `images` (до 60 попыток `docker manifest inspect` обоих образов с паузой 10 с, затем `pull api web`), `db-up`, `ensure-db` (`exec -T db /deploy/postgres/ensure-db.sh`), `pre-dump` (`predeploy-<UTC штамп>-<sha12>.dump` через `.part`, `pg_restore --list`, `mv`), `dry-run` (`CREATE DATABASE "dvlab_migcheck_<epoch>" OWNER dvlab_migrator`, `pg_restore --exit-on-error`, `MIGRATE_DB=... run --rm migrate`, удаление базы), `migrate`, `switch` (запись `release.env`, `SWITCHED=1`, `up -d --wait --wait-timeout 120 api web`, `up -d --force-recreate --no-deps caddy`), `smoke` (до 12 попыток с паузой 5 с: тело `/healthz` содержит `"sha":"<FULL>"` и `"db":"ok"` через `case`, код `/` равен 200), `cleanup` (дампы `predeploy-*` старше 30 дней, локальные образы api и web с тегами кроме TAG и PREV, ошибки не роняют скрипт), `DEPLOY_OK <PREV> -> <TAG>`.
- `on_err`: печатает `DEPLOY_FAILED stage=<этап>`; при непустом PREV на любом этапе сначала `git -C "$REPO" checkout -q --detach "${PREV#sha-}"` (ошибка checkout даёт `ROLLBACK FAILED`), затем при `SWITCHED=1` пишет PREV в `release.env`, поднимает api и web предыдущего образа и пересоздаёт caddy; при пустом PREV сообщает, что откатываться не на что. Итог пишется в `state/deploy-journal.log`, временная база удаляется, скрипт выходит с исходным кодом. Все команды отката стоят в условиях `if`, поэтому `set -e` не обрывает обработчик до записи в журнал.
- `deploy/backup/backup.sh`: `umask 077`, `dvlab-daily-<UTC штамп>.dump` через `.part`, `pg_restore --list` над `.part` до `mv`, `trap cleanup ERR EXIT` удаляет `.part`; weekly жёсткой ссылкой, если нет weekly моложе 7 суток; хранение по количеству через `find | sort -r | tail -n +N | while read` (без `mapfile` и `head` с отрицательным числом); `predeploy-*` не трогает; `BACKUP_OK <файл>`.
- `deploy/backup/restore-check.sh`: последний `dvlab-daily-*.dump`, `test -s`, `DROP` и `CREATE DATABASE dvlab_restorecheck OWNER dvlab_migrator`, `pg_restore --exit-on-error`; число записей `drizzle.__drizzle_migrations` в копии от 1 до значения живой базы; таблицы `public` берутся из копии (`pg_tables`, `quote_ident`), для каждой проверяется наличие в живой базе (`to_regclass`) и что строк в копии не больше; вывод `migrations live=<n> restored=<n>`, `tables=<n>`, `RESTORE_OK`; `trap EXIT` удаляет временную базу. В живую базу идут только `select`.
- `deploy/systemd/dv-lab-backup.service`: `After=` и `Requires=docker.service`, `Type=oneshot`, `ExecStart=/opt/dv-lab/repo/deploy/backup/backup.sh`, `TimeoutStartSec=30min`, без `EnvironmentFile`. `deploy/systemd/dv-lab-backup.timer`: `OnCalendar=*-*-* 03:30:00`, `RandomizedDelaySec=10min`, `Persistent=true`, `WantedBy=timers.target`.

## Task Commits

1. **Задача 1: deploy.sh — от sha в master до DEPLOY_OK с репетицией миграций и откатом** — `063261d` (feat, tracer)
2. **Задача 2: ночной бэкап с хранением 14 daily и 8 weekly, проверка восстановления, юниты systemd** — `17a4c90` (feat)

**Plan metadata:** коммит `docs(17-08)` только с этим SUMMARY. STATE.md и ROADMAP.md обновляет оркестратор.

Счёт `commits: 2` взят по области `(17-08)`: `git log --oneline d7e8a85..HEAD --grep='(17-08)'`. В той же ветке параллельно коммитят другие исполнители, поэтому `git rev-list --count d7e8a85..HEAD` может включать чужие коммиты. `plan_head_after` — последний коммит этого плана до SUMMARY. Режим файлов в git: три скрипта `100755`, юниты `100644`.

## Проверки

| Проверка | Результат |
|----------|-----------|
| `bash -n deploy/deploy.sh && test -x deploy/deploy.sh` | код 0 |
| Маркеры этапов (`set -Eeuo pipefail`, `flock -n 9`, `exit 75`, `dvlab_migcheck_`, `MIGRATE_DB=`, `manifest inspect`, `DEPLOY_OK`), нет `grep -q`, `TEMPLATE`, `buildx`, `docker build`, `:latest`, нет `exec` без `-T` кроме `exec 9>` | код 0 |
| `grep -q -- '--force-recreate --no-deps caddy' deploy/deploy.sh` | код 0 |
| `DV_LAB_ROOT` в deploy.sh; вызов `ensure-db.sh` (строка 133) раньше `pg_dump` (строка 137) | выполнено |
| `bash -n` и `test -x` обоих скриптов бэкапа | код 0 |
| Прогон backup.sh с заглушкой docker из verify (20 daily, 10 старых weekly) | `BACKUP_OK`, 14 daily, 8 weekly, `dvlab-daily-20260901-033000.dump` удалён, новый дамп и weekly с правами 600 |
| Дополнительно: заглушка, падающая на `--list` | код 1, в каталоге не осталось ни `.part`, ни daily |
| Дополнительно: два запуска подряд в пустом каталоге | 2 daily, 1 weekly |
| Ключи юнитов, нет `restic`, `EnvironmentFile`, `AWS_`; `RESTORE_OK` и `dvlab_restorecheck` в restore-check.sh | код 0 |
| `pg_tables` и `tables=` в restore-check.sh; `pg_restore --list` (строка 29) раньше `mv` (строка 30) в backup.sh | выполнено |
| Нет комментариев, кроме shebang, нет IP-адресов, имён пользователей и паролей в файлах плана | выполнено |

Tracer-гейт задачи 1: все проверки задачи 1 перезапущены после коммита задачи 2 одним скриптом вместе с проверками задачи 2 и прошли.

### Не запущено

- `shellcheck` по трём скриптам: не установлен локально; выполняет CI (17-10).
- Прогон deploy.sh даже на заглушках: на Mac нет `flock` и каталога `/run/lock`, а создать его без sudo нельзя. Поведение блокировки (второй запуск, код 75), этапов и отката проверяет владелец на сервере (17-13); в плане это ребро помечено `backstop`.
- `docker compose config`, `docker manifest inspect` к GHCR без входа, `run --rm migrate`, `up --wait`: Docker локально нет (допущение A1 исследования, проверка в 17-13).
- `systemd-analyze verify` юнитов: локально нет systemd; ключи стандартные, проверка при установке владельцем (17-11).
- restore-check.sh не запускался: нужен Docker с базой; запуск владельцем в 17-13.

## Decisions Made

- Compose вызывается функцией `dc`, а не строкой `$COMPOSE`: пути в кавычках, shellcheck в CI не выдаст SC2086. Состав аргументов совпадает с планом.
- Дамп перед выкаткой проверяется до `mv` (в плане порядок `.part`, `mv`, проверка): так битый дамп не лежит под именем `predeploy-*`, а `trap EXIT` удаляет оставшийся `.part`.
- Права на дампы закрывает `install -d -m 700` для каталога, а не `umask 077` на весь deploy.sh: `git checkout` под таким umask создавал бы файлы клона с правами 600, и init-скрипт `ensure-db.sh`, который контейнер postgres запускает от пользователя postgres, не смог бы их прочитать.
- Этап `cleanup` снимает `trap ERR`, все его команды с `|| true`: ошибка очистки после успешной выкатки не запускает откат клона на PREV.
- `unset MIGRATE_DB` в начале deploy.sh: этап `migrate` гарантированно идёт в `dvlab`.
- В restore-check.sh вызовы `psql` получают stdin из `/dev/null`: `docker compose exec -T` читает stdin и внутри `while read` съел бы список таблиц.
- В юнит не добавлен `Environment=HOME=/root` из примера исследования: его нет в плане, а без restic он не нужен.

## Deviations from Plan

### Auto-fixed Issues

Нет.

### Отклонения от текста плана

- Порядок проверки и переименования дампа перед выкаткой, `install -d -m 700`, снятие `trap ERR` на `cleanup`, `unset MIGRATE_DB`, функция `dc` вместо переменной `COMPOSE` (см. Decisions Made). Поведение и маркеры этапов совпадают с планом, все проверки verify проходят.
- Указание «Не коммитить» в действиях задач заменено правилами оркестратора: каждая задача закоммичена отдельно.

**Total deviations:** 0 автоисправлений, 5 пояснений к тексту плана.
**Impact on plan:** объём работ не расширен.

## Issues Encountered

Нет.

## User Setup Required

Нет. Установку юнитов (`systemctl enable --now dv-lab-backup.timer`), каталоги `/opt/dv-lab/{state,backups/db,env}` и первый запуск `deploy.sh` описывают RUNBOOK (17-11) и шаги владельца (17-13).

## Next Phase Readiness

- 17-10 (CI): `shellcheck deploy/deploy.sh deploy/backup/*.sh` вместе с `deploy/postgres/ensure-db.sh`.
- 17-11 (RUNBOOK): копирование юнитов из `deploy/systemd/` в `/etc/systemd/system/`, `daemon-reload`, `enable --now dv-lab-backup.timer`; проверка часового пояса сервера (`timedatectl`); первая выкатка не требует `state/release.env`.
- 17-13: первый `deploy.sh` (этап `dry-run` и удаление `dvlab_migcheck_*`), второй одновременный запуск даёт код 75, `restore-check.sh` печатает `RESTORE_OK`.
- Фаза 26: в deploy.sh добавить защиту «активная комната ielts» (D-03) перед этапом `images`.

## Self-Check: PASSED

Все пять файлов из `key-files` существуют; коммиты `063261d` и `17a4c90` есть в `git log`; все проверки обеих задач перезапущены после последнего коммита и проходят.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09*
