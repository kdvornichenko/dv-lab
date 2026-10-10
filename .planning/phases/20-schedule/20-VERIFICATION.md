---
phase: 20-schedule
verified: 2026-10-10T11:02:59Z
status: human_needed
score: 11/11 must-haves verified (SC3 gap closed by 20-ES, ee9e9b8)
covered_files: [".planning/phases/20-schedule/20-01-PLAN.md", ".planning/phases/20-schedule/20-01-SUMMARY.md", ".planning/phases/20-schedule/20-02-PLAN.md", ".planning/phases/20-schedule/20-02-SUMMARY.md", ".planning/phases/20-schedule/20-03-PLAN.md", ".planning/phases/20-schedule/20-03-SUMMARY.md", ".planning/phases/20-schedule/20-04-PLAN.md", ".planning/phases/20-schedule/20-04-SUMMARY.md", ".planning/phases/20-schedule/20-05-PLAN.md", ".planning/phases/20-schedule/20-05-SUMMARY.md", ".planning/phases/20-schedule/20-06-PLAN.md", ".planning/phases/20-schedule/20-06-SUMMARY.md", ".planning/phases/20-schedule/20-07-PLAN.md", ".planning/phases/20-schedule/20-07-SUMMARY.md", ".planning/phases/20-schedule/20-08-PLAN.md", ".planning/phases/20-schedule/20-08-SUMMARY.md", ".planning/phases/20-schedule/20-09-PLAN.md", ".planning/phases/20-schedule/20-09-SUMMARY.md", ".planning/phases/20-schedule/20-10-PLAN.md", ".planning/phases/20-schedule/20-10-SUMMARY.md", ".planning/phases/20-schedule/20-TP-SUMMARY.md", "AGENTS.md", "apps/api/src/app.ts", "apps/api/src/cards/card-facts.ts", "apps/api/src/cards/card-rows.ts", "apps/api/src/cards/cards.ts", "apps/api/src/routes/schedule.ts", "apps/api/src/routes/students.ts", "apps/api/src/schedule/changes.ts", "apps/api/src/schedule/rows.ts", "apps/api/src/schedule/schedule.ts", "apps/api/src/schedule/series.ts", "apps/web/app/(app)/schedule/_components/end-series-dialog.tsx", "apps/web/app/(app)/schedule/_components/event-tooltip.tsx", "apps/web/app/(app)/schedule/_components/lesson-block.tsx", "apps/web/app/(app)/schedule/_components/lesson-dialog.tsx", "apps/web/app/(app)/schedule/_components/lesson-move-form.tsx", "apps/web/app/(app)/schedule/_components/move-series-dialog.tsx", "apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx", "apps/web/app/(app)/schedule/_components/schedule-mutations.ts", "apps/web/app/(app)/schedule/_components/schedule-screen.tsx", "apps/web/app/(app)/schedule/_components/schedule-toolbar.tsx", "apps/web/app/(app)/schedule/_components/second-zone-select.tsx", "apps/web/app/(app)/schedule/_components/week-grid.tsx", "apps/web/app/(app)/schedule/page.tsx", "apps/web/app/(app)/students/_components/student-form-dialog.tsx", "apps/web/app/(app)/students/_components/students-screen.tsx", "apps/web/app/globals.css", "apps/web/components/app/date-field.tsx", "apps/web/components/app/empty-line.tsx", "apps/web/components/app/layout-parts.tsx", "apps/web/components/app/time-pair.tsx", "apps/web/components/ui/input-group.tsx", "apps/web/components/ui/table.tsx", "apps/web/components/ui/time-picker.tsx", "apps/web/lib/popup.ts", "apps/web/lib/schedule-format.ts", "apps/web/lib/time-zones.ts", "knip.json", "packages/contracts/src/auth.ts", "packages/contracts/src/index.ts", "packages/contracts/src/schedule.ts", "packages/contracts/src/students.ts", "packages/contracts/test/auth.test.ts", "packages/core/src/index.ts", "packages/core/src/schedule.ts", "packages/core/src/zoned.ts", "packages/db/drizzle/20261010075813_schedule/migration.sql", "packages/db/drizzle/20261010103628_schedule_revoke_delete/migration.sql", "packages/db/src/schema.ts", "scripts/dev-checks/api.mjs", "scripts/dev-checks/paths.mjs", "scripts/dev-checks/schedule-api.mjs", "scripts/dev-checks/schedule-core.mjs", "scripts/dev-checks/schedule-db.mjs", "scripts/dev-checks/schedule-web.mjs", "scripts/dev-checks/sql.mjs", "scripts/dev-checks/wait-dev.mjs", "scripts/dev-checks/web.mjs"]
covered_digest: "v2:sha256:252a87b52ba17e4f37aa07208d0b4b929e47b88fe5a5b2ec84fb0d9a128d5441"
behavior_unverified: 0
overrides_applied: 0
gaps: []
gaps_resolved_by_20_ES:
  - truth: "SC3 / SCHED-05: прошлые уроки, в том числе уроки закончившейся серии, остаются ровно такими, какими были"
    status: partial
    reason: "End series прячет уже прошедший урок, если он был перенесён с даты позже выбранного конца серии. Воспроизведено на packages/core: вхождение 2026-10-19 перенесено на 2026-10-08 18:00, now = 2026-10-10 12:00, endSeriesAt(lastOn = 2026-10-10) даёт endsOn = 2026-10-05, после чего scheduleWindow прошлой недели 2026-10-05..11 не содержит блок 2026-10-08 (до окончания он был). Строка исключения в базе остаётся (D-16), но урок пропадает из сетки, из occurrenceAt и, значит, из будущих отметок фазы 21. cutSeries в том же случае сохраняет урок строкой lessons, endSeries — нет. По ревью WR-01 исправлен только текст подсказки, и он неверен для этого случая («Earlier lessons stay»)."
    artifacts:
      - path: "apps/api/src/schedule/series.ts"
        issue: "endSeries (строки 40-54) только ставит ends_on; moved-исключения с original_on > ends_on и startsAt не позже конца выбранного дня не переводятся в lessons, в отличие от moveSeries (строки 31-33)"
      - path: "packages/core/src/schedule.ts"
        issue: "endSeriesAt (строки 321-327) не возвращает уроки, которые надо сохранить; occurrenceAt (строка 93) скрывает исключение вне диапазона серии"
      - path: "apps/web/app/(app)/schedule/_components/end-series-dialog.tsx"
        issue: "строки 129-134: «Earlier lessons stay» ложно для перенесённого раньше и уже прошедшего урока"
    missing:
      - "После End series перенесённые на более ранний день вхождения (и отменённые с временем переноса), чьё startsAt не позже выбранного последнего дня, остаются видимыми: по образцу cutSeries переводить их в lessons в той же транзакции, без удаления строк исключений; либо явное решение владельца (override ниже)"
      - "Сценарий в schedule-core.mjs и schedule-api.mjs changes: перенос вперёд на прошедшую дату, затем End series, урок на прошлой неделе остаётся"
