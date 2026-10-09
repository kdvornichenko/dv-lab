# Phase 19: Student Cards and Vault Import - Pattern Map

**Mapped:** 2026-10-10
**Files analyzed:** 58 (new, changed or copied)
**Analogs found:** 49 in-repo / 58; 9 without an analog (see "No Analog Found"); 7 external copy sources are listed separately

Все пути-аналоги из репозитория проверены по `git ls-files` (трекаемые файлы фазы 18). Исходники design-lab лежат в другом репозитории (vault) и аналогами не называются: это «copy sources (external, vetted in 19-UI-SPEC Registry Safety)». В файле нет имён учеников, сумм и текста заметок; в тексте «карточка CARD-06» и «единственный несопоставленный перевод». Код проекта без комментариев: в выдержках комментариев нет, в новом коде не писать.

Конфликт, решённый здесь: `19-RESEARCH.md` называет модуль `apps/api/src/students/`, а закреплённое решение D-42 называет `apps/api/src/cards`. Используется `apps/api/src/cards` (D-42 главнее).

## File Classification

### A. Схема и миграция (`packages/db`)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/db/src/schema.ts` (+ `students`, `studentSections`, `studentTerms`, `payments`, `accounts.studentId`) | model | CRUD | тот же файл, `accounts` (стр. 10-40) и `sessions` (42-57) | exact |
| `packages/db/drizzle/<ts>_student_cards/migration.sql` + `snapshot.json` | migration | batch | `packages/db/drizzle/20261009150610_accounts/` | exact (только генерация `yarn db:generate`) |

### B. Хелпер `packages/db` (D-39)

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/db/src/postgres-errors.ts` (новый; `violatesUnique`, `postgresCode`, цепочка `cause`) | utility | transform | `apps/api/src/auth/accounts.ts:42-50` + `bootstrap-teacher.ts:61-69` + `request-context.ts:12-25` | exact (перенос) |
| `packages/db/src/connection.ts` (+ тип `DbExecutor`/`Transaction`) или новый `executor.ts` | utility | — | `apps/api/src/auth/sessions.ts:14-16` | exact (перенос) |
| `packages/db/src/index.ts` | config | — | тот же файл (`export * from './x.ts'`) | exact |
| `apps/api/src/auth/sessions.ts`, `throttle.ts`, `middleware.ts`, `accounts.ts`, `bootstrap-teacher.ts`, `request-context.ts` (переход на импорт из `@dv-lab/db`) | service/utility | request-response | они же | exact |

### C. `packages/contracts`

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/contracts/src/students.ts` (виды секций, валюты, схемы карточки, оплаты, словаря, ответы) | model | request-response | `packages/contracts/src/auth.ts` | exact |
| `packages/contracts/src/identity.ts` (+ экспорт предиката длины имени, D-41) | utility | transform | `packages/contracts/src/auth.ts:20-23` (`isDisplayNameLength`) | exact |
| `packages/contracts/src/auth.ts` (`errorCodes`, удаление `StudentRow`/`StudentListResponse`/`CreateStudentResponse`/`DeactivateStudentResponse`, D-40) | model | request-response | тот же файл | exact |
| `packages/contracts/src/index.ts` | config | — | тот же файл | exact |
| `packages/contracts/test/auth.test.ts` (только правка `errorCodes` 142-156 и блока `createStudentRequest` 37-106 по судьбе экспорта) | test | — | тот же файл | exact |

