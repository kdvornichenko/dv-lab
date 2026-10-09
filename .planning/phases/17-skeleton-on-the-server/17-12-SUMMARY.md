---
phase: 17-skeleton-on-the-server
plan: 12
subsystem: infra
tags: [github, pull-request, ci, ghcr, release]

requires:
  - phase: 17-skeleton-on-the-server
    provides: "ci.yml с job Verify и сборкой образов (17-10), RUNBOOK (17-11)"
provides:
  - "PR #2 слит в master, merge-коммит 17868c4969f15ee0b1012b91d2c06b5d2070757f"
  - "Образы ghcr.io/kdvornichenko/dv-lab-web и dv-lab-api с тегами sha-17868c4969f15ee0b1012b91d2c06b5d2070757f и latest"
affects: [17-13]

requirements-completed: []

completed: 2026-10-09
status: complete
---

# Phase 17 Plan 12: PR, merge и публикация образов Summary

**PR #2 ветки `gsd/phase-17-skeleton-on-the-server` прошёл CI (Verify, Image web, Image api) и слит владельцем в master; запуск CI на push в master зелёный и опубликовал приватные образы с тегом `sha-17868c4969f15ee0b1012b91d2c06b5d2070757f` и `latest`.**

## Что произошло

- PR открыт ведущей сессией через `gh pr create` (после коммитов и пуша ветки по указанию владельца). Проверки на PR: Verify, Image web, Image api завершились success, mergeable CLEAN.
- Слияние сделал владелец (merge-коммит): ведущей сессии автоматическое `gh pr merge` не разрешено классификатором прав.
- Запуск CI на push в master (run 37941198943): Verify, Image web, Image api success.
- Решение владельца по видимости пакетов GHCR (вместо checkpoint:decision задачи 2): пакеты остаются **приватными**, сервер входит в GHCR токеном `read:packages` (блок 4.2 RUNBOOK выполнен на VPS оператором Server guy: `docker login` принят, `docker manifest inspect` несуществующего тега отвечает `manifest unknown`). Публичные пакеты отвергнуты.

## Отклонения от плана

- Задача 3: вместо анонимной проверки манифестов выбран вариант private-token; проверка образов с сервера выполняется блоком 5a RUNBOOK (17-13), а не анонимным запросом с Mac.
- Задача 1: коммит и push делает ведущая сессия (владелец разрешил полный цикл GSD с коммитами), а не владелец вручную.

## Что дальше

17-13: оператор Server guy выполняет разделы 5a, 3.3-3.4, 5, 6, 7 RUNBOOK с SHA `17868c4969f15ee0b1012b91d2c06b5d2070757f`.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09*
