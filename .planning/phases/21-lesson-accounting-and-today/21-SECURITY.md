---
phase: '21'
slug: lesson-accounting-and-today
status: verified
verdict: SECURED
threats_open: 0
asvs_level: 2
block_on: high
register_authored_at_plan_time: true
threats_total: 65
closed_static: 37
closed_runtime: 8
accepted_risks: 20
source_head: 8c3cb5d8c01ed22f8512b66a155756d01c153430
created: '2026-10-11'
---

# Фаза 21 — безопасность

Существующий реестр завершён: 65 строк, открытых угроз 0. Это проверка угроз фазы на глубине L2, а не сертификация соответствия всему ASVS.

## Trust Boundaries

| Граница                                   | Контроль                                                     | Данные                                |
| ----------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| Browser → API                             | Сессия, teacher role, Origin, validation, stale checks       | Отметки, настройки, карточки          |
| API → PostgreSQL                          | Роль приложения, транзакции, ограничения, блокировки         | История уроков и остаток              |
| E2E → dev stack                           | Localhost, `_dev` guard, собственные фикстуры, exact restore | Только разрешённые тестовые изменения |
| Private artifacts → публичный репозиторий | STATE_DIR вне repo, privacy gate, отключённые trace/video    | Credentials и данные учеников         |

**Обозначения evidence**

- **B** — [исходный backend review](/private/tmp/dv-lab-phase21-parallel/21-backend-security.md).
- **R** — [реестр на bec43a9](/private/tmp/dv-lab-phase21-parallel/21-security-current-delta.md), с уже принятым опровержением прежнего claim T-21-41.
- **S13** — [21-13-SUMMARY.md](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/.planning/phases/21-lesson-accounting-and-today/21-13-SUMMARY.md).
- **X13** — [evidence исправления JSON boundary](/private/tmp/dv-lab-phase21-parallel/21-13-type-followup.json).
- **S18** — [21-18-SUMMARY.md](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/.planning/phases/21-lesson-accounting-and-today/21-18-SUMMARY.md).
- **P18** — [manifest выполнения 21-18](/private/tmp/dv-lab-phase21-parallel/21-18-preparation.md).
- **Δ** — ограниченная проверка изменений `bec43a9..8c3cb5d`.
- **U** — итоговый отчёт оркестратора: итоговая privacy-проверка четырёх metadata-файлов и `diff --check`.
- **P01…P18** — соответствующие принятые `21-NN-PLAN.md` в каталоге фазы.

Категории сохранены через сокращения: **T** = Tampering; **R** = Repudiation; **I** = Information disclosure; **D** = Denial of service; **E** = Elevation of privilege. `Integrity` сохранено как отдельное исходное обозначение.

**Полный реестр: 37 прежних статических закрытий**

