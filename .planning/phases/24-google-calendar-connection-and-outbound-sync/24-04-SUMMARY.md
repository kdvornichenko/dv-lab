---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '04'
subsystem: auth
tags: [oauth, google-calendar, pkce, aes-gcm, postgres, credentials]
requires:
  - phase: 24-02
    provides: Calendar DTO, encrypted envelope schema и journal
  - phase: 24-03
    provides: Names-only config, exact SDK dependencies и queue bootstrap
provides:
  - Teacher-bound one-use OAuth с encrypted verifier/refresh и immutable primary target
  - Общая session advisory lease и generation CAS для операций grant
  - Durable disconnect с provider-confirmed и operator-confirmed outcomes
affects: [24-05, 24-07, 24-13, 24-14]
tech-stack:
  added: []
  patterns:
    - Random DEK wrapped by configured KEK; AAD binds account/connection/generation/purpose
    - Provider DTO validation and safe error codes at SDK boundary
    - Accepted revoke attempts persist before dispatch; restart does not resend uncertain attempts
key-files:
  created:
    - apps/api/src/calendar/token-envelope.ts
    - apps/api/src/calendar/lease.ts
    - apps/api/src/calendar/oauth-session.ts
    - apps/api/src/calendar/credentials.ts
    - apps/api/src/calendar/connection.ts
    - apps/api/src/calendar/gateway.ts
    - apps/api/src/calendar/connection-control.ts
    - apps/api/src/routes/google.ts
  modified:
    - apps/api/src/app.ts
    - apps/api/src/server.ts
    - apps/api/src/request-context.ts
    - packages/db/src/calendar-values.ts
    - packages/db/src/connection.ts
    - e2e/calendar.spec.ts
    - deploy/caddy/Caddyfile
key-decisions:
  - 'Consent, refresh, revoke и recovery используют одну session advisory lease и generation CAS.'
  - 'Только revoke HTTP 200 означает provider_confirmed; explicit operator assertion сохраняет отдельный outcome.'
  - 'Provider proof отложен в 24-14 до получения разрешённой PRIMARY identity, consent и matching HTTPS attestation.'
  - 'Дополнительные envelope/session/lease helpers объявлены внутри принятой области; новый public DTO не введён.'
requirements-completed: [GCAL-01, GCAL-09, GCAL-03]
requirements-status: source-implemented-e2e-authoring-and-provider-unverified
coverage:
  - id: D1
    description: Encrypted teacher-bound consent и refresh
    requirement: GCAL-01
    verification:
      - kind: other
        ref: yarn workspace @dv-lab/api typecheck
        status: pass
      - kind: e2e
        ref: 'e2e/calendar.spec.ts#[calendar] oauth consumes denial once and binds state to the initiating session'
        status: unknown
      - kind: other
        ref: '24-14 authoring gap: real consent, granted scopes, primary identity and refresh'
        status: unknown
    human_judgment: false
  - id: D2
    description: Public routes, callback query privacy и disabled capability
    requirement: GCAL-09
    verification:
      - kind: e2e
        ref: 'e2e/calendar.spec.ts#[calendar] oauth refuses anonymous access and strips callback input'
        status: pass
      - kind: other
        ref: Caddy configuration validation
        status: unknown
    human_judgment: false
  - id: D3
    description: Disconnect recovery с честным provider/operator outcome
    requirement: GCAL-03
    verification:
      - kind: e2e
        ref: 'e2e/calendar.spec.ts#[calendar] credential recovery; local input/auth negative paths'
        status: pass
      - kind: other
        ref: '24-14 authoring gap: real revoke, lost response, restart and quiescence'
        status: unknown
    human_judgment: false
actuals:
  tokens: 21526
  tasks: 3
  commits: 6
plan_head_before: dfa4b0c37aacf6eea5b7582c9efff7f57267d971
plan_head_after: fad2e0f3bfa54a40bbe7b25e52fac9b85fa232d6
duration: 23min
completed: 2026-10-11
status: complete
---

# Phase 24 Plan 04: OAuth, refresh и разрешимый Disconnect Summary

**Одноразовый teacher OAuth, envelope encryption и единый владелец grant обеспечивают безопасные connect/refresh/disconnect; source завершён, реальная проверка Google остаётся UNVERIFIED.**

## Scope и состояние

Реализованы три source tasks 24-04. Текущая execution authority заменила исторический preparation-only раздел плана. Проверки реального Google перенесены в 24-14 по прямому указанию пользователя; `status: complete` означает завершение разрешённой source implementation, не приёмку GCAL и не разрешение deployment.

Начало: 2026-10-11T16:25:58Z. Первичная source/evidence работа: 23 минуты, до 2026-10-11T16:49:07Z. Bounded review correction внесена коммитом `fad2e0f`. Net diff: 15 source/config/E2E файлов и этот SUMMARY. Актуальные actuals измерены между ledger base и `fad2e0f`: 86 101 символ полного `git diff --no-ext-diff <before> <after> --`, ceil(chars/4) = 21 526; 6 коммитов, включая первую версию SUMMARY. Текущий metadata commit в этот срез не входит.

