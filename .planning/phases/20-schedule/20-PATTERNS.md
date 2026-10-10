# Phase 20: Schedule - Pattern Map

**Mapped:** 2026-10-10
**Files analyzed:** 41 new or modified
**Analogs found:** 36 / 41 (5 have only a partial analog or none, see "No Analog Found")

All analog paths below are git-tracked in this repository (checked with `git ls-files`). Two kinds of external references are marked **EXTERNAL**: the vault design-lab working copy (`/Volumes/T7/personal/vault/.claude/worktrees/design-lab/...`), which is the owner-approved copy source named in the UI-SPEC and is not part of this repo. No gitignored mirror paths appear.

Excerpts contain no code comments (project rule). Line numbers refer to the files as they are at the start of phase 20.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/db/src/schema.ts` (add `lessonSeries`, `lessonExceptions`, `lessons`) | model | CRUD | same file: `studentSections` (composite PK), `payments` (checks, index), `students` (FK target) | exact |
| `packages/db/drizzle/<ts>_schedule/{migration.sql,snapshot.json}` | migration | batch | `packages/db/drizzle/20261009194959_student_cards/` | exact (generated, not hand-written) |
| `packages/core/src/zoned.ts` | utility | transform | `packages/core/src/lessons.ts` (`localIsoDate`, Intl `formatToParts`) | role-match |
| `packages/core/src/schedule.ts` | utility | transform | `packages/core/src/balance.ts` + `lessons.ts` (pure, dependency-free) | role-match |
| `packages/core/src/index.ts` (export two files) | config | n/a | same file | exact |
| `packages/contracts/src/schedule.ts` | model (contract) | request-response | `packages/contracts/src/students.ts` (`recordPaymentRequest`, response types) | exact |
| `packages/contracts/src/index.ts` (add `./schedule.ts`) | config | n/a | same file | exact |
| `packages/contracts/src/auth.ts` (`errorCodes` + `lesson_changed`) | config | request-response | same file lines 42-60 | exact |
| `packages/contracts/src/students.ts` (`StudentRow.nextLessonAt`, export `isoDate`) | model | request-response | same file lines 74, 139-147 | exact |
| `apps/api/src/schedule/schedule.ts` | service | CRUD + transaction | `apps/api/src/cards/payments.ts` (transactions, discriminated results) and `cards.ts` `setOpeningBalance` (`for('update')`) | exact |
| `apps/api/src/routes/schedule.ts` | route (controller) | request-response | `apps/api/src/routes/payments.ts` | exact |
| `apps/api/src/app.ts` (add `app.route('/schedule', ...)`) | config | request-response | same file lines 67-69 | exact |
| `apps/api/src/cards/cards.ts` (`listCards`, `createCard`, `toDetail`) | service | CRUD | same file | exact |
| `apps/api/src/cards/card-rows.ts` (`toCardRow`, `toStudentDetail`) | utility (mapper) | transform | same file | exact |
| `apps/web/app/(app)/schedule/page.tsx` | route (server page) | request-response | `apps/web/app/(app)/students/page.tsx` | exact |
| `apps/web/app/(app)/schedule/_components/schedule-screen.tsx` | component (client screen) | request-response | `apps/web/app/(app)/students/_components/students-screen.tsx` | exact |
| `apps/web/app/(app)/schedule/_components/week-grid.tsx` + `lesson-block.tsx` | component | event-driven (clock tick, click) | EXTERNAL `design-lab/src/app/lab/a/_components/schedule-view.tsx` `WeekGrid`, `LessonBlock`, `clusters` | role-match (rewrite, not copy) |
| `apps/web/app/(app)/schedule/_components/lesson-form-dialog.tsx` (New lesson) | component (dialog form) | request-response | `apps/web/app/(app)/students/_components/assign-payment-dialog.tsx` + `students/[id]/_components/record-payment-dialog.tsx` | exact |
| `.../schedule/_components/move-lesson-dialog.tsx`, `move-series-dialog.tsx` | component (dialog form) | request-response | `record-payment-dialog.tsx` | exact |
| `.../schedule/_components/end-series-dialog.tsx` | component (dialog) | request-response | `students/_components/deactivate-student-dialog.tsx` | exact |
| `.../schedule/_components/lesson-dialog.tsx` (details) | component (dialog, read-mostly) | request-response | `deactivate-student-dialog.tsx` structure; `assign-payment-dialog.tsx` `SummaryRow` | role-match |
| Cancel this lesson (inside screen) | component | request-response | `apps/web/components/app/confirm-dialog.tsx` | exact |
| `.../schedule/_components/second-zone-select.tsx` | component | event-driven (localStorage) | `student-form-dialog.tsx` time-zone `Combobox` (lines 163-190, 383-418) | exact |
| `apps/web/lib/schedule-format.ts` | utility | transform | `apps/web/components/app/date-field.tsx` formatter style; `packages/core/src/lessons.ts` `formatLessons` | role-match |
| `apps/web/components/ui/time-picker.tsx`, `input-group.tsx` | component (copy) | event-driven | EXTERNAL `design-lab/src/components/lab/a/ui/{time-picker,input-group}.tsx` | exact (copy with edits) |
| `apps/web/app/globals.css` (E1, E2) | config | n/a | same file lines 125-156, 412-426, 466-511 | exact |
| `apps/web/components/app/layout-parts.tsx` (E3) | component | n/a | same file `PageScroll` lines 24-32; `scroll-area.tsx` `viewportClassName` | exact |
| `apps/web/components/ui/table.tsx` (E4) | component | n/a | same file line 8 | exact |
| `apps/web/components/app/date-field.tsx` (E5 `min`) | component | n/a | same file `max` lines 29, 64 | exact |
| `apps/web/components/app/empty-line.tsx` (E6 `text`) | component | n/a | same file | exact |
| `apps/web/app/(app)/students/_components/students-screen.tsx` (E7: controlled tabs, search, Next lesson) | component | request-response | same file | exact |
| `scripts/dev-checks/schedule-*.mjs` (one-off acceptance scripts) | test/script | batch | `scripts/dev-checks/api.mjs`, `sql.mjs`, `web.mjs` | exact |

## Pattern Assignments

### `packages/db/src/schema.ts` (model, CRUD)

**Analog:** same file. Add `smallint` and `time` to the `drizzle-orm/pg-core` import (currently lines 2-14 import `check, date, index, integer, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid`); both builders exist in rc.4 per RESEARCH.

**Table skeleton pattern** (`payments`, lines 174-209):
```typescript
export const payments = pgTable(
	'payments',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		studentId: uuid('student_id').references(() => students.id, { onDelete: 'restrict' }),
		paidOn: date('paid_on').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('payments_student_paid_idx').on(table.studentId, table.paidOn),
		check('payments_amount_ck', sql`${table.amountMinor} > 0`),
		check('payments_source_ck', sql`${table.source} in ('manual', 'vault')`),
	]
)
```

**Composite PK pattern** for `lesson_exceptions (series_id, original_on)` (`studentSections`, lines 133-151):
```typescript
export const studentSections = pgTable(
	'student_sections',
	{
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		kind: text('kind').notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ name: 'student_sections_pk', columns: [table.studentId, table.kind] }),
		check('student_sections_kind_ck', sql`${table.kind} in ('general_info', 'interests')`),
	]
)
```

**Paired-nullable CHECK pattern** for the `moved` exception (`students_archived_at_ck`, line 113; `students_opening_ck`, lines 126-129):
```typescript
check('students_archived_at_ck', sql`(${table.status} = 'archived') = (${table.archivedAt} is not null)`),
check(
	'students_opening_ck',
	sql`(${table.openingBalanceMinutes} is null) = (${table.openingBalanceOn} is null) and (${table.openingBalanceMinutes} is null or ${table.openingBalanceMinutes} >= 0)`
),
```

**Duration CHECK** (line 120): `check('students_lesson_minutes_ck', sql\`${table.defaultLessonMinutes} between 15 and 240\`)`.

**Status-column pattern** (`students.status`, line 96): `text('status').default('active').notNull()` with the IN-list CHECK on line 112. Use for `lessons.status` (`scheduled | cancelled`) and `lesson_exceptions.kind`.

Full recommended shape for the three tables is in RESEARCH.md Pattern 1; copy it. Apply D-16: all FKs stay `onDelete: 'restrict'` (nothing in the app deletes rows), and the series-cut code must not issue `delete` on series or exceptions (see "Conflict with RESEARCH.md" below).

---

### `packages/db/drizzle/<ts>_schedule/` (migration, batch)

**Analog:** `packages/db/drizzle/20261009194959_student_cards/{migration.sql,snapshot.json}`

Procedure, not code: `yarn workspace @dv-lab/db db:generate --name schedule`, no hand edits, no `drizzle-kit push`, no GRANT (default privileges in `deploy/postgres/ensure-db.sql:33-34` cover `dvlab_app`), second `db:generate` must print "No schema changes". Apply under `dvlab_migrator` to `dvlab_dev` and `dvlab_test`; journal rows must equal folders (4). Source: `19-05-SUMMARY.md:63-64,88-89` in phase 19. Verify `migration.sql` carries the `isodow` CHECK and the partial index verbatim before applying.

---

### `packages/core/src/zoned.ts` and `packages/core/src/schedule.ts` (utility, transform)

**Analog:** `packages/core/src/lessons.ts` (pure functions, no imports, `Intl` formatting) and `packages/core/src/balance.ts`.

**Style pattern** (`balance.ts`, whole file; `lessons.ts` lines 64-70):
```typescript
export function balanceMinutes(openingMinutes: number | null, credited: readonly number[]): number | null {
	if (openingMinutes === null) return null
	return credited.reduce((sum, minutes) => sum + minutes, openingMinutes)
}
```
```typescript
export function localIsoDate(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
		date
	)
	const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
	return `${part('year')}-${part('month')}-${part('day')}`
}
```
Trap: `localIsoDate` formats in the process zone. Do not reuse it for Vietnam dates; `zonedParts(instant, zone)` takes an explicit `timeZone`.

**Index re-export pattern** (`index.ts`, lines 1-3, `.ts` extensions):
```typescript
export * from './balance.ts'
export * from './lessons.ts'
export * from './money.ts'
```
Add `export * from './zoned.ts'` and `export * from './schedule.ts'`.

Constraints: erasable TypeScript only (no `enum`, `namespace`, parameter properties), imports with `.ts`, no dependencies. The `Intl` formatter cache, `offsetMs`, `zonedInstant`, and the full type list (`SeriesRule`, `SeriesException`, `SingleLesson`, `ScheduleBlock`, `OccurrenceRef`) are given verbatim in RESEARCH.md Pattern 5; copy them. Date arithmetic goes through `Date.UTC` and `toISOString().slice(0, 10)`, never local `Date` constructors.

---

### `packages/contracts/src/schedule.ts` (contract, request-response)

**Analog:** `packages/contracts/src/students.ts`

**Imports and constants pattern** (lines 1, 29-30, 41-59, 74):
```typescript
import { z } from 'zod'

export const LESSON_MINUTES_MIN = 15
export const LESSON_MINUTES_MAX = 240

export function isIsoDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
	const year = Number(value.slice(0, 4))
	const month = Number(value.slice(5, 7))
	const day = Number(value.slice(8, 10))
	if (year < 1) return false
	const date = new Date(0)
	date.setUTCFullYear(year, month - 1, day)
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const isoDate = z.string().refine(isIsoDate)
```
`isoDate` is module-private. Either export it from `students.ts` or define `z.string().refine(isIsoDate)` locally in `schedule.ts`; import `isIsoDate`, `LESSON_MINUTES_MIN`, `LESSON_MINUTES_MAX` from `./students.ts`.

**Request schema pattern** (`recordPaymentRequest`, lines 116-123):
```typescript
export const recordPaymentRequest = z.object({
	studentId: z.uuid(),
	paidOn: isoDate,
	amountMinor,
	currency,
	lessonsHundredths: lessonsHundredths.nullable(),
	note: optionalText(PAYMENT_NOTE_MAX_LENGTH),
})
```
Apply to `createLessonRequest { studentId: z.uuid(), date: isoDate, startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), durationMinutes: z.number().int().min(15).max(240), repeats: z.enum(['once', 'weekly']) }`, plus move / series-move / end-series bodies per RESEARCH.md API surface.

**Response type pattern** (lines 188-190):
```typescript
export type PaymentsResponse = { payments: PaymentRow[] }

export type PaymentResponse = { payment: PaymentRow }
```
Apply to `ScheduleWeekResponse`, `ScheduleBlock` (wire form: ISO strings), `ScheduleSeries`.

Index: add `export * from './schedule.ts'` to `packages/contracts/src/index.ts` (currently four lines, `session`, `identity`, `auth`, `students`).

**Error code addition** (`packages/contracts/src/auth.ts` lines 42-60): append `'lesson_changed'` to the `errorCodes` `as const` array before use; `errorBody` is typed on it.

**`StudentRow` change** (`students.ts` lines 139-147): add `nextLessonAt: string | null` after `balanceMinutes`.

---

### `apps/api/src/routes/schedule.ts` (route, request-response)

**Analog:** `apps/api/src/routes/payments.ts`

**Imports and helpers** (lines 1-32):
```typescript
import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import { type PaymentResponse, assignPaymentRequest, recordPaymentRequest } from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { errorBody } from '../request-context.ts'

type PaymentRouteDeps = { db: Database }

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

const notFound = (c: Context<AppEnv>) => c.json(errorBody('not_found', 'Not Found'), 404)

function paymentId(c: Context<AppEnv>): string | null {
	const id = z.uuid().safeParse(c.req.param('id'))
	return id.success ? id.data : null
}
```

**Auth and router pattern** (lines 40-42):
```typescript
export function paymentRoutes({ db }: PaymentRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))
```

**Mutation with discriminated result and 409** (lines 72-88):
```typescript
routes.post('/:id/assign', async (c) => {
	const id = paymentId(c)
	if (id === null) return notFound(c)
	const input = await readJson(c, assignPaymentRequest)
	if (!input) return invalidRequest(c)
	const result = await assignPayment(db, id, input)
	switch (result.kind) {
		case 'not_found':
			return notFound(c)
		case 'currency_required':
			return invalidRequest(c)
		case 'already_assigned':
			return c.json(errorBody('payment_already_assigned', 'This payment is already assigned'), 409)
		case 'assigned':
			return c.json({ payment: result.payment } satisfies PaymentResponse, 200)
	}
})
```
Map the schedule 409s the same way: `c.json(errorBody('lesson_changed', 'This lesson was changed elsewhere'), 409)`.

**Query param validation** (`routes/payments.ts` line 45): `z.uuid().safeParse(c.req.query('student'))`. For `GET /schedule/week?start=`, use a zod schema (ISO date, Monday via core `weekdayOf`, year 2000-2100) and `invalidRequest` on failure.

**Past-guard `now` pattern:** `payments.ts` lines 34-38 (`latestPaymentDate(now: Date)`) shows an injected `now` with `new Date()` only at the route boundary (line 55). Pass `new Date()` from the route into the service; never read the clock inside core.

**Wiring** (`apps/api/src/app.ts` lines 67-69): add `import { scheduleRoutes } from './routes/schedule.ts'` next to the other route imports (lines 13-15) and `app.route('/schedule', scheduleRoutes({ db: deps.db }))` after line 69.

---

### `apps/api/src/schedule/schedule.ts` (service, CRUD + transaction)

**Analog:** `apps/api/src/cards/payments.ts` and `apps/api/src/cards/cards.ts`

**Imports pattern** (`payments.ts` lines 1-14):
```typescript
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm'
import type { z } from 'zod'

import { type PaymentRow, type assignPaymentRequest, type recordPaymentRequest } from '@dv-lab/contracts'
import { creditedMinutes, decimalToHundredths, hundredthsToDecimal } from '@dv-lab/core'
import { type Database, type DbExecutor, payments, students } from '@dv-lab/db'

type AssignPaymentInput = z.output<typeof assignPaymentRequest>
```

**Result union + transaction + share lock on student** (`payments.ts` lines 22-28, 120-150, abbreviated):
```typescript
type AssignPaymentResult =
	| { kind: 'assigned'; payment: PaymentRow }
	| { kind: 'not_found' }
	| { kind: 'currency_required' }
	| { kind: 'already_assigned' }

export function assignPayment(db: Database, id: string, input: AssignPaymentInput): Promise<AssignPaymentResult> {
	return db.transaction(async (tx): Promise<AssignPaymentResult> => {
		const [card] = await tx
			.select({ id: students.id, defaultLessonMinutes: students.defaultLessonMinutes })
			.from(students)
			.where(eq(students.id, input.studentId))
			.for('share')
		if (!card) return { kind: 'not_found' }
		const [row] = await tx.update(payments).set({ ... }).where(...).returning()
		if (!row) return { kind: 'already_assigned' }
		return { kind: 'assigned', payment: toPaymentRow(row) }
	})
}
```

**Row lock `for('update')` for series cut / end / occurrence ops** (`cards.ts` lines 132-156):
```typescript
export function setOpeningBalance(db: Database, id: string, { lessonsHundredths, on }: OpeningBalanceInput) {
	return db.transaction(async (tx): Promise<StudentDetail | null> => {
		const [locked] = await tx
			.select({ defaultLessonMinutes: students.defaultLessonMinutes })
			.from(students)
			.where(eq(students.id, id))
			.for('update')
		if (!locked) return null
		const [row] = await tx.update(students).set({ ..., updatedAt: sql`now()` }).where(eq(students.id, id)).returning(cardColumns)
		if (!row) throw new Error('student card update returned no row')
		return toDetail(tx, row)
	})
}
```
Use `.for('update')` on the `lesson_series` or `lessons` row; set `updatedAt: sql\`now()\``.

**Insert-returning guard** (`cards.ts` lines 74-78): `const [row] = await executor.insert(...).values(...).returning(...)` then `if (!row) throw new Error('... returned no row')`.

**Row mappers throw on unexpected enum values** (`payments.ts` lines 39-65; `card-rows.ts` lines 29-32): `toCurrency`/`toSource`/`toStudentStatus` narrow DB strings; do the same for `lessons.status` and `lesson_exceptions.kind`. Dates come back from drizzle's `date()` as `YYYY-MM-DD` strings; the `time` column returns `HH:MM:SS`, so `.slice(0, 5)` at this boundary (RESEARCH Pitfall 4). Instants go out with `.toISOString()` (`payments.ts` line 63).

**Batched loading** (`cards.ts` `cardBalances`, lines 34-66): one `inArray` query then group into a `Map`; use the same shape for loading series, exceptions and lessons for `nextLessons`.

**Week query / nextLessons loading rules:** RESEARCH Pattern 4 and Pattern 5 (moved exceptions selected by destination `starts_at`, independent of the series filter). Under D-16 add the in-range filter: take moved exceptions only with `original_on` within the series range (`>= starts_on` and `<= ends_on` when set).

**Past guard and cut semantics:** RESEARCH Patterns 2 and 3, adjusted per the D-16 conflict list below.

---

### `apps/api/src/cards/cards.ts` and `card-rows.ts` (StudentRow.nextLessonAt ripple)

**Analog:** same files.

`toCardRow(row, balanceMinutes)` (`card-rows.ts` 41-51) becomes `toCardRow(row, balanceMinutes, nextLessonAt)`; `toStudentDetail(row, balanceMinutes, account)` (53-71) spreads `toCardRow`, so add the parameter there and pass `null` from `createCard` (`cards.ts` line 77: `toStudentDetail(row, null, null)`). `toDetail` (68-72) should compute the value for one student; `listCards` (85-99) computes it in one batched call next to `cardBalances` (line 90) and maps `toCardRow(row, balances.get(row.id) ?? null, next.get(row.id) ?? null)`. Keep this in the same plan as the contracts `StudentRow` edit (RESEARCH Pitfall 7). `nextLessonAt` is `Date | null` from core `nextLessons`, serialised with `.toISOString()` like `archivedAt` on line 68 of `card-rows.ts`.

---

### `apps/web/app/(app)/schedule/page.tsx` (server page)

**Analog:** `apps/web/app/(app)/students/page.tsx` (whole file)
```typescript
import type { Metadata } from 'next'

import { requireTeacherPage } from '@/lib/session'

import { StudentsScreen } from './_components/students-screen'

export const metadata: Metadata = { title: 'Students' }

export default async function StudentsPage() {
	await requireTeacherPage()
	return <StudentsScreen />
}
```
Replace the current stub body (`PageScroll > PageHeader > EmptyLine`) with `<ScheduleScreen />`, keep `metadata = { title: 'Schedule' }` and `requireTeacherPage()`. No time-dependent rendering on the server (Pitfall 6).

---

### `schedule-screen.tsx` (client screen, request-response)

**Analog:** `apps/web/app/(app)/students/_components/students-screen.tsx`

**Imports** (lines 1-26): `'use client'`, `useCallback/useEffect/useMemo/useRef/useState`, `lucide-react` icon, `@/components/app/{layout-parts,read-error,empty-line}`, `@/components/ui/*`, `apiRequest` from `@/lib/api-client`, types from `@dv-lab/contracts`.

**Read-state + loader pattern** (lines 28-35):
```typescript
type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; students: StudentRow[]; unassigned: number }

async function readStudents(): Promise<ReadState> {
	const result = await apiRequest<StudentsResponse>('GET', '/students')
	return result.ok
		? { kind: 'ready', students: result.data.students, unassigned: result.data.unassignedPayments }
		: { kind: 'error' }
}
```

**Load + stale-response guard** (lines 118-130):
```typescript
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
Extend with the requested week `start` as the effect dependency; the `current` flag is the "ignore stale week response" rule.

**Error / header / body split** (lines 142-183): error branch renders `<PageHeader title=... />` plus `<ReadError screen="schedule" onRefresh={load} />`; otherwise `PageHeader` with `description` as a skeleton while loading and `actions` buttons. Return `<PageScroll>{header}{body}{dialogs}</PageScroll>`.

**Dialog open / focus return** (lines 115-116, 156, 189-201):
```typescript
const createButton = useRef<HTMLButtonElement>(null)
...
<Button ref={createButton} leadingIcon={UserPlus} onClick={() => setCreateOpen(true)}>New student</Button>
...
{createOpen ? (
	<StudentFormDialog
		mode="create"
		onClose={() => {
			setCreateOpen(false)
			requestAnimationFrame(() => createButton.current?.focus())
		}}
		onSaved={() => {
			setCreateOpen(false)
			void load()
		}}
	/>
) : null}
```
Dialogs mount only while open; success calls `onSaved` then refetches (no optimistic update).

---

### `week-grid.tsx` and `lesson-block.tsx` (component, event-driven)

**Analog:** EXTERNAL `/Volumes/T7/personal/vault/.claude/worktrees/design-lab/src/app/lab/a/_components/schedule-view.tsx` lines 65-191 (not copied; rewritten per UI-SPEC "Screen Contracts").

**Cluster algorithm to reuse** (lines 65-79):
```typescript
function clusters(lessons: Lesson[]) {
  const groups: { start: number; end: number; lessons: Lesson[] }[] = []
  for (const lesson of lessons) {
    const start = minutesOf(lesson.time)
    const end = start + lesson.minutes
    const current = groups[groups.length - 1]
    if (current && start < current.end) {
      current.lessons.push(lesson)
      current.end = Math.max(current.end, end)
    } else {
      groups.push({ start, end, lessons: [lesson] })
    }
  }
  return groups
}
```
Then assign each block the first free lane inside a cluster (width `1/lanes`), position by inline style `top = minutes / 15 * 14`, `height = max(28, duration / 15 * 14)` instead of A's `ROW_START` class tables.

**Status tones to reuse** (lines 81-86, remapped by UI-SPEC):
```typescript
const BLOCK_TONE = {
  planned: "bg-active text-foreground hover:bg-selected",
  cancelled: "bg-hover text-muted-foreground hover:bg-active",
  moved: "border border-dashed border-border text-muted-foreground hover:bg-hover",
}
```
Map `scheduled` to the `planned` tone; cancelled name gets `line-through`; moved shows `ArrowRight` and the destination day. Drop `done`. Remaps: `text-caption font-medium` becomes `font-semibold`, `text-micro` becomes `text-caption`, `text-subtitle` becomes `text-body`. Block is a `button type="button"` with `focus-visible:ring-2 focus-visible:ring-focus-ring`.

**Now-line / today circle:** A uses `bg-foreground`; this phase uses `bg-gcal-now` (line, 8px dot, `-ml-1`, `size-2`) and `bg-gcal-today text-gcal-today-ink` (28px circle `size-7`). Add the `gcal-*` tokens first (E1).

**Frame / scroller split** (UI-SPEC "Week frame"): wrapper `Elevated offset={1} shadowLevel={2} className="flex flex-col overflow-hidden rounded-2xl"` (see `Elevated` use in `students-screen.tsx` line 52), header row outside the scroller, body `min-h-0 flex-1 overflow-y-auto scroll-fade [scrollbar-gutter:stable]`.

**Loading:** `SkeletonTable rows={10}` from `@/components/ui/skeleton` (imported in `students-screen.tsx` line 16). All time maths through `zonedParts(..., SCHEDULE_TIME_ZONE)` from `@dv-lab/core`; compute "now" after mount only.

---

### `lesson-form-dialog.tsx` (New lesson), `move-lesson-dialog.tsx`, `move-series-dialog.tsx` (dialog form, request-response)

**Analog:** `apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx` (form + validation) and `students/_components/assign-payment-dialog.tsx` (student `Select`).

**Imports** (`record-payment-dialog.tsx` lines 3-31):
```typescript
import { useRef, useState, type FormEvent } from 'react'

import { DateField } from '@/components/app/date-field'
import { TextField } from '@/components/app/text-field'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { apiRequest } from '@/lib/api-client'

import { useToast } from '../../../_components/toasts'
```
Path to toasts from `schedule/_components/` is `../../_components/toasts`.

**State and validation pattern** (lines 56-89):
```typescript
const toast = useToast()
const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
const [submitted, setSubmitted] = useState(false)
const [failed, setFailed] = useState(false)
const [pending, setPending] = useState(false)
...
const errors: Partial<Record<Field, string>> = {}
...
const shown = (field: Field) => (submitted || touched[field] ? errors[field] : undefined)
const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }))
```

**Submit pattern** (lines 91-122):
```typescript
async function onSubmit(event: FormEvent<HTMLFormElement>) {
	event.preventDefault()
	if (pending) return
	setSubmitted(true)
	setFailed(false)
	if (errors.amount) return amountRef.current?.focus()
	setPending(true)
	const result = await apiRequest<PaymentResponse>('POST', '/payments', { ... })
	setPending(false)
	if (!result.ok) {
		setFailed(true)
		return
	}
	toast.show({ title: 'Payment recorded', description: `...` })
	onRecorded()
}
```
For stale data, treat `result.status === 409 || 404` as "changed elsewhere": show the Banner "This lesson was changed elsewhere. The schedule has been refreshed." and call the screen's refetch (UI-SPEC "Confirmations").

**Dialog shell and footer** (lines 124-146, 212-221):
```typescript
<Dialog
	open
	onOpenChange={(open) => {
		if (!open && !pending) onClose()
	}}
