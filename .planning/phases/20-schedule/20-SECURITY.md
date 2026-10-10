---
phase: 20
slug: schedule
status: verified
verdict: SECURED
threats_open: 0
threats_total: 36
threats_closed: 36
asvs_level: 2
block_on: high
audited_head: 6e5982a
created: 2026-10-10
---

# Фаза 20 — Security

Аудит соответствия: каждая митигация из `<threat_model>` планов 20-01..20-10 сверена с кодом ветки `gsd/phase-20-schedule` (HEAD `6e5982a`). Уровень ASVS L2: проверено, что защита стоит на нужной границе (группа маршрутов, транзакция с блокировкой строки, ограничение базы), а не только что строка есть в файле. В `.planning/config.json` и `~/.gsd/defaults.json` нет `asvs_level` и `block_on`: применены значения по умолчанию `block_on: high` и `asvs_level: 2` (как в фазе 19). Код фазы не менялся.

## Итог

**Verdict: SECURED.** `threats_open: 0`.

| Всего | CLOSED | OPEN, блокирует | OPEN, не блокирует |
|-------|--------|-----------------|--------------------|
| 36    | 36     | 0               | 0                  |

36 строк = 26 угроз T-20-01..T-20-26 и 10 строк T-20-SC (по одной на план). По disposition: mitigate 25, accept 11 (T-20-24 и T-20-SC всех десяти планов), transfer 0. План 20-TP (TimePair) без `<threat_model>`, см. INFO-20-05.

## Независимые проверки аудита

- **Имена учеников.** Скрипт аудита сверил приватный список (24 имени, `~/.claude/private/student-names.txt`) со всеми 97 файлами, изменёнными от слияния фазы 19 (`d24da59`) до HEAD, включая `20-CONTEXT.md`, `20-DISCUSS*.html`, `20-RESEARCH.md`, все PLAN и SUMMARY, и с сообщениями всех коммитов этого диапазона; имена не печатались. Найдено одно совпадение: строка `.planning/ROADMAP.md:247`, написанная коммитом `5cf1389` (2026-10-09, roadmap milestone v2.0) до начала фазы и уже лежащая в `master`. Это повтор INFO-19-02, новой утечки фаза 20 не добавила. Скан плана 20-10 (`PRIVACY_OK files=403`) исключал ROADMAP, REQUIREMENTS и 20-CONTEXT, поэтому этой строки не видел; скан аудита включает и их.
- **Секреты и адреса.** В файлах фазы нет адресов домашнего сервера, строк подключения с паролем, ключей и токенов. `.env` и `.env.test` игнорируются (`.gitignore:38-39`); отслеживаемых `.png`, `.jpg`, `.webp` нет.
- **Зависимости.** Diff от `d24da59` до HEAD по `yarn.lock`, `**/package.json` и `.yarnrc.yml` пуст: пакеты в фазе не ставились и не менялись.
- **База `dvlab_dev`** (только SELECT через `scripts/dev-checks/sql.mjs`): владелец `lessons`, `lesson_series`, `lesson_exceptions` — `dvlab_migrator`; у `dvlab_app` нет TRUNCATE, есть DELETE (ожидаемо по 20-01, см. INFO-20-02); пробных карточек `Alex Example 20%` без `import_key` 0.
- **База `dvlab_test`** (только SELECT): все три внешних ключа расписания с `confdeltype = r` (RESTRICT); пробных карточек 0.
- **Покрытие middleware.** `routes.use('*', noStore, requireSession(db), requireRole('teacher'))` подприложения, смонтированного на `/schedule`, покрывает корень группы и все вложенные пути (тот же механизм, что проверен в 19-SECURITY для `/students`). Других маршрутов фаза не добавила: в `apps/api/src/routes` изменён только `schedule.ts`.
- **IDOR.** Проверки владельца строки нет и не нужна: активный учитель в базе один (`accounts_one_active_teacher_uq`, `packages/db/src/schema.ts:46-48`, `20261009150610_accounts/migration.sql:38`), сессия ученика получает 403 (`scripts/dev-checks/schedule-api.mjs:274-276`). Всё, что видит роль teacher, принадлежит этому учителю.
- **Конверт ошибок.** Клиент получает только код, статичный текст и requestId (`apps/api/src/request-context.ts:60-62`, `apps/api/src/app.ts:28-39`); 5xx — `internal_error` без деталей (`apps/api/src/app.ts:72-78`); `readJson` возвращает `null` без текста zod (`apps/api/src/auth/middleware.ts:92-103`); ошибки драйвера в журнал попадают без текста запроса и параметров (`apps/api/src/request-context.ts:13-18`).

