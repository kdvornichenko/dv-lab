---
phase: 19-student-cards-and-vault-import
plan: 15
subsystem: deploy
tags: [compose, runbook, import-vault, server, shred]

requires:
  - phase: 19-student-cards-and-vault-import
    provides: "import-vault parse (19-08), import-vault apply и приёмка на dvlab_dev со sha256 пакета (19-13)"
provides:
  - "deploy/compose.yaml: одноразовый сервис import (профиль tools, entrypoint node apps/api/dist/import-vault.mjs apply, роль dvlab_app)"
  - "deploy/RUNBOOK.md: раздел 11 (11.1 выкатка, 11.2 разовый импорт пакета, 11.3 повтор и после импорта), маркер NO_IMPORT_CONTAINER"
affects: [19-19]

tech-stack:
  added: []
  patterns:
    - "Одноразовые сервисы compose (migrate, bootstrap, import) — образ api, профиль tools, restart no, без ports и volumes"
    - "Пакет с данными учеников подаётся в контейнер через stdin (run --rm -T) и сразу уничтожается shred -u"

key-files:
  created: []
  modified:
    - deploy/compose.yaml
    - deploy/RUNBOOK.md

key-decisions:
  - "Блок 11.2 сам сверяет sha256 файла пакета с PACKET_SHA от владельца (sha256sum -c), а не только текстом; хеш не записан в RUNBOOK: при пересборке пакета он меняется"
  - "Проверка карточек без import_key идёт под -U postgres, как в разделе 9: оговорка 10.4 про аутентификацию dvlab_migrator не нужна"
  - "Аргумент apply в команде запуска не передаётся: он уже в entrypoint сервиса"
  - "При любой остановке блока до shred оператор удаляет пакет вручную; логи db назад не присылаются"

requirements-completed: []

actuals:
  tokens: 4500
  tasks: 2
  commits: 2

plan_head_before: 1167328b948a0ff18979a1156129edcbc24cf9a2
plan_head_after: 9dc46a3bdb45e3adf8e97e6734d1d75f29a251d9
duration: 15min
completed: 2026-10-10
status: complete
---

# Phase 19 Plan 15: сервис import в compose и раздел 11 RUNBOOK Summary

**Одноразовый сервис compose `import` запускает `import-vault apply` из образа api под ролью `dvlab_app`; раздел 11 RUNBOOK ведёт оператора от выкатки фазы 19 до разового импорта пакета со сверкой sha256, проверкой ручных карточек, `shred -u` и маркером `NO_IMPORT_CONTAINER`.**

## Performance

- **Duration:** около 15 мин
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `deploy/compose.yaml`: сервис `import` после `bootstrap` той же формы: образ `dv-lab-api:${APP_TAG:?}`, `profiles: ['tools']`, `restart: 'no'`, `logging: *logging`, `entrypoint: ['node', 'apps/api/dist/import-vault.mjs', 'apply']`, `NODE_ENV: production`, `DATABASE_URL` роли `dvlab_app`, `depends_on: db: service_healthy`. Без `ports`, `volumes`, `networks`. Остальные сервисы не менялись.
- `deploy/RUNBOOK.md`, раздел 11:
  - 11.1 — обычная выкатка по 8.1 или 8.2, миграция `20261009194959_student_cards` применяется этапом `migrate`, ожидаемо `DEPLOY_OK`.
  - 11.2 — как владелец делает пакет (stdout `parse` в файл без правки, sha256 с завершающим переводом строки равен записанному при приёмке на `dvlab_dev`), куда оператор кладёт пакет (домашний каталог `ubuntu`, не `/opt/dv-lab` и не клон), блок: проверка `SHA` и `PACKET_SHA` (64 hex), `[ -f "$PACKET" ]`, `sha256sum -c`, `count(*)` карточек без `import_key` должен быть 0, `dc --profile tools run --rm -T import < "$PACKET"`, `sudo shred -u "$PACKET"`, проверка контейнера, `NO_IMPORT_CONTAINER`. Ожидаемый вывод и счётчики первого запуска (25 карточек, 66 секций, 762 термина, 29 оплат), что присылается назад, остановки (`FAILED` у sha256, ручные карточки, код 2 `Invalid packet`, код 1 `Import failed`), ручной `shred -u` при остановке, удаление копий пакета у владельца и оператора.
  - 11.3 — повтор тем же пакетом ожидаемо даёт `inserted=0`, но возвращает удалённые учителем строки (дубли), поэтому импорт один раз; открывающий остаток учитель задаёт в интерфейсе.
