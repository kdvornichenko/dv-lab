---
phase: 21-lesson-accounting-and-today
plan: 13
subsystem: testing
tags: [ledger, today, postgres, playwright, nextjs, webpack, design-v40]
requires:
  - phase: 21-01..12, 21-14..17
    provides: Схема, core, API, Today, настройки, UI и устранённые source findings
provides:
  - Завершённые root gates и 11 существующих suites с 116 tests
  - 32 штатных browser runs, 2 ROADMAP runs и affected proof V1 в обеих темах
  - Точное восстановление devTeacher и нулевые счётчики собственных фикстур
affects: [21-18, phase21-verification]
tech-stack:
  added: []
  patterns: [Node24 private TypeScript helpers с публичными mjs entry points]
key-files:
  created: [.planning/phases/21-lesson-accounting-and-today/21-13-SUMMARY.md]
  modified:
    [
      knip.json,
      AGENTS.md,
      apps/web/package.json,
      apps/web/components/app/layout-parts.tsx,
      apps/web/app/(app)/_components/today-lessons.tsx,
      scripts/dev-checks/ledger-web/today-rows.ts,
      .planning/WINDOWS.md,
    ]
key-decisions:
  - Root build использует поддерживаемый webpack flag после воспроизводимого Turbopack EPERM
  - V1 закрыт сжатием существующих колонок и PageScroll Content без нового mobile layout
  - Доказательства unaffected test suites повторно использованы; affected web build проверен отдельно
requirements-completed: [LEDG-03, LEDG-04, LEDG-05, LEDG-06, LEDG-07, LEDG-08, SHELL-05]
actuals:
  tokens: 17077
  tasks: 3
  commits: 7
plan_head_before: bec43a9484e2c55aa8b857e2f971a159841af155
plan_head_after: d6ccf60c1f48840a5eedd3f91fd8b48daabb0bd8
duration: 61min
completed: 2026-10-11
status: complete
coverage:
  - id: root
    description: Root static/test/build и catalog/core/API gates
    verification:
      - kind: other
        ref: /private/tmp/dv-lab-phase21-parallel/21-13-runs.jsonl
        status: pass
    human_judgment: false
  - id: ledger-today
    description: Пять критериев ROADMAP через настоящий public UI/API/persistence
    verification:
      - kind: automated_ui
        ref: /private/tmp/dv-lab-phase21-parallel/21-13-browser-evidence.json
        status: pass
    human_judgment: false
  - id: narrow
    description: Today/Settings/Students помещаются в viewport 320 px в обеих темах
    verification:
      - kind: automated_ui
        ref: /private/tmp/dv-lab-phase21-parallel/21-13-narrow-after-light.json
        status: pass
      - kind: automated_ui
        ref: /private/tmp/dv-lab-phase21-parallel/21-13-narrow-after-dark.json
        status: pass
    human_judgment: false
  - id: unavailable-backstops
    description: Отрисовка 300 символов и реальная полночь browser/API
    verification:
      - kind: other
        ref: .planning/WINDOWS.md#4-5
        status: unknown
    human_judgment: true
    rationale: 300 символов запрещены действующим контрактом; реальная синхронная полночь не наблюдалась
---

# Phase 21 Plan 13: Итоговая проверка учёта уроков и Today

**Единые правила остатка и отметок подтверждены core/API/browser checks; Today помещается в 320 px, root build и существующие suites зелёные.**

## Performance

- Начало выполнения checks: 2026-10-11T06:56:36Z.
- Фиксация итоговых фактов: 2026-10-11T07:57:41.880Z; длительность 61 min.
- Задачи: 3/3. Собственные изменённые файлы: 46, включая SUMMARY.
- `actuals.tokens`: chars/4 по собственному realized diff и новому SUMMARY. Parent ROADMAP исключён из знаменателя файлов.
- `actuals.commits=7` измерено через `git rev-list --count <plan_head_before>..<plan_head_after>` по сохранённому ledger. В диапазоне шесть собственных task commits и parent commit `c63a76b` с ROADMAP. Parent commit сохранён; его содержимое не изменялось этим планом. Последний SUMMARY commit в метрику до SUMMARY не включён.

## Task Commits

1. Задача 1, build/knip/type imports: `2cc7bd9e9bd2aa10d491b6e0f67e9a079c85f705`.
2. Задача 1, сверка AGENTS/build owner: `833f218fc98eb0fb309353029d5b8d84226ee9d4`.
3. Задача 2, 32 browser runs: `b0563690f7e5de88f28f77461c7d7c7d6ae3f2a1`. Verification-only empty commit; новые ROOT test suites не создавались.
4. Задача 3, честные unavailable observations: `ae1ce54418c06e866ba05be268230151e4f45e9c`.
5. Задача 3, подтверждённый V1 fix: `ac713f5bff0cc3dede559606e80f21d457655166`.
6. Проверка границы JSON в существующем journey: `d6ccf60c1f48840a5eedd3f91fd8b48daabb0bd8`.

Последний отдельный docs commit содержит только этот SUMMARY. Все task commits имеют `Co-Authored-By: Codex <noreply@openai.com>`.

## Проверки: точные команды, original status, decisive output

Команды выполнены из закреплённого ROOT. Полные redacted logs и original exits лежат в `/private/tmp/dv-lab-phase21-parallel/21-13-runs.jsonl` и `21-13-<label>.log`. Ранние ошибки сохранены как отдельные attempts. Процессы доведены до завершения; проверочные команды не передавались в head.

