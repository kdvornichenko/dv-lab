# Проверочные помощники

Новые юнит- и интеграционные тесты не добавляются; существующие сохранены. E2E лежат в `e2e/` и запускаются `yarn test:e2e` на dev-стеке в обеих темах. Команда использует dev-учителя из `.env`; артефакты лежат только в `STATE_DIR` вне репозитория. E2E не входят в CI. Приёмка остального идёт разовыми скриптами, SQL-счётчиками и проверкой в браузере. Общие помощники для таких скриптов:

- `sql.mjs ENV_FILE app|migrator SQL` — единственный путь к разовому SQL. Отказывает базам без суффикса `_dev` или `_test` и env-файлу, который указывает не на «свою» базу (`.env` только на `_dev`, `.env.test` только на `_test`).
- `api.mjs` — `startApi`, `call` (через `node:http`, не `fetch`: часть портов `fetch` запрещает), `teacherCookie`, `studentCookie`, `sql`, `quote`. Фикстуры учителя и ученика создаются в `dvlab_test`, их пароли лежат в `STATE_DIR` (по умолчанию `$TMPDIR/dvlab-dev-checks`, переопределяется `DVLAB_CHECKS_DIR`).
- `web.mjs` — Chromium через playwright-core (путь в `PLAYWRIGHT_CORE`), `signIn` учителем из `.env`, `api`, `check`, `shot`; тема `dark` аргументом командной строки. Скриншоты пишутся только в `STATE_DIR`.

Проверки, которые меняют данные в `dvlab_dev`, используют только вымышленные карточки `Alex Example NNNN` и убирают их за собой. Реальные карточки не менять и не записывать.

## Local Google OAuth client

Живые проверки Google идут только на локальном стеке, с локальным OAuth-клиентом и только на тестовом аккаунте владельца (D-11). Рабочий календарь и прод не используются.

Локальный `.env` владельца содержит переменные `GOOGLE_CALENDAR_ENABLED=true`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_KEY_ID` и `GOOGLE_TOKEN_KEYRING`. Значения лежат только в этом файле, в репозиторий и отчёты не попадают.

`GOOGLE_REDIRECT_URI` проверяет `loadConfig` (`apps/api/src/config.ts`):

- путь всегда `/api/google/callback`, без query, hash и учётных данных в адресе;
- обычный локальный стек: `http://localhost:3000/api/google/callback` (`http://127.0.0.1:<порт>` тоже допустим), `APP_ORIGIN=http://localhost:3000`;
- туннель: `<origin туннеля>/api/google/callback` по HTTPS, `APP_ORIGIN` равен origin туннеля;
- при `NODE_ENV=production` адрес равен `APP_ORIGIN` + `/api/google/callback`, `APP_ORIGIN` только HTTPS.

Тот же адрес указывается в redirect URI локального OAuth-клиента в Google Cloud Console.

- `calendar-config.mjs` — проверка правила redirect URI на синтетических значениях, печатает `CALENDAR_CONFIG_OK`.
