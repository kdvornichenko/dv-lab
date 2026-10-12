# dv-lab: инструкции для агентов

Личное рабочее пространство преподавателя. Монорепозиторий на Yarn 4 (workspaces, `nodeLinker: node-modules`) и Turbo, Node 24.

## Дизайн интерфейса

Источник правды по UI — Design System варианта A, выгруженная вне репозитория в `~/dv-lab-design/`. Версию бери из `~/dv-lab-design/VERSION` и записывай в план.

Для любого экрана или компонента читай оттуда:

- `project/principles.md` — решения владельца и глоссарий текстов;
- `project/components/<Name>/README.md` и `preview.html` нужного компонента;
- `project/tokens.css` — токены;
- `project/assets/Reference/` — скриншоты лабораторной версии.

Пересказ дизайна в промпте или плане не заменяет эти файлы. Нужного компонента или состояния там нет — запроси его у сессии дизайна (Design dude) и жди ответа с названием компонента и версией.

## Структура

- `apps/web` — Next 16 (App Router), сборка `next build --webpack` с `output: 'standalone'`. Шрифты Inter Variable и JetBrains Mono Variable из пакетов `@fontsource-variable/inter` и `@fontsource-variable/jetbrains-mono`, без обращения к Google.
- `apps/api` — Hono на `@hono/node-server`, отдельный процесс за прокси. Сборка `tsdown` в `apps/api/dist/server.mjs`, `apps/api/dist/migrate.mjs`, `apps/api/dist/bootstrap-teacher.mjs` (CLI первого учителя и восстановления его пароля) и `apps/api/dist/import-vault.mjs` (импорт vault: команды `parse` и `apply`), `@dv-lab/*` вшиваются в бандл, миграции копируются в `apps/api/drizzle`.
- `packages/core` — JIT-пакет `@dv-lab/core` (экспортирует исходники `src/index.ts`): чистые функции денег и уроков, правило остатка (`balance.ts`), исход и действия урока (`schedule.ts`), зоны (`zoned.ts`) и порог Pays soon (`lessons.ts`). `SCHEDULE_TIME_ZONE` = `Asia/Ho_Chi_Minh`. Без зависимостей, без Node API и без базы. Его вызывают web, api и импорт vault.
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
| `yarn test:e2e` | Playwright: девять journeys фазы 21 в light/dark, один воркер; нужен dev-стек, `.env` с dev-учителем и установленный Chromium. Артефакты только в `STATE_DIR` вне репозитория; в CI не входит |
| `yarn knip` | неиспользуемые файлы, экспорты и зависимости |
| `yarn format` / `yarn format:check` | Prettier |
| `yarn db:generate` | `drizzle-kit generate`: новая миграция из `packages/db/src/schema.ts` |
| `yarn db:migrate` | применение миграций под ролью миграций (`apps/api/src/migrate.ts`) |

