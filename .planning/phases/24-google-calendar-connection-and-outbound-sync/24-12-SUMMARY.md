---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '12'
subsystem: ui
tags: [google-calendar, commands, recovery, nextjs, playwright]
status: halted
source-status: complete
source-review: unverified
real-runtime: unverified
requires:
  - phase: 24-02
    provides: Публичные Calendar DTO и состояния команд
  - phase: 24-06
    provides: Provider window, shared read notices и next lesson facts
  - phase: 24-07
    provides: Journal, unresolved list, by-request и explicit recovery
provides:
  - Settings connection controls и shared command recovery
  - Provider window, all-day view и capability gates
  - Подтверждение mutation после applied и свежей projection
affects: [24-11, 24-13, 24-14]
tech-stack:
  added: []
  patterns: [account-scoped command controller, confirmed projection, opaque recovery identifiers]
key-files:
  created:
    - apps/web/components/app/calendar-command-store.ts
    - apps/web/components/app/calendar-command-provider.tsx
    - apps/web/components/app/calendar-command-transport.ts
    - apps/web/app/(app)/schedule/_components/calendar-lesson-dialog.tsx
    - e2e/support/calendar-ui.ts
  modified:
    - apps/web/app/(app)/schedule/_components/schedule-mutations.ts
    - apps/web/app/(app)/schedule/_components/use-schedule-week.ts
    - apps/web/app/(app)/settings/_components/calendar-card.tsx
key-decisions:
  - Captured command generation задаёт identity; текущие connection и target задают подтверждение projection.
  - Saved требует applied, confirmedRevision и завершённого общего refresh.
  - Session storage содержит только requestId и commandId; draft остаётся в памяти.
  - All-day занятость использует zone события и exclusive endsBefore через startOfZonedDay.
requirements-in-scope: [GCAL-01, GCAL-02, GCAL-03, GCAL-09, GCAL-10]
requirements-completed: []
coverage:
  - id: UI-SETTINGS
    description: Подключение, disconnect и recovery в Settings
    verification:
      - kind: e2e
        ref: e2e/calendar-settings.spec.ts
        status: unknown
    human_judgment: false
  - id: UI-WINDOW
    description: Provider window, all-day, external details и blocked gestures
    verification:
      - kind: e2e
        ref: e2e/calendar-view.spec.ts
        status: unknown
    human_judgment: false
  - id: UI-COMMANDS
    description: Pending, correlated apply, explicit recovery и C2
    verification:
      - kind: e2e
        ref: e2e/calendar.spec.ts#calendar confirmed UI
        status: unknown
    human_judgment: false
---

# 24-12 — Текущее состояние UI Calendar

**Settings, provider window и общий command controller подключены к публичным DTO. Подтверждение UI требует applied и свежей projection.**

## Граница результата

- Source revision: `251842a8a2e660404c913bd3144f065e4e0b2764`.
- **Task 1–3 завершены в исходниках.** Student identity получен из обязательного DTO и подключён к ссылке Schedule. Открытых source gaps в owned scope нет.
- **SourceReview: UNVERIFIED для полного плана.** Parent принял исправления `47b305f` и `97cb2c3`: all-day bounds, generation fence, retained fixture guard и сохранение original correlation. Typed student identity caller `9e51f90` также принят. Навигационный E2E delta `251842a` ожидает parent review. Полная приёмка плана этим review не подменяется.
- **RealRuntime / provider / browser: UNVERIFIED.** Runtime lease и grant synthetic PRIMARY этому исполнителю не выданы. Серверы, браузер, SQL fixtures и Google не запускались.
- `source-status: complete` фиксирует завершённый source scope. `status: halted` сохраняет незавершённую runtime-приёмку плана. Это не отказ статических проверок и не разрешение на runtime.
- Full series/cut/conflict acceptance принадлежит 24-11. Общая provider regression принадлежит 24-13; release — 24-14. STATE и ROADMAP остаются у parent.

## Task 1 — Settings и shared command recovery

Settings показывает фактический primary calendar, zone, pending count и server allowedActions. Disconnect и operator confirmation требуют свежего состояния сервера. Ответ mutation сам по себе не подтверждает отключение.

