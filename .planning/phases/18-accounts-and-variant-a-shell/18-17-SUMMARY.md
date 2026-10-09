---
phase: 18-accounts-and-variant-a-shell
plan: 17
subsystem: ui
tags: [nextjs, not-found, error-boundary, skeleton, banner, tailwind]

requires:
  - phase: 18-11
    provides: "proxy.ts, getMe, requireTeacherPage, CenteredPanel, /login"
  - phase: 18-13
    provides: "layout (app) с AppShell и ветвлением по роли"
provides:
  - "Panel рядом с CenteredPanel, PageScroll и PageHeader"
  - "NotFoundPage (вне оболочки и в оболочке), ErrorPage"
  - "app/not-found.tsx, app/(app)/not-found.tsx, app/(app)/[...missing]/page.tsx, app/error.tsx, app/global-error.tsx"
  - "ReadError для сбоя чтения целого экрана"
  - "Skeleton и части SkeletonText, SkeletonAvatar, SkeletonTable, SkeletonStat, SkeletonProfileHeader"
  - "статусы Banner с заливкой 14% и ролями (alert только у error)"
  - "ключевые кадры shimmer, spinner-move, spinner-dash на верхнем уровне globals.css"
affects: [18-14, 18-15]

actuals:
  tokens: 3000
  tasks: 2
  commits: 2

plan_head_before: 453ec52
plan_head_after: 203cbd5

tech-stack:
  added: []
  patterns:
    - "404 внутри оболочки достигается страницей-ловушкой (app)/[...missing], которая вызывает notFound() внутри сегмента (app)"
    - "ErrorPage и NotFoundPage в одном клиентском модуле status-pages.tsx: Button получает значки как компоненты"

key-files:
  created:
    - apps/web/components/app/status-pages.tsx
    - apps/web/components/app/read-error.tsx
    - apps/web/app/not-found.tsx
    - apps/web/app/(app)/not-found.tsx
    - apps/web/app/(app)/[...missing]/page.tsx
    - apps/web/app/error.tsx
    - apps/web/app/global-error.tsx
  modified:
    - apps/web/components/app/layout-parts.tsx
    - apps/web/components/ui/skeleton.tsx
    - apps/web/components/ui/banner.tsx
    - apps/web/app/globals.css

key-decisions:
  - "Go to Today в global-error сделан кнопкой с window.location.assign(window.location.origin), а не якорем: якорь на / ловит правило @next/next/no-html-link-for-pages, а комментарий-исключение запрещён правилами проекта"
  - "Page not found в заголовке вкладки на 404 внутри оболочки задаётся metadata страницы-ловушки: nested not-found не поддерживает metadata, без этого вкладка показывала бы только dv-lab"
  - "Контраст Banner по умолчанию вычисляется от статуса (default - low, цветные - high), явный contrast сохраняет прежний смысл"

patterns-established:
  - "Состояния без технических деталей: error.tsx и global-error.tsx не читают объект ошибки"

requirements-completed: [SHELL-01, SHELL-02]

duration: 75min
completed: 2026-10-09
status: complete
---

# Phase 18 Plan 17: страницы 404 и ошибки, ReadError, Skeleton и статусы Banner Summary

**Неизвестный адрес вошедшего учителя даёт 404 внутри оболочки (статус 404, сайдбар и верхняя панель на месте), корневой 404, ErrorPage и global-error рисуют ту же панель вне оболочки; ReadError, части Skeleton и статусы Banner готовы для экранов 18-14; ключевые кадры shimmer и спиннера Button loading теперь попадают в собранный CSS.**

## Performance

- **Duration:** около 75 минут
- **Tasks:** 2 (трассер и остальное)
- **Files:** 7 созданы, 4 изменены

## Accomplishments

