---
phase: 18-accounts-and-variant-a-shell
plan: 06
subsystem: auth
tags: [sign-in, sessions, throttle, scrypt, drizzle, postgres, housekeeping]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-01 @dv-lab/contracts (AccountSummary, StudentRow, SESSION_*, normalizeLogin, пределы длины); 18-02 таблицы accounts, sessions, sign_in_throttles и помощник 18-sql.mjs; 18-04 verifyPassword и verifyDummyPassword"
provides:
  - "apps/api/src/auth/sign-in.ts: createSignIn({ db, logger, requireClientIp }) -> { attempt, verifyCredentials }, типы SignIn, SignInOutcome, CredentialCheck, SignInAttempt, CredentialInput"
  - "apps/api/src/auth/throttle.ts: MAX_PAIR_FAILURES, MAX_LOGIN_FAILURES, WINDOW_SECONDS, LOCK_SECONDS, ipBucket, reserveSignInAttempt, settleSignInSuccess, pruneSignInThrottles, типы ThrottleKeys и SignInReservation"
  - "apps/api/src/auth/sessions.ts: DbExecutor, SessionView, hashSessionToken, issueSession, readSession, renewSession, deleteSession, revokeAccountSessions, pruneExpiredSessions"
  - "apps/api/src/auth/account-rows.ts: accountSummaryColumns, toAccountSummary, studentRowColumns, toStudentRow"
  - "apps/api/src/auth/housekeeping.ts: createHousekeeping({ db, logger, intervalMs }) -> { name, start, runOnce, close }, тип Housekeeping"
affects: [18-09, 18-10, 18-12, 18-15]

tech-stack:
  added: []
  patterns:
    - "Порядок попытки входа (допуск, счётчик FOR UPDATE, слот scrypt, проверка, сессия, сброс счётчика) живёт в одной внутренней функции run модуля sign-in.ts; attempt и verifyCredentials отличаются только условием на найденный аккаунт и завершающим шагом"
    - "Очереди допуска и scrypt создаются фабрикой createGate внутри createSignIn: у каждого экземпляра свои счётчики, на уровне модуля состояния нет"
    - "Эпоха аккаунта повышается только в revokeAccountSessions; отображение строк accounts только в account-rows.ts"

key-files:
  created:
    - apps/api/src/auth/account-rows.ts
    - apps/api/src/auth/throttle.ts
    - apps/api/src/auth/sessions.ts
    - apps/api/src/auth/sign-in.ts
    - apps/api/src/auth/housekeeping.ts
  modified: []

key-decisions:
  - "Модуль входа сам отклоняет пустой логин или пароль и длину выше LOGIN_MAX_LENGTH и SIGN_IN_PASSWORD_MAX_LENGTH исходом invalid_credentials без базы и scrypt: предел 1024, обещанный в 18-04, держит и модуль, не только схема маршрута"
  - "verifyCredentials при успехе тоже снимает счётчики пары и логина (владелец доказал пароль), сессию не открывает; аккаунт с тем же логином, но другим id идёт путём пустышки и даёт invalid_credentials"
  - "Строки ограничения читаются сырым SQL select ... for update (как в ielts), а не .for('update') Drizzle: в том же запросе считаются locked, remaining и expired по часам базы"
  - "retryAfterSeconds = max(1, ceil(locked_until - now())) по всем закрытым строкам; закрытая попытка не увеличивает ни один счётчик"
  - "readSession, renewSession и deleteSession принимают string | null | undefined, чтобы маршрут передавал значение cookie как есть; токен вне SESSION_TOKEN_PATTERN не доходит до базы"
  - "revokeAccountSessions бросает Error('account not found'), если строки аккаунта нет: вызывающий (18-10) блокирует аккаунт в той же транзакции до вызова"
  - "housekeeping.runOnce не запускает второй прогон, пока идёт первый; ошибка любого шага пишется logger.warn({ err }, 'housekeeping failed'); start после close ничего не делает"

requirements-completed: [ACCT-01, ACCT-02, ACCT-03]

actuals:
  tokens: 3941
  tasks: 2
  commits: 2

duration: 25min
completed: 2026-10-09
status: complete
plan_head_before: bff0a561931346f356e1399b1d595b579484abdd
plan_head_after: 9b7d38472e217a1f9f5c9198ee204dea5328c356
commits: 2
---

# Phase 18 Plan 06: Модуль входа и сессий в apps/api Summary

**Попытка входа одним вызовом `createSignIn().attempt`: допуск 4/8 и слот scrypt 2/8 в замыкании, счётчики пары (5, IPv6 по /64) и логина (20) под `FOR UPDATE` до проверки пароля, одинаковый `invalid_credentials` для неверного пароля, неизвестного и деактивированного логина, сессия с sha256 токена 32 байт и эпохой аккаунта; плюс чтение, продление и отзыв сессий, проверка учётных данных для смены пароля и фоновая очистка как `Closable`.**

