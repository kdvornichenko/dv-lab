---
phase: 20-schedule
fixed_at: 2026-10-10T11:00:00Z
review_path: .planning/phases/20-schedule/20-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Фаза 20: исправления по ревью

**Отчёт ревью:** `.planning/phases/20-schedule/20-REVIEW.md`
**Итерация:** 1

В работе по заданию оркестратора: CR-01, WR-01..WR-08, WR-11 (10 находок, WR-08 вошла в коммит CR-01). Не делались по заданию: WR-09, WR-10, IN-01..IN-10.

Правки и проверки шли в worktree фазы, dev-стек поднимался из него же (api на `dvlab_dev`, без `DATABASE_URL` и `MIGRATOR_DATABASE_URL` в окружении).

## Исправлено

### CR-01 + WR-08: отменённый перенесённый урок

**Коммит:** `3fc350e`
**Файлы:** `packages/core/src/schedule.ts`, `apps/api/src/schedule/rows.ts`, `apps/api/src/schedule/changes.ts`, `apps/web/app/(app)/schedule/_components/lesson-dialog.tsx`, `20-CONTEXT.md` (D-17), `scripts/dev-checks/schedule-core.mjs`, `scripts/dev-checks/schedule-api.mjs`

- `SeriesException` вида `cancelled` получил необязательные `startsAt`/`durationMinutes`; `occurrenceAt` ставит такое вхождение на время переноса со статусом `cancelled`. Новая функция `movedAway(occurrence)`.
- `scheduleWindow`: в месте переноса зачёркнутый блок `cancelled` с `movedFrom`, на исходном месте остаётся призрак `moved` с `movedTo` (пара блоков открывает друг друга, как у обычного переноса).
- `loadScheduleRows` берёт по `starts_at` в окне исключения `moved` и `cancelled`, иначе отменённый урок, перенесённый из другой недели, не загружался бы.
- `cancelOccurrence` пишет время переноса в строку `cancelled`; `restoreOccurrence` проверяет и сравнивает `expectedStartsAt` с моментом, где вхождение стоит сейчас, и пишет `moved` с тем же временем (если урок переносили) или `restored`.
- `markException` всегда задаёт время явно: у `restored` и простого `cancelled` обнуляет `starts_at`/`duration_minutes`. Без этого после цепочки «перенос → возврат домой → отмена» урок встал бы на старое место переноса.
- Диалог: «This lesson has already taken place» показывается только у запланированного урока (не у отменённых и не у исходного места переноса).
- D-17 дополнен одной пометкой. Новой миграции, нового `kind` и правки CHECK нет: CHECK `lesson_exceptions_moved_ck` уже разрешает время у `cancelled`.
- Строки `cancelled` с устаревшим временем, записанные старым кодом в dev и test, остаются как есть (тестовые данные; в прод фаза 20 не выкатывалась).

### WR-07: ложные 409

**Коммит:** `902839c`
**Файлы:** `packages/contracts/src/auth.ts`, `packages/contracts/test/auth.test.ts`, `packages/core/src/schedule.ts`, `apps/api/src/schedule/changes.ts`, `apps/api/src/schedule/series.ts`, `apps/api/src/routes/schedule.ts`, `lesson-dialog.tsx`, `lesson-move-form.tsx`, `move-series-dialog.tsx`, `schedule-screen.tsx`, `schedule-core.mjs`, `schedule-api.mjs`

