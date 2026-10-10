---
phase: 19-student-cards-and-vault-import
plan: 19
subsystem: verification
status: complete
tags: [agents-md, knip, ci-boundary, privacy, import-vault, browser, both-themes]
requires:
  - phase: 19-01..19-18, 19-20
    provides: пакет core, модуль карточек, import-vault, сервис import и RUNBOOK 11, экраны карточек и оплат
provides:
  - AGENTS.md с владельцами модулей фазы 19 и правилом о пакете импорта
  - итоговая проверка фазы: полный прогон проверок, приватность, повторный импорт, шесть критериев ROADMAP в обеих темах
affects: [20, 24, 25, 26]
key-files:
  created: []
  modified:
    - AGENTS.md
key-decisions:
  - 'knip зелёный без правок: файлы packages/contracts и packages/core из files_modified не менялись'
  - 'Разрешённое имя для проверки приватности берётся только из раздела Phase 19 файла ROADMAP.md на master; в остальном ROADMAP есть ещё одно совпадение с папкой vault, оно не разрешается'
  - 'Ученик на /students и /students/[id] видит страницу-приземление / на месте, без смены URL; это записано как наблюдение, а не исправлено (план не исправляет)'
requirements-completed: [CARD-01, CARD-02, CARD-03, CARD-06, CARD-07, ACCT-04, LEDG-01, LEDG-02, LEDG-09]
estimate:
  tokens: 45000
actuals:
  tokens: 700
  tasks: 3
  commits: 1
plan_head_before: 2d0e0a2b306c71b5dcabddb0f365aca07ff97f33
plan_head_after: 5be9d50a4e2e21d987ec3e7fdbe5fa521208e023
metrics:
  duration: 25min
  completed: 2026-10-10
---

# Phase 19 Plan 19: итоговая проверка фазы Summary

**AGENTS.md описывает пакет core, модуль карточек, разбор ошибок Postgres, import-vault и правило о пакете импорта; монорепозиторий зелёный по typecheck, lint, test, build и knip, миграции синхронны, границы CI и приватность соблюдены, повторный импорт vault вставил 0 строк, шесть критериев ROADMAP пройдены в браузере в светлой и тёмной теме на dvlab_dev.**

## Задачи

1. **AGENTS.md** — коммит `5be9d50` (docs). «Структура»: `apps/api/dist/import-vault.mjs`, строка `packages/core`. CI: граница `Web and api boundary` включает core. «Модули-владельцы»: правила core в строке о границе, `DbExecutor` и `postgres-errors.ts` в `packages/db`, `accounts.ts` как единственный владелец создания, привязки и деактивации аккаунтов, модуль карточек `apps/api/src/cards` (отбор оплат в остаток, импорт из `auth/` только `accounts.ts`, маршруты — ещё `middleware.ts`), маршруты `/students`, `/students/:id/account*`, `/payments`, `StudentRow` и `StudentAccount`, import-vault (`parse-vault.ts`, `packet.ts`, `apply-packet.ts`, сервис `import` профиля `tools`, RUNBOOK 11), `markdown-view.tsx` и `ledger-text.tsx`. «Публичный репозиторий»: правило о пакете импорта (D-28). Строка о двенадцати файлах `lib` не менялась.
2. **Полный прогон, knip, границы CI, приватность** — без коммита: knip зелёный, правок не понадобилось.
3. **Шесть критериев ROADMAP** — без коммита: файлов задача не меняет.

## Задача 1: проверки

`SCRATCH/19-19-t1.sh`: `packages/core`, `apps/api/src/cards`, `import-vault`, `vault-import.json`, `postgres-errors` найдены; grep запрещённых слов из критерия приёмки задачи 1 — пусто; пути vault в AGENTS.md нет; `prettier --check AGENTS.md` чисто; `T1_OK`.

## Задача 2: полный прогон

