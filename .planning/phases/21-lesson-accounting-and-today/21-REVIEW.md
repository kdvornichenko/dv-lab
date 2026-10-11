---
phase: 21-lesson-accounting-and-today
reviewed: 2026-10-11T09:07:16Z
depth: standard
review_kind: completed_existing_review
source_snapshot: 8c3cb5d8c01ed22f8512b66a155756d01c153430
base: b32615eccbee33eff75e5963d89480db2207d87c
files_reviewed: 79
files_reviewed_list:
  - apps/api/src/app.ts
  - apps/api/src/cards/card-facts.ts
  - apps/api/src/cards/card-rows.ts
  - apps/api/src/cards/cards.ts
  - apps/api/src/routes/payments.ts
  - apps/api/src/routes/schedule.ts
  - apps/api/src/routes/settings.ts
  - apps/api/src/routes/students.ts
  - apps/api/src/routes/today.ts
  - apps/api/src/schedule/changes.ts
  - apps/api/src/schedule/marks.ts
  - apps/api/src/schedule/rows.ts
  - apps/api/src/schedule/schedule.ts
  - apps/api/src/schedule/series.ts
  - apps/api/src/settings/settings.ts
  - apps/api/src/today/today.ts
  - apps/web/app/(app)/_components/due-list.tsx
  - apps/web/app/(app)/_components/sections.ts
  - apps/web/app/(app)/_components/today-lessons.tsx
  - apps/web/app/(app)/_components/today-mark-controls.tsx
  - apps/web/app/(app)/_components/today-screen.tsx
  - apps/web/app/(app)/_components/use-minute-now.ts
  - apps/web/app/(app)/page.tsx
  - apps/web/app/(app)/schedule/_components/end-series-dialog.tsx
  - apps/web/app/(app)/schedule/_components/event-tooltip.tsx
  - apps/web/app/(app)/schedule/_components/lesson-block.tsx
  - apps/web/app/(app)/schedule/_components/lesson-dialog.tsx
  - apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx
  - apps/web/app/(app)/schedule/_components/lesson-mark-row.tsx
  - apps/web/app/(app)/schedule/_components/lesson-move-form.tsx
  - apps/web/app/(app)/schedule/_components/move-series-dialog.tsx
  - apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx
  - apps/web/app/(app)/schedule/_components/schedule-mutations.ts
  - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
  - apps/web/app/(app)/schedule/_components/schedule-toolbar.tsx
  - apps/web/app/(app)/schedule/_components/week-grid.tsx
  - apps/web/app/(app)/settings/_components/payments-card.tsx
  - apps/web/app/(app)/settings/_components/settings-screen.tsx
  - apps/web/app/(app)/settings/page.tsx
  - apps/web/app/(app)/students/[id]/_components/opening-balance-panel.tsx
  - apps/web/app/(app)/students/[id]/_components/overview-tab.tsx
  - apps/web/app/(app)/students/[id]/_components/payment-student-picker.tsx
  - apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx
  - apps/web/app/(app)/students/[id]/_components/student-profile.tsx
  - apps/web/app/(app)/students/_components/student-form-dialog.tsx
  - apps/web/app/(app)/students/_components/students-screen.tsx
  - apps/web/components/app/date-field.tsx
  - apps/web/components/app/empty-state.tsx
  - apps/web/components/app/layout-parts.tsx
  - apps/web/components/app/ledger-text.tsx
  - apps/web/components/app/stat.tsx
  - apps/web/components/app/status-dot.tsx
  - apps/web/components/app/student-balance.tsx
  - apps/web/components/app/time-zone-picker.tsx
  - apps/web/components/ui/combobox.tsx
  - apps/web/components/ui/dropdown.tsx
  - apps/web/components/ui/select.tsx
  - apps/web/components/ui/switch.tsx
  - apps/web/components/ui/time-picker.tsx
  - apps/web/lib/lesson-mark-text.ts
  - apps/web/lib/popup.ts
  - apps/web/lib/schedule-format.ts
  - apps/web/lib/time-zones.ts
  - apps/web/package.json
  - knip.json
  - package.json
  - packages/contracts/src/auth.ts
  - packages/contracts/src/index.ts
  - packages/contracts/src/schedule.ts
  - packages/contracts/src/settings.ts
  - packages/contracts/src/students.ts
  - packages/contracts/src/today.ts
  - packages/contracts/test/auth.test.ts
  - packages/core/src/balance.ts
  - packages/core/src/lessons.ts
  - packages/core/src/schedule.ts
  - packages/db/drizzle/20261010145713_lesson_marks/migration.sql
  - packages/db/drizzle/20261010145724_lesson_marks_revoke_delete/migration.sql
  - packages/db/src/schema.ts
