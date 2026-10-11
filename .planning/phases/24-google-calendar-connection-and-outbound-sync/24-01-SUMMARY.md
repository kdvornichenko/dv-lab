---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '01'
subsystem: testing
tags: [calendar, public-pages, playwright, privacy]
requires:
  - phase: 21.1-default-time-zone
    provides: Existing public E2E harness and teacher settings recovery
provides:
  - Anonymous welcome, privacy and terms with exact public route allowlist
  - HTTPS origin, API build and operator-confirmed persistence preflight before fixtures
affects: ['24-03', '24-04', '24-07', '24-11', '24-13', '24-14']
actuals:
  tokens: 6689
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns: [shared target preflight before fixture writes]
key-files:
  created:
    - apps/web/app/welcome/page.tsx
    - apps/web/app/privacy/page.tsx
    - apps/web/app/terms/page.tsx
    - e2e/calendar.spec.ts
    - e2e/support/calendar.ts
  modified:
    - apps/web/proxy.ts
    - e2e/support/api.ts
    - e2e/support/data.ts
    - e2e/support/test.ts
    - e2e/auth.setup.ts
    - e2e/cleanup.teardown.ts
    - playwright.config.ts
key-decisions:
  - Setup and cleanup must pass the same preflight as application journeys.
  - HTTPS fixture authority is an operator-provided private binding, not an inferred deployment permission.
  - Provider fixture operations remain absent until their actual authorized journey needs them.
patterns-established: []
requirements-completed: [GCAL-01]
coverage:
  - id: SC6-public
    description: Anonymous public pages and private workspace boundary
    requirement: GCAL-01
    verification:
      - kind: e2e
        ref: 'e2e/calendar.spec.ts#public pages keep the workspace private'
        status: pass
      - kind: e2e
        ref: 'e2e/calendar.spec.ts#public policies describe calendar storage and recovery'
        status: pass
    human_judgment: false
  - id: P1-preflight
    description: Direct HTTPS discovery and refusal before fixtures without target authority
    verification:
      - kind: other
        ref: 'E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts --grep calendar --project=light --list'
        status: pass
      - kind: other
        ref: '24-01-https-missing-authority.log: expected exit 1 before fixture writes'
        status: pass
      - kind: e2e
        ref: 'Authorized HTTPS API build, persistence and Google runtime journey'
        status: unknown
    human_judgment: true
    rationale: Actual operator binding and Google fixture authority are required for the remote run.
duration: 15min
completed: 2026-10-11
status: complete
---

# 24-01 — Публичные страницы и E2E target

Открыты `/welcome`, `/privacy` и `/terms`. Остальные защищённые маршруты сохраняют вход. HTTPS E2E проверяет подтверждение оператора, SHA API и identity базы до SQL и передачи учётных данных.

## Task Commits

1. Welcome и точный allowlist — `a44f3fe`.
2. Privacy, Terms и публичный journey — `8512408`.
3. HTTPS preflight и привязка фикстур — `8289591`.

## Files Created/Modified

- `apps/web/app/welcome/page.tsx` — утверждённая публичная точка входа.
- `apps/web/app/privacy/page.tsx` — точный текст о Google reads, persisted cache, journal, credentials и backups.
- `apps/web/app/terms/page.tsx` — правила сохранения только после Google acknowledgement и поведение без связи.
- `apps/web/proxy.ts` — разрешены только три точных публичных пути.
- `e2e/calendar.spec.ts` — public navigation, keyboard, narrow viewport, policy disclosures и private route checks.
- `e2e/support/calendar.ts` — HTTPS preflight и приватное свидетельство проверенной identity.
- `e2e/support/data.ts` — общий origin, раздельное состояние локального и HTTPS target, запрет SQL и credentials до preflight.
- `e2e/support/api.ts` — тот же preflight перед API-запросами; JSON входит как `unknown`.
- `e2e/support/test.ts` — page fixture проходит preflight.
- `e2e/auth.setup.ts` — readiness до очистки фикстур и входа; ожидаемый URL использует выбранный origin.
- `e2e/cleanup.teardown.ts` — readiness до восстановления фикстур и настроек.
- `playwright.config.ts` — global setup останавливает неподтверждённый HTTPS run до запуска проектов.
- `24-01-PLAN.md` — inventory дополнен setup и teardown, которые также могли обращаться к базе.

## Verification

Команды выполнены из worktree фазы. `STATE_DIR` — существующий приватный каталог `scripts/dev-checks/paths.mjs`, вне репозитория. Новых provider calls или удалённого deployment не было.

