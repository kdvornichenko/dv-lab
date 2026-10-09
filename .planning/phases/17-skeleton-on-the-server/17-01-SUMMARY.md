---
phase: 17-skeleton-on-the-server
plan: 01
subsystem: infra
tags: [yarn, turbo, typescript, monorepo, lockfile, workspaces]

requires: []
provides:
  - "Дерево без кода эпохи Supabase: старые apps/*, packages/*, docs/, корневые аудиты удалены"
  - "Yarn 4.18.1 через yarnPath и packageManager, возрастной барьер Yarn не ослаблен (1440)"
  - "Корневой пакет dv-lab и workspace @dv-lab/web, @dv-lab/api, @dv-lab/db на точных версиях"
  - "Единственный yarn.lock фазы (676 resolution), install --immutable и dedupe --check проходят"
affects: [17-02, 17-03, 17-04]

actuals:
  tokens: 47530
  tasks: 1
  commits: 0

tech-stack:
  added: [yarn@4.18.1, turbo@2.11.7, typescript@6.0.3, next@16.4.0, react@19.3.0, hono@4.13.13, "@hono/node-server@2.1.4", drizzle-orm@1.0.0-rc.4, drizzle-kit@1.0.0-rc.4, tsdown@0.23.0, vitest@5.0.3, vite@8.3.3]
  patterns: ["JIT-пакет @dv-lab/db: exports на ./src/index.ts, без dist и без paths", "точные версии без ^ и ~ во всех четырёх package.json"]

key-files:
  created: [apps/web/package.json, apps/api/package.json, .yarn/releases/yarn-4.18.1.cjs]
  modified: [package.json, .yarnrc.yml, yarn.lock, turbo.json, tsconfig.base.json, .gitignore, .prettierrc.json, packages/db/package.json]

key-decisions:
  - "Исполнение инлайн в основной сессии, а не через gsd-executor: путь executor коммитит и удаляет worktree вместе с некоммиченным SUMMARY, а коммиты запрещены"
  - "Lockfile пересобран с нуля после того, как миграция Yarn выставила npmMinimalAgeGate: 0"

requirements-completed: [INFRA-05, INFRA-08]

coverage:
  - id: D1
    description: "Код эпохи Supabase удалён: git grep --untracked по дереву без .planning пуст"
    requirement: INFRA-08
    verification:
      - kind: other
        ref: "git grep --untracked -n -i -E 'supa[b]ase' -- . ':(exclude).planning'; test $? -eq 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Версии закреплены точно, чистая установка воспроизводима, дедупликация чистая"
    requirement: INFRA-05
    verification:
      - kind: other
        ref: "yarn install --immutable; yarn dedupe --check; проверка pins ok"
        status: pass
    human_judgment: false
  - id: D3
    description: "Владелец просмотрел yarn.lock и список прямых зависимостей"
    requirement: INFRA-05
    verification:
      - kind: manual_procedural
        ref: "задача 2 плана 17-01: владелец ответил approved"
        status: pass
    human_judgment: true
    rationale: "Решение владельца 3: проверка lockfile человеком"
  - id: D4
    description: "Локальные .env и .env.test для домашней базы лежат в корне и игнорируются git"
    requirement: INFRA-08
    verification:
      - kind: other
        ref: "git check-ignore -q .env; git check-ignore -q .env.test; node-скрипт плана печатает env ok"
        status: pass
    human_judgment: true
    rationale: "Значения знает только владелец (сессия Server guy), файлы создал владелец"

duration: 40min
completed: 2026-10-09
status: complete
---

# Phase 17 Plan 01: чистое дерево на закреплённом тулчейне Summary

**Старый код удалён, Yarn 4.18.1 и три манифеста `@dv-lab/*` на точных версиях установлены одним lockfile; план остановлен на двух шагах владельца (проверка lockfile и файлы `.env`).**

## Статус

`status: complete`: выполнены все три задачи. Задача 2 (`checkpoint:human-verify`, lockfile) одобрена владельцем ("approved"), задача 3 (`checkpoint:human-action`, файлы `.env` и `.env.test`) выполнена владельцем ("done"). Коммитов нет, всё лежит в рабочем дереве worktree `phase17-wave1` (ветка `worktree-phase17-wave1`).

## Accomplishments

