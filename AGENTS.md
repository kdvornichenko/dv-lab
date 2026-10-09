# dv-lab: инструкции для агентов

Личное рабочее пространство преподавателя. Монорепозиторий на Yarn 4 (workspaces, `nodeLinker: node-modules`) и Turbo, Node 24.

## Структура

- `apps/web` — Next 16 (App Router), сборка `output: 'standalone'`. Шрифты Inter Variable и JetBrains Mono Variable из пакетов `@fontsource-variable/inter` и `@fontsource-variable/jetbrains-mono`, без обращения к Google.
- `apps/api` — Hono на `@hono/node-server`, отдельный процесс за прокси. Сборка `tsdown` в `apps/api/dist/server.mjs`, `apps/api/dist/migrate.mjs` и `apps/api/dist/bootstrap-teacher.mjs` (CLI первого учителя и восстановления его пароля), `@dv-lab/*` вшиваются в бандл, миграции копируются в `apps/api/drizzle`.
- `packages/contracts` — JIT-пакет `@dv-lab/contracts`: только типы, схемы zod и константы общего контракта web и api (запросы, ответы, коды ошибок, имя cookie сессии, пределы логина и пароля). Зависит только от `zod`. web и api импортируют его; web не зависит от `@dv-lab/api` и `@dv-lab/db`.
- `packages/db` — JIT-пакет `@dv-lab/db` (экспортирует исходники `src/index.ts`, своей сборки нет): Drizzle v1, схема, подключение, мигратор. Миграции лежат в `packages/db/drizzle`.
- `deploy/` — `compose.yaml`, Caddy (`deploy/caddy/Caddyfile`), `deploy.sh`, скрипты бэкапа, `deploy/postgres/ensure-db.sql` и `ensure-db.sh`, юниты systemd, `deploy/RUNBOOK.md`.
- `apps/web/Dockerfile`, `apps/api/Dockerfile` — multi-stage сборка образов. Образы собирает и публикует в GHCR GitHub Actions (`.github/workflows/ci.yml`), на сервере сборки нет.

## Команды

| Команда | Что делает |
|---------|-----------|
| `yarn install` | установка зависимостей |
| `yarn dev` | web и api через `portless`; нужен запущенный прокси `portless` и sudo, без TTY не запускается |
| `yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev` | локальный стек со входом (две команды), браузер на http://localhost:3000; web передаёт `/api/*` в api на порту 4000 |
| `yarn build` | сборка всех workspace |
| `yarn typecheck` | `tsc --noEmit` во всех workspace |
| `yarn lint` | ESLint (web) |
| `yarn test` | Vitest в `packages/db`, `packages/contracts` и `apps/api`; тесты db и api идут на настоящем Postgres. У web тест-раннера нет |
| `yarn knip` | неиспользуемые файлы, экспорты и зависимости |
| `yarn format` / `yarn format:check` | Prettier |
| `yarn db:generate` | `drizzle-kit generate`: новая миграция из `packages/db/src/schema.ts` |
| `yarn db:migrate` | применение миграций под ролью миграций (`apps/api/src/migrate.ts`) |

CI (`.github/workflows/ci.yml`) на каждый pull request и push в `master`: job `Verify` проверяет границу web, api и contracts (шаг `Web and api boundary`) и доверие к адресу клиента в `deploy/` (шаг `Client address trust`), поднимает `postgres:18`, готовит роли через `deploy/postgres/ensure-db.sql`, проверяет синхронность схемы и миграций, гоняет миграции, typecheck, lint, test, build, knip, `caddy validate` и shellcheck скриптов `deploy/`. Job `images` собирает образы после зелёного `Verify`; на push в `master` публикует их в GHCR с тегами `sha-<полный sha>` и `latest`.

## Окружение

- `.env` в корне — разработка, база `dvlab_dev`. `.env.test` — тесты, база `dvlab_test`. Оба файла в `.gitignore`.
- Имена переменных — в `.env.example`: `NODE_ENV`, `DATABASE_URL`, `MIGRATOR_DATABASE_URL`, `APP_ORIGIN`, `PORT`, `LOG_LEVEL`, `SHUTDOWN_DEADLINE_MS`.
- Роли Postgres без прав суперпользователя: `dvlab_app` — роль приложения (`DATABASE_URL`, только чтение и запись данных), `dvlab_migrator` — владелец базы и роль миграций (`MIGRATOR_DATABASE_URL`).
- web: `API_INTERNAL_URL` (адрес api для серверных запросов web) и `API_DEV_PROXY_URL` (цель `/api/*` в `next dev`) — в `apps/web/.env.development`, файл в git. В compose `API_INTERNAL_URL` задан у сервиса `web`.
- `DEV_TEACHER_LOGIN`, `DEV_TEACHER_PASSWORD`, `DEV_STUDENT_PASSWORD` — учётные данные dev-аккаунтов для проверок в браузере, только в локальном `.env`.
- Разовый SQL к домашним базам выполняется только к базам с суффиксом `_dev` или `_test`.
- Переменные сервера — в `deploy/env.example` (только имена).

## Модули-владельцы