| ID / план    | Категория   | Компонент                                                      | Severity | Disposition | Status        | Control                                                                                                                                 | Evidence                                                                                                                              |
| ------------ | ----------- | -------------------------------------------------------------- | -------- | ----------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T-21-01 / 01 | T/R         | Удаление истории отметок                                       | high     | mitigate    | CLOSED_STATIC | REVOKE DELETE/TRUNCATE у роли приложения; FK RESTRICT; API не удаляет историю отметок                                                   | B, R; DB/API неизменны по Δ                                                                                                           |
| T-21-02 / 01 | T           | Неверный kind или двойной ключ отметки                         | medium   | mitigate    | CLOSED_STATIC | CHECK kind/ref и уникальные индексы                                                                                                     | B, R                                                                                                                                  |
| T-21-03 / 01 | T           | Порог вне диапазона                                            | low      | mitigate    | CLOSED_STATIC | CHECK `teacher_settings_pays_soon_ck`, диапазон 0…20                                                                                    | B, R                                                                                                                                  |
| T-21-04 / 01 | T           | Разовый SQL в чужую базу                                       | medium   | mitigate    | CLOSED_STATIC | Общий SQL wrapper запрещает базы без `_dev`/`_test`                                                                                     | R; wrapper неизменён                                                                                                                  |
| T-21-05 / 02 | T           | Неверная граница даты урока, оплаты или открытия               | medium   | mitigate    | CLOSED_STATIC | Общие VN date owners; расчёт открытия и вычета в core                                                                                   | B, R                                                                                                                                  |
| T-21-06 / 02 | I/T         | «Не задан» показан как ноль; ошибочное включение в Pays soon   | medium   | mitigate    | CLOSED_STATIC | `null`/`not_set` сохраняются; `paysSoon(null)` исключён                                                                                 | B, R                                                                                                                                  |
| T-21-07 / 03 | I/T         | Реальные карточки в проверках и скриншотах                     | medium   | mitigate    | CLOSED_STATIC | Синтетические фикстуры; независимый browser cleanup; private STATE_DIR; публично только счётчики                                        | R, S13                                                                                                                                |
| T-21-08 / 04 | E           | Ученик ставит отметку                                          | high     | mitigate    | CLOSED_STATIC | Сессия и `requireRole('teacher')` на маршрутах расписания                                                                               | B, R                                                                                                                                  |
| T-21-09 / 04 | T           | Гонка отметок и отметка изменённого урока из старой вкладки    | medium   | mitigate    | CLOSED_STATIC | Транзакции, FOR UPDATE, upsert, проверка переданного `expectedStartsAt`, 409                                                            | B, R                                                                                                                                  |
| T-21-10 / 04 | T           | Неверный kind, ref или дата пути                               | medium   | mitigate    | CLOSED_STATIC | Zod enum, UUID/date validation, `safeParse`, 400                                                                                        | B, R                                                                                                                                  |
| T-21-11 / 04 | R           | Потеря истории отметки при отмене или разрезе                  | medium   | mitigate    | CLOSED_STATIC | Отмена сохраняет отметку; cut/end сохраняет отмеченный хвост, включая `restored`                                                        | R; S18: Done/No-show × cut/end                                                                                                        |
| T-21-12 / 05 | E/T         | Запись настроек чужого аккаунта или учеником                   | high     | mitigate    | CLOSED_STATIC | Teacher role; account ID только из сессии                                                                                               | B, R                                                                                                                                  |
| T-21-13 / 05 | T           | Порог вне диапазона                                            | low      | mitigate    | CLOSED_STATIC | Zod integer 0…20 и CHECK базы                                                                                                           | B, R                                                                                                                                  |
| T-21-14 / 06 | T/D         | Нечитаемое значение второго пояса или избранного               | low      | mitigate    | CLOSED_STATIC | Валидация сохранённых значений; fallback к допустимому значению                                                                         | R                                                                                                                                     |
| T-21-15 / 07 | I           | Остатки учеников в GET `/today`                                | high     | mitigate    | CLOSED_STATIC | Teacher-only маршрут; ответ через владельцев данных                                                                                     | B, R                                                                                                                                  |
| T-21-16 / 07 | D           | Поиск неотмеченных уроков по всей истории                      | low      | mitigate    | CLOSED_STATIC | Lookback 366 дней; ограниченное окно в repeatable-read snapshot                                                                         | B, R                                                                                                                                  |
| T-21-17 / 07 | T           | Смена флага неявки                                             | medium   | mitigate    | CLOSED_STATIC | Boolean validation; teacher-only PATCH; сами отметки сохраняются                                                                        | B, R                                                                                                                                  |
| T-21-18 / 08 | T           | Двойная отправка или отметка из устаревшей вкладки             | medium   | mitigate    | CLOSED_STATIC | Busy guards; `expectedStartsAt`; обработка 409/404 и перечитывание; серверная проверка                                                  | R, S18                                                                                                                                |
| T-21-19 / 09 | T           | Проверки меняют порог настоящего учителя                       | low      | mitigate    | CLOSED_STATIC | Snapshot после успешного SQL; finally restore; точное сравнение значения и `updated_at`                                                 | R, S13, X13, S18                                                                                                                      |
| T-21-20 / 10 | I/Integrity | Частичный экран при ошибке чтения показывает неверные счётчики | low      | mitigate    | CLOSED_STATIC | Отдельное состояние ReadError без частичных счётчиков и списков                                                                         | R; Δ не меняет этот control                                                                                                           |
| T-21-21 / 11 | T           | Оплата записана не тому ученику из Today                       | medium   | mitigate    | CLOSED_STATIC | Обязательный Student без предвыбора; проверка перед отправкой; API проверяет карточку                                                   | R                                                                                                                                     |
| T-21-22 / 12 | I           | Адреса, пароли, токены и имена в документах                    | medium   | mitigate    | CLOSED_STATIC | Документы используют роли, пути и placeholders; privacy gate                                                                            | R, S13, S18, U                                                                                                                        |
| T-21-25 / 04 | T           | Расхождение словарей отметки и исхода contracts/core           | medium   | mitigate    | CLOSED_STATIC | `MARK_KINDS`, `toMarkKind`, взаимная совместимость типов Mirror                                                                         | B, R; owners неизменны                                                                                                                |
| T-21-26 / 04 | T           | Гонка отметок, отмены и переноса серии                         | medium   | mitigate    | CLOSED_STATIC | Общие блокировки, транзакции и upsert; сохранение отмеченного хвоста после cut/end                                                      | B, R; S13/S18 усиливают прежнее доказательство                                                                                        |
| T-21-27 / 15 | T           | Дата урока или Today вычислена по зоне браузера                | low      | mitigate    | CLOSED_STATIC | Общие `scheduleToday`/`scheduleDate` и явная VN zone                                                                                    | R; Δ не вводит нового date owner                                                                                                      |
| T-21-29 / 10 | D           | Цикл перечитывания Today при сбитых часах клиента              | low      | mitigate    | CLOSED_STATIC | Стабильные зависимости refresh; минутное `now`                                                                                          | R                                                                                                                                     |
| T-21-30 / 06 | I           | Реальные карточки в browser checks                             | medium   | mitigate    | CLOSED_STATIC | Только собственные синтетические фикстуры; независимый cleanup; private screenshots                                                     | R, S13                                                                                                                                |
| T-21-31 / 08 | I           | Реальные карточки в проверках отметок                          | medium   | mitigate    | CLOSED_STATIC | Синтетические фикстуры; lesson_marks очищаются первыми; private screenshots                                                             | R, S13                                                                                                                                |
| T-21-32 / 09 | I           | Реальные карточки в проверках settings/students                | medium   | mitigate    | CLOSED_STATIC | Ограниченные фикстуры; независимый cleanup и settings restore                                                                           | R, S13                                                                                                                                |
| T-21-33 / 10 | I           | Настоящие уроки и карточки в screenshots/output                | medium   | mitigate    | CLOSED_STATIC | Локаторы фикстур; публично счётчики; artifacts вне репозитория                                                                          | R, S13                                                                                                                                |
| T-21-34 / 11 | I           | Настоящие данные dev-базы                                      | medium   | mitigate    | CLOSED_STATIC | Собственные фикстуры Today marks/payment; независимый cleanup                                                                           | R, S13                                                                                                                                |
| T-21-35 / 14 | I/T         | Реальные карточки в проверках и скриншотах                     | medium   | mitigate    | CLOSED_STATIC | Ограниченные фикстуры; lesson_marks первыми; private artifacts                                                                          | R, S13                                                                                                                                |
| T-21-36 / 15 | I           | Реальные карточки в проверках                                  | medium   | mitigate    | CLOSED_STATIC | Общий marks owner, ограниченные фикстуры и независимый cleanup                                                                          | R, S13                                                                                                                                |
| T-21-37 / 11 | T           | Двойная отметка быстрыми кнопками                              | medium   | mitigate    | CLOSED_STATIC | Синхронный saving guard; pending блокирует кнопки и открытие строки; stale refresh                                                      | R; S18: реальный POST + reload busy window                                                                                            |
| T-21-38 / 17 | T           | Перенос в прошлое или за дату открытия меняет остаток          | medium   | mitigate    | CLOSED_STATIC | Teacher role, FOR UPDATE, stale check; единый расчёт по текущим данным                                                                  | B, R, S13                                                                                                                             |
| T-21-41 / 17 | I           | Реальные dev/test карточки в проверках и скриншотах            | medium   | mitigate    | CLOSED_STATIC | Ограниченные фикстуры; marks-first cleanup; private screenshots; счётчики в SUMMARY                                                     | Принятое опровержение source-gap сохраняется: достижимый reject фактического API stop owner не подтверждён; browser cleanup независим |
| T-21-SC / 18 | T           | Установка `@playwright/test`, `playwright`, `playwright-core`  | high     | mitigate    | CLOSED_STATIC | Принятая установка; точная 1.63.0; age gate 1440; три lock entries; без install hooks/optional dependencies; существующий browser cache | R, S18; lockfile и Yarn config неизменны по Δ                                                                                         |

