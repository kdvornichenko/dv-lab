---
phase: 17-skeleton-on-the-server
plan: 13
subsystem: infra
tags: [vps, deploy, dns, https, backup, restore, ipv6]

requires:
  - phase: 17-skeleton-on-the-server
    provides: "образы sha-17868c4969f15ee0b1012b91d2c06b5d2070757f (17-12), RUNBOOK (17-11), deploy.sh и бэкап (17-08)"
provides:
  - "Живой https://dv-lab.dev на VPS: web и api за Caddy, сертификат Let's Encrypt, HTTP/3 выключен"
  - "Первая выкатка deploy.sh: DEPLOY_OK none -> sha-17868c4969f15ee0b1012b91d2c06b5d2070757f за 21 с"
  - "Ночной бэкап включён (таймер 03:35 UTC), восстановление проверено: RESTORE_OK"
affects: [phase-18]

requirements-completed: [INFRA-01, INFRA-03, INFRA-04, INFRA-06]

completed: 2026-10-09
status: complete
---

# Phase 17 Plan 13: первая выкатка на VPS Summary

**Скелет живёт на `dv-lab.dev` за HTTPS: оператор Server guy выполнил разделы 5a, 3.3-3.4, 5, 6, 7 RUNBOOK; первая выкатка `deploy.sh` закончилась `DEPLOY_OK` за 21 с, бэкап создан и восстановлен (`RESTORE_OK`). Адреса и сырой вывод остались у оператора (D-11), здесь только итоги.**

## Итоги по разделам RUNBOOK (отчёт оператора)

| Раздел | Результат |
|--------|-----------|
| 5a образы до DNS | образы api и web тянутся с токеном `read:packages`, `migrate` печатает `migrations applied` (повтор тоже без ошибок), api, db, web healthy, `/healthz` изнутри: status ok, sha релиза, db ok; caddy не запущен |
| 3.3-3.4 DNS | апекс A -> VPS_IPV4 и AAAA -> VPS_IPV6 у авторитетного NS и у публичного резолвера; `ielts.dv-lab.dev` и `vault.dv-lab.dev` остаются на Vercel и отвечают 307 |
| 5 первая выкатка | `DEPLOY_OK none -> sha-17868c4969f15ee0b1012b91d2c06b5d2070757f`, 21 с: ensure-db, предрелизный дамп, репетиция миграций на копии, migrate, switch, `caddy up` и `reload`, smoke (`healthz` ok с нужным sha, web 200). Сертификат Let's Encrypt выдан при старте Caddy, действует до 2027-01-07 |
| 6.1 снаружи | `/healthz` и `/` по IPv4 и IPv6 отвечают 200, тело healthz с текущим sha и db ok |
| 6.2 заголовки | `alt-svc` нет (HTTP/3 выключен, 443/udp закрыт ufw); HSTS, nosniff, Referrer-Policy на месте, заголовка Server нет |
| 6.3 порты | 5432, 3000, 4000, 2019, 8080 закрыты по v4 и v6; открыты только 22, 80, 443 |
| 6.4 соседние домены | ielts и vault не затронуты |
| 6.5 адрес клиента | по IPv4 `remote_ip` в журнале Caddy равен адресу клиента; **по IPv6 `remote_ip` равен шлюзу Docker**: сеть compose `dv-lab_default` была без IPv6 и Docker проводил IPv6 через userland-proxy |
| 6.6 остановка api | `stop api` за 0,3 с, код выхода 0, в журнале `shutdown start` -> `shutdown complete`; `up -d --wait api` healthy |
| 7.1-7.3 бэкапы | юниты установлены, `dv-lab-backup.timer` enabled и active (следующий запуск 03:35 UTC); `BACKUP_OK`, weekly создан жёсткой ссылкой; восстановление: `migrations live=1 restored=1`, `tables=1`, `RESTORE_OK` за 3 с |

## Находки и правки после выкатки

- **D-26 (IPv6-клиент):** проверенное оператором лекарство (сеть compose с `enable_ipv6` и ULA-подсеткой, опубликованы по-прежнему только 80/443 у caddy) внесено в `deploy/compose.yaml` коммитом 2bcd8c0 на ветке фазы 18; при выкатке с этой правкой существующую сеть `dv-lab_default` нужно один раз пересоздать (`down` без `-v`, затем `deploy.sh`; короткий простой). До этого ограничение попыток входа по IP считает всех IPv6-клиентов одним адресом шлюза.
- `docker compose run --rm migrate` без `-T` съедает остаток блока, поданного через `ssh ... bash -s`: `-T` добавлен в `deploy.sh` и RUNBOOK 5a (коммит e6d9fa9).
- Предрелизный дамп создавался с правами 644 (daily 600): `umask 077` применён только вокруг `pg_dump` (глобальный `umask` сломал бы права файлов клона для init-скрипта postgres), коммит 2bcd8c0.
- Smoke принимает 200 или 307 на корне (f4f7b49), чтобы первая выкатка релиза со входом не откатывалась скриптом предыдущего релиза.

## Для владельца

- Раздел 3.5 RUNBOOK: вернуть TTL записей апекса к 300-3600 в панели Vercel (коннектор оператора только читает DNS).
- Пакеты GHCR приватные, на VPS вход `read:packages` выполнен владельцем.

## Self-Check: PASSED

Критерии 1, 3, 4, 5 roadmap фазы 17 подтверждены отчётом оператора; критерий 2 (CI на PostgreSQL 18 под ролью без прав суперпользователя) подтверждён зелёным Verify в PR #2 и на master.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09*
