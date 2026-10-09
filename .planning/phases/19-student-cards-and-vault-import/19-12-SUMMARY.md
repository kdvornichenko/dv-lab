---
phase: 19-student-cards-and-vault-import
plan: 12
subsystem: api
status: complete
tags: [accounts, cards, auth, hono, drizzle, savepoint]
requires:
  - phase: 19-02
    provides: DbExecutor, violatesUnique, postgresCode в @dv-lab/db
  - phase: 19-03
    provides: createStudentAccountRequest, linkStudentAccountRequest, deactivateStudentAccountRequest, CreateStudentAccountResponse, StudentAccountResponse, AccountCandidatesResponse, isDisplayNameLength
  - phase: 19-05
    provides: accounts.student_id, частичный индекс accounts_student_uq, CHECK accounts_student_role_ck
  - phase: 19-07
    provides: модуль карточек, findStudentAccount, account в StudentDetail, SCRATCH/19-api.mjs
provides:
  - apps/api/src/cards/card-account.ts (createCardAccount, linkCardAccount, cardAccountCandidates, deactivateCardAccount)
  - apps/api/src/auth/accounts.ts (createStudent со studentId, linkStudentAccount, listUnlinkedStudentAccounts, deactivateStudent по карточке)
  - маршруты POST /students/:id/account, GET /students/:id/account/candidates, POST /students/:id/account/link, POST /students/:id/account/deactivate
affects: [19-14, 19-16, 19-19, 26]
tech-stack:
  added: []
  patterns:
    - "запись аккаунта внутри executor.transaction: на транзакции это SAVEPOINT, нарушение уникальности не ломает внешнюю транзакцию модуля карточек"
    - "модуль карточек: карточка FOR SHARE и вызов auth/accounts.ts в одной транзакции, сам в accounts не пишет"
    - "привязка условным UPDATE where student_id is null, гонки сериализует частичный индекс accounts_student_uq"
key-files:
  created:
    - apps/api/src/cards/card-account.ts
  modified:
    - apps/api/src/auth/accounts.ts
    - apps/api/src/routes/students.ts
    - apps/api/src/bootstrap-teacher.ts
decisions:
  - "Флаг плана о SAVEPOINT снят: drizzle 1.0.0-rc.4 (node-postgres session.js) выполняет tx.transaction как savepoint/release/rollback to savepoint, поэтому createStudent и linkStudentAccount принимают DbExecutor и ловят 23505 внутри вложенной транзакции"
  - "Поле результата createStudent и deactivateStudent переименовано student → account под контракты CreateStudentAccountResponse и StudentAccountResponse"
  - "Привязка аккаунта учителя, неактивного или несуществующего аккаунта — 404 not_found; неверный accountId в теле — 400"
  - "Кандидаты: активные аккаунты учеников без student_id, порядок lower(display_name), login"
metrics:
  duration: 25min
  completed: 2026-10-10
estimate:
  tokens: 45000
actuals:
  tokens: 7000
  tasks: 2
  commits: 2
plan_head_before: 1329199e144304ff1de3c3b8acd702714a428c7f
plan_head_after: b7287be05ba68f9e9a48c086270a826f6e3424f5
---

# Phase 19 Plan 12: Аккаунт ученика из карточки, привязка и деактивация по карточке Summary

Учитель создаёт ученику аккаунт прямо из карточки (имя берётся из карточки), привязывает существующий непривязанный аккаунт и деактивирует аккаунт под путём карточки; один аккаунт на карточку и одна карточка на аккаунт держат частичный индекс базы и точка сохранения, включая параллельные запросы.

## Что сделано