**Полный реестр: восемь runtime-закрытий**

| ID / план    | Категория | Компонент                                             | Severity | Disposition | Status         | Control                                                                                                                                  | Фактическое evidence                                                                                                                                                                  |
| ------------ | --------- | ----------------------------------------------------- | -------- | ----------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-21-23 / 13 | I         | Имена учеников в коде, scripts, planning и SUMMARY    | high     | mitigate    | CLOSED_RUNTIME | Privacy scan по закрытому списку, без вывода значений; только синтетические фикстуры                                                     | S13: `PRIVACY_OK files=263`; raw исходного scan: 262, exit 0. Дополнения: S18 — 21 файл и SUMMARY отдельно; U — финальные 4 metadata-файла после исправления, PASS                    |
| T-21-24 / 13 | T         | Остатки фикстур и изменённый порог dev-учителя        | low      | mitigate    | CLOSED_RUNTIME | Счётчик фикстур 0; exact settings restore, включая отсутствие строки и `updated_at`                                                      | Raw SQL result `n=0`, original exit 0; S13/X13 и последующий S18 подтверждают один baseline hash и `DEV_DOWN_OK`                                                                      |
| T-21-60 / 18 | I         | Пароль в trace, video, HAR или output                 | medium   | mitigate    | CLOSED_RUNTIME | Trace/video off; HAR не записывается; выбираются два credential key; ошибки скрывают значения; диагностический вывод без credentials     | Canonical config/data/API owners применены; реальные setup/journeys/cleanup выполнены; S18/P18 и raw logs                                                                             |
| T-21-61 / 18 | I         | Cookie в storageState                                 | low      | mitigate    | CLOSED_RUNTIME | Private directory 0700, файлы 0600; успешный публичный sign-out; независимый scrub в finally; auth перезаписан пустым объектом состояния | Raw cleanup PASS; success marker возможен только после успешных операций. S18/P18: `auth=empty settings=null owned=0`, sessions signed out. Файлы сохранены согласно запрету удаления |
| T-21-62 / 18 | I         | Настоящие имена в output, screenshots и error-context | high     | mitigate    | CLOSED_RUNTIME | Локаторы собственных фикстур; reporter list; private outputDir вне репозитория; публичные документы без содержимого данных               | Raw `PRIVACY_OK files=21`, затем `files=1`; runtime artifacts остались private; S18/P18 фиксируют область и результаты                                                                |
| T-21-63 / 18 | T         | Фикстуры и порог Pays soon в dev-базе                 | medium   | mitigate    | CLOSED_RUNTIME | Восемь точных фикстур 2182–2189, `import_key IS NULL`, ownership ledger; marks-first cleanup; exact restore                              | Завершённые успешные и неуспешные runs имеют cleanup PASS; финально fixtures 0; совпадение исходного teacher baseline; private settings snapshot очищен                               |
| T-21-64 / 18 | E         | E2E против чужой базы или сервера                     | low      | mitigate    | CLOSED_RUNTIME | Постоянный localhost BASE; SQL wrapper; дополнительный guard роли migrator и базы `_dev`; без server override                            | Canonical guards прочитаны; реальные runs на предусмотренном dev-стеке; S18; после runs `DEV_DOWN_OK`                                                                                 |
| T-21-65 / 18 | D         | Rate limiter блокирует учителя повторными входами     | low      | mitigate    | CLOSED_RUNTIME | Один setup login на run; обе темы используют storageState; retries 0, worker 1                                                           | Raw logs содержат один успешный setup на каждый завершённый run и последующие journeys обеих тем без повторного setup login                                                           |