| Команда                                                                                                                                     | Original exit | Decisive output                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------: | --------------------------------------------------------------------------------------------------- |
| `yarn typecheck`                                                                                                                            |             0 | 5 successful, 5 total; final V1 run: 4 cached                                                       |
| `yarn lint`                                                                                                                                 |             0 | 1 successful, 1 total; final V1 run live                                                            |
| `yarn test`                                                                                                                                 |             0 | 11 suites, 116 tests; 5 successful, 5 total                                                         |
| `yarn build`                                                                                                                                |             0 | Final V1: 2 successful, 2 total; Next.js 16.4.0 (webpack), 8/8 pages; API tsdown build cache replay |
| `yarn knip`                                                                                                                                 |             0 | No unused/unlisted findings; 18 existing configuration hints                                        |
| `yarn workspace @dv-lab/db db:generate`                                                                                                     |             0 | No schema changes, nothing to migrate                                                               |
| `git status --porcelain -- packages/db/drizzle`                                                                                             |             0 | Пусто; 7 каталогов миграций                                                                         |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-evidence.mts ci`                                                                           |             0 | CI_STEPS_OK                                                                                         |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-evidence.mts privacy`                                                                      |             0 | PRIVACY_OK; исходный scan files=262; scan с SUMMARY: files=263                                      |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-gates.mts`                                                                                 |             0 | SOURCE_GATES_OK                                                                                     |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-helper-metrics.cjs v1`                                                                     |             0 | 41 files; violations=[]                                                                             |
| `grep -c "lesson_marks" AGENTS.md`                                                                                                          |             0 | 2                                                                                                   |
| `grep -rn "\.delete(" apps/api/src/schedule apps/api/src/settings`                                                                          |             1 | Нет совпадений; ожидаемый absence gate                                                              |
| `git diff --check`                                                                                                                          |             0 | Пусто                                                                                               |
| `bash scripts/gsd/root-pin.sh /Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today`                       |             0 | ROOT_PIN_OK перед write/commit                                                                      |
| `node /Users/kdvornichenko/.codex/gsd-core/bin/gsd-tools.cjs query git.base-branch --is-protected gsd/phase-21-lesson-accounting-and-today` |             0 | false                                                                                               |

CI driver дословно извлёк и выполнил `Web and api boundary`, `Client address trust` и `Turbo version in Dockerfiles` из текущего ci.yml. Root knip после V1 не повторялся: изменения классов и локального predicate не меняют dependency/export graph.

Дополнительные static commands, exit 0:

```sh
node node_modules/typescript/bin/tsc --noEmit --allowJs --skipLibCheck --strict --allowImportingTsExtensions --erasableSyntaxOnly --target es2024 --module esnext --moduleResolution bundler --types node scripts/dev-checks/browser-context.ts scripts/dev-checks/ledger-web/*.ts scripts/dev-checks/schedule-web/*.ts
node node_modules/prettier/bin/prettier.cjs --check AGENTS.md knip.json apps/web/package.json scripts/dev-checks/browser-context.ts scripts/dev-checks/ledger-web scripts/dev-checks/schedule-web
node node_modules/prettier/bin/prettier.cjs --check apps/web/components/app/layout-parts.tsx 'apps/web/app/(app)/_components/today-lessons.tsx' scripts/dev-checks/ledger-web/today-rows.ts
node node_modules/typescript/bin/tsc --noEmit --allowJs --skipLibCheck --strict --allowImportingTsExtensions --erasableSyntaxOnly --target es2024 --module esnext --moduleResolution bundler --types node /private/tmp/dv-lab-phase21-parallel/21-13-roadmap.mts
```

Decisive results: strict tsc — без diagnostics; Prettier — All matched files use Prettier code style. Original exact AGENTS audit `node -e` и статические tool results сохранены в `21-13-static-evidence.json`: `AGENTS_SYMBOLS_OK 42 AGENTS_PATHS_OK 52`.

### Гейты «одно правило»

Все следующие exact git grep commands вернули original exit 1 и пустой output:

```sh
git grep -nE "@radix-ui|radix-ui|cmdk" -- 'apps/web/**/*.tsx' apps/web/package.json
git grep -nE "status *(===|!==) *'(scheduled|cancelled|moved)'" -- apps/web apps/api/src
git grep -nE "outcome *(===|!==) *'(done|no_show)'" -- apps/web apps/api/src
git grep -nE "\['done', *'no_show'" -- apps packages/core/src
git grep -nE "zonedParts\([^)]*SCHEDULE_TIME_ZONE\)\.date" -- apps/web
git grep -nE "localIsoDate|latestPaymentDate|todayOf|UTC\+" -- apps/web apps/api/src packages/core/src
git grep -nE "balanceMinutes */|balanceMinutes! */" -- apps/web apps/api/src
git grep -nE "(paidOn|startsAt|lessonDate) *[<>]=? *(opening|card\.opening|student\.opening)" -- apps/web apps/api/src
git grep -nE "\.delete\(" -- apps/api/src/schedule apps/api/src/settings
```

`grep -c "MARK_KINDS" apps/api/src/schedule/rows.ts` — exit 0, 2; `grep -c "Mirror<" apps/api/src/schedule/rows.ts` — exit 0, 6. Comment scan по фазовому списку: 0 совпадений; удаления строк через db.delete в schedule/settings не найдены. Это scoped source evidence, не заявление об отсутствии произвольных дефектов.

Сверенные AGENTS symbols: studentBalance, countsAfterOpening, lessonDeduction, markEffect, needsMark, todayCounts, lessonOutcome, occurrenceOutcome, countsAsLesson, isMarked, lessonActions, awaitsMark, withOutcomes, scheduleToday, scheduleDate, isAfterScheduleToday, hasOccurrences, cutSeries, endSeriesAt, balanceState, paysSoon, paysSoonList, balancePhrase, windowDates, PAYS_SOON_LESSONS_DEFAULT, readWindow, lockSeries, lockLesson, toMarkKind, toBalanceCard, loadMarkRows, readToday, readPaysSoonLessons, savePaysSoonLessons, TimeZonePicker, useMinuteNow, mutate, markLesson, LessonDialogs, Mirror, MARK_KINDS, zoneLabel. Все 52 literal paths существуют. Единственное исправление AGENTS — фактический build flag.

