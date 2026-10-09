---
phase: 18-accounts-and-variant-a-shell
plan: 11
subsystem: ui
tags: [next-proxy, session-dal, login, base-ui, next-rewrites, dockerignore]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-01: пакет @dv-lab/contracts (SESSION_COOKIE, SESSION_TOKEN_PATTERN, ErrorResponse, MeResponse, SignInResponse)"
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-05: TextField, PasswordField, Banner, Button, Elevated, WorkspaceTile"
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-08: оболочка (app) с заглушками разделов"
provides:
  - "apps/web/proxy.ts: отсечение анонимов по форме cookie, 307 на /login"
  - "apps/web/lib/session.ts: getMe (React cache) и requireTeacherPage"
  - "apps/web/lib/api-client.ts: apiRequest(method, path, body?) и тип ApiResult, единственный клиентский путь к api"
  - "CenteredPanel в components/app/layout-parts.tsx"
  - "Страница /login с формой, ошибками полей и баннерами исходов"
  - "dev-only rewrites /api/:path* в next.config.ts, apps/web/.env.development, **/.env.* в .dockerignore"
affects: [18-12, 18-13, 18-14, 18-15, 18-16]

actuals:
  tokens: 6500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "proxy.ts отдаёт NextResponse.redirect(new URL('/login', request.url), 307): Next сам превращает Location в относительный, если хост совпадает с хостом запроса"
    - "Серверный DAL на React cache: 401 это null, прочие сбои это исключение"
    - "Клиентская форма: fetch к /api через apiRequest, без server action, cookie приходит из ответа api напрямую в браузер"

key-files:
  created:
    - apps/web/proxy.ts
    - apps/web/lib/session.ts
    - apps/web/lib/api-client.ts
    - apps/web/app/login/page.tsx
    - apps/web/app/login/login-form.tsx
    - apps/web/.env.development
  modified:
    - apps/web/components/app/layout-parts.tsx
    - apps/web/next.config.ts
    - .gitignore
    - .env.example
    - .dockerignore

key-decisions:
  - "A7 опровергнут: относительный Location из голого new Response(null, 307) роняет proxy в Next 16.4.0 (TypeError: Invalid URL, adapter.js делает new NextURL(location) без базы). Используется NextResponse.redirect с абсолютным URL от request.url; Next сам переписывает Location в относительный /login, пока хост совпадает с хостом запроса"
  - "Для контрактов proxy и DAL импортируют корень @dv-lab/contracts: transpilePackages не понадобился, Turbopack собирает TS-источник workspace-пакета"
  - "Ошибка api с кодом, которого нет в UI-SPEC (в том числе 404 от ещё не добавленных маршрутов), показывается баннером Could not sign in. Try again in a moment."

patterns-established:
  - "Любой клиентский запрос к api идёт через apiRequest с путём без префикса /api"

requirements-completed: [ACCT-01, SHELL-01, SHELL-02]

coverage:
  - id: D1
    description: "proxy: аноним и cookie неверной формы получают 307 Location /login (в том числе за чужим Host), cookie верной формы пропускается, /login, /api и robots.txt не затрагиваются"
    requirement: SHELL-01
    verification:
      - kind: other
        ref: "node scratchpad/18-11-standalone.mjs против собранного standalone-сервера: PROXY_OK"
        status: pass
    human_judgment: false
  - id: D2
    description: "Страница /login в CenteredPanel с формой, отправкой в api и баннерами исходов; серверный getMe и requireTeacherPage"
    requirement: ACCT-01
    verification:
      - kind: other
        ref: "yarn workspace @dv-lab/web typecheck; lint; build; curl /login?reason=expired в next dev содержит заголовок, поля и баннер"
        status: pass
    human_judgment: true
    rationale: "Фокус и очистка пароля после отказа, баннеры, вид панели в обеих темах и на 320 px проверяются только в браузере; у исполнителя его нет"
  - id: D3
    description: "Dev rewrites /api только при NODE_ENV=development и заданной API_DEV_PROXY_URL; .env.development в git; **/.env.* в .dockerignore"
    requirement: SHELL-01
    verification:
      - kind: other
        ref: "node scratchpad/18-11-rewrites.mjs: REWRITES_OK; scratchpad/18-11-checks.sh: все PASS; curl http://localhost:3000/api/healthz через next dev вернул JSON api"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-10-09