**Полный реестр: 20 accepted risks**

Основание принятия рисков — утверждённые планы фазы. Установка Playwright учитывается отдельной строкой SC/18.

| ID / план    | Категория   | Компонент                                                                  | Severity | Disposition | Status   | Control / rationale                                                                                                 | Authority / source                      |
| ------------ | ----------- | -------------------------------------------------------------------------- | -------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| T-21-SC / 01 | T           | npm installs                                                               | low      | accept      | ACCEPTED | Immutable install существующего lockfile; новых пакетов в плане нет; age gate сохранён                              | P01, R, принятый PLAN                   |
| T-21-SC / 02 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P02, R, принятый PLAN                   |
| T-21-SC / 03 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P03, R, принятый PLAN                   |
| T-21-SC / 04 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P04, R, принятый PLAN                   |
| T-21-SC / 05 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P05, R, принятый PLAN                   |
| T-21-SC / 06 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P06, R, принятый PLAN                   |
| T-21-SC / 07 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P07, R, принятый PLAN                   |
| T-21-SC / 08 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P08, R, принятый PLAN                   |
| T-21-SC / 09 | T           | npm installs                                                               | low      | accept      | ACCEPTED | Switch взят из одобренного design-lab; новых пакетов нет                                                            | P09, UI-SPEC Registry Safety, R         |
| T-21-SC / 10 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P10, R, принятый PLAN                   |
| T-21-SC / 11 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P11, R, принятый PLAN                   |
| T-21-SC / 12 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P12, R, принятый PLAN                   |
| T-21-SC / 13 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P13, R, принятый PLAN                   |
| T-21-SC / 14 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P14, R, принятый PLAN                   |
| T-21-SC / 15 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P15, R, принятый PLAN                   |
| T-21-SC / 16 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P16, R, принятый PLAN                   |
| T-21-SC / 17 | T           | npm installs                                                               | low      | accept      | ACCEPTED | План ничего не устанавливает                                                                                        | P17, R, принятый PLAN                   |
| T-21-28 / 16 | D/Integrity | Старая открытая вкладка неверно показывает неделю без нового статуса блока | low      | accept      | ACCEPTED | Один учитель, короткое окно выката; обязательная перезагрузка вкладок                                               | P16, R2, RUNBOOK §12.1, R               |
| T-21-39 / 17 | R           | Перенос переписывает время урока; журнала изменений нет                    | low      | accept      | ACCEPTED | Один учитель; Google Calendar принят как источник правды по D-17; `updated_at` сохранён; ученик переносить не может | P17, D-17, B/R                          |
| T-21-40 / 17 | D           | Перенос за диапазон недель скрывает урок с экрана                          | low      | accept      | ACCEPTED | Принятый диапазон 2000-01-03…2100-12-27; дата видна до отправки; урок сохраняется в базе и расчёте остатка          | P17, принятый календарный диапазон, B/R |

