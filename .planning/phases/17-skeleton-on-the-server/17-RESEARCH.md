# Phase 17: Skeleton on the Server - Research

**Researched:** 2026-10-09
**Domain:** монорепа Yarn 4 + Turbo (Next 16.4, Hono API, Drizzle v1, PostgreSQL 18), Docker/Caddy на VPS, GitHub Actions + GHCR, бэкапы, жизненный цикл процесса
**Confidence:** HIGH для версий, цепочки сборки, ролей Postgres и остановки процесса (проверены запуском в этой сессии); MEDIUM для Docker/compose/Caddy-TLS/DNS (Docker локально нет, сервера нет — первая настоящая проверка в CI и у владельца)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** База для разработки и тестов на Mac живёт на домашнем сервере владельца в отдельном контейнере `postgres:18` для dv-lab: не в Docker на Mac и не на базе VPS (задержка до Канады около 270 мс на запрос). Адрес, пользователь и пароли ролей лежат только в локальном `.env`, в `.env.example` заглушки (D-11). CI использует свой сервисный контейнер Postgres 18. Контейнера под dv-lab на домашнем сервере ещё нет (проверено 2026-10-09: там только Postgres 16 и 17), его готовит Server guy. — **Reversibility:** reversible — меняется строкой `DATABASE_URL`.
- **D-01a:** `deploy.sh` перед миграциями боевой базы прогоняет их на временной копии на сервере и применяет к основной базе только после успеха (решение владельца, 2026-10-09). Способ копирования (`pg_dump | pg_restore` во временную базу или `CREATE DATABASE … TEMPLATE`, который требует отсутствия других сессий в источнике) выбирает планировщик; копия удаляется после проверки.
- **D-02:** Прокси на сервере — Caddy в контейнере: автоматические сертификаты, HTTP/3 выключен (`servers { protocols h1 h2 }`), наружу опубликованы только 80 и 443, `443/udp` закрыт. — **Reversibility:** costly — от выбора зависят `deploy/`, конфиг прокси и запасной путь через Beget (там тоже Caddy).
- **D-03:** Новая версия попадает на сервер командой `deploy/deploy.sh` вручную после merge в `master`. Таймера автообновления в этой фазе нет. Защита «не выкатывать при активной комнате ielts» добавляется скрипту в фазе 26.
- **D-04:** Ночной `pg_dump` на диск сервера, автобэкап OVH остаётся включённым и шифрованная копия уезжает в S3-совместимое хранилище вне сервера. Владелец один раз восстанавливает последний бэкап (критерий 5). — **Reversibility:** reversible — расписание и хранилище меняются скриптом и ключом на сервере.
- **D-05:** Api пишет одну JSON-строку на запрос с `requestId`. Трассировки (OpenTelemetry) в этой фазе нет; к ней возвращаемся в фазе 22 вместе с чатом.
- **D-06:** Углубить модуль конфигурации и роли подключения к базе отдельным планом до планов, которые трогают env, `packages/db` и CI (см. 17-ARCH-REVIEW.md, находка 1). Один модуль решает, какой URL и под какой ролью (приложение, миграции, тесты) берёт каждая точка входа; неверные `PORT` и `APP_ORIGIN` не подменяются молча. — **Reversibility:** costly — на модуле держатся api, drizzle-конфиг, тесты, CI и `deploy/`.
- **D-07:** Api — отдельный процесс за прокси. В web нет `route.ts` с монтированием api, нет `transpilePackages` и `paths` в исходники api; префикс `/api` и путь health check принадлежат одному месту (см. 17-ARCH-REVIEW.md, находка 2). — **Reversibility:** costly — определяет Dockerfile'ы, маршруты прокси и клиент web.
- **D-08:** Углубить контекст запроса (request id) отдельным планом до планов, которые добавляют логи и обработку ошибок (см. 17-ARCH-REVIEW.md, находка 3). Request id виден логгеру, ошибкам и фоновым задачам; строка доступа содержит id.
- **D-09:** Углубить владельца запуска и остановки процесса api отдельным планом до планов, которые добавляют WebSocket, пул базы или фоновые задачи (см. 17-ARCH-REVIEW.md, находка 4). Сигналы, срок ожидания, закрытие пула и WebSocket — в одном месте. WebSocket-кода в репозитории нет, поэтому скелет добавляет минимальную точку `/ws`, чтобы критерий 5 было чем проверять. — **Reversibility:** costly — на нём держатся фоновые задачи и realtime следующих фаз.
- **D-10:** Шов «память или база» не переносим: адаптера в памяти в скелете нет, тесты идут на настоящем Postgres 18 под ролью без прав суперпользователя (INFRA-02).
- **D-11:** Репозиторий `kdvornichenko/dv-lab` публичный. В нём нет адресов серверов, паролей, ключей и данных учеников: ни в `deploy/`, ни в тестовых данных, ни в `.planning/`, ни в `.env.example`. Данные учеников (фаза 19) в репозиторий не коммитятся.
- **D-12:** `apps/api` остаётся на Hono; логирование, трассировка и миграции закрываются явно (D-05, D-08, INFRA-07).
- **D-13:** База пишется заново на Drizzle v1 с чистой историей миграций; старый `packages/db` и 14 миграций удаляются. PostgreSQL 18; расширения создаёт суперпользователь в init-скрипте, приложение и миграции идут под ролями без прав суперпользователя.
- **D-14:** CI запускается на `pull_request` и на `push` в `master` (сейчас в `ci.yml` стоит `main`, поэтому push в `master` CI не запускает). Образы собирает GitHub Actions и публикует в GHCR; на сервере сборки нет.
- **D-15:** Файлы деплоя лежат в репозитории: `Dockerfile` рядом с кодом (`apps/web`, `apps/api`), остальное в `deploy/` (compose, Caddyfile, скрипты выкатки и бэкапа, юниты systemd, `env.example` без значений). Секреты только на сервере (файлы 600).
- **D-16:** Домен и DNS `dv-lab.dev` остаются в Vercel; записи A и AAAA корня переводятся на VPS, `ielts.dv-lab.dev` продолжает работать на Vercel. Перед переключением TTL понижается, домен снимается с проектов Vercel (`.dev` в HSTS preload: только HTTPS).
- **D-17:** Все библиотеки — на последних версиях (Next 16.4, React 19.3, TypeScript, Turbo, Yarn); старый код не переносится, а пишется заново («переписывать, а не переносить»).

### Claude's Discretion