### D. `packages/core` (новый пакет)

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/core/package.json` | config | — | `packages/contracts/package.json` | exact (без `dependencies`, `test`, `vite`, `vitest`) |
| `packages/core/tsconfig.json` | config | — | `packages/contracts/tsconfig.json` | exact (`include` без `test`, `vitest.config.ts`) |
| `packages/core/src/index.ts` | config | — | `packages/contracts/src/index.ts` | exact |
| `packages/core/src/money.ts`, `lessons.ts`, `balance.ts` | utility | transform | `packages/contracts/src/identity.ts` (чистые функции без побочных эффектов) | role-match |
| `knip.json` (блок `packages/core`) | config | — | `knip.json:29-32` | exact |
| `.github/workflows/ci.yml` (шаг `Web and api boundary`, стр. 72-80) | config | — | те же строки для contracts | exact |
| `AGENTS.md` (стр. 9 и 50) | config | — | строки для contracts | exact |
| `apps/api/package.json:15`, `apps/web/package.json:14` | config | — | строки `@dv-lab/contracts` | exact |

### E. `apps/api`: модуль карточек, маршруты, привязка аккаунта

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `apps/api/src/cards/cards.ts`, `sections.ts`, `terms.ts`, `payments.ts` (запись) | service | CRUD | `apps/api/src/auth/accounts.ts` | role-match |
| `apps/api/src/cards/card-rows.ts` | utility | transform | `apps/api/src/auth/account-rows.ts` | exact |
| `apps/api/src/routes/students.ts` (переписывается под карточки + `/:id/account*`) | route | request-response | тот же файл (стр. 18-44) | exact |
| `apps/api/src/routes/payments.ts` (новый; unassigned, assign, delete) | route | request-response | `apps/api/src/routes/students.ts` | exact |
| `apps/api/src/app.ts:14,67` (монтирование) | config | — | тот же файл | exact |
| `apps/api/src/auth/accounts.ts` (`createStudent` + `studentId`, `linkStudentAccount`, список непривязанных, удаление `listStudents`) | service | CRUD | тот же файл | exact |
| `apps/api/src/auth/account-rows.ts` (`studentRowColumns`/`toStudentRow` → сводка аккаунта карточки) | utility | transform | тот же файл | exact |

### F. `apps/api`: утилита `import-vault`, deploy, RUNBOOK

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `apps/api/src/import-vault.ts` (вход `parse`/`apply`) | utility (CLI) | batch | `apps/api/src/bootstrap-teacher.ts` | exact |
| `apps/api/src/import/parse-vault.ts` | service | file-I/O, transform | нет (см. `bootstrap-teacher.ts:53-59` для stdin, `sessions.ts:25` для `node:crypto`) | partial |
| `apps/api/src/import/packet.ts` (zod-схема пакета) | model | transform | `packages/contracts/src/auth.ts:25-43` | role-match |
| `apps/api/src/import/apply-packet.ts` | service | batch | `apps/api/src/auth/accounts.ts:52-78` (`createTeacher`: транзакция + advisory lock) | role-match |
| `apps/api/tsdown.config.ts` | config | — | тот же файл (стр. 4) | exact |
| `knip.json` (`apps/api.entry`) | config | — | `knip.json:26` | exact |
| `deploy/compose.yaml` (сервис `import`) | config | — | сервисы `migrate` (75-85) и `bootstrap` (87-98) | exact |
| `deploy/RUNBOOK.md` (новый подраздел запуска импорта) | doc | — | `deploy/RUNBOOK.md` 10.3 (стр. 756-776) | exact |
| `.gitignore`, `.dockerignore` (маска пакета) | config | — | эти же файлы | exact |
| `AGENTS.md` (владелец `import-vault`, правило о данных) | doc | — | строки «Модули-владельцы» | exact |

### G. `apps/web`: копия компонентов варианта A, MarkdownView

| File | Role | Data Flow | Closest Analog (для правок при копировании) | Match |
|---|---|---|---|---|
| `components/ui/select.tsx`, `combobox.tsx`, `textarea.tsx`, `popover.tsx`, `calendar.tsx` | component | event-driven | `components/ui/input.tsx` (ремап `text-body`), `eslint.config.mjs` (запрет `cn` из пакета) | role-match |
| `hooks/use-keyboard-nav-gate.ts` | hook | event-driven | `hooks/use-fluid-hover.ts` | role-match |
| `components/app/date-field.tsx` | component | event-driven | `components/app/text-field.tsx` | partial |
| `components/app/markdown-view.tsx` | component | transform | нет (RESEARCH «Render a section» + UI-SPEC DR-1) | no analog |
| `package.json` (`react-markdown` 10.1.0, `remark-gfm` 4.0.1, `react-day-picker` 10.0.1, `@dv-lab/core`) | config | — | `apps/web/package.json:12-26` | exact |
| `app/globals.css` | config | — | сам файл (DR-1 не требует `.typeset`; копировать нечего) | n/a |
| `lib/api-client.ts:6` (union методов) | utility | request-response | тот же файл | exact |

### H. `apps/web`: Students list / profile / dialogs

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `app/(app)/students/_components/students-screen.tsx` (переписывается: список карточек + вкладки) | component | request-response | тот же файл | exact |
| `app/(app)/students/page.tsx` | route | request-response | тот же файл | exact |
| `app/(app)/students/[id]/page.tsx` (первый динамический маршрут) | route | request-response | `app/(app)/students/page.tsx` + `app/(app)/[...missing]/page.tsx` | partial |
| `app/(app)/students/[id]/_components/student-profile.tsx`, `overview-tab.tsx`, `notes-tab.tsx`, `vocabulary-tab.tsx`, `payments-tab.tsx` | component | request-response | `students-screen.tsx` (ReadState, `useCallback`/`useEffect` загрузка, `Elevated` + `Table`) | role-match |
| `.../_components/student-form-dialog.tsx` (создать/править карточку) | component | request-response | `create-student-dialog.tsx` | exact |
| `.../_components/record-payment-dialog.tsx`, `assign-payment-dialog.tsx` | component | request-response | `create-student-dialog.tsx` | role-match |
| `.../_components/term-dialogs.tsx`, `confirm-dialog.tsx` (архив/восстановление/удаление) | component | request-response | `deactivate-student-dialog.tsx` | exact |
| `.../_components/create-account-dialog.tsx` (из `create-student-dialog.tsx`), `link-account-dialog.tsx`, `reveal-body.tsx` (вынесенный `RevealBody`) | component | request-response | `create-student-dialog.tsx:42-106` | exact |
| `deactivate-student-dialog.tsx` (путь `/students/:id/account/deactivate`, id аккаунта) | component | request-response | тот же файл | exact |

### I. Сайдбар, палитра, статус-точка

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `components/app/status-dot.tsx` (вынос из `students-screen.tsx:35-49`) | component | — | `students-screen.tsx:35-49` | exact (перенос) |
| `app/(app)/_components/sections.ts`, `app-sidebar.tsx`, `command-palette.tsx`, `apps/web/proxy.ts`, `lib/session.ts` | — | — | без изменений: путь `/students` и `isSectionActive` (`startsWith('/students/')`) уже покрывают `/students/[id]` | n/a |

## Pattern Assignments

### A. `packages/db/src/schema.ts` (model, CRUD)

**Analog:** `packages/db/src/schema.ts`, таблица `accounts` (10-40).

Импорт сейчас (стр. 1-2) без `date`, `numeric`, `primaryKey`; планировщик дополняет строку 2:

```typescript
import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
```

**Колонки и ограничения** (стр. 13-39): id `uuid('id').defaultRandom().primaryKey()`, время `timestamp('created_at', { withTimezone: true }).defaultNow().notNull()`, перечисления как `text` + `check(...)`, частичный уникальный индекс, FK через стрелку:

```typescript
id: uuid('id').defaultRandom().primaryKey(),
status: text('status').default('active').notNull(),
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
...
uniqueIndex('accounts_active_login_uq')
	.on(table.login)
	.where(sql`${table.status} = 'active'`),
check('accounts_status_ck', sql`${table.status} in ('active', 'deactivated')`),
check('accounts_display_name_ck', sql`char_length(${table.displayName}) between 1 and 80`),
```

**FK** (`sessions`, стр. 46-48):

```typescript
accountId: uuid('account_id')
	.notNull()
	.references(() => accounts.id, { onDelete: 'restrict' }),
```

**Индекс по колонке** (стр. 54): `index('sessions_account_idx').on(table.accountId)`.

**Что применить:** код колонок `students`, `student_sections` (составной `primaryKey({ columns })`), `student_terms` (уникальный индекс с `sql\`lower(${t.term})\``), `payments` и `accounts.student_id` с индексом `accounts_student_uq` (предикат `student_id is not null and status = 'active'`, D-33) и CHECK `accounts_student_role_ck` берётся из `19-RESEARCH.md` Pattern 1 и 2 (там готовые блоки) с поправками: `payments.currency` по D-29 (CHECK `currency is not null or (lessons_count is null and credited_minutes = 0)`), `opening_balance_minutes >= 0` по D-36. Новый CHECK имени карточки использует ту же форму `char_length(...) between 1 and 80` (D-41).

**Миграция:** только `yarn db:generate`; образцом формы является каталог `packages/db/drizzle/20261009150610_accounts/` (`migration.sql` + `snapshot.json`). Шаг CI `Migrations are in sync with the schema` (`ci.yml:121-129`) падает при расхождении; руками файлы не править. Миграция только добавляет (AGENTS.md «База»).

### B. `packages/db`: тип «база или транзакция» и разбор нарушений (D-39)

Источники переноса (все трекаемые):

**Тип** (`apps/api/src/auth/sessions.ts:14-16`):

