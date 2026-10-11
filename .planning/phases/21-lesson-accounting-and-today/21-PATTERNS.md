# Phase 21: Lesson Accounting and Today - Pattern Map

**Mapped:** 2026-10-10
**Files analyzed:** 34 (новых и значимо изменяемых)
**Analogs found:** 31 / 34 (3 без прямого аналога: Today-экран, Settings-экран, `Stat`/`Switch`/`EmptyState` — берутся из дизайн-системы v35, см. «No Analog Found»)

Все пути ниже относительны к корню worktree и проверены как отслеживаемые git-файлы (`git ls-files`); зеркал `.gsd/capabilities` среди аналогов нет. Строки указаны по состоянию worktree на 2026-10-10 до правок фазы 21. Код без комментариев, интерфейс на английском, новых тестов нет (приёмка скриптами `scripts/dev-checks/ledger-*.mjs`).

## File Classification

| Новый / изменяемый файл | Роль | Поток данных | Ближайший аналог | Качество |
|-------------------------|------|--------------|------------------|----------|
| `packages/db/src/schema.ts` (`lessonMarks`, `teacherSettings`, `students.noShowDeducts`) | model | CRUD | `lessonExceptions` / `lessons` / `studentSections` в том же файле | exact |
| `packages/db/drizzle/<ts>_lesson_marks/` (generate) | migration | batch | `drizzle/20261010075813_schedule/` | exact |
| `packages/db/drizzle/<ts>_lesson_marks_revoke_delete/` (custom) | migration | batch | `drizzle/20261010103628_schedule_revoke_delete/migration.sql` | exact |
| `packages/core/src/balance.ts` (правило остатка) | utility | transform | текущий `balance.ts` + `schedule.ts::occurrenceAt` | role-match |
| `packages/core/src/schedule.ts` (`lessonOutcome`, `lessonActions`, `awaitsMark`, `scheduleToday`, `scheduleDate`) | utility | transform | `schedule.ts::canChange`, `todayOf`, `nextLessons` | exact |
| `packages/core/src/lessons.ts` (`balancePhrase`, `paysSoon`, `paysSoonList`, удалить `localIsoDate`) | utility | transform | `lessons.ts::lessonsPhrase`, `formatLessons` | exact |
| `packages/core/src/today.ts` (`todayCounts`) или в `schedule.ts` | utility | transform | `schedule.ts::overlaps` (чистая функция над списком блоков) | role-match |
| `packages/contracts/src/schedule.ts` (`markLessonRequest`, `outcome`, `actions`, `ScheduleMark*`) | contract | request-response | тот же файл: `lessonActionRequest`, `ScheduleOccurrence` | exact |
| `packages/contracts/src/students.ts` (`noShowDeducts`) | contract | CRUD | `saveStudentRequest`, `StudentDetail` | exact |
| `packages/contracts/src/today.ts`, `settings.ts` (новые) | contract | request-response | `contracts/src/schedule.ts` (zod + wire-типы, реэкспорт из `index.ts`) | role-match |
| `packages/contracts/src/auth.ts` (`errorCodes`: `lesson_not_started`) | contract | request-response | массив `errorCodes` (`:42-65`) | exact |
| `apps/api/src/schedule/rows.ts` (`loadMarkRows`, `loadMarks`) | service | CRUD (read) | `rows.ts::loadScheduleRows`, `seriesException` | exact |
| `apps/api/src/schedule/marks.ts` (новый, запись отметки) | service | CRUD (upsert, транзакция) | `schedule/changes.ts` (`cancelOccurrence`, `markException`, `cancelLesson`) | exact |
| `apps/api/src/schedule/changes.ts` (`refusal` через `lessonActions`) | service | request-response | свой же `refusal` (`:58-61`) | exact |
| `apps/api/src/schedule/schedule.ts` (`toWireBlock` с `outcome`/`actions`) | service | transform | свой же `toWireBlock` (`:67-84`) | exact |
| `apps/api/src/schedule/series.ts` (перенос отметок при разрезе) | service | CRUD (транзакция) | свой же `moveSeries` / `endSeries` | exact |
| `apps/api/src/cards/card-facts.ts` (сырые оплаты + отметки в core) | service | transform | свой же `cardBalances` | exact |
| `apps/api/src/cards/cards.ts` / `card-rows.ts` (`noShowDeducts`, `importCard`) | service | CRUD | `cardValues`, `cardColumns`, `toStudentDetail` | exact |
| `apps/api/src/routes/schedule.ts` (маршруты `/mark`) | route | request-response | цикл cancel/restore (`:120-133`, `:145-158`) | exact |
| `apps/api/src/routes/today.ts` + `apps/api/src/today/today.ts` | route + service | request-response | `routes/students.ts::GET /` + `schedule/schedule.ts::readWeek` | role-match |
| `apps/api/src/routes/settings.ts` + `apps/api/src/settings/settings.ts` | route + service | CRUD (upsert) | `routes/students.ts::PUT /:id/sections/:kind` + `cards/sections.ts::saveSection` | role-match |
| `apps/api/src/routes/payments.ts`, `routes/students.ts` (убрать `latestPaymentDate`) | route | request-response | `schedule/changes.ts::moveTarget` (`:63-67`, сравнение с датой Вьетнама) | role-match |
| `apps/api/src/app.ts` (монтирование `/today`, `/settings`) | config | request-response | `app.ts:68-71` | exact |
| `apps/web/app/(app)/page.tsx` + `_components/today-screen.tsx` (Today) | component | request-response | `students/_components/students-screen.tsx` + `schedule-screen.tsx` | role-match |
| `apps/web/app/(app)/schedule/_components/schedule-mutations.ts` (`'mark'`) | utility | request-response | свой же `mutate` / `pathOf` | exact |
| `apps/web/app/(app)/schedule/_components/lesson-dialog.tsx` (кнопки отметок) | component | request-response | свой же `run` + `plannedActions` + `DialogFooter` | exact |
| `apps/web/app/(app)/schedule/_components/lesson-block.tsx`, `event-tooltip.tsx`, `lib/schedule-format.ts` (читают `outcome`) | component | transform | свои же `DOT`/`STATUS_CLASS`/`LessonStatus` | exact |
| `apps/web/app/(app)/schedule/_components/schedule-screen.tsx` (`changeLesson`, `mark`, `scheduleToday`) | component | request-response | свой же `changeLesson` (`:228-242`) | exact |
| `apps/web/app/(app)/settings/` (новый) + карточка N | component | CRUD | `students-screen.tsx` (Tabs + Panel) + `opening-balance-panel.tsx` (поле с сохранением) | role-match |
| `apps/web/components/app/ledger-text.tsx` (`balanceCaption`, `LessonsText`) | component | transform | свой же файл | exact |
| `students-screen.tsx`, `student-profile.tsx::SummaryLine`, `opening-balance-panel.tsx`, `record-payment-dialog.tsx` (долг, `scheduleToday`) | component | transform | свои же места показа остатка | exact |
| `students/_components/student-form-dialog.tsx` или профиль (флаг `noShowDeducts`) | component | CRUD | `student-form-dialog.tsx` (`Values`/`parse`/`apiRequest PATCH`) | exact |
| `scripts/dev-checks/ledger-core.mjs`, `ledger-api.mjs`, `ledger-db.mjs`, правка `schedule-db.mjs` | test (приёмка) | batch | `schedule-core.mjs`, `schedule-api.mjs`, `schedule-db.mjs` | exact |