STATE, ROADMAP, HANDOFF, state.json, WINDOWS и inventory планов принадлежат parent. Они не изменялись этим исполнителем. 24-05 не начат.

## Accomplishments

- State содержит 32 random bytes; в persistence сохраняются digest, TTL 10 минут, account/session epoch/token digest и generation. State атомарно потребляется до token exchange. PKCE verifier зашифрован.
- Refresh и verifier используют random DEK и wrapped DEK с AES-256-GCM. AAD привязан к account, connection, generation и purpose. Access token существует только в памяти. Refresh без нового refresh token сохраняет старый; первый grant без refresh token отклоняется.
- Проверяются ровно `calendar.events` и `calendar.calendarlist.readonly`. Primary ищется по всем страницам `CalendarList.list(showHidden:true)`; допускается активный primary с owner/writer. Смена actual target при reconnect запрещена до установки grant.
- Consent, refresh, revoke и recovery сериализованы session advisory lease; запись credential защищена generation CAS. Установка grant повторно проверяет session под блокировкой. Потеря leased DB connection прерывает provider operation.
- Callback смонтирован; ответы имеют no-store/no-referrer, redirect не несёт code/state/token. Logger использует безопасный код ошибки. Caddy source убирает URI query и Referer; proxy trust boundary сохранена.
- Disconnect сразу закрывает admission/dispatch, повышает generation, переводит credential в revoke-only и очищает access cache. Unsent без попытки получают not_applied. Dispatched unknown, partial recovery и confirmed projection сохраняют своё знание.
- Durable pump сохраняет attempt до request. Только HTTP 200 очищает credential с provider_confirmed. Timeout/400 дают disconnect_failed. После restart неизвестная попытка не отправляется повторно; выдерживается её deadline и требуется явное действие.
- confirm-revoked принимает только `{confirmed:true}`, требует teacher/session/Origin и общую lease. Запись actor/time/operator_confirmed появляется после commit. Operator assertion не объявляется provider proof. Reconciliation dispatched commands остаётся владельцу 24-07.

## Task Commits

| Task                          | Коммит    | Результат                                                              |
| ----------------------------- | --------- | ---------------------------------------------------------------------- |
| 1 — one-use encrypted consent | `7ab907e` | OAuth, envelope, SDK boundary, lease и refresh                         |
| 2 — routes/callback privacy   | `7974a05` | Composition, public endpoints, logging и Caddy source                  |
| Коррекция области             | `283a6e8` | Удалена только добавленная строка ignore; `.gitignore` равен исходному |
| 3 — disconnect recovery       | `e471024` | Durable control, explicit recovery и local negative E2E                |

Metadata commit создаётся отдельно и содержит только этот SUMMARY. После каждого task commit проверено отсутствие file deletions. HEAD/root guards подтверждены.

## Files Created/Modified

- `apps/api/src/calendar/token-envelope.ts` — Новый AES-256-GCM envelope: random DEK, wrapped DEK, AAD и чтение старых keyId.
- `apps/api/src/calendar/lease.ts` — Новая общая session advisory lease для consent, refresh, revoke и recovery; abort при потере соединения.
- `apps/api/src/calendar/oauth-session.ts` — Новая проверка актуальной teacher session, account epoch и token digest.
- `apps/api/src/calendar/credentials.ts` — Новый владелец encrypted refresh, memory access cache, rotation CAS и revoke-only режима.
- `apps/api/src/calendar/connection.ts` — Новые begin/complete/readConnection: одноразовый state, PKCE, primary identity и безопасная установка grant.
- `apps/api/src/calendar/gateway.ts` — Новая граница Google SDK: схемы ответов, все страницы primary list, безопасные ошибки, timeout без скрытых retry.
- `apps/api/src/calendar/connection-control.ts` — Новые disconnect intent, durable control pump, явный retry и operator-confirmed recovery.
- `apps/api/src/routes/google.ts` — Новые teacher endpoints, строгая форма confirm-revoked и чистый callback redirect.
- `apps/api/src/app.ts` — Смонтированы Calendar routes; optional dependency закрывает capability; уточнены типы затронутых Hono/WebSocket callbacks.
- `apps/api/src/server.ts` — Подключены владельцы Calendar и ordered shutdown control/lease/cache до закрытия пула.
- `apps/api/src/request-context.ts` — Закрыты callback query и raw Calendar errors в логах; сохранён requestId.
- `packages/db/src/calendar-values.ts` — Private envelope schema расширена полями wrappedDek/wrapNonce/wrapTag; SQL CHECK уже допускает дополнительные поля.
- `packages/db/src/connection.ts` — Database скрывает pool-specific $client для работы с той же Drizzle-схемой через leased client; resolveDatabaseUrl не менялся.
- `e2e/calendar.spec.ts` — До реализации добавлены сценарии OAuth и credential recovery в существующий durable journey.
- `deploy/caddy/Caddyfile` — Query удаляется из URI в default/access logs, Referer исключён; callback получает no-store/no-referrer.
- `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-04-SUMMARY.md` — результаты, fingerprints и границы проверки.
- `.gitignore` — временно затронут в task 2; исправлен `283a6e8`, net diff отсутствует.

