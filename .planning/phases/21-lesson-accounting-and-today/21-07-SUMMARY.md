---
phase: 21-lesson-accounting-and-today
plan: 07
subsystem: api, contracts, core
status: complete
tags: [balance, lesson_marks, no-show, today, pays-soon]
requires: [21-01, 21-02, 21-04, 21-05]
provides:
  - "rows.ts: loadMarkRows(executor, studentIds) — все отметки учеников с текущим местом и длительностью вхождения и исходом из core"
  - "card-facts.ts: остаток через studentBalance(toBalanceCard(card), сырые оплаты, уроки из loadMarkRows)"
  - "core: старая balanceMinutes удалена"
  - "contracts: saveStudentRequest.noShowDeducts (optional), StudentDetail.noShowDeducts, TodayResponse"
  - "api: readToday (apps/api/src/today/today.ts), GET /today только для учителя"
  - "scripts/dev-checks/ledger-api.mjs: разделы balance, flag, today"
affects: [21-08, 21-09, 21-13, 21-15, 21-17]
tech-stack:
  added: []
  patterns:
    - "SQL отдаёт сырые строки оплат и отметок, вычет и границу даты решает core"
    - "модуль today собирает schedule, cards и settings; schedule не импортирует cards"
key-files:
  created:
    - packages/contracts/src/today.ts
    - apps/api/src/today/today.ts
    - apps/api/src/routes/today.ts
  modified:
    - packages/core/src/balance.ts
    - packages/contracts/src/students.ts
    - packages/contracts/src/index.ts
    - apps/api/src/schedule/rows.ts
    - apps/api/src/cards/card-facts.ts
    - apps/api/src/cards/card-rows.ts
    - apps/api/src/cards/cards.ts
    - apps/api/src/app.ts
    - scripts/dev-checks/ledger-api.mjs
decisions:
  - "loadMarkRows идёт тремя запросами без leftJoin: отметки серий с сериями, исключения этих серий, отметки одиночных уроков с уроками"
  - "Отметка серии, у которой occurrenceAt даёт null (дата вне серии, в том числе после разреза), не считается; перенесённое вхождение считается по новой дате (D-17)"
  - "series в ответе /today — серии уроков дня и серии блоков earlier, без повторов; серии прочих прошлых блоков окна не отдаются"
  - "earlier не сортируется отдельно: readWindow отдаёт блоки по возрастанию начала (scheduleWindow)"
metrics:
  duration: "~35 мин"
  completed: 2026-10-10
  tasks: 3
  files: 12
estimate:
  tokens: 105000
  raw_tokens: 105000
  tasks: 3
  confidence: low
actuals:
  tokens: 8700
  tasks: 3
  commits: 3
plan_head_before: d45853fbb00d0768f94c1d3890fb2d05b36bab59
plan_head_after: 56dc8e8079579157d3b362e9b277997c8b7afbfd
---

# Фаза 21, план 07: остаток по отметкам, флаг неявки и GET /today

Остаток карточки считает core: card-facts отдаёт в `studentBalance` все оплаты карточек без фильтров и все отметки уроков из `loadMarkRows`, карточку остатка строит та же `toBalanceCard`, что и блок недели. Флаг `noShowDeducts` проходит через контракт и карточку. Новый `GET /today` отдаёт учителю уроки дня, прошлые неотмеченные уроки, их серии и Pays soon по порогу из настроек.

## Задачи

| Задача | Что сделано | Коммит |
|--------|-------------|--------|
| 1 (tracer) | `loadMarkRows` в rows.ts; card-facts на `studentBalance` по сырым оплатам и отметкам; `noShowDeducts` в `cardColumns`; удалена `balanceMinutes` из core; раздел balance | 99a5ccf |
| 2 | `noShowDeducts: z.boolean().optional()` в `saveStudentRequest`, поле в `StudentDetail`; `createCard` пишет `?? true`, `updateCard` ставит поле только при `!== undefined`, `importCard` пишет `true`; раздел flag | 2a24a40 |
| 3 | `TodayResponse`; `readToday` (окно дня и окно `MARK_LOOKBACK_DAYS` до начала дня, `needsMark` из core, `paysSoonList` по `readPaysSoonLessons`); `todayRoutes` с `noStore`, `requireSession`, `requireRole('teacher')`; монтирование `/today`; раздел today | 56dc8e8 |

Гейт tracer после задачи 1: все `<verify>` автоматические, повторный прогон зелёный, задача 2 пошла без остановки.

## Проверки