Владелец не возражал на странице обсуждения; принято по умолчанию.
- В скелете три части: `apps/web`, `apps/api`, `packages/db` (плюс `deploy/` и Dockerfile'ы). Пустых `core` и `contracts` нет; `rbac` и `api-types` удаляются и пишутся заново, когда понадобятся.
- На `dv-lab.dev` до входа (фаза 18): страница-заглушка и открытый `/healthz`.
- Если новейшая версия пакета ломает сборку, типы, линт или тесты, берётся новейшая рабочая, причина записывается в план.
- Образы GHCR публичные: репозиторий публичный, секретов в образах нет; сервер тянет без токена.
- `deploy.sh` по образцу `~/.claude/servers/bio-exam-ops/deploy.sh` (блокировка, журнал): дамп, прогон миграций на временной копии (D-01), миграции основной базы одноразовым сервисом под ролью миграций, перезапуск, health check, откат на прошлый тег при неудаче. Простой в секунды допустим.
- Локальный прогон DB-тестов идёт в отдельной тестовой базе на домашнем сервере под ролью без прав суперпользователя (INFRA-02), на ней же проверяются миграции при разработке.
- Хранение бэкапов: 14 суточных и 8 недельных.
- Тест-раннер, библиотека логов, multi-stage Dockerfile, теги образов по sha, срок ожидания остановки, шрифты без `next/font/google`.
- Старые аудиты в корне (`ARCHITECTURE_REVIEW.md`, `TECH_DEBT_AUDIT.md`, `TECH_DEBT_REMEDIATION_PLAN.md`, `docs/`) удаляются; `AGENTS.md` и `CLAUDE.md` переписываются под новый скелет, блок GitNexus убирается.

### Deferred Ideas (OUT OF SCOPE)

- Внешний мониторинг доступности и оповещения (в том числе о сбое ночного бэкапа) — отдельная идея; в фазе бэкап падает громко (код возврата, состояние юнита).
- Трассировка OpenTelemetry — фаза 22, вместе с чатом.
- Автообновление по таймеру — вернуться в фазе 26, когда появится защита активной комнаты ielts.
- Проверка доступа к OVH из российских сетей — после готовности приложения, до 12-месячного обязательства.
- Превью-окружения на PR — не нужны.
- Очередь `pg-boss` и `LISTEN/NOTIFY` — с чатом и календарём.

Открытые вопросы к владельцу и планировщику из CONTEXT.md (не решения, но рамка):
- Домашний сервер (состояние на 2026-10-09): контейнер `postgres:18` для dv-lab нужно создать. Занятые порты: 5432 (loopback), 55432, 55433 (loopback, владелец не выяснен), 55434. Compose-проекты лежат по образцу `/opt/its-doc`. Нужны: том в `/var/lib/postgresql` (не в `/data`), расширения под суперпользователем в init-скрипте, роли миграций и приложения без прав суперпользователя, база для разработки и отдельная для тестов. Проверку и команды готовит Server guy, выполняет владелец; планы, которым нужна база, ждут этого шага, CI от него не зависит.
- Хранилище для копий вне сервера: провайдер и бакет выбирает владелец при планировании; ключ лежит только на сервере (файл 600).
- Минимальный `/ws` для проверки остановки с открытыми соединениями: форму выбирает планировщик внутри D-09.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Развёрнутый скелет (web, api, Postgres) отвечает по HTTPS на `dv-lab.dev` с VPS OVHcloud. | Caddy (проверен `caddy validate` 2.11.7 и маршрутизация), compose-раскладка, DNS-переключение в Vercel DNS, `/healthz`. Разделы «Caddy», «Server Operations Design». |
| INFRA-02 | Каждый PR и каждый push в `master` запускает CI: typecheck, lint, unit и DB-тесты на PG 18 под той же ролью без прав суперпользователя, что и сервер. | Три роли + идемпотентный `ensure-db.sql` (проверен на PG 17.10), CI-workflow, тест «роль не суперпользователь, DDL запрещён». |
| INFRA-03 | Merge в `master` собирает образы в GHA и публикует в GHCR; сервер тянет и перезапускает без сборки. | Matrix-job images, версии actions, видимость пакета GHCR (private по умолчанию, владелец один раз делает public), `deploy.sh`. |
| INFRA-04 | Бэкапы Postgres по расписанию; восстановление проверено один раз. | `backup.sh` + systemd timer + restic в S3, `restore-check.sh`, сравнение провайдеров. |
| INFRA-05 | Все зависимости на последних стабильных версиях (Next, React, TS, Turbo, Yarn); build/typecheck/tests проходят. | Таблица версий с датами; три отклонения от «последней» с причинами (TS 6.0.3, Drizzle rc.4, правило возраста Yarn). |
| INFRA-06 | API останавливается по `SIGTERM` за ограниченное время даже с открытыми WebSocket. | Прототип остановки (воспроизведено зависание и исправление), встроенный `upgradeWebSocket` из `@hono/node-server` 2.x, `init`/PID 1. |
| INFRA-07 | API пишет структурные логи с request id; миграции — отдельный шаг под ролью миграций. | pino + AsyncLocalStorage (проверено), Caddy перезаписывает `X-Request-Id`, программный мигратор Drizzle в отдельной команде образа. |
| INFRA-08 | Старые `apps` и `packages` удалены, БД переписана на Drizzle v1 с чистой историей, в репозитории только новый код. | Раскладка Drizzle v1 (проверено генерацией), CI-проверка отсутствия старого кода (проверена на текущем репозитории), перечень выживающих корневых файлов. |
</phase_requirements>

## Summary

Фаза — это не «пустой скелет», а шесть связанных систем: цепочка сборки на последних версиях, роли Postgres 18, процесс API с контекстом запроса и остановкой, образы и CI, прокси с HTTPS на VPS, бэкапы. В этой сессии работоспособность цепочки доказана запуском на минимальной монорепе в scratchpad: Yarn 4.18.1 + Next 16.4.0 + React 19.3.0 + TypeScript 6.0.3 + ESLint 10.12.0 + Tailwind 4.3.3 собираются, проходят typecheck и lint, шрифты `geist` не ходят в сеть, `output: 'standalone'` даёт `apps/web/server.js`; api на Hono 4.13.13 + `@hono/node-server` 2.1.4 + Drizzle `1.0.0-rc.4` + `pg` собирается `tsdown`, мигрирует под ролью миграций, пишет под ролью приложения и тестируется Vitest 5.0.3. Роли и права проверены на локальном PostgreSQL 17.10 (PG 18 локально нет — см. Environment Availability).

Три «последних» версии пришлось обойти, и план обязан записать причины (CONTEXT: «берётся новейшая рабочая»): (1) **TypeScript 6.0.3 вместо 7.0.2**: `typescript-eslint` 8.71.1 падает на TS 7 жёсткой ошибкой, `tsup --dts` падает (оба вывода ниже); (2) **Drizzle `1.0.0-rc.4`**: v1 ещё не вышел стабильным, dist-tag `latest` указывает на 0.45.4, а владелец зафиксировал v1 (D-13); (3) **Yarn 4.18 отказывается ставить пакеты младше 24 часов** (`npmMinimalAgeGate: 1440`): «последняя» = новейшая версия, опубликованная ≥ 24 ч назад (vite 8.3.4 и knip 6.41.0 были отвергнуты, взяты 8.3.3 и 6.40.0). Дополнительно: `@hono/node-ws` 1.3.1 несовместим по peer с `@hono/node-server` 2.x и не нужен — WebSocket встроен в `@hono/node-server` 2.x.

Остановка процесса воспроизведена: «наивный» `server.close()` при открытом WebSocket не выходит за 8 секунд (в проде — до `stop_grace_period`, это и есть ловушка из профиля сервера). Спроектированная остановка (закрыть idle, закрыть WS кодом 1001, ждать drain с жёстким дедлайном, закрыть пул, выйти) завершилась за 17 мс без запросов и за 1,5 с с зависшим запросом. Контекст запроса на `AsyncLocalStorage` виден логгеру, в том числе в фоновом `setTimeout` после ответа. Пробы PG показали: `CREATE DATABASE … TEMPLATE` падает при любой другой сессии в источнике (`is being accessed by other users`), поэтому прогон миграций (D-01a) делается через `pg_restore` предвыкатного дампа во временную базу — один дамп служит и бэкапом, и репетицией.

**Легенда провенанса.** «Проверено пробой» в тексте = `[VERIFIED: scratchpad probe 2026-10-09]` (запуск в этой сессии); «проверено на PG 17.10» = `[VERIFIED: local PG 17.10 probe]` (не PG 18); версии и даты публикации = `[VERIFIED: npm view 2026-10-09]`; цитаты из `node_modules`/пакетов = `[VERIFIED: путь:строки]` с дословным текстом рядом; всё, что взято из документации без запуска, помечено `[CITED: url]`; всё остальное — `[ASSUMED]` (сводка в Assumptions Log). Все строки с вердиктом SUS в Standard Stack несут `[WARNING: flagged as suspicious — verify before using.]`: причина только `too-new`/`unknown-downloads` (не новый пакет), см. Package Legitimacy Audit и A10.

**Primary recommendation:** Строить фазу в порядке «зависимости → модули-владельцы (D-06, D-08, D-09) → образы/CI → `deploy/` и серверные шаги владельца». Фиксировать точные версии из таблицы Standard Stack (без `^`), использовать TypeScript 6.0.3, Drizzle `1.0.0-rc.4`, встроенный WebSocket `@hono/node-server` 2.1.4 и программный мигратор Drizzle в отдельной команде образа api; роли Postgres создавать одним идемпотентным `deploy/postgres/ensure-db.sql`, который вызывают и init-скрипт контейнера, и `deploy.sh`, и CI.

## Project Constraints (from CLAUDE.md)

Репозиторный `./CLAUDE.md` (блок GitNexus) устарел и перепишется в этой фазе (CONTEXT, Discretion); по указанию владельца следовать ему не нужно. Действуют директивы из глобального `~/.claude/CLAUDE.md` и инструкций запуска:

- **Без комментариев в коде** нигде (TS, SQL, shell, YAML, Caddyfile, Dockerfile). Примеры в этом документе даны без комментариев; пояснения вынесены в прозу.
- **GSD не коммитит**: исполнители оставляют изменения в рабочем дереве и сообщают «готово к коммиту».
- **Минимальное решение**: никаких новых компонентов, обёрток, скриптов и абстракций сверх нужного; если считаешь нужным — предложи одной фразой.
- **Сначала готовое**: для UI — готовый компонент библиотеки проекта; в этой фазе UI — только страница-заглушка.
- **«Готово» для UI — после проверки в браузере** (страница-заглушка на `dv-lab.dev` проверяется открытием в браузере).
- **Агентам нет доступа к серверу**: все серверные шаги — владельцу (сессия «Server guy»); команды даются готовыми блоками.
- **Репозиторий публичный (D-11)**: ни адресов, ни паролей, ни ключей; в этом документе IP/имена хостов VPS и домашнего сервера намеренно заменены плейсхолдерами `<VPS_IPV4>`, `<VPS_IPV6>`, `<HOME_SERVER>`.
- **Блоки команд для сервера**: правила `pipefail`/`grep` и «`( … ) || echo` отключает `set -e`» из профилей серверов; в проверках с `curl -u` печатать только `%{http_code}`.
- **Язык**: интерфейс и продуктовые тексты — английский; документы и ответы владельцу — русский.
- **Сообщения коммитов** (когда владелец попросит): стиль из `git log`, одна строка по-русски.
- **Журнал решений**: решения по ходу фазы сохраняются в память проекта (делает ведущая сессия).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TLS, редиректы http→https, HSTS, сжатие, маршрутизация `/api`, `/ws`, `/healthz` | Прокси (Caddy) | — | Единственный публичный процесс; префикс `/api` принадлежит только ему (D-07, находка 2) |
| Страница-заглушка, будущие экраны | Frontend Server (Next standalone) | Browser | Web не знает про БД и код api; общается с api только по HTTP через префикс |
| Бизнес-логика, health, `/ws`, логи, остановка | API (Hono, отдельный процесс) | — | Единый владелец запуска/остановки (D-09) и контекста запроса (D-08) |
| Выбор URL БД и роли, валидация env | `packages/db` (роль → URL) + `apps/api/src/config` (остальной env) | — | Один модуль на правило (D-06); web БД не касается |
| Схема и миграции | `packages/db` (Drizzle) → применяются командой `migrate` образа api под ролью миграций | Database | Миграции — отдельный шаг, отдельная роль (INFRA-07) |
| Роли, права, расширения | Database (init/`ensure-db.sql`, суперпользователь) | CI (тот же файл) | Расширения только суперпользователем (D-13) |
| Сборка и публикация образов | CI (GitHub Actions) | GHCR | Сборки на сервере нет (D-14) |
| Выкатка, откат, репетиция миграций | Скрипт `deploy/deploy.sh` на VPS | Docker Compose | Ручной запуск после merge (D-03) |
| Бэкапы и проверка восстановления | systemd timer + restic на VPS | S3-хранилище вне сервера | D-04 |
| DNS | Vercel DNS (владелец) | — | D-16, шаги владельца |

## Standard Stack

### Core

Все версии подтверждены `npm view` 2026-10-09 (дата публикации в скобках). Колонка «Seam» — вердикт `gsd-tools query package-legitimacy check` (подробности и оговорка в Package Legitimacy Audit).

| Library | Version (pin) | Purpose | Why standard / примечание | Seam |
|---------|---------|---------|--------------|------|
| node (рантайм образов, CI) | 24.21.0 (LTS «Krypton», 2026-09-07) | рантайм | LTS; 26.11.1 — «Current» (`lts: false` в `nodejs.org/dist/index.json`); ielts на `24.x` | — |
| yarn | 4.18.1 (2026-09-24) | менеджер пакетов | в репозитории 4.14.1; `yarn set version 4.18.1` | — |
| turbo | 2.11.7 (2026-10-02) | оркестрация задач | установка и `turbo prune --docker` проверены | SUS (too-new, unknown-downloads) |
| typescript | **6.0.3** | компилятор | **не 7.0.2** — см. «Version Decisions» | SUS (unknown-downloads) |
| next | 16.4.0 (2026-10-06) | web | цель владельца; build/standalone проверены | SUS (too-new) |
| react, react-dom | 19.3.0 (2026-09-09) | UI | цель владельца | SUS (too-new) |
| @types/react, @types/react-dom | 19.3.0 | типы | совпадают с React | SUS |
| hono | 4.13.13 (2026-10-04) | HTTP-фреймворк api | D-12 | SUS (too-new) |
| @hono/node-server | **2.1.4** (2026-10-08) | запуск Hono на Node + встроенный WebSocket | `latest-1` = 1.19.17 | SUS (too-new) |
| ws | 8.22.0 (2026-09-26) | WebSocket-сервер для `upgradeWebSocket` | требуется README node-server 2.x | SUS (too-new) |
| drizzle-orm, drizzle-kit | **1.0.0-rc.4** (2026-06-27, dist-tag `rc`) | ORM, миграции | D-13 требует v1; `latest` = 0.45.4 | SUS (too-new) |
| pg | 8.23.1 (2026-09-30) | драйвер Postgres | пара с Drizzle (`drizzle-orm/node-postgres`); ielts на том же | SUS (too-new) |
| zod | 4.6.5 (2026-09-13) | валидация env и тел запросов | пара с Drizzle (peer `^3.25 \|\| ^4`) | SUS (too-new) |
| pino | 10.4.0 (2026-10-02) | JSON-логгер | `mixin` + AsyncLocalStorage проверены | SUS (too-new) |
| tsdown | 0.23.0 (2026-09-03) | сборка api в `dist/` | замена `tsup` (README tsup: «not actively maintained anymore»); сборка проверена | OK |
| vitest | 5.0.3 (2026-09-30) | тест-раннер | DB-тест через workspace-пакет прошёл | SUS (too-new) |
| vite | **8.3.3** (2026-10-06) | обязательный peer vitest 5 | 8.3.4 отвергнут возрастом | SUS (too-new) |
| tailwindcss, @tailwindcss/postcss | 4.3.3 | стили заглушки (Tailwind 4 уже в репозитории) | сборка проверена | OK / SUS (unknown-downloads) |
| postcss | 8.5.28 (на 8.5.29 вышла 2026-10-05; допустима любая ≥24 ч) | peer Tailwind | — | SUS |
| geist | 1.7.2 (2026-06-01) | шрифты без `next/font/google` | сборка Next без обращения к Google проверена | OK |
| @types/node | 24.19.1 | типы | версия типов = минимальный рантайм (Node 24), не 26.6.4 | SUS |
| @types/pg | 8.23.1 | типы | — | OK |
| @types/ws | 8.18.2 | типы | — | SUS |
| eslint | 10.12.0 (2026-10-02) | линт | оговорка: peer части плагинов — до 9 (см. ниже) | SUS |
| eslint-config-next | 16.4.0 | правила Next (flat config `core-web-vitals`, `typescript`) | — | SUS |
| knip | **6.40.0** (6.41.0 отвергнут возрастом) | мёртвый код и зависимости | проверен запуск | SUS |
| prettier | 3.9.9 | формат | — | SUS |
| @trivago/prettier-plugin-sort-imports, prettier-plugin-tailwindcss | 6.0.2, 0.8.1 | существующие плагины | peer `prettier` 3 — подходят | не проверялись seam |

### Version Decisions (причины отклонений от «последней»; план обязан их записать)

1. **TypeScript 6.0.3, а не 7.0.2 (последняя стабильная, 2026-07-08).** Пробы в scratchpad с `typescript@7.0.2` и `--legacy-peer-deps`:
   - `npm i -D typescript@7.0.2 typescript-eslint@8.71.1 …` → `ERESOLVE` (peer `typescript-eslint` 8.71.1 — `">=4.8.4 <6.1.0"`, прочитано `npm view`).
   - `eslint` с `@typescript-eslint/parser` 8.71.1: `Error: typescript-eslint does not support TS 7.0.` (ссылка в выводе: `github.com/typescript-eslint/typescript-eslint/issues/10940`, поддержка — после TS 7.1).
   - `tsup src/index.ts --dts` с TS 7.0.2: `TypeError: Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')` (падение в rollup-plugin-dts).
   - `tsc --noEmit` на TS 7.0.2 проходит (rc=0), Next 16.4 поддерживает TS 7 через `experimental.useTypeScriptCli` (включено по умолчанию) `[CITED: nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli]`.
   - Microsoft: у TS 7.0 нет программного API, ждут 7.1 `[CITED: devblogs.microsoft.com/typescript/announcing-typescript-7-0]`.
   - Пока в web используется `typescript-eslint` (через `eslint-config-next`), пакет `typescript` обязан быть 6.x. TS 6.0.3 — это же версия, на которой работает ielts (`"typescript": "6.0.3"` в `/Volumes/T7/personal/ielts/package.json`). Пересмотреть при выходе TS 7.1 + поддержки typescript-eslint. Опциональная схема «TS 7 для `tsc` + алиас TS 6 для инструментов» (`"typescript": "npm:@typescript/typescript6@^6.0.2"` + `"@typescript/native": "npm:typescript@^7.0.2"`, из блога TS) в фазе не нужна: выигрыш — скорость, цена — две копии компилятора.
2. **Drizzle `1.0.0-rc.4`.** Теги: `latest` = `0.45.4`, `rc` = `1.0.0-rc.4`, `beta` = `1.0.0-beta.22`; есть и снапшот `rc5` (`1.0.0-rc.5-5935859`, хэш-суффикс — не брать). D-13 требует v1 → брать ровно `1.0.0-rc.4` (без `^`: pre-release) для `drizzle-orm` и `drizzle-kit`; ielts в проде на той же версии. Изменение API v1, на которое наткнулась проба: `drizzle({ client: pool, schema })` не компилируется (TS2345), в v1 вместо `schema` — `relations`; скелету связи не нужны, достаточно `drizzle({ client: pool })`.
3. **Возрастной барьер Yarn 4.18.** `yarn config get npmMinimalAgeGate` → `1440` (минуты). Вывод установки: `YN0016: │ vite@npm:8.3.4: All versions satisfying "8.3.4" are quarantined` и то же для `knip@npm:6.41.0` (опубликованы <24 ч до проверки). Правило для плана: перед фиксацией версии проверять `npm view <pkg> time`; брать новейшую версию с возрастом ≥24 ч; не отключать барьер (это защита цепочки поставок); для срочного исключения есть `npmPreapprovedPackages` — решение владельца. Версии `@hono/node-server` 2.1.4 (28 ч на момент проверки) и `next` 16.4.0 проходят. К моменту исполнения плана часть «последних» может измениться — планировщику сверить таблицу командой `npm view` и датами.
4. **`@hono/node-ws` не используется.** Его `peerDependencies`: `"@hono/node-server": "^1.19.11"` (прочитано в `package.json` 1.3.1) — конфликт с 2.1.4. Не нужен: README `@hono/node-server` 2.1.4: «You can upgrade WebSocket connections with `upgradeWebSocket` from `@hono/node-server`. To enable this, install `ws` (and `@types/ws`) in your project…», пример `serve({ fetch: app.fetch, websocket: { server: wss } })`, тип `websocket?: { server: WebSocketServerLike }` в `dist/index.d.mts`.
5. **ESLint 10.12.0 принят условно.** `eslint-plugin-react` 7.37.5 (peer `^9.7`), `eslint-plugin-jsx-a11y` 6.10.2 (`^9`), `eslint-plugin-import` 2.32.0 (`^9`) формально не поддерживают ESLint 10; `yarn install` даёт `YN0060`/`YN0086` (предупреждения, не ошибки). Проверено: конфиг `eslint-config-next/core-web-vitals` + `/typescript` загружается и линтует тестовые файлы (предупреждение `@next/next/no-img-element` сработало, ошибок 0). Покрытие всех правил не доказано. Запасной вариант: ESLint `9.39.5` (dist-tag `maintenance`). Планировщику: принять ESLint 10 и при первой реальной ошибке плагина откатиться на 9.39.5 с записью причины.
6. **`tsup` не используется** (не поддерживается, ломается на TS 7); **`tsx`/`dotenv` не нужны**: Node 24 исполняет `.ts` напрямую, в т.ч. TS из workspace-пакета через symlink (проба: `node src/server.ts` импортировал `@dv-lab/db` и выполнил запрос), env — флагом `node --env-file-if-exists=…` (приём ielts: `"db:migrate": "node --env-file-if-exists=.env.local …"`).

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| restic | 0.19.1 (GitHub, 2026-07-05); на сервере допустим пакет Ubuntu (так на bio-exam) | шифрованные бэкапы в S3 | `deploy/backup/backup.sh` |
| caddy (образ) | `caddy:2.11.7` (2026-10-06) | прокси | compose + `caddy validate` в CI |
| postgres (образ) | `postgres:18` (на 2026-10-07 тег `18.6`) | БД на VPS, домашний сервер, CI | том `/var/lib/postgresql` |
| node (образ) | `node:24.21.0-slim` | база образов web и api | есть теги `24.21.0-slim`, `-trixie-slim`, `-alpine` |
| portless | 0.15.7 (в репозитории `^0.12.0`) | локальные именованные адреса (`portless dv-lab turbo run dev`) | существующий инструмент владельца; `engines.node >=24`; сверить, что `yarn dev` работает |
| actions/checkout | v7 (7.0.1) | GHA | — |
| actions/setup-node | v7 (7.1.0) | GHA | `cache: yarn` |
| docker/setup-buildx-action | v4 (4.4.1) | GHA | — |
| docker/login-action | v4 (4.6.0) | GHA | вход в GHCR |
| docker/metadata-action | v6 (6.2.0) | GHA | теги и labels |
| docker/build-push-action | v7 (7.4.0) | GHA | сборка, push, кэш `type=gha` |

Версии actions — `gh api repos/<repo>/releases/latest` 2026-10-09. Плавающие теги мажора (`@v7`) допустимы; закрепление по SHA — опция усиления.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsdown | esbuild-скрипт | esbuild стабильнее (0.28.2), но externals/бандл workspace-пакетов пишется вручную; tsdown (0.x) проверен в пробе и сам внешне держит `dependencies`, а `@dv-lab/*` вшивает через `deps.alwaysBundle` |
| Vitest 5 | `node:test` | `node:test` не требует vite, но тесты в `apps/api`, импортирующие workspace-TS, и будущие компонентные тесты проще на Vitest; цена — обязательный peer `vite` |
| pino | `hono/logger` | `hono/logger` печатает текст, не JSON, и не знает про контекст |
| Свой ALS-модуль контекста | `hono/context-storage` + `hono/request-id` | встроенные хранят `Context` Hono и недоступны вне запроса и фоновым задачам по смыслу D-08; свой ALS хранит только `{ requestId }` |
| restic | `rclone crypt`; `age` + `aws s3 cp` | restic: шифрование, дедупликация, `forget --keep-daily/--keep-weekly`, `check` в одном инструменте (владелец уже использует на bio-exam). rclone crypt — только шифрованная синхронизация без снимков и политики хранения. `age`+`aws s3` — просто, но срок хранения придётся делать lifecycle-правилами бакета и скриптом |
| CREATE DATABASE … TEMPLATE | `pg_dump \| pg_restore` во временную базу | TEMPLATE падает при любой чужой сессии (воспроизведено) — работающий api держит пул; выбран `pg_restore` |
| `drizzle-kit migrate` в проде | программный `migrate()` из `drizzle-orm/node-postgres/migrator` | kit тянет esbuild и конфиг-загрузчик в образ; программный вариант — только `drizzle-orm` + папка SQL; kit остаётся для `generate` в разработке |

**Installation (корень):**
```bash
corepack enable
corepack yarn@4.18.1 set version 4.18.1
yarn add -D -W turbo@2.11.7 typescript@6.0.3 eslint@10.12.0 prettier@3.9.9 knip@6.40.0
yarn workspace @dv-lab/api add hono@4.13.13 @hono/node-server@2.1.4 ws@8.22.0 pino@10.4.0 zod@4.6.5 pg@8.23.1 drizzle-orm@1.0.0-rc.4
yarn workspace @dv-lab/api add -D tsdown@0.23.0 vitest@5.0.3 vite@8.3.3 @types/ws@8.18.2 @types/pg@8.23.1 @types/node@24.19.1
yarn workspace @dv-lab/db add drizzle-orm@1.0.0-rc.4 pg@8.23.1 zod@4.6.5
yarn workspace @dv-lab/db add -D drizzle-kit@1.0.0-rc.4 vitest@5.0.3 vite@8.3.3 @types/pg@8.23.1 @types/node@24.19.1
yarn workspace @dv-lab/web add next@16.4.0 react@19.3.0 react-dom@19.3.0 geist@1.7.2
yarn workspace @dv-lab/web add -D eslint-config-next@16.4.0 eslint@10.12.0 tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3 postcss@8.5.28 @types/react@19.3.0 @types/react-dom@19.3.0 @types/node@24.19.1
```
Имя области `@dv-lab/*` — рекомендация (см. Runtime State Inventory и Open Questions, Q1). Версии `vitest`/`vite`/`pg` в `packages/db` нужны, если DB-тесты лежат там.

**Version verification:** выполнено `npm view <pkg> version time` 2026-10-09 для каждой строки таблицы; даты публикации — в таблице и Version Decisions. Образы: Docker Hub API (`caddy` 2.11.7 — 2026-10-06; `postgres` 18.6 — 2026-10-07; `node` 24.21.0-slim). Секретов в команде нет.

## Package Legitimacy Audit

Команда: `gsd-tools query package-legitimacy check --ecosystem npm …` (2026-10-09).

| Package | Registry | Latest published | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| hono | npm | 2026-10-04 | 73 млн | github.com/honojs/hono | SUS (too-new) | Approved с оговоркой ниже |
| @hono/node-server | npm | 2026-10-08 | 68 млн | github.com/honojs/node-server | SUS (too-new) | Approved с оговоркой |
| ws | npm | 2026-09-26 | 283 млн | github.com/websockets/ws | SUS (too-new) | Approved с оговоркой |
| @types/ws | npm | 2026-09-29 | 77 млн | DefinitelyTyped | SUS (too-new) | Approved с оговоркой |
| drizzle-orm / drizzle-kit | npm | 2026-10-08 / 2026-09-21 | 27 млн / 22 млн | github.com/drizzle-team/drizzle-orm | SUS (too-new) | Approved с оговоркой (ставится `rc.4` из 2026-06-27) |
| pg | npm | 2026-09-30 | 63 млн | github.com/brianc/node-postgres | SUS (too-new) | Approved с оговоркой |
| @types/pg | npm | 2026-08-17 | 65 млн | DefinitelyTyped | OK | Approved |
| zod | npm | 2026-09-13 | 324 млн | github.com/colinhacks/zod | SUS (too-new) | Approved с оговоркой |
| pino | npm | 2026-10-02 | 53 млн | github.com/pinojs/pino | SUS (too-new) | Approved с оговоркой |
| vitest / vite | npm | 2026-09-30 / 2026-10-08 | 122 млн / 194 млн | github.com/vitest-dev/vitest, vitejs/vite | SUS (too-new) | Approved с оговоркой (vite 8.3.3) |
| tsdown | npm | 2026-09-03 | 4,2 млн | github.com/rolldown/tsdown | OK | Approved |
| geist | npm | 2026-06-01 | 2,6 млн | github.com/vercel/geist-font | OK | Approved |
| tailwindcss | npm | 2026-07-16 | 135 млн | github.com/tailwindlabs/tailwindcss | OK | Approved |
| @tailwindcss/postcss | npm | 2026-07-16 | н/д | tailwindlabs/tailwindcss | SUS (unknown-downloads) | Approved с оговоркой |
| eslint, eslint-config-next, next, react, react-dom | npm | 2026-10-02…09-09 | 163 млн … 36 млн | github.com/eslint/eslint, vercel/next.js, react/react | SUS (too-new) | Approved с оговоркой |
| knip | npm | 2026-10-09 | 17 млн | github.com/webpro-nl/knip | SUS (too-new) | Approved (ставится 6.40.0) |
| typescript, turbo, postcss, prettier, @types/node, @types/react, @types/react-dom | npm | 2026-07…10 | н/д | microsoft/TypeScript, vercel/turborepo, … | SUS (unknown-downloads / too-new) | Approved с оговоркой |
| @hono/node-ws | npm | 2026-05-01 | н/д | github.com/honojs/middleware | SUS (unknown-downloads) | NOT USED (конфликт peer) |
| tsup | npm | 2025-11-12 | н/д | github.com/egoist/tsup | SUS (unknown-downloads) | NOT USED (не поддерживается) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** почти все прямые зависимости. Причины только две — `too-new` (последний релиз опубликован недавно; у всех десятки/сотни миллионов загрузок в неделю и официальные репозитории) и `unknown-downloads` (seam не получил статистику). Ни один не «новый пакет». Рекомендация планировщику: вместо `checkpoint:human-verify` на каждый пакет поставить **один** checkpoint после первого `yarn install` — владелец просматривает diff `yarn.lock` и список прямых зависимостей; дополнительную защиту даёт возрастной барьер Yarn (24 ч) и `--immutable` в CI. Это отклонение от буквы протокола (checkpoint на каждый SUS) вынесено на решение (Assumptions Log A10).
*Имена пакетов взяты из существующих зависимостей репозитория/ielts, README `@hono/node-server`, документации Next/Turbo и Vitest; ни один не получен из слепого веб-поиска.*

## Architecture Patterns

### System Architecture Diagram

```
Internet (IPv4 + IPv6)                           GitHub
   |                                      push/PR  |
   | :80, :443/tcp  (443/udp закрыт)               v
   v                                       +---------------+   merge to master
+------------------+                       |  CI (Verify)  |------------------+
|  Caddy 2.11.7    |  TLS (Let's Encrypt)  |  PG18 service |                  v
|  h1 + h2 only    |                       +---------------+        +------------------+
|  X-Request-Id := |                                                |  GHCR images     |
|  {http.request   |                                                |  web/api :sha-…  |
|   .uuid}         |                                                +--------+---------+
+---+----+----+----+                                                         |
    |    |    |                                                  docker pull  | (владелец запускает
    |    |    +--> /healthz  ---------> api:4000 /healthz                     |  deploy/deploy.sh)
    |    +-------> /ws  --------------> api:4000 /ws   (upgrade)             v
    |    +-------> /api/*  (prefix stripped) -> api:4000 /<rest>      +---------------------+
    +------------> всё остальное ------> web:3000 (Next standalone)   |  VPS (Docker)       |
                                                                      |  caddy web api db   |
 api:4000 (Hono, node dist/server.mjs, PID 1 = tini via init:true)    +---------------------+
   request-context (ALS) -> pino JSON line per request {requestId,...}
   shutdown owner: SIGTERM -> readiness 503 -> close idle -> WS 1001 -> drain
                   (deadline) -> pool.end() -> exit
   db pool (role dv_app) ----------------------------> db:5432 (postgres:18)

 migrate (one-shot, same api image, profile tools) -- role dv_migrator --> db
 ensure-db.sql (superuser; roles, DB, extensions, default privileges) -> init + deploy + CI

 pg_dump (nightly, systemd timer) -> /opt/dv-lab/backups/db -> restic -> S3 outside the VPS
```

Поток основного сценария: запрос → Caddy (перезаписывает `X-Request-Id`) → web или api → api открывает ALS-контекст с `requestId` → обработчик/БД → одна JSON-строка доступа с `requestId` → ответ с заголовком `x-request-id`.

### Recommended Project Structure

```
apps/
├── web/                    # Next 16.4, standalone, geist; нет route.ts с монтированием api (D-07)
│   ├── Dockerfile
│   ├── app/{layout.tsx,page.tsx,globals.css}
│   ├── lib/endpoints.ts    # единственное место web, знающее '/api' и '/ws'
│   └── public/             # должен существовать (COPY в образе)
└── api/
    ├── Dockerfile
    ├── tsdown.config.ts
    ├── src/
    │   ├── config.ts            # env-контракт (zod), вызывает resolveDatabaseUrl из @dv-lab/db
    │   ├── request-context.ts   # ALS + middleware + createLogger
    │   ├── lifecycle.ts         # владелец запуска/остановки
    │   ├── app.ts               # createApp({ ... }) без побочных эффектов при импорте
    │   ├── routes/{health.ts,ws.ts}
    │   ├── server.ts            # точка входа: composition root
    │   └── migrate-cli.ts       # точка входа миграций (роль migrator)
    └── test/                    # vitest: unit + spawn built process
packages/
└── db/                     # JIT-пакет: exports -> ./src/*.ts, без dist и dts
    ├── src/{index.ts,schema.ts,connection.ts,migrate.ts}
    ├── drizzle/<ts>_<name>/{migration.sql,snapshot.json}
    └── drizzle.config.ts
deploy/
├── compose.yaml
├── caddy/Caddyfile
├── postgres/{ensure-db.sql,ensure-db.sh}
├── dev-db/compose.yaml          # шаблон для домашнего сервера, без адресов
├── deploy.sh
├── backup/{backup.sh,restore-check.sh}
├── systemd/dv-lab-backup.{service,timer}
├── install.sh                   # идемпотентная установка юнитов (владелец)
├── env.example                  # имена переменных без значений
└── RUNBOOK.md                   # шаги владельца: сервер, DNS, GHCR, восстановление
.github/workflows/ci.yml
.dockerignore  turbo.json  package.json  tsconfig.base.json  .yarnrc.yml  .yarn/releases/yarn-4.18.1.cjs
.prettierrc.json  .prettierignore  knip.json  .gitignore  .env.example
```

### Pattern 1: JIT внутренний пакет `packages/db` (убирает «пять мест подключения пакета»)
**What:** `package.json` пакета: `"exports": { ".": "./src/index.ts", "./migrate": "./src/migrate.ts" }`, без `dist`, без `dts`, без `paths` в tsconfig. Потребители: api собирается `tsdown` с `deps: { alwaysBundle: [/^@dv-lab\//] }` и вшивает исходники пакета; typecheck идёт через `moduleResolution: bundler` по `exports`; Vitest и `node src/server.ts` исполняют TS напрямую. Web `@dv-lab/db` не импортирует. Это закрывает «Вне находок» ARCH-REVIEW (подключение пакета в `tsconfig.base.json`, `tsup.config.ts`, `knip.json`, `next.config.ts` — больше не нужно).
**Why verified:** сборка `tsdown` вшила пакет и дала `dist/server.mjs`/`dist/migrate.mjs`; `tsc --noEmit` в api и db — rc=0; `vitest run` с импортом пакета — passed; `node src/server.ts` — работает (все импорты в пакете с расширением `.ts`, нужны `allowImportingTsExtensions` + `verbatimModuleSyntax` + `erasableSyntaxOnly`).
**Конфигурация tsconfig пакетов (рабочая в пробе):**
```json
{"compilerOptions":{"target":"ES2023","module":"esnext","moduleResolution":"bundler","strict":true,"noEmit":true,"skipLibCheck":true,"types":["node"],"allowImportingTsExtensions":true,"verbatimModuleSyntax":true,"erasableSyntaxOnly":true}}
```

### Pattern 2: Один модуль «роль → URL базы» + один env-контракт api (D-06)
**What:** `packages/db/src/connection.ts` экспортирует `resolveDatabaseUrl(role: 'app' | 'migrator', env)`: роль `app` читает `DATABASE_URL`, `migrator` — `MIGRATOR_DATABASE_URL`; пустая/отсутствующая переменная — ошибка с именем переменной без значения; других читателей этих имён в репозитории нет (drizzle-конфиг, миграции, тесты, api вызывают эту функцию). Для тестов отдельной роли в коде нет: тесты запускаются с `NODE_ENV=test`, роли те же (`app` — для кода под тестом, `migrator` — для подготовки/очистки данных), а защита от прогона по «не той» базе: при `NODE_ENV=test` имя базы обязано оканчиваться на `_test`, кроме `CI=true`. `apps/api/src/config.ts` валидирует остальное через zod 4 и возвращает типизированный объект; вызывается только из `server.ts`/`migrate-cli.ts`, а не при импорте. Загрузка `.env` — только флагом Node `--env-file-if-exists=../../.env` в dev-скриптах; в образе env приходит от compose. `dotenv` и пути от `import.meta.url` отсутствуют, что устраняет дефект `dist/` из находки 1.
**Проверено (zod 4.6.5, probe):** `PORT=abc` → `Invalid input: expected number, received NaN`; `PORT=''` → `Too small: expected number to be >=1`; `PORT=70000` → `Too big`; `APP_ORIGIN=https://dv-lab.dev/x` → `APP_ORIGIN must be an origin without path`; `APP_ORIGIN=dv-lab` → `Invalid URL`. Тихих подмен (`.catch(4000)`) нет.
**Turbo:** строгий режим скрывает от задач переменные, не объявленные в `env`/`globalEnv`/`passThroughEnv`; проба без `globalPassThroughEnv`: DB-тест упал `Error: connect ECONNREFUSED ::1:5432`, с ним прошёл. Поэтому в `turbo.json` — `globalPassThroughEnv` (не хэшируются): `CI`, `DATABASE_URL`, `MIGRATOR_DATABASE_URL`, `APP_ORIGIN`, `PORT`, `LOG_LEVEL`, `SHUTDOWN_DEADLINE_MS`; секретов в `globalEnv` нет (иначе значения влияют на хэш кэша). Сборка web не читает env (рантайм-значения идут через compose), поэтому `build` гермитичен; `NEXT_PUBLIC_*` Turbo выводит сам для Next `[CITED: turborepo.dev/docs/crafting-your-repository/using-environment-variables]`. Новые Turbo-задачи: `typecheck`, `lint`, `test` зависят от `^build` только если пакеты отдают `dist`; при JIT-пакетах зависимость `^build` можно убрать (ускорение) — планировщику решить; текущая схема тоже работает.

### Pattern 3: Три роли Postgres и идемпотентный `ensure-db.sql` (D-13, INFRA-02)
**What:** один файл, выполняемый суперпользователем, идемпотентный, вызываемый из трёх мест: init контейнера (`/docker-entrypoint-initdb.d/10-ensure-db.sh`), `deploy.sh` (перед миграциями — чтобы добавить расширение позже без пересоздания тома: init-скрипты Docker «only run if you start the container with a data directory that is empty» `[CITED: hub.docker.com/_/postgres]`), CI-шаг `psql -f`.
Роли: `dv_migrator` (LOGIN, не суперпользователь, **владелец базы**, выполняет DDL), `dv_app` (LOGIN, не суперпользователь, только DML через default privileges), суперпользователь `postgres` (расширения, бэкап/restore). «Тестовой» роли как отдельного пользователя нет: тесты идут под `dv_app` (то же, что сервер) и `dv_migrator` (подготовка); базы разные (`dv_lab`, `dv_lab_dev`, `dv_lab_test`).
Имена `dv_migrator`, `dv_app`, `dv_lab*` — предложение; в них нет секретов.
**Проверено на локальном PostgreSQL 17.10 (не 18) `[VERIFIED: local PG 17.10 probe]`:**
- повторный запуск скрипта безопасен (`CREATE EXTENSION IF NOT EXISTS` → NOTICE `already exists, skipping`);
- `dv_migrator` создаёт схему `drizzle` и таблицы в `public`; `dv_app` читает/пишет таблицы и последовательности (default privileges работают), но `CREATE TABLE` → `ERROR: permission denied for schema public`, `TRUNCATE` → `permission denied for table app_info`, `SELECT * FROM drizzle.__drizzle_migrations` → `permission denied for schema drizzle`;
- **ловушка `pg_trgm`-типа воспроизведена на `hstore`**: расширение, созданное `dv_migrator`, владеет им он, но функции принадлежат `postgres` (`proowner` = `postgres`), и `ALTER EXTENSION hstore SET SCHEMA drizzle` → `ERROR: must be owner of type hstore`. Вывод: `CREATE EXTENSION` только в `ensure-db.sql` под суперпользователем; в миграциях Drizzle `CREATE EXTENSION` не писать (если написать с `IF NOT EXISTS` — безопасно только при уже созданном расширении);
- `CREATE SCHEMA IF NOT EXISTS "drizzle"` под ролью без права CREATE на базе падает даже при существующей схеме: `permission denied for database dv_lab_dev` — миграции обязаны идти под владельцем базы.
Следствие для тестов: `dv_app` не может `TRUNCATE`; очистку данных между тестами делать под `dv_migrator` либо откатываемыми транзакциями.
**CI:** сервисный контейнер `postgres:18` не принимает файлы из репозитория, поэтому шаг `psql` с runner'а (на `ubuntu-latest` есть клиент) выполняет тот же `deploy/postgres/ensure-db.sql` с тестовыми паролями — роли в CI идентичны серверным.
**Пароли:** генерировать `openssl rand -hex 24` (без символов, требующих URL-кодирования: URL собирается в compose подстановкой).
**Неподтверждено:** сам образ `postgres:18` и путь тома `/var/lib/postgresql` — `[CITED: hub.docker.com/_/postgres]` («PGDATA is version-specific from PostgreSQL 18»; «The VOLUME moved in 18+», монтировать `/var/lib/postgresql`); совместимость `drizzle-orm`/`pg` с самим PG 18 локально не проверялась (нет PG 18) — первая проверка в CI.

### Pattern 4: Drizzle v1 — раскладка, генерация, применение
**Раскладка `[VERIFIED: scratchpad probe 2026-10-09, drizzle-kit generate rc.4]`:** `drizzle/<YYYYMMDDHHmmss, UTC>_<name>/migration.sql` + `snapshot.json`; файла `meta/_journal.json` нет. Читатель `[VERIFIED: /Volumes/T7/personal/ielts/node_modules/drizzle-orm/migrator.js:7-36, drizzle-orm 1.0.0-rc.4]`:
- `if (fs.existsSync(`${config.migrationsFolder}/meta/_journal.json`)) throw Error("We detected that you have old drizzle-kit migration folders. You must upgrade drizzle-kit and run \"drizzle-kit up\"");`
- `path: join(migrationFolderTo, subdir, "migration.sql")`
- применение `[VERIFIED: /Volumes/T7/personal/ielts/node_modules/drizzle-orm/pg-core/async/session.js:137-139]`: `const migrationsTable = typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";`, `const migrationsSchema = typeof config === "string" ? "drizzle" : config.migrationsSchema ?? "drizzle";`, ``await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(migrationsSchema)}`);``.
Итого история — `drizzle.__drizzle_migrations`; роль приложения её не видит (и не должна).
**Программный запуск:** `migrate(drizzle({ client: pool }), { migrationsFolder })` из `drizzle-orm/node-postgres/migrator` — проверено в собранном `dist/migrate.mjs` (повторный запуск ничего не применяет, rc=0). Под ролью `dv_app` падает: `DrizzleQueryError: Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"` / `cause: error: permission denied for database dv_lab_dev`.
**Конфиг:** `drizzle.config.ts` для `generate` не подключается к БД; ielts вызывает `generate` с фиктивным `DATABASE_URL_UNPOOLED=postgresql://offline@127.0.0.1:9/offline`. Для нового пакета: скрипт `db:generate` задаёт `MIGRATOR_DATABASE_URL` фиктивным значением, `db:migrate` исполняет программный мигратор через `node --env-file-if-exists=../../.env src/migrate.ts`.
**CI-проверка синхронности схемы:** повторный `drizzle-kit generate` без изменений печатает `No schema changes, nothing to migrate` и ничего не создаёт; при дрейфе создаёт новую папку → `git status --porcelain -- packages/db/drizzle` непуст → CI красный.
**Совместимость вперёд/назад (урок bio-exam 0026):** миграции применяются до переключения образа, поэтому прошлый образ (`PREV`) должен работать на новой схеме; автооткат `deploy.sh` откатывает только образ. Правило: в одном релизе только аддитивные миграции; удаление/переименование — следующим релизом. Деструктивные операторы можно ловить проверкой в духе `migrationSafety.ts` из ielts (необязательно в фазе).
**Первая миграция скелета:** одна минимальная таблица, чтобы доказать цепочку «миграция под `dv_migrator` → DML под `dv_app`» (например, `app_info(key text primary key, value text not null, updated_at timestamptz not null default now())`; в пробе так и сделано). Таблицы доменов — с фазы 18.

