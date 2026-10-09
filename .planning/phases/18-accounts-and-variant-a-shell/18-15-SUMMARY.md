---
phase: 18-accounts-and-variant-a-shell
plan: 15
subsystem: verification
tags: [manual-verification, playwright, built-api, lockout, d-20, sessions, themes, states]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "все планы фазы 18 (18-01, 18-02, 18-04 - 18-14, 18-16, 18-17): код, dev-учётные записи 18-13, страницы состояний 18-17, экран Students 18-14, knip 18-16"
provides:
  - "Результаты итоговой проверки фазы 18 по пяти критериям ROADMAP: полный набор проверок, собранный api, второй учитель, перезапуск, блокировка, поток попыток, жизненный цикл ученика, смена и восстановление пароля, таблица экранов x тем x ширин, семь состояний 18-17"
  - "Список пробелов для /gsd-plan-phase 18 --gaps и список того, что нужно посмотреть глазами"
affects: [18-verify-work, phase-18-release]

tech-stack:
  added: []
  patterns:
    - "Второй клиент - node-скрипт с отдельной cookie через web-origin; браузер - headless Chromium из кеша playwright (playwright-core), DOM и вычисленные стили вместо глаз"
    - "Отказ чтения без правки кода: web dev с API_DEV_PROXY_URL на мёртвый порт 4999, пересылка 4999 -> 4000 с задержкой каждого ответа"

key-files:
  created: []
  modified: []

key-decisions:
  - "Код не правился: два найденных отклонения записаны пробелами (порядок Tab в оболочке, неработающий truncate имени в таблице)"
  - "Шаги задачи 2 выполнены через :3000/api: dev-прокси Next передаёт X-Forwarded-For без изменений (проба: clientIp 198.51.100.77 и через 3000, и напрямую на 4000)"
  - "Для блока ReadError браузерные контексты вошли через форму на обычном стеке, затем web перезапущен на мёртвый порт; cookie остались в контекстах (addCookies для __Host- на http отклоняется Chromium)"

requirements-completed: [ACCT-01, ACCT-02, ACCT-03, ACCT-05, SHELL-01, SHELL-02]

actuals:
  tokens: 4500
  tasks: 3
  commits: 0

duration: 100min
completed: 2026-10-10
status: complete
plan_head_before: 8eac6164fcd7c7e9effe4943e6c6bc505120a13a
plan_head_after: 8eac6164fcd7c7e9effe4943e6c6bc505120a13a
---

# Phase 18 Plan 15: итоговая проверка фазы Summary

**Полный набор (typecheck, lint, build, 116 существующих тестов, prettier, knip, 18-17-checks) зелёный; на собранном `dist/server.mjs` учитель входит через форму, второй учитель отвергается (код 3 и 23505 `accounts_one_active_teacher_uq`), сессия переживает SIGTERM и новый запуск, пятая неудача закрывает вход (шестой 429, Retry-After 900), 50 одновременных попыток не задерживают `/healthz` (максимум 98 мс), деактивация и смена или восстановление пароля закрывают чужие сессии; все экраны и семь состояний 18-17 проверены в обеих темах на 1280 и 320 px. Найдено два мелких отклонения от UI-SPEC.**

## Performance

- **Duration:** около 100 минут
- **Tasks:** 3 из 3
- **Files modified:** 0 (план без правок файлов; коммит только с этим SUMMARY)

## Стенд

- api: `node --env-file=.env apps/api/dist/server.mjs` (dvlab_dev, порт 4000), запуск без `DATABASE_URL` и `MIGRATOR_DATABASE_URL` в окружении процесса (обёртка `18-15-svc.mjs api`, журнал в `18-15-run/api.log`).
- web: `yarn workspace @dv-lab/web dev` (порт 3000, `.env.development`); для ReadError и скелетона - тот же dev с `API_DEV_PROXY_URL=http://localhost:4999` (`18-15-svc.mjs web-dead`, роль `18-15-web-dead-proxy.mjs` из плана) и пересылка `18-15-svc.mjs forward [задержка]` (роль `18-15-forward.mjs`).
- Второй клиент: `18-15-client.mjs` (fetch на `http://localhost:3000/api`, `origin`, cookie `__Host-dvlab_session`; печатает только коды и тексты).
- Браузер: headless Chromium 1243 из кеша playwright через `playwright-core` (`18-15-browser.mjs`), вход через настоящую форму `/login`.
- SQL только через `18-sql.mjs` (dvlab_dev). Пароли и токены нигде не печатались; учётные данные только из корневого `.env`.
- Все скрипты, журнал результатов `18-15-results.md` (252 PASS) и 50 снимков `18-15-shots/` лежат в scratchpad сессии, в репозиторий не попали.
- Оркестратор до этого плана прошёл в настоящем браузере вход, редирект, оболочку, палитру (Ctrl+K, фильтр, Enter), тёмную тему из палитры, выход и баннер неверного пароля на 1280 и узкой ширине; здесь это не повторялось, кроме случаев, где нужно было для других проверок.