### Catalog, core, API

| Exact command                                      | Exit | Marker                     |
| -------------------------------------------------- | ---: | -------------------------- |
| `node scripts/dev-checks/ledger-db.mjs catalog`    |    0 | LEDGER_DB_OK               |
| `node scripts/dev-checks/schedule-db.mjs catalog`  |    0 | SCHEDULE_DB_OK             |
| `node scripts/dev-checks/ledger-core.mjs`          |    0 | LEDGER_CORE_OK             |
| `node scripts/dev-checks/schedule-core.mjs`        |    0 | CORE_OK                    |
| `node scripts/dev-checks/ledger-api.mjs marks`     |    0 | SCHEDULE_LEDGER_MARKS_OK   |
| `node scripts/dev-checks/ledger-api.mjs past`      |    0 | SCHEDULE_LEDGER_PAST_OK    |
| `node scripts/dev-checks/ledger-api.mjs moves`     |    0 | SCHEDULE_LEDGER_MOVES_OK   |
| `node scripts/dev-checks/ledger-api.mjs cut`       |    0 | SCHEDULE_LEDGER_CUT_OK     |
| `node scripts/dev-checks/ledger-api.mjs race`      |    0 | SCHEDULE_LEDGER_RACE_OK    |
| `node scripts/dev-checks/ledger-api.mjs balance`   |    0 | SCHEDULE_LEDGER_BALANCE_OK |
| `node scripts/dev-checks/ledger-api.mjs flag`      |    0 | SCHEDULE_LEDGER_FLAG_OK    |
| `node scripts/dev-checks/ledger-api.mjs today`     |    0 | SCHEDULE_LEDGER_TODAY_OK   |
| `node scripts/dev-checks/ledger-settings.mjs`      |    0 | SETTINGS_OK                |
| `node scripts/dev-checks/schedule-api.mjs read`    |    0 | SCHEDULE_API_READ_OK       |
| `node scripts/dev-checks/schedule-api.mjs next`    |    0 | SCHEDULE_API_NEXT_OK       |
| `node scripts/dev-checks/schedule-api.mjs changes` |    0 | SCHEDULE_API_CHANGES_OK    |

ledger-core также сверил read-only остатки 25 карточек с API; данные этих карточек не публиковались. `moves` включён для принятого D-17.

## Existing regression proof для parent

`yarn test` завершился 2026-10-11T07:00:28.828Z с original exit 0. Девять suites выполнены live; две contracts suites повторно выданы из cache предыдущего фактического успешного выполнения. Rerun: `yarn test`. Дополнительный зелёный run ради metadata не выполнялся.

| Existing successful suite                | Tests | Execution                 |
| ---------------------------------------- | ----: | ------------------------- |
| packages/contracts/test/identity.test.ts |    20 | cache прежнего actual run |
| packages/contracts/test/auth.test.ts     |    28 | cache прежнего actual run |
| apps/api/test/config.test.ts             |    15 | live                      |
| apps/api/test/lifecycle.test.ts          |     6 | live                      |
| apps/api/test/ws.test.ts                 |     4 | live                      |
| apps/api/test/health.test.ts             |     3 | live                      |
| apps/api/test/request-context.test.ts    |    12 | live                      |
| apps/api/test/migrate.test.ts            |     3 | live                      |
| packages/db/test/roles.test.ts           |     9 | live                      |
| packages/db/test/connection.test.ts      |    12 | live                      |
| apps/api/test/shutdown.test.ts           |     4 | live                      |

Из 12 unique prior-phase refs 11 соответствуют таблице. Legacy `apps/api/test/auth/passwords.test.ts` отсутствует. Эквивалентная Vitest password suite не заявляется. Actual contracts/auth проверяет общий auth contract; source owner паролей — `apps/api/src/auth/passwords.ts`; public sign-in фактически прошёл browser/API helpers. Это отдельное evidence, не замена отсутствующей suite.

Источник run: HEAD `bec43a9484e2c55aa8b857e2f971a159841af155` с тогдашним uncommitted diff SHA-256 `9e0789fae20386338d21de562f1283a9371462031c8c8fb1dd9a076d8928278e`. Manifest 373 files: `2a2d7cb14dc594a8925810f40c67c09dd245e6a081caf24f5bf45d62e2432067`. Первоначальный широкий behavior manifest 272 files: `c9f28d745764f50c4d8a88fa1cacdad9f8f882d561f28b3cb5ad230c0f5fb300`.

После V1 в широком manifest изменились только layout-parts.tsx и today-lessons.tsx. Web не имеет Vitest suite. Все 100 входов существующих suites (apps/api, packages/core/contracts/db, test/config, root package/yarn/turbo) совпадают с actual run: `ebd95da5f43f819e6d47ccdfb7ea73feef0db0ceff0a41f50476ad9b883005ec`. Их reuse доказан hash comparison; web build обновлён отдельным завершённым root `yarn build`. Docs/config не инвалидируют unaffected behavior proof. Если эти реальные test inputs изменятся, parent должен пересмотреть reuse.

Подробности и 12-reference mapping: `21-13-test-evidence.json`; original log: `21-13-test.log`.

## Browser evidence

Ниже все первоначальные 32 exact runs. Каждый завершился, failures=0. Code/fixture refs, expected/observed assertion counts, original exit, log hashes и rerun находятся в `21-13-browser-evidence.json`.