Controller живёт в teacher layout и привязан к account id. Reload и новый mount читают unresolved list. Session storage содержит только opaque UUID. Потерянный POST проверяется через by-request; после 404 разрешён один повтор того же requestId и неизменённого body. После reload draft не отправляется.

Pending, unknown, projection_pending, partial_recovery и recovery_required имеют отдельные состояния. Polling читает статус. Resume выполняется только явным действием при свежем nextAction. Reload и отсоединённый инициатор не создают success toast.

## Task 2 — Provider window

Schedule использует валидированный GoogleScheduleWindow. Fresh empty window, last_known и unavailable различаются. Requested range не переименовывает сохранённое окно. Browser не раскрывает recurrence и не подставляет local future fallback.

Timed events используют overlap lanes. All-day events остаются в отдельной строке и mobile agenda. External и transition details доступны через pointer и keyboard. Они не получают lesson mutations или attendance. Потеря write capability отключает создание и gestures.

Advisory overlap hint учитывает busy all-day events. Начало и exclusive endsBefore преобразуются в instants через `startOfZonedDay(date, event.when.timeZone)`. Нет предположения о 24 часах в дне. `blocksTime=false` и cancelled events исключены. Server conflict resolution остаётся отдельным владельцем.

## Task 3 — Confirmed mutation и C2

202 создаёт pending receipt. Форма остаётся открытой. `applied + confirmedRevision` запускает refresh зарегистрированных projection readers, затем active window readers и последнее фактическое чтение окна. Только после этого живой инициатор получает applied и один success toast.

Перед завершением controller читает актуальную connection. Fresh window должен совпасть по generation и calendar id с этим ответом и последней известной connection. Window generation не может быть меньше captured command generation. Read revision должна достигнуть confirmedRevision. Account, epoch, commandId, requestId, expectedVersion и operation сохраняют отдельную корреляцию. Устаревшие callbacks не публикуют результат и не снимают locks нового mount.

Равенство window generation и captured command generation не требуется. Same-target reconnect увеличивает generation. Server `connection.install` отклоняет другой primary, disconnect сохраняет calendarId, snapshotRevision не сбрасывается. Поэтому для этого fence дополнительный DTO не нужен. При новой generation обновляется connection; ошибка чтения не создаёт бесконечный немедленный retry.

Known failed/effect none сохраняет inputs в памяти. Новое явное Save получает fresh version и новый requestId. View schedule отсоединяет форму без отмены server command. Today и Students подключены к общему refresh. Historical marks сохраняют existing eligible path.

### Student identity

`CalendarEventView.binding` для lesson содержит обязательный `studentId: z.uuid()` вместе с ref и version. Parent commit `aa3ceb6` получает id из уже сохранённого ReadEventRow.studentId. Если lesson mapping не содержит studentId, read model оставляет event external. Новая миграция или DB query не требуются.

`CalendarLessonDialog` строит ссылку из `event.binding.studentId`. Внутренний `LessonTitle.studentId` имеет тип string; ветка отсутствующего id удалена. Caller и series не подменяют target ссылки. Подбор по title и фиктивный ScheduleBlock не используются.

Existing `pendingUi` находит реальный applied single event по affectedRefs и сверяет studentId с retained fixture. Для pointer и keyboard journey открывает dialog, проверяет href и активирует ссылку соответствующим способом. После каждого перехода он проверяет фактический `/students/<actual id>` и существующий heading с именем fixture, затем возвращается через openView для следующего действия. Новый scenario или изменение application code не потребовались. Сценарий остаётся UNVERIFIED до разрешённого functional run.

## Коммиты

| Коммит    | Результат                                                        |
| --------- | ---------------------------------------------------------------- |
| `a518af3` | Settings connection controls и 16 source scenarios               |
| `cfc9206` | Provider window, all-day/external view и durable view journeys   |
| `9a45bb1` | Shared command controller и foundation journeys                  |
| `2be2ae3` | Confirmed mutation forms, Today и Students                       |
| `e371b7e` | Epoch/callback guards и resume source scenario                   |
| `47b305f` | Busy all-day advisory hint и boundary scenario                   |
| `97cb2c3` | Same-target reconnect confirmation, retained fixture и simplify  |
| `9e51f90` | Actual student card link и pointer/keyboard проверки в pendingUi |
| `251842a` | Pointer/keyboard переход по ссылке, actual URL и profile heading |

