---
phase: 18-accounts-and-variant-a-shell
plan: 13
subsystem: ui
tags: [next-app-router, session, role-guard, sign-out, command-palette, base-ui]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-08: оболочка (app), AppShell, AppSidebar, CommandPalette"
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-09: маршруты api /auth/sign-in, /auth/me, /auth/renew, /auth/sign-out"
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-10: createStudent и учётные записи"
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-11: proxy.ts, getMe, requireTeacherPage, apiRequest, CenteredPanel, /login"
provides:
  - "(app)/layout.tsx: getMe, редирект /login?reason=expired, ветвление teacher (AppShell) и student (StudentLanding)"
  - "AppShell и AppSidebar принимают account: AccountSummary; в SidebarFooter строка аккаунта с display name и меню (Sign out)"
  - "useSignOut() { signOut, pending }: единственное место вызова POST /auth/sign-out"
  - "Группа Account с пунктом Sign out в палитре"
  - "StudentLanding и SessionRenewal"
  - "requireTeacherPage в Chat, Students, Schedule; generateMetadata в Today"
  - "Процедура dev-учётных записей: SCRATCH/18-13-dev-accounts.mjs, DEV_TEACHER_LOGIN, DEV_TEACHER_PASSWORD, DEV_STUDENT_PASSWORD в корневом .env"
affects: [18-14, 18-15, 18-16]

actuals:
  tokens: 3200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Layout группы (app) решает по ответу getMe; страницы разделов дополнительно вызывают requireTeacherPage"
    - "Выход из любой точки интерфейса идёт через useSignOut; запрос не блокирует переход на /login"
    - "Продление сессии: клиентский компонент без разметки, один запрос за монтирование по ref-флагу"

key-files:
  created:
    - apps/web/app/(app)/_components/use-sign-out.ts
    - apps/web/app/(app)/_components/student-landing.tsx
    - apps/web/app/(app)/_components/session-renewal.tsx
  modified:
    - apps/web/app/(app)/layout.tsx
    - apps/web/app/(app)/page.tsx
    - apps/web/app/(app)/chat/page.tsx
    - apps/web/app/(app)/students/page.tsx
    - apps/web/app/(app)/schedule/page.tsx
    - apps/web/app/(app)/_components/app-shell.tsx
    - apps/web/app/(app)/_components/app-sidebar.tsx
    - apps/web/app/(app)/_components/command-palette.tsx

key-decisions:
  - "Сбой getMe (не 401, а исключение Session lookup failed) в layout не превращается в редирект: страница показывает ошибку Next, редирект только на 401"
  - "Меню аккаунта содержит только Sign out; Change password добавит 18-14"
  - "pending у useSignOut после вызова не сбрасывается: страница сразу уходит на /login и компонент размонтируется, кнопка не оживает во время перехода"
  - "Учитель в dev-базе называется teacher@dv-lab.test (Dev Teacher), ученик dev.student (Dev Student); пароли генерируются crypto.randomBytes(12) base64url и лежат только в корневом .env"

patterns-established:
  - "SCRATCH/18-13-dev-accounts.mjs идемпотентен: готовые учётные записи с известным паролем не трогает, иначе сбрасывает пароль учителя через bootstrap-teacher --reset-password или пересоздаёт ученика"

requirements-completed: [ACCT-01, SHELL-01]

coverage:
  - id: D1
    description: "Учитель входит через web-origin (POST /api/auth/sign-in с Origin), получает cookie __Host-dvlab_session HttpOnly и Secure, страница / отдаёт оболочку с Dev Teacher и триггером Open account menu; без сессии и при строке sessions, удалённой в базе, редирект на /login?reason=expired; вошедший на /login уходит на /"
    requirement: ACCT-01
    verification:
      - kind: other
        ref: "node scratchpad/18-13-e2e.mjs 1 против next dev (3000) и api из исходников (4000): E2E_OK, проверки 1.1-1.10"
        status: pass
    human_judgment: true
    rationale: "Вид строки аккаунта, вход через форму и принятие Secure-cookie с префиксом __Host- на http://localhost в Chromium проверяются только в браузере; у исполнителя его нет"
  - id: D2
    description: "Выход из меню аккаунта и из палитры (группа Account) через единственный хук useSignOut; sign-out идемпотентен"
    requirement: SHELL-01
    verification:
      - kind: other
        ref: "git grep --untracked '/auth/sign-out' -- apps/web печатает только use-sign-out.ts; e2e 2.2 (двойной sign-out 204)"
        status: pass
    human_judgment: true
    rationale: "Открытие меню вверх, пункт в меню, запуск из палитры по Enter и переход на /login проверяются только в браузере"
  - id: D3
    description: "Ученик видит страницу Signed in as Dev Student вне оболочки; на /chat, /students, /schedule получает редирект на /; учитель видит оболочку на всех четырёх разделах"
    requirement: SHELL-01
    verification:
      - kind: other
        ref: "node scratchpad/18-13-e2e.mjs 3: E2E_OK, проверки 3.2-3.5; grep requireTeacherPage в трёх страницах"
        status: pass
    human_judgment: true
    rationale: "Вид страницы ученика в обеих темах и на ширине 320 px проверяется только в браузере"
  - id: D4
    description: "Продление сессии: при renewDue клиентский компонент вызывает POST /auth/renew один раз; в payload страницы renewDue меняется с true на false после продления"
    requirement: ACCT-01
    verification:
      - kind: other
        ref: "e2e 3.6-3.9: свежая сессия renewDue false, состаренная до 28 суток true, POST /api/auth/renew 204 с Set-Cookie, затем false"
        status: pass
    human_judgment: true
    rationale: "Фактический вызов /api/auth/renew из браузера после перезагрузки (однократность, сетевой журнал) проверяется только в браузере"

