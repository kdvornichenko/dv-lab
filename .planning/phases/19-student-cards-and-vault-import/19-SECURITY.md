---
phase: 19
slug: student-cards-and-vault-import
status: verified
verdict: SECURED
threats_open: 0
threats_total: 109
threats_closed: 109
asvs_level: 2
block_on: high
audited_head: c0bff23
created: 2026-10-10
---

# Фаза 19 — Security

Аудит соответствия: каждая митигация из `<threat_model>` планов 19-01..19-20 сверена с кодом ветки `gsd/phase-19-student-cards-and-vault-import` (HEAD `c0bff23`). Уровень ASVS L2: проверено, что защита стоит на нужной границе (группа маршрутов, условие в SQL, ограничение базы), а не только что строка есть в файле. В `.planning/config.json` порог `block_on` не задан, применён порог по умолчанию `high`. Код фазы не менялся.

## Итог

**Verdict: SECURED.** `threats_open: 0`.

| Всего | CLOSED | OPEN, блокирует | OPEN, не блокирует |
|-------|--------|-----------------|--------------------|
| 109   | 109    | 0               | 0                  |

109 строк = 89 угроз T-19-01..T-19-89 и 20 строк T-19-SC (по одной на план). По disposition: mitigate 87 (86 пронумерованных и T-19-SC плана 19-01), accept 20 (T-19-40 и T-19-SC планов 19-02..19-20), transfer 2 (T-19-32, T-19-35).

## Независимые проверки аудита

- **Имена учеников в git.** Скрипт аудита сверил 25 имён папок vault (заголовки главных файлов совпадают с ними) со всеми 417 отслеживаемыми файлами и с `git log -p 8b4a085..HEAD`; имена не печатались. Новых имён в ветке нет. Одно имя из четырёх букв, которое уже было в публичном `.planning/ROADMAP.md` ветки `master` до фазы 19, повторено в `19-CONTEXT.md`, `19-RESEARCH.md` и `19-19-PLAN.md` (вместе с фрагментом заметки оплаты без суммы и даты).
- **Пакет импорта.** `git ls-files` без `*.vault-import.json`; `git check-ignore` срабатывает на `x.vault-import.json` и `sub/dir/x.vault-import.json` (`.gitignore:30`); в истории ветки нет добавленных `.json` с содержимым пакета, нет `.png` и `.log`; в SCRATCH пакета нет.
- **База `dvlab_dev`** (только SELECT через `SCRATCH/19-sql.mjs`, роль `dvlab_app`): владелец `students`, `student_sections`, `student_terms`, `payments`, `accounts` — `dvlab_migrator`; у `dvlab_app` есть SELECT, INSERT, UPDATE, DELETE, нет TRUNCATE, REFERENCES, TRIGGER. Индекс `accounts_student_uq` частичный (`student_id IS NOT NULL AND status = active`), восемь CHECK фазы на месте. Данные импорта: 25 карточек, 66 секций, 762 термина, 29 оплат vault (одна без карточки); открывающий остаток у импортированных карточек пуст (0 из 25); карточек без ключа импорта 0; пробных карточек `Alex Example*`, аккаунтов `v1918.*` и ручных оплат 0.
- **Покрытие middleware.** `routes.use(*)` подприложения, смонтированного на `/students` и `/payments`, даёт шаблон `/students/*`, который RegExpRouter hono 4.13.13 компилирует в `/students(?:|/.*)$`: проверка сессии и роли покрывает и корень группы, и все вложенные пути (`account`, `sections`, `terms`, `assign`).
- **Возрастной барьер Yarn.** `.yarnrc.yml` не переопределяет `npmMinimalAgeGate`; в `.yarn/releases/yarn-4.18.1.cjs` значение по умолчанию `1d` (1440 минут). Зависимости менялись только в коммитах плана 19-01 (`b04338a`, `6c55799`).

## Реестр угроз

Пути без префикса: `api/` = `apps/api/src/`, `web/` = `apps/web/`, `contracts` = `packages/contracts/src/students.ts`, `migration.sql` = `packages/db/drizzle/20261009194959_student_cards/migration.sql`.