>
	<DialogContent size="lg">
		<form noValidate onSubmit={onSubmit}>
			<DialogHeader>
				<DialogTitle>Record payment</DialogTitle>
				<DialogDescription>...</DialogDescription>
			</DialogHeader>
			<div className="flex flex-col gap-4">
				{failed ? (
					<Banner status="error">
						<BannerTitle>Could not record the payment. Try again.</BannerTitle>
					</Banner>
				) : null}
				<div className="grid gap-4 sm:grid-cols-2">...</div>
			</div>
			<DialogFooter>
				<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Discard changes</Button>
				<Button type="submit" loading={pending}>{pending ? 'Saving…' : 'Record payment'}</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
```
UI-SPEC adds: wrap the field area in `ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] px-1 -mx-1"` with `DialogHeader` and `DialogFooter` outside it. No existing dialog uses `ScrollArea` yet (see No Analog Found).

**Student `Select`** (`assign-payment-dialog.tsx` lines 133-155):
```typescript
<Select value={studentId} onValueChange={(value) => void chooseStudent(value)} disabled={pending}>
	<SelectTrigger
		ref={studentRef}
		id="assign-payment-student"
		className="w-full min-w-0"
		placeholder="Choose a student"
		autoFocus
		error={show(studentError, 'student')}
		onBlur={() => setTouched((current) => ({ ...current, student: true }))}
	/>
	<SelectContent>
		{students.map((student, index) => (
			<SelectItem key={student.id} index={index} value={student.id}>
				{student.displayName}
			</SelectItem>
		))}
	</SelectContent>
</Select>
```
Reuse for Student, Repeats (Once / Every week) and New day (Monday to Sunday). Imports: `Select, SelectContent, SelectItem, SelectTrigger` from `@/components/ui/select`.

