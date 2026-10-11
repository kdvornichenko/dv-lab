---
phase: 21-lesson-accounting-and-today
plan: 12
subsystem: docs
status: complete
tags: [ledger, today, module-owners, runbook, deployment]
requires:
  - phase: 21-lesson-accounting-and-today
    provides: схема и миграции 21-01; API и web 21-07..21-11; правила и контракт 21-14..21-17
  - phase: 20-schedule
    provides: RUNBOOK и образец передачи релиза в 20-10
provides:
  - оператор выката и граница шагов с паролем или токеном
  - владельцы остатка, исхода урока, отметок, Today и settings
  - инструкция релиза с двумя миграциями, проверками и последствиями отката
affects: [21-13, 21-18, chat, google-calendar, deployment]
tech-stack:
  added: []
  patterns: [один владелец каждого правила в core; парные образы api и web]
key-files:
  created:
    - .planning/phases/21-lesson-accounting-and-today/21-12-SUMMARY.md
  modified:
    - deploy/RUNBOOK.md
    - AGENTS.md
key-decisions:
  - Серверные шаги ведёт Server guy; шаги RUNBOOK 10.3, 10.5 и 4.2 с паролем или токеном выполняет владелец
  - Владельцы и поведение описаны по текущему коду, включая D-17 и сохранение отмеченного хвоста серии
requirements-completed: [LEDG-08]
actuals:
  tokens: 9966
  tasks: 2
  commits: 2
plan_head_before: abae8168e3c27e118dd68d8825dd96eb93fcb8d1
plan_head_after: d754018c8442e105e8899a5ccb884cecbfd09bb2
duration: 8 min
completed: 2026-10-11
---

# Phase 21 Plan 12: Владельцы учёта уроков и выкат Summary

Server guy получил порядок выката учёта уроков; AGENTS.md закрепляет владельцев остатка, отметок, Today и настроек по текущим символам кода.

## Результат

- RUNBOOK, строка 3: оператор — Server guy или владелец. Разделы 4.2, 10.3 и 10.5 явно поручены владельцу. Напечатанный пароль сохраняет владелец; передача пароля от оператора убрана.
- RUNBOOK, раздел 12: две миграции, один SHA для api и web, перезагрузка вкладок, ожидаемые HTTP-ответы и права, последствия отката и восстановления дампа.
- AGENTS.md: правило остатка и Today в core; исход и действия через `lessonActions`; API-владельцы `schedule`, `cards/card-facts`, `today`, `settings`; общий `LessonDialogs`, `markLesson`, `TimeZonePicker` и текущие разделы приёмочных скриптов.
- Разрез и окончание серии сохраняют перенесённые и отмеченные вхождения хвоста, включая отмеченные `restored` и `cancelled`. `series.ts` копирует отметку в одиночный урок и сохраняет отмену. Повторный разрез пустой серии возвращает `409 lesson_changed` через `hasOccurrences` из core.

## Коммиты задач

1. `20f5788` — `docs(21-12): Уточнил оператора и порядок выката учёта уроков`.
2. `d754018` — `docs(21-12): Описал владельцев учёта уроков и Today`.

Оба коммита атомарные. Каждый содержит один документ и трейлер `Co-Authored-By: Codex <noreply@openai.com>`. Коммит этого SUMMARY выполняется отдельно.

## Изменённые файлы

- `deploy/RUNBOOK.md` — оператор, шаги с секретами и инструкция релиза.
- `AGENTS.md` — текущие владельцы правил, таблиц, web и скриптов.
- `.planning/phases/21-lesson-accounting-and-today/21-12-SUMMARY.md` — результат, проверка, выкат и точные замены для parent.

## Для выката

Это ожидаемый чек-лист релиза для Server guy. HTTP, привилегии и production в плане 21-12 не проверялись.