behavior_unverified_items: []
human_verification:
  - test: "Пройти пять критериев в встроенном браузере (правило владельца «готово для UI — после проверки в браузере»): создать урок и серию, листать недели и Today, перенести и отменить вхождение, Move series и End series, вторая зона и None, список учеников со вкладками и поиском, обе темы"
    expected: "Поведение совпадает с прогонами schedule-web.mjs frame/read/changes/students"
    why_human: "Приёмка шла скриптами Playwright (прогон оркестратора, обе темы, все _OK); встроенный браузер не использовался, верификатор web-стек не поднимал"
  - test: "Сверка с артефактом дизайн-системы v23/v25 у Design dude по спискам замечаний в 20-03, 20-05, 20-07, 20-08, 20-09, 20-TP SUMMARY"
    expected: "Design dude подтверждает или присылает правки (см. раздел «Ручные пункты»)"
    why_human: "Артефакт исполнителям был недоступен, экраны собраны по Amendments UI-SPEC и лаборатории"
---

# Фаза 20: Schedule — отчёт верификации

**Цель фазы:** учитель планирует уроки на недельной сетке из одиночных уроков, еженедельных серий и исключений из серий и видит у каждого ученика следующий урок и остаток уроков.
**Проверено:** 2026-10-10T11:02:59Z
**Статус:** gaps_found (один частичный провал SC3/SCHED-05 на краевом сценарии End series)
**Повторная верификация:** нет, первичная.