CI (`.github/workflows/ci.yml`) на каждый pull request и push в `master`: job `Verify` проверяет границу web, api, contracts и core (шаг `Web and api boundary`) и доверие к адресу клиента в `deploy/` (шаг `Client address trust`), поднимает `postgres:18`, готовит роли через `deploy/postgres/ensure-db.sql`, проверяет синхронность схемы и миграций, гоняет миграции, typecheck, lint, test, build, knip, `caddy validate` и shellcheck скриптов `deploy/`. Job `images` собирает образы после зелёного `Verify`; на push в `master` публикует их в GHCR с тегами `sha-<полный sha>` и `latest`.

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
- `apps/web` не импортирует код api и базы: в `apps/web/package.json` нет `@dv-lab/api` и `@dv-lab/db`, в исходниках web нет их импортов, каталога `apps/web/app/api` нет, `transpilePackages` в `apps/web/next.config.ts` нет. `packages/contracts` не импортирует `pg`, `node:*` и `@dv-lab/*` и не читает `process.env`. У `packages/core` нет зависимостей, он не импортирует `pg`, `node:*` и `@dv-lab/*` и не читает `process.env`. Эти условия проверяет шаг CI `Web and api boundary`.
- Тип `DbExecutor` (база или транзакция) — `packages/db/src/connection.ts`. Разбор ошибок Postgres (`violatesUnique`, `postgresCode`, `postgresErrorFields`) — `packages/db/src/postgres-errors.ts`.
- Доверие к адресу клиента: api берёт адрес из правого значения `X-Forwarded-For`, которое дописывает Caddy. У api в `deploy/compose.yaml` нет `ports`, в `deploy/caddy/Caddyfile` нет `trusted_proxies`, у сети `default` включён IPv6. Это проверяет шаг CI `Client address trust`.
- Порядок входа (проверка пароля, ограничение попыток, выдача сессии) принадлежит `apps/api/src/auth/sign-in.ts`: `createSignIn().attempt`, экземпляр создаётся в `server.ts`.
- Эпоха аккаунта и сессии (выдача, чтение, продление, отзыв) принадлежат `apps/api/src/auth/sessions.ts`.
- Отображение строк `accounts` в ответы api принадлежит `apps/api/src/auth/account-rows.ts`.
- Учётные записи (первый учитель, ученики, деактивация, смена пароля, восстановление пароля учителя) принадлежат `apps/api/src/auth/accounts.ts`. Он единственный создаёт аккаунты, привязывает их к карточке и деактивирует.
- Модуль карточек `apps/api/src/cards` владеет записью и чтением карточки, секций, словаря и оплат, аккаунтом карточки (`card-account.ts`). Для остатка он загружает сырые оплаты; отбор оплат и вычеты принадлежат `packages/core`. Из `auth/` он импортирует только `accounts.ts`, маршруты карточек и оплат — ещё `middleware.ts`.
- Маршруты карточек: `/students` — карточки, `/students/:id/account*` — аккаунт карточки, `/payments` — оплаты. `StudentRow` — строка карточки, `StudentAccount` — аккаунт ученика.
- Импорт vault — `apps/api/src/import-vault.ts`. `parse` выполняет владелец над каталогом vault (`apps/api/src/import/parse-vault.ts`), пакет по схеме `apps/api/src/import/packet.ts` уходит в stdout. `apply` читает пакет из stdin и пишет его одной транзакцией только через модуль карточек (`apps/api/src/import/apply-packet.ts`) под ролью приложения. На сервере `apply` запускает одноразовый сервис `import` профиля `tools` в `deploy/compose.yaml` (`deploy/RUNBOOK.md`, раздел 11).
- HTTP-сторона входа (проверка Origin, адрес клиента, cookie сессии, ответы отказа, `no-store`) принадлежит `apps/api/src/auth/middleware.ts`.
- Клиентские запросы web к api идут только через `apps/web/lib/api-client.ts` (`apiRequest`, путь без префикса `/api`).
- Проверка формы cookie сессии и редирект на `/login` — `apps/web/proxy.ts`; «кто я» на сервере web — `apps/web/lib/session.ts` (`getMe`, `requireTeacherPage`).
- Страницы 404 и ошибки — `apps/web/components/app/status-pages.tsx`; корневые `not-found.tsx`, `error.tsx` и `global-error.tsx` только вызывают их. Ошибка чтения целого экрана — `apps/web/components/app/read-error.tsx`. Скелетоны — `apps/web/components/ui/skeleton.tsx`.
- Вид markdown в web — `apps/web/components/app/markdown-view.tsx` (`react-markdown` со `skipHtml`). Строки денег, уроков и дат оплат — `apps/web/components/app/ledger-text.tsx` поверх `packages/core`.
- Правило видимости вхождения (дата серии в диапазоне `[starts_on, ends_on]`, исключение учитывается только через `occurrenceAt`, история за концом серии и пустая серия скрыты), разрез и окончание серии (`cutSeries`, `endSeriesAt`) и даты окна (`windowDates`) принадлежат `packages/core` (`schedule.ts`, `zoned.ts`). api и web второго правила не держат, браузер серии не раскрывает.
- Правило остатка — `packages/core/src/balance.ts`: `studentBalance`, `countsAfterOpening`, `lessonDeduction` и `markEffect`. Даты оплат и уроков строго позже даты открытия; дата урока — по Вьетнаму. Done вычитает длительность, No-show — при `noShowDeducts`, включая прошлые неявки; долг не обрезается, `null` («не задан») отличается от нуля. `needsMark` и `todayCounts` владеют отбором ожидающих отметки уроков и счётчиками Today.
- Исход урока и доступность действий — `packages/core/src/schedule.ts`: `lessonOutcome`, `occurrenceOutcome`, `countsAsLesson`, `isMarked`, `lessonActions`, `awaitsMark`, `withOutcomes`. Поставить, исправить и снять отметку можно по полю `mark` результата `lessonActions`; неотмеченный будущий урок отметить нельзя, уже отмеченный можно исправить в любое время.
- «Сегодня» и дата урока по Вьетнаму — `scheduleToday`, `scheduleDate`, `isAfterScheduleToday` из `packages/core/src/schedule.ts`. Порог и слова остатка — `packages/core/src/lessons.ts`: `PAYS_SOON_LESSONS_DEFAULT`, `balanceState`, `paysSoon`, `paysSoonList`, `balancePhrase`. В Pays soon входят активные карточки с остатком не больше порога, включая долг; «не задан» не входит.
- Модуль `apps/api/src/schedule` владеет чтением недели и мутациями расписания. `schedule.ts: readWindow` — единственная сборка блоков для недели и Today; блок контракта несёт `outcome`, `actions`, `ledger` и `mark`, без `status` и `changeable`. `rows.ts` загружает строки окна и «от сейчас», держит мапперы и блокировки `lockSeries`, `lockLesson`. Это место встречи contracts и core: `toMarkKind` по `MARK_KINDS`, адаптеры core → контракт через тип `Mirror`, `toBalanceCard`.
- Отметки принадлежат `apps/api/src/schedule/marks.ts`: `POST /schedule/series/:id/occurrences/:originalOn/mark` и `POST /schedule/lessons/:id/mark`. `kind: none` снимает отметку; строки `lesson_marks` не удаляются. Неотмеченный будущий урок даёт `400 lesson_not_started`.
- Перенос, отмена и возврат в `schedule/changes.ts` следуют `lessonActions` из core, включая начавшийся и прошедший урок. Перенос — на любые дату и время (D-17), отказов по времени нет. Отметка едет с уроком на том же ключе; вычет считается по новой дате, призрак на старом месте не вычитает. Мутации идут в транзакциях с `FOR UPDATE`: запрещённое действие, призрак или устаревший `expectedStartsAt` дают `409 lesson_changed`. Отменённый урок можно вернуть, но нельзя перенести или отменить повторно. Строки расписания не удаляются: меняются статус, `kind` или `ends_on`. Маршруты — `apps/api/src/routes/schedule.ts`.
- Разрез и окончание серии в `schedule/series.ts` используют `cutSeries` и `endSeriesAt` из core; даты — только от сегодня. При разрезе `400 series_today_passed` означает, что сегодняшнее вхождение уже началось; `400 series_ends_before_new_day` — что серия заканчивается до первого урока на новом дне. Повторный разрез пустой серии возвращает `409 lesson_changed` по `hasOccurrences` из core.
- Производные факты карточки (остаток и `nextLessonAt`) считает `apps/api/src/cards/card-facts.ts`. Это единственная точка остатка для списка, профиля и Today: в `studentBalance` идут карточка через `toBalanceCard`, сырые оплаты и отметки из `loadMarkRows`. `apps/api/src/schedule/rows.ts: loadMarkRows` раскрывает отметки через `occurrenceAt` с текущими датой, длительностью и исходом. `schedule` не импортирует `cards`.
- `apps/api/src/today/today.ts: readToday` собирает schedule, cards и settings для `GET /today`: уроки дня, Earlier, not marked и Pays soon. `apps/api/src/settings/settings.ts` владеет `teacher_settings` (`readPaysSoonLessons`, `savePaysSoonLessons`); `GET /settings` и `PATCH /settings` берут id аккаунта только из сессии учителя.
- Показ дат расписания — `apps/web/lib/schedule-format.ts` (`Intl` с явной зоной). Список зон, сокращения меток (`zoneLabel`) и поиск — `apps/web/lib/time-zones.ts`. Второй пояс и избранные зоны — `apps/web/components/app/time-zone-picker.tsx` (`TimeZonePicker`), хранение только в `localStorage`. Время урока во второй зоне показывает `apps/web/components/app/time-pair.tsx`.
- Мутации расписания в web — `mutate`, мутация отметки — `markLesson` из `apps/web/app/(app)/schedule/_components/schedule-mutations.ts`; доступность отметки задаёт `actions.mark` блока. Общий хост диалогов урока для расписания и Today — `apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx` (`LessonDialogs`). Слова статуса, слот блока и подписи отметок — `apps/web/lib/lesson-mark-text.ts`. Остаток и долг — `apps/web/components/app/student-balance.tsx` поверх core.
- Экран Today — `apps/web/app/(app)/_components`; минутное `now` — `use-minute-now.ts` (`useMinuteNow`), счётчики — `todayCounts` из core. Settings → General — `apps/web/app/(app)/settings`: порог Pays soon и второй пояс.
- Дизайн расписания — артефакт дизайн-системы (WeekGrid, ScheduleToolbar, EventColors, EventTooltip, LessonDialog); цвет блоков в этой фазе — токен `selected`.
- UI web — только Base UI и копия компонентов варианта A (`components/ui`, `components/sidebar-app`, `components/fluid-hover-highlight.tsx`, `hooks`, двенадцать файлов `lib`; knip их не проверяет). Импорты `radix-ui`, `@radix-ui/*` и `cmdk` запрещены правилом ESLint. Рукописные части экранов лежат в `apps/web/components/app` и `apps/web/app`.