`apps/web/AGENTS.md` создан Next dev и сохранён untracked на месте по прямому указанию пользователя. Он не staging/ignore/deletion candidate и не часть owned diff.

## Проверки

Все процессы дождались завершения с исходным exit. Повторная проверка неизменённого source 24-03 не выполнялась.

| Команда                                                                                                                                           | Exit / статус | Краткое доказательство                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| `yarn workspace @dv-lab/api typecheck`                                                                                                            | 0 / PASS      | Финальный tsc завершился без diagnostics                                     |
| `yarn workspace @dv-lab/api build --no-clean`                                                                                                     | 0 / PASS      | Финальный API build: 16 output files, 83 ms; clean отключён явной authority  |
| `E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\] oauth' --project=light --list`               | 0 / DISCOVERY | 5 tests, включая setup/cleanup; OAuth не выполнялся                          |
| `E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\] credential recovery' --project=light --list` | 0 / DISCOVERY | 4 tests, включая setup/cleanup; revoke не выполнялся                         |
| `yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\] oauth refuses anonymous' --project=light --no-deps`                               | 0 / PASS      | 1 passed; synthetic callback values absent in API log                        |
| `yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\] credential recovery' --project=light --no-deps`                                   | 0 / PASS      | 2 passed (1.7s); anonymous 401, invalid confirmation 400, foreign Origin 403 |
| `git diff --check`                                                                                                                                | 0 / PASS      | Нет whitespace errors                                                        |
| `node scripts/dev-checks/wait-dev.mjs down`                                                                                                       | 0 / PASS      | DEV_DOWN_OK после остановки собственных API/web                              |
| `bash scripts/gsd/root-pin.sh ~/.claude/worktrees/phase24-contracts/dv-lab`                                                     | 0 / PASS      | ROOT_PIN_OK; branch agent-24-contracts, protected=false                      |

Финальная команда форматирования, exit 0, `All matched files use Prettier code style!`:

```sh
yarn prettier --check apps/api/src/app.ts apps/api/src/calendar/connection-control.ts apps/api/src/calendar/connection.ts apps/api/src/calendar/credentials.ts apps/api/src/calendar/gateway.ts apps/api/src/calendar/lease.ts apps/api/src/calendar/oauth-session.ts apps/api/src/calendar/token-envelope.ts apps/api/src/request-context.ts apps/api/src/routes/google.ts apps/api/src/server.ts e2e/calendar.spec.ts packages/db/src/calendar-values.ts packages/db/src/connection.ts
```

Локальные E2E прошли через public HTTP web proxy → API → настоящую разрешённую dev persistence. Calendar provider был disabled; startup wrapper отказывал при включённом provider. Anonymous journey не создавал account/calendar fixtures. Recovery journey использовал существующий dev teacher login и создал только app session. Значения credentials не выводились. Собственные runtime процессы остановлены.

## Воспроизводимые E2E evidence

Артефакты сохранены в существующем private `STATE_DIR`, без secrets/student/event contents:

| Артефакт                        | Version / scenario                                                                                                                                                        | Expected → observed                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `phase24-04-anonymous-e2e.json` | API build SHA-256 `78e1303b23fd814e8e6093f586496f96697a7bdf66b635107f22cd232c379944`; scenario SHA-256 `a1e53bd27ce009e3dc331254dbcb4fdb9392a246b2344176e1bc3544aa64453c` | 401, no-store, no callback input in logs → 1 passed, log absence true |
| `phase24-04-recovery-e2e.json`  | API build SHA-256 `ac5ce9d509df9afc747fd1825ecf48c3b678f555338efb05de22666b32bc752a`; six source hashes внутри evidence                                                   | 401/400/403 и unchanged connection availability → 2 passed            |

Rerun: запустить существующий локальный API/web с provider disabled, убрать inherited DATABASE_URL/MIGRATOR_DATABASE_URL, выполнить соответствующую `--no-deps` команду из таблицы. Полный HTTPS journey требует уже предусмотренных 01 authority/attestation. Local success не доказывает provider behavior или Caddy.

## Quality и simplify — первичный срез e471024

Применены simplify и cyclomatic-complexity к owned diff. Новых code comments, зависимостей, SQL DDL и isolated suites нет. В scope review нет подтверждённых dead/redundant code findings. Полный knip/quality audit принадлежит 24-13 и здесь не заявлен.