## Задача 1: полный набор, собранный api, второй учитель, перезапуск

Предусловие: в `.env` есть `APP_ORIGIN=http://localhost:3000`, `DEV_TEACHER_LOGIN`, `DEV_TEACHER_PASSWORD`, `DEV_STUDENT_PASSWORD`, `PORT=4000` (проверено grep без вывода значений).

| Команда (из корня, `--force` без кеша turbo) | Итог |
|---|---|
| `yarn typecheck --force` | exit 0, `Tasks: 4 successful, 4 total`, `Cached: 0 cached` |
| `yarn lint --force` | exit 0, `Tasks: 1 successful, 1 total`, `Cached: 0 cached` |
| `yarn build --force` | exit 0, `Tasks: 2 successful, 2 total`; api: `dist/server.mjs` 20.20 kB, `dist/bootstrap-teacher.mjs` 3.81 kB; web: `/`, `/_not-found`, `/[...missing]`, `/chat`, `/login`, `/schedule`, `/students`, Proxy |
| `yarn test --force` (после build) | exit 0, `Tasks: 5 successful, 5 total`; contracts 48 passed (2 файла), db 21 passed (2), api 47 passed (7) |
| `yarn prettier --check apps packages` | exit 0, `All matched files use Prettier code style!` |
| `yarn knip` | exit 0 (печатает configuration hints `Remove redundant entry pattern`, как описано в 18-16) |
| `node 18-17-checks.mjs` (после build, до запуска next dev) | `CHECKS_OK` |
| grep кириллицы в `apps/web` и импортов `cmdk`, `radix-ui`, `@radix-ui/*` | пусто, пусто |

| Шаг | Результат |
|---|---|
| 1. `/` без сессии | переход на `/login` |
| 1. вход через форму на собранном api | оболочка Today, в строке аккаунта Dev Teacher |
| 1. cookie в браузере (`context.cookies()`) | `__Host-dvlab_session`: httpOnly true, secure true, sameSite Lax, path `/` |
| 2. `bootstrap-teacher.mjs --email second@dv-lab.test --name "Second Teacher"` | exit 3, stderr `An active teacher already exists`, stdout пустой |
| 2. прямая вставка второго активного учителя (`18-sql.mjs app`) | `{"code":"23505","constraint":"accounts_one_active_teacher_uq"}`, строк second@dv-lab.test 0 |
| 3. второй клиент входит учителем | sign-in 200, `/api/auth/me` 200 |
| 3. SIGTERM процессу `dist/server.mjs` | exit 0, в журнале `shutdown complete`, порт 4000 свободен; пока api стоит, `/api/auth/me` через web - 500 |
| 3. новый запуск той же командой | `/healthz` 200 `"db":"ok"` |
| 3. перезагрузка браузера | учитель остаётся в оболочке на `/` |
| 3. второй клиент с той же cookie | `/api/auth/me` 200, тот же id аккаунта |
| консоль браузера | без ошибок |

## Задача 2: блокировка, поток попыток, ученик, смена и восстановление пароля

Проба перед шагами: неверный вход через `:3000/api` с `X-Forwarded-For: 198.51.100.77` даёт в журнале api `clientIp 198.51.100.77` (dev-прокси Next заголовок не дописывает), поэтому шаги идут через web-origin, как в плане.

