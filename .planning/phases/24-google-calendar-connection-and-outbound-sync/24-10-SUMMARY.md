---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '10'
subsystem: api
tags: [google-calendar, recurring, cut, journal, marks]
status: complete
source-status: complete
runtime-status: UNVERIFIED
requires:
  - phase: 24-09
    provides: canonical master/instance lookup, conditional writes, authentic cancellation history
provides:
  - Immutable cut/end preparation and once-reserved lineage
  - Checkpointed provider progress with explicit recovery and transition bindings
  - Verified SQL apply with current marks and no local recut
affects: [24-11, 24-13, 24-14]
tech-stack:
  added: []
  patterns: [existing journal, conditional PATCH, authenticated sparse facts, SQL-only projection]
requirements-addressed: [GCAL-02, GCAL-03]
requirements-completed: []
key-files:
  created:
    - apps/api/src/calendar/family-pages.ts
    - apps/api/src/calendar/gateway-reads.ts
    - apps/api/src/calendar/series-observation.ts
    - apps/api/src/calendar/transition-cancellations.ts
    - apps/api/src/calendar/transition-journal.ts
    - apps/api/src/calendar/transition-proof.ts
    - apps/api/src/calendar/transition-stages.ts
    - apps/api/src/calendar/transition-verify.ts
    - apps/api/src/calendar/transition-view.ts
    - apps/api/src/calendar/transition-write.ts
    - apps/api/src/calendar/transitions.ts
    - apps/api/src/schedule/cut-apply.ts
    - apps/api/src/schedule/cut-proof.ts
    - apps/api/src/schedule/series-command.ts
    - e2e/support/calendar-cut.ts
    - packages/db/src/calendar-transition-values.ts
  modified:
    - apps/api/src/calendar/command-result.ts
    - apps/api/src/calendar/commands.ts
    - apps/api/src/calendar/dispatch.ts
    - apps/api/src/calendar/event-mapping.ts
    - apps/api/src/calendar/gateway.ts
    - apps/api/src/calendar/journal.ts
    - apps/api/src/calendar/worker.ts
    - apps/api/src/routes/schedule.ts
    - apps/api/src/schedule/command-apply.ts
    - apps/api/src/schedule/command-plan.ts
    - apps/api/src/schedule/series.ts
    - e2e/marks.spec.ts
    - e2e/move.spec.ts
    - e2e/support/calendar-commands.ts
    - packages/db/src/calendar-values.ts
    - packages/db/src/index.ts
key-decisions:
  - Current sparse cancelled facts and authentic historical baseline remain distinct.
  - Unknown cancellation is not confirmed by sparse GET alone.
  - New eligible marks outside reserved lineage refuse apply without new UUID or recut.
  - Final proof is fenced by actual auth and credential generation.
actuals:
  tokens: 37981
  tasks: 3
  commits: 7
plan_head_before: 913fc5ae9286aca9a48b5ce4272699c846849874
plan_head_after: 651e498f9f5035db769f5dc454b87b55ef68eea2
duration: '53min observed source-commit interval; executor start unavailable'
completed: 2026-10-12
coverage:
  - id: D1
    description: Bound admission and no implicit export of legacy series
    requirement: GCAL-02
    verification:
      - kind: e2e
        ref: 'e2e/move.spec.ts: [calendar] cut prepare'
        status: unknown
    human_judgment: false
  - id: SC2-SC3
    description: Checkpointed provider progress, current grants and immutable lineage
    requirement: GCAL-03
    verification:
      - kind: e2e
        ref: 'e2e/move.spec.ts: [calendar] cut recovery'
        status: unknown
    human_judgment: false
  - id: C2
    description: Current marks and preserved history under confirmed apply locks
    requirement: GCAL-02
    verification:
      - kind: e2e
        ref: 'e2e/marks.spec.ts: [calendar] cut history'
        status: unknown
    human_judgment: false
---

# Phase 24 Plan 10: Cut/end с actual provider proof и current marks

**SOURCE COMPLETE 3/3. Cut/end используют существующий journal, canonical core prepare, immutable IDs и SQL-only apply после verified provider progress. Google parity остаётся UNVERIFIED.**

## Task commits