ROADMAP показывает 20-10 как `[ ]` (9/10): задача 3 этого плана (ручная приёмка) выполнялась оркестратором прогонами `schedule-web.mjs` в обеих темах, все маркеры `_OK`. Это не противоречит статусу: код плана 20-10 (AGENTS.md, knip.json) на месте.

## Достижение цели

### Наблюдаемые истины

| # | Истина | Статус | Доказательство |
|---|---|---|---|
| 1 | **SC1 / SCHED-01.** Учитель создаёт одиночный урок и еженедельную серию и видит каждое вхождение на сетке при листании недель | ✓ VERIFIED | Схема: `packages/db/src/schema.ts:214` (`lesson_series`), `:239` (`lesson_exceptions`, PK `:252` = ключ вхождения), `:269` (`lessons`). Создание: `apps/api/src/schedule/schedule.ts:110-164` (once — строка `lessons`; weekly — серия с `starts_on` = ближайшая дата, идемпотентно с учётом длительности `:135-149`), маршрут `apps/api/src/routes/schedule.ts:96-108`. Вхождения считаются при показе: `packages/core/src/schedule.ts:92-111` (`occurrenceAt`), `:123-177` (`scheduleWindow`), неделя `apps/api/src/schedule/schedule.ts:96-108`. Web: «Repeats» once/weekly `new-lesson-dialog.tsx:88,299-331`, длина из `defaultLessonMinutes` `:134`, POST `:147-153`, клик по пустой клетке с шагом 15 минут `week-grid.tsx:101-105,153-157`; навигация `schedule-screen.tsx:95,250-253,303-305`, загрузка недели эффектом `:116-126`. Поведение: `schedule-api.mjs read` → `SCHEDULE_API_READ_OK` (запуск верификатора); `schedule-web.mjs read` обе темы `_OK` (прогон оркестратора) |
| 2 | **SC2 / SCHED-02.** Перенос или отмена одного вхождения меняет только его; остальная серия на месте; последующие изменения серии сохраняют исключение | ✓ VERIFIED | Исключение по ключу (series_id, original_on) upsert `apps/api/src/schedule/changes.ts:82-107`; move `:109-132`, cancel `:134-159`, restore `:161-186`, блокировка серии `rows.ts:111-114`; одиночный урок `changes.ts:202-233`. Отменённый перенесённый урок стоит в месте переноса (CR-01 исправлен): `core/schedule.ts:102-104`, `changes.ts:148-156,175-183`. Перенос серии: moved-исключения хвоста становятся строками `lessons` (`core/schedule.ts:293-303`, `series.ts:31-33`) и остаются на своём времени (D-04); исключения до даты разреза остаются на старой серии. Отменённые вхождения хвоста сбрасываются — решение владельца D-04: старой даты в новом правиле нет, отменять нечего. Поведение: `schedule-api.mjs changes` → `OCCURRENCE_OK`, `SINGLE_OK`, `SERIES_OK`, 97 PASS (запуск верификатора); `schedule-core.mjs` s2, s3, s4, s10, s13 PASS |
| 3 | **SC3 / SCHED-03.** Перенос всей серии на новый день и время меняет только будущие вхождения | ✓ VERIFIED | `cutSeries` `packages/core/src/schedule.ts:274-317`: From не раньше сегодня `:282`, сегодняшний начавшийся урок → `today_passed` `:285-287`, старая серия получает `ends_on` = From − 1 `:306`, новая начинается с ближайшей даты нового дня `:288`; транзакция с `FOR UPDATE` `apps/api/src/schedule/series.ts:20-38`; строк не удаляет (`grep .delete(` в `apps/api/src/schedule` пусто, REVOKE DELETE у `dvlab_app` в `20261010103628_schedule_revoke_delete/migration.sql`, `schedule-db.mjs catalog`: «no delete, no truncate»). UI: `move-series-dialog.tsx`, кнопка Move series `lesson-dialog.tsx:226`. Поведение: `SERIES_OK` (верификатор), `schedule-web.mjs changes` `_OK` (оркестратор) |
| 4 | **SC3 / SCHED-05.** Прошлые уроки, включая уроки закончившейся серии, остаются ровно такими, какими были | ✗ FAILED (partial) | Основной путь верен: `endSeriesAt` `core/schedule.ts:321-327` ставит `ends_on` не раньше последней прошедшей даты серии (lastOn ≥ сегодня), разрез не трогает даты до From. **Провал на краю:** вхождение, перенесённое с поздней даты на более раннюю и уже прошедшее, исчезает из прошлой недели после End series. Скрипт верификатора (scratchpad, исходники не менялись): до окончания неделя 2026-10-05 содержит `s:s1:2026-10-19 scheduled 2026-10-08T11:00Z`, `endSeriesAt(lastOn=2026-10-10)` → `endsOn 2026-10-05`, после — блока нет. Для того же случая `cutSeries` выдаёт `lessons ['2026-10-08T11:00:00.000Z']`, то есть перенос серии урок сохраняет. См. gaps |
| 5 | **SC4 / SCHED-04.** Сетка показывает время Вьетнама по умолчанию и может показать вторую зону рядом | ✓ VERIFIED | `SCHEDULE_TIME_ZONE = 'Asia/Ho_Chi_Minh'` `packages/core/src/schedule.ts:3`; все позиции блоков и «сейчас» через `zonedParts(…, SCHEDULE_TIME_ZONE)` `week-grid.tsx:52,93,144`; гаттер: вторая зона слева, VN справа, одна колонка без второй зоны `week-grid.tsx:107-130,168-170,211-219`; выбор зоны, по умолчанию `Europe/Moscow`, хранение в localStorage, None `second-zone-select.tsx:17-54,64-125`; сегодня и красная линия `week-grid.tsx:172-196,231-243`; открытие на 08:00 (48px ниже края) `week-grid.tsx:18,147` по UI-SPEC:45. TimePair второй зоны в диалоге, тултипе, Next lesson: `components/app/time-pair.tsx`. Поведение: `schedule-core.mjs` → `CORE_OK` (верификатор, в т.ч. s12 «не зависит от зоны процесса»); `schedule-web.mjs frame` обе темы `_OK`, включая зону браузера America/New_York (оркестратор) |
| 6 | **SC5 / CARD-04.** Список учеников со вкладками статуса и поиском показывает остаток уроков и следующий урок | ✓ VERIFIED | Вкладки Active/Archived управляемые `students-screen.tsx:141,193-229`; поиск по имени на клиенте `:49-52,168-170,210-212`, пусто → «No students found» `:62`; Lessons left `:115-121` (остаток из `packages/core` `balanceMinutes`, `card-facts.ts:15-44`); Next lesson `:122-127` с TimePair. `nextLessonAt` считает один владелец `apps/api/src/cards/card-facts.ts:46-68` через `loadScheduleRows` и `core nextLessons` (`core/schedule.ts:201-235`), подключён в `cards.ts:34,55`, контракт `packages/contracts/src/students.ts:147`; чтение одним снимком `rows.ts:145-147`. Поведение: `schedule-api.mjs next` → `SCHEDULE_API_NEXT_OK` (верификатор); `schedule-web.mjs students` обе темы `_OK` (оркестратор) |
| 7 | D-05: прошедшие вхождения только смотреть | ✓ VERIFIED | `canChange` `core/schedule.ts:62-64` в каждой мутации (`changes.ts:58-61`), коды `lesson_in_past`/`target_in_past` `routes/schedule.ts:58-61`; UI прячет действия по `block.changeable && canChange(start, now)` `lesson-dialog.tsx:116` |
| 8 | D-09: пересечения разрешены с предупреждением | ✓ VERIFIED | `overlaps` `core/schedule.ts:239-251`; баннер, сохранение не блокируется `new-lesson-dialog.tsx:125,200-201` |
| 9 | D-16/D-17: приложение ничего не удаляет | ✓ VERIFIED | удалений в `apps/api/src/schedule` нет; REVOKE DELETE, TRUNCATE у `dvlab_app`; `schedule-db.mjs catalog` → `SCHEDULE_DB_OK` (верификатор) |
| 10 | Гонки мутаций: одна мутация на строку, устаревшее состояние → 409 | ✓ VERIFIED | `lockSeries`/`lockLesson` `FOR UPDATE` `rows.ts:111-119`, `expectedStartsAt` `changes.ts:54-61`; проверка гонки в `schedule-api.mjs changes` (PASS) |
| 11 | Фэйд на скроллерах (D-14) новых экранов | ✓ VERIFIED | `scroll-fade` тела сетки `week-grid.tsx:207`, компактный фэйд списка зон `second-zone-select.tsx:101`, таблица учеников и PageScroll (20-03); визуально — прогон `schedule-web.mjs fade`/`frame` оркестратора |

