# Phase 18: Accounts and Variant A Shell - Research

**Researched:** 2026-10-09
**Domain:** вход и сессии на Hono + Drizzle v1 + Postgres 18 (порт ielts), оболочка варианта A на Next 16.4 + Base UI (копия из vault design-lab)
**Confidence:** HIGH для правил входа, схемы и API Hono/Drizzle (прочитан эталон и исходники пакетов, ielts работает на тех же версиях), HIGH для сборки Next с workspace-пакетом (проба), MEDIUM для оболочки (копия 37 файлов не собиралась в dv-lab), MEDIUM для Docker/Caddy/IPv6 (Docker и Caddy локально нет)

<user_constraints>
## User Constraints (from CONTEXT.md)

Все решения приняты по умолчанию, не просмотрены владельцем (см. 18-CONTEXT.md). Планировщик обязан их соблюдать; оспаривание — только через владельца.

### Locked Decisions

#### Сессии и граница web и api (по умолчанию, не просмотрено)
- **D-01:** Api владеет аккаунтами, сессиями и ограничением попыток; браузер держит одну cookie `__Host-dvlab_session` (httpOnly, secure, sameSite lax, path `/`), которую ставит api на том же домене через прокси (Caddy срезает `/api`, D-07 фазы 17). Сессия живёт 30 дней с продлением примерно раз в сутки, как в ielts.
- **D-02:** `proxy.ts` в web проверяет только форму cookie и отправляет на `/login`; настоящая проверка — в api и в layout web через запрос «кто я». «Не вошёл» в api — 401 JSON, в web — редирект на `/login`.

#### Аккаунты и пароли (по умолчанию, не просмотрено)
- **D-03:** Таблицы `accounts` (id, login, display_name, role, status, password_hash, auth_epoch), `sessions` (хэш токена, аккаунт, снимок эпохи, срок) и `sign_in_throttles` на Drizzle v1, миграции под `dvlab_migrator`. Частичные уникальные индексы: логин уникален среди активных, один активный учитель. Связь с карточкой ученика добавит фаза 19. — **Reversibility:** costly — схема аккаунтов определяет вход, роли и импорт учеников.
- **D-04:** Пароли хэшируются scrypt из `node:crypto` (N=2^15, r=8, p=3, соль 16 байт, ключ 32 байта, NFKC), параметры хранятся в строке хэша; нативных зависимостей нет.
- **D-05:** Логин ученика `^[a-z0-9._-]{3,32}$`, логин учителя — e-mail.
- **D-06:** Пароль нового ученика генерируется (12 символов) и показывается один раз; учитель может ввести свой (10-128 символов).
- **D-07:** Учитель меняет пароль (ACCT-05), вводя старый; остальные его сессии закрываются, текущая остаётся.
- **D-08:** Деактивация ученика повышает `auth_epoch` и удаляет его сессии в одной транзакции: ученик выходит на всех устройствах.

#### Защита входа (по умолчанию, не просмотрено)
- **D-09:** Пять неудач на пару «логин + IP» (IPv6 по сети /64) за 15 минут закрывают вход на 15 минут; сверх того 20 неудач на логин со всех адресов. Строки ограничения блокируются `FOR UPDATE` до проверки пароля. IP берётся из заголовка прокси, которому api доверяет только в цепочке Caddy.
- **D-10:** Неверный пароль и неизвестный логин дают одно сообщение «Wrong login or password» (неизвестный логин тратит такой же хэш); блокировка показывается: «Too many attempts, try again in 15 minutes».

#### Оболочка варианта A (по умолчанию, не просмотрено)
- **D-11:** Компоненты и токены варианта A копируются из рабочей копии `design-lab` репозитория vault (sidebar, search-field, palette, button, input, popover, tabs), подписи переводятся на английский; экраны пишутся заново (решение владельца 2026-10-09).
- **D-12:** Палитра в фазе знает разделы, смену темы и выход; ученики и «New chat» добавляет фаза 23.
- **D-13:** Тема по умолчанию как в системе, переключатель в верхней панели (next-themes, класс `dark`).
- **D-14:** Разделы Today, Chat, Students, Schedule без данных показывают одну строку «Nothing here yet».

#### Первый запуск и ученик (по умолчанию, не просмотрено)
- **D-15:** Первого учителя создаёт скрипт в образе api под ролью приложения (`docker compose run --rm`): генерирует пароль, печатает один раз, отказывается, если активный учитель уже есть. Адреса и пароли в репозитории нет (D-11 фазы 17).
- **D-16:** Ученик после входа видит страницу «Signed in as …» с кнопкой выхода; кабинета ученика в roadmap нет.

#### Архитектура в зоне фазы (см. `18-ARCH-REVIEW.md`, по умолчанию, не просмотрено)
- **D-17:** Модуль входа в `apps/api` с одним входом «попытка входа → исход» (порядок: счётчик, слот scrypt, сессия, сброс счётчика; пороги 5 и 20; разбор исходов) — отдельным планом до планов, которые пишут маршруты, смену пароля и деактивацию. Фоновая очистка идёт через `lifecycle.ts` фазы 17.
- **D-18:** Контракт web и api живёт в типовом пакете `packages/contracts` без `pg` и кода api (имя и форма cookie, шаблон логина, исходы входа, ответ «кто я»); web может зависеть от него. Проверка CI 17-10 сужена до запрета `@dv-lab/api` и `@dv-lab/db` в web. — **Reversibility:** costly — от места контракта зависят импорты web и api.
- **D-19:** Поддержка тестов базы отдельным небольшим планом до DB-тестов api: сброс состояния таблиц под ролью миграций, миграции перед прогоном, последовательный запуск файлов, общий запуск собранного api и его перезапуск (критерий 3: сессии переживают рестарт).
- **D-20:** Условие приёмки плана ограничения попыток: поток попыток на один логин не должен лишать `/healthz` соединений (пул `createDb` фиксирован на 10 соединений и общий с проверкой базы).

### Claude's Discretion
- Маршруты `/api/auth/*`, имена таблиц и столбцов, схема сообщений об ошибках, тест-раннер.
- Стиль экрана входа как в варианте A.
- Где внутри `apps/api` лежит код входа, если он соблюдает D-17.

### Deferred Ideas (OUT OF SCOPE)
- Повторная активация и удаление ученика, самостоятельная смена пароля учеником, сброс пароля по почте, вход через Google.
- Поднять в `@dv-lab/db` тип «база или транзакция» и разбор нарушений уникальности — на втором потребителе в фазе 19 (находка 4, запись в `.planning/WINDOWS.md`).
- Поиск учеников и «New chat» в палитре — фаза 23; телефонная вёрстка — фаза 23.

