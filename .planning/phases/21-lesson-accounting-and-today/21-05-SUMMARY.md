---
phase: 21-lesson-accounting-and-today
plan: 05
subsystem: api, contracts
status: complete
tags: [settings, pays-soon, teacher-settings, api, contracts]
requires: [21-01, 21-02]
provides:
  - "contracts: updateSettingsRequest, SettingsResponse, TeacherSettings, PAYS_SOON_LESSONS_MIN, PAYS_SOON_LESSONS_MAX"
  - "api: readPaysSoonLessons, savePaysSoonLessons (apps/api/src/settings/settings.ts)"
  - "api: GET /settings и PATCH /settings (только учитель)"
  - "scripts/dev-checks/ledger-settings.mjs"
affects: [21-06, 21-07, 21-14, 22]
tech-stack:
  added: []
  patterns: ["порог Pays soon читает одна функция модуля settings", "id аккаунта для записи настроек берётся только из сессии"]
key-files:
  created:
    - packages/contracts/src/settings.ts
    - apps/api/src/settings/settings.ts
    - apps/api/src/routes/settings.ts
    - scripts/dev-checks/ledger-settings.mjs
  modified:
    - packages/contracts/src/index.ts
    - apps/api/src/app.ts
decisions:
  - "Ответ GET и PATCH одинаков: { settings: { paysSoonLessons } }, как у остальных ресурсов с обёрткой по имени"
  - "Проверка диапазона дублируется: zod int 0..20 в contracts и CHECK teacher_settings_pays_soon_ck в базе"
  - "Лишнее поле тела (например accountId) отбрасывает zod, а запись идёт по id аккаунта из сессии"
metrics:
  duration: "~15 мин"
  completed: 2026-10-10
  tasks: 2
  files: 6
commits: 2
plan_head_before: 9b570b4a857110cd63257fe1e72fcbd8c47d5878
plan_head_after: 83e90695c2422ef3845d968dfc3b0432c0d08f6c
estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 2
  confidence: low
actuals:
  tokens: 3300
  tasks: 2
  commits: 2
---

# Phase 21 Plan 05: Порог Pays soon на аккаунте учителя Summary

Порог Pays soon (целое 0..20, по умолчанию `PAYS_SOON_LESSONS_DEFAULT` из core) хранится в `teacher_settings` и меняется только учителем через `GET /settings` и `PATCH /settings`; читает его одна функция `readPaysSoonLessons`.

## Что сделано

- **Задача 1 (tracer), коммит d0045f2.** `packages/contracts/src/settings.ts` (пределы, `updateSettingsRequest`, wire-типы) и реэкспорт в `index.ts`. `apps/api/src/settings/settings.ts`: `readPaysSoonLessons` отдаёт значение строки аккаунта или `PAYS_SOON_LESSONS_DEFAULT`, если строки нет; `savePaysSoonLessons` пишет upsert по `account_id` с явным числом (в базе у `pays_soon_lessons` нет значения по умолчанию, см. 21-01). `apps/api/src/routes/settings.ts`: `noStore`, `requireSession`, `requireRole('teacher')`, чтение через `readSnapshot`, запись по `c.get('session').account.id`. Монтирование `/settings` в `app.ts`. Приёмка часть 1 в `ledger-settings.mjs`.
- **Задача 2, коммит 83e9069.** Часть 2 приёмки: границы 0 и 20, отказы, ученик, анонимный доступ, лишний `accountId`, повторное сохранение. Маршрут правок не потребовал: все отказы уже шли конвертом `invalid_request` с кодом 400.

## Проверено

- `yarn workspace @dv-lab/contracts typecheck`: код 0.
- `yarn workspace @dv-lab/api typecheck`: код 0.
- `npx prettier --check` по шести файлам плана: чисто.
- `node scripts/dev-checks/ledger-settings.mjs` (api на порту 4203, `dvlab_test`): код 0, 26 строк PASS, нет FAIL, напечатаны `SETTINGS_PART1_OK` и `SETTINGS_OK`. Значения порога: без строки 2, после сохранения 5, после последнего сохранения 7.
- Границы: PATCH 0 и 20 приняты; 21, -1, 2.5, строка "3", null, `{}`, тело `null`, пустое тело, запрос без content-type дали 400 `invalid_request`, сохранённое значение не изменилось.
- Доступ: ученик получил 403 на GET и PATCH, без сессии 401, лишний `accountId` в теле проигнорирован, строк `teacher_settings` другого аккаунта нет, у учителя ровно одна строка.
- Уборка: `select count(*) from teacher_settings` на `dvlab_test` после прогона даёт n = 0.
- Критерии: `grep -nE "from '\.\./(auth|cards)/"` и `grep -nE "\b2\b"` по `apps/api/src/settings/settings.ts` ничего не нашли (код 1).

## Не запускалось

- Сборка api и `yarn test`: запрещено правилами плана (параллельные исполнители).
- Проверка в браузере: плана UI нет, экран настроек делает 21-14.

## Deviations from Plan

None - plan executed exactly as written.

## Для следующих планов

- 21-06 (Today) и Students берут порог так: `readPaysSoonLessons(executor, c.get('session').account.id)`, внутри `readSnapshot`; значение по умолчанию подставляет эта же функция.
- 21-14 (экран Settings): `GET /settings` и `PATCH /settings` с телом `{ paysSoonLessons }`, ответ `{ settings: { paysSoonLessons } }`; 400 `invalid_request` на всё вне целого 0..20; пределы в `PAYS_SOON_LESSONS_MIN` и `PAYS_SOON_LESSONS_MAX` из `@dv-lab/contracts`.
- `commits: 2` посчитан по двум задачным коммитам: в общем worktree параллельные исполнители коммитят в ту же ветку, но между `plan_head_before` и `plan_head_after` чужих коммитов не оказалось.

## Known Stubs

None.

## Threat Flags

None. T-21-12 закрыт (учитель-только, id из сессии, проверки 403, 401 и лишнего `accountId`), T-21-13 закрыт (zod и CHECK в базе).

## Self-Check: PASSED

Файлы плана на месте, коммиты d0045f2 и 83e9069 есть в ветке.
