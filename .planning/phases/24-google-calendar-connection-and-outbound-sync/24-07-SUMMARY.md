---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '07'
subsystem: api
tags: [google-calendar, commands, recovery, pg-boss, e2e]
status: complete
completion-scope: source-and-local-disconnected
verification-status: connected-unverified
requires:
  - phase: '24-06'
    provides: generation-safe read owner, credentials, lease, schema and typed contracts
provides:
  - Immutable account-scoped create commands with 202 receipts
  - Real Google ACK followed by atomic projection
  - Honest unknown outcome recovery and private repo-local fault controls
affects: ['24-08', '24-09', '24-10', '24-12', '24-13', '24-14']
tech-stack:
  added: []
  patterns: [immutable-command-journal, stable-connection-lease, ack-before-projection]
key-files:
  created:
    - apps/api/src/calendar/commands.ts
    - apps/api/src/calendar/journal.ts
    - apps/api/src/calendar/command-result.ts
    - apps/api/src/calendar/dispatch.ts
    - apps/api/src/calendar/recovery.ts
    - apps/api/src/calendar/worker.ts
    - apps/api/src/schedule/command-plan.ts
    - apps/api/src/schedule/command-apply.ts
    - e2e/support/calendar-commands.ts
    - e2e/support/calendar-command-recovery.ts
    - e2e/support/calendar-fault-control.ts
    - e2e/support/calendar-faults.ts
  modified:
    - apps/api/src/calendar/event-mapping.ts
    - apps/api/src/calendar/read-store.ts
    - apps/api/src/calendar/gateway.ts
    - apps/api/src/calendar/connection-control.ts
    - apps/api/src/routes/google.ts
    - apps/api/src/routes/schedule.ts
    - apps/api/src/schedule/schedule.ts
    - apps/api/src/app.ts
    - apps/api/src/server.ts
    - e2e/move.spec.ts
key-decisions:
  - 'Google HTTP runs outside SQL transactions; verified ACK is persisted before atomic projection.'
  - 'A 404 plus complete identity search is an absence observation, never proof that an unknown insert cannot complete later.'
  - 'Stored ACK projection does not fabricate a new HTTP status or repeat provider HTTP.'
  - 'Fault controls require an attested repo-local HTTPS process; the existing main Docker runtime needs a separate remote adapter.'
requirements-completed: [GCAL-02, GCAL-03, GCAL-09]
coverage:
  - id: command-admission
    description: Disconnected create refused without a journal write; unsupported writes blocked
    requirement: GCAL-02
    verification:
      - kind: e2e
        ref: 'e2e/move.spec.ts#[calendar] command tracer rejects disconnected create and blocks unsupported writes'
        status: pass
    human_judgment: false
  - id: provider-command-tracer
    description: Real ACK, atomic projection, immutable retry and recovery
    requirement: GCAL-03
    verification:
      - kind: e2e
        ref: 'e2e/move.spec.ts#[calendar] command tracer and recovery'
        status: unknown
    human_judgment: false
actuals:
  tokens: 25616
  tasks: 3
  commits: 4
plan_head_before: 1d75d27ca65da90cb442f0ed912ad8c4a705fab8
plan_head_after: 878314746598c62788d95c8ef39542416a56f8c0
duration: 37min
completed: 2026-10-12
---

# Phase 24 Plan 07: Immutable commands и recovery Summary

Create сохраняет immutable command и возвращает 202. Только проверенный Google ACK разрешает atomic commit урока, mapping, read revision и applied state.

**Завершены исходники 3/3 задач и разрешённая local_dev проверка. Connected Google proof отсутствует.** Requirements выше обозначают реализованную часть этого плана; полную приёмку требований и общую metadata ведёт parent.

## Task Commits

| Задача              | Коммит    | Результат                                    |
| ------------------- | --------- | -------------------------------------------- |
| Отдельный CI hotfix | `433c50d` | Убран неиспользуемый readWeek wrapper        |
| 1                   | `ab2ed72` | Immutable admission, UUID reservations и 202 |
| 2                   | `c17dc52` | Реальный ACK, worker и atomic projection     |
| 3                   | `8783147` | Status/resume, recovery и fault controls     |

Commits измерены через persisted ledger: 4 source commits. Последующий SUMMARY commit не входит в интервал `plan_head_before..plan_head_after`. Tokens: ceil(chars/4) фактического Git diff, без harness tokens. Файлы не удалялись.

## Проверенные инварианты исходников