```typescript
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export type DbExecutor = Database | Transaction
```

**Нарушение уникальности** (`apps/api/src/auth/accounts.ts:42-50`):

```typescript
export function violatesUnique(error: unknown, constraint: string): boolean {
	let current: unknown = error
	for (let depth = 0; depth < CAUSE_DEPTH && current instanceof Error; depth += 1) {
		const candidate = current as Error & { code?: unknown; constraint?: unknown }
		if (candidate.code === '23505' && candidate.constraint === constraint) return true
		current = candidate.cause
	}
	return false
}
```

**Код ошибки без данных** (`apps/api/src/bootstrap-teacher.ts:61-69`):

```typescript
function postgresCode(error: unknown): string | null {
	let current: unknown = error
	for (let depth = 0; depth < CAUSE_DEPTH && current instanceof Error; depth += 1) {
		const code = (current as Error & { code?: unknown }).code
		if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code
		current = current.cause
	}
	return null
}
```

**Копия обхода `cause` в логгере** (`apps/api/src/request-context.ts:12-25`, `serializeError`): читает `err.cause` один раз; после переноса использует общий разбор из `@dv-lab/db`, а форма вывода (`type`, `message: 'Failed query'`, `code`, `constraint`) остаётся.

**Экспорт:** новый файл подключается строкой `export * from './x.ts'` в `packages/db/src/index.ts` (стиль строк 1-3). `packages/db/test/roles.test.ts:12-16` (`pgCode`) — пятая копия; перечень переноса в `19-ARCH-REVIEW.md` её не содержит, а D-38 запрещает трогать тесты, поэтому она остаётся.

Потребители, которые после переноса импортируют из `@dv-lab/db`: `auth/throttle.ts:8`, `auth/middleware.ts:11` (сейчас берут `DbExecutor` из `sessions.ts`), `cards/*`, `import/*`.

### C. `packages/contracts`

**Analog:** `packages/contracts/src/auth.ts`.

**Схема запроса** (стр. 30-38, нормализация + refine):

```typescript
export const createStudentRequest = z.object({
	login: z.string().transform(normalizeLogin).refine(isStudentLogin),
	displayName: z.string().transform(normalizeDisplayName).refine(isDisplayNameLength),
	password: z
		.string()
		.nullish()
		.transform((password) => (password === undefined || password === null || password === '' ? null : password))
		.refine((password) => password === null || isManualPasswordLength(password)),
})
```

**Предикат длины имени** (стр. 20-23, сейчас не экспортирован; D-41 требует экспорта, переносить в `identity.ts` рядом с `normalizeDisplayName`):

```typescript
const isDisplayNameLength = (name: string) => {
	const length = Array.from(name).length
	return length >= 1 && length <= DISPLAY_NAME_MAX_LENGTH
}
```

Потребители предиката (убирает три копии): `bootstrap-teacher.ts:45-46`, `create-student-dialog.tsx:112-115`, схема имени карточки, пакет импорта (`import/packet.ts`).

**Коды ошибок** (стр. 45-61): `errorBody` в `request-context.ts:67` типизирован `ErrorCode`, поэтому неизвестный код не скомпилируется. Добавить `card_has_account`, `account_already_linked`, `term_exists`, `payment_already_assigned` (имена вне названных в D-04 — на усмотрение; `card_archived` не нужен: оплата на архивной карточке разрешена по UI-SPEC).

**Обязательная правка существующего теста:** `packages/contracts/test/auth.test.ts:141-157` проверяет точный список `errorCodes`; список обновляется вместе с контрактом. Блок `createStudentRequest` (37-106) либо остаётся вместе с экспортом (схема аккаунта карточки выводится как `createStudentRequest.omit({ displayName: true })`), либо удаляется вместе с экспортом.

**Типы ответов** (стр. 77-89: `StudentRow`, `StudentListResponse`, `CreateStudentResponse`, `DeactivateStudentResponse`) — удаляются или переписываются как типы карточки и сводки аккаунта в `students.ts` (D-40).

**Границы пакета** (проверяет CI): только `zod`, нет `pg`, `node:*`, `@dv-lab/*`, `process.env`. Относительные импорты с `.ts` (как `./identity.ts` в `auth.ts:3-13`). `index.ts` добавляет строку `export * from './students.ts'` в стиле строк 1-3.

### D. `packages/core` (новый пакет, близнец `packages/contracts`)

**Файлы, которые называют `packages/contracts` и потому имеют близнеца или правку для `packages/core`:**

| Файл | Строки | Что сделать |
|---|---|---|
| `packages/contracts/package.json` | 1-20 | `packages/core/package.json`: имя `@dv-lab/core`, те же `private`, `type: module`, `exports: { ".": "./src/index.ts" }`, скрипт `typecheck`, `devDependencies: { typescript: "6.0.3" }`; без `dependencies` и без `test`, `vite`, `vitest` |
| `packages/contracts/tsconfig.json` | 1-7 | `extends ../../tsconfig.base.json`, `lib: ["ES2023"]` (если `tsc` не знает `trailingZeroDisplay` — `esnext`, A2 в RESEARCH), `types: []`, `include: ["src"]` |
| `packages/contracts/src/index.ts` | 1-3 | `export * from './money.ts'` и т.д. |
| `knip.json` | 29-32 | блок `"packages/core": { "entry": ["src/index.ts"], "project": ["src/**/*.ts"] }` |
| `.github/workflows/ci.yml` | 72-80 | три проверки в шаге `Web and api boundary`: ноль зависимостей (вместо «только zod»), нет импортов `pg`, `node:*`, `@dv-lab/*` в `packages/core/src`, нет `process.env` |
| `AGENTS.md` | 9, 50 | строка структуры и строка границ для core |
| `apps/api/package.json` | 15 | `"@dv-lab/core": "workspace:*"` |
| `apps/web/package.json` | 14 | `"@dv-lab/core": "workspace:*"` |
| `yarn.lock` | 275-300, 326 | не правится руками; обновляется `yarn install` (в worktree нет `node_modules`, первый план начинает с него) |

**Не близнецы (проверено, искать не нужно):** оба Dockerfile (`turbo prune ... --docker` сам берёт зависимости рабочих областей; `tsconfig.base.json` копируется явно), `turbo.json` (задачи общие), `.prettierignore`, `README.md`, `apps/web/next.config.ts` (`transpilePackages` запрещён CI), `apps/api/tsdown.config.ts:11` (`alwaysBundle: [/^@dv-lab\//]` уже покрывает core). `AGENTS.md:24` (список `yarn test`) — не близнец: у core нет тестов и скрипта `test`.