### Pattern 5: Контекст запроса и журнал (D-08, INFRA-07)
**What:** модуль `request-context.ts`: `AsyncLocalStorage<{ requestId: string }>`; middleware первым в цепочке: берёт `x-request-id` из запроса, только если он проходит `/^[\w-]{8,64}$/` (иначе `crypto.randomUUID()`), кладёт в Hono-переменную и в заголовок ответа, исполняет остальную цепочку внутри `storage.run`, после неё пишет одну строку доступа (`method`, `path`, `status`, `durationMs`); `createLogger` настраивает pino `mixin: () => ({ requestId: currentRequestId() })`. Единственный источник `requestId` для логгера, обработчика ошибок и фоновых задач — этот ALS; конверт ошибки `{ error: { code, message, requestId } }` собирается в одном `onError`/`errorResponse` (находка 3: три копии слияния).
**Проверено `[VERIFIED: scratchpad probe 2026-10-09]`:** логгер с `mixin` и ALS даёт `"requestId":"abc-123"` в строке доступа при входящем `x-request-id: abc-123`, а запрос без заголовка получает UUID; фоновый `setTimeout`, запущенный внутри `run`, логирует с тем же `requestId` и после завершения запроса; `formatters.level` печатает `"level":"info"`, `redact` маскирует `req.headers.cookie`. Hono-встроенные `requestId()` и `contextStorage()` существуют (`hono/request-id`, `hono/context-storage`, прочитаны в `hono@4.13.13`), но `requestId()` отвергает id с символами вне `\w-=` и хранит id в `Context`, а не в ALS.
**Граница доверия:** Caddy перезаписывает заголовок: проба с `curl -H 'X-Request-Id: attacker'` показала на бэкенде `rid` = сгенерированный UUID (`header_up X-Request-Id {http.request.uuid}`). Значит id из публичного трафика не подделывается; прямой доступ к api в обход Caddy (compose-сеть) — только изнутри. Валидация формата в api нужна как страховка от log injection.
**Не проверено:** что `app.onError` исполняется внутри ALS-области middleware (по устройству `compose` Hono так и есть); тест в плане обязателен (обработчик бросает ошибку → строка ошибки и конверт содержат тот же `requestId`).

