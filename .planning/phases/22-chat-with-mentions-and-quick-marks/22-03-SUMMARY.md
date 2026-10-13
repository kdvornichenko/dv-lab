---
phase: 22-chat-with-mentions-and-quick-marks
plan: '03'
subsystem: schedule-marks
status: complete
tags: [lesson-marks, revision, undo, calendar-journal, migration]
requires: ['22-01', '22-18']
provides:
  - 'lesson_marks.revision и CHECK lesson_marks_revision_ck'
  - 'writeMark(executor, accountId, ref, input, now) с before и ревизией в ответе'
  - 'expectedRevision в markLessonRequest, markRevision в ScheduleBlock, revision в ScheduleMark'
  - 'restoreMark в команде move и в lineage журнала, checkMarkRestore и restoreMarkAfterMove'
  - 'scripts/dev-checks/mark-revision.mjs'
affects: ['22-09', '22-10', '22-17']
tech-stack:
  added: []
  patterns:
    - 'Все записи lesson_marks идут через marks.ts: putMark (upsert) и changeMark (условный UPDATE), ревизия растёт выражением revision + 1'
key-files:
  created:
    - packages/db/drizzle/20261013113547_lesson_mark_revision/migration.sql
    - packages/db/drizzle/20261013113547_lesson_mark_revision/snapshot.json
    - scripts/dev-checks/mark-revision.mjs
  modified:
    - packages/db/src/schema.ts
    - packages/contracts/src/schedule.ts
    - packages/contracts/src/calendar.ts
    - packages/db/src/calendar-values.ts
    - apps/api/src/schedule/marks.ts
    - apps/api/src/schedule/rows.ts
    - apps/api/src/schedule/schedule.ts
    - apps/api/src/schedule/cut-apply.ts
    - apps/api/src/schedule/single-command.ts
    - apps/api/src/schedule/occurrence-command.ts
    - apps/api/src/schedule/command-apply.ts
decisions:
  - 'restoreMarkAfterMove и settleMarkAfterMove пишут одним условным UPDATE (блокировку строки берёт сам UPDATE), отдельного SELECT FOR UPDATE нет'
  - 'checkMarkRestore требует !canChange(target, now): точное дополнение условия clearsMark, поэтому clearMark и restoreMark в одной команде не встречаются по построению'
  - 'writeMark читает строку отметки под FOR UPDATE после блокировки серии или урока; expectedRevision сверяется после historyEligibility и markRefusal'
  - 'Ревизия в чтении — параллельные loadMarkStates и markStateOf; loadMarks и markOf оставлены с прежним типом для read-model и учёта'
metrics:
  duration: '~95 мин'
  completed: 2026-10-13
actuals:
  tokens: 12000
  tasks: 4
  commits: 5
plan_head_before: f2b5c205d4a5e7dd293f00e2707b5c6a15d443a6
plan_head_after: 2e9c809f7ceaa7e2e6c5525a45e41a9186643cf0
---

# Phase 22 Plan 03: Ревизия отметки урока Summary

Строка `lesson_marks` получила числовую ревизию, все писатели отметок пишут через `marks.ts` и растят её на каждой записи, запись может требовать точную ревизию (409 `lesson_changed`), а обратный перенос с `restoreMark` возвращает `no_show` в той же транзакции, что применяет команду журнала.

## Задачи

| # | Задача | Коммит |
|---|--------|--------|
| 1 | Колонка `revision`, миграция, контракт (`expectedRevision`, `markRevision`, `ScheduleMark.revision`) | 1a8a269 |
| 2 | `writeMark` и общие `putMark`/`changeMark`, ревизия у всех писателей, `markRevision` в блоках `readWindow`/`wireBlocks` | 2fe4de5 |
| 3 | `restoreMark` в варианте `move` команды и в `lineage`, проверка при приёме и возврат при применении | e1de69a |
| 4 | `scripts/dev-checks/mark-revision.mjs` | a9280a0 |
| — | Prettier для `markStateOf` | 2e9c809 |

`commits: 5` — коммиты этого плана. `git rev-list --count f2b5c20..HEAD` даёт больше, потому что в том же диапазоне лежат коммиты параллельного 22-02.

## Миграция

- Каталог: `packages/db/drizzle/20261013113547_lesson_mark_revision`. Содержит только `ADD COLUMN "revision" integer DEFAULT 1 NOT NULL` и `ADD CONSTRAINT "lesson_marks_revision_ck" CHECK ("revision" >= 1)`. Повторный `yarn db:generate`: «No schema changes».
- `node scripts/dev-checks/schedule-db.mjs migrate` падает на числе папок (`migration folders 16, expected 8`), как в 25.1-01 и 25.1-07. Миграция применена тем же обходом: `node --env-file=<.env.test|.env> apps/api/src/migrate.ts` без `DATABASE_URL`/`MIGRATOR_DATABASE_URL`, разовым скриптом из временной папки. Журнал миграций: `dvlab_test` — 16 записей, `dvlab_dev` — 19. Колонка проверена через `sql.mjs` в обеих базах (default 1, not null).