## Pattern Assignments

### `packages/db/src/schema.ts` — `lessonMarks`, `teacherSettings`, `students.noShowDeducts` (model, CRUD)

**Analog:** `lessonExceptions` (`schema.ts:238-266`), `lessons` (`:268-287`), `studentSections` (`:135-153`), `accounts` (`:24-59`).

**Импорты** (`schema.ts:1-16`): добавить `boolean` в список из `drizzle-orm/pg-core` (сейчас его нет), остальное (`check`, `date`, `integer`, `pgTable`, `text`, `timestamp`, `uniqueIndex`, `uuid`, `sql`) уже импортировано.

**Стиль таблицы** (`schema.ts:268-287`): `id uuid defaultRandom primaryKey`, FK `.references(() => ..., { onDelete: 'restrict' })`, `createdAt`/`updatedAt` как `timestamp(..., { withTimezone: true }).defaultNow().notNull()`, имена индексов `<table>_<что>_idx` / `_uq`, проверки `<table>_<что>_ck` внутри массива третьего аргумента:
```ts
(table) => [
	index('lessons_starts_at_idx').on(table.startsAt),
	check('lessons_status_ck', sql`${table.status} in ('scheduled', 'cancelled')`),
	check('lessons_minutes_ck', sql`${table.durationMinutes} between 15 and 240`),
]
```

**Ключ вхождения** — копировать пару `(series_id, original_on)` из `lessonExceptions` (`:241-244`, `:252`): колонки `uuid('series_id').references(() => lessonSeries.id, { onDelete: 'restrict' })` и `date('original_on')`, но nullable (одиночный урок идёт через `lessonId`). Уникальность `uniqueIndex('lesson_marks_occurrence_uq').on(seriesId, originalOn)` и `uniqueIndex('lesson_marks_lesson_uq').on(lessonId)` — обычные, не частичные (в Postgres NULL различаются). Проверка ссылки одним CHECK по образцу составной проверки `lesson_exceptions_moved_ck` (`:257-260`) и `students_opening_ck` (`schema.ts:128-131`, `(a is null) = (b is null)`):
```ts
check('lesson_marks_kind_ck', sql`${table.kind} in ('done', 'no_show', 'none')`),
check('lesson_marks_ref_ck', sql`(${table.seriesId} is null) = (${table.originalOn} is null) and (${table.seriesId} is null) <> (${table.lessonId} is null)`),
```

**`teacher_settings`:** ключ `accountId: uuid('account_id').primaryKey().references(() => accounts.id, { onDelete: 'restrict' })` — форма как у `sessions.accountId` (`:65-67`) и PK-таблицы `appInfo` (`:18-22`); CHECK диапазона `between 0 and 20` по образцу `lesson_series_minutes_ck` (`:234`).

**`students.noShowDeducts`:** добавить в `students` рядом с `defaultLessonMinutes` (`:101`) в стиле `integer('...').default(60).notNull()`: `noShowDeducts: boolean('no_show_deducts').default(true).notNull()`.

---

### `packages/db/drizzle/<ts>_lesson_marks/` и `<ts>_lesson_marks_revoke_delete/` (migration)

**Analog:** `packages/db/drizzle/20261010075813_schedule/` (generate) и `20261010103628_schedule_revoke_delete/migration.sql` (custom).

Порядок строго как в фазе 20 (`21-RESEARCH.md` Pitfall 6): `yarn db:generate --name lesson_marks`, затем `yarn workspace @dv-lab/db db:generate --custom --name lesson_marks_revoke_delete`, затем повторный `yarn db:generate` должен ответить «No schema changes» (CI шаг `.github/workflows/ci.yml:130-138`). Руками миграции не править.

**Содержимое custom-миграции** (аналог `schedule_revoke_delete/migration.sql:1`, одна строка):
```sql
REVOKE DELETE, TRUNCATE ON "lesson_series", "lesson_exceptions", "lessons" FROM "dvlab_app";
```
Для фазы 21: `REVOKE DELETE, TRUNCATE ON "lesson_marks" FROM "dvlab_app";`. Причина: `deploy/postgres/ensure-db.sql:33` выдаёт DELETE по умолчанию на каждую новую таблицу. `teacher_settings` отзыв не нужен.

---

### `packages/core/src/schedule.ts` — исход вхождения и «сегодня» (utility, transform)

**Analog:** сам файл.

**Образец чистой предикатной функции** (`schedule.ts:62-64`) — копировать форму для `lessonActions`/`awaitsMark`, они зовут `canChange`:
```ts
export function canChange(startsAt: Date, now: Date): boolean {
	return startsAt.getTime() > now.getTime()
}
```

