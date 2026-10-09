---
phase: 18-accounts-and-variant-a-shell
plan: 10
subsystem: auth
tags: [accounts, students, password-change, sessions, cli, drizzle, postgres]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-06 revokeAccountSessions, issueSession, readSession, createSignIn().verifyCredentials, studentRowColumns и toStudentRow; 18-07 createTeacher, violatesUnique и CLI bootstrap-teacher; 18-04 hashPassword, verifyPassword, generatePassword; 18-01 StudentRow, AccountSummary"
provides:
  - "apps/api/src/auth/accounts.ts: createStudent, listStudents, deactivateStudent, changePassword, resetTeacherPassword; типы CreateStudentResult, DeactivateStudentResult, ChangePasswordResult, ResetTeacherPasswordResult"
  - "apps/api/src/bootstrap-teacher.ts: режим --reset-password --email <email> [--password-stdin]"
affects: [18-12, 18-15, 18-16]

tech-stack:
  added: []
  patterns:
    - "Операции над чужой строкой accounts идут одной транзакцией: select ... for update с условием роли и статуса, запись, затем revokeAccountSessions(tx, id); отсутствие строки — исход not_found без записи"
    - "Смена пароля — compare-and-set: хэш из verifyCredentials сверяется со строкой под FOR UPDATE, новый хэш считается до транзакции"

key-files:
  created: []
  modified:
    - apps/api/src/auth/accounts.ts
    - apps/api/src/bootstrap-teacher.ts

key-decisions:
  - "changePassword принимает Pick<SignIn, 'verifyCredentials'>, а не весь SignIn: маршрут передаёт свой экземпляр createSignIn, проверка подменяет только этот метод"
  - "Отказы locked, busy и unavailable модуля входа changePassword возвращает как есть (тип Exclude<CredentialCheck, ok | invalid_credentials>); invalid_credentials превращается в wrong_current_password"
  - "Строка в транзакции смены пароля выбирается с условием status = 'active': аккаунт, деактивированный между проверкой и транзакцией, даёт wrong_current_password, а не новую сессию"
  - "deactivateStudent возвращает строку из update ... returning (status deactivated) до вызова revokeAccountSessions; эпоху и удаление сессий делает только модуль сессий"
  - "В режиме --reset-password --name не нужен и не проверяется; пароль, его чтение из stdin и коды 1, 2, 3 общие с созданием; ошибка печатается той же строкой Bootstrap failed"

requirements-completed: [ACCT-02, ACCT-05]

actuals:
  tokens: 2577
  tasks: 3
  commits: 3

duration: 30min
completed: 2026-10-09
status: complete
plan_head_before: 555fd47550f86540495c334212e3f76427ffd5ac
plan_head_after: 5e3533885375d09b91c11d85eceafa8242da6433
commits: 3
---

# Phase 18 Plan 10: Учётные записи учеников, смена и восстановление пароля Summary

**Модуль accounts.ts создаёт учеников (12-символьный сгенерированный пароль один раз или свой 10-128), отдаёт список через toStudentRow, деактивирует только активного ученика под FOR UPDATE с отзывом всех сессий через revokeAccountSessions, меняет пароль учителя compare-and-set с новой сессией и восстанавливает пароль единственного учителя из CLI `--reset-password` без смены id.**

## Performance

- **Duration:** около 30 мин
- **Completed:** 2026-10-09
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `createStudent(db, { login, displayName, password })`: при `password === null` пароль `generatePassword()` и `generatedPassword` равен ему, иначе `null`; хэш до вставки; вставка `role: 'student'` с `returning(studentRowColumns)`; нарушение `accounts_active_login_uq` через `violatesUnique` даёт `{ kind: 'login_taken' }`; успех — `{ kind: 'created', student: toStudentRow(row), generatedPassword }`.
- `listStudents(db)`: только `role = 'student'`, `created_at` по убыванию, без пагинации, строки через `toStudentRow` (ключи `id, login, displayName, status, createdAt`).
- `deactivateStudent(db, studentId)`: транзакция, `select ... for update` по `id`, `role = 'student'`, `status = 'active'`; нет строки — `not_found`; иначе `status = 'deactivated'`, `updated_at = now()`, `revokeAccountSessions(tx, id)`, `{ kind: 'deactivated', student }`.
- `changePassword(db, signIn, { account, currentPassword, newPassword, ip })`: `verifyCredentials` модуля входа (неверный пароль считается тем же счётчиком, что вход), совпадающий новый пароль — `password_unchanged`, хэш нового до транзакции, в транзакции сверка хэша под `FOR UPDATE`, запись хэша, `epoch = revokeAccountSessions(tx, id)`, `issueSession(tx, { accountId, authEpoch: epoch })`, `{ kind: 'changed', token }`.
- `resetTeacherPassword(db, { login, passwordHash })`: транзакция, `select ... for update` активного учителя с этим логином, новый хэш, `revokeAccountSessions`; `{ kind: 'reset', login }` или `not_found`; новая сессия не открывается, id не меняется.
- `bootstrap-teacher.ts`: флаг `--reset-password` (нужен только `--email`), строки `Password reset. Login: <login>` и `Password (shown once): <password>` только для сгенерированного пароля; `No active teacher with this email` в stderr и код 3; Usage дополнен второй строкой `bootstrap-teacher --reset-password --email <email> [--password-stdin]`.