status: complete
plan_head_before: bff0a561931346f356e1399b1d595b579484abdd
plan_head_after: 88f72082e0ce10e5c00ae4aa9c587e7c0124ba89
commits: 3
---

# Phase 18 Plan 11: Вход в web Summary

**Proxy с проверкой формы cookie `__Host-dvlab_session` и 307 на `/login`, серверный DAL getMe, страница `/login` на токенах варианта A в общей панели CenteredPanel с клиентской формой (fetch к api, баннеры исходов), dev-маршрут `/api` через rewrites и `**/.env.*` в `.dockerignore`.**

## Performance

- **Duration:** около 45 мин
- **Tasks:** 3
- **Files modified:** 11 (6 создано, 5 изменено)

## Accomplishments

- `proxy.ts`: cookie есть и проходит `SESSION_TOKEN_PATTERN` — `NextResponse.next()`, иначе 307 на `/login`; `matcher` исключает `api`, `login`, `_next/static`, `_next/image`, `favicon.ico`, `robots.txt`.
- `lib/session.ts`: `getMe` (React `cache`): нет cookie — `null` без запроса; нет `API_INTERNAL_URL` — исключение; запрос `API_INTERNAL_URL/auth/me` с пересланной cookie и `cache: 'no-store'`; 401 — `null`; иной статус — исключение `Session lookup failed`. `requireTeacherPage`: нет сессии — `/login?reason=expired`, роль student — `/`.
- `CenteredPanel` (`main.grid.min-h-svh.place-items-center.bg-surface-1`, `Elevated offset 1 shadowLevel 2 max-w-sm rounded-2xl p-6`, ряд бренда с `WorkspaceTile` D и dv-lab); `PageScroll` и `PageHeader` не менялись.
- `/login`: `h1` Sign in to dv-lab, описание, `LoginForm`; вошедший (по ответу api, сбой DAL трактуется как «не вошёл») уходит на `/`. Форма: проверка пустых полей (Enter your login or email., Enter your password.) без запроса, `apiRequest('POST', '/auth/sign-in', …)`, успех — `router.replace('/')` и `router.refresh()`, `invalid_credentials` / `locked` / прочее — баннеры по UI-SPEC, логин сохраняется, пароль очищается и получает фокус, пока идёт запрос — `Button loading` с `Signing in…` и `disabled` у полей.
- `apiRequest`: `/api` + путь, `credentials: same-origin`, `no-store`, JSON; 204, успех, разбор `ErrorResponse`, сеть и нечитаемое тело дают `error: null`.
- `next.config.ts`: `rewrites` читает `NODE_ENV` и `API_DEV_PROXY_URL` на вызове; `apps/web/.env.development` (два адреса `http://localhost:4000`) отслеживается git через `!apps/web/.env.development`; имена переменных в `.env.example`; `**/.env.*` в `.dockerignore`.

## Task Commits

1. **Задача 1: proxy, getMe, CenteredPanel, страница входа** - `7519235` (feat)
2. **Задача 2: dev rewrites, .env.development, .dockerignore** - `9775bc1` (feat)
3. **Задача 3: отправка формы, apiRequest, баннеры** - `88f7208` (feat)

**Plan metadata:** коммит `docs(18-11)` с этим файлом. Число коммитов измерено по `git log --grep "(18-11)"` (3): диапазон `rev-list` включает коммиты параллельных планов.