1. Миграции релиза: `20261010145713_lesson_marks` добавляет `lesson_marks`, `teacher_settings` и `students.no_show_deducts` с `DEFAULT true`; `20261010145724_lesson_marks_revoke_delete` отзывает `DELETE, TRUNCATE` на `lesson_marks` у `dvlab_app`. Объекты не удаляются и не переименовываются. Миграции применяет отдельный этап `migrate` из образа api под `dvlab_migrator`. `deploy.sh` снимает и проверяет дамп и проверяет миграции на временной копии до переключения приложений.
2. Откат кодом (R8): вернуть api и web вместе на один прежний `sha-<полный sha>`. Таблицы и колонка остаются; код до учёта уроков их не читает, новая карточка получает `no_show_deducts = true` по DEFAULT. Остатки вырастут на сумму действующих вычетов за отметки. Отмена и выключенный флаг No-show исключают соответствующие вычеты. Отметки при откате кода не теряются. Повторный выкат кода учёта возвращает расчёт с отметками. После отката вкладки также перезагружаются.
3. Восстановление дампа до выката теряет все изменения после создания дампа, включая отметки уроков и изменения порога Pays soon. Решение принимает владелец с учётом этой потери данных.
4. После деплоя (R7): авторизованный `GET /api/today` должен дать `200` и JSON с `date`, `lessons`, `earlier`, `series`, `paysSoon`, `paysSoonLessons`. `GET /api/settings` должен дать `200` и `{ settings: { paysSoonLessons } }`; без строки настроек порог равен `2`. Server guy проверяет `has_table_privilege('dvlab_app', 'public.lesson_marks', 'DELETE') = false` и то же для `TRUNCATE`. Для `public.teacher_settings` ожидается `true` для `SELECT`, `INSERT`, `UPDATE`, необходимых upsert. `DELETE` и `TRUNCATE` у `teacher_settings` намеренно не отзываются. Передаются только статусы, результат проверки структуры и булевы результаты прав; тела ответов с данными карточек не пересылаются.
5. Перезагрузка после выката обязательна (R2). В ответе недели у блока нет `status` и `changeable`; доступны `outcome`, `actions`, `ledger`, `mark`. Старый JavaScript несовместим с этим контрактом. Api и web выкатываются с одним SHA; владелец перезагружает все открытые вкладки приложения.
6. Выкатку, миграции и серверные проверки ведёт Server guy. Релиз не требует отдельного шага с паролем или токеном. Шаги RUNBOOK 10.3, 10.5 и 4.2, если они нужны, выполняет владелец. После выката владелец перезагружает вкладки, проверяет Today и вводит начальные балансы карточек. Ручной календарный UAT отложен до полной синхронизации Google в фазах 24-25.
7. Дата оплаты и открывающего остатка принимается не позже сегодняшней даты в `Asia/Ho_Chi_Minh` (D-12i). Предыдущая граница проверки оплаты — UTC плюс сутки; релиз делает её строже. Это изменение проверки ввода, а не миграция сохранённых дат.

## Замены для parent

STATE и ROADMAP принадлежат parent. Ниже точные строки и замены. Суффиксы о серверном профиле сохранены.

### `.planning/ROADMAP.md:79`

Текущая строка:

```text
**Notes**: Server steps are run by the owner through the separate "Server guy" session; agents have no server access. Traps and the bio-exam reference setup are in `~/.claude/servers/dv-lab.md`.
```

Замена:

```text
**Notes**: The operator is Server guy (VPS access by key; DNS through the owner's personal Vercel CLI) or the owner. Steps that print a password or require a token (RUNBOOK 10.3, 10.5, 4.2) are performed by the owner. Traps and the bio-exam reference setup are in `~/.claude/servers/dv-lab.md`.
```

### `.planning/STATE.md:95`

Текущая строка:

```text
- [Phase 17] Server steps are run by the owner through the "Server guy" session. Traps in `~/.claude/servers/dv-lab.md`: PostgreSQL 18 volume path, Docker ports bypassing ufw, HTTP/3 off, CI trigger on `master` instead of `main`, `next/font/google` downloads at build time, API hang on `SIGTERM`.
```

Замена:

```text
- [Phase 17] The operator is Server guy (VPS access by key; DNS through the owner's personal Vercel CLI) or the owner. Steps that print a password or require a token (RUNBOOK 10.3, 10.5, 4.2) are performed by the owner. Traps in `~/.claude/servers/dv-lab.md`: PostgreSQL 18 volume path, Docker ports bypassing ufw, HTTP/3 off, CI trigger on `master` instead of `main`, `next/font/google` downloads at build time, API hang on `SIGTERM`.
```

