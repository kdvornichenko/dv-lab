---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '08'
status: complete
verification-status: source-only-unverified-runtime
subsystem: api
tags: [google-calendar, conditional-patch, tombstone, journal, recovery, e2e]
requires:
  - phase: '24-07'
    provides: Immutable create journal, verified ACK, connection lease и recovery
provides:
  - Single move/cancel/restore через conditional Google result и confirmed apply
  - Authentic absence proof и immutable reserved replacement generation
  - Deadline, stage/auth fencing, bounded reads и один coordinated 401 refresh
affects: ['24-09', '24-10', '24-12', '24-13', '24-14']
tech-stack:
  added: []
  patterns: [prepare-confirmed-apply, conditional-if-match, reserved-representation, bounded-reconciliation]
key-files:
  created:
    - apps/api/src/schedule/single-command.ts
    - apps/api/src/calendar/single-observation.ts
    - apps/api/src/calendar/cancelled-singles.ts
    - e2e/support/calendar-single.ts
  modified:
    - apps/api/src/routes/schedule.ts
    - apps/api/src/schedule/changes.ts
    - apps/api/src/schedule/command-plan.ts
    - apps/api/src/schedule/command-apply.ts
    - apps/api/src/calendar/commands.ts
    - apps/api/src/calendar/journal.ts
    - apps/api/src/calendar/event-mapping.ts
    - apps/api/src/calendar/gateway.ts
    - apps/api/src/calendar/command-result.ts
    - apps/api/src/calendar/dispatch.ts
    - apps/api/src/calendar/recovery.ts
    - apps/api/src/calendar/worker.ts
    - apps/api/src/calendar/credentials.ts
    - apps/api/src/calendar/connection-control.ts
    - apps/api/src/calendar/read-model.ts
    - e2e/move.spec.ts
    - e2e/support/calendar-commands.ts
key-decisions:
  - Single expectedVersion относится к target binding, create expectedVersion — к complete window revision.
  - Persisted cancellation ACK даёт cancelled binding и сохранённое время; он не является текущим Google absence proof.
  - Replacement generation резервируется только после authenticated GET404, bound primary access, complete identity search и confirmed cancellation facts.
  - Unsent unresolved restore может завершить proof только по explicit resume внутри исходного deadline; после expiry он failed/not_applied.
  - Recovery никогда не повторяет unknown write. GET404 unknown insert не доказывает non-application.
  - Real ACK с незавершённой проверкой единственной representation сохраняется как confirmed effect/recovery_required без domain apply.
requirements-covered: [GCAL-02, GCAL-03, GCAL-09]
requirements-completed: []
duration: 41.5 min source execution
completed: 2026-10-12
source-start-utc: '2026-10-11T19:02:09.679280+00:00'
source-finish-utc: '2026-10-11T19:43:37.391563+00:00'
actuals:
  tokens: 26653
  tasks: 3
  commits: 3
commits: 3
plan_head_before: 6ada73b31758986538c9db9c8312570a6f737d8d
plan_head_after: 407d9c99fa53afe681d168ff08b2c7efe2451918
---

# Phase 24 Plan 08: Conditional single edits, tombstone proof и fences Summary

Single move/cancel/restore проходят immutable journal и настоящий If-Match PATCH. Lesson projection меняется после verified Google result. R2 резервирует новый deterministic ID по полному authentic absence proof. Исходники и static/build checks завершены. Runtime/Google/DB acceptance не выполнялась и остаётся UNVERIFIED.

## Task Commits

| Задача      | Коммит    | Результат                                                                                                     |
| ----------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| T1 / SC2    | `c5bd283` | Public single routes, prepare/confirmed apply, conditional PATCH, source journeys                             |
| T2 / SC2/R2 | `8441f2a` | Complete absence proof, reserved replacement, retained cancellation history, explicit unresolved-proof resume |
| T3 / SC3/4  | `407d9c9` | Deadline/auth/stage fences, bounded reads, 401 refresh, stale/reject/lost-admission source cases              |

Native per-plan ledger измеряет три source commits. `actuals.tokens` = ceil(chars/4) над realized Git diff между указанными HEAD. Это не harness token count. Duration измерен от birth time первого нового owned source file; начальное чтение в него не включено. Metadata commit в число source commits не включён.

