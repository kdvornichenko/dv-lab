# Архитектурный осмотр — фаза 17

Дата: 2026-10-09
Область: корневые `package.json`, `turbo.json`, `.github/workflows/ci.yml`, `.env.example`; `apps/api` (`local-server.ts`, `app.ts`, `config/env.ts`, `http/errors.ts`, `middleware/auth.ts`, `services/db-context.ts`); `packages/db` (`factory.ts`, `connection-url.ts`, `drizzle.config.ts`); `packages/api-types`; `apps/web` (`app/api/[[...route]]/route.ts`, `next.config.ts`, `lib/public-origin.ts`).
Источник: gsd-arch-scan (`--findings-only`)

Старый код фаза удаляет (INFRA-08), поэтому в находки вошли только швы, форму которых новый скелет повторил бы, и места, которые фаза расширяет.

## Находки

### 1. Правило «какой URL базы и под какой ролью» никому не принадлежит

- Файлы:
  - `apps/api/src/config/env.ts:47-48,55,102-103` — `DATABASE_URL ?? POSTGRES_URL` после очистки пустых строк; `NODE_ENV==='test'` отключает базу.
  - `apps/api/src/config/env.ts:6-12` — четыре вызова dotenv; в собранном `dist/` пути от `import.meta.url` указывают не туда, срабатывает только `config()` из cwd.
  - `apps/api/src/config/env.ts:40-41` — `.catch(4000)` и `.catch('http://localhost:3000')` молча проглатывают неверные `PORT` и `APP_ORIGIN`.
  - `packages/db/drizzle.config.ts:6,9` — свой dotenv, читает только `../../.env.local`, тот же fallback без очистки пустых строк.
  - `apps/api/src/db.integration.test.ts:6-7,20` — третье имя `TEACHER_CRM_TEST_DATABASE_URL` и флаг `CI`.
  - `.github/workflows/ci.yml:30-31,56` — миграции и тесты идут под суперпользователем `postgres`.
  - `turbo.json:3-20`, `.env.example:12-14` — имена повторены ещё раз.
  - `packages/db/src/connection-url.ts:29-36` — владеет только `sslmode`.
- Трение: понятия роли (приложение или миграции) в коде нет, каждая точка входа выбирает URL по своему правилу. Роль миграций (INFRA-07) и тестовая роль без прав суперпользователя (INFRA-02) потребуют правок в шести местах.
- Тест удаления: сейчас удаление любого читателя ничего не упрощает; сведённое в один модуль правило убрало бы четыре копии. Модуль окупится.
- Категория зависимости: in-process (разбор env); подключение — local-substitutable (Postgres 18 в CI).
- Тесты сегодня: `connection-url.test.ts` проверяет только `sslmode`; выбор URL, роли и `env.ts` не покрыты.
- Связь с фазой: расширяет (новый `packages/db`, роль миграций, роль сервера в CI).
- Сила: Strong
- Рекомендация: **в этой фазе**

### 2. Две топологии одного API: web загружает исходники api внутрь себя

- Файлы:
  - `apps/web/app/api/[[...route]]/route.ts:4,9-12` — импортирует `app` из `@teacher-crm/api`, монтирует под `/api` через `hono/vercel`.
  - `apps/web/package.json:49`, `apps/web/next.config.ts:4` (`transpilePackages`), `apps/web/tsconfig.json:7,9` (`paths` в `apps/api/src`), `apps/api/package.json:8-13` (`types` → `./src/index.ts`).
  - `apps/web/lib/crm/api.ts:58` — клиент ходит в `'/api'` на тот же origin.
  - `apps/api/src/local-server.ts:6-9` — отдельный процесс; CORS в `apps/api/src/app.ts:21-46`; health на `/healthz` (`app.ts:98-122`).
  - Публичный origin собирается в четырёх местах: `env.ts:28-32,41` (`APP_ORIGIN`), `env.ts:42` и `app.ts:26-29` (`CORS_ORIGINS`), `apps/web/lib/public-origin.ts:3,31-37`, `next.config.ts:5`.
