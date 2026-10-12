---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '13'
subsystem: testing
tags: [google-calendar, readiness, e2e, typescript]
requires:
  - phase: 24-11
    provides: Final conflict and series source
provides:
  - Current source readiness and reproducible scoped quality evidence
  - Public pages/day0/day8 verifier and secure fault/operator harness
  - Explicit runtime/provider acceptance handoff to24-14
affects: [24-14, 25-google-calendar-two-way-sync]
key-files:
  created: [scripts/dev-checks/calendar-quality.ts, scripts/dev-checks/calendar-acceptance.mjs]
  modified: [apps/api/src/calendar/credentials.ts, e2e/calendar.spec.ts, e2e/support/calendar-series-ui.ts]
requirements-completed: []
status: source_verified_runtime_pending
---

# 24-13 — Текущий source проверен; actual Google приёмка остаётся открытой

## Результат

Задачи1–3 реализованы. CLI измеряет actual owned source и валидирует внешние observations. Успешный refresh отмечается только после actual provider response и generation CAS. Secure harness использует существующий owner/runtime/persistence binding; никакое наблюдение здесь не подменяет consent, provider outcome или elapsed time.

Финальные исправления сохранены в09211e8. Полный implementation baseline8116e48b1788b68d93f84536d3142d5ac4797148 уже включает принятую21.1. Current source fingerprint6d1e88478bf422a79ae0002a0db4b5eae8384cbc2f8889a35e70ad5b4432f989:177TS/JS files,2269functions,1893changed functions,3670type inputs. SQL/generated migrations, dependencies и non-TS config/docs не измерены TS function metrics. Их отдельные configured CI/runtime gates не получают PASS от этого инструмента.

## Точные проверки

Все процессы завершились; stdout/stderr и exact argv сохранены в ранее разрешённом private STATE_DIR, без secrets/user content.

| Command                                                                                                                                                                                                             | Original exit/status | Краткий результат                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `env -u DATABASE_URL -u MIGRATOR_DATABASE_URL NODE_ENV=test yarn node --env-file=.env.test apps/api/src/migrate.ts`                                                                                                 | 0                    | migrations applied; существующая_test DB, оба role guards подтверждены;8Calendar tables и queue permissions проверены readonly SQL |
| `yarn typecheck`                                                                                                                                                                                                    | 0                    | 5/5workspace tasks successful                                                                                                      |
| `yarn lint`                                                                                                                                                                                                         | 0                    | 1/1applicable task successful                                                                                                      |
| `yarn test`                                                                                                                                                                                                         | 0                    | 11existing files,116tests passed: contracts48/db21/api47; existing suites preserved                                                |
| `yarn build --force`                                                                                                                                                                                                | 0                    | 2/2fresh builds successful;11web pages; API34output artifacts                                                                      |
| `yarn knip`                                                                                                                                                                                                         | 0                    | Unused files/exports отсутствуют; existing configuration hints не являются dead-code findings                                      |
| `yarn format:check`                                                                                                                                                                                                 | 1                    | 220format warnings;0в177owned source files; historical planning/other areas не исправлялись этим task                              |
| `yarn prettier --check` с exact177owned paths из private24-13-owned-format-command.json                                                                                                                             | 0                    | All matched files use Prettier code style                                                                                          |
| `yarn node --max-old-space-size=8192 scripts/dev-checks/calendar-quality.ts` с exact argv из private24-13-final-quality-complete-command.json: baseline8116e48,177owned paths и current reviewed boundary arguments | 0/PASS               | 0failures/diagnostics/unreviewed boundaries/missing/stale; source fingerprint указан выше                                          |

Exact long argv остаются в inspectable private JSON, а не заменены сокращённой командой. Rerun: выполнить массив argv из соответствующего command.json из ROOT. Current full quality output:24-13-final-quality-complete-stdout.json. Весь global format check не объявлен green.

Первый `yarn build` exited1/EEXIST, потому что Parent запустил его параллельно с `yarn test`, чей Turbo graph сам вызывает build. Отдельный API build exited0; fresh serialized `yarn build --force` exited0 без EEXIST. Source исправления для этого не требовалось; первоначальный failure сохранён. Cached replay с exit0 и старым error log не использован как decisive build proof.

Первые quality invocations exited2/UNVERIFIED на недостающих input-boundary receipts. Reused только PASS receipts с совпадающими path/line/currentSHA. Узкая независимая проверка31production boundaries и Parent30E2E+4observation boundaries закрыли остаток. Финальный actual CLI exited0/PASS; blanket unknown exemption отсутствует.

