---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-10-09T18:00:04.771Z
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
  }
]
````