**Date field:** `<DateField id="..." label="Date" value={...} onChange={...} max={...} disabled={pending} />` (`record-payment-dialog.tsx` lines 174-181). Move dialogs use the new `min` prop (E5). Note `DateField` formats with local `new Date(y, m - 1, d)`; fine for calendar dates, never pass its value to zone maths without `Date.UTC`.

**Length field:** `TextField` with `inputMode="numeric"`, `autoComplete="off"`, `helper`, `error={shown('length')}` as in lines 182-195.

**Overlap warning:** `<Banner status="warning"><BannerTitle>This overlaps another lesson</BannerTitle><BannerDescription>...</BannerDescription></Banner>` (imports `Banner, BannerTitle, BannerDescription` from `@/components/ui/banner`, the latter used in `toasts.tsx` line 5). Never disables submit (D-09).

---

### `end-series-dialog.tsx` and `lesson-dialog.tsx` (small dialogs)

**Analog:** `apps/web/app/(app)/students/_components/deactivate-student-dialog.tsx`

**Pattern** (lines 26-82): `size="sm"` dialog, `showCloseButton={!pending}`, `failed` Banner, footer with safe `secondary` button first and destructive `tertiary className="text-destructive"` second, `loading={pending}`, pending label.
```typescript
<DialogFooter>
	<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
		Keep account
	</Button>
	<Button
		type="button"
		variant="tertiary"
		className="text-destructive"
		loading={pending}
		onClick={() => void deactivate()}
	>
		{pending ? 'Deactivating…' : 'Deactivate account'}
	</Button>
</DialogFooter>
```
"End series" adds a `DateField` ("Last lesson on", `min` today) and a live helper; initial focus on "Keep series" (add `autoFocus` as `confirm-dialog.tsx` line 70 does). The lesson details dialog (`lg`) reuses `DialogHeader` plus `Avatar` (`@/components/app/avatar`) and `SummaryRow` (from `@/components/app/ledger-text`, used in `assign-payment-dialog.tsx` lines 127-131) for the details rows.