## Quality / simplify

Node24.17.0, TypeScript6.0.3, ESLint10.12.0. CC — existing ESLint classic AST convention; cognitive — DVLab AST nesting/control/logical-sequence v1, без заявления Sonar equivalence. Halstead D=(n1/2)*(N2/n2): executable operators по SyntaxKind, operands по точному написанию; trivia/imports/type syntax исключены; nested functions отдельно. Current maxima:CC21,cognitive21,D45.5211,498physical lines. No new/touched any findings.179unknown boundaries имеют конкретное input/error объяснение. Полный raw method, source/tool hashes и before/after function spans находятся в current quality report.

Simplify применён к финальному owned diff. Общая проверка calendarVersionFor убрала duplicate event/series logic и сохранила stale/fresh/editable/version fences. Семь API exports не имели production/test consumers;13retained production function bodies побайтно совпадают с16fcfb0. Файлы и existing tests не удалялись. Existing conflictMoveUi теперь восстанавливает исходную account zone вfinally. Actual browser/provider execution этого cleanup остаётся NOT RUN.

## Открытая приёмка24-14

Actual published/anonymous public pages, Google Auth Platform Branding/In production, named TEST PRIMARY consent, provider/fault/recovery journeys и immutable day0/day8 observation — UNVERIFIED/NOT RUN. Нужны existing authorized HTTPS runtime, matching deployed/build/persistence attestation, actual grant и genuine UTC interval>=8days. Discovery/static/legacy tests не заменяют эти claims. Requirement completion и Phase24 seal не заявлены.

Source25 можно выполнять по проверенным source joins, пока external14 ждёт фактические inputs/time. Ни deploy, paid provider, secret transfer, automation, new environment, cleanup nor personal Primary selection этот SUMMARY не разрешает.

## Изменённые файлы

Это полный52-path Source13 inventory; shared files имеют общий final Phase24 baseline, а не утверждение об исключительном authorship13. Точные source hashes находятся в quality report.