### Pattern 6: Владелец запуска и остановки процесса (D-09, INFRA-06)
**What:** `lifecycle.ts` — единственное место, знающее про сигналы. Порядок: (1) флаг `stopping` → `/healthz` отвечает 503 `{status:'stopping'}`; (2) `server.close()` (не принимает новые) + `server.closeIdleConnections()`; (3) все клиенты `wss.clients` получают `close(1001, …)`; (4) таймер на половину дедлайна: `client.terminate()` для оставшихся и `server.closeAllConnections()`; (5) ждём завершения `close`; (6) закрываем ресурсы по порядку (пул БД; затем все будущие: очереди, фоновые задачи); (7) `process.exit(0)`; жёсткий таймер на весь дедлайн → `process.exit(1)`. Дедлайн — `SHUTDOWN_DEADLINE_MS` (по умолчанию 10000, границы 1000–60000, в конфиге), `stop_grace_period` в compose — 20 с (запас).
**Проверено прототипом `[VERIFIED: scratchpad probe 2026-10-09]`** (`node probe.mjs` с запуском отдельного процесса, `child.kill('SIGTERM')`, WS-клиент `ws`, `DEADLINE_MS=3000`):
```
naive,  ws open:                 {"exit":"HUNG>8s","ms":8001,"wsCloseCode":null}
graceful, ws open:               {"exit":{"code":0},"ms":17,"wsCloseCode":1001}
graceful, ws + hung /slow request:{"exit":{"code":0},"ms":1512,"wsCloseCode":1001}
```
Наивный вариант воспроизводит ловушку профиля сервера (`server.close()` ждёт upgraded-сокеты). `exit 0` при штатном дрейне, `exit 1` при превышении дедлайна — различимо в тесте.
**Тест детерминирован,** если: запускать `node dist/server.mjs` напрямую, а не `yarn start`/`npm run` (обёртки не пробрасывают сигнал), порт брать свободный (`PORT=0` не подходит для ожидания — выбрать случайный и дождаться строки `listening` в stdout), дедлайн в тесте 2000–3000 мс, проверять код выхода, время (`< deadline + 1000 мс`) и код закрытия WS 1001.
**Docker:** команда запуска — exec-форма `["node","--enable-source-maps","apps/api/dist/server.mjs"]`; `init: true` в compose (tini как PID 1: сигналы, zombie reaping) `[ASSUMED — не запускалось, Docker локально нет]`; healthcheck без curl (в `-slim` его нет): `node -e "fetch('http://127.0.0.1:4000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"`.
**Минимальный `/ws`:** `upgradeWebSocket(() => ({ onMessage(event, ws) { ws.send(event.data) } }))` (эхо) из `@hono/node-server` + `new WebSocketServer({ noServer: true, maxPayload: 65536 })`; проверка `Origin === APP_ORIGIN` в обработчике апгрейда (защита от cross-site WebSocket hijacking); без аутентификации до фазы 18, поэтому не принимать ничего, кроме эхо. Размещение сервера `ws` и его закрытие — только в `lifecycle.ts`.
**Нет побочных эффектов импорта:** `createApp(deps)` не вызывается при импорте (находка 4: `export const app = createApp()`); весь composition root — в `server.ts`.

### Pattern 7: Граница web/api и Caddy (D-07, D-02)
**Правила:** api знает только маршруты без префикса (`/healthz`, `/ws`, будущие `/chat`…); префикс `/api` принадлежит Caddy (`handle_path /api/*` срезает его) и константе в `apps/web/lib/endpoints.ts`; `/healthz` и `/ws` — публичные пути без префикса, маршрутизируются Caddy напрямую; CORS в api не нужен (один origin) и не включается; `APP_ORIGIN` — единственная переменная origin (используется для проверки `Origin` WebSocket). В web нет `route.ts` api, `transpilePackages`, `paths` в исходники api.
**Проверенная проба Caddy 2.11.7 `[VERIFIED: scratchpad probe 2026-10-09]`** (`auto_https off`, локальные бэкенды): `caddy validate` → `Valid configuration`; `/healthz` → api; `/api/foo/bar` → api получает `/foo/bar`; `/ws` → api; `/x` → web; клиентский `X-Request-Id: attacker` заменён UUID; `--http2-prior-knowledge` → HTTP/2. Нюанс: голый `/api` (без слеша) в `handle_path /api/*` не попадает и уходит в web (404 Next) — приемлемо.
Не проверено локально (нет публичного домена/сервера): ACME-выдача сертификата, редирект http→https, IPv6-доступность.
`Caddyfile` целиком — в Code Examples. `lb_try_duration`/`lb_try_interval` дают переждать рестарт api без 502 (проверено `caddy validate`); `flush_interval -1` у `/api/*` — под стриминг чата фазы 22.

### Pattern 8: Сборка образов (Next standalone + api) в Yarn 4 + Turbo
**Проверено `[VERIFIED: scratchpad probe 2026-10-09]`:** `turbo prune @dv-lab/api --docker` (2.11.7) на репозитории с Yarn 4 создаёт `out/json` (с `.yarnrc.yml`, `.yarn/releases/yarn-*.cjs`, `package.json` воркспейсов, `yarn.lock`), `out/full`, `out/yarn.lock`; `yarn install --immutable` на `out/json` проходит; `yarn workspaces focus --production @dv-lab/api` оставляет 39 МБ `node_modules`; собранный `dist/server.mjs` работает на этом наборе. `next build` с `output: 'standalone'` и `outputFileTracingRoot` на корень монорепы даёт `.next/standalone/apps/web/server.js` и woff2 шрифтов `geist` в `.next/static/media` (сети к Google нет). Каталог `public/` обязан существовать (иначе `COPY` в образе упадёт).
**Не проверено** (Docker локально отсутствует): сами `docker build`. Dockerfile'ы ниже — каркас по документации Turbo `[CITED: turborepo.dev/docs/guides/tools/docker]` и проверенным шагам; первая настоящая сборка — PR-ветка CI (job `images` собирает без push на PR). Пользователь `node` (uid 1000) уже есть в образе; `corepack enable` нужен, чтобы команда `yarn` была Berry — при сомнении запускать `node .yarn/releases/yarn-4.18.1.cjs` (поэтому `yarnPath` оставить в `.yarnrc.yml` и закоммитить `.yarn/releases/yarn-4.18.1.cjs`; утверждение «в Node 25+ corepack из дистрибутива убран» — `[ASSUMED]`, не проверялось, рекомендация от него не зависит).
Образ api включает и команду миграций (`node apps/api/dist/migrate.mjs`, папка `apps/api/drizzle` копируется из `packages/db/drizzle`): код и миграции одной версии в одном образе.
`.dockerignore` (корень): `.git`, `**/node_modules`, `.next`, `**/dist`, `.env*`, `.planning`, `.claude`, `.turbo`, `deploy`, `.yarn/cache`, `.yarn/install-state.gz` — иначе в публичный образ попадёт `.env`.

### Pattern 9: Рекомендуемая декомпозиция и порядок планов

Волны зависят от решений ARCH-REVIEW («модули до потребителей»):
1. **Plan A — очистка и тулчейн (первый, решает D-07):** удалить старые `apps/*`, `packages/*`, корневые аудиты, `docs/`; переписать `README.md` (в нём есть упоминания старой платформы, иначе проверка устаревшего кода в CI упадёт); завести `apps/web` (заглушка), `apps/api` (пустой каркас), `packages/db` (пустой JIT-пакет); обновить корневые файлы и версии; переписать `CLAUDE.md`/`AGENTS.md`; границу web/api зафиксировать (нет `route.ts`). Результат: `yarn install --immutable`, typecheck/lint/build зелёные.
2. **Plan B — конфигурация и роли БД (D-06):** `connection.ts`, `config.ts`, Drizzle-схема и первая миграция, `deploy/postgres/ensure-db.sql`, тесты на PG (под `dv_app`), `.env.example`. До него не трогать env/CI.
3. **Plan C — контекст запроса и логи (D-08)** и **Plan D — жизненный цикл + `/ws` (D-09):** параллельны после B (разные файлы), но C раньше обработчика ошибок и любых логов.
4. **Plan E — Dockerfile'ы, compose, Caddyfile.** **Plan F — CI** (`ci.yml`: verify + images, `caddy validate`, `shellcheck`, проверка устаревшего кода). Планы E и F зависят от A–D; CI не зависит от домашнего сервера.
5. **Plan G — `deploy.sh`, бэкапы, юниты, `RUNBOOK.md`.**
6. **Plan H — шаги владельца (checkpoint:human-action):** Server guy: домашняя БД, подготовка VPS, GHCR public, бакет и ключи, DNS, первая выкатка, проверка снаружи, восстановление. Планы, которым нужна домашняя БД для локального прогона, ждут этого шага.

### Anti-Patterns to Avoid
- **`export const app = createApp()` и чтение env при импорте** — побочные эффекты (находка 4).
- **`.catch(4000)` для PORT/APP_ORIGIN** — молчаливая подмена (находка 1).
- **Два читателя `DATABASE_URL`** — только `resolveDatabaseUrl`.
- **`CREATE EXTENSION` в миграциях** — воспроизведённая ловушка владения функциями.
- **`CREATE DATABASE … TEMPLATE` при живом api** — `source database … is being accessed by other users`.
- **`yarn start` / shell-форма CMD как PID 1** — сигнал не доходит до node.
- **`@hono/node-ws` вместе с `@hono/node-server` 2.x** — конфликт peer, дубль функциональности.
- **Секреты в `turbo.json` `globalEnv`** — попадают в хэш; использовать `globalPassThroughEnv`.
- **Хранить id запроса только в Hono `Context`** — фоновые задачи его не видят.

## Server Operations Design

### Раскладка на VPS (предложение; `<…>` — не хранить в репозитории)
`/opt/dv-lab/{repo,env,state,data/{pg,caddy/{data,config}},backups/db,logs}`; `repo` — клонирование публичного репозитория (токен не нужен); файлы деплоя берутся из того же коммита, что и образ (профиль сервера). `env/db.env` (600): `POSTGRES_PASSWORD`, `MIGRATOR_PASSWORD`, `APP_PASSWORD`; `env/api.env`, `env/web.env` (600): не-БД переменные (`APP_ORIGIN`, `PORT`, `LOG_LEVEL`, `SHUTDOWN_DEADLINE_MS`); `state/release.env`: `APP_TAG=sha-<40hex>`; `/etc/dv-lab/backup.env` и `/etc/dv-lab/restic.pass` (600) — доступ к S3 и пароль restic. Compose читает пароли через второй `--env-file env/db.env`, а `DATABASE_URL`/`MIGRATOR_DATABASE_URL` собираются в `environment:` из `${APP_PASSWORD}`/`${MIGRATOR_PASSWORD}` (отсюда требование «пароли — hex»).

### Выкатка `deploy/deploy.sh` (D-01a, D-03)
Образец — `bio-exam-ops/deploy.sh` (прочитан): `flock`, журнал, этапы, `trap ERR` с откатом, смоук. Отличия: образы тянутся, а не собираются; тег `sha-<полный sha>` (однозначно, `type=sha,format=long`); перед выкаткой скрипт ждёт появления обоих образов (`docker manifest inspect`, до 10 минут) — образы публикуются только после зелёного job `verify` (`needs: verify`), поэтому наличие образа означает зелёный CI; журнал в `state/deploy-journal.log`; этап `ensure-db` повторяет идемпотентный SQL (добавление расширений позже).
Репетиция миграций: дамп `pg_dump -Fc` → `pg_restore --list` (проверка) → `CREATE DATABASE <tmp> OWNER dv_migrator` → `pg_restore` дампа под суперпользователем в `<tmp>` → одноразовый сервис `migrate` с `MIGRATE_DB=<tmp>` → `DROP DATABASE <tmp>` → настоящий `migrate` → переключение. **Рекомендация: `pg_dump | pg_restore`, не TEMPLATE.** Проба на PG 17.10: `CREATE DATABASE dv_lab_tpl4 TEMPLATE dv_lab_test` при одной активной сессии в источнике → `ERROR: source database "dv_lab_test" is being accessed by other users`, `DETAIL: There is 1 other session using the database.` (в документации PG 18 то же ограничение для обеих стратегий `[CITED: postgresql.org/docs/18/sql-createdatabase.html]`). Пока api жив, у него есть пул → TEMPLATE потребовал бы остановить api до репетиции, увеличив простой. Дамп из `pg_dump` — MVCC-снимок без остановки; восстановление дампа (права, владельцы, default ACL, расширения) проверено: объекты у `dv_migrator`, ACL `dv_app=arwd/dv_migrator`, `ALTER TABLE` под `dv_migrator` на копии проходит. Цена: время и место пропорциональны размеру базы (для скелета — секунды; пересмотреть, когда база вырастет).
Откат: только образ (`APP_TAG=PREV`); схема не откатывается (см. Pattern 4). Перед фазой 26 добавить функцию-защиту «активная комната ielts» (D-03) — в фазе её нет.
**Bash-ловушки (профили `bio-exam.md`, `mapei-ai.md`):** `set -Eeuo pipefail`; `trap ERR` работает в функциях только с `-E`; не писать `команда | grep -q` и `grep -c … |` под `pipefail` — вывод в переменную и `case`/`[ ]`; `( … ) || echo FAILED` отключает `set -e` внутри подоболочки; `docker compose exec` всегда с `-T`; `curl -s -o /dev/null -w '%{http_code}'`, без `%{redirect_url}`; `exit 75` для «занято»; `|| true` только у намеренно необязательных шагов (очистка). `bash -n` скриптов из этого документа пройден; `shellcheck` локально нет — запускается в CI (job `verify`).