| Команда                                                                                                                                                                        | Exit       | Краткий результат                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------- |
| `yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\] public' --project=light --project=dark --no-deps`                                                              | 0          | 4 passed; public pages без SQL fixtures                                          |
| `yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\] public' --project=light --project=dark`                                                                        | 0          | 6 passed; setup, обе темы, cleanup; `settings=restored`                          |
| `E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\]' --project=light --list`                                                  | 0          | 4 tests discovered; не functional PASS                                           |
| `E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts --grep '\[calendar\]' --project=light --no-deps`                                               | 1 expected | `E2E HTTPS requires an operator-provided E2E_TARGET_ATTESTATION before fixtures` |
| `yarn workspace @dv-lab/web typecheck`                                                                                                                                         | 0          | No TypeScript errors                                                             |
| `yarn workspace @dv-lab/web exec eslint app/welcome/page.tsx app/privacy/page.tsx app/terms/page.tsx proxy.ts`                                                                 | 0          | No lint findings                                                                 |
| `yarn exec prettier --check e2e/support/data.ts e2e/support/calendar.ts e2e/support/api.ts e2e/support/test.ts e2e/auth.setup.ts e2e/cleanup.teardown.ts playwright.config.ts` | 0          | All matched files use Prettier code style                                        |
| `node --input-type=module < "$TMPDIR/dvlab-dev-checks/24-01-quality-check.mjs"`                                                                                                | 0          | 12 files, 89 functions, failures=[]                                              |
| `git diff --check`                                                                                                                                                             | 0          | No whitespace errors                                                             |
| `node scripts/dev-checks/wait-dev.mjs down`                                                                                                                                    | 0          | `DEV_DOWN_OK`                                                                    |

Исходные процессы закончились с указанным exit. Логи: `24-01-public-pages.log`, `24-01-final-public.log`, `24-01-https-missing-authority.log`, `24-01-web-types.log`, `24-01-public-lint.log` в `STATE_DIR`. Сценарии написаны до страниц: первоначально проверки Privacy/Terms падали на отсутствующих страницах. Затем оба сценария прошли в обеих темах.

Final source: `8289591`. Fingerprint 12 файлов: `a5fad2f485a698c8ad21e1b9246c3261cf6451ab277ae1c78d1767726eadac6c`. Последующие изменения после локального E2E касались типов JSON и проверки пути attestation для HTTPS; локальное поведение не менялось. Успешный HTTPS run, mismatch реального API/БД и Google operations остаются **UNVERIFIED**.

## Quality / Simplify

Owned diff прочитан с ближайшими callers. Нет новых комментариев, подтверждённого dead code или лишних provider helpers. 10 `unknown` относятся к входным JSON/SQL данным и их передаче к валидаторам. Explicit/inferred `any`: 0. Semantic diagnostics: 0.

Метод: TypeScript 6.0.3 и существующий `scripts/dev-checks/time-zone-metrics.ts`. Baseline `8116e48`; fingerprints, before/after и все функции находятся в `STATE_DIR/24-01-final-quality.json`. Измеряются 12 handwritten source/tooling files, 89 функций; dependencies и generated files в этот denominator не входят. Halstead использует AST leaf tokens: keyword/punctuation как operator, identifier/literal как operand; comments/trivia и nested functions исключены, type/JSX tokens включены. Это промежуточный метод; final quality owner — 24-13.

| Изменённая ветвящаяся область               | CC before → after | Cognitive before → after |
| ------------------------------------------- | ----------------- | ------------------------ |
| `proxy.ts`                                  | 4 → 5             | 2 → 3                    |
| `data.ts`, максимум функции                 | 7 → 7             | 6 → 6                    |
| Новый `calendar.ts`, максимум функции       | — → 14            | — → 11                   |
| Новый `calendar.spec.ts`, максимум callback | — → 6             | — → 5                    |

Общие максимумы: CC 14, cognitive 11, Halstead Difficulty 25.56, file size 255 строк. Все обязательные границы соблюдены. Перед итоговым измерением исправлены `any` из default generic Playwright и настройки анализа JS imports; не скрыты suppressions или exclusions.

## Target binding and limitations

`E2E_TARGET_ORIGIN` принимает точный HTTPS origin или прежний `http://localhost:3000`. Путь, credentials, query и fragment отвергаются. Для HTTPS `E2E_TARGET_ATTESTATION` указывает на предоставленный оператором JSON вне репозитория с правами `0600`: `origin`, `apiBuildSha` (40 hex), `persistenceFingerprint` (64 hex), `fixtureWritesAuthorized: true`. Этот файл не создан исполнителем и не подменяет отдельное разрешение на Google synthetic fixtures.

Fingerprint базы — SHA-256 JSON строки `{database,address,port,oid}` из read-only запроса текущей базы. SQL продолжает использовать существующий `.env`, роль `dvlab_migrator` и только `_dev`; неподтверждённый `_test` target не расширяет этот прежний fixture boundary. Оператор подтверждает, что эта identity принадлежит тому же HTTPS runtime и SHA. Публичный `/api/healthz` должен вернуть `status=ok`, `db=ok`, точный `sha`. Иначе запуск отказывает до fixture writes. Для разрешённого запуска используются прямые Playwright commands без localhost wait script.

Public policy соответствует утверждённой реализации всей фазы. Publication выполняется только после реализации зависимых owners и отдельной readiness-проверки 24-14. Этот план не подтверждает готовность Google feature или Production/day-8 verification.