- Удалены `apps/web`, `apps/api`, `packages/api-types`, `packages/db`, `packages/rbac`, `docs`, корневые аудиты, `README.md`, корневой `tsconfig.json`, `.env.example`, `.github/workflows/ci.yml`, `.yarn/releases/yarn-4.14.1.cjs`. Всего удалено 310 отслеживаемых файлов. `.turbo` и `.cache` в свежем worktree не было; `node_modules` стёрт перед пересборкой lockfile.
- `.claude/settings.local.json` снят с учёта (`git rm --cached`), локальная копия на диске осталась.
- Yarn 4.18.1: `yarnPath` и `packageManager` указывают на 4.18.1, `yarn config get npmMinimalAgeGate` печатает 1440, ключа `npmMinimalAgeGate` в `.yarnrc.yml` нет.
- Корневой `package.json` (`dv-lab`, `engines.node >=24`, скрипты `dev`, `build`, `typecheck`, `lint`, `test`, `format`, `format:check`, `knip`, `db:generate`, `db:migrate`), `turbo.json` (схема `v2-11-7`, `test.dependsOn` = `^build` и `build`, без `globalEnv`), `tsconfig.base.json` (без `paths` и `lib`), `.gitignore` (убран `.gitnexus`, добавлен `/apps/api/drizzle`), `.prettierrc.json` (`^@dv-lab/`).
- Манифесты `@dv-lab/web`, `@dv-lab/api` (с `@dv-lab/db: workspace:*`), `@dv-lab/db` (`exports` `.` на `./src/index.ts`), без поля `scripts`, все версии точные.
- `yarn.lock`: 676 resolution, источники только `npm` и `workspace`, плюс три встроенных compat-патча Yarn (`fsevents`, `resolve`, `typescript`).

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn install --immutable` | код 0, YN0028 нет |
| `yarn dedupe --check` | код 0 |
| `git grep --untracked -n -i -E 'supa[b]ase' -- . ':(exclude).planning'` | пусто, код 1 |
| проверка точных версий (`node -e`) | `pins ok` |
| `yarn config get npmMinimalAgeGate` | 1440 |
| `yarn prettier --check` по новым JSON | `All matched files use Prettier code style!` |
| `yarn turbo --version`, `yarn tsc --version`, `yarn knip --version` | 2.11.7, 6.0.3, 6.40.0 |
| `git check-ignore -q .env`, `git check-ignore -q .env.test` | оба кода 0, права файлов 600, в `git status` их нет |
| скрипт задачи 3 (роли и базы в URL, значения не печатаются) | `env ok` |
| критерии приёмки задачи 1 (каталоги, `yarnPath`, `name`, `packageManager`, `drizzle-orm`, `typescript`, `^@dv-lab/`, `test.dependsOn`, `git ls-files`) | все выполнены |

`yarn install` печатает предупреждения YN0060 и YN0086: ESLint 10.12.0 не удовлетворяет peer `^9.7.0` у `eslint-plugin-import` и других плагинов `eslint-config-next`. Это известное условие из исследования; откат на ESLint 9.39.5 делается только если 17-02 покажет ошибку плагина на lint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Блокер] Миграция Yarn выставила `npmMinimalAgeGate: 0`**
- **Found during:** Задача 1, первый `yarn install`
- **Issue:** Yarn 4.18 при первой установке мигрировал старый lockfile (`YN0087`) и дописал в `.yarnrc.yml` ключ `npmMinimalAgeGate: 0`. Резолв шёл без возрастного барьера, `yarn config get` печатал 0, что нарушает запрет плана. В тот lockfile попадали версии младше 24 часов (например, `baseline-browser-mapping@2.11.28`).
- **Fix:** ключ удалён из `.yarnrc.yml`, `yarn.lock` создан заново с рабочим барьером. Новый lockfile разошёлся с прежним по транзитивным версиям (например, `baseline-browser-mapping` 2.11.27 вместо 2.11.28).
- **Files modified:** `.yarnrc.yml`, `yarn.lock`
- **Verification:** `yarn config get npmMinimalAgeGate` = 1440, ключа в файле нет, после повторной установки файл не менялся.

**2. [Rule 3 - Блокер] Висячий `yarnPath` мешал `yarn set version`**
- **Found during:** Задача 1, установка Yarn 4.18.1
- **Issue:** после удаления `yarn-4.14.1.cjs` команда `corepack yarn@4.18.1 set version 4.18.1` падала с `ENOENT` по старому `yarnPath`.
- **Fix:** строка `yarnPath` удалена вручную, `set version` вернул её с `yarn-4.18.1.cjs`.
- **Files modified:** `.yarnrc.yml`

**3. [Rule 3 - Блокер] Без `yarn.lock` Yarn искал проект в основной копии**
- **Found during:** Задача 1, пересборка lockfile
- **Issue:** при удалённом `yarn.lock` в worktree Yarn поднялся к основной копии и отказал по workspace-конфигурации, ничего там не изменив.
- **Fix:** в worktree создан пустой `yarn.lock` перед `yarn install`.

### Отклонения от текста плана

- **Запуск в worktree.** Сессия стартовала в основной копии на `master`, а не в worktree. Создан worktree `phase17-wave1` от `master` (581632b, совпадает с `origin/master`), планы фазы 17, `STATE.md` и `ROADMAP.md` скопированы из основной копии. Основная копия не менялась.
- **Инлайн-исполнение вместо `gsd-executor`.** Путь executor коммитит каждую задачу и удаляет worktree вместе с некоммиченным SUMMARY; при запрете коммитов это потеряло бы работу.
- **`handle_branching` пропущен.** `branching_strategy: phase` создал бы ветку `gsd/phase-17-skeleton-on-the-server`, но без коммитов она не нужна; ветку и коммит оформляет владелец.
- **`yarn dedupe`.** Первый lockfile (собранный без барьера) требовал дедупликации 16 транзитивных пакетов. Финальный lockfile пересобран с нуля и `yarn dedupe --check` проходит без правок.
- **Кавычки `'**'` в `approvedGitRepositories`.** Yarn переписал их на `"**"`, значения не менялись, кавычки возвращены ради минимального diff.

### Версии

- Взяты ровно версии из плана, все прошли проверку `npm view <pkg> time` (возраст не менее 24 часов на 2026-10-09T11:20Z).
- `vite` 8.3.3, а не 8.3.4: 8.3.4 имел возраст 23,2 ч (барьер открывается около 12:07Z).
- `knip` 6.40.0, а не 6.41.0: 6.41.0 имел возраст 3,4 ч.
- `postcss` 8.5.29 по плану (в исследовании 8.5.28; 8.5.29 старше 24 ч).
- TypeScript 6.0.3 вместо 7.0.2: typescript-eslint 8.x требует TypeScript ниже 6.1.0, tsup и rollup-plugin-dts падают на TS 7.
- `drizzle-orm` и `drizzle-kit` 1.0.0-rc.4: D-13 требует Drizzle v1, тег `latest` указывает на 0.45.
- `tsdown` вместо `tsup`: tsup не поддерживается.
- WebSocket из `@hono/node-server` 2.x с `ws`, без `@hono/node-ws`: у него конфликт peer с `@hono/node-server` 2.x.
- `@types/node` 24.19.1: рантайм Node 24.

### Общие

**Всего отклонений:** 3 автоисправления (Rule 3) и 5 отклонений от текста плана.
**Влияние на план:** автоисправления необходимы, чтобы барьер возраста действовал и установка проходила; объём работ не расширен.

## Issues Encountered

Первый lockfile собран без барьера (см. автоисправление 1) и заменён. Других проблем нет.

## User Setup Required

Оба шага владельца выполнены (задачи 2 и 3 плана 17-01). Значения адресов и паролей не записаны ни в одном файле репозитория: `<АДРЕС>`, `<ПОРТ>`, `<ПАРОЛЬ_APP>`, `<ПАРОЛЬ_MIGRATOR>` владелец получил от сессии Server guy. Файлы `.env` и `.env.test` лежат в корне worktree `phase17-wave1` и не читались; при работе из основной копии их нужно перенести туда.

## Next Phase Readiness

Планы 17-02, 17-03 и 17-04 (волна 2) разблокированы статусом `complete`; волны 2 и выше в этой сессии не запускались. В рабочем дереве остаются неотслеживаемые служебные файлы GSD `.planning/milestone.lock` и `.planning/state.json`: в коммит они не нужны. Правило GitNexus из `CLAUDE.md` не применялось: его инструменты не подключены, индекса в дереве нет, а изменение состоит из удаления старого кода и новых манифестов.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09 (частично: задача 1 из 3)*
