---
phase: 21-lesson-accounting-and-today
plan: 15
subsystem: web, core
tags: [schedule, outcome, overlaps, week-summary, schedule-today, schedule-date]
requires: [21-04, 21-08, 21-17]
provides:
  - "core: OverlapItem с outcome, overlaps занимает время по countsAsLesson"
  - "web: weekSummary и счётчик уроков недели по исходу, элементы перекрытий из block.outcome"
  - "web: «сегодня» и даты расписания только через scheduleToday и scheduleDate"
affects: [21-16]
status: complete
commits: 2
plan_head_before: 84af3e4a77e936f98ffe3b50f988499012d6a265
plan_head_after: 506a9b846687cfe4938175017ed9f6aa612cad26
actuals:
  tokens: 6000
  tasks: 2
  commits: 2
key-files:
  modified:
    - packages/core/src/schedule.ts
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - apps/web/app/(app)/schedule/_components/week-grid.tsx
    - apps/web/app/(app)/schedule/_components/lesson-move-form.tsx
    - apps/web/lib/schedule-format.ts
    - scripts/dev-checks/schedule-core.mjs
    - scripts/dev-checks/schedule-web.mjs
key-decisions:
  - "OverlapItem.outcome вместо status; перекрытие считается по countsAsLesson, поведение баннера пересечения прежнее, но отмеченный (done, no_show) урок занимает слот"
  - "openNew берёт дату из today экрана (scheduleToday), zonedParts остался только для минут"
requirements-completed: [LEDG-05, LEDG-08]
---

# Фаза 21, план 15: исход и даты расписания из core в web

Перекрытия уроков и сводка недели считают уроки по исходу (countsAsLesson), «сегодня» и даты начала уроков в web берутся только из scheduleToday и scheduleDate. Web больше не читает поле статуса блока: план 21-16 убирает `status` и `changeable` из контракта и api.

## Задачи

| Задача | Что сделано | Коммит |
|--------|-------------|--------|
| 1 (tracer) | `OverlapItem` с `outcome: LessonOutcome`, `overlaps` пропускает элементы без `countsAsLesson`; `blocksOn` в schedule-screen.tsx строит элементы из `block.outcome`; сценарий s7 в schedule-core.mjs на исход | 8fa0f74 |
| 2 | `weekSummary` (уроки и ученики через `countsAsLesson`, отменённые по `outcome === 'cancelled'`) и счётчик `planned` экрана; даты экрана, сетки, формы переноса и вторая зона в schedule-format.ts через `scheduleToday` и `scheduleDate`; отпечаток недели в schedule-web.mjs по `outcome` | 506a9b8 |

`new-lesson-dialog.tsx` и `lesson-move-form.tsx` по типам `OverlapBlock = OverlapItem & { studentName }` перешли на исход без правок кода; `lesson-move-form.tsx` правился только ради даты (`scheduleDate(start)`).

## Проверки

| Команда | Результат |
|---------|-----------|
| `yarn workspace @dv-lab/core typecheck`, `@dv-lab/web typecheck` | код 0 |
| `yarn workspace @dv-lab/web lint`, `build` | код 0 |
| `node scripts/dev-checks/schedule-core.mjs` | CORE_OK, s7 зелёный |
| `schedule-web.mjs read` (светлая и тёмная) | SCHEDULE_WEB_READ_OK |
| `schedule-web.mjs changes` | SCHEDULE_WEB_CHANGES_OK (части 1-3, move-past) |
| `schedule-web.mjs grid` (светлая и тёмная) | SCHEDULE_WEB_GRID_OK |
| `schedule-web.mjs forms` | SCHEDULE_WEB_FORMS_OK (баннер пересечения прежний) |
| `ledger-web.mjs marks` | LEDGER_WEB_MARKS_OK |
| `wait-dev.mjs down` | DEV_DOWN_OK |

Гейты: `git grep -F -e "block.status" -e ".changeable"` по `apps/web` и `schedule-web.mjs` — код 1; `grep "status ===|!== 'scheduled|cancelled|moved'"` по `apps/web` — код 1; `git grep "zonedParts(…SCHEDULE_TIME_ZONE).date"` по `apps/web` — код 1; `parts.date`, `nowParts.date`, `current.date` в каталоге расписания — нет; `scheduleDate` в week-grid.tsx — 2; `countsAsLesson` в schedule-format.ts — 2; `outcome: LessonOutcome` в core есть.

Фикстуры: только `Alex Example 21NN` и `215x`, уборка в начале и в конце каждого раздела, после прогонов 0 карточек. Реальные данные dvlab_dev не менялись.

## Изменённые ожидания проверок

- schedule-core.mjs, s7: элементы перекрытий заданы по `outcome`; добавлены урок done на тот же слот и урок no_show внутри слота; ожидание `all` стало `k1, k6, k7`, `excluded` стало `k6, k7` (done и no_show занимают слот, cancelled и moved нет); призрак и цель переноса из `scheduleWindow` приводятся к исходу через `lessonOutcome(status, null)`, `ghost` пусто, `destination` — `planned`.
- schedule-web.mjs: отпечаток недели в проверке stale (`pastSnapshot`) читает `block.outcome` вместо `block.status`; других ожиданий, читающих статус блока или `changeable`, в файле не оставалось.

## Отклонения от плана

- **Файл вне списка не менялся, список сокращён.** `new-lesson-dialog.tsx` не правился: тип `OverlapBlock` берёт новое поле из core.
- **`secondRange` и `secondWhen`** в schedule-format.ts сравнивают даты через `scheduleDate` вместо `dateOf(…, SCHEDULE_TIME_ZONE)`, чтобы дата по Вьетнаму бралась из одного места (D7). Поведение то же.
- Прямое сравнение `outcome === 'cancelled'` осталось в `weekSummary` для счётчика отменённых: в core нет предиката «отменён», а план требует считать их по исходу cancelled.

## Для следующих планов

- 21-16: web не читает `block.status` и `block.changeable`; поля `status` блока и `changeable` из контракта и api убираются без поломки web. Ответы мутаций (`occurrence.status`, `lesson.status`) могут читаться проверками schedule-api.mjs.
- `apps/web/AGENTS.md` от next dev удалён, порты 3000 и 4000 свободны.

## Known Stubs

Нет.

## Threat Flags

Нет. T-21-27 закрыт: гейт на даты из `zonedParts` по зоне Вьетнама пуст. T-21-36: только вымышленные карточки, скриншоты в STATE_DIR.

## Self-Check: PASSED

- Коммиты 8fa0f74 и 506a9b8 есть в `git log`; изменённые файлы существуют.