| Шаг | Результат |
|---|---|
| 1. пять неверных входов логином учителя, XFF 198.51.100.77 | каждый 401 `invalid_credentials`, текст `Wrong login or password` |
| 1. шестой с верным паролем, тот же адрес | 429 `locked`, `Too many attempts, try again in 15 minutes`, `Retry-After: 900` |
| 1. журнал api | пять строк `sign-in refused` с `outcome invalid_credentials`, `clientIp 198.51.100.77`, шестая с `outcome locked`; логина в строках нет |
| 1. `delete from sign_in_throttles` (migrator, R10) | удалено 2 строки, вход снова 200 |
| 2. 50 одновременных неверных входов на `flood@dv-lab.test`, XFF 198.51.100.1-50 | 12 x 401 `invalid_credentials`, 38 x 503 `busy`; весь поток 1080 мс |
| 2. `/api/healthz` через web каждые 100 мс во время потока | 19 опросов, все 200 и `"db":"ok"`, максимум 94 мс |
| 2. `/healthz` на 4000 напрямую | 19 опросов, все 200 и `"db":"ok"`, максимум 98 мс |
| 2. очистка после потока | `sign_in_throttles` 13 строк удалено |
| 3. учитель создаёт ученика в браузере (`e2e.student.<время>`, пустой пароль) | показ пароля из 12 символов, пароль взят из диалога и в вывод не попал |
| 4. второй клиент входит учеником | 200, роль student, `/api/auth/me` 200 |
| 5. учитель деактивирует ученика в браузере | тост `E2E Student One is signed out on every device.`; второй клиент `/api/auth/me` 401 `unauthenticated`; повторный вход 401 `invalid_credentials` |
| 6. ученик `e2e.student2.<время>` входит в браузере после выхода учителя | `Signed in as E2E Student Two` |
| 6. второй клиент учителем: `POST /api/students/<id>/deactivate` | 200, status `deactivated` |
| 6. перезагрузка браузера ученика | `/login?reason=expired`, баннер `Your session has ended. Sign in again.` |
| 7. смена пароля учителя через меню аккаунта | тост Password changed; второй клиент учителя 200 до и 401 после; перезагрузка оставляет браузер в оболочке |
| 7. возврат пароля повторной сменой в диалоге | вход `DEV_TEACHER_PASSWORD` 200, браузер в оболочке |
| 8. `bootstrap-teacher.mjs --reset-password --email <DEV_TEACHER_LOGIN> --password-stdin` | exit 0, stdout `Password reset. Login: <DEV_TEACHER_LOGIN>`, строки `Password (shown once)` нет, stderr пустой |
| 8. id учителя до и после | тот же |
| 8. сессии после восстановления | второй клиент 200 -> 401, браузер `/login?reason=expired`; вход `DEV_TEACHER_PASSWORD` 200 |
| 8. `--reset-password --email nobody@dv-lab.test` | exit 3, stderr `No active teacher with this email`, stdout пустой |
| консоль браузера | без ошибок |

Тестовые ученики удалены (`e2e.student%`, 2 строки), блокировки сняты, пароль учителя прежний.

## Задача 3: экраны x темы x ширины

Каждая ячейка - отдельный прогон `18-15-t3.mjs <theme> <width>` с новым контекстом браузера (`colorScheme`), вход через форму. Проверка на каждом экране: текст страницы, `title`, `aria-label`, `placeholder` без кириллицы и символов вне латиницы; `font-family` начинается с `"Inter Variable"` и `document.fonts.check` true; класс темы на `html` и тёмный или светлый фон `body`; `scrollWidth <= clientWidth` у `html` и `body`; на 1280 карточка `SidebarInset` с отступами 8 px сверху, справа, снизу и радиусом 14 px; в тёмной теме класс `dark` и тёмный фон уже в первом кадре (`requestAnimationFrame` из init-скрипта, до гидрации).