---

### Cancel this lesson (confirmation)

**Analog:** `apps/web/components/app/confirm-dialog.tsx` (lines 16-26 props)
```typescript
interface ConfirmDialogProps {
	title: string
	body: string
	cancelLabel: string
	confirmLabel: string
	pendingLabel: string
	tone: 'primary' | 'destructive'
	failureText: string
	onConfirm: () => Promise<boolean>
	onClose: () => void
}
```
Use `tone="primary"`, `cancelLabel="Keep lesson"`, `confirmLabel="Cancel lesson"`, `pendingLabel="Cancelling…"`, `failureText="Could not cancel the lesson. Try again."`, `onConfirm` returning `result.ok`. For a 409/404 on cancel the caller still refetches. Restore has no confirmation.

---

### `second-zone-select.tsx` (component, event-driven)

**Analog:** `apps/web/app/(app)/students/_components/student-form-dialog.tsx`

**Zone list + filter** (lines 163-190): build items from `Intl.supportedValuesOf('timeZone')` (client only, after mount), items `{ value, label, detail }` of type `ComboboxItemData`, a custom `filter` doing case-insensitive substring match including `name.replace(/_/g, ' ')`. Remove Vietnam by both aliases (`Asia/Ho_Chi_Minh`, `Asia/Saigon`) and put a leading "None" item (same idea as the `SAME_TIME_ZONE` item on line 170). `isTimeZone` from `@dv-lab/contracts` validates the saved value.