**«Сегодня» (D-15):** заменить приватный `const todayOf = (now: Date) => zonedParts(now, SCHEDULE_TIME_ZONE).date` (`:183`) на экспортируемые `scheduleToday(now)` и `scheduleDate(instant)`; четыре внутренних вызова `todayOf` (`:186`, `:211`, `:295`, `:334`) переименовать. Остальные прямые `zonedParts(..., SCHEDULE_TIME_ZONE).date`, которые перейдут на эти функции: `apps/api/src/schedule/changes.ts:64`, `apps/api/src/schedule/schedule.ts:131`, `apps/api/src/schedule/rows.ts:104`, `apps/web/.../schedule-screen.tsx:95,108,245`.

**Исход (D-14):** `BlockStatus` (`:33`) остаётся внутренним; у `Occurrence` `status: 'moved'` значит «сам урок на новом месте» (`:99-101`), у `ScheduleBlock` — «призрак на старом месте» (`:139`, блок на новом месте даёт `'scheduled'`/`'cancelled'` с `movedFrom`, `:157-159`). `lessonOutcome` должен принять оба вида (для `Occurrence` вход `status === 'cancelled' ? 'cancelled' : 'scheduled'`). Ключ отметки — `occurrenceKey(ref)` (`:66-68`), у призрака и блока на новом месте ключ общий (Pitfall 3 исследования), поэтому читать отметки надо по ключу, а исход призрака — `moved` без действий.

**Окно с отметками:** `scheduleWindow` (`:123-177`) собирает блоки трёх видов (серия на месте, блок на новом месте для `exceptions`, одиночные); новое поле `outcome` проставляется одним проходом после `.sort(byStart)` через `withOutcomes(blocks, marks)` либо необязательным `marks` в `ScheduleInput` — единственный `blocks.push` каждого вида не размножать.

**Остаток по уроку**: использовать `occurrenceAt(rule, originalOn, exception)` (`:92-111`) — `startsAt`/`durationMinutes` места, где урок стоит сейчас; дата вычета `scheduleDate(occurrence.startsAt)`.

**`CutLesson`** (`:263`): добавить `originalOn` (`movedLessons`, `:267-279`) для переноса отметок при разрезе серии.

---

### `packages/core/src/balance.ts` — правило остатка (utility, transform)

**Analog:** текущий `balance.ts` (4 строки) + стиль чистых функций `lessons.ts`.

Сегодня (`balance.ts:1-4`):
```ts
export function balanceMinutes(openingMinutes: number | null, credited: readonly number[]): number | null {
	if (openingMinutes === null) return null
	return credited.reduce((sum, minutes) => sum + minutes, openingMinutes)
}
```
Станет `balanceMinutes(card, payments, lessons)` со строгой границей `date > openingOn` (то же, что делал SQL `gt(payments.paidOn, students.openingBalanceOn)` в `card-facts.ts:30`) и `deductedMinutes(outcome, durationMinutes, noShowDeducts)`. Ранний выход `null` сохранить (`:2`). Не обрезать нулём (D-06). Экспорт автоматически идёт через `export * from './balance.ts'` (`core/src/index.ts:1`); core без `node:*`, `process.env`, `@dv-lab/*`.

---

### `packages/core/src/lessons.ts` — `balancePhrase`, `paysSoon`, `paysSoonList` (utility, transform)

**Analog:** `lessons.ts:53-62`.
```ts
export function formatLessons(minutes: number, lessonMinutes: number): string {
	return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, signDisplay: 'negative' }).format(
		minutes / lessonMinutes
	)
}

export function lessonsPhrase(minutes: number, lessonMinutes: number): string {
	const count = formatLessons(minutes, lessonMinutes)
	return count === '1' ? '1 lesson' : `${count} lessons`
}
```
`balancePhrase` строить на `lessonsPhrase`/`formatLessons` от модуля минут (для `minutes < 0` — «owes 1.5 lessons», иначе «… left»); `lessonsPhrase` для долга даёт «-1.5 lessons», не годится. `paysSoon(balance, lessonMinutes, threshold)` сравнивает в минутах `balance <= threshold * lessonMinutes`, `null` → `false`. Удалить `localIsoDate` (`lessons.ts:64-70`, зона среды): вызовы в `opening-balance-panel.tsx:14,38,140` и `record-payment-dialog.tsx:25,57` заменить на `scheduleToday(new Date())`; `knip` ловит оставшийся экспорт. Константа `PAYS_SOON_LESSONS_DEFAULT = 2`.

---

### `packages/contracts/src/schedule.ts` — отметка, `outcome`, `actions` (contract, request-response)

**Analog:** тот же файл.

**Zod-запрос** (`schedule.ts:25,41-43`) — копировать для `markLessonRequest`:
```ts
const expectedStartsAt = z.iso.datetime().optional()

export const lessonActionRequest = z.object({
	expectedStartsAt,
})
```
Новый: `z.object({ kind: z.enum(['done', 'no_show', 'none']), expectedStartsAt })`. Массивы-константы с `as const` + выведенный тип — как `REPEATS` (`:13-15`).

**Wire-типы** (`:57-75`, `:101-108`): `ScheduleBlock` теряет `status` и `changeable` и получает `outcome` и `actions` (D-14); `ScheduleOccurrence.status` (`:104`) → `outcome`. Ответ мутации — `{ occurrence }` / `{ lesson }` (`ScheduleOccurrenceResponse`, `ScheduleLessonResponse`), для отметки — `{ mark: {...} }`. Реэкспорт нового `today.ts`/`settings.ts` — в `index.ts` строкой `export * from './today.ts'`.

**Код ошибки:** добавить `'lesson_not_started'` в массив `errorCodes` (`auth.ts:42-65`, рядом с `'lesson_in_past'`).

**`students.ts`:** добавить `noShowDeducts: z.boolean()` в `saveStudentRequest` (`students.ts:82-93`) и `noShowDeducts: boolean` в `StudentDetail`; `importCard` передаёт значение явно (Pitfall 7).

---

### `apps/api/src/schedule/rows.ts` — `loadMarkRows`, `loadMarks` (service, CRUD read)

**Analog:** `rows.ts::loadScheduleRows` (`:151-214`) и `seriesException` (`:121-131`).