findings:
  critical: 6
  warning: 9
  info: 1
  total: 16
original_findings:
  critical: 6
  warning: 10
  info: 0
  total: 16
dispositions:
  fixed: 11
  skipped: 4
  deferred: 1
  open: 0
status: issues_found
---

# Фаза 21: итоговый code review

## Итог и граница

Существующий review завершён на `8c3cb5d8c01ed22f8512b66a155756d01c153430`. Все 16 claims имеют disposition: **11 fixed, 4 skipped, 1 deferred, 0 open**. Новых findings нет. `issues_found` и severity counts сохраняют историю claims; это не количество текущих открытых дефектов. Severity нормализована в critical/warning/info; исходный BLOCKER соответствует critical. Единственное понижение — FE-WR-08, WARNING → INFO. Четыре skipped содержат три отвергнутых обязательных требования и один неподтверждённый файловый Halstead gate.

Это завершение принятого review, без нового полного аудита. Исходный scope — 75 путей из backend/frontend review. Узкий delta добавляет layout-parts и три config-файла; остальные product-файлы delta уже входили в scope. Proof-only fingerprints и отчёты helpers/E2E имеют отдельные denominators ниже. UI, security и architecture остаются отдельными отчётами своих владельцев. Code review не объявляет manual UAT или всю фазу завершённой вместо verifier.

Источник решений — существующий [candidate](/private/tmp/dv-lab-phase21-parallel/21-review-candidate.md), исходные review/refutation и принятые исключения. Канонический ledger — [21-REVIEW-DISPOSITION.md](21-REVIEW-DISPOSITION.md). Изменения ограничены двумя этими Markdown-файлами.

## Narrative Findings (AI reviewer)

Ниже сохранены все 16 исходных claims, включая refuted и deferred. Для skipped указан наблюдаемый факт и причина отсутствия обязательного patch. Ссылки source обозначают owner/участок текущего кода; первоначальные точные строки и snapshots сохранены в исходных отчётах.

### BE-CR-01 — Сохранение отметки хвоста при cut/end

**Severity:** critical. **Disposition:** fixed.

**Origin:** Новая достижимая комбинация D-17 в прежнем cut/end. Исходный CR-01 — BLOCKER; backend refutation его отдельно не проверяла.

**Source:** [packages/core/src/schedule.ts](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/packages/core/src/schedule.ts:342).

**Решение:** `fbe2af0`: marks загружаются до изменения границы; preservedLessons сохраняет отмеченные restored и cancelled history; отметка копируется на одиночный lesson в той же транзакции.

**Доказательство:** 21-18 move journey: Done/No-show × cut/end для restored tail; один действующий отмеченный блок, прежняя отметка и остаток 120 минут. PASS light/dark в `21-18-journeys.log`; source core SHA совпадает с сохранённым исправлением.

### BE-CR-02 — Повторный cut пустой серии

**Severity:** critical. **Disposition:** fixed.

**Origin:** Унаследованный дефект затронутого core. CR-02 / BLOCKER подтверждён backend refutation.

**Source:** [packages/core/src/schedule.ts](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/packages/core/src/schedule.ts:379).

**Решение:** `abae816`: guard !hasOccurrences(rule) возвращает changed до расчёта и insert. Существующие lock/transaction и ответ 409 lesson_changed сохранены.

**Доказательство:** 21-18 move journey повторяет cut по старому ID: 409, второй серии нет, первый результат не меняется. PASS light/dark в `21-18-journeys.log`.

### BE-CR-03 — Расширение диапазона week-read

**Severity:** critical. **Disposition:** skipped.

**Origin:** Унаследованная граница чтения в сочетании с D-17. Исходный CR-03 / BLOCKER отвергнут как обязательное новое требование.

**Source:** [apps/api/src/routes/schedule.ts](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/api/src/routes/schedule.ts:42).