**Runtime evidence и его границы**

Ниже — результаты ранее завершённых запусков. В этом review команды runtime не выполнялись.

| Команда                                                                                                                        | Original status | Решающее evidence                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------: | ----------------------------------------------------------------------------------- |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-evidence.mts privacy`                                                         |               0 | Raw: `PRIVACY_OK files=262`; S13 документирует итоговый scan с SUMMARY: 263         |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-evidence.mts settings-after`                                                  |               0 | `TEACHER_EXACT_RESTORE_OK`; совпадает исходный baseline                             |
| Финальные SQL fixture checks owner13                                                                                           |               0 | Raw JSON: `rows:[{"n":0}]`                                                          |
| `node scripts/dev-checks/schedule-web.mjs changes`                                                                             |               0 | 109 assertions, `SCHEDULE_WEB_CHANGES_OK`                                           |
| `node scripts/dev-checks/schedule-web.mjs changes dark`                                                                        |               0 | 109 assertions, `SCHEDULE_WEB_CHANGES_OK`                                           |
| `yarn test:e2e --grep "dialog marks deduct by lesson length"`                                                                  |               0 | 4 passed: setup, обе темы, cleanup                                                  |
| `yarn test:e2e --grep-invert "dialog marks deduct by lesson length"`                                                           |               1 | 14 passed, 4 failed; успешные journeys и cleanup сохранены как отдельные наблюдения |
| `yarn test:e2e --grep "dialog corrections recompute\|Pays soon follows\|Earlier, not marked lists"`                            |               1 | Corrections/keyboard/320 прошли в обеих темах; четыре Today failures затем закрыты  |
| `yarn test:e2e --grep "Pays soon follows\|Earlier, not marked lists"`                                                          |               0 | Финальный run: **6 passed**, обе темы, setup и cleanup                              |
| `node /private/tmp/dv-lab-phase21-parallel/21-18-privacy.mjs`                                                                  |               0 | `PRIVACY_OK files=21`                                                               |
| `node /private/tmp/dv-lab-phase21-parallel/21-18-privacy.mjs .planning/phases/21-lesson-accounting-and-today/21-18-SUMMARY.md` |               0 | `PRIVACY_OK files=1`                                                                |
| `node scripts/dev-checks/wait-dev.mjs down`                                                                                    |               0 | `DEV_DOWN_OK`, подтверждено S13 и S18/P18                                           |
| `yarn test` на `f5e7083`                                                                                                       |               0 | 11 suites, 116 tests; 5/5 Turbo tasks                                               |
| `yarn build` на `f5e7083`                                                                                                      |               0 | 2/2 tasks; web compiled, 8/8 pages                                                  |