**Счёт:** 10/11 истин подтверждены (0 present-behavior-unverified). Поведенческие истины SC2 и SC3 подтверждены прогоном `schedule-api.mjs changes` верификатором; SC1, SC4, SC5 на стороне браузера подтверждены прогонами `schedule-web.mjs` оркестратора, верификатор web-стек не поднимал.

### Отложенные пункты

Нет: в фазах 21-26 нет критерия, который закрывал бы сохранение прошлых перенесённых уроков при End series. Фаза 21 опирается на `occurrenceAt` и унаследует пропажу урока.

### Необходимые артефакты

| Артефакт | Назначение | Статус | Детали |
|---|---|---|---|
| `packages/db/drizzle/20261010075813_schedule/migration.sql`, `20261010103628_schedule_revoke_delete/migration.sql` | таблицы, CHECK, FK RESTRICT, отзыв DELETE | ✓ VERIFIED | применены к dev и test (5/5), `SCHEDULE_DB_OK` |
| `packages/core/src/zoned.ts`, `schedule.ts` | зоны и одно правило вхождений | ✓ VERIFIED | `CORE_OK`, годы 0050/0099 через `setUTCFullYear` |
| `packages/contracts/src/schedule.ts` | контракты web/api | ✓ VERIFIED | используется в routes и web |
| `apps/api/src/schedule/{rows,schedule,changes,series}.ts`, `routes/schedule.ts` | чтение недели, создание, мутации | ✓ VERIFIED | смонтировано `apps/api/src/app.ts:71` под `requireSession`/`requireRole('teacher')` `routes/schedule.ts:86` |
| `apps/api/src/cards/card-facts.ts` | остаток и следующий урок | ✓ VERIFIED | `cards.ts:34,55` |
| `apps/web/app/(app)/schedule/_components/*` | экран расписания | ✓ VERIFIED | `page.tsx` → `ScheduleScreen` |
| `apps/web/app/(app)/students/_components/students-screen.tsx` | вкладки, поиск, Next lesson | ✓ VERIFIED | данные из `GET /students` |
| `apps/web/lib/{schedule-format,time-zones}.ts`, `components/app/time-pair.tsx` | форматирование и зоны | ✓ VERIFIED | один владелец `matchesTimeZone`/`utcOffset` |