## Инварианты исходников

- Все public single mutations принимают Frozen DTO02 и возвращают receipt 202. Старые direct mutation helpers не подключены к этим HTTP routes.
- Подготовка сохраняет requestId, inputHash, original expectedVersion, target IDs, payload, time zone и stage digest. Она не меняет lesson или marks.
- Проверяются local history, authoritative target start, expectedStartsAt, default time zone, active mapping, connection generation и target version. Исторический lesson не превращается в будущую offline edit.
- PATCH отправляет настоящий `If-Match`. Body содержит owned fields. Другие private properties сохраняются; остальные writable fields не отправляются. GET reconciliation сравнивает identity, owned fields, digest и unowned writable fingerprint.
- Cancelled binding строится только по applied cancellation ACK и saved lesson data. Это представление сохранённой cancellation, а не fabricated Google resource или fabricated GET404.
- Missing tombstone требует реального GET404, authenticated bound primary access, complete paginated identity search с showDeleted и одного private identity predicate. Результаты проверяются локально. Contradictory/incomplete proof не разрешает insert.
- Reservation transaction сохраняет старый mapping как retired history и новый как reserved. ID зависит от stable connection/calendar/local identity/representation generation. Повтор принятого request использует тот же reserved ID и generation.
- Если proof не завершён, command остаётся recovery_required без dispatch. Explicit resume до исходного deadline может записать proof и единственный новый write stage. Исходный unsent stage сохраняется как failed/none; requestId/inputHash/input не меняются. Reserved generation после этой записи неизменна.
- После replacement ACK и при GET recovery выполняется полный identity search. Projection разрешается только при одной active representation с reserved ID. Если последующая проверка недоступна, настоящий ACK и его HTTP status сохраняются, command остаётся recovery_required.
- Definitive rejected replacement освобождает reservation и возвращает cancelled history binding. Новая попытка требует нового Save; поколения прежнего request не переиспользуются как retry counter.
- Admission deadline — 30 секунд, HTTP timeout — 10 секунд, automatic reconciliation budget — 30 секунд и максимум три read attempts. Backoff имеет capped jitter. Retry-After помещается в оставшийся budget либо переводит command в explicit recovery. SDK automatic writes retry выключен.
- Один proven rejected 401 допускает coordinated refresh под существующим lease и повтор того же immutable request после revalidation. Повторный 401, 400, permission 403 и write 429 не превращаются в позднюю edit.
- 409/412 требуют GET ownership verification. Proven rejected attempts плюс противоречащий provider fact дают failed/none/external_change. Unknown GET404 сохраняет uncertainty и reservation; одного absence observation недостаточно для non-application.
- Late result проверяет command/stage/digest/connection/credential generation. Он не удаляет чужой barrier и не применяет domain при смене auth generation.
- Новый pending row может появиться до admit: sweep ожидает admission или deadline. Pending row, созданный до запуска текущего worker и потерявший admission, завершается failed/not_applied. Restart не отправляет старую unsent edit.

## Verification

| Команда                                                                                                                                                              | Exit / статус      | Краткое доказательство                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| `yarn workspace @dv-lab/api typecheck`                                                                                                                               | 0 / PASS           | Нет diagnostics после final source edits                                           |
| `yarn workspace @dv-lab/api build`                                                                                                                                   | 0 / PASS           | `Build complete in 96ms`; build lease получена и затем освобождена                 |
| `yarn exec prettier --check` со всеми 21 owned paths ниже                                                                                                            | 0 / PASS           | `All matched files use Prettier code style!`; final worker отдельно также проверен |
| `git diff --check`                                                                                                                                                   | 0 / PASS           | Нет whitespace errors                                                              |
| `E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/move.spec.ts --grep '\[calendar\] (single changes\|tombstone\|command races)' --project=light --list` | 0 / DISCOVERY ONLY | 12 source scenarios + setup/cleanup = 14 tests                                     |
| `yarn node scripts/dev-checks/calendar-quality.ts` с argv ниже                                                                                                       | 0 / PASS           | Current fingerprints, no stale files, no any/type/metric violations                |