**Колонки-константы + `Pick<typeof table.$inferSelect, keyof typeof columns>`** (`:28-48`) — завести `markColumns` и тип `MarkRecord` так же. **Преобразование строки базы в core-тип с выбросом на неожиданное значение** (`:88-101`):
```ts
function toLessonStatus(value: string): SingleLesson['status'] {
	if (value === 'scheduled' || value === 'cancelled') return value
	throw new Error('unexpected lesson status')
}
```
Копировать как `toMarkKind(value: string): MarkKind`. **Пустой вход → пустой результат** (`:153`): `if (studentIds.length === 0) return []`. Фильтр по студентам через `inArray(column, [...studentIds])` (`:157-158`). Серийная отметка разрешается через `toSeriesRule` + `toSeriesException` + `occurrenceAt`; если вернулся `null`, отметку не считать. Чтение — внутри `readSnapshot` (`:145-147`), как у `listCards`/`getCard`.

---

### `apps/api/src/schedule/marks.ts` — запись отметки (service, CRUD upsert)

**Analog:** `apps/api/src/schedule/changes.ts`.

**Импорты и типы результата** (`changes.ts:1-42`): `import { eq, sql } from 'drizzle-orm'`, `type { z } from 'zod'`, типы из `@dv-lab/contracts`, функции из `@dv-lab/core`, `{ type Database, type DbExecutor, ... } from '@dv-lab/db'`, замки из `./rows.ts`. Результат — дискриминированное объединение с `ChangeFailure`:
```ts
export type OccurrenceResult = { kind: 'ok'; occurrence: ScheduleOccurrence } | ChangeFailure
const NOT_FOUND = { kind: 'not_found' } as const
const CHANGED = { kind: 'changed' } as const
```
Добавить в `ChangeFailure` (`:33-38`) вид `{ kind: 'not_started' }` и константу `NOT_STARTED`.

**Блокировка вхождения** (`changes.ts:69-80`):
```ts
async function lockOccurrence(executor, seriesId, originalOn): Promise<LockedOccurrence | null> {
	const rule = await lockSeries(executor, seriesId)
	if (rule === null) return null
	const exception = await seriesException(executor, seriesId, originalOn)
	return { rule, occurrence: occurrenceAt(rule, originalOn, exception ?? undefined) }
}
```
Экспортировать `lockOccurrence` из `changes.ts` (сейчас приватная) и переиспользовать, не копировать.

**Транзакция + проверки** (`changes.ts:134-159`, `cancelOccurrence`): `db.transaction(async (tx): Promise<OccurrenceResult> => { lock → NOT_FOUND / occurrence null → CHANGED / refusal(...) → upsert })`. Протухший `expectedStartsAt` проверяет `stale()` (`:54-56`).

**Upsert** (`changes.ts:87-94`) — копировать для отметки, `target: [lessonMarks.seriesId, lessonMarks.originalOn]` для серий и `target: lessonMarks.lessonId` для одиночных:
```ts
.onConflictDoUpdate({
	target: [lessonExceptions.seriesId, lessonExceptions.originalOn],
	set: { kind: exception.kind, ...time, updatedAt: sql`now()` },
})
.returning(exceptionColumns)
if (!row) throw new Error('lesson exception upsert returned no row')
```
Одиночный урок: `lockLesson` + `saveLesson`-подобная ветка (`changes.ts:188-233`). Проверка D-04: `lessonActions(...).mark`; `kind: 'none'` разрешён и на отменённом (A6), `done`/`no_show` на отменённом → `CHANGED`.

---

### `apps/api/src/schedule/changes.ts` — `refusal` через `lessonActions` (service)

**Analog:** сам файл. Сегодняшний `refusal` (`:58-61`):
```ts
function refusal(allowed: boolean, startsAt: Date, expected: string | undefined, now: Date): ChangeFailure | null {
	if (!allowed || stale(expected, startsAt)) return CHANGED
	return canChange(startsAt, now) ? null : IN_PAST
}
```
Для `cancel`/`restore` убрать `IN_PAST` (разрешено в любое время, D-07 и критерий 3, Pitfall 1), оставить `IN_PAST` только для `move`. Вызовы `refusal` в `:121,146,173,206,219,229` передают `occurrence.status !== 'cancelled'` и т.п. — заменить на `lessonActions(outcome, startsAt, now).cancel/restore/move`. Ответ `markException` (`:98-106`) отдаёт `occurrence.status` — поменять на `outcome` из core.

---

### `apps/api/src/schedule/schedule.ts::toWireBlock` и `series.ts` (service)

**`toWireBlock`** (`schedule.ts:67-84`): заменить `status: block.status` и `changeable: canChange(block.startsAt, now)` на `outcome: block.outcome` и `actions: lessonActions(block.outcome, block.startsAt, now)`. `readWeek` (`:96-108`) перед преобразованием зовёт `loadMarks(executor, refs)` и накладывает отметки на блоки.

**`series.ts`** (`:20-58`): `moveSeries`/`endSeries` вставляют строки `lessons` по `CutLesson` (`:31-33`, `:53-55`) — после вставки получить `id` через `.returning({ id: lessons.id })` и вставить `lesson_marks` с `lessonId` и тем же `kind` для тех, у кого была отметка на ключе `s:<series>:<original_on>` (Pitfall 4). Образец вставки множества — `tx.insert(lessons).values(result.lessons.map((lesson) => ({ ...lesson, status: 'scheduled' })))`; `originalOn` в `CutLesson` не пишется в `lessons`, его нужно отделить до `values`.

---

### `apps/api/src/cards/card-facts.ts` — сырые строки в core (service, transform)

**Analog:** сам файл.

**Сегодня** (`card-facts.ts:15-44`): SQL фильтрует `gt(payments.paidOn, students.openingBalanceOn)`, `gt(payments.creditedMinutes, 0)`, `isNotNull(students.openingBalanceOn)` и отдаёт массив `creditedMinutes`. Станет: `select({ studentId, paidOn, creditedMinutes }).from(payments).where(inArray(payments.studentId, ids))` без фильтров даты, плюс `loadMarkRows(executor, ids)` из `../schedule/rows.ts` (импорт уже есть: `:6`), и вызов `balanceMinutes(card, payments, lessons)` из core. Группировку в `Map<string, ...[]>` сохранить как есть (`:34-39`). `FactSource` (`:13`) расширить `noShowDeducts`; для порога нужны `status` и `defaultLessonMinutes` — они в `CardRecord` (`card-rows.ts:13-29`).