## Проверки (вывод дословно, без паролей)

Скрипт `scratchpad/18-10-accounts.mjs` импортирует `apps/api/src/auth/*.ts` из исходников, работает на dvlab_test под ролью приложения (`resolveDatabaseUrl('app', { NODE_ENV: 'test', ... })`), `createSignIn({ db, logger, requireClientIp: false })` с логгером в поток-заглушку. Ученики `v1810.*`, адреса `198.51.10x.<случайный октет>`; строки учеников и ключи ограничения удаляются в начале и в конце. CLI запускается из исходников: `node --env-file=.env.test apps/api/src/bootstrap-teacher.ts` с `NODE_ENV=test` и env без `DATABASE_URL` и `MIGRATOR_DATABASE_URL`; деактивация учителей и подмена хэша — через `18-sql.mjs`. Аргумент скрипта — номер последней части (1 после задачи 1, 2 после задачи 2, без аргумента все три).

После задачи 1 (`node 18-10-accounts.mjs 1`, и повтор после коммита `08f4991` как tracer-проверка):
```
1.1 PASS createStudent with password null gives created, 12-char generated password from the alphabet, ISO createdAt, StudentRow keys only (kind=created generatedLength=12 alphabet=true keys=createdAt,displayName,id,login,status)
1.2 PASS signIn.attempt with the generated password gives ok with role student (kind=ok role=student)
cleanup v1810 students left=0 warnings=0
ACCOUNTS_OK
```