**Combobox markup** (lines 384-417):
```typescript
<Combobox items={timeZones} value={values.timeZone} onValueChange={...} filter={matchesTimeZone} disabled={pending}>
	<ComboboxInput id="student-form-time-zone" placeholder="Same as teacher" aria-describedby="..." />
	<ComboboxContent>
		<ComboboxList emptyTitle="No time zones found" emptyHint="Try a city, a country or an offset like UTC+7.">
			{(item) => {
				if (typeof item === 'string') {
					return <ComboboxItem key={item} value={item}>{item}</ComboboxItem>
				}
				return (
					<ComboboxItem key={item.value} value={item.value} detail={item.detail}>
						{item.label}
					</ComboboxItem>
				)
			}}
		</ComboboxList>
	</ComboboxContent>
</Combobox>
```
Imports are at `student-form-dialog.tsx` lines 11-16 (`Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList, type ComboboxItemData` from `@/components/ui/combobox`). Persist to `localStorage` key `dv-lab.schedule.second-zone` after mount; render the trigger only after mount.

---

### `students-screen.tsx` (E7: controlled tabs, search, Next lesson column)

**Analog:** same file.

**Table columns/cell pattern** (lines 56-59, 97-103): add a header `<TableHead className={headClass}>Next lesson</TableHead>` and a cell `<TableCell className="px-4 py-2 text-body tabular-nums">` rendering the formatted time or `<span className="text-muted-foreground">None</span>` (same shape as the "No rate" cell, lines 89-91). Column order Student, Status, Rate, Lessons left, Next lesson.