### Бэкапы (D-04, INFRA-04)
Ночной таймер `OnCalendar=*-*-* 03:30:00`, `Persistent=true`, `RandomizedDelaySec=10min` → `dv-lab-backup.service` (`Type=oneshot`, `EnvironmentFile=/etc/dv-lab/backup.env`) → `backup.sh`: `pg_dump -Fc` суперпользователем в контейнере → `pg_restore --list` → `restic backup --tag nightly` → `restic forget --keep-daily 14 --keep-weekly 8 --prune` → `restic check` → локальные дампы старше 14 суток удаляются. Любая ошибка → ненулевой код → юнит `failed` (`systemctl is-failed dv-lab-backup.service`, `journalctl -u dv-lab-backup.service`) — «падает громко» без внешнего мониторинга (он отложен). Автобэкап OVH остаётся включённым (второй независимый слой).
Выбор инструмента — **restic**: клиентское шифрование, дедупликация, готовая политика 14+8, `check`, владелец уже эксплуатирует на bio-exam (повторяемая модель); `rclone crypt` не даёт снимков и retention, `age`+`aws s3 cp` требует собственного retention.
Хранилище вне сервера (выбирает владелец; факты 2026-10-09):

| Провайдер | Цена | Бесплатно | Выходной трафик | Нюансы |
|-----------|------|-----------|-----------------|--------|
| Backblaze B2 | $6.95/TB/мес `[CITED: backblaze.com/cloud-storage/pricing]` | первые 10 GB | бесплатно до 3× хранимого, далее $0.01/GB | нет минимального срока хранения; S3-совместимый API |
| Cloudflare R2 | $0.015/GB-мес Standard `[CITED: developers.cloudflare.com/r2/pricing]` | 10 GB-мес, 1 млн Class A, 10 млн Class B | нет платы | Class A $4.50/млн, Class B $0.36/млн |
| Hetzner Object Storage | базовая цена с включённым 1 TB хранилища и 1 TB трафика (сумма на странице не извлеклась — `[ASSUMED]`, уточнить) `[CITED: hetzner.com/storage/object-storage]` | — | включён 1 TB | Falkenstein/Helsinki/Nuremberg; есть object lock и versioning (защита от удаления ключом с сервера — на bio-exam этого нет); минимум 64 КБ на объект |
Для базы скелета (МБ) любой вариант практически бесплатен. Ключ лежит только на сервере (600) и в менеджере паролей владельца; в репозитории — шаблон `deploy/env.example` с именами (`RESTIC_REPOSITORY`, `RESTIC_PASSWORD_FILE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`).
**Восстановление (один раз, владелец; критерий 5):** `restore-check.sh` берёт последний снимок `nightly`, восстанавливает дамп во временную базу `dv_lab_restorecheck` под `OWNER dv_migrator`, сравнивает число строк `drizzle.__drizzle_migrations` с живой базой, печатает `RESTORE_OK` и удаляет временную базу. Тот же скрипт можно повесить на ежемесячный таймер (как `bio-exam-restore-test`) — по желанию. Реальное аварийное восстановление: новый кластер → `ensure-db.sh` → `pg_restore` суперпользователем в пустую базу `dv_lab` (проверенный вариант: пустая база `OWNER dv_migrator`, без `--no-owner`).

### Домашняя БД для разработки (D-01) — шаги Server guy
Проект compose по образцу `/opt/its-doc`: `postgres:18`, том на `/var/lib/postgresql` (не `/data`, не `/var/lib/postgresql/data`), порт — свободный и не из занятых (5432, 55432–55434 заняты по CONTEXT; кандидат 55435 — `[ASSUMED]`, проверить `ss -ltn`), привязка к LAN-интерфейсу значением из `DEV_DB_BIND` в локальном `.env` сервера (в репозитории только `${DEV_DB_BIND:?}`), init-скрипт `deploy/postgres/ensure-db.sh` монтируется в `docker-entrypoint-initdb.d`. Затем два вызова `ensure-db.sh` с `APP_DB_NAME=dv_lab_dev` и `APP_DB_NAME=dv_lab_test` (одни роли, две базы). Мак подключается с `DATABASE_URL`/`MIGRATOR_DATABASE_URL` из локального `.env` (адрес и пароли — только там). Не добавлять `sslmode=require/prefer/verify-ca` в URL без необходимости: `pg` 8.x трактует их как `verify-full` (комментарий ielts в `src/lib/db/client.ts`: «pg already treats these modes as aliases for verify-full»); во внутренней сети TLS не используется. Шаблон `deploy/dev-db/compose.yaml` в репозитории — без адресов.

### DNS-переключение `dv-lab.dev` (D-16) — шаги владельца
1. Не раньше чем за сутки: понизить TTL существующих записей apex до 60 с (Vercel: «Ideally, about 24 hours in advance of changes, you should shorten the DNS TTL to 60s» `[CITED: vercel.com/docs/domains/working-with-dns]`; минимум TTL 30 с, по умолчанию 60 с).
2. Проверить текущее состояние: `vercel dns ls dv-lab.dev` (или панель Domains → DNS Records): записи apex (A/ALIAS от проектов Vercel), CAA. Vercel автоматически ставит CAA для Let's Encrypt на apex — Caddy использует Let's Encrypt как основной CA, запасной ZeroSSL при такой CAA получить сертификат не сможет (допустимо).
3. Снять `dv-lab.dev` (apex) с проектов Vercel (`ielts.dv-lab.dev` и `vault.dv-lab.dev` не трогать — это отдельные записи/домены проектов).
4. Добавить `A @ <VPS_IPV4>` и `AAAA @ <VPS_IPV6>` (`vercel dns add dv-lab.dev '@' A <VPS_IPV4>`, `vercel dns add dv-lab.dev '@' AAAA <VPS_IPV6>` `[CITED: vercel.com/docs/cli/dns]`). Vercel допускает создание AAAA в своих NS: «we allow the creation of AAAA records when using Vercel's nameservers, we do not support IPv6 yet» — это про невозможность указывать AAAA на Vercel, а не про запрет внешнего IPv6 `[CITED: vercel.com/docs/domains/troubleshooting#ipv6-support]`.
5. Проверка до первого HTTPS-запроса: `dig +short A dv-lab.dev`, `dig +short AAAA dv-lab.dev`, затем `curl -4 -sI http://dv-lab.dev` и `curl -6 -sI http://dv-lab.dev` (Caddy отвечает 308 на https). AAAA должен работать до выдачи сертификата: Let's Encrypt предпочитает IPv6, при мёртвом AAAA проверка HTTP-01 падает.
6. После `https://dv-lab.dev/healthz` вернуть TTL к 300–3600. Том `data/caddy/data` (сертификаты) не удалять и не пересоздавать — лимиты Let's Encrypt.
7. `.dev` целиком в HSTS preload (профиль сервера): HTTP без редиректа браузеры не откроют; Caddy ставит `Strict-Transport-Security` без `includeSubDomains` и без `preload`.
Агентам Vercel MCP/CLI без явного разрешения владельца не использовать.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Применение миграций | свой раннер SQL | `migrate()` из `drizzle-orm/node-postgres/migrator` | журнал, хэши, порядок, транзакции уже есть |
| Валидация env | ручные `parseInt`/`catch` | zod 4 (`z.coerce.number()`, `z.url()`, `z.prettifyError`) | пустая строка/NaN/диапазоны ловятся, тексты ошибок готовы |
| JSON-логи, redaction, уровни | `console.log(JSON.stringify(…))` | pino (`mixin`, `redact`, `formatters.level`) | производительность и безопасность полей |
| Контекст запроса | передача `requestId` аргументом | `AsyncLocalStorage` | видим в фоновых задачах |
| WebSocket на Node | свой апгрейд | `upgradeWebSocket` из `@hono/node-server` 2.x + `ws` | протокол, фрагменты, ping/pong, maxPayload |
| Сертификаты, HTTP→HTTPS, HSTS | свой certbot-скрипт | Caddy automatic HTTPS | продление и OCSP встроены |
| Бэкапы с шифрованием и retention | свой openssl + find | restic | снимки, дедупликация, `forget`, `check` |
| Сборка слоёв монорепы в Docker | ручное копирование пакетов | `turbo prune --docker` + `yarn workspaces focus --production` | проверенная связка |
| Расписание бэкапа | cron-обёртка | systemd timer (`Persistent=true`) | догоняет пропущенные запуски, состояние юнита видно |
| Сборка backend-пакета | самописный esbuild-скрипт | `tsdown` | externals по `dependencies`, вшивка workspace-пакетов |
| Определение текущей роли в тесте | парсинг URL | `select rolsuper from pg_roles where rolname = current_user` | источник истины — сервер БД |

**Key insight:** сложность этой фазы — в стыках (роли БД ↔ миграции ↔ образы ↔ выкатка ↔ остановка). Каждый стык уже проверен готовым инструментом; самописное оправдано только для четырёх тонких модулей из D-06/D-08/D-09 (≈ по 30–60 строк).

## Runtime State Inventory

Фаза удаляет и переписывает код и (рекомендуется) переименовывает область пакетов `@teacher-crm/*` → `@dv-lab/*`; чтобы не потерять скрытое состояние:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Старая БД dv-lab не используется (REQUIREMENTS: «Not in use»), перенос не нужен. Проекты Supabase/Neon за пределами репозитория; состояние на них не меняется агентами | Нет миграции данных; удаление внешних проектов — решение и действие владельца (вне фазы) |
| Live service config | Vercel: apex `dv-lab.dev` закреплён за проектом(ами) Vercel (DNS-шаг выше); GitHub: правила защиты ветки `master` могут ссылаться на имя проверки (`Verify` в текущем `ci.yml`) | Сохранить имя job `Verify` или обновить required checks в GitHub; снять apex с проектов Vercel (шаги владельца) |
| OS-registered state | На VPS ещё ничего не развёрнуто (профиль: `discover.sh` не запускался); на Mac нет зарегистрированных задач | Юниты systemd создаются впервые (`deploy/install.sh`) — переименования нет |
| Secrets/env vars | Имена в `turbo.json`/`.env.example`: `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_*`, `TEACHER_CRM_*`, `POSTGRES_URL`, `GOOGLE_*`, `CALENDAR_TOKEN_ENCRYPTION_KEY`; секреты GitHub Actions/Vercel с этими именами | Удалить из `turbo.json` и `.env.example`; новые имена — `DATABASE_URL`, `MIGRATOR_DATABASE_URL`, `APP_ORIGIN`, `PORT`, `LOG_LEVEL`, `SHUTDOWN_DEADLINE_MS`; Google-переменные вернутся в фазе 24; устаревшие секреты в GitHub/Vercel удаляет владелец |
| Build artifacts / installed packages | `node_modules`, `.turbo`, `dist`, `*.tsbuildinfo`, `.next`, `.cache` в рабочих копиях; `.yarn/releases/yarn-4.14.1.cjs` и `yarnPath` в `.yarnrc.yml`; `yarn.lock` со старыми зависимостями; `importOrder` в `.prettierrc.json` содержит `^@teacher-crm/` | Перегенерировать `yarn.lock` (`yarn install`), заменить yarn-релиз, поправить `importOrder` под новую область, удалить старые артефакты локально (в git их нет, `.gitignore` их покрывает) |

Имя корневого пакета `teacher-english-crm` и области `@teacher-crm/*` — унаследованы; решение о переименовании не зафиксировано в CONTEXT (Open Question Q1).

## Common Pitfalls

### Pitfall 1: Yarn отвергает «последнюю» версию (`YN0016 … quarantined`)
**What goes wrong:** `yarn add pkg@latest` или `yarn dlx knip` падают для пакетов младше 24 ч.
**Why it happens:** Yarn 4.18 `npmMinimalAgeGate: 1440`.
**How to avoid:** фиксировать версии точными номерами после `npm view <pkg> time`; в `audit:dead-code` не использовать `yarn dlx` (поставить `knip` в devDependencies).
**Warning signs:** `Failed with errors` на этапе Resolution.

### Pitfall 2: Turbo строгий режим скрывает `DATABASE_URL`
**What goes wrong:** тесты внутри `turbo run test` не видят БД (`ECONNREFUSED ::1:5432`).
**How to avoid:** `globalPassThroughEnv` (воспроизведено).

### Pitfall 3: `server.close()` не завершается с открытым WebSocket
**What goes wrong:** процесс ждёт до `stop_grace_period`, потом `SIGKILL` (теряется фоновая работа — урок CODE-AUDIT AUD-CAL-4).
**How to avoid:** Pattern 6; тест со spawn.

### Pitfall 4: Обёртки глотают SIGTERM
**What goes wrong:** `yarn start`/shell-CMD не передают сигнал, тест остановки «проходит» только на ручном запуске.
**How to avoid:** `node …` напрямую; exec-форма CMD; `init: true`.

### Pitfall 5: Расширение, созданное ролью миграций
**What goes wrong:** `must be owner of type …` на `ALTER EXTENSION`/последующих миграциях; CI под суперпользователем не ловит (так упал bio-exam).
**How to avoid:** расширения только в `ensure-db.sql`; CI на ролях без суперпользователя; `CREATE EXTENSION` в миграциях запрещён ревью.

### Pitfall 6: Миграции под ролью без CREATE на базе
**What goes wrong:** `CREATE SCHEMA IF NOT EXISTS "drizzle"` падает `permission denied for database …` даже если схема есть.
**How to avoid:** `dv_migrator` — владелец базы (`CREATE DATABASE … OWNER dv_migrator`).

### Pitfall 7: GHCR-пакет создаётся приватным
**What goes wrong:** сервер не может `docker pull` без токена.
**Why:** «the default visibility is private»; пакет, связанный с репозиторием, наследует права, «but not the visibility» `[CITED: docs.github.com … configuring-a-packages-access-control-and-visibility]`; смена на Public — в Package settings → Danger Zone, «Once you make a package public, you cannot make it private again»; через API/CLI не описана.
**How to avoid:** шаг владельца после первого push в `master` и **до** первого `deploy.sh`: сделать `dv-lab-web` и `dv-lab-api` публичными; запасной вариант — `docker login ghcr.io` с PAT `read:packages` на сервере.

### Pitfall 8: Docker публикует порты в обход ufw, IPv6 и реальный IP клиента
**What goes wrong:** «закрытые» ufw порты открыты; для IPv6-клиентов в логах может быть адрес шлюза Docker (userland-proxy) — для лимита входа «пять попыток на логин и IP» (ACCT-03, фаза 18) это важно.
**Why:** «container traffic gets diverted before it goes through the ufw firewall settings» `[CITED: docs.docker.com/engine/network/packet-filtering-firewalls]`; поведение IPv6 source IP в документе не описано — `[ASSUMED]`.
**How to avoid:** публиковать только `80:80` и `443:443` у Caddy; db/web/api без `ports:`; после первого запуска проверить снаружи по IPv4 и IPv6 (`nc -zv`, `curl -4/-6`) и посмотреть `remote_ip` в логе Caddy для IPv6-запроса — если это адрес Docker, решение (хост-сеть Caddy или `ip6tables`) принимается до фазы 18.

### Pitfall 9: Шрифты из Google ломают сборку
**How to avoid:** `geist/font/sans`, `geist/font/mono` (проверено: `next build` без обращения к Google; woff2 в `.next/static/media`).

### Pitfall 10: Версия `turbo` в Dockerfile расходится с корнем
**How to avoid:** `ARG TURBO_VERSION=2.11.7` в стадии `pruner` и проверка совпадения в CI (grep по `package.json`) — или читать версию из `package.json`.

### Pitfall 11: GitHub Actions — `main` вместо `master` и имя job
**What goes wrong:** текущий `ci.yml`: `push: branches: - main`, поэтому push в `master` CI не запускает (CONTEXT/D-14).
**How to avoid:** `master`; имя job `Verify` сохранить.

### Pitfall 12: Образ вшивает `.env`
**How to avoid:** `.dockerignore` (Pattern 8) — образы публичные.

### Pitfall 13: `ws`-сервер без лимитов
**How to avoid:** `maxPayload`, проверка `Origin`, закрытие в `lifecycle.ts`.

## Code Examples

Код ниже — без комментариев (правило владельца). Статус проверки указан под блоками. Подставляемые значения (имена ролей/БД, пути) — предложения планировщику, а не значения из существующих файлов.

### `deploy/postgres/ensure-db.sql`
```sql
\set ON_ERROR_STOP on
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', :'migrator_role', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrator_role')
\gexec
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', :'app_role', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'migrator_role', :'migrator_password') \gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'app_role', :'app_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8''', :'db_name', :'migrator_role')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db_name') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db_name', :'app_role') \gexec
\connect :db_name
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_role') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', :'migrator_role', :'app_role') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', :'migrator_role', :'app_role') \gexec
```
Проверено дважды подряд на PG 17.10 (rc=0, идемпотентно). Набор расширений (`pg_trgm`, `citext`) — предположение под будущий поиск; список уточняет планировщик/фаза 19 `[ASSUMED]`. Пароль попадает в `psql`-переменные, не в историю shell, если вызывать через `ensure-db.sh`.