**Решение:** Без patch. `20-04-PLAN.md:31–32,125` явно задаёт 400 вне 2000-01-03…2100-12-27. D-17 не меняет browsing contract.

**Доказательство:** BE-refutation:17,31–37. Сохранить дату вне читаемой календарной недели возможно; это ограничение сохранено явно. Удаление констант и новый диапазон не включены в фазу.

### BE-WR-01 — Cognitive complexity scheduleWindow

**Severity:** warning. **Disposition:** fixed.

**Origin:** Унаследованный gate gap; исходный WR-01 / WARNING подтверждён backend refutation.

**Source:** [packages/core/src/schedule.ts](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/packages/core/src/schedule.ts:205).

**Решение:** `0337da2`: naturalBlock и destinationBlock выделены без изменения guards, keys, данных и порядка блоков.

**Доказательство:** Найден существующий `21-schedule-window-simplify.md`: scheduleWindow CC 17→13, cognitive 29→18, function D 34.86→23.54. Финальный virtual-source SHA `31c52b395caf57e5461a513d5bca26b185c9f209f7fcee039bf43dd2a331f691` совпал с текущим core. Existing schedule-core/read/changes прошли в 21-13; последующие changes light/dark по 109 assertions прошли по type-followup. Повторного scan нет.

### BE-WR-02 — Файловый Halstead как обязательный gate

**Severity:** warning. **Disposition:** skipped.

**Origin:** Смешанный origin: rows file D 75.96→98.10; core schedule 139.23→133.39. Исходный WR-02 / WARNING не доказан для файлового знаменателя.

**Source:** [apps/api/src/schedule/rows.ts](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/api/src/schedule/rows.ts:1).

**Решение:** Без разделения модулей ради Dfile. Принятая единица фактического gate — функция/callback; file aggregates остаются диагностикой.

**Доказательство:** BE-refutation:19,52–58. Исходный max function D 40.19; финальный core function measurement см. BE-WR-01. File-level 98.10/133.39 не переименованы в PASS. Порог <80 не изменён.

### FE-CR-01 — Ввод порога во время PATCH

**Severity:** critical. **Disposition:** fixed.

**Origin:** Новый Settings Payments flow фазы. FE-CR-01 / BLOCKER подтверждён frontend refutation.

**Source:** [apps/web/app/(app)/settings/_components/payments-card.tsx](</Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/web/app/(app)/settings/_components/payments-card.tsx:140>).

**Решение:** `126a529`: saving блокирует поле до завершения PATCH; inflight guard сохранён.

**Доказательство:** 21-18 Pays soon journey: задержан реальный PATCH; поле disabled, после ответа разрешён новый ввод и второе сохранение. PASS light/dark в `21-18-today-final.log`. Исправленный product blob не менялся после candidate.

### FE-CR-02 — Обновление actions на границе времени

**Severity:** critical. **Disposition:** fixed.

**Origin:** Новая mark/series семантика поверх прежнего минутного clock. FE-CR-02 / BLOCKER подтверждён frontend refutation.

**Source:** [apps/web/lib/lesson-actions.ts](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/web/lib/lesson-actions.ts:4).

**Решение:** `126a529`: сравнение обеих core actions, mark и series, вызывает перечитывание Schedule/Today.

**Доказательство:** 21-18 real-clock journey прошёл light/dark: первая отметка становится доступна после начала; Whole series у уже отмеченного будущего урока отключается после начала. Связанный 21-13 C13_START_BOUNDARY_OK также PASS. Поздний Today diff меняет только opacity и удаляет reduced hook; сравнение actions не изменено.

### FE-CR-03 — Target date/key при переходе из Today

**Severity:** critical. **Disposition:** skipped.

**Origin:** Новый Today host; исходный FE-CR-03 / BLOCKER добавлял отсутствующий URL-контракт.

**Source:** [apps/web/app/(app)/_components/today-screen.tsx](</Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/web/app/(app)/_components/today-screen.tsx:379>).

**Решение:** Без patch. `21-11-PLAN.md:126–128` требует открыть парный блок внутри Today либо перейти на /schedule.

**Доказательство:** FE-refutation:18. Target date/key/slot и автоматическое открытие диалога исключены. 21-18 сохраняет принятый fallback; навигация в целевую неделю не объявлена реализованной.

