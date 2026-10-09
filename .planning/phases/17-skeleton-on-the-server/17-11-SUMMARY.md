---
phase: 17-skeleton-on-the-server
plan: 11
subsystem: infra
tags: [runbook, vps, docker, ufw, ssh, dns, ghcr, deploy, backup, restore]

requires:
  - phase: 17-skeleton-on-the-server
    provides: "deploy/compose.yaml, deploy/caddy/Caddyfile, deploy/postgres/ensure-db.* (17-06); deploy/deploy.sh, deploy/backup/*, deploy/systemd/* (17-08)"
provides:
  - "deploy/RUNBOOK.md: разделы 0–9 и 5a, 34 блока bash для оператора от пустого VPS до DEPLOY_OK и RESTORE_OK"
affects: [17-13]

actuals:
  tokens: 9000
  tasks: 1
  commits: 1
plan_head_before: e1132ee1c78f67e373d313475085b820423ed3bd
plan_head_after: f27288fff0e39e29e6bdfa00e7064a58b1fac048

tech-stack:
  added: []
  patterns:
    - "Ручной вызов compose в RUNBOOK: SHA в начале блока, APP_TAG=\"sha-${SHA:?}\", функция dc с sudo env APP_TAG=\"$APP_TAG\" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env"
    - "Блоки, которые проверяют ожидаемый отказ (nc, alt-svc, HTTP/3), держат команду в условии if, чтобы set -e не обрывал блок на хорошем исходе"

key-files:
  created:
    - deploy/RUNBOOK.md
  modified: []

key-decisions:
  - "Блоки 5a и 9 переводят клон на SHA (git fetch и checkout --detach через sudo) до вызова compose: клон раздела 2 может быть старше merge-коммита"
  - "Раздел 9 переключает DNS на новый VPS до блока восстановления: smoke deploy.sh идёт по HTTPS через локальный Caddy, сертификат выдаётся только при DNS на сервер"
  - "Разделы 1–2 написаны идемпотентно (проверка существующего Docker, db.env, клона; mkdir -p не меняет права каталога данных Postgres): VPS уже подготовлен, те же блоки нужны для нового VPS"
  - "Раздел 4 содержит оба варианта GHCR: публичные пакеты с проверкой анонимного pull через пустой DOCKER_CONFIG и приватные пакеты с docker login токеном read:packages, введённым через read -s"
  - "Проверка TTL в 3.1 и DNS в 3.4 идёт к авторитетному NS зоны, чтобы TTL не был уменьшен кэшем резолвера"

requirements-completed: []

coverage:
  - id: D1
    description: "RUNBOOK: разделы 0–9 и 5a, не меньше 8 блоков bash, все проходят bash -n, есть set -Eeuo pipefail, нет | grep -q, || echo, redirect_url, файла состояния выкатки; блоки с compose.yaml задают APP_TAG из ${SHA:?}; нет адресов, кроме 127.0.0.1"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "python-проверка и grep-цепочка verify задачи 1 (scratchpad 17-11-verify.py, 17-11-grep.sh), перезапуск после коммита"
        status: pass
    human_judgment: false
  - id: D2
    description: "VPS подготовлен по разделам 1–2, автобэкап OVH включён, TTL корня не больше 60 с"
    requirement: INFRA-04
    verification:
      - kind: manual_procedural
        ref: "отчёт оператора (сессия Server guy) по блокам 1.2, 1.5, 2.2, 2.3, 2.4, 3.1 и панели OVH (задача 2)"
        status: pass
    human_judgment: true
    rationale: "У агента нет доступа к серверу, панели OVH и Vercel; итоги прислал оператор"

duration: 15min
completed: 2026-10-09
status: complete
---

# Phase 17 Plan 11: RUNBOOK сервера Summary

**`deploy/RUNBOOK.md` ведёт оператора от пустого VPS до `DEPLOY_OK` и `RESTORE_OK` 34 блоками bash: подготовка VPS, каталоги и пароли, DNS корня в Vercel, два варианта GHCR, проверка образов до переключения DNS, первая выкатка с разбором этапов отказа, проверка снаружи по IPv4 и IPv6, бэкапы, обычная выкатка и откат, восстановление после аварии. Подготовку VPS по разделам 1–2 оператор подтвердил отчётом (задача 2).**