### `deploy/postgres/ensure-db.sh`
```bash
#!/usr/bin/env bash
set -Eeuo pipefail

exec psql -U "${POSTGRES_USER:-postgres}" -d postgres -X -q \
	-v ON_ERROR_STOP=1 \
	-v db_name="${APP_DB_NAME:-dv_lab}" \
	-v migrator_role=dv_migrator \
	-v migrator_password="$MIGRATOR_PASSWORD" \
	-v app_role=dv_app \
	-v app_password="$APP_PASSWORD" \
	-f /deploy/postgres/ensure-db.sql
```
`bash -n` пройден. В контейнере `postgres` psql ходит по unix-сокету (доверие внутри контейнера по умолчанию образа).

### `packages/db/src/connection.ts`
```ts
import { z } from 'zod'

export type DbRole = 'app' | 'migrator'

const variables = { app: 'DATABASE_URL', migrator: 'MIGRATOR_DATABASE_URL' } as const

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ })

export function resolveDatabaseUrl(role: DbRole, env: NodeJS.ProcessEnv): string {
	const name = variables[role]
	const parsed = postgresUrl.safeParse(env[name])
	if (!parsed.success) throw new Error(`${name} is missing or is not a postgres URL`)
	const database = new URL(parsed.data).pathname.slice(1)
	if (env.NODE_ENV === 'test' && env.CI !== 'true' && !database.endsWith('_test')) {
		throw new Error(`${name} must point to a database whose name ends with _test`)
	}
	return parsed.data
}
```
`[ASSUMED]` на уровне формы: фрагмент `z.url({ protocol: /…/ })` проверен с `https?`, для `postgres(ql)?` не запускался; сообщение об ошибке намеренно не содержит значения (секрет).

### `apps/api/src/config.ts`
```ts
import { resolveDatabaseUrl } from '@dv-lab/db'
import { z } from 'zod'

const origin = z
	.url({ protocol: /^https?$/ })
	.transform((value) => new URL(value))
	.refine((url) => url.pathname === '/' && url.search === '' && url.hash === '', 'APP_ORIGIN must be an origin without path')
	.transform((url) => url.origin)

const schema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	PORT: z.coerce.number().int().min(1).max(65535),
	APP_ORIGIN: origin,
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
	SHUTDOWN_DEADLINE_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
})

export type ApiConfig = z.infer<typeof schema> & { databaseUrl: string }

export function loadConfig(env: NodeJS.ProcessEnv): ApiConfig {
	const parsed = schema.safeParse(env)
	if (!parsed.success) throw new Error(`Invalid environment\n${z.prettifyError(parsed.error)}`)
	return { ...parsed.data, databaseUrl: resolveDatabaseUrl('app', env) }
}
```
Схема (PORT/APP_ORIGIN/диапазоны) проверена пробой на zod 4.6.5; обёртка `loadConfig` — форма для плана.

### `apps/api/src/request-context.ts`
```ts
import { AsyncLocalStorage } from 'node:async_hooks'
import type { MiddlewareHandler } from 'hono'
import pino, { type DestinationStream, type Logger } from 'pino'

const storage = new AsyncLocalStorage<{ requestId: string }>()
const VALID_ID = /^[\w-]{8,64}$/

export const currentRequestId = () => storage.getStore()?.requestId

export function createLogger(level: string, destination?: DestinationStream): Logger {
	return pino(
		{
			level,
			base: { service: 'api' },
			timestamp: pino.stdTimeFunctions.isoTime,
			formatters: { level: (label) => ({ level: label }) },
			mixin: () => ({ requestId: currentRequestId() }),
			redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[redacted]' },
		},
		destination,
	)
}

export const requestContext =
	(logger: Logger): MiddlewareHandler<{ Variables: { requestId: string } }> =>
	async (c, next) => {
		const incoming = c.req.header('x-request-id')
		const requestId = incoming && VALID_ID.test(incoming) ? incoming : crypto.randomUUID()
		c.set('requestId', requestId)
		c.header('x-request-id', requestId)
		const started = performance.now()
		await storage.run({ requestId }, async () => {
			try {
				await next()
			} finally {
				logger.info(
					{ method: c.req.method, path: c.req.path, status: c.res.status, durationMs: Math.round(performance.now() - started) },
					'request',
				)
			}
		})
	}
```
Ядро (`mixin`, `isoTime`, `formatters.level`, `redact`, ALS в `setTimeout`) проверено пробой; сама форма middleware с `finally` — рабочая в прототипе без `try/finally`; `onError` внутри области — тест в плане (Pattern 5).

### `apps/api/src/lifecycle.ts`
```ts
import type { ServerType } from '@hono/node-server'
import type { Logger } from 'pino'
import type { WebSocketServer } from 'ws'

export type Closable = { name: string; close: () => Promise<void> }

type Options = {
	server: ServerType
	wss: WebSocketServer
	resources: Closable[]
	deadlineMs: number
	logger: Logger
	exit: (code: number) => void
}

export function createLifecycle(options: Options) {
	let stopping = false

	async function shutdown(signal: string) {
		if (stopping) return
		stopping = true
		options.logger.info({ signal }, 'shutdown start')
		const hard = setTimeout(() => {
			options.logger.error('shutdown deadline exceeded')
			options.exit(1)
		}, options.deadlineMs)
		hard.unref()
		const closed = new Promise<void>((resolve) => options.server.close(() => resolve()))
		options.server.closeIdleConnections()
		for (const client of options.wss.clients) client.close(1001, 'server shutting down')
		const grace = setTimeout(() => {
			for (const client of options.wss.clients) client.terminate()
			options.server.closeAllConnections()
		}, Math.floor(options.deadlineMs / 2))
		await closed
		clearTimeout(grace)
		for (const resource of options.resources) {
			try {
				await resource.close()
			} catch (error) {
				options.logger.error({ err: error, resource: resource.name }, 'resource close failed')
			}
		}
		options.logger.info('shutdown complete')
		options.exit(0)
	}

	return { shutdown, isStopping: () => stopping }
}
```
Логика — перенос проверенного прототипа (`server.mjs`) на TS с `exit` как зависимость (чтобы остановку можно было тестировать в процессе); `isStopping` читает `/healthz`. В `server.ts`: `process.on('SIGTERM', () => void lifecycle.shutdown('SIGTERM'))` и то же для `SIGINT`.

### `apps/api/src/server.ts` (composition root)
```ts
import { serve } from '@hono/node-server'
import { createDb } from '@dv-lab/db'
import { WebSocketServer } from 'ws'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createLifecycle } from './lifecycle.ts'
import { createLogger } from './request-context.ts'

const config = loadConfig(process.env)
const logger = createLogger(config.LOG_LEVEL)
const { pool, db } = createDb(config.databaseUrl)
const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 })
const lifecycle = createLifecycle({
	server: undefined as never,
	wss,
	resources: [{ name: 'pg-pool', close: () => pool.end() }],
	deadlineMs: config.SHUTDOWN_DEADLINE_MS,
	logger,
	exit: (code) => process.exit(code),
})
const app = createApp({ config, logger, db, isStopping: lifecycle.isStopping })
const server = serve({ fetch: app.fetch, port: config.PORT, websocket: { server: wss } }, (info) => logger.info({ port: info.port }, 'listening'))
```
Каркас: циклическую зависимость `lifecycle ↔ server` планировщик решает передачей `server` после `serve` (например, `lifecycle.attach(server)`); пример намеренно показывает форму, не готовый код. Сигналы подключаются здесь же.

### `deploy/caddy/Caddyfile`
```
{
	servers {
		protocols h1 h2
	}
}

(upstream) {
	lb_try_duration 10s
	lb_try_interval 250ms
	header_up X-Request-Id {http.request.uuid}
}

dv-lab.dev {
	encode zstd gzip

	header {
		-Server
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
	}

	request_body {
		max_size 1MB
	}

	handle /healthz {
		reverse_proxy api:4000 {
			import upstream
		}
	}

	handle /ws {
		reverse_proxy api:4000 {
			import upstream
		}
	}

	handle_path /api/* {
		reverse_proxy api:4000 {
			import upstream
			flush_interval -1
		}
	}

	handle {
		reverse_proxy web:3000 {
			import upstream
		}
	}
}
```
`caddy validate --adapter caddyfile` (2.11.7) → `Valid configuration`; `caddy fmt --diff` без замечаний. Логика маршрутов проверена на варианте с `:8089` и `auto_https off` (отличие — адрес сайта и автоматический HTTPS). `request_body max_size 1MB` (лимит запросов к web и api; для будущих загрузок IELTS пересмотреть) проверен только `validate`.

### `deploy/compose.yaml` (каркас, не запускался)
```yaml
name: dv-lab

services:
  caddy:
    image: caddy:2.11.7
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - /opt/dv-lab/data/caddy/data:/data
      - /opt/dv-lab/data/caddy/config:/config
    depends_on:
      - web
      - api

  web:
    image: ghcr.io/kdvornichenko/dv-lab-web:${APP_TAG:?}
    restart: unless-stopped
    init: true
    env_file: /opt/dv-lab/env/web.env
    mem_limit: 512m
    healthcheck:
      test: ['CMD', 'node', '-e', "fetch('http://127.0.0.1:3000/').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 15s

  api:
    image: ghcr.io/kdvornichenko/dv-lab-api:${APP_TAG:?}
    restart: unless-stopped
    init: true
    stop_grace_period: 20s
    env_file: /opt/dv-lab/env/api.env
    environment:
      DATABASE_URL: postgresql://dv_app:${APP_PASSWORD}@db:5432/dv_lab
    mem_limit: 512m
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'node', '-e', "fetch('http://127.0.0.1:4000/healthz').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 10s

  migrate:
    image: ghcr.io/kdvornichenko/dv-lab-api:${APP_TAG:?}
    profiles: ['tools']
    command: ['node', 'apps/api/dist/migrate.mjs']
    environment:
      MIGRATOR_DATABASE_URL: postgresql://dv_migrator:${MIGRATOR_PASSWORD}@db:5432/${MIGRATE_DB:-dv_lab}
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:18
    restart: unless-stopped
    env_file: /opt/dv-lab/env/db.env
    environment:
      POSTGRES_USER: postgres
    volumes:
      - /opt/dv-lab/data/pg:/var/lib/postgresql
      - ./postgres:/deploy/postgres:ro
      - ./postgres/ensure-db.sh:/docker-entrypoint-initdb.d/10-ensure-db.sh:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 3s
      retries: 10
```
`[ASSUMED]` — не запускалось (нет Docker). Ключи (`init`, `stop_grace_period`, `profiles`, `depends_on.condition`, `up --wait`) стандартны для Compose; `profiles` + `run --rm migrate` и `up -d --wait` применялись в `bio-exam-ops/deploy.sh` (прочитан). Пароли для подстановки берутся из второго `--env-file /opt/dv-lab/env/db.env`. Порт web/api внутри сети — 3000/4000 (должен совпадать с `PORT`).

### `apps/api/Dockerfile` (каркас)
```dockerfile
FROM node:24.21.0-slim AS pruner
WORKDIR /repo
RUN npm install --global turbo@2.11.7
COPY . .
RUN turbo prune @dv-lab/api --docker

FROM node:24.21.0-slim AS builder
WORKDIR /repo
RUN corepack enable
COPY --from=pruner /repo/out/json/ .
RUN yarn install --immutable
COPY --from=pruner /repo/out/full/ .
RUN yarn turbo run build --filter=@dv-lab/api
RUN yarn workspaces focus --production @dv-lab/api

FROM node:24.21.0-slim AS runner
ARG GIT_SHA=unknown
ENV NODE_ENV=production GIT_SHA=$GIT_SHA
WORKDIR /app
COPY --from=builder --chown=node:node /repo/node_modules ./node_modules
COPY --from=builder --chown=node:node /repo/apps/api ./apps/api
COPY --from=builder --chown=node:node /repo/packages/db/drizzle ./apps/api/drizzle
USER node
CMD ["node", "--enable-source-maps", "apps/api/dist/server.mjs"]
```
Шаги `prune` → `yarn install --immutable` → `workspaces focus --production` проверены локально вне Docker; сам файл не собирался. `/healthz` возвращает `GIT_SHA`, `deploy.sh` сверяет его с выкатываемым коммитом.

### `apps/web/Dockerfile` (каркас)
```dockerfile
FROM node:24.21.0-slim AS pruner
WORKDIR /repo
RUN npm install --global turbo@2.11.7
COPY . .
RUN turbo prune @dv-lab/web --docker

FROM node:24.21.0-slim AS builder
WORKDIR /repo
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=pruner /repo/out/json/ .
RUN yarn install --immutable
COPY --from=pruner /repo/out/full/ .
RUN yarn turbo run build --filter=@dv-lab/web

FROM node:24.21.0-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
CMD ["node", "apps/web/server.js"]
```
Структура `standalone` (`apps/web/server.js`) подтверждена локальной сборкой.

### `apps/web/next.config.ts`
```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	output: 'standalone',
	outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
	poweredByHeader: false,
}

export default nextConfig
```
Сборка с этим файлом прошла (Next 16.4.0, standalone в `.next/standalone/apps/web`).

### `apps/web/app/layout.tsx`
```tsx
import type { ReactNode } from 'react'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import './globals.css'

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
			<body className="font-sans">{children}</body>
		</html>
	)
}
```
Проверено сборкой. Выбор шрифта (`Geist`, как в ielts) — временный; шрифты варианта A определит фаза 18 (тот же приём `geist` или `next/font/local` с vendored woff2).

### `turbo.json`
```json
{
	"$schema": "https://v2-11-7.turborepo.dev/schema.json",
	"globalPassThroughEnv": ["CI", "DATABASE_URL", "MIGRATOR_DATABASE_URL", "APP_ORIGIN", "PORT", "LOG_LEVEL", "SHUTDOWN_DEADLINE_MS"],
	"tasks": {
		"build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
		"typecheck": { "dependsOn": ["^build"], "outputs": [] },
		"lint": { "dependsOn": ["^build"], "outputs": [] },
		"test": { "dependsOn": ["^build"], "outputs": [] },
		"dev": { "cache": false, "persistent": true },
		"start": { "cache": false, "persistent": true }
	}
}
```
Схема `https://v2-11-7.turborepo.dev/schema.json` отвечает 200; `turbo run test typecheck` в пробе — 4 успешных задачи.

### `.github/workflows/ci.yml`
```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - master

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions:
  contents: read

jobs:
  verify:
    name: Verify
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_PASSWORD: ci-superuser-password
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      CI: 'true'
      PGHOST: 127.0.0.1
      PGPORT: '5432'
      PGUSER: postgres
      PGPASSWORD: ci-superuser-password
      DATABASE_URL: postgresql://dv_app:ci-app-password@127.0.0.1:5432/dv_lab_test
      MIGRATOR_DATABASE_URL: postgresql://dv_migrator:ci-migrator-password@127.0.0.1:5432/dv_lab_test
      APP_ORIGIN: http://localhost:3000
      PORT: '4000'
    steps:
      - uses: actions/checkout@v7

      - name: Legacy code check
        run: |
          if git grep -n -i -E 'supa[b]ase' -- . ':(exclude).planning'; then
            echo "legacy references found"
            exit 1
          fi

      - run: corepack enable

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: yarn

      - run: yarn install --immutable

      - name: Prepare roles and database
        run: >-
          psql -d postgres -X -v ON_ERROR_STOP=1
          -v db_name=dv_lab_test
          -v migrator_role=dv_migrator -v migrator_password=ci-migrator-password
          -v app_role=dv_app -v app_password=ci-app-password
          -f deploy/postgres/ensure-db.sql

      - name: Migrations are in sync with the schema
        run: |
          yarn workspace @dv-lab/db db:generate
          test -z "$(git status --porcelain -- packages/db/drizzle)"

      - run: yarn workspace @dv-lab/db db:migrate
      - run: yarn typecheck
      - run: yarn lint
      - run: yarn test
      - run: yarn build
      - run: yarn knip

      - name: Caddyfile
        run: docker run --rm -v "$PWD/deploy/caddy:/etc/caddy:ro" caddy:2.11.7 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

      - name: Shell scripts
        run: |
          for f in deploy/*.sh deploy/*/*.sh; do bash -n "$f"; done
          shellcheck deploy/*.sh deploy/*/*.sh

  images:
    name: Image ${{ matrix.app }}
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: verify
    strategy:
      fail-fast: false
      matrix:
        app: [web, api]
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7

      - uses: docker/setup-buildx-action@v4

      - uses: docker/login-action@v4
        if: github.event_name == 'push'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - id: meta
        uses: docker/metadata-action@v6
        with:
          images: ghcr.io/${{ github.repository_owner }}/dv-lab-${{ matrix.app }}
          tags: |
            type=sha,format=long
            type=raw,value=latest,enable={{is_default_branch}}

      - uses: docker/build-push-action@v7
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          push: ${{ github.event_name == 'push' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            GIT_SHA=${{ github.sha }}
          cache-from: type=gha,scope=${{ matrix.app }}
          cache-to: type=gha,mode=max,scope=${{ matrix.app }}
```
YAML разбирается (`yaml.safe_load` → jobs `verify`, `images`; `on` = `pull_request`, `push: master`). Версии actions — из `gh api …/releases/latest`; параметры `metadata-action`/`build-push-action`/`cache-from type=gha` — `[ASSUMED]` по памяти документации, актуальность сверит первый прогон; `shellcheck` на `ubuntu-latest` — `[ASSUMED]` предустановлен. Проверка устаревшего кода: паттерн `supa[b]ase` не совпадает с собственным текстом (проверено), на текущем репозитории даёт 26 файлов с совпадениями — после очистки дойдёт до нуля; `.planning/` исключён (исторические документы), `yarn.lock` перегенерируется без этих пакетов. Права `packages: write` — только у job `images`; вход в GHCR только на `push` (на PR образ собирается без публикации — ловит поломку Dockerfile до merge). Образ собирается только после зелёного `verify` (`needs`), поэтому сервер никогда не увидит образ красного коммита. Необходимость `CI: 'true'` для обхода проверки `_test` в `resolveDatabaseUrl` согласована с Pattern 2.