### FE-WR-01 — Сложность четырёх app functions

**Severity:** warning. **Disposition:** fixed.

**Origin:** Три унаследованных превышения усилены фазой; student onSubmit унаследован без роста. FE-WR-01 / WARNING подтверждён.

**Source:** [apps/web/app/(app)/schedule/_components/lesson-dialog.tsx](</Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/web/app/(app)/schedule/_components/lesson-dialog.tsx:59>).

**Решение:** `91dc7ab` разделяет обязанности; последующие `1d2bcaa`/`4e26822` сохраняют guards и public Props.

**Доказательство:** Исходные CC/cognitive 29/37, 50/43, 28/28, 23/14. После refactor функций 6/6, 15/13, 20/19, 11/8; последний LessonDialog 8/8. Готовые frontend-quality/footer metrics актуальны для этих файлов. Диалоги и формы подтверждены 21-13; corrections/keyboard/320 — 21-18 light/dark.

### FE-WR-02 — Размер week-grid

**Severity:** warning. **Disposition:** fixed.

**Origin:** Handwritten grid вырос 271→509 строк в фазе. FE-WR-02 / WARNING подтверждён.

**Source:** [apps/web/app/(app)/schedule/_components/week-grid.tsx](</Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/web/app/(app)/schedule/_components/week-grid.tsx:224>).

**Решение:** `91dc7ab`: grid 352 строки, private use-slot-drag 180; public API, capture/cancel/autoscroll сохранены.

**Доказательство:** Оба source blobs неизменны после исправления. Frontend-quality metrics/preservation и 21-13 schedule browser frame/drag/grid/changes подтверждают scope в обеих темах.

### FE-WR-03 — Gates локальных копий Base UI

**Severity:** warning. **Disposition:** fixed.

**Origin:** Унаследованные size/CC/cognitive gaps в изменённых source-копиях; generated/vendor исключение не установлено. WARNING подтверждён частично; file-Halstead часть отвергнута.

**Source:** [apps/web/components/ui/time-picker.tsx](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/web/components/ui/time-picker.tsx:1).

**Решение:** `e93cf9d`: четыре публичных entry и 26 private modules разделены по обязанностям.

**Доказательство:** 30/30 fingerprints актуальны. Max file 299, CC 21, cognitive 16, function D 36.932; 94 exports и 171 class strings сохранены. 21-13 browser helpers и 21-18 journeys прошли. Direct any 0 / new deep findings 0; 26 inherited dependency graph findings остаются вне утверждения о global no-any.

### FE-WR-04 — Caption The mark stays

**Severity:** warning. **Disposition:** skipped.

**Origin:** Реальное отличие от v40, заранее исключённое владельцем из фазы. Исходный FE-WR-04 / WARNING отвергнут как обязательная работа.

**Source:** [apps/web/app/(app)/schedule/_components/lesson-move-form.tsx](</Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/web/app/(app)/schedule/_components/lesson-move-form.tsx:158>).

**Решение:** Без patch. Caption остаётся в принятом Backlog.

**Доказательство:** FE-refutation:22; ROADMAP:352 и 21/.continue-here:30 в snapshot refutation. V40 LessonDialog README:11 не отменяет эту scope-границу. Владелец фазы/дизайна сохраняет backlog; новый обязательный claim не создаётся.

### FE-WR-05 — Token заголовка EmptyState

**Severity:** warning. **Disposition:** fixed.

**Origin:** Точное source/v40 расхождение; исходные отчёты не устанавливают commit появления. FE-WR-05 / WARNING подтверждён.

**Source:** [apps/web/components/app/empty-state.tsx](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/web/components/app/empty-state.tsx:19).

**Решение:** `126a529`: text-subtitle font-semibold; padding-вопрос не включён в fix.

**Доказательство:** Blob неизменён. Source token доказан непосредственно; empty/loaded состояния входят в 21-13. Отдельный visual verdict принадлежит UI review Newton, а не заменяется этим code review.

### FE-WR-06 — Exit fade строк и панели Earlier

**Severity:** warning. **Disposition:** fixed.

**Origin:** Новый Today list без предусмотренного v40 exit. FE-WR-06 / WARNING подтверждён.

