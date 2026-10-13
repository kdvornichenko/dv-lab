---
schema_version: 1
open_count: 11
waived_count: 0
fixed_count: 1
total_count: 12
last_updated: 2026-10-13T18:06:24.770Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 18 | deviation | packages/db/src/connection.ts |  | Нет типа базы или транзакции и разбора нарушений уникальности в @dv-lab/db: отложено, см. 18-ARCH-REVIEW.md | open |  | 2026-10-09T12:29:57.074Z |  |
| 2 | 18 | deviation | apps/web/app/(app)/_components/app-sidebar.tsx |  | Порядок Tab в оболочке отличается от 18-UI-SPEC (skip, поиск, разделы одной остановкой, аккаунт, триггер): принято, владелец не углубляет доступность | open |  | 2026-10-09T17:27:11.622Z |  |
| 3 | 19 | deviation | .planning/phases/19-student-cards-and-vault-import/19-CONTEXT.md |  | Владелец правила «что входит в остаток»: отложено, см. 19-ARCH-REVIEW.md | open |  | 2026-10-09T18:00:04.771Z |  |
| 4 | 21 | unrun-verify | .planning/phases/21-lesson-accounting-and-today/21-UI-SPEC.md | 604 | Отрисовка имени длиной 300 символов не проверена: contracts и SQL CHECK допускают максимум 80; запрос с 300 символами отклонён HTTP 400 | open |  | 2026-10-11T07:27:54.898Z |  |
| 5 | 21 | unrun-verify | .planning/phases/21-lesson-accounting-and-today/21-UI-SPEC.md | 606 | Реальный переход browser и API через полночь Вьетнама не проверен; существующая симуляция устаревшей даты и повторного чтения Today прошла в обеих темах | open |  | 2026-10-11T07:27:55.011Z |  |
| 6 | 21.1 | unrun-verify | e2e/today.spec.ts |  | Поведенческие RED/GREEN сценариев [tz] не запускались в плане 02: по PLAN-INDEX общий runtime принадлежит плану 13; listing не подтверждает поведение. | fixed |  | 2026-10-11T12:25:00.008Z | 2026-10-11T15:33:53.149Z |
| 7 | 24 | unrun-verify | .planning/phases/24-google-calendar-connection-and-outbound-sync/24-04-SUMMARY.md |  | OAuth: два написанных сценария не запускались. Real consent, refresh, revoke, fault/restart и student cases требуют authoring и external execution в 24-14; локальные три negative cases не доказывают provider behavior. | open |  | 2026-10-11T17:04:39.276Z |  |
| 8 | 24 | unrun-verify | deploy/caddy/Caddyfile |  | Caddy runtime/config и callback-query redaction не проверены: CLI отсутствует, install/deploy не разрешены. Метрики Caddy DSL unsupported, full-scope quality UNVERIFIED. Проверка владельца 24-13/CI и существующего runtime в 24-14. | open |  | 2026-10-11T17:04:39.417Z |  |
| 9 | 24 | unrun-verify | .planning/phases/24-google-calendar-connection-and-outbound-sync/24-05-SUMMARY.md |  | Чтение Calendar: connected all-pages/restart, empty non-final page, out-of-order publish, foreign-account, next prefix/deadline и полная history matrix пока не подтверждены реальным provider. Отдельные journeys ещё требуют authoring; disconnected E2E не заменяет эти доказательства. Закрыть на разрешённом prelaunch runtime в 24-13/24-14. | open |  | 2026-10-11T18:06:27.661Z |  |
| 10 | 24 | unrun-verify | .planning/phases/24-google-calendar-connection-and-outbound-sync/24-06-SUMMARY.md |  | C2: disconnected API/UI, marks и Pays soon проверены; connected edit Schedule→Today→Students, failed pagination, proven none, last-known UI и real pending command ещё требуют authoring/execution. Exact startsAt=asOf после исправления статически проверен, но real-clock equality не наблюдалась. Сохранить UNVERIFIED до воспроизводимого evidence. | open |  | 2026-10-11T18:06:27.778Z |  |
| 11 | 24 | unrun-verify | .planning/phases/24-google-calendar-connection-and-outbound-sync/24-07-SUMMARY.md |  | Journal07 source и disconnected E2E завершены; connected create/ACK/recovery и фактический fault transport не запускались. Bundled runtime13 интегрирован, SSH loader/control и PRIMARY binding готовятся. Закрыть на существующем разрешённом HTTPS target с exact build/persistence и synthetic fixtures; отсутствие proof не PASS. | open |  | 2026-10-11T19:11:40.648Z |  |
| 12 | 22 | unrun-verify | scripts/dev-checks/chat-web.mjs |  | 22-15: chat-web.mjs models light\|dark и wait-dev.mjs down не запускались: стенд владельца занимает порты 3000 и 4000 | open |  | 2026-10-13T18:06:24.770Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "18",
    "file": "packages/db/src/connection.ts",
    "line": null,
    "description": "Нет типа базы или транзакции и разбора нарушений уникальности в @dv-lab/db: отложено, см. 18-ARCH-REVIEW.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-09T12:29:57.074Z",
    "resolved_at": null,
    "milestone": "v2.0"
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "18",
    "file": "apps/web/app/(app)/_components/app-sidebar.tsx",
    "line": null,
    "description": "Порядок Tab в оболочке отличается от 18-UI-SPEC (skip, поиск, разделы одной остановкой, аккаунт, триггер): принято, владелец не углубляет доступность",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-09T17:27:11.622Z",
    "resolved_at": null,
    "milestone": "v2.0"
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "19",
    "file": ".planning/phases/19-student-cards-and-vault-import/19-CONTEXT.md",
    "line": null,
    "description": "Владелец правила «что входит в остаток»: отложено, см. 19-ARCH-REVIEW.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-09T18:00:04.771Z",
    "resolved_at": null,
    "milestone": "v2.0"
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "21",
    "file": ".planning/phases/21-lesson-accounting-and-today/21-UI-SPEC.md",
    "line": 604,
    "description": "Отрисовка имени длиной 300 символов не проверена: contracts и SQL CHECK допускают максимум 80; запрос с 300 символами отклонён HTTP 400",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-11T07:27:54.898Z",
    "resolved_at": null,
    "milestone": "v2.0"
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "21",
    "file": ".planning/phases/21-lesson-accounting-and-today/21-UI-SPEC.md",
    "line": 606,
    "description": "Реальный переход browser и API через полночь Вьетнама не проверен; существующая симуляция устаревшей даты и повторного чтения Today прошла в обеих темах",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-11T07:27:55.011Z",
    "resolved_at": null,
    "milestone": "v2.0"
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "21.1",
    "file": "e2e/today.spec.ts",
    "line": null,
    "description": "Поведенческие RED/GREEN сценариев [tz] не запускались в плане 02: по PLAN-INDEX общий runtime принадлежит плану 13; listing не подтверждает поведение.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-11T12:25:00.008Z",
    "resolved_at": "2026-10-11T15:33:53.149Z",
    "milestone": "v2.0"
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "24",
    "file": ".planning/phases/24-google-calendar-connection-and-outbound-sync/24-04-SUMMARY.md",
    "line": null,
    "description": "OAuth: два написанных сценария не запускались. Real consent, refresh, revoke, fault/restart и student cases требуют authoring и external execution в 24-14; локальные три negative cases не доказывают provider behavior.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-11T17:04:39.276Z",
    "resolved_at": null,
    "milestone": "v2.0"
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "24",
    "file": "deploy/caddy/Caddyfile",
    "line": null,
    "description": "Caddy runtime/config и callback-query redaction не проверены: CLI отсутствует, install/deploy не разрешены. Метрики Caddy DSL unsupported, full-scope quality UNVERIFIED. Проверка владельца 24-13/CI и существующего runtime в 24-14.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-11T17:04:39.417Z",
    "resolved_at": null,
    "milestone": "v2.0"
  },
  {
    "id": 9,
    "kind": "unrun-verify",
    "phase": "24",
    "file": ".planning/phases/24-google-calendar-connection-and-outbound-sync/24-05-SUMMARY.md",
    "line": null,
    "description": "Чтение Calendar: connected all-pages/restart, empty non-final page, out-of-order publish, foreign-account, next prefix/deadline и полная history matrix пока не подтверждены реальным provider. Отдельные journeys ещё требуют authoring; disconnected E2E не заменяет эти доказательства. Закрыть на разрешённом prelaunch runtime в 24-13/24-14.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-11T18:06:27.661Z",
    "resolved_at": null,
    "milestone": "v2.0"
  },
  {
    "id": 10,
    "kind": "unrun-verify",
    "phase": "24",
    "file": ".planning/phases/24-google-calendar-connection-and-outbound-sync/24-06-SUMMARY.md",
    "line": null,
    "description": "C2: disconnected API/UI, marks и Pays soon проверены; connected edit Schedule→Today→Students, failed pagination, proven none, last-known UI и real pending command ещё требуют authoring/execution. Exact startsAt=asOf после исправления статически проверен, но real-clock equality не наблюдалась. Сохранить UNVERIFIED до воспроизводимого evidence.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-11T18:06:27.778Z",
    "resolved_at": null,
    "milestone": "v2.0"
  },
  {
    "id": 11,
    "kind": "unrun-verify",
    "phase": "24",
    "file": ".planning/phases/24-google-calendar-connection-and-outbound-sync/24-07-SUMMARY.md",
    "line": null,
    "description": "Journal07 source и disconnected E2E завершены; connected create/ACK/recovery и фактический fault transport не запускались. Bundled runtime13 интегрирован, SSH loader/control и PRIMARY binding готовятся. Закрыть на существующем разрешённом HTTPS target с exact build/persistence и synthetic fixtures; отсутствие proof не PASS.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-11T19:11:40.648Z",
    "resolved_at": null,
    "milestone": "v2.0"
  },
  {
    "id": 12,
    "kind": "unrun-verify",
    "phase": "22",
    "file": "scripts/dev-checks/chat-web.mjs",
    "line": null,
    "description": "22-15: chat-web.mjs models light|dark и wait-dev.mjs down не запускались: стенд владельца занимает порты 3000 и 4000",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-13T18:06:24.770Z",
    "resolved_at": null,
    "milestone": "v2.0"
  }
]
````