Parent также обновляет progress и LEDG-08 и выполняет push. План 21-12 не меняет STATE, ROADMAP, HANDOFF, config или чужие файлы.

## Проверка

Все команды выполнялись из ROOT фазы. Процессы завершились с указанными кодами. Ожидаемые отрицательные поиски сохранены как код `1`.

- `bash scripts/gsd/root-pin.sh /Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today` — код `0`, `ROOT_PIN_OK` перед первой правкой и коммитами.
- `node /Users/kdvornichenko/.codex/gsd-core/bin/gsd-tools.cjs query git.base-branch --is-protected gsd/phase-21-lesson-accounting-and-today` — код `0`, `false`. ROOT, symbolic HEAD и sentinel совпали с веткой фазы.
- `git apply --check --whitespace=error /private/tmp/dv-lab-phase21-parallel/21-12-task1.patch /private/tmp/dv-lab-phase21-parallel/21-12-task2.patch` — код `0`. Исходные SHA-256 совпали с подготовкой. Изменённые после подготовки владельцы пересверены с текущим кодом.
- `grep -c "Оператор — Server guy" deploy/RUNBOOK.md` — код `0`, `1`.
- `grep -c "(10.3, 10.5, 4.2)" deploy/RUNBOOK.md` — код `0`, `1`. Обе проверки повторены после tracer-коммита; задача 2 начата после их успеха.
- `grep -c "У агентов доступа" deploy/RUNBOOK.md` — код `1`, `0`.
- `grep -c "lesson_marks" AGENTS.md` — код `0`, `2`.
- `grep -c "studentBalance" AGENTS.md` — код `0`, `2`.
- `grep -c "apps/api/src/today" AGENTS.md` — код `0`, `1`.
- `grep -nE "раньше|было|планировали|теперь" AGENTS.md` — код `1`, без совпадений.
- `grep -c "ledger-web.mjs" AGENTS.md` — код `0`, `1`.
- `grep -c "time-zone-picker" AGENTS.md` — код `0`, `1`.
- `yarn exec prettier --check AGENTS.md deploy/RUNBOOK.md` — код `0`, `All matched files use Prettier code style!` (Prettier 3.9.9). Первичная проверка RUNBOOK дала код `1`; формат добавленных таблиц исправлен. Исходный RUNBOOK соответствовал Prettier.
- `git diff --check -- AGENTS.md` и `git diff --cached --check -- deploy/RUNBOOK.md` — код `0`, без ошибок.
- `node scripts/privacy-check.mjs` — код `0` перед коммитами. Проверка добавленных строк на адреса и значения секретов — код `0`, `ADDED_DOC_ADDRESS_SECRET_PATTERN_OK`; строки просмотрены, данных учеников нет.
- `git grep -n -e 'Server steps are run' -- .planning/ROADMAP.md .planning/STATE.md` — код `0`, строки `79` и `95`; замены приведены выше.
- `git show --first-parent --diff-filter=D --name-only --pretty=format: 20f5788` и та же команда для `d754018` — код `0`, удалений файлов нет.

Сверка символов с кодом, код `0` у обеих команд:

```bash
git grep -n -E 'function (studentBalance|countsAfterOpening|lessonDeduction|markEffect|needsMark|todayCounts|lessonOutcome|occurrenceOutcome|countsAsLesson|isMarked|lessonActions|awaitsMark|withOutcomes|scheduleToday|scheduleDate|isAfterScheduleToday|hasOccurrences|cutSeries|endSeriesAt|balanceState|paysSoon|paysSoonList|balancePhrase|windowDates)|PAYS_SOON_LESSONS_DEFAULT' -- packages/core/src/balance.ts packages/core/src/schedule.ts packages/core/src/lessons.ts packages/core/src/zoned.ts
git grep -n -E '^(export )?(async )?function (readWindow|lockSeries|lockLesson|toMarkKind|toBalanceCard|loadMarkRows|readToday|readPaysSoonLessons|savePaysSoonLessons|TimeZonePicker|useMinuteNow|mutate|markLesson|LessonDialogs)|type Mirror|MARK_KINDS|function zoneLabel' -- apps/api/src/schedule/rows.ts apps/api/src/schedule/schedule.ts apps/api/src/today/today.ts apps/api/src/settings/settings.ts 'apps/web/app/(app)/_components/use-minute-now.ts' 'apps/web/app/(app)/schedule/_components/schedule-mutations.ts' 'apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx' apps/web/components/app/time-zone-picker.tsx apps/web/lib/time-zones.ts
```