После задачи 3 (`node 18-10-accounts.mjs`, последний прогон; части 1-2 совпадают с прогоном после задачи 2):
```
1.1 PASS createStudent with password null gives created, 12-char generated password from the alphabet, ISO createdAt, StudentRow keys only (kind=created generatedLength=12 alphabet=true keys=createdAt,displayName,id,login,status)
1.2 PASS signIn.attempt with the generated password gives ok with role student (kind=ok role=student)
2.1 PASS own 12-char password: created with generatedPassword null, the student signs in with it (kind=created generatedPassword=null ownLength=12 attempt=ok)
2.2 PASS active login repeated gives login_taken without a row; after deactivation the login is taken again (repeat=login_taken rowsWithLogin=1 deactivate=deactivated again=created newId=true)
2.3 PASS listStudents: only students, newest first, no passwordHash or authEpoch, own rows present including deactivated (rows=4 nonStudents=0 teachersListed=0 keysOk=true leaked=false ordered=true newestBeforeOlder=true)
2.4 PASS deactivateStudent: deactivated, both sessions read null, epoch +1, rows gone, sign-in with the right password is invalid_credentials (aliveBefore=true kind=deactivated rowStatus=deactivated epoch 0->1 reads=null,null sessionsLeft=0 attempt=invalid_credentials)
2.5 PASS deactivateStudent on a teacher id, an already deactivated student and a random uuid gives not_found and changes no row (teacher=not_found deactivated=not_found random=not_found teacherUnchanged=true studentUnchanged=true probeTeacherInserted=true)
3.1 PASS changePassword with the right current password: changed, three old sessions read null, the new token reads the account, epoch +1, one session left (kind=changed oldReads=null,null,null fresh=alive epoch 0->1 sessions=1)
3.2 PASS old password no longer signs in, the new one does (old=invalid_credentials new=ok)
3.3 PASS wrong current password gives wrong_current_password; after five from one address the sixth sign-in with the right password from it is locked; sessions and epoch untouched (kinds=wrong_current_password,wrong_current_password,wrong_current_password,wrong_current_password,wrong_current_password sixth=locked retryAfter=900 currentAlive=true epoch 1->1)
3.3 note throttle rows of v1810.c removed through 18-sql.mjs (left=0)
3.4 PASS new password equal to the current one gives password_unchanged and every session stays alive (kind=password_unchanged alive=true sessions=2->2)
3.5 PASS password_hash replaced between the check and the transaction: wrong_current_password, hash stays the replaced one, epoch and sessions untouched (kind=wrong_current_password hashIsReplaced=true epoch 1->1 sessions=2->2)
3.6 note active teachers of dvlab_test deactivated (rowCount=0)
3.6 PASS --reset-password --email: code 0, Password reset line, one generated password line, same id, epoch +1, both old sessions null, no new session, new password signs in, old does not (create=0 sessions=ok,ok reset=0 stdout=Password reset. Login: teacher@example.test|Password (shown once): <hidden>| stderr="" passwordLines=1 generatedLength=12 sameId=true activeRows=1 epoch 0->1 oldReads=null,null sessionsAfterReset=0 old=invalid_credentials new=ok)
3.6b PASS --reset-password --password-stdin: code 0, only the Password reset line, the given password signs in (code=0 stdout=Password reset. Login: teacher@example.test| attempt=ok)
3.7 PASS --reset-password for an unknown email: code 3, No active teacher with this email, nothing printed to stdout, teacher rows unchanged; missing or invalid email: code 2 with usage (code=3 stderr="No active teacher with this email\n" stdout="" teacherRowsUnchanged=true noEmail=2 badEmail=2)
3.7b PASS create mode unchanged: a second teacher is refused with code 3 and no row (code=3 stderr="An active teacher already exists\n" rows=0)
3.8 PASS created teacher deactivated at the end (rowCount=1)
cleanup v1810 students left=0 warnings=0
ACCOUNTS_OK
```
В проверке 2.5 активного учителя в dvlab_test не было: скрипт вставил учителя `v1810-probe@example.test` через `18-sql.mjs`, после проверки деактивировал и удалил строку. Строка `rowCount=0` в 3.6 — следствие этого. В 3.5 обёртка `verifyCredentials` после настоящего `ok` подменяет `password_hash` через `18-sql.mjs`.

`bash scratchpad/18-10-checks.sh task3` (критерии приёмки трёх задач):
```
PASS accounts.ts imports account-rows
--- grep "'student'" apps/api/src/auth/accounts.ts
87:			.values({ login: input.login, displayName: input.displayName, role: 'student', passwordHash })
101:		.where(eq(accounts.role, 'student'))
111:			.where(and(eq(accounts.id, studentId), eq(accounts.role, 'student'), eq(accounts.status, 'active')))
--- grep -nE 'auth_epoch|authEpoch\} \+ 1|delete\(sessions\)' apps/api/src/auth/accounts.ts
PASS no direct epoch or session writes in accounts.ts
--- git grep --untracked -n process.env -- apps/api/src
apps/api/src/bootstrap-teacher.ts:117:		const connection = createDb(resolveDatabaseUrl('app', process.env))
apps/api/src/migrate.ts:8:	const migrations = await runMigrations(resolveDatabaseUrl('migrator', process.env))
apps/api/src/server.ts:15:const config = loadConfig(process.env)
PASS process.env only in entry points
PASS bootstrap-teacher contains reset-password
--- comments
PASS no comments
Checking formatting...
All matched files use Prettier code style!
```

`yarn workspace @dv-lab/api typecheck` — код 0 после каждой задачи и после форматирования перед третьим коммитом.

## Task Commits

1. **Задача 1: создание ученика со сгенерированным или своим паролем** - `08f4991` (feat)
2. **Задача 2: список учеников и деактивация с отзывом сессий** - `3bbf04d` (feat)
3. **Задача 3: смена пароля и восстановление пароля учителя из CLI** - `5e35338` (feat)

**Plan metadata:** коммит `docs(18-10)` с этим файлом.

`commits: 3` — коммиты `(18-10)` в `git log 555fd47..HEAD`; в диапазон попал коммит параллельного плана 18-09 `c4c1e01`.

## Files Created/Modified

- `apps/api/src/auth/accounts.ts` - ученики (создание, список, деактивация), смена пароля, восстановление пароля учителя
- `apps/api/src/bootstrap-teacher.ts` - режим `--reset-password` и вторая строка Usage

## Decisions Made

См. `key-decisions` во frontmatter. Решение плана, которое видит пользователь: пять неверных текущих паролей в диалоге смены закрывают вход этого учителя с того же адреса на 15 минут (общий счётчик с входом); снятие — строка RUNBOOK из 18-16.