## Реестр угроз

Пути без префикса: `api/` = `apps/api/src/`, `web/` = `apps/web/`, `sched/` = `apps/web/app/(app)/schedule/_components/`, `contracts` = `packages/contracts/src/schedule.ts`, `core` = `packages/core/src/schedule.ts`, `migration.sql` = `packages/db/drizzle/20261010075813_schedule/migration.sql`, `checks/` = `scripts/dev-checks/`.

| Threat ID | Категория | Severity | Disposition | Evidence | Status |
|-----------|-----------|----------|-------------|----------|--------|
| T-20-01 | Tampering | medium | mitigate | CHECK `migration.sql:10-12` (kind, moved, minutes), `:25-29` (weekday, isodow, ends_on, секунды, minutes), `:40-41` (status, minutes); пробы 23514 `checks/schedule-db.mjs:77-113` | CLOSED |
| T-20-02 | Tampering | high | mitigate | FK ON DELETE RESTRICT `migration.sql:48-50`, в `dvlab_test` `confdeltype = r` у всех трёх; проба удаления карточки с серией → 23001 restrict_violation `checks/schedule-db.mjs:115-119` (план ждал 23503, RESTRICT даёт 23001, защита та же); пустая серия через `ends_on >= starts_on - 1` `migration.sql:27`, `core:246-248` | CLOSED |
| T-20-03 | Elevation of privilege | medium | mitigate | таблицы создаёт миграция под `dvlab_migrator` (владелец всех трёх в `dvlab_dev`); `has_table_privilege` для select/insert/update/delete/truncate `checks/schedule-db.mjs:10-11,131-146`; в `dvlab_dev` TRUNCATE у `dvlab_app` false | CLOSED |
| T-20-04 | Tampering | medium | mitigate | `checks/sql.mjs:30-42` отказывает базам без `_dev`/`_test` и проверяет пару файл и база; все пробы идут через него (`checks/schedule-db.mjs:24-37`, `checks/api.mjs:29-42`, `checks/web.mjs:24-25`); режим `migrate` сверяет имя базы точно (`checks/schedule-db.mjs:157-169`); прямых `pg.Client` в скриптах фазы нет | CLOSED |
| T-20-SC (20-01) | Tampering | low | accept | см. «Принятые риски» | CLOSED |
| T-20-05 | Denial of service | medium | mitigate | `SEARCH_DAYS = 366` `core:172`, циклы `core:178-186` и `core:206-215` ограничены им; окно недели 7 дней `api/schedule/schedule.ts:97-98`; границы года `api/routes/schedule.ts:38-40,60-65`; `windowDates` идёт только по датам окна `packages/core/src/zoned.ts:93-99` | CLOSED |
| T-20-06 | Tampering | medium | mitigate | `contracts:5,17-25` (isIsoDate, CLOCK_TIME_PATTERN, minutes 15..240, weekday 1..7, `z.iso.datetime`), схемы тел `contracts:27-53` (uuid, `z.enum(REPEATS)`); `isIsoDate` `packages/contracts/src/students.ts:50-58`; маршруты разбирают тела только через `readJson(c, schema)` `api/routes/schedule.ts:90,106,120,131,145,156,172` | CLOSED |
| T-20-07 | Tampering | medium | mitigate | видимость только через `occurrenceAt` (`core:92-108`): `scheduleWindow` `core:123,142`, мутации `api/schedule/changes.ts:64,79`; серии в ответе недели только показанные `api/schedule/schedule.ts:102,106`; moved-исключения вне диапазона серии отсекаются `occurrenceAt` (null) | CLOSED |
| T-20-SC (20-02) | Tampering | low | accept | см. «Принятые риски» | CLOSED |
| T-20-08 | Tampering | medium | mitigate | `web/components/ui/time-picker.tsx:2-11` и `web/components/ui/input-group.tsx:2-9`: импорты только react, react-dom, lucide-react, class-variance-authority и локальные `@/components/ui/*`, `@/lib/utils`; нет `fetch(`, `eval(`, `new Function`, `import(`, `process.env`, `dangerouslySetInnerHTML`; пакетов `radix`/`cmdk` в `web/` нет (единственное совпадение — CSS-переменная `--radix-dropdown-menu-trigger-width` в `web/lib/sidebar-menu-grid.ts:3`, файл до фазы) | CLOSED |
| T-20-SC (20-03) | Tampering | low | accept | см. «Принятые риски» | CLOSED |
| T-20-09 | Elevation of privilege | high | mitigate | `api/routes/schedule.ts:81` `routes.use('*', noStore, requireSession(db), requireRole('teacher'))`; монтирование `api/app.ts:71`; `requireSession`/`requireRole` `api/auth/middleware.ts:75-90`; проверки 401 без cookie и 403 сессии ученика `checks/schedule-api.mjs:267,274-276` | CLOSED |
| T-20-10 | Denial of service | medium | mitigate | `weekStart`: ISO-дата, понедельник, `2000-01-03..2100-12-27`, иначе 400 `api/routes/schedule.ts:38-40,60-65,84-85`; окно 7 дней `api/schedule/schedule.ts:97-98` | CLOSED |
| T-20-11 | Tampering | medium | mitigate | глобальный `sameOrigin(appOrigin)` `api/app.ts:44` до всех маршрутов; без Origin пропускает только `sec-fetch-site: same-origin` `api/auth/middleware.ts:32-42`; вторая линия — `readJson` требует `application/json` `api/auth/middleware.ts:93-94`; cookie `SameSite=Lax` `api/auth/middleware.ts:24`; проверка 403 без Origin `checks/schedule-api.mjs:257-266` | CLOSED |
| T-20-12 | Information disclosure | medium | mitigate | журнал запросов пишет только method, path, status, durationMs `api/request-context.ts:47-55`; пути содержат uuid и даты, не имена; ошибки без параметров запроса `api/request-context.ts:13-18`; проверка «api log has no fixture name» `checks/schedule-api.mjs:1009`; фикстуры `Alex Example 20NN` `checks/schedule-api.mjs:8-9`, `checks/schedule-web.mjs:730-732` | CLOSED |
| T-20-13 | Tampering | low | mitigate | в `api/schedule/*` и `api/routes/schedule.ts` только построитель drizzle; единственный сырой фрагмент — константа `now()` в шаблоне `sql` (`api/schedule/series.ts:29,48`, `api/schedule/changes.ts:75,174`); `sql.raw` нет; id через `z.uuid()` `api/routes/schedule.ts:67-70`, даты через `isIsoDate` `:72-77` | CLOSED |
| T-20-SC (20-04) | Tampering | low | accept | см. «Принятые риски» | CLOSED |
| T-20-14 | Tampering | low | mitigate | `normalize`: `isTimeZone` и исключение вьетнамских алиасов, иначе `Europe/Moscow` `sched/second-zone-select.tsx:22-26`; чтение и запись в try `:28-34,47-52`; алиасы `web/lib/time-zones.ts:15-19`; значение используется только в `Intl`, в запросах api его нет (`sched/schedule-mutations.ts:63`, `sched/new-lesson-dialog.tsx:147-153`, `sched/schedule-screen.tsx:53`) | CLOSED |
| T-20-15 | Information disclosure | low | mitigate | скриншоты пишутся в `STATE_DIR` `checks/web.mjs:81-82`, `STATE_DIR` = `${tmpdir()}/dvlab-dev-checks` вне репозитория `checks/paths.mjs:5`; изображений в ветке нет | CLOSED |
| T-20-SC (20-05) | Tampering | low | accept | см. «Принятые риски» | CLOSED |
| T-20-16 | Tampering | medium | mitigate | все мутации в `db.transaction` с `SELECT … FOR UPDATE`: `lockSeries`/`lockLesson` `api/schedule/rows.ts:109-117`, карточка при создании `api/schedule/schedule.ts:112-116`; проверка состояния через `occurrenceAt` и `expectedStartsAt` → `changed` → 409 `api/schedule/changes.ts:44-46,103-110,132-139,155-162,185-191,202-208,217-223`, `api/routes/schedule.ts:46-47,53-54`; других писателей `lesson_exceptions` нет (вставка только `api/schedule/changes.ts:71`); проверка гонки двух одинаковых запросов `checks/schedule-api.mjs:626-627,703,731`. `expectedStartsAt` необязателен — INFO-20-01 | CLOSED |
| T-20-17 | Tampering | high | mitigate | `canChange` `core:62-64` в каждой мутации: начавшийся урок → 409 `api/schedule/changes.ts:106,135,158,187,204,219`; цель в прошлом → 400 `api/schedule/changes.ts:48-52,111-112,192-193`; From раньше сегодня → 400 `core:274`; разрез с From = сегодня после начала урока → 409 `core:277-279`; Last lesson on раньше сегодня → 400 `core:316`, серия уже кончилась → 409 `core:315`; weekly с датой в прошлом → 400 `api/schedule/schedule.ts:131`. Создание одиночного урока на прошедшую дату `api/schedule/schedule.ts:118-129` разрешено намеренно (`20-04-PLAN.md:33` «дата в прошлом допустима»): это запись истории, а не правка прошедшего урока | CLOSED |
| T-20-18 | Repudiation | high | mitigate | в `api/schedule/*` и `api/routes/schedule.ts` нет `.delete(`, `delete from`, `truncate`; меняются только `status` `api/schedule/changes.ts:170-178`, `kind` (upsert) `:70-77` и `ends_on` `api/schedule/series.ts:27-30,46-50`; отмена не стирает время переноса: для `cancelled` и `restored` поля `starts_at`/`duration_minutes` в `set` не входят `api/schedule/changes.ts:68-69,75`; на уровне базы — FK RESTRICT (T-20-02). Право DELETE у `dvlab_app` остаётся — INFO-20-02 | CLOSED |
| T-20-19 | Tampering | low | mitigate | `idParam` `z.uuid()` и `occurrenceParam` `isIsoDate` → 404 `api/routes/schedule.ts:67-77,104-105,118-119,129-130,143-144,154-155,170-171`; тела через схемы контрактов | CLOSED |
| T-20-SC (20-06) | Tampering | low | accept | см. «Принятые риски» | CLOSED |
| T-20-20 | Tampering | low | mitigate | имя и цель выводятся текстовыми узлами React `sched/lesson-dialog.tsx:137-143,183`, `sched/end-series-dialog.tsx:101`, `sched/move-series-dialog.tsx:146`; `aria-label` — строка из `join` `sched/lesson-block.tsx:85-111`; ссылка `/students/${studentId}` строится из uuid базы `sched/lesson-dialog.tsx:140`; `dangerouslySetInnerHTML`, `innerHTML`, `eval` в `web/app`, `web/components`, `web/lib` нет | CLOSED |
| T-20-21 | Information disclosure | medium | mitigate | скриншоты только в `STATE_DIR` (см. T-20-15); очистка трогает только `display_name like 'Alex Example 20…%' and import_key is null` `checks/schedule-web.mjs:7-28,730,1834,1851`; в SUMMARY только счётчики. Шаблон по умолчанию шире, чем в плане — INFO-20-04 | CLOSED |
| T-20-SC (20-07) | Tampering | low | accept | см. «Принятые риски» | CLOSED |
| T-20-22 | Tampering | low | mitigate | `if (pending) return` `sched/lesson-dialog.tsx:118`, `sched/lesson-move-form.tsx:101`, `sched/end-series-dialog.tsx:63`, `sched/move-series-dialog.tsx:107`, `sched/new-lesson-dialog.tsx:139`; кнопка `loading`/`disabled` `sched/new-lesson-dialog.tsx:327-330`; сервер отвечает 409 на повтор (T-20-16, проверка гонки) | CLOSED |
| T-20-23 | Tampering | medium | mitigate | `expectedStartsAt: block.startsAt` `sched/lesson-move-form.tsx:107`, `sched/schedule-screen.tsx:231`; 409 и 404 → `stale` `sched/schedule-mutations.ts:65`; прошлое защищает сервер (T-20-17); действий у прошлого нет: `changeable: canChange(...)` `api/schedule/schedule.ts:82` | CLOSED |
| T-20-SC (20-08) | Tampering | low | accept | см. «Принятые риски» | CLOSED |
| T-20-24 | Information disclosure | low | accept | см. «Принятые риски» | CLOSED |
| T-20-SC (20-09) | Tampering | low | accept | см. «Принятые риски» | CLOSED |
| T-20-25 | Information disclosure | high | mitigate | скан плана 20-10 `PRIVACY_OK` (`20-10-SUMMARY.md:45,56`); независимый скан аудита по всем 97 файлам фазы и сообщениям коммитов: новых имён 0 (одно старое совпадение в `ROADMAP.md`, см. INFO-20-03); фикстуры только `Alex Example 20NN` | CLOSED |
| T-20-26 | Tampering | low | mitigate | счётчик фикстур в `dvlab_dev` после проверки = 0 (SELECT аудита 2026-10-10), в `dvlab_test` = 0; очистка в начале и в `finally` разделов `checks/schedule-web.mjs:22-28` | CLOSED |
| T-20-SC (20-10) | Tampering | low | accept | см. «Принятые риски» | CLOSED |