- `Panel` в `layout-parts.tsx` (Elevated offset 1, shadowLevel 2, rounded-2xl; шапка `px-4 pt-4 pb-2`, зазоры `gap-2` и `gap-1`, только по шкале UI-SPEC). `CenteredPanel`, `PageScroll`, `PageHeader` не менялись.
- `status-pages.tsx`: `NotFoundPage({ inShell? })` и `ErrorPage({ onRefresh, hardHomeLink? })`. Тексты дословно из спецификации. 404 вне оболочки: `CenteredPanel`, кнопка Go to Today primary (ссылка на `/` через `next/link`). Внутри оболочки: `PageScroll` > `PageHeader` Page not found > `Panel` с текстом и кнопкой (решение I-1). ErrorPage: Refresh secondary со значком `RefreshCw` и Go to Today ghost.
- `app/not-found.tsx` (с metadata `Page not found`), `app/(app)/not-found.tsx` и страница-ловушка `app/(app)/[...missing]/page.tsx` (`await requireTeacherPage()`, затем `notFound()`; построена как заказано).
- `app/error.tsx`: `router.refresh()` и `reset()` в `startTransition`, объект ошибки не читается. `app/global-error.tsx`: свои `html`/`body`, те же шрифты, `globals.css`, `ThemeProvider` и `div.isolate`, обновление через `window.location.reload`.
- `read-error.tsx`: `ReadError({ screen, onRefresh })` в одной `Panel`: круг `size-10 bg-hover` со значком `CircleAlert` 20 px, заголовок `Could not load {screen}`, строка `Nothing was changed. Try again.`, Button secondary Refresh с `loading` на время перечитывания.
- `skeleton.tsx`: `Skeleton` (rounded-sm, bg-hover и пятиостановочный градиент hover/active 200%, `animate-[shimmer_1.6s_linear_infinite]`, `motion-reduce:animate-none motion-reduce:bg-none`), части `SkeletonText`, `SkeletonAvatar` (size-7 и size-14), `SkeletonTable` (пять полос h-9 в рамке настоящей таблицы), `SkeletonStat`, `SkeletonProfileHeader`. Прежние `animate-pulse` и `bg-accent` убраны.
- `banner.tsx`: заливка цветных статусов 14%, контраст по умолчанию high для цветных и low для default, роль `alert` только у error, у остальных `status` (раньше alert был и у warning).
- `globals.css`: `@keyframes shimmer`, `spinner-move`, `spinner-dash` вынесены из `@theme inline` на верхний уровень.
- До этого плана спиннер Button loading не анимировался (кадры spinner-move и spinner-dash не попадали в CSS, потому что кнопка задаёт анимацию встроенным style); этот план это исправил (кадры теперь в собранном CSS), 18-15 не должен записывать это как пробел 18-17.

## Task Commits

1. **Задача 1 (трассер): 404 внутри оболочки и вне её, Panel, страница-ловушка** - `cd26260` (feat)
2. **Задача 2: ErrorPage, error.tsx, global-error.tsx, ReadError, Skeleton, Banner, ключевые кадры** - `203cbd5` (feat)

## Проверки (команды и результат)

| Проверка | Результат |
|---|---|
| `yarn prettier --check apps/web/app apps/web/components` | PASS |
| `yarn workspace @dv-lab/web typecheck` | PASS после каждой задачи и в конце |
| `yarn workspace @dv-lab/web lint` | PASS после каждой задачи и в конце (одно предупреждение `no-location-assign-relative-destination` на `assign('/')` устранено заменой на `window.location.origin`) |
| `yarn workspace @dv-lab/web build` | PASS, таблица маршрутов: `/`, `/_not-found`, `/[...missing]`, `/chat`, `/login`, `/schedule`, `/students`, Proxy |
| `18-17-tracer.mjs` (standalone, порт 3117) | `TRACER_OK`: `_not-found.html` содержит заголовок, текст, Go to Today, `href="/"`, строку dv-lab и не содержит цифры 404 между тегами; `/login/no-such-page` без cookie - 307 на `/login?reason=expired`; `/login` - 200 с Sign in to dv-lab; `/robots.txt` - 200; порт 3117 свободен |
| `18-17-shell404.mjs` (dev-стек, web 3000 и api 4000) | `SHELL404_OK`: вход dev-учителя 200; `/no-such-page` и `/students/no-such-page` - статус 404 без технического текста; `/` и `/students` - 200; `/api/healthz` через web - 200 и `"db":"ok"`; аноним на `/no-such-page` - 307 на `/login` |
| `18-17-checks.mjs` (после сборки) | `CHECKS_OK`: тексты спецификации, нет кириллицы, комментариев, radix/cmdk, `dangerouslySetInnerHTML`, `console.`, обращений к полям ошибки, `usePathname`, цифры 404 в тексте, классов-полушагов и ступеней 3/5/7 в status-pages, read-error и Panel, сырых палитр; skeleton и banner по плану; три `@keyframes` вне `@theme`; три `@keyframes` и `prefers-reduced-motion` в собранном CSS; `global-error.tsx` в client reference manifest страницы `_global-error` и его чанки содержат тексты ErrorPage |
| `18-17-error.mjs` (standalone, порт 3118, api на мёртвом адресе) | `ERRORPAGE_OK`: `/` и `/students` - 500 без `ECONNREFUSED`, `fetch failed`, `Session lookup failed`, `API_INTERNAL_URL`; в гидрированном DOM нет технического текста; порты свободны |