## Результаты проверок

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web typecheck` | чисто (после каждой задачи и в конце) |
| `yarn workspace @dv-lab/web lint` | 0 ошибок, 0 предупреждений |
| `yarn workspace @dv-lab/web build` | успешно; `/login` динамический (`ƒ`), `ƒ Proxy (Middleware)` в сборке; `/`, `/chat`, `/students`, `/schedule` статические |
| `grep -rn "use server" apps/web/app` | пусто (exit 1) |
| `git grep --untracked "fetch(\`/api"` и `fetch('/api` в apps/web | только `apps/web/lib/api-client.ts:9` |
| комментарии (`//`, `/*`) в proxy, session, api-client, login, layout-parts | нет |
| yarn.lock, `.yarnrc.yml` | не менялись, `yarn install` не запускался |

### Вывод `18-11-standalone.mjs` (собранный standalone-сервер, порт 3107, 127.0.0.1)

```
PASS 1 /students no cookie: status 307 location /login
PASS 1b /students with foreign Host header: status 307 location /login
PASS 2 /students malformed cookie: status 307 location /login
PASS 3 /students well-formed cookie: status 200
PASS 4 /login renders: status 200 hasHeading true
PASS 5 /api/auth/me and /robots.txt not redirected: api 404 robots 404
PROXY_OK
port 3107 free: true
```

Проверка 1b добавлена: запрос с заголовком `Host: app.example.test` (имитация Caddy) также получает относительный `Location: /login`.

### Вывод `18-11-rewrites.mjs` (прямой импорт `apps/web/next.config.ts` в Node 24)

```
PASS production with API_DEV_PROXY_URL: []
PASS development with API_DEV_PROXY_URL: [{"source":"/api/:path*","destination":"http://localhost:4000/:path*"}]
PASS development without API_DEV_PROXY_URL: []
REWRITES_OK
```

Node импортирует `next.config.ts` напрямую (снятие типов), загрузчик Next не понадобился; выводится предупреждение `MODULE_TYPELESS_PACKAGE_JSON`, на результат не влияет.

### Dev-маршрут `/api` (`yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev`)

`curl -s -i http://localhost:3000/api/healthz` вернул `HTTP/1.1 200 OK` и тело `{"status":"ok","sha":"unknown","db":"ok"}`. `curl -o /dev/null http://localhost:3000/students` без cookie: 307 на `http://localhost:3000/login`; `/login?reason=expired` отдаёт 200 с заголовком Sign in to dv-lab, описанием, полем Login or email и баннером Your session has ended. Sign in again. `POST /api/auth/sign-in` с несуществующим логином на момент проверки дал 404 `not_found` (маршрутов входа в api ещё нет: 18-09), форма в этом случае показывает Could not sign in. Try again in a moment.

Корневой `yarn dev` (portless): не запустился, `portless` требует работающий прокси и sudo (`Proxy is not running and no TTY is available for sudo`). Известное ограничение для среды без TTY; рабочий порядок запуска двумя командами выше (`yarn workspace @dv-lab/api dev`, `yarn workspace @dv-lab/web dev`). Корневой скрипт `dev` не менялся (решение владельца).

После проверок все процессы остановлены; слушателей на 3000, 3107, 4000 нет.

## Not verified in a browser

Встроенного браузера у исполнителя не было. Оркестратору проверить на двух командах выше, http://localhost:3000, в светлой и тёмной темах:

1. `/` без cookie ведёт на `/login`; `/login?reason=expired` показывает info-баннер Your session has ended. Sign in again.
2. Отправка пустой формы показывает под полями Enter your login or email. и Enter your password. (фокус на первом пустом поле), запросов к api нет.
3. Неизвестный логин: красный баннер Wrong login or password (если маршруты 18-09 уже в дереве) или Could not sign in. Try again in a moment.; логин сохранён, пароль очищен и в фокусе; повторная отправка меняет баннер, а не добавляет второй.
4. Пока идёт запрос: кнопка со спиннером и текстом Signing in… (виден как скрытый label), поля disabled.
5. Панель читаема в обеих темах, края карточки видны, на ширине 320 px панель не шире экрана и нет горизонтальной прокрутки.
6. Chromium принимает Secure-cookie `__Host-` на http://localhost (A2): проверяется сквозным входом учителя в трассере 18-13.
7. Анимация появления баннера внутри формы (`Banner` со spring-анимацией в потоке колонки `gap-4`) не прыгает; при смене текста баннера нет мигания.

## Decisions Made

См. `key-decisions` во frontmatter.

## Deviations from Plan

**1. [Rule 1 - Bug] Относительный Location из proxy.ts не работает в Next 16.4.0**
- **Found during:** задача 1, скрипт `18-11-standalone.mjs`
- **Issue:** план и A7 предписывали `new Response(null, { status: 307, headers: { location: '/login' } })`. Собранный сервер отвечал 500, в логе `TypeError: Invalid URL, input: '/login'`: `next/dist/server/web/adapter.js` делает `new NextURL(location)` без базового URL для любого ответа proxy с заголовком `Location`.
- **Fix:** `NextResponse.redirect(new URL('/login', request.url), 307)`. Адаптер Next при совпадении хоста сам заменяет `Location` на относительный `/login` (проверено: обычный запрос и запрос с чужим `Host`).
- **Files modified:** `apps/web/proxy.ts`
- **Verification:** `18-11-standalone.mjs`, строки 1, 1b, 2 (307 и Location ровно `/login`)
- **Committed in:** `7519235`
- **Для 18-16:** A7 на стороне Next подтверждён для хоста запроса; поведение за Caddy с чужим Host проверено имитацией заголовка, на реальном Caddy проверяется при выкатке.

**2. [Rule 3 - Blocking] `<automated>` запускались скриптом и отдельными командами**
- Хук изоляции worktree отклоняет цепочки с `&&`, `!`. Проверки задач 2 и 3 вынесены в `scratchpad/18-11-checks.sh` (содержание проверок то же, плюс grep `use server` и `fetch('/api`).

**3. Мелкие уточнения к тексту плана**
- `api-client.ts` создан в задаче 1 (во время правки) и закоммичен вместе с формой в задаче 3, как в плане.
- Тексты баннеров оформлены через `BannerTitle`: сетка `Banner` размещает текст во второй колонке только у `BannerTitle`.
- Next dev создал `apps/web/AGENTS.md` (`agentRules`); файл не коммитился и удалён. В `next.config.ts` ничего не отключалось.

**Total deviations:** 1 баг (Rule 1), 1 блокирующая по среде, 2 уточнения.
**Impact on plan:** состав файлов и поведение по плану; способ выдачи редиректа другой, результат тот же (относительный `Location: /login`).

## Issues Encountered

- `yarn knip` не запускался (ожидаемо красный до 18-16, правило 7). Новых тестов нет (директива владельца).
- Параллельные планы 18-06 и 18-07 меняли `apps/api`: не тронуто. `.gsd/` в рабочем дереве не мой, не коммитился.

## Known Stubs

Нет. `requireTeacherPage` пока никем не вызывается: страницы оболочки подключит 18-13 (в плане так и задумано).

## Threat Flags

Нет новых поверхностей сверх threat_model плана. T-18-38: proxy проверяет только форму cookie, настоящая проверка в api и DAL. T-18-39: редиректы только на `/` и `/login`, `reason` влияет лишь на баннер. T-18-40: rewrites только в development (скрипт), `**/.env.*` в `.dockerignore`. T-18-41: `use server` нет, cookie HttpOnly и из клиентского кода не читается.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 18-13: `getMe`, `requireTeacherPage`, `CenteredPanel`, `apiRequest` готовы; в `(app)/layout.tsx` нужен вызов `requireTeacherPage`; страница ученика использует `CenteredPanel`.
- 18-12, 18-14: все клиентские запросы идут через `apiRequest(method, '/путь')`, разрешены `GET` и `POST`; код ошибки api (`error.code`) доступен в `result.error`.
- Для проверок против api из sources: `/api/healthz` в dev доходит через Next; `API_INTERNAL_URL` для серверных страниц берётся из `apps/web/.env.development`.
- Next 16.4 при `next dev` создаёт `apps/web/AGENTS.md`: удалять перед коммитом (в `.gitignore` не добавлялось).

## Self-Check: PASSED

- Файлы на диске: `proxy.ts`, `lib/session.ts`, `lib/api-client.ts`, `app/login/page.tsx`, `app/login/login-form.tsx`, `.env.development` найдены; `apps/web/app/api` отсутствует.
- Коммиты `7519235`, `9775bc1`, `88f7208` найдены в `git log`.
- `typecheck`, `lint`, `build`, `PROXY_OK`, `REWRITES_OK`, `18-11-checks.sh` (exit 0): пройдены. Не запускались: `yarn test`, `yarn knip`, браузерные проверки, корневой `yarn dev` (portless без прокси).

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-09*