| Exact command                                               | Exit | Final marker                  |
| ----------------------------------------------------------- | ---: | ----------------------------- |
| `node scripts/dev-checks/schedule-web.mjs fade`             |    0 | `SCHEDULE_WEB_FADE_OK`        |
| `node scripts/dev-checks/schedule-web.mjs frame`            |    0 | `SCHEDULE_WEB_FRAME_OK`       |
| `node scripts/dev-checks/schedule-web.mjs read`             |    0 | `SCHEDULE_WEB_READ_OK`        |
| `node scripts/dev-checks/schedule-web.mjs changes`          |    0 | `SCHEDULE_WEB_CHANGES_OK`     |
| `node scripts/dev-checks/schedule-web.mjs students`         |    0 | `SCHEDULE_WEB_STUDENTS_OK`    |
| `node scripts/dev-checks/schedule-web.mjs grid`             |    0 | `SCHEDULE_WEB_GRID_OK`        |
| `node scripts/dev-checks/schedule-web.mjs forms`            |    0 | `SCHEDULE_WEB_FORMS_OK`       |
| `node scripts/dev-checks/schedule-web.mjs zones`            |    0 | `SCHEDULE_WEB_ZONES_OK`       |
| `node scripts/dev-checks/schedule-web.mjs settings`         |    0 | `SCHEDULE_WEB_SETTINGS_OK`    |
| `node scripts/dev-checks/schedule-web.mjs drag`             |    0 | `SCHEDULE_WEB_DRAG_OK`        |
| `node scripts/dev-checks/ledger-web.mjs marks`              |    0 | `LEDGER_WEB_MARKS_OK`         |
| `node scripts/dev-checks/ledger-web.mjs students`           |    0 | `LEDGER_WEB_STUDENTS_OK`      |
| `node scripts/dev-checks/ledger-web.mjs settings`           |    0 | `LEDGER_WEB_SETTINGS_OK`      |
| `node scripts/dev-checks/ledger-web.mjs today`              |    0 | `LEDGER_WEB_TODAY_OK`         |
| `node scripts/dev-checks/ledger-web.mjs today-marks`        |    0 | `LEDGER_WEB_TODAY_MARKS_OK`   |
| `node scripts/dev-checks/ledger-web.mjs today-payment`      |    0 | `LEDGER_WEB_TODAY_PAYMENT_OK` |
| `node scripts/dev-checks/schedule-web.mjs fade dark`        |    0 | `SCHEDULE_WEB_FADE_OK`        |
| `node scripts/dev-checks/schedule-web.mjs frame dark`       |    0 | `SCHEDULE_WEB_FRAME_OK`       |
| `node scripts/dev-checks/schedule-web.mjs read dark`        |    0 | `SCHEDULE_WEB_READ_OK`        |
| `node scripts/dev-checks/schedule-web.mjs changes dark`     |    0 | `SCHEDULE_WEB_CHANGES_OK`     |
| `node scripts/dev-checks/schedule-web.mjs students dark`    |    0 | `SCHEDULE_WEB_STUDENTS_OK`    |
| `node scripts/dev-checks/schedule-web.mjs grid dark`        |    0 | `SCHEDULE_WEB_GRID_OK`        |
| `node scripts/dev-checks/schedule-web.mjs forms dark`       |    0 | `SCHEDULE_WEB_FORMS_OK`       |
| `node scripts/dev-checks/schedule-web.mjs zones dark`       |    0 | `SCHEDULE_WEB_ZONES_OK`       |
| `node scripts/dev-checks/schedule-web.mjs settings dark`    |    0 | `SCHEDULE_WEB_SETTINGS_OK`    |
| `node scripts/dev-checks/schedule-web.mjs drag dark`        |    0 | `SCHEDULE_WEB_DRAG_OK`        |
| `node scripts/dev-checks/ledger-web.mjs marks dark`         |    0 | `LEDGER_WEB_MARKS_OK`         |
| `node scripts/dev-checks/ledger-web.mjs students dark`      |    0 | `LEDGER_WEB_STUDENTS_OK`      |
| `node scripts/dev-checks/ledger-web.mjs settings dark`      |    0 | `LEDGER_WEB_SETTINGS_OK`      |
| `node scripts/dev-checks/ledger-web.mjs today dark`         |    0 | `LEDGER_WEB_TODAY_OK`         |
| `node scripts/dev-checks/ledger-web.mjs today-marks dark`   |    0 | `LEDGER_WEB_TODAY_MARKS_OK`   |
| `node scripts/dev-checks/ledger-web.mjs today-payment dark` |    0 | `LEDGER_WEB_TODAY_PAYMENT_OK` |

Дополнительная приёмка:

| Exact command                                                           | Exit | Decisive marker        |
| ----------------------------------------------------------------------- | ---: | ---------------------- |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-roadmap.mts`           |    0 | C13_ROADMAP_BROWSER_OK |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-roadmap.mts dark`      |    0 | C13_ROADMAP_BROWSER_OK |
| `node scripts/dev-checks/ledger-web.mjs today` (affected V1 rerun)      |    0 | LEDGER_WEB_TODAY_OK    |
| `node scripts/dev-checks/ledger-web.mjs today dark` (affected V1 rerun) |    0 | LEDGER_WEB_TODAY_OK    |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-narrow.mts after`      |    0 | C13_NARROW_VIEWPORT_OK |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-narrow.mts after dark` |    0 | C13_NARROW_VIEWPORT_OK |

Итого 38 успешных acceptance browser runs: 32 + 2 ROADMAP + 2 affected Today + 2 narrow. Диагностические attempts не подменяют этот счётчик.

Исходный browser source: HEAD `833f218fc98eb0fb309353029d5b8d84226ee9d4`, пустой source diff, 373 files SHA-256 `98ce7460af16be8eb1b1a108ec7db8e9446b3c7bc1b1e54adcbd009100194907`. Final source после V1: `ac713f5bff0cc3dede559606e80f21d457655166`, SHA-256 `2a092c5967c37809bc3f10c8dc8615dc2c51f91c51cc5fe9ba5208fc2ed75b30`; delta — layout-parts.tsx, today-lessons.tsx, ledger-web/today-rows.ts. Остальные поведенческие результаты повторно использованы: core/API/state/event handlers не менялись, desktop widths подтверждены affected journey. Для изменённой узкой геометрии использованы новые actual observations.