- Раздел 0 RUNBOOK: в список переменных добавлены `PACKET`, `PACKET_SHA`, в форму вызова compose — раздел 11, в строку порядка — «Релиз фазы 19 — раздел 11».

## Task Commits

1. **Задача 1 (tracer): сервис import в compose** - `706099b` (feat)
2. **Задача 2: раздел 11 RUNBOOK** - `9dc46a3` (docs)

**Plan metadata:** коммит `docs(19-15)` с этим файлом.

## Проверки

| Проверка | Результат |
|----------|-----------|
| `SCRATCH/19-15-compose.sh`: команды шага CI `Client address trust` дословно | PASS (у api нет ports, у default `enable_ipv6: true`, trusted_proxies нет) |
| тот же скрипт: блок сервиса import (awk) | нет ports, volumes, networks, command; profiles tools, restart no, logging, образ, entrypoint с apply, NODE_ENV, DATABASE_URL dvlab_app, depends_on healthy; ролей migrator и postgres нет |
| разбор YAML пакетом `yaml` с merge-ключами | PASS, `COMPOSE_OK` |
| tracer-гейт: повтор скрипта после коммита | `COMPOSE_OK` |
| критерии задачи 1: `grep -n "import-vault.mjs"` со строкой apply, `grep -A12 "^  import:"` с `dvlab_app` | оба найдены |
| `SCRATCH/19-15-runbook.sh`: grep раздела 11, `run --rm -T import`, `NO_IMPORT_CONTAINER`, `shred -u` | PASS |
| адреса и секреты в разделе 11 (регулярное выражение плана) | 0 совпадений |
| форма `run --rm -T import apply` в разделе 11 | нет |
| блок 11.2 извлечён в файл SCRATCH, `bash -n` | PASS |
| shellcheck блока 11.2 | shellcheck недоступен (не установлен локально); CI-шаг shellcheck покрывает только `deploy/*.sh`, RUNBOOK им не проверяется |
| строка `sha256sum -c -` на пробном файле | совпадение — `OK` и код 0, чужой хеш — `FAILED` и ненулевой код |
| `yarn prettier --check deploy/compose.yaml deploy/RUNBOOK.md` | чисто |

Не запускалось: Docker и `docker compose config` (D-38, локально Docker не нужен), сборка образов, любые команды на сервере и реальный импорт на VPS — их выполняет Server guy по разделу 11 после релиза фазы. Предположение A3 (`run --rm -T` передаёт stdin хоста в контейнер) подтверждается при первом запуске на сервере.

## Decisions Made

См. key-decisions во frontmatter.

## Deviations from Plan

### Уточнения реализации (в рамках формулировок плана)

- Сверка sha256 пакета сделана строкой блока (`echo "$PACKET_SHA  $PACKET" | sha256sum -c -`) с новой переменной `PACKET_SHA`, а не только указанием в тексте. Ожидаемый хеш в RUNBOOK не записан: владелец присылает его вместе с пакетом.
- Небольшие правки раздела 0 RUNBOOK (список переменных, перечень разделов с функцией `dc`, строка порядка релизов), чтобы раздел 11 не вводил неописанные переменные.
- В разделе 11.2 добавлено, куда оператор кладёт пакет на сервере и что владелец и оператор удаляют свои копии после `NO_IMPORT_CONTAINER`; отдельная остановка на несовпадении sha256.
- Счётчик `commits` — два коммита задач по сообщениям `(19-15)`; коммит этого файла идёт после.

### Auto-fixed Issues

None.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. T-19-65: `shred -u` в блоке сразу после запуска и вручную при любой остановке, пакет вне клона, маска в `.dockerignore` (19-08). T-19-66: `apply` печатает только счётчики, `run --rm` и проверка `NO_IMPORT_CONTAINER`, логи db назад не присылаются. T-19-67: `DATABASE_URL` роли `dvlab_app`, профиль tools. T-19-68: у import нет ports, шаг CI `Client address trust` проходит. T-19-69: `SHA`, `PACKET`, `PACKET_SHA` пустые, адресов и секретов в разделе 11 нет.

## Next Phase Readiness

- 19-19: в AGENTS.md и итогах фазы — сервис `import` в `deploy/compose.yaml`; прогон раздела 11 на сервере — отложенный шаг Server guy после релиза фазы 19 (нужны sha256 пакета и счётчики приёмки от владельца).
- 19-16 идёт параллельно в той же волне, файлы не пересекаются.

## Self-Check: PASSED

- `deploy/compose.yaml` содержит `import-vault.mjs`, `deploy/RUNBOOK.md` содержит `NO_IMPORT_CONTAINER`.
- Коммиты `706099b` и `9dc46a3` есть в `git log`.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