## Performance

- **Duration:** около 25 мин
- **Completed:** 2026-10-09
- **Tasks:** 2
- **Files modified:** 5 (созданы)

## Accomplishments

- `sign-in.ts`: `createSignIn({ db, logger, requireClientIp })` возвращает `{ attempt, verifyCredentials }`. Порядок в одной внутренней функции `run`: нормализация логина, `unavailable` без адреса при `requireClientIp`, отказ по длине, допуск (4 одновременных, 8 в очереди, иначе `busy`), `reserveSignInAttempt` (`locked` сразу), слот scrypt (2 и 8), чтение активного аккаунта, `verifyPassword` или `verifyDummyPassword`, завершающий шаг (сессия или данные для смены пароля), `settleSignInSuccess` в try/catch с `logger.warn({ err }, 'sign-in throttle settle failed')`. Допуск и слот освобождаются в `finally` на всех путях. Исходы различаются полем `kind`; поля `code` нет.
- `throttle.ts`: перенос ielts с ключами `sha256(login + "\n" + bucket)` и `sha256('login:' + encodeURIComponent(login))`, порядок блокировки «логин, потом пара», окно истекло при `window_started_at <= now() - 900 s`, блокировка `now() + 900 s` на 5-й (пара) и 20-й (логин) неудаче, без адреса `{ kind: 'unthrottled' }` без записи; `pruneSignInThrottles` удаляет строки с истёкшим окном и без действующей блокировки.
- `sessions.ts`: `DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0]`; токен `randomBytes(32).toString('base64url')`, в базе только sha256; `readSession` одним запросом с `expires_at > now()`, `status = 'active'`, равенством эпох и `renewDue` в SQL (`expires_at < now() + 29 суток`); `renewSession` ставит `now() + 30 суток` только непросроченной; `revokeAccountSessions` повышает `auth_epoch` и удаляет все сессии аккаунта в переданном исполнителе.
- `account-rows.ts`: столбцы и функции отображения в `AccountSummary` и `StudentRow`; роль и статус сужаются проверкой, неизвестное значение бросает ошибку.
- `housekeeping.ts`: `createHousekeeping({ db, logger, intervalMs = 900000 })` с `start` (setInterval + unref), `runOnce`, `close` (снимает интервал и ждёт текущий прогон), `name: 'housekeeping'` — подходит под `Closable` из `lifecycle.ts`.

## Проверки (вывод дословно)

Скрипты: `scratchpad/18-06-common.mjs` (общая часть: env из `.env.test` через `util.parseEnv`, `resolveDatabaseUrl('app', { NODE_ENV: 'test', ... })`, `createDb`, логгер `createLogger('warn')` в поток-заглушку, засев учеников `v1806-<run>-<tag>` через `hashPassword`, деактивация и старение строк только через `18-sql.mjs`, очистка своих строк в начале и в конце), `scratchpad/18-06-sign-in.mjs`, `scratchpad/18-06-sessions.mjs`, `scratchpad/18-06-checks.sh`. База dvlab_test. После прогонов строк `v1806-%` в accounts и sessions нет (`{"accounts":"0","sessions":"0"}`).

`node scratchpad/18-06-sign-in.mjs` (последний прогон, после задачи 2):
```
1 PASS correct password gives ok, 43-char base64url token, one session row with sha256 hash, raw token stored nowhere (kind=ok sessions=1 rawMatches=0)
2 PASS wrong password gives invalid_credentials and no new session (kind=invalid_credentials sessions=1)
3 PASS ipBucket: /64 shared, other /64 differs, IPv4-mapped is IPv4 (2001:db8:0:0::/64 2001:db8:0:0::/64 2001:db8:0:1::/64 203.0.113.5)
4 PASS five wrong from one address: fifth invalid_credentials, sixth with correct password locked 1..900 s (kinds=invalid_credentials,invalid_credentials,invalid_credentials,invalid_credentials,invalid_credentials sixth=locked retryAfter=900)
5 PASS after four wrong the correct password gives ok and removes both throttle rows (before=4 kind=ok loginRow=gone pairRow=gone)
6 PASS 20 wrong from 20 addresses lock the login: correct password from a 21st address is locked (invalid=20 loginCount=20 twentyFirst=locked)
7 PASS unknown login gives invalid_credentials and creates throttle rows (kind=invalid_credentials loginCount=1 pairCount=1)
8 PASS deactivated account with correct password gives invalid_credentials (kind=invalid_credentials)
9 PASS 2001:db8::1 and 2001:db8::2 share one pair counter (pairCount=2)
10 PASS after aging by 901 s the locked pair admits the attempt and it counts as the first in a new window (beforeAging=locked after=invalid_credentials pairCount=1 loginCount=1)
11 PASS no address: attempt is not counted; requireClientIp true gives unavailable (kind=invalid_credentials rows=0 strictNull=unavailable strictEmpty=unavailable)
12 PASS 20 concurrent wrong attempts on one pair: at most five invalid_credentials, the rest locked or busy (counts={"invalid_credentials":5,"locked":7,"busy":8} pairCount=5)
SIGN_IN_OK
```
Проверка 1 передаёт логин в верхнем регистре с пробелами по краям: нормализация в модуле работает.