Fixture owners: текущие typed modules `schedule-web/fixtures.ts`, `ledger-web/common.ts`, section modules из публичных mjs wrappers; ROADMAP fixtures описаны в `21-13-roadmap.mts`. Только явно вымышленные карточки с import_key null. Narrow probe не меняет карточки/настройки. API suites используют существующий _test owner.

STATE_DIR: `/private/var/folders/_t/fgvwdzzs1394z_82sp4p500h0000gn/T/dvlab-dev-checks`. Реальные PNG обеих тем:

- `c13-{light,dark}-balance.png`: controlled 2.5 balance row.
- `c13-{light,dark}-name-60.png`: synthetic 60-character dialog.
- `c13-{light,dark}-start-boundary.png`: quick marks после реального начала урока.
- `ledger-today-{light,dark}-narrow-320.png`: final affected fixture journey.
- `c13-v1-after-{light,dark}.png`: final narrow viewport, строки с данными замаскированы.

Per-image SHA-256 и source/fixture hashes сохранены в browser/narrow evidence. Изображения остаются в STATE_DIR и не коммитятся.

## Пять критериев ROADMAP

| Критерий            | Expected / actual observed                                                                                                                                           | Evidence                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1, LEDG-03          | Synthetic opening 5; Done 60 min → 4; Done 90 min → 2.5 в Students/profile/Today Pays soon и трёх API reads                                                          | C13_DURATION_60_90_OK, обе темы                                   |
| 2, LEDG-04/05       | No-show вычитает; выключение флага возвращает остаток; отмена убирает вычет, restore возвращает; moved ghost не вычитает, новый адрес учитывает opening date по D-17 | ledger-api flag/moves/balance; ledger-web students/marks обе темы |
| 3, LEDG-06          | Done → No-show → Scheduled → Done → Cancel → Return; после каждого шага одинаковые минуты и текст на перечитанных экранах                                            | C13_CORRECTIONS_CANCEL_RESTORE_OK, обе темы                       |
| 4, LEDG-07/SHELL-05 | Нет setting row → N=2; N=3 включает positive fixture, N=0 исключает; caption обновляется; null исключён, debt первый; четыре counters, Lessons today и Earlier       | ledger-settings; today/settings обе темы; C13_THRESHOLDS_3_0_OK   |
| 5, LEDG-08          | Core script зелёный; GET students/detail/today равны; одно правило в core по source gates                                                                            | LEDGER_CORE_OK; C13 equal balance; SOURCE_GATES_OK                |

По D-12h фраза «covered by unit tests» заменена приёмочным `ledger-core.mjs`. Новые unit/integration/contract/incident suites не создавались. Все пять функциональных критериев подтверждены automation через настоящий UI/API/persistence. Manual human PASS не заявлен.

### Backstops и ограничения

- 320 px Today/Settings/Students: PASS обе темы. После V1 right=304 при viewport=320; panels client/scroll=288/288. Desktop 88 px time и 72 px date сохранены.
- 60-character synthetic name: Today/Pays soon row и dialog fit — PASS обе темы.
- 300-character rendering: **UNVERIFIED**. Contracts и SQL CHECK разрешают максимум 80. Public POST с 300 символами вернул 400 в обеих темах; обход ограничения в DB не выполнялся. WINDOWS #4.
- America/New_York: Today h1/date и started state следуют Vietnam core date — PASS.
- Реальное начало урока в открытом Today: до начала quick mark отсутствует, затем появляется без reload — C13_START_BOUNDARY_OK, обе темы.
- Реальная синхронная полночь browser/API: **UNVERIFIED**. Existing stale-date/re-read/page.clock simulation прошла обе темы. API clock не сдвигался. WINDOWS #5.
- Calendar manual human UAT отложен владельцем до Google 24/25. Actual automation Today, balance, payment, Settings и schedule helpers выполнена.

## Решения D-01..D-17 и D-12a..n

