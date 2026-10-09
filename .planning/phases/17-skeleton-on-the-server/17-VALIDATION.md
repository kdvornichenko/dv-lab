---
phase: "17"
slug: "skeleton-on-the-server"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-09"
---

# Phase 17 — Validation Strategy

> Контракт проверки фазы для выборочной обратной связи во время исполнения. Источник: раздел Validation Architecture в `17-RESEARCH.md`. Колонки Task ID, Plan, Wave и Threat Ref заполняет планировщик после раскладки задач по планам.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.3 + vite 8.3.3 (DB-тесты в `packages/db` и `apps/api`; тесты остановки и логов запускают собранный `dist/server.mjs`) |
| **Config file** | `apps/api/vitest.config.ts`, `packages/db/vitest.config.ts` (Wave 0) |
| **Quick run command** | `yarn workspace @dv-lab/api vitest run` (нужны `DATABASE_URL` и `MIGRATOR_DATABASE_URL` на тестовую базу) |
| **Full suite command** | `yarn typecheck && yarn lint && yarn test && yarn build && yarn knip` |
| **Estimated runtime** | ~30 секунд на пакет, 2–4 минуты полный набор |

---

## Sampling Rate

- **After every task commit:** `yarn workspace <pkg> vitest run` и `yarn typecheck` затронутого пакета
- **After every plan wave:** `yarn typecheck && yarn lint && yarn test && yarn build`
- **Before `/gsd-verify-work`:** полный набор зелёный в CI на PR, затем чек-лист владельца (критерии 3–5)
- **Max feedback latency:** 60 секунд на пакет

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-T1 | 17-01 | 1 | INFRA-08 | T-17-01 | в коде нет старой платформы | shell | `git grep --untracked -n -i -E 'supa[b]ase' -- . ':(exclude).planning'; test $? -eq 1` (в CI без `--untracked`) | ✅ команда | ⬜ pending |
| 17-01-T1 | 17-01 | 1 | INFRA-05 | T-17-SC, T-17-02 | точные версии, возрастной барьер Yarn не отключён, одна версия пакета на все workspace | install | `yarn install --immutable && yarn dedupe --check` | ✅ команда | ⬜ pending |
| 17-01-T2 | 17-01 | 1 | INFRA-05 | T-17-SC | владелец одобрил yarn.lock и список прямых зависимостей | manual (blocking-human) | — | — | ⬜ pending |
| 17-01-T3 | 17-01 | 1 | D-01, D-11 | T-17-01 | .env и .env.test вне git и указывают на dvlab_dev и dvlab_test | shell | `git check-ignore -q .env && git check-ignore -q .env.test` и проверка имён баз без вывода значений | ✅ команда | ⬜ pending |
| 17-02-T1 | 17-02 | 2 | INFRA-01, INFRA-05 | T-17-03 | standalone web собирается без шрифтов из Google и отвечает 200 | build + smoke | `yarn workspace @dv-lab/web build` и запуск `apps/web/.next/standalone/apps/web/server.js` | ❌ W0 | ⬜ pending |
| 17-02-T2 | 17-02 | 2 | D-07, INFRA-05 | T-17-04 | в web нет кода api и базы | lint + shell | `yarn workspace @dv-lab/web lint`, `test ! -e apps/web/app/api`, проверка манифеста web | ❌ W0 | ⬜ pending |
| 17-03-T1 | 17-03 | 2 | INFRA-02, INFRA-08 | T-17-06 | миграция под dvlab_migrator, DML под dvlab_app в dvlab_test | integration | `yarn workspace @dv-lab/db test` (packages/db/test/roles.test.ts) | ❌ W0 | ⬜ pending |
| 17-03-T1 | 17-03 | 2 | INFRA-08 | — | одна новая миграция Drizzle v1, повторный generate не создаёт папок, нет CREATE EXTENSION | shell | `yarn workspace @dv-lab/db db:generate` и подсчёт папок в packages/db/drizzle | ❌ W0 | ⬜ pending |
| 17-03-T2 | 17-03 | 2 | INFRA-02, D-06 | T-17-06, T-17-07, T-17-08, T-17-09 | права ролей, защита _test, параллельные миграции, контракт env | integration + unit | `yarn workspace @dv-lab/db test --sequence.shuffle` (roles.test.ts, connection.test.ts) | ❌ W0 | ⬜ pending |
| 17-04-T1 | 17-04 | 2 | INFRA-07, D-05, D-08 | T-17-10 | одна JSON-строка доступа с requestId, x-request-id в ответе | unit | `yarn workspace @dv-lab/api test` (apps/api/test/request-context.test.ts) | ❌ W0 | ⬜ pending |
| 17-04-T2 | 17-04 | 2 | INFRA-07, D-08 | T-17-10, T-17-11, T-17-12 | формат id, конверт ошибки, 404, фон, параллельные запросы, redact | unit | `yarn workspace @dv-lab/api test` | ❌ W0 | ⬜ pending |
| 17-05-T1 | 17-05 | 3 | INFRA-07 | T-17-13, T-17-14, T-17-15 | dist/migrate.mjs: под migrator код 0, под app отказ, параллельно оба успешны | integration (spawn) | `yarn workspace @dv-lab/api build && yarn workspace @dv-lab/api test` (migrate.test.ts) | ❌ W0 | ⬜ pending |
| 17-05-T2 | 17-05 | 3 | INFRA-07, INFRA-08 | T-17-13 | [BLOCKING] миграции применены в dvlab_dev и dvlab_test, журнал равен числу папок; URL-переменные родительского окружения в дочерний процесс не попадают, имя базы печатается рядом с числом | integration | node-скрипт сверки журнала из 17-05, задача 2 (печатает `.env dvlab_dev N N` и `.env.test dvlab_test N N`) | ✅ команда | ⬜ pending |
| 17-06-T1 | 17-06 | 3 | INFRA-01, D-02, D-07 | T-17-16, T-17-17, T-17-18, T-17-20, T-17-44 | наружу только 80 и 443/tcp, HTTP/3 выключен, X-Request-Id перезаписан, нет секретов и адресов, журналы всех сервисов с ротацией (x-logging, driver local) | static | python-проверка compose, grep Caddyfile; `caddy validate` в CI | ❌ W0 | ⬜ pending |
| 17-06-T2 | 17-06 | 3 | INFRA-02, D-13 | T-17-19 | ensure-db.sql идемпотентен и даёт ту же раскладку ролей, что домашний сервер | integration (временный PG 17) | временный кластер, два прогона ensure-db.sql, `yarn workspace @dv-lab/db test` | ❌ W0 | ⬜ pending |
| 17-07-T1 | 17-07 | 4 | INFRA-06, D-09 | T-17-21 | собранный api отвечает /healthz с базой и выходит по SIGTERM с кодом 0 до срока | integration (spawn) | `yarn workspace @dv-lab/api test` (shutdown.test.ts) | ❌ W0 | ⬜ pending |
| 17-07-T2 | 17-07 | 4 | D-06, INFRA-06 | T-17-21, T-17-22, T-17-23 | конфигурация без подмен, срок и идемпотентность остановки, 503 при остановке | unit | config.test.ts, lifecycle.test.ts, health.test.ts через `yarn workspace @dv-lab/api test` | ❌ W0 | ⬜ pending |
| 17-08-T1 | 17-08 | 4 | INFRA-03, INFRA-01, D-01a, D-03 | T-17-24, T-17-25 | этапы deploy.sh (ensure-db до дампа), flock и код 75, репетиция миграций на копии, пересоздание caddy при переключении, откат с checkout коммита PREV, без сборки на сервере | static | `bash -n deploy/deploy.sh`, grep-маркеры, `grep -q -- '--force-recreate --no-deps caddy' deploy/deploy.sh`; shellcheck в CI | ❌ W0 | ⬜ pending |
| 17-08-T2 | 17-08 | 4 | INFRA-04, D-04 | T-17-26, T-17-27, T-17-28 | хранение 14 daily и 8 weekly, .part проверяется до переименования, restore только во временную базу со сверкой журнала и count(*) таблиц public | shell (заглушка docker) | прогон `deploy/backup/backup.sh` с DV_LAB_ROOT и заглушкой docker | ❌ W0 | ⬜ pending |
| 17-09-T1 | 17-09 | 5 | INFRA-06, D-09 | T-17-31 | SIGTERM с открытым WebSocket: выход 0 до срока, код закрытия 1001 | integration (spawn) | `yarn workspace @dv-lab/api test` (shutdown.test.ts) | ❌ W0 | ⬜ pending |
| 17-09-T2 | 17-09 | 5 | INFRA-06 | T-17-29, T-17-30, T-17-31 | чужой Origin 403, кадр больше 64 KiB закрывается 1009, зависший клиент обрывается | integration + unit | ws.test.ts, lifecycle.test.ts | ❌ W0 | ⬜ pending |
| 17-11-T1 | 17-11 | 5 | INFRA-01, INFRA-04 | T-17-36, T-17-37, T-17-38 | блоки RUNBOOK проходят bash -n и правила блоков, ручной compose только с APP_TAG из `${SHA:?}` и db.env (без release.env), раздел 5a, раздел 9 с DROP и CREATE DATABASE, адресов и секретов нет | static | python-проверка блоков deploy/RUNBOOK.md и grep-маркеры разделов | ❌ W0 | ⬜ pending |
| 17-11-T2 | 17-11 | 5 | INFRA-01, INFRA-04 | T-17-36, T-17-37, T-17-38, T-17-45 | VPS подготовлен, автобэкап OVH включён, TTL известен, в SUMMARY нет адресов | owner-run | вывод проверочного блока RUNBOOK от владельца; grep IPv4 и IPv6 по 17-11-SUMMARY.md пуст | — | ⬜ pending |
| 17-10-T1 | 17-10 | 6 | INFRA-02, INFRA-05, INFRA-08 | T-17-32 | CI на PR и push в master, Verify на postgres:18 под ролями сервера, shellcheck -S warning, полный набор зелёный | static + full suite | python-проверка ci.yml; `yarn typecheck && yarn lint && yarn test && yarn build && yarn knip` | ❌ W0 | ⬜ pending |
| 17-10-T2 | 17-10 | 6 | INFRA-03 | T-17-33, T-17-34, T-17-35, T-17-SC | образы только после Verify, теги sha-<sha>, без секретов, USER node | static | turbo prune обоих приложений, grep Dockerfile и .dockerignore, python-проверка job images | ❌ W0 | ⬜ pending |
| 17-10-T3 | 17-10 | 6 | — | — | AGENTS.md и CLAUDE.md без GitNexus, без адресов | static | grep по AGENTS.md, CLAUDE.md, README.md | ❌ W0 | ⬜ pending |
| 17-12-T1 | 17-12 | 7 | INFRA-02, INFRA-03 | T-17-40 | первый прогон CI на PR зелёный | CI | `gh pr checks <номер> --watch` | — | ⬜ pending |
| 17-12-T3 | 17-12 | 7 | INFRA-03 | T-17-39 | образы sha-<sha> опубликованы и доступны серверу | CI + анонимный доступ | анонимный HEAD манифестов ghcr.io (node-скрипт из 17-12) | — | ⬜ pending |
| 17-13-T2 | 17-13 | 8 | INFRA-01, INFRA-03, INFRA-04 | T-17-43, T-17-46 | DEPLOY_OK (DEPLOY_SKIPPED не успех), BACKUP_OK, RESTORE_OK; /healthz с sha merge-коммита и db ok; в SUMMARY нет адресов | owner-run + curl с Mac | node-проверка https://dv-lab.dev/healthz из 17-13 | — | ⬜ pending |
| 17-13-T3 | 17-13 | 8 | INFRA-01, INFRA-06 | T-17-41, T-17-42, T-17-46 | только прокси наружу, нет alt-svc, ielts на Vercel, остановка api до 20 с; в SUMMARY нет адресов (grep IPv4 и IPv6 по 17-13-SUMMARY.md пуст) | owner-run + curl/nc с Mac | curl и nc с Mac по IPv4, вывод владельца по IPv6 | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/db/vitest.config.ts` (17-03-T1), `apps/api/vitest.config.ts` (17-04-T1) — конфиги Vitest, загрузка `.env.test`
- [ ] `packages/db/test/roles.test.ts` (17-03-T1, T2) — роль без суперпользователя, DDL запрещён, default privileges, параллельные миграции
- [ ] `packages/db/test/connection.test.ts` (17-03-T2), `apps/api/test/config.test.ts` (17-07-T2) — выбор URL и роли, ошибки `PORT` и `APP_ORIGIN`
- [ ] `apps/api/test/request-context.test.ts` (17-04-T1, T2) — `requestId` в строке доступа, в ошибке и в фоновой задаче
- [ ] `apps/api/test/shutdown.test.ts` (17-07-T1, 17-09-T1) и `apps/api/test/lifecycle.test.ts` (17-07-T2, 17-09-T2) — остановка без соединений, с WebSocket и с зависшими соединениями
- [ ] `apps/api/test/migrate.test.ts` (17-05-T1) — `dist/migrate.mjs` под двумя ролями и параллельно
- [ ] `apps/api/test/health.test.ts` (17-07-T2), `apps/api/test/ws.test.ts` (17-09-T2)
- [ ] шаги CI (17-10-T1, T2): проверка устаревшего кода, граница web и api, синхронность Drizzle, `caddy validate`, `shellcheck`, проверка образа
- [ ] установка `vitest@5.0.3` и `vite@8.3.3` (обязательный peer) — 17-01-T1

---

## Manual-Only Verifications

Выполняет владелец через сессию «Server guy»; у агентов доступа к серверу нет.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `https://dv-lab.dev` отдаёт web и `/healthz` по IPv4 и IPv6 | INFRA-01 | нужен VPS и DNS | 17-13-T2, T3: `curl -4 -s -o /dev/null -w '%{http_code}\n' https://dv-lab.dev/healthz`, то же с `-6` → `200` |
| Снаружи открыты только 80/443, 443/udp закрыт, HTTP/3 выключен | INFRA-01 | нужен VPS | 17-13-T3: порты api, web, Postgres и админка Caddy недоступны по IPv4 и IPv6; `curl -sI https://dv-lab.dev` без `alt-svc` |
| `ielts.dv-lab.dev` остаётся на Vercel | INFRA-01 | нужен DNS | 17-13-T1, T3: `dig +short ielts.dv-lab.dev` не содержит адрес VPS, страница открывается |
| Сервер тянет образы без токена и перезапускает без сборки | INFRA-03 | нужен VPS и публичность пакета GHCR | 17-12-T3 (анонимный манифест), 17-13-T1: раздел 5a RUNBOOK до переключения DNS (migrate успешен, api и web healthy без caddy), 17-13-T2: `deploy.sh` завершается `DEPLOY_OK` |
| Бэкап идёт по расписанию, последний восстановлен один раз | INFRA-04 | нужен VPS | 17-13-T2: `systemctl list-timers dv-lab-backup.timer`, `systemctl show -p Result dv-lab-backup.service` → `Result=success`, `restore-check.sh` → `RESTORE_OK` |
| Репетиция миграций на временной копии | D-01a | нужен VPS | 17-13-T2: этап `dry-run` в `deploy.sh` проходит, временная база удалена |
| Подготовка VPS, автобэкап OVH, TTL | INFRA-01, INFRA-04, D-16 | нужен VPS и панели OVH и Vercel | 17-11-T2: вывод проверочного блока RUNBOOK |
| Страница-заглушка в браузере, остановка api в контейнере, IPv6-адрес клиента в журнале Caddy | INFRA-01, INFRA-06 | нужен живой сайт и сервер | 17-13-T3 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