| Экран | light 1280 | dark 1280 | light 320 | dark 320 |
|---|---|---|---|---|
| `/login` | PASS | PASS | PASS | PASS |
| `/login?reason=expired` (info Banner, role status) | PASS | PASS | PASS | PASS |
| `/login` с Wrong login or password (error Banner, role alert) | PASS | PASS | PASS | PASS |
| Today | PASS, карточка t8 r8 b8 | PASS, первый кадр `dark` | PASS | PASS |
| Chat | PASS | PASS | PASS | PASS |
| Schedule | PASS | PASS | PASS | PASS |
| Students, вкладка Active (точка Active 8 px, подсказка) | PASS | PASS | PASS | PASS |
| Students, вкладка Deactivated (точка, подсказка) | PASS (повторный прогон) | PASS | PASS | PASS |
| Палитра: группы Sections, Theme, Account; `stud` -> Students; `zzzz` -> No matching sections or actions | PASS | PASS | PASS | PASS |
| Create student account | PASS | PASS | PASS | PASS |
| Account created (warning Banner, role status) | PASS | PASS | PASS | PASS |
| Тост Account created (success, role status) | PASS | PASS | PASS | PASS |
| Deactivate {name}? (фокус на Keep account) | PASS | PASS | PASS | PASS |
| Change password | PASS | PASS | PASS | PASS |
| Страница ученика, имя 60 символов | PASS, 3 строки | PASS, 3 строки | PASS, 5 строк | PASS, 5 строк |
| Имя 60 символов в таблице | помещается в колонку | помещается | не обрезается, таблица 906 px прокручивается в рамке (пробел 2) | то же |
| Консоль | только 401 намеренного неверного пароля | то же | то же | то же |

Отдельно на 1280 в обеих темах:
- Фокус клавиатуры: снимок области элемента в фокусе отличается от снимка без фокуса у skip link, поля поиска, ссылки раздела, строки аккаунта, триггера сайдбара и кнопки темы.
- Порядок Tab с начала страницы: Skip to content -> Search sections and actions -> Today -> Open account menu -> Toggle sidebar -> Dark theme. Разделы - одна остановка Tab, стрелка вниз переводит фокус на Chat (пробел 1).
- Статус нигде не передан цветным текстом: точка - `span` с `role=img`, `aria-label` и пустым текстом, подпись в подсказке; баннеры со значком слева.

Снимки (по одному на экран и тему, на 320 только вход, Students, диалоги, страница ученика): `scratchpad/18-15-shots/t3-*.png`.

## Задача 3: состояния плана 18-17

| Состояние | light 1280 | dark 1280 | light 320 | dark 320 |
|---|---|---|---|---|
| 1. 404 в оболочке `/no-such-page`: статус документа 404, сайдбар и верхняя панель, h1 Page not found, текст, Go to Today, нет картинок и цифр 404, вкладка `Page not found · dv-lab` | PASS | PASS | PASS | PASS |
| 1. то же для `/students/no-such-page` | PASS | PASS | PASS | PASS |
| 1. Go to Today -> `/` без нового запроса документа | PASS | PASS | PASS | PASS |
| 2. `/_not-found` вошедшим учителем | 404, вариант внутри оболочки | то же | то же | то же |
| 3. переход Today -> Students при остановленном api | ErrorPage (вне оболочки) | PASS | PASS | PASS |
| 3. перезагрузка `/` при остановленном api: статус 500, панель по центру, Something went wrong, текст, Refresh и Go to Today, нет ECONNREFUSED, fetch failed, Session lookup failed, digest, `Error:` | PASS | PASS | PASS | PASS |
| 3. Go to Today -> `/` | PASS | PASS | PASS | PASS |
| 3. api снова запущен, Refresh: Today без нового запроса документа | PASS | PASS | PASS | PASS |
| 4. мёртвый порт для `/api`: h1 Students, одна панель (круг 40 px `bg-hover`, значок 20 px, заголовок weight 600, Nothing was changed. Try again., Refresh), вкладок, счётчиков и Create student account нет, оболочка на месте | PASS | PASS | PASS | PASS |
| 4. Refresh при мёртвом порте | та же ошибка | PASS | PASS | PASS |
| 4. пересылка 4999 -> 4000, Refresh: список без нового запроса документа | PASS | PASS | PASS | PASS |
| 5. скелетон (задержка 3 с): h1, Create student account, вкладки Active и Deactivated, серая строка вместо счётчиков, 5 полос по 36 px, анимация `shimmer` | PASS | PASS | PASS | PASS |
| 5. рамка скелетона и таблицы: те же top, left, width | PASS (208/272/968) | PASS | PASS (236/16/288) | PASS |
| 5. `prefers-reduced-motion: reduce` (эмуляция): анимация `none`, градиента нет | PASS | PASS | - | - |
| 6. Banner: error `alert`, info, warning, success `status` | PASS (см. таблицу экранов) | PASS | PASS | PASS |
| 7. Button loading: на Refresh идут анимации `spinner-move` и `spinner-dash` | PASS | PASS | PASS | PASS |