- Same account/requestId/body возвращает тот же receipt, включая terminal command. Другое тело отклоняется.
- Admission проверяет актуальную provider snapshot, полное попадание создаваемого интервала в выбранное окно и совпадение default time zone.
- ID вычисляется из stable connection, actual calendar, entity kind, reserved UUID и representation generation. Auth generation в ID не входит.
- Запрос Google выполняется после записи попытки и вне SQL transaction. SDK write retries выключены.
- Фактический HTTP status insert/get сохраняется в attempt. Сохранённый ACK имеет отдельный внутренний тип без нового HTTP status.
- Projection применяет сохранённый план и UUID. ACK остаётся доступен при DB failure.
- Pending без подтверждённого admission после restart не отправляется автоматически. Истёкший genuinely unsent pending становится failed/not_applied.
- Unknown insert восстанавливается чтением того же ID. Реальный 404 и полный identity search сохраняют effect=unknown, reservation и recovery_required/resume_recovery. Новый Save заблокирован. Таймаут не доказывает завершение прежней отправки.
- Definitive provider rejection и genuinely unsent pending допускают failed/effect=none.
- Worker завершается перед lease/credentials/pool. Queue completion не является доказательством applied.
- Public status содержит только согласованный account-scoped DTO.

## Verification

| Команда                                                                                                                                              | Exit | Краткий результат                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `yarn workspace @dv-lab/api typecheck`                                                                                                               | 0    | TypeScript без ошибок                            |
| `yarn workspace @dv-lab/api build`                                                                                                                   | 0    | Build complete                                   |
| `yarn playwright test e2e/move.spec.ts --grep '\[calendar\] command tracer rejects disconnected' --project=light --no-deps`                          | 0    | 1 passed (2.7s)                                  |
| `E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/move.spec.ts --grep '\[calendar\] command (tracer\|recovery)' --project=light --list` | 0    | 7 tests, включая setup/cleanup; только discovery |
| `node scripts/dev-checks/wait-dev.mjs up`                                                                                                            | 0    | DEV_UP_OK                                        |
| `node scripts/dev-checks/wait-dev.mjs down`                                                                                                          | 0    | DEV_DOWN_OK                                      |
| `git diff --check`                                                                                                                                   | 0    | Нет whitespace errors                            |
| `yarn prettier --check <22 owned source files>`                                                                                                      | 0    | All matched files use Prettier code style        |
| Quality command ниже                                                                                                                                 | 0    | PASS                                             |

Точные команды, scope, fingerprints и rerun instructions сохранены вне репозитория в разрешённом STATE_DIR:

- `phase24-07-verification-manifest.json` — точные команды всех проверок.
- `phase24-07-disconnected-e2e.json` — версия, fixture reference, ожидаемый/наблюдаемый результат, exit и persistence fingerprint.
- `phase24-07-quality-ready.json` — текущий source/type fingerprint и измерения.
- Предыдущие `task1-quality-ready`, `task2-quality-ready`, `task3-quality-initial`, `quality-final` сохранены отдельно. Промежуточный UNVERIFIED не выдан за PASS.

Disconnected E2E шёл через public /api proxy, настоящую local_dev persistence и существующий аккаунт. Новых Google fixtures и provider calls не было. После проверки owned процессы остановлены.

### Quality

Fingerprint: `46dc43bc55612bf9f8ba5d68a5ab87b258df9a63ffcefa14636915036f91d597`.

Scope: 22 изменённых source files и 3 существующих файла метода; 379 функций, 220 изменённых. Node 24.17.0, TypeScript 6.0.3, ESLint 10.12.0. Максимумы изменённых функций: CC 19, cognitive 16, Halstead D 35.88095238095238. Максимальная длина файла: 442 строки. Any findings и type diagnostics отсутствуют; unknown ограничен проверенными внешними input/error boundaries.

CC: ESLint classic AST. Cognitive: DVLab AST nesting/control/logical-sequence v1, не Sonar. Halstead: executable AST leaves; идентификаторы/литералы — operands, executable keyword/punctuation SyntaxKind — operators; trivia, imports, type syntax и erased modifiers исключены. D=(n1/2)*(N2/n2). Nested функции измеряются отдельно. Module tokens не считаются функцией.

Новые функции не имеют baseline: prepareScheduleCommand CC —→19; applyConfirmedCommand —→17; reconcileCommand —→15; handleReadFailure —→14; worker.processCommand —→12. Полные before/after пары существующих функций находятся в quality artifact. Scope review и simplify не оставили подтверждённых dead/redundant findings; полный quality audit не заявлен.

Точная quality-команда:

```bash
yarn node scripts/dev-checks/calendar-quality.ts \
  --base 1d75d27ca65da90cb442f0ed912ad8c4a705fab8 \
  --owned apps/api/src/calendar/commands.ts \
  --owned apps/api/src/calendar/journal.ts \
  --owned apps/api/src/schedule/command-plan.ts \
  --owned apps/api/src/routes/schedule.ts \
  --owned apps/api/src/schedule/schedule.ts \
  --owned e2e/move.spec.ts \
  --owned e2e/support/calendar-commands.ts \
  --owned apps/api/src/calendar/command-result.ts \
  --owned apps/api/src/calendar/dispatch.ts \
  --owned apps/api/src/calendar/gateway.ts \
  --owned apps/api/src/calendar/worker.ts \
  --owned apps/api/src/calendar/read-store.ts \
  --owned apps/api/src/calendar/event-mapping.ts \
  --owned apps/api/src/schedule/command-apply.ts \
  --owned apps/api/src/app.ts \
  --owned apps/api/src/server.ts \
  --owned apps/api/src/calendar/connection-control.ts \
  --new apps/api/src/calendar/recovery.ts \
  --owned apps/api/src/routes/google.ts \
  --new e2e/support/calendar-command-recovery.ts \
  --new e2e/support/calendar-fault-control.ts \
  --new e2e/support/calendar-faults.ts \
  --boundary-review 'apps/api/src/app.ts:78:a6e7ad6dfc55d44f8e3e5e3a43563743b33e41e9c2e4dccde5a5c7dc81c3a8bf:Existing unvalidated WebSocket event narrowed to string' \
  --boundary-review 'apps/api/src/calendar/command-result.ts:72:a260d454e5ace65d21fd772783994086b8537892698f0939ac36a5c46e1ee2b9:Unvalidated Google HTTP response verified against immutable request' \
  --boundary-review 'apps/api/src/calendar/dispatch.ts:159:7034a5edb209e90fccae7f859f5c0dec9e74a8092af9c684ba6b6c9078591829:Unvalidated thrown error narrowed before public classification' \
  --boundary-review 'apps/api/src/calendar/recovery.ts:195:647633454de46f13a9ee9caca7e89f872b0f3bdab183d219d0e260fc12b496ac:Unvalidated thrown error narrowed before public classification' \
  --boundary-review 'apps/api/src/routes/google.ts:37:d2f943f2e8cce97d87ef2a041743fb1eb32c60fa60119eb983f5d3c26a23a975:Unvalidated thrown error narrowed before public classification' \
  --boundary-review 'apps/api/src/routes/schedule.ts:81:a50ccb3afeef5b011be743406ca7142856e1cf71aad5c41d24bb3e0c3c6a5f79:Unvalidated thrown error narrowed before public classification' \
  --boundary-review 'e2e/support/calendar-commands.ts:19:5bb1d0d3c01b8700cb7e721490c6bb63be238824cbe2aeb2836bf1c79992f880:Unvalidated public API response parsed by its supplied schema' \
  --boundary-review 'e2e/support/calendar-faults.ts:42:110f147481a833c11f1f6d0905abab9736550916774a286bf99c8e46149e37e2:Unvalidated PostgreSQL result narrowed by strict identity schema' \
  --boundary-review 'e2e/support/calendar-faults.ts:83:110f147481a833c11f1f6d0905abab9736550916774a286bf99c8e46149e37e2:Unvalidated Node response event arguments narrowed by IncomingMessage before interception' \
  --json
```

## Изменённые файлы