1. T1 — `27f71ce`: подготовлен bound cut, зарезервирована immutable lineage; public E2E source написан до поведения.
2. T2 — `bc27868`: подключены provider stages, actual observations, partial recovery и worker/Resume.
3. T3 — `838aba8`: проверены stored ACKs, применены current marks под locks; закрыты sparse readers и deadline fence нового saga.
4. Bounded recovery correction — `d5f8ff6`: обновлён complete proof после actual credential rollover; auth failure после journal persistence передан existing credential owner. `ab502d5` — исходный SUMMARY commit.
5. Residual recovery correction — `651e498`: fresh READ из projection_pending получает recoverable state до HTTP; current valid complete сохраняет SQL-only projection. `d02b783` — предыдущий SUMMARY commit.

Docs commit содержит только этот SUMMARY. Shared STATE/ROADMAP/REQ/PLAN inventories/WINDOWS принадлежат parent. План 11 не начат. GCAL requirements и phase не объявлены завершёнными.

## Реализованный контракт

- Legacy unbound series получает `history_only` до credential/provider access. Cut не экспортирует такую series.
- `cutSeries`/`endSeriesAt` вызываются только при prepare. Old boundary, new rule, instants/zones, originalOn и once-reserved IDs сохраняются в immutable plan. Domain и marks до verified apply не меняются.
- Capture проверяет actual master, canonical tail identities, all-pages family и prefix. Каждая provider stage имеет durable attempt до HTTP и ACK после verified response с актуальным grant fence.
- Stages: capture → conditional tail cancellation → old-master trim/cancel → old-tail inactive proof → reserved detached/new master → valid prefix replay → final actual proof. Preflight/reconcile slots не пересекаются с main stages.
- Unknown write проходит GET reconciliation до повтора. Sparse GET cancellation не становится нашим ACK. 404 не становится non-application proof. Вставка с неизвестным исходом требует authentic complete identity absence перед same-ID повтором.
- Ранее ACKed stages остаются историей после reconnect. Final proof использует текущие auth/credential generations. Первый unknown write после исходного deadline или смены auth generation не отправляется без confirmed partial progress.
- Cached affected rows получают transition/commandId/read-only binding после actual write ACK. Их содержание остаётся last-known. Fresh provider reads используют reserved IDs и captured new rule для transition mapping, без записи new domain до final apply.
- Final proof содержит обязательные stage IDs, verified resources, all-pages identity results, actual sparse cancellations, inactive old tail и canonical first instance нового master. Foreign edit не компенсируется автоматически.
- Apply locks connection/command, old series, reservations/new domain, tail exceptions и current marks. Он записывает old boundary, reserved new rule/lessons, current mark values, mappings, revision и `applied` одной транзакцией. `projection_pending` повторяет только SQL.
- Новый eligible mark вне immutable lineage отклоняет apply как stale proof. Нет UUID regeneration, local recut, пропуска нового mark или false Saved. Старые marks/exceptions/rows не удаляются.

## Sparse cancellations

`cancelledTail`/`cancelledPrefix` разделяют actual current sparse identity и historical `baselineEvent` из последнего applied cancellation того же occurrence. Более поздний applied move/restore не позволяет использовать старый cancel как current history proof. Время/ETag/provider event из local rule не синтезируются.

Cancellation-only GET запрашивает настоящий Google fields mask `id,recurringEventId,originalStartTime,status`. Expected start/end/etag отсутствуют в фактической projection. Для cancelled single/master хранится actual `id` и доступные status/etag отдельно от genuine conditional PATCH ACK. Empty-old master не требует выдуманного полного event.

