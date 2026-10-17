# База: роли, подключение, миграции, права

## Роли и подключение

- PostgreSQL 18. Роли, база, схема `extensions` и расширения создаёт только `deploy/postgres/ensure-db.sql` (идемпотентный, запускается суперпользователем). `CREATE EXTENSION` в миграциях не пишется.
- Роли Postgres без прав суперпользователя: `dvlab_app` — роль приложения (`DATABASE_URL`, только чтение и запись данных), `dvlab_migrator` — владелец базы и роль миграций (`MIGRATOR_DATABASE_URL`).
- URL базы для роли выбирает только `resolveDatabaseUrl` из `packages/db/src/connection.ts`. При `NODE_ENV=test` он принимает только базу с именем на `_test`.
- Тип `DbExecutor` (база или транзакция) — `packages/db/src/connection.ts`. Разбор ошибок Postgres (`violatesUnique`, `postgresCode`, `postgresErrorFields`) — `packages/db/src/postgres-errors.ts`.

## Миграции

- Миграции применяются отдельным шагом под `dvlab_migrator`: локально `yarn db:migrate`, на сервере одноразовый сервис `migrate` из образа api (`node apps/api/dist/migrate.mjs`).
- Удаление и переименование объектов — отдельным релизом, когда код прошлой версии уже не работает с этими объектами.
- Единственное исключение из правила «миграции только добавляют» — миграция `note_blocks_kind_check`: она снимает `student_sections_kind_ck` (решение D-02), check не возвращается, ключи своих блоков `b_…` ему не соответствуют.

## Права `dvlab_app`

- Без `DELETE` и `TRUNCATE`: `chat_conversations`, `chat_messages`, `chat_actions`, `chat_turns`, `chat_budget_periods`, `chat_usage_attempts`, `student_notes`, `lesson_comments`, `lesson_marks`, `note_reviews`, `chat_command_prompts`, `chat_commands`, `push_subscriptions`, `push_deliveries`, `push_payment_alerts`.
- Единственная таблица, где `dvlab_app` имеет `DELETE`, — `google_calendar_events`; на остальных новых таблицах (включая таблицы календаря) `DELETE` и `TRUNCATE` отозваны.

## Тесты

Тесты идут на настоящем Postgres в базе `dvlab_test` под ролями `dvlab_app` и `dvlab_migrator`. Данные между тестами очищаются `TRUNCATE` под `dvlab_migrator`. Адаптера базы в памяти нет.