**Source:** [apps/web/app/(app)/_components/today-lessons.tsx](</Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/web/app/(app)/_components/today-lessons.tsx:93>).

**Решение:** `126a529` добавил presence; `4dc57f3` заменил opacity spring, который давал 100ms, на tween ровно spring.fast.duration=80ms. Панель и строки сохраняют exit; exiting row inert.

**Доказательство:** Финальный 21-18 Today run: light/dark × normal/reduced, WAAPI duration 80ms, delay 0, промежуточная opacity, transform отсутствует, panelRetained=true, max frame gap ≤17.9ms. Исчезновение последней панели условно/unverified при наличии реальных чужих строк; они не менялись ради теста. Это явно сохранённая граница, не PASS отсутствующего наблюдения.

### FE-WR-07 — Balance в новом PaymentDialog

**Severity:** warning. **Disposition:** fixed.

**Origin:** Новый Today flow delta 34da0dc1; preset-профиль не был самостоятельным scope finding. FE-WR-07 / WARNING подтверждён для нового flow.

**Source:** [apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx](</Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx:264>).

**Решение:** `126a529`: balancePhrase, Not set при null, rate / No rate is set; plan в модель не добавлен.

**Доказательство:** Product blob неизменён. 21-13 today-payment и payment/threshold evidence подтверждают новый flow через UI/API/persistence; итоговые остатки подтверждены 21-18. V40 принят как source дизайна.

### FE-WR-08 — Вид moved-from ссылки

**Severity:** info. **Disposition:** deferred.

**Origin:** Прежний вид ссылки фазы 20 в новом marked-future состоянии. Исходная WARNING понижена refutation до INFO.

**Source:** [apps/web/app/(app)/schedule/_components/lesson-details.tsx](</Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/apps/web/app/(app)/schedule/_components/lesson-details.tsx:1>).

**Решение:** Не исправлено в этой фазе. Принятый неблокирующий Human Action остаётся за владельцем UI/дизайна.

**Доказательство:** FE-refutation:26 и 21-08-SUMMARY:76,120. Разница caption/class реальна; нарушения действий не доказано. В canonical сохранены исходная severity и scope принятого переноса.

## Необходимый delta после candidate

Сравнен только `bec43a9..8c3cb5d` для затронутых owners. Backend, contracts, core и исходные fixes CR-01/02 не менялись. Product delta: today-lessons — 320px layout и opacity tween; today-screen — тот же tween; layout-parts — min-width viewport. Actions, balance, marks и pending guards сохранены. В build script web явно выбран webpack; root ESM/test:e2e и knip согласованы с typed helpers/E2E. Полное доказательство соответствующих изменений дано исполнителями 13/18, их runtime не повторялся.

Mandatory Simplify применён read-only к этому delta и к собственным двум отчётам. Не добавлены source edits, comments, абстракции, сценарии или новая работа. Source simplify исполнителей 13/18 подтверждён их SUMMARY; unused reduced hooks удалены в `4dc57f3`, а retained presence/guards и validation сохранены.

## Фактическая проверка и reuse

[SUMMARY13](21-13-SUMMARY.md) и [SUMMARY18](21-18-SUMMARY.md) содержат точные команды, первоначальные ошибки, fixtures, expected/observed и rerun. Здесь сохранены решающие итоги. Все команды таблицы уже выполнены владельцами; reviewer не запускал runtime, DB, browser, build или test.