## Performance

- **Duration:** около 15 мин
- **Completed:** 2026-10-09
- **Tasks:** 1 из 2 (задача 2 ждёт оператора)
- **Files modified:** 1

## Accomplishments

- Раздел 0: оператор (Server guy или владелец), `sudo` для `deploy.sh`, `backup.sh`, `restore-check.sh` и git в клоне root, блоки-подоболочки, переменные `VPS_IPV4`, `VPS_IPV6`, `CLIENT_IPV6`, `SHA`, `DUMP`, `SERVICE`, `GHCR_USER` с проверкой `${VAR:?}`, источник `SHA`, одна форма ручного compose, порядок первого релиза 1–2 → 3.1 → 4 → 5a → 3.3–3.4 → 5 → 6 → 7.
- Раздел 1: пакеты, Docker из официального репозитория (с запасным `docker.io`), ufw (OpenSSH, 80/tcp, 443/tcp), проверка входа по ключу с Mac до создания `00-dv-lab.conf`, `sshd -t`, перезапуск `ssh.socket` и `ssh`, `timedatectl`, автобэкап OVH.
- Раздел 2: каталоги `/opt/dv-lab`, `db.env` (600, `openssl rand -hex 24` под `umask 077`, без вывода; печатается только число строк), клон, проверочный блок.
- Раздел 3: TTL у авторитетного NS, замена ручных A корня и новая AAAA, список записей, которые не трогаются, проверка `DNS_OK`, TTL обратно к 300–3600, каталог сертификатов Caddy не удаляется.
- Раздел 4: вариант A (публичные пакеты, анонимный pull) и вариант B (приватные пакеты, `docker login` с `read:packages`).
- Раздел 5a: без caddy, `up -d --wait db`, `run --rm migrate` (`migrations applied`), `up -d --wait --wait-timeout 120 api web`, `ps`; блок `down`.
- Раздел 5: первая выкатка по текущему `deploy.sh` (`up -d --no-deps caddy`, `caddy reload`, smoke через `curl --resolve dv-lab.dev:443:127.0.0.1`), таблица «этап → где смотреть», блок `logs --tail 200`.
- Раздел 6: коды 200 по IPv4 и IPv6, нет `alt-svc` и HTTP/3, закрытые 5432, 3000, 4000, 2019 по обоим адресам, `ielts.dv-lab.dev` на Vercel, `CLIENT_IPV6` в журнале Caddy, остановка api не дольше 20 с с кодом 0.
- Раздел 7: юниты (с `systemd-analyze verify`), таймер только после первого `DEPLOY_OK`, разовый запуск с `Result=success` и `BACKUP_OK`, `restore-check.sh` → `RESTORE_OK`.
- Раздел 8: успех только `DEPLOY_OK`, `DEPLOY_SKIPPED` не успех, повтор с `FORCE=1`, код 75, откат прошлым sha.
- Раздел 9: DNS на новый VPS, `up -d --wait db`, `DROP DATABASE dvlab;` и `CREATE DATABASE dvlab OWNER dvlab_migrator;` отдельными `-c`, `sudo cat "$DUMP" | … pg_restore --exit-on-error`, `sudo env FORCE=1 deploy.sh "$SHA"`.

## Task Commits

1. **Задача 1: RUNBOOK от пустого VPS до DEPLOY_OK и RESTORE_OK** — `f27288f` (docs, tracer)

Задача 2 (checkpoint:human-action) закрыта отчётом оператора (сессия Server guy), см. раздел «Отчёт оператора».

## Отчёт оператора (задача 2)

Адреса, выводы и значения секретов в отчёт не входят; приведены итоги и коды.

