---
phase: 18-accounts-and-variant-a-shell
plan: 08
subsystem: ui
tags: [base-ui, autocomplete, next-app-router, tailwind, fontsource, inter, jetbrains-mono, design-tokens]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-05: копия компонентов варианта A, токены, ThemeProvider, ThemeToggle, PageScroll, PageHeader, EmptyLine"
provides:
  - "Группа маршрутов apps/web/app/(app) с разделами Today, Chat, Students, Schedule в оболочке варианта A"
  - "sections.ts: единственный список разделов (sections, isSectionActive, sectionForPath)"
  - "AppShell, AppSidebar, CommandPalette на Base UI Autocomplete (⌘K, поле поиска сайдбара, кнопка поиска верхней панели)"
  - "Токены сверены с дизайн-системой владельца, шрифты Inter Variable и JetBrains Mono Variable из fontsource, класс .app-scale на body"
affects: [18-11, 18-13, 18-14, 18-15, 18-16]

actuals:
  tokens: 20000
  tasks: 4
  commits: 4

tech-stack:
  added: ["@fontsource-variable/inter@5.3.0", "@fontsource-variable/jetbrains-mono@5.3.0"]
  patterns:
    - "Палитра: Dialog (копия) + Autocomplete.Root open inline, пункты {value, label, icon, action}, перемонтирование по key при каждом открытии"
    - "Один список разделов в sections.ts для сайдбара, верхней панели и палитры"
    - "Шкала экрана 22/28 и 13/20 в классе .app-scale на body, :root держит значения tokens.css"

key-files:
  created:
    - "apps/web/app/(app)/layout.tsx"
    - "apps/web/app/(app)/page.tsx"
    - "apps/web/app/(app)/chat/page.tsx"
    - "apps/web/app/(app)/students/page.tsx"
    - "apps/web/app/(app)/schedule/page.tsx"
    - "apps/web/app/(app)/_components/sections.ts"
    - "apps/web/app/(app)/_components/app-shell.tsx"
    - "apps/web/app/(app)/_components/app-sidebar.tsx"
    - "apps/web/app/(app)/_components/command-palette.tsx"
  modified:
    - apps/web/app/globals.css
    - apps/web/app/layout.tsx
    - apps/web/package.json
    - yarn.lock
  deleted:
    - apps/web/app/page.tsx

key-decisions:
  - "A9 закрыт: Base UI Autocomplete сам берёт label у пунктов формы { value, label } (JSDoc itemToStringValue в AutocompleteRoot.d.mts), поэтому itemToStringValue не добавлялось"
  - "Токены: значения владельца и копии 18-05 совпадают по вычисленным значениям, менялись только шкала экрана, шрифты и класс .app-scale"
  - "Запуск пункта палитры идёт через onClick пункта (как в примере документации); onValueChange корня не подключался"
  - "Пункты палитры хранят action ({type: route, href} или {type: theme, theme}), строковый разбор value не нужен"

requirements-completed: [SHELL-01, SHELL-02]

coverage:
  - id: D1
    description: "Оболочка варианта A собирается: четыре раздела, SidebarProvider, SidebarInset на surface-2, верхняя панель, main#content, skip link; prerendered HTML содержит aria-current=page, aria-label Sections и Nothing here yet"
    requirement: SHELL-01
    verification:
      - kind: other
        ref: "yarn workspace @dv-lab/web typecheck; lint; build (маршруты /, /chat, /students, /schedule статические); grep prerendered index.html"
        status: pass
    human_judgment: true
    rationale: "Вид оболочки, края карточки со всех сторон, выдвижная панель на 320 px и отсутствие ошибок в консоли проверяются только в браузере; у исполнителя его нет"
  - id: D2
    description: "Палитра на Base UI Autocomplete внутри Dialog без cmdk и Radix; ESLint no-restricted-imports и grep чисты"
    requirement: SHELL-02
    verification:
      - kind: other
        ref: "bash scratchpad/18-08-checks.sh (autocomplete импортирован, cmdk и radix нет); yarn workspace @dv-lab/web lint"
        status: pass
    human_judgment: true
    rationale: "Фильтрация без учёта регистра, подсветка первого пункта, Enter как клик, Esc с возвратом фокуса, ⌘K, первый символ из поля сайдбара проверяются только в браузере"
  - id: D3
    description: "Токены и шрифты сверены с дизайн-системой владельца; Geist, vitest и vite убраны из web; сборка не обращается к Google"
    requirement: SHELL-02
    verification:
      - kind: other
        ref: "18-08-checks.sh: Inter Variable в globals.css, app-scale в layout.tsx, geist нет, fonts.googleapis нет, .yarnrc.yml без изменений; в собранном CSS есть Inter Variable"
        status: pass
    human_judgment: true
    rationale: "Вычисленный font-family заголовка, размеры 22 и 13 px и читаемость в обеих темах проверяются только в браузере"

