---
phase: 19-student-cards-and-vault-import
plan: 03
subsystem: contracts
tags: [zod, contracts, students, payments, validation]

requires:
  - phase: 19-student-cards-and-vault-import
    provides: пакет @dv-lab/core и зависимости web (план 19-01)
provides:
  - предикат isDisplayNameLength в identity.ts как единственный источник правила длины имени
  - коды 409 card_has_account, account_already_linked, term_exists, payment_already_assigned
  - константы SECTION_KINDS, CURRENCIES, STUDENT_STATUSES, PAYMENT_SOURCES и пределы полей
  - zod-схемы запросов карточки, открывающего остатка, секций, словаря, оплат и аккаунта карточки
  - типы ответов секций, словаря и оплат
affects: [19-05, 19-07, 19-08, 19-09, 19-10, 19-11, 19-12, 19-13, 19-14, 19-15, 19-16, 19-17, 19-18]

actuals:
  tokens: 3800
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "optionalText(max): пустая строка и undefined превращаются в null, длина в кодовых точках"
    - "Деньги и уроки на границе только целые: amountMinor и lessonsHundredths с верхними пределами"

key-files:
  created:
    - packages/contracts/src/students.ts
  modified:
    - packages/contracts/src/identity.ts
    - packages/contracts/src/auth.ts
    - packages/contracts/src/index.ts
    - packages/contracts/test/auth.test.ts

key-decisions:
  - "isIsoDate сверяет дату через setUTCFullYear и обратное чтение года, месяца и дня, чтобы годы меньше 100 не сдвигались"
  - "Схема термина нормализуется той же normalizeDisplayName (trim и схлопывание пробелов)"

requirements-completed: [CARD-01, CARD-02, CARD-03, CARD-07, ACCT-04, LEDG-01, LEDG-09]

plan_head_before: 5f3010625362ebfbd657ab45eb7cb6829fb74965
plan_head_after: b9d74f6
duration: 12min
completed: 2026-10-10
status: complete
---

# Phase 19 Plan 03: контракт карточек, секций, словаря и оплат Summary

**Общий контракт web и api фазы 19: один предикат имени, список валют RUB/KZT/USD/EUR, шесть видов секций, zod-схемы всех запросов фазы и четыре новых кода 409.**

## Performance

- **Duration:** около 12 мин
- **Tasks:** 2
- **Files modified:** 6 (1 создан, 5 изменены)

## Accomplishments

- `isDisplayNameLength` переехал из `auth.ts` в `identity.ts` и экспортируется; `createStudentRequest` и `saveStudentRequest` используют один предикат (D-41).
- `errorCodes` дополнен четырьмя кодами сразу после `password_unchanged`; существующий тест списка обновлён тем же списком (D-38).
- `createStudentAccountRequest = createStudentRequest.omit({ displayName: true })` (D-04).
- `students.ts`: константы, предикаты `isTimeZone` (через `Intl`) и `isIsoDate`, схемы `saveStudentRequest`, `openingBalanceRequest`, `saveSectionRequest`, `addTermRequest`, `updateTermNoteRequest`, `recordPaymentRequest`, `assignPaymentRequest`, `linkStudentAccountRequest`, `deactivateStudentAccountRequest`, типы ответов секций, словаря и оплат.
- Типы `StudentRow`, `StudentListResponse`, `CreateStudentResponse`, `DeactivateStudentResponse` не тронуты (D-40, их меняют 19-07, 19-11, 19-18).

## Task Commits

1. **Задача 1: общий предикат имени и коды 409, тест errorCodes** - `90e57c5` (feat)
2. **Задача 2: students.ts и экспорт из index.ts** - `b9d74f6` (feat)

## Files Created/Modified

- `packages/contracts/src/students.ts` - константы, предикаты, схемы запросов и типы ответов карточек, секций, словаря, оплат
- `packages/contracts/src/identity.ts` - `isDisplayNameLength`
- `packages/contracts/src/auth.ts` - импорт предиката, новые коды 409, `createStudentAccountRequest`
- `packages/contracts/src/index.ts` - `export * from './students.ts'`
- `packages/contracts/test/auth.test.ts` - в списке `errorCodes` четыре добавленные строки, ничего не удалено

## Проверка

- `yarn workspace @dv-lab/contracts typecheck` - код 0 (после Prettier повторно).
- `yarn workspace @dv-lab/contracts test` - 48 тестов в 2 файлах прошли.
- `git show --numstat` по `auth.test.ts` после задачи 1: 4 добавлено, 0 удалено.
- `SCRATCH/19-03-contracts.mjs` печатает `CONTRACTS_OK`: все образцы плана приняты и отвергнуты как задумано; дополнительно проверено отбрасывание лишних ключей (`status`, `importKey`, `creditedMinutes`, `source`, T-19-06), дробные и переполняющие значения (T-19-07), пределы длин (T-19-08), 29 февраля високосного года.
- Граница пакета: `git grep` по `pg`, `node:*`, `@dv-lab/*`, `process.env` в `packages/contracts/src` пуст; зависимости пакета - только `zod`.
- `prettier --check` по `packages/contracts/src` и `test` - чистый после `--write` для `students.ts`.

Не запускалось: lint, build, knip (ожидаемо красный до 19-19), api и web typecheck (потребители контракта появляются в других планах; старые типы не менялись).

## Decisions Made

- `isIsoDate` использует `setUTCFullYear`, а не `Date.UTC`, чтобы годы 0-99 не превращались в 1900-1999.
- `rateMinor`, `currency` в `saveStudentRequest` принимают `null`, но не `undefined`: PATCH присылает полный объект; `parent`, `level`, `goals`, `timeZone` принимают и `undefined`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Prettier переформатировал `students.ts` после первой версии, поведение не менялось.

## Threat Flags

None.

## Known Stubs

None.

## Next Phase Readiness

Контракт готов для 19-05 (база), 19-07..19-18 (маршруты и экраны). Названия экспортов добавлены в `packages/contracts/src/index.ts` через `students.ts`.

## Self-Check: PASSED

- `packages/contracts/src/students.ts` существует; коммиты `90e57c5` и `b9d74f6` найдены в `git log`.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