Итог девяти journeys — **18 успешных наблюдений в двух темах**, собранных несколькими ограниченными запусками. Неуспешные команды не переименованы в PASS. Запуск с утраченным producer exit из-за shell-переменной `status` не использован как command PASS.

Exact restore fingerprint:

```text
8ec157deee53f848bf1b5cf6259be2b590c8a791a97912a6d5b96ff06da5f886
```

P18 отдельно подтверждает совпадение аутентифицированного учителя и исходного baseline S13. Первоначальный hash18 от `[]` относился к другой форме SQL-результата. Он не подменял baseline.

**Недостающее raw evidence отделено от дефектов:** отдельные raw-логи итоговых privacy scans **263** и **4** в TMP не найдены. Для 263 источник — committed S13 и итоговый отчёт оркестратора. Для 4 — итоговый отчёт оркестратора с `PRIVACY_OK files=4` и `diffcheck=0`. Эти два результата не представлены как независимо прочитанные raw-логи. Это ограничение provenance, а не открытый дефект или блокирующий пробел принятого контракта.

Scrub/session/fixtures/settings/dev-down подтверждены S18/P18 и успешными runtime cleanup. Принудительное завершение процесса и недоступность FS/DB не объявляются проверенными failure-injection сценариями.

**Ограниченный source delta**

- Type imports owner13 меняют источник типов. Нового runtime control не добавляют.
- JSON boundary в `d6ccf60` использует `unknown` и проверку структуры. Два affected browser runs завершились exit 0.
- Root ESM, Playwright config и canonical E2E проверены по фактическим исходникам и runtime evidence.
- Изменения Today затрагивают узкую геометрию и opacity tween 80 мс. Auth, provider, API и persistence behavior не меняются.
- Backend, core, contracts, DB, lockfile и Yarn config идентичны `bec43a9`.
- Между `f5e7083` и `8c3cb5d` изменены только четыре metadata-файла. Финальные test/build относятся к неизменившемуся продуктовому коду.

**Пороги и актуальность измерений**

| Gate                       | Порог                                                 | Сохранённое evidence                                                        |
| -------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Security                   | ASVS L2; блокировка с high                            | Открытых high/critical: 0                                                   |
| Cyclomatic complexity      | Каждая функция/callback `<22`                         | Максимум 21                                                                 |
| Cognitive complexity       | Каждая функция/callback `<22`                         | Максимум 20                                                                 |
| Halstead Difficulty        | `<80`                                                 | Максимум 40.4194                                                            |
| Handwritten source/tooling | `<500` физических строк                               | Максимум 457                                                                |
| Types                      | Нет explicit/inferred any; unknown только на границах | Owner13: any=0, diagnostics=0; owner18: соответствующие findings пусты      |
| Dead/redundant code        | Нет подтверждённых незакрытых findings                | Сохранённый knip exit 0; прежние configuration hints не объявлены дефектами |
| Supply chain               | Точная версия; age gate 1440                          | Прежнее закрытие SC/18; dependency inputs неизменны                         |

Метод метрик: TypeScript 6.0.3; ESLint 10.12.0 classic complexity; parser 8.71.1. Cognitive — AST nesting и логические последовательности, не SonarJS. Halstead использует leaf tokens тела функции: вложенные функции отдельно; types/imports/trivia исключены; identifiers/literals — operands, остальные токены — operators; `D=(n1/2)*(N2/n2)`. SQL, generated artifacts и dependencies не измеряются как handwritten JS/TS.

Изменённые ветвления: `occurrenceStateStale` CC 17→21; `LessonRow` 12→11; `Panels` 5→4; setup 4→5; `observeExit.inspect` 16→19; `markEarlier` 10→12.

У [final static report 18](/private/tmp/dv-lab-phase21-parallel/21-18-final-static.json) есть старые поля `snapshot`, `readiness: unverified` и legacy `sourceFingerprints`. Последний массив содержит 13 несовпадений с текущим кодом и **не использован как актуальный общий fingerprint**. Актуальная секция `analyses` совпадает: 13 canonical файлов плюс checker. Все 15 файлов [final metrics 18](/private/tmp/dv-lab-phase21-parallel/21-18-final-metrics.json) также совпадают.