**Функции:** аналога нет, готовые сигнатуры в `19-RESEARCH.md` Pattern 3 (целые сотые доли, `Intl`, строки только на границе). Стиль чистых функций без побочных эффектов — `packages/contracts/src/identity.ts:9-29`:

```typescript
export function normalizeDisplayName(name: string): string {
	return name.trim().replace(/\s+/g, ' ')
}

export function passwordLength(password: string): number {
	return Array.from(password).length
}
```

Правила: `.ts` в относительных импортах, без `enum` и `namespace` (`erasableSyntaxOnly` в `tsconfig.base.json`), без `process.env` и `node:*`.

### E. `apps/api/src/cards`, маршруты, привязка аккаунта

**Analog (сервис):** `apps/api/src/auth/accounts.ts`.

**Импорты** (стр. 1-10):

```typescript
import { and, desc, eq, sql } from 'drizzle-orm'

import type { AccountSummary, StudentRow } from '@dv-lab/contracts'
import { accounts } from '@dv-lab/db'
import type { Database } from '@dv-lab/db'
```

**Дискриминированный результат** (стр. 18-25): `type CreateStudentResult = { kind: 'created'; ... } | { kind: 'login_taken' }`; маршрут ветвится по `outcome.kind`.

**Условная операция в транзакции с блокировкой строки** (`deactivateStudent`, стр. 106-123):

```typescript
return db.transaction(async (tx): Promise<DeactivateStudentResult> => {
	const [locked] = await tx
		.select({ id: accounts.id })
		.from(accounts)
		.where(and(eq(accounts.id, studentId), eq(accounts.role, 'student'), eq(accounts.status, 'active')))
		.for('update')
	if (!locked) return { kind: 'not_found' }
	const [row] = await tx
		.update(accounts)
		.set({ status: 'deactivated', updatedAt: sql`now()` })
		.where(eq(accounts.id, locked.id))
		.returning(studentRowColumns)
	if (!row) throw new Error('student update returned no row')
	await revokeAccountSessions(tx, locked.id)
	return { kind: 'deactivated', student: toStudentRow(row) }
})
```

Для привязки аккаунта (D-04) тот же приём: условный `UPDATE ... WHERE id = $acc AND role = 'student' AND status = 'active' AND student_id IS NULL RETURNING id`; ноль строк → перечитать и выбрать `account_already_linked` либо `not_found` (готовый блок в `19-RESEARCH.md` «Conditional link»).

**Создание аккаунта из карточки:** расширяет `createStudent` (стр. 80-95): вставка с `studentId`, обработка `violatesUnique(error, ACTIVE_LOGIN_CONSTRAINT)` (стр. 92) и добавленная ветка `accounts_student_uq` → `card_has_account`:

```typescript
try {
	const [row] = await db
		.insert(accounts)
		.values({ login: input.login, displayName: input.displayName, role: 'student', passwordHash })
		.returning(studentRowColumns)
	if (!row) throw new Error('student insert returned no row')
	return { kind: 'created', student: toStudentRow(row), generatedPassword }
} catch (error) {
	if (violatesUnique(error, ACTIVE_LOGIN_CONSTRAINT)) return { kind: 'login_taken' }
	throw error
}
```

Имя аккаунта берётся из карточки (D-04, длина по общему предикату D-41). `accounts.ts` остаётся единственным владельцем создания и деактивации аккаунтов (D-05); модуль карточек вызывает его функции, а не пишет в `accounts` сам.

**Analog (строки → ответ):** `apps/api/src/auth/account-rows.ts`:

```typescript
export const studentRowColumns = {
	id: accounts.id,
	login: accounts.login,
	displayName: accounts.displayName,
	status: accounts.status,
	createdAt: accounts.createdAt,
}

function toStatus(value: string): AccountStatus {
	if (value === 'active' || value === 'deactivated') return value
	throw new Error('unexpected account status')
}

export function toStudentRow(row: Pick<AccountRecord, 'id' | 'login' | 'displayName' | 'status' | 'createdAt'>): StudentRow {
	return { id: row.id, login: row.login, displayName: row.displayName, status: toStatus(row.status), createdAt: row.createdAt.toISOString() }
}
```

`card-rows.ts` повторяет форму: объект колонок для `select`, `toX(status)` с исключением на неизвестное значение, `Date` → `toISOString()`, дату `paid_on` оставлять строкой `YYYY-MM-DD`.

**Analog (маршруты):** `apps/api/src/routes/students.ts` (стр. 1-44).

**Цепочка доступа teacher-only** (стр. 18-20, D-27):

```typescript
export function studentRoutes({ db }: StudentRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))
```

**Разбор входа и id** (стр. 22-24, 35-38):

```typescript
const input = await readJson(c, createStudentRequest)
if (!input) return c.json(errorBody('invalid_request', 'Invalid request'), 400)
...
const id = z.uuid().safeParse(c.req.param('id'))
if (!id.success) return c.json(errorBody('not_found', 'Not Found'), 404)
```

**Ответ с типом контракта и 409** (стр. 26-30, 40):

```typescript
if (outcome.kind === 'login_taken') {
	return c.json(errorBody('login_taken', 'This login is already taken'), 409)
}
return c.json({ student, generatedPassword } satisfies CreateStudentResponse, 201)
```

**Монтирование** (`apps/api/src/app.ts:14,67`): `import { studentRoutes } from './routes/students.ts'` и `app.route('/students', studentRoutes({ db: deps.db }))`; рядом добавить `app.route('/payments', paymentRoutes({ db: deps.db }))`. Префикс `/api` в маршрутах не пишется (срезает Caddy). Все новые изменяющие методы (PUT, PATCH, DELETE) уже закрывает `sameOrigin` (`middleware.ts:27-41`, `SAFE_METHODS`).

**Белый список импортов модуля `cards/` (D-42, ARCH-REVIEW):** из `auth/` только `middleware.ts` (`requireSession`, `requireRole`, `readJson`, `noStore`, `AppEnv`) и `accounts.ts`; нельзя `sessions.ts`, `throttle.ts`, `sign-in.ts`. Тип `DbExecutor` и разбор ошибок берутся из `@dv-lab/db` (раздел B). Отбор оплат в остаток делает только модуль карточек; `packages/core` только считает (`balanceMinutes`), в SQL баланс не суммируется (Pitfall 4).

**Идемпотентная вставка с подсчётом** (`19-RESEARCH.md` «Target-less idempotent insert with counts») — образец для `apply-packet.ts`, а запись карточки и оплаты в нём идёт через функции `cards/*`, а не отдельными запросами (ARCH-REVIEW решение 5).

