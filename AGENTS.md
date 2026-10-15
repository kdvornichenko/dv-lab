# dv-lab: инструкции для агентов

Личное рабочее пространство преподавателя: ученики и оплаты, расписание с Google Calendar, чат учителя с моделью. Монорепозиторий на Yarn 4 (workspaces, `nodeLinker: node-modules`) и Turbo, Node 24.

## Дизайн интерфейса

Источник правды по UI — Design System варианта A вне репозитория, `~/dv-lab-design/`; версию из `~/dv-lab-design/VERSION` записывай в план. Для экрана или компонента читай оттуда `project/principles.md` (решения владельца, глоссарий текстов), `project/components/<Name>/README.md` и `preview.html`, `project/tokens.css`, скриншоты `project/assets/Reference/`. Пересказ дизайна в промпте или плане эти файлы не заменяет. Нет нужного компонента или состояния — запроси его у сессии дизайна (Design dude) и жди ответа с названием компонента и версией.

## Структура

- `apps/web` — Next 16 (App Router).
- `apps/api` — Hono, отдельный процесс за Caddy.
- `packages/core` — `@dv-lab/core`: чистые правила денег, уроков, остатка и зон; его зовут web, api и импорт vault.
- `packages/contracts` — `@dv-lab/contracts`: типы, схемы zod и константы контракта web и api.
- `packages/db` — `@dv-lab/db`: Drizzle v1, схема `packages/db/src/schema.ts`, подключение, мигратор; миграции в `packages/db/drizzle`.
- `deploy/` — compose, Caddy, `deploy.sh`, бэкап, `ensure-db.sh`, юниты systemd.

## Команды

| Команда | Что делает |
|---------|-----------|
| `yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev` | локальный стек со входом: браузер на http://localhost:3000, web передаёт `/api/*` в api на порту 4000 |
| `yarn dev` | web и api через `portless`; нужен запущенный прокси `portless` и sudo, без TTY не запускается |
| `yarn build`, `yarn typecheck` (`tsc --noEmit`), `yarn lint` (ESLint, web), `yarn knip`, `yarn format` / `yarn format:check` (Prettier) | сборка и проверки |
| `yarn test` | Vitest в `packages/db`, `packages/contracts` и `apps/api`; db и api — на настоящем Postgres. У web тест-раннера нет |
| `yarn test:e2e` | Playwright: девять journeys в light/dark, один воркер; нужны dev-стек, `.env` с dev-учителем и Chromium. Артефакты только в `STATE_DIR` вне репозитория; в CI не входит |
| `yarn db:generate` | `drizzle-kit generate`: новая миграция из схемы |
| `yarn db:migrate` | миграции под ролью миграций (`apps/api/src/migrate.ts`) |

## Окружение

- `.env` в корне — разработка, база `dvlab_dev`; `.env.test` — тесты, база `dvlab_test`; оба в `.gitignore`.
- Имена переменных — `.env.example`: `NODE_ENV`, `DATABASE_URL`, `MIGRATOR_DATABASE_URL`, `APP_ORIGIN`, `PORT`, `LOG_LEVEL`, `SHUTDOWN_DEADLINE_MS`. Ещё `ANTHROPIC_API_KEY` (`chat.md`) и `PUSH_VAPID_*` (`push.md`).
- web: `API_INTERNAL_URL` (адрес api для серверных запросов web) и `API_DEV_PROXY_URL` (цель `/api/*` в `next dev`) — в `apps/web/.env.development`, файл в git.
- `DEV_TEACHER_LOGIN`, `DEV_TEACHER_PASSWORD`, `DEV_STUDENT_PASSWORD` — dev-аккаунты для проверок в браузере, только в локальном `.env`.
- Разовый SQL к домашним базам — только к базам с суффиксом `_dev` или `_test`.
- Переменные сервера — `deploy/env.example` (только имена).

## Правила для любой правки

- Версии зависимостей закреплены точно, без `^` и `~`. Возрастной барьер Yarn (`npmMinimalAgeGate: 1440`, пакеты младше суток не ставятся) не отключается.
- TypeScript 6.0.3, а не 7.x: `typescript-eslint` (через `eslint-config-next`) не поддерживает TypeScript 7.0. `drizzle-orm` и `drizzle-kit` 1.0.0-rc.4: стабильного v1 нет, `latest` указывает на 0.45, проект работает на v1. Версия `turbo` в `ARG TURBO_VERSION` обоих Dockerfile совпадает с `devDependencies.turbo` корневого `package.json`.
- Миграции генерирует `yarn db:generate`; сгенерированные файлы руками не правятся, `drizzle-kit push` не используется. Миграции одного релиза только добавляют (новые таблицы, колонки, индексы); исключение — `database.md`.
- `apps/web` не импортирует код api и базы; `packages/contracts` зависит только от `zod`, у `packages/core` зависимостей нет (условия — `platform.md`).
- Строки расписания не удаляются: меняются статус, `kind` или `ends_on`.
- CI (`.github/workflows/ci.yml`): job `Verify` (граница пакетов, гигиена, миграции, typecheck, lint, test, build, knip), job `Base is master` и job `images` (образы в GHCR, на сервере сборки нет); подробно — `platform.md`.