Полные argv quality check сохранены также в private `STATE_DIR/phase24-08-quality-command.json`. Остальные private artifacts: `phase24-08-task1-quality.json`, `phase24-08-task2-quality.json`, `phase24-08-quality-final.json`, `phase24-08-api-build.log`, `phase24-08-actuals.json`, `phase24-08-source-attestation.json`. Первоначальный formatting check выявил только formatting в event-mapping; исправление не изменило поведение. Финальный check прошёл.

```bash
yarn node scripts/dev-checks/calendar-quality.ts --base 6ada73b31758986538c9db9c8312570a6f737d8d \
  --owned apps/api/src/calendar/cancelled-singles.ts \
  --owned apps/api/src/calendar/command-result.ts \
  --owned apps/api/src/calendar/commands.ts \
  --owned apps/api/src/calendar/connection-control.ts \
  --owned apps/api/src/calendar/credentials.ts \
  --owned apps/api/src/calendar/dispatch.ts \
  --owned apps/api/src/calendar/event-mapping.ts \
  --owned apps/api/src/calendar/gateway.ts \
  --owned apps/api/src/calendar/journal.ts \
  --owned apps/api/src/calendar/read-model.ts \
  --owned apps/api/src/calendar/recovery.ts \
  --owned apps/api/src/calendar/single-observation.ts \
  --owned apps/api/src/calendar/worker.ts \
  --owned apps/api/src/routes/schedule.ts \
  --owned apps/api/src/schedule/changes.ts \
  --owned apps/api/src/schedule/command-apply.ts \
  --owned apps/api/src/schedule/command-plan.ts \
  --owned apps/api/src/schedule/single-command.ts \
  --owned e2e/move.spec.ts \
  --owned e2e/support/calendar-commands.ts \
  --owned e2e/support/calendar-single.ts \
  --new apps/api/src/schedule/single-command.ts \
  --new apps/api/src/calendar/cancelled-singles.ts \
  --new apps/api/src/calendar/single-observation.ts \
  --new e2e/support/calendar-single.ts \
  --boundary-review 'apps/api/src/calendar/command-result.ts:72:1c020999d7c05ade5305c25df59243b668fc9b5c5d568feb50e704aeae583709:Unvalidated Google HTTP value parsed by zod before ownership verification' \
  --boundary-review 'apps/api/src/calendar/command-result.ts:134:1c020999d7c05ade5305c25df59243b668fc9b5c5d568feb50e704aeae583709:Unvalidated Google HTTP value parsed by zod before ownership verification' \
  --boundary-review 'apps/api/src/calendar/command-result.ts:156:1c020999d7c05ade5305c25df59243b668fc9b5c5d568feb50e704aeae583709:Unvalidated Google HTTP value parsed by zod before ownership verification' \
  --boundary-review 'apps/api/src/calendar/gateway.ts:365:9040c473d146e1e5e6045bcfeffd33ada47729abc2aa8788f2a3031ece7d1a1d:Unvalidated provider error headers parsed by zod before bounded Retry-After use' \
  --boundary-review 'apps/api/src/calendar/gateway.ts:399:9040c473d146e1e5e6045bcfeffd33ada47729abc2aa8788f2a3031ece7d1a1d:Unvalidated provider error headers parsed by zod before bounded Retry-After use' \
  --boundary-review 'apps/api/src/calendar/dispatch.ts:209:b2c82b7e732e012fd0bfee5b69fc1a30420c9cc0b4d4e34df29c5c9c9448e1ed:Unvalidated thrown value narrowed to CalendarFault or GoogleWriteFault before classification' \
  --boundary-review 'apps/api/src/calendar/recovery.ts:217:1156436c0dd40a3d04efa231f4fc2e5c3415b09a2e92bb86a38b5f82a8b9b2bd:Unvalidated thrown value narrowed before provider failure classification' \
  --boundary-review 'apps/api/src/calendar/credentials.ts:94:0f1fa356a0fb1ac3df7b1d47cf6cf0fc7531d86657ac7cad65a76cad447b2d18:Unvalidated thrown value narrowed to CalendarFault before public classification' \
  --json
```

### Quality и simplify

