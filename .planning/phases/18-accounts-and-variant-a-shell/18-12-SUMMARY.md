---
phase: 18-accounts-and-variant-a-shell
plan: 12
subsystem: auth
tags: [hono, routes, students, change-password, cookie, rbac]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-09 middleware.ts (requireSession, requireRole, readJson, noStore, refusalResponse, setSessionCookie, clientIp) и authRoutes; 18-10 createStudent, listStudents, deactivateStudent, changePassword; 18-01 createStudentRequest, changePasswordRequest, StudentListResponse, CreateStudentResponse, DeactivateStudentResponse"
provides:
  - "apps/api/src/routes/students.ts: studentRoutes({ db }) — GET /students, POST /students, POST /students/:id/deactivate"
  - "apps/api/src/routes/auth.ts: POST /auth/change-password"
  - "apps/api/src/app.ts: app.route('/students', studentRoutes({ db }))"
affects: [18-14, 18-15, 18-16]

tech-stack:
  added: []
  patterns:
    - "Группа /students закрыта целиком: use('*', noStore, requireSession(db), requireRole('teacher')), поэтому 401 и 403 тоже несут Cache-Control: no-store"
    - "Параметр пути проверяется z.uuid().safeParse до обращения к модулю: неверный id отвечает тем же 404 not_found, что чужой или несуществующий"

key-files:
  created:
    - apps/api/src/routes/students.ts
  modified:
    - apps/api/src/routes/auth.ts
    - apps/api/src/app.ts

key-decisions:
  - "Ответы /students собираются из исходов модуля без своих правил: login_taken 409, not_found 404, created 201 { student, generatedPassword }, deactivated 200 { student }"
  - "POST /auth/change-password: requireSession(db), requireRole('teacher'), readJson; changed — setSessionCookie с новым токеном и 204; wrong_current_password и password_unchanged — 400 со своими кодами; locked, busy, unavailable — refusalResponse"
  - "Отказ смены пароля строку sign-in refused не пишет (план её не требует); неверный текущий пароль засчитывается модулем входа в тот же счётчик"

requirements-completed: [ACCT-02, ACCT-05]

actuals:
  tokens: 1100
  tasks: 3
  commits: 3

duration: 20min
completed: 2026-10-09
status: complete
plan_head_before: fac85222f6621060cec6a889e410d2d50f1a7dc8
plan_head_after: 608cfd9be4ba80230b387a6a6b4ee7d9bb12bc59
commits: 3
---

# Phase 18 Plan 12: HTTP-маршруты учеников и смены пароля Summary

**Группа /students (только учитель, no-store): создание ученика с 201 { student, generatedPassword }, список без пароля, хэша и эпохи, деактивация с проверкой uuid и 404 для учителя, чужого и неверного id; POST /auth/change-password для учителя с новой cookie текущей сессии, закрытием остальных сессий, отдельными кодами wrong_current_password и password_unchanged и отказами locked/busy/unavailable через refusalResponse.**

## Performance

- **Duration:** около 20 мин
- **Completed:** 2026-10-09
- **Tasks:** 3
- **Files modified:** 3 (1 создан, 2 изменены)

## Accomplishments

- `routes/students.ts`: `studentRoutes({ db })` — `POST /` (`readJson(createStudentRequest)`, null — 400 `invalid_request`; `login_taken` — 409 «This login is already taken»; `created` — 201 `CreateStudentResponse`), `GET /` (200 `{ students: await listStudents(db) }`), `POST /:id/deactivate` (не uuid — 404 `not_found` без запроса; `not_found` — 404; `deactivated` — 200 `DeactivateStudentResponse`).
- `routes/auth.ts`: `POST /change-password` переводит исходы `changePassword(db, signIn, { account, currentPassword, newPassword, ip: clientIp(c, production) })` в 204 + cookie, 400 «Wrong current password», 400 «Choose a password different from the current one», 429/503 через `refusalResponse`.
- `app.ts`: монтирование `/students` сразу после `/auth`.

## Проверки (вывод дословно, без паролей и токенов)