**Тесты/проверка:** новых тестов нет (D-38); существующие `apps/api/test/*.test.ts` остаются зелёными.

### F. `apps/api/src/import-vault.ts` и deploy

**Analog:** `apps/api/src/bootstrap-teacher.ts` (136 строк).

**Импорты и аргументы** (стр. 1-16, 30-51):

```typescript
import { parseArgs } from 'node:util'
...
import { createDb, resolveDatabaseUrl } from '@dv-lab/db'
import type { Database } from '@dv-lab/db'
```

```typescript
const { values } = parseArgs({
	args: argv,
	options: { email: { type: 'string' }, name: { type: 'string' }, 'password-stdin': { type: 'boolean' }, 'reset-password': { type: 'boolean' } },
})
```

Для `import-vault` вместо опций используется позиционная команда (`parse <dir>` / `apply`); `parseArgs` с `allowPositionals: true`.

**Чтение stdin** (стр. 53-59):

```typescript
async function readStdin(): Promise<string> {
	const chunks: Buffer[] = []
	for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
	return Buffer.concat(chunks)
		.toString('utf8')
		.replace(/\r?\n$/, '')
}
```

**Коды выхода и обработка ошибки без данных** (стр. 18-24, 97-134): `USAGE`, `USAGE_EXIT_CODE = 2`, `REFUSED_EXIT_CODE = 3`; `createDb(resolveDatabaseUrl('app', process.env))` только в `apply` (в `parse` базы нет); `finally { await pool?.end() }`; в stderr только `Bootstrap failed (${code})` через `postgresCode` (после переноса — из `@dv-lab/db`), без текста запросов и данных:

```typescript
let pool: ReturnType<typeof createDb>['pool'] | null = null
try {
	const connection = createDb(resolveDatabaseUrl('app', process.env))
	pool = connection.pool
	...
} catch (error) {
	const code = postgresCode(error)
	process.stderr.write(code ? `Bootstrap failed (${code})\n` : 'Bootstrap failed\n')
	return 1
} finally {
	await pool?.end()
}
```

Файл завершается `process.exitCode = await main()` (стр. 136): top-level await, без `process.exit`.

**Транзакция с advisory lock** (`accounts.ts:54-55`): `db.transaction(async (tx) => { await tx.execute(sql\`select pg_advisory_xact_lock(hashtext('dvlab_bootstrap_teacher'))\`) ...`; для импорта свой ключ (`'dvlab_import_vault'`).

**Хэш sha256** (`sessions.ts:2,24-26`): `import { createHash } from 'node:crypto'` и `createHash('sha256').update(token).digest('hex')`; ключ оплаты по D-15 считается в `parse` (в core нет Node API).

**Вывод:** `apply` печатает только счётчики по таблицам («вставлено / пропущено»), без имён и сумм; `parse` пишет пакет в stdout и сводку со счётчиками в stderr (D-20). Пакет проверяется zod-схемой (`import/packet.ts`) с предикатом длины имени из контракта (D-41).

**tsdown** (`apps/api/tsdown.config.ts:4`):

```typescript
entry: { migrate: 'src/migrate.ts', server: 'src/server.ts', 'bootstrap-teacher': 'src/bootstrap-teacher.ts' },
```

добавить `'import-vault': 'src/import-vault.ts'` (получится `dist/import-vault.mjs`). **knip** (`knip.json:26`): добавить `"src/import-vault.ts"` в `entry`.

**Compose** (`deploy/compose.yaml:75-98`). Для `apply` без аргументов подходит форма `migrate` (`command:`), а `bootstrap` берёт аргументы через `entrypoint:`:

```yaml
  migrate:
    image: ghcr.io/kdvornichenko/dv-lab-api:${APP_TAG:?}
    profiles: ['tools']
    restart: 'no'
    logging: *logging
    command: ['node', 'apps/api/dist/migrate.mjs']
```

```yaml
  bootstrap:
    image: ghcr.io/kdvornichenko/dv-lab-api:${APP_TAG:?}
    profiles: ['tools']
    restart: 'no'
    logging: *logging
    entrypoint: ['node', 'apps/api/dist/bootstrap-teacher.mjs']
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://dvlab_app:${APP_PASSWORD:?}@db:5432/dvlab
    depends_on:
      db:
        condition: service_healthy
```

Сервис `import`: окружение и `depends_on` как у `bootstrap`, `command: ['node', 'apps/api/dist/import-vault.mjs', 'apply']`. Шаг CI `Client address trust` (`ci.yml:82-99`) читает compose awk-ом: сервис `import` не должен иметь `ports`, секцию `networks` не менять.

**RUNBOOK** (форма раздела 10.3, `deploy/RUNBOOK.md:756-776`): блок в подоболочке `( set -Eeuo pipefail ... )`, проверка `SHA` (`case "${SHA:?}" in *[^0-9a-f]*) ...; [ "${#SHA}" -eq 40 ]`), `APP_TAG="sha-${SHA:?}"`, функция `dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }`, запуск `dc --profile tools run --rm -T import < "$PACKET"` (форма `run --rm -T` уже есть в `RUNBOOK.md:322`: `dc --profile tools run --rm -T migrate`), затем проверка «контейнера не осталось»:

```bash
LEFT=$(sudo docker ps -a -q --filter label=com.docker.compose.project=dv-lab --filter label=com.docker.compose.service=bootstrap)
[ -z "$LEFT" ]
echo NO_BOOTSTRAP_CONTAINER
```

(для нового сервиса `service=import` и маркер `NO_IMPORT_CONTAINER`). Назад присылаются только маркеры и счётчики, без имён. Раздел с разбором кодов выхода, как в абзаце после блока 10.3. Номер подраздела выбирает планировщик (после 10.5, например 10.6; шапка раздела 10 на стр. 664 перечисляет порядок).

**Маски** (`.gitignore` — после блока `# misc`; `.dockerignore` — список из 19 строк): добавить строку вида `*.vault-import.json` в оба файла (по D-28). В AGENTS.md в «Модули-владельцы» дописать владельца `import-vault` и правило о данных.

### G. `apps/web`: копия варианта A, зависимости, `MarkdownView`