### `deploy/deploy.sh`
```bash
#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/dv-lab
REPO=$ROOT/repo
STATE=$ROOT/state
COMPOSE="docker compose -f $REPO/deploy/compose.yaml --env-file $STATE/release.env --env-file $ROOT/env/db.env"
JOURNAL=$STATE/deploy-journal.log
IMAGES=ghcr.io/kdvornichenko/dv-lab
REF="${1:-origin/master}"
STAGE=start
PREV=""
FULL=""
TAG=""
SWITCHED=0
TMP_DB=""
T_START=$(date +%s)

note() { echo "$(date -Is) $*" >> "$JOURNAL"; }

drop_tmp_db() {
	if [ -n "$TMP_DB" ]; then
		$COMPOSE exec -T db psql -U postgres -d postgres -qAt -c "DROP DATABASE IF EXISTS \"$TMP_DB\"" > /dev/null 2>&1 || true
		TMP_DB=""
	fi
}

on_err() {
	local rc=$?
	trap - ERR
	echo "DEPLOY_FAILED stage=$STAGE" >&2
	if [ "$SWITCHED" = 1 ] && [ -n "$PREV" ]; then
		printf 'APP_TAG=%s\n' "$PREV" > "$STATE/release.env"
		if $COMPOSE up -d --wait --wait-timeout 120 api web; then
			echo "rolled back to $PREV" >&2
		else
			echo "ROLLBACK FAILED: manual action needed" >&2
		fi
		note "FAILED stage=$STAGE from=$PREV to=$TAG rollback=$PREV sec=$(( $(date +%s) - T_START ))"
	else
		note "FAILED stage=$STAGE from=$PREV to=$TAG switched=no sec=$(( $(date +%s) - T_START ))"
	fi
	drop_tmp_db
	exit "$rc"
}
trap on_err ERR
trap drop_tmp_db EXIT

STAGE=lock
exec 9> /run/lock/dv-lab-deploy.lock
if ! flock -n 9; then
	echo "DEPLOY_STOPPED: another deploy is running"
	exit 75
fi

STAGE=current
PREV=$(sed -n 's/^APP_TAG=//p' "$STATE/release.env")
test -n "$PREV"

STAGE=fetch
git -C "$REPO" fetch -q origin
FULL=$(git -C "$REPO" rev-parse "$REF^{commit}")
TAG="sha-$FULL"
echo "current: $PREV, target: $TAG"
if [ "$TAG" = "$PREV" ] && [ "${FORCE:-0}" != 1 ]; then
	echo "DEPLOY_SKIPPED: $TAG is already live"
	exit 0
fi
git -C "$REPO" checkout -q --detach "$FULL"

STAGE=images
for i in $(seq 1 60); do
	if docker manifest inspect "$IMAGES-api:$TAG" > /dev/null 2>&1 && docker manifest inspect "$IMAGES-web:$TAG" > /dev/null 2>&1; then
		break
	fi
	if [ "$i" = 60 ]; then
		echo "images for $TAG are not published"
		false
	fi
	sleep 10
done
APP_TAG="$TAG" $COMPOSE pull api web

STAGE=pre-dump
DUMP=$ROOT/backups/db/predeploy-$(date +%Y%m%d-%H%M%S)-${FULL:0:12}.dump
$COMPOSE exec -T db pg_dump -U postgres -d dv_lab -Fc > "$DUMP.part"
mv "$DUMP.part" "$DUMP"
$COMPOSE exec -T db pg_restore --list < "$DUMP" > /dev/null
echo "pre-deploy dump: $DUMP"

STAGE=ensure-db
$COMPOSE exec -T db /deploy/postgres/ensure-db.sh

STAGE=dry-run
TMP_DB="dv_lab_migcheck_$(date +%s)"
$COMPOSE exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TMP_DB\" OWNER dv_migrator"
$COMPOSE exec -T db pg_restore -U postgres -d "$TMP_DB" --exit-on-error < "$DUMP"
APP_TAG="$TAG" MIGRATE_DB="$TMP_DB" $COMPOSE --profile tools run --rm migrate
drop_tmp_db

STAGE=migrate
APP_TAG="$TAG" $COMPOSE --profile tools run --rm migrate

STAGE=switch
printf 'APP_TAG=%s\n' "$TAG" > "$STATE/release.env"
SWITCHED=1
$COMPOSE up -d --wait --wait-timeout 120 api web caddy

STAGE=smoke
HEALTH=$(curl -s --max-time 15 https://dv-lab.dev/healthz)
WEB_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://dv-lab.dev/)
case "$HEALTH" in
	*"$FULL"*) ;;
	*) echo "healthz does not report $FULL"; false ;;
esac
test "$WEB_CODE" = 200
SWITCHED=0
note "OK from=$PREV to=$TAG ref=$REF sec=$(( $(date +%s) - T_START ))"

STAGE=cleanup
find "$ROOT/backups/db" -name 'predeploy-*.dump' -mtime +30 -delete || true
echo "DEPLOY_OK $PREV -> $TAG"
```
`bash -n` пройден; логика этапов и откат — по образцу `bio-exam-ops/deploy.sh`. Не выполнялось (нет сервера). Первый запуск требует начального `state/release.env` (`APP_TAG=sha-<sha>` любого опубликованного образа) — шаг runbook'а. Фраза в `case` на пустой `HEALTH` (curl не достучался) даёт `false` → откат, что и нужно.

### `deploy/backup/backup.sh` и `restore-check.sh`
```bash
#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/dv-lab
COMPOSE="docker compose -f $ROOT/repo/deploy/compose.yaml --env-file $ROOT/state/release.env --env-file $ROOT/env/db.env"
DIR=$ROOT/backups/db
OUT=$DIR/dv_lab-$(date +%Y%m%d-%H%M%S).dump

set -a
. /etc/dv-lab/backup.env
set +a

$COMPOSE exec -T db pg_dump -U postgres -d dv_lab -Fc > "$OUT.part"
mv "$OUT.part" "$OUT"
$COMPOSE exec -T db pg_restore --list < "$OUT" > /dev/null

restic backup --tag nightly --host dv-lab "$OUT"
restic forget --tag nightly --host dv-lab --keep-daily 14 --keep-weekly 8 --prune
restic check

find "$DIR" -name 'dv_lab-*.dump' -mtime +14 -delete
echo "BACKUP_OK $OUT"
```
```bash
#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/dv-lab
COMPOSE="docker compose -f $ROOT/repo/deploy/compose.yaml --env-file $ROOT/state/release.env --env-file $ROOT/env/db.env"
WORK=$(mktemp -d /var/tmp/dv-lab-restore.XXXXXX)
TMP_DB="dv_lab_restorecheck"

cleanup() {
	$COMPOSE exec -T db psql -U postgres -d postgres -qAt -c "DROP DATABASE IF EXISTS \"$TMP_DB\"" > /dev/null 2>&1 || true
	rm -rf "$WORK"
}
trap cleanup EXIT

set -a
. /etc/dv-lab/backup.env
set +a

restic restore latest --tag nightly --host dv-lab --target "$WORK" > "$WORK/restic.log" 2>&1 || { tail -n 20 "$WORK/restic.log"; false; }
DUMP=$(find "$WORK" -name 'dv_lab-*.dump' | sort | tail -n 1)
test -s "$DUMP"
echo "restoring $DUMP"

$COMPOSE exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$TMP_DB\"" -c "CREATE DATABASE \"$TMP_DB\" OWNER dv_migrator"
$COMPOSE exec -T db pg_restore -U postgres -d "$TMP_DB" --exit-on-error < "$DUMP"

QUERY='select count(*) from drizzle.__drizzle_migrations'
LIVE=$($COMPOSE exec -T db psql -U postgres -d dv_lab -qAt -c "$QUERY")
COPY=$($COMPOSE exec -T db psql -U postgres -d "$TMP_DB" -qAt -c "$QUERY")
echo "migrations live=$LIVE restored=$COPY"
test "$COPY" -ge 1
test "$COPY" -le "$LIVE"
echo "RESTORE_OK"
```
`bash -n` обоих пройден. Операция `pg_restore` дампа под `OWNER dv_migrator` в пустую базу проверена на PG 17.10 (объекты, ACL и default ACL восстановлены; в пробе `--exit-on-error` не сработал). Лента `restic` не выполнялась (restic локально нет).

### systemd-юниты `deploy/systemd/`
```ini
[Unit]
Description=dv-lab nightly database backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
EnvironmentFile=/etc/dv-lab/backup.env
Environment=HOME=/root
ExecStart=/opt/dv-lab/repo/deploy/backup/backup.sh
TimeoutStartSec=30min
```
```ini
[Unit]
Description=dv-lab nightly database backup timer

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=10min
Persistent=true

[Install]
WantedBy=timers.target
```
`[ASSUMED]` — стандартные ключи systemd, юниты не запускались; образец — `bio-exam-backup*.{service,timer}` из профиля `bio-exam.md`.

### Тест остановки (форма из проверенной пробы)
```ts
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import WebSocket from 'ws'

const entry = fileURLToPath(new URL('../dist/server.mjs', import.meta.url))

test('SIGTERM with an open WebSocket exits within the deadline', async () => {
	const port = 20000 + Math.floor(Math.random() * 20000)
	const child = spawn(process.execPath, [entry], {
		env: { ...process.env, PORT: String(port), APP_ORIGIN: `http://127.0.0.1:${port}`, SHUTDOWN_DEADLINE_MS: '3000' },
		stdio: ['ignore', 'pipe', 'inherit'],
	})
	let out = ''
	child.stdout.on('data', (chunk) => (out += chunk))
	await expect.poll(() => out.includes('listening'), { timeout: 5000 }).toBe(true)
	const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { origin: `http://127.0.0.1:${port}` } })
	let closeCode = 0
	socket.on('close', (code) => (closeCode = code))
	await new Promise((resolve) => socket.once('open', resolve))
	const started = performance.now()
	child.kill('SIGTERM')
	const code = await new Promise<number | null>((resolve) => child.once('exit', resolve))
	expect(code).toBe(0)
	expect(performance.now() - started).toBeLessThan(4000)
	expect(closeCode).toBe(1001)
})
```
`[ASSUMED]` как форма: проверенная версия — отдельный `probe.mjs` (результаты в Pattern 6), в Vitest этот код не запускался. Тест требует предварительной сборки (`dependsOn: ["^build"]` + сборка самого api перед `test` либо `pretest`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tsup` (+ dts) | `tsdown` (rolldown) | tsup README: «not actively maintained anymore» | сборка api |
| TS 5.x компилятор на JS | TS 7.0 (нативный) без программного API; TS 6.0.x для инструментов | 7.0 — 2026-07-08, API ждут в 7.1 | typescript-eslint/tsup на 6.x |
| `@hono/node-ws` отдельным пакетом | `upgradeWebSocket` внутри `@hono/node-server` 2.x | node-server 2.0 | меньше зависимостей, но нужен `ws` |
| Drizzle `meta/_journal.json` + плоские `.sql` | папки `<ts>_<name>/migration.sql` + `snapshot.json` (v1) | v1 beta → rc | перенос старых папок запрещён мигратором («old drizzle-kit migration folders») |
| Drizzle `schema` в `drizzle()` | `relations` (RQB v2) | v1 | см. Version Decisions |
| `next lint` | ESLint CLI + flat `eslint-config-next/core-web-vitals` и `/typescript` | Next 16 | `lint` в web = `eslint .` |
| Корректировка `dotenv` и путей | `node --env-file-if-exists` | Node 22.9+/24 | нет зависимости и путей |
| Данные Postgres в `/var/lib/postgresql/data` | `/var/lib/postgresql` (PG 18+) | образ postgres 18 | профиль сервера |
| Свободная установка «latest» | возрастной барьер Yarn 4.18 (24 ч) | Yarn 4.18 | см. Pitfall 1 |

**Deprecated/outdated:** `tsup`; `@hono/node-ws` для node-server 2.x; `dotenv`+пути; `supabase`-код; `main` в триггере CI; `next/font/google`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Docker-сборка обоих Dockerfile'ов, compose-ключи (`init`, `stop_grace_period`, `depends_on.condition`, `profiles`), `docker manifest inspect` анонимно к публичному GHCR работают как описано | Code Examples | Первая сборка в CI/запуск на VPS упадёт; чинится правками файлов |
| A2 | Параметры `docker/metadata-action@v6`, `build-push-action@v7`, `cache type=gha`, `shellcheck` на `ubuntu-latest` | ci.yml | Первый прогон CI красный; правки шагов |
| A3 | PG 18 ведёт себя как PG 17.10 в пробах ролей/прав/restore; драйвер `pg` и `drizzle-orm` rc.4 работают на PG 18 | Pattern 3 | DB-тесты в CI выявят; правки скриптов |
| A4 | Набор расширений в `ensure-db.sql` (`pg_trgm`, `citext`) — под будущие фазы | Code Examples | Лишние/недостающие расширения; добавляются идемпотентно |
| A5 | Docker публикует 80/443 на IPv6; IP IPv6-клиента виден в логе Caddy (userland-proxy) | Pitfall 8 | ACCT-03 (лимит по IP) в фазе 18 лимитирует всех IPv6-клиентов сразу; проверка Server guy |
| A6 | `app.onError` Hono исполняется внутри области ALS middleware | Pattern 5 | Ошибки логируются без `requestId`; ловится тестом |
| A7 | `corepack enable` в `node:24-slim` даёт Yarn 4 (иначе `node .yarn/releases/yarn-4.18.1.cjs`) | Pattern 8 | Сборка образа падает на `yarn`; запасной путь указан |
| A8 | Hetzner Object Storage: сумма базовой цены не извлечена со страницы | Backups | Владелец выбирает по неполным данным; уточнить на сайте |
| A9 | Свободный порт домашнего сервера 55435 | Home DB | Конфликт порта; проверка `ss -ltn` Server guy |
| A10 | Один consolidated `checkpoint:human-verify` вместо проверки по каждому из SUS-пакетов | Package Legitimacy Audit | Владелец/планировщик могут потребовать буквально по протоколу |
| A11 | Переименование области пакетов `@teacher-crm/*` → `@dv-lab/*` | Standard Stack, Runtime State | Если владелец оставляет старые имена — правки команд установки и `importOrder` |
| A12 | Лимит `request_body max_size 1MB` подходит скелету | Caddyfile | Блокирует будущие загрузки; пересмотр в фазе 26 |
| A13 | `restic` из пакетов Ubuntu 26.04 достаточно свежий для S3-бэкенда (как на bio-exam); версия пакета не проверялась | Backups | Использовать бинарник GitHub-релиза (0.19.1) |

## Open Questions

1. **Переименовать ли `@teacher-crm/*` в `@dv-lab/*`?**
   - Известно: все пакеты создаются заново; `importOrder` в `.prettierrc.json` и корневое имя `teacher-english-crm` унаследованы; в CONTEXT решение не зафиксировано.
   - Неясно: нужно ли владельцу сохранять старые имена.
   - Рекомендация: переименовать в плане A одним действием (имена новых пакетов дёшевы); если нет — заменить `@dv-lab` в командах на прежний scope.

2. **Провайдер хранилища для копий вне сервера** (B2, R2, Hetzner или другой): решает владелец до плана G; рекомендация по условиям фазы — B2 или R2 (точные цены выше; бесплатного объёма хватает).

3. **IPv6 и реальный IP клиента за Docker.** Неясно, виден ли настоящий адрес IPv6-клиента у Caddy; нужна проверка Server guy при первом запуске; если не виден — решение (Caddy на host-сети, `ip6tables` в Docker) принять до фазы 18 (лимит попыток входа по IP).

4. **Оставлять ли `/ws` публичным в проде скелета.** Рекомендация: оставить (нужен для проверки остановки и фаз 22+), только эхо, с проверкой `Origin` и `maxPayload`; отключение — один маршрут.

5. **Нужна ли зависимость `^build` для JIT-пакетов** (`typecheck`/`lint`/`test`): можно убрать для ускорения; решает планировщик по факту времени CI.

6. **Часовой пояс сервера** (ночной бэкап 03:30 «по серверному времени»): проверить `timedatectl` при подготовке; не критично.