Fingerprint: `427a4685e40a7f49594a68de0207ad1382e1d1aa718986c55ceab220a681453f`. Attested source HEAD: `407d9c99fa53afe681d168ff08b2c7efe2451918`. Realized diff fingerprint: `fecd8111b399fb892143891b7bbe94cd20c7f2fc7101fad73b57e4c86470397a`. Built server.mjs SHA-256: `0524c05ab38c6d1b60ae54d783190410399d6a1977a72a3e056aba20bb363844`.

Scope — 21 changed source files и три существующих файла measurement tool. 415 функций, 210 changed. Node 24.17.0, TypeScript 6.0.3, ESLint 10.12.0. Максимумы changed функций: CC 20, cognitive 19, Halstead Difficulty 40.2. Максимальная длина — 490 physical lines. Any findings/type diagnostics отсутствуют. Unknown используется только на reviewed input/error boundaries.

Метод: ESLint classic AST для CC. Cognitive — DVLab AST nesting/control/logical-sequence v1, не Sonar. Halstead — executable AST leaves; identifiers/literals являются operands, executable keyword/punctuation SyntaxKind — operators. Trivia, imports, erased type syntax/modifiers исключены. D=(n1/2)*(N2/n2). Nested callbacks измеряются отдельно. SQL string проверен по семантике; отдельной SQL/runtime метрики не заявлено. Generated dist/dependencies не включены в handwritten source gate.

| Функция                                          | CC before | CC after |
| ------------------------------------------------ | --------- | -------- |
| prepareScheduleCommand                           | 19        | 5        |
| prepareCreateCommand, extracted validation owner | —         | 19       |
| applyConfirmedCommand                            | 17        | 18       |
| dispatchCommand                                  | 7         | 15       |
| handleReadFailure                                | 14        | 18       |

Полные пары и source/tool fingerprints находятся в private quality artifact. Simplify удалил redundant target read и unused export confirmedCancellation; shared validation/write owners сохранены. Новых code comments, dependencies и test suites нет. Confirmed dead/redundant findings в owned diff не оставлены; repository-wide audit не заявлен. `e2e/move.spec.ts` имеет 490 строк: integration с 12 должна сохранить gate <500.

## Изменённые файлы

| Файл                                                                              | Причина                                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| apps/api/src/schedule/changes.ts                                                  | Pure single validation, history guard и shared SQL apply seam                   |
| apps/api/src/schedule/command-plan.ts                                             | Dispatch create/single prepare и immutable 30-second admission                  |
| apps/api/src/schedule/single-command.ts                                           | Target binding/version, captured payload и single command plan                  |
| apps/api/src/schedule/command-apply.ts                                            | Single domain/mapping apply после verified result                               |
| apps/api/src/routes/schedule.ts                                                   | Реальное подключение move/cancel/restore к receipt 202                          |
| apps/api/src/calendar/commands.ts                                                 | Single admission и корректное распространение CommandFault                      |
| apps/api/src/calendar/journal.ts                                                  | Stage selection, proof persistence, reservations и fail-unsent                  |
| apps/api/src/calendar/event-mapping.ts                                            | Deterministic replacement generation и mapping history                          |
| apps/api/src/calendar/single-observation.ts                                       | Authentic cancellation/absence observations и bounded explicit resume           |
| apps/api/src/calendar/cancelled-singles.ts                                        | Saved cancellation binding без fake current provider fact                       |
| apps/api/src/calendar/read-model.ts                                               | Показ saved cancelled bindings в public window                                  |
| apps/api/src/calendar/gateway.ts                                                  | If-Match PATCH, full identity search, post-ACK uniqueness и Retry-After parsing |
| apps/api/src/calendar/command-result.ts                                           | Insert/patch verification и unowned writable fingerprint                        |
| apps/api/src/calendar/dispatch.ts                                                 | Stage/auth/clock fences, rejection classification и one-shot 401 retry          |
| apps/api/src/calendar/recovery.ts                                                 | Bounded GET comparison, 409/412 evidence и honest unknown absence               |
| apps/api/src/calendar/worker.ts                                                   | Deadline/lost-admission handling и serialized explicit resume                   |
| apps/api/src/calendar/credentials.ts                                              | Coordinated rejected-401 refresh в существующем credential owner                |
| apps/api/src/calendar/connection-control.ts                                       | Disconnect завершает proven unsent/rejected commands без позднего dispatch      |
| e2e/move.spec.ts                                                                  | Подключение durable single/tombstone/race source scenarios                      |
| e2e/support/calendar-single.ts                                                    | Public journeys и retained authentic provider/process fixture assertions        |
| e2e/support/calendar-commands.ts                                                  | Валидные DTO для disconnected single journey                                    |
| .planning/phases/24-google-calendar-connection-and-outbound-sync/24-08-SUMMARY.md | Source results, measured actuals и границы verification                         |