В отчётах owner13 совпадают 40/41 файлов. Единственный изменённый `today-lessons.tsx` покрыт свежим evidence owner18. Нового широкого quality audit не проводилось.

**Source fingerprints**

Manifest convention: отсортированные записи `path<TAB>sha256(file bytes)<LF>`, затем SHA-256 всего manifest.

| Scope                                              | Count | SHA-256                                                            |
| -------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| Итоговый diff `bec43a9..8c3cb5d`, frozen Git blobs |    68 | `7527c1072d5931e805202c4112c4cbfe69a0ec4ebe8dd0dded35bb3db2f13976` |
| Все исходные PLAN registers                        |    18 | `1e4026a78d94854e25b65d8aaa8a3cd8608ea86817e9d4e97d494f649f7936a4` |
| Актуальные 15 файлов metrics18                     |    15 | `708d55a2b1a4011c0c4e292a52eb3a912e95b4cbae6fb34e7d7b175da5aa9de7` |
| Прежний browser payload, baseline R                |    58 | `568dff53f9cf2bafed9706602e2b982c2d309198aea7b7b08e52b3906190a41d` |
| Прежний API payload, baseline R                    |    23 | `8dafdea007b29956405a95b2fe14f7a4670e6cfbf930d7142c37e9349f855c5e` |
| Прежний core payload, baseline R                   |    10 | `a4dbb39cb9ec6600c735cc5867483d8387a650df1a21635f80f2e5a2bd7f68db` |
| Прежний DB payload, baseline R                     |     5 | `b6c6f2d6664620d9d0c0132fce47d9b253b9dfbd83ab9ff8a4e56535d856fabc` |

Индивидуальные fingerprints сохранены в указанных type/metrics reports. Старые payload manifests обозначают baseline, не подменяют итоговый manifest.

**SHA-256 входных отчётов**

Все TMP-файлы ниже находятся в `/private/tmp/dv-lab-phase21-parallel`.

```text
21-backend-security.md
4fec35b940b318c430e18fef0c0bec252e4d467420b43cd37dcec81783fe5afa
21-security-delta.md
0b29fea0226bfec38bd1d0972bffd4cb0d0e097b3a882e849eb62e9f8fe037a3
21-security-current-delta.md
be2b3f4df7d54cf144f2deea13a81c8cbc9ca6088875a56aefea64b7f9aff240
21-13-SUMMARY.md — committed файл фазы
846d1b81c972dd917262a06852da1a642fe37dad623d0316e4990b835b4ad840
21-18-SUMMARY.md — committed файл фазы
e71e7af2256187e636e06a441178b45aa3ba4a102111a88574e7b256c01d8370
21-13-runs.jsonl
851adc3f9c212cf7f606c676dc48ea259297b4d5ee6ff0eced7551f28720a8f1
21-13-static-evidence.json
a065b6e817685c6bb43bcd42c0619d995e57c1e2634f924a7389a26e4a96d154
21-13-browser-evidence.json
c6764c65a6931ac7cc249056587e49cfc951c3563206b2f86209cf5b722d9708
21-13-type-followup.json
d65269c63ff3c78162e2be08f798117b0e9d9be3a3b014b6b46d26eda94b486e
21-13-owned-types.json
599693610f65a536ee53bc57944f6751146901b597737f9834a36460d27fb3d5
21-13-v1-metrics.json
4c8472aef1a64e07368740829f81036e8995f6973c827b1b9e2c44645c6dc787
21-18-preparation.md
6726fd3a7b2d324278c618cdb3c8c99fd1f3ddee9cd545cfb82e53ec59d05ff8
21-18-final-static.json
25a42cc8906e3b00a1eed23ee7fe9e0ca967bc75ebf626764ef4b5018ae07396
21-18-final-metrics.json
c3ca8c912884e70face00eb3c87a5d1bb83e6e8bdfc6c8d893a4d77db3115904
21-final-test.json
80f93bcd16763bb907cbadb698aceefe995b9141fab28d4bbdfc3d32a3b4ebf8
21-final-build.json
34b70bb5f97e3451b88b2aee500c8a7e1c185540b4c70b93c9ec6dc1fe46a1e6
21-18-tracer-2.log
fc7a77ca9e17d23e6a643bd706ba10a232d721d0d47b735d72de927da8e601fb
21-18-journeys.log
a2472d506ae0eecb888ae7302be9836fbbfe09681377c67afbb6b39b4260d67e
21-18-affected.log
9d2ad286dddb0dc8676053105d5716c53098ccaccc916221052ff78d3768a9a3
21-18-today-final.log
0846246355dd47f7d92ba0c7ac66497aef791545e1b3b7e7b921803274f678bf
21-13-privacy.log
106a3eb2ed6f61486919675e816ba7903fd99536b6443a51b596cf95a284e5cf
21-18-privacy.log
523c8a77a7c015fbcfe5b6f8406eebfb523c987f0eea68cc78784420d4d1b4a4
21-18-privacy-summary.log
2e2d3a40b8833ba244c7d1141c997fc3e7bbe8d903c07dfdb56f8e6391ccb640
21-13-teacher-final.log
7e18ec4a865d92225c815ed8a8a6debc839e98fc6d323f08093b8da6d996269a
21-13-fixture-final.log / 21-13-fixture21-final.log
26320b3c4827783f0ed7c48b3bbd14d820e28c71fd1b51312e1c059cd8ca1d1c
21-13-dev-down.log
8fdd3311c86213ca5ae998f7de05a268a241ee6602ad65748736d53f2e7f40b3
```

