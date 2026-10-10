---
phase: 19-student-cards-and-vault-import
plan: 06
subsystem: ui
tags: [base-ui, react-day-picker, react-markdown, remark-gfm, variant-a, tailwind]

requires:
  - phase: 19-student-cards-and-vault-import
    provides: плана 19-01, точные версии react-markdown 10.1.0, remark-gfm 4.0.1, react-day-picker 10.0.1 в web
provides:
  - Select, Combobox, Textarea, Popover, Calendar и хук useKeyboardNavGate из варианта A
  - DateField (строка YYYY-MM-DD, en-US, неделя с понедельника, запрет дат позже max)
  - MarkdownView по карте классов DR-1 (skipHtml, стандартный urlTransform)
  - StatusDot в components/app для active, archived, deactivated
  - apiRequest с методами GET, POST, PUT, PATCH, DELETE
affects: [19-11, 19-14, 19-16, 19-17, 19-18, 19-19]

actuals:
  tokens: 16000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "копия компонента варианта A: снятие комментариев через AST TypeScript, prettier, точечные замены размеров текста"
    - "markdown через react-markdown components, без rehype-raw, skipHtml, стандартный urlTransform"

key-files:
  created:
    - apps/web/components/ui/select.tsx
    - apps/web/components/ui/combobox.tsx
    - apps/web/components/ui/textarea.tsx
    - apps/web/components/ui/popover.tsx
    - apps/web/components/ui/calendar.tsx
    - apps/web/hooks/use-keyboard-nav-gate.ts
    - apps/web/components/app/date-field.tsx
    - apps/web/components/app/markdown-view.tsx
    - apps/web/components/app/status-dot.tsx
  modified:
    - apps/web/app/(app)/students/_components/students-screen.tsx
    - apps/web/lib/api-client.ts

key-decisions:
  - "Отмеченный пункт задачи в markdown приглушается через has-[[role=checkbox][aria-checked=true]] на li, без разбора узла hast"
  - "Фокусируемость квадрата задачи не нужна: он только для чтения, role=checkbox с aria-checked и aria-readonly"
  - "Кнопки навигации Calendar берут классы buttonVariants плюс rounded-md и hover:bg-hover через локальную navButtonClass: у Button этого репозитория фон лежит во внутреннем span, у кнопок DayPicker его нет"

requirements-completed: [CARD-02, LEDG-01]

plan_head_before: 90e57c5
plan_head_after: dcca6f8

duration: 35min
completed: 2026-10-10
status: complete
---

# Phase 19 Plan 06: Элементы интерфейса фазы Summary

**Select, Combobox, Textarea, Popover, Calendar варианта A скопированы без перестилизации, DateField на строке YYYY-MM-DD, MarkdownView по карте DR-1 с skipHtml, StatusDot вынесена, apiRequest знает PUT, PATCH и DELETE.**

## Performance

- **Duration:** около 35 мин
- **Tasks:** 3
- **Files modified:** 11 (девять новых, два изменённых)

## Accomplishments

- Select, Combobox и useKeyboardNavGate скопированы из design-lab; замыкание импортов (`@/lib/popup`, `size-context`, `shape-context`, `springs`, `icon-context`, `elevated`, `use-fluid-hover`, `use-merge-split`, `scroll-area`, `fluid-hover-highlight`) целиком есть в web, чужих модулей не потребовалось.
- Textarea, Popover и Calendar скопированы с правками из Copy-time edits; второго Button нет, Calendar использует `@/components/ui/button`.
- DateField: пропсы id, label, value, onChange, max, error, helper, disabled; перевод строки в Date и обратно по локальным году, месяцу и дню, без `toISOString`; локаль enUS, `weekStartsOn={1}`; кнопка `tertiary`, `h-9 px-2`; подпись `gap-2`; `aria-label` «{label}: {Oct 9, 2026}».
- MarkdownView: все элементы по карте DR-1, пустая секция «Nothing here yet» с `px-6 py-12 text-center text-body text-muted-foreground`; `.typeset` не копировался.
- StatusDot вынесена, экран Students фазы 18 использует её; поведение экрана не изменилось.
- apiRequest принимает `'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'`.