Разрешённые merge: `d74b6a2` из parent `e5a9001`; `596d3e3` из parent `8d5d182`; `775afd2` из parent `aa3ceb6`. В `596d3e3` разрешён один конфликт импортов `e2e/calendar.spec.ts`. Diff к parent содержит только импорт UI helper и шесть foundation cases; parent cases сохранены. `data.ts`, `prelaunch-sql.ts` и parent read helpers не редактировались исполнителем.

Parent-owned delta `aa3ceb6`: `packages/contracts/src/calendar.ts` — required lesson studentId; `apps/api/src/calendar/read-model.ts` — фактический studentId или fail-closed external; `24-12-PLAN.md` — inventory и failure modes. Parent сообщил contracts/API typecheck exit 0 и scoped quality PASS (`cc727473438cc588555386ccd5f71dbc1d88463e9a13bf0063cd2f71f75ddd74`). Исполнитель не повторял API build.

## Изменённые файлы

38 source/test files относятся к собственным коммитам плана. Parent additions внутри общих файлов сохранены. Этот SUMMARY — отдельный документационный файл.

| Файл                                                                 | Причина                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/web/app/(app)/_components/today-screen.tsx`                    | Передаёт настоящий event и ученика в общий dialog.                       |
| `apps/web/app/(app)/_components/use-today.ts`                        | Регистрирует shared refresh и сохраняет last-known.                      |
| `apps/web/app/(app)/layout.tsx`                                      | Устанавливает controller текущего teacher account.                       |
| `apps/web/app/(app)/schedule/_components/calendar-event-details.tsx` | Показывает безопасные external/transition details.                       |
| `apps/web/app/(app)/schedule/_components/calendar-layout.ts`         | Раскладывает timed overlaps и all-day spans.                             |
| `apps/web/app/(app)/schedule/_components/calendar-lesson-dialog.tsx` | Управляет реальным mapped event без фиктивного ScheduleBlock.            |
| `apps/web/app/(app)/schedule/_components/calendar-overlaps.ts`       | Считает advisory занятость timed и all-day events.                       |
| `apps/web/app/(app)/schedule/_components/end-series-dialog.tsx`      | Ожидает confirmed result перед закрытием.                                |
| `apps/web/app/(app)/schedule/_components/event-tooltip.tsx`          | Отображает provider facts и безопасные details.                          |
| `apps/web/app/(app)/schedule/_components/lesson-block.tsx`           | Даёт pointer/keyboard доступ к provider event.                           |
| `apps/web/app/(app)/schedule/_components/lesson-details.tsx`         | Использует минимальные view props и actual series context.               |
| `apps/web/app/(app)/schedule/_components/lesson-dialog.tsx`          | Сохраняет historical attendance flow.                                    |
| `apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx`         | Разделяет mapped и historical flows; убирает недостижимую проверку null. |
| `apps/web/app/(app)/schedule/_components/lesson-footer.tsx`          | Принимает только фактическое время и capabilities.                       |
| `apps/web/app/(app)/schedule/_components/lesson-move-form.tsx`       | Сохраняет draft и показывает pending/recovery.                           |
| `apps/web/app/(app)/schedule/_components/move-series-dialog.tsx`     | Использует CalendarSeriesContext и общий confirmation flow.              |
| `apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx`      | Получает свежую version перед Save и ждёт applied.                       |
| `apps/web/app/(app)/schedule/_components/schedule-mutations.ts`      | Соединяет preflight, receipt, recovery и live result.                    |
| `apps/web/app/(app)/schedule/_components/schedule-screen.tsx`        | Подключает provider window, recovery и capability gates.                 |
| `apps/web/app/(app)/schedule/_components/use-schedule-week.ts`       | Валидирует покрытие requested range и shared window updates.             |
| `apps/web/app/(app)/schedule/_components/use-slot-drag.ts`           | Прерывает gesture при потере write capability.                           |
| `apps/web/app/(app)/schedule/_components/week-grid.tsx`              | Показывает timed/all-day events и mobile view.                           |
| `apps/web/app/(app)/settings/_components/calendar-card.tsx`          | Показывает connection controls и unresolved commands.                    |
| `apps/web/app/(app)/settings/_components/settings-screen.tsx`        | Добавляет Calendar tab.                                                  |
| `apps/web/app/(app)/students/_components/students-screen.tsx`        | Подключает refresh next lesson facts.                                    |
| `apps/web/components/app/calendar-command-notice.tsx`                | Показывает pending, unknown, failed и explicit-resume copy.              |
| `apps/web/components/app/calendar-command-provider.tsx`              | Связывает account, store, projection и window readers.                   |
| `apps/web/components/app/calendar-command-store.ts`                  | Ведёт identity, polling, exact retry и confirmation fences.              |
| `apps/web/components/app/calendar-command-transport.ts`              | Валидирует HTTP snapshots через api-client.                              |
| `apps/web/components/app/google-calendar-state.tsx`                  | Владеет Settings connection hook; сохраняет parent read notices.         |
| `apps/web/lib/lesson-actions.ts`                                     | Проверяет real event/ref/context и window coverage.                      |
| `apps/web/lib/lesson-mark-text.ts`                                   | Убирает неиспользуемый tooltipDeduction.                                 |
| `apps/web/lib/schedule-format.ts`                                    | Убирает неиспользуемые форматтеры прежней недели.                        |
| `e2e/calendar-settings.spec.ts`                                      | Описывает реальные Settings states и disconnect flows.                   |
| `e2e/calendar-view.spec.ts`                                          | Описывает provider rendering, gates и all-day boundary hint.             |
| `e2e/calendar.spec.ts`                                               | Регистрирует шесть foundation cases и сохраняет parent cases.            |
| `e2e/support/calendar-ui.ts`                                         | Проверяет command flow, actual student navigation, C2 и history marks.   |
| `e2e/support/calendar-view.ts`                                       | Проверяет real view fixtures, details и advisory boundaries.             |

## Проверки

Все процессы завершены с исходным exit status. Typecheck, lint, build, format и scoped quality относятся к `9e51f90`. Для helper-only delta `251842a` выполнены только format, diff check и scoped quality с проверкой типов изменённого helper. Application code не менялся; full quality round и discovery не повторялись. Knip evidence относится к `97cb2c3`; student-link и navigation delta не меняют imports или exports. API findings не переоткрывались.

| Команда                                                                                                                                                                                                                 | Статус       | Краткий результат                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------- |
| `yarn workspace @dv-lab/web typecheck`                                                                                                                                                                                  | PASS, exit 0 | Route types generated; TypeScript diagnostics нет.            |
| `yarn workspace @dv-lab/web lint`                                                                                                                                                                                       | PASS, exit 0 | Diagnostics нет.                                              |
| `yarn workspace @dv-lab/web build`                                                                                                                                                                                      | PASS, exit 0 | Compiled successfully; static pages 11/11.                    |
| `yarn prettier --check apps/web/components/app/calendar-command-store.ts apps/web/components/app/calendar-command-transport.ts e2e/support/calendar-ui.ts 'apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx'` | PASS, exit 0 | All matched files use Prettier code style.                    |
| `git diff --check`                                                                                                                                                                                                      | PASS, exit 0 | Diagnostics нет.                                              |
| `yarn prettier --check 'apps/web/app/(app)/schedule/_components/calendar-lesson-dialog.tsx' e2e/support/calendar-ui.ts`                                                                                                 | PASS, exit 0 | All matched files use Prettier code style.                    |
| `yarn prettier --check e2e/support/calendar-ui.ts`                                                                                                                                                                      | PASS, exit 0 | Navigation helper: All matched files use Prettier code style. |
| `yarn prettier --check .planning/phases/24-google-calendar-connection-and-outbound-sync/24-12-SUMMARY.md`                                                                                                               | PASS, exit 0 | All matched files use Prettier code style.                    |
| `yarn knip`                                                                                                                                                                                                             | FAIL, exit 1 | 1 unused file и 9 exports в API; web/E2E findings нет.        |

Knip findings вне owned scope: `apps/api/src/schedule/series.ts`; `moveOccurrence`, `cancelOccurrence`, `restoreOccurrence`, `moveLesson`, `cancelLesson`, `restoreLesson` из `changes.ts`; `seriesExceptionsFrom`, `seriesMarksFrom` из `rows.ts`; `createLesson` из `schedule.ts`. Файлы не удалялись. Configuration hints не объявлены подтверждёнными findings.

### Quality evidence

Текущее сопоставление: 38/38 source files, 645 function/callback; max CC 21, cognitive 18, Halstead Difficulty 34.65, physical lines 475. Все значения ниже обязательных пределов. Missing или несовпадающих source hashes нет. Aggregate fingerprint: `fea5bbc3d2bd54cefc6c3f7b627fc592d0c95fedcc89bb598346b5548667d781` (SHA256 по отсортированным path + NUL + file SHA256 + LF). Повторно измерен только изменённый helper; остальные значения сохранены при совпадении file hash. Quality tooling измерено отдельно в исходных отчётах; оно не входит в эти 38 файлов.

Метод: Node 24.17.0, TypeScript 6.0.3, ESLint 10.12.0 classic cyclomatic complexity; DVLab AST cognitive v1; Halstead executable AST leaf tokens v1. Imports, type syntax и trivia не являются executable tokens. Explicit/inferred any в проверяемом diff не обнаружены. Unknown разрешён только на проверенных входных границах. Method source hashes, file hashes, line ranges, denominators и ограничения находятся в JSON.

Private evidence в существующем STATE_DIR:

| Файл                                                                                           | Назначение                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `24-settings-proof.json`, `24-settings-quality.json`                                           | Первоначальный Settings scope и точные команды.                                                                                           |
| `24-12-task2-1d75d27-cfc9206-proof.json`, `24-12-task2-1d75d27-04-quality.json`                | Provider view scope и первоначальная проверка.                                                                                            |
| `24-12-task13-quality-08.json`, `24-12-task13-quality-08-command.json`                         | Controller/form wiring, 29 owned files и 3 quality tools.                                                                                 |
| `24-12-resume-quality-03.json`, `24-12-resume-quality-03-command.json`                         | Epoch/callback guards.                                                                                                                    |
| `24-12-all-day-quality-01.json`, `24-12-all-day-quality-01-command.json`                       | 3 all-day files и 3 quality tools; PASS, exit 0.                                                                                          |
| `24-12-confirmation-quality-02.json`, `24-12-confirmation-quality-02-command.json`             | 4 reconnect/fixture/simplify files и 3 tools; PASS, exit 0.                                                                               |
| `24-12-merged-quality-02.json`, `24-12-merged-quality-02-command.json`                         | Актуальные общие Settings/spec files после parent merge.                                                                                  |
| `24-12-current-source-proof.json`                                                              | Предыдущий aggregate proof для `97cb2c3`.                                                                                                 |
| `24-12-student-link-quality-02.json`, `24-12-student-link-quality-02-command.json`             | Student-link delta: 2 owned files и 3 tools, PASS exit 0; fingerprint `bde6407b40f08c91e5319059cf4d18fd365bcc1b8df8df66dbd4874c345fc077`. |
| `24-12-student-link-source-proof.json`                                                         | Предыдущие file fingerprints для `9e51f90`, 38/38 matches.                                                                                |
| `24-12-student-navigation-quality-01.json`, `24-12-student-navigation-quality-01-command.json` | Navigation delta: 1 owned helper и 3 tools, PASS exit 0; fingerprint `5d644885cf268340d917d85320b1be7f8e4f41575f1942e528e39845919e8328`.  |
| `24-12-student-navigation-source-proof.json`                                                   | Current file fingerprints для `251842a`, 38/38 matches.                                                                                   |

`*-command.json` хранит точные argv, cwd и exit для `node scripts/dev-checks/calendar-quality.ts --base ... --json --owned ... --boundary-review ...`. Старый PASS повторно используется только при совпадении source hash. Старые type-input fingerprints не объявляются текущим global type proof. Измерения не доказывают runtime, отсутствие всех dead-code paths или качество provider behavior.

| Изменённая функция                      | CC до → после |
| --------------------------------------- | ------------- |
| `readCalendarOverlaps.flatMap callback` | 4 → 5         |
| `CalendarCommandStore.finish`           | 18 → 19       |
| `readUnresolved`                        | 5 → 4         |
| `LessonDialogs.mark`                    | 4 → 3         |
| `recoveryUi`                            | 4 → 5         |
| `assertResumed`                         | 3 → 4         |
| `LessonContent`                         | 21 → 18       |
| `LessonTitle`                           | 2 → 1         |
| `studentCardLinkUi`                     | 6 → 7         |

Новые функции: `sameConnection` CC 7, `refreshChangedConnection` 4, `readCalendarConnection` 3, `assertCurrentConnection` 3. Для новых функций baseline не придумывается. Промежуточный `finish` с CC 22 исправлен; итоговый report PASS. Simplify применён к owned diff. Новые features, зависимости, комментарии и отдельные test suites этим проходом не добавлены.

Student-link delta: новый `studentCardLinkUi` CC 6. Scoped report содержит 136 functions/callbacks, 44 changed; max CC 18, cognitive 15, Halstead Difficulty 31.0431, lines 469. Первый quality run получил UNVERIFIED из-за одновременной перегенерации `.next/types` сборкой. Последовательный run после успешной build завершился PASS без изменений source. Исходный результат сохранён в `24-12-student-link-quality-01.json`.

Navigation delta: `studentCardLinkUi` CC 6 → 7, cognitive 6 → 9, Halstead Difficulty 21 → 25.3333. Новый URL predicate имеет CC 1. Helper содержит 475 строк. Scoped report включает 123 functions/callbacks в helper и трёх обязательных quality tools; max CC 14, cognitive 13, Halstead Difficulty 28.5071. Missing, stale, type diagnostics и findings нет. Simplify применён к этому diff без дополнительных правок. Точные argv, cwd и exit находятся в `24-12-student-navigation-quality-01-command.json`.

### E2E source и пределы доказательства

Сценарии записаны до поведения. Они используют public UI/API и real persistence/provider responses. Runtime не выполнялся. Исторический discovery: `yarn playwright test e2e/calendar-settings.spec.ts --grep '\[calendar\] settings' --project=light --project=dark --list` — exit 0, 34 tests; `yarn playwright test e2e/calendar-view.spec.ts --grep '\[calendar-view\]' --list` — exit 0, 14 tests; `yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\] complete UI foundation' --list` — exit 0, 14 tests. `--list` не считается functional PASS.