7. **`pg-boss` позже создаёт собственную схему (DDL)**: под ролью `dv_app` это невозможно; решение (миграция схемы очереди под `dv_migrator`) — фаза очереди; здесь только предупреждение.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | всё | ✓ (Mac) | v24.17.0 (последний LTS 24.21.0; на Mac допустим 24.x) | — |
| Yarn Berry | install | ✓ через `corepack yarn@4.18.1`; глобальный `yarn` — 1.22.22 | 4.18.1 | `.yarn/releases` в репозитории |
| Docker | образы, compose, `caddy validate` | ✗ (Mac) | — | Первая настоящая сборка — CI (PR-ветка); `caddy validate` проверен бинарником Caddy 2.11.7 из GitHub-релиза |
| PostgreSQL server | DB-тесты локально | ✗ на Mac как сервис; ✓ только `postgresql@17` (psql/pg_dump 17.10) | 17.10 | Домашний сервер (`postgres:18`, готовит Server guy); CI — сервисный контейнер 18. Все пробы ролей/восстановления сделаны на 17.10 во временном кластере (остановлен и удалён из процессов) |
| psql / pg_dump клиент | CI-шаг ролей, deploy | ✓ (Mac 17.10; runner — предустановлен) | 17.10 | — |
| caddy (CLI) | валидация Caddyfile | ✗ установлен; скачан бинарник в scratchpad | 2.11.7 | `docker run caddy:2.11.7` в CI |
| shellcheck / hadolint / actionlint | линт скриптов, Dockerfile, workflow | ✗ | — | `bash -n` (пройден); shellcheck в CI; Dockerfile/workflow проверит первый прогон |
| restic | бэкапы | ✗ (Mac), на сервере ставит владелец | 0.19.1 (релиз) | — |
| gh CLI | справочно | ✓ | — | — |
| VPS (доступ) | выкатка, DNS, HTTPS | ✗ у агентов | — | Шаги владельца (Server guy) |
| Домашний сервер | локальные DB-тесты | ✗ у агентов (контейнера dv-lab ещё нет) | — | CI независим; локальные DB-планы ждут шага |

**Missing dependencies with no fallback:**
- Доступ к VPS и домашнему серверу у агентов — по условию; всё серверное оформлено как шаги владельца.

**Missing dependencies with fallback:**
- Docker локально отсутствует: Dockerfile, compose, `init`, healthcheck — непроверены; первая проверка в CI. Это явное ограничение пробы, а не вывод о работоспособности.
- PostgreSQL 18 локально отсутствует: проверки на 17.10; PG 18 подтверждается первым прогоном CI.

## Validation Architecture

Nyquist-валидация включена (`workflow.nyquist_validation: true` в `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.3 + vite 8.3.3 (DB-тесты в `packages/db` и `apps/api`; тесты остановки/логов запускают собранный `dist/server.mjs`) |
| Config file | `vitest.config.ts` в `apps/api` и `packages/db` (Wave 0) |
| Quick run command | `DATABASE_URL=… MIGRATOR_DATABASE_URL=… yarn workspace @dv-lab/api vitest run` (<30 с в пробе: 0,4–0,8 с на DB-тест) |
| Full suite command | `yarn typecheck && yarn lint && yarn test && yarn build && yarn knip` (как job `Verify`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-08 / SC1 | В коде нет упоминаний старой платформы; нет старых `apps/*`/`packages/*` | CI shell | `git grep -n -i -E 'supa[b]ase' -- . ':(exclude).planning'` должен вернуть код 1 (падение CI: перечень файлов и строк, exit 1 из шага) | ❌ Wave 0 (шаг в ci.yml) |
| INFRA-08 / SC1 | Новая история миграций Drizzle v1, схема синхронна | CI | `yarn workspace @dv-lab/db db:generate && test -z "$(git status --porcelain -- packages/db/drizzle)"`; красный = появилась неучтённая папка миграции | ❌ Wave 0 |
| INFRA-05 / SC1 | Версии из таблицы Standard Stack; build/typecheck/lint/test зелёные | CI + ревью | `yarn install --immutable` (падает на YN0016 при версии <24 ч), `yarn why next react react-dom typescript turbo` — сверка с таблицей; полуавтомат: разовая сверка `package.json` планировщиком | ❌ Wave 0 |
| INFRA-02 / SC2 | DB-тесты идут под ролью без суперпользователя | integration | тест `select rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname = current_user` → все `false`; `CREATE TABLE` под `dv_app` → `code 42501`; падение = роль суперпользователь/DDL разрешён | ❌ Wave 0 |
| INFRA-02 / SC2 | Тесты не бегут по «не той» базе | unit | `resolveDatabaseUrl('app', {NODE_ENV:'test', DATABASE_URL:'postgresql://…/dv_lab'})` бросает ошибку | ❌ Wave 0 |
| INFRA-02 / SC2 | CI на `pull_request` и `push` в `master` | CI конфиг | `python3 -c "import yaml…"` разбор `ci.yml`: `on.push.branches == ['master']` и есть `pull_request`; фактический запуск — зелёный Verify на PR | ❌ Wave 0 |
| INFRA-07 | Миграции под ролью миграций, роль приложения их не применит | integration | запуск `dist/migrate.mjs` с `MIGRATOR_DATABASE_URL` под `dv_migrator` → `migrated`, rc=0; с URL `dv_app` → rc≠0, текст `permission denied for database` | ❌ Wave 0 |
| INFRA-07 | Строка доступа JSON с `requestId`; входящий валидный `x-request-id` сохраняется, мусорный заменяется | integration (spawn) | запрос к собранному серверу, разбор stdout (`requestId`, `method`, `path`, `status`, `durationMs`), заголовок ответа `x-request-id` | ❌ Wave 0 |
| INFRA-07 | `requestId` в строках ошибки и фонового логгера | unit (in-process, pino в память) | handler бросает → строка `level:error` с тем же `requestId`; фоновый `setTimeout` внутри запроса логирует с ним | ❌ Wave 0 |
| INFRA-06 / SC5 | SIGTERM с открытым WS: выход 0 за < дедлайна, WS закрыт 1001 | integration (spawn) | тест «Тест остановки» (выше): красный = таймаут/код ≠ 0/нет 1001 | ❌ Wave 0 |
| INFRA-06 / SC5 | Зависший HTTP-запрос не удерживает процесс дольше дедлайна | integration (spawn) | запрос к тестовому маршруту-«зависанию», SIGTERM, выход ≤ дедлайн | ❌ Wave 0 |
| D-06 | Неверные `PORT`/`APP_ORIGIN` не подменяются | unit | `loadConfig({PORT:'abc',…})` бросает с текстом по полю; `APP_ORIGIN` с путём — ошибка | ❌ Wave 0 |
| D-07 | В web нет кода api | CI shell | `test ! -e apps/web/app/api` и отсутствие `@dv-lab/api` в `apps/web/package.json` (`git grep`) | ❌ Wave 0 |
| INFRA-03 / SC3 | Образы web и api публикуются на push в `master`, теги `sha-<sha>` и `latest` | CI | job `images`; после push — шаг `docker buildx imagetools inspect ghcr.io/…/dv-lab-api:sha-${{ github.sha }}` (добавить в ci.yml) | ❌ Wave 0 |
| INFRA-03 / SC3 | Сервер тянет без токена и перезапускает без сборки | owner-run | `docker pull ghcr.io/kdvornichenko/dv-lab-api:latest` без `docker login` (успех = пакет публичный); `deploy.sh` печатает `DEPLOY_OK` | **не автоматизируется агентами** |
| INFRA-01 / SC4 | `https://dv-lab.dev` отдаёт web и `/healthz` по IPv4 и IPv6 | owner-run | `curl -4 -s -o /dev/null -w '%{http_code}\n' https://dv-lab.dev/healthz` и `curl -6 …` → `200`; `curl -6 -s https://dv-lab.dev/ -o /dev/null -w '%{http_code}'` → `200` | **не автоматизируется агентами** |
| INFRA-01 / SC4 | Снаружи открыты только 80/443; 443/udp закрыт; HTTP/3 выключен | owner-run | `nc -zv <VPS_IPV4> 5432 3000 4000 2019` → отказ/таймаут; `curl -sI https://dv-lab.dev | grep -i alt-svc` → пусто; `curl --http3-only -sI https://dv-lab.dev` → ошибка; для IPv6 те же проверки | **не автоматизируется агентами** |
| INFRA-01 / SC4 | `ielts.dv-lab.dev` остаётся на Vercel | owner-run | `dig +short ielts.dv-lab.dev` не содержит `<VPS_IPV4>`; страница открывается | **не автоматизируется агентами** |
| INFRA-01 | Caddyfile валиден | CI | `docker run … caddy:2.11.7 caddy validate …` | ❌ Wave 0 |
| INFRA-04 / SC5 | Бэкап по расписанию; последний восстановлен один раз | owner-run | `systemctl list-timers dv-lab-backup.timer`; `systemctl is-failed dv-lab-backup.service` → `active`/не failed; `deploy/backup/restore-check.sh` → `RESTORE_OK` | **не автоматизируется агентами** |
| deploy | Скрипты синтаксически корректны | CI | `bash -n` + `shellcheck` | ❌ Wave 0 |
| D-01a | Репетиция миграций на копии | owner-run (при первой выкатке) | `deploy.sh` проходит этап `dry-run`; временная база удалена (`\l` без `dv_lab_migcheck_*`) | **не автоматизируется агентами** |

### Sampling Rate
- **Per task commit (когда владелец коммитит):** `yarn workspace <pkg> vitest run` + `yarn typecheck` затронутого пакета.
- **Per wave merge:** `yarn typecheck && yarn lint && yarn test && yarn build`.
- **Phase gate:** полный набор в CI зелёный на PR; затем owner-run чек-лист (SC3–SC5) до `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `apps/api/vitest.config.ts`, `packages/db/vitest.config.ts` — конфиги Vitest (проверенная форма: `defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 15000 } })`).
- [ ] `packages/db/test/roles.test.ts` — роль без суперпользователя, DDL запрещён, default privileges.
- [ ] `packages/db/test/connection.test.ts`, `apps/api/test/config.test.ts` — выбор URL/роли, ошибки `PORT`/`APP_ORIGIN`.
- [ ] `apps/api/test/request-context.test.ts` — `requestId` в доступе, ошибке, фоне.
- [ ] `apps/api/test/shutdown.test.ts` — spawn-тесты остановки (с WS и с зависшим запросом).
- [ ] `apps/api/test/migrate.test.ts` — `dist/migrate.mjs` под двумя ролями.
- [ ] Шаги CI: legacy-grep, drizzle-sync, `caddy validate`, `shellcheck`, inspect образа.
- [ ] Установка: `vitest@5.0.3`, `vite@8.3.3` (обязательный peer) — без `vite` Vitest падает `Cannot find package 'vite'` (воспроизведено).

## Security Domain

`security_enforcement` в `.planning/config.json` не задан (= включён).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (вход — фаза 18) | — |
| V3 Session Management | no (фаза 18) | — |
| V4 Access Control | частично: права ролей БД (`dv_app` без DDL), публичные пути ограничены `/healthz`, `/ws`, `/api/*` | `ensure-db.sql`, Caddy-маршруты |
| V5 Input Validation | yes | zod для env; формат `x-request-id`; `maxPayload` WebSocket; `request_body max_size` |
| V6 Cryptography | yes (TLS, бэкапы) | Caddy automatic HTTPS; restic (клиентское шифрование) — не самописное |
| V7 Error Handling and Logging | yes | pino JSON, `redact` для `authorization`/`cookie`, конверт ошибки без внутренних данных; ни URL БД, ни паролей в сообщениях |
| V9 Communications | yes | TLS на периметре, HSTS, HTTP/3 выключен по решению, внутри docker-сети без публикации портов |
| V13/V14 API & Configuration | yes | секреты 600 вне репозитория, `.dockerignore`, образы без секретов (публичные), контейнеры не от root (`USER node`), `cap_drop: ALL` у Caddy |

### Known Threat Patterns for {Hono + Next + Postgres + Docker + Caddy}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Подделка `X-Request-Id` / log injection | Spoofing/Tampering | Caddy `header_up X-Request-Id {http.request.uuid}` (проверено); валидация формата в api |
| Cross-site WebSocket hijacking на `/ws` | Spoofing | проверка `Origin === APP_ORIGIN` при апгрейде |
| DoS через большие кадры/много соединений WS | DoS | `maxPayload`, закрытие в `lifecycle.ts`, лимиты контейнера (`mem_limit`) |
| Публикация внутренних портов в обход ufw | Information disclosure | только `80`/`443` у Caddy; проверка снаружи IPv4+IPv6 |
| Утечка секретов в публичный образ/репозиторий | Information disclosure | `.dockerignore`, `env.example` без значений, секреты только на сервере; `.planning/` без адресов (D-11) |
| Повышение прав через роль БД | Elevation | `dv_app` без DDL/TRUNCATE/суперпользователя; миграции только под `dv_migrator`; `REVOKE ALL ON DATABASE … FROM PUBLIC` |
| Подмена зависимостей/образов | Tampering | `yarn install --immutable`, возрастной барьер Yarn, закрепление версий; плавающие теги actions — опция закрепить по SHA; публичные образы собирает только job после `verify` |
| Fork-PR получает секреты/токен записи | Elevation | `permissions: contents: read` по умолчанию, `packages: write` только в `images`, вход в GHCR только на `push`; не использовать `pull_request_target` |
| Потеря/уничтожение бэкапов ключом сервера | Denial/Tampering | вторичный слой — автобэкап OVH; для S3 — object lock/versioning у провайдера (Hetzner) или ограниченный ключ бакета |
| Брутфорс/лимит по IP за Docker (IPv6) | Spoofing | см. Pitfall 8 / Open Question 3 (до фазы 18) |

## Sources

### Primary (HIGH confidence — проверено в этой сессии)
- Локальные пробы в scratchpad: монорепа Yarn 4.18.1 (install, typecheck, eslint, `next build` standalone, `turbo prune`, `workspaces focus --production`, tsdown, vitest, knip, Turbo strict env), прототип остановки (`naive`/`graceful`), пробы ролей/restore/TEMPLATE на PostgreSQL 17.10, `caddy validate` + маршрутизация (Caddy 2.11.7), zod/pino пробы, `drizzle-kit generate`, ESLint 10 / TS 7 / tsup пробы.
- npm registry (`npm view`, 2026-10-09): версии, даты, peerDependencies, dist-tags.
- Прочитанные файлы: `/Volumes/T7/personal/ielts/node_modules/drizzle-orm/{migrator.js,pg-core/async/session.js}`, `…/ielts/package.json`, `…/ielts/scripts/db-migrate.mjs`, `…/ielts/src/lib/db/client.ts`; пакеты `@hono/node-ws@1.3.1`, `@hono/node-server@2.1.4` (README, `dist/index.d.mts`), `hono@4.13.13` (`request-id`, `context-storage`), `eslint-config-next@16.4.0`, `vitest@5.0.3` (npm pack).
- `~/.claude/servers/dv-lab.md`, `bio-exam.md`, `bio-exam-ops/{deploy,autodeploy,install}.sh`; `.planning/*`; существующие `ci.yml`, `turbo.json`, `.yarnrc.yml`, `knip.json`, `.prettierrc.json`, `package.json` репозитория.
- GitHub API releases (versions of actions, restic, rclone, age), Docker Hub API (теги caddy, postgres, node), `nodejs.org/dist/index.json`.
- `gsd-tools query package-legitimacy check` (2026-10-09).

### Secondary (MEDIUM confidence — официальная документация, прочитана)
- nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli; devblogs.microsoft.com/typescript/announcing-typescript-7-0.
- turborepo.dev/docs/crafting-your-repository/using-environment-variables; turborepo.dev/docs/guides/tools/docker.
- hub.docker.com/_/postgres (PG 18 путь тома, init-скрипты); docs.docker.com/engine/network/packet-filtering-firewalls.
- postgresql.org/docs/18/sql-createdatabase.html.
- docs.github.com (container registry; package visibility); github.com/actions/setup-node advanced usage; github.com/docker/build-push-action.
- vercel.com/docs/domains/{working-with-dns,troubleshooting}; vercel.com/docs/cli/dns.
- backblaze.com/cloud-storage/pricing; developers.cloudflare.com/r2/pricing; hetzner.com/storage/object-storage.

### Tertiary (LOW confidence — не проверено / по памяти)
- Параметры Compose/systemd/GHA-экшенов, не запускавшиеся в этой сессии (см. Assumptions A1–A2, A13); поведение Docker с IPv6-клиентами (A5).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — версии и совместимость проверены запуском; оговорки: ESLint 10 (peer плагинов), `shellcheck`/Docker не запускались.
- Architecture: HIGH для модулей D-06/D-08/D-09 и ролей БД (воспроизведено), MEDIUM для Docker/compose/Caddy-TLS/DNS (нет Docker, сервера, домена).
- Pitfalls: HIGH для воспроизведённых (TEMPLATE, расширения, SIGTERM, Turbo env, Yarn age gate, TS 7), MEDIUM для IPv6/ufw/GHCR (документация без запуска).

**Research date:** 2026-10-09
**Valid until:** 2026-10-16 (быстро меняющаяся экосистема: версии «последних» и возрастной барьер Yarn; Drizzle v1 может выйти стабильным)