## Что сделано

- `marks.ts`: `writeMark(executor, accountId, ref, input, now)` — порядок блокировок прежний (`lockHistoryConnection` → `lockOccurrence`/`lockLesson`), строка отметки читается под `FOR UPDATE`, `historyEligibility(..., 'write')`, `markRefusal`, затем `expectedRevision` (поле есть и не равно текущей ревизии, `null` при существующей строке тоже) → `changed`. Результат `ok` несёт `mark.revision` и `before: { kind, revision } | null`. `markOccurrence` и `markLesson` открывают транзакцию и зовут `writeMark`, их сигнатуры и маршруты не менялись.
- `putMark(executor, ref, kind)` — единственный `insert(lessonMarks)`: вставка с `revision = 1`, при конфликте `revision + 1`, всегда, в том числе тот же `kind`. `insertDomain` (`cut-apply.ts`) копирует отметку на новый одиночный урок через `putMark`.
- `changeMark` — условный UPDATE с `revision + 1`: им пишут `settleMarkAfterMove` (`no_show` → `none`) и `restoreMarkAfterMove` (`none` → `no_show` только при `revision = restore.revision`, строк не вставляет и не удаляет). `inbound-apply.ts` зовёт `settleMarkAfterMove`, поэтому тоже растит ревизию.
- `checkMarkRestore(executor, ref, restore, targetStartsAt, now)` — при приёме: строка ключа `none` с точной ревизией и цель не позже `now`, иначе `CommandFault('precondition_failed')`.
- `contracts/calendar.ts`: вариант `move` получил необязательное поле верхнего уровня `restoreMark { kind: 'no_show', revision }`. `routes/schedule.ts` не менялся: браузер это поле передать не может. `calendar-values.ts` `lineage` принимает `restoreMark` (jsonb, старые строки журнала разбираются).
- `single-command.ts` и `occurrence-command.ts` проверяют `restoreMark` и пишут его в `lineage[0]`; `applySingle` после `settleMarkAfterMove` зовёт `restoreMarkAfterMove` на обеих ветках (серия и одиночный урок).
- `rows.ts`: `markColumns` с `revision`, тип `MarkState`, `loadMarkStates`, `markStateOf(executor, ref, lock)`, `markKey`; `loadMarks` и `markOf` построены поверх них и сохранили тип. `schedule.ts` `wireBlocks` отдаёт `markRevision`, Today получает его через `readWindow` и `calendarLessons`.

## Проверки

| Команда | Результат |
|---------|-----------|
| `yarn db:generate` (после задачи 1 и в конце) | новых миграций нет |
| `yarn workspace @dv-lab/db typecheck`, `@dv-lab/contracts typecheck`, `@dv-lab/api typecheck` | без ошибок |
| `yarn workspace @dv-lab/web typecheck` | после задач 1 и 2 без ошибок; после задачи 3 одна ошибка в `lesson-dialogs.tsx` (проп `calendar`), файл в работе у 22-02, не связан с этим планом |
| `grep -rn "insert(lessonMarks)" apps/api/src` | только `marks.ts` |
| `node scripts/dev-checks/mark-revision.mjs` | кейсы 1-9 и 11 проходят, кейс 10 падает на ошибке вне плана (ниже); `MARK_REVISION_OK` не напечатан |
| `node scripts/dev-checks/schedule-started.mjs` | `SCHEDULE_STARTED_OK` |
| `node scripts/dev-checks/schedule-started-series.mjs` | `SCHEDULE_STARTED_SERIES_OK` |
| `node scripts/dev-checks/calendar-final.mjs` | 15/15, `CALENDAR_FINAL_OK` |

Что доказывает `mark-revision.mjs` (`dvlab_test`, api на порту 4203, вымышленная карточка `Alex Example 0006`, шлюз Google — заглушка, хосты Google закрыты):

1. `POST /schedule/series/:id/occurrences/:date/mark`: Done → No-show → Done → Done даёт ревизии 1, 2, 3, 4; `expectedRevision: 3` и `expectedRevision: null` при существующей строке → 409 `lesson_changed`, строка осталась `done`/4.
2. `none` с `expectedRevision: 4` → 200, ревизия 5, строка на месте; остаток по `GET /students/:id` совпал.
3. `expectedRevision: null` на ключе без строки → 200, ревизия 1 (два ключа).
5. `GET /today`: все блоки несут `markRevision` (число или `null`), отмеченный начавшийся урок сегодня — `done`/1; блок недели по определению плана (`readWindow` за день вхождения) — `none`/5.
6. Перенос `no_show` на завтра: `lineage[0].clearMark = true`, строка `none`/2, остаток +60.
7. Обратный `move` на прежнее время с `restoreMark { no_show, 2 }` → `applied`, `lineage[0].restoreMark` в журнале, строка `no_show`/3, исключение `restored`, без опроса статуса.
8. `restoreMark` с ревизией 1 и `restoreMark` с целью послезавтра → `precondition_failed`, число строк `google_commands` не изменилось.
9. Ревизия поднята прямым `UPDATE` под мигратором между приёмом и отправкой → команда `applied`, строка `none`/3, отметка не тронута.
11. Остаток через `GET /students/:id` после всех переносов совпал с ожидаемым; `cardFacts` сверялся после каждого шага.