### Проверка связей

| Откуда | Куда | Через | Статус |
|---|---|---|---|
| `schedule-screen.tsx:52` | `GET /api/schedule/week` | `apiRequest` | WIRED |
| `new-lesson-dialog.tsx:147` | `POST /api/schedule/lessons` | `apiRequest` | WIRED |
| `schedule-mutations.ts` | move/cancel/restore/series move/end | `mutate` | WIRED |
| `routes/schedule.ts` | `core` (`occurrenceAt`, `cutSeries`, `endSeriesAt`) | `changes.ts`, `series.ts` | WIRED |
| `card-facts.ts:51-52` | `loadScheduleRows` + `nextLessons` | вызов | WIRED |
| `students-screen.tsx:122-127` | `StudentRow.nextLessonAt` | `GET /students` | WIRED |

### Поток данных (Level 4)

| Артефакт | Переменная | Источник | Реальные данные | Статус |
|---|---|---|---|---|
| WeekGrid | `week.data.blocks` | `readWeek` → `loadScheduleRows` (3 запроса drizzle в снимке repeatable read) → `scheduleWindow` | да | ✓ FLOWING |
| Next lesson | `student.nextLessonAt` | `cardFacts` → `loadScheduleRows(to=null)` → `nextLessons` | да | ✓ FLOWING |
| Lessons left | `student.balanceMinutes` | `cardBalances` (payments + opening balance) | да | ✓ FLOWING |

