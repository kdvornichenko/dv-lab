# dv-lab: инструкции для агентов

Личное рабочее пространство преподавателя. Монорепозиторий на Yarn 4 (workspaces, `nodeLinker: node-modules`) и Turbo, Node 24.

## Структура

- `apps/web` — Next 16 (App Router), сборка `output: 'standalone'`. Шрифты из пакета `geist`, без обращения к Google при сборке.
- `apps/api` — Hono на `@hono/node-server`, отдельный процесс за прокси. Сборка `tsdown` в `apps/api/dist/server.mjs` и `apps/api/dist/migrate.mjs`, `@dv-lab/db` вшивается в бандл, миграции копируются в `apps/api/drizzle`.
- `packages/db` — JIT-пакет `@dv-lab/db` (экспортирует исходники `src/index.ts`, своей сборки нет): Drizzle v1, схема, подключение, мигратор. Миграции лежат в `packages/db/drizzle`.
- `deploy/` — `compose.yaml`, Caddy (`deploy/caddy/Caddyfile`), `deploy.sh`, скрипты бэкапа, `deploy/postgres/ensure-db.sql` и `ensure-db.sh`, юниты systemd, `deploy/RUNBOOK.md`.
- `apps/web/Dockerfile`, `apps/api/Dockerfile` — multi-stage сборка образов. Образы собирает и публикует в GHCR GitHub Actions (`.github/workflows/ci.yml`), на сервере сборки нет.

## Команды

| Команда | Что делает |
|---------|-----------|
| `yarn install` | установка зависимостей |
| `yarn dev` | web и api в режиме разработки |
| `yarn build` | сборка всех workspace |
| `yarn typecheck` | `tsc --noEmit` во всех workspace |
| `yarn lint` | ESLint (web) |
| `yarn test` | Vitest (api и db), тесты идут на настоящем Postgres |
| `yarn knip` | неиспользуемые файлы, экспорты и зависимости |
| `yarn format` / `yarn format:check` | Prettier |
| `yarn db:generate` | `drizzle-kit generate`: новая миграция из `packages/db/src/schema.ts` |
| `yarn db:migrate` | применение миграций под ролью миграций (`apps/api/src/migrate.ts`) |

CI (`.github/workflows/ci.yml`) на каждый pull request и push в `master`: job `Verify` поднимает `postgres:18`, готовит роли через `deploy/postgres/ensure-db.sql`, проверяет синхронность схемы и миграций, гоняет миграции, typecheck, lint, test, build, knip, `caddy validate` и shellcheck скриптов `deploy/`. Job `images` собирает образы после зелёного `Verify`; на push в `master` публикует их в GHCR с тегами `sha-<полный sha>` и `latest`.

## Окружение

- `.env` в корне — разработка, база `dvlab_dev`. `.env.test` — тесты, база `dvlab_test`. Оба файла в `.gitignore`.
- Имена переменных — в `.env.example`: `NODE_ENV`, `DATABASE_URL`, `MIGRATOR_DATABASE_URL`, `APP_ORIGIN`, `PORT`, `LOG_LEVEL`, `SHUTDOWN_DEADLINE_MS`.
- Роли Postgres без прав суперпользователя: `dvlab_app` — роль приложения (`DATABASE_URL`, только чтение и запись данных), `dvlab_migrator` — владелец базы и роль миграций (`MIGRATOR_DATABASE_URL`).
- Переменные сервера — в `deploy/env.example` (только имена).

## Модули-владельцы

- URL базы для роли выбирает только `resolveDatabaseUrl` из `packages/db/src/connection.ts`. При `NODE_ENV=test` он принимает только базу с именем на `_test`.
- Переменные окружения api читает только `loadConfig` из `apps/api/src/config.ts`. Неверные `PORT` и `APP_ORIGIN` дают ошибку запуска, значения по умолчанию за них не подставляются.
- Request id, логгер pino и конверт ошибки (`errorBody`) принадлежат `apps/api/src/request-context.ts`. Одна JSON-строка лога на запрос с `requestId`.
- Сигналы, срок остановки, закрытие HTTP-сервера, WebSocket и пула базы принадлежат `apps/api/src/lifecycle.ts`.
- `apps/api/src/server.ts` — composition root: собирает конфиг, логгер, базу, приложение и жизненный цикл. `apps/api/src/app.ts` при импорте ничего не запускает.
- Маршруты api — без префикса (`/healthz`, `/ws`, далее свои пути). Префикс `/api` принадлежит Caddy: `handle_path /api/*` срезает его перед api.
- `apps/web` не импортирует код api и базы: в `apps/web/package.json` нет `@dv-lab/api` и `@dv-lab/db`, каталога `apps/web/app/api` нет. CI проверяет оба условия.

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