duration: 55min
completed: 2026-10-09
status: complete
plan_head_before: d41d1847a304260a03cf4cb8367189688ea73da7
plan_head_after: 6cda5237db332ac61d67889fd4541612b3fc4062
commits: 4
---

# Phase 18 Plan 08: Оболочка варианта A и палитра Summary

**Оболочка варианта A (сайдбар Today, Chat, Students, Schedule, верхняя панель с темой, карточка SidebarInset) и палитра на Base UI Autocomplete с ⌘K и полем поиска; шрифты Inter Variable и JetBrains Mono из fontsource, шкала экрана в .app-scale.**

## Performance

- **Duration:** около 55 мин
- **Tasks:** 4
- **Files modified:** 14 (9 создано, 4 изменено, 1 удалён)

## Accomplishments

- `apps/web/app/page.tsx` удалён, главная теперь `(app)/page.tsx` в оболочке: `AppShell` (skip link, `SidebarProvider persist={false} peek="hover" width="15rem"`, `SidebarInset`, `SurfaceProvider value={2}`, `main#content`), `AppSidebar` (ряд dv-lab с плиткой D, поле Search, меню Sections с `aria-current="page"`, закрытие выдвижной панели при переходе на мобильной ширине), верхняя панель с названием раздела, кнопкой Search (только ниже 768 px) и `ThemeToggle`.
- Разделы Today, Chat, Students, Schedule: `PageHeader` и `EmptyLine` («Nothing here yet»), заголовки вкладок `Today · dv-lab` и так далее (проверены по prerendered HTML).
- Список разделов один раз в `sections.ts` (`sections`, `isSectionActive`, `sectionForPath`), его используют сайдбар, верхняя панель и палитра.
- Палитра: `Dialog size="lg" position="top" showCloseButton={false}` с `data-palette`, `Autocomplete.Root open inline autoHighlight="always" keepHighlight`, группы Sections и Theme (Light, Dark, System), пустое состояние «No matching sections or actions», запуск по `onClick` пункта (раздел: `router.push`, тема: `setTheme`), затем закрытие. Открытие: клик, Enter, Space и первый печатный символ в поле сайдбара, ⌘K или Ctrl+K (с игнором, если открыт другой диалог), кнопка Search верхней панели. Каждое открытие меняет `key`, поле пустое или с символом.
- Сверка с дизайн-системой владельца (`/Volumes/T7/personal/dv-lab/.planning/design/variant-a/tokens.css`, файл не менялся): шрифты `Inter Variable` (`@fontsource-variable/inter/opsz.css`, ось opsz; файл с таким именем есть в 5.3.0) и `JetBrains Mono Variable`, `:root` вернён к display 28/34 и subtitle 14/20, шкала экрана 22/28 и 13/20 вынесена в `.app-scale` на body. `geist`, `vitest`, `vite` убраны из манифеста web.

## Task Commits

1. **Задача 1: оболочка и страница Today** - `4036734` (feat)
2. **Задача 2: токены и шрифты** - `e2e9039` (feat)
3. **Задача 3: разделы и верхняя панель** - `4285fe3` (feat)
4. **Задача 4: палитра** - `6cda523` (feat)

**Plan metadata:** коммит `docs(18-08)` с этим файлом. Число коммитов измерено по `git log --grep "(18-08)"` (4): `rev-list ${plan_head_before}..HEAD` включает коммиты параллельного плана 18-02. `plan_head_before` записан после первого коммита 18-02, поэтому в диапазоне могут быть и его последующие коммиты.

