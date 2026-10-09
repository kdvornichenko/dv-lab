# dv-lab

Личное рабочее пространство преподавателя. Сейчас в репозитории скелет v2.0: страница-заглушка, api с `/healthz` и `/ws`, база с ролями и миграциями, CI, образы и файлы выкатки на VPS.

## Стек

- Next 16, React 19, Tailwind 4 — `apps/web`
- Hono на Node 24 — `apps/api`
- PostgreSQL 18, Drizzle v1 — `packages/db`
- Yarn 4, Turbo, TypeScript 6, Vitest, ESLint, Prettier, knip
- Docker-образы в GHCR, Caddy и Docker Compose на сервере — `deploy/`

## Быстрый старт

```sh
corepack enable
yarn install
cp .env.example .env
yarn dev
```

В `.env` указать URL базы для ролей `dvlab_app` и `dvlab_migrator` и применить миграции командой `yarn db:migrate`. Для тестов нужен `.env.test` с базой, имя которой заканчивается на `_test`.

## Документация

- [AGENTS.md](AGENTS.md) — структура, команды, правила модулей и базы.
- [deploy/RUNBOOK.md](deploy/RUNBOOK.md) — подготовка сервера, выкатка, откат, бэкапы и восстановление.