| Доказательство / точная команда                                                                                                                         | Первоначальный статус | Решающий результат                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 32 исходных browser runs из [21-13-browser-evidence.json](/private/tmp/dv-lab-phase21-parallel/21-13-browser-evidence.json); exact commands в SUMMARY13 | все exit 0            | Schedule/ledger helpers, light/dark; пять критериев ROADMAP подтверждены через UI/API/persistence                                    |
| `node scripts/dev-checks/schedule-web.mjs changes`                                                                                                      | exit 0                | SCHEDULE_WEB_CHANGES_OK, 109 assertions после typed request validation                                                               |
| `node scripts/dev-checks/schedule-web.mjs changes dark`                                                                                                 | exit 0                | SCHEDULE_WEB_CHANGES_OK, 109 assertions; [type-followup](/private/tmp/dv-lab-phase21-parallel/21-13-type-followup.json)              |
| `yarn test:e2e --grep "dialog marks deduct by lesson length"`                                                                                           | exit 0                | 4 passed с setup/cleanup; 2 theme journeys                                                                                           |
| `yarn test:e2e --grep-invert "dialog marks deduct by lesson length"`                                                                                    | exit 1                | 14 passed, 4 failed; сохраняются только доказанные unaffected successes, не command PASS                                             |
| `yarn test:e2e --grep "dialog corrections recompute\|Pays soon follows\|Earlier, not marked lists"`                                                     | exit 1                | corrections/keyboard/320 light/dark passed; две Today failures закрыты следующим финальным run                                       |
| `yarn test:e2e --grep "Pays soon follows\|Earlier, not marked lists"`                                                                                   | exit 0                | 6 passed с setup/cleanup; четыре final Today journeys                                                                                |
| `yarn test`                                                                                                                                             | exit 0                | 11 suites / 116 tests; 5 successful, 4 cached; [final-test.json](/private/tmp/dv-lab-phase21-parallel/21-final-test.json)            |
| `yarn build`                                                                                                                                            | exit 0                | 2 successful / 2 total, 2 cached; штатный Next webpack; [final-build.json](/private/tmp/dv-lab-phase21-parallel/21-final-build.json) |
| `yarn typecheck`, `yarn lint`, `yarn knip` в 21-13; final web typecheck/lint/knip в 21-18                                                               | exit 0                | Scoped static checks пройдены; knip оставляет 18 прежних configuration hints, не dead-code findings                                  |
| `node /private/tmp/dv-lab-phase21-parallel/21-18-verify.ts`                                                                                             | recorded exit 0       | 13 tracked TS config/E2E files; diagnostics/any/syntax/forbidden/comments пусты                                                      |
| `node /private/tmp/dv-lab-phase21-parallel/21-18-metrics.cjs`                                                                                           | recorded exit 0       | 15 files / 257 functions; max CC 19, cognitive 20, function D 33.913, lines 440; violations=[]                                       |
| `node /private/tmp/dv-lab-phase21-parallel/21-13-owned-types.cjs`                                                                                       | recorded exit 0       | 41 source files / 14083 nodes, any=0, diagnostics=0 в исходном scope; правила reuse ниже                                             |
| `node scripts/dev-checks/wait-dev.mjs down`                                                                                                             | recorded exit 0       | DEV_DOWN_OK; собственные процессы завершены                                                                                          |

Девять durable journeys × light/dark = **18 уникальных успешных выполнений**. Это объединение tracer, unaffected successes, corrections и финального Today run, а не выдуманный единый зелёный полный запуск. Старый today-focused wrapper потерял producer exit; этот attempt не считается PASS. Финальный Today run даёт самостоятельный original exit 0. Raw логи и их SHA приведены ниже.

Финальные test/build выполнены на `f5e7083c7db741ec6a6d94b02dfd52ac85c21668`. Между ним и source snapshot изменились только HANDOFF, ROADMAP, STATE и continue-here; код и runtime inputs не менялись. Build cache reuse указан явно. В историческом списке regression refs было 12 путей; `apps/api/test/auth/passwords.test.ts` отсутствует. Подтверждены именно **11 существующих suites**, а не 12; public sign-in не назван заменой отсутствующей suite.

Fixtures очищены: count=0. Settings восстановлены точно с исходным hash `8ec157deee53f848bf1b5cf6259be2b590c8a791a97912a6d5b96ff06da5f886`. Private auth scrubbed, settings=null, owned=0. Эти факты перенесены из SUMMARY/type-followup; reviewer не обращался к env, state, данным или БД.

## Fingerprints, методы и quality boundaries

Проверены только сохранённые доказательства и SHA-256 Git blobs `8c3cb5d`:

- `21-18-final-static.json.analyses`: **13/13 tracked paths совпали**. Четырнадцатая analysis относится к TMP verify.ts вне репозитория и не включена в tracked denominator. В analyses нет anySites, diagnostics пусты.
- Старое поле `sourceFingerprints` того же JSON: **22 совпадения, 13 mismatches**. Эти 13 stale fingerprints не используются как доказательство текущего кода. Исторические поля readiness/runtime не переименованы в final PASS.
- `21-18-final-metrics.json.data`: **15/15 current**. Это актуальный измеренный набор config/E2E и двух Today product-файлов.
- `21-13-owned-types.json.scope`: **40/41 current**. Единственное изменение — today-lessons, покрытое узким delta review, final18 metrics и web typecheck; delta удаляет hook и меняет CSS/transition, не вводит новых unvalidated типов.
- `21-13-type-followup.json.source`: SHA occurrence-state совпал; две affected browser проверки — по 109 assertions.
- Core SHA равен итоговому virtual source в `21-schedule-window-simplify.md`; numeric evidence BE-WR-01 найдено и привязано. Прежний candidate gap закрыт существующим evidence.
- UI-quality 30/30 fingerprints сохраняются: copied source gates не объявлены vendor-exempt. **26 inherited deep dependency any** исключены из утверждения о новых/touched direct types; global absence of any не заявлена.

Инструменты: Node 24.17.0, TypeScript 6.0.3, ESLint complexity classic 10.12.0, typescript-eslint parser 8.71.1. Cognitive — опубликованная TS AST схема nesting/логических последовательностей; совпадение с SonarJS не заявлено. Halstead измеряется отдельно для каждой функции/callback: executable keywords/punctuation/operators — operators; identifiers/literals — operands; types/imports/trivia и тела вложенных функций исключены из parent. `D=(n1/2)*(N2/n2)`. File aggregate сохранён как диагностика. SQL, generated artifacts и dependencies не оцениваются по JS/TS token convention.

В 21-13 актуальный scoped denominator 41 файла: max CC 21, cognitive 15, function D 40.4193548387, lines 457. Эти числа не смешаны с final18 denominator 15 файлов. Старые source proofs применяются только при совпадении inputs. Coverage, mutation, stability, полный audit и новый security verdict не заявлены.

## Сохранённые ограничения

- Реальная синхронная полночь browser/API в зоне VN — unverified. Stale-date simulation и реальная граница начала урока прошли; они не названы проверкой реальной полуночи.
- 300-character rendering — unverified: public contract и SQL CHECK допускают максимум 80, запрос с 300 символами дал 400. Обход persistence validation не выполнялся.
- Последнее исчезновение панели Earlier остаётся условно/unverified, если в ней есть чужие реальные строки. Fade своей строки и удержание панели наблюдались; данные не изменялись ради искусственного пустого состояния.
- Manual calendar UAT отложен владельцем до Google 24/25. Это не отменяет выполненную автоматическую проверку Today/баланса.
- FE-WR-08 — принятый optional caption INFO, владелец UI/дизайна. FE-WR-04, target navigation и расширение week-read не возвращены в обязательный scope.

## Provenance

Сводка использует четыре первоначальных review/refutation, candidate, SUMMARY13/18 и перечисленные frozen reports. Полные первоначальные snapshots, origins и before counts сохранены в candidate. Конечные source SHA и raw record SHA позволяют проверить reuse без нового runtime.