Quality CLI до review correction: exit **2 / UNVERIFIED** только из-за `deploy/caddy/Caddyfile`: `UNSUPPORTED handwritten language: no implemented measurement`. TypeScript portion не имеет failures, unavailable syntax, type diagnostics или непросмотренных unknown boundaries. Любой any исправлен; unknown ограничен входными HTTP/provider/WebSocket значениями и error boundaries с source-hash-bound review.

Отчёт `STATE_DIR/phase24-04-quality-final.json`:

- Fingerprint: `727b9d9310d881f317cd0e1e274d0f0f947767a654c4e20a96b4bd73a32dfda8`.
- Node 24.17.0; TypeScript 6.0.3; ESLint 10.12.0.
- Выбраны 18 файлов; измерены 17 TS файлов: 14 owned и три неизменённых measurement owners. Всего 204 functions, 136 changed. Owned denominator: 124 functions, 109 changed; отчёт инструмента шире из-за его обязательных method owners.
- Проверены fingerprints всех 3547 type inputs: 0 stale. HEAD в отчёте предшествует task 3 commit; все измеренные bytes совпадают с task 3.
- Cyclomatic: ESLint classic AST, 1 + branches/loops/cases/catch/ternary/logical/default parameters/optional accesses, nested functions отдельно.
- Cognitive: DVLab AST nesting/control/logical-sequence v1, не Sonar. Control increments включают nesting; logical runs/else/labelled jumps +1.
- Halstead: DVLab executable AST leaves v1. Identifier/private identifier/literal/template/JSX text — operands exact spelling; executable keyword/punctuation — operators по SyntaxKind. Trivia/imports/type syntax/erased modifiers исключены. Nested function владеет своими tokens один раз. D=(n1/2)*(N2/n2), при n2=0 результат 0. Module tokens представлены отдельно.
- Пределы каждого function/callback: CC<22, cognitive<22, D<80; handwritten TS file<500 physical lines.

Ниже максимумы по каждому файлу; before→after не утверждает соответствие переименованных/неоднозначных callbacks. `—` означает новый файл, а не измеренный baseline 0.

| Owned TS file                                 | Lines | CC before→after | Cognitive before→after | D before→after |
| --------------------------------------------- | ----: | --------------: | ---------------------: | -------------: |
| `apps/api/src/app.ts`                         |    98 |             4→4 |                    2→2 |       16.05→16 |
| `apps/api/src/calendar/connection-control.ts` |   289 |            —→10 |                   —→11 |        —→22.09 |
| `apps/api/src/calendar/connection.ts`         |   185 |            —→14 |                    —→7 |         —→19.8 |
| `apps/api/src/calendar/credentials.ts`        |   137 |             —→8 |                    —→7 |        —→27.33 |
| `apps/api/src/calendar/gateway.ts`            |   178 |            —→10 |                   —→11 |        —→22.24 |
| `apps/api/src/calendar/lease.ts`              |    69 |             —→8 |                    —→7 |        —→25.62 |
| `apps/api/src/calendar/oauth-session.ts`      |    30 |             —→2 |                    —→1 |        —→18.79 |
| `apps/api/src/calendar/token-envelope.ts`     |    86 |             —→3 |                    —→2 |         —→12.3 |
| `apps/api/src/request-context.ts`             |    79 |             5→7 |                    3→4 |    13.75→13.65 |
| `apps/api/src/routes/google.ts`               |   103 |             —→7 |                    —→6 |         —→17.5 |
| `apps/api/src/server.ts`                      |    80 |             1→1 |                    0→0 |           7→13 |
| `e2e/calendar.spec.ts`                        |   174 |             6→6 |                    5→5 |    19.77→23.98 |
| `packages/db/src/calendar-values.ts`          |   241 |             2→2 |                    1→1 |        4.9→4.9 |
| `packages/db/src/connection.ts`               |    36 |             4→4 |                    3→3 |    14.87→14.87 |

Исходный gateway draft имел cognitive 22; разделение выбора primary снизило максимум до 11 до task 1 commit. Финальные owned максимумы: CC 14, cognitive 11, D 27.33, file 289 lines.

Точная команда первичного quality среза (stdout сохранялся в private JSON; source-hash-bound reviews относятся к bytes до `fad2e0f`):

