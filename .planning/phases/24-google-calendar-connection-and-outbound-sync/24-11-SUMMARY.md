---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '11'
subsystem: api-ui
tags: [google-calendar, conflicts, recurring, reconnect, playwright]
status: complete
source-status: complete
runtime-status: UNVERIFIED
requires:
  - phase: 24-12
    provides: Mounted command UI, calendar windows, current series context and explicit recovery
  - phase: 24-10
    provides: Checkpointed cut/end and verified current-mark apply
provides:
  - Complete canonical conflict intervals and all Google pages
  - Shared create/move/whole-series check with stale and grant fences
  - Mounted reconnect drafts and explicit Check then Save
requirements-addressed: [GCAL-10]
requirements-completed: []
affects: [24-13, 24-14]
tech-stack:
  added: []
  patterns: [existing gateway and read mapper, core intervals, checked-window save, mounted memory]
key-files:
  created:
    - apps/api/src/schedule/calendar-conflicts.ts
    - apps/web/components/app/google-conflicts.tsx
    - e2e/support/calendar-conflicts.ts
    - e2e/support/calendar-conflict-ui.ts
    - e2e/support/calendar-series-ui.ts
  modified:
    - apps/api/src/calendar/commands.ts
    - apps/api/src/calendar/read-model.ts
    - apps/api/src/calendar/read-state.ts
    - apps/api/src/routes/google.ts
    - e2e/calendar.spec.ts
    - apps/web/components/app/date-field.tsx
    - apps/web/lib/api-client.ts
    - apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/new-lesson-content.tsx
    - apps/web/app/(app)/schedule/_components/schedule-mutations.ts
    - apps/api/src/calendar/series-observation.ts
    - apps/web/app/(app)/schedule/_components/lesson-move-form.tsx
    - apps/web/app/(app)/schedule/_components/move-series-dialog.tsx
    - e2e/support/calendar-ui.ts
    - apps/web/app/(app)/schedule/_components/calendar-lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - apps/web/app/(app)/_components/today-screen.tsx
    - apps/web/app/(app)/_components/use-today.ts
    - apps/web/app/(app)/schedule/_components/calendar-overlaps.ts
key-decisions:
  - Only complete current results permit Save; overlaps remain advisory.
  - Self exclusion uses one exact provider instance, including whole-series proposals.
  - Whole-series command version matches published connection/generation/revision wrapping.
  - Draft remains only in mounted memory; reconnect never submits it automatically.
actuals:
  tokens: 25343
  tasks: 3
  commits: 3
plan_head_before: a670696df2abb5d317b65048b920c9419c04aaf8
plan_head_after: db58066d5d0e69d0a0fef13840a7c96fd6dbc4ba
duration: '52min observed T1-to-T3 source-commit interval; executor start unavailable'
completed: 2026-10-12
worktree_metadata:
  root: /Users/kdvornichenko/.codex/worktrees/phase24-contracts/dv-lab
  branch: agent-24-contracts
  expected_base: a670696df2abb5d317b65048b920c9419c04aaf8
  source_head: db58066d5d0e69d0a0fef13840a7c96fd6dbc4ba
coverage:
  - id: SC5
    description: Full canonical interval union, every page, exact self identity, unavailable fail-closed
    requirement: GCAL-10
    verification:
      - kind: e2e
        ref: 'e2e/calendar.spec.ts: [calendar] conflicts'
        status: unknown
    human_judgment: false
  - id: SC4-SC5
    description: Same mounted draft, fresh explicit Check and Save for create/move/whole-series
    requirement: GCAL-10
    verification:
      - kind: e2e
        ref: 'e2e/calendar.spec.ts: [calendar] conflict UI / conflict move / complete UI series'
        status: unknown
    human_judgment: false
---

# План 24-11: SOURCE COMPLETE 3/3

Runtime/provider/browser verification: **NOT RUN / UNVERIFIED**. TEST PRIMARY grant и runtime/DB/provider lease отсутствуют. Source completion не завершает GCAL-10 или фазу24. Следующий source owner — Parent13.

## Task commits

| Task | Commit    | Результат                                                                   |
| ---- | --------- | --------------------------------------------------------------------------- |
| T1   | `ca206f4` | Полные intervals/all pages; Parent review закрыт без findings.              |
| T2   | `42d1460` | Create shared check; Parent review закрыт, unused prop claim устранён в T3. |
| T3   | `db58066` | Move/Whole series и deferred UI series cases; current static proof.         |

Все source commits атомарные, с `Co-Authored-By: Codex <noreply@openai.com>`. Финальный docs commit содержит только этот SUMMARY и находится вне source-ledger interval.

## Контракт и решения

