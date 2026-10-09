---
phase: 19-student-cards-and-vault-import
plan: 07
subsystem: api
status: complete
tags: [cards, students, balance, contracts, hono, drizzle]
requires:
  - phase: 19-02
    provides: DbExecutor и разбор ошибок Postgres в @dv-lab/db
  - phase: 19-03
    provides: saveStudentRequest, openingBalanceRequest, isDisplayNameLength
  - phase: 19-04
    provides: balanceMinutes, lessonsToMinutes в @dv-lab/core
  - phase: 19-05
    provides: таблицы students, payments, accounts.student_id; SCRATCH/19-sql.mjs
provides:
  - модуль карточек apps/api/src/cards (createCard, getCard, listCards, updateCard, archiveCard, restoreCard, setOpeningBalance, importCard)
  - маршруты /students для карточек
  - StudentAccount и StudentRow (карточка) в контрактах, findStudentAccount в accounts.ts
  - SCRATCH/19-api.mjs (общий помощник проверок api)
affects: [19-09, 19-10, 19-11, 19-12, 19-13, 19-18, 19-19]
tech-stack:
  added: []
  patterns:
    - "отбор оплат в остаток одним запросом в модуле карточек, сложение в core (balanceMinutes)"
    - "идемпотентные archive/restore: условный update, ноль строк — перечитать карточку"
    - "importCard: insert on conflict do nothing по import_key, затем select id"
key-files:
  created:
    - apps/api/src/cards/cards.ts
    - apps/api/src/cards/card-rows.ts
  modified:
    - apps/api/src/routes/students.ts
    - apps/api/src/auth/accounts.ts
    - apps/api/src/auth/account-rows.ts
    - packages/contracts/src/auth.ts
    - packages/contracts/src/students.ts
    - apps/web/app/(app)/students/_components/students-screen.tsx
    - apps/web/app/(app)/students/_components/create-student-dialog.tsx
    - apps/web/app/(app)/students/_components/deactivate-student-dialog.tsx
decisions:
  - "Отображение строки карточки названо toCardRow, колонки — cardColumns: имена toStudentRow и studentRowColumns запрещены приёмкой задачи 2"
  - "findStudentAccount: активный аккаунт карточки, иначе последний по updated_at деактивированный"
  - "Помощник 19-api.mjs ходит в api через node:http, а не fetch: порт 4190 входит в список bad ports у fetch (undici отвечает 'bad port')"
metrics:
  duration: 25min
  completed: 2026-10-10
estimate:
  tokens: 60000
actuals:
  tokens: 6100
  tasks: 3
  commits: 3
plan_head_before: a3e4f2ba030996b615b965ab80532e4b5cf5b7f5
plan_head_after: 4cc71537b0e6f2f5f4570c2fbd26c1252ea12fa9
---

# Phase 19 Plan 07: Модуль карточек и маршруты /students Summary

Карточки учеников в `apps/api/src/cards`: создание, чтение, список с числом несопоставленных оплат, правка, идемпотентные архив и восстановление, открывающий остаток в минутах и остаток от оплат позже даты открытия; аккаунт ученика (`StudentAccount`) и строка карточки (`StudentRow`) в контрактах разведены.

## Что сделано