```sh
node --max-old-space-size=8192 scripts/dev-checks/calendar-quality.ts --base dfa4b0c37aacf6eea5b7582c9efff7f57267d971 \
  --owned apps/api/src/calendar/token-envelope.ts \
  --owned apps/api/src/calendar/lease.ts \
  --owned apps/api/src/calendar/oauth-session.ts \
  --owned packages/db/src/calendar-values.ts \
  --owned e2e/calendar.spec.ts \
  --owned apps/api/src/calendar/gateway.ts \
  --owned apps/api/src/calendar/credentials.ts \
  --owned apps/api/src/calendar/connection.ts \
  --owned packages/db/src/connection.ts \
  --owned apps/api/src/routes/google.ts \
  --owned apps/api/src/app.ts \
  --owned apps/api/src/server.ts \
  --owned apps/api/src/request-context.ts \
  --owned deploy/caddy/Caddyfile \
  --owned .gitignore \
  --new apps/api/src/calendar/connection-control.ts \
  --boundary-review 'apps/api/src/app.ts:74:c6f9d44a1d1fa6734312e2aafaf4f23c84f619669dd0f1065a9073e5e39e71b5:unvalidated WebSocket message payload narrowed to string before send' \
  --boundary-review 'apps/api/src/request-context.ts:13:9eb0c082b19492f9675d1e3e05ba337af75e71a1906ec0f5ddc81082d652c8c6:unvalidated logger error input; Calendar context emits a fixed safe error' \
  --boundary-review 'apps/api/src/calendar/gateway.ts:155:ae6d0e13de749f5e0e54e28d4eb816e127d95f468a5c536ff48ebfd3c464ef71:raw provider token input validated immediately by tokenData' \
  --boundary-review 'apps/api/src/calendar/credentials.ts:85:0129e88a25d398c9b5ac7f2179ec90b5e96755deed5dc52567d6eb1f2b86c529:unvalidated error input narrowed to CalendarFault before state changes' \
  --boundary-review 'apps/api/src/routes/google.ts:30:97dbbe787ce96466ec9e78f91c234633270a42013e36f669371f33e25da07bef:unvalidated route error input narrowed to the CalendarFault safe code allowlist' \
  --boundary-review 'e2e/calendar.spec.ts:11:69765f8886c011e7a1a45b46b1a76feda966625b8e28cc6ae20060d599f9ed7b:unvalidated public HTTP response input; status headers and schema-checked JSON or raw text asserted' \
  --boundary-review 'e2e/calendar.spec.ts:22:69765f8886c011e7a1a45b46b1a76feda966625b8e28cc6ae20060d599f9ed7b:unvalidated public HTTP response input; status headers and schema-checked JSON or raw text asserted' \
  --boundary-review 'e2e/calendar.spec.ts:25:69765f8886c011e7a1a45b46b1a76feda966625b8e28cc6ae20060d599f9ed7b:unvalidated public HTTP response input; status headers and schema-checked JSON or raw text asserted' \
  --boundary-review 'e2e/calendar.spec.ts:31:69765f8886c011e7a1a45b46b1a76feda966625b8e28cc6ae20060d599f9ed7b:unvalidated public HTTP response input; status headers and schema-checked JSON or raw text asserted' \
  --boundary-review 'e2e/calendar.spec.ts:36:69765f8886c011e7a1a45b46b1a76feda966625b8e28cc6ae20060d599f9ed7b:unvalidated public HTTP response input; status headers and schema-checked JSON or raw text asserted' \
  --boundary-review 'e2e/calendar.spec.ts:50:69765f8886c011e7a1a45b46b1a76feda966625b8e28cc6ae20060d599f9ed7b:unvalidated public HTTP response input; status headers and schema-checked JSON or raw text asserted' \
  --boundary-review 'e2e/calendar.spec.ts:62:69765f8886c011e7a1a45b46b1a76feda966625b8e28cc6ae20060d599f9ed7b:unvalidated public HTTP response input; status headers and schema-checked JSON or raw text asserted' \
  --boundary-review 'e2e/calendar.spec.ts:68:69765f8886c011e7a1a45b46b1a76feda966625b8e28cc6ae20060d599f9ed7b:unvalidated public HTTP response input; status headers and schema-checked JSON or raw text asserted' \
  --boundary-review 'e2e/calendar.spec.ts:88:69765f8886c011e7a1a45b46b1a76feda966625b8e28cc6ae20060d599f9ed7b:unvalidated public HTTP response input; status headers and schema-checked JSON or raw text asserted' \
  --boundary-review 'e2e/calendar.spec.ts:93:69765f8886c011e7a1a45b46b1a76feda966625b8e28cc6ae20060d599f9ed7b:unvalidated public HTTP response input; status headers and schema-checked JSON or raw text asserted' \
  --boundary-review 'e2e/calendar.spec.ts:95:69765f8886c011e7a1a45b46b1a76feda966625b8e28cc6ae20060d599f9ed7b:unvalidated public HTTP response input; status headers and schema-checked JSON or raw text asserted' \
  --json
```

Первый запуск того же полного scope с default Node heap завершился exit 134/OOM. Повтор с `--max-old-space-size=8192` завершился штатно exit 2 и сохранил UNVERIFIED Caddy evidence. Исключение Caddy для получения PASS не применялось.

## Source fingerprints