- T1 использует существующие credentials, GoogleGateway, all-pages read и единственный event mapper. Intervals раскрывает core в canonical zone. Полный query range включает конец последнего finite занятия. Для infinite range требуется explicit inclusive Check through; скрытого horizon нет. Любой invalid/partial/failed page возвращает unavailable.
- Half-open overlap и all-day exclusive end используют core zoned boundaries. Cancelled/transparent события игнорируются. Self exclusion удаляет только точный provider identity меняемого instance; другие instances той же серии остаются кандидатами overlap.
- T2/T3 используют один google-conflicts owner. Complete response проверяется по canonical inputKey; input/target/zone/recurrence/generation/publication changes отменяют stale request и readiness. Возврат A→B→A не восстанавливает старый complete/loading. Unavailable target без checked window показывает отказ и не разрешает Save.
- Save получает проверенное окно. После store.refresh проверяются current account/connection/calendar/generation, target, schedule publication и zone. Silent refetch+auto-submit отсутствует. Complete overlap остаётся advisory только при ready gate.
- Whole series берёт stored rule/referenceOccurrence.ruleStartsAt, а не moved actualStartsAt. Command meta использует опубликованный context.version. Подтверждённый source join: read-store wrapping включал connection/generation/revision, а admission сравнивал raw master version. Admission согласован с опубликованной формулой; actual master ETag/grant fences сохранены.
- Settings открываются с noopener. Draft хранится только в mounted state. Return перечитывает account, connection и target; затем требуются явные Check и Save. Reload не обещает сохранить draft.
- Duration→Zodthrow hypothesis refuted: parseLength уже проверяет 15–240. Дополнительная duration validation не добавлена.
- Simplify удалил неиспользуемый blocksOn prop и всю цепочку consumers после перехода трёх форм на полный серверный check. Других consumers не найдено. Старый helper file сохранён без obsolete executable functions; файловых удалений нет.
- Source10 изменён только по необходимым объявленным joins: `apps/api/src/calendar/commands.ts`, `apps/api/src/calendar/series-observation.ts`. Registry, sparse cancellation, cut stages, credential freshness, conditional writable preservation и current-mark apply не изменены.

Public DTO и обязательный binding.lesson.studentId сохранены. Internal signatures: commands.checkCalendarConflicts; eventView/eventVersion narrow inputs; apiRequest optional signal; mutate optional checkedWindow; DateField explicit nullable discriminant; obsolete local-overlap props удалены. Новых dependencies, env, migrations, processes/services или provider actions нет. Shared STATE/ROADMAP/PLAN metadata принадлежат Parent и не изменены.

## Фактический inventory: 25 source files

