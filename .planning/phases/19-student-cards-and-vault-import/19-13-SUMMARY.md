---
phase: 19-student-cards-and-vault-import
plan: 13
subsystem: api-import
tags: [import-vault, apply, idempotent, advisory-lock, drizzle, dvlab_dev]

requires:
  - phase: 19-student-cards-and-vault-import
    provides: "importCard (19-07), import-vault parse и importPacket (19-08), addMissingSections и addMissingTerms (19-09), addMissingPayments (19-10)"
provides:
  - "apps/api/src/import/apply-packet.ts: applyPacket(db, packet) → { students, sections, terms, payments } × { inserted, skipped }"
  - "apps/api/src/import-vault.ts: команда apply (stdin, Invalid packet, Import failed (CODE), коды 0, 1, 2)"
  - "dvlab_dev: 25 карточек vault, 66 секций, 762 термина, 29 оплат vault (1 несопоставленная)"
affects: [19-15, 19-19]

tech-stack:
  added: []
  patterns:
    - "Импорт пишет только через функции модуля карточек; в apply-packet.ts нет insert и update"
    - "Одна транзакция на пакет с pg_advisory_xact_lock(hashtext('dvlab_import_vault'))"
    - "apply печатает только четыре строки счётчиков; ошибки без содержимого пакета"

key-files:
  created:
    - apps/api/src/import/apply-packet.ts
  modified:
    - apps/api/src/import-vault.ts

key-decisions:
  - "Счётчик payments включает несопоставленные переводы: 28 оплат учеников + 1 несопоставленная = 29, как в критерии плана"
  - "Неверный JSON и пакет не по схеме дают одно и то же сообщение Invalid packet и код 2"
  - "Карточка CARD-06 ищется по имени папки без учёта регистра в памяти скрипта, ключ в SQL и вывод не попадает"

requirements-completed: [CARD-06, CARD-07]

actuals:
  tokens: 1500
  tasks: 2
  commits: 2

plan_head_before: 0d12958c73131a6dc1be9cf0de3e362a5301d44f
plan_head_after: fdb174d
duration: 20min
completed: 2026-10-10
status: complete
---

# Phase 19 Plan 13: import-vault apply и импорт vault в dvlab_dev Summary

**`import-vault apply` пишет проверенный пакет одной транзакцией с advisory-блокировкой только через importCard, addMissingSections, addMissingTerms и addMissingPayments; vault импортирован в dvlab_dev (25 карточек, 66 секций, 762 термина, 29 оплат), повторный прогон вставляет 0 строк и не меняет id.**

## Performance

- **Duration:** около 20 мин
- **Tasks:** 2
- **Files modified:** 2 (1 создан, 1 изменён)

## Accomplishments

- `apply-packet.ts`: `applyPacket(db, packet)` в одной `db.transaction`: `select pg_advisory_xact_lock(hashtext('dvlab_import_vault'))`, для каждого ученика `importCard` (ставка из пакета или null, минуты урока из ставки или 60, остальные поля пусты, статус active), затем секции, термины и оплаты с id карточки, в конце несопоставленные оплаты с `studentId: null`. `skipped = попытки − вставлено` по каждой таблице.
- `import-vault.ts`: команда `apply` читает весь stdin, `JSON.parse` и `importPacket.safeParse`; неудача — `Invalid packet` и код 2 без содержимого; `createDb(resolveDatabaseUrl('app', process.env))`, четыре строки `<table> inserted=N skipped=M`, ошибка — `Import failed (CODE)` или `Import failed` и код 1, `pool.end()` в `finally`. Usage дополнен строкой `import-vault apply < packet.json`.
- dvlab_dev содержит данные vault: проверено счётчиками, повтором и снимком id.

## Task Commits

1. **Задача 1 (tracer): apply через модуль карточек, вымышленный пакет в dvlab_test** - `fdb174d` (feat)
2. **Задача 2: прогон импорта vault на dvlab_dev** - без коммита: файлов задача не меняет, результат — данные в dvlab_dev

**Plan metadata:** коммит `docs(19-13)` с этим файлом.

Число коммитов посчитано по сообщениям `(19-13)`: в диапазоне `plan_head_before..HEAD` есть коммиты 19-12 и оркестратора.

## Проверки

