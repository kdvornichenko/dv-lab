---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '09'
status: complete
subsystem: api
tags: [google-calendar, recurring, canonical-instance]
requires:
  - phase: 24-08
    provides: Conditional single operations, sparse cancellation ACK, generation fencing and absolute admission deadline
provides:
  - Canonical weekly master source committed in task 1
  - Canonical instance conditional PATCH, sparse cancellation ACK, recovery and exception projection
affects: [24-09, 24-10]
tech-stack:
  added: []
  patterns: [Existing immutable command journal and ACK-before-domain]
key-files:
  created:
    [
      apps/api/src/calendar/recurring.ts,
      apps/api/src/calendar/instance-observation.ts,
      apps/api/src/calendar/instance-recovery.ts,
      apps/api/src/calendar/cancelled-occurrences.ts,
      apps/api/src/schedule/recurring-command.ts,
      apps/api/src/schedule/occurrence-command.ts,
      apps/api/src/schedule/occurrence-change.ts,
      e2e/support/calendar-recurring.ts,
    ]
  modified:
    [
      apps/api/src/calendar/command-result.ts,
      apps/api/src/calendar/commands.ts,
      apps/api/src/calendar/dispatch.ts,
      apps/api/src/calendar/event-mapping.ts,
      apps/api/src/calendar/gateway.ts,
      apps/api/src/calendar/read-model.ts,
      apps/api/src/calendar/series-context.ts,
      apps/api/src/calendar/worker.ts,
      apps/api/src/routes/schedule.ts,
      apps/api/src/schedule/command-plan.ts,
      apps/api/src/schedule/command-apply.ts,
      packages/db/src/calendar-values.ts,
      e2e/move.spec.ts,
    ]
key-decisions:
  - Weekly master uses the stored rule zone and core first/last natural instants.
  - Canonical instances require complete originalStart lookup, actual ID and conditional PATCH; no standalone replacement.
requirements-completed: []
actuals:
  tokens: 22214
  tasks: 2
  commits: 2
plan_head_before: 6c38a9ea43249e0cbd6fe3c0bd6e9a7b56bb189e
plan_head_after: 5c28b970519e66401c5899077c0f34c5b721af6f
completed: 2026-10-12
duration: not_recorded
coverage:
  - id: master
    description: Canonical recurring master source
    requirement: GCAL-02
    human_judgment: false
    verification:
      - kind: other
        ref: yarn workspace @dv-lab/api typecheck
        status: pass
      - kind: e2e
        ref: E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/move.spec.ts --grep '\[calendar\] recurring master' --project=light
        status: unknown
  - id: instance
    description: Canonical recurring instance source
    requirement: GCAL-03
    human_judgment: false
    verification:
      - kind: other
        ref: yarn workspace @dv-lab/api build
        status: pass
      - kind: e2e
        ref: E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/move.spec.ts --grep '\[calendar\] recurring instance' --project=light
        status: unknown
---

# Phase 24 Plan 09: Recurring masters и canonical instances Summary

Canonical weekly master и conditional PATCH canonical instance используют прежний immutable journal и ACK-before-domain. Обе source tasks завершены. Actual Google/runtime parity остаётся UNVERIFIED.

## Task Commits

1. T1 — `80a17a4`: `feat(24-09): создал canonical recurring master после verified ACK`.
2. T2 — `5c28b97`: `feat(24-09): подключил canonical instance к conditional ACK и projection`.

Счётчик commits измерен через persisted `gsd-plan-head-before-24-09`: два source commits между `plan_head_before` и `plan_head_after`. Tokens = ceil(chars/4) realized source diff этого диапазона; это не harness tokens. Время начала полного выполнения не сохранено, duration не выдуман.

## Verification

T1, до изменений T2:

- `yarn workspace @dv-lab/api typecheck` — exit 0.
- `yarn workspace @dv-lab/api build` — exit 0, 95 ms.
- Playwright recurring master `--list` — exit 0, 3 tests; только discovery.
- `git diff --check` — exit 0.
- Scoped native quality — PASS, fingerprint `37d5292f188fc13818773fce42a377ec57f903a5aa1ab32aeb95eca4827b2c1b`. Точные argv: private STATE_DIR `phase24-09-task1-command.json`; результаты: `phase24-09-task1-quality.json`.