**Tabs** (lines 163-181): change `<Tabs defaultValue="active">` to controlled `value`/`onValueChange` state so the search `Input type="search"` is hidden on the `unassigned` tab. Filter `active` and `archived` memos (lines 133-140) by `displayName.toLowerCase().includes(query.trim().toLowerCase())` before rendering; header description (line 153) keeps the unfiltered counts. Empty search result renders `<EmptyLine text="No students found" />`. `TabsList` class on line 164 gets `max-sm:scroll-fade-x max-sm:[--scroll-fade-size:var(--scroll-fade-size-compact)]`.

Layout for the search row (UI-SPEC): `flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between` around `TabsList` and the `Input`.

---

### `empty-line.tsx` (E6), `date-field.tsx` (E5), `layout-parts.tsx` (E3), `table.tsx` (E4)

**E6** (`empty-line.tsx`, whole file): turn `export function EmptyLine()` into `EmptyLine({ text = 'Nothing here yet' }: { text?: string })` and render `{text}` on line 6.

**E5** (`date-field.tsx`): mirror `max` exactly. Props line 29 `max?: string`; usage line 64:
```typescript
disabled={max ? { after: toDate(max) } : undefined}
```
becomes a combined matcher when both are set: add `min?: string`, and pass `disabled={[...(min ? [{ before: toDate(min) }] : []), ...(max ? [{ after: toDate(max) }] : [])]}` or equivalent react-day-picker matcher array.