`cardFacts(executor, cards, now)` остаётся единственным вызывающим: из `cards.ts::toDetail` (`:33-37`), `listCards` (`:55`) и нового `today/today.ts`.

---

### `apps/api/src/cards/cards.ts` и `card-rows.ts` — `noShowDeducts` (service, CRUD)

**Analog:** `cardValues` (`cards.ts:20-31`), `cardColumns` (`card-rows.ts:13-27`), `toStudentDetail` (`:56-70`).

Добавить `noShowDeducts: students.noShowDeducts` в `cardColumns`, `noShowDeducts: input.noShowDeducts` в `cardValues`, `noShowDeducts: row.noShowDeducts` в `toStudentDetail`. `importCard` (`cards.ts:123-131`) вызывает `cardValues({ ...card, parent: null, level: null, goals: null, timeZone: null })` — добавить `noShowDeducts: true` в этот объект (тип `Pick<SaveStudentInput, ...>` иначе не сойдётся с typecheck).

---

### `apps/api/src/routes/schedule.ts` — маршруты `/mark` (route, request-response)

**Analog:** сам файл, цикл cancel/restore (`:120-133` и `:145-158`).

**Копировать форму целиком** (серии):
```ts
routes.post('/series/:id/occurrences/:originalOn/cancel', async (c) => {
	const ref = occurrenceParam(c)
	if (ref === null) return notFound(c)
	const input = await readJson(c, lessonActionRequest)
	if (!input) return invalidRequest(c)
	const result = await change(db, ref.seriesId, ref.originalOn, input, new Date())
	if (result.kind !== 'ok') return refused(c, result)
	return c.json({ occurrence: result.occurrence } satisfies ScheduleOccurrenceResponse, 200)
})
```
Для отметки: `routes.post('/series/:id/occurrences/:originalOn/mark', ...)` и `routes.post('/lessons/:id/mark', ...)` с `markLessonRequest`; ошибки через общий `refused` (`:50-63`) — добавить `case 'not_started': return c.json(errorBody('lesson_not_started', 'This lesson has not started yet'), 400)`, по образцу `in_past` (`:58-59`). Заголовок роутера `routes.use('*', noStore, requireSession(db), requireRole('teacher'))` (`:86`); `idParam`/`occurrenceParam` (`:72-82`) использовать как есть. Метод POST (как у остальных мутаций, `mutate` шлёт POST).

---

### `apps/api/src/routes/today.ts` + `apps/api/src/today/today.ts` (route + service, request-response)

**Analog:** `routes/students.ts` (`GET /`, `:68-72`) для формы роутера; `schedule/schedule.ts::readWeek` (`:96-108`) для сборки окна.

**Роутер** (форма `students.ts:49,68-72`):
```ts
type StudentRouteDeps = { db: Database }
export function studentRoutes({ db }: StudentRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))
	routes.get('/', async (c) => c.json((await readSnapshot(db, listCards)) satisfies StudentsResponse, 200))
```
Today: `routes.get('/', async (c) => c.json((await readSnapshot(db, (executor) => readToday(executor, new Date()))) satisfies TodayResponse, 200))`. Модуль `today` собирает `schedule` и `cards` (схема зависимостей: `schedule` не импортирует `cards`, `card-facts` импортирует `schedule/rows`).

**Окно дня** — копировать из `readWeek` (`schedule.ts:97-100`): `const from = zonedInstant(today, '00:00', SCHEDULE_TIME_ZONE)`, `const to = zonedInstant(addDays(today, 1), '00:00', SCHEDULE_TIME_ZONE)`, `loadScheduleRows` → `scheduleWindow` → `blockStudents` → `toWireBlock`; `today` из `scheduleToday(now)`. Панель «Earlier, not marked» (D-12c): отдельный запрос прошедших неотмеченных после `openingBalanceOn` — через те же `scheduleWindow` + `awaitsMark`.

**Порог N:** `settings/settings.ts::readPaysSoonLessons(executor, accountId)` возвращает `PAYS_SOON_LESSONS_DEFAULT`, если строки нет.

---

### `apps/api/src/routes/settings.ts` + `apps/api/src/settings/settings.ts` (route + service, CRUD upsert)

**Analog:** `routes/students.ts` `PUT /:id/sections/:kind` (`:181-190`) и `cards/sections.ts::saveSection` (`:36-55`).

**Upsert одной строки с возвратом** (`sections.ts:42-54`):
```ts
const [row] = await executor
	.insert(studentSections)
	.values({ studentId, kind, body })
	.onConflictDoUpdate({
		target: [studentSections.studentId, studentSections.kind],
		set: { body, updatedAt: sql`now()` },
	})
	.returning(sectionColumns)
if (!row) throw new Error('student section upsert returned no row')
```
Для настройки: `target: teacherSettings.accountId`, `set: { paysSoonLessons, updatedAt: sql\`now()\` }`. Id аккаунта брать из сессии: `c.get('session').account.id` (тип `AppEnv.Variables.session` — `auth/middleware.ts:15-20`), не из тела (ASVS V4). Тело запроса — `readJson(c, updateSettingsRequest)`, ошибка → `errorBody('invalid_request', 'Invalid request')` как `invalidRequest` в `students.ts:51`. Роутер: `GET /` и `PATCH /`, ответ `{ paysSoonLessons }`.

---

### `apps/api/src/routes/payments.ts`, `routes/students.ts` — убрать `latestPaymentDate` (route)

**Analog:** `schedule/changes.ts::moveTarget` (`:63-67`) — сравнение даты запроса с датой по Вьетнаму:
```ts
if (input.date < zonedParts(now, SCHEDULE_TIME_ZONE).date) return null
```
Заменить `payments.ts:34-38` (`latestPaymentDate`, UTC + 1 сутки) и вызовы `payments.ts:55`, `students.ts:47,120` на `input.paidOn > scheduleToday(new Date())` / `input.on > scheduleToday(new Date())`; функцию и импорт `./payments.ts` в `students.ts` удалить. Поведение сознательно меняется (D-15).

---

### `apps/api/src/app.ts` — монтирование (config)