**Выполненные bounded read checks**

| Проверка                                                                                                                                                                                         | Status | Результат                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -----: | --------------------------------------------------------------------------------------- |
| `git rev-parse HEAD bec43a9 f5e7083`                                                                                                                                                             |      0 | Frozen HEAD и оба baseline подтверждены                                                 |
| `git status --short`                                                                                                                                                                             |      0 | Только три ранее сохранённых untracked файла                                            |
| `git diff --stat bec43a9..8c3cb5d`                                                                                                                                                               |      0 | 68 изменённых файлов                                                                    |
| `git diff --name-only f5e7083..8c3cb5d`                                                                                                                                                          |      0 | Только HANDOFF, ROADMAP, STATE, `.continue-here.md`                                     |
| `git diff --quiet bec43a9 8c3cb5d -- apps/api packages/core packages/contracts packages/db yarn.lock .yarnrc.yml`                                                                                |      0 | Все перечисленные inputs неизменны                                                      |
| Scoped `git diff` для двух Today owners, layout, JSON boundary, package/config files                                                                                                             |      0 | Только описанный выше delta                                                             |
| Read-only Python: разбор threat tables из 18 PLAN                                                                                                                                                |      0 | Ровно 65 исходных строк                                                                 |
| Read-only Python: SHA-256 текущих файлов против `analyses`, `data`, owner13 `scope`/`after`                                                                                                      |      0 | 14/14 analysis inputs; 15/15 metrics18; 40/41 owner13 с одним покрытым заменяющим proof |
| Read-only Python: markers и original statuses из существующих JSON/JSONL/logs                                                                                                                    |      0 | Runtime результаты согласуются с S13/S18; failed runs сохранены как failed              |
| `rg -n -g '*.log' -g '*.json' -g '*.jsonl' -g '*.md' -e 'PRIVACY_OK files=263' -e 'PRIVACY_OK files=4' -e 'PRIVATE_STATE_SCRUB_OK' -e 'sessions signedout' /private/tmp/dv-lab-phase21-parallel` |      0 | Scrub/sign-out найдены в P18; отдельные raw privacy 263/4 не найдены                    |
| Read-only Python: fingerprints frozen blobs и входных отчётов                                                                                                                                    |      0 | Manifest/report SHA приведены выше                                                      |

## Security Audit Trail

| Дата       | Всего | Mitigate закрыты | Риски приняты | Открыто | Исполнитель          |
| ---------- | ----: | ---------------: | ------------: | ------: | -------------------- |
| 2026-10-11 |    65 |               45 |            20 |       0 | gsd-security-auditor |

## Sign-Off

- [x] Все 65 строк имеют disposition.
- [x] Все 20 принятых рисков содержат основание и ссылку на PLAN.
- [x] `threats_open: 0`.
- [x] `status: verified`.

Показатели quality выше ограничены проверенными входами owner13/18. Полная трассировка code-review findings ведётся в `21-REVIEW.md` и `21-REVIEW-DISPOSITION.md`.