| Команда                                                                            | Результат                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn typecheck`                                                                   | код 0, 5 задач turbo                                                                                                                                                                                                                                                                                                                                      |
| `yarn lint`                                                                        | код 0                                                                                                                                                                                                                                                                                                                                                     |
| `yarn test`                                                                        | код 0: contracts 48/48 (2 файла), db 21/21 (2 файла), api 47/47 (7 файлов)                                                                                                                                                                                                                                                                                |
| `yarn build`                                                                       | код 0; api собрал `dist/import-vault.mjs`, web — маршруты `/students`, `/students/[id]`                                                                                                                                                                                                                                                                   |
| `yarn knip`                                                                        | код 0; в выводе только подсказки конфигурации (`Remove from ignore` для копии варианта A, `Remove redundant entry pattern`), находок нет                                                                                                                                                                                                                  |
| `SCRATCH/19-19-ci.sh` (дословные тексты шагов CI)                                  | `Legacy code check`, `Web and api boundary`, `Client address trust`, `Turbo version in Dockerfiles`, `Migrations are in sync with the schema` — код 0 каждый; `yarn db:generate`: «No schema changes»; `git status` по `packages/db/drizzle` пуст; `CI_STEPS_OK`                                                                                          |
| `SCRATCH/19-19-privacy.mjs`                                                        | 25 папок vault, 1 имя разрешено разделом Phase 19 ROADMAP на master, проверено 326 файлов фазы (diff от merge-base с master, без удалённых, плюс незакоммиченные файлы фазы); пакет не отслеживается, `git check-ignore` для `x.vault-import.json` и `apps/api/x.vault-import.json` — код 0, строка `*.vault-import.json` в `.dockerignore`; `PRIVACY_OK` |
| `grep -rn "@radix-ui\|radix-ui\|cmdk" apps/web` по `*.tsx`, `*.ts`, `package.json` | пусто                                                                                                                                                                                                                                                                                                                                                     |

`yarn test` очистил `dvlab_test`; фикстуры `teacher19@example.test` и `s19.fixture` пересоздал помощник `19-api.mjs` при проверке api. После сборки `apps/web/AGENTS.md` не появлялся.

## Задача 3: критерии ROADMAP на dvlab_dev

Стек: `yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev` на dvlab_dev, Chromium через playwright-core и `SCRATCH/19-web-lib.mjs`, скрипт `SCRATCH/19-19-browser.mjs` в светлой и тёмной теме (`CRITERIA_OK [light]`, `CRITERIA_OK [dark]`, строк FAIL нет). Данные менялись только на вымышленных карточках Alex Example 1919 A и B, аккаунте `v1919.free` и пробных оплатах `probe 1919`; одна реальная карточка получала открывающий остаток и сразу возвращена (критерий 6). Скриншоты — только в SCRATCH (`19-19-{light,dark}-*.png`).

| Критерий                                | Итог                         | Наблюдение                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Карточка (CARD-01, CARD-02, CARD-03) | PASS                         | New student со ставкой 1500 RUB, длиной урока 60, поясом через поиск «ho_chi», Parent, Level, Goals — профиль показывает все поля, в базе `Asia/Ho_Chi_Minh`, 150000, RUB, 60; Edit details меняет Level на B2; Archive переносит карточку во вкладку Archived, Restore возвращает в Active; Notes: таблица из трёх строк, ссылка с `target="_blank"` и `rel="noreferrer noopener"`, `<script>` не исполнен и не показан; Vocabulary: термин добавлен, тот же термин в другом регистре даёт ошибку поля «This term is already on the card.» и одна строка в базе, заметка изменена, термин удалён                                                                 |
| 1. Роль ученика (D-27)                  | PASS по сути, см. наблюдение | api (`SCRATCH/19-19-api.mjs`, порт 4199, dvlab_test): сессия ученика получает 403 на все 22 маршрута карточек, секций, словаря, оплат и аккаунта карточки, ничего не меняется; без сессии `GET /students` — 401; `API_ROLES_OK`. Через прокси web: 403 на `/students`, `/payments/unassigned`, `/students/{id}/terms`. Браузер: dev-ученик на `/students` и `/students/[id]` видит ту же страницу «Signed in as», что на `/`, без вкладок и данных карточки (в HTML нет имени и полей карточки), но URL не меняется: `(app)/layout.tsx` показывает ученику `StudentLanding` вместо `children`, поэтому `redirect('/')` из `requireTeacherPage` не срабатывает     |
| 2. Импорт (CARD-06)                     | PASS                         | `SCRATCH/19-19-import.mjs`: `parse` — код 0, сводка students=25 sections=66 terms=762 payments=28 payments_without_currency=4 unmatched=1 rates=19 skipped_rows=1, sha256 пакета равен принятому в 19-13; `apply` (`--env-file=.env`, env без URL базы) — код 0, stderr пуст, `students inserted=0 skipped=25; sections inserted=0 skipped=66; terms inserted=0 skipped=762; payments inserted=0 skipped=29`; SQL: 25 карточек и 25 различных id, 66 секций, 762 термина, 29 оплат vault, 1 несопоставленная; у карточки CARD-06 0 оплат; снимок id до и после совпал; в выводе нет имён папок; пакет удалён, `test ! -e SCRATCH/19-19.vault-import.json` — код 0 |
| 3. Несопоставленные оплаты (CARD-07)    | PASS                         | вкладка «Unassigned payments (2)» равна `select count(*) from payments where student_id is null` (реальная оплата vault и пробная), строк в таблице 2; пробная оплата без валюты назначена 1919 A с выбранной валютой RUB: 0.8 урока в форме, в базе RUB, `0.80`, 48 минут, счётчик уменьшился; реальная оплата vault осталась несопоставленной (1 до и после). Set currency (DR-2) на оплате карточки без валюты: RUB, `0.40`, 24 минуты, шапка 4.2 lessons left                                                                                                                                                                                                 |
| 4. Запись оплаты (LEDG-01, LEDG-02)     | PASS                         | у 1919 A (3 урока на вчера) сумма 3750 RUB даёт Lessons 2.5, KZT очищает; сохранено с 1.5 — SQL `'1.50'` и 90, шапка «4.5 lessons left»; удаление с подтверждением возвращает «3 lessons left»                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 5. Аккаунт и карточка (ACCT-04)         | PASS                         | `v1919.free` (вставлен SQL) привязан к 1919 A через Link existing account; в открытом ранее диалоге 1919 B тот же аккаунт даёт «This account is already linked to a card.»; Create account в открытом ранее диалоге 1919 A даёт «This card already has an account.», аккаунт не создан; `group by student_id having count(*) > 1` по активным — 0 строк                                                                                                                                                                                                                                                                                                           |
| 6. Открывающий остаток (LEDG-09)        | PASS                         | все 25 импортированных карточек в списке показывают «Set opening balance»; одна импортированная карточка: 3 урока на сегодня — «3 lessons left», затем `opening_balance_minutes` и `opening_balance_on` = null через 19-sql.mjs (прогон в светлой теме, один раз); 1919 A: остаток 3 на сегодня — «3 lessons left», оплата 1 урок датой открытия показывает подпись «This date is on or before…» и остаток не меняет, перенос даты открытия на вчера даёт «5.2 lessons left» (3 + 0.8 + 0.4 + 1)                                                                                                                                                                  |
| 7. Темы (backstop)                      | PASS                         | класс `dark` у документа соответствует теме; контраст: приглушённый текст «Set opening balance» и «No currency» 4.74 (светлая) и 5.93 (тёмная), текст баннера 19.8 и 9.78, ошибка поля в диалоге 4.77 и 3.94; точка Active зелёная в обеих темах; строки bg-hover, баннеры и диалоги осмотрены на скриншотах                                                                                                                                                                                                                                                                                                                                                      |

Приёмка: пакет отсутствует; `select count(*) from students where import_key is not null and opening_balance_minutes is not null` (.env) — 0. После прогонов в dvlab_dev: 25 карточек, 0 карточек без import_key, 29 оплат, 1 несопоставленная, 66 секций, 762 термина, аккаунтов и сессий `v19%` 0. Dev-серверы остановлены, слушателей на портах 3000 и 4000 нет, `apps/web/AGENTS.md` удалён и не коммитился.

## Не запускалось

- Выкатка релиза фазы 19 и импорт на сервере (RUNBOOK 11.1-11.3) — отложенный шаг человека: владелец принимает импорт на dvlab_dev, Server guy выполняет раздел 11; ни одной серверной команды план не выполнял.
- Docker, `caddy validate`, shellcheck скриптов `deploy/` и сборка образов из job CI (локально Docker не используется, файлы `deploy/` фаза 19-19 не меняла).
- Клавиатурный проход по всем экранам и ширина 320 px (проверены в 19-14, 19-16, 19-17).

## Deviations from Plan

### Уточнения исполнения

- Задачи 2 и 3 не дают коммитов: knip зелёный без правок, ручная проверка файлов не меняет. `commits: 1` — `git rev-list --count 2d0e0a2..HEAD` до коммита этого файла.
- `19-19-ci.sh` кроме двух шагов плана выполняет дословно ещё `Legacy code check`, `Turbo version in Dockerfiles` и `Migrations are in sync with the schema`.
- `19-19-privacy.mjs` разрешает только имя из раздела Phase 19 ROADMAP на master (CARD-06); второе совпадение папки vault в другом разделе ROADMAP разрешением не считается. Проверяются и незакоммиченные файлы фазы, чтобы этот SUMMARY прошёл проверку до коммита.
- Реальная карточка получила открывающий остаток один раз (прогон светлой темы), в тёмной теме критерий 6 проверен на списке и на 1919 A.

### Auto-fixed Issues

Нет.

## Наблюдения для оркестратора и дизайна

- Роль ученика: UI-SPEC (Roles) и must_have плана говорят «редирект на /», фактически `(app)/layout.tsx` показывает ученику страницу-приземление на любом адресе приложения, URL остаётся `/students`. Данных карточек нет, api отвечает 403. Если нужен именно редирект, это правка layout или proxy в отдельной задаче.
- Диалог Link existing account после 409 «already linked» перечитывает список, сбрасывает выбор и показывает вместе с баннером ошибку поля «Choose an account.» (так же на скриншотах 19-18).
- Тёмная тема: ошибка поля в диалоге на фоне диалога даёт контраст 3.94 (ниже 4.5 для мелкого текста); в светлой 4.77.

## Known Stubs

Нет.

## Threat Flags

Новой поверхности нет. T-19-83: `PRIVACY_OK`, находки печатаются без имени. T-19-84: пакет не отслеживается, закрыт масками `.gitignore` и `.dockerignore`, удалён из SCRATCH. T-19-85: 403 на 22 маршрута для сессии ученика, данных карточки в HTML нет. T-19-86: правки только на карточках 1919, открывающий остаток импортированной карточки возвращён в null (счёт 0). T-19-87: в этом файле только PASS, счётчики и uuid.

## Self-Check: PASSED

- `AGENTS.md` содержит `import-vault`, `apps/api/src/cards`, `vault-import.json`.
- Коммит `5be9d50` есть в `git log`.
- `SCRATCH/19-19.vault-import.json` отсутствует.

---

_Phase: 19-student-cards-and-vault-import_
_Completed: 2026-10-10_