## Deviations from Plan

### Auto-fixed Issues

**1. [Дисциплина плана] Коммиты задач вместо «Не коммитить»**
- **Found during:** все три задачи
- **Issue:** действия задач заканчиваются «Не коммитить», общие правила фазы 18 требуют атомарный коммит каждой задачи.
- **Fix:** по коммиту на задачу, пути явные.
- **Commits:** `08f4991`, `3bbf04d`, `5e35338`

**2. [Rule 2 - Missing critical] Условие status = 'active' в транзакции смены пароля**
- **Found during:** задача 3
- **Issue:** план выбирает строку только по id; аккаунт, деактивированный между `verifyCredentials` и транзакцией, получил бы новый хэш и запись сессии.
- **Fix:** условие `status = 'active'` в `select ... for update`; нет строки — `wrong_current_password`, как при изменённом хэше.
- **Files modified:** `apps/api/src/auth/accounts.ts`
- **Commit:** `5e35338`

**3. [Rule 3 - Среда] Проверки через скрипты scratchpad и аргумент части**
- **Found during:** все задачи
- **Issue:** хук изоляции worktree отклоняет `&&`, `!` и `$(...)` в командах, а `<automated>` задач 1 и 2 вызывает скрипт, части которого до следующих задач заведомо не пройдут.
- **Fix:** typecheck и скрипт запускались отдельными командами; критерии приёмки — `18-10-checks.sh`; скрипт принимает номер последней части (`1`, `2`), без аргумента выполняет все.

**4. [Проверка сверх плана] Проверки 3.6b и 3.7b**
- **Fix:** добавлены сброс с `--password-stdin` (строки пароля нет, заданный пароль входит), отказ без `--email` и с не-e-mail (код 2) и отказ второго учителя в режиме создания (код 3): режим создания переписан на общую ветку с режимом сброса.

---

**Total deviations:** 4 (1 организационное, 1 Rule 2, 1 по среде проверки, 1 расширение проверки)
**Impact on plan:** интерфейс и поведение совпадают с планом; добавлено только условие статуса в compare-and-set.

## Known Stubs

None.

## Threat Flags

None: новых сетевых точек нет; режим `--reset-password` описан в модели угроз плана (T-18-61).

## Issues Encountered

- `yarn workspace @dv-lab/api build` и тесты api не запускались: сборку api в волне 4 делает 18-09, новые тесты запрещены директивой владельца. `yarn lint` у api нет, `yarn knip` ожидаемо красный до 18-16.
- Ошибок typecheck от параллельного 18-09 не было.

## User Setup Required

None.

## Next Phase Readiness

- 18-12: маршруты учеников и смены пароля вызывают `createStudent` (вход уже нормализован `createStudentRequest`), `listStudents`, `deactivateStudent`, `changePassword(db, signIn, { account, currentPassword, newPassword, ip })` и ставят новую cookie из `token` при `changed`. `deactivateStudent` не проверяет формат id: маршрут должен проверить, что параметр пути — uuid, иначе Postgres даст 22P02 и ответ 500. `changePassword` не проверяет роль: маршрут закрывает её ролью учителя. Исходы различаются полем `kind`: `login_taken`, `not_found`, `wrong_current_password`, `password_unchanged`, `locked` (с `retryAfterSeconds`), `busy`, `unavailable`.
- 18-15 (ручной список): восстановление пароля dev-учителя `--reset-password` на dvlab_dev и сценарии учителя в браузере.
- 18-16: строки RUNBOOK для `docker compose run ... bootstrap-teacher --reset-password --email <email>` и снятия блокировки входа после пяти неверных текущих паролей.
- dist api этим планом не собирался: `bootstrap-teacher` с `--reset-password` попадёт в dist при следующей сборке (18-09 или 18-12).
- В dvlab_test активного учителя после прогона нет (скрипт деактивирует `teacher@example.test`).

## Self-Check: PASSED

- Файлы `apps/api/src/auth/accounts.ts` и `apps/api/src/bootstrap-teacher.ts` на диске, экспорты `createStudent`, `listStudents`, `deactivateStudent`, `changePassword`, `resetTeacherPassword`, `violatesUnique`, `createTeacher` есть.
- Коммиты `08f4991`, `3bbf04d`, `5e35338` есть в `git log`.
- `ACCOUNTS_OK` получен после каждой задачи, typecheck чистый.

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-09*
