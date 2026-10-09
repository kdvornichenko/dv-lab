---
phase: 18-accounts-and-variant-a-shell
plan: 05
subsystem: ui
tags: [base-ui, tailwind, next-themes, framer-motion, design-tokens, eslint]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-01: UI-зависимости web (Base UI, framer-motion, lucide-react, next-themes, cva, clsx, tailwind-merge)"
provides:
  - "38 файлов варианта A в apps/web (components/ui, sidebar-app, fluid-hover-highlight, hooks, lib) без комментариев, на Base UI"
  - "Токены варианта A и шкала экрана в apps/web/app/globals.css, тема next-themes (system по умолчанию)"
  - "Общие части экранов apps/web/components/app: ThemeProvider, ThemeToggle, PageScroll, PageHeader, EmptyLine, TextField, PasswordField, Avatar"
  - "Алиас @/* в tsconfig web, ESLint-запрет radix-ui, @radix-ui/*, cmdk, cn"
affects: [18-06, 18-07, 18-08, 18-09, 18-10, 18-11, 18-12, 18-13, 18-14, 18-16]

actuals:
  tokens: 100000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Копия компонентов из vault design-lab скриптом: createPrinter({ removeComments: true }), prettier проекта, импорт cn только из @/lib/utils"
    - "Скрытие смонтированного флага через useSyncExternalStore вместо setState в эффекте (правило react-hooks/set-state-in-effect)"
    - "Поле формы TextField получает id снаружи, helper и error связаны через aria-describedby"

key-files:
  created:
    - apps/web/components/ui/{sidebar,sidebar-core,sidebar-menu,dropdown,dropdown-search,dropdown-sub,menu-item,button,dialog,tooltip,scroll-area,table,banner,skeleton,input,tabs,badge}.tsx
    - apps/web/components/sidebar-app/{search-field,inset-topbar,workspace-header,user-footer}.tsx
    - apps/web/components/fluid-hover-highlight.tsx
    - apps/web/hooks/{use-fluid-hover.ts,use-merge-split.tsx,use-mobile.ts,use-touch-primary.tsx}
    - apps/web/lib/{elevated,icon-context,shape-context,size-context,surface-context}.tsx
    - apps/web/lib/{font-weight,popup,sidebar-menu-grid,springs,surface-classes,type-scale,utils}.ts
    - apps/web/components/app/{theme-provider,theme-toggle,layout-parts,empty-line,text-field,avatar}.tsx
  modified:
    - apps/web/app/globals.css
    - apps/web/app/layout.tsx
    - apps/web/app/page.tsx
    - apps/web/tsconfig.json
    - apps/web/eslint.config.mjs
    - .planning/phases/18-accounts-and-variant-a-shell/18-UI-SPEC.md

key-decisions:
  - "Тесты web не писались по директиве владельца (приоритетнее текста плана): вместо english-only, radix-free и boundary тестов контракт охраняют ESLint no-restricted-imports и разовый скрипт-проверка в scratchpad"
  - "ESLint: no-unused-vars оставлен предупреждением, но с игнором имён на _ и ignoreRestSiblings: скопированные компоненты намеренно отбрасывают пропсы с префиксом _ (после снятия eslint-disable-комментариев давали 21 предупреждение)"
  - "Из Input убраны py-0.5 и md:text-xs/relaxed: высота задана h-9, полу-шаговых классов в правленом коде нет; file:text-xs/relaxed оставлен как в источнике"
  - "aria-roledescription на русском из PageScroll источника не переносился: атрибут опущен, а не переведён"

patterns-established:
  - "Рукописные части экранов лежат в apps/web/components/app и используют только токены и шкалу 4 px"
  - "Подсказка + иконка-кнопка: Tooltip с delayDuration 200 вокруг Button ghost icon-compact с aria-label"

requirements-completed: [SHELL-02]