**Analog:** `app.ts:68-71`:
```ts
app.route('/students', studentRoutes({ db: deps.db }))
app.route('/payments', paymentRoutes({ db: deps.db }))
app.route('/schedule', scheduleRoutes({ db: deps.db }))
```
Добавить `app.route('/today', todayRoutes({ db: deps.db }))`, `app.route('/settings', settingsRoutes({ db: deps.db }))` и импорты рядом со строками `:13-16` (по алфавиту путей).

---

### `apps/web/app/(app)/page.tsx` + `_components/today-screen.tsx` (component, request-response)

**Analog:** `students/_components/students-screen.tsx` (скелет экрана) + `schedule/_components/schedule-screen.tsx` (минутное «сейчас», мутации, тосты).

**Страница-обёртка** (`schedule/page.tsx`): `requireTeacherPage()` и `<ScheduleScreen />`; текущая заглушка `app/(app)/page.tsx:12-21` проверяет роль через `getMe()` (для ученика возвращает `null`) — сохранить проверку, подставив `<TodayScreen />` вместо `PageScroll` с `EmptyLine`; `generateMetadata` оставить.

**Состояния чтения** (`students-screen.tsx:33-40,138-157,172-176`):
```ts
type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; students: StudentRow[]; unassigned: number }
async function readStudents(): Promise<ReadState> {
	const result = await apiRequest<StudentsResponse>('GET', '/students')
	return result.ok ? { kind: 'ready', ... } : { kind: 'error' }
}
...
if (state.kind === 'error') {
	header = <PageHeader title="Students" />
	body = <ReadError screen="students" onRefresh={load} />
}
```
Today: `ReadError screen="today"`, один экран при ошибке без частичных списков (память «ошибка чтения = один экран»). Скелетоны — `SkeletonTable`/`SkeletonText` (`students-screen.tsx:18,183,221`).

**Минутное «сейчас»:** `useScheduleNow()` в `schedule-screen.tsx:56-77` — вынести в общий хук (например `apps/web/hooks/use-minute-now.ts`) и использовать из обоих экранов (в `apps/web/hooks` есть каталог хуков). Не копировать `subscribeMinute` второй раз.

**Раскладка:** `PageScroll` + `PageHeader` + `Panel` (`components/app/layout-parts.tsx`); таблица/список в `Elevated` (`students-screen.tsx:69`); пустое — `EmptyLine`. `Stat`, `LessonList`, `DueList`, `EmptyState` в коде нет (см. «No Analog Found»).

**Тосты после отметки** (`schedule-screen.tsx:237-240`): `toast.show({ title: ..., description: \`${block.studentName}, ${vnWhen(new Date(block.startsAt), zone, currentYear)}.\` })`; `useToast` из `../../_components/toasts`.

**Счётчики:** `todayCounts(lessons, paysSoonCount, now)` из core, не повторять правило в JSX (D-16); импорт мутаций из `../schedule/_components/schedule-mutations` — прецедент `students-screen.tsx:29` (импорт `useSecondZone` из расписания).

---

### `schedule-mutations.ts` — `'mark'` (utility, request-response)

**Analog:** сам файл (`:19-21,63-66`).
```ts
export type LessonAction = 'move' | 'cancel' | 'restore'
export type LessonBody = { date?: string; startTime?: string; expectedStartsAt?: string }
```
Добавить `'mark'` в `LessonAction` и `kind?: MarkKind` в `LessonBody`; `pathOf` (`:31-37`) путь соберёт сам (`.../mark`). Разбор ответа: `409`/`404` → `{ kind: 'stale' }` (`:63-66`) — не менять. `changedStart` (`:39-41`) читает `'occurrence' in data`; для `{ mark }` расширить `LessonChange` или завести отдельный тип результата.

---

### `lesson-dialog.tsx` — кнопки отметок (component, request-response)

**Analog:** сам файл — `run`, `plannedActions`, `DialogFooter`.

**Состояние pending и баннер** (`:105-129`):
```ts
async function run(action: () => Promise<ActionOutcome>, failure: 'cancel' | 'restore') {
	if (pending) return
	setPending(true)
	setNotice(null)
	const outcome = await action()
	setPending(false)
	setConfirming(false)
	setNotice(outcome === 'ok' ? null : outcome === 'stale' || outcome === 'past' ? outcome : failure)
}
```
Добавить `onMark: (kind: MarkKind) => Promise<ActionOutcome>` в `LessonDialogProps` (`:48-63`), расширить `Notice`/`FAILURE` (`:65-71`) значением `mark` («Could not save the mark. Try again.» по UI-SPEC C2) и пропустить через тот же `run`. Условия показа (`:116-119`):
```ts
const live = block.changeable && canChange(start, now)
const plannedActions = live && block.status === 'scheduled'
const restoreAction = live && block.status === 'cancelled'
```
заменить на `block.actions.move/cancel/restore/mark` из контракта (`changeable` и `canChange` из диалога уйдут; подпись «already taken place» `:189-193` и `FAILURE.past` `:68` — тексты исправить по DR-10). Кнопки — `Button variant="secondary" size="compact" leadingIcon={...}` из `DialogFooter` (`:297-321`); иконки `Check`/`UserX` (lucide, как `CalendarClock`/`CalendarX2` на `:5`). Порядок работы: после UI-планов A/B (D-12), вид кнопок и неявки — по ответу Design dude.

---

### `lesson-block.tsx`, `event-tooltip.tsx`, `schedule-format.ts`, `schedule-screen.tsx` — читатели исхода (component, transform)

**Analog:** сами файлы.

`lesson-block.tsx:13-15` `blockSlot`: `block.status === 'moved' ? 'from' : 'to'` → `block.outcome === 'moved'`. Таблицы `DOT` и `STATUS_CLASS` (`:24-28`, `:47-51`) — `Record<ScheduleBlockStatus, string>`; переключить ключ на `ScheduleLessonOutcome` и добавить `done`, `no_show`, `planned`:
```ts
const DOT: Record<ScheduleBlockStatus, string> = {
	scheduled: 'bg-info', cancelled: 'bg-destructive', moved: 'bg-warning',
}
```
`LessonStatus` (`:30-45`) и `statusWord` (`:79-84`) — слово исхода; `event-tooltip.tsx:74,97` — то же. `schedule-format.ts::weekSummary` (`:156-165`) считает `block.status === 'scheduled'`/`'cancelled'` → «урок» = исход `planned|done|no_show` (одна функция из core, не фильтр по строкам). `schedule-screen.tsx:168` (`blocksOn` → `OverlapItem.status`) и `:274` (`planned`) — тоже; `overlaps` в core (`schedule.ts:239-251`) считает занятыми `status === 'scheduled'`, после введения `done`/`no_show` решить, чтобы начавшиеся отмеченные уроки не освобождали слот.