- `yarn workspace @dv-lab/core typecheck`, `yarn workspace @dv-lab/contracts typecheck`, `yarn workspace @dv-lab/api typecheck`: код 0 после каждой задачи.
- `yarn workspace @dv-lab/contracts test`: 2 файла, 48 тестов, все прошли.
- `yarn workspace @dv-lab/web typecheck`: код 0 (только чтение, web не правился; `StudentDetail.noShowDeducts` web не ломает).
- `node scripts/dev-checks/ledger-api.mjs balance`: 15 строк PASS, `SCHEDULE_LEDGER_BALANCE_OK`. Шаги остатка: 0 → −60 (done 60) → −150 (done 90) → −150 (done в день открытия) → −210 (ночной урок 00:30 по Вьетнаму) → −120 (none) → −210 (no_show) → −120 (отмена начавшегося, строка отметки на месте) → −210 (возврат) → −90 (оплата 2 урока) → −150 (done вхождения серии) → −90 (отмеченное вхождение перенесено на день открытия). Список и профиль совпадают на каждом шаге.
- `node scripts/dev-checks/ledger-api.mjs flag`: 13 строк PASS, `SCHEDULE_LEDGER_FLAG_OK`. Остаток 60 → 120 (флаг выключен, отметка no_show на месте) → 120 (PATCH без поля, флаг остался выключен) → 60 (флаг включён); POST без поля даёт `true`; не булево значение — 400.
- `node scripts/dev-checks/ledger-api.mjs today`: 24 строки PASS, `SCHEDULE_LEDGER_TODAY_OK`. Порядок Pays soon среди фикстур при N = 2 — S, U, P; при N = 0 — S, U. Ученик 403, без сессии 401, `no-store`.
- `node scripts/dev-checks/ledger-api.mjs marks`, `past`, `cut`, `race`: `SCHEDULE_LEDGER_MARKS_OK`, `SCHEDULE_LEDGER_PAST_OK`, `SCHEDULE_LEDGER_CUT_OK`, `SCHEDULE_LEDGER_RACE_OK` (общие помощники скрипта менялись).
- `node scripts/dev-checks/ledger-core.mjs`: `LEDGER_CORE_OK` без правок (часть 1 уже сравнивает со своей `oldBalance`).
- `node scripts/dev-checks/schedule-api.mjs read`: `SCHEDULE_API_READ_OK`.
- Критерии приёмки: `gt(payments.paidOn|creditedMinutes` и `isNotNull(students.openingBalanceOn` в card-facts.ts — нет (код 1); `git grep "balanceMinutes("` по `packages/core/src` и `apps/api/src` — нет (код 1); `toBalanceCard` в card-facts.ts — 2, в schedule.ts — 2; `noShowDeducts: true` в `importCard`; `noShowDeducts: z.boolean().default` — нет (код 1), `noShowDeducts: z.boolean().optional()` — 1; `from '../cards` в `apps/api/src/schedule` — нет (код 1); запрещённые сравнения в today.ts — нет (код 1), `needsMark` — 2.
- Уборка: `students where display_name like 'Alex Example 21%' and import_key is null` на dvlab_test — n = 0; `teacher_settings` на dvlab_test — n = 0. dvlab_dev план не трогал.
- `npx prettier --check` по файлам плана: чисто.

## Не запускалось

- Сборка api (tsdown) и `yarn test`: запрещены планом и правилами волны.
- `yarn lint` и `yarn knip`: план их не называет; knip может показать `TodayResponse` неиспользуемым до web-плана Today.

## Отклонения от плана

### Auto-fixed Issues

**1. [Правило 3, блокирующее] Уборка фикстур в ledger-api.mjs**
- **Задача:** 1
- **Что:** `removeTails` чистил только префикс `Alex Example 211`, а `removeCards` не удалял оплаты; раздел balance создаёт оплату, и она осталась бы в dvlab_test или помешала бы удалить карточку.
- **Решение:** префиксы `Alex Example 211` и `Alex Example 212`, в `removeCards` добавлено удаление `payments` карточек. `createLesson` и `onceLesson` получили необязательную длительность (по умолчанию 60).
- **Коммит:** 99a5ccf

### Уточнения к плану

- В раздел balance добавлены два шага сверх плана: отметка done вхождения серии (ветка серий `loadMarkRows`) и перенос этого вхождения исключением `moved` на день открытия — вычет пропадает (D-17: отметка едет с уроком, дата считается новая).
- Раздел today строит «урок час назад», «урок через два часа» и призрак перенесённого вхождения строками SQL (`lessons` и `lesson_exceptions`), а не через POST: время берётся с ограничением полуночью по Вьетнаму, чтобы проверка не зависела от часа запуска. Перенос через API до 21-17 отказал бы, если бы естественное время вхождения уже прошло.
- Вне плана в разделах проверены 401 без сессии, `no-store` у `/today`, 400 на не булев флаг.

## Для следующих планов

- 21-08 и web Today: `GET /today` → `{ date, lessons, earlier, series, paysSoon, paysSoonLessons }`; `lessons` — блоки окна дня вместе с призраками, `earlier` — блоки до начала дня, где `needsMark` истинно, по возрастанию начала; `paysSoon` — `StudentRow[]` из `paysSoonList`. Счётчики считает `todayCounts` из core по этим массивам.
- 21-09 (форма карточки): поле `noShowDeducts` в теле POST и PATCH `/students` необязательно, ответ `StudentDetail.noShowDeducts`.
- 21-17: `loadMarkRows` уже считает перенесённое вхождение по новому месту, а одиночный урок — по `lessons.starts_at`; для переноса начавшегося урока правки остатка не нужны.
- `apps/web/AGENTS.md` (не отслеживается) создан dev-сервером соседнего 21-06; этот план его не трогал.

## Known Stubs

Нет.

## Threat Flags

Нет. T-21-15: `/today` закрыт `requireRole('teacher')`, проверены 403 для ученика и 401 без сессии. T-21-16: глубина `MARK_LOOKBACK_DAYS` из core, оба окна читаются в одном `readSnapshot`. T-21-17: флаг только в `saveStudentRequest` (zod boolean), PATCH карточки под `requireRole('teacher')`, отметки флаг не меняет (проверено).

## Self-Check: PASSED

- FOUND: packages/contracts/src/today.ts, apps/api/src/today/today.ts, apps/api/src/routes/today.ts
- FOUND: коммиты 99a5ccf, 2a24a40, 56dc8e8