| Файл                                                                                | Причина                                                                            |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/api/src/app.ts`                                                               | Подключил owner команд к существующим маршрутам.                                   |
| `apps/api/src/calendar/command-result.ts`                                           | Проверил реальные Google facts и отделил HTTP response от сохранённого ACK.        |
| `apps/api/src/calendar/commands.ts`                                                 | Добавил immutable admission, idempotent receipt, чтение и resume.                  |
| `apps/api/src/calendar/connection-control.ts`                                       | Закрыл unsent stages и reservations при disconnect.                                |
| `apps/api/src/calendar/dispatch.ts`                                                 | Записал попытку до HTTP, фактический status и ACK до projection.                   |
| `apps/api/src/calendar/event-mapping.ts`                                            | Добавил резервирование и подтверждение стабильного mapping.                        |
| `apps/api/src/calendar/gateway.ts`                                                  | Добавил настоящие insert/get и полный поиск opaque identity.                       |
| `apps/api/src/calendar/journal.ts`                                                  | Добавил журнал, account-scoped lookup, статусы и terminal unsent handling.         |
| `apps/api/src/calendar/read-store.ts`                                               | Добавил atomic revision advance после применения команды.                          |
| `apps/api/src/calendar/recovery.ts`                                                 | Добавил bounded GET reconciliation и сохранение неопределённости после 404.        |
| `apps/api/src/calendar/worker.ts`                                                   | Подключил pg-boss, стабильный lease, journal sweep и lifecycle.                    |
| `apps/api/src/routes/google.ts`                                                     | Добавил account-scoped by-request/list/status/resume endpoints.                    |
| `apps/api/src/routes/schedule.ts`                                                   | Перевёл create на 202 и заблокировал неподдержанные calendar writes.               |
| `apps/api/src/schedule/command-apply.ts`                                            | Добавил atomic lesson/mapping/revision/journal commit после ACK.                   |
| `apps/api/src/schedule/command-plan.ts`                                             | Зафиксировал UUID, Google ID, тело, зону, окно и preconditions.                    |
| `apps/api/src/schedule/schedule.ts`                                                 | Убрал неиспользуемый wrapper readWeek по отдельному поручению parent.              |
| `apps/api/src/server.ts`                                                            | Подключил worker к composition root и остановке перед pool.                        |
| `e2e/move.spec.ts`                                                                  | Добавил пять публичных command tracer/recovery сценариев.                          |
| `e2e/support/calendar-command-recovery.ts`                                          | Описал delayed ACK, lost response и unresolved real absence.                       |
| `e2e/support/calendar-commands.ts`                                                  | Добавил disconnected/create journeys и проверку synthetic fixture ownership.       |
| `e2e/support/calendar-fault-control.ts`                                             | Добавил приватные controls и отдельные файлы evidence для repo-local процесса.     |
| `e2e/support/calendar-faults.ts`                                                    | Добавил opt-in перехват настоящего Node HTTPS transport после process attestation. |
| `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-07-SUMMARY.md` | Native итог плана и handoff                                                        |

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 — Blocking] Неиспользуемый readWeek wrapper.** Parent отдельно поручил CI hotfix. Удалены функция и два импорта, сохранены readWindow/wireBlocks. Файл schedule/schedule.ts; `433c50d`.
2. **[Rule 2 — Correctness] Admission range/TZ и fixture ownership.** Добавлены проверка интервала/зоны snapshot и принадлежность synthetic карточки по retained ownership ledger, имени и отсутствию import_key. Файлы command-plan.ts и calendar-commands.ts; `c17dc52`.
3. **[Rule 1 — Raw evidence] Фактический HTTP status ACK.** Gateway передаёт response.status; stored projection не создаёт HTTP observation. command-result.ts, gateway.ts, dispatch.ts, recovery.ts; `8783147`.
4. **[Rule 1 — Recovery] Absence не завершает unknown insert.** Сохранена reservation и неопределённость после actual 404/search. Добавлен public journey contract для retained interrupted fixture. recovery.ts, calendar-command-recovery.ts, calendar-commands.ts, move.spec.ts; `8783147`.

План требует real tracer. По прямому разрешению пользователя завершены source/commits с явным UNVERIFIED. Connected verification и требования не считаются полностью принятыми. Shared STATE/ROADMAP/REQUIREMENTS/WINDOWS и plan inventory не изменены: ими владеет parent.

## Known Stubs

| Файл                                | Статус                                        | Причина / владелец                                                                           |
| ----------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| apps/api/src/routes/schedule.ts:143 | Намеренный capability block, 409 history_only | Move/cancel/restore/series writes реализуют 24-08–10. Local fallback запрещён и отсутствует. |

Других заглушек и skipped tests не найдено. Пустые коллекции в parsing/recovery — рабочие accumulators. Этот block является требованием 07, не незавершённым create.

## UNVERIFIED и не написанные ветки

- Реальный connected create/retry/stale-version tracer, delayed ACK, response loss и absence recovery: сценарии написаны, не запущены.
- Unknown absence journey требует operator-retained synthetic interrupted command: `unknownRequestId` в приватном calendar-command.json. Он проверяет реальный GET/search observation, retained mapping и отказ нового Save.
- Fault preloader на attested repo-local HTTPS процессе: source/type/discovery проверены, actual interception не запущен.
- Lost public POST response, genuinely pending process death/restart, ACK→DB failure, lost queue wake, wrong-account status: отдельные durable branches не написаны и runtime proof отсутствует. Реализация recovery не заменяет эти доказательства.
- Main Docker fault execution: **конкретный capability gap**, описан ниже. Это не просто недоступность Google.
- Новых 05/06 journeys нет. Их будущий owner может использовать GET/calendarList/event/events и first/next selectors.
- Parent должен отразить unrun-verify и будущий capability block в общем WINDOWS, если ledger активен. Этот executor не записывает shared metadata.

## Fault controls: handoff для 24-13

### Поддерживаемая среда

Текущий preloader предназначен только для **repo-local attested HTTPS API process**. Команда из плана: `yarn node --import ./e2e/support/calendar-faults.ts apps/api/dist/server.mjs`. API env должен уже принадлежать этому процессу. Секреты и DSN в source/evidence не передаются.

Проверки до patch: canonical private 0600 manifest, совпадение target binding, exact PID, actual entry SHA256, GIT_SHA, APP_ORIGIN, enabled calendar и fingerprint реальной persistence. Затем перехватывается установленный SDK transport `node:https.request`. Используется настоящий response stream. Успешные ACK/404 не подделываются.

### Control API

- `armCalendarFault(input: Omit<CalendarFaultRule, 'id'>): string` — создаёт rule UUID в существующем manifest; требует свободный rule и проверяет **локальный** PID через signal 0.
- `disarmCalendarFault(ruleId: string): void` — снимает только собственный rule.
- `calendarFaultEvidence(ruleId: string): Observation[]` — читает отдельные immutable JSON observations из того же PRIVATE_DIR.
- `readCalendarFaultControl(): CalendarFaultManifest` — проверяет manifest и текущий target binding.
- `recordCalendarFault(manifest, rule, phase, status?): void` — пишет только IDs, PID, hashes, time, phase и фактический status.

Manifest: `E2E_CALENDAR_FAULTS` указывает строго на `PRIVATE_DIR/calendar-faults.json`. Поля: runId, pid, apiBuildSha, entrySha256, origin, persistenceFingerprint, calendarFaultsAuthorized=true, exclusiveSyntheticProcess=true, expiresAt, rule|null. Срок должен быть действующим. JSON и directory должны быть canonical, вне Git; файл 0600.

Rule: id UUID; method GET/POST/PATCH; resource events/event/calendarList; page first/next/any; action drop_response/delay_response/stop_before_request/stop_after_response; delayMs 0..15000. Один rule воздействует один раз за PID; все совпавшие requests наблюдаются, включая повторные после первого hit.

Actions: delay удерживает реальный response; drop обрывает transport после реального response; stop завершает owned процесс с exit 86 до request либо после response. Restart этим модулем не выполняется. OAuth/token endpoints не входят в selectors. Evidence не содержит URL, headers, токенов или payload.

### Gap текущего main и требования adapter

- Existing main API работает в Docker image. Raw e2e TypeScript и repo source в image отсутствуют.
- Preloader импортирует `apps/api/src/config.ts`, `@dv-lab/db`, paths.mjs и требует entry по `ROOT/apps/api/dist/server.mjs`.
- Main DSN доступен только на сервере; repo-local startup не имеет разрешённого HTTPS API env.
- Mac controls проверяют Mac PID и Mac PRIVATE_DIR. Они не управляют PID/files внутри server/container namespace.

Поэтому нужны отдельные изменения 24-13: packaging preloader с доступными runtime imports/entry binding, server-side manifest/evidence owner, SSH relay для arm/disarm/evidence и remote PID/lifecycle verification, attestation image/build/persistence, serial lease и контролируемый restart. Секреты остаются на сервере; релэй не возвращает DSN, токены или provider content. Source transport selectors и action semantics можно сохранить.

**Ownership освобождён коммитом 8783147.** Следующий owner может менять calendar-fault-control.ts/calendar-faults.ts для adapter. Build/deploy/SSH изменения и живые Google calls в этом плане не выполнялись.

Command fixture должен оставаться retained до согласованной Google/local cleanup. Существующий общий teardown чистит local fixtures и не завершает Google command lifecycle. Для отдельного connected запуска с уже подготовленным auth нужен `--no-deps`; полноценный setup/cleanup cycle остаётся задачей runtime owner. Удаление реальных Google events, journal или mappings этим планом не разрешалось и не выполнялось.

## TDD Gate Compliance

Failure scenarios написаны в существующем E2E harness до соответствующего поведения. Новых isolated suites нет. Functional RED/GREEN для connected пути не выполнялся из-за отсутствия разрешённой runtime capability. Discovery не объявлен функциональной проверкой.

## Next Boundary

24-08 не начат. Общую metadata и runtime acceptance продолжает parent. Следующий backend run создаёт parent с явно выбранным gpt-6.1-sol; текущая работа не делегировалась заново.

## Self-Check: PASSED

Все 22 source files и SUMMARY существуют. Коммиты 433c50d, ab2ed72, c17dc52 и 8783147 являются ancestors текущего HEAD. Source commit deletions отсутствуют. Собственные dev-процессы остановлены; DEV_DOWN_OK получен. Connected/runtime capability gaps перечислены выше.