- Трение: префикс `/api` и путь health check зависят от того, кто хостит API (`/healthz` или `/api/healthz`). В топологии «внутри Next» не нужен CORS, в отдельной — не нужен `route.ts`. Образ web тащит `pg` и схему.
- Тест удаления: если удалить `route.ts`, сложность больше нигде не появится; остаётся правило префикса, его забирает прокси. Сквозной модуль.
- Категория зависимости: ports & adapters (web и api разделены сетью после фазы).
- Тесты сегодня: `app.test.ts` ходит в `app.request('/healthz')` без префикса; монтирование под `/api` и CORS не проверяются.
- Связь с фазой: фаза пересекает этот шов (отдельные образы web и api, один домен за прокси, health check по HTTPS).
- Сила: Strong
- Рекомендация: **в этой фазе** (становится решением о топологии и владельце префикса `/api`, а не отдельным планом углубления)

### 3. Request id приклеивается вручную, логгер запускается раньше, чем id появляется

- Файлы:
  - `apps/api/src/app.ts:70` — `hono/logger()` стоит до middleware request id (`app.ts:71-76`), строка доступа без id.
  - Слияние `requestId` в тело ошибки реализовано трижды: `apps/api/src/http/errors.ts:64-75` (статус без 409), `app.ts:127-137` (`onError`), `apps/api/src/routes/lessons.ts:68-69`.
  - Восемь мест с `console.*` и ручным префиксом `[teacher-crm]`, без requestId: `app.ts:128`, `middleware/auth.ts:168`, `lesson-workflow-service.ts:171,186`, `calendar-service.ts:518,1069`, `local-server.ts:11,21`, `packages/db/src/factory.ts:29`.
  - Тип контекста объявлен дважды: `auth.ts:28-34` и `:36-42`.
  - Конверт ошибки описан дважды: `errors.ts:3-23` (`ApiErrorCode`, `ApiErrorBody`) и `packages/api-types/src/index.ts:664-672,852` (`apiErrorSchema` с `code: z.string()`).
- Трение: request id не виден коду ниже по стеку; фоновые логи после ответа его получить не могут; коды ошибок api расходятся с общим контрактом для web.
- Тест удаления: после удаления `errorResponse` слияние requestId появилось бы заново (уже появилось дважды); модуль слишком узкий. Контекст запроса собрал бы восемь мест в одно.
- Категория зависимости: in-process.
- Тесты сегодня: в `app.test.ts` нет проверок `requestId` и `x-request-id`.
- Связь с фазой: расширяет (INFRA-07).
- Сила: Strong
- Рекомендация: **в этой фазе**

### 4. У жизненного цикла процесса API нет владельца

- Файлы:
  - `apps/api/src/local-server.ts:13-16` — SIGINT выходит сразу; `:18-25` — SIGTERM ждёт `server.close()` без дедлайна.
  - `apps/api/src/services/db-context.ts:8,10,35` — пул-синглтон и Map пулов по URL; `packages/db/src/factory.ts:17,32-35` возвращает `pgPool`, `end()` нигде не вызывается.
  - `apps/api/src/app.ts:144` — `export const app = createApp()` при импорте; реэкспорт `index.ts:1-4`, импорт в web `route.ts`. Импорт разбирает env и считает CORS как побочный эффект.
  - Фоновая работа через `void …catch` (`lesson-workflow-service.ts:170-176,185-191`), при остановке её нечем дождаться.
  - WebSocket-кода в репозитории нет (grep по `websocket` и `upgradeWebSocket` пуст); `.planning/PROJECT.md:81` говорит «WebSocket exists». INFRA-06 («SIGTERM с открытыми WebSocket») придётся делать с нуля.
- Трение: запуск размазан по побочным эффектам импорта, остановка владеет только HTTP-сервером, порядка остановки, дедлайна и закрытия ресурсов нет.
- Тест удаления: `local-server.ts` — сквозной модуль; настоящая сложность жизненного цикла отсутствует и раскидана по синглтонам без `close`.
- Категория зависимости: in-process (сигналы, сервер); пул — local-substitutable.
- Тесты сегодня: нет; `app.request` не проходит через listen и close.
- Связь с фазой: расширяет (INFRA-06).
- Сила: Strong
- Рекомендация: **в этой фазе**

### 5. Шов хранилища стоит в каждом методе, тест с базой идёт под суперпользователем