| Решение             | План-владелец   | Current observation                                                                                 |
| ------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| D-01                | 01,04           | lesson_marks catalog/mark API; kind none сохраняет строку                                           |
| D-02                | 02,07           | 60/90 длительности дают 1/1.5; C13 и core                                                           |
| D-03                | 01,07,09        | default true; form off пересчитывает прошлую no-show                                                |
| D-04                | 02,04,17,08,11  | Future unmarked запрещён; past/marked correction разрешён; marks/past/moves                         |
| D-05                | 02,07,17        | countsAfterOpening; новая дата moved учитывает opening; balance/moves                               |
| D-06                | 02,07,09,10     | Negative balance отображается как debt; students/today                                              |
| D-07                | 02,04,17,08,11  | Cancel/restore сохраняют mark и убирают/возвращают deduction                                        |
| D-08                | 02,07,10        | Active <=N и debt включены, null исключён; today/core                                               |
| D-09                | 01,05,09        | TeacherSettings default2 и 0..20; settings API/browser                                              |
| D-10                | 02,07,10        | Четыре counters, next и toMark через core; today                                                    |
| D-11                | 08,11           | Schedule pills и Today quick controls; marks/today-marks                                            |
| D-12                | 03,14,06        | Frame/forms/fade/drag/zones/read в обеих темах                                                      |
| D-12a               | 08..11          | Accepted v40 source baseline; нужные существующие UI components используются                        |
| D-12b               | 03,14,06,08..11 | Done/Pays soon vocabulary, tokens, Settings Payments/Time zones; соответствующие helpers            |
| D-12c               | 02,07,10        | Earlier unmarked и toMark; today/core                                                               |
| D-12d               | 04,08,11,17     | Past cancel/restore PASS; ограничение move отменено D-17                                            |
| D-12e               | 01,05,09        | Отдельная teacher_settings, auth не владеет ledger setting                                          |
| D-12f               | 01              | Catalog/roles: app DELETE/TRUNCATE lesson_marks отозваны                                            |
| D-12g               | 04,17           | Cut/end сохраняют marks при materialization moved occurrence; cut/API/core                          |
| D-12h               | 02,13           | ledger-core вместо новых unit tests; отклонение записано выше                                       |
| D-12i               | 02,04,07,15     | POST mark, loadMarkRows, Vietnam date; core/API gates                                               |
| D-12j               | 04,07           | Новый маршрут изменения duration не добавлялся                                                      |
| D-12k               | 12              | Документы владельцев server/deploy подтверждены SUMMARY12; deployment здесь не выполнялся           |
| D-12l               | 11              | Add payment + Student selector browser PASS; profile Stat/Next payment не входят в принятый scope   |
| D-12m               | 02,07,10        | Archived и <=opening исключены из toMark/Earlier; core/API today                                    |
| D-12m, null opening | 02,07           | Уроки карточки без opening_balance_on входят в To mark; null balance при этом не входит в Pays soon |
| D-12n               | 07              | PATCH без noShowDeducts сохраняет значение; flag API PASS                                           |
| D-13                | 02,07           | Сырые rows → studentBalance в core; гейты без duplicate opening comparison                          |
| D-14                | 02,04,15,16,17  | Единый outcome/actions, Mirror; нет status/changeable в wire response                               |
| D-15                | 02,15           | scheduleToday/scheduleDate; browser zone не задаёт Vietnam day                                      |
| D-16                | 02,07,09,10     | balanceState/paysSoon/balancePhrase; null отличается от zero                                        |
| D-17                | 17              | Move past/future/marked; новая дата deduction, ghost без deduction; moves/marks/changes PASS        |

## Дизайн: accepted v40 и сводка для Design dude

Фактический `/Users/kdvornichenko/dv-lab-design/VERSION` — v40. v36 в старом PLAN не является текущим baseline. Предыдущие согласования дизайнера перечислены в `21-ui-review-draft.md`; согласование F1..F6 заново не приписывается. Их source fixes приняты по v40/UI-SPEC/locked scope.

| Область                                                                     | Current accepted observation / disposition                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| TodayPage, DueList, StudentBalance, StudentForm, SettingsGeneral            | Current v40 source baseline; реальные counters/list/settings/flag/payment observations получены в обеих темах |
| LessonMark, LessonDialog, EventTooltip, WeekGrid, StatusDot, TimeZonePicker | Marks/read/frame/forms/zones/drag обе темы; desktop geometry по existing helpers                              |
| OQ-1                                                                        | Profile Stat row и Next payment не строятся; accepted balance + rate без plan                                 |
| OQ-2                                                                        | Add payment и Student field реализованы и browser PASS                                                        |
| OQ-3                                                                        | Отступ 16 px у знака; existing marks/frame source/DOM evidence                                                |
| OQ-4 / D-17                                                                 | Старый caption прошедшего урока убран; past cancel/restore/move разрешены                                     |
| Time zones                                                                  | Accepted phase scope: second zone в browser; account default zone остаётся будущей работой                    |
| WeekGrid details                                                            | 22 px short block и полноразмерный border-left сохраняют approved исключения; helper checks PASS              |
| Switch                                                                      | Approved design-lab цвет/расположение сохранены; form label click, flag и recalculation PASS                  |
| Read errors / EmptyState                                                    | Принятые banner, glyph и padding сохранены; error/refresh/quiet cases PASS                                    |
| moved-from / mark-stays                                                     | Вид ссылки сохранён по accepted scope; mark-stays caption deferred владельцем                                 |
| FECR03 target navigation                                                    | Claim rejected в accepted scope: /schedule fallback допускается                                               |
| V1 320px                                                                    | Product warning подтверждён, исправлен ac713f5; actual final viewport bounds PASS обе темы                    |

F1 pending Footer Move/Cancel подтверждён C13 с delayed POST обе темы. Existing quick mark busy/focus и null balance observations получены helpers. Эти факты не заменяют все отдельные F1..F6/FEclock computed CSS/SSR/failure assertions подготовленных девяти journeys owner18. Полный visual/color score или human UAT PASS здесь не заявляется. Source report и screenshot supplement сохраняют свою датированную provenance.

## Quality и Simplify

Simplify применён к собственному diff: возвращён исходный runtime Playwright loader, оставлены необходимые type import/config изменения; V1 ограничен двумя CSS owners и existing narrow predicate. Public API/statics/mjs sections сохраняются. CSS diagnostic interventions удалены до final passing runs. Комментарии не добавлялись.

- 39 type-import files: before/after max CC 21/21; bodies неизменны; max cognitive 15, max Difficulty 40.4193548387, max physical lines 457.
- Final owned source/tooling denominator 41 files (39 helpers + 2 UI owners): max CC 21, cognitive 15, Difficulty 40.4193548387, lines 457; violations=[].
- 7 TMP procedures: max CC 11, cognitive 18, Difficulty 24.3939393939, lines 219; violations=[].
- Tools: Node 24.17.0, TypeScript 6.0.3, ESLint 10.12.0, typescript-eslint parser 8.71.1. CC — ESLint classic. Cognitive — phase21 AST control nesting/logical sequences, не Sonar-certified.
- Halstead convention: TS AST executable leaf keywords/punctuation/operators как operators; identifiers/literals как operands; types/imports/comments и вложенные function bodies исключены. D=(n1/2)*(N2/n2), функция отдельно.
- Compiler probe `node /private/tmp/dv-lab-phase21-parallel/21-13-owned-types.cjs` — exit 0: TypeScript 6.0.3, 41 файл, 14083 узла, anyCount=0, diagnostics=0. Проверены bound identifiers, параметры, вызовы и property/element expressions. Два intrinsic `JSON.parse` записаны отдельно: их результаты сразу присвоены `unknown` на границе ввода. Type/import/export nodes и syntax binding containers не входят в знаменатель. Текущие file SHA и метод — в `21-13-owned-types.json`. Knip не нашёл confirmed dead/redundant code в принятом scope.
- Source/method fingerprints: `21-13-helper-metrics.json`, `21-13-v1-metrics.json`, `21-13-procedure-metrics.json`. Это scoped gates; coverage/mutation/audit metrics не заявляются.