Дополнительно, в headless Chromium из кеша playwright (скрипты `18-17-domcheck.mjs`, `18-17-probe-dom.mjs` в scratchpad; временная проверочная страница не коммитилась и удалена):

- Собранное приложение, вошедший учитель: после гидрации `/no-such-page` и `/students/no-such-page` показывают Page not found, This page does not exist or was moved., Go to Today, `aria-label="Sections"`, Skip to content и строку dv-lab; заголовок вкладки `Page not found · dv-lab`; `/students` показывает оболочку без текстов 404.
- Реальный отказ api (мёртвый адрес): после гидрации ErrorPage с Something went wrong, текстом, Refresh и Go to Today вне оболочки.
- Временная страница с компонентами: `Skeleton` анимация `shimmer` и радиус 6px (rounded-sm), при `--force-prefers-reduced-motion` анимация `none`; `SkeletonTable` - пять полос по 36px; спиннер Button loading - `spinner-move, spinner-dash`; Banner: success/info/warning - role `status`, error - `alert`, у цветных `data-contrast=high` и заливка 14%, у default `low` и `var(--hover)`.

## Что НЕ проверено

- Не проверено в браузере (живая сессия, обе темы, 320 px): визуальный вид 404 внутри оболочки и вне её, ErrorPage, ReadError (включая loading после нажатия Refresh), скелетон и статусные Banner; переход по Go to Today без перезагрузки оболочки; Refresh в ErrorPage (router.refresh вместе с reset). Это блок «Состояния» плана 18-15, задача 3. Headless-проверки выше покрывают DOM и вычисленные стили, но не внешний вид.
- `global-error` в рантайме не вызывался (нужен сбой корневого layout); проверено только то, что файл входит в страницу `_global-error` сборки.
- `yarn knip` не запускался (до 18-16 ожидаемо красный).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Предпосылка проверки: тексты 404 и ErrorPage в начальном HTML**
- **Found during:** Задача 1, запуск 18-17-shell404.mjs и разбор ответа
- **Issue:** Next 16.4 для любого `notFound()`, брошенного из страницы (проверено и на временной корневой странице без async layout), и для ошибки layout отдаёт начальный HTML как оболочку `<html id="__next_error__">` со статусом 404/500; сами тексты и вложенный `(app)/not-found` рисуются после гидрации на клиенте. Поэтому условие плана «в теле ответа Page not found, текст, Go to Today, aria-label Sections, Skip to content» неисполнимо по сырому HTML. Это поведение Next, не дефект кода плана.
- **Fix:** `18-17-shell404.mjs` проверяет статус 404, отсутствие технического текста, `/`, `/students`, `/api/healthz` и редирект анонима; наличие текстов проверено на гидрированном DOM в headless Chromium (см. выше). Оценить мигание пустого экрана до гидрации в обычном браузере можно только руками (18-15).
- **Files modified:** только скрипты в scratchpad
- **Commit:** нет

**2. [Rule 1 - Bug] `_global-error.html` не содержит текстов ErrorPage**
- **Found during:** Задача 2, проверка 7 из 18-17-checks.mjs
- **Issue:** пререндер `_global-error.html` в Next 16.4 - стандартная оболочка `500: This page couldn't load`, а не наш `global-error.tsx`, хотя файл входит в страницу `_global-error` сборки.
- **Fix:** проверка 7 заменена на: `global-error.tsx` присутствует в client reference manifest страницы `_global-error`, а его чанки содержат тексты ErrorPage.
- **Commit:** нет (скрипт в scratchpad)