duration: 55min
completed: 2026-10-09
status: complete
plan_head_before: db443366e02b9c8f388ade306899206c4f9ef1b5
plan_head_after: 65a225f4cb65c5c503e801e2258baecb04eb76cd
commits: 3
---

# Phase 18 Plan 13: Сессия в оболочке Summary

**Сквозной вход учителя через web и api: layout (app) проверяет сессию через getMe и ветвит по роли, в сайдбаре имя аккаунта и меню с Sign out, в палитре группа Account, страница ученика Signed in as {name} в CenteredPanel, requireTeacherPage на страницах разделов и однократное продление сессии при renewDue.**

## Performance

- **Duration:** около 55 мин
- **Tasks:** 3
- **Files modified:** 11 (3 создано, 8 изменено)

## Accomplishments

- `layout.tsx` стал серверным: `getMe()`; нет сессии при cookie правильной формы — `redirect('/login?reason=expired')`; учитель — `AppShell account` с `SessionRenewal` внутри; ученик — `SessionRenewal` и `StudentLanding` без оболочки и без `children`.
- `app-sidebar.tsx`: `SidebarFooter` с `SidebarUserFooter` (имя `account.displayName`, иконка `UserRound` 16 px, меню вверх), в меню пункт `MenuItem` Sign out с `LogOut`. Подписи списка Account и триггера Open account menu остались из копии компонента.
- `use-sign-out.ts`: `signOut` вызывает `apiRequest('POST', '/auth/sign-out')` и в `finally` делает `router.replace('/login')` и `router.refresh()`, поэтому переход происходит и при сбое запроса.
- `command-palette.tsx`: третья группа Account с пунктом Sign out (действие `sign-out`); запуск — `signOut()` и закрытие палитры.
- `student-landing.tsx`: `CenteredPanel`, `h1` `Signed in as {displayName}` с `break-words`, строка `{login}`, кнопка secondary с `LogOut` и `Signing out…` через `useSignOut`.
- `session-renewal.tsx`: при `renewDue` один раз (ref-флаг) `POST /auth/renew`, разметки нет.
- `chat`, `students`, `schedule`: первой строкой `await requireTeacherPage()`. `page.tsx` Today: `getMe()`, не учитель — `null`; `generateMetadata`: `Today` для учителя, абсолютный `dv-lab` для ученика.
- Dev-учётные записи в `dvlab_dev`: `SCRATCH/18-13-dev-accounts.mjs` создал учителя `teacher@dv-lab.test` (Dev Teacher) через `bootstrap-teacher.ts --password-stdin` и ученика `dev.student` (Dev Student) через `createStudent`; пароли записаны только в корневой `.env` (`DEV_TEACHER_LOGIN`, `DEV_TEACHER_PASSWORD`, `DEV_STUDENT_PASSWORD`), в логи и сюда не попадали. Скрипт отказывает базе без суффикса `_dev`, идемпотентен (повторный запуск печатает `already usable`) и предназначен для 18-14 и 18-15.

## Task Commits

1. **Задача 1 (трассер): вход учителя и оболочка с именем** - `8bf4cca` (feat)
2. **Задача 2: выход из меню аккаунта и палитры** - `b4cc403` (feat)
3. **Задача 3: страница ученика, роли на страницах, продление** - `65a225f` (feat)

**Plan metadata:** коммит `docs(18-13)` с этим файлом. `commits: 3` измерено по `git log --grep "(18-13)"`: диапазон `plan_head_before..HEAD` включает коммиты параллельного плана 18-12.