**E3** (`layout-parts.tsx` line 26): `<ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">`. `ScrollArea` already accepts `viewportClassName` (`scroll-area.tsx` lines 13, 37, 53), and the touch branch also applies it.

**E4** (`table.tsx` line 8): `className="relative w-full overflow-x-auto scroll-fade-x [--scroll-fade-size:var(--scroll-fade-size-compact)]"`. Keep the rounded `Elevated` frame on the wrapper in `students-screen.tsx` line 52 (the mask belongs to the scroller only).

---

### `apps/web/app/globals.css` (E1, E2)

**Analog:** same file.

- E2 delete lines 423-426:
```css
.scroll-fade,
.scroll-fade-x {
	--scroll-fade-size: 48px;
}
```
and add to `:root`:
```css
--scroll-fade-size: 48px;
--scroll-fade-size-compact: 24px;
```
Both halves in one edit (Pitfall 5). Existing users (`select.tsx`, `combobox.tsx`, `dropdown.tsx`, `sidebar.tsx`) keep 48px from `:root`.
- E1 gcal tokens: add to `:root` / `.dark` / `@theme inline` with the values listed in RESEARCH.md "Scroll fade state" (light `#dadce0 #1a73e8 #ffffff #ea4335`, dark `#3c4043 #8ab4f8 #202124 #f28b82`, and the four `--color-gcal-*` lines). Do not add `--gcal-event-*`.

---

### `time-picker.tsx` and `input-group.tsx` (copy)

**Source (EXTERNAL):** `/Volumes/T7/personal/vault/.claude/worktrees/design-lab/src/components/lab/a/ui/time-picker.tsx` and `.../input-group.tsx`. Copy-time edits are the closed list in UI-SPEC "Copy list": `cn` from `@/lib/utils`; imports of `button`, `input`, `input-group`, `popover`, `textarea` point to the existing `@/components/ui/*`; `variant="outline"` becomes `tertiary`, `size="icon-sm"` becomes `icon-compact`; text scale remaps; English labels; strip the header comment (lines 3-4) and section banners (lines 38-40) and every other comment; strip `data-fade` masks and put `scroll-fade [--scroll-fade-size:var(--scroll-fade-size-compact)]` on the column lists; props `hourCycle={24}`, `minuteStep={15}`, value `HH:MM`. Then run the Radix/cmdk grep gate and the `@/lib` closure grep. Existing Base UI component style to match: `apps/web/components/ui/popover.tsx`, `apps/web/components/ui/input.tsx`.

---

### `scripts/dev-checks/schedule-*.mjs` (acceptance scripts)

**Analog:** `scripts/dev-checks/api.mjs`, `sql.mjs`, `web.mjs` (README `scripts/dev-checks/README.md`).

**API script pattern** (`api.mjs` lines 29-44, 57-97, 120): use the exports `startApi({ port })`, `call(api, method, path, { cookie, body })`, `teacherCookie`, `sql(text, role)`, `quote`. `sql()` spawns `sql.mjs ENV_TEST migrator|app <text>` and parses the last stdout line as JSON; the API is spawned with `node --env-file=.env.test apps/api/src/server.ts`, so core and contracts must stay Node-strippable TypeScript. Use only fictional cards `Alex Example NNNN` and remove them afterwards. The `zonedInstant` vs SQL `at time zone` cross-check also goes through `sql()`. In raw SQL cast dates with `::text` (pg returns `date` as a local `Date`).

---

## Shared Patterns

### Teacher-only API surface
**Source:** `apps/api/src/routes/payments.ts` line 42 and `apps/api/src/routes/students.ts` line 69
**Apply to:** `routes/schedule.ts`
```typescript
routes.use('*', noStore, requireSession(db), requireRole('teacher'))
```
Same-origin protection is global in `app.ts` line 43 (`sameOrigin(deps.appOrigin)`); mutations are POST with JSON.

### Request body parsing and error envelope
**Source:** `apps/api/src/auth/middleware.ts` lines 92-103 (`readJson`), `apps/api/src/request-context.ts` (`errorBody`)
**Apply to:** every schedule mutation route
```typescript
const input = await readJson(c, someRequest)
if (!input) return invalidRequest(c)
```
`readJson` returns `null` on wrong content type, bad JSON or schema failure. Errors are `c.json(errorBody(code, message), status)` with codes from the closed `errorCodes` list.

### Transaction + row lock + discriminated result
**Source:** `apps/api/src/cards/cards.ts` lines 132-156, `apps/api/src/cards/payments.ts` lines 120-150
**Apply to:** all schedule mutations (create series, cut, end, occurrence move/cancel/restore, single move/cancel/restore)
`db.transaction(async (tx): Promise<Result> => { ... .for('update') ... })`, results `{ kind: '...' }`, routes `switch` on `kind`.