**Copy sources (external, vetted in 19-UI-SPEC Registry Safety; не аналоги):** в репозитории vault, дерево design-lab: `src/components/ui/select.tsx`, `src/components/ui/combobox.tsx`, `src/hooks/use-keyboard-nav-gate.ts`, `src/components/lab/a/ui/textarea.tsx`, `popover.tsx`, `calendar.tsx`, `src/app/lab/a/_components/date-field.tsx`; экраны-образцы только для чтения: `payment-dialog.tsx`, `student-view.tsx`, `students-view.tsx`, `src/app/lab/_components/note-markdown.tsx`. Все файлы существуют (проверено `ls`). Замыкание импортов `select.tsx` и `combobox.tsx` (`@/lib/popup`, `size-context`, `shape-context`, `springs`, `icon-context`, `elevated`, `hooks/use-fluid-hover`, `use-merge-split`, `components/ui/scroll-area`, `fluid-hover-highlight`) уже есть в `apps/web`; отсутствует только `hooks/use-keyboard-nav-gate.ts`.

**Правки при копировании (шаблон — уже скопированные файлы в этом репозитории):**

- `import { cn } from "cn"` запрещён правилом (`apps/web/eslint.config.mjs`, `no-restricted-imports`: `{ name: 'cn', message: 'Import cn from @/lib/utils.' }`); заменить на `import { cn } from '@/lib/utils'`.
- Ремап размеров текста, как в `apps/web/components/ui/input.tsx` (класс `text-body` вместо `text-sm`/`text-xs/relaxed`); `textarea.tsx` — по списку в UI-SPEC.
- Кавычки одинарные, без точки с запятой, табуляции, порядок импортов по `.prettierrc.json` (`importOrder`: `^react`, `^[a-z]`, `^@/`, `^@dv-lab/`, `^[./]`).
- `calendar.tsx`/`date-field.tsx` не копируют второй `Button`: берут `@/components/ui/button` (`export { Button, buttonVariants }`, `button.tsx:239`), `variant="outline"` → `variant="tertiary"`; локаль `ru` → `enUS`.
- Файлы `components/ui/**` и `hooks/**` knip не проверяет (`knip.json:6-23`); новые файлы в `lib/` потребуют записи в `ignore` и правки строки «двенадцать файлов `lib`» в AGENTS.md; `components/app/date-field.tsx` и `status-dot.tsx` knip проверяет, поэтому они должны использоваться.
- После копирования: `grep -rn "@radix-ui\|radix-ui\|cmdk" apps/web --include=*.tsx --include=package.json` — пусто.

**`apps/web/package.json`** (формат зависимостей, строки 12-26): версии точные, по алфавиту: `"@dv-lab/core": "workspace:*"`, `"react-day-picker": "10.0.1"`, `"react-markdown": "10.1.0"`, `"remark-gfm": "4.0.1"` (D-37).

**`apps/web/lib/api-client.ts:6`** (расширить тип метода):

```typescript
export async function apiRequest<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiResult<T>> {
```

→ `'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'`; остальной код (статус 204, разбор `ErrorResponse`) не меняется. Это единственный клиент web к api (AGENTS.md).

**`MarkdownView`:** аналога нет. Источники: блок «Render a section» в `19-RESEARCH.md` (react-markdown, `remarkPlugins={[remarkGfm]}`, `skipHtml`, обёртка в `div`, т.к. v10 убрал `className`) и карта классов DR-1 в `19-UI-SPEC.md` (`components` для `h1..h6`, `ul`, `ol`, `a`, `code`, `pre`, `blockquote`, `table`, `hr`, `img`). Пустая секция показывает «Nothing here yet» внутри того же `Panel`. Классы `.typeset` из design-lab не копируются (D-37).

### H. `apps/web`: список, профиль, диалоги

**Analog (страница):** `apps/web/app/(app)/students/page.tsx`:

```tsx
import type { Metadata } from 'next'

import { requireTeacherPage } from '@/lib/session'

import { StudentsScreen } from './_components/students-screen'

export const metadata: Metadata = { title: 'Students' }

export default async function StudentsPage() {
	await requireTeacherPage()
	return <StudentsScreen />
}
```

Для `app/(app)/students/[id]/page.tsx`: тот же порядок (сначала `requireTeacherPage()`), `params` как `Promise` (`const { id } = await params`, Pitfall 13), при невалидном uuid `notFound()` из `next/navigation` (форма — `app/(app)/[...missing]/page.tsx`: `await requireTeacherPage(); notFound()`). Готового динамического маршрута в репозитории нет (см. «No Analog Found»).

**Analog (экран списка):** `students-screen.tsx`.

**Состояние чтения и загрузка** (стр. 26-33, 112-130):

```tsx
type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; students: StudentRow[] }

async function readStudents(): Promise<ReadState> {
	const result = await apiRequest<StudentListResponse>('GET', '/students')
	return result.ok ? { kind: 'ready', students: result.data.students } : { kind: 'error' }
}
```

```tsx
const load = useCallback(async () => {
	setState(await readStudents())
}, [])

useEffect(() => {
	let current = true
	void readStudents().then((next) => {
		if (current) setState(next)
	})
	return () => {
		current = false
	}
}, [])
```

**Ошибка чтения целого экрана** (стр. 140-143): `header = <PageHeader title="Students" />`, `body = <ReadError screen="students" onRefresh={load} />`; `ReadError` (`components/app/read-error.tsx:10`) сам рисует «Could not load {screen}» и кнопку Refresh.

**Вкладки + заголовок + скелеты** (стр. 147-173):

```tsx
<PageHeader
	title="Students"
	description={loading ? <SkeletonText className="w-48 py-0.5" /> : `${active.length} active, ${deactivated.length} deactivated`}
	actions={createButton}
/>
...
<Tabs defaultValue="active">
	<TabsList aria-label="Account status">
		<TabItem value="active" label="Active" />
		<TabItem value="deactivated" label="Deactivated" />
	</TabsList>
	<TabPanel value="active" className="mt-4">
		{loading ? <SkeletonTable /> : <StudentsTable rows={active} onDeactivate={setDeactivating} />}
	</TabPanel>
```

В фазе 19: вкладки Active · Archived · Unassigned payments (aria-label «Student lists»), описание «{n} active, {m} archived» (тексты — `19-UI-SPEC.md`, «Copywriting Contract»).

**Таблица в рамке** (стр. 51-76, 85-87):

```tsx
const headClass = 'px-4 text-body font-normal text-muted-foreground'
...
if (rows.length === 0) return <EmptyLine />
return (
	<Elevated offset={1} shadowLevel={2} className="w-0 min-w-full overflow-hidden rounded-2xl">
		<Table className="text-body">
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead className={headClass}>Student</TableHead>
```

Ячейка студента: `Avatar` + усечённое имя (`flex max-w-64 min-w-0 items-center gap-2`, `min-w-0 truncate text-body`, архивные `text-muted-foreground`, стр. 74-83). Число — `tabular-nums` (стр. 88). Строка списка становится ссылкой/переходом на `/students/{id}` (UI-SPEC: настоящая `Link` на имени).