- Ready fixture: 202 не закрывает форму; applied даёт один toast; actual event studentId совпадает с retained fixture; pointer/keyboard активация ссылки приводит к actual student URL и profile heading; Schedule → Today → Students показывают фактические read/revision/next facts.
- Lost POST: фактический lookup 404, затем тот же requestId и byte-identical body. Reload не replay draft.
- Resume fixture: реальная unresolved команда с captured generation меньше текущей, тот же target; explicit Resume один раз; unchanged command identity; applied + fresh revision; reload без toast.
- Failed-none fixture: inputs сохранены, второе явное Save использует новый requestId и actual fresh version.
- Blocked fixture: UI gestures запрещены; реальная eligible history mark остаётся доступной. Command_pending требует наблюдаемую unresolved command.
- All-day fixture: отдельные busy all-day и available events, отсутствие посторонней занятости в проверяемых интервалах; точное начало, последний час и exclusive end. Cancelled exclusion проверен в source; реальный DST-crossing provider run остаётся UNVERIFIED.

`calendar-ui.json` обязан совпасть с origin, build, persistence и teacher account; содержать действующую authority и неистёкший срок. `retainedStudent` проверяется до command/fixture writes. Публичные ответы не заменяются выдуманными successful DTO.

После runtime lease, target attestation, retained fixtures и synthetic PRIMARY grant запускать один подготовленный scenario за раз. Пример rerun:

```sh
E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\] complete UI foundation recovery resumes only by explicit current action' --project=light --project=dark
E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar-view.spec.ts --grep '\[calendar-view\] draft hints include busy all-day boundaries and exclude available events' --project=light --project=dark
```

Одна provider fixture не подходит ко всем перечисленным состояниям. Run evidence должен записать source/build fingerprint, scenario, fixture reference, expected/observed result, exit, target/persistence identity и rerun command без secrets или пользовательского содержимого.

## Следующие действия владельцев

1. Parent: проверить navigation journey `251842a`; принятые student identity caller, generation и all-day claims не пересматривать без нового evidence.
2. Parent: завершить SourceReview всего 24-12 и согласовать runtime lease с provider owner.
3. Runtime owner: выполнить применимые Settings/view/foundation journeys, сохранить evidence; затем снять halted и обновить acceptance metadata.