## Deviations from Plan

1. **[Rule 2 — Owners]** Routes, confirmed cancellation read helpers и credential refresh owner необходимы для SC2/R2/SC3. Inventory объявлен до правок. Public Frozen DTO02, DB schema и dependencies не менялись. `schedule/schedule.ts` не потребовал изменений: готовый create owner из 07 переиспользован.
2. **[Rule 1 — Admission]** Await single admission сохраняет CommandFault; missing await превращал ожидаемый отказ в provider error. Дополнительно устранена race между journal commit и worker admit.
3. **[Rule 2 — Preservation]** Core legacy actions допускают историю. Calendar preparation/dispatch отдельно запрещают historical target; старые internal helpers остаются совместимыми. Cancelled binding и post-ACK identity check закрывают provider sparse/disappeared representation.
4. **[Rule 1 — E2E transport]** PATCH fault selector использует resource=event, а не collection events. Existing disconnected helper отправляет Frozen valid DTO.
5. **Execution authority override:** выполнен source plan, несмотря на obsolete planning-only boundary. Source commits имеют Codex trailer. Shared STATE/ROADMAP/REQUIREMENTS/HANDOFF и WINDOWS не менялись: ими владеет parent. Никакие файлы не удалены; сохранён untracked apps/web/AGENTS.md.

## UNVERIFIED / handoff parent 13

- Все три planned functional commands без --list **NOT RUN**: single changes, tombstone, command races. Discovery не является execution. Runtime/node service processes, DB writer и Google target не арендованы. Main TEST PRIMARY/grant не найден. Source нельзя выдавать за runtime proof или выполненный GCAL acceptance.
- Native disappearing tombstone требует реальной provider observation. Fake/synthesized 404 запрещён. Retained fixture `calendar-single.json` связан с target build/persistence/student и требует actual disappeared cancelled single; gateway proof остаётся обязательным независимо от manifest.
- `calendar-command.json` задаёт существующую attested synthetic fixture. `calendar-races.json` содержит retained cases для настоящих 412, 403, 429, expiry, lost admission, late disconnect и changed-unowned observations. Assertions не создают эти provider/process failures. Их setup и execution принадлежат 13. One-shot 401 refresh runtime отдельно не проверен.
- Main creation helper требует `retainedStudent(fixture.studentId)` до teacher/API/SQL действий внутри helper. Parent source 8fbd404 интегрирован merge 8c9eff4 без сброса коммитов08. Adapter использует точную upstream signature `retainedStudent(id: string): string`; retained lifecycle проверяется по существующему ownership registry. data.ts/prelaunch-sql.ts вручную не изменялись. Runtime authority и реальные provider fixtures остаются обязательными.
- Полное доказательство runtime должно содержать code/build fingerprint, scenario/fixture refs, expected/observed result, original exit, target/persistence identity и rerun command. Private artifacts этой работы доказывают только static/build результаты.
- Full regression, combined source 12/13 build и live provider permission/quota/late response branches остаются у parent/13. Новые unit/component/contract/integration suites не создавались.

Точные planned reruns после выдачи runtime/fixture authority:

```bash
E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/move.spec.ts --grep '\[calendar\] single changes' --project=light
E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/move.spec.ts --grep '\[calendar\] tombstone' --project=light
E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/move.spec.ts --grep '\[calendar\] command races' --project=light
```

## Known Stubs