Actual fields mask поддержан установленным googleapis Calendar v3 SDK: `StandardParameters.fields?: string`, `Params$Resource$Events$Get extends StandardParameters`. Primary docs подтверждают выбор полей ответа через `fields`: [Google Calendar performance](https://developers.google.com/workspace/calendar/api/guides/performance). Runtime response в этом плане не получен.

Для sparse tombstones identity search принимает отсутствующий marker/status только по IDs, уже подтверждённым genuine cancellation ACK и fresh sparse GET этого final proof. Unknown IDs и foreign marker остаются barrier. Default callers 08 сохраняют прежнюю проверку.

## E2E source и незапущенные journeys

Existing durable `move.spec.ts` и `marks.spec.ts` расширены через owned `calendar-cut.ts`; новая suite не создана. Источники failure scenarios появились до поведения. Private retained cases разделяют finite/empty/cross-zone prepare, recovery, history, native sparse cancelled tail/prefix и initially-none unreserved mark.

- Held real PATCH: domain boundary/new lessons до ACK не меняются; history mark обновляется после `response_held`.
- Lost real INSERT reply после trim: partial/recovery, no confirmedRevision, explicit Resume, те же plan/IDs.
- Sparse cancelled tail/prefix: genuine historical baseline и actual sparse shape; cancelled detached status, unchanged old exceptions.
- Changed current mark: detached lesson получает current value; public balance после смены mark и после apply совпадает.
- New eligible unreserved mark: recovery refusal без domain cut/confirmedRevision.

**Все actual journeys NOT RUN.** TEST PRIMARY/grant и runtime/DB/provider lease отсутствуют. Native sparse response, DST/gap/fold, tombstone, pagination, process-crash/late ACK и Google prefix parity не получили runtime proof. Discovery ниже не считается execution. Fixture/operator lifecycle готовит parent/Server guy; этот executor не создавал fixtures и не запускал app/runtime.

Повтор actual journeys после выдачи capability: те же команды discovery ниже без `--list`, на интегрированном API build и retained target-bound fixtures. Ledger unrun verification передан parent через SUMMARY; shared register child не менял.

## Verification

| Exact command                                                                                                                                                                | Status                 | Decisive output                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| `yarn workspace @dv-lab/api typecheck`                                                                                                                                       | PASS, exit 0           | no diagnostics                                                                           |
| `yarn workspace @dv-lab/api build`                                                                                                                                           | PASS, exit 0           | `Build complete in 105ms`; app не запускался                                             |
| `E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/move.spec.ts e2e/marks.spec.ts --grep '\[calendar\] cut (prepare\|recovery\|history)' --project=light --list` | PASS discovery, exit 0 | 5 tests in 4 files: 3 cut journeys + setup/cleanup                                       |
| `yarn prettier --check <32 exact paths>`                                                                                                                                     | PASS, exit 0           | `All matched files use Prettier code style!`                                             |
| `yarn node --max-old-space-size=8192 scripts/dev-checks/calendar-quality.ts --base 913fc5a <explicit owned/new/review argv> --json`                                          | PASS, exit 0           | fingerprint `50b4391615e55010e395e9842f77e117d046cae1ea351dcfad8268807023f6b2`; stale=[] |
| `git diff --check`                                                                                                                                                           | PASS, exit 0           | empty output                                                                             |
| `bash scripts/gsd/root-pin.sh ~/.claude/worktrees/phase24-contracts/dv-lab`                                                                                | PASS, exit 0           | `ROOT_PIN_OK`                                                                            |
| `node ~/.claude/gsd-core/bin/gsd-tools.cjs query git.base-branch --is-protected agent-24-contracts`                                                        | PASS, exit 0           | `false`                                                                                  |
| Post-commit SHA-256 comparison against native quality                                                                                                                        | PASS, exit 0           | 32/32 source hashes matched                                                              |

Exact expanded format/quality argv сохранены в existing private STATE_DIR: `phase24-10-format-command.json`, `phase24-10-residual-command.json`. Полный current result, 32 source fingerprints, method/tool fingerprints, before/after measurements и type input fingerprint — `phase24-10-residual-quality.json`. Measured actuals/root identity — `phase24-10-residual-metadata.json`. Исходные final/correction artifacts сохранены как prior evidence. Эти artifacts не содержат provider payloads и не коммитятся.

### Scoped quality

- 32 changed source files + 3 unchanged measuring-tool files; 538 functions, 298 changed functions. Largest owned source: 498 lines; gateway 480, marks.spec 458.
- Changed function/callback maxima: CC 20, cognitive 21, Halstead D 43.95238095238095. Limits: `<22`, `<22`, `<80`.
- CC: ESLint classic AST. Cognitive: DVLab AST nesting/control/logical-sequence v1, не Sonar. Halstead: DVLab executable AST leaves v1; SyntaxKind operators, exact identifier/literal operands; imports/trivia/types/erased modifiers excluded; nested functions отдельно; `D=(n1/2)*(N2/n2)`.
- Node 24.17.0, TypeScript 6.0.3, ESLint 10.12.0. Explicit/inferred any findings и diagnostics отсутствуют; hash-bound unknown/error boundaries проверены.
- Before/after примеры от base: body builder CC 8→5; projectCommand 2→6; identitySearch 13→18; worker processCommand 14→14. Новым functions baseline не приписан.
- Mandatory simplify выполнен. Confirmed dead legacy `moveSeries/endSeries`, unused return types и private detach/wire helpers удалены из сохранённого `series.ts` после targeted caller search. Новых comments нет.
- Это scoped static evidence. Full KNIP/dead-code audit принадлежит 13; runtime/provider coverage, flakiness, deployment metrics и parity здесь UNVERIFIED.

## Actual inventory: каждый changed source file

| File                                                | Причина                                                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/api/src/calendar/command-result.ts`           | Validated unowned writable replay в PATCH body, без отмены sparse cancellation provenance.           |
| `apps/api/src/calendar/commands.ts`                 | Bound cut/end admission через существующий absolute-budget command service.                          |
| `apps/api/src/calendar/dispatch.ts`                 | Cut `projection_pending` направлен в SQL-only verified apply.                                        |
| `apps/api/src/calendar/event-mapping.ts`            | Reserved new series читается как transition из immutable captured rule.                              |
| `apps/api/src/calendar/family-pages.ts`             | Complete family pagination, duplicate/token guards, actual optional status.                          |
| `apps/api/src/calendar/gateway-reads.ts`            | SDK family adapter и genuine sparse cancellation-only GETs.                                          |
| `apps/api/src/calendar/gateway.ts`                  | Existing gateway подключил bounded readers, preserved prefix PATCH и known tombstone identity proof. |
| `apps/api/src/calendar/journal.ts`                  | Persisted cut capture/first write и once-reserved mapping IDs.                                       |
| `apps/api/src/calendar/series-observation.ts`       | Bound master/version и canonical prefix/tail capture, sparse history отдельно.                       |
| `apps/api/src/calendar/transition-cancellations.ts` | Authentic 09 cancel lookup и guarded cancelled-prefix replay.                                        |
| `apps/api/src/calendar/transition-journal.ts`       | Durable attempts/ACKs, current grant/deadline fences и rejection/recovery states.                    |
| `apps/api/src/calendar/transition-proof.ts`         | Actual capture/inactive facts, sparse cancelled tail/master и authentic absence guard.               |
| `apps/api/src/calendar/transition-stages.ts`        | Immutable stage blueprint и provider payloads из reserved plan.                                      |
| `apps/api/src/calendar/transition-verify.ts`        | Final stage/resource/identity/canonical-instance/prefix verification.                                |
| `apps/api/src/calendar/transition-view.ts`          | Known progress публикует cached transition/read-only binding.                                        |
| `apps/api/src/calendar/transition-write.ts`         | Conditional dispatch и READ-before-repeat unknown recovery.                                          |
| `apps/api/src/calendar/transitions.ts`              | Последовательность stages, Resume и final projection.                                                |
| `apps/api/src/calendar/worker.ts`                   | Cut process/Resume routing через существующие lease/credentials.                                     |
| `apps/api/src/routes/schedule.ts`                   | Public move/end routes подключены к accepted command contract.                                       |
| `apps/api/src/schedule/command-apply.ts`            | Exposed owned verified cut apply seam.                                                               |
| `apps/api/src/schedule/command-plan.ts`             | Series evidence/operation поддержаны существующим command prepare.                                   |
| `apps/api/src/schedule/cut-apply.ts`                | One transaction, current marks, reserved domain/mapping/revision и stale-lineage refusal.            |
| `apps/api/src/schedule/cut-proof.ts`                | Проверка all required stored ACKs и актуального final proof перед SQL writes.                        |
| `apps/api/src/schedule/series-command.ts`           | Once-reserved UUID/event IDs, immutable lineage и actual preconditions.                              |
| `apps/api/src/schedule/series.ts`                   | Pure canonical prepare; obsolete uncalled direct domain cuts удалены.                                |
| `e2e/marks.spec.ts`                                 | Existing durable cut-history entry без расширения file сверх limit.                                  |
| `e2e/move.spec.ts`                                  | Existing journey registry содержит cut prepare/recovery.                                             |
| `e2e/support/calendar-commands.ts`                  | Target-bound retained private cut cases с narrow typed fields.                                       |
| `e2e/support/calendar-cut.ts`                       | Public-interface cut/mark/recovery observables и real persistence assertions.                        |
| `packages/db/src/calendar-transition-values.ts`     | Sole internal Registry owner для captures, sparse facts и final ACK shape.                           |
| `packages/db/src/calendar-values.ts`                | Cut plan/stage ACK composition в существующий Registry.                                              |
| `packages/db/src/index.ts`                          | Export internal Registry symbols для их actual consumers.                                            |

Public DTO не изменён. Required parent `binding.lesson.studentId` сохранён. DB columns/migrations/dependencies/env не добавлены. Planned read-model/marks behavior использует existing readers/mark locks; эти два files не требовали edits. Actual additions объявлены по owned modules перед edits; PLAN inventories обновляет parent.

## Deviations and fixes

1. **Rule 1/2 — genuine minimum cancelled shape.** New observer первоначально требовал current start/end для cancelled tail. Он заменён distinct current sparse identity + authentic prior ACK history; downstream capture/inactive/prefix/empty-master readers согласованы с этой shape. Ни baseline, ни local time не объявлены post-write provider event.
2. **Rule 1 — source simplify/type chain.** Extracted validators сохранили invariants и снизили CC/cognitive. Optional baseline и narrow stage lookup получили правильные type guards. Ошибочное удаление реально используемого `GoogleFamilyResource` export исправлено. Lookup 09 использует actual `plan.input.ref`, не предполагаемый top-level field.
3. **Rule 2 — current-mark eligibility and fences.** Unreserved eligible current mark отказывает в apply. Expired/unreconciled first write не получает поздний dispatch. Final credential generation — actual captured confirmation, не inferred command generation.
4. **Simplify — confirmed dead exports.** Старые direct cut/end paths без callers удалены вместе с private helpers, без удаления файла. Targeted caller evidence и compiler подтвердили seam migration.

Нет package installs, runtime/auth попыток, external writes или новых agent runs. Known blocking source stubs не оставлены. Unrun provider verification — ограничение capability, не PASS. Полное начало execution не сохранилось; 53min — исходный интервал T1→T3. Actual tokens = ceil(151924 source-diff characters/4) по 32 source paths. Measured ledger interval base→651e498 содержит пять source commits и два предыдущих docs commits; этот final docs commit вне recorded interval.

## Bounded recovery correction: d5f8ff6 evidence

Этот раздел хранит evidence d5f8ff6. Актуальный residual proof и hashes приведены ниже.

Оба static findings подтверждены. Смена credentialGeneration без смены connection.generation оставляла ACKed complete в skip loop, хотя apply правильно отказывал. Catch сохранял journal, но скрывал actual CalendarFault от credentials.recordFailure.

- `cutCompletionIsCurrent(stage, connection)` проверяет actual complete ACK и обе generation. Его использует execute и узкий guard повторного READ. ACKed WRITE остаётся запрещённым к повтору. Stale complete выполняет настоящий `readCutComplete`, включая `verifyPrimary`, resources/identities/prefix, с новым attempt и actual ACK. Старому proof новая generation не присваивается.
- `checkGrant` также требует active credentialMode. Apply credential fence не изменён. Request/IDs/plan, acknowledged writes и их provenance сохранены.
- Catch сначала выполняет `pauseTransition`, затем пробрасывает actual auth CalendarFault. Existing `credentials.recordFailure` остаётся единственным writer connection state/issue. Command issue сохраняет reconnect_required/permission_required. Нового auth retry нет.
- До backend edits расширен existing cut recovery source. Private `cuts.recoveryBoundaries` содержит два retained command references: actual after-complete restart/refresh boundary и один actual provider auth failure. Это ссылки для operator lifecycle, не доказательство restart и не fake response. Journey требует actual stored complete/write ACKs, смену credential epoch при той же auth generation, fresh read attempt, те же plan/UUIDs и отсутствие повторных ACKed writes. Для auth он требует connected admission и pending verify stage, затем public HTTP409, actual command/connection auth issue, partial recovery и неизменный domain/prefix. 401 и 403 проверяются отдельными runs с восстановленным реальным grant.
- Реальные restart, OAuth refresh и Google 401/403 не исполнялись. Operator должен создать границы через реальный transport/process lifecycle; SQL подмена epoch/stages не является допустимой fixture. Все эти journeys NOT RUN.

Изменены ровно четыре source files и этот SUMMARY:

| File                                          | Причина                                                                          | Current SHA-256                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/api/src/calendar/transitions.ts`        | Fresh complete вместо stale skip; journal-before-auth propagation                | `c3c3094b6d3a99a912fd14f0aceac1b31ff2a34b39d7c02fe2705e3782a72491` |
| `apps/api/src/calendar/transition-journal.ts` | Narrow stale complete READ guard, active grant, actual auth issue                | `2a2ac0a7fd89dccc3cdd7fce4914a0fba0de43802e9fb34d1780b0e04da0a949` |
| `e2e/support/calendar-cut.ts`                 | Durable rollover/auth failure observables через public Resume и real persistence | `cc8b21c088782e1cba6bf630166b38a1daaccaf6f87692adf3c4c2d53338f913` |
| `e2e/support/calendar-commands.ts`            | Validated private retained boundary references                                   | `8d4a4d5f31fc227ce93fb1787e98228509cfbae72207f4f03c3fa350e106cced` |

Current 32/32 fingerprints совпали после commit. Остальные 28 source files неизменны относительно исходного quality. Full current 32 hashes и measurements: private STATE_DIR `phase24-10-correction-quality.json`; exact expanded argv `phase24-10-correction-command.json`; measured actuals/hashes `phase24-10-correction-metadata.json`; format log `phase24-10-correction-format.log`. Type input fingerprint: `74a212fdfc958e3318e7614841415e07861eab195adb37f27b99d1f4ca357a91`. Unknown boundary reviews актуальны по source hash; missing/stale=[]; any/diagnostics отсутствуют.

Simplify выполнен через общие freshness/auth predicates и lastPendingStage, без нового subsystem/Registry/public DTO. До→после correction: execute CC17→15/cognitive20→16; begin-stage callback CC19→18/cognitive17→16; pause callback CC17→18/cognitive20→21. Первые scoped runs обнаружили CC22/cognitive22/24; после bounded extraction превышения устранены. Targeted caller search подтверждает использование всех новых helpers. Full KNIP не повторялся.

Финальные typecheck/build/Prettier/discovery/diff check завершились exit0. Discovery: 5 tests in 4 files, не execution. Exact format argv остаётся `phase24-10-format-command.json`; актуальный quality argv приведён выше. Main/shared metadata/provider/runtime не менялись. Correction не начинает 11.

## Residual recovery correction: 651e498

Static finding подтверждён: при fresh READ complete ACK очищался, но command оставался projection_pending; pause возвращался до записи read failure. Изменение ограничено existing owners.

- `beginTransitionStage` в той же transaction, где начинает READ и очищает ACK, переводит confirmed command в partial_recovery/effect partial/nextAction resume_recovery. Это действует из projection_pending и recovery_required. До HTTP уже есть recoverable journal. Auth/external_change/provider_unavailable после READ получают существующий pause path; старый complete не объявляется current proof.
- Necessary caller `worker.ts`: `projectIfCurrent` под existing lease проверяет actual complete ACK/его обе generations против current connection. Current valid complete идёт прямо в projectCommand, без token refresh/provider calls. Stale/missing complete сохраняет existing requireRecovery до входа в credentials/executeTransition; SQL attempt с stale proof не нужен. SQL-only failure с сохранившимся valid ACK по-прежнему не повторяет provider writes.
- Public DTO/Registry/credentials owner/cut-proof не менялись. ACKed writes, original command/plan/reserved UUIDs, history и текущие marks сохранены. HTTP внутри SQL transaction нет.
- До behavior edits existing durable boundary case получил initialState projection_pending или recovery_required и actual failure modes auth/external_change/provider_unavailable. Projection case ожидает startup worker; recovery case вызывает public Resume. Полный runtime matrix — оба initial states × 401/403/external change/transport failure, отдельные retained runs/grants. Initial state в manifest проверяется против actual public snapshot, а не принимается как доказательство.
- Failed-read case требует actual старый complete ACK и credential rollover при той же auth generation, новый READ attempt, outcome_unknown/null ACK, partial_recovery/resume_recovery/no confirmedRevision, тот же plan и ACKed write prefix, unchanged domain/history/marks. Provider-unavailable case использует existing real GET drop_response, требует response_dropped evidence, disarm и новый public Resume до fresh proof/applied; old marks/exceptions остаются. Это не fake 503/body/ACK. Auth и external change готовит оператор через actual provider lifecycle, не SQL epoch/state/ACK подмену.
- Runtime matrix NOT RUN: grant/runtime lease отсутствуют. Source paths и fixtures не являются actual crash/provider proof. Новые suite/env/fixtures не создавались.

| Changed file                                  | Причина                                                                                | Current SHA-256                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/api/src/calendar/transition-journal.ts` | Atomic invalidation complete proof и recoverable partial state до READ                 | `12dc6821327f33ff6862e25eb9835a855784867dde150d4d47af77861ff3346e` |
| `apps/api/src/calendar/worker.ts`             | Startup stale-proof routing; valid current ACK остаётся SQL-only                       | `b6617fcdacf7f802eb7fcbb0b79889bac4d578a983d1dedf8821a4903e16eb1c` |
| `e2e/support/calendar-commands.ts`            | Validated initial-state/failure selector в private retained boundary                   | `0aaf34cdbf45cbedcb06b5b8cd16b3e650acec3d97f9f127959c5bb15416f639` |
| `e2e/support/calendar-cut.ts`                 | Оба initial states, failed fresh READ, same-journal recovery и real transport evidence | `e0d0231b76301b585ad36a74ea84ffc05a5dd24b9b927907cb399042a8d7940d` |
| `24-10-SUMMARY.md`                            | Actual residual inventory, evidence, hashes и runtime limits                           | docs only                                                          |

Mandatory simplify выполнен; failedCompleteRead выделен как связная failure-path responsibility. Callback metrics current: begin CC18→20/cognitive16→18; worker processCommand CC14→15/cognitive15→16; recoveryBoundaries CC10→11/cognitive11→14; failedCompleteRead CC9/cognitive11. Метод и версии unchanged. New private helpers имеют callers; подтверждённых dead findings нет, full KNIP owner13 не повторялся.

Текущий quality: PASS `50b4391615e55010e395e9842f77e117d046cae1ea351dcfad8268807023f6b2`; type input fingerprint `871c9754d6e9e71954c24350097a91e9b86174f1924520ba60ed2fbcdb5356fc`; 32 source +3 measuring files, 538 functions/298 changed. Current 32 hashes совпали после atomic commit; 28 source hashes unchanged от d5f8ff6 proof. any/diagnostics/missing/stale отсутствуют. Initial check UNVERIFIED из-за raw HTTP unknown в новом journey; response boundary исправлен existing object validation для отказа и sole public receipt schema для accepted response, затем final check PASS.

Existing private STATE_DIR: exact expanded argv `phase24-10-residual-command.json`, полный 32-fingerprint result `phase24-10-residual-quality.json`, measured ledger/source tokens `phase24-10-residual-metadata.json`, format log `phase24-10-residual-format.log`. Exact format argv: `phase24-10-format-command.json`. Команды verification table выше исполнены на final source; все exit0, API build 105ms, discovery 5 tests in 4 files. `--list` не execution. Main/shared metadata/parent docs 81a1175 не изменены; STOP before11.

## Worktree and handoff

ROOT `~/.claude/worktrees/phase24-contracts/dv-lab`, branch `agent-24-contracts`, expected base `913fc5ae9286aca9a48b5ce4272699c846849874`. Main не изменялся. Preserved untracked `apps/web/AGENTS.md` исключён из owned diff и quality scope. Tracked file deletions отсутствуют.

API build lease освобождена после завершения static checks. Runtime/DB/provider lease не использовалась. Source 10 готов для parent integration/review; actual Google acceptance остаётся открытой. STOP before 11.

## Self-Check: PASSED

SUMMARY существует на canonical path. Все 32 source files существуют; commits `27f71ce`, `bc27868`, `838aba8`, `ab502d5`, `d5f8ff6`, `d02b783`, `651e498` — ancestors текущего HEAD. После residual commit все 32 fingerprints совпали с current native quality. Tracked file deletions отсутствуют. Shared metadata и parent docs commit `81a1175` не изменялись и не merge-лись в этот worktree.