| Threat ID | Категория | Severity | Disposition | Evidence | Status |
|-----------|-----------|----------|-------------|----------|--------|
| T-19-01 | Tampering | high | mitigate | `web/package.json:25` react-day-picker 10.0.1, `yarn.lock:6813`; барьер 1440 мин (значение Yarn 4.18.1 по умолчанию, `.yarnrc.yml` его не меняет) | CLOSED |
| T-19-02 | Tampering | medium | mitigate | в манифестах нет версий с `^` и `~`; `.github/workflows/ci.yml:121` `yarn install --immutable` | CLOSED |
| T-19-SC (19-01) | Tampering | high | mitigate | `19-RESEARCH.md:155-166` аудит пакетов (Approved, postinstall нет, 10.0.2 исключена); точные версии `web/package.json:25,27,28`; в `yarn.lock` нет `radix-ui`, `@radix-ui/*`, `cmdk` | CLOSED |
| T-19-03 | Information disclosure | high | mitigate | `api/request-context.ts:13-18` для ошибок с query и params только type, `Failed query`, code, constraint; `packages/db/src/postgres-errors.ts:27-33`; сериализатор `err` `api/request-context.ts:28` | CLOSED |
| T-19-04 | Information disclosure | medium | mitigate | `postgres-errors.ts:2,20-25` только код из пяти символов; `api/bootstrap-teacher.ts:118`, `api/import-vault.ts:93` | CLOSED |
| T-19-05 | Tampering | medium | mitigate | `postgres-errors.ts:16-18` (23505 и имя ограничения по цепочке cause); вызовы `api/auth/accounts.ts:77,103-104,141`, `api/cards/terms.ts:51` | CLOSED |
| T-19-06 | Tampering | high | mitigate | `contracts:81-136` схемы без status, importKey, creditedMinutes, source (`z.object` отбрасывает лишние ключи); `api/cards/cards.ts:21-32` поля перечислены явно; статус только `cards.ts:114-130`; минуты считает сервер `api/cards/payments.ts:96,138` | CLOSED |
| T-19-07 | Tampering | medium | mitigate | `contracts:38-39,75,77` целые с границами 2000000000 и 9999999; `migration.sql:5,7,13,18` | CLOSED |
| T-19-08 | Denial of service | low | mitigate | `contracts:34-37,100,104-108,112,121`; CHECK `migration.sql:19,30,39,40` | CLOSED |
| T-19-09 | Tampering | medium | mitigate | `packages/core/src/money.ts:8-18`, `lessons.ts:9-15` разбор строк и `Number.isSafeInteger`; `parseFloat` в core, api и экранах фазы нет | CLOSED |
| T-19-10 | Tampering | medium | mitigate | `packages/core/src/balance.ts:1-4` только сумма; отбор оплат по дате один, `api/cards/cards.ts:41-55` | CLOSED |
| T-19-11 | Elevation of privilege | low | mitigate | `ci.yml:81-89` core без зависимостей, без `pg`, `node:*`, `@dv-lab/*`, `process.env`; `packages/core/package.json` без dependencies | CLOSED |
| T-19-12 | Tampering | high | mitigate | `migration.sql:72` частичный уникальный `accounts_student_uq`; индекс есть в `dvlab_dev` | CLOSED |
| T-19-13 | Elevation of privilege | medium | mitigate | `migration.sql:79` `accounts_student_role_ck` | CLOSED |
| T-19-14 | Tampering | high | mitigate | `migration.sql:15-17` `payments_currency_ck`, `payments_unassigned_ck`, `payments_credited_ck` | CLOSED |
| T-19-15 | Tampering | medium | mitigate | `deploy/postgres/ensure-db.sql:33` только SELECT, INSERT, UPDATE, DELETE; в `dvlab_dev` владелец `dvlab_migrator`, TRUNCATE у `dvlab_app` нет | CLOSED |
| T-19-16 | Tampering | medium | mitigate | `SCRATCH/19-sql.mjs:29-41` отказ с кодом 2 до подключения; `:52-54` печатает результат либо code и constraint, URL и текст запроса не печатает | CLOSED |
| T-19-17 | Information disclosure | low | mitigate | `SCRATCH/19-05-catalog.mjs:45,47,98-100` вымышленное имя Alex Example 0501, пробы в `begin ... rollback` | CLOSED |
| T-19-18 | Tampering | high | mitigate | `web/components/app/markdown-view.tsx:109` `skipHtml`, `urlTransform` не переопределён (стандартный отбрасывает `javascript:`); `rehype-raw`, `dangerouslySetInnerHTML`, `innerHTML` в `apps/web` нет | CLOSED |
| T-19-19 | Tampering | medium | mitigate | в скопированных `calendar`, `combobox`, `popover`, `select`, `textarea`, `use-keyboard-nav-gate` нет `fetch`, `eval`, `new Function`, `process.env`; `web/eslint.config.mjs` запрещает `radix-ui`, `@radix-ui/*`, `cmdk` | CLOSED |
| T-19-20 | Spoofing | low | mitigate | `markdown-view.tsx:63-64` `target=_blank`, `rel=noreferrer noopener` | CLOSED |
| T-19-21 | Elevation of privilege | high | mitigate | `api/routes/students.ts:68` `noStore`, `requireSession`, `requireRole` (teacher) на всей группе; `api/auth/middleware.ts:75-90` 401 и 403 | CLOSED |
| T-19-22 | Information disclosure | medium | mitigate | `api/routes/students.ts:56-59,81-83` невалидный и отсутствующий id дают одинаковый 404 | CLOSED |
| T-19-23 | Tampering | high | mitigate | `contracts:81-92` без status, importKey, openingBalance; `cards.ts:21-32`; остаток только `PUT /:id/opening-balance`, `api/routes/students.ts:113-121` | CLOSED |
| T-19-24 | Tampering | high | mitigate | `api/app.ts:43` `sameOrigin` на `*` до маршрутов; `middleware.ts:26,32-42` любой метод кроме GET, HEAD, OPTIONS без Origin приложения (или без `Sec-Fetch-Site: same-origin`) получает 403 | CLOSED |
| T-19-25 | Tampering | low | mitigate | `cards.ts:137-155` транзакция и блокировка карточки `for update` | CLOSED |
| T-19-26 | Information disclosure | medium | mitigate | `api/request-context.ts:47-55` в журнале только method, path, status, durationMs | CLOSED |
| T-19-27 | Information disclosure | high | mitigate | `.gitignore:30`, `.dockerignore:19-20`; пакета нет ни в `git ls-files`, ни в истории ветки, ни в SCRATCH | CLOSED |
| T-19-28 | Information disclosure | high | mitigate | `api/import/parse-vault.ts:404` метка `folder #N`; предупреждения и `VaultParseError` только с меткой (`:189-213,250,257,275,302,305,339,345`); прочие ошибки без текста `api/import-vault.ts:45`; сводка только счётчики `:27-38` | CLOSED |
| T-19-29 | Tampering | high | mitigate | `parse-vault.ts:406-408` оплаты только из `Payments.md` своей папки; `:427-429` несопоставленные отдельно; `api/import/apply-packet.ts:51,57` (`toImported(card.id)` и `toImported(null)`) | CLOSED |
| T-19-30 | Tampering | medium | mitigate | `parse-vault.ts:153-159` `not specified` даёт null, неизвестная валюта пропускается; `:199-210` строка без суммы пропускается с предупреждением; `parseMoney` из core `:205` | CLOSED |
| T-19-31 | Tampering | medium | mitigate | `parse-vault.ts:166-170,215-219` sha256 от папки, даты, суммы, валюты и порядкового номера; ключ карточки — папка `:419`; `api/import/packet.ts:26,60` | CLOSED |
| T-19-32 | Tampering | low | transfer | принимающая сторона на месте: `markdown-view.tsx:109` `skipHtml` (T-19-18) | CLOSED |
| T-19-33 | Elevation of privilege | high | mitigate | маршруты sections и terms в той же группе: `api/routes/students.ts:68,170-227` | CLOSED |
| T-19-34 | Tampering | high | mitigate | `api/cards/terms.ts:65,73` условие `id = termId and student_id = id` в update и delete | CLOSED |
| T-19-35 | Tampering | high | transfer | тело хранится без преобразований `api/cards/sections.ts:39-46`; показ только через `MarkdownView` (`notes-tab.tsx:165`) со `skipHtml` | CLOSED |
| T-19-36 | Tampering | medium | mitigate | `api/routes/students.ts:180` `z.enum(SECTION_KINDS)`; все шаблоны `sql` параметризованы, `sql.raw` в api нет | CLOSED |
| T-19-37 | Tampering | medium | mitigate | on conflict do nothing: `sections.ts:60`, `terms.ts:87`, `payments.ts:169`, `cards.ts:166` | CLOSED |
| T-19-38 | Elevation of privilege | high | mitigate | `api/routes/payments.ts:42` `requireSession`, `requireRole` (teacher) на всей группе | CLOSED |
| T-19-39 | Tampering | high | mitigate | `api/cards/payments.ts:140-147` условный UPDATE (`student_id is null` или своя карточка без валюты), иначе `already_assigned`; `api/routes/payments.ts:83-84` 409 `payment_already_assigned` | CLOSED |
| T-19-40 | Tampering | medium | accept | запись в «Принятые риски»; кнопка блокируется `record-payment-dialog.tsx:93`, дубль удаляется `api/routes/payments.ts:65-70` | CLOSED |
| T-19-41 | Tampering | high | mitigate | `contracts:115-122` без creditedMinutes, source, importKey; `api/cards/payments.ts:96,98` минуты из карточки, source `manual` | CLOSED |
| T-19-42 | Tampering | high | mitigate | `api/cards/payments.ts:130-131` `currency_required` до записи (400); валюта записи обязательна `contracts:119`; CHECK `migration.sql:15-17` | CLOSED |
| T-19-43 | Tampering | high | mitigate | `api/app.ts:43` (как T-19-24) | CLOSED |
| T-19-44 | Information disclosure | medium | mitigate | `api/request-context.ts:47-55`; строка запроса (`?student=`) в журнал не идёт, пишется `c.req.path` | CLOSED |
| T-19-45 | Elevation of privilege | high | mitigate | `web/app/(app)/students/page.tsx:10` `requireTeacherPage`; `web/lib/session.ts:22-27`; `web/app/(app)/layout.tsx:14-20` ученик видит только `StudentLanding`; api 403 (T-19-21) | CLOSED |
| T-19-46 | Tampering | medium | mitigate | сервер `api/routes/students.ts:73,90` `saveStudentRequest`; форма `student-form-dialog.tsx:32-43` те же предикаты contracts и `parseMoney` из core | CLOSED |
| T-19-47 | Tampering | low | mitigate | `student-form-dialog.tsx:251` `if (pending) return` | CLOSED |
| T-19-48 | Information disclosure | medium | mitigate | в истории ветки нет `.png`; сканирование имён: новых имён нет, в SUMMARY имён нет | CLOSED |
| T-19-49 | Tampering | high | mitigate | `migration.sql:72`; `api/cards/card-account.ts:20-27,34-45` блокировка карточки `for share` в транзакции; `api/auth/accounts.ts:124-142` точка сохранения, условие `student_id is null`, 23505 даёт `card_has_account` (409) | CLOSED |
| T-19-50 | Elevation of privilege | medium | mitigate | `api/auth/accounts.ts:131` условие role student в UPDATE; `migration.sql:79` | CLOSED |
| T-19-51 | Tampering | high | mitigate | `api/auth/accounts.ts:163-175` выборка `for update` с `student_id = id карточки`, иначе `not_found` (404) | CLOSED |
| T-19-52 | Information disclosure | high | mitigate | пароль только в теле 201 `api/routes/students.ts:132-135`; `no-store` `:68` и `middleware.ts:113-116`; тела не логируются `request-context.ts:47-55`; в базе только хеш `accounts.ts:85,94` | CLOSED |
| T-19-53 | Elevation of privilege | high | mitigate | маршруты `account`, `account/candidates`, `account/link`, `account/deactivate` в группе `api/routes/students.ts:68,123-168` | CLOSED |
| T-19-54 | Tampering | high | mitigate | `api/app.ts:43` (как T-19-24) | CLOSED |
| T-19-55 | Tampering | high | mitigate | `api/import-vault.ts:65-74` схема `importPacket` (`api/import/packet.ts:25-62`); запись только функциями модуля карточек `apply-packet.ts:5-8,38-57`; сырого SQL нет | CLOSED |
| T-19-56 | Information disclosure | high | mitigate | `api/import-vault.ts:79,88,93` только `Invalid packet`, счётчики и `Import failed (CODE)` | CLOSED |
| T-19-57 | Tampering | medium | mitigate | `apply-packet.ts:34-35` одна транзакция и `pg_advisory_xact_lock`; on conflict do nothing (T-19-37) | CLOSED |
| T-19-58 | Tampering | medium | mitigate | `apply-packet.ts:34` одна `db.transaction` на пакет | CLOSED |
| T-19-59 | Information disclosure | high | mitigate | маски (T-19-27); в SCRATCH пакета нет | CLOSED |
| T-19-60 | Elevation of privilege | low | mitigate | `api/import-vault.ts:84` `resolveDatabaseUrl` с ролью app; права `dvlab_app` (T-19-15) | CLOSED |
| T-19-61 | Elevation of privilege | high | mitigate | `web/app/(app)/students/[id]/page.tsx:13` `requireTeacherPage` первым; api 403 (T-19-21) | CLOSED |
| T-19-62 | Information disclosure | low | mitigate | `[id]/page.tsx:10,15` невалидный uuid даёт `notFound()`; api 404 (T-19-22) | CLOSED |
| T-19-63 | Tampering | medium | mitigate | `contracts:75,94-97` минимум 0; `opening-balance-panel.tsx:66` `parseLessons`; CHECK `migration.sql:68` | CLOSED |
| T-19-64 | Information disclosure | medium | mitigate | в истории нет `.png`; сканирование имён без новых находок; в `dvlab_dev` пробных карточек 0 | CLOSED |
| T-19-65 | Information disclosure | high | mitigate | `deploy/RUNBOOK.md:835` пакет в домашнем каталоге, не в клоне; `:858-859` `shred -u` сразу после запуска; `:875` ручной `shred -u` при любой остановке; в образ не попадает (`.dockerignore:19-20`) | CLOSED |
| T-19-66 | Information disclosure | medium | mitigate | `deploy/compose.yaml:100-111`; `RUNBOOK.md:858,860-862` `run --rm` и проверка `NO_IMPORT_CONTAINER`; вывод только счётчики (T-19-56) | CLOSED |
| T-19-67 | Elevation of privilege | low | mitigate | `compose.yaml:102` профиль `tools`, `:108` `DATABASE_URL` роли `dvlab_app`, `:105` только `apply` | CLOSED |
| T-19-68 | Spoofing | low | mitigate | у сервиса `import` (`compose.yaml:100-111`) нет `ports`, `expose`, `network_mode` | CLOSED |
| T-19-69 | Information disclosure | medium | mitigate | `RUNBOOK.md:842-844` `SHA`, `PACKET`, `PACKET_SHA` пустые; в добавленных строках `deploy/` нет IP, хешей, паролей и URL | CLOSED |
| T-19-70 | Tampering | medium | mitigate | `record-payment-dialog.tsx:93`, `assign-payment-dialog.tsx:82` `if (pending) return` и кнопка `loading` | CLOSED |
| T-19-71 | Tampering | high | mitigate | api 409 (T-19-39); `assign-payment-dialog.tsx:95-98` ошибка в диалоге и `onFailed` перечитывает список | CLOSED |
| T-19-72 | Tampering | medium | mitigate | `record-payment-dialog.tsx:26-28`, `assign-payment-dialog.tsx:29` `parseMoney`, `parseLessons`, `suggestLessons` из core; минуты считает api `payments.ts:96,138` | CLOSED |
| T-19-73 | Information disclosure | medium | mitigate | `dvlab_dev`: одна оплата vault без карточки, ручных оплат 0; в истории нет `.png` | CLOSED |
| T-19-74 | Tampering | low | mitigate | `web/components/app/ledger-text.tsx:58-61`, `assign-payment-dialog.tsx:131` заметка как текст React | CLOSED |
| T-19-75 | Tampering | high | mitigate | `markdown-view.tsx:109`, `notes-tab.tsx:165` (как T-19-18) | CLOSED |
| T-19-76 | Spoofing | low | mitigate | `markdown-view.tsx:63-64` | CLOSED |
| T-19-77 | Tampering | medium | mitigate | `dvlab_dev`: 25 карточек, 66 секций, 762 термина, 29 оплат vault совпадают с приёмкой (`RUNBOOK.md:866`); пробных карточек 0 | CLOSED |
| T-19-78 | Tampering | low | mitigate | `term-dialogs.tsx:111,212` `if (pending) return`; повтор термина 409 `api/routes/students.ts:204-206` | CLOSED |
| T-19-79 | Information disclosure | high | mitigate | `create-account-dialog.tsx:112` Esc и клик снаружи не закрывают, `:115` без крестика; `reveal-body.tsx:75` единственный выход; закрытие размонтирует диалог с паролем `account-panel.tsx:95-103` | CLOSED |
| T-19-80 | Tampering | high | mitigate | api 409 (T-19-49); `link-account-dialog.tsx:89-93` Banner и перечитывание кандидатов | CLOSED |
| T-19-81 | Tampering | medium | mitigate | `deactivate-student-dialog.tsx:34-35` запрос несёт `accountId`; api сверяет с карточкой (T-19-51) | CLOSED |
| T-19-82 | Information disclosure | medium | mitigate | `dvlab_dev`: аккаунтов `v1918.*` 0; ответ api с паролем не логируется (T-19-52) | CLOSED |
| T-19-83 | Information disclosure | high | mitigate | независимое сканирование аудита (раздел выше): новых имён учеников в файлах и истории ветки нет | CLOSED |
| T-19-84 | Information disclosure | high | mitigate | как T-19-27: `git ls-files` и история без пакета, `.gitignore:30`, `.dockerignore:19-20` | CLOSED |
| T-19-85 | Elevation of privilege | high | mitigate | api `api/routes/students.ts:68`, `api/routes/payments.ts:42`; web `(app)/layout.tsx:14-20`, `requireTeacherPage` на обеих страницах | CLOSED |
| T-19-86 | Tampering | low | mitigate | `dvlab_dev`: открывающий остаток импортированных карточек пуст (0 из 25) | CLOSED |
| T-19-87 | Information disclosure | medium | mitigate | сканирование аудита: в SUMMARY фазы имён нет | CLOSED |
| T-19-88 | Tampering | medium | mitigate | `dvlab_dev`: импортированных карточек 25, пробных 0 | CLOSED |
| T-19-89 | Information disclosure | medium | mitigate | в истории нет `.png`; сканирование имён без новых находок | CLOSED |
| T-19-SC (19-02..19-20, 19 строк) | Tampering | low | accept | запись в «Принятые риски»; манифесты и `yarn.lock` в ветке менялись только в коммитах 19-01 (`b04338a`, `6c55799`) | CLOSED |