`node scratchpad/18-06-sessions.mjs`:
```
1 PASS fresh session: readSession gives the account and renewDue false (account=found renewDue=false)
2 PASS readSession gives null for expired session, deactivated account, mismatched epoch and malformed token (expired=null deactivated=null epoch=null short=null badChars=null empty=null)
3 PASS expires in 28 days: renewDue true; renewSession true sets 30 days and renewDue false; expired session is not renewed (dueBefore=true renewed=true dueAfter=false secondsLeft=2592000 renewExpired=false)
4 PASS deleteSession removes only its own session (dropped=true kept=true)
5 PASS revokeAccountSessions in a transaction raises the epoch by 1 and removes all sessions of the account, another account keeps its session (epoch 0->1 db=1 sessionsLeft=0 other=alive)
6 PASS verifyCredentials: ok with passwordHash and authEpoch for the correct password, invalid_credentials for a wrong one which creates a throttle row (ok=ok epoch=0 sessions=0 wrong=invalid_credentials pairCount=1 otherAccountId=invalid_credentials)
7 PASS housekeeping.runOnce removes the expired session and the stale throttle rows and keeps live ones; the interval prunes while started and never after close (staleRowsLeft=0 freshRowsLeft=2 expiredSession=gone liveSession=kept prunedWhileStarted=true keptAfterClose=true warnings=0)
SESSIONS_OK
```
Проверка 7 «после close интервал не срабатывает» сделана через базу, а не счётом вызовов prune: экземпляр с `intervalMs: 50` после `start` убирает вставленную устаревшую строку за 200 мс (положительный контроль), после `close` такая же строка остаётся через 200 мс.

`bash scratchpad/18-06-checks.sh task2` (критерии приёмки обеих задач):
```
PASS no module-level let/var in sign-in, throttle, sessions, account-rows
PASS thresholds 5 and 20
--- git grep 'code: ' apps/api/src
apps/api/src/lifecycle.ts:12:	close: (code: number, reason: string) => unknown
apps/api/src/lifecycle.ts:36:	exit: (code: number) => void
apps/api/src/request-context.ts:49:export const errorBody = (code: string, message: string) => ({
PASS code: only in request-context.ts and phase 17 lifecycle.ts parameter names, none in apps/api/src/auth
--- git grep epoch increments
apps/api/src/auth/sessions.ts:82:		.set({ authEpoch: sql`${accounts.authEpoch} + 1`, updatedAt: sql`now()` })
PASS epoch increment only in sessions.ts
--- git grep 'displayName: row'
apps/api/src/auth/account-rows.ts:32:	return { id: row.id, login: row.login, displayName: row.displayName, role: toRole(row.role) }
apps/api/src/auth/account-rows.ts:41:		displayName: row.displayName,
PASS row mapping only in account-rows.ts
PASS no module-level let/var in housekeeping
--- comments in plan files
PASS no comments
Checking formatting...
All matched files use Prettier code style!
```

`yarn workspace @dv-lab/api typecheck` — код 0 после каждой задачи и перед вторым коммитом.

Tracer-проверка задачи 1: после коммита `a920778` typecheck и `18-06-sign-in.mjs` прогнаны ещё раз (`SIGN_IN_OK`), затем начата задача 2.

## Task Commits

1. **Задача 1: попытка входа, счётчик, слот scrypt, сессия, пороги 5 и 20** - `a920778` (feat)
2. **Задача 2: чтение, продление и отзыв сессий, verifyCredentials, фоновая очистка** - `9b7d384` (feat)

**Plan metadata:** коммит `docs(18-06)` с этим файлом.

`commits: 2` — коммиты `(18-06)` в `git log bff0a56..HEAD`; в тот же диапазон попали коммиты параллельного плана 18-11 (`7519235`, `9775bc1`, `88f7208`, `f8c5fe8`).

## Files Created/Modified

- `apps/api/src/auth/account-rows.ts` - отображение строк accounts в AccountSummary и StudentRow
- `apps/api/src/auth/throttle.ts` - ограничение попыток по паре и логину, очистка устаревших строк
- `apps/api/src/auth/sessions.ts` - выдача, чтение, продление, удаление и отзыв сессий, очистка просроченных
- `apps/api/src/auth/sign-in.ts` - попытка входа и проверка учётных данных с очередями в замыкании
- `apps/api/src/auth/housekeeping.ts` - интервальная очистка как ресурс lifecycle