- `global-error` в браузере не вызывался (нужен сбой корневого layout): покрыт проверкой `18-17-checks.mjs` (CHECKS_OK, файл в client reference manifest страницы `_global-error`).
- `/_not-found` вошедшего попадает в страницу-ловушку `(app)/[...missing]` и показывает вариант внутри оболочки; вариант вне оболочки покрыт пререндером `_not-found.html` (TRACER_OK 18-17), аноним на неизвестном адресе получает 307 на `/login` (проверено и здесь). Пробелом не считается.
- Верхняя панель показывает Today на `/no-such-page` и Students на `/students/no-such-page`: известное поведение `sectionForPath`, не пробел.
- В dev на ErrorPage видна плашка Next `2 Issues` (только next dev).

## Дополнительно из списков «не проверено в браузере» 18-13 и 18-14

| Проверка | Результат |
|---|---|
| Аноним на `/no-such-page` | 307 на `/login` |
| Продление сессии: свежая сессия без `POST /api/auth/renew`; после `expires_at = now() + 28 days` одна перезагрузка даёт один `POST /api/auth/renew` 204; следующая перезагрузка - ни одного | PASS |
| Пять неверных текущих паролей в `POST /api/auth/change-password` (XFF 198.51.100.88): 5 x 400 `wrong_current_password`, шестой 429 `locked`; вход учителя с того же адреса 429, с другого адреса 200 | PASS (общий счётчик с входом) |

## Пробелы (для /gsd-plan-phase 18 --gaps)

1. **Порядок Tab в оболочке расходится с UI-SPEC.** UI-SPEC (Interaction Contract, Keyboard): skip link -> trigger -> search -> section links -> account row -> page. Фактически (1280, обе темы): Skip to content -> Search sections and actions -> Today -> Open account menu -> Toggle sidebar -> Dark theme. Триггер стоит после строки аккаунта, потому что верхняя панель идёт в DOM после сайдбара; разделы - одна остановка Tab с переходом стрелками. Команда: `node scratchpad/18-15-t3.mjs light 1280`, строка `NOTE T3.light-1280 Tab order from page start: ...`. Нужно решить: менять порядок или поправить UI-SPEC.
2. **`truncate` у имени в таблице Students не действует.** UI-SPEC: длинные имена и логины обрезаются `truncate`. Имя из 60 символов на 1280 помещается в колонку (407 px), на 320 колонка растёт по содержимому: таблица 906 px, имя обрезано краем рамки без многоточия (`clientWidth == scrollWidth` у ячейки), Login, Status, Created и Deactivate видны только после горизонтальной прокрутки внутри рамки. Страница при этом не прокручивается (требование SHELL-02 выполнено). Команда: `node scratchpad/18-15-t3.mjs light 320`, строка `T3.light-320.long-name-table` и снимок `t3-light-320-students.png`. Нужна ширина колонки или `max-w` у ячейки, иначе `truncate` не срабатывает.

## Нужно посмотреть глазами

Всё ниже проверено DOM, вычисленными стилями и снимками headless Chromium, но решение о внешнем виде за владельцем:

1. Контраст и читаемость в обеих темах: заливка Banner 14% (info, warning, error, success), серая и зелёная точки статуса, серые полосы скелетона и блик (`s5-*-skeleton.png`), круг значка ReadError (`s4-*-readerror.png`).
2. Отсутствие белой вспышки при перезагрузке в тёмной теме: в первом кадре класс `dark` и тёмный фон подтверждены, сам визуальный эффект в обычном Chrome не оценивался.
3. Мигание пустого экрана до гидрации на 404 и ErrorPage (Next 16.4 отдаёт сначала оболочку ошибки, 18-17 отклонение 1).
4. Анимации появления и закрытия диалогов, меню аккаунта, палитры, тоста; положение тоста на узком экране.
5. Вид кольца фокуса (снимки с фокусом отличаются, но толщину и цвет кольца глазами не сравнивали с `--focus-ring`).
6. Таблица Students на 320 px с длинным именем (см. пробел 2) и решение, нужна ли там прокрутка.
7. Тексты, которые владелец ещё не подтверждал: Enter your current password., Use 80 characters or fewer. (18-14), тексты 404 и ErrorPage (18-17).
8. Копирование пароля кнопкой Copy password на не-localhost origin (Clipboard API) - только после выкатки.
9. Принятие `__Host-` cookie с флагом Secure на http://localhost в обычном (не headless) Chrome и Safari владельца.