Final source, T1+T2:

- `yarn workspace @dv-lab/api typecheck` — exit 0.
- `yarn workspace @dv-lab/api build` — exit 0, `Build complete in 89ms`, 34 output files. Сборка не запускает runtime.
- `E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/move.spec.ts --grep '\[calendar\] recurring (master|instance)' --project=light --list` — exit 0, `Total: 4 tests in 3 files`: два recurring journeys плюс setup/cleanup. Это discovery, не execution.
- `git diff --check` — exit 0.
- Native scoped quality — exit 0, PASS, fingerprint `d592eaf35c99ae5f28d9afc30ace84dfc65aebcd3f9fe3d919fa49647d78e1c2`. Точные argv: private STATE_DIR `phase24-09-final-command.json`; current file hashes, methods, boundary reviews и результаты: `phase24-09-final-quality.json`.
- Scoped `yarn prettier --check` — exit 0, `All matched files use Prettier code style!`. Точные argv: private STATE_DIR `phase24-09-format-command.json`; output `phase24-09-format.log`.
- Final simplify выполнен: убраны unshipped Registry alias и unused exports; instance identity checks отделены от owned field checks; restored exception использует прежнюю форму владельца. Новых code comments нет.
- Google/runtime/DB/E2E execution — NOT RUN. TEST grant отсутствует. DST, tombstone, pagination и provider parity — UNVERIFIED.

Quality denominator: 21 owned source files плюс три существующих measurement tools; 24 files, 360 functions/callbacks, 169 changed functions. Node 24.17.0, TypeScript 6.0.3, ESLint 10.12.0. Max CC 21, cognitive 19, Halstead D 42.71923076923077; max source file 498 physical lines. Explicit/inferred any и compiler diagnostics отсутствуют. Три unknown boundary reviewed на текущих hashes: два raw provider input до Registry/parser validation, один unvalidated thrown value до классификации expiry/rethrow. Catch boundaries проверены AST. Scoped symbol/caller inspection не оставил confirmed dead exports; полного Knip audit не было.

Методы: CC — ESLint classic AST; cognitive — DVLab AST nesting/control/logical-sequence v1, не Sonar. Halstead — DVLab executable AST leaves v1: identifier/literal operands по точному spelling, keyword/punctuation operators по SyntaxKind; imports/trivia/types/erased modifiers исключены; nested functions измерены отдельно, D=(n1/2)*(N2/n2). Подробные method/source/type-input fingerprints сохранены в private quality JSON.

До/после относительно BASE: `verifyOwnedFields` CC 15→17, cognitive 12→15; `checkDispatchWindow` 15→15/14→14; `applySingle` 10→17/8→13; `prepareCreateCommand` 19→7/16→6. Промежуточные превышения CC/cognitive были устранены разделением обязанностей, не исключением executable code.

## Source Inventory

- `calendar/recurring.ts` — canonical weekly RRULE и first/last instants, T1.
- `calendar/series-context.ts` — проверка master через общий canonical encoder, T1.
- `schedule/recurring-command.ts` — canonical rule capture и запрет duplicate active master, T1.
- `calendar/command-result.ts` — master ACK и instance identity/sparse cancellation provenance.
- `calendar/commands.ts` — admission weekly create и instance observation в прежнем 30-second budget.
- `schedule/command-plan.ts` — dispatch preparation к прежним single/master и новым occurrence helpers.
- `schedule/command-apply.ts` — series creation и occurrence projection после ACK.
- `packages/db/src/calendar-values.ts` — единственный Registry master/instance request и ACK shapes; без миграции.
- `e2e/move.spec.ts` — durable master/instance journey entry points, T1.
- `e2e/support/calendar-recurring.ts` — real-provider fixture binding, delayed/lost responses и canonical assertions.
- `calendar/gateway.ts` — all-pages originalStart lookup без effective-time filters.
- `calendar/dispatch.ts` — pre-dispatch master и canonical identity fence.
- `calendar/read-model.ts` — cancelled occurrence historical projection.
- `calendar/worker.ts` — unsent instance Resume с исходным deadline.
- `routes/schedule.ts` — public instance move/cancel/restore routes.
- `calendar/cancelled-occurrences.ts` — historical cancelled rows из genuine ACK baseline и local exception.
- `calendar/instance-observation.ts` — actual canonical ID, originalStartTime, ETag и stored-rule checks; parent fix `target.mapping.calendarId` сохранён.
- `calendar/instance-recovery.ts` — повторный complete lookup и новые journal stages до исходного deadline.
- `schedule/occurrence-change.ts` — подготовка local change и exception write после ACK.
- `schedule/occurrence-command.ts` — immutable occurrence PATCH intent.