Фикстуры убраны (`calendar-seed down`, карточка удалена; проверено SQL-счётчиком), порт 4203 свободен.

## Deviations from Plan

### Отклонения

**1. [Пробел плана] `GET /schedule/week` не несёт `markRevision`**
- Найдено в задаче 4. С фазы 25.1 `GET /schedule/week` отдаёт `googleScheduleWindow` из `calendar/read-model.ts`, где `binding.mark` — только вид отметки (`done`/`no_show`). Блоки `ScheduleBlock` из `readWindow` использует только Today. План считал «блоком недели» `readWindow`, ревизия там есть и проверена в процессе.
- Чтобы ревизия была в недельном ответе, нужны `packages/contracts/src/calendar.ts` (поле в `binding`) и `apps/api/src/calendar/read-model.ts` (`loadMarkStates` вместо `loadMarks`). `read-model.ts` не входит в план, правка не сделана. В фазе 22 ревизию из недели никто не читает: 22-09 и 22-10 берут её из ответа `writeMark` (`mark.revision`, `before`) и из журнала.

**2. [Rule 3 - блокер вне плана] Кейс 10 (`end_series` с отмеченным перенесённым вхождением хвоста) не проходит**
- Подробно в «Deferred Issues». Связь `insertDomain → putMark` подтверждена только typecheck и `grep`, без запуска.

**3. [Процесс] Миграция применена обходом `migrate.ts`, а не `schedule-db.mjs migrate`** (скрипт устарел по числу папок, как в 25.1-07).

## Deferred Issues

Кейс 10 `mark-revision.mjs` (разрез серии с перенесённым вхождением в хвосте) исправлен после отчёта: три причины подряд, `MARK_REVISION_OK` на 11 кейсах, `calendar-final` 15/15, `schedule-started` OK.

- `68cb46e`: `verifyStoredCancellation` сравнивал `instance` через `JSON.stringify`, порядок ключей из jsonb отличался от zod; теперь `canonical`.
- `c9cf1b8`: `cutWrite` клал в запрос `instance: undefined` для мастера и одиночного события; jsonb ключ терял, `isDeepStrictEqual` расходился, `precondition_failed`.
- `bc73132`: `currentTail` в `cut-apply.ts` сравнивал статус `moved` с lineage `scheduled`, `external_change` при применении после записи в Google.

Остаётся: `cut-apply.ts` (`currentTail`) пропускает только дату без исключения, а `preservedLessons` в `packages/core/src/schedule-series.ts` пропускает ещё и исключение `restored` без отметки. Сценарий: будущее вхождение перенесли и вернули обратно без отметки, затем `end_series` или `move_series` дают `external_change` при применении, команда остаётся в `recovery_required`. Правка в одну строку (`(!exception || exception.kind === 'restored') && ...`), воспроизведения нет. Проверить отдельным шагом (кандидат в 22-10, где перенос серии идёт из чата).

Ревизия в ответе `GET /schedule/week`: календарное окно (`calendar/read-model.ts`) несёт у отметки только вид, без ревизии. Ревизия есть в Today и `readWindow`; фаза 22 берёт её из ответа `writeMark` и журнала, из недели никто не читает.

## Known Stubs

Нет.

## Threat Flags

Нет. Новое поле `restoreMark` описано в модели угроз (T-22-46): маршруты schedule его не собирают, приём требует строку `none` с точной ревизией и цель не позже текущего момента, применение пишет только условным UPDATE при той же ревизии.

## Для следующих планов

- 22-09 (Undo отметки из чата): `writeMark(tx, accountId, ref, { kind, expectedRevision }, now)` работает внутри чужой транзакции; квитанцию строить из `before` и `mark.revision`.
- 22-10 (Undo переноса): обратная команда `move` с `restoreMark: { kind: 'no_show', revision }`, где `revision` — ревизия строки после `settleMarkAfterMove` исходного переноса.
- 22-17: строку про `mark-revision.mjs` (`MARK_REVISION_OK`) добавить в `scripts/dev-checks/README.md`.

## Self-Check: PASSED

- Файлы на месте: `packages/db/drizzle/20261013113547_lesson_mark_revision/migration.sql`, `snapshot.json`, `scripts/dev-checks/mark-revision.mjs`.
- Коммиты найдены: 1a8a269, 2fe4de5, e1de69a, a9280a0, 2e9c809.
