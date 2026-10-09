---
phase: 18-accounts-and-variant-a-shell
plan: 04
subsystem: auth
tags: [scrypt, node-crypto, passwords, ielts-compat]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "@dv-lab/contracts: GENERATED_PASSWORD_LENGTH (18-01)"
provides:
  - "apps/api/src/auth/passwords.ts: hashPassword, verifyPassword, verifyDummyPassword, generatePassword"
  - "строка хэша scrypt$N=32768,r=8,p=3$<соль 22>$<ключ 43>, совместимая с ielts"
affects: [18-06, 18-07, 18-10, 26]

tech-stack:
  added: []
  patterns:
    - "Правило хэширования паролей живёт только в apps/api/src/auth/passwords.ts; параметры scrypt хранятся в строке хэша"

key-files:
  created:
    - apps/api/src/auth/passwords.ts
  modified: []

key-decisions:
  - "Тестовый файл apps/api/test/auth/passwords.test.ts не создан по прямому указанию координатора: проверка через typecheck, prettier и одноразовый скрипт в scratchpad"
  - "verifyPassword повторяет ielts без try/catch вокруг scrypt: сбои разбора дают false, а внутренняя ошибка scrypt уходит наверх к модулю входа"
  - "isAcceptableManualPassword и MANUAL_PASSWORD_* из ielts не перенесены: пределы уже лежат в @dv-lab/contracts"

requirements-completed: [ACCT-01, ACCT-02, ACCT-05]

actuals:
  tokens: 600
  tasks: 2
  commits: 2

duration: 15min
completed: 2026-10-09
status: complete
plan_head_before: 51f553baab1ab3985f4389297ab7d534796f7bb1
plan_head_after: 836905934fe28b1921e3d2fe5a89ccf1bf486c01
commits: 2
---

# Phase 18 Plan 04: Модуль паролей входа Summary

**Пароли хэшируются scrypt из node:crypto (N=2^15, r=8, p=3, соль 16 байт, ключ 32 байта, maxmem 64 MiB, NFKC) в строку формата ielts; хэш, созданный модулем ielts, проходит verifyPassword dv-lab; есть проверка-пустышка для неизвестного логина и генерация 12-символьных паролей через randomInt.**

## Performance

- **Duration:** около 15 мин
- **Tasks:** 2
- **Files modified:** 1 (создан)

## Accomplishments

- `hashPassword(password)` возвращает `scrypt$N=32768,r=8,p=3$<соль base64url>$<ключ base64url>`, `maxmem` передаётся в каждый вызов scrypt, пароль нормализуется NFKC.
- `verifyPassword(password, storedHash)` разбирает строку шаблоном `/^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/`, отвергает параметры вне проверки разумности (N >= 2^14, степень двойки, r >= 8, 1 <= p <= 16, 128·N·r < 64 MiB) и сравнивает ключи через `timingSafeEqual`.
- `verifyDummyPassword(password)` считает проверку против хэша-пустышки, промис которого хранится в замыкании модуля и сбрасывается при ошибке (D-10), всегда возвращает `false`.
- `generatePassword()` даёт `GENERATED_PASSWORD_LENGTH` (12, из `@dv-lab/contracts`) символов алфавита `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789` через `randomInt` (D-06).
- Импорты модуля: только `node:crypto` и `@dv-lab/contracts`; нативных пакетов хэширования нет, комментариев нет.

## Task Commits

1. **Задача 1: хэш и проверка в формате ielts** - `486d883` (feat)
2. **Задача 2: проверка-пустышка и генерация пароля** - `8369059` (feat)

**Plan metadata:** коммит `docs(18-04)` с этим файлом.

`commits: 2` посчитан как `git log --oneline 51f553b..HEAD` с фильтром по `(18-04)`: в тот же диапазон попал параллельный коммит плана 18-05 `4f4933e`, поэтому полный `rev-list --count` (3) больше числа коммитов этого плана.

## Проверка

Одноразовый скрипт `scratchpad/18-04-check.mjs` импортирует `apps/api/src/auth/passwords.ts` напрямую под Node 24. Фикстура ielts получена один раз скриптом `scratchpad/18-04-ielts-fixture.mjs` вызовом `hashPassword('fixture-password-1')` модуля `/Volumes/T7/personal/ielts/src/lib/auth/passwords.ts` (тестовый пароль, не секрет). Вывод последнего прогона после задачи 2:

```
PASS hash has format scrypt$N=32768,r=8,p=3$<22>$<43>
PASS two hashes of the same password differ
PASS hash then verify gives true
PASS wrong password gives false
PASS ielts fixture hash verifies with fixture-password-1
PASS ielts fixture hash rejects another password
PASS NFKC: fullwidth hash verifies plain password
PASS NFKC: plain hash verifies fullwidth password
PASS malformed (empty string) gives false without throwing
PASS malformed (bcrypt string) gives false without throwing
PASS malformed (N=1024) gives false without throwing
PASS malformed (N not a power of two) gives false without throwing
PASS malformed (r=4) gives false without throwing
PASS malformed (p=17) gives false without throwing
PASS malformed (p=0) gives false without throwing
PASS malformed (128*N*r above maxmem) gives false without throwing
PASS malformed (salt one char short) gives false without throwing
PASS malformed (key one char short) gives false without throwing
PASS malformed (trailing newline) gives false without throwing
PASS verifyDummyPassword gives false
PASS dummy time 118 ms >= half of real 117 ms
PASS 200 generated passwords: 12 chars from the readable alphabet
PASS 200 generated passwords are all distinct
exports generatePassword,hashPassword,verifyDummyPassword,verifyPassword
total 23, failed 0
```

Остальное:
- `yarn workspace @dv-lab/api typecheck` — чисто после каждой задачи.
- `yarn prettier --check --config .prettierrc.json apps/api/src/auth/passwords.ts` — чисто.
- `grep -nE "^import|//|/\*" apps/api/src/auth/passwords.ts` — три строки импорта (`node:crypto` дважды, `@dv-lab/contracts`), комментариев нет.
- Lint: у `@dv-lab/api` нет скрипта `lint` (turbo `lint` есть только у web), поэтому ESLint для файла не запускался.

## Decisions Made

- Модуль перенесён из ielts без изменения значений и формата строки; `isAcceptableManualPassword` и `MANUAL_PASSWORD_*` не перенесены, потому что эти пределы уже экспортирует `@dv-lab/contracts`.
- `verifyPassword` не перехватывает исключения scrypt, как в ielts: искажённая строка отсекается шаблоном и проверкой параметров до вызова scrypt, а реальная ошибка вычисления не маскируется под неверный пароль.
- Предел длины пароля входа 1024 символа (`SIGN_IN_PASSWORD_MAX_LENGTH`) проверяется схемой `signInRequest` контракта (18-01) и модулем входа (18-06), модуль паролей его не дублирует.

## Deviations from Plan

### Указание координатора

**1. Тесты vitest не написаны, протокол RED/GREEN пропущен**
- **Found during:** начало задачи 1
- **Issue:** Координатор отдал прямое указание владельца для плана 18-04: новых unit/integration/e2e тестов не писать, проверять модуль typecheck, lint и одноразовым скриптом в scratchpad, коммиты задач с `feat(18-04):`.
- **Fix:** Артефакт `apps/api/test/auth/passwords.test.ts` и фикстура ielts в нём не созданы; все семь поведений плана (и сверх них NFKC в обе стороны, p=0, N не степень двойки, превышение maxmem, перевод строки в конце) проверены скриптом `18-04-check.mjs`, вывод выше. Коммитов `test(18-04)` нет.
- **Files modified:** нет
- **Verification:** 23 проверки скрипта PASS, typecheck чистый.

### Auto-fixed Issues

None.

**Total deviations:** 1 (по указанию координатора)
**Impact on plan:** Код модуля совпадает с планом; регрессионной защиты в `yarn workspace @dv-lab/api test` для модуля паролей нет, совместимость с ielts и формат строки сейчас подтверждены только разовым прогоном скрипта.

## TDD Gate Compliance

План помечен `type: tdd`, но по прямому указанию координатора RED/GREEN не выполнялся: коммитов `test(18-04)` нет, есть два `feat(18-04)`. Это сознательное отступление, а не пропуск.

## Issues Encountered

- Сброс промиса пустышки при ошибке первого вычисления (D-10) проверен только чтением кода: вызвать сбой `hashPassword` без подмены `node:crypto` нельзя, а моков по указанию не писали.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 18-06 (вход): `verifyPassword` для известного логина, `verifyDummyPassword` для неизвестного; ограничение длины 1024 и очередь scrypt остаются за модулем входа (T-18-11).
- 18-07 и 18-10: `hashPassword` и `generatePassword` готовы.
- Фаза 26: строки хэшей ielts проходят `verifyPassword` без преобразования.

## Self-Check: PASSED

- `apps/api/src/auth/passwords.ts` существует, экспортирует четыре функции.
- Коммиты `486d883` и `8369059` есть в `git log`.

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-09*