### Поведенческие проверки (запуски верификатора)

| Поведение | Команда | Результат | Статус |
|---|---|---|---|
| Типы монорепозитория | `yarn typecheck` | 5/5 задач успешно | ✓ PASS |
| Правило вхождений, разрез, окончание, зоны | `node scripts/dev-checks/schedule-core.mjs` | `CORE_PART1_OK`, s1-s13 PASS, `CORE_OK` | ✓ PASS |
| Каталог базы, права | `node scripts/dev-checks/schedule-db.mjs catalog` | `SCHEDULE_DB_OK`, «no delete, no truncate» | ✓ PASS |
| Неделя, 401/403, архивная карточка | `node scripts/dev-checks/schedule-api.mjs read` | `SCHEDULE_API_READ_OK` | ✓ PASS |
| Следующий урок | `node scripts/dev-checks/schedule-api.mjs next` | `SCHEDULE_API_NEXT_OK` | ✓ PASS |
| Мутации вхождений, уроков, серий | `node scripts/dev-checks/schedule-api.mjs changes` | `OCCURRENCE_OK`, `SINGLE_OK`, `SERIES_OK`, 97 PASS, хвостов фикстур 0 | ✓ PASS |
| End series сохраняет прошлый перенесённый урок | скрипт scratchpad на `packages/core` | блок 2026-10-08 пропадает из прошлой недели | ✗ FAIL |
| Web frame/read/changes/students, обе темы | `schedule-web.mjs` | все `_OK` | ? прогон оркестратора, верификатор не запускал |

`yarn test` верификатор не запускал (по заданию); по 20-10 и 20-REVIEW-FIX он зелёный (contracts 48, db 21, api 47).

### Probe

Проб `scripts/*/tests/probe-*.sh` в фазе нет; приёмка идёт скриптами `scripts/dev-checks/schedule-*.mjs` (см. выше).

### Покрытие требований

| Требование | План | Описание | Статус | Доказательство |
|---|---|---|---|---|
| SCHED-01 | 20-01, 20-02, 20-04, 20-07 | одиночные уроки и серии | ✓ SATISFIED | истина 1 |
| SCHED-02 | 20-02, 20-06, 20-08 | перенос или отмена одного вхождения | ✓ SATISFIED | истина 2 |
| SCHED-03 | 20-02, 20-06, 20-08 | перенос всей серии | ✓ SATISFIED | истина 3 |
| SCHED-04 | 20-02, 20-03, 20-05, 20-07 | сетка недели, навигация, VN по умолчанию, вторая зона | ✓ SATISFIED | истина 5 |
| SCHED-05 | 20-02, 20-06, 20-08 | прошлые уроки не меняются при изменении и окончании серии | ✗ BLOCKED (partial) | истина 4, gaps |
| CARD-04 | 20-03, 20-04, 20-09 | вкладки, поиск, остаток, следующий урок | ✓ SATISFIED | истина 6 |