## Не выполнялось

- Критерий 1 «на dv-lab.dev»: закрывается выкаткой по RUNBOOK 10.1-10.3 (18-16) и входом владельца.
- Встроенного браузера у исполнителя нет; все браузерные шаги сделаны headless Chromium.
- `global-error` в живом браузере (см. выше).

## Deviations from Plan

1. **[Rule 3 - Среда] Шаги через скрипты scratchpad.** Хук изоляции отклоняет `&&`, `!`, префикс переменной и `$(...)`: полный набор запускался `18-15-static.sh`, `<automated>` задачи 3 (grep кириллицы и Radix) - там же; `--force` добавлен к typecheck, lint, build, test, чтобы turbo не отдавал кеш.
2. **[Rule 3 - Среда] Порядок полного набора: build до test.** Тестам api нужен свежий `dist`, а 18-17-checks читает собранный CSS до запуска `next dev`.
3. **[Rule 3 - Среда] Вход контекстов браузера для блока ReadError.** `addCookies` для `__Host-` cookie на http Chromium отклоняет; шесть контекстов вошли через форму на обычном стеке, затем web перезапущен на мёртвый порт (как и предписывает план: «cookie остаётся в браузере»).
4. **[Rule 1 - Скрипт проверки] Задержка пересылки на каждый ответ.** Первая версия `forward` задерживала только установку соединения; dev-прокси Next переиспользует keep-alive, скелетон не появлялся у второго контекста. Пересылка переписана на задержку каждого ответа, блок прогнан повторно.
5. **[Скрипт проверки] Повторные прогоны.** Первые FAIL в `18-15-results.md` - ошибки скриптов (ожидание обрезки имени на 1280, клик по скрытой ссылке раздела в закрытом сайдбаре на 320, `textContent` вкладок с дублем подписи); после исправления все ячейки PASS, кроме пробела 2.
6. **[Дополнение] Проверки сверх плана** из списков 18-13 (продление, аноним на неизвестном адресе) и 18-14 (блокировка через смену пароля) - чтобы закрыть их «не проверено в браузере».

**Total deviations:** 3 по среде, 2 по скриптам проверки, 1 дополнение. Файлы репозитория не менялись.

## Known Stubs

Нет (план без правок кода). Разделы Chat и Schedule остаются заглушками `Nothing here yet` по D-14.

## Threat Flags

Нет. T-18-53: пароли учеников и учителя, токены и строки подключения не попали в SUMMARY и в файлы репозитория (сгенерированный пароль видим только на снимке `t3-dark-1280-dialog-reveal.png` в scratchpad, учётная запись удалена). T-18-54: SQL только через `18-sql.mjs` в dvlab_dev, тестовые ученики `e2e.%` и `second@dv-lab.test` удалены (остаток 0), `sign_in_throttles` пуст.

## Уборка

- Процессы остановлены: api (exit 0, `shutdown complete`), web dev, пересылка; порты 3000, 4000, 4999 свободны.
- `apps/web/AGENTS.md`, созданный `next dev`, удалён; `git status` показывает только чужой `.gsd/`.
- В dvlab_dev у dev-учителя накопились незакрытые сессии прогонов (28 строк на момент проверки продления); они истекают сами и проверкам не мешают.

## Self-Check: PASSED

- Коммиты задач не создавались (план без файлов, `commits: 0` измерено `git rev-list --count 8eac616..HEAD` до коммита этого файла).
- Результаты подтверждены журналом `scratchpad/18-15-results.md` и логами `scratchpad/18-15-static/*.log`.

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-10*