| File                                                            | Причина                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `.github/workflows/ci.yml`                                      | Сохранил CI-проверки и исправил подготовку Calendar readiness.                       |
| `knip.json`                                                     | Объявил действующие runtime/tooling entrypoints.                                     |
| `package.json`                                                  | Объявил инструменты проверки Calendar.                                               |
| `yarn.lock`                                                     | Закрепил объявленные зависимости без изменения age gate.                             |
| `playwright.config.ts`                                          | Защитил private evidence и выключил screenshots на HTTPS target.                     |
| `apps/api/tsdown.config.ts`                                     | Добавил переносимые bundled fault runtime/operator entrypoints.                      |
| `apps/api/Dockerfile`                                           | Включил нужные runtime harness artifacts в образ API.                                |
| `apps/api/turbo.json`                                           | Привязал build cache к реальным fault source inputs.                                 |
| `apps/api/src/tools/calendar-fault-runtime.ts`                  | Обеспечивает разрешённый fault transport/control с identity и permissions guards.    |
| `apps/api/src/tools/calendar-fault-operator.ts`                 | Обеспечивает разрешённый fault transport/control с identity и permissions guards.    |
| `e2e/support/calendar-fault-control.ts`                         | Обеспечивает разрешённый fault transport/control с identity и permissions guards.    |
| `e2e/support/calendar-fault-protocol.ts`                        | Обеспечивает разрешённый fault transport/control с identity и permissions guards.    |
| `e2e/support/calendar-fault-auth.ts`                            | Обеспечивает разрешённый fault transport/control с identity и permissions guards.    |
| `e2e/support/calendar-fault-ssh.ts`                             | Обеспечивает разрешённый fault transport/control с identity и permissions guards.    |
| `e2e/support/calendar-faults.ts`                                | Обеспечивает разрешённый fault transport/control с identity и permissions guards.    |
| `docs/google-calendar/CALENDAR-FAULT-HANDOFF.md`                | Описал существующий защищённый server fault/SQL operator path.                       |
| `packages/contracts/test/auth.test.ts`                          | Согласовал существующие ожидания error codes с контрактом.                           |
| `apps/api/test/config.test.ts`                                  | Согласовал существующую проверку с конфигурацией Calendar.                           |
| `apps/api/test/shutdown.test.ts`                                | Убрал конфликт портов в существующей проверке shutdown.                              |
| `e2e/support/calendar.ts`                                       | Сохраняет existing public Calendar E2E и его recovery/ownership evidence.            |
| `e2e/support/data.ts`                                           | Сохраняет ownership retained/disposable fixtures и target guards.                    |
| `e2e/support/calendar-history.ts`                               | Сохраняет existing public Calendar E2E и его recovery/ownership evidence.            |
| `e2e/support/target.ts`                                         | Проверяет actual HTTPS/build/persistence binding через существующий secure operator. |
| `e2e/support/prelaunch-sql.ts`                                  | Проверяет actual HTTPS/build/persistence binding через существующий secure operator. |
| `e2e/support/prelaunch-transport.ts`                            | Проверяет actual HTTPS/build/persistence binding через существующий secure operator. |
| `scripts/dev-checks/calendar-quality.ts`                        | Измеряет scoped source/type gates с fingerprints и явным методом.                    |
| `scripts/dev-checks/calendar-metrics.ts`                        | Измеряет scoped source/type gates с fingerprints и явным методом.                    |
| `scripts/dev-checks/calendar-types.ts`                          | Измеряет scoped source/type gates с fingerprints и явным методом.                    |
| `scripts/dev-checks/calendar-acceptance.mjs`                    | Проверяет actual public pages/day0/day8 evidence без создания provider proof.        |
| `scripts/dev-checks/calendar-acceptance-io.ts`                  | Проверяет actual public pages/day0/day8 evidence без создания provider proof.        |
| `scripts/dev-checks/calendar-acceptance-records.ts`             | Проверяет actual public pages/day0/day8 evidence без создания provider proof.        |
| `apps/api/src/calendar/observation.ts`                          | Владеет безопасными opaque observations grant/read/refresh.                          |
| `apps/api/src/calendar/reads.ts`                                | Отражает фактически завершённое fresh чтение.                                        |
| `apps/api/src/routes/schedule.ts`                               | Публикует public read completion после успешного ответа.                             |
| `apps/api/src/calendar/connection.ts`                           | Связывает наблюдение с actual connection/grant.                                      |
| `apps/api/src/calendar/connection-control.ts`                   | Сохраняет generation и recovery при управлении соединением.                          |
| `apps/api/src/server.ts`                                        | Собирает разрешённые observation/fault owners.                                       |
| `e2e/calendar-evidence.spec.ts`                                 | Проверяет публичные grant/refresh/read observations в existing E2E journey.          |
| `e2e/support/calendar-evidence.ts`                              | Проверяет публичные grant/refresh/read observations в existing E2E journey.          |
| `scripts/dev-checks/calendar-acceptance-pages.ts`               | Проверяет actual public pages/day0/day8 evidence без создания provider proof.        |
| `apps/api/src/calendar/credentials.ts`                          | Публикует refresh observation только после provider success и generation CAS.        |
| `apps/api/src/schedule/changes.ts`                              | Удалил шесть неподключённых legacy facades; retained bodies сохранены.               |
| `apps/api/src/schedule/schedule.ts`                             | Удалил неподключённый createLesson; retained bodies сохранены.                       |
| `e2e/calendar.spec.ts`                                          | Сохраняет existing public Calendar E2E и его recovery/ownership evidence.            |
| `apps/web/app/privacy/page.tsx`                                 | Описал фактически сохраняемые supported writable snapshots.                          |
| `e2e/support/calendar-read-fixture.ts`                          | Сохраняет existing public Calendar E2E и его recovery/ownership evidence.            |
| `e2e/support/calendar-read-recovery.ts`                         | Сохраняет existing public Calendar E2E и его recovery/ownership evidence.            |
| `e2e/support/calendar-ownership.ts`                             | Сохраняет existing public Calendar E2E и его recovery/ownership evidence.            |
| `e2e/support/calendar-series-ui.ts`                             | Восстанавливает account defaultTimeZone в finally после сценариев.                   |
| `apps/web/app/(app)/schedule/_components/calendar-overlaps.ts`  | Владеет общей проверкой актуальной версии Calendar target.                           |
| `apps/web/app/(app)/schedule/_components/schedule-mutations.ts` | Использует общий resolver с прежними mutation fences.                                |
| `apps/web/components/app/google-conflicts.tsx`                  | Использует общий resolver с прежними overlap-read fences.                            |