## Принятые риски

| Threat ID | Риск | Обоснование и остаточная защита |
|-----------|------|---------------------------------|
| T-20-24 | Поиск учеников на клиенте раскрывает данные карточек | Новых конечных точек нет: поиск фильтрует уже загруженный учителем `GET /students` (`apps/web/app/(app)/students/_components/students-screen.tsx:36,168-169`, D-12). Маршрут `/students` закрыт сессией и ролью teacher (`apps/api/src/routes/students.ts:69`). |
| T-20-SC (20-01..20-10) | Цепочка поставок зависимостей | Ни один план фазы пакеты не ставит и не меняет: diff от слияния фазы 19 (`d24da59`) до HEAD по `yarn.lock`, `**/package.json`, `.yarnrc.yml` пуст; `class-variance-authority` для `input-group.tsx` уже был в `apps/web`. Установка по существующему `yarn.lock` (`yarn install --immutable`, `.github/workflows/ci.yml:121`); `.yarnrc.yml` не переопределяет `npmMinimalAgeGate`, возрастной барьер Yarn действует по умолчанию. |

## Переданные риски

Нет.

## Незарегистрированные находки (не блокируют)

| ID | Severity | Находка | Что сделать |
|----|----------|---------|-------------|
| INFO-20-01 | low | `expectedStartsAt` в контракте необязателен (`packages/contracts/src/schedule.ts:25`), поэтому проверка устаревшего состояния на сервере (`apps/api/src/schedule/changes.ts:44-46`) срабатывает, только если клиент поле прислал. Web шлёт его всегда (`lesson-move-form.tsx:107`, `schedule-screen.tsx:231`), так что T-20-16 и T-20-23 для двух вкладок закрыты; клиент вне браузера без поля получает только проверки статуса и `canChange` под блокировкой строки. У мутаций серии (`move`, `end`) токена устаревания нет, их защищают `lockSeries` и проверки `cutSeries`/`endSeriesAt`. | При желании сделать поле обязательным для move/cancel/restore урока; можно оставить. |
| INFO-20-02 | low | У `dvlab_app` есть DELETE на `lesson_series`, `lesson_exceptions`, `lessons` (default privileges `deploy/postgres/ensure-db.sql:33`; проверка 20-01 ожидает `delete: true`). D-16 «ничего не удалять» держится кодом api (удалений нет) и FK RESTRICT, а не правами базы. | Если нужна защита на уровне базы — `REVOKE DELETE` на эти три таблицы в отдельной миграции и поправить ожидание в `schedule-db.mjs`. Решение за владельцем. |
| INFO-20-03 | info | Одно имя из приватного списка есть в `.planning/ROADMAP.md:247` и `.planning/REQUIREMENTS.md:87` (пример промпта CHAT-06). Строки написаны до фазы 20 (коммит `5cf1389`, 2026-10-09) и уже в `master`; это повтор INFO-19-02. Скан плана 20-10 исключал ROADMAP, REQUIREMENTS и 20-CONTEXT. | Если имя убирать из публичного репозитория, заменить его на вымышленное в обоих файлах на `master`; история при этом его сохранит. Решение за владельцем. |
| INFO-20-04 | info | `cleanupFixtures` по умолчанию берёт `Alex Example 20%` (`scripts/dev-checks/schedule-web.mjs:22`), шире, чем `Alex Example 2007` в T-20-21. Условие `import_key is null` и шаблон имени фикстур сохраняют границу: карточки импорта не затрагиваются. | Мер не нужно. |
| INFO-20-05 | info | План 20-TP (TimePair, D-19) выполнен без PLAN и `<threat_model>`. Изменения только в отображении времени (`apps/web/components/app/time-pair.tsx`, `apps/web/lib/schedule-format.ts`): новых маршрутов, хранилищ и вывода HTML нет. | Мер не нужно. |

Флаги из `## Threat Flags` в SUMMARY планов 20-03, 20-05, 20-07, 20-08, 20-10 ссылаются на угрозы реестра (T-20-08, T-20-14, T-20-15, T-20-22, T-20-23) или заявляют, что новой поверхности нет; в остальных SUMMARY раздела нет.

## Ход аудита

| Дата | Угроз всего | CLOSED | OPEN | Кто |
|------|-------------|--------|------|-----|
| 2026-10-10 | 36 | 36 | 0 | gsd-security-auditor |

Вне аудита (по решению владельца): новые тесты в фазе не пишутся, приёмка скриптами `scripts/dev-checks/*` и браузером.