Сиротских требований нет: REQUIREMENTS.md относит к фазе 20 ровно SCHED-01..05 и CARD-04.

### Антипаттерны

Поиск `TBD|FIXME|XXX|TODO|HACK|not yet implemented|coming soon` по коду фазы — пусто (код 1). Гейт долговых маркеров пройден. Заглушек нет: данные блоков, Next lesson и остатка идут из базы.

| Файл | Строка | Находка | Серьёзность |
|---|---|---|---|
| `apps/web/app/(app)/schedule/_components/end-series-dialog.tsx` | 129-134 | текст «Earlier lessons stay» неверен для прошедшего урока, перенесённого с даты позже конца | 🛑 часть gap SC3/SCHED-05 |
| `apps/web/app/(app)/schedule/_components/schedule-toolbar.tsx` | 39-48 | глобальные `t`/`j`/`k` и стрелки на `document` (WR-09) | ⚠️ принято, см. ниже |

## Принятые и отложенные пункты ревью (не блокируют)

По 20-REVIEW-FIX исправлены CR-01, WR-01 (только текст), WR-02..WR-08, WR-11. Намеренно не делались по заданию оркестратора:

| ID | Суть | Где | Примечание |
|---|---|---|---|
| WR-09 | однобуквенные глобальные сочетания `t`/`j`/`k` и стрелки, WCAG 2.1.4; стрелки на фокусированном блоке уводят неделю и теряют фокус | `schedule-toolbar.tsx:39-48` | доступность по решению владельца не углубляется |
| WR-10 | одиночный урок в прошлом создаётся кликом по прошедшей клетке без предупреждения и потом не меняется (D-05, D-16) | `new-lesson-dialog.tsx:118-119`, `schedule.ts:118-130` | прошлая дата у once разрешена UI-SPEC «for later marks»; актуально для отметок фазы 21 |
| IN-01 | подписи второй зоны на полдень понедельника, при смене летнего времени посреди недели ошибка на час | `schedule-format.ts`, `week-grid.tsx:215` | для MSK не проявляется |
| IN-02 | мелочи доступности: `role="alert"` у вопроса с кнопками, висячий `aria-describedby`, aria-label призрака без времени | `lesson-dialog.tsx`, `new-lesson-dialog.tsx`, `lesson-block.tsx` | |
| IN-03 | «Series added»/«Series moved» без «VN (… MSK)», «None» вместо «none» D-13 | `new-lesson-dialog.tsx`, `move-series-dialog.tsx`, `students-screen.tsx:124` | за Design dude |
| IN-04 | смысл `starts_at` у `cancelled`/`restored` | `changes.ts:82-93` | закрыт CR-01: `restored` и простой `cancelled` обнуляют время, `cancelled` после переноса хранит время переноса (D-17) |
| IN-05 | `studentStatus` в контракте не читается, серии архивных учеников идут бесконечно | `contracts/src/schedule.ts`, `schedule.ts:67-84` | решение владельца |
| IN-06 | убран 32px фэйд у всплывающих списков | `apps/web/lib/popup.ts` | за Design dude (20-03 п.1) |
| IN-07 | `blocksOn` глотает ошибку чтения, предупреждение о пересечении молча не появляется | `schedule-screen.tsx:155-171` | |
| IN-08 | дата не из серии в маршруте вхождения даёт 409 вместо 404 | `routes/schedule.ts:77-82`, `changes.ts` | |
| IN-09 | students импортирует `useSecondZone` из папки маршрута schedule | `students-screen.tsx` | |
| IN-10 | privacy-check без списка имён молча пропускает коммит, `--install` перезаписывает хук | `scripts/privacy-check.mjs` | инструмент |
| INFO-20-01 | `expectedStartsAt` необязателен в контракте | `contracts/src/schedule.ts:25` | web шлёт всегда |
| INFO-20-03 | одно имя из приватного списка в `ROADMAP.md:247` и `REQUIREMENTS.md:87` (до фазы, уже в master) | | решение владельца |