Все пути `calendar/`, `schedule/`, `routes/` выше относятся к `apps/api/src/`. Все 21 source files закоммичены. `apps/web/AGENTS.md` сохранён без изменений. Этот SUMMARY — единственный изменённый child metadata file.

## Deviations from Plan

1. [Rule 1 - Bug] Extraction для CC/cognitive потерял lexical `primary`. Parent исправил provider GET на `target.mapping.calendarId`, уже проверенный через actual PRIMARY и current generation. Эта строка вошла в atomic T2 commit. Продолжение authorized после диагностики всей цепочки; current typecheck и quality PASS.
2. [Rule 2 - Correctness] Internal lineage сохраняет исходные startsAt/duration/status отдельно от неизменного command input. Projection проверяет captured rule и local history; mapping conflict проверяется после insert вместо молчаливого принятия. Registry остаётся sole wire owner. Новых public DTO, DB columns, migrations или dependencies нет.
3. Real provider verification не исполнена по текущей runtime/DB/provider authority и отсутствию TEST grant. Source engineering завершено без фиктивного provider proof. Shared STATE/ROADMAP/requirements/PLAN inventory/WINDOWS принадлежат Parent и child не менялись.

## Deferred Verification

- Parent/owner13: исполнить два указанных выше public recurring journeys после authentic TEST grant, same deployed build и retained fixture lifecycle. Fixture references: private `calendar-recurring.json` и существующий calendar command/fault harness.
- Missing/ambiguous fixtures должны описывать actual provider state, не synthetic resource/ACK/404. Native ambiguity может быть недостижима; её execution не заявлен. Отказ от invented IDs остаётся source-verified.
- Finite/master first-last, unbounded, DST gap/fold, midnight/cross-zone, canonical pagination, cancelled sparse GET/restore и lost PATCH parity требуют real provider proof. Не отмечать requirements или runtime GCAL PASS по `--list`.

## Decisions and Limits

Публичный create DTO не содержит endsOn. Encoder использует finite stored rules; native finite provider fixtures требуют настоящего retained master. Public DTO/studentId parent-owned и не изменён.

Actual canonical provider IDs захвачены в request.instance. Occurrence mapping активируется после ACK, поскольку provider instance уже существует; нового provider ID не резервируется и standalone insert отсутствует. Unverified lookup не разрешает PATCH.

Sparse cancellation GET недостаточен. Direct conditional cancel PATCH сохраняет genuine id-only response отдельно от pre-write baseline. Historical projection не является post-write provider event.

Admission остаётся в одном абсолютном 30-second budget. Unsent instance Resume ограничен исходным deadline, generation и credential fence; поздняя подготовка не становится offline edit. Verified lookup запускает новый write stage того же command с прежними requestId/inputHash/canonical ID/ETag. Unknown PATCH использует прежнюю explicit reconciliation архитектуру, не повторный insert. Exception/marks/history/local IDs меняются только в committed projection после ACK; marks не переписываются.

Durable journeys были добавлены перед T2 behavior в T1 commit и расширены в owned helper: delayed ACK не создаёт exception заранее, lost PATCH проходит reconciliation, stale version отказывается, sibling identities/times и marks сохраняются, standalone lesson/insert не появляется. Source scenarios не являются execution evidence.

T1 reviewed Parent без новых source findings. Source09 готов для Parent integration; 10 не начат. Actual runtime proof не заявлен. API build lease освобождена после final static/build checks.

## Self-Check: PASSED

Commits `80a17a4` и `5c28b97` являются ancestors текущего HEAD. Все 21 source files существуют и совпадают с final quality hashes. Root pin: `ROOT_PIN_OK`; branch `agent-24-contracts`, protected check false, sentinel совпадает с ROOT02. В T2 нет file deletions. Оставшееся provider verification указано явно.