- URL базы для роли выбирает только `resolveDatabaseUrl` из `packages/db/src/connection.ts`. При `NODE_ENV=test` он принимает только базу с именем на `_test`.
- Переменные окружения api читает только `loadConfig` из `apps/api/src/config.ts`. Неверные `PORT` и `APP_ORIGIN` дают ошибку запуска, значения по умолчанию за них не подставляются.
- Request id, логгер pino и конверт ошибки (`errorBody`) принадлежат `apps/api/src/request-context.ts`. Одна JSON-строка лога на запрос с `requestId`.
- Сигналы, срок остановки, закрытие HTTP-сервера, WebSocket и пула базы принадлежат `apps/api/src/lifecycle.ts`.
- `apps/api/src/server.ts` — composition root: собирает конфиг, логгер, базу, приложение и жизненный цикл. `apps/api/src/app.ts` при импорте ничего не запускает.
- Маршруты api — без префикса (`/healthz`, `/ws`, далее свои пути). Префикс `/api` принадлежит Caddy: `handle_path /api/*` срезает его перед api.
- `apps/web` не импортирует код api и базы: в `apps/web/package.json` нет `@dv-lab/api` и `@dv-lab/db`, в исходниках web нет их импортов, каталога `apps/web/app/api` нет, `transpilePackages` в `apps/web/next.config.ts` нет. `packages/contracts` не импортирует `pg`, `node:*` и `@dv-lab/*` и не читает `process.env`. Эти условия проверяет шаг CI `Web and api boundary`.
- Доверие к адресу клиента: api берёт адрес из правого значения `X-Forwarded-For`, которое дописывает Caddy. У api в `deploy/compose.yaml` нет `ports`, в `deploy/caddy/Caddyfile` нет `trusted_proxies`, у сети `default` включён IPv6. Это проверяет шаг CI `Client address trust`.
- Порядок входа (проверка пароля, ограничение попыток, выдача сессии) принадлежит `apps/api/src/auth/sign-in.ts`: `createSignIn().attempt`, экземпляр создаётся в `server.ts`.
- Эпоха аккаунта и сессии (выдача, чтение, продление, отзыв) принадлежат `apps/api/src/auth/sessions.ts`.
- Отображение строк `accounts` в ответы api принадлежит `apps/api/src/auth/account-rows.ts`.
- Учётные записи (первый учитель, ученики, деактивация, смена пароля, восстановление пароля учителя) принадлежат `apps/api/src/auth/accounts.ts`.
- HTTP-сторона входа (проверка Origin, адрес клиента, cookie сессии, ответы отказа, `no-store`) принадлежит `apps/api/src/auth/middleware.ts`.
- Клиентские запросы web к api идут только через `apps/web/lib/api-client.ts` (`apiRequest`, путь без префикса `/api`).
- Проверка формы cookie сессии и редирект на `/login` — `apps/web/proxy.ts`; «кто я» на сервере web — `apps/web/lib/session.ts` (`getMe`, `requireTeacherPage`).
- Страницы 404 и ошибки — `apps/web/components/app/status-pages.tsx`; корневые `not-found.tsx`, `error.tsx` и `global-error.tsx` только вызывают их. Ошибка чтения целого экрана — `apps/web/components/app/read-error.tsx`. Скелетоны — `apps/web/components/ui/skeleton.tsx`.
- UI web — только Base UI и копия компонентов варианта A (`components/ui`, `components/sidebar-app`, `components/fluid-hover-highlight.tsx`, `hooks`, двенадцать файлов `lib`; knip их не проверяет). Импорты `radix-ui`, `@radix-ui/*` и `cmdk` запрещены правилом ESLint. Рукописные части экранов лежат в `apps/web/components/app` и `apps/web/app`.

## База

- PostgreSQL 18. Роли, база, схема `extensions` и расширения создаёт только `deploy/postgres/ensure-db.sql` (идемпотентный, запускается суперпользователем). `CREATE EXTENSION` в миграциях не пишется.
- Миграции генерирует `yarn db:generate`, руками сгенерированные файлы не правятся, `drizzle-kit push` не используется.
- Миграции одного релиза только добавляют (новые таблицы, колонки, индексы). Удаление и переименование — отдельным релизом, когда код прошлой версии уже не работает с этими объектами.
- Миграции применяются отдельным шагом под `dvlab_migrator`: локально `yarn db:migrate`, на сервере одноразовый сервис `migrate` из образа api (`node apps/api/dist/migrate.mjs`).
- Тесты идут на настоящем Postgres в базе `dvlab_test` под ролями `dvlab_app` и `dvlab_migrator`. Данные между тестами очищаются `TRUNCATE` под `dvlab_migrator`. Адаптера базы в памяти нет.

## Версии

- Версии зависимостей закреплены точно, без `^` и `~`.
- Возрастной барьер Yarn (`npmMinimalAgeGate: 1440`, пакеты младше суток не ставятся) не отключается.
- TypeScript 6.0.3, а не 7.x: `typescript-eslint` (через `eslint-config-next`) не поддерживает TypeScript 7.0.
- `drizzle-orm` и `drizzle-kit` 1.0.0-rc.4: стабильного v1 нет, `latest` указывает на 0.45, проект работает на v1.
- Версия `turbo` в `ARG TURBO_VERSION` обоих Dockerfile совпадает с `devDependencies.turbo` корневого `package.json`, CI это проверяет.

## Публичный репозиторий

Репозиторий публичный. Адресов серверов, паролей, ключей и данных учеников нет нигде, включая `.planning/`, `deploy/` и тестовые данные. `.env*` не коммитятся и не попадают в контекст сборки образов (`.dockerignore`). Секреты сервера лежат только на сервере.

## Выкатка и сервер

Подготовка VPS, выкатка, откат, бэкапы и восстановление — `deploy/RUNBOOK.md`.