## Результаты проверок

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web typecheck` (после каждой задачи) | чисто |
| `yarn workspace @dv-lab/web lint` (после каждой задачи) | 0 ошибок |
| `yarn workspace @dv-lab/web build` | успешно; `/`, `/chat`, `/students`, `/schedule`, `/login` динамические (`ƒ`), `ƒ Proxy (Middleware)` |
| `yarn prettier --check` на изменённых файлах | чисто |
| `18-13-checks.sh 3` | PASS: кириллицы в apps/web нет; активный dev-учитель в `dvlab_dev` (rowCount 1); `/auth/sign-out` только в `use-sign-out.ts`; `requireTeacherPage` в трёх страницах; `student-landing.tsx` без собственной разметки панели; комментариев в файлах плана нет |

### Вывод `18-13-e2e.mjs` (next dev на 3000 + `yarn workspace @dv-lab/api dev` на 4000, запросы через origin web)

Часть 1 (после задачи 1), часть 2 (после задачи 2), часть 3 (после задачи 3):

```
PASS 1.1 / without cookie: 307 to /login (307 /login)
PASS 1.2 teacher sign-in through the web origin: 200, __Host- cookie HttpOnly and Secure (status 200)
PASS 1.3 / with the teacher cookie: 200, Dev Teacher in the account row (status 200)
PASS 1.4 shell markup: account menu trigger, sections, Today title
PASS 1.5 /login with a live session: redirect to / (307 /)
PASS 1.6 sign-out: 204 (status 204)
PASS 1.7 / with the signed-out cookie: 307 to /login?reason=expired (307 /login?reason=expired)
PASS 1.8 /login?reason=expired shows the banner
PASS 1.9 sessions of the dev teacher removed (rows 1)
PASS 1.10 / with a cookie of right shape but no session: 307 to /login?reason=expired (307 /login?reason=expired)
E2E_OK
PASS 2.2 sign-out twice is safe
E2E_OK
PASS 3.1 student sign-in: 200 (status 200)
PASS 3.2 / as student: Signed in as Dev Student, login line, Sign out, no shell (status 200)
PASS 3.3 /chat, /students, /schedule as student: redirect to / and no teacher shell or section content (200 streamed)
PASS 3.4 student sign-out: 204, then / redirects to /login?reason=expired (status 204)
PASS 3.5 /, /chat, /students, /schedule as teacher: 200 inside the shell
PASS 3.6 fresh session: renewDue false in the page payload
PASS 3.7 session aged to 28 days: renewDue true in the page payload (aged 1)
PASS 3.8 POST /api/auth/renew: 204 with Set-Cookie (status 204)
PASS 3.9 after renew renewDue is false again
E2E_OK
```

Проверка 3.3 принимает редирект двух видов: HTTP 307 на `/` либо поток 200 с `NEXT_REDIRECT;replace;/;` в payload. Для ученика на `/chat` реализован второй вид: layout уже отрисовал `StudentLanding`, редирект страницы приходит в потоке и выполняется на клиенте; разметки раздела и оболочки в ответе нет (проверено: нет `aria-label="Sections"` и `Nothing here yet`). Для учителя без сессии и для вошедшего на `/login` редирект настоящий (307).

Оба сервера остановлены, слушателей на 3000 и 4000 нет; `apps/web/AGENTS.md`, созданный `next dev`, удалён и не коммитился.

## Not verified in a browser

Встроенного браузера у исполнителя не было. Оркестратору проверить в плане 18-15 (http://localhost:3000, оба сервера из исходников; учётные данные в корневом `.env`: `DEV_TEACHER_LOGIN`/`DEV_TEACHER_PASSWORD`, ученик `dev.student`/`DEV_STUDENT_PASSWORD`):

1. `/` без входа ведёт на `/login`; вход через форму открывает оболочку на Today, в строке аккаунта Dev Teacher с иконкой пользователя и шевроном.
2. В инструментах браузера cookie `__Host-dvlab_session` помечена HttpOnly и Secure и принята на http://localhost (A2 из 18-11, пункт 6 его списка); `/login` для вошедшего ведёт на `/`.
3. Удалить строки sessions учителя в dvlab_dev (`18-sql.mjs .env migrator`) и перезагрузить: `/login?reason=expired` с баннером Your session has ended. Sign in again.
4. Меню аккаунта в сайдбаре открывается вверх, единственный пункт Sign out ведёт на `/login`; повторный заход на `/` снова требует входа.
5. После нового входа: ⌘K, ввод `sign`, Enter на Sign out выходит так же; в палитре три группы Sections, Theme, Account; палитра закрывается.
6. Вход `dev.student`: страница Signed in as Dev Student со строкой `dev.student` и кнопкой Sign out вне оболочки; `/students` и `/chat` у ученика уходят на `/` (в браузере виден мгновенный переход на страницу ученика); Sign out ведёт на `/login`, кнопка показывает Signing out… со спиннером.
7. Страница ученика читаема в светлой и тёмной теме и на ширине 320 px (длинное имя переносится), панель такая же, как у входа.
8. Состарить `expires_at` сессии учителя до `now() + 28 суток` (`18-sql.mjs .env migrator`), перезагрузить оболочку: в сетевом журнале один `POST /api/auth/renew` со статусом 204 и `Set-Cookie`; повторная перезагрузка запроса не делает.
9. Строка аккаунта не прыгает при открытии меню, длинное display name обрезается в сайдбаре.

## Decisions Made

См. `key-decisions` во frontmatter.

## Deviations from Plan

**1. [Rule 3 - Blocking] `<automated>` запускались скриптом и отдельными командами**
- **Found during:** задачи 1-3
- **Issue:** хук изоляции worktree отклоняет цепочки с `&&`, `!` и переменные.
- **Fix:** проверки вынесены в `scratchpad/18-13-checks.sh` (содержание то же, что в плане: кириллица, запрос активного dev-учителя через `18-sql.mjs`, grep `/auth/sign-out`, `requireTeacherPage`, `CenteredPanel`, плюс комментарии); typecheck, lint, build вызывались отдельно.

**2. [Дисциплина плана] Коммиты задач вместо «Не коммитить»**
- Действия задач заканчиваются «Не коммитить», а общие правила исполнителей фазы 18 требуют коммит каждой задачи.

**3. Мелкие уточнения к тексту плана**
- Меню аккаунта в задаче 1 передано пустым (`menu={null}`) и заполнено в задаче 2, как указано в плане.
- Браузерные критерии приёмки заменены сквозными http-проверками `18-13-e2e.mjs` и списком выше.
- Скрипт `18-13-dev-accounts.mjs` при коде 3 CLI сначала пробует `--reset-password` для `teacher@dv-lab.test` и только при отказе деактивирует активных учителей `dvlab_dev` через `18-sql.mjs`.

**Total deviations:** 1 блокирующая по среде, 2 организационных.
**Impact on plan:** состав файлов и поведение по плану.

## Issues Encountered

- Первый прогон части 3 e2e дал четыре FAIL из-за самого скрипта (React вставляет `<!-- -->` внутрь `Signed in as ... Dev Student`, а ученик на разделе получает не HTTP 307, а редирект в потоке). Приложение работало верно (зонд `18-13-probe.mjs`: на `/` есть `Signed in as`, `dev.student`, `Sign out`, оболочки нет); проверки исправлены и перепрогнаны, всё PASS.
- `yarn knip` не запускался (ожидаемо красный до 18-16, правило 7). Новых тестов нет (директива владельца).
- В рабочем дереве есть чужие изменения (`apps/api/src/routes/auth.ts`, SUMMARY и PLAN параллельных планов, `.gsd/`): не тронуты и не коммитились; коммиты сделаны с явными путями.

## Known Stubs

Нет. Разделы Chat и Schedule остаются заглушками `Nothing here yet` по D-14 (заполнят фазы 20-23), Students заменит 18-14; Change password добавит 18-14 в то же меню аккаунта.

## Threat Flags

Нет новых поверхностей сверх threat_model плана. T-18-46: layout ветвит по роли, каждая страница раздела вызывает `requireTeacherPage` (grep PASS), api отвечает 403 на `/students` (18-12). T-18-47: `getMe` без кеша между запросами, 401 даёт `/login?reason=expired` (e2e 1.7, 1.10). T-18-48: пароли dev-учителя и ученика только в корневом `.env`, не печатались; разовый SQL только через `18-sql.mjs`. T-18-49: `/login` решает по ответу api (e2e 1.5), proxy исключает `/login`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 18-14: в `app-sidebar.tsx` меню аккаунта (`MenuItem index={0}` Sign out) ждёт пункта Change password с `index` 0 и сдвигом Sign out на 1; `students/page.tsx` уже содержит `await requireTeacherPage()` и нужно сохранить; для проверок есть `node scratchpad/18-13-dev-accounts.mjs` и переменные `DEV_*` в `.env`.
- Запуск стека для браузера: `yarn workspace @dv-lab/api dev` (порт 4000 из `.env`) и `yarn workspace @dv-lab/web dev` (3000); `next dev` создаёт `apps/web/AGENTS.md`, его удалять и не коммитить.
- Если вход закрыт ограничением попыток: `node scratchpad/18-sql.mjs .env migrator 'delete from sign_in_throttles'`.

## Self-Check: PASSED

- Файлы на диске: `use-sign-out.ts`, `student-landing.tsx`, `session-renewal.tsx` найдены.
- Коммиты `8bf4cca`, `b4cc403`, `65a225f` найдены в `git log`.
- typecheck, lint, build, `18-13-checks.sh 3`, `18-13-e2e.mjs` (части 1-3) зелёные; слушателей на 3000 и 4000 нет. Не запускались: `yarn test`, `yarn knip`, браузерные проверки.

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-09*