## Task Commits

1. **Задача 1: Select, Combobox и хук клавиатурной навигации** - `148d5bc` (feat)
2. **Задача 2: Textarea, Popover, Calendar и DateField** - `7444bd0` (feat)
3. **Задача 3: MarkdownView, StatusDot, методы apiRequest** - `dcca6f8` (feat)

**Plan metadata:** коммит `docs(19-06)` с этим файлом.

`commits: 3` посчитано по `git log --grep "(19-06)"`: в рабочей копии параллельно коммитят планы 19-03, 19-04, 19-05, поэтому `git rev-list` от `plan_head_before` включил бы их коммиты.

## Скопированные компоненты и правки

Источник: design-lab (`src/components/ui/select.tsx`, `combobox.tsx`, `src/hooks/use-keyboard-nav-gate.ts`, `src/components/lab/a/ui/textarea.tsx`, `popover.tsx`, `calendar.tsx`, `src/app/lab/a/_components/date-field.tsx`).

| Файл | Правки |
|------|--------|
| select.tsx, combobox.tsx, use-keyboard-nav-gate.ts | только удаление комментариев и prettier (одинарные кавычки, без точек с запятой, табуляции, порядок импортов); `cn` в них уже брался из `@/lib/utils` |
| textarea.tsx | `cn` из `@/lib/utils`; `text-sm` и `md:text-xs/relaxed` заменены на `text-body`; `field-sizing-content min-h-16 resize-none` сохранены |
| popover.tsx | `cn` из `@/lib/utils`; `text-xs` в контенте и заголовке стал `text-caption`; заголовок `text-sm font-medium` стал `text-body font-semibold` |
| calendar.tsx | `cn` из `@/lib/utils`; Button и buttonVariants из `@/components/ui/button`; `text-sm` стал `text-body`, `text-[0.8rem]` и `[&>span]:text-xs` стали `text-caption`, `font-medium` стал `font-semibold`, `gap-1.5` стал `gap-2`; кнопки навигации идут через локальную `navButtonClass` |
| date-field.tsx | написан по источнику: `ru` на `enUS`, `capitalize` и `formatDateLong` убраны, `Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })`, `Button variant="tertiary"`, добавлены id, error, helper, disabled |