- Новые коды: `lesson_in_past` (400, урок уже начался: перенос, отмена, возврат), `target_in_past` (400, цель переноса в прошлом), `series_today_passed` (400, Move series с From = сегодня после начала сегодняшнего урока; `cutSeries` возвращает вид `today_passed`). 409 остаётся только для настоящих изменений (нет вхождения, другой статус, устаревший `expectedStartsAt`).
- Клиент: `now` передаётся в `LessonDialog` и `LessonMoveForm`, действия прячутся по `canChange(startsAt, now)`; форма переноса не отправляет время раньше текущего («Choose a time later than now.») и показывает отдельные тексты для `lesson_in_past`/`target_in_past`; `MoveSeriesDialog` пишет ошибку у поля From («Today's lesson has already started. Choose a later date.») и по клиентскому расчёту, и по коду сервера; отказ `lesson_in_past` при отмене или возврате даёт баннер «This lesson has already started and cannot be changed.» и перечитывает неделю.
- Тест `packages/contracts/test/auth.test.ts` (точный список кодов) дополнен тремя кодами.

### WR-02: DELETE у роли приложения

**Коммит:** `a0dd4f9`
**Файлы:** `packages/db/drizzle/20261010103628_schedule_revoke_delete/{migration.sql,snapshot.json}`, `scripts/dev-checks/schedule-db.mjs`

- Аддитивная миграция через `db:generate --custom --name schedule_revoke_delete`: `REVOKE DELETE, TRUNCATE ON "lesson_series", "lesson_exceptions", "lessons" FROM "dvlab_app";`. Старые миграции не менялись, повторный `db:generate` — «No schema changes».
- `schedule-db.mjs`: папок 5, проверка текста REVOKE, ожидание `delete: false`.
- Применено к `dvlab_dev` и `dvlab_test` через `schedule-db.mjs migrate` (5/5 в обеих базах); на `dvlab_dev` отдельно подтверждено `has_table_privilege(..., 'delete') = false` на трёх таблицах.
- Чистка фикстур в `schedule-api.mjs` (`api.mjs` по умолчанию `migrator`), `schedule-web.mjs` (`web.mjs` всегда `migrator`) и пробы `schedule-db.mjs` уже шли под ролью миграций, переводить нечего. Роль `app` в скриптах используется только для `accounts`.

### WR-03: годы 0001-0099

**Коммит:** `5415391`
**Файлы:** `packages/core/src/zoned.ts`, `scripts/dev-checks/schedule-core.mjs`

- Помощник `utcMs` на `setUTCFullYear`/`setUTCHours` заменил `Date.UTC` в `offsetMs`, `utcDate`, `weekdayOf`, `zonedInstant`.
- `schedule-core.mjs`: сверка с SQL для `0050-03-03 10:00 UTC` и `0099-12-31 23:45 Europe/Moscow`, `addDays` через границу века, `weekdayOf('0050-03-03')`, круг `zonedInstant`/`zonedParts` во Вьетнаме.

### WR-06: чтение одним снимком

**Коммит:** `0ef331d`
**Файлы:** `apps/api/src/schedule/rows.ts`, `apps/api/src/routes/schedule.ts`, `apps/api/src/routes/students.ts`

- `readSnapshot(db, read)` открывает транзакцию `repeatable read, read only` (drizzle подставляет `begin isolation level repeatable read read only`). Обёрнуты `GET /schedule/week`, `GET /students`, `GET /students/:id`. Внутренние функции остались без своей транзакции: `getCard` вызывается и внутри пишущих транзакций.

### WR-11: длительность при повторном создании серии

**Коммит:** `c58d6d4`
**Файлы:** `apps/api/src/schedule/schedule.ts`, `new-lesson-dialog.tsx`, `schedule-api.mjs`

- В условие поиска существующей серии добавлено `duration_minutes`: другая длительность создаёт вторую серию (D-09 разрешает). На ответ 200 диалог показывает тост «This series already exists» вместо «Series added».

### WR-05: неделя от движущегося якоря

**Коммит:** `5f9199b`
**Файлы:** `schedule-screen.tsx`, `apps/web/lib/schedule-format.ts`

- В состоянии хранится абсолютный `monday`; Today, стрелки и `openPair` ставят его напрямую. `weeksBetween` больше не нужен и удалён.

### WR-04: гонка reload/refresh

**Коммит:** `2b59a99`
**Файл:** `schedule-screen.tsx`

- `reloadNow` убран, все загрузки идут через эффект с флагом актуальности. После Move/End series фокус ставится, когда пришла новая неделя (`focusAfterLoad` + эффект на `loaded`), поэтому проверка «фокус уходит на заголовок, если блока нет» осталась верной. Refresh на экране ошибки сбрасывает `loaded` и вызывает `reload()`.

### WR-01: подсказка End series

**Коммит:** `d4889f1`
**Файлы:** `end-series-dialog.tsx`, `scripts/dev-checks/schedule-web.mjs`

- Только текст: «… Later lessons are removed from the schedule, including any you moved to an earlier day. Earlier lessons stay.» и «No lessons will remain, including any you moved to an earlier day. Earlier lessons stay.». Логика не менялась. Ожидания текста в `schedule-web.mjs` обновлены.

## Проверки

| Команда | Результат |
|---|---|
| `yarn workspace @dv-lab/{core,contracts,db,api,web} typecheck` | код 0 |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `node scripts/dev-checks/schedule-db.mjs migrate` | `.env dvlab_dev 5 5`, `.env.test dvlab_test 5 5`, `MIGRATE_OK` |
| `node scripts/dev-checks/schedule-db.mjs catalog` | `SCHEDULE_DB_OK`, в том числе «dvlab_app select insert update, no delete, no truncate» (повторён после `yarn test`, зелёный) |
| `node scripts/dev-checks/schedule-core.mjs` | `CORE_PART1_OK`, `CORE_OK` (новые s13 и проверки годов 0050/0099) |
| `node scripts/dev-checks/schedule-api.mjs read` | `SCHEDULE_API_READ_OK` |
| `node scripts/dev-checks/schedule-api.mjs next` | `SCHEDULE_API_NEXT_OK` |
| `node scripts/dev-checks/schedule-api.mjs changes` | `OCCURRENCE_OK`, `SINGLE_OK`, `SERIES_OK`, `SCHEDULE_API_CHANGES_OK` (новые сценарии: отмена перенесённого урока и Restore в место переноса, в том числе урок, перенесённый со вчерашнего дня в будущее; коды `lesson_in_past`, `target_in_past`, `series_today_passed`) |
| `node scripts/dev-checks/wait-dev.mjs up` | `DEV_UP_OK` |
| `schedule-web.mjs frame / read / changes / students` (светлая) | `SCHEDULE_WEB_FRAME_OK`, `SCHEDULE_WEB_READ_OK`, `SCHEDULE_WEB_CHANGES_OK`, `SCHEDULE_WEB_STUDENTS_OK` |
| `schedule-web.mjs frame / read / changes / students dark` | те же четыре маркера |
| разовый браузерный скрипт CR-01 (scratchpad, обе темы) | отменённый перенесённый урок стоит в месте переноса зачёркнутым, в диалоге есть Return to schedule и нет «already taken place»; Return to schedule возвращает урок в то же место (строка `moved`); у исходного места переноса нет «already taken place»; ошибок консоли нет |
| `node scripts/dev-checks/wait-dev.mjs down` | `DEV_DOWN_OK`; `lsof` на 3000/4000/4201/4202 пуст |
| `yarn workspace @dv-lab/api build` | собран |
| `yarn test` | contracts 48, db 21, api 47 тестов, все зелёные |

Замечания по проверкам:

- `yarn test` запускался дважды подряд: первый вывод был обрезан, второй прогон нужен был только чтобы увидеть счётчики по пакетам; оба зелёные.
- Подсказка «Choose a time later than now.» в форме переноса и ошибка у поля From в Move series в браузере отдельно не проверялись: в `schedule-web.mjs` для них нет сценария, проверены typecheck, lint и ответами api.
- Dev-стек остановлен целиком (yarn-обёртки, `node --watch`, `src/server.ts`, `next dev`, `next-server`); чужой `node --watch src/server.ts` из worktree фазы 19 не тронут. `apps/web/AGENTS.md`, созданный `next dev`, удалён без коммита.

---

_Исправлено: 2026-10-10_
_Исполнитель: Claude (gsd-code-fixer)_
_Итерация: 1_
