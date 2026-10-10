---
phase: 19-student-cards-and-vault-import
plan: 08
subsystem: api-import
tags: [import-vault, zod, parser, vault, sha256, tsdown, knip]

requires:
  - phase: 19-student-cards-and-vault-import
    provides: контракт карточек, секций, словаря и оплат (19-03), parseMoney из core (19-04)
provides:
  - "apps/api/src/import/packet.ts: importPacket (version 1), ImportPacket"
  - "apps/api/src/import/parse-vault.ts: parseVault(dir) → { packet, summary, warnings }, ParseSummary, VaultParseError"
  - "apps/api/src/import-vault.ts: CLI import-vault parse <students-dir> (коды 0, 1, 2)"
  - "точка сборки apps/api/dist/import-vault.mjs, entry в knip.json"
  - "маска *.vault-import.json в .gitignore и .dockerignore"
affects: [19-13, 19-15, 19-19]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Предупреждения и ошибки parse — фиксированный текст с номером папки (folder #N), без имён, путей и содержимого ячеек"
    - "Пакет пишется в stdout только после importPacket.safeParse"

key-files:
  created:
    - apps/api/src/import/packet.ts
    - apps/api/src/import/parse-vault.ts
    - apps/api/src/import-vault.ts
  modified:
    - apps/api/tsdown.config.ts
    - knip.json
    - .gitignore
    - .dockerignore

key-decisions:
  - "Порядок папок — String.prototype.sort по имени; номера #1..#25 совпали с нумерацией Shape Catalogue (тот же набор полных профилей)"
  - "Папки с именем на точку не считаются карточками"
  - "Нормализация суммы (удаление пробелов, запятая-разделитель групп перед ровно тремя цифрами) общая для ставки и ячеек оплат"
  - "Термин и заметка словаря чистятся одинаково: снять ** и обратные кавычки, normalizeDisplayName, убрать завершающую ;, ещё раз normalizeDisplayName (как addTermRequest)"
  - "Ошибка чтения каталога или файла — «Parse failed: cannot read the students directory», текст ошибки fs не выводится (в нём путь с именем папки)"

requirements-completed: [CARD-06, CARD-07]

plan_head_before: 828724ab8419c79aaa464f8e5ca565225bccf4fb
plan_head_after: cb5734e6611082f5d1bca65aace2412c5b32ed5b
duration: 25min
completed: 2026-10-10
status: complete
---

# Phase 19 Plan 08: import-vault parse Summary

**Первый шаг импорта: `import-vault parse <каталог students>` разбирает 25 папок vault в проверенный zod-пакет (карточки, ставки, секции, словарь, оплаты, несопоставленный перевод) со стабильными sha256-ключами оплат; пакет и имена учеников не попадают в git, образ и вывод.**

## Performance

- **Duration:** около 25 мин
- **Tasks:** 2
- **Files modified:** 7 (3 создано, 4 изменено)

## Accomplishments

- `packet.ts`: схема `importPacket` (version 1): карточка (key 1..200, displayName через `normalizeDisplayName` и `isDisplayNameLength`, ставка или null, секции по `SECTION_KINDS`, термины с проверкой «равен своему trim», оплаты), уникальность key, оплата с ключом `^[0-9a-f]{64}$`, `isIsoDate`, суммой 1..`AMOUNT_MINOR_MAX`, валютой из `CURRENCIES` или null. Длины в кодовых точках.
- `parse-vault.ts`: правила Pattern 6 и Shape Catalogue с поправками D-30, D-31, D-32: имя из H1 главной страницы или имя папки, статус не читается, ставка по шаблону с валютой до или после суммы, оплаты только из таблиц с Date, Amount, Currency, «not specified» → null, строка без суммы пропускается с предупреждением, ключ оплаты sha256 с порядковым номером, `Unmatched transfers.md` без ученика; секции без frontmatter, ведущего H1 и последнего блока `## Links`, wiki-ссылки заменены текстом; словарь по колонкам и deny-list, пункты со стрелкой, схлопывание по lower(term).
- `import-vault.ts`: форма bootstrap-teacher.ts, `parseArgs` с `allowPositionals`; stdout — пакет одной строкой, stderr — предупреждения и строка сводки; `process.env` не читается.
- `tsdown.config.ts` — точка `import-vault`, `knip.json` — entry `src/import-vault.ts`, маски `*.vault-import.json` в `.gitignore` (блок misc) и `.dockerignore` (`*.vault-import.json`, `**/*.vault-import.json`).

## Task Commits

1. **Задача 1 (tracer): parse с карточками, ставками и оплатами, сборка, маски** - `038fd75` (feat)
2. **Задача 2: секции и словарь, повторяемость** - `cb5734e` (feat)

**Plan metadata:** коммит `docs(19-08)` с этим файлом.

Число коммитов посчитано по сообщениям `(19-08)`: в той же ветке параллельно коммитит 19-07, поэтому диапазон `plan_head_before..HEAD` может включать его коммиты.

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/api typecheck` (после каждой задачи) | код 0 |
| `yarn workspace @dv-lab/api build`, `ls apps/api/dist/import-vault.mjs` | код 0, файл есть |
| `19-08-parse.mjs 1` (задача 1) | все проверки PASS, `PARSE_OK` |
| tracer-гейт: повтор verify задачи 1 после коммита (typecheck, build, скрипт) | `PARSE_OK` |
| `19-08-parse.mjs` (обе части) после пересборки dist с итоговым кодом | все проверки PASS, `PARSE_OK` |
| `! grep -q "@dv-lab/" dist/import-vault.mjs` (в скрипте) | PASS |
| маски `grep -qx '\*.vault-import.json'` в `.gitignore` и `.dockerignore` (`/usr/bin/grep`) | код 0 |
| `git check-ignore -q` для `x.vault-import.json` и `apps/api/x.vault-import.json` | код 0 оба |
| `git status --porcelain --ignored` без `vault-import.json` | PASS |
| `git grep --untracked -n "process.env" -- apps/api/src` | только server.ts, migrate.ts, bootstrap-teacher.ts |
| `prettier --check` по файлам плана | чисто |
| пакет `SCRATCH/19-08.vault-import.json` после скрипта | удалён |

Сводка parse (stderr):

```
students=25 sections=66 terms=762 payments=28 payments_without_currency=4 unmatched=1 rates=19 skipped_rows=1
```

- Предупреждений: 1 (строка оплаты без суммы, `folder #7`).
- Термины по полным папкам (#3 #4 #6 #8 #9 #11 #13 #15 #20 #21 #24): 180 / 187 / 0 / 8 / 99 / 0 / 91 / 0 / 146 / 51 / 0 = 762 (прототип исследования: 763, отличие 1 термин в папке #4, в пределах 684..836); терминов с заметкой 89.
- Секции: 11 папок по 6, 14 папок без секций; ни одно тело не начинается с H1, не содержит `[[` и строки `## Links`.
- Ключи: 25 разных ключей карточек, 29 уникальных ключей оплат (28 ученических и 1 несопоставленная).
- Два запуска parse дают одинаковый sha256 stdout; stdout и stderr исходников и `dist/import-vault.mjs` совпадают байт-в-байт.
- Имена папок vault в stderr исходников и бандла не встречаются (сравнение без учёта регистра).
- Код 2 и строка `Usage: import-vault parse` без аргументов; код 1 и `Parse failed: cannot read the students directory` для несуществующего каталога (путь не выводится).

Не запускалось: `yarn test` api (план тестов не требует, новые тесты не пишутся, тесты api идут на базе, а 19-07 параллельно меняет api), lint (у api нет ESLint), полный `yarn knip` (ожидаемо красный до 19-19).

## Decisions Made

См. key-decisions во frontmatter.

## Deviations from Plan

### Уточнения реализации (в рамках формулировок плана)

- Скрипт `19-08-parse.mjs` удаляет пакет в конце любого режима (в том числе `1`), а не только после части 2: пакет не лежит в SCRATCH между запусками. Есть режим `debug` для печати счётчиков по номерам папок (без имён).
- После задачи 2 dist пересобран (`yarn workspace @dv-lab/api build`), чтобы `dist/import-vault.mjs` отражал итоговый код; проверка «исходники и бандл совпадают» прошла и на итоговом коде.
- Нормализация суммы с запятой-разделителем групп применяется и к ячейкам оплат, не только к ставке: без неё `parseMoney` вернул бы null для суммы вида `9,000`. На данных vault ячеек с запятой нет, результат тот же.
- Каталоги с именем на точку пропускаются; на данных vault таких нет.
- `readText` приводит CRLF к LF; BOM не обрабатывается (по исследованию файлов с BOM и CR нет).

### Auto-fixed Issues

None.

## Issues Encountered

- В версии задачи 1 escape-последовательности BOM и неразрывных пробелов в регулярных выражениях оказались записаны буквальными невидимыми символами; во второй задаче удаление пробелов переписано на `\s` (в JS включает неразрывные и узкие пробелы), обработка BOM убрана. В итоговых файлах плана невидимых символов нет (проверено скриптом).

## Known Stubs

None. Шаг `apply` — план 19-13 (так задумано D-13).

## Threat Flags

None. T-19-27: маски и проверка `git check-ignore`, пакет только в SCRATCH и удалён. T-19-28: предупреждения и ошибки без имён и путей, сверка stderr с именами папок. T-19-29: оплаты только из `Payments.md` своей папки. T-19-30: «not specified» → null, строка без суммы пропущена. T-19-31: повторяемость пакета проверена двумя запусками.

## Next Phase Readiness

- 19-13 добавляет команду `apply` в `import-vault.ts`: пакет читается из stdin и проверяется тем же `importPacket`; сводка `ParseSummary` и строка сводки уже есть.
- 19-15 (compose и RUNBOOK): бандл `node apps/api/dist/import-vault.mjs`, маска пакета уже в `.dockerignore`.
- 19-19 (AGENTS.md): владелец разбора vault — `apps/api/src/import/parse-vault.ts`, схема пакета — `apps/api/src/import/packet.ts`.

## Self-Check: PASSED

- Файлы `apps/api/src/import/packet.ts`, `apps/api/src/import/parse-vault.ts`, `apps/api/src/import-vault.ts` существуют.
- Коммиты `038fd75` и `cb5734e` есть в `git log`.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
