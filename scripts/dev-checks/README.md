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
- `calendar-lease.mjs` — проверка `accessToken` без аренды аккаунта в `dvlab_test` с заглушкой Google: токен выдаётся при удержанной аренде, одно обновление на параллельных вызывающих, потерянный CAS не отключает аккаунт, отказ эндпоинта токена и ответ 403 внутри операции (R-08). Печатает `CALENDAR_LEASE_OK`.

## Проверки календаря фазы 25.1

Ни одна из них не обращается к настоящему Google: `calendar-offline.mjs` делает хосты Google недоступными процессу, шлюз заменён заглушкой. `calendar-env.mjs probe` печатает `OFFLINE_OK`, если блокировка действует.

Синтетический набор:

- `calendar-env.mjs` — общее окружение проверок: ключи токенов, запуск api (`startCalendarApi`), SQL к `dvlab_test` и `dvlab_dev`.
- `calendar-offline.mjs` — preload, закрывающий DNS-имена Google.
- `calendar-seed.mjs up|down|bump|state test|dev [сценарий]` — вымышленное подключённое расписание (`Alex Example NNNN`, `Synthetic event NN`) для браузерных проверок; `down` идемпотентен и убирает все строки набора.
- `calendar-dev-api.mjs` — api на порту 4000 с окружением набора, для браузерных проверок вместе с `yarn workspace @dv-lab/web dev`.

Проверки (каждая печатает свою строку успеха):

- `calendar-catalog.mjs` — структура таблиц проекции в `dvlab_test` (ключи, ограничения, права `dvlab_app`): `CALENDAR_CATALOG_OK`.
- `calendar-config.mjs` — `CALENDAR_CONFIG_OK`; `calendar-lease.mjs` — `CALENDAR_LEASE_OK`.
- `calendar-reads.mjs` — чтение недели, Today и карточек из SQL без Google и без аренды: `CALENDAR_READS_OK`.
- `calendar-commands.mjs check` — журнал команд и фикстуры (`fixtures test|dev`): `CALENDAR_COMMANDS_OK`.
- `calendar-sync.mjs pass|claim|loop` — полный и инкрементальный проходы, 410, захват строки, цикл и сроки: `PASS_OK`, `CLAIM_OK`, `LOOP_OK`.
- `calendar-push.mjs` — вебхук, каналы, продление, фильтр журналов Caddy: `CALENDAR_PUSH_OK`.
- `calendar-event-commands.mjs` — создание, правка и удаление любого события с областями: `CALENDAR_EVENT_COMMANDS_OK`.
- `calendar-inbound.mjs resolver|assign|inbound` — привязка, предложения, Assign и Ignore, применение изменений Google к урокам: `RESOLVER_OK`, `ASSIGN_OK`, `CALENDAR_INBOUND_OK`.
- `calendar-switch.mjs` — список календарей и смена календаря внутри аккаунта: `CALENDAR_SWITCH_OK`.
- `calendar-final.mjs` — запускает все перечисленные выше по порядку: каталог, настройки, аренда, чтение, команды, проходы, push, команды событий, привязка и применение, смена календаря, блокировка Google. Печатает по строке на проверку и `CALENDAR_FINAL_OK`. Использует `dvlab_test`: не запускать при параллельных исполнителях.
- Браузерные (нужен dev-стек, сценарий поднимает и останавливает его сам, перехватывает записи через `page.route`, обе темы аргументом `light` или `dark`): `calendar-web-grid.mjs` (`CALENDAR_WEB_GRID_OK`), `calendar-web-editor.mjs` (`CALENDAR_WEB_EDITOR_OK`), `calendar-web-drag.mjs` (`CALENDAR_WEB_DRAG_OK`), `calendar-web-settings.mjs` (`CALENDAR_WEB_SETTINGS_OK`).

### Живая сессия владельца

Не часть автоматических проверок и не задача исполнителя. Идёт на локальном стеке, с локальным OAuth-клиентом (раздел «Local Google OAuth client») и только на тестовом аккаунте Google владельца (D-11): рабочий календарь и прод не затрагиваются. Для push стек открывается временным HTTPS-туннелем; `APP_ORIGIN` и `GOOGLE_REDIRECT_URI` равны origin туннеля (D-20).

Владелец подтверждает:

- задержка push: изменение в Google доходит до недели без открытой страницы;
- настоящий 410: недействительный `sync_token`, записанный в `google_sync_state`, приводит к полному проходу без дублей уроков;
- допущения провайдера A1-A7 из `25.1-RESEARCH`; A2 (копия маркера при разделении серии), A3 (`originalStartTime` после правки «все события») и A6 (Assign на событиях других организаторов) — условие выпуска, `deploy/RUNBOOK.md`, раздел 13.2;
- сценарии D-21 из 13.2;
- каждая область (этот, этот и следующие, все): запись из приложения и из Google, результат совпадает;
- Assign и Ignore, в том числе маркер, переживший отключение и повторное подключение;
- смена календаря внутри аккаунта: события прежнего календаря скрыты, отметки на месте, первый полный проход нового календаря, `channels.stop` старым токеном.

Назад пишутся только «подтверждено» и счётчики, без названий календарей и содержимого событий.