## Deviations from Plan / Issues Encountered

1. **[Rule 3 — blocker] Root build.** Turbopack internal CSS/PostCSS bind EPERM воспроизведён default и require_escalated. Настроен поддерживаемый `next build --webpack`; затем именно root `yarn build` получил exit 0. Отдельный прежний webpack fallback не назван root PASS. Flag подтверждён [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/next#next-build-options). Files: apps/web/package.json, AGENTS.md; commits 2cc7bd9/833f218.
2. **[Rule 3 — blocker] Knip typed helpers.** Root project видел только mjs; добавлен scripts/**/*.ts. 39 private type imports переведены на уже объявленный @playwright/test. Deps не устанавливались. Original runtime loader и функции сохранены. Commit 2cc7bd9.
3. **[Rule 1 — bug] V1.** Старый scrollWidth check давал false positive при скрытой обрезке. До product fix strengthened assertion дала exit 1; right=436.125 при viewport320. Первая min-width-only гипотеза не закрыла row overflow и была отменена. Whole-chain measurement показал устойчивые bounds и остаточный 8 px row overflow; fake-clock-only probe дефект не воспроизвёл. Окончательный fix — PageScroll min-width0 плюс сжатие date/time columns. После fix оба Today и narrow runs exit0; right304, client/scroll288. Commit ac713f5.
4. **Harness observations.** Первые ROADMAP attempts: exit1 в 07:22 (неверное ожидание 201 для имени300; actual400), exit1 в 07:24 (browser clock не меняет API time). Проверка заменена реальным началом минуты; light 07:29 и dark завершились0. Product исправление по этим двум ошибкам не требовалось. [Playwright Clock](https://playwright.dev/docs/api/class-clock) документирует browser-context scope.
5. **Sandbox/runtime.** DB default checks получили EPERM, те же важные команды повторены require_escalated. Dev startup default дал bind EPERM/EMFILE; escalated stack работал. Повторный default readiness timeout завершился1, exact escalated readiness — DEV_UP_OK. Ctrl-C собственных долгоживущих dev sessions дал exit1; это shutdown, не проверочный PASS. Финальный escalated down — exit0.
6. **Initial test/build scheduling.** Первая попытка test была sandbox-blocked; следующий escalated run столкнулся с Next lock из-за преждевременно запущенного root build. После завершения процессов test/build выполнены последовательно до exit0. Последний build шёл при остановленном dev-стеке.
7. **Workflow adaptation.** Использованы actual ~/.codex workflow/template/gsd-tools.cjs и trailer Codex. Старые Claude hooks/model/пути и agent-* branch projection не применялись к явно заданной gsd phase branch. STATE/ROADMAP/HANDOFF/continue принадлежат parent; phase advance/push не выполнялись.

## Cleanup, runtime и rerun

Начальный и финальный settings snapshot SHA-256 одинаков: `8ec157deee53f848bf1b5cf6259be2b590c8a791a97912a6d5b96ff06da5f886`. Сравнены наличие строки, значение и точный updated_at; при исходном отсутствии строки она восстановлена в отсутствие. Независимые cleanup owners отработали также после failed attempts.

| Exact command                                                                                                                                               | Exit | Observed                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | ---------------------------------------------------------- |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-evidence.mts settings-before`                                                                              |    0 | TEACHER_BASELINE_OK, hash выше                             |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-evidence.mts settings-after`                                                                               |    0 | TEACHER_EXACT_RESTORE_OK, hash выше                        |
| `node scripts/dev-checks/sql.mjs .env migrator "select count(*)::int as n from students where display_name like 'Alex Example 2%' and import_key is null"`  |    0 | n=0 после всех affected runs                               |
| `node scripts/dev-checks/sql.mjs .env migrator "select count(*)::int as n from students where display_name like 'Alex Example 21%' and import_key is null"` |    0 | n=0 после ROADMAP; финальный 2% count включает эту область |
| `node scripts/dev-checks/wait-dev.mjs up`                                                                                                                   |    0 | DEV_UP_OK                                                  |
| `node scripts/dev-checks/wait-dev.mjs down`                                                                                                                 |    0 | DEV_DOWN_OK финально, escalated                            |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-evidence.mts final`                                                                                        |    0 | BROWSER_EVIDENCE_OK; TEST_SUITE_INPUTS_UNCHANGED files=100 |

Dev start commands: `env -u DATABASE_URL -u MIGRATOR_DATABASE_URL yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev`; оба использовали тот же dev stack. Для browser rerun сначала дождаться up, выполнить нужную exact command из таблиц, затем down. Checks, которые пишут dvlab_test, запускаются последовательно одним runtime owner. Новые среды не создавались.

Bounded live facts: `21-13-checkpoint.json`. Original attempts/status/hash: `21-13-runs.jsonl`. Source version/diff: `21-13-source-evidence.json`, `21-13-browser-source.json`; consolidated final mapping: `21-13-browser-evidence.json` и `21-13-test-evidence.json`. Unavailable observations записаны в WINDOWS #4/#5. Product stubs и новая security surface не добавлены.

## Files Created/Modified

- `.planning/WINDOWS.md` — Записал две непроверенные backstop-проверки, сохранил прежние записи.
- `AGENTS.md` — Описал штатную сборку web через webpack; сверил владельцев с source.
- `apps/web/app/(app)/_components/today-lessons.tsx` — Разрешил сжатие колонок даты/времени в узком окне; desktop 72/88 px сохранён.
- `apps/web/components/app/layout-parts.tsx` — Ограничил минимальную ширину Base UI Content доступной шириной PageScroll.
- `apps/web/package.json` — Задал поддерживаемый next build --webpack для реального root build gate.
- `knip.json` — Включил private TypeScript helpers в root project анализа зависимостей.
- `scripts/dev-checks/browser-context.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/ledger-web/common.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/ledger-web/marks-dialog.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/ledger-web/marks-view.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/ledger-web/settings.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/ledger-web/students.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/ledger-web/today-due.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/ledger-web/today-marks.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/ledger-web/today-payment.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/ledger-web/today-read.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/ledger-web/today-rows.ts` — Использовал объявленные типы и проверил реальные границы панелей относительно viewport.
- `scripts/dev-checks/schedule-web/block-probes.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/changes.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/dialogs.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/drag-draft.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/drag-limits.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/drag.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/fade.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/field-values.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/forms.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/grid.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/lesson-creation.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/lesson-preview.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/navigation.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/occurrence-move.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/occurrence-state.ts` — Использовал объявленные типы; JSON наблюдаемого запроса получает unknown и проверку expectedStartsAt перед сравнением.
- `scripts/dev-checks/schedule-web/preferences-context.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/read-fixtures.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/read.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/second-zone-popup.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/series-changes.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/series-forms.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/settings.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/students-forms.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/students-list.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/students.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/week-grid-layout.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/week-navigation.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `scripts/dev-checks/schedule-web/zones.ts` — Перевёл type imports на объявленный @playwright/test; runtime и публичный путь сохранены.
- `.planning/phases/21-lesson-accounting-and-today/21-13-SUMMARY.md` — canonical результаты, fingerprints, ограничения и handoff для parent.

Initial untracked milestone.lock, state.json и generated apps/web/AGENTS.md сохранены. Файлы не удалялись; normal build behavior выполнено по разрешённому плану. Parent commit c63a76b с ROADMAP сохранён, в собственный file inventory не включён.

## Next Phase Readiness

План 13 завершён. Parent получает actual root/test/API/catalog/core/browser evidence и committed V1 fix. Owner18 применяет уже подготовленные девять durable journeys к новому source snapshot; здесь 18 не запускался. Реальная полночь и 300-character rendering остаются честно непроверенными. Calendar manual human UAT сохраняет принятое откладывание до Google24/25. Google/OAuth, privacy/terms фазы24 и deployment в работу 13 не включались.

## Self-Check: PASSED

- Все перечисленные собственные файлы и существующие suites найдены; legacy missing path явно обозначен.
- Все шесть собственных task SHAs и сохранённый parent c63a76b являются предками plan_head_after.
- Сохранены completed original statuses, expected/observed и rerun; V1 source delta ограничен тремя owners; дополнение ниже меняет только occurrence-state.ts.
- Final build/type/lint/strict/format/metrics и affected browser gates прошли; test suite inputs совпали.
- Exact teacher restore, fixture n=0 и DEV_DOWN_OK подтверждены.
- Нет tracked file deletions; собственный diff закоммичен до SUMMARY; последний commit ограничен SUMMARY.

## Дополнение: проверка типов наблюдаемого запроса

Прямое приведение JSON тела запроса к объекту заменено на `unknown` с проверкой структуры в существующем journey `schedule-web changes`. Публичные сигнатуры, продуктовый код, сценарий и expected value сохранены. SQL JSON уже имел границу `unknown`. Simplify применён к этому diff; новых функций, комментариев и suites нет.

Метрики `occurrenceStateStale`: CC 17 → 21, cognitive 11 → 11, Halstead D 30.38095238095 → 31.68604651163. Границы `<22` и `<80` соблюдены. Метод и версии совпадают с Quality выше. Новые results в `21-13-owned-types.json` и обновлённом `21-13-v1-metrics.json`; история исходного V1 остаётся в git commit `ac713f5`.

Первый вызов compiler probe без allowJs не разрешал существующие mjs wrappers. Его диагностика не относится к configured project. После применения allowJs из фактической helper-команды проверены реальные типы; затем устранено прямое приведение тела запроса.

Дополнение завершено на `d6ccf60c1f48840a5eedd3f91fd8b48daabb0bd8`.

| Команда                                                                                                                                                    | Exit | Наблюдение                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------- |
| `node scripts/dev-checks/schedule-web.mjs changes`                                                                                                         | 0    | SCHEDULE_WEB_CHANGES_OK; 109 assertions |
| `node scripts/dev-checks/schedule-web.mjs changes dark`                                                                                                    | 0    | SCHEDULE_WEB_CHANGES_OK; 109 assertions |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-evidence.mts settings-after`                                                                              | 0    | TEACHER_EXACT_RESTORE_OK; прежний SHA   |
| `node scripts/dev-checks/sql.mjs .env migrator "select count(*)::int as n from students where display_name like 'Alex Example 2%' and import_key is null"` | 0    | n=0                                     |
| `node scripts/dev-checks/wait-dev.mjs down`                                                                                                                | 0    | DEV_DOWN_OK                             |

Expected/observed, original exits, fixtures и rerun сохранены в `/private/tmp/dv-lab-phase21-parallel/21-13-type-followup.json`. Source SHA256 `ad7ec04d325bf2465d04b2781af8b2c95a7018a409054e59181b76ed037eec94`; diff SHA256 от ac713f5 `66615b5f30e95509b854f84c605781ce03cf6e2e9c027ccb73f325234eb7b040`. Эти два affected runs дополняют исходные 38. Product build и существующие suites повторно не запускались: их входы не менялись.