- `apps/api/src/auth/accounts.ts` (остаётся единственным владельцем записи в `accounts`, D-05):
  - `createStudent(executor, { login, displayName, password, studentId })` → `created { account, generatedPassword } | login_taken | card_has_account`; хэш считается до записи, insert идёт в `executor.transaction(...)` (savepoint), перехват `violatesUnique` по `accounts_active_login_uq` и `accounts_student_uq` (D-04, D-39);
  - `linkStudentAccount(executor, { accountId, studentId })` → `linked | account_already_linked | card_has_account | not_found`: условный UPDATE `role = 'student' and status = 'active' and student_id is null` внутри savepoint; 23505 `accounts_student_uq` → `card_has_account`; ноль строк → перечитывание аккаунта;
  - `listUnlinkedStudentAccounts(executor)` — активные ученики без карточки;
  - `deactivateStudent(db, { accountId, studentId })` — к условию `FOR UPDATE` добавлен `student_id = studentId`, чужой аккаунт → `not_found`; отзыв сессий без изменений (D-40). Отвязки нет (D-04).
- `apps/api/src/cards/card-account.ts` (D-42, из `auth/` импортирует только `accounts.ts`): `createCardAccount` и `linkCardAccount` — транзакция с карточкой `FOR SHARE`, затем функция аккаунтов на `tx`; `cardAccountCandidates` — `null` без карточки; `deactivateCardAccount` — `deactivateStudent` с id карточки.
- `apps/api/src/routes/students.ts`: четыре маршрута аккаунта карточки под общим `requireRole('teacher')` (D-27); неверный uuid карточки — 404, неверное тело — 400; 409 `login_taken` «This login is already taken», `card_has_account` «This card already has an account», `account_already_linked` «This account is already linked to a card»; 201 `{ account, generatedPassword }`, 200 `{ account }`, 200 `{ accounts }`.
- `apps/api/src/bootstrap-teacher.ts`: длину имени проверяет `isDisplayNameLength` из `@dv-lab/contracts` (D-41), импорт `DISPLAY_NAME_MAX_LENGTH` убран.

## Проверка

- `yarn workspace @dv-lab/api typecheck` — код 0 после каждой задачи; `prettier --check` по четырём файлам — чисто.
- Приёмочные grep: в `apps/api/src/cards/*.ts` нет `insert(accounts)` и `update(accounts)`; в `accounts.ts` нет `student_id = null` и `studentId: null`; в `bootstrap-teacher.ts` есть `isDisplayNameLength` и нет `DISPLAY_NAME_MAX_LENGTH`.
- Скрипт `SCRATCH/19-12-accounts.mjs` (api из исходников на порту 4193, `dvlab_test`, учитель-фикстура и ученик-фикстура из `19-api.mjs`, карточки Alex Example 1912 A..F, логины `v1912.*`). Часть 1 (`19-12-accounts.mjs 1`) после задачи 1 — ACCOUNTS_OK. Полный прогон после задачи 2:

```
cleanup before: 0 accounts, 0 cards
1.1 PASS POST /students/A/account: 201, login normalized, name from card, active, 12-char generated password, no-store (status 201)
1.2 PASS sign-in with the new account: 200, role student (status 200)
1.3 PASS GET /students/A shows the account, status active
1.4 PASS student fixture on POST /students/A/account: 403 (status 403)
1.5 PASS invalid login: 400 (status 400)
1.6 PASS unknown card and malformed id: 404 (404/404)
2.1 PASS GET candidates of B: 200, contains v1912.free1, not v1912.a (4 v1912 candidates)
2.2 PASS candidates of an unknown card: 404
2.3 PASS link free1 to B: 200 (status 200)
2.4 PASS link free1 to C: 409 account_already_linked (409 account_already_linked)
2.5 PASS second account for A: 409 card_has_account (409 card_has_account)
2.6 PASS link free2 to A: 409 card_has_account (409 card_has_account)
2.7 PASS link the teacher account to C: 404 (status 404)
2.8 PASS link an unknown account: 404
2.9 PASS parallel link free3 and free4 to D: one 200, one 409 card_has_account (200/409)
2.10 PASS parallel create of two accounts for E: one 201, one 409 card_has_account (201/409)
2.11 PASS login v1912.a for F: 409 login_taken (409 login_taken)
2.12 PASS migrator update of the teacher with student_id: 23514 accounts_student_role_ck ({"code":"23514","constraint":"accounts_student_role_ck"})
2.13 PASS deactivate the account of B through the path of A: 404 (status 404)
2.14 PASS account of B stays active after the cross-card attempt
2.15 PASS deactivate the account of A: 200, status deactivated (status 200)
2.16 PASS cookie of the deactivated account on /auth/me: 401 (status 401)
2.17 PASS deactivate the same account again: 404
2.18 PASS new account for A after deactivation: 201 (status 201)
2.19 PASS card A shows the new active account
2.20 PASS deactivated account stays in the history of A (2 rows)
2.21 PASS no card has two active accounts (0 rows)
2.22 PASS student fixture on candidates, link and deactivate: 403 (403/403/403)
2.23 PASS link with a malformed accountId: 400
3.1 PASS bootstrap-teacher with an empty name: exit 2 and Usage (exit 2)
3.2 PASS bootstrap-teacher with an 81-character name: exit 2 and Usage (exit 2)
3.3 PASS bootstrap-teacher with an 80-character name passes parsing and fails only on the missing database URL: exit 1 (exit 1)
L PASS api stdout has none of the 3 generated passwords
cleanup after: 7 accounts, 6 cards
ACCOUNTS_OK
```