**Уведомления:** `const toast = useToast()` из `../../_components/toasts` и `toast.show({ title, description })` (стр. 113, 186-190; контракт `toasts.tsx:24-28`). Мутации после успеха перезапрашивают данные (`void load()`), оптимистичных обновлений нет.

**Профиль:** `PageScroll` > кнопка «Students» (`Button variant="ghost" size="compact"`, `leadingIcon`, ссылка) > `PageHeader`; `Panel` из `components/app/layout-parts.tsx:43-62` (`title`, `description`, `action`, `children`); загрузка — `SkeletonProfileHeader` (`skeleton.tsx`); `Tabs` управляемые (`value`/`onValueChange`, `tabs.tsx:49-58`).

**Analog (диалог формы):** `create-student-dialog.tsx`.

**Состояния и валидация** (стр. 108-126, 128-144):

```tsx
type Field = 'name' | 'login' | 'password'

function validate(displayName: string, login: string, password: string): Partial<Record<Field, string>> {
	const errors: Partial<Record<Field, string>> = {}
	const name = normalizeDisplayName(displayName)
	if (name === '') errors.name = "Enter the student's name."
	else if (passwordLength(name) > DISPLAY_NAME_MAX_LENGTH)
		errors.name = `Use ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`
```

```tsx
const [touched, setTouched] = useState<Record<Field, boolean>>({ name: false, login: false, password: false })
const [submitted, setSubmitted] = useState(false)
const [failed, setFailed] = useState(false)
const [pending, setPending] = useState(false)
const errors = validate(displayName, login, password)
const shown = (field: Field) => (submitted || touched[field] ? errors[field] : undefined)
```

**Отправка** (стр. 146-175): `event.preventDefault()`, `if (pending) return`, фокус на первое неверное поле через `ref`, `setPending(true)`, `apiRequest<...>('POST', '/students', {...})`, разбор `result.error?.code === 'login_taken'` для 409, иначе `setFailed(true)`.

**Каркас** (стр. 178-192, 244-251): `<Dialog open onOpenChange={...}>`, `<DialogContent size="lg" showCloseButton={!revealed}>`, `<form noValidate onSubmit={onSubmit}>`, `DialogHeader/Title/Description`, поля `TextField` (`id`, `name`, `label`, `helper`, `error`, `disabled={pending}`), `Banner status="error"` для отказа, футер:

```tsx
<DialogFooter>
	<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
		Discard changes
	</Button>
	<Button type="submit" loading={pending}>
		{pending ? 'Creating…' : 'Create account'}
	</Button>
</DialogFooter>
```

**Одноразовый показ пароля** (`RevealBody`, стр. 42-106): выносится в общий файл `reveal-body.tsx` (UI-SPEC «Supersession»); `onOpenChange` не закрывает диалог, пока пароль показан (`if (!open && !revealed) onClose()`), `showCloseButton={!revealed}`, пароль очищается `setPassword('')` до перехода в reveal-состояние.

`CreateStudentDialog` превращается в «создать аккаунт из карточки»: убрать поле Name и `displayName` из запроса, `apiRequest('POST', \`/students/${id}/account\`, { login, password })`, 409 `card_has_account` → баннер «This card already has an account.».

**Analog (подтверждения: архив, восстановление, удаление оплаты, удаление термина):** `deactivate-student-dialog.tsx` (стр. 25-79).

```tsx
const [pending, setPending] = useState(false)
const [failed, setFailed] = useState(false)

async function deactivate() {
	if (pending) return
	setFailed(false)
	setPending(true)
	const result = await apiRequest<DeactivateStudentResponse>('POST', `/students/${student.id}/deactivate`)
	setPending(false)
	if (!result.ok) {
		setFailed(true)
		return
	}
	onDeactivated(result.data.student)
}
```

```tsx
<DialogContent size="sm">
	...
	<DialogFooter>
		<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
			Keep account
		</Button>
		<Button type="button" variant="tertiary" className="text-destructive" loading={pending} onClick={() => void deactivate()}>
			{pending ? 'Deactivating…' : 'Deactivate account'}
		</Button>
	</DialogFooter>
</DialogContent>
```

Этот файл остаётся для деактивации аккаунта; путь меняется на `/students/${cardId}/account/deactivate`, тип ответа — из нового контракта (D-40, id аккаунта идёт под путём аккаунта карточки). Остальные подтверждения копируют его форму; «Archive» использует `variant="primary"` (по UI-SPEC), удаления — деструктивную тертичную кнопку как здесь.

### I. Статус-точка, сайдбар, палитра

**Статус-точка** (`students-screen.tsx:35-49`) переносится в `components/app/status-dot.tsx` и принимает общий тип статуса:

```tsx
function StatusDot({ status }: { status: AccountStatus }) {
	const label = status === 'active' ? 'Active' : 'Deactivated'
	return (
		<Tooltip content={label}>
			<span
				role="img"
				aria-label={label}
				className={cn(
					"relative inline-block size-2 rounded-full before:absolute before:-inset-2 before:content-['']",
					status === 'active' ? 'bg-success' : 'bg-muted-foreground'
				)}
			/>
		</Tooltip>
	)
}
```

Для карточки подпись «Active»/«Archived», для аккаунта «Active»/«Deactivated»; узкая типизация: `label` передаётся из вызывающего кода или статус — объединение `'active' | 'archived' | 'deactivated'`.

**Сайдбар и палитра без изменений:** `sections.ts:14` (`href: '/students'`) и `isSectionActive` (`pathname.startsWith(\`${section.href}/\`)`, стр. 18-21) уже подсвечивают раздел на `/students/[id]`; `app-sidebar.tsx` и `command-palette.tsx` берут пункты из `sections`. `proxy.ts` и `lib/session.ts` (`requireTeacherPage`, стр. 22-27) переиспользуются как есть.

## Shared Patterns

### Teacher-only доступ (D-27)
**Source:** `apps/api/src/routes/students.ts:20`, `apps/api/src/auth/middleware.ts:74-89`
**Apply to:** все новые маршруты (`routes/students.ts`, `routes/payments.ts`)
```typescript
routes.use('*', noStore, requireSession(db), requireRole('teacher'))
```