Внутренние отступы скопированных компонентов (`p-3`, `p-2.5` и подобные) оставлены как размеры компонента, по правилу 18-UI-SPEC для неизменяемых копий.

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web typecheck` | код 0 |
| `yarn workspace @dv-lab/web lint` | код 0, предупреждений нет |
| `yarn workspace @dv-lab/web build` | код 0, 7 страниц собрано |
| grep Radix и cmdk по apps/web (tsx, ts, package.json) | пусто |
| комментарии, кириллица, пакет `cn`, `text-sm`, `text-xs`, `font-medium`, `text-subtitle` в новых файлах | нет, кроме одной директивы eslint (см. Отклонения) |
| `skipHtml` есть, `rehype-raw`, `dangerouslySetInnerHTML`, `urlTransform=` нет | выполнено |
| `function StatusDot` в students-screen.tsx | нет |
| `'DELETE'` в api-client.ts | есть |
| SSR-проверка MarkdownView (`19-06-md-smoke.mjs`, esbuild и `react-dom/server`) | `<script>` удалён, сырой `<b>` стал текстом, `javascript:` ссылка получила `href=""`, внешние ссылки с `target="_blank" rel="noreferrer noopener"`, пункты задач (отмеченный и нет), вложенный список, таблица в обёртке, `pre` и инлайн `code`, `hr`, `img`; пустая строка даёт «Nothing here yet» |
| SSR-проверка `19-06-ui-smoke.mjs` | Calendar: октябрь 2026, первый день недели Mo, даты после max отключены; DateField: `aria-label="Date: Oct 9, 2026"` и текст ошибки; Select, Combobox, Textarea, StatusDot (Active, Archived, Deactivated) рендерятся без ошибок |
| Классы Tailwind (`wrap-anywhere`, `has-[...]`, `[li_&]`, `size-(--cell-size)`, `field-sizing-content`) в собранном CSS | присутствуют |

Не запускалось: `yarn knip` (красный до 19-19, по директиве волны), новые тесты (директива владельца), проверка в браузере (потребителей этих компонентов пока нет: вид MarkdownView, DateField, Select и Combobox в светлой и тёмной теме проверяют 19-14, 19-17, 19-16 и 19-18).

## Decisions Made

- Приглушение текста отмеченного пункта задачи: селектор `has-[[role=checkbox][aria-checked=true]]` на `li`, потому что узел hast в `components` лучше не использовать.
- Квадрат задачи только для чтения: `role="checkbox"`, `aria-checked`, `aria-readonly`, внутри иконка `Check` 12 px.
- Навигация Calendar: `navButtonClass` (классы `buttonVariants` плюс `rounded-md hover:bg-hover active:bg-active`), потому что у Button этого репозитория фон кнопки лежит во внутреннем span, а у кнопок DayPicker внутренних span нет и hover иначе пропал бы.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Директива eslint у `img` в MarkdownView**
- **Found during:** Задача 3
- **Issue:** `lint` давал предупреждение `@next/next/no-img-element` на `img` из карты DR-1, а оставлять предупреждения в коде фазы нельзя.
- **Fix:** одна строка `// eslint-disable-next-line @next/next/no-img-element` над `<img>`. Это директива, а не пояснение; других комментариев в новых файлах нет.
- **Files modified:** apps/web/components/app/markdown-view.tsx
- **Verification:** lint без предупреждений
- **Committed in:** dcca6f8

**2. [Rule 2 - Missing Critical] Alt у `img` по умолчанию**
- **Found during:** Задача 3
- **Issue:** изображение без `alt` в markdown даёт `img` без атрибута.
- **Fix:** `alt={alt ?? ''}`.
- **Committed in:** dcca6f8

---

**Total deviations:** 2 auto-fixed (оба Rule 2)
**Impact on plan:** на вид и контракт не влияют.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

Нет заглушек. Новые компоненты пока без потребителей (получат их 19-11, 19-14, 19-16, 19-17, 19-18); `yarn knip` по ним красный до 19-19, как и заложено в волне.

## Threat Flags

Новой поверхности сверх threat_model плана нет. T-19-18: markdown без сырого HTML, `javascript:` адреса отброшены стандартным преобразованием (проверено SSR-прогоном); ввод script и `javascript:` ссылки в браузере проверит 19-17. T-19-19: Radix и cmdk в apps/web не найдены. T-19-20: внешние ссылки с `target="_blank" rel="noreferrer noopener"`.

## Next Phase Readiness

- Экраны могут импортировать `Select`, `Combobox*`, `Textarea`, `Popover*`, `Calendar`, `DateField`, `MarkdownView`, `StatusDot`; `apiRequest` годится для PUT, PATCH, DELETE.
- Для Select каждый `SelectItem` требует проп `index` (источник так устроен), для Combobox строки идут из функции-потомка `ComboboxList`.
- Анимации входа и выхода Popover опираются на классы `animate-in`/`fade-in-0`, которых в Tailwind проекта нет (нет `tw-animate-css`): всплывающее окно появляется без анимации. Источник не менялся; если дизайну нужна анимация, это вопрос к Design dude.

## Self-Check: PASSED

- Файлы из key-files существуют на диске.
- Коммиты 148d5bc, 7444bd0, dcca6f8 есть в `git log`.
- typecheck, lint, build — код 0.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