**`changeLesson`** (`schedule-screen.tsx:228-242`) — образец для `markLesson`: `mutate(block.ref, 'mark', { kind, expectedStartsAt: block.startsAt })`, ветка `failed` → `'failed'`, `stale` → `reload()` + `'stale'`, успех → `reload()` + `toast.show` + `'ok'`. Ветку `lesson_in_past` (`:230-233`) оставить только для move.

---

### `apps/web/app/(app)/settings/` + карточка N (component, CRUD)

**Analog:** `students-screen.tsx` (Tabs + Panel каркас, `:193-229`), `opening-balance-panel.tsx` (поле с сохранением по месту и тостом), `sections.ts` / `app-sidebar.tsx` для пункта меню.

**Каркас вкладок** (`students-screen.tsx:193-207`): `Tabs value onValueChange` + `TabsList` + `TabItem value label` + `TabPanel`; одна вкладка «General» (UI-SPEC B4). **Пункт Settings** — добавить в `sections` (`_components/sections.ts:11-16`, последним) и использовать существующий `isSectionActive`. **Карточка** — `Panel title description` (`layout-parts.tsx`, `Panel`). **Сохранение по blur/Enter с тостом:** `opening-balance-panel.tsx` (`apiRequest<StudentResponse>('PUT', ...)`, `useToast`, состояния `pending`/`failed`/`touched`); поле — `TextField` (`components/app/text-field.tsx`). Текст ошибки «Use a whole number from 0 to 20.» — по D-12b. Данные: `apiRequest('GET', '/settings')`, `PATCH`.

Страница-обёртка — по образцу `students/page.tsx` (`requireTeacherPage()` + экран, `metadata`).

---

### `ledger-text.tsx`, `students-screen.tsx`, `student-profile.tsx`, `opening-balance-panel.tsx`, `record-payment-dialog.tsx` — остаток и долг (component, transform)

**Analog:** сами файлы.

- `ledger-text.tsx:79-88` `balanceCaption`: условие `paidOn <= openingBalance.on` заменить на `!countsAfterOpening(paidOn, openingBalance.on)` из core (D-13). Подпись «Payments dated on or before…» — после фазы затрагивает и уроки (текст за Design dude).
- `ledger-text.tsx:25-37` `LessonsText`: `formatLessons`/`lessonsPhrase` → при долге использовать `balancePhrase` из core; префикс `phrase` не повторять руками.
- `student-profile.tsx:92-115` `SummaryLine`: сейчас `<LessonsText ... phrase /> left`; суффикс « left» зашит в JSX — перенести в `balancePhrase`.
- `students-screen.tsx:115-121`: `student.balanceMinutes === null` → «Set opening balance» (оставить), иначе `LessonsText` — отрицательное уже печатается как «-1.5» (`formatLessons`, `signDisplay: 'negative'`).
- `opening-balance-panel.tsx:38,140`, `record-payment-dialog.tsx:57`: `localIsoDate(new Date())` → `scheduleToday(new Date())`.

---

### флаг `noShowDeducts` на карточке (component, CRUD)

**Analog:** `students/_components/student-form-dialog.tsx` (`Values` `:55-65`, `initialValues` `:81-105`, отправка `apiRequest` `:222-235`).

Если переключатель живёт в форме: добавить поле `noShowDeducts: boolean` в `Values`, значение по умолчанию `true` в `initialValues` (ветка создания) и `student.noShowDeducts` (ветка правки), и ключ в теле PATCH рядом с `timeZone: ...` (`:233`). Если дизайн (DR-12) вынесет переключатель в профиль, нужен отдельный `PUT /students/:id/no-show-deducts` — образец `routes.put('/:id/opening-balance', ...)` (`routes/students.ts:115-124`) и `setOpeningBalance` (`cards/cards.ts:97-121`, транзакция с `FOR UPDATE`). Компонент `Switch` — копия из design-lab (`components/ui/switch.tsx`, R9 в UI-SPEC).

---

### `scripts/dev-checks/ledger-core.mjs`, `ledger-api.mjs`, `ledger-db.mjs` (приёмка, batch)

**Analog:** `schedule-core.mjs`, `schedule-api.mjs`, `schedule-db.mjs`.