coverage:
  - id: D1
    description: "38 файлов варианта A скопированы в apps/web без комментариев, русских строк и Radix; замыкание импортов @/ полное"
    requirement: SHELL-02
    verification:
      - kind: other
        ref: "bash scratchpad/18-05-checks.sh (файлов 38, импортов radix/cmdk/cn нет, комментариев нет, кириллицы нет, registry-grep пуст)"
        status: pass
      - kind: other
        ref: "yarn workspace @dv-lab/web typecheck; yarn workspace @dv-lab/web lint; yarn workspace @dv-lab/web build"
        status: pass
    human_judgment: false
  - id: D2
    description: "ESLint отклоняет импорты cmdk, radix-ui, @radix-ui/* и cn"
    requirement: SHELL-02
    verification:
      - kind: other
        ref: "временный apps/web/probe-radix.tsx: yarn workspace @dv-lab/web lint дал 4 ошибки no-restricted-imports; файл удалён"
        status: pass
    human_judgment: false
  - id: D3
    description: "Токены варианта A, тема по умолчанию system, переключатель светлой и тёмной темы, EmptyLine, TextField, PasswordField, Avatar"
    requirement: SHELL-02
    verification:
      - kind: other
        ref: "prerendered .next/server/app/index.html содержит lang=en, noindex, Dark theme, Nothing here yet; собранный CSS содержит .text-display, .bg-surface-2, .dark:hidden"
        status: pass
    human_judgment: true
    rationale: "Вид страницы, переключение темы без белой вспышки, подсказка, контраст в тёмной теме и отсутствие ошибок гидрации проверяются только в браузере; встроенного браузера у исполнителя нет"

duration: 40min
completed: 2026-10-09
status: complete
plan_head_before: 4979ac8
plan_head_after: 940f0ee
commits: 3
---

# Phase 18 Plan 05: Основа web варианта A Summary

**38 файлов варианта A из vault design-lab (Base UI, без Radix, cmdk, комментариев и русских строк) собираются в apps/web с токенами светлой и тёмной схем, темой next-themes и общими частями экранов (PageScroll, PageHeader, EmptyLine, TextField, PasswordField, Avatar, ThemeToggle); Radix закрыт правилом ESLint.**

## Performance

- **Duration:** около 40 мин
- **Tasks:** 3
- **Files modified:** около 75 (копия 38, рукописные 7, прочие)

## Accomplishments

- Копия: скрипт в scratchpad (`createPrinter` с `removeComments`, затем prettier проекта); замыкание импортов `@/` пересчитано по исходникам: 38 файлов, 10 646 строк, недостающих нет, докопировать не пришлось. `lab/a/ui/{input,tabs,badge}` легли в `components/ui/`, импорты `@/components/lab/a/ui/` переписаны, `cn` берётся из `@/lib/utils`.
- `globals.css`: `@custom-variant dark`, `@theme inline` (с `--font-geist-sans` и `--font-geist-mono`, вместе с keyframes `spinner-*`, `sf-*`, `shimmer`), `:root` со шкалой 22/28 и 13/20, `.dark`, `@layer base` (с `body { position: relative }`), `html.transitioning`, `@property --sf-*`, `.scroll-fade`, `.scroll-divider`, правила скроллбара. Без `tw-animate-css`, `.note-content`, `[data-lab]` и комментариев.
- `layout.tsx`: `ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange`, `suppressHydrationWarning`, `div.isolate`, шаблон заголовка `%s · dv-lab`, noindex. `tsconfig.json`: единственный путь `@/*`.
- Восемь русских строк переведены (Sidebar, Show sidebar, Expand sidebar, Collapse sidebar, Toggle sidebar, Drag to resize, Click to collapse, Resize or collapse the sidebar) плюс Close в dialog; `user-footer`: Account и Open account menu; `Input`: h-9, px-2, text-body. В `18-UI-SPEC.md` исправлено предложение в строке 67.
- ESLint: `no-restricted-imports` (error) на `cmdk`, `radix-ui`, `cn` и `@radix-ui/*`; проверено пробным файлом (4 ошибки), файл удалён.
- Рукописные части: `PageScroll`, `PageHeader`, `EmptyLine` («Nothing here yet»), `TextField` (id, label, helper, error), `PasswordField` (Eye/EyeOff, `aria-pressed`), `Avatar` (28 px, инициалы), `ThemeToggle` (aria-label Dark theme, подсказка Light or dark theme, `aria-pressed` после монтирования). Временная `page.tsx` собрана из них (удалит 18-08).

