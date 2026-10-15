# Платформа: api, вход, граница пакетов, сборка, CI

## Пакеты и сборка

- `apps/web` собирается `next build --webpack` с `output: 'standalone'`.
- `apps/api` — Hono на `@hono/node-server`, отдельный процесс за прокси. Сборка `tsdown` в `apps/api/dist/server.mjs`, `apps/api/dist/migrate.mjs`, `apps/api/dist/bootstrap-teacher.mjs` (CLI первого учителя и восстановления его пароля) и `apps/api/dist/import-vault.mjs` (импорт vault: команды `parse` и `apply`); `@dv-lab/*` вшиваются в бандл, миграции копируются в `apps/api/drizzle`.
- `packages/core`, `packages/contracts` и `packages/db` — JIT-пакеты: экспортируют исходники `src/index.ts`, своей сборки нет.
- `packages/contracts` — типы, схемы zod и константы общего контракта web и api: запросы, ответы, коды ошибок, имя cookie сессии, пределы логина и пароля, `CHAT_FOLLOW_UP_TEXT`, `REVIEW_COMMAND_TEXT`. Исключения — чистые функции без зависимостей, общие для api и web: строители адресов `links.ts` (`encodeLessonRef`, `lessonLink`, `studentPaymentsLink`) и `placeView` в `calendar-events.ts` (метка места-адреса без схемы, учётных данных, query и fragment).
- `apps/web/Dockerfile`, `apps/api/Dockerfile` — multi-stage сборка образов. Образы собирает и публикует в GHCR GitHub Actions, на сервере сборки нет. Оба образа получают build-arg `GIT_SHA` (sha коммита) и несут его в окружении: api отдаёт его в `/healthz`, web — клиенту для уведомления о новой версии.
- В `deploy/compose.yaml` `API_INTERNAL_URL` задан у сервиса `web`.

## CI

`.github/workflows/ci.yml` на каждый pull request и push в `master`:

Задачи идут параллельно; зависимости, кеш turbo (`.turbo/cache`) и кеш сборки Next восстанавливает общий шаг `.github/actions/setup`.

- job `Checks`: граница web, api, contracts и core (шаг `Web and api boundary`), доверие к адресу клиента в `deploy/` (шаг `Client address trust`), чистота репозитория — нет путей и моделей чужих рантаймов и личных почтовых адресов (шаг `Repository hygiene`, `scripts/hygiene-check.mjs`), версия `turbo` в Dockerfile; typecheck, lint, knip, `caddy validate` и shellcheck скриптов `deploy/`;
- job `Test`: поднимает `postgres:18`, готовит роли через `deploy/postgres/ensure-db.sql`, проверяет синхронность схемы и миграций, гоняет миграции, test и сборку пакетов кроме web;
- job `Image web`: собирает web на раннере (`turbo run build`, кеш `.next/cache`) и кладёт standalone, static и public в образ по `apps/web/Dockerfile.runtime`; `apps/web/Dockerfile` — полная сборка в Docker для ручных сборок, в CI не используется;
- job `Image api`: образ по `apps/api/Dockerfile` с кешем слоёв GHA;
- образы на push публикуются с временным тегом `ci-<полный sha>`; job `Publish` после зелёных `Checks`, `Test` и обоих образов ставит тег `sha-<полный sha>`, который ждёт `deploy.sh`, поэтому коммит с красной проверкой не выкатывается;
- job `Base is master` падает на pull request с базой не `master`.

## Граница web и api

`apps/web` не импортирует код api и базы: в `apps/web/package.json` нет `@dv-lab/api` и `@dv-lab/db`, в исходниках web нет их импортов, каталога `apps/web/app/api` нет, `transpilePackages` в `apps/web/next.config.ts` нет. `packages/contracts` зависит только от `zod`, не импортирует `pg`, `node:*` и `@dv-lab/*` и не читает `process.env`. У `packages/core` нет зависимостей, он не импортирует `pg`, `node:*` и `@dv-lab/*` и не читает `process.env`. Эти условия проверяет шаг CI `Web and api boundary`.

## api: конфиг, логи, жизненный цикл

- Переменные окружения api читает только `loadConfig` из `apps/api/src/config.ts`. Неверные `PORT` и `APP_ORIGIN` дают ошибку запуска, значения по умолчанию за них не подставляются.
- Request id, логгер pino и конверт ошибки (`errorBody`) принадлежат `apps/api/src/request-context.ts`. Одна JSON-строка лога на запрос с `requestId`.
- Сигналы, срок остановки, закрытие HTTP-сервера, WebSocket и пула базы принадлежат `apps/api/src/lifecycle.ts`.
- `apps/api/src/server.ts` — composition root: собирает конфиг, логгер, базу, приложение и жизненный цикл. `apps/api/src/app.ts` при импорте ничего не запускает.
- Маршруты api — без префикса (`/healthz`, `/ws`, далее свои пути). Префикс `/api` принадлежит Caddy: `handle_path /api/*` срезает его перед api.
- Доверие к адресу клиента: api берёт адрес из правого значения `X-Forwarded-For`, которое дописывает Caddy. У api в `deploy/compose.yaml` нет `ports`, в `deploy/caddy/Caddyfile` нет `trusted_proxies`, у сети `default` включён IPv6. Это проверяет шаг CI `Client address trust`.

## Вход и аккаунты

- Порядок входа (проверка пароля, ограничение попыток, выдача сессии) принадлежит `apps/api/src/auth/sign-in.ts`: `createSignIn().attempt`, экземпляр создаётся в `server.ts`.
- Эпоха аккаунта и сессии (выдача, чтение, продление, отзыв) принадлежат `apps/api/src/auth/sessions.ts`.
- Отображение строк `accounts` в ответы api принадлежит `apps/api/src/auth/account-rows.ts`.
- Учётные записи (первый учитель, ученики, деактивация, смена пароля, восстановление пароля учителя) принадлежат `apps/api/src/auth/accounts.ts`. Он единственный создаёт аккаунты, привязывает их к карточке и деактивирует.
- HTTP-сторона входа (проверка Origin, адрес клиента, cookie сессии, ответы отказа, `no-store`) принадлежит `apps/api/src/auth/middleware.ts`.

## web: запросы и сессия

- Клиентские запросы web к api идут только через `apps/web/lib/api-client.ts` (`apiRequest`, путь без префикса `/api`). Исключение — статический `apps/web/public/sw.js`: на `pushsubscriptionchange` он сам отправляет подписку в `/api/push/subscriptions`.
- Проверка формы cookie сессии и редирект на `/login` — `apps/web/proxy.ts`; «кто я» на сервере web — `apps/web/lib/session.ts` (`getMe`, `requireTeacherPage`).
