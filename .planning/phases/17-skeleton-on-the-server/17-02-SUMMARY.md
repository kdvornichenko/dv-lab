---
phase: 17-skeleton-on-the-server
plan: 02
subsystem: infra
tags: [next, react, tailwind, geist, eslint, standalone]

requires:
  - phase: 17-skeleton-on-the-server
    provides: "манифест @dv-lab/web с точными версиями и общий yarn.lock (план 17-01)"
provides:
  - "apps/web: страница-заглушка на Next 16.4.0 и React 19.3.0, шрифты из пакета geist"
  - "Сборка output standalone: apps/web/.next/standalone/apps/web/server.js"
  - "Скрипты @dv-lab/web: dev, build, start, typecheck, lint"
  - "ESLint 10.12.0 с eslint-config-next 16.4.0 (плоский конфиг)"
  - "Граница web и api (D-07) проверяется командой"
affects: [17-06, 17-10, phase-18]

actuals:
  tokens: 940
  tasks: 2
  commits: 2
plan_head_before: 5d623fd
plan_head_after: 1f3bd55e90fbe70d49ada9905a86e25bf58e6608

tech-stack:
  added: []
  patterns: ["output standalone с outputFileTracingRoot на корень монорепы", "web без @dv-lab/* зависимостей, без app/api, transpilePackages, rewrites и paths", "шрифты только из пакета geist, без next/font/google"]

key-files:
  created: [apps/web/tsconfig.json, apps/web/next.config.ts, apps/web/postcss.config.mjs, apps/web/eslint.config.mjs, apps/web/app/layout.tsx, apps/web/app/page.tsx, apps/web/app/globals.css, apps/web/public/robots.txt]
  modified: [apps/web/package.json]

key-decisions:
  - "ESLint 10.12.0 работает с eslint-config-next 16.4.0 без ошибок плагинов, откат на 9.39.5 не понадобился"
  - "metadata в layout.tsx без аннотации типа Metadata: план давал только title и robots, typecheck проходит"

requirements-completed: [INFRA-01, INFRA-05]

coverage:
  - id: D1
    description: "Заглушка web собирается на Next 16.4.0 и React 19.3.0 в standalone, server.js создан"
    requirement: INFRA-05
    verification:
      - kind: other
        ref: "yarn workspace @dv-lab/web build; test -f apps/web/.next/standalone/apps/web/server.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Запущенный standalone-сервер отвечает 200 на GET /, тело содержит dv-lab и meta robots noindex"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "node-проба плана: порт 3107, статус 200, dv-lab в теле"
        status: pass
    human_judgment: false
  - id: D3
    description: "lint и typecheck web завершаются кодом 0, prettier-проверка файлов web чистая"
    requirement: INFRA-05
    verification:
      - kind: other
        ref: "yarn workspace @dv-lab/web lint; yarn workspace @dv-lab/web typecheck; yarn prettier --check"
        status: pass
    human_judgment: false
  - id: D4
    description: "Граница D-07: нет app/api, нет @dv-lab/* в манифесте, нет transpilePackages, rewrites и paths"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "команда границы D-07 из verify задачи 2"
        status: pass
    human_judgment: false
  - id: D5
    description: "Заглушка в браузере: Geist, английский текст, чистая консоль"
    requirement: INFRA-01
    verification: []
    human_judgment: true
    rationale: "human-check задачи 1 (yarn dev и просмотр localhost:3000); режим end-of-phase откладывает его на проверку фазы, браузер в этой сессии не открывался"

duration: 15min
completed: 2026-10-09
status: complete
---

# Phase 17 Plan 02: web-заглушка на Next 16.4 со standalone-сборкой Summary

**Страница-заглушка dv-lab на Next 16.4.0 и React 19.3.0 с шрифтами из пакета geist собирается в standalone и отвечает 200; ESLint, typecheck и проверка границы web и api (D-07) проходят.**

## Performance

- **Duration:** около 15 мин
- **Tasks:** 2
- **Files:** 9 (8 созданы, `apps/web/package.json` изменён)

## Accomplishments