- `apps/api/src/cards/cards.ts`: экспорт `createCard`, `getCard`, `listCards`, `updateCard`, `archiveCard`, `restoreCard`, `setOpeningBalance`, `importCard`. Приватные `cardValues` (общий построитель значений для createCard, updateCard и importCard), `cardBalances` (единственное место правила «что входит в остаток»: оплаты карточек набора с `paid_on > opening_balance_on` и `credited_minutes > 0`, одним запросом, без SQL-сумм; сложение — `balanceMinutes` из core; без открывающего остатка — `null`), `toDetail`. Из `auth/` импортирует только `accounts.ts`; `DbExecutor` и `Database` — из `@dv-lab/db`.
- `apps/api/src/cards/card-rows.ts`: `cardColumns`, тип `CardRecord`, `toCardRow` (строка списка `StudentRow`), `toStudentDetail`; статус и валюта через функции с исключением на неизвестное значение; `archivedAt` — ISO, `opening_balance_on` — строка `YYYY-MM-DD`.
- `apps/api/src/routes/students.ts` (`studentRoutes`): `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `POST /:id/archive`, `POST /:id/restore`, `PUT /:id/opening-balance`; цепочка `noStore, requireSession, requireRole('teacher')`; невалидный или неизвестный id — 404 `not_found`. Старые маршруты (список аккаунтов, создание аккаунта через `POST /`, `/:id/deactivate` по id аккаунта) удалены.
- `apps/api/src/auth/accounts.ts`: `findStudentAccount(executor, studentId)`; `listStudents` удалён; `createStudent` и `deactivateStudent` возвращают `StudentAccount`. `account-rows.ts`: `studentAccountColumns`, `toStudentAccount`, прежние колонки и отображение строки аккаунта удалены.
- Контракты: `auth.ts` — `StudentAccount`, `CreateStudentAccountResponse`, `StudentAccountResponse`, `AccountCandidatesResponse`; `StudentListResponse`, `CreateStudentResponse`, `DeactivateStudentResponse` описывают `StudentAccount` (их удалят 19-11 и 19-18); `StudentRow` из `auth.ts` убран. `students.ts` — `StudentRow`, `StudentsResponse`, `StudentDetail = StudentRow & {…}`, `StudentResponse`.
- web: в трёх файлах экрана Students только замена типа `StudentRow` на `StudentAccount`.

## Проверка

- `yarn workspace @dv-lab/contracts typecheck`, `@dv-lab/api typecheck`, `@dv-lab/web typecheck` — код 0 после каждой задачи.
- `yarn workspace @dv-lab/web lint` — код 0; `yarn workspace @dv-lab/contracts test` — 48 из 48.
- Prettier `--check` по файлам плана — чисто.
- Приёмочные grep: модуль карточек не импортирует `sessions`, `throttle`, `sign-in`, `passwords`; `code: '` в `routes` и `cards` нет; `listStudents`, `toStudentRow`, `studentRowColumns` в `apps` и `packages` нет; `export type StudentRow` только в `students.ts`; `/:id/deactivate` в маршрутах нет; `sum(` в `cards.ts` нет; `opening_balance_on`/`openingBalanceOn` в `apps/api/src` только в `cards/`.
- `node SCRATCH/19-07-cards.mjs` (api из исходников, порт 4190, `dvlab_test`), итоговый прогон:

```
setup removed leftover probe cards: 0
setup teacher and student fixtures signed in
1.1 PASS POST /students: 201, name normalized, active, balance null, account null, no-store
1.2 PASS GET /students/:id returns the same card (status=200)
1.3 PASS extra fields status, importKey, openingBalance are ignored: card is active without opening balance
1.4 PASS 81-char name, rate without currency, time zone Mars/Base: 400 invalid_request (long=400 noCurrency=400 zone=400)
1.5 PASS GET not-a-uuid and a random uuid: 404 not_found (bad=404 random=404)
1.6 PASS student fixture on POST and GET: 403 forbidden (post=403 get=403)
1.7 PASS no cookie on GET and POST: 401 unauthenticated (get=401 post=401)
1.8 PASS POST without Origin: 403 forbidden_origin
2.1 PASS GET /students: 200 { students, unassignedPayments }, row keys without parent and sections, unassignedPayments is a number
2.2 PASS list sorted case-insensitively: 'alex Earlier' before 'Alex Example'
2.3 PASS PATCH changes rate, lesson length 45 and time zone; GET shows the change
2.4 PASS PATCH with rate and no currency: 400
2.5 PASS POST archive: status archived, archivedAt set, linked account shown and still active
2.6 PASS repeated archive: 200 and the same card
2.7 PASS restore: active, archivedAt null, repeated restore 200, linked account still active
2.8 PASS archive, restore and PATCH of a random uuid, PATCH of not-a-uuid: 404
2.9 PASS student fixture on list, PATCH and archive: 403
2.10 PASS old /:id/deactivate route is gone: 404
3.1 PASS PUT opening-balance 3 lessons on 2026-10-01 for a 60-minute card: balance 180, openingBalance { 180, 2026-10-01 }
3.2 PASS payments on 09-30, 10-01, 10-02 (1.5) and 10-03 (credited 0): balance 270, only payments after the opening date
3.3 PASS GET /students shows the same balance 270
3.4 PASS opening date 2026-09-29: balance 390
3.5 PASS lessonsHundredths -1 and date 2026-02-30: 400; random uuid: 404; student: 403
3.6 PASS card without opening balance and the same payments: balanceMinutes null in GET and in the list
3.7 PASS importCard twice with one key: inserted true, then false with the same id; the existing card is not changed
log PASS api log has no request bodies or passwords
api stopped {"code":0,"signal":null}
cleanup removed probe cards: 6
CARDS_OK parts=3
```