Задача 1 (`19-13-apply.mjs 1`, dvlab_test, вымышленные карточки `probe-1913-a`, `probe-1913-b`):

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/api typecheck` | код 0 |
| первый прогон из исходников | код 0, students 2/0, sections 4/0, terms 3/0, payments 4/0 (inserted/skipped) |
| оплаты пакета в базе | 4 строки vault, lessons_count null, credited_minutes 0; 1 без карточки и без валюты |
| карточка со ставкой и без ставки | active, ставка из пакета или null, 60 минут, прочие поля и остаток пусты |
| второй прогон (термин в другом регистре) | код 0, inserted 0 по всем таблицам; термин сохранён в первом написании |
| третий прогон после правки секции и имени учителем | inserted 0, тело секции и имя не перезаписаны; id карточек не изменились |
| битый JSON и пакет version 2 | код 2, stderr ровно `Invalid packet`, stdout пуст, вход не напечатан |
| недоступная база | код 1, stderr только `Import failed` |
| usage | код 2, есть строка `import-vault apply < packet.json` |
| `yarn workspace @dv-lab/api build`, прогон `dist/import-vault.mjs apply` того же пакета | код 0, inserted 0 по всем таблицам; битый JSON — код 2 |
| `@dv-lab/` в бандле | нет |
| пробные строки после прогона | удалены (4 оплаты, 3 термина, 4 секции, 2 карточки) |
| tracer-гейт: повтор verify после коммита | `APPLY_OK` |
| `! grep -nE "\.insert\(\|\.update\(" apps/api/src/import/apply-packet.ts` | совпадений нет |
| `git grep --untracked -n "process.env" -- apps/api/src` | только server.ts, migrate.ts, bootstrap-teacher.ts, import-vault.ts |
| `prettier --check` файлов плана | чисто |

Задача 2 (`19-13-apply.mjs dev`, dvlab_dev). Предусловие проверено до прогона чтением: таблицы карточек, секций, словаря и оплат в dvlab_dev есть и пусты, `.env` указывает на базу `_dev`.

| Проверка | Результат |
|----------|-----------|
| сводка parse | students=25 sections=66 terms=762 payments=28 payments_without_currency=4 unmatched=1 rates=19 skipped_rows=1 |
| sha256 принятого пакета (байты stdout parse, с завершающим `\n`) | `4c39430d281c948fdb16717e1019bd0a0ed8c899f0195e49b3041e3bebcb60c4` |
| импортированных карточек до прогона | 0 |
| первый прогон `node --env-file=.env apps/api/dist/import-vault.mjs apply` | код 0, students 25/0, sections 66/0, terms 762/0, payments 29/0 |
| карточки с import_key / разных id | 25 / 25 |
| секции импортированных карточек | 66 |
| термины импортированных карточек | 762 (равно сводке parse) |
| оплаты source = 'vault' | 29 |
| несопоставленные оплаты vault / из них без валюты | 1 / 1 |
| оплаты vault с уроками или минутами | 0 |
| импортированные карточки не в статусе active | 0 |
| импортированные карточки с открывающим остатком | 0 |
| оплаты карточки CARD-06 | 0 (карточка есть) |
| снимок id (sha256 строк `id\|import_key`, по import_key) | `d0ee4632e770c93b8c8a211de7ba63570c1b3dadd2054a4553fba2687b0031ef`, 25 строк |
| второй прогон | код 0, students 0/25, sections 0/66, terms 0/762, payments 0/29 |
| снимок id после второго прогона | совпал |
| имена папок vault в выводе обоих прогонов | нет |
| пакет `SCRATCH/19-13.vault-import.json` | удалён; `git status --porcelain --ignored` без `vault-import.json` |

Не запускалось: `yarn test` (новые тесты не пишутся, план тестов не требует, 19-12 параллельно меняет api), lint (у api нет ESLint), полный `yarn knip` (ожидаемо красный до 19-19).

## Decisions Made

См. key-decisions во frontmatter.

## Deviations from Plan

### Уточнения реализации (в рамках формулировок плана)

- Задача 2 не даёт коммита: файлов она не меняет.
- Скрипт части 1 проверяет больше, чем перечислено в плане: поля вставленных карточек, недоступную базу (`Import failed` без деталей), отказ бандла на битом JSON. Для проверки недоступной базы скрипт пишет во временный файл SCRATCH адрес на закрытый порт с вымышленными учётными данными и удаляет его.
- В части 1 после правки секции меняется ещё и имя карточки: проверяется, что повтор не перезаписывает и его.
- Помимо счётчиков плана скрипт части 2 сверяет число терминов импортированных карточек в базе со сводкой parse (762).
- Для перезапусков скрипт части 2 не подходит: если в dvlab_dev уже есть импортированные карточки, он останавливается до прогона. Сервис compose и раздел RUNBOOK — план 19-15.

### Auto-fixed Issues

None.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. T-19-55: значения проходят importPacket и пишутся параметрами Drizzle в функциях модуля карточек. T-19-56: apply печатает только счётчики, сверка вывода с именами папок прошла. T-19-57: повтор вставил 0, id стабильны, правки учителя не перезаписаны. T-19-58: одна транзакция на пакет. T-19-59: пакет только в SCRATCH и удалён. T-19-60: роль dvlab_app через resolveDatabaseUrl('app').

## Next Phase Readiness

- 19-15: сервис compose `import` с `entrypoint: ['node', 'apps/api/dist/import-vault.mjs', 'apply']` и чтением пакета из stdin (`run --rm -T`); RUNBOOK 11.2 сравнивает sha256 пакета и счётчики с этим файлом.
- 19-19: владельцы `apps/api/src/import/apply-packet.ts` (запись пакета) и команды `apply` в `apps/api/src/import-vault.ts` для AGENTS.md.
- В dvlab_dev теперь 25 карточек vault и 1 несопоставленный перевод: экраны списка, профиля и Unassigned payments в браузере показывают эти данные.

## Self-Check: PASSED

- `apps/api/src/import/apply-packet.ts` и `apps/api/src/import-vault.ts` существуют.
- Коммит `fdb174d` есть в `git log`.
- Пакет `SCRATCH/19-13.vault-import.json` отсутствует.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