## Ручные пункты (не блокируют сами по себе)

1. **Встроенный браузер.** Приёмка UI шла через Playwright (`schedule-web.mjs` fade/frame/read/changes/students, обе темы, все `_OK` у оркестратора и в 20-REVIEW-FIX). Встроенным браузером не проверялось. Отдельно в браузере не проверены подсказка «Choose a time later than now.» в форме переноса и ошибка у поля From в Move series (20-REVIEW-FIX).
2. **Design dude** (артефакт исполнителям был недоступен, сборка по Amendments UI-SPEC и лаборатории):
   - 20-03: фэйд списков 48px или 32px; триггер TimePicker и `text-box:trim`; высота TimePickerInput 28px; полшаги `p-1.5`; фэйд колонок TimePicker.
   - 20-05: единственный вид «Week»; шкала шрифта даты и подписей; столбец сегодня `bg-hover`; сутки 00:00-24:00 и открытие на 08:00 вместо 9:00-22:00 артефакта (D-10); первая строка гаттера; выбор зоны на Base UI Combobox.Trigger; попап не прокручивается к выбранной зоне; 320px; засечки шапки.
   - 20-07: блоки Cancelled и Moved; обрезка коротких блоков; текст «0 lessons with 0 students · 1 cancelled»; высота сетки; положение подсказки; формат DateField en-US; кнопки пары.
   - 20-08: футер LessonDialog и «Whole series», MoveSeriesDialog, EndSeriesDialog; занятые слоты в TimePicker; перенос кнопок на lg; Return to schedule во время запроса; красная рамка TimePicker; перенос строки «было → стало»; расположение ошибок и баннеров.
   - 20-09: вкладки без Paused и All; «UTC+13» против «+13» в Next lesson; `py-1` ячейки; фон полосы вкладок.
   - 20-TP: время серии во второй зоне; подпись под Start time; VN в 4px от сетки; стопки TimePair; метка VN в Next lesson.
   - D-18: ScheduleAgenda (ниже `lg`) не строилась, телефон в фазе 23.
3. **Владелец:** INFO-20-03 (имя в ROADMAP/REQUIREMENTS на master), IN-05 (серии архивных учеников).

## Сводка пробелов

Один пробел, корень один: асимметрия End series и Move series по отношению к перенесённым на более ранний день вхождениям. Move series (`cutSeries`) переводит moved-исключения хвоста в строки `lessons`, End series (`endSeriesAt`/`endSeries`) только ставит `ends_on`, и `occurrenceAt` скрывает исключения с `original_on` позже `ends_on`. Для будущих уроков это совпадает с буквой D-16 и с новой подсказкой диалога. Но если такой урок уже прошёл (перенесли урок следующей недели на четверг, четверг прошёл, в выходные закончили серию), проведённый урок пропадает из прошлой недели. Это прямо противоречит SC3 («past lessons, including those of an ended series, stay exactly as they were») и SCHED-05. Строка в базе цела, так что данные не потеряны, но фаза 21 будет считать отметки через `occurrenceAt` и урока не увидит.

Минимальное исправление: в `endSeries` по образцу `moveSeries` переводить в `lessons` moved-исключения с `original_on > endsOn` (и, по желанию, отменённые с временем), без удаления строк исключений; добавить сценарий в `schedule-core.mjs`/`schedule-api.mjs changes`.

Если владелец уже решил оставить поведение по D-16 и для прошедших уроков, это можно принять одной записью во frontmatter:

```yaml
overrides:
  - must_have: "SC3 / SCHED-05: прошлые уроки, в том числе уроки закончившейся серии, остаются ровно такими, какими были"
    reason: "D-16: исключения с original_on позже ends_on остаются в базе как история и не показываются; прошедший перенесённый вперёд урок после End series скрывается осознанно"
    accepted_by: "<владелец>"
    accepted_at: "<ISO timestamp>"
```

---

_Проверено: 2026-10-10T11:02:59Z_
_Верификатор: Claude (gsd-verifier)_