| Файл                                                                 | Причина                                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/schedule/calendar-conflicts.ts`                        | Полные core intervals, all-pages query, exact self identity и fail-closed result.                            |
| `apps/api/src/calendar/commands.ts`                                  | Composition существующих credentials/gateway owners для conflict check.                                      |
| `apps/api/src/calendar/read-model.ts`                                | Повторное использование единственного CalendarEventView mapper.                                              |
| `apps/api/src/calendar/read-state.ts`                                | Нarrow input type eventVersion без смены version formula.                                                    |
| `apps/api/src/routes/google.ts`                                      | Teacher/session/Origin POST /google/conflicts и sole contract decoder.                                       |
| `e2e/calendar.spec.ts`                                               | Пять durable public journey для полного check и UI completion.                                               |
| `e2e/support/calendar-conflicts.ts`                                  | Retained/API-build/persistence-bound case schema и реальные public requests.                                 |
| `apps/web/components/app/google-conflicts.tsx`                       | Общий check owner: abort/sequence/inputKey/publication/grant fences, C15–C25/C43.                            |
| `apps/web/components/app/date-field.tsx`                             | Discriminated nullable props, пустая дата и clear без смены mandatory callers.                               |
| `apps/web/lib/api-client.ts`                                         | AbortSignal и typed HTTP error decoder вместо any.                                                           |
| `apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx`      | Create требует complete+ready check; obsolete blocksOn prop удалён.                                          |
| `apps/web/app/(app)/schedule/_components/new-lesson-content.tsx`     | Удалён ограниченный local clash presentation.                                                                |
| `apps/web/app/(app)/schedule/_components/schedule-mutations.ts`      | Save использует checked window и повторно проверяет current grant/publication.                               |
| `e2e/support/calendar-conflict-ui.ts`                                | Create stale/out-of-order/null/clear и mounted reconnect cases.                                              |
| `apps/api/src/calendar/series-observation.ts`                        | Admission сравнивает опубликованный whole-series version с actual master ETag и current connection/revision. |
| `apps/web/app/(app)/schedule/_components/lesson-move-form.tsx`       | Exact single/instance target и shared complete check вместо local window overlaps.                           |
| `apps/web/app/(app)/schedule/_components/move-series-dialog.tsx`     | Natural rule reference, context.version и explicit infinite range через shared check.                        |
| `e2e/support/calendar-series-ui.ts`                                  | Move/series/stale/zone/DST/reconnect и real cut pending/partial/Resume source cases; retained student guard. |
| `e2e/support/calendar-ui.ts`                                         | Foundation12 Create явно выполняет complete Check перед Save.                                                |
| `apps/web/app/(app)/schedule/_components/calendar-lesson-dialog.tsx` | Удалена obsolete blocksOn forwarding prop.                                                                   |
| `apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx`         | Удалена obsolete blocksOn forwarding prop.                                                                   |
| `apps/web/app/(app)/schedule/_components/schedule-screen.tsx`        | Удалены obsolete create/selected-dialog caller props и limited-window callback.                              |
| `apps/web/app/(app)/_components/today-screen.tsx`                    | Удалён obsolete LessonDialogs caller prop.                                                                   |
| `apps/web/app/(app)/_components/use-today.ts`                        | Удалён callback без функциональных consumers.                                                                |
| `apps/web/app/(app)/schedule/_components/calendar-overlaps.ts`       | Obsolete limited-window functions удалены; файл сохранён как пустой module (export {}).                      |

## Failure scenarios и runtime граница

Existing durable calendar.spec.ts расширен до поведения. Новый test suite не создан. Private retained fixture требует current origin/API build/persistence/account/student binding перед SQL и commands. Новый UI target дополнительно проверяет actual binding.studentId.

- Conflicts: single; finite last overlap; all pages и реальный dropped page2 response; all-day exclusive boundary; DST; exact instance self-filter; missing explicit range; stale context. Expected complete означает все intervals/pages, expected failure не разрешает Save.
- Create UI: empty/cleared Check through; advisory overlap; input changes; held real response и отмена stale input, включая A→B→A; keyboard/Escape; mounted same-calendar reconnect.
- Move/Whole series: exact target; actual target/context change во время held read; missing context; changed account zone; DST gap/fold; natural moved reference после reload; reconnect сохраняет время и не отправляет schedule POST автоматически. Existing Source08 stale_etag journey сохраняет conditional-write failure path.
- Complete UI series: actual pending conditional PATCH; no local boundary или Saved до ACK; dropped real insert response; partial command/reload/explicit Resume; same requestId; sent whole-series version совпадает с фактическим window response перед Check; applied/confirmed revision и новая canonical rule после reload.

Operator-controlled reconnect/external change — будущие реальные действия через существующий grant/fixture lifecycle. Manifest описывает ожидаемые public observables, не attest выдуманные responses/ACK/epochs. Новый source не добавляет mock или новый fault protocol. Light/dark/focus/Google parity остаются UNVERIFIED.

## Проверки

| Команда                                                                                                                                                                                                  | Статус                 | Минимальный output                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------- |
| `yarn workspace @dv-lab/api typecheck`                                                                                                                                                                   | PASS, exit 0           | no diagnostics                                                  |
| `yarn workspace @dv-lab/web typecheck`                                                                                                                                                                   | PASS, exit 0           | Types generated successfully                                    |
| `yarn workspace @dv-lab/api build`                                                                                                                                                                       | PASS, exit 0           | Build complete in 98ms                                          |
| `yarn workspace @dv-lab/web build`                                                                                                                                                                       | PASS, exit 0           | Compiled successfully in 7.8s; static pages 11/11               |
| Scoped ESLint, exact argv below                                                                                                                                                                          | PASS, exit 0           | empty output                                                    |
| `yarn prettier --check` с exact 25 paths                                                                                                                                                                 | PASS, exit 0           | All matched files use Prettier code style!                      |
| `yarn prettier --check e2e/support/calendar-series-ui.ts` после final guard delta                                                                                                                        | PASS, exit 0           | current file formatted                                          |
| Native calendar-quality, exact expanded argv в private artifact                                                                                                                                          | PASS, exit 0           | no failures, no diagnostics, no unreviewed boundaries, stale=[] |
| `E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\] (conflicts\|conflict UI\|conflict move\|complete UI series)' --project=light --project=dark --list` | PASS discovery, exit 0 | 12 tests in 3 files; **not execution**                          |
| `git diff --check`                                                                                                                                                                                       | PASS, exit 0           | empty output                                                    |
| `bash scripts/gsd/root-pin.sh /Users/kdvornichenko/.codex/worktrees/phase24-contracts/dv-lab`                                                                                                            | PASS, exit 0           | ROOT_PIN_OK                                                     |

API/web type/build inputs не изменились после passing checks. Final delta затронул только E2E retained-student guard; его types/metrics проверены current native quality. apps/web/AGENTS.md hash before/after build совпал.

Exact lint command:

```sh
yarn workspace @dv-lab/web exec eslint components/app/google-conflicts.tsx 'app/(app)/schedule/_components/lesson-move-form.tsx' 'app/(app)/schedule/_components/move-series-dialog.tsx' 'app/(app)/schedule/_components/new-lesson-dialog.tsx' 'app/(app)/schedule/_components/calendar-lesson-dialog.tsx' 'app/(app)/schedule/_components/lesson-dialogs.tsx' 'app/(app)/schedule/_components/schedule-screen.tsx' 'app/(app)/_components/today-screen.tsx' 'app/(app)/_components/use-today.ts' 'app/(app)/schedule/_components/calendar-overlaps.ts'
```

Exact format paths и native quality argv, включая все hash-bound input reviews, сохранены в existing private STATE_DIR `/var/folders/_t/fgvwdzzs1394z_82sp4p500h0000gn/T/dvlab-dev-checks`: `phase24-11-final-paths.json`, `phase24-11-final-command.json`. Original numeric exits и argv: `phase24-11-*-exit.json`. Current quality/types/method fingerprints: `phase24-11-final-quality.json`. Measured source ledger и hashes: `phase24-11-final-metadata.json`. Artifacts содержат static evidence, без provider payloads.

Quality native invocation: `yarn node --max-old-space-size=8192 scripts/dev-checks/calendar-quality.ts --base a670696`, с explicit 25 owned / 5 new paths и current boundary reviews из exact argv artifact.

Промежуточные quality exits 2 были честными UNVERIFIED: сначала CC/narrowing/import diagnostics, затем отсутствующие current boundary reviews. Причины исправлены. Passing result не выводится из предыдущего exit. T1 и T2 source review не переоткрывались.

Exact final discovery command:

```sh
E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\] (conflicts|conflict UI|conflict move|complete UI series)' --project=light --project=dark --list
```

## Текущий quality proof

- Fingerprint: `2775fb1519cdf22d215d7df328816b9944d35a891c74f9eb240c74536642d1e7`.
- Scope: 25 owned source + 3 unchanged measurement tools; 469 functions/callbacks, 246 changed. Current file hashes совпали 28/28 после source commit; source inventory 25/25.
- Max CC 21; cognitive 19; function Halstead D 43.871795; largest source/tooling file 478 physical lines. Все required thresholds пройдены.
- Tool versions: Node v24.17.0; TypeScript 6.0.3; ESLint 10.12.0.
- CC: ESLint classic AST. Cognitive: DVLab nesting/control/logical-sequence v1, не Sonar. Halstead: executable AST leaves, operators by SyntaxKind, operands exact identifier/literal/template/JSX spelling; imports/trivia/types/erased modifiers исключены; nested function tokens отдельно; D=(n1/2)*(N2/n2). Module token totals — diagnostics, не function gate.
- Any findings и type diagnostics: 0. Unknown оставлен только на actual HTTP/DOM/private input или catch boundaries, с hash-bound review. Type input denominator 3667; fingerprint `380093dbd5cb656c24bc0d12eac85fb5b7e70c65fa9357c204007539ffe226b8`.
- Dead/redundant review: scoped diff и точные callers/exports; blocksOn/OverlapBlock/readCalendarOverlaps/overlapsOn consumers отсутствуют. Полный KNIP/audit — owner13, не заявлен PASS.
- Measured baseline a670696→current (CC/cognitive): useScheduleMutation.mutate 18/14→17/12; NewLessonDialog 20/17→21/16; MoveSeriesDialog 16/11→21/13; новый GoogleConflicts N/A→18/14. Полные measured before/after spans и meaningful helper extractions — native JSON. Промежуточные превышения устранялись до PASS.

## Self-Check: PASSED

Source files существуют; T1/T2/T3 commits ancestors текущего source HEAD; current 28/28 hashes совпали с quality; tracked deletions отсутствуют; owned tree clean после commit; apps/web/AGENTS.md preserved. Native SUMMARY verification: exit 0, passed=true, files found25/25, commits_exist=true. Первый metadata self-check script получил exit1 из-за before=null у нового function; reader исправлен без source edits. Повторный self-check: exit0, 28/28 hashes, три ancestors, owned clean и no tracked deletions. Runtime не включён в этот self-check.

Actual tokens — proxy ceil(101369 source-diff characters/4) = 25343, не telemetry model usage. Source-ledger base→db58066d5d0e69d0a0fef13840a7c96fd6dbc4ba содержит ровно3 atomic task commits. Полное начало execution не сохранилось; duration — измеренный commit interval.

Stop boundary: SOURCE COMPLETE 3/3 + SUMMARY. Plan13 не начат. API и web static/build leases возвращаются Parent после docs commit. Provider/browser/DB parity, TEST grant и real runtime acceptance остаются открыты.
