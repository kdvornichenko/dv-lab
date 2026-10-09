---
phase: 17-skeleton-on-the-server
verified: 2026-10-09T15:00:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - .github/workflows/ci.yml
  - apps/api/src/lifecycle.ts
  - deploy/compose.yaml
  - deploy/deploy.sh
covered_digest: "v2:sha256:4a08943e269a29fbe3a99bd00025c492d58ed6ea50b4837b72d4c8336b387d67"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Вернуть TTL записей апекса dv-lab.dev к 300-3600 в панели Vercel (RUNBOOK 3.5)"
    expected: "TTL в панели в диапазоне 300-3600"
    why_human: "Коннектор оператора только читает DNS; шаг владельца"
  - test: "Выкатить релиз с правкой сети compose (коммит 2bcd8c0): один раз пересоздать сеть dv-lab_default (down без -v, затем deploy.sh)"
    expected: "remote_ip IPv6-клиента в журнале Caddy равен адресу клиента, а не шлюзу Docker"
    why_human: "Действует со следующего релиза, доступ к серверу только у оператора"
  - test: "Необязательно: открыть https://dv-lab.dev в браузере"
    expected: "Заглушка web отображается"
    why_human: "Визуальная проверка; снаружи curl вернул 200 HTML"
---

# Phase 17: Skeleton on the Server. Отчёт проверки

**Цель:** пустой скелет из очищенного монорепо на последних библиотеках работает на VPS OVHcloud за HTTPS, с CI, опубликованными образами и восстанавливаемыми бэкапами.
**Статус:** human_needed (цель достигнута, остались два шага владельца и один необязательный визуальный)
**Повторная проверка:** нет

## Критерии roadmap

| # | Критерий | Статус | Доказательства |
|---|----------|--------|----------------|
| 1 | Репозиторий только со скелетом, `packages/db` на Drizzle v1 с новой историей, `supabase` не найден, версии последние | VERIFIED | `git ls-files` вне `.planning`: ни одного `supabase`; в `packages/db/drizzle` одна миграция `20261009120830_init` вместо 14; `apps/` только `api`, `web`; `packages/` только `contracts`, `db`; next 16.4.0, react 19.3.0, typescript 6.0.3, drizzle-orm 1.0.0-rc.4, turbo 2.11.7, yarn 4.18.1. CI проверяет отсутствие `supabase` шагом Legacy code check |
| 2 | CI на каждый PR и push в master, тесты БД на PG 18 под ролью без суперпользователя, зелёный | VERIFIED | `.github/workflows/ci.yml`: триггеры `pull_request` и `push: master`, сервис `postgres:18`, `DATABASE_URL` под `dvlab_app`; `roles.test.ts` проверяет `rolsuper=false`, отказ на `create table`/`truncate`. `gh run`: master run 37941198943 success (Verify, Image web, Image api); PR #2 MERGED, merge-коммит 17868c4 |
| 3 | Merge в master публикует образы в GHCR, сервер тянет их без сборки | VERIFIED | job `images` публикует `sha-<полный sha>` и `latest` на push; `compose.yaml` использует `ghcr.io/kdvornichenko/dv-lab-{web,api}:${APP_TAG}`; `deploy.sh` ждёт манифесты, делает `dc pull`, не вызывает `build`. Первая выкатка `DEPLOY_OK none -> sha-17868c4...` за 21 с (отчёт оператора 17-13) |
| 4 | `dv-lab.dev` отдаёт web и health по IPv4/IPv6, закрыты все порты кроме прокси, HTTP/3 выключен, `ielts` на Vercel | VERIFIED | Сам проверил: `curl -4` и `curl -6 -sI /` дают 200 (HTTP/2, `via: Caddy`); `/healthz` вернул `{"status":"ok","sha":"17868c49...","db":"ok"}`; `alt-svc` нет, в Caddyfile `protocols h1 h2`; `nc` на 5432, 4000, 3000, 2019, 8080 отказ, 443 открыт; `ielts.dv-lab.dev` отвечает 307 `/login`, `server: Vercel` |
| 5 | Бэкапы по расписанию и одно восстановление; SIGTERM за ограниченное время с открытыми WS; структурные логи с request id; миграции отдельным шагом | VERIFIED | `backup.sh` (14 daily + 8 weekly, проверка `pg_restore --list`), таймер 03:30 с разбросом; оператор: `BACKUP_OK`, `RESTORE_OK` за 3 с, `stop api` за 0,3 с, код 0. В коде: `lifecycle.ts` (дедлайн, закрытие WS 1001, terminate на половине дедлайна, `exit(0)`), `request-context.ts` (requestId в pino через AsyncLocalStorage, заголовок `x-request-id`), `apps/api/src/migrate.ts` и сервис `migrate` (profile tools, роль `dvlab_migrator`), `/ws` с проверкой Origin (403 `forbidden_origin`) |

**Счёт:** 5/5. Поведенческие инварианты (остановка, WS): тесты `shutdown.test.ts`, `ws.test.ts` лежат в репозитории и входят в зелёный CI (turbo `test` зависит от `build`); локально без сборки `dist/server.mjs` их не запускал, это артефакт окружения проверки, не дефект.

## Требования

| ID | План(ы) | Статус |
|----|---------|--------|
| INFRA-01 | 01, 05, 06, 11, 13 | SATISFIED (живой HTTPS) |
| INFRA-02 | 03, 05, 10, 12 | SATISFIED (CI зелёный) |
| INFRA-03 | 08, 10, 12, 13 | SATISFIED |
| INFRA-04 | 08, 11, 13 | SATISFIED (RESTORE_OK, отчёт оператора) |
| INFRA-05 | 01, 04, 10 | SATISFIED |
| INFRA-06 | 07, 09, 13 | SATISFIED |
| INFRA-07 | 02, 06, 07 | SATISFIED |
| INFRA-08 | 03, 04 | SATISFIED |

Все 8 ID объявлены во frontmatter планов и есть в REQUIREMENTS.md; осиротевших требований нет.

## Антипаттерны

Маркеров TBD/FIXME/XXX в файлах проверки не найдено; заглушек нет (`deferred-items.md`: все пункты resolved).

## Замечания (не блокируют)

- Устаревший учёт: в ROADMAP.md план 17-12 и 17-13 не отмечены, строка "11/13 plans executed"; в REQUIREMENTS.md INFRA-01..08 стоят "Pending". Нужно обновить при закрытии фазы.
- До пересоздания сети лимит попыток входа по IP считает всех IPv6-клиентов одним адресом шлюза (важно для фазы 18).
- Серверные факты (выкатка, порты, бэкап, остановка api) опираются на отчёт оператора Server guy; внешняя часть проверена мной сама.

---

_Verified: 2026-10-09T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