- Файлы:
  - 45 мест вида `const db = getDb(); if (!db) return getMemoryStore()…` в 7 файлах (billing 4, calendar 16, error-log 4, lesson 8, payment 3, settings 6, student 4).
  - `apps/api/src/services/memory-store.ts` — 1053 строки, второй полный адаптер.
  - `storeNamespace` (чисто тестовое понятие) протянут через интерфейс запроса: `app.ts:49,86-89`, `auth.ts:31,39,141`, `store-scope.ts:4`, `memory-store.ts:192-196`.
  - Запрет памяти в production охраняется дважды: `app.ts:55-63`, `storage-context.ts:17-19`.
  - Основной набор тестов на памяти: `app.test.ts:8`, 1449 строк; тест с базой — один сценарий, 101 строка, URL суперпользователя (`ci.yml:31`).
- Трение: шов стоит в каждом методе, а не на уровне композиции. Адаптер в памяти не проверяет права роли, ограничения и транзакции — то, чего требует INFRA-02. Форма (`createApp({ db, memoryStore, storeNamespace })`, `AsyncLocalStorage` в `db-context`) может перейти в новый скелет.
- Тест удаления: если убрать адаптер в памяти и гонять тесты на настоящем Postgres, сложность не вернётся: 45 ветвлений и защита для production исчезнут.
- Категория зависимости: local-substitutable.
- Тесты сегодня: `app.test.ts` на памяти, `db.integration.test.ts` на реальной базе под `postgres`.
- Связь с фазой: код удаляется в INFRA-08; фаза только читает шов как образец, которому не следовать. Тестовая роль базы закрыта находкой 1 и INFRA-02.
- Сила: Worth exploring
- Рекомендация: **отклонено** — модуль удаляется целиком, чинить нечего; урок («тесты идут на реальном Postgres 18, адаптера в памяти в новом скелете нет») входит в требование INFRA-02.

## Вне находок

- Speculative: подключение пакета workspace описано в нескольких местах — `tsconfig.base.json:14-18`, `apps/web/tsconfig.json:5-11`, `packages/api-types/tsup.config.ts:8-15`, `next.config.ts:4`, `apps/api/tsup.config.ts:10`, корневой `tsconfig.json:4-10`, `knip.json`. TypeScript идёт в `src`, `exports` — в `dist`, поэтому все задачи в `turbo.json` зависят от `^build`. Новый `packages/db` (и позже `packages/core`) затронет все эти места.
- Мёртвое: `apps/web/lib/canonical-localhost.ts` ни откуда не вызывается и спрятан через `ignore` в `knip.json`; уходит вместе с web.
- `next/font/google` (11 шрифтов, `apps/web/app/layout.tsx:4-16`) — удаляемый код.
- Корневой `ARCHITECTURE_REVIEW.md` уже отмечал находку 5 для старого кода (OO-002) и частично находку 3 (API-003).

## Решения

Решения приняты на странице обсуждения фазы 17 (`17-DISCUSS.html`), 2026-10-09.

| id | название | решение | причина | модуль-владелец |
| -- | -------- | ------- | ------- | --------------- |
| 1 | Выбор URL базы и роли | в этой фазе | INFRA-02 и INFRA-07 добавляют роль миграций и тестовую роль без прав суперпользователя; без владельца правила правки идут в шесть мест | конфигурация процесса и роли подключения к базе |
| 2 | Две топологии одного API | в этой фазе | образы web и api собираются отдельно, один домен за прокси; префикс `/api` и путь health check должны принадлежать одному месту | граница web и api (прокси и клиент) |
| 3 | Request id и контекст запроса | в этой фазе | INFRA-07: структурные логи с request id; сейчас id приклеивается вручную и теряется в фоновых логах | контекст запроса api |
| 4 | Жизненный цикл процесса api | в этой фазе | INFRA-06: остановка по `SIGTERM` за ограниченное время с открытыми WebSocket; сейчас ожидание без срока, пул не закрывается | запуск и остановка процесса api |
| 5 | Шов «память или база» | отклонено | модуль удаляется целиком в INFRA-08; урок (тесты идут на настоящем Postgres 18, адаптера в памяти нет) уже входит в INFRA-02 | — |

## Для планировщика

- Углубить модуль конфигурации и роли подключения к базе отдельным планом до планов, которые трогают env, `packages/db` и CI.
- Углубить границу web и api отдельным решением в первом плане скелета: api отдельный процесс, в web нет `route.ts` и кода api, префикс `/api` принадлежит одному месту.
- Углубить контекст запроса (request id) отдельным планом до планов, которые добавляют логи и обработку ошибок.
- Углубить владельца запуска и остановки процесса api отдельным планом до планов, которые добавляют WebSocket, пул базы или фоновые задачи.