## Публичный репозиторий

Адресов серверов, паролей, ключей и данных учеников нет нигде, включая `.planning/`, `deploy/` и тестовые данные; имён, сумм и заметок учеников нет в коде, тестах, `.planning/` и SUMMARY. `.env*` не коммитятся и не попадают в контекст сборки образов (`.dockerignore`). Секреты сервера лежат только на сервере. Пакет импорта vault лежит вне репозитория (`cards.md`).

## Документация Google Calendar

При планировании или изменении интеграции Google Calendar сначала прочитай `docs/google-calendar/READING.md`, затем нужные локальные статьи и схемы. В плане укажи прочитанные файлы и разделы, которые обосновывают методы API, поля, ограничения и обработку ошибок. Перед исполнением проверь актуальность изменяемых условий по официальным источникам; сохрани дату проверки и расхождения со снимком. Наличие справки не расширяет scope фазы и не разрешает запись в Google.

## Владельцы модулей: `docs/owners/`

Перед правкой кода в области прочитай её файл и сам код; сказанное там важнее догадок. В конце файла — приёмочные скрипты области.

- `platform.md` — сборка api, contracts (`links.ts`, `placeView`), CI, граница web/api, `loadConfig`, request-context, lifecycle, server/app, префикс `/api`, `X-Forwarded-For`, auth (sign-in, sessions, accounts, middleware), `api-client.ts`, `proxy.ts`, `session.ts`
- `database.md` — Postgres 18, `ensure-db.sql`, роли, `resolveDatabaseUrl`, `DbExecutor`, postgres-errors, применение миграций, `note_blocks_kind_check`, права `DELETE`/`TRUNCATE`, тестовая база
- `cards.md` — cards, `/students`, `/payments`, ревизии, `insertPayment`, card-facts, блоки заметок, `student_sections`, словарь, леджер, `lessons-range`, импорт vault
- `schedule.md` — core (видимость, `balance.ts`, `lessonActions`, `schedule-day.ts`, Pays soon), таблицы серий, `readWindow`, `rows.ts`, `window-blocks`, marks, comments, changes, series, `allFrom`, Today, `teacher_settings`
- `calendar.md` — `google_connections`, выбор календаря, projection, read-model, sync, окно синхронизации, `watch.ts`, вебхук, event-commands, matching, assign, event-mapping, inbound-apply, event-titles, event-description
- `chat.md` — chat, `ANTHROPIC_API_KEY`, tool-registry, `executeIntent`, budget, model-config, prompts, note-writes, review, `chat_actions` и предложения, command-zone, essay, блоки предложений в web
- `push.md` — `apps/api/src/push` (subscriptions, presence, scheduler, deliver), `/push/*`, VAPID, push-client, `sw.js`
- `web.md` — Base UI и вариант A, ESLint-запреты, шрифты, цвета событий, status-pages, skeleton, markdown, ledger-text, даты и зоны, `mutate`/`markLesson`, `LessonDialogs`, `dvlab:data-changed`, Today, Settings, палитра команд, прибытия по адресу

## Помощники

- Фаза GSD: правила исполнителя — `.planning/EXECUTOR-RULES.md`; охрана корня worktree — `scripts/gsd/root-pin.sh`; режим изоляции перед запуском исполнителей — `scripts/gsd/dispatch.sh <фаза>`.
- Разовый SQL, фикстуры api, браузерные и приёмочные проверки — `scripts/dev-checks/`, каталог и порядок — `scripts/dev-checks/README.md` (в нём раздел «Проверки фазы 25.2»). Браузерные проверки в Firefox — `DEV_CHECK_BROWSER=firefox`.
- Проверка коммита на имена учеников и пакеты импорта — `scripts/privacy-check.mjs` (ставится один раз `node scripts/privacy-check.mjs --install`, список имён обновляется `--refresh` и лежит вне репозитория).
- Подготовка VPS, выкатка, откат, бэкапы и восстановление — `deploy/RUNBOOK.md`.
