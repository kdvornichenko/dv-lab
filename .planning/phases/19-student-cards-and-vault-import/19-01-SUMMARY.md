---
phase: 19-student-cards-and-vault-import
plan: 01
subsystem: infra
tags: [yarn, workspaces, packages-core, react-markdown, remark-gfm, react-day-picker]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: рабочие области contracts, db, api, web и lockfile
provides:
  - пакет @dv-lab/core (JIT-близнец contracts, без зависимостей)
  - ссылки "@dv-lab/core": "workspace:*" в apps/api и apps/web
  - точные версии react-markdown 10.1.0, remark-gfm 4.0.1, react-day-picker 10.0.1 в web
  - node_modules в рабочей копии фазы 19
affects: [19-04, 19-11, 19-19]

actuals:
  tokens: 14000
  tasks: 2
  commits: 2

tech-stack:
  added: [react-markdown 10.1.0, remark-gfm 4.0.1, react-day-picker 10.0.1]
  patterns: [JIT-пакет рабочей области без сборки и без тестового раннера]

key-files:
  created:
    - packages/core/package.json
    - packages/core/tsconfig.json
    - packages/core/src/index.ts
  modified:
    - apps/api/package.json
    - apps/web/package.json
    - yarn.lock

key-decisions:
  - "core без dependencies, test, vite и vitest: функции денег и остатка добавит 19-04"
  - "Возрастной барьер Yarn не тронут: .yarnrc.yml без изменений"

requirements-completed: [LEDG-02, CARD-02]

plan_head_before: 6ca736f
plan_head_after: 6c55799

duration: 12min
completed: 2026-10-10
status: complete
---

# Phase 19 Plan 01: Пакет core и зависимости web Summary

**Пакет @dv-lab/core подключён к api и web как JIT-близнец contracts; в web точно закреплены react-markdown 10.1.0, remark-gfm 4.0.1 и react-day-picker 10.0.1 при нетронутом барьере возраста 1440.**

## Performance

- **Duration:** около 12 мин
- **Tasks:** 2
- **Files modified:** 9 (три новых файла core, два манифеста, yarn.lock, SUMMARY)

## Accomplishments

- `yarn install --immutable` в пустой рабочей копии прошёл без изменения lockfile фазы 18.
- Создан `packages/core` (`exports` на `./src/index.ts`, скрипт `typecheck`, из зависимостей только `typescript` 6.0.3 в devDependencies, `src/index.ts` содержит `export {}`).
- api и web получили `"@dv-lab/core": "workspace:*"`; из обоих каталогов `import('@dv-lab/core')` разрешается.
- В web закреплены react-markdown 10.1.0, remark-gfm 4.0.1, react-day-picker 10.0.1 (флаг `-E`); 10.0.2 не ставилась.

## Task Commits

1. **Задача 1: пакет @dv-lab/core подключён к api и web** - `b04338a` (chore)
2. **Задача 2: три пакета web закреплены точно** - `6c55799` (chore)

**Plan metadata:** коммит `docs(19-01)` с этим файлом.

## Files Created/Modified

- `packages/core/package.json` - манифест @dv-lab/core
- `packages/core/tsconfig.json` - extends tsconfig.base.json, lib ES2023, types [], include src
- `packages/core/src/index.ts` - `export {}`
- `apps/api/package.json`, `apps/web/package.json` - ссылка на core; в web три новых пакета
- `yarn.lock` - рабочая область core и 18 новых пакетов

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn install --immutable` до изменений и после обеих задач | проходит |
| `yarn workspace @dv-lab/core typecheck`, `@dv-lab/api typecheck`, `@dv-lab/web typecheck` | без ошибок |
| `19-01-resolve.mjs` | `RESOLVE_OK` (apps/api и apps/web, код 0) |
| `yarn config get npmMinimalAgeGate` | 1440; `.yarnrc.yml` без diff и без строки npmMinimalAgeGate |
| acceptance задачи 1 (`19-01-accept1.mjs`) | core без dependencies и test: PASS; ссылки в api и web: PASS |
| acceptance задачи 2 (`19-01-accept2.mjs`) | точные версии, нет `^`/`~` в трёх манифестах, нет radix и cmdk в yarn.lock, установленная react-day-picker 10.0.1: все PASS |

Отчёт `19-01-ages.mjs` (возраст версий с публикации): react-markdown 10.1.0 - 13953 ч; remark-gfm 4.0.1 - 14551 ч; react-day-picker 10.0.1 - 3538 ч; date-fns 4.4.0 - 3188 ч; @date-fns/tz 1.5.0 - 3393 ч; итог `AGES_OK` (все старше 24 ч).

Не запускалось: `yarn knip` (по плану, итоговая проверка в 19-19), lint, build (в плане не требуются), новые тесты (директива владельца).

## Decisions Made

None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written. Единственная поправка техники: команда `yarn workspace ... add -E @dv-lab/core@workspace:*` в zsh потребовала кавычек вокруг `workspace:*` (глоб), результат тот же.

## Issues Encountered

None. Предупреждение Yarn YN0060 о peer-зависимости eslint (10.12.0 против ^9.7.0 у eslint-plugin-import) было до плана и не относится к нему.

## User Setup Required

None - no external service configuration required.

## Threat Flags

Нет новой поверхности: добавлены только пакеты по аудиту легитимности из 19-RESEARCH.

## Next Phase Readiness

- Волна 2 может импортировать `@dv-lab/core` в api и web без второй установки; функции денег и остатка добавляет 19-04.
- Допущение A1 (Next компилирует TS из packages/core без transpilePackages) подтвердится первым импортом core в web (19-11).
- node_modules в рабочей копии готовы; повторный `yarn install` другим планам не нужен.

## Self-Check: PASSED

- Файлы packages/core/package.json, tsconfig.json, src/index.ts существуют.
- Коммиты b04338a и 6c55799 есть в `git log`.
- `git rev-list --count 6ca736f..HEAD` до SUMMARY равен 2.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