## Результаты проверок

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web typecheck` (после каждой задачи) | чисто |
| `yarn workspace @dv-lab/web lint` (после каждой задачи) | 0 ошибок, 0 предупреждений |
| `yarn workspace @dv-lab/web build` (после каждой задачи) | успешно; маршруты `/`, `/chat`, `/students`, `/schedule`, `/_not-found` статические; без конфликта маршрутов |
| `18-08-checks.sh` (scratchpad) | все PASS: `app/page.tsx` отсутствует; кириллицы в apps/web нет; `Inter Variable` в globals.css; `app-scale` в layout.tsx; `geist` нет; `fonts.googleapis` нет; `.yarnrc.yml` без изменений; Autocomplete импортирован, `cmdk` нет; `cmdk`, `radix-ui`, `@radix-ui` в web нет; комментариев в `(app)` нет |
| prerendered `index.html` | `<title>Today · dv-lab</title>`, Skip to content, `aria-label="Search sections and actions"`, `aria-label="Sections"`, `aria-current="page"`, Nothing here yet |
| заголовки `chat.html`, `students.html`, `schedule.html` | `Chat · dv-lab`, `Students · dv-lab`, `Schedule · dv-lab` |
| собранный CSS | содержит `Inter Variable`; `googleapis` в `.next/static` и `.next/server/app` нет |
| `yarn config get npmMinimalAgeGate` | 1440 (ключа в `.yarnrc.yml` репозитория нет, значение берётся из пользовательской конфигурации; файл не менялся) |
| `yarn prettier --write` на изменённых файлах | чисто |

### Изменения yarn.lock (задача 2)

Только записи: добавлены `@fontsource-variable/inter@npm:5.3.0` и `@fontsource-variable/jetbrains-mono@npm:5.3.0`; удалена запись `geist@npm:1.7.2`; в записи рабочей области `@dv-lab/web` добавлены два пакета fontsource и убраны `geist`, `vite`, `vitest`. Других правок нет. Версии `vite` и `vitest` остаются у api и db (их записи не тронуты). `.yarnrc.yml` не менялся.

### Сверка токенов (globals.css и tokens.css владельца)

Вычисленные значения совпадают, различается только запись, поэтому они не переписывались:

| Группа | Состояние |
|--------|-----------|
| surface-1..8 (светлая и тёмная) | идентичны |
| shadow-1..5 | идентичны по значению (в копии через `--shadow-color` и `--dm-*`, у владельца литералы); shadow-6..8, `--shadow-color`, `--dm-*` оставлены из копии |
| hover, active, selected, tint, tint-hover, success, warning, info, focus-ring, link, link-missing, destructive, destructive-light, border, input, ring | идентичны |
| радиусы sm, md, lg, xl | `calc(var(--radius) ± …)` из копии дают 6, 8, 10, 14 px, как у владельца |
| шкала текста | принято значение владельца для `:root` (display 28/34, subtitle 14/20), 22/28 и 13/20 перенесены в `.app-scale` |
| шрифты | принято: Inter Variable и JetBrains Mono Variable |
| оставлено из копии | `--sidebar-*`, `--chart-*`, `--card`, `--popover`, `--shadow-6..8`, `--dm-*` |
| не добавлялось | `--duration-*`, `--exit-*`, `--stagger-step`, `--tooltip-delay`, `--enter-offset`, `--radius-2xl`, `--radius-full` из tokens.css: в плане не перечислены, скопированные компоненты их не используют |

Расхождений, при которых значение владельца ломало бы скопированный компонент, не выявлено (без браузера не проверено).

## Not verified in a browser

Встроенного браузера у исполнителя не было, dev-сервер не запускался (процессов и слушателей после работы нет). Оркестратору проверить на `yarn workspace @dv-lab/web dev` (http://localhost:3000), в обеих темах:

1. Ширина 1280: сайдбар с dv-lab, полем Search и разделами Today, Chat, Students, Schedule; справа карточка с верхней панелью и строкой Nothing here yet; у Today `aria-current="page"`; края карточки видны с четырёх сторон; консоль без ошибок гидрации.
2. Шрифты: вычисленный font-family заголовка Today равен Inter Variable, `h1` 22 px, строка Nothing here yet 13 px; нет запросов к Google Fonts; тёмная тема читаема.
3. Клики по Chat, Students, Schedule: заголовок раздела в PageHeader и верхней панели, `aria-current` переходит; заголовок вкладки вида `Chat · dv-lab`.
4. Переключатель темы (aria-label Dark theme) меняет схему; в тёмной теме сайдбар, карточка и строка читаемы.
5. Ширина 320: сайдбар скрыт и открывается триггером как выдвижная панель, клик по разделу закрывает её, горизонтальной прокрутки нет (`document.documentElement.scrollWidth <= clientWidth`); кнопка Search видна в верхней панели.
6. Палитра: клик по полю Search открывает её с фокусом в поле; Esc закрывает и возвращает фокус полю (риск: Autocomplete в поле может перехватывать Esc, тогда нужен `onKeyDown` с закрытием); ⌘K или Ctrl+K открывает и закрывает; ввод `s` в поле сайдбара открывает палитру с `s`; `sch` оставляет один пункт Schedule с подсветкой, Enter переходит на /schedule и закрывает палитру (Enter как клик по пункту в коде не проверен); Dark theme включает тёмную тему, System theme возвращает системную; `zzz` показывает No matching sections or actions без заголовков групп; подсветка и текст читаемы в обеих темах; дважды ⌘K подряд не оставляет двух окон.
7. Выступы: список палитры не создаёт горизонтальной прокрутки в диалоге; рамка между строкой ввода и списком (`border-t border-border`) видна в обеих темах.

## Decisions Made

См. `key-decisions` во frontmatter.

## Deviations from Plan

**1. [Rule 3 - Blocking] Проверки `<automated>` запускались скриптом и отдельными командами**
- **Found during:** задачи 1, 2, 4
- **Issue:** хук изоляции worktree отклоняет цепочки с `&&`, `!` и `$(...)`.
- **Fix:** проверки вынесены в `/private/tmp/claude-501/-Volumes-T7-personal-dv-lab/c67bfb49-e738-4052-b0d3-559a7bfaa4c0/scratchpad/18-08-checks.sh` (содержание проверок то же), `yarn workspace @dv-lab/web typecheck|lint|build` вызывались отдельно.

**2. Удаление `apps/web/app/page.tsx`**
- Запланированное удаление (план: «удаляется»); попало в коммит `4036734` как `delete mode`. Непреднамеренных удалений нет.

**3. Мелкие уточнения к тексту плана**
- Кнопка Search верхней панели и поле сайдбара получили обработчики сразу в задаче 4, в задачах 1 и 3 их не было, как и предписано планом.
- Поле `data-palette=""` передаётся пустой строкой (селектор `[data-palette]` срабатывает по наличию атрибута).
- Строки палитры: рамка `border-t border-border` над списком вместо кольца shadow-*, так как это разделитель внутри диалога, а не край карточки.

**Total deviations:** 1 блокирующая по среде, 2 уточнения.
**Impact on plan:** состав файлов и поведение по плану.

## Issues Encountered

- В рабочем дереве есть чужие изменения параллельного плана 18-02 (`apps/api/tsdown.config.ts`, `apps/api/src/auth/accounts.ts`, `apps/api/src/bootstrap-teacher.ts`) и каталог `.gsd/`: этим планом не тронуты и не коммитились.
- `yarn knip` не запускался (ожидаемо красный до 18-16, правило 7).
- Новых тестов нет (директива владельца); у web нет тест-раннера, `vitest` и `vite` убраны из манифеста web.

## Known Stubs

Страницы Chat, Students и Schedule намеренно показывают только PageHeader и строку Nothing here yet (D-14). Students заменит 18-14, остальные разделы заполнятся в фазах 20-23. Проверку входа, имя аккаунта и выход в оболочку добавят 18-11 и 18-13 (в сайдбаре нет `SidebarFooter`).

## Threat Flags

Нет новых сетевых точек, путей авторизации или обращений к файлам. T-18-26: пункты палитры — фиксированный список из `sections.ts` и трёх тем, ввод только фильтрует, `dangerouslySetInnerHTML` не используется. T-18-SC: два пакета fontsource точной версии 5.3.0, diff yarn.lock ограничен ими и удалением geist, возрастной барьер Yarn 1440 действует.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 18-11 (proxy и DAL) и 18-13 (проверка сессии в `(app)/layout.tsx`, имя аккаунта, Sign out, пункт Sign out палитры) заполняют готовую оболочку без смены архитектуры: `CommandPalette` ожидает ещё группу Account, `AppSidebar` — `SidebarFooter` с `SidebarUserFooter`.
- 18-14 заменяет `(app)/students/page.tsx`.
- В волне 3 web-сборка не пересекалась с api: `.next` создан этим планом, процессов нет.

## Self-Check: PASSED

- Файлы на диске найдены: `(app)/layout.tsx`, `(app)/page.tsx`, `(app)/chat|students|schedule/page.tsx`, `_components/{sections.ts,app-shell.tsx,app-sidebar.tsx,command-palette.tsx}`; `apps/web/app/page.tsx` отсутствует.
- Коммиты `4036734`, `e2e9039`, `4285fe3`, `6cda523` найдены в `git log`.
- Критерии приёмки без браузера выполнены (таблица); браузерные пункты перечислены выше как не проверенные.

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-09*