- Скрипт удалил свои строки (сессии, 7 аккаунтов `v1912.*`, 6 карточек), api остановлен, порт 4193 свободен.

## Не запускалось

- `yarn workspace @dv-lab/api test`: тесты api очищают `dvlab_test` через `TRUNCATE`, а в волне 5 параллельно с этим планом 19-13 и 19-14 используют фикстуры в `dvlab_test`; существующие тесты не вызывают `createStudent` и `deactivateStudent` (grep по `apps/api`). Прогон оставлен итоговой проверке фазы.
- Сборка api — по плану её делает 19-13.
- `yarn knip`: ожидаемо красный до 19-19. После переименования поля результата в `account` api больше не отдаёт `CreateStudentResponse` и `DeactivateStudentResponse`; их импортируют только диалоги фазы 18 `create-student-dialog.tsx` и `deactivate-student-dialog.tsx` в `apps/web/app/(app)/students/_components` (файлы контрактов и web не входят в этот план).

## Deviations from Plan

### Auto-fixed Issues

Нет.

### Уточнения проверки

- Проверка bootstrap-teacher запускается без `--env-file` и с удалёнными из окружения `DATABASE_URL` и `MIGRATOR_DATABASE_URL` (план: `--env-file=.env.test` и «env без URL базы»). Так код 2 доказывает отказ до подключения: если бы разбор аргументов прошёл, `resolveDatabaseUrl` дал бы код 1, что показывает контрольный прогон 3.3 с именем из 80 символов.
- Скрипт проверяет больше плана: 400 на неверный логин и неверный accountId, 404 на неизвестную карточку и аккаунт, 404 на привязку аккаунта учителя через api, повторную деактивацию и историю деактивированного аккаунта.
- Диапазон `plan_head_before..plan_head_after` содержит 4 коммита: два коммита этого плана и два коммита параллельного плана 19-13 (fdb174d, fc2da38); `commits: 2` — коммиты задач 19-12 (`git log --grep="(19-12)"`), без коммита SUMMARY.

## Коммиты

- f34d634 feat(19-12): создание аккаунта ученика из карточки
- b7287be feat(19-12): привязка, кандидаты, деактивация по карточке, предикат имени в bootstrap-teacher

## Для следующих планов

- 19-14 (web профиль): ответы `POST /students/:id/account` — `{ account, generatedPassword }`, link и deactivate — `{ account }`, candidates — `{ accounts }`; коды 409 `card_has_account`, `account_already_linked`, `login_taken`.
- 19-14 / 19-19: `CreateStudentResponse` и `DeactivateStudentResponse` в `packages/contracts/src/auth.ts` используют только диалоги фазы 18 `create-student-dialog.tsx` и `deactivate-student-dialog.tsx`; когда их заменит профиль карточки, типы надо убрать (knip).
- Фаза 26: привязка аккаунтов ielts — `linkStudentAccount` / `linkCardAccount`.

## Self-Check: PASSED

- apps/api/src/cards/card-account.ts — FOUND
- f34d634, b7287be — FOUND в `git log`