`routes/schedule.ts:164` сохраняет intentional history_only capability block для occurrence/series mutations. Это scope 09/10. Single routes реализованы. Других owned goal-blocking placeholders/TODO/FIXME не найдено. Пустые accumulators/null single rule — реальные значения, не UI stubs. Retained guard adapter интегрирован; functional runtime proof остаётся UNVERIFIED.

## TDD Gate Compliance

TDD_MODE из SDK — false; plan type execute. Durable source scenarios написаны перед основным соответствующим behavior. RED/GREEN functional execution не выполнялась из-за отсутствия runtime authority/provider fixture. Canonical runtime TDD PASS не заявлен. Static discovery и typecheck не заменяют RED/GREEN.

## Next Boundary

Source tasks 08 завершены. 09 не начат. Parent владеет shared metadata, inventory integration и runtime acceptance. API build lease освобождена после final build. Никакие owned runtime services не запускались. Auth gates не исполнялись; live connection/grant является external verification dependency, а не simulated success.

## Self-Check: PASSED

Все четыре созданных source/helper файла и SUMMARY существуют. Коммиты c5bd283, 8441f2a и 407d9c9 являются ancestors текущего HEAD. Каждый source SHA-256 совпадает с final quality artifact. Source deletion check пуст. Untracked apps/web/AGENTS.md сохранён по assignment. Shared metadata и чужие source files не изменялись.

## Retained Guard Integration

Source commit `1311bc9` меняет только `e2e/support/calendar-commands.ts`: import/call `ownedStudent` заменён на `retainedStudent`. Parent integration merge `8c9eff4` сохраняет source08 и принимает upstream13; shared metadata приходит только из parent commits. Simplify: дополнительный adapter или compatibility layer не требуется.

- `yarn node scripts/dev-checks/calendar-quality.ts --base 8c9eff41034018c2720eb6f814dc0b126f1de840 --owned e2e/support/calendar-commands.ts --json`: exit0, PASS. Private evidence `STATE_DIR/phase24-08-retained-quality.json`; fingerprint `74af2042e25d6bcbd5dd8d96074bacbb056d58970c64322a032b9f459fbb831b`. Helper SHA-256 `c213f8e30d8dbccfcf65ffb45b229d3ce22b909b9b94cd92aa3bb49e35b82677`, 175 lines. Changed function CC10→10, cognitive6→6, Halstead D22.04→22.04; method/tool convention выше. Missing/stale/type/metric violations отсутствуют.
- `yarn prettier --check e2e/support/calendar-commands.ts`: exit0, all matched files use Prettier style.
- `git diff --check`: exit0.
- `env E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/move.spec.ts --grep '\[calendar\] (single changes|tombstone|command races)' --project=light --list`: exit0, 14 tests in3files, discovery only.

Parent сообщил ownership E2E local_dev: 1passed3.9s и остановленный dev. Это upstream fixture ownership evidence, не runtime proof08. Собственные runtime/DB/Google journeys не запускались. Frozen DTO не изменён; captured command generation остаётся immutable, actual confirmation generation проверяется в ACK/apply. UI completion fence после Resume согласует parent/Arendt.

Integration self-check: upstream `retainedStudent(id: string): string` доступен из merge; source commit существует; diff не содержит deletions. Основные source-task metrics/actuals выше относятся к исходным трём атомарным задачам до integration follow-up.

## Integration Review Corrections

Все три замечания независимого review приняты. Source closure не означает connected runtime acceptance.

| Finding                             | Commit    | Source result                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CR-01 / P1 minimal cancellation ACK | `1d7bbbe` | Direct successful conditional PATCH допускает id/etag/status без private markers. ID/status/тип/recurrence и фактический 2xx проверяются; gateway передаёт actual If-Match. `conditionalCancellation: true` отделяет происхождение direct ACK от GET. Captured baseline fingerprint остаётся явным baseline. Sparse GET проходит прежний строгий verifier и не доказывает наш PATCH. |
| CR-02 / P1 R2 writable preservation | `607aefa` | Immutable validated snapshot capture при отмене; replacement body восстанавливает supported values и проверяет fingerprint в ACK. Missing/unsupported snapshot даёт recovery_required/external_change без reservation/insert. Explicit unsent resume не отправляет такой replacement.                                                                                                |
| CR-03 / P2 admission budget         | `e431f2f` | Один absolute deadline context.now+30000 ограничивает refresh и все reads/capture. Signal объединён с lease до token refresh. Expiry до/после persist внутри transaction откатывает admission; public refusal not_applied. Deadline не пересоздаётся после provider reads. HTTP timeout10s сохранён.                                                                                 |