## Task Commits

1. **Задача 1: копия варианта A, токены и тема** - `51f553b` (feat)
2. **Задача 2: перевод строк, правки Input и user-footer, ESLint-запрет Radix, правка UI-SPEC** - `4f4933e` (refactor)
3. **Задача 3: общие рукописные части экранов** - `940f0ee` (feat)

**Plan metadata:** коммит `docs(18-05)` с этим файлом. Число коммитов измерено по `git log --grep "(18-05)"`: между ними лежат коммиты параллельного плана 18-04.

## Результаты проверок

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web typecheck` | чисто |
| `yarn workspace @dv-lab/web lint` | 0 ошибок, 0 предупреждений |
| `yarn workspace @dv-lab/web build` | успешно, маршруты `/` и `/_not-found` статические |
| `yarn prettier --check apps/web` | чисто |
| `18-05-checks.sh`: файлов в копии | 38 |
| импорты `cn`, `cmdk`, `radix-ui`, `@radix-ui/*` в components, lib, hooks, app | NONE |
| radix, cmdk, cn, tw-animate в `apps/web/package.json` | NONE |
| комментарии (`//`, `/*`, `{/*`) в components, lib, hooks, app | NONE |
| кириллица в apps/web (ts, tsx, css, mjs, json) | NONE (до перевода находились ровно 8 строк) |
| registry-grep UI-SPEC (`fetch(`, `XMLHttpRequest`, `sendBeacon`, `process.env`, `eval(`, `new Function`, `Function(`, `import(`) | NONE |
| импорты `@dv-lab/api`, `@dv-lab/db`, `transpilePackages`, каталог `app/api` | NONE |
| классы вне шкалы (0.5, 1.5, 2.5, 3.5, 3, 5, 7) в `components/app` | NONE |
| prerendered `index.html` | `lang="en"`, noindex, `<title>dv-lab</title>`, `aria-label="Dark theme"`, «Nothing here yet», «Workspace is being set up.» |
| собранный CSS | `.text-display`, `.bg-surface-2`, `.dark:hidden` присутствуют |

Скрипты проверок: `/private/tmp/claude-501/-Volumes-T7-personal-dv-lab/c67bfb49-e738-4052-b0d3-559a7bfaa4c0/scratchpad/18-05-checks.sh`, `18-05-copy.cjs`, `18-05-css.cjs`.

## Not verified in a browser

Встроенного браузера у исполнителя не было. Оркестратору осталось проверить на `yarn workspace @dv-lab/web dev` (http://localhost:3000):

1. Страница `/` показывает заголовок dv-lab, строку Workspace is being set up. и панель «Nothing here yet» на фоне surface-2.
2. Кнопка с подписью Dark theme переключает тему (на `html` появляется и пропадает класс `dark`), подсказка Light or dark theme появляется при наведении.
3. Перезагрузка в тёмной теме идёт без белой вспышки; тема по умолчанию следует системной.
4. В тёмной теме панель EmptyLine и текст читаемы, края карточки видны на всех четырёх сторонах.
5. Консоль без ошибок гидрации (предупреждение next-themes о теге script допустимо, A8).
6. Проверка полей: `PasswordField` показывает и скрывает пароль, `aria-pressed` меняется; пока ни один экран их не использует, проверять их удобнее на экране входа 18-08.

## Decisions Made

См. `key-decisions` во frontmatter.

## Deviations from Plan

**1. [Директива владельца] Тесты web не писались**
- **Found during:** отправка задачи, до задачи 2
- **Issue:** план требует `vitest.config.ts`, скрипт `test` и три теста (`english-only`, `radix-free`, `boundary`); координатор передал постоянную директиву владельца: новых unit, integration и e2e тестов не писать.
- **Fix:** файлы `apps/web/vitest.config.ts`, `apps/web/test/*` и скрипт `scripts.test` не созданы. Охрана контракта SHELL-02: правило ESLint, разовый скрипт `18-05-checks.sh` с выводом, процитированным выше, `typecheck`, `lint`, `build`. `yarn workspace @dv-lab/web test` у web по-прежнему нет.
- **Files modified:** нет

**2. [Rule 3 - Blocking] `<automated>` плана запускались скриптом и отдельными командами**
- **Found during:** задачи 1 и 3
- **Issue:** хук изоляции worktree отклоняет цепочки с `&&` и `$(...)`.
- **Fix:** проверки вынесены в `18-05-checks.sh` и отдельные вызовы `yarn workspace @dv-lab/web typecheck|lint|build`; содержание проверок не менялось, кириллица ищется `grep -E '[а-яА-ЯёЁ]'` вместо `-P` (BSD grep).

**3. [Rule 1 - Bug] `ThemeToggle`: setState в эффекте отклонён ESLint**
- **Found during:** задача 3
- **Issue:** флаг монтирования через `useEffect` и `setMounted(true)` даёт ошибку `react-hooks/set-state-in-effect` (eslint-config-next 16.4).
- **Fix:** флаг получен через `useSyncExternalStore` (серверный снимок `false`, клиентский `true`); поведение то же, `aria-pressed` ставится после монтирования.
- **Committed in:** `940f0ee`

**4. [Rule 3 - Blocking] ESLint: предупреждения `no-unused-vars` в копии**
- **Found during:** задача 2
- **Issue:** без снятых eslint-disable-комментариев 21 предупреждение на пропсах `_style`, `_onDrag` и т.п., которые компоненты отбрасывают намеренно (A12).
- **Fix:** в конфиге правило с `varsIgnorePattern`/`argsIgnorePattern: '^_'` и `ignoreRestSiblings`; ни одно правило не отключено по каталогам, список отключённых правил пуст.
- **Committed in:** `4f4933e`

**5. Мелкие отклонения от текста плана**
- `page.tsx` в задаче 1 — клиентский компонент с `useTheme` и копированной кнопкой Toggle theme, в задаче 3 заменён серверной страницей из общих частей, как требует план.
- Prettier повторно прогнан в задаче 2: первый прогон в задаче 1 шёл до записи `globals.css`, и плагин Tailwind сортировал классы без токенов проекта; правки порядка классов вошли в коммит `4f4933e`.
- В `PageScroll` не перенесён русский `aria-roledescription` источника (атрибут опущен).

---

**Total deviations:** 4 (1 директива владельца, 1 баг, 2 блокирующих по среде), 1 пропущенный атрибут
**Impact on plan:** состав файлов и поведение по плану, кроме отсутствия тестов web.

## Issues Encountered

- `.planning/config.json`, `18-CONTEXT.md` и `18-ARCH-REVIEW.md` изменены в рабочем дереве не этим планом, `apps/api/src/auth/` не отслежен (параллельный план 18-04): ничего из этого не коммитилось.
- `yarn knip` не запускался (ожидаемо красный до 18-16, правило 7).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Для планов экранов готовы: `PageScroll`, `PageHeader`, `EmptyLine`, `TextField`, `PasswordField`, `Avatar`, `ThemeToggle`, `ThemeProvider` в `@/components/app/*`; `Banner`, `Button`, `Dialog`, `Tooltip`, `Table`, `Tabs`, `Badge`, `Skeleton`, сайдбар и выпадающее меню в `@/components/ui/*` и `@/components/sidebar-app/*`.
- Интерфейс `TextField`: `id` обязателен, есть `helper`, `error`, `trailing`; `PasswordField` принимает те же свойства без `type` и `trailing`.
- `page.tsx` временная, удалит 18-08. Тестового раннера со скриптом `test` у web нет (директива владельца): `vitest` и `vite` в devDependencies остались от 18-01.
- Процессов и dev-серверов этот план не запускал.

## Self-Check: PASSED

- Файлы на диске: 38 копированных (ls), `components/app/{theme-provider,theme-toggle,layout-parts,empty-line,text-field,avatar}.tsx`, `globals.css`, `layout.tsx`, `page.tsx` найдены.
- Коммиты `51f553b`, `4f4933e`, `940f0ee` найдены в `git log`.
- Критерии приёмки: пункты, не требующие браузера, выполнены (см. таблицу); `probe-radix.tsx` удалён (`test ! -e`).
- Не запускались: `yarn test` (скрипта нет), `yarn knip`, браузерные проверки.

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-09*