### Конверт ошибки и 409
**Source:** `apps/api/src/request-context.ts:67-69`, `apps/api/src/routes/students.ts:24,27`
**Apply to:** все маршруты и сервисы карточек
```typescript
export const errorBody = (code: ErrorCode, message: string, extra?: { retryAfterSeconds?: number }) => ({
	error: { code, message, requestId: currentRequestId(), ...extra },
})
```
Использование: `c.json(errorBody('invalid_request', 'Invalid request'), 400)`; 404 для невалидного uuid; 409 с кодами `card_has_account`, `account_already_linked`, `term_exists`, `payment_already_assigned`. 500 формирует `app.onError` (`app.ts:68-74`).

### Валидация входа
**Source:** `apps/api/src/auth/middleware.ts:91-102` (`readJson`)
**Apply to:** каждый POST/PUT/PATCH; схемы только из `@dv-lab/contracts`, `z.uuid()` для параметров.
```typescript
export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T> | null> {
	const contentType = c.req.header('content-type') ?? ''
	if (!contentType.toLowerCase().startsWith('application/json')) return null
```

### Гонки без блокировок
**Source:** `apps/api/src/auth/accounts.ts:42-50,74-77,91-94`; `packages/db/src/schema.ts:24-29`
**Apply to:** привязка аккаунта, создание аккаунта из карточки, назначение оплаты, добавление термина
Правило: ограничение в базе (уникальный индекс, CHECK) + перехват 23505 через `violatesUnique(error, '<имя индекса>')` из `@dv-lab/db` и условный `UPDATE ... RETURNING`; в коде без `SELECT`-потом-`UPDATE`.

### Транзакции
**Source:** `apps/api/src/auth/accounts.ts:54-73,106-123`
**Apply to:** запись оплаты (чтение карточки `FOR SHARE`/`FOR UPDATE` и запись в одной транзакции), `apply` импорта (одна транзакция + advisory lock)

### Роли Postgres и URL базы
**Source:** `packages/db/src/connection.ts:11-26`, `deploy/postgres/ensure-db.sql` (default privileges)
**Apply to:** `import-vault apply` и все запросы
`resolveDatabaseUrl('app', process.env)` единственный читатель URL; приложение работает под `dvlab_app` (SELECT/INSERT/UPDATE/DELETE на таблицы, созданные `dvlab_migrator`; TRUNCATE нет). `createDb(url)` возвращает `{ pool, db }`, `Database` — тип.

### Web: клиентские запросы
**Source:** `apps/web/lib/api-client.ts:6-33`
**Apply to:** все экраны и диалоги; путь без префикса `/api`.
```tsx
const result = await apiRequest<T>('POST', '/students', { ... })
if (!result.ok) { /* result.error?.code */ }
```

### Web: правила экранов
**Source:** `students-screen.tsx`, `components/app/read-error.tsx`, `components/app/empty-line.tsx`, `app/(app)/_components/toasts.tsx`
**Apply to:** все экраны фазы
Ошибка чтения экрана = один `ReadError` с Refresh; пустое состояние `EmptyLine`; скелеты `SkeletonTable`/`SkeletonText`/`SkeletonProfileHeader`; уведомления `useToast().show({ title, description })`; кнопка отправки `loading={pending}`, значения в форме сохраняются при отказе; весь текст интерфейса на английском.

### Данные учеников и репозиторий
**Source:** AGENTS.md «Публичный репозиторий», `19-CONTEXT.md` D-28
**Apply to:** `import-vault`, RUNBOOK, `.gitignore`, `.dockerignore`, планы
Пакет импорта вне репозитория, маска `*.vault-import.json` в обоих ignore-файлах; `apply` печатает только счётчики; в `.planning/`, коде, тестовых данных, логах и образах нет имён, сумм и заметок.

### Версии и стиль кода
**Source:** `.prettierrc.json`, `tsconfig.base.json`, `package.json` проекта
**Apply to:** все новые файлы
Табуляции, одинарные кавычки, без точек с запятой, ширина 120; относительные импорты с `.ts` в api/db/contracts/core; `erasableSyntaxOnly` (без `enum`, `namespace`); версии зависимостей точные; комментариев в коде нет.

## No Analog Found

| File | Role | Data Flow | Reason / что использовать |
|---|---|---|---|
| `packages/core/src/money.ts`, `lessons.ts`, `balance.ts` | utility | transform | Арифметики денег и уроков в репозитории нет; сигнатуры и правила — `19-RESEARCH.md` Pattern 3, Pitfalls 1, 2, 7, 8 |
| `apps/api/src/import/parse-vault.ts` | service | file-I/O, transform | Разбора файлов в репозитории нет; правила парсера — `19-RESEARCH.md` Pattern 6 и Shape Catalogue (D-30, D-31, D-32); stdin/`node:crypto` берутся из `bootstrap-teacher.ts` и `sessions.ts` |
| `apps/web/components/app/markdown-view.tsx` | component | transform | Markdown в web ещё нет; «Render a section» в RESEARCH + карта DR-1 в UI-SPEC |
| `apps/web/components/app/date-field.tsx`, `ui/calendar.tsx`, `ui/popover.tsx` | component | event-driven | Выбора даты нет; copy source из design-lab + `react-day-picker` 10.0.1 (в тексте UI-SPEC указан `^10.0.2`, фиксируется 10.0.1 по D-37) |
| `apps/web/components/ui/select.tsx`, `combobox.tsx`, `textarea.tsx` | component | event-driven | Выпадающих списков и textarea нет; copy sources из design-lab (правки при копировании — раздел G) |
| `apps/web/app/(app)/students/[id]/page.tsx` | route | request-response | Динамических маршрутов в `apps/web/app` нет; ближайшие — `students/page.tsx` (порядок `requireTeacherPage`) и `[...missing]/page.tsx` (`notFound()`); `params` как `Promise` (Pitfall 13) |
| Строка таблицы оплаты, неназначенной оплаты, словаря | component | CRUD | Только `Table` из `components/ui/table.tsx`; по D-25 всё, чего нет в варианте A, идёт шагом «запросить у дизайна» |
| Первая запись `import` в `deploy/RUNBOOK.md` с передачей файла через stdin | doc | batch | `run --rm -T` уже есть (`RUNBOOK.md:322`), но подачи файла в stdin нет; форма блока — 10.3 |
| Правка типа `StatusDot` на три состояния | component | — | Определение есть, но только для аккаунта; расширяется при переносе |

## Metadata

**Analog search scope:** `apps/api/src`, `apps/web/{app,components,hooks,lib}`, `packages/{db,contracts}`, `deploy/`, `.github/workflows/ci.yml`, `knip.json`, `turbo.json`, оба Dockerfile, корневые конфиги; внешний каталог design-lab проверен только на существование файлов и их импорты
**Files scanned:** ~70 прочитано или просмотрено по `grep`/`ls`
**Pattern extraction date:** 2026-10-10