```text
c6f9d44a1d1fa6734312e2aafaf4f23c84f619669dd0f1065a9073e5e39e71b5  apps/api/src/app.ts
7a2795ecc3dd7d87c5919407f07c203b28d4d96d21df8b0fb65c7ee21aaaffe7  apps/api/src/calendar/connection-control.ts
b7b219aad1e2c5f488d61f2976e0877a84659df26243862c2aaacda607f62344  apps/api/src/calendar/connection.ts
0129e88a25d398c9b5ac7f2179ec90b5e96755deed5dc52567d6eb1f2b86c529  apps/api/src/calendar/credentials.ts
ae6d0e13de749f5e0e54e28d4eb816e127d95f468a5c536ff48ebfd3c464ef71  apps/api/src/calendar/gateway.ts
b43a15bd1296882a01e35f3cdb185c096b0ded5c521624a2d53e8fb32c8f8618  apps/api/src/calendar/lease.ts
f074837fb484746a0bacaf598c89f4b5cf4ec92bb9b50a497567267ab3fb8c4e  apps/api/src/calendar/oauth-session.ts
e4c94f2015230c4eb1359588a7adb45bfa4419a5dc31c7f880438c68572106c9  apps/api/src/calendar/token-envelope.ts
9eb0c082b19492f9675d1e3e05ba337af75e71a1906ec0f5ddc81082d652c8c6  apps/api/src/request-context.ts
97dbbe787ce96466ec9e78f91c234633270a42013e36f669371f33e25da07bef  apps/api/src/routes/google.ts
66bbb61ae44b0e7d52d2a86c9bc6839e70d4113ce83e9420df390694a1121871  apps/api/src/server.ts
65d40d3323eca2d24766d75009403494eb036044791f12698272e77b2f9e3b80  e2e/calendar.spec.ts
c846f0154c227281774ea64997559924b462d5ba94e617f4f5d4282ec2c7bd57  packages/db/src/calendar-values.ts
2bb3e709933b907ddce8f6cb61d5a16231b72e56e72975d500907abc918ff8c2  packages/db/src/connection.ts
0d50251ad78b45bb943949a0671f4b67cf736c374b162fe2afab003197837396  deploy/caddy/Caddyfile
```

Tool/method fingerprints, ESLint rule/config hashes, per-function before/after и type-input fingerprint сохранены в quality JSON.

## Deviations from Plan

1. **[Rule 2 — correctness/security] Расширен private envelope schema.** Четыре прежних поля не выражали обязательный random DEK/wrapped DEK. Добавлены wrappedDek/wrapNonce/wrapTag в `calendar-values.ts`; существующий DB CHECK уже допускает их. Объявлено до edit, task 1 `7ab907e`.
2. **[Rule 3 — type/lease boundary] Добавлены lease/oauth-session helpers и уточнён Database type.** Shared leased client нужен для сериализации внешнего request и DB CAS. Убрана только pool-specific `$client` из публичного Database type; URL/config owners сохранены. Task 1 `7ab907e`.
3. **[Rule 2 — type safety] Уточнены затронутые Hono/WebSocket value types.** Inferred any из SDK/framework response не оставлен в owned code; input становится reviewed unknown и сужается перед использованием. Tasks 1/2, `7ab907e` / `7974a05`.
4. **[Rule 1 — scope correction] Восстановлен ignore boundary.** Добавленная строка `/apps/web/AGENTS.md` удалена из `.gitignore` после указания пользователя, `283a6e8`. Сам AGENTS сохранён, не скрыт и не удалён.
5. **User-authorized verification adaptation.** `build --no-clean` сохраняет generated artifacts. TDD использует сценарии существующего E2E до поведения; HTTPS RED/GREEN не выдумывается без authority/attestation. Только local negative journeys запущены функционально.

Иных архитектурных изменений, миграций, installation/deploy/Google writes или изменений общих tracking files нет.

## TDD Gate Compliance

Tasks 1 и 3 сначала расширили `e2e/calendar.spec.ts`, затем реализовали поведение. Discovery выполнен. Полный RED/GREEN на Google не выполнялся: authorization и matching HTTPS runtime отсутствуют. Пользователь явно разрешил source execution с этим ограничением и передачу provider proof в 24-14. Изолированные mock/unit/component/contract/integration tests не добавлялись; discovery не объявлен RED evidence или OAuth PASS.

## Verification inventory / handoff в 24-14

Фактически написаны пять cases. Готовый source не означает, что сценарий выполнялся.

| Сценарий в e2e/calendar.spec.ts                                                         | Что проверяет                                                                                 | Evidence                                              |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `[calendar] oauth refuses anonymous access and strips callback input`                   | Anonymous connection/callback: 401, no-store, отсутствие synthetic code в response            | Local PASS, exit 0; case неизменён                    |
| `[calendar] oauth rejects foreign Origin and invalid state without replacing the grant` | Foreign Origin; отсутствующий/неверный state; clean redirect и неизменность snapshot          | SOURCE-READY, UNEXECUTED; discovery есть              |
| `[calendar] oauth consumes denial once and binds state to the initiating session`       | Формат state, PKCE S256, другая teacher session, denial, replay и unchanged snapshot          | SOURCE-READY, UNEXECUTED; discovery есть              |
| `[calendar] credential recovery refuses anonymous control requests`                     | Anonymous disconnect/confirm-revoked: 401, no-store                                           | Local PASS, exit 0; case неизменён                    |
| `[calendar] credential recovery requires explicit confirmation and same Origin`         | Missing/false/extra confirmation: 400; foreign Origin: 403; unchanged connection availability | Local PASS, exit 0, provider disabled; case неизменён |