### Registry and provider boundaries

`packages/db/src/calendar-values.ts` остаётся sole owner private JSON validators. Добавлены `googleUnownedWritable`, optional precondition/ACK snapshot, insert payload `preserved`, typed cancellationBaseline и conditionalCancellation provenance. Existing JSON columns используются без migration/new columns. Public packages/contracts DTO не изменён.

Supported snapshot: description, location, colorId, guest permissions, transparency, visibility, reminders, source, non-dv private/shared extendedProperties. Strict schemas отвергают unsupported values. Attendees/attachments/conferenceData блокируют replacement вместо потери полей. [Google Events insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) описывает attendee response reset и специальные параметры conference/attachment writes; безопасное копирование этих полей в текущем scope не заявлено. [Events resource](https://developers.google.com/workspace/calendar/api/v3/reference/events) допускает sparse cancelled resources. Для direct ACK дополнительно требуются actual status/etag/ID; missing etag не синтезируется. Auth generation и credential generation fences сохранены.

### E2E source and unavailable execution

Before основным соответствующим behavior добавлены source assertions в existing durable journeys: minimal native cancellation, restored description/location и сохранённый fingerprint; paginated admission budget через actual response delay/pageSize1. Unsupported snapshot branch также имеет public recovery/no-write assertions. Sparse ACK scenario требует реальной retained native observation; fake response payload не создаётся. Новый narrow helper `calendar-admission.ts` работает через public API и real persistence, без unit/contract/integration suite.

Private fixture inputs: calendar-minimal-cancel.json, calendar-single.json, calendar-single-unsupported.json, calendar-admission.json. Они обязаны совпадать с target build/persistence/student; retained lifecycle проверяет общий calendarCommandFixture. Admission fixture требует реальное natural disappearance и минимум6 страниц identity search при pageSize1; expected result409/not_applied за общий budget, request lookup404 и unchanged lesson. Missing provider capability не заменяется synthetic evidence. Unsupported restore намеренно оставляет unresolved barrier; runtime fixture lifecycle/reset принадлежит13, такой journey нужен в отдельном authorized fixture run.

Фактический RED/GREEN и все эти connected journeys **NOT RUN / UNVERIFIED**: runtime/DB/provider lease отсутствует. Discovery не является execution. No09 start.

### Exact static checks

- `yarn workspace @dv-lab/api typecheck`: exit0.
- `yarn workspace @dv-lab/api build`: exit0, Build complete in95ms; integrated source13 bundled entries включены. Runtime services не запускались.
- `yarn node --max-old-space-size=8192 scripts/dev-checks/calendar-quality.ts --base 390b293 --owned apps/api/src/calendar/command-result.ts --owned apps/api/src/calendar/commands.ts --owned apps/api/src/calendar/credentials.ts --owned apps/api/src/calendar/dispatch.ts --owned apps/api/src/calendar/event-mapping.ts --owned apps/api/src/calendar/gateway.ts --owned apps/api/src/calendar/journal.ts --owned apps/api/src/calendar/single-observation.ts --owned apps/api/src/schedule/command-plan.ts --owned apps/api/src/schedule/single-command.ts --owned e2e/move.spec.ts --owned e2e/support/calendar-admission.ts --owned e2e/support/calendar-single.ts --owned packages/db/src/calendar-values.ts --new e2e/support/calendar-admission.ts --json` плюс source-hash-bound `--boundary-review` argv из private `STATE_DIR/phase24-08-review-fixes-command.json`: exit0/PASS.
- `yarn prettier --check apps/api/src/calendar/command-result.ts apps/api/src/calendar/commands.ts apps/api/src/calendar/credentials.ts apps/api/src/calendar/dispatch.ts apps/api/src/calendar/event-mapping.ts apps/api/src/calendar/gateway.ts apps/api/src/calendar/journal.ts apps/api/src/calendar/single-observation.ts apps/api/src/schedule/command-plan.ts apps/api/src/schedule/single-command.ts e2e/move.spec.ts e2e/support/calendar-admission.ts e2e/support/calendar-single.ts packages/db/src/calendar-values.ts`: exit0, all matched files use Prettier style.
- `git diff --check`: exit0.
- `env E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/move.spec.ts --grep '\[calendar\] (single changes|tombstone|command races|command recovery keeps an absent)' --project=light --list`: exit0,15 tests in3files; discovery only.

Initial quality tool default heap закончился OOM/exit129. Повтор с Node heap8192 прошёл. Interim UNVERIFIED выявил CC23; shared validated precondition helper исправил его. Unvalidated provider/public JSON/error boundaries review привязан к точным SHA-256; any не вводился. Финальный evidence `STATE_DIR/phase24-08-review-fixes-quality.json`, fingerprint `cc556f1838d6f38d8372fbd926f2e7294748bc80c0614f39877efc25a29fdb3b`, missing/stale/violations пусты; unknown только reviewed input/error boundaries. Denominator:14 owned source files и3 measurement tools,17 measured files. Node24.17.0/TS6.0.3/ESLint10.12.0; method/token convention выше. MaxCC20, cognitive19, HalsteadD40.68, file495. prepareSingleCommand CC21→20; callback admission CC18/cognitive18; no confirmed dead/redundant export left in owned diff. Repository-wide dead-code audit не заявлен. Final simplify сохранил validation/fences и не добавил compatibility layers.

### Changed files and reasons

| File                                        | Reason                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| apps/api/src/calendar/command-result.ts     | Direct conditional cancel proof, validated snapshot capture и replacement body |
| apps/api/src/calendar/gateway.ts            | Direct PATCH provenance; GET verifier не ослаблен                              |
| apps/api/src/calendar/dispatch.ts           | Replacement ACK unowned fingerprint equality                                   |
| apps/api/src/calendar/event-mapping.ts      | Immutable snapshot в insert; unsupported replacement block                     |
| apps/api/src/calendar/journal.ts            | Honest recovery issue без утечки internal metadata в DB row                    |
| apps/api/src/calendar/single-observation.ts | Unsupported replacement остаётся unresolved при Resume                         |
| apps/api/src/calendar/commands.ts           | Absolute admission budget, transactional expiry checks                         |
| apps/api/src/calendar/credentials.ts        | Общий signal до refresh/token callback                                         |
| apps/api/src/schedule/command-plan.ts       | Internal typed recoveryIssue                                                   |
| apps/api/src/schedule/single-command.ts     | Capture cancellation baseline/precondition snapshot                            |
| packages/db/src/calendar-values.ts          | Sole typed Registry schema для snapshots/provenance                            |
| e2e/move.spec.ts                            | Existing durable journeys вызывают новые assertions                            |
| e2e/support/calendar-single.ts              | Minimal ACK/R2 preservation и unsupported no-write assertions                  |
| e2e/support/calendar-admission.ts           | Public paginated admission timeout journey                                     |
| 24-08-SUMMARY.md                            | Review closure и actual verification limits                                    |

### Review fix actuals and self-check

Measured source range: base `390b29365c99d6126305a5db1397286fe352da4b`, after `e431f2f7cfbb4b72c6835e08a77f7f9fe131b3e2`. `git rev-list --count 390b293..e431f2f`=3 source commits;14 source files;8569 estimateTokens=ceil(realized diff chars/4). Diff SHA-256 `bef894e177a42a7558663495a5e3bc22a89fa6ccdc335106550a3b18d45b2129`. Private actuals `STATE_DIR/phase24-08-review-fixes-actuals.json`. Original plan-task actuals выше сохранены с их собственным pinned interval; это отдельный review correction interval.

Self-check PASSED: три correction commits являются ancestors HEAD; новый helper существует и используется; final quality fingerprints current; deletions отсутствуют; untracked apps/web/AGENTS.md сохранён. Shared metadata/чужие source файлы вручную не менялись. API build lease после проверки свободна. Source closure готова к повторному parent review; runtime proof отсутствует.