## База

- PostgreSQL 18. Роли, база, схема `extensions` и расширения создаёт только `deploy/postgres/ensure-db.sql` (идемпотентный, запускается суперпользователем). `CREATE EXTENSION` в миграциях не пишется.
- Миграции генерирует `yarn db:generate`, руками сгенерированные файлы не правятся, `drizzle-kit push` не используется.
- Миграции одного релиза только добавляют (новые таблицы, колонки, индексы). Удаление и переименование — отдельным релизом, когда код прошлой версии уже не работает с этими объектами.
- Миграции применяются отдельным шагом под `dvlab_migrator`: локально `yarn db:migrate`, на сервере одноразовый сервис `migrate` из образа api (`node apps/api/dist/migrate.mjs`).
- Расписание: таблицы `lesson_series`, `lesson_exceptions` (ключ `series_id` + `original_on`, `kind` — `cancelled`, `moved` или `restored`) и `lessons`; внешние ключи `ON DELETE RESTRICT`. Вхождение считается через `occurrenceAt`, а не по наличию строки исключения; время переноса у `cancelled` и `restored` — только история. Пустая серия — `ends_on = starts_on - 1`. Колонки правила серии после вставки не меняются.
- Ключ вхождения стабилен только для прошлых вхождений и для серии после её последнего разреза: разрез даёт новую серию с новыми ключами будущих вхождений. Разрез и окончание серии сохраняют перенесённые и отмеченные вхождения хвоста как одиночные уроки, включая отмеченные `restored` и `cancelled`. `apps/api/src/schedule/series.ts` копирует отметки на новые строки `lessons`; отменённые уроки сохраняют статус `cancelled`. Синхронизации с Google (фаза 24) нужен маппинг или пересборка событий при разрезе.
- Подключения Google хранятся по истории: у аккаунта одна текущая строка `google_connections` (`retired_at is null`, частичный уникальный индекс), текущую строку выбирает `currentConnection` из `apps/api/src/calendar/credentials.ts`. Подключение другого аккаунта после отключения (`install` в `apps/api/src/calendar/connection.ts`) переводит старую строку в архив (`retired_at`), её привязки событий — в `retired` и создаёт новую строку; строки старого календаря не удаляются и не переносятся. При незавершённых командах смена отклоняется кодом `command_pending`. Действие снимка `switch` (только при сохранённом календаре) web выполняет сам: отключает текущий аккаунт, ждёт `not_connected` и уходит на согласие Google (`switchAccount` в `apps/web/components/app/google-calendar-state.tsx`).
- `lesson_marks`: ключ `series_id + original_on` либо `lesson_id`, `kind` = `done | no_show | none`, FK `ON DELETE RESTRICT`. У `dvlab_app` нет `DELETE` и `TRUNCATE`; снятие отметки меняет `kind` на `none`.
- `teacher_settings`: ключ `account_id`, `pays_soon_lessons` — целое 0..20 без DEFAULT в базе. Без строки действует `PAYS_SOON_LESSONS_DEFAULT` из core. `students.no_show_deducts` имеет `DEFAULT true`; PATCH карточки без `noShowDeducts` колонку не трогает.
- Тесты идут на настоящем Postgres в базе `dvlab_test` под ролями `dvlab_app` и `dvlab_migrator`. Данные между тестами очищаются `TRUNCATE` под `dvlab_migrator`. Адаптера базы в памяти нет.