Два SOURCE-READY OAuth cases имеют executable assertions и public API путь. Им нужны matching HTTPS runtime, teacher session и включённая Calendar configuration. Они не завершают настоящий Google consent и не проверяют refresh/revoke. Сравнение snapshot не доказывает сохранение прежнего **валидного** grant: такой grant не установлен как fixture этих cases.

После получения inputs команды ниже выбирают только три OAuth и два recovery cases из таблицы. Они не запускают отсутствующие сценарии следующего раздела.

```sh
E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts --grep 'oauth' --project=light
E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts --grep 'credential recovery' --project=light
```

### NOT YET AUTHORED — authoring и execution gap, владелец 24-14

| Отсутствующий сценарий                                                   | Что потребуется                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student session rejection                                                | Owned student account/session и совместимый fixture lifecycle. Текущий fx выполняет общий legacy cleanup студентов; его нельзя слепо использовать рядом с append-only Calendar journal/FK RESTRICT |
| Успешный real consent, сохранение refresh/actual primary                 | Разрешённый synthetic Google PRIMARY, реальный consent через fixed callback, наблюдаемый public connection outcome                                                                                 |
| Incomplete granted scopes, wrong actual primary, initial missing refresh | Настоящие управляемые consent/grant states. Для wrong primary нужен второй разрешённый synthetic identity; проверка authorization URL не заменяет provider outcomes                                |
| Сохранение прежнего валидного grant при отказе нового consent/exchange   | Подтверждённый старый grant и настоящий отказ нового grant с проверкой public snapshot                                                                                                             |
| Concurrent refresh, refresh без нового token, invalid_grant              | Реальный grant с контролируемым expiration/revocation и вызывающий refresh public workflow                                                                                                         |
| Disconnect in-flight, revoke 200, timeout, lost reply→400, retry         | Реальный provider request и управление потерей ответа/transport без подмены acceptance                                                                                                             |
| Restart/resume, old-request quiescence, operator-confirmed recovery      | Управление существующим API process/transport, наблюдение завершения старого request и реальное подтверждение удаления grant                                                                       |
| Reconnect без resurrection unsent и resolution dispatched barriers       | Durable journal через будущие public command workflows и reconciliation владельца 24-07                                                                                                            |

Эти gaps не закрываются текущими grep-командами и не считаются готовым test coverage. Новых фиктивных PASS/skip cases нет. Простые missing-state, wrong-session, denial, replay и HTTP recovery-validation cases уже написаны. Остальная проверка требует fixture/control authoring, а не добавления неисполняемых заготовок. Student fixture и fault orchestration — инженерная работа 24-14, не новое согласование реализации.

Невосстановимые из checkout operator inputs:

- Разрешённые synthetic Google account identities и фактический consent/2FA; второй identity нужен для wrong primary. Секреты не записываются в SUMMARY.
- Matching attestation существующего HTTPS callback runtime: API build и разрешённая persistence того же target. Новое окружение/deployment этим планом не разрешены.
- Authority на изменение/отзыв и восстановление конкретных synthetic grants и на управление transport/process target для loss/restart. Сам способ fault orchestration ещё должен быть реализован в 24-14 без fake replies.
- Для operator-confirmed recovery — фактическое подтверждение удаления выбранного grant оператором. Это не provider proof.

Missing-authority preflight и live operator flows повторно не запускались.

### Остальные ограничения

Caddy runtime/config validation и redaction в настоящем Caddy — UNVERIFIED: local CLI недоступен; install/server/deploy не разрешены. Static metrics Caddyfile unsupported; первичный full-scope quality report имеет exit 2 / UNVERIFIED.

Parent владеет WINDOWS: переданы отдельно два SOURCE-READY unrun OAuth cases, перечисленные authoring gaps и Caddy limitations. Самостоятельных изменений ledger нет. Stub scan не обнаружил фиктивной provider/worker реализации; отсутствие test stub не доказывает покрытие. Новых security surfaces вне T-24-40/41/42 не выявлено.

## Next Plan Readiness

Owners OAuth/credentials/control готовы для дальнейшей source интеграции. Reconciliation ранее dispatched commands и admission barriers остаются 24-07; acceptance реального provider остаётся 24-14. Full root regression принадлежит 24-13. Общий tracking и inventory расширенных файлов обновляет parent. Остановка перед 24-05.

## Self-Check: PASSED