- `apps/web/next.config.ts`: `output: 'standalone'`, `outputFileTracingRoot` на корень монорепы, `poweredByHeader: false`. Сборка создаёт `apps/web/.next/standalone/apps/web/server.js`.
- `layout.tsx`: `GeistSans` и `GeistMono` из `geist/font/sans` и `geist/font/mono`, `html lang="en"`, `metadata` с `title: 'dv-lab'` и `robots: { index: false, follow: false }`. `page.tsx`: серверный компонент с заголовком `dv-lab` и строкой "Workspace is being set up.". `globals.css`: Tailwind 4 и тема с `--font-sans`, `--font-mono` из переменных geist.
- `public/robots.txt` с `Disallow: /` (каталог `public` нужен и для `COPY` в образе, 17-10).
- `eslint.config.mjs`: `eslint-config-next/core-web-vitals` и `eslint-config-next/typescript` через `defineConfig`, игнор `.next/**`, `out/**`, `next-env.d.ts`.
- Скрипты `@dv-lab/web`: `dev`, `build`, `start`, `typecheck` (`next typegen && tsc --noEmit`), `lint` (`eslint .`). Зависимости и `yarn.lock` не менялись, `npmMinimalAgeGate` в `.yarnrc.yml` не появился.

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web build` (в выводе нет Google Fonts и "Failed to fetch") | код 0, маршруты `/` и `/_not-found` статические |
| `test -f apps/web/.next/standalone/apps/web/server.js` | есть |
| проба standalone-сервера (порт 3107, `HOSTNAME=127.0.0.1`) | статус 200, `dv-lab` в теле, `<meta name="robots" content="noindex, nofollow">` |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `yarn workspace @dv-lab/web typecheck` | код 0 |
| `yarn prettier --check` по `apps/web` | чисто |
| `test ! -e apps/web/app/api`, `grep geist/font/sans`, `grep 'Disallow: /'`, отсутствие `next/font/google` | все выполнены |
| проверка D-07 (нет `@dv-lab/*` в манифесте, нет `transpilePackages`, `rewrites`, `paths`) | код 0 |

Сервер на порту 3107 остановлен, слушателей на порту нет.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Формат] Prettier-порядок импортов в `next.config.ts`**
- **Found during:** Задача 2, проверка `prettier --check`
- **Issue:** файл из примера исследования (тип `NextConfig` после `node:`-импортов, с пустой строкой) не соответствует плагину сортировки импортов проекта.
- **Fix:** `prettier --write`; тип `NextConfig` теперь идёт первым.
- **Files modified:** `apps/web/next.config.ts`
- **Commit:** 1f3bd55

### Отклонения от текста плана

- **human-check задачи 1 не выполнялся.** `workflow.human_verify_mode` = `end-of-phase`, автопилот выключен; автоматические проверки задачи пройдены, просмотр `yarn dev` в браузере остаётся на проверку фазы (в coverage это D5, `human_judgment: true`).
- **Откат ESLint не потребовался.** Условие плана (ошибка плагина на eslint 10.12.0) не наступило: lint завершился кодом 0. Предупреждения peer YN0060 и YN0086 из 17-01 остаются предупреждениями.

**Всего отклонений:** 1 автоисправление (форматирование) и 2 пояснения к тексту плана.
**Влияние на план:** нет, объём работ не расширен.

## Issues Encountered

Standalone-сервер сам не отдаёт `public/` и `.next/static`: `GET /robots.txt` на нём вернул 404 (страница-заглушка при этом отдаётся). Это ожидаемо для `output: 'standalone'`: образ web в 17-10 копирует `public` и `.next/static` рядом с `server.js`, и до того `robots.txt` на локальном standalone не проверяется. Защита от индексации в любом случае действует через `metadata` (noindex в HTML).

## Known Stubs

- `apps/web/app/page.tsx`: страница-заглушка "Workspace is being set up." заложена планом (Claude's Discretion, заглушка до фазы 18); цель плана (собирающийся и отдающий 200 web скелета) она не блокирует. Заменяется в фазе 18.

## Threat Flags

Нет новых поверхностей сверх `threat_model` плана. Меры T-17-03 (шрифты из geist, нет `next/font/google`, сеть при сборке не нужна) и T-17-04 (граница web и api проверена командой D-07) выполнены; T-17-05 принят (`robots.txt` и noindex).

## User Setup Required

Нет.

## Next Phase Readiness

Планы 17-03 и 17-04 (волна 2) не затронуты: общие файлы не менялись. Образ web (17-10) может опираться на `apps/web/.next/standalone/apps/web/server.js` и существующий `apps/web/public`; прокси 17-06 владеет префиксом `/api`.

## Self-Check: PASSED

Файлы из `key-files.created` существуют; коммиты `98766da` и `1f3bd55` найдены в `git log`; все acceptance_criteria обеих задач и plan-level `<verification>` перезапущены и проходят.

---
*Phase: 17-skeleton-on-the-server*
*Completed: 2026-10-09*