Скрипт `scratchpad/18-12-routes.mjs` поднимает api из исходников (`node --env-file=.env.test apps/api/src/server.ts`, env без DATABASE_URL и MIGRATOR_DATABASE_URL, NODE_ENV=test, PORT=4112, APP_ORIGIN=http://127.0.0.1:4112), деактивирует активных учителей dvlab_test через `18-sql.mjs` (роль migrator), создаёт `teacher@example.test` через `bootstrap-teacher.ts --password-stdin`, входит через `POST /auth/sign-in` с `X-Forwarded-For` из 198.51.100.0/24; ученики `v1812.*`. В начале и в конце удаляет строки учеников `v1812%`, их сессии и ключи ограничения попыток (свои и учителя), в конце деактивирует учителя, удаляет его сессии, останавливает api SIGTERM и проверяет порт. Аргумент — номер последней части (1, 2, без аргумента все три).

После задачи 1 (`node 18-12-routes.mjs 1`, повтор после коммита `7c6ee6f` как tracer-проверка с тем же итогом):
```
setup note active teachers of dvlab_test deactivated (rowCount=0)
setup PASS teacher created by bootstrap-teacher --password-stdin and signed in through POST /auth/sign-in (cli=0 signIn=200 role=teacher)
1.1 PASS POST /students with an empty password: 201, StudentRow with status active, 12-char generatedPassword, no-store (status=201 keys=createdAt,displayName,id,login,status generatedLength=12 cache=no-store)
1.2 PASS POST /auth/sign-in with the student login and the generated password: 200, role student (status=200 role=student)
end PASS api stopped and port 4112 is free (exit={"code":0,"signal":null} free=true)
cleanup teacher deactivated=1 v1812 students left=0
STUDENT_ROUTES_OK
```

После задачи 3 (`node 18-12-routes.mjs`, все три части; части 1-2 совпадают с прогоном после задачи 2):
```
setup note active teachers of dvlab_test deactivated (rowCount=0)
setup PASS teacher created by bootstrap-teacher --password-stdin and signed in through POST /auth/sign-in (cli=0 signIn=200 role=teacher)
1.1 PASS POST /students with an empty password: 201, StudentRow with status active, 12-char generatedPassword, no-store (status=201 keys=createdAt,displayName,id,login,status generatedLength=12 cache=no-store)
1.2 PASS POST /auth/sign-in with the student login and the generated password: 200, role student (status=200 role=student)
2.1 PASS GET /students: 200 { students }, StudentRow keys only, no password, passwordHash, authEpoch or generatedPassword, generated password absent from the body (status=200 rows=1 own=1 keySets=createdAt,displayName,id,login,status leaked=false)
2.2 PASS student v1812.b with an own 12-char password: 201 and generatedPassword null, signs in with it (status=201 generatedPassword=null signIn=200)
2.3 PASS repeated login (any case): 409 login_taken "This login is already taken"; body without displayName, a bad login or a 9-char password: 400 invalid_request (repeat=409/login_taken noName=400 badLogin=400 shortPassword=400)
2.4 PASS POST /students/:id/deactivate for v1812.a: 200 { student } deactivated; its cookie on /auth/me gives 401; list shows deactivated; generated password no longer signs in (meBefore=200 deactivate=200 status=deactivated meAfter=401 listStatus=deactivated signInAfter=401)
2.5 PASS deactivate the teacher id, a random uuid, not-a-uuid and an already deactivated student: 404 not_found; teacher session still alive (teacher=404/not_found random=404/not_found notUuid=404/not_found again=404 teacherMe=200)
2.6 PASS student cookie on GET /students, POST /students and deactivate: 403 forbidden; no cookie: 401 unauthenticated; all no-store (studentList=403 studentCreate=403 studentDeactivate=403 anonymousList=401 anonymousCreate=401)
2.6a PASS refused requests created or deactivated nothing (strayRows=0 bStatus=active)
2.7 PASS api stdout: no student password (own or generated) and no request body (secretsChecked=4 leaked=0)
3.1 PASS two teacher sessions; POST /auth/change-password: 204 with a new __Host- cookie (HttpOnly, Secure, Max-Age=2592000) that gives 200 on /auth/me; both old cookies give 401 (second=200 change=204 newTokenLength=43 meNew=200 meOld1=401 meOld2=401)
3.2 PASS old password no longer signs in, the new one does (old=401 new=200)
3.3 PASS wrong current password: 400 wrong_current_password "Wrong current password"; after five from one X-Forwarded-For the sixth sign-in with the right password from it is 429 locked, change-password from it is 429 locked with Retry-After; current session alive; throttle rows removed (five=400/wrong_current_password,400/wrong_current_password,400/wrong_current_password,400/wrong_current_password,400/wrong_current_password sixthSignIn=429/locked lockedChange=429/locked Retry-After=900 meDuringLock=200 throttleRowsRemoved=2 afterRemoval=200)
3.4 PASS new password equal to the current one: 400 password_unchanged "Choose a password different from the current one", session stays (status=400/password_unchanged me=200)
3.5 PASS new password of 9 characters or a non-JSON body: 400 invalid_request (short=400/invalid_request notJson=400/invalid_request)
3.6 PASS student session on /auth/change-password: 403 forbidden; no cookie: 401; foreign Origin: 403 forbidden_origin; teacher session unchanged (student=403/forbidden anonymous=401 foreignOrigin=403/forbidden_origin me=200)
3.7 PASS api stdout: no change-password password (current, new or wrong) and no student password; sign-in refused lines without login (secretsChecked=22 leaked=0 refusedLines=3)
end PASS api stopped and port 4112 is free (exit={"code":0,"signal":null} free=true)
cleanup teacher deactivated=1 v1812 students left=0
STUDENT_ROUTES_OK
```
В 3.3 шестой запрос смены пароля с верным текущим паролем с заблокированного адреса проверяет ветку `refusalResponse` (429 `locked`, `Retry-After` равен `retryAfterSeconds`); затем ключи ограничения учителя для этого адреса удалены через `18-sql.mjs` (`rowCount=2`: ключ пары и ключ логина).

Остальное:
- `yarn workspace @dv-lab/api typecheck` — код 0 после каждой задачи.
- `yarn prettier --check` для трёх файлов — `All matched files use Prettier code style!`.
- `yarn workspace @dv-lab/api build` — `✔ Build complete` (после задачи 3; dist теперь содержит и `--reset-password` из 18-10).
- `yarn workspace @dv-lab/api test` — `Test Files 7 passed (7)`, `Tests 47 passed (47)`.
- Критерии приёмки: `git grep --untracked -n "code: " -- apps/api/src` — только `request-context.ts` и две строки параметров `lifecycle.ts` фазы 17 (как в 18-09); `grep -cE "passwordHash|authEpoch|password_hash|auth_epoch" routes/students.ts` — 0; `grep -A3 "change-password" routes/auth.ts` — `requireRole('teacher')` в строке маршрута.
- `lsof -iTCP:4112 -sTCP:LISTEN` — пусто.

## Task Commits

1. **Задача 1: POST /students и монтирование группы** - `7c6ee6f` (feat)
2. **Задача 2: список, деактивация с проверкой uuid** - `db44336` (feat)
3. **Задача 3: POST /auth/change-password** - `608cfd9` (feat)

**Plan metadata:** коммит `docs(18-12)` с этим файлом.

`commits: 3` — коммиты `(18-12)` в `git log fac8522..HEAD`; в диапазон попал коммит параллельного плана 18-13 `8bf4cca`.

## Files Created/Modified

- `apps/api/src/routes/students.ts` - маршруты /students, /students/:id/deactivate
- `apps/api/src/routes/auth.ts` - маршрут /auth/change-password
- `apps/api/src/app.ts` - монтирование /students

## Decisions Made

См. `key-decisions` во frontmatter. Для следующих планов:
- 18-14 (экраны): `POST /students` с `password: ''` или `null` выдаёт `generatedPassword` из 12 символов, со своим паролем — `null`; логин нормализуется контрактом (повтор `V1812.B` даёт 409). Деактивация отвечает `{ student }` со статусом `deactivated`; повтор — 404. Смена пароля отвечает 204 без тела и ставит новую cookie; страница должна продолжать работу без повторного входа.
- 18-15 (ручной список): пять неверных текущих паролей в диалоге смены закрывают вход учителя с этого адреса на 15 минут (общий счётчик с входом, 429 `locked`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Дисциплина плана] Коммиты задач вместо «Не коммитить»**
- **Found during:** задачи 1-3
- **Issue:** действия задач заканчиваются «Не коммитить», общие правила фазы 18 требуют коммит каждой задачи.
- **Fix:** по коммиту на задачу, пути явные.
- **Commits:** `7c6ee6f`, `db44336`, `608cfd9`

**2. [Rule 3 - Среда] Части скрипта по аргументу и отдельные команды**
- **Found during:** задачи 1-2
- **Issue:** `<automated>` задач 1 и 2 вызывает полный скрипт, части которого до задачи 3 не пройдут; хук изоляции отклоняет `&&`.
- **Fix:** скрипт принимает номер последней части (`1`, `2`), без аргумента выполняет все; typecheck, скрипт, build и test запускались отдельными командами.

### Проверки сверх плана (без изменения поведения)

- 2.3: логин в другом регистре, неверный логин и пароль из 9 символов при создании; 2.5: повторная деактивация; 2.6: `POST /students` и деактивация с cookie ученика, `POST /students` без cookie, no-store на 401 и 403; 2.6a: отказы ничего не создали и не деактивировали.
- 3.3: смена пароля с заблокированного адреса — 429 `locked` через `refusalResponse`; 3.5: тело не JSON; 3.6: смена без cookie и с чужим Origin.

---

**Total deviations:** 2 (1 организационное, 1 по среде проверки)
**Impact on plan:** интерфейсы и поведение совпадают с планом.

## Known Stubs

None.

## Threat Flags

None: новые точки `/students*` и `/auth/change-password` описаны в модели угроз плана (T-18-42..T-18-45).

## Issues Encountered

- Ошибок typecheck от параллельного 18-13 не было.
- В рабочем дереве есть неотслеживаемый `apps/web/AGENTS.md` (не из этого плана, вне `files_modified`), не трогал.
- `yarn knip` не запускался (красный до 18-16 по общим правилам); скрипта `lint` у api нет.

## User Setup Required

None.

## Next Phase Readiness

- 18-14: маршруты `/students`, `/students/:id/deactivate`, `/auth/change-password` проверены против api из исходников на dvlab_test.
- В dvlab_test после прогона активного учителя нет (`teacher@example.test` деактивирован), строк `v1812%` нет.

## Self-Check: PASSED

- `apps/api/src/routes/students.ts` на диске, экспорт `studentRoutes` есть; `/auth/change-password` в `routes/auth.ts`; `/students` смонтирован в `app.ts`.
- Коммиты `7c6ee6f`, `db44336`, `608cfd9` есть в `git log`.
- `STUDENT_ROUTES_OK`, typecheck, build и 47 тестов api зелёные; порт 4112 свободен.

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-09*