- Все 15 net changed source/config/E2E файлов и SUMMARY существуют.
- Коммиты `7ab907e`, `7974a05`, `283a6e8`, `e471024` подтверждены через `git merge-base --is-ancestor <hash> HEAD`, exit 0 для каждого.
- Ledger before/after и `git rev-list --count <before>..<after>` подтверждают 6 коммитов до текущей metadata correction, включая `fad2e0f` и первичный SUMMARY.
- Первичный quality snapshot проверил 3547 type inputs. После него изменён только `e2e/calendar.spec.ts`; его новый fingerprint, scoped typecheck и metrics приведены ниже. Старый report не объявляется актуальным для этого файла.
- Собственные API/web остановлены; `DEV_DOWN_OK`. Единственный внешний untracked файл — сохранённый `apps/web/AGENTS.md`.

## Bounded review correction — fad2e0f

Изменены только `e2e/calendar.spec.ts` и этот SUMMARY. Production source, shared harness и Playwright config не менялись. Parent подтвердил закрытие конкретных privacy findings.

- Grant/state/Location assertions передают в expect boolean и безопасную подпись. Schema validation выводит фиксированную ошибку.
- Callback transport rejection заменяется фиксированной ошибкой без URL/state и исходного cause. Shared api helper уже подавляет request details.
- Для двух teacher OAuth cases отдельный `test.extend` фиксирует trace/video/screenshot off. Проверены текущие Playwright 1.63 config и fixture implementation; остальные cases сохраняют свои artifact options.
- Simplify применён к исправлению; новых комментариев, suite, mocks, fake outcomes и dependencies нет.
- Source commit: `fad2e0f3bfa54a40bbe7b25e52fac9b85fa232d6`, `fix(24-04): исключил секреты из OAuth evidence`. Первый metadata commit: `be8c4dc`.

### Текущее статическое evidence

SHA-256 `e2e/calendar.spec.ts`: `65d40d3323eca2d24766d75009403494eb036044791f12698272e77b2f9e3b80`.

```sh
yarn exec tsc --noEmit --strict --target ES2024 --module ESNext --moduleResolution Bundler --allowImportingTsExtensions --allowJs --checkJs --skipLibCheck --types node e2e/calendar.spec.ts
E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\] (oauth|credential recovery)' --project=light --list
yarn prettier --check e2e/calendar.spec.ts
git diff --check
```

Все четыре команды: exit 0. TSC без diagnostics. Discovery: `Total: 7 tests in 3 files` — пять cases и setup/cleanup; runtime/provider execution отсутствует. Prettier: `All matched files use Prettier code style!`. Diff check без ошибок.

Промежуточные static failures исправлены: TSC без allowJs не видел declarations существующего paths.mjs; добавлены принятые tooling flags allowJs/checkJs. Playwright отклонил worker options внутри describe и смену option registration; применён поддерживаемый отдельный test.extend с обычными значениями. Финальные проверки завершились успешно.

Существующий `calendar-metrics.compare` измерил только этот файл против `be8c4dc`, exit 0; Node 24.17.0 / TypeScript 6.0.3 / ESLint 10.12.0, прежняя token convention. 210 lines вместо 174, unavailable syntax: 0. File maxima: CC 6→6, cognitive 5→5, Halstead D 23.98→23.98. Новые helpers: readConnection CC=2/cognitive=1/D=10; callback CC=1/cognitive=0/D=5.91; catch callback CC=1/cognitive=0/D=3.5. Неоднозначные имена callbacks не получили выдуманных before-pairs.

Точная команда измерения:

```sh
node --input-type=module -e 'import { readFileSync } from "node:fs"; import { execFileSync } from "node:child_process"; import { createHash } from "node:crypto"; import { compare, METHOD } from "./scripts/dev-checks/calendar-metrics.ts"; const path="e2e/calendar.spec.ts"; const before=execFileSync("git",["show","be8c4dc:"+path],{encoding:"utf8"}); const after=readFileSync(path,"utf8"); const result=compare(path,before,after); console.log(JSON.stringify({path,sha256:createHash("sha256").update(after).digest("hex"),method:METHOD,lines:result.lines,unavailable:result.unavailable,functions:result.functions.filter(f=>f.changed).map(f=>({name:f.name,line:f.line,cc:f.cyclomatic,cognitive:f.cognitive,d:f.difficulty,before:f.before?{cc:f.before.cyclomatic,cognitive:f.before.cognitive,d:f.before.difficulty}:null})),max:{cc:Math.max(...result.functions.map(f=>f.cyclomatic)),cognitive:Math.max(...result.functions.map(f=>f.cognitive)),d:Math.max(...result.functions.map(f=>f.difficulty))}}));'
```

Ранее прошедшие три local cases и production source неизменны; runtime evidence переиспользовано. Исправленные два внешних OAuth cases остаются UNEXECUTED. Static/discovery не объявлены functional privacy/OAuth PASS. Новые runtime, provider calls и operator flows не запускались. Остановка перед 24-05.