### Входной документ вне CONTEXT: 18-UI-SPEC.md (статус draft, создан 2026-10-09 после CONTEXT)
`18-UI-SPEC.md` не указан в задании, но лежит в каталоге фазы и расширяет рамку: экран Students со списком аккаунтов, диалоги создания, показа пароля один раз и деактивации, диалог смены пароля из меню аккаунта, страница ученика, палитра без `cmdk`. Исследование считает его действующим контрактом UI (в нём «Auto mode: nothing was asked of the owner» и подпись чекера «pending»). Палитра на Base UI `Autocomplete` подтверждена (Pattern 6). Остальные расхождения контракта с проверенными фактами вынесены в Open Questions: Q3 (строки сайдбара не «уже английские»), Q8 (`tw-animate-css` без потребителей), Q4 (`paths`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACCT-01 | Учитель входит по email и паролю; база допускает ровно одного активного учителя. | Схема `accounts` с частичным уникальным индексом `accounts_one_active_teacher_uq` (раздел «Схема»), порядок входа и параметры scrypt (раздел «Правила эталона»), cookie `__Host-` и middleware Hono. |
| ACCT-02 | Учитель создаёт аккаунт ученика (login, имя, пароль), деактивирует его; деактивация отзывает сессии. | `createStudent`/`deactivateStudent` из эталона, транзакция с `FOR UPDATE` и `auth_epoch + 1`, UI-SPEC: экран Students и диалоги. |
| ACCT-03 | Сессии в Postgres с хэшами токенов; пять неудач на логин и IP за 15 минут блокируют вход на 15 минут. | `sessions` (хэш sha256 hex, проверка `^[0-9a-f]{64}$`), `sign_in_throttles`, пороги 5 и 20, IPv6 /64, получение IP за Caddy, D-20 (семафор допуска), тесты перезапуска. |
| ACCT-05 | Первого учителя создаёт bootstrap-скрипт; учитель меняет пароль. | `bootstrap-teacher.ts` в образе api (tsdown entry), сервис `bootstrap` в профиле `tools`, смена пароля с ротацией сессии (раздел «Pitfalls», «Code Examples»). |
| SHELL-01 | Приложение открывается в оболочке варианта A: разделы Today, Chat, Students, Schedule и поле поиска, открывающее палитру. | Перечень 37 файлов копии (10 627 строк), структура `app/(app)/`, палитра на Base UI Autocomplete (проверено по документации пакета), `proxy.ts`. |
| SHELL-02 | Каждый экран на Base UI и токенах варианта A, светлая и тёмная тема, весь текст на английском. | Замена `cn` и пакет `cn`, 8 русских строк в копии, снятие 1 932 строк комментариев, next-themes, ESLint `no-restricted-imports` против Radix, проверки Cyrillic и Radix. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Репозиторный `./CLAUDE.md` (блок GitNexus) устарел: фаза 17 (17-10) переписывает его, глобальное правило владельца — GitNexus не использовать, навигация CodeGraph (в репозитории `.codegraph/` проверять не требуется для этой задачи). Действуют директивы из `~/.claude/CLAUDE.md`:

- Без комментариев в коде нигде (TS, CSS, SQL, shell, YAML). Копия из vault содержит 1 932 строки комментариев (18 % строк): их снимают при копировании (см. «Pitfall 9»). Примеры в этом документе даны без комментариев.
- GSD не коммитит: исполнители оставляют изменения в рабочем дереве.
- Минимальное решение: новые обёртки, скрипты и абстракции только при необходимости (D-17 и D-19 владелец уже одобрил по умолчанию).
- Сначала готовое: UI из копии варианта A и Base UI, своё только когда готового нет (палитра, `PasswordField`, `EmptyLine` — указаны в UI-SPEC).
- «Готово» для UI только после проверки в браузере (раздел Validation Architecture, ручные проверки).
- Интерфейс только на английском; документы и ответы владельцу на русском.
- Репозиторий публичный (D-11 фазы 17): ни адресов серверов, ни паролей, ни данных учеников в файлах, тестах, документации.
- Серверные шаги выполняет владелец; агентам доступа к серверу нет.
- `yarn install` исследование не запускало; `yarn.lock` и `.yarnrc.yml` не менялись. Установку новых зависимостей делает исполнитель с одним checkpoint (прецедент A10 фазы 17).

## Summary

Правила входа берутся из ielts без изменения смысла: шаги, пороги, формат хэша, схема таблиц и тексты исходов описаны ниже с цитатами из эталона. Меняется только окружение: вместо server action — Hono-маршруты `POST /auth/sign-in` и связанные, вместо `@vercel/functions` — IP из заголовка Caddy, вместо `after()` — интервал через `lifecycle.ts`, вместо `cookies()` — `hono/cookie`. Формат строки хэша паролей нужно сохранить буква в букву: фаза 26 переносит существующие аккаунты ielts, и их хэши должны проходить `verifyPassword`.

Оболочка: UI-SPEC фиксирует копию 37 файлов (10 627 строк) из design-lab без Radix и `cmdk`. Проверено: ни один из 37 файлов не импортирует Radix или `cmdk`; нужны `@base-ui/react` 1.8.0, `framer-motion` 14.0.0, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `next-themes`. Палитру на Base UI подтверждает документация самого пакета: `Autocomplete.Root open inline` с `autoHighlight="always"` и `keepHighlight` внутри `Dialog` — это штатный пример «Command palette» версии 1.8.0. Next 16.4 собирает workspace-пакет `@dv-lab/contracts` без `transpilePackages` (проба в scratchpad, включая импорты с расширением `.ts`).

Главные риски для планирования: (1) в `next dev` у браузера нет маршрута `/api/*` на api — нужен выбор владельца; (2) продление сессии нельзя сделать в серверном layout, потому что layout не умеет ставить cookie; (3) `onError` в `app.ts` отвечает 500 на любое исключение, включая `HTTPException`; (4) поток попыток входа может занять пул из 10 соединений (D-20); (5) copy-составу нужны: перевод 8 русских строк, снятие комментариев, `paths` `@/*` в tsconfig web, настройка `knip` и `eslint`; (6) `cmdk` исключён UI-SPEC, поэтому Radix не приходит даже транзитивно.

**Primary recommendation:** строить в порядке `contracts + схема + тестовая поддержка (D-18, D-19)` → `модуль входа (D-17)` → `маршруты, bootstrap, правки compose/Caddy` ‖ `web-основа (зависимости, токены, чистка копии)` → `оболочка, вход, Students`; пароль, сессии и ограничения — строго по ielts, хэши совместимы с фазой 26.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Хэш пароля, проверка, ограничение попыток, сессии, роли | API (Hono) | Database | Api владеет правилом входа (D-01, D-17); база держит инварианты (частичные индексы, CHECK, FK) |
| Cookie `__Host-dvlab_session` (установка, очистка, продление) | API | Browser | Cookie ставит api через Caddy на том же домене; layout Next cookie не ставит |
| Проверка формы cookie, редирект на `/login` | Frontend Server (`proxy.ts`) | — | D-02: только форма, без запроса к api |
| Проверка «кто я» на каждый заход | Frontend Server (layout, DAL) | API (`GET /auth/me`) | Настоящая проверка — в api; web вызывает его по внутренней сети с пересланной cookie |
| Форма входа, диалоги, палитра, переключатель темы | Browser (client components) | — | Формы идут `fetch` на `/api/auth/*` с того же origin; тема и палитра чисто клиентские |
| Клиентский IP для лимита | CDN/Proxy (Caddy) | API | Caddy перезаписывает `X-Forwarded-For`; api читает самое правое значение |
| Блокировка «одного активного учителя», уникальность логина | Database | API | Частичные уникальные индексы — единственный авторитет, api только разбирает код `23505` |
| Контракт имён, шаблонов, исходов | `packages/contracts` | web, api | Одно место для cookie-имени, шаблонов логина, форм запросов и ответов (D-18) |
| Первый учитель | API-образ (CLI-скрипт) | Database | Запуск `docker compose run --rm` под `dvlab_app` (D-15) |
| Подмена темы без вспышки | Browser (скрипт next-themes в `<head>`) | Frontend Server (`suppressHydrationWarning`) | Класс `dark` ставится до гидрации |

## Standard Stack

### Core (уже в репозитории, версии не меняются)

| Library | Version | Purpose | Источник |
|---------|---------|---------|----------|
| hono | 4.13.13 | маршруты, `hono/cookie`, `hono/http-exception` | `apps/api/package.json:18` `[VERIFIED: apps/api/package.json]` |
| @hono/node-server | 2.1.4 | запуск, `getConnInfo` из `@hono/node-server/conninfo` | `[VERIFIED: node_modules/@hono/node-server/package.json exports ./conninfo]` |
| drizzle-orm / drizzle-kit | 1.0.0-rc.4 | схема, транзакции, `.for('update')`, миграции | `[VERIFIED: packages/db/package.json]`; ielts на той же версии `[VERIFIED: /Volumes/T7/personal/ielts/package.json:33,54]` |
| pg | 8.23.1 | драйвер | `[VERIFIED: apps/api/package.json]` |
| zod | 4.6.5 | схемы запросов и ответов (api и contracts) | `[VERIFIED: apps/api/package.json]` |
| pino | 10.4.0 | логи только через `createLogger` | `[VERIFIED: apps/api/package.json]` |
| vitest / vite | 5.0.3 / 8.3.3 | тесты | `[VERIFIED: apps/api/package.json]` |
| next / react / react-dom | 16.4.0 / 19.3.0 | web | `[VERIFIED: apps/web/package.json]` |

Новых зависимостей в `apps/api` нет. Валидацию тел запросов делает `zod.safeParse` вручную (`@hono/zod-validator` не добавлять: лишний пакет, лишняя поверхность, а ответ валидатора всё равно нужно приводить к конверту `errorBody`).

### Новые зависимости (только web и contracts)

Версии — самая новая стабильная, опубликованная не менее 24 часов назад на момент 2026-10-09 (возрастной барьер Yarn 1440 минут, 17-01). Расчёт: `scratchpad/ages.mjs` по реестру npm.

| Library | Pin | Опубликована | Зачем | Примечание |
|---------|-----|--------------|-------|------------|
| @base-ui/react | **1.8.0** | 2026-09-04 | примитивы (Button, Dialog, Menu, Tooltip, ScrollArea, Tabs, Input, Autocomplete) | `latest` 1.9.0 опубликована 2026-10-09 08:52Z, барьер её не пропустит; 1.8.0 стоит в ielts и vault |
| framer-motion | 14.0.0 | 2026-10-02 | анимации в 11 из 37 копируемых файлов (Button, Dialog, Sidebar, Tooltip, Banner, Tabs) | в списке владельца не назван; следует из D-11 и UI-SPEC |
| lucide-react | **1.53.0** | 2026-10-08 | иконки | `latest` 1.54.0 опубликована 2026-10-09 06:18Z, младше 24 ч; ielts 1.50.0, vault 1.53.0 |
| next-themes | 0.4.6 | 2025-03-11 | тема, класс `dark` | совпадает с ielts и vault |
| class-variance-authority | 0.7.1 | 2024-11-26 | варианты кнопок и бейджей | |
| clsx | 2.1.1 | 2024-04-23 | `lib/utils.cn` | |
| tailwind-merge | 3.7.0 | 2026-09-12 | `lib/utils.cn` с расширенной шкалой типографики | |

Не ставить: `cmdk` (тянет `@radix-ui/react-dialog`, `-id`, `-primitive`, `-compose-refs`: `[VERIFIED: vault design-lab node_modules/cmdk/package.json dependencies]`; UI-SPEC запрещает), `radix-ui`, `@radix-ui/*`, пакет `cn` (его импортируют только `lab/a/ui/*`; vault D-33 переписывал на `@/lib/utils`), `tw-animate-css` (UI-SPEC называет его зависимостью, но во всех 37 копируемых файлах нет ни одного класса `animate-in`, `animate-out`, `fade-in-*`, `zoom-in-*`, `slide-in-from-*` — `[VERIFIED: scratchpad audit.mjs по 37 файлам]`; ставить, только если `yarn build` или браузер покажут нужду).

`packages/contracts`: зависимость только `zod` 4.6.5 (уже в lockfile). Без `pg`, без `node:crypto`.

**Installation (исполнитель, один checkpoint по diff `yarn.lock`):**
```bash
yarn workspace @dv-lab/web add @base-ui/react@1.8.0 framer-motion@14.0.0 lucide-react@1.53.0 next-themes@0.4.6 class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.7.0 @dv-lab/contracts@workspace:*
yarn workspace @dv-lab/api add @dv-lab/contracts@workspace:*
```
Перед фиксацией версий повторить `node scratchpad/ages.mjs` (список в Sources): за время планирования выйдут новые релизы, а `@base-ui/react@1.9.0` пройдёт барьер уже завтра — оставить 1.8.0 осознанно (копия сверена с 1.8.0).

**Version verification:** `npm view` по реестру выполнен скриптом 2026-10-09; `latest` и самая новая версия старше 24 ч: base-ui 1.9.0 / 1.8.0; lucide-react 1.54.0 / 1.53.0; framer-motion, cmdk, next-themes, cva, clsx, tailwind-merge — совпадают.

## Package Legitimacy Audit

Команда: `gsd-tools query package-legitimacy check --ecosystem npm …` (2026-10-09). Имена пакетов не из слепого поиска: все — зависимости ielts и vault (репозитории владельца) и список из задания.

| Package | Registry | Latest published | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|------------------|--------------|-------------|---------|-------------|
| @base-ui/react | npm | 2026-10-09 | 16,3 млн | github.com/mui/base-ui | SUS (too-new) | Approved с оговоркой (ставится 1.8.0 от 2026-09-04) `[WARNING: flagged as suspicious — verify before using.]` |
| framer-motion | npm | 2026-10-02 | 49,4 млн | github.com/motiondivision/motion | SUS (too-new) | Approved с оговоркой `[WARNING: flagged as suspicious — verify before using.]` |
| lucide-react | npm | 2026-10-09 | 108,3 млн | github.com/lucide-icons/lucide | SUS (too-new) | Approved с оговоркой (ставится 1.53.0) `[WARNING: flagged as suspicious — verify before using.]` |
| tailwind-merge | npm | 2026-09-12 | 87,0 млн | github.com/dcastil/tailwind-merge | SUS (too-new) | Approved с оговоркой `[WARNING: flagged as suspicious — verify before using.]` |
| next-themes | npm | 2025-03-11 | 27,2 млн | github.com/pacocoursey/next-themes | OK | Approved |
| class-variance-authority | npm | 2024-11-26 | 67,6 млн | github.com/joe-bell/cva | OK | Approved |
| clsx | npm | 2024-04-23 | 127,1 млн | github.com/lukeed/clsx | OK | Approved |
| cmdk | npm | 2025-03-14 | 43,5 млн | github.com/pacocoursey/cmdk | OK | NOT USED (UI-SPEC: тянет Radix) |
| tw-animate-css | npm | 2025-09-24 | 40,6 млн | github.com/Wombosvideo/tw-animate-css | OK | NOT USED (нет потребителей) |
| cn | npm | 2026-09-22 | 8,3 млн | github.com/shadcn-ui/cn | SUS (too-new) | NOT USED (заменяется на `@/lib/utils`) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** @base-ui/react, framer-motion, lucide-react, tailwind-merge — причина только `too-new` (последний релиз свежий, у пакетов десятки миллионов загрузок в неделю и официальные репозитории), `postinstall` у всех `null`. Предложение, как в 17 (A10): один `checkpoint:human-verify` после первого `yarn install` с просмотром diff `yarn.lock` вместо отдельного checkpoint на каждый пакет; защиту дают возрастной барьер Yarn и `--immutable` в CI.

## Architecture Patterns

### System Architecture Diagram

```
Browser
  | GET /, /students ...                                 | fetch /api/auth/sign-in, /api/students ...
  v                                                      v
Caddy :443  (X-Forwarded-For := TCP peer, X-Request-Id := uuid; unknown XFF from clients is ignored)
  |-- handle_path /api/*  (prefix stripped) ----------------------------> api:4000  /auth/*, /students/*
  |-- /healthz, /ws -----------------------------------------------------> api:4000
  '-- everything else --------------------------------------------------> web:3000

web (Next standalone)
  proxy.ts: cookie shape only ----> absent: 307 Location /login   (matcher excludes api, _next/*, login, robots.txt)
  (app)/layout.tsx -> getAccount() = fetch(API_INTERNAL_URL + /auth/me, Cookie forwarded, no-store)
        200 teacher -> shell | 200 student -> landing | 401 -> redirect /login?reason=expired
  browser JS: fetch('/api/auth/sign-in' | sign-out | change-password | renew), router.refresh()

api (Hono, one process)
  requestContext -> sameOrigin(APP_ORIGIN) [POST/PUT/PATCH/DELETE] -> route
  POST /auth/sign-in:
     zod parse -> client ip (XFF rightmost) -> admission (in-process cap < pool.max)
       -> reserve throttle tx (login row, pair row; FOR UPDATE)  -> locked? 429
       -> scrypt slot (2 running, 8 waiting) -> select active account + verify (dummy hash if none)
       -> insert session (token 32 random bytes, sha256 hex stored, epoch snapshot) -> settle (delete both throttle rows)
       -> Set-Cookie __Host-dvlab_session
  GET /auth/me -> session join accounts -> {account, renewDue}
  POST /auth/renew, /auth/sign-out, /auth/change-password
  GET|POST /students, POST /students/:id/deactivate  (teacher only)
  housekeeping interval (lifecycle resource, closed BEFORE pg-pool)
        |
        v  pool(10, dvlab_app)
Postgres 18:  accounts | sessions | sign_in_throttles   (DDL only by dvlab_migrator)
```

### Recommended Project Structure

```
packages/contracts/            # D-18: types and pure functions, deps: zod only
  src/index.ts  session.ts (SESSION_COOKIE, TTL, token pattern)  identity.ts (login patterns, normalizers, limits)
  src/auth.ts (zod request schemas, response types, ErrorCode union)
packages/db/
  src/schema.ts                # + accounts, sessions, sign_in_throttles
  src/testing.ts               # D-19: ./testing subpath export: resetTables(), createTestDatabase()
  drizzle/<ts>_accounts/       # drizzle-kit generate --name accounts
apps/api/src/
  auth/passwords.ts            # hash/verify/dummy/generate (from ielts, node:crypto)
  auth/sessions.ts             # issue/read/delete/renew/hashSessionToken
  auth/throttle.ts             # ipBucket, reserve, settle, prune
  auth/admission.ts            # scrypt slot + sign-in admission cap (factory, no module state)
  auth/sign-in.ts              # the single entry "attempt -> outcome" (D-17)
  auth/accounts.ts             # createStudent, deactivateStudent, changePassword, listStudents
  auth/housekeeping.ts         # interval cleanup as Closable
  auth/middleware.ts           # sameOrigin, requireSession, requireRole, clientIp
  routes/auth.ts, routes/students.ts
  bootstrap-teacher.ts         # second tsdown entry -> dist/bootstrap-teacher.mjs
apps/api/test/auth/*.test.ts, test/support/server.ts
apps/web/
  proxy.ts
  app/layout.tsx (ThemeProvider)  app/globals.css (tokens)  app/login/{page,login-form}.tsx
  app/(app)/layout.tsx  app/(app)/{page,chat,students,schedule}/page.tsx  app/(app)/_components/*
  components/{ui,sidebar-app}/*  components/fluid-hover-highlight.tsx  hooks/*  lib/*   (copy, alias @/* -> apps/web/*)
  lib/session.ts (server DAL: getAccount via React cache)
```

### Pattern 1: Правила входа из ielts (порядок и константы)

Порядок действия входа `[VERIFIED: /Volumes/T7/personal/ielts/src/app/login/actions.ts:33-102]`: (1) пустые поля отвечают `invalid` без базы (`:39-46`); (2) `zod`: логин `trim().toLowerCase().min(1).max(254)`, пароль `min(1).max(1024)` (`:28-31`); (3) адрес клиента, при его отсутствии на платформе отказ `server` (`:49-55`); (4) `reserveSignInAttempt` до проверки пароля, при блокировке `locked` с минутами (`:62-63`); (5) очистка таблицы после ответа (`:66-70`); (6) слот scrypt, при полной очереди `server` (`:73-80`); (7) `signInAccount` (`:77`); (8) `null` → `credentials` (`:81`); (9) две cookie (`:82-87`); (10) `settleSignInSuccess` в try/catch, сбой не ломает вход (`:91-95`); (11) редирект по роли (`:101`).

Дискретные значения (цитаты дословно):

| Что | Значение | Источник |
|-----|----------|----------|
| Имя cookie эталона | `export const SESSION_COOKIE = '__Host-ielts_session'` (в dv-lab: `__Host-dvlab_session`, D-01) | `[VERIFIED: ielts/src/lib/auth/cookies.ts:3]` |
| Срок | `export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60` | `[VERIFIED: cookies.ts:4]` |
| Порог продления | `export const SESSION_RENEW_BELOW_SECONDS = 29 * 24 * 60 * 60` | `[VERIFIED: cookies.ts:6]` |
| Атрибуты | `export const sessionCookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } as const` | `[VERIFIED: cookies.ts:12]` |
| Форма токена | `export const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/` | `[VERIFIED: cookies.ts:16]` |
| Токен и хэш | `randomBytes(32).toString('base64url')`; `createHash('sha256').update(token).digest('hex')` | `[VERIFIED: sessions.ts:55,24]` |
| scrypt | `const SCRYPT_PROFILE = Object.freeze({ N: 2 ** 15, r: 8, p: 3 })`, `SCRYPT_KEY_BYTES = 32`, `SCRYPT_SALT_BYTES = 16`, `SCRYPT_MAX_MEMORY = 64 * 1024 * 1024`, NFKC в `derive` | `[VERIFIED: passwords.ts:15-18,23]` |
| Формат хэша | `scrypt$N=${N},r=${r},p=${p}$${salt.toString('base64url')}$${key.toString('base64url')}`, разбор `/^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/` | `[VERIFIED: passwords.ts:34,19]` |
| Проверка разумности параметров | `N >= 2 ** 14 && (N & (N - 1)) === 0 && r >= 8 && p >= 1 && p <= 16 && 128 * N * r < SCRYPT_MAX_MEMORY` | `[VERIFIED: passwords.ts:42]` |
| Длины паролей | `MANUAL_PASSWORD_MIN_LENGTH = 10`, `MANUAL_PASSWORD_MAX_LENGTH = 128`, `GENERATED_PASSWORD_LENGTH = 12` (в символах-кодпоинтах) | `[VERIFIED: passwords.ts:5-7,65-68]` |
| Алфавит сгенерированного пароля | `'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'` через `randomInt` | `[VERIFIED: passwords.ts:11,70-76]` |
| Пороги | `MAX_FAILURES = 5`, `MAX_LOGIN_FAILURES = 20`, `WINDOW_SECONDS = 900`, `LOCK_SECONDS = 900` | `[VERIFIED: throttle.ts:12-16]` |
| Слот scrypt | `MAX_RUNNING_PASSWORD_CHECKS = 2`, `MAX_WAITING_PASSWORD_CHECKS = 8` | `[VERIFIED: passwordCheckGate.ts:4-5]` |
| Логины | `LOGIN_MAX_LENGTH = 254`, `STUDENT_LOGIN_PATTERN = /^[a-z0-9._-]{3,32}$/`, `DISPLAY_NAME_MAX_LENGTH = 80`; `normalizeLogin = trim().toLowerCase()`; имя: `trim().replace(/\s+/g, ' ')` | `[VERIFIED: identity.ts:6-8,11-13,26-28]` |
| Логин учителя | ровно один `@`, непустые локальная часть и домен, без пробелов, длина 3-254 | `[VERIFIED: identity.ts:16-20]` |

Ограничение попыток (`throttle.ts:91-161`): ключи `sha256(login + "\n" + ipBucket)` и `sha256('login:' + encodeURIComponent(login))` (`:58-66`); в одной транзакции сначала блокируется строка логина, потом строка пары (один порядок, без взаимных блокировок), если любая заблокирована — отказ, не засчитанный нигде; иначе обе строки продвигаются: `count = expired ? 1 : failure_count + 1`, блокировка `now() + 900 s` при `count >= max` (`:136-147`); время только по часам базы; успешный вход удаляет обе строки (`:153-161`); попытка без адреса пропускается без счётчиков (`:97`). Это значит: пятая допущенная попытка, если она неудачна, закрывает пару; шестая, даже с верным паролем, получает отказ; верная пятая снимает счётчик.

Сессия (`sessions.ts:33-106`): вход читает активный аккаунт по нормализованному логину; нет аккаунта — `verifyDummyPassword` и `null`; неверный пароль — `null`; успех — вставка строки сессии со снимком `auth_epoch` аккаунта и сроком `now() + make_interval(secs => 2592000)` и удаление просроченных сессий этого аккаунта; чтение требует `expires_at > now()`, `accounts.status = 'active'` и равенство эпох; продление — `UPDATE … SET expires_at = now() + …` только для непросроченной.

Аккаунты (`accounts.ts:38-231`): `violatesUnique(error, constraint)` проходит по `cause` до пяти уровней и сверяет `code === '23505'` и имя ограничения (`:38-46`); создание ученика ловит `accounts_active_login_uq` → `login_taken`; деактивация в транзакции: `lockStudent` (`select … for update` с условием `role = 'student'` и `status = 'active'`), `status = 'deactivated'`, затем `revokeAccountSessions` = `auth_epoch + 1` и `delete from sessions` (`:149-155,204-211`); хэш считается до транзакции, чтобы не держать блокировку на время scrypt (`:180-189`).

**Что меняется при переносе на Hono и Drizzle v1:** `getDb()` → внедряемый `Database` (как `AppDeps.db`), `DatabaseSession` и `DatabaseTransaction` в `@dv-lab/db` нет (вынесено в Deferred, находка 4) — модуль учётных записей принимает `Database` и выводит тип транзакции из `Parameters<Database['transaction']>[0]`; `after(prune…)` → интервал-ресурс `lifecycle`; `@vercel/functions.ipAddress` → `clientIp(c)`; `cookies().set` → `setCookie` из `hono/cookie`; редирект по роли → клиент делает `router.replace('/')`; в схеме нет `note` и `target_band_halves`.

### Pattern 2: Модуль «попытка входа → исход» (D-17, D-20)

Фабрика `createSignIn({ db, logger, now? })` владеет всем состоянием (слот scrypt и допуск — поля замыкания, не модуль). Один метод `attempt({ login, password, ip }) → Outcome` и тот же путь для проверки старого пароля при смене (`verifyCredentials`), чтобы неверный старый пароль тоже засчитывался. Следствие, которое планировщик принимает осознанно: пять опечаток в диалоге смены пароля закрывают вход самого учителя на 15 минут с того же IP (счётчик общий с входом); альтернатива — отдельный ключ счётчика для смены пароля. Исходы: `{ kind: 'ok', token, account }`, `{ kind: 'invalid_credentials' }`, `{ kind: 'locked', retryAfterSeconds }`, `{ kind: 'busy' }` (допуск или очередь scrypt переполнены), `{ kind: 'unavailable' }` (нет IP в production). Маршрут только переводит исход в HTTP.

Порядок и защита пула (D-20): допуск (семафор, лимит ниже `pool.max`, например 4 одновременных попыток входа и очередь до 8, дальше сразу `busy`) стоит **перед** любой работой с базой. В эталоне слот scrypt стоит после транзакции ограничения, поэтому поток попыток держит соединения пула в ожидании `FOR UPDATE`, а пул у `createDb` фиксирован: `new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 3000 })` `[VERIFIED: packages/db/src/connection.ts:23]`, и тот же пул отвечает `select 1` в `/healthz` `[VERIFIED: apps/api/src/app.ts:26]`. Приёмка D-20 — тест: 50 параллельных неверных попыток на один логин, параллельно опрос `/healthz`, все ответы 200.

### Pattern 3: Схема Drizzle v1 (эталон без полей ielts)

Источник DSL и порождённого SQL — ielts на той же `1.0.0-rc.4` `[VERIFIED: ielts/src/lib/db/schema.ts:18-91; ielts/drizzle/20261003014350_init_accounts/migration.sql]`. Ограничения для dv-lab берутся дословно:

```typescript
import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const accountRoles = ['teacher', 'student'] as const
export const accountStatuses = ['active', 'deactivated'] as const

export const accounts = pgTable(
	'accounts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		login: text('login').notNull(),
		displayName: text('display_name').notNull(),
		role: text('role').notNull(),
		status: text('status').default('active').notNull(),
		passwordHash: text('password_hash').notNull(),
		authEpoch: integer('auth_epoch').default(0).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('accounts_active_login_uq').on(table.login).where(sql`${table.status} = 'active'`),
		uniqueIndex('accounts_one_active_teacher_uq')
			.on(table.role)
			.where(sql`${table.role} = 'teacher' and ${table.status} = 'active'`),
		check('accounts_role_ck', sql`${table.role} in ('teacher', 'student')`),
		check('accounts_status_ck', sql`${table.status} in ('active', 'deactivated')`),
		check('accounts_auth_epoch_ck', sql`${table.authEpoch} >= 0`),
		check('accounts_login_normalized_ck', sql`${table.login} = lower(btrim(${table.login})) and char_length(${table.login}) between 3 and 254`),
		check('accounts_student_login_ck', sql`${table.role} <> 'student' or ${table.login} ~ '^[a-z0-9._-]{3,32}$'`),
		check('accounts_display_name_ck', sql`char_length(${table.displayName}) between 1 and 80`),
	]
)
```

Порождённый drizzle-kit rc.4 SQL (эталон): `CREATE UNIQUE INDEX "accounts_active_login_uq" ON "accounts" ("login") WHERE "status" = 'active';` и `CREATE UNIQUE INDEX "accounts_one_active_teacher_uq" ON "accounts" ("role") WHERE "role" = 'teacher' and "status" = 'active';`, CHECK-ограничения внутри `CREATE TABLE`, внешний ключ отдельным `ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;` `[VERIFIED: ielts/drizzle/20261003014350_init_accounts/migration.sql; …015125_add_sessions/migration.sql]`. `sessions`: `token_hash text primary key`, `account_id uuid not null → accounts(id) on delete restrict`, `auth_epoch integer not null`, `created_at`, `expires_at timestamptz not null`, индекс `sessions_account_idx`, `check ("token_hash" ~ '^[0-9a-f]{64}$')`. `sign_in_throttles`: `key_hash text primary key`, `failure_count integer not null`, `window_started_at timestamptz not null`, `locked_until timestamptz`, индекс по `window_started_at` `[VERIFIED: schema.ts:61-91]`.

Формат миграции в dv-lab: каталог `packages/db/drizzle/<timestamp>_<name>/{migration.sql,snapshot.json}` без `meta/_journal.json` `[VERIFIED: 17-03-SUMMARY.md, «Первая миграция Drizzle v1: packages/db/drizzle/20261009120830_init/{migration.sql,snapshot.json}»]`. Одна миграция `drizzle-kit generate --name accounts` (скрипт `db:generate`), руками не править; CI 17-10 проверяет, что повторный `generate` ничего не создаёт.

Права: `ALTER DEFAULT PRIVILEGES FOR ROLE dvlab_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dvlab_app;` и `… GRANT USAGE, SELECT ON SEQUENCES TO dvlab_app;` `[VERIFIED: deploy/postgres/ensure-db.sql:32-33]`. Значит три новые таблицы автоматически доступны `dvlab_app` на SELECT/INSERT/UPDATE/DELETE; `TRUNCATE` у приложения нет (тест ролей: `app role cannot truncate app_info` → `42501`, `packages/db/test/roles.test.ts:64-66`), поэтому сброс таблиц в тестах идёт под `dvlab_migrator`. `FOR UPDATE` требует права UPDATE — оно есть. Идентификаторы `uuid` с `gen_random_uuid()` — последовательностей нет. Bootstrap под `dvlab_app` вставляет в `accounts` без дополнительных грантов. `pg_advisory_xact_lock` доступна ролям по умолчанию `[ASSUMED]` — проверяется тестом `bootstrap-teacher.test.ts`, запускаемым под `dvlab_app`.

### Pattern 4: Hono — порядок middleware, cookie, Origin, ошибки, IP

**Порядок.** `requestContext` остаётся первым `app.use('*', …)` `[VERIFIED: app.ts:21]`; за ним `sameOrigin` на путях с изменяющими методами, затем маршруты. Маршруты подключаются `app.route('/auth', authRoutes(deps))`, `app.route('/students', studentRoutes(deps))`; `requireSession` и `requireRole('teacher')` вешаются на группу, а не на отдельные обработчики. Тип `Variables` расширяется полем `account`. `AppDeps` в `app.ts` уже получил `appOrigin` в 17-09 `[VERIFIED: app.ts:11-17]` — его же использует `sameOrigin`.

**Cookie.** `setCookie(c, name, value, opt)` вызывает `c.header("Set-Cookie", cookie, { append: true })` `[VERIFIED: node_modules/hono/dist/helper/cookie/index.js, функция setCookie]`. Имя с префиксом `__Host-` проверяется при сериализации: `if (!opt.secure) throw …`, `if (opt.path !== "/") throw …`, `if (opt.domain) throw …` `[VERIFIED: node_modules/hono/dist/utils/cookie.js:83-86]`. Тип `sameSite?: 'Strict' | 'Lax' | 'None' | 'strict' | 'lax' | 'none'` `[VERIFIED: node_modules/hono/dist/types/utils/cookie.d.ts:30]`. Максимум `Max-Age` — 400 суток `[VERIFIED: cookie.js:95]`, 30 суток проходят. Рекомендация: полное имя `__Host-dvlab_session` лежит в `@dv-lab/contracts`, `setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge })` **без** опции `prefix` (так имя остаётся единственным источником правды для `proxy.ts`); сброс — тот же вызов с пустым значением и `maxAge: 0` и теми же атрибутами (`deleteCookie` делает именно это `[VERIFIED: helper/cookie/index.js, deleteCookie]`). Чтение: `getCookie(c, SESSION_COOKIE)`.

**CSRF.** Встроенный `csrf()` проверяет только запросы с типом содержимого форм: `isRequestedByFormElementRe = /^\b(application\/x-www-form-urlencoded|multipart\/form-data|text\/plain)\b/i` и `!isSafeMethodRe.test(c.req.method) && isRequestedByFormElementRe.test(c.req.header("content-type") || "text/plain") && …` `[VERIFIED: node_modules/hono/dist/middleware/csrf/index.js:10-11,97]`. JSON-запросы он пропускает, при отказе бросает `HTTPException(403)`, а источник по умолчанию — `new URL(c.req.url).origin`. За Caddy `c.req.url` имеет схему `http`: `scheme = incoming.socket && incoming.socket.encrypted ? "https" : "http"` `[VERIFIED: node_modules/@hono/node-server/dist/index.mjs:605]`, а заголовок `Host` Caddy передаёт без изменений `[CITED: caddyserver.com/docs/caddyfile/directives/reverse_proxy]`, то есть origin запроса `http://dv-lab.dev` и по умолчанию настоящие запросы отклонились бы. Поэтому: свой `sameOrigin(appOrigin)` на всех методах кроме GET/HEAD/OPTIONS по образцу ielts (`provesSameOrigin`: `Origin` равен разрешённому, а если `Origin` нет — `Sec-Fetch-Site: same-origin`, `[VERIFIED: ielts/src/lib/auth/origin.ts:9-13]`) и по образцу уже написанной проверки `/ws` (`c.req.header('origin') !== deps.appOrigin` → `errorBody('forbidden_origin', 'Forbidden')`, 403, `[VERIFIED: app.ts:36]`). Плюс: CORS-заголовков api не отдаёт (JSON с `application/json` из чужого origin требует preflight и не пройдёт), тела принимаются только при `content-type: application/json`, cookie `SameSite=Lax`.

**Ошибки.** `app.onError` сейчас отвечает 500 на любое исключение `[VERIFIED: app.ts:45-48]`; `HTTPException` (от `hono/http-exception`, из `validator`, `csrf`, `bodyLimit`) станет 500. Добавить ветку `err instanceof HTTPException` → статус исключения и конверт `errorBody(code, message)`. Обработчики возвращают конверт напрямую, не бросают. Разбор тела: `await c.req.json().catch(() => undefined)` и `schema.safeParse`; ошибка → 400 `invalid_request`. `errorBody(code, message)` возвращает только `{ error: { code, message, requestId } }` `[VERIFIED: request-context.ts:49-51]`; для блокировки нужны `retryAfterSeconds` — расширить сигнатуру необязательным третьим аргументом `extra`, не собирая конверт в маршруте руками (тест 17-04 проверяет, что `code:` встречается только в `request-context.ts`: `git grep "code: "` в `apps/api/src`).

**IP клиента.** Caddy: для `reverse_proxy` «It sets or augments the X-Forwarded-For header field», значения из входящего запроса игнорируются «to prevent spoofing», если не настроен `trusted_proxies` `[CITED: caddyserver.com/docs/caddyfile/directives/reverse_proxy, раздел Defaults]`. В `deploy/caddy/Caddyfile` `trusted_proxies` нет `[VERIFIED: deploy/caddy/Caddyfile:1-55]`, а `handle_path /api/*` ведёт на `api:4000` `[VERIFIED: Caddyfile:43-48]`. Значит правило «доверять только цепочке Caddy» реализуется так: api читает **самое правое** значение `X-Forwarded-For` (то, что дописал ближайший прокси), проверяет `net.isIP`, и не публикуется наружу (у `api` в compose нет `ports` `[VERIFIED: deploy/compose.yaml:43-71]`), поэтому достучаться до него в обход Caddy могут только соседние контейнеры. Менять Caddyfile не нужно. Ближайший запасной источник вне production — `getConnInfo(c).remote.address` из `@hono/node-server/conninfo` `[VERIFIED: conninfo.mjs]`; он падает на `app.request()` без `env` (читает `c.env.server ?? c.env` → `incoming.socket`), поэтому обернуть в `try`. Если адреса нет: в `NODE_ENV=production` вход отвечает `503`/`unavailable` (как «refuse» в эталоне, `actions.ts:50-55`), в остальных режимах попытка проходит без счётчиков.

### Pattern 5: Next 16.4 — proxy.ts, DAL, вход без server action

`proxy.ts` — переименованный `middleware.ts`: «The `proxy.js|ts` file … Create a `proxy.ts` … in the project root, or inside `src` if applicable, so that it is located at the same level as `pages` or `app`»; экспорт — одна функция `proxy` или default; «Proxy defaults to using the Node.js runtime. The `runtime` config option … is not available in Proxy files» `[CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy, version 16.4.0]`. Для `apps/web` файл лежит в `apps/web/proxy.ts` (у приложения нет `src/`). `matcher` — константа; пример исключающего шаблона из документации: `'/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'`. Для dv-lab: `'/((?!api|login|_next/static|_next/image|favicon.ico|robots.txt).*)'`. Решение: нет cookie `__Host-dvlab_session` → ответ 307 с относительным `Location: /login` (`NextResponse.redirect` требует абсолютный URL, а `request.url` за прокси строится из `Host` и протокола, и в ielts это уже приходилось обходить: `ielts/src/lib/auth/origin.ts:17-28`); cookie есть → `NextResponse.next()`. Форма токена — `SESSION_TOKEN_PATTERN` из contracts. `/login` из проверки исключён, редирект «вошёл → `/`» делает страница `/login` по реальному ответу `me`, а не по форме cookie (иначе устаревшая cookie зациклит `/login` ↔ `/`).

Документ предупреждает: «Server Functions are not separate routes … A matcher change … can silently remove Proxy coverage. Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone» `[CITED: nextjs.org proxy docs, Execution order]`. Поэтому проверка роли — в api на каждом маршруте и в каждой странице через DAL, а не только в layout (layout и страница рендерятся независимо).

DAL: `lib/session.ts` с `cache(async () => …)` из React; читает `(await cookies()).get(SESSION_COOKIE)?.value`, при отсутствии — `null`; иначе `fetch(`${process.env.API_INTERNAL_URL}/auth/me`, { headers: { cookie: `${SESSION_COOKIE}=${token}` }, cache: 'no-store' })`; 401 → `null`; другой статус или сетевой сбой → исключение (страница ошибки, не редирект на вход). Layout `(app)/layout.tsx`: `null` → `redirect('/login?reason=expired')` (cookie есть, но недействительна: proxy пустил, значит cookie присутствует); учитель → оболочка; ученик → страница «Signed in as …» без `children`.

Вход без server action: клиентская форма делает `fetch('/api/auth/sign-in', { method: 'POST', headers: { 'content-type': 'application/json' }, body })`; успех → `router.replace('/')` и `router.refresh()`. Причина — cookie обязана прийти **из ответа api** через Caddy напрямую в браузер; server action пересылал бы вход через web, терял бы IP клиента (web не получает XFF от Caddy к api) и требовал бы ретрансляции `Set-Cookie`.

Web в compose: переменная времени исполнения `API_INTERNAL_URL=http://api:4000` в `environment` сервиса `web` (сейчас у `web` в `deploy/compose.yaml:29-41` блока `environment` нет). Запросы идут по внутренней сети, не через Caddy и TLS. Страницы, читающие `cookies()`, динамические, `process.env` читается во время запроса; в `next dev` значение лежит в `apps/web/.env.development` (без секретов) — Next читает `.env*` из каталога приложения, а не из корня монорепозитория `[ASSUMED]`.

### Pattern 6: Перенос оболочки варианта A

Состав копии по UI-SPEC пересчитан замыканием импортов (`scratchpad/closure.mjs`, `audit.mjs`): **37 файлов, 10 627 строк**, из них `ui/sidebar-core.tsx` 1 661, `ui/sidebar-menu.tsx` 1 511, `ui/dropdown.tsx` 928, `hooks/use-fluid-hover.ts` 609, `lab/a/ui/tabs.tsx` 612, `ui/banner.tsx` 681. Внешние пакеты: `@base-ui/react` (8 файлов), `framer-motion` (11), `class-variance-authority` (3), `clsx`, `tailwind-merge`, `lucide-react`, `react`; пакет `cn` — только `components/lab/a/ui/input.tsx:3` (`import { cn } from "cn"`). Radix и `cmdk`: ноль импортов; единственное совпадение подстроки `radix` — комментарий в `lib/sidebar-menu-grid.ts:4` (исчезнет вместе с комментариями) `[VERIFIED: scratchpad audit.mjs 2026-10-09]`. Переписать нужно: `lab/a/ui/input.tsx` (пакет `cn` → `@/lib/utils`), `user-footer` (две строки aria по UI-SPEC), перевести 8 русских строк (Q3).

Токены (`globals.css` vault): блоки `@custom-variant dark (&:is(.dark *))` (строка 12), `@theme inline` (16-189), `:root` (191-279), `.dark` (281-350), `@layer base` (352-372), `html.transitioning` (725-727), `@property --sf-start/--sf-end` (728-737), `.scroll-fade`/`.scroll-divider` с `@supports` (738-796), правила скроллбара `@media (pointer: fine)` (798-830); шкала варианта A `[data-lab="a"] { --fs-display: 22px; --lh-display: 28px; --fs-subtitle: 13px; --lh-subtitle: 20px; }` `[VERIFIED: vault design-lab src/app/globals.css:1154-1159]` — UI-SPEC переносит её прямо в `:root`. Не брать: `.note-content`, `.typeset`, блоки `[data-lab="b"|"c"]`, второй `@theme inline` (876-909). В `sidebar-core` используются классы `scroll-fade`, `scroll-divider` (`sidebar.tsx:279,283,297`) — их CSS обязателен. Шрифты: `layout.tsx` web держит `geist/font/sans` и `geist/font/mono` (`[VERIFIED: apps/web/app/layout.tsx:3-4]`); vault использует Inter и JetBrains Mono из `next/font/google`, что запрещено 17 (D-17 фазы 17: сборка не ходит в Google). Оставить Geist (UI-SPEC так и решает).

Палитра (UI-SPEC: «The planner confirms the primitive in 18-RESEARCH»): **подтверждено — `Autocomplete`, не `Combobox`.** Документация, поставляемая с `@base-ui/react@1.8.0`, содержит раздел «### Command palette» с примером: `Dialog.Root` → `Dialog.Popup` → `<Autocomplete.Root open inline items={groupedItems} autoHighlight="always" keepHighlight>`, `Autocomplete.InputGroup`/`Autocomplete.Input`, `Autocomplete.Empty`, `Autocomplete.List` с функцией по группам, `Autocomplete.Group items={group.items}`, `Autocomplete.GroupLabel`, `Autocomplete.Collection`, `Autocomplete.Item value={item} onClick={…}` `[VERIFIED: vault design-lab node_modules/@base-ui/react/docs/react/components/autocomplete.md:3203-3320]`. Данные: `interface Item { value: string; label: string }`, `interface Group { value: string; items: Item[] }` (там же, `:3347-3355`). Типы: `inline?: boolean` — «Whether the list is rendered inline … Specify `open` unconditionally in conjunction with this prop», `autoHighlight?: boolean | 'always'`, `keepHighlight?: boolean`, `mode` по умолчанию `'list'` (фильтрация по вводу), `value`/`defaultValue` — строка ввода `[VERIFIED: node_modules/@base-ui/react/autocomplete/root/AutocompleteRoot.d.mts:62-100]`. «Первый печатный символ из поля сайдбара» → `defaultValue={initial}` плюс `key` на перемонтирование (как в `lab-shell.tsx:187-192` `key={search.key}`). Начинать с примера документации дословно (он фильтрует `{ value, label }` без `itemToStringValue`); `itemToStringValue={(item) => item.label}` добавлять только если фильтр по подписи не сработает `[ASSUMED]` — проверить в спайке (A9).

Структура оболочки — как в `lab-shell.tsx`: `<div className="bg-surface-1"><SidebarProvider persist={false} peek="hover" width="15rem" className="h-dvh min-h-0 overflow-hidden">` → `<Sidebar variant={isMobile ? "sidebar" : "inset"}>` + `<SidebarInset className="overflow-hidden"><SurfaceProvider value={2}>…` `[VERIFIED: design-lab src/app/lab/a/_components/lab-shell.tsx:163-175; lab-sidebar.tsx:44]`. `persist={false}` отключает запись cookie `sidebar_state` (`sidebar-core.tsx:41,220-221`). Хлебные крошки (Radix `breadcrumb`) не копируются: заголовок раздела простым текстом (UI-SPEC).

### Pattern 7: Bootstrap первого учителя (D-15, ACCT-05)

Эталон `scripts/bootstrap-teacher.mjs`: аргументы `--email`, `--name`, `--password-stdin`; нормализация логина и имени; пароль из stdin (10-128 символов) или сгенерированный; в транзакции `select pg_advisory_xact_lock($1)`, затем `select 1 from accounts where role = 'teacher' and status = 'active' limit 1`, при наличии — `rollback` и отказ; иначе `insert into accounts (login, display_name, role, password_hash)`; нарушение `accounts_one_active_teacher_uq` тоже трактуется как отказ; коды выхода 2 (использование), 3 (учитель уже есть), 1 (ошибка, текст ошибки не выводится); при успехе печатает `Teacher created. Login: …` и, если пароль сгенерирован, `Password (shown once): …` `[VERIFIED: ielts/scripts/bootstrap-teacher.mjs:19-22,56-90,92-133]`.

Перенос: `apps/api/src/bootstrap-teacher.ts` на `createDb(resolveDatabaseUrl('app', process.env))` (не `loadConfig`: ему нужны `PORT` и `APP_ORIGIN`), вторая запись в `entry` у `tsdown.config.ts` (сейчас `entry: { migrate: 'src/migrate.ts', server: 'src/server.ts' }` `[VERIFIED: apps/api/tsdown.config.ts:4]`) → `dist/bootstrap-teacher.mjs`; пароль и нормализаторы берутся из тех же модулей, что и сервер. В `deploy/compose.yaml` — сервис `bootstrap` в профиле `tools` (по образцу `migrate`, `compose.yaml:73-83`) с `entrypoint: ['node', 'apps/api/dist/bootstrap-teacher.mjs']`, `DATABASE_URL` под `dvlab_app`; запуск `docker compose run --rm bootstrap --email … --name …`. Вывод пароля один раз попадает в журнал контейнера драйвера `local`, `--rm` удаляет контейнер вместе с журналом `[ASSUMED]` — проверит владелец на сервере. Строку в RUNBOOK (17-11) нужно добавить.

### Anti-Patterns to Avoid
- **Server action для входа**: теряет IP, cookie идёт через web (см. Pattern 5).
- **`csrf()` из Hono как единственная защита**: не трогает JSON, отвергает настоящие запросы за Caddy.
- **`redirect` по форме cookie на `/login`**: цикл при устаревшей cookie.
- **Состояние слота scrypt на уровне модуля** (как `passwordCheckGate.ts:7-8`): запрещено ARCH-REVIEW находкой 1, состояние в фабрике.
- **Продление в layout**: Server Component не ставит cookie (Pitfall 2).
- **Копировать `ui/command`, `ui/breadcrumb`, `ui/tabs`, `ui/badge`, `ui/sheet`, `ui/separator`, `ui/collapsible`** из vault: Radix (UI-SPEC, проверено грепом).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Хэш пароля | свой PBKDF, bcrypt/argon2 (нативные пакеты) | `node:crypto.scrypt` с профилем из ielts (D-04) | Совместимость хэшей с фазой 26; без зависимостей |
| Сравнение секретов | `===` | `timingSafeEqual` на равных по длине буферах (длина фиксирована `HASH_PATTERN`) | Время ответа |
| Cookie | ручная сборка `Set-Cookie` | `setCookie`/`getCookie` из `hono/cookie` | Проверка `__Host-` встроена |
| Валидация тел | ручные `typeof` | `zod` 4 (в api и contracts) | Уже зависимость |
| Номера уникальных нарушений | разбор текста ошибки | код `23505` + `constraint` по цепочке `cause` | Drizzle оборачивает ошибку драйвера (`DrizzleQueryError`) |
| Фильтрация палитры | свой `includes` + свой список | `Autocomplete` из Base UI с `inline open` | Клавиатура, `aria`, подсветка уже есть |
| Тема | свой `useEffect` с `localStorage` | `next-themes` | Скрипт до гидрации против вспышки |
| Очистка | cron | интервал-ресурс под `lifecycle.ts` | Остановка по `SIGTERM` (INFRA-06) |

**Key insight:** вся «хитрость» входа в порядке шагов и в инвариантах базы; код каждого шага тривиален, а ошибки появляются на стыках (счётчик до проверки пароля, эпоха сессии, пул соединений).

## Common Pitfalls

### Pitfall 1: У браузера в `next dev` нет маршрута `/api/*` к api (блокирует план web и входа)
**What goes wrong:** клиентский `fetch('/api/auth/sign-in')` на `localhost:3000` возвращает 404 от Next; прямая отправка на отдельный адрес api ломает `__Host-` (cookie без `Domain`, чужой хост её не получит) и требует CORS.
**Why it happens:** в проде `/api/*` срезает Caddy (`Caddyfile:43`); в разработке Caddy нет. D-07 фазы 17 и проверка 17-02 запрещают в web `route.ts` с монтированием api и (в проверке 17-02) `rewrites`; `portless` даёт только имена хостов: «Replace port numbers with stable, named .localhost URLs» `[VERIFIED: node_modules/portless/README.md]`.
**How to avoid:** решение за владельцем (Open Question Q1). Варианты: (A) локальный Caddy с теми же маршрутами (`caddy` локально не установлен — шаг установки в окружение разработчика, подходит под D-07 без исключений); (B) `rewrites` только при `NODE_ENV=development` и заданной `API_DEV_PROXY_URL` в `apps/web/next.config.ts` — отклонение от буквы проверки 17-02, требует явного решения владельца и сужения проверки.
**Warning signs:** 404 на `/api/auth/*` из браузера; форма входа «зависает».

### Pitfall 2: Продлению сессии негде жить
**What goes wrong:** эталон продлевает в `proxy.ts` (`ielts/src/proxy.ts:73-90`) вместе с cookie-подсказкой `__Host-ielts_renew`. D-02 оставляет dv-lab `proxy.ts` только форму cookie, а Server Component (layout) cookie поставить не может, поэтому `Set-Cookie` из серверного вызова `GET /auth/me` теряется.
**How to avoid:** `GET /auth/me` возвращает `renewDue: boolean` (истечение раньше `now()+29 суток`, `SESSION_RENEW_BELOW_SECONDS`); layout передаёт флаг клиентскому компоненту `SessionRenewal`, который при `due` один раз делает `fetch('/api/auth/renew', { method: 'POST' })`; ответ api перевыставляет cookie (`maxAge` 30 суток) и продлевает `expires_at`. Cookie-подсказка не нужна. Это решение планировщика (Claude's discretion «маршруты auth»).
**Warning signs:** сессия учителя обрывается ровно через 30 суток после входа несмотря на ежедневное использование.

### Pitfall 3: `onError` и исключения HTTPException
**What goes wrong:** любое `HTTPException` (400 от `validator`, 403 от `csrf`) превращается в 500 `internal_error` `[VERIFIED: app.ts:45-48]`.
**How to avoid:** ветка `instanceof HTTPException` в `onError`; не использовать `validator`, а разбирать вручную; тест на статус.

### Pitfall 4: Origin строится не из запроса
**What goes wrong:** `new URL(c.req.url).origin` за Caddy равен `http://dv-lab.dev` (схема `http`, Pattern 4), проверка Origin отклоняет все настоящие запросы.
**How to avoid:** сравнивать с `deps.appOrigin` (`APP_ORIGIN`, уже проверяется `loadConfig` как origin без пути `[VERIFIED: apps/api/src/config.ts:4-11]`). В dev значение `http://localhost:3000` (`.env.example`); при `portless` оно должно совпасть с адресом браузера.

### Pitfall 5: IP клиента за Docker и Caddy
**What goes wrong:** для IPv6-клиентов Docker userland-proxy может показать Caddy адрес шлюза; тогда пара «логин + IP» превращается в «логин + шлюз» для всех, а пять чужих неудач блокируют учителя `[ASSUMED]` — это открытый вопрос 3 исследования 17 (`17-RESEARCH.md`, Pitfall 8 и A5), результат проверки Server guy при первой выкатке (17-13).
**How to avoid:** до фазы 18 в проде посмотреть `remote_ip` IPv6-запроса в журнале Caddy; закладывать запасной выход: потолок на логин 20 (D-09) остаётся, а блокировку учителя можно снять строкой `delete from sign_in_throttles` под ролью миграций (добавить в RUNBOOK). Тесты: заголовок `X-Forwarded-For` передаётся явно; в `app.request()` нет `env`, `getConnInfo` бросает — оборачивать.

### Pitfall 6: Пул и поток scrypt (D-20)
**What goes wrong:** бесконечные попытки на один логин держат соединения в `FOR UPDATE`, а scrypt в `libuv` занимает потоки (по умолчанию 4); `getaddrinfo` для нового соединения пула тоже идёт через те же потоки.
**How to avoid:** допуск до базы (Pattern 2), слот scrypt ≤ 2 (`passwordCheckGate.ts:4`), очередь ограничена; блокировка по ключу логина дополнительно можно сериализовать в процессе (одна карта промисов), база остаётся единственным авторитетом.

### Pitfall 7: scrypt и память
**What goes wrong:** без явного `maxmem` вычисление с N=2^15, r=8 падает. Проба на Node v24.17.0 (2026-10-09): `default maxmem: FAIL ERR_CRYPTO_INVALID_SCRYPT_PARAMS Invalid scrypt params: error:030000AC:digital envelope routines::memory limit exceeded`; при `maxmem` 64 MiB — `ok 117 ms`, при 33 MiB — `ok 112 ms` `[VERIFIED: scratchpad scrypt-probe.mjs]`. 32 MiB на хэш × 2 параллельно = 64 MiB пика, контейнер api ограничен `mem_limit: 512m` `[VERIFIED: compose.yaml:56]`.
**How to avoid:** `maxmem: 64 MiB` в обоих вызовах; пароль ограничен 1024 символами (как `actions.ts:30`), иначе NFKC и scrypt на мегабайтных паролях — вектор DoS (Caddy ограничивает тело 1 МБ, `Caddyfile:27-29`). Неизвестный логин и деактивированный аккаунт идут через `verifyDummyPassword`; ошибка первого хэша не должна кешироваться (`passwords.ts:56-59`).

### Pitfall 8: Смена пароля убивает текущую сессию
**What goes wrong:** деактивация увеличивает `auth_epoch` и удаляет сессии (`revokeAccountSessions`); при смене пароля тот же приём разлогинит и текущую сессию: чтение требует `accounts.auth_epoch = sessions.auth_epoch`.
**How to avoid:** в одной транзакции: `select … for update` строку аккаунта, сверить, что `password_hash` не изменился с проверки (compare-and-set), обновить хэш, `auth_epoch + 1`, удалить все сессии аккаунта, вставить **новую** сессию (новый токен, новая эпоха) и поставить новую cookie. Хэш нового пароля считать до транзакции. Проверка старого пароля идёт через модуль входа (засчитывается как попытка).
**Warning signs:** после смены пароля следующий запрос возвращает 401.

### Pitfall 9: Гигиена копии из vault
**What goes wrong:** в 37 файлах 1 932 строки комментариев (18 %), что нарушает правило «без комментариев»; 8 русских строк; пакет `cn`; классы вне шкалы 4 px; vault использует двойные кавычки и точки с запятой, а `.prettierrc.json` dv-lab требует табы, одинарные кавычки, без `;`, ширину 120 и сортировку импортов; `knip` ругнётся на неиспользуемые экспорты (в старом `knip.json` для `components/ui/**` уже стоял `ignore` `[VERIFIED: knip.json, workspace apps/web]`); `eslint-config-next` без правил `@shadcn/lint`, но в vault для `src/components/ui/**` отключён `@typescript-eslint/no-unused-vars` `[VERIFIED: vault eslint.config.mjs]`; в `apps/web/tsconfig.json` нет `paths` `[VERIFIED: apps/web/tsconfig.json]`, а копия импортирует `@/…`; `tsconfig.base.json` включает `erasableSyntaxOnly` и `verbatimModuleSyntax`.
**How to avoid:** копировать скриптом: TypeScript `createPrinter({ removeComments: true })` по каждому файлу, затем `prettier --write`; русские строки (список ниже) заменить вручную; в `apps/web/tsconfig.json` добавить `"paths": { "@/*": ["./*"] }` (Next читает `paths` из tsconfig, это не вторжение в исходники api, но противоречит буквальному «нет `paths`» в проверке 17-02 — одной строкой записать в план); `eslint.config.mjs`: `no-restricted-imports` на `radix-ui`, `@radix-ui/*`, `cmdk`, и `no-unused-vars` выключить для `components/ui/**`, `components/sidebar-app/**`; `knip.json` — `ignore` для `components/ui/**`, `components/sidebar-app/**`, `hooks/**`, `lib/**` копии. Запустить `yarn workspace @dv-lab/web typecheck && lint && build` сразу после копии, до экранов.

Русские строки в копии `[VERIFIED: scratchpad audit.mjs; vault design-lab src/…]`:
`components/ui/sidebar.tsx:127` «Боковая панель» → `Sidebar`; `components/ui/sidebar-core.tsx:747` «Показать боковую панель» → `Show sidebar`; `:943` «Развернуть/Свернуть боковую панель» → `Expand sidebar`/`Collapse sidebar`; `:954` «Переключить боковую панель» → `Toggle sidebar`; `:1080` «Потяните … чтобы изменить ширину» → `Drag to resize`; `:1084` «Нажмите … чтобы свернуть» → `Click to collapse`; `:1099` «Изменить ширину или свернуть боковую панель» → `Resize or collapse the sidebar`; `components/ui/dialog.tsx:235` «Закрыть» → `Close`.

### Pitfall 10: next-themes и гидрация
**What goes wrong:** `ThemeProvider` вставляет синхронный `<script>`; на Next 16 и React 19 в консоли появляется «Encountered a script tag while rendering React component» при работающей теме (next-themes 0.4.6, issues #385 и #387 в репозитории next-themes, воспроизведено на Next 16.2) `[CITED: github.com/pacocoursey/next-themes/issues/385]`. Критерий 17-02 «чистая консоль» может сработать.
**How to avoid:** `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange` на `ThemeProvider`, `suppressHydrationWarning` на `<html>`; значок темы переключать CSS-классами `dark:hidden` / `hidden dark:block` (как в vault `theme-toggle.tsx:19-20`), `aria-pressed` ставить только после монтирования (UI-SPEC). Если предупреждение остаётся — зафиксировать в плане как известное и проверить в браузере; замена пакета только по решению владельца `[ASSUMED]` на 16.4 и React 19.3 (источник — отчёты о 16.2).

### Pitfall 11: Base UI и Tailwind 4
**What goes wrong:** всплывающие слои (Dialog, Menu, Tooltip, Autocomplete) уходят под страницу; на iOS 26 Safari подложка диалога с `position: fixed` ведёт себя неверно.
**How to avoid:** по документации Base UI: обёртка приложения с `isolation: isolate` и `body { position: relative }` для iOS 26+ `[CITED: base-ui.com/react/overview/quick-start]`; в vault этого нет `[VERIFIED: grep isolation в globals.css, layout.tsx]` — добавить в `globals.css` и в корневой layout. `@custom-variant dark (&:is(.dark *))` обязателен для классов `dark:`.

### Pitfall 12: Next — динамика, перенаправления, cookies
**What goes wrong:** `cookies()` асинхронный (Next 16); `redirect()` из layout не защищает страницы рядом (layout и page рендерятся параллельно); `NextResponse.redirect(new URL('/login', request.url))` за прокси даёт неверный хост; `HOSTNAME=0.0.0.0` в образе web.
**How to avoid:** DAL на `cache()`, проверка роли и в layout, и в каждой странице (`await requireTeacher()`), относительный `Location`; в `turbo.json` добавить в `globalPassThroughEnv` только то, что читают задачи сборки/тестов (для `API_INTERNAL_URL` сборка не нужна — читается при запросе).

### Pitfall 13: Тестовая инфраструктура (D-19)
**What goes wrong:** `apps/api/vitest.config.ts` не имеет `fileParallelism: false` и `globalSetup` (в `packages/db/vitest.config.ts:13-14` они есть); `@dv-lab/db` не имеет скрипта `build`, поэтому `turbo run test` пускает тесты db и api одновременно на одной `dvlab_test`; запуск собранного процесса уже есть в `apps/api/test/shutdown.test.ts` и его хелпер `start(port)` приватный.
**How to avoid:** в `apps/api/vitest.config.ts` — `fileParallelism: false` и `globalSetup` (миграции под `dvlab_migrator`, как `packages/db/test/global-setup.ts`); корневой `test`: `turbo run test --concurrency=1`; `packages/db/src/testing.ts` (подпуть `@dv-lab/db/testing`): `resetTables()` берёт имена из `pg_tables where schemaname = 'public'`, исключая схему `drizzle`, и выполняет `truncate … restart identity cascade` под `dvlab_migrator` — в тестах нет имён таблиц; `apps/api/test/support/server.ts`: `startApi({ port, env }) → { url, stop(), exited }`, вынесенный из `shutdown.test.ts`. Тесты бьют по `dist/server.mjs` (нужен `yarn workspace @dv-lab/api build`; `test` в Turbo уже зависит от `build`).

### Pitfall 14: Роли и IDOR
**What goes wrong:** деактивация находит строку по `id` без проверки роли и деактивирует учителя; список учеников отдаёт хэш и эпоху.
**How to avoid:** все запросы `where role = 'student'`; DTO без `passwordHash`, `authEpoch`; `requireRole('teacher')` на группе `/students`; ученик получает 403 на `/students`.

### Pitfall 15: Утечки паролей в журналах
**What goes wrong:** сгенерированный пароль возвращается в теле ответа создания (`201`), pino пишет только строку доступа, но `logger.error({ err })` при ошибке парсинга может вынести тело.
**How to avoid:** не логировать тела; `redact` в `createLogger` покрывает только `req.headers.*` `[VERIFIED: request-context.ts:18]`; пароль в ответе — единожды, в поле `generatedPassword`, никогда в `GET /students`.

### Pitfall 16: `/ws` остаётся публичным эхом
`/ws` (17-09) принимает любого с верным `Origin`, не проверяет сессию (`app.ts:33-44`), и 17-09 запрещает на нём что-либо кроме эха до появления входа. После фазы 18 вход есть; пока данных в `/ws` нет, оставить как есть, при появлении данных (фаза 22) потребовать сессию.

### Pitfall 17: Clickjacking и заголовки
В `Caddyfile` заголовки: `-Server`, HSTS, `nosniff`, `Referrer-Policy` `[VERIFIED: Caddyfile:20-25]`; `X-Frame-Options`/`frame-ancestors` нет, форма входа встраиваема. Предложение: `X-Frame-Options "DENY"` в том же блоке `header` (правка файла фазы 17, одной строкой, `caddy validate` в CI 17-10).

## Рекомендуемая нарезка (подсказка планировщику, решение его)

| Волна | План | Что внутри | Зависит от |
|-------|------|------------|-----------|
| 0 | Спайки | (a) решение Q1 (маршрут `/api` в dev), (b) копия 37 файлов в `apps/web` + `typecheck/lint/build` с `paths` `@/*`, (c) `Autocomplete` в `Dialog` с фильтром по `label`, (d) `yarn dev` в связке с `portless` | — |
| 1 | `packages/contracts` + схема и миграция `accounts` | D-18; один `drizzle-kit generate --name accounts`; правка проверки 17-10 уже внесена в 18-ARCH-REVIEW | завершение фазы 17 |
| 1 | Поддержка тестов БД (D-19) | `@dv-lab/db/testing`, `apps/api` vitest `fileParallelism: false` + `globalSetup`, `test/support/server.ts`, `--concurrency=1` | схема |
| 2 | Модуль входа (D-17, D-20) | passwords, sessions, throttle, admission, sign-in, housekeeping + их тесты | волна 1 |
| 2 | web-основа | зависимости (один checkpoint), токены `globals.css`, чистка копии, `ThemeProvider`, ESLint/knip/tsconfig | волна 0 |
| 3 | Маршруты api | `/auth/*`, `/students/*`, `sameOrigin`, `onError`, `errorBody(extra)`, bootstrap + tsdown entry + сервис `bootstrap` + `API_INTERNAL_URL` в compose | волна 2 |
| 3 | Оболочка и вход в web | `proxy.ts`, DAL, `(app)/layout`, сайдбар, топбар, палитра, `/login`, страницы-заглушки, `SessionRenewal` | волна 2 (web) + контракт |
| 4 | Students и диалоги | таблица, создание, показ пароля один раз, деактивация, смена пароля, ученик-страница | волна 3 |
| 5 | Проверка | перезапуск api, браузерные проверки в обеих темах, строка RUNBOOK про bootstrap, снятие блокировки | все |

## Code Examples

Значения в примерах взяты из блока «Правила входа» (дословно) или из прочитанных файлов; всё остальное — предложение. Без комментариев.

### Контракт web и api (`packages/contracts/src/index.ts`)
```typescript
import { z } from 'zod'

export const SESSION_COOKIE = '__Host-dvlab_session'
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
export const SESSION_RENEW_BELOW_SECONDS = 29 * 24 * 60 * 60
export const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
export const STUDENT_LOGIN_PATTERN = /^[a-z0-9._-]{3,32}$/
export const LOGIN_MAX_LENGTH = 254
export const DISPLAY_NAME_MAX_LENGTH = 80
export const MANUAL_PASSWORD_MIN_LENGTH = 10
export const MANUAL_PASSWORD_MAX_LENGTH = 128

export const signInRequest = z.object({
	login: z.string().trim().toLowerCase().min(1).max(LOGIN_MAX_LENGTH),
	password: z.string().min(1).max(1024),
})

export type Role = 'teacher' | 'student'
export type MeResponse = {
	account: { id: string; login: string; displayName: string; role: Role }
	renewDue: boolean
}
```

### Origin и IP (`apps/api/src/auth/middleware.ts`)
```typescript
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context, MiddlewareHandler } from 'hono'
import { isIP } from 'node:net'

import { errorBody } from '../request-context.ts'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export const sameOrigin =
	(appOrigin: string): MiddlewareHandler =>
	async (c, next) => {
		if (SAFE_METHODS.has(c.req.method)) return next()
		const origin = c.req.header('origin')
		const proven = origin !== undefined ? origin === appOrigin : c.req.header('sec-fetch-site') === 'same-origin'
		if (!proven) return c.json(errorBody('forbidden_origin', 'Forbidden'), 403)
		await next()
	}

export function clientIp(c: Context, production: boolean): string | null {
	const forwarded = c.req.header('x-forwarded-for')
	if (forwarded) {
		const nearest = forwarded.split(',').at(-1)?.trim() ?? ''
		return isIP(nearest) === 0 ? null : nearest
	}
	if (production) return null
	try {
		return getConnInfo(c).remote.address ?? null
	} catch {
		return null
	}
}
```

### Ошибка и cookie (фрагменты `app.ts` и маршрута входа)
```typescript
import { HTTPException } from 'hono/http-exception'
import { setCookie } from 'hono/cookie'

app.onError((err, c) => {
	if (err instanceof HTTPException) {
		return c.json(errorBody(err.status === 403 ? 'forbidden' : 'invalid_request', err.message), err.status)
	}
	deps.logger.error({ err }, 'request failed')
	return c.json(errorBody('internal_error', 'Internal Server Error'), 500)
})

const sessionCookie = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' } as const

setCookie(c, SESSION_COOKIE, token, { ...sessionCookie, maxAge: SESSION_TTL_SECONDS })
setCookie(c, SESSION_COOKIE, '', { ...sessionCookie, maxAge: 0 })
```

### Смена пароля в одной транзакции (идея, Drizzle v1 как в эталоне)
```typescript
const next = await hashPassword(newPassword)
await db.transaction(async (tx) => {
	const [row] = await tx
		.select({ passwordHash: accounts.passwordHash, authEpoch: accounts.authEpoch })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.for('update')
	if (!row || row.passwordHash !== verifiedHash) throw new PasswordChangeConflict()
	const epoch = row.authEpoch + 1
	await tx.update(accounts).set({ passwordHash: next, authEpoch: epoch, updatedAt: sql`now()` }).where(eq(accounts.id, accountId))
	await tx.delete(sessions).where(eq(sessions.accountId, accountId))
	await tx.insert(sessions).values({
		tokenHash: hashSessionToken(token),
		accountId,
		authEpoch: epoch,
		expiresAt: sql`now() + make_interval(secs => ${SESSION_TTL_SECONDS})`,
	})
})
```

### proxy.ts (форма cookie, относительный редирект)
```typescript
import { SESSION_COOKIE, SESSION_TOKEN_PATTERN } from '@dv-lab/contracts'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
	const token = request.cookies.get(SESSION_COOKIE)?.value
	if (token !== undefined && SESSION_TOKEN_PATTERN.test(token)) return NextResponse.next()
	return new Response(null, { status: 307, headers: { location: '/login' } })
}

export const config = {
	matcher: ['/((?!api|login|_next/static|_next/image|favicon.ico|robots.txt).*)'],
}
```

### Серверный DAL и ветвление по роли (`apps/web/lib/session.ts`, `app/(app)/layout.tsx`)
```typescript
import { SESSION_COOKIE, type MeResponse } from '@dv-lab/contracts'
import { cookies } from 'next/headers'
import { cache } from 'react'

export const getMe = cache(async (): Promise<MeResponse | null> => {
	const token = (await cookies()).get(SESSION_COOKIE)?.value
	if (!token) return null
	const response = await fetch(`${process.env.API_INTERNAL_URL}/auth/me`, {
		headers: { cookie: `${SESSION_COOKIE}=${token}` },
		cache: 'no-store',
	})
	if (response.status === 401) return null
	if (!response.ok) throw new Error('Session lookup failed')
	return (await response.json()) as MeResponse
})
```
```tsx
export default async function AppLayout({ children }: { children: ReactNode }) {
	const me = await getMe()
	if (!me) redirect('/login?reason=expired')
	if (me.account.role === 'student') return <StudentLanding account={me.account} />
	return <Shell account={me.account} renewDue={me.renewDue}>{children}</Shell>
}
```

### Палитра (Base UI Autocomplete внутри копии `Dialog`)
```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
	<DialogContent size="lg" position="top" showCloseButton={false} className="overflow-hidden p-0">
		<Autocomplete.Root
			open
			inline
			items={groups}
			defaultValue={initial}
			autoHighlight="always"
			keepHighlight
		>
			<Autocomplete.InputGroup>
				<Autocomplete.Input aria-label="Search sections and actions" placeholder="Search sections and actions" />
			</Autocomplete.InputGroup>
			<Autocomplete.Empty>No matching sections or actions</Autocomplete.Empty>
			<Autocomplete.List>
				{(group: Group) => (
					<Autocomplete.Group key={group.value} items={group.items}>
						<Autocomplete.GroupLabel>{group.value}</Autocomplete.GroupLabel>
						<Autocomplete.Collection>
							{(item: Item) => (
								<Autocomplete.Item key={item.value} value={item} onClick={() => run(item.value)}>
									{item.label}
								</Autocomplete.Item>
							)}
						</Autocomplete.Collection>
					</Autocomplete.Group>
				)}
			</Autocomplete.List>
		</Autocomplete.Root>
	</DialogContent>
</Dialog>
```
`DialogContent` поддерживает `size: "sm" | "lg" | "xl"`, `showCloseButton`, `position: "center" | "top"` `[VERIFIED: vault design-lab src/components/ui/dialog.tsx:104-127]`. Структура `Autocomplete.*` — по документации пакета (раздел «Command palette»), группы `{ value, items }`, элементы `{ value, label }`.

### tsdown и compose для bootstrap
```typescript
entry: { migrate: 'src/migrate.ts', server: 'src/server.ts', 'bootstrap-teacher': 'src/bootstrap-teacher.ts' },
```
```yaml
  bootstrap:
    image: ghcr.io/kdvornichenko/dv-lab-api:${APP_TAG:?}
    profiles: ['tools']
    restart: 'no'
    logging: *logging
    entrypoint: ['node', 'apps/api/dist/bootstrap-teacher.mjs']
    environment:
      DATABASE_URL: postgresql://dvlab_app:${APP_PASSWORD:?}@db:5432/dvlab
    depends_on:
      db:
        condition: service_healthy
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts`, Node.js runtime по умолчанию | Next 16.0.0 | Файл рядом с `app/`, функция `proxy`; Edge-ограничений нет `[CITED: nextjs.org proxy docs, Version history]` |
| `cmdk` для палитры | Base UI `Autocomplete` с `inline open` внутри `Dialog` | пример «Command palette» в документации Base UI 1.8.0 | Нет Radix даже транзитивно |
| `transpilePackages` для workspace-пакетов | Turbopack (и webpack App Router) транспилируют workspace-пакеты сами | Next 16 | «Turbopack transpiles workspace packages … automatically under both routers» `[CITED: nextjs.org transpilePackages docs]`, проба: сборка `@probe/contracts` с импортами `./identity.ts` и `zod` прошла `[VERIFIED: scratchpad probe, next build 16.4.0 Turbopack]` |
| Server action + `cookies()` | cookie выставляет отдельный api | D-01 | Нужны Origin-проверка и Caddy-маршрут |
| `@base-ui-components/react` | `@base-ui/react` | переименование | Импорты `@base-ui/react/...` `[VERIFIED: node_modules/@base-ui/react/docs/react/components/autocomplete.md:9]` |

**Deprecated/outdated:** `next/font/google` в сборке (запрещено фазой 17); пакет `cn` (заменяется `@/lib/utils`); `tw-animate-css` без потребителей.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Docker userland-proxy показывает Caddy реальный IPv6-адрес клиента (иначе лимит схлопывается в «логин + шлюз») | Pitfall 5 | Блокировка по пяти чужим неудачам; решение Server guy до выкатки |
| A2 | `Secure`-cookie `__Host-` принимается на `http://localhost` в Chromium и Firefox, но не в Safari | Pitfall 1 / dev | Разработка в Safari не войдёт; смотреть в Chromium |
| A3 | Next читает `.env*` из каталога `apps/web`, а не из корня монорепозитория | Pattern 5 | `API_INTERNAL_URL` не виден в dev; положить в `apps/web/.env.development` |
| A4 | `fetch` из undici в тестах позволяет задать заголовок `Origin` | Validation | Иначе тесты ходят через `node:http` или `app.request()` |
| A5 | `pg_advisory_xact_lock` доступна `dvlab_app` без грантов | Pattern 3 | Bootstrap падает; проверка тестом под ролью приложения |
| A6 | Журнал контейнера `docker compose run --rm` с драйвером `local` исчезает вместе с контейнером | Pattern 7 | Сгенерированный пароль остаётся в журнале; проверить владельцу |
| A7 | Относительный `Location: /login` из `proxy.ts` корректно переживает Caddy и `standalone` | Pattern 5 | Редирект на неверный хост; запасной вариант — абсолютный URL от `APP_ORIGIN` |
| A8 | Консольное предупреждение next-themes о теге `script` воспроизводится на Next 16.4 и React 19.3 (источник — отчёты на Next 16.2) | Pitfall 10 | Шум в консоли; решение владельца |
| A9 | Пример «Command palette» из документации Base UI фильтрует `{ value, label }` без `itemToStringValue`; в `AutocompleteRoot.d.mts:37` это свойство входит в список `Omit` базовых типов и доступно, только если интерфейс объявляет его сам (тело файла прочитано до строки ~100) | Pattern 6 | Спайк волны 0: взять пример из документации дословно, `itemToStringValue` добавлять только если фильтр по подписи не работает |
| A10 | `portless dv-lab turbo run dev` выдаёт обоим приложениям один `PORT` (корневой скрипт `dev` не проверялся) | Open Q10 | Dev-цикл не работает; решить в волне 0 |
| A11 | Сброс блокировки учителя командой `delete from sign_in_throttles` под ролью миграций достаточен | Pitfall 5 | Нужен другой способ разблокировки |
| A12 | ESLint 10 + `eslint-config-next` 16.4 не выдают ошибок на скопированных файлах после снятия комментариев и отключения `no-unused-vars` для `components/ui/**` | Pitfall 9 | Дополнительные правки копии |
| A13 | `knip` не падает на копии при `ignore` для `components/ui/**`, `components/sidebar-app/**`, `hooks/**`, `lib/**` | Pitfall 9 | Правка `knip.json` |

## Open Questions

1. **Как браузер достаёт `/api/*` в локальной разработке? (блокирует план web и входа)**
   - What we know: в проде маршрут держит Caddy; D-07 фазы 17 и проверка 17-02 запрещают `rewrites` и `route.ts` в web; `portless` только именует хосты; `caddy` локально нет.
   - What's unclear: что допустимо для dev.
   - Recommendation: либо (A) локальный Caddy с теми же маршрутами (установка `brew install caddy`, dev-Caddyfile в `deploy/`), либо (B) `rewrites` в `next.config.ts` только при `NODE_ENV=development` с явной записью отклонения. Не выбирать молча; вынести владельцу одной фразой.
2. **UI-SPEC (draft, без согласования с владельцем) расширяет объём фазы** экраном Students, диалогами и палитрой. Объём принимается как контракт; подтверждение владельца желательно до планирования.
3. **UI-SPEC утверждает, что строки сайдбара «уже английские».** Это неверно: в `sidebar.tsx:127`, `sidebar-core.tsx:747,943,954,1080,1084,1099`, `dialog.tsx:235` русский текст (Pitfall 9 даёт перевод). Исправить UI-SPEC или учесть в плане «чистка копии».
4. **`paths` `@/*` в `apps/web/tsconfig.json`** нужен копии (импорты `@/…`), но 17-02 проверял «нет paths». Рекомендация: разрешить `@/*` → `./*`, сузить проверку до «нет путей в исходники api и db».
5. **Продление сессии**: принять схему `renewDue` + клиентский `POST /auth/renew` (Pitfall 2) или другую; решение планировщика.
6. **Реальный IP IPv6-клиента** (A1): ждать результата 17-13 или заложить способ разблокировки в RUNBOOK.
7. **Список студентов без пагинации** (UI-SPEC «unresolved»): принять как допущение до фазы 19.
8. **`tw-animate-css`**: UI-SPEC включает в «другие пакеты», потребителей нет; не ставить, пока `yarn build` и браузер не покажут нужду.
9. **Dev-цикл `yarn dev` через `portless`** не проверялся (A10); входит в спайк волны 0.
10. **Совместимость хэшей с ielts (фаза 26)**: формат строки хэша и `accounts.login`/`role`/`status` повторяются буквально; поле `note` и `target_band_halves` фаза 26 добавит миграцией.
11. **`/ws`** остаётся публичным эхом (Pitfall 16); решить отдельно в фазе 22.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | всё | ✓ | v24.17.0 | — |
| Yarn | установка | ✓ | 4.18.1 (репозиторий) | — |
| PostgreSQL 18, база `dvlab_test` (домашний сервер) | DB-тесты | ✓ (по 17-03: PG 18.6, роли `dvlab_app`, `dvlab_migrator`) | 18.6 | — |
| `psql` | диагностика | ✓ | `/opt/homebrew/bin/psql` | — |
| `.env`, `.env.test` в worktree | тесты | ✓ (файлы есть, содержимое не читалось) | — | — |
| Docker | образы, `compose run bootstrap` | ✗ | — | CI 17-10 и владелец на сервере |
| Caddy | dev-маршрут `/api` (вариант A), `caddy validate` | ✗ | — | `brew install caddy` или вариант B |
| Playwright | e2e | ✗ | — | не вводить; браузерные проверки встроенным браузером и тесты `vitest` |
| Встроенный браузер агента | проверка UI (правило владельца) | не проверялось | — | описать ручной чек-лист владельцу |

**Missing dependencies with no fallback:** нет.
**Missing dependencies with fallback:** Docker (сервер), Caddy (dev-маршрут), Playwright.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.3 (api, db — уже; web — добавить, версии те же) |
| Config file | `apps/api/vitest.config.ts` (Wave 0: добавить `fileParallelism: false`, `globalSetup`), `packages/db/vitest.config.ts`, `apps/web/vitest.config.ts` (Wave 0) |
| Quick run command | `yarn workspace @dv-lab/api test test/auth/<file>.test.ts` |
| Full suite command | `yarn workspace @dv-lab/api build && yarn turbo run test --concurrency=1` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACCT-01 | Учитель входит по email и паролю, cookie с атрибутами `__Host-dvlab_session; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`, без `Domain` | integration (HTTP через `createApp`, настоящий Postgres) | `yarn workspace @dv-lab/api test test/auth/routes.test.ts` | ❌ Wave 0 |
| ACCT-01 | Второй активный учитель отклоняется базой (`23505`, `accounts_one_active_teacher_uq`); после деактивации первого вставка проходит | integration (DB) | `… test test/auth/accounts.test.ts` | ❌ Wave 0 |
| ACCT-02 | Создание ученика (сгенерированный пароль 12 символов из алфавита, свой 10-128), занятый логин → `login_taken`, ученик входит | integration | `… test test/auth/accounts.test.ts` | ❌ Wave 0 |
| ACCT-02 | Деактивация: статус, `auth_epoch + 1`, удаление сессий в одной транзакции, старая cookie → 401, учитель деактивации не поддаётся | integration | `… test test/auth/accounts.test.ts` | ❌ Wave 0 |
| ACCT-03 | В таблице `sessions` лежит только sha256-хэш (64 hex), сырого токена нет; `CHECK` отвергает не-hex | integration | `… test test/auth/sessions.test.ts` | ❌ Wave 0 |
| ACCT-03 | Сессия переживает перезапуск api (два запуска `dist/server.mjs`, SIGTERM между ними, тот же cookie → `GET /auth/me` 200) | integration, процесс | `… test test/auth/restart.test.ts` | ❌ Wave 0 |
| ACCT-03 | Пять неудач на пару закрывают пару на 900 с, шестая (даже верная) → `locked`; 20 на логин со всех IP; IPv6 /64; неизвестный логин считается; успех сбрасывает; окно истекает (старение строки под ролью миграций) | integration (DB) | `… test test/auth/throttle.test.ts` | ❌ Wave 0 |
| ACCT-03 | 20 параллельных попыток одного логина допускаются ровно в пределах порога (гонка `FOR UPDATE`); 50 попыток + опрос `/healthz` — все 200 (D-20) | integration | `… test test/auth/sign-in.test.ts` | ❌ Wave 0 |
| ACCT-05 | Скрипт первого учителя: создаёт, печатает пароль один раз, повторный запуск → код 3, `--password-stdin`, роль приложения | integration, процесс (`dist/bootstrap-teacher.mjs`) | `… test test/auth/bootstrap-teacher.test.ts` | ❌ Wave 0 |
| ACCT-05 | Смена пароля: неверный старый → ошибка и счётчик, успех → остальные сессии удалены, текущая заменена новой cookie и жива, старый пароль не входит | integration | `… test test/auth/routes.test.ts` | ❌ Wave 0 |
| ACCT-01..05 | `sameOrigin`: POST без/с чужим Origin → 403 `forbidden_origin`; JSON-ошибки идут конвертом; `HTTPException` не превращается в 500 | integration | `… test test/auth/routes.test.ts` | ❌ Wave 0 |
| SHELL-01 | `proxy.ts`: нет cookie → 307 `/login`, форма токена, `matcher` исключает `api`, `login`, статику | unit (web) | `yarn workspace @dv-lab/web test` | ❌ Wave 0 |
| SHELL-01 | Разделы, поле поиска открывает палитру (⌘K, клик, первый символ), навигация, выход | manual (браузер) | чек-лист ниже | ручной |
| SHELL-02 | В `apps/web` (кроме `.next`, `node_modules`) нет кириллицы | contract (web) | `yarn workspace @dv-lab/web test test/english-only.test.ts` | ❌ Wave 0 |
| SHELL-02 | Нет `radix-ui`, `@radix-ui/*`, `cmdk` в `package.json` и импортах `apps/web` | contract (web) + ESLint `no-restricted-imports` | `yarn workspace @dv-lab/web test test/radix-free.test.ts`; `yarn workspace @dv-lab/web lint` | ❌ Wave 0 |
| SHELL-02 | `typecheck`, `lint`, `build` web проходят с копией | build | `yarn workspace @dv-lab/web typecheck && yarn workspace @dv-lab/web lint && yarn workspace @dv-lab/web build` | существуют |
| SHELL-02 | Светлая и тёмная тема, нет вспышки при перезагрузке в тёмной, палитра и диалоги читаемы, ширина 320 и 1280 | manual (браузер) | чек-лист ниже | ручной |

Ручной чек-лист в браузере (после автоматических): вход учителем; редирект анонима на `/login`; четыре раздела с «Nothing here yet»; поле поиска и ⌘K открывают палитру, Enter идёт в раздел, пункты темы и Sign out работают; переключатель темы, перезагрузка в тёмной теме без белой вспышки; консоль без ошибок (учесть A8); создание ученика → показ пароля один раз → вход учеником в другом окне → деактивация → ученик получает `/login?reason=expired`; смена пароля, другое окно учителя разлогинено; 320 px без горизонтальной прокрутки страницы; перед «готово» — требование владельца о проверке UI в браузере.

### Sampling Rate
- **Per task commit:** тест-файл, который задача трогает (до 30 секунд на файл).
- **Per wave merge:** `yarn workspace @dv-lab/api build && yarn turbo run test --concurrency=1`, затем `typecheck`, `lint`, `knip`.
- **Phase gate:** полный набор зелёный, ручной чек-лист пройден до `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `apps/api/vitest.config.ts` — `fileParallelism: false`, `globalSetup` с миграциями под `dvlab_migrator`
- [ ] `packages/db/src/testing.ts` и подпуть `@dv-lab/db/testing` (`resetTables`, роли приложения и миграций) — D-19
- [ ] `apps/api/test/support/server.ts` — `startApi`, вынесенный из `shutdown.test.ts`, с остановкой и повторным запуском
- [ ] `apps/api/test/auth/{passwords,throttle,sessions,accounts,sign-in,routes,restart,bootstrap-teacher}.test.ts` (юнит-тест `ipBucket` внутри throttle)
- [ ] `apps/web`: `vitest`, `vite`, `vitest.config.ts`, скрипт `test`, `test/{proxy,english-only,radix-free}.test.ts`
- [ ] `turbo.json`/корневой скрипт: `--concurrency=1` для `test`
- [ ] Спайки волны 0: Q1, копия 37 файлов собирается, `Autocomplete` в `Dialog`, `yarn dev`
- [ ] Установка зависимостей: `yarn workspace @dv-lab/web add …` (один checkpoint по diff `yarn.lock`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | scrypt N=2^15 r=8 p=3 (в списке OWASP: «N=2^15 (32 MiB), r=8 (1024 bytes), p=3» `[CITED: cheatsheetseries.owasp.org Password Storage]`), дамми-хэш для неизвестного логина, одно сообщение об ошибке (D-10), ограничение попыток в Postgres |
| V3 Session Management | yes | токен 32 случайных байта, в базе только sha256, `__Host-` cookie `HttpOnly; Secure; SameSite=Lax`, новый токен при каждом входе и при смене пароля, отзыв по эпохе |
| V4 Access Control | yes | `requireSession` + `requireRole('teacher')` в api на группе маршрутов; проверка в каждой странице web (DAL), не только в layout; ученик получает 403 на `/students` |
| V5 Input Validation | yes | zod 4: логин `trim().toLowerCase()`, длины 1-254 и пароль до 1024; шаблоны D-05; CHECK-ограничения в базе |
| V6 Cryptography | yes | только `node:crypto` (`scrypt`, `randomBytes`, `randomInt`, `timingSafeEqual`, `createHash`) |
| V7 Logging | yes | pino, redact `cookie`/`authorization`, тела запросов и пароли не логируются |
| V13 API | yes | единый конверт ошибок, `Cache-Control: no-store` на `/auth/*`, проверка Origin на изменяющих методах |

### Known Threat Patterns for Hono + Next + Postgres

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Подбор паролей / подстановка учётных данных | Spoofing | счётчик до проверки пароля под `FOR UPDATE`, потолок 5 на пару и 20 на логин, слот scrypt |
| Перечисление логинов по ответу или времени | Information disclosure | одно сообщение, дамми-хэш, счётчик для неизвестных логинов |
| Подделка `X-Forwarded-For` | Spoofing | Caddy перезаписывает заголовок, api не опубликован, берётся правое значение |
| CSRF, login CSRF | Tampering | `SameSite=Lax`, проверка `Origin` на всех изменяющих методах, нет CORS |
| Фиксация сессии | Spoofing | новый токен при входе и смене пароля |
| Кража cookie через XSS | Information disclosure | `HttpOnly`, нет чтения cookie клиентом (renew идёт через api), без `dangerouslySetInnerHTML` |
| Исчерпание пула / потоков libuv потоком попыток | Denial of service | допуск ниже `pool.max`, слот scrypt ≤ 2, очередь ограничена, лимит тела 1 МБ в Caddy и пароля 1024 |
| Деактивация учителя или чужой роли (IDOR) | Elevation of privilege | запросы с `role = 'student'`, `requireRole('teacher')` |
| Утечка сгенерированного пароля в журналы | Information disclosure | единственный показ в ответе создания, не логировать тела, `docker compose run --rm` |
| Clickjacking формы входа | Tampering | `X-Frame-Options: DENY` в Caddy (Pitfall 17) |
| Устаревшая сессия после деактивации | Elevation of privilege | `auth_epoch` в чтении сессии и удаление строк |

## Sources

### Primary (HIGH confidence)
- Эталон ielts, прочитан целиком: `src/lib/auth/{passwords,sessions,cookies,throttle,accounts,identity,dal,passwordCheckGate,routeAccess,origin,studentInput}.ts`, `src/app/login/{actions.ts,login-form.tsx,page.tsx}`, `src/lib/db/schema.ts:1-100`, `src/proxy.ts`, `scripts/bootstrap-teacher.mjs`, `drizzle/20261003014350_init_accounts`, `…015125_add_sessions`, `…050837_add_sign_in_throttles`, `package.json` (`/Volumes/T7/personal/ielts`)
- dv-lab worktree: `apps/api/src/{app,config,lifecycle,server,request-context,migrate}.ts`, `apps/api/{package.json,tsdown.config.ts,vitest.config.ts,tsconfig.json}`, `apps/api/test/{migrate,shutdown}.test.ts`, `packages/db/src/{connection,migrate,schema,index}.ts`, `packages/db/{package.json,vitest.config.ts,drizzle.config.ts}`, `packages/db/test/{global-setup,roles}.test.ts`, `packages/db/drizzle/20261009120830_init/migration.sql`, `deploy/{compose.yaml,caddy/Caddyfile,postgres/ensure-db.sql}`, `apps/web/{package.json,tsconfig.json,next.config.ts,app/layout.tsx,app/globals.css,eslint.config.mjs}`, `package.json`, `turbo.json`, `.env.example`, `.prettierrc.json`, `.planning/phases/17-*` (CONTEXT, RESEARCH, SUMMARY 01-06 и 08, PLAN 09/10)
- Установленные пакеты в `node_modules` worktree: `hono@4.13.13` (`helper/cookie`, `utils/cookie`, `middleware/csrf`), `@hono/node-server@2.1.4` (`index.mjs`, `conninfo`), `portless@0.15.7/README.md`
- vault design-lab (`/Volumes/T7/personal/vault/.claude/worktrees/design-lab`): `src/app/globals.css`, `src/app/lab/a/**`, `src/components/{ui,sidebar-app,lab/a/ui}/*`, `src/lib`, `src/hooks`, `package.json`, `eslint.config.mjs`, `tsconfig.json`, `node_modules/@base-ui/react` 1.8.0 (`docs/react/components/autocomplete.md`, `autocomplete/root/AutocompleteRoot.d.mts`), `node_modules/cmdk/package.json`; vault `.planning/phases/01-fundament-interfeysa/01-CONTEXT.md` (D-25..D-45)
- Пробы этой сессии (scratchpad): `scrypt-probe.mjs` (Node v24.17.0), `closure.mjs`/`audit.mjs` (37 файлов, 10 627 строк, 1 932 строки комментариев, 8 русских строк, 0 Radix/cmdk), `ages.mjs` (возраст версий), `probe/` (сборка Next 16.4.0 Turbopack с workspace-пакетом)
- `gsd-tools query package-legitimacy check` для 10 пакетов

### Secondary (MEDIUM confidence)
- Next.js 16.4 docs: `nextjs.org/docs/app/api-reference/file-conventions/proxy`, `…/config/next-config-js/transpilePackages`
- Caddy docs: `caddyserver.com/docs/caddyfile/directives/reverse_proxy` (Defaults, `trusted_proxies`)
- Hono docs: `hono.dev/docs/helpers/cookie`
- Base UI: `base-ui.com/react/overview/quick-start` (isolation, iOS 26), `base-ui.com/react/components/autocomplete`
- OWASP Password Storage Cheat Sheet (параметры scrypt)

### Tertiary (LOW confidence)
- next-themes issues #385 и #387 (предупреждение о теге `script` на Next 16.2), WebSearch, на 16.4 не воспроизводилось

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — версии и возраст проверены по реестру, пакеты из репозиториев владельца
- Правила входа и схема: HIGH — эталон прочитан дословно, ielts на тех же версиях в проде
- Hono / Drizzle / Next: HIGH для проверенных по исходникам фактов (cookie, csrf, схема URL, proxy), MEDIUM для рабочих деталей, не запускавшихся (Docker, Caddy, IPv6)
- Оболочка: MEDIUM — состав и чистка копии измерены, сборка 37 файлов в dv-lab не запускалась (вынесено в спайк)
- Pitfalls: HIGH для воспроизведённых (scrypt maxmem, Origin за Caddy, csrf, workspace-пакет), MEDIUM для остальных

**Research date:** 2026-10-09
**Valid until:** 2026-10-16 (версии Base UI, lucide-react и других меняются ежедневно; пересверить `ages.mjs` перед установкой)