## Версии

- Версии зависимостей закреплены точно, без `^` и `~`.
- Возрастной барьер Yarn (`npmMinimalAgeGate: 1440`, пакеты младше суток не ставятся) не отключается.
- TypeScript 6.0.3, а не 7.x: `typescript-eslint` (через `eslint-config-next`) не поддерживает TypeScript 7.0.
- `drizzle-orm` и `drizzle-kit` 1.0.0-rc.4: стабильного v1 нет, `latest` указывает на 0.45, проект работает на v1.
- Версия `turbo` в `ARG TURBO_VERSION` обоих Dockerfile совпадает с `devDependencies.turbo` корневого `package.json`, CI это проверяет.

## Документация Google Calendar

При планировании или изменении интеграции Google Calendar сначала прочитайте `docs/google-calendar/READING.md`, затем нужные локальные статьи и схемы. В плане укажите прочитанные файлы и разделы, которые обосновывают методы API, поля, ограничения и обработку ошибок. Перед исполнением проверьте актуальность изменяемых условий по официальным источникам; сохраните дату проверки и расхождения со снимком. Наличие справки не расширяет scope фазы и не разрешает запись в Google.

## Помощники для агентов

- Правила исполнителя фазы GSD: `.planning/EXECUTOR-RULES.md`; охрана корня worktree: `scripts/gsd/root-pin.sh`; режим изоляции перед запуском исполнителей: `scripts/gsd/dispatch.sh <фаза>`.
- Разовый SQL, фикстуры api и браузер: `scripts/dev-checks/` (описание в `README.md`).
- Приёмка расписания: `scripts/dev-checks/schedule-db.mjs` (`catalog`), `schedule-core.mjs`, `schedule-api.mjs` (разделы `read`, `next`, `changes`), `schedule-web.mjs` (разделы `fade`, `frame`, `read`, `changes`, `students`, `grid`, `forms`, `zones`, `settings`, `drag`, тема светлая или тёмная) и `wait-dev.mjs` (`up` — ждать dev-стек на портах 3000 и 4000, `down` — порты свободны).
- Приёмка учёта уроков: `scripts/dev-checks/ledger-db.mjs` (`catalog`; `migrate` вызывает `schedule-db.mjs migrate`, число папок миграций задаёт `schedule-db.mjs`), `ledger-core.mjs`, `ledger-api.mjs` (разделы `marks`, `past`, `moves`, `cut`, `race`, `balance`, `flag`, `today`), `ledger-settings.mjs` и `ledger-web.mjs` (разделы `marks`, `students`, `settings`, `today`, `today-marks`, `today-payment`; сценарии в `scripts/dev-checks/ledger-web/`).
- Проверка коммита на имена учеников и пакеты импорта: `scripts/privacy-check.mjs` (ставится один раз командой `node scripts/privacy-check.mjs --install`, список имён обновляется `--refresh` и лежит вне репозитория).

## Публичный репозиторий

Репозиторий публичный. Адресов серверов, паролей, ключей и данных учеников нет нигде, включая `.planning/`, `deploy/` и тестовые данные. `.env*` не коммитятся и не попадают в контекст сборки образов (`.dockerignore`). Секреты сервера лежат только на сервере.

Пакет импорта vault содержит данные учеников и лежит вне репозитория: маска `*.vault-import.json` закрыта в `.gitignore` и `.dockerignore`, в образ и логи пакет не попадает. `apply` печатает только счётчики. В коде, тестах, `.planning/` и SUMMARY нет имён, сумм и заметок учеников.

## Выкатка и сервер

Подготовка VPS, выкатка, откат, бэкапы и восстановление — `deploy/RUNBOOK.md`.