**3. [Rule 3 - Blocking] Якорь на `/` в global-error не проходит lint**
- **Found during:** Задача 1, lint
- **Issue:** `<a href="/">` ловит `@next/next/no-html-link-for-pages`, а исключающий комментарий запрещён правилами проекта; `assign('/')` даёт предупреждение `no-location-assign-relative-destination`.
- **Fix:** при `hardHomeLink` Go to Today - кнопка с `window.location.assign(window.location.origin)`; ведёт на `/`, без якоря и без директивных комментариев. Остальные места используют `next/link`.
- **Files modified:** apps/web/components/app/status-pages.tsx
- **Commit:** 203cbd5

**4. [Rule 2 - Missing critical] Заголовок вкладки на 404 внутри оболочки**
- **Found during:** Задача 1
- **Issue:** вложенный `(app)/not-found.tsx` не поддерживает metadata, вкладка показывала бы только dv-lab.
- **Fix:** `metadata = { title: 'Page not found' }` в странице-ловушке (файл плана); шаблон даёт `Page not found · dv-lab`, подтверждено на гидрированном DOM.
- **Files modified:** apps/web/app/(app)/[...missing]/page.tsx
- **Commit:** cd26260

**5. [Организационное] Трассерный скрипт копирует `public` в standalone**
- `18-17-tracer.mjs` копирует `apps/web/public` в `.next/standalone/apps/web/public` (так делает Dockerfile): без этого `/robots.txt` при каталоге standalone без public отдаёт 307 из-за страницы-ловушки, а не 200. В production файл раздаётся статикой раньше маршрутов, ловушка его не затеняет.

**Total deviations:** 4 по коду проверок и поведения Next, 1 организационное. Влияние на объём плана: ни одного нового файла вне списка плана.

## Known Stubs

Нет.

## Threat Flags

Новых поверхностей сверх threat_model плана нет. T-18-64: ErrorPage и NotFoundPage не принимают ошибку и адрес, `error.tsx` и `global-error.tsx` ничего не читают из объекта ошибки (grep в 18-17-checks.mjs и проверка утечек в 18-17-error.mjs PASS). T-18-66: адрес Go to Today фиксирован. T-18-67: `requireTeacherPage()` первой строкой ловушки, аноним получает 307 на `/login` (shell404 и tracer PASS).

## Для следующих планов

- 18-14: `ReadError screen="students"` с `onRefresh`, возвращающим промис, и `SkeletonTable` готовы; `Banner` по умолчанию теперь тонирован для цветных статусов, тосты success получат заливку 14%.
- 18-15 (браузерные проверки, блок «Состояния»): 404 внутри оболочки в обеих темах и на 320 px; Go to Today без перезагрузки оболочки; мигание пустого экрана до гидрации на 404 и ошибке (поведение Next 16.4, см. отклонение 1); ErrorPage настоящим отказом (остановленный api); спиннер Refresh в ReadError; reduced motion для скелетона (в headless подтверждено: анимация none); цвет заливки Banner в светлой и тёмной теме. Тексты 404 и ошибки владелец ещё не подтвердил.
- `/favicon.ico` и любой нераспознанный адрес вошедшего идут через layout оболочки (T-18-65, принято). Аноним по `/login/опечатка` теперь попадает на `/login?reason=expired` (принято планом).
- Команда `next dev` создаёт `apps/web/AGENTS.md`: удалён, не коммитился.

## Self-Check: PASSED

- Файлы существуют: status-pages.tsx, read-error.tsx, not-found.tsx (корень и группа), `[...missing]/page.tsx`, error.tsx, global-error.tsx, изменённые layout-parts.tsx, skeleton.tsx, banner.tsx, globals.css.
- Коммиты найдены: `cd26260`, `203cbd5`.
- Процессы остановлены, слушателей на портах 3000, 3117, 3118, 3119, 3120, 3121, 4000 нет; `apps/web/AGENTS.md` удалён.