## Принятые риски

| Threat ID | Риск | Обоснование и остаточная защита |
|-----------|------|---------------------------------|
| T-19-40 | Сетевой повтор `POST /payments` может записать оплату дважды | Ключа идемпотентности в фазе нет (D-11). Кнопка блокируется на время запроса и повтор игнорируется (`record-payment-dialog.tsx:93`); дубль виден в списке оплат карточки, учитель удаляет его (`DELETE /payments/:id`). |
| T-19-SC (19-02..19-20) | Цепочка поставок зависимостей | Эти планы пакеты не ставят; все изменения зависимостей фазы — в плане 19-01 под его митигацией T-19-SC. |

## Переданные риски

| Threat ID | Кому передано | Проверка принимающей стороны |
|-----------|---------------|------------------------------|
| T-19-32 | `MarkdownView` (19-06) | `markdown-view.tsx:109` `skipHtml`, стандартный `urlTransform`, без `rehype-raw` |
| T-19-35 | `MarkdownView` (19-06, 19-17) | то же; секции показываются только через него (`notes-tab.tsx:165`) |

## Незарегистрированные находки (не блокируют)

| ID | Severity | Находка | Что сделать |
|----|----------|---------|-------------|
| INFO-19-01 | low | `markdown-view.tsx:97-100` выводит `img` с внешним `src` (стандартный `urlTransform` пропускает http и https). При просмотре заметки браузер учителя идёт на сторонний хост и передаёт ему адрес и User-Agent. Источник текста — учитель и его vault. В threat model фазы такой строки нет. | При желании убрать `img` из `components` или пропускать только свои адреса; можно оставить как принятый риск. |
| INFO-19-02 | low | `19-19-privacy.mjs` исключает `19-CONTEXT.md` и не проверяет имена, которые уже есть в `master:.planning/ROADMAP.md`. Одно такое имя (уже публичное до фазы 19) повторено в `19-CONTEXT.md`, `19-RESEARCH.md`, `19-19-PLAN.md`. Новой утечки нет. | Если имя убирать из публичного репозитория, править нужно и `ROADMAP.md`, и `REQUIREMENTS.md`, и `PROJECT.md` на `master`; история git при этом сохранит его. Решение за владельцем. |
| INFO-19-03 | info | Шаг CI `Client address trust` проверяет `ports` только у сервиса `api`; у нового сервиса `import` портов нет, но CI это не охраняет. | Расширить проверку на все сервисы, кроме `caddy`, если появится риск. |
| INFO-19-04 | info | Postgres на сервере может записать в свой журнал строку DETAIL с данными при нарушении ограничения. `RUNBOOK.md:873` уже запрещает присылать логи `db`. | Мер не нужно. |

Флаги из `## Threat Flags` в SUMMARY планов 19-01..19-20 все ссылаются на угрозы реестра; новой поверхности в них не заявлено.

## Ход аудита

| Дата | Угроз всего | CLOSED | OPEN | Кто |
|------|-------------|--------|------|-----|
| 2026-10-10 | 109 | 109 | 0 | gsd-security-auditor |

Вне аудита (по решению владельца): новые тесты в фазе не пишутся; выкатка на VPS и настоящий импорт на сервере (RUNBOOK 11.1-11.3) — отложенный шаг человека.