### Dates and times on the wire
**Source:** `apps/api/src/cards/payments.ts` line 63 (`createdAt.toISOString()`); `packages/contracts/src/students.ts` `isIsoDate`
**Apply to:** contracts, API services, web
Instants are ISO strings, dates `YYYY-MM-DD`, times `HH:MM`. All Vietnam-time maths use `SCHEDULE_TIME_ZONE` from `@dv-lab/core`; never `new Date().getDay()`, `localIsoDate`, or `toLocaleDateString()` without `timeZone`.

### Web fetch and error handling
**Source:** `apps/web/lib/api-client.ts` (whole file)
**Apply to:** all schedule and students-screen reads and mutations
`apiRequest<T>(method, path, body?)` returns `{ ok: true, status, data }` or `{ ok: false, status, error }`; network failure gives `status: 0`. Read failure shows `ReadError` (`apps/web/components/app/read-error.tsx`, `screen` prop gives "Could not load {screen}"); mutation failure shows a `Banner status="error"` inside the open dialog and keeps field values.

### Toasts
**Source:** `apps/web/app/(app)/_components/toasts.tsx` lines 24-28
**Apply to:** every successful schedule mutation
`const toast = useToast()`; `toast.show({ title, description })`.

### Pending, double-submit, focus
**Source:** `record-payment-dialog.tsx` lines 91-122 and `confirm-dialog.tsx` lines 42-50
**Apply to:** all dialogs
`if (pending) return`, `loading={pending}` on the primary button, `onOpenChange` ignoring close while pending, inputs `disabled={pending}`.

### Scroll fade (D-14)
**Source:** `apps/web/app/globals.css` lines 412-426 and the `@supports (animation-timeline: scroll())` block (466-511); `apps/web/components/ui/scroll-area.tsx` `viewportClassName`
**Apply to:** `PageScroll`, week-grid body, dialog bodies, students table container, TimePicker lists, students tabs strip
Class `scroll-fade` / `scroll-fade-x` on the element that scrolls; ring/background/shadow on a wrapper; header and axis caption outside the scroller; 24px via `[--scroll-fade-size:var(--scroll-fade-size-compact)]`. No static fallback fade, no copy of shadcn's utility.

### No comments, English UI text, Base UI only
**Source:** project rules (CONTEXT.md "Established Patterns"); ESLint rule against Radix and `cmdk`
**Apply to:** every new or copied file.

## Conflicts With RESEARCH.md That the Planner Must Resolve (D-16 override)

CONTEXT D-15 and D-16 were added after RESEARCH.md and override its wording. Pattern references above are adjusted; these are the specific places where RESEARCH.md text must not be copied as is:

| RESEARCH.md place | Says | Must become (D-15 / D-16) |
|-------------------|------|---------------------------|
| Pattern 2 step 5 | cancelled exceptions after `from` are deleted; moved ones converted to `lessons` and the exception row deleted | Cancelled exceptions stay on the old series, outside its new `ends_on` range, as history (not shown). Moved exceptions become new `lessons` rows; the old exception row stays (no `delete`) |
| Pattern 2 step 6 | delete the old series row when its range is empty | Do not delete. An empty range cannot satisfy `lesson_series_ends_on_ck` (`ends_on >= starts_on`), so the planner needs a way to represent "cut at or before `starts_on`" without deleting (for example set `ends_on = starts_on` only when the first date is still before `from`, otherwise leave the old row untouched and hidden by the in-range filter, or relax the CHECK). This is a schema decision to settle before the db plan |
| Pattern 3 End series row | deletes exceptions with `original_on > ends_on`, deletes the series row when empty | Only `update lesson_series set ends_on`; exceptions stay and are ignored by the week query when `original_on` is outside the series range |
| Pattern 4 / Pattern 5 queries | moved exceptions selected by destination time | also require `original_on` within the series range (`>= starts_on` and `<= ends_on` if set) |
| Pattern 1 / schema | `SCHEDULE_TIME_ZONE` core constant; no zone column | confirmed by D-15 (no change) |
| Open Questions 1 and 2 | open | closed by D-15 and D-16 |

`ON DELETE RESTRICT` on all new FKs is consistent with D-16; no code path in the schedule service calls `.delete()`.

## No Analog Found

| File / feature | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| Dialog body wrapped in `ScrollArea` with `scroll-fade` viewport | component | n/a | No existing dialog scrolls its body; build from `scroll-area.tsx` props (`viewportClassName`) per UI-SPEC; verify the viewport honours `max-h-[inherit]` in the browser |
| `week-grid.tsx` absolute positioning, lane layout, clock tick, 08:00 initial scroll | component | event-driven | Nothing in this repo is a calendar grid; only the EXTERNAL variant A `WeekGrid` (different geometry: CSS-grid rows, 09:00-22:00, no scroll, MSK primary). Use RESEARCH.md Pattern 6 and UI-SPEC "Week frame" |
| `zonedInstant` / `zonedParts` zone arithmetic | utility | transform | `lessons.ts` only has a process-zone `localIsoDate`; use RESEARCH.md Pattern 5 code (Intl `formatToParts`, two-pass offset) |
| localStorage-backed preference | hook/component | event-driven | No `localStorage` use found in `apps/web`; keep it inside `second-zone-select.tsx`, read after mount |
| Occurrence expansion (`scheduleWindow`, `nextLessons`, `overlaps`) | utility | transform | No recurrence logic exists; RESEARCH.md Pattern 5 semantics are the spec |

## Metadata

**Analog search scope:** `packages/db`, `packages/core`, `packages/contracts`, `apps/api/src`, `apps/web/app`, `apps/web/components`, `apps/web/lib`, `scripts/dev-checks`; EXTERNAL design-lab `schedule-view.tsx`.
**Files scanned:** about 45 (read in full: 20; the rest located by `git ls-files`, grep and header reads).
**Pattern extraction date:** 2026-10-10