## Decisions Made

См. `key-decisions` во frontmatter. Главное для следующих планов:
- Маршрут входа (18-09) только переводит `SignInOutcome.kind` в HTTP и коды ошибок контракта (`invalid_credentials`, `locked` с `retryAfterSeconds`, `busy`, `unavailable`); статусы задаёт его план. В production `requireClientIp: true`.
- Смена пароля (18-10) вызывает `verifyCredentials({ accountId, login, password, ip })` с логином из сессии; неверный старый пароль засчитывается в тот же счётчик пары, что и вход (принятое следствие Pattern 2).
- Деактивация (18-10) вызывает `revokeAccountSessions(tx, accountId)` внутри своей транзакции после блокировки строки ученика.
- `createHousekeeping` подключается в server.ts и lifecycle (ресурс перед pg-pool) в 18-09; `start()` вызывает тот, кто создаёт.

## Deviations from Plan

### Auto-fixed Issues

**1. [Дисциплина плана] Коммиты задач вместо «Не коммитить»**
- **Found during:** Задачи 1 и 2
- **Issue:** Действия задач заканчиваются «Не коммитить», а общие правила исполнителей фазы 18 требуют коммит каждой задачи (как в 18-02).
- **Fix:** Каждая задача закоммичена отдельно.
- **Committed in:** `a920778`, `9b7d384`

**2. [Rule 2 - Missing critical] Предел длины логина и пароля в модуле входа**
- **Found during:** Задача 1
- **Issue:** План не называет проверку длины в модуле, а 18-04 записал, что предел 1024 держат и контракт, и модуль входа (T-18-11): без неё вызывающий код, минуя схему, мог бы отдать scrypt пароль любой длины.
- **Fix:** Пустой или длиннее `LOGIN_MAX_LENGTH` логин и пустой или длиннее `SIGN_IN_PASSWORD_MAX_LENGTH` пароль дают `invalid_credentials` до допуска, базы и scrypt.
- **Files modified:** `apps/api/src/auth/sign-in.ts`
- **Committed in:** `a920778`

**3. [Rule 3 - Blocking] Критерий «code: только в request-context.ts» и параметры lifecycle.ts**
- **Found during:** Задача 1
- **Issue:** `git grep "code: " -- apps/api/src` находит ещё две строки `apps/api/src/lifecycle.ts` фазы 17 (`close: (code: number, ...)`, `exit: (code: number)`) — это имена параметров, не поле исхода; файл вне `files_modified`.
- **Fix:** Проверка в `18-06-checks.sh` пропускает эти две строки phase 17 и падает на любом `code: ` в `apps/api/src/auth`; в модуле входа совпадений нет (вывод выше).

**4. [Rule 3 - Blocking] Автоматические проверки через скрипты scratchpad**
- **Found during:** Задачи 1 и 2
- **Issue:** Хук изоляции worktree отклоняет `!`, `&&`-цепочки с переменными и `$(...)`.
- **Fix:** Проверки приёмки вынесены в `18-06-checks.sh` без изменения логики; начальный HEAD записан в `scratchpad/18-06-head-before.txt`.

---

**Total deviations:** 4 (1 организационное, 1 Rule 2, 2 по среде проверки)
**Impact on plan:** Интерфейс и поведение совпадают с планом; добавлена только ранняя проверка длины.

## Issues Encountered

- `yarn workspace @dv-lab/api build`, `test` и `lint` не запускались: сборку api в волне 3 делает только 18-07, своих тестов план не пишет, скрипта `lint` у api нет. Защита пула при потоке попыток с опросом `/healthz` (D-20) проверяется вручную в 18-15: здесь подтверждено только условие проектирования (допуск 4 меньше пула 10, проверка 12 показывает 8 `busy` из 20 одновременных).
- Ошибок typecheck от параллельных планов не было.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 18-09: маршруты `/auth/sign-in`, `/auth/me`, `/auth/renew`, `/auth/sign-out` берут `createSignIn`, `readSession`, `renewSession`, `deleteSession`; housekeeping подключается к lifecycle.
- 18-10: `verifyCredentials`, `revokeAccountSessions`, `studentRowColumns` и `toStudentRow`.
- Логгер: `settleSignInSuccess` и housekeeping пишут `err` целиком; ошибки Drizzle несут текст запроса и параметры (здесь только хэши ключей), редакцию параметров (R5) делает свой план.

## Self-Check: PASSED

- Пять файлов `apps/api/src/auth/{account-rows,throttle,sessions,sign-in,housekeeping}.ts` существуют.
- Коммиты `a920778` и `9b7d384` есть в `git log`.
- `SIGN_IN_OK` и `SESSIONS_OK` получены, typecheck чистый.

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-09*