**`ledger-core.mjs`** — импорт исходников core напрямую и самодельный `check` (`schedule-core.mjs:1-18`):
```js
import * as core from '../../packages/core/src/index.ts'
import { quote, sql } from './api.mjs'
const VN = core.SCHEDULE_TIME_ZONE
let failures = 0
function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else { failures += 1; console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`) }
}
```
Фиксированные `NOW`/`rule`/`at` помощники — `schedule-core.mjs:97-110`. Кейсы: урок 00:30 VN, 23:30 VN, урок в день открытия, оплата в день открытия, 60/90 минут, `no_show` с `noShowDeducts` true/false, `null` ≠ 0, порог N. Сверку дат с SQL — как `sql(\`select ((date ${quote(date)} + time ${quote(time)}) at time zone ${quote(zone)}) ...\`)` (`schedule-core.mjs:28-37`).

**`ledger-api.mjs`** — запуск api и фикстуры (`schedule-api.mjs:1-65`): `startApi({ port })` (новый порт, `schedule-api.mjs` занимает 4201), `teacherCookie(api)`, `call(api, method, path, { cookie, body })`, карточки `Alex Example 20NN` с префиксом, `removeTails()`/`removeOwn(ids)`. **Важно:** `removeCards` (`:25-33`) удаляет по цепочке `lesson_exceptions` → `lessons` → `lesson_series` → `students` под ролью migrator; в `ledger-api.mjs` первым шагом добавить `delete from lesson_marks where ...` (FK restrict), иначе уборка упадёт. Использовать другой префикс имён (например `Alex Example 21`), чтобы `removeTails` старого скрипта не стирал чужие фикстуры.

**`ledger-db.mjs` / правка `schedule-db.mjs`** (`schedule-db.mjs:9-11,41`): `EXPECTED_FOLDERS = 5` → 7 и `TABLES` добавить `'lesson_marks'` (привилегии `delete: false`, `truncate: false`, `PRIVILEGES` `:11`), либо вынести проверки новых таблиц в `ledger-db.mjs` с теми же `checkMigrationFile`/`runProbes`/`checkPrivileges` и пробами (`probeCode`, транзакция `begin; ... rollback;`, коды `23514`, `23505`). Параллельная правка `migrate()` не нужна — она считает папки сама.

## Shared Patterns

### Авторизация и конверт ошибки (все новые маршруты)
**Source:** `apps/api/src/routes/schedule.ts:86` и `apps/api/src/request-context.ts` (`errorBody`), `apps/api/src/auth/middleware.ts:74-98` (`requireSession`, `requireRole`, `readJson`, `noStore`).
**Apply to:** `routes/today.ts`, `routes/settings.ts`, новые маршруты `/mark`.
```ts
const routes = new Hono<AppEnv>()
routes.use('*', noStore, requireSession(db), requireRole('teacher'))
const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)
const notFound = (c: Context<AppEnv>) => c.json(errorBody('not_found', 'Not Found'), 404)
```
Ответ `c.json(payload satisfies XResponse, status)`; конверт `{ error: { code, message, requestId } }`; новые коды добавлять только в `errorCodes` (`contracts/src/auth.ts:42-65`).

### Транзакция с блокировкой строки
**Source:** `apps/api/src/schedule/changes.ts:134-159` и `apps/api/src/schedule/rows.ts:111-119` (`lockSeries`, `lockLesson` через `.for('update')`); `cards/cards.ts:97-121` (`setOpeningBalance`).
**Apply to:** `marks.ts`, перенос отметок в `series.ts`, `setNoShowDeducts`.

### Upsert вместо SELECT+INSERT/UPDATE
**Source:** `changes.ts:87-94`, `cards/sections.ts:42-54`.
**Apply to:** `lesson_marks`, `teacher_settings`. Всегда `updatedAt: sql\`now()\`` в `set`, `.returning(columns)` и `throw new Error('... returned no row')` при пустом результате.

### Читающие снимки
**Source:** `apps/api/src/schedule/rows.ts:145-147` (`readSnapshot`, repeatable read, read only), использование `routes/students.ts:72,84`, `routes/schedule.ts:92`.
**Apply to:** `GET /today`, `GET /settings`, любые чтения нескольких таблиц.

### Core: чистые функции без зависимостей
**Source:** `packages/core/src/index.ts` (`export * from './x.ts'`), `schedule.ts`, `lessons.ts`.
**Apply to:** `balance.ts`, `schedule.ts`, `lessons.ts`, возможный `today.ts`. Новый файл — добавить строку в `index.ts`. Нет `node:*`, `process.env`, `pg`, `@dv-lab/*` (проверка CI «Web and api boundary»).

### Web: чтение через `apiRequest`, состояние `loading|error|ready`, одиночный `ReadError`
**Source:** `apps/web/lib/api-client.ts`, `students-screen.tsx:33-40,172-176`, `schedule-screen.tsx:49-54,257-263`.
**Apply to:** Today, Settings.

### Web: мутации расписания только через `mutate`
**Source:** `schedule-mutations.ts:44-66`, `AGENTS.md` (правило).
**Apply to:** быстрые кнопки Today и кнопки в `LessonDialog` (одна логика, два входа, D-11).

### Подпись «VN» и двойное время
**Source:** `components/app/time-pair.tsx`, `lib/schedule-format.ts` (`formatRange`, `vnWhen`, `secondRange`).
**Apply to:** строки уроков на Today; ручное форматирование времени запрещено.

### Фикстуры приёмки и приватность
**Source:** `scripts/dev-checks/README.md`, `schedule-api.mjs:12-45`.
**Apply to:** все `ledger-*.mjs`: только карточки `Alex Example NNNN`, уборка за собой, секретов и имён учеников в коде нет; вывод скриптов цитируется в SUMMARY.

## No Analog Found

| Файл | Роль | Поток | Причина |
|------|------|-------|---------|
| `components/app/stat.tsx` (`Stat`, счётчики Today) | component | transform | В коде нет; брать из дизайн-системы `~/dv-lab-design/project/components/Stat/` (README, preview), версия по `VERSION` |
| `components/ui/switch.tsx` (`Switch`) | component | event-driven | Нет в `components/ui`; копия по `~/dv-lab-design/project/components/Switch/` (R9 UI-SPEC) |
| `components/app/empty-state.tsx` (`EmptyState`) и `LessonList` / `DueList` строки | component | transform | Есть только `EmptyLine` (`components/app/empty-line.tsx`); `LessonList`/`DueList` в коде нет, вид быстрых Done / No-show и «Upcoming payments» без срока и суммы ждёт ответа Design dude (DR-9, DR-13); нельзя придумывать |

## Metadata

**Analog search scope:** `packages/db/src`, `packages/db/drizzle`, `packages/core/src`, `packages/contracts/src`, `apps/api/src/{schedule,cards,routes,auth,import}`, `apps/web/app/(app)/{schedule,students,_components}`, `apps/web/components/app`, `apps/web/lib`, `scripts/dev-checks`.
**Files scanned:** ~45 (прочитаны целиком: `schema.ts`, `balance.ts`, `lessons.ts`, `core/schedule.ts`, `rows.ts`, `changes.ts`, `schedule/schedule.ts`, `series.ts`, `routes/{schedule,students,payments}.ts`, `cards/{card-facts,cards,card-rows,sections}.ts`, `contracts/src/{schedule,students}.ts`, `schedule-mutations.ts`, `lesson-dialog.tsx`, `lesson-block.tsx`, `schedule-screen.tsx`, `students-screen.tsx`, `ledger-text.tsx`; частично: остальные).
**Pattern extraction date:** 2026-10-10