- После прогона в `dvlab_test`: аккаунтов `v1907.%` — 0, карточек с ключом `probe-v1907` — 0; на порту 4190 слушателя нет.

## Не запускалось

- `yarn test` для `apps/api` и `packages/db`: они делают TRUNCATE в `dvlab_test` и стёрли бы фикстуры 19-api.mjs и данные параллельного плана; новых тестов план не пишет.
- Сборка api (в волне 3 её делает 19-08), `yarn knip` (красный до 19-19 по правилу фазы), браузер (экран Students перепишет 19-11; старый экран сейчас ходит в удалённые маршруты, план это допускает).

## Помощник SCRATCH/19-api.mjs (для 19-09, 19-10, 19-12, 19-19)

Экспорт: `ROOT`, `SCRATCH`, `ENV_TEST`, `COOKIE_NAME`, `TEACHER_LOGIN`, `STUDENT_LOGIN`, `startApi({ port })` → `{ base, port, logs(), stop() }`, `call(api, method, path, { cookie, body, origin = true, headers })` → `{ status, json, headers }` (`headers` — объект `Headers`), `teacherCookie(api)`, `studentCookie(api)`, `sql(text, role = 'migrator')`, `quote(value)`. Запросы идут через `node:http` (fetch отвергает порт 4190). Учитель `teacher19@example.test` и ученик `s19.fixture` созданы, секреты в `SCRATCH/19-teacher.secret` и `SCRATCH/19-student.secret` (права 600). Если учителя с этим логином нет (например, после TRUNCATE), `teacherCookie` создаёт его заново с тем же паролем; если учитель есть, а пароль не подходит — ошибка, пароль не сбрасывается.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Помощник ходит в api через node:http вместо fetch**
- **Found during:** Задача 1
- **Issue:** порт 4190 из плана входит в список запрещённых портов fetch (undici: `bad port`), запросы к `/healthz` не уходили.
- **Fix:** `startApi` и `call` в `SCRATCH/19-api.mjs` используют `node:http`; порт 4190 оставлен.
- **Files modified:** SCRATCH/19-api.mjs (вне репозитория)

**2. [Rule 2 - Robustness] Повторное создание учителя-фикстуры после очистки базы**
- **Found during:** Задача 1
- **Issue:** при существующем файле секрета и стёртом TRUNCATE учителе вход невозможен.
- **Fix:** `teacherCookie` проверяет через sql, есть ли активный `teacher19@example.test`; если нет — создаёт его тем же паролем; если есть и пароль не подходит — ошибка без сброса пароля.
- **Files modified:** SCRATCH/19-api.mjs (вне репозитория)

Имена в коде: строка карточки — `toCardRow`, колонки — `cardColumns` (приёмка задачи 2 запрещает `toStudentRow` и `studentRowColumns` в `apps` и `packages`).

## Known Stubs

Нет. Экран Students в web (`students-screen.tsx`, диалоги создания и деактивации) обращается к удалённым маршрутам списка и деактивации аккаунтов; это ожидаемо по плану, экран перепишет 19-11, диалоги — 19-12 и 19-18.

## Commits

- fd8f8cc feat(19-07): модуль карточек, POST /students и GET /students/:id
- 87d6888 refactor(19-07): StudentAccount и StudentRow разведены; список, правка, архив, восстановление
- 4cc7153 feat(19-07): открывающий остаток, отбор оплат в остаток, importCard

## Self-Check: PASSED

Файлы `apps/api/src/cards/cards.ts`, `apps/api/src/cards/card-rows.ts` на месте; коммиты fd8f8cc, 87d6888, 4cc7153 есть в ветке (3 коммита от a3e4f2b).

## Threat Flags

Нет новых поверхностей вне `<threat_model>` плана: все маршруты под `requireSession` и `requireRole('teacher')`, изменяющие методы под `sameOrigin`, тела не логируются (проверка `log` в скрипте).