| Evidence                                                                                                                                                                    | SHA-256                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [21-review-candidate.md](/private/tmp/dv-lab-phase21-parallel/21-review-candidate.md)                                                                                       | `13eaca76e744ad7a6c67856c3d742e8a5446def778617035d1d21a8e66ecd1f4` |
| [21-backend-review.md](/private/tmp/dv-lab-phase21-parallel/21-backend-review.md)                                                                                           | `414bbf36e4702f94f6ae4fac6956b758e0746392dcb2ceb5a18a3e3150d8c9ec` |
| [21-frontend-review.md](/private/tmp/dv-lab-phase21-parallel/21-frontend-review.md)                                                                                         | `3c54491f7dc082f64ed89b938bb53fa7349a4442ada2a6b94f20c0fa8d94a161` |
| [21-backend-refutation.md](/private/tmp/dv-lab-phase21-parallel/21-backend-refutation.md)                                                                                   | `264dedaa16f27151f79acc5c6d64a4cd2d6b565405efd13ec5f1552f49a69110` |
| [21-frontend-refutation.md](/private/tmp/dv-lab-phase21-parallel/21-frontend-refutation.md)                                                                                 | `f69587ec18efe865d864cb9f1758b610386519aa60d388d96f5e83151df4f5c8` |
| [21-13-type-followup.json](/private/tmp/dv-lab-phase21-parallel/21-13-type-followup.json)                                                                                   | `d65269c63ff3c78162e2be08f798117b0e9d9be3a3b014b6b46d26eda94b486e` |
| [21-13-owned-types.json](/private/tmp/dv-lab-phase21-parallel/21-13-owned-types.json)                                                                                       | `599693610f65a536ee53bc57944f6751146901b597737f9834a36460d27fb3d5` |
| [21-18-preparation.md](/private/tmp/dv-lab-phase21-parallel/21-18-preparation.md)                                                                                           | `6726fd3a7b2d324278c618cdb3c8c99fd1f3ddee9cd545cfb82e53ec59d05ff8` |
| [21-18-final-static.json](/private/tmp/dv-lab-phase21-parallel/21-18-final-static.json)                                                                                     | `25a42cc8906e3b00a1eed23ee7fe9e0ca967bc75ebf626764ef4b5018ae07396` |
| [21-18-final-metrics.json](/private/tmp/dv-lab-phase21-parallel/21-18-final-metrics.json)                                                                                   | `c3ca8c912884e70face00eb3c87a5d1bb83e6e8bdfc6c8d893a4d77db3115904` |
| [21-schedule-window-simplify.md](/private/tmp/dv-lab-phase21-parallel/21-schedule-window-simplify.md)                                                                       | `7379c48ca4e4ef6780ee47fd18f86bb3788c9b39c3f3981c850efa3ca55b5b8b` |
| [21-final-test.json](/private/tmp/dv-lab-phase21-parallel/21-final-test.json)                                                                                               | `80f93bcd16763bb907cbadb698aceefe995b9141fab28d4bbdfc3d32a3b4ebf8` |
| [21-final-build.json](/private/tmp/dv-lab-phase21-parallel/21-final-build.json)                                                                                             | `34b70bb5f97e3451b88b2aee500c8a7e1c185540b4c70b93c9ec6dc1fe46a1e6` |
| [21-18-tracer-2.log](/private/tmp/dv-lab-phase21-parallel/21-18-tracer-2.log)                                                                                               | `fc7a77ca9e17d23e6a643bd706ba10a232d721d0d47b735d72de927da8e601fb` |
| [21-18-journeys.log](/private/tmp/dv-lab-phase21-parallel/21-18-journeys.log)                                                                                               | `a2472d506ae0eecb888ae7302be9836fbbfe09681377c67afbb6b39b4260d67e` |
| [21-18-affected.log](/private/tmp/dv-lab-phase21-parallel/21-18-affected.log)                                                                                               | `9d2ad286dddb0dc8676053105d5716c53098ccaccc916221052ff78d3768a9a3` |
| [21-18-today-final.log](/private/tmp/dv-lab-phase21-parallel/21-18-today-final.log)                                                                                         | `0846246355dd47f7d92ba0c7ac66497aef791545e1b3b7e7b921803274f678bf` |
| [21-13-SUMMARY.md](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/.planning/phases/21-lesson-accounting-and-today/21-13-SUMMARY.md) | `846d1b81c972dd917262a06852da1a642fe37dad623d0316e4990b835b4ad840` |
| [21-18-SUMMARY.md](/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/.planning/phases/21-lesson-accounting-and-today/21-18-SUMMARY.md) | `e71e7af2256187e636e06a441178b45aa3ba4a102111a88574e7b256c01d8370` |

## Проверка двух canonical-документов

`bash scripts/gsd/root-pin.sh /Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today` — exit 0, ROOT_PIN_OK перед записью. Проверка ledger: exit 0, `REVIEW_DISPOSITION_OK total=16 fixed=11 skipped=4 deferred=1 open=0 critical=6 warning=9 info=1`. Проверка ссылок и fingerprints: exit 0, `REVIEW_EVIDENCE_OK hashes=19 scope_paths=79 source=8c3cb5d`. Точная команда проверки ledger приведена в DISPOSITION. Parent выполняет согласованные format/privacy и commit; эти действия данным reviewer не выполнялись.

Изменены только:

- `21-REVIEW.md` — объединён review, evidence после 13/18 и его точные ограничения.
- `21-REVIEW-DISPOSITION.md` — каждому из 16 claims назначен конечный статус и источник решения.