Найдены все перечисленные символы в указанных владельцах. `LessonDialogs` вызывается из Today и расписания. `ledger-web.mjs` содержит разделы `marks`, `students`, `settings`, `today`, `today-marks`, `today-payment`; `schedule-web.mjs` содержит `grid`, `forms`, `zones`, `settings`, `drag`. Проверка 26 полных путей из добавленных строк AGENTS дала `OWNED_DOC_PATHS_OK 26`. Имена и разделы относительных помощников сверены с их файлами. Runtime этих скриптов не запускался.

Функциональные тесты, E2E, dev, build, install, SQL и production не входят в проверку документационного плана. Метрики кода не применяются к изменённым документам. Применены правила writing-for-agents и simplify; код и комментарии кода не изменены. Новых security surfaces и известных заглушек этот план не вводит.

## Fingerprints и actuals

- `AGENTS.md`: SHA-256 `a0a28ecbaa563a69cf19cc366dc0e0486f299fd384cd2bb2c2b88ce1396ac03f`.
- `deploy/RUNBOOK.md`: SHA-256 `5d5ec5d6bcf52c77b82f050995f5b11b93b47817133004ac9a39984fab23c0fa`.
- Ledger: Git dir worktree, `gsd-plan-head-before-21-12`. `git rev-list --count abae8168e3c27e118dd68d8825dd96eb93fcb8d1..d754018c8442e105e8899a5ccb884cecbfd09bb2` — `2` коммита задач. Последний коммит только SUMMARY учитывается отдельно.
- `actuals.tokens`: `ceil(chars / 4)` по реализованному Git diff трёх файлов от `plan_head_before`, включая этот SUMMARY. Это шкала estimateTokens, не расход токенов модели. Только diff двух документов до SUMMARY содержит 25011 символов.
- Начало измерения: `2026-10-11T04:18:46Z`.
- Завершение задач и self-check: `2026-10-11T04:26:28Z`.

## Deviations from Plan

1. **[Rule 1 — Bug] Сохранение отметок хвоста описано по текущему коду.** AGENTS охватывает отмеченные `restored`, `cancelled` и обычные вхождения, наряду с перенесёнными, при разрезе и окончании серии. Подтверждено `preservedLessons`, `seriesMarksFrom`, `keepCutLessons` и поправкой `fbe2af0`. Коммит `d754018`.
2. **[Rule 2 — Critical] Документировано правило пустой серии.** Повторный разрез отклоняется через общий `hasOccurrences` с `409 lesson_changed`, по поправке `abae816`. Коммит `d754018`.
3. **Адаптация протокола к текущим инструкциям.** Совместная ветка фазы и ROOT заданы parent и EXECUTOR-RULES. Использован native Codex и трейлер OpenAI. Чужие untracked `apps/web/AGENTS.md`, `.planning/state.json`, `.planning/milestone.lock` сохранены. STATE, ROADMAP, HANDOFF и config остаются у parent. Генераторы, удаления и blanket restore не выполнялись.

## Готовность следующего плана

Следующий план — 21-13. Он владеет итоговыми проверками фазы; parent завершает review fixes web и progress/push. Этот SUMMARY подтверждает документацию LEDG-08, а не готовность всего runtime или production.

21-18 владеет постоянным E2E. Подготовленный TypeScript draft в TMP не считается установленной suite или выполненным тестом; наличие команды `test:e2e` не заявляется. Ручной календарный UAT остаётся отложенным до Google 24-25.

## Self-Check: PASSED

- Три файла результата существуют; коммиты `20f5788` и `d754018` — предки HEAD.
- Проверены семь пунктов выката, обе миграции и точные замены ROADMAP/STATE: `SUMMARY_RELEASE_7_OK; SUMMARY_PARENT_REPLACEMENTS_OK; SELF_CHECK_FILES_3_COMMITS_2_OK`, код `0`.
- Коммиты задач не удаляют файлы. Изменены только документы плана. Чужие untracked файлы сохранены; процессы этого плана не запускались.