| Блок | Результат |
|------|-----------|
| 1.2 Docker и compose | Docker 29.9.0, compose 5.6.0, buildx 0.38.0 |
| 1.5 время | Timezone=Etc/UTC, NTPSynchronized=yes |
| 2.1, 2.2 каталоги и `db.env` | `/opt/dv-lab/{env,backups/db,state,data/pg,data/caddy/data,data/caddy/config}` созданы, `env` и `backups/db` с правами 700, `db.env` 600, три имени паролей, значения сгенерированы на сервере |
| 2.3 клон | `/opt/dv-lab/repo` на master, HEAD 581632bb4aa228b931e1a7e2f1c2b26580b6ed5c; блоки 5a и 9 переводят его на `SHA` |
| 2.4 ufw и ssh | ufw: OpenSSH, 80/tcp, 443/tcp на IPv4 и IPv6, 443/udp закрыт; вход по ключу, пароль и root отклонены |
| 3.1 TTL | TTL всех записей уже 60 с; корень не привязан ни к одному проекту Vercel, записи AAAA нет |
| 1.6 автобэкап OVH | включён (Standard), подтвердил владелец в панели |

Решения владельца, переданные оператором: пакеты GHCR остаются приватными, на сервере `docker login ghcr.io` под root с токеном `read:packages`, который владелец вводит сам (блок 4.2, вариант B); переключение DNS апекса (блок 3.3) выполняет оператор через коннектор Vercel после блока 5a; копии бэкапов вне сервера в фазе нет (D-04).

Проверки оператора на VPS по коммиту fe4ed85: `docker compose config -q` (в том числе `--profile tools`) rc=0, `caddy validate` на caddy:2.11.7 rc=0 (keepalive 4s принят), в `deploy.sh` есть `caddy reload` и `--resolve`, `--force-recreate` нет; `ensure-db.sql` на свежем postgres:18.6 дважды rc=0.

Счёт `commits: 1` взят по области `(17-11)`: `git log --oneline e1132ee..HEAD --grep='(17-11)'`; в ветке параллельно коммитят другие исполнители.

## Проверки

| Проверка | Результат |
|----------|-----------|
| python-проверка verify задачи 1 | `34 blocks, bad: []`, код 0 |
| grep-цепочка verify задачи 1 (маркеры, нет IPv6 и IPv4, кроме 127.0.0.1) | код 0 |
| `deploy/deploy.sh` и `dv-lab-backup.timer` в RUNBOOK (key_links) | есть |
| Нет имени файла состояния выкатки, `!`, табуляций в RUNBOOK | выполнено |
| Tracer-гейт: python-проверка перезапущена после коммита | код 0 |
| Проверка адресов по этому SUMMARY | код 0 |

### Не запущено

- `shellcheck` по блокам RUNBOOK: не установлен локально.
- Блоки на сервере и на Mac: у агента нет доступа к VPS, Vercel и GitHub; выполняет оператор (задача 2 и 17-13).

## Deviations from Plan

### Auto-fixed Issues

Нет.

### Отклонения от текста плана

- RUNBOOK приведён к изменениям `deploy/` после начала плана (коммиты f07ca65, c5100ec, 5ee119d) и к сообщению оркестратора: caddy в `deploy.sh` перезагружается, а не пересоздаётся, smoke идёт через `--resolve`; разделы 0–2 написаны как идемпотентная проверка уже подготовленного VPS; порядок первого релиза 5a → DNS → 5 → 7; таймер бэкапа только после первого `DEPLOY_OK`; в разделе 3 корень не привязан к проектам Vercel, заменяются ручные A, добавляется AAAA, перечислены записи, которые не трогаются; в разделе 4 оба варианта GHCR.
- Блоки 5a и 9 переводят клон на `SHA` до compose (см. key-decisions), раздел 9 переключает DNS до блока восстановления.
- Адресат RUNBOOK — оператор (Server guy или владелец), а не только владелец.
- «Не коммитить» в действии задачи заменено правилами оркестратора: задача закоммичена.

## Issues Encountered

Нет.

## User Setup Required

Нет: подготовку VPS выполнил оператор, итоги записаны выше.

## Next Phase Readiness

- 17-13: разделы 4 (вариант B), 5a, 3.3–3.4, 5, 6, 7 RUNBOOK; оператор ждёт SHA образов после 17-12.

## Self-Check: PASSED

`deploy/RUNBOOK.md` существует; коммит `f27288f` есть в `git log`.

---
*Phase: 17-skeleton-on-the-server*
*Checkpoint: 2026-10-09*
