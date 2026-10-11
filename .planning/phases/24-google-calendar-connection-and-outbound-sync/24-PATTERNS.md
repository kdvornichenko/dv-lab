# Phase 24: Google Calendar — Pattern Map

**Mapped:** 2026-10-11
**Files classified:** 53: 16 NEW, 34 MOD, 3 GENERATED. Это будущий write set, не выполненные изменения.
**Analogs found:** 44 / 53 структурных назначений: 39 exact, 4 role-match, 1 flow-match; 9 без готового аналога. Поиск остановлен на пяти основных аналогах P1–P5. Existing-owner назначения не означают наличие нового Calendar поведения.

## Scope

Результат — карта для planner по CONTEXT D-01…D-12, RESEARCH, ARCH-REVIEW и финальному UI draft. Здесь записывается только этот файл. Приёмка карты: SC1–SC6 и GCAL-01/02/03/09/10 имеют владельца, границу вызова и будущую проверку; пять аналогов прочитаны и git-tracked; fingerprints и doc-check воспроизводимы. Реализация, install, env/runtime/DB/browser/Google, Git mutations, parent-owned документы и UI-аудит вне этой работы.

A1: код Phase 21.1 отсутствует в baseline; его интерфейс — зависимость, а не существующие exports. Основание: текущий запрос и Stable Interface в 21.1-RESEARCH. Опровергается реализованным совместимым source; перед исполнением planner привязывает карту к нему. A2: UI binding соответствует проверенному draft, включая C24 `Keep connected`; изменение DTO или компонента требует обновления затронутой строки, смена copy — только fingerprint.

Карта работы: входы → классификация; P1–P5 и существующие owners → call/copy и сигнатуры; SC/evidence → doc-check. Stop: документ прошёл проверку; отсутствующий source 21.1 и внешняя приёмка явно остаются зависимостями. Новых product/install gates эта карта не вводит.

## File Classification

`NEW` — предложенный путь, ещё не source. `MOD` — будущая правка существующего владельца. `GENERATED` — результат штатного генератора, не ручной шаблон. `owner exact` означает продолжить владельца в этой же строке; это не шестой найденный аналог. P1–P5 раскрыты ниже; S1 — существующий владелец общих schemas.

| New/Modified File                                                | State     | Role       | Data Flow        | Closest Analog | SC                  | Owner / boundary                                                                                    |
| ---------------------------------------------------------------- | --------- | ---------- | ---------------- | -------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/calendar.ts`                             | NEW       | model      | request-response | S1 exact       | SC1,SC4,SC5         | Strict schemas/DTO; request projection, connection/sync axes, CalendarIssue.                        |
| `packages/contracts/src/auth.ts`                                 | MOD       | model      | request-response | owner exact    | SC1,SC4,SC5         | Extend errorCodes; preserve ErrorResponse envelope.                                                 |
| `packages/contracts/src/index.ts`                                | MOD       | config     | transform        | owner exact    | SC1,SC4,SC5         | Export calendar.ts; no SDK/core imports.                                                            |
| `packages/db/src/schema.ts`                                      | MOD       | model      | CRUD             | owner exact    | SC1,SC2,SC3,SC4     | Connection/flow/mapping/intent/journal constraints; encrypted fields.                               |
| `packages/db/drizzle/<generated>/migration.sql`                  | GENERATED | migration  | batch            | none           | SC1,SC2,SC3,SC4     | Only generator output; additive domain schema.                                                      |
| `packages/db/drizzle/<generated>/snapshot.json`                  | GENERATED | config     | transform        | none           | SC1,SC2,SC3,SC4     | Paired generator output; exact folder assigned by generator.                                        |
| `apps/api/src/calendar/connection.ts`                            | NEW       | service    | request-response | P3 role-match  | SC1,SC4             | Consent, flow binding, primary identity, snapshot, disconnect/reconnect.                            |
| `apps/api/src/calendar/credentials.ts`                           | NEW       | service    | CRUD             | P3 role-match  | SC1,SC4             | Envelope crypto, credential persistence, refresh lock and generation CAS.                           |
| `apps/api/src/calendar/gateway.ts`                               | NEW       | service    | request-response | none           | SC1,SC2,SC5         | Only Google transport; validation, pagination, sanitized errors.                                    |
| `apps/api/src/calendar/event-mapping.ts`                         | NEW       | utility    | transform        | none           | SC2,SC5             | Deterministic IDs, canonical instance mapping, minimal event projection.                            |
| `apps/api/src/calendar/outbox.ts`                                | NEW       | service    | event-driven     | P2 role-match  | SC2,SC3             | Atomic recorder/revisions, pending work, CAS acknowledgement.                                       |
| `apps/api/src/calendar/transitions.ts`                           | NEW       | service    | event-driven     | P2 role-match  | SC2,SC3             | Persisted lineage and ordered cut/end recovery; no local re-cut.                                    |
| `apps/api/src/calendar/worker.ts`                                | NEW       | service    | event-driven     | none           | SC2,SC3,SC4         | Pump, singleton queue, latest-state writer, start/close.                                            |
| `apps/api/src/routes/google.ts`                                  | NEW       | route      | request-response | P1 exact       | SC1,SC4,SC5         | Teacher routes; safe callback; fixed redirect.                                                      |
| `apps/api/src/routes/schedule.ts`                                | MOD       | route      | request-response | P1 exact       | SC2,SC3             | Pass authenticated account/recorder into domain calls.                                              |
| `apps/api/src/schedule/schedule.ts`                              | MOD       | service    | CRUD             | P2 exact       | SC2,SC3             | Intent before return from single/series creation transaction.                                       |
| `apps/api/src/schedule/changes.ts`                               | MOD       | service    | CRUD             | P2 exact       | SC2,SC3             | Intent for successful single/occurrence move/cancel/restore.                                        |
| `apps/api/src/schedule/series.ts`                                | MOD       | service    | CRUD             | P2 exact       | SC2,SC3             | Return detached ID lineage; append cut/end journal in same tx.                                      |
| `apps/api/src/schedule/rows.ts`                                  | MOD       | service    | CRUD             | owner exact    | SC2,SC3,SC5         | Canonical by-ref/bootstrap projection and proposed interval loading; no Google DTO.                 |
| `apps/api/src/routes/students.ts`                                | MOD       | route      | request-response | P1 exact       | SC2,SC3             | Pass teacher-bound title-change recorder; preserve cards write ownership.                           |
| `apps/api/src/cards/cards.ts`                                    | MOD       | service    | CRUD             | P2 exact       | SC2,SC3             | Keep card write/old-name comparison under its own transaction; call supplied title-change recorder. |
| `apps/api/src/app.ts`                                            | MOD       | config     | request-response | owner exact    | SC1,SC2,SC3,SC4,SC5 | Inject Calendar dependencies; mount /google; no startup during import.                              |
| `apps/api/src/config.ts`                                         | MOD       | config     | transform        | owner exact    | SC1,SC3             | Validate Calendar config/key names centrally; values never in evidence.                             |
| `apps/api/src/server.ts`                                         | MOD       | config     | event-driven     | owner exact    | SC1,SC3             | Compose services, start worker, register it before pool.                                            |
| `apps/api/src/migrate.ts`                                        | MOD       | config     | batch            | owner exact    | SC3                 | pg-boss schema/queue setup under migrator; no runtime DDL.                                          |
| `deploy/postgres/ensure-db.sql`                                  | MOD       | config     | batch            | owner exact    | SC3                 | Separate queue privileges; preserve domain no-delete policy.                                        |
| `deploy/caddy/Caddyfile`                                         | MOD       | config     | request-response | owner exact    | SC1                 | Redact OAuth query; preserve /api prefix stripping/address trust.                                   |
| `deploy/compose.yaml`                                            | MOD       | config     | event-driven     | owner exact    | SC1,SC3             | Config wiring into existing api/migrate services; no new service topology.                          |
| `.env.example`                                                   | MOD       | config     | transform        | owner exact    | SC1,SC3             | Names-only placeholders; content not inspected in this task.                                        |
| `deploy/env.example`                                             | MOD       | config     | transform        | owner exact    | SC1,SC3             | Deployment names-only placeholders; no credentials.                                                 |
| `apps/api/package.json`                                          | MOD       | config     | batch            | owner exact    | SC1,SC3             | Future exact pg-boss/googleapis pins from RESEARCH; not installed here.                             |
| `yarn.lock`                                                      | GENERATED | config     | batch            | none           | SC1,SC3             | Generated by separately authorized dependency change; no manual copy.                               |
| `apps/web/hooks/use-google-connection.ts`                        | NEW       | hook       | request-response | P4 flow-match  | SC4                 | Shared safe snapshot/read/reload logic for Settings and Schedule.                                   |
| `apps/web/app/(app)/settings/_components/calendar-panel.tsx`     | NEW       | component  | request-response | P4 exact       | SC1,SC4             | Connection/Sync, primary-only, consent and confirmed disconnect.                                    |
| `apps/web/app/(app)/settings/_components/settings-screen.tsx`    | MOD       | component  | request-response | P4 exact       | SC4                 | Add calendar tab using existing URL-tab owner.                                                      |
| `apps/web/app/(app)/schedule/_components/schedule-screen.tsx`    | MOD       | component  | request-response | P4 exact       | SC4                 | Render truthful Calendar status banner; local schedule stays usable.                                |
| `apps/web/app/(app)/schedule/_components/google-conflicts.tsx`   | NEW       | component  | request-response | P4 exact       | SC5                 | Shared useGoogleConflicts and complete-result presentation; no recurrence.                          |
| `apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx`  | MOD       | component  | request-response | owner exact    | SC5                 | Pass validated candidate; Check through state below Repeats; notices above fields.                  |
| `apps/web/app/(app)/schedule/_components/new-lesson-content.tsx` | MOD       | component  | request-response | owner exact    | SC5                 | Compose Google notice separately from existing local overlaps.                                      |
| `apps/web/app/(app)/schedule/_components/lesson-move-form.tsx`   | MOD       | component  | request-response | owner exact    | SC5                 | Candidate with current ref; unsaved-input guard before Settings navigation.                         |
| `apps/web/app/(app)/schedule/_components/move-series-dialog.tsx` | MOD       | component  | request-response | owner exact    | SC5                 | Finite check of future rule through shared conflict owner.                                          |
| `apps/web/components/app/date-field.tsx`                         | MOD       | component  | request-response | owner exact    | SC5                 | Explicit nullable empty state; never format an empty date.                                          |
| `apps/web/app/welcome/page.tsx`                                  | NEW       | route      | request-response | none           | SC6                 | Static public homepage outside (app); reuse root theme and approved copy.                           |
| `apps/web/app/privacy/page.tsx`                                  | NEW       | route      | request-response | none           | SC6                 | Static privacy data-flow disclosure from UI-SPEC.                                                   |
| `apps/web/app/terms/page.tsx`                                    | NEW       | route      | request-response | none           | SC6                 | Static terms; common approved links, no session request.                                            |
| `apps/web/proxy.ts`                                              | MOD       | middleware | request-response | owner exact    | SC6                 | Exact public pathname allowlist; private root remains guarded.                                      |
| `e2e/calendar.spec.ts`                                           | NEW       | test       | request-response | P5 exact       | SC1,SC4,SC5,SC6     | Durable consent/connection/conflict/public-page journey in existing harness.                        |
| `e2e/move.spec.ts`                                               | MOD       | test       | request-response | P5 exact       | SC2,SC3             | Rapid edits, restart/lost response, cut/end and retained history.                                   |
| `e2e/marks.spec.ts`                                              | MOD       | test       | request-response | P5 exact       | SC2                 | Detached marked tail and zone invariants through existing journey.                                  |
| `e2e/no-show.spec.ts`                                            | MOD       | test       | request-response | P5 exact       | SC2                 | Cancel/restore of canonical single and recurring instance.                                          |
| `e2e/support/api.ts`                                             | MOD       | utility    | request-response | owner exact    | SC1,SC2,SC3,SC4,SC5 | Typed public API inputs and decoded minimal Calendar facts.                                         |
| `e2e/support/test.ts`                                            | MOD       | test       | request-response | P5 exact       | SC1,SC2,SC3,SC4,SC5 | Extend existing fixture lifecycle for authorized Calendar journey.                                  |
| `e2e/support/data.ts`                                            | MOD       | utility    | file-I/O         | owner exact    | SC1,SC2,SC3,SC4,SC5 | Reuse private STATE_DIR/owned-fixture boundary; no secret/event-body evidence.                      |

Путь новой общей web-логики ограничен двумя повторно используемыми владельцами: `use-google-connection.ts` нужен Settings и Schedule; `google-conflicts.tsx` нужен create/move/whole-series forms. Отдельный provider framework, store, cron service, Calendar repository, новый public shell и второй API client не требуются. Размер и cohesion проверяются при реализации, без механического дробления заранее.

Строки cards/routes-students выведены из RESEARCH `2 и `8: канонический `studentName` входит в event summary, а `updateCard` действительно меняет displayName. Замена только времени не закрывает актуальность title. Само переименование остаётся операцией cards; новые account/payment/mark правила в scope не входят.

## Pattern Assignments

| ID  | Tracked source                                              | Copy scope                                                                                  |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| P1  | `apps/api/src/routes/settings.ts`                           | Hono route factory, teacher guard, readJson, typed response/error envelope                  |
| P2  | `apps/api/src/schedule/series.ts`                           | Same transaction, domain result, inserted ID and mark lineage                               |
| P3  | `apps/api/src/auth/sessions.ts`                             | Opaque random state, digest lookup, DB epoch predicates; не OAuth/encryption implementation |
| P4  | `apps/web/app/(app)/settings/_components/payments-card.tsx` | apiRequest, late-response guard, separate read/error state, existing Panel                  |
| P5  | `e2e/move.spec.ts`                                          | Existing durable UI journey with public-response and real-persistence assertions            |

### P1 — routes/google.ts и HTTP wiring

**Imports, lines 1–10:**

```ts
import type { Context } from 'hono'
import { Hono } from 'hono'

import { type SettingsResponse, updateSettingsRequest } from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { errorBody } from '../request-context.ts'
import { readSnapshot } from '../schedule/rows.ts'
import { readPaysSoonLessons, savePaysSoonLessons } from '../settings/settings.ts'
```

**Guard, validation и result, lines 14–30:**

```ts
const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

export function settingsRoutes({ db }: SettingsRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/', async (c) => {
		const accountId = c.get('session').account.id
		const paysSoonLessons = await readSnapshot(db, (executor) => readPaysSoonLessons(executor, accountId))
		return c.json({ settings: { paysSoonLessons } } satisfies SettingsResponse, 200)
	})

	routes.patch('/', async (c) => {
		const input = await readJson(c, updateSettingsRequest)
		if (!input) return invalidRequest(c)
		const paysSoonLessons = await savePaysSoonLessons(db, c.get('session').account.id, input.paysSoonLessons)
		return c.json({ settings: { paysSoonLessons } } satisfies SettingsResponse, 200)
	})
```

Copy factory/guard/validation structure для `routes/google.ts`. Вызвать существующие middleware и `errorBody`, не копировать их реализации. `routes/schedule.ts` и `routes/students.ts` уже имеют этот HTTP слой; расширить только dependency wiring. Account ID берётся из session, не из body.

Показанный import `readSnapshot` — baseline. По 21.1-PATTERNS:465 его целевой owner — `packages/db/src/connection.ts`, export через `@dv-lab/db`. Новый Calendar route использует этот целевой owner после 21.1, не создаёт зависимость Google → schedule ради общего read helper.

Callback GET сохраняет session/teacher/state binding. `sameOrigin` уже пропускает GET (middleware:26–41), поэтому Origin не заменяет проверку callback. POST connect/disconnect/conflicts проходит существующий same-origin guard из `app.ts:44–47`. Добавить callback `no-store` и `Referrer-Policy: no-referrer`; не ослаблять глобальную защиту.

### P2 — recorder, lineage и schedule transactions

**Imports, lines 4–10:**

```ts
import type { ScheduleSeries, endSeriesRequest, moveSeriesRequest } from '@dv-lab/contracts'
import { type CutLesson, type MarkKind, cutSeries, endSeriesAt } from '@dv-lab/core'
import { type Database, type DbExecutor, lessonMarks, lessonSeries, lessons } from '@dv-lab/db'

import type { ChangeFailure } from './changes.ts'
import { lockSeries, seriesColumns, seriesExceptionsFrom, seriesMarksFrom, toSeriesRule } from './rows.ts'
import { toWireSeries } from './schedule.ts'
```

**Inserted identity and mark, lines 20–34:**

```ts
async function keepCutLessons(executor: DbExecutor, cut: readonly CutLesson[], marks: ReadonlyMap<string, MarkKind>) {
	for (const lesson of cut) {
		const [row] = await executor
			.insert(lessons)
			.values({
				studentId: lesson.studentId,
				startsAt: lesson.startsAt,
				durationMinutes: lesson.durationMinutes,
				status: lesson.status ?? 'scheduled',
			})
			.returning({ id: lessons.id })
		if (!row) throw new Error('lesson insert returned no row')
		const mark = marks.get(lesson.originalOn)
		if (mark !== undefined) await executor.insert(lessonMarks).values({ lessonId: row.id, kind: mark })
	}
```

**Transaction/core refusal, lines 37–44:**

```ts
export function moveSeries(db: Database, id: string, input: MoveSeriesInput, now: Date): Promise<MoveSeriesResult> {
	return db.transaction(async (tx): Promise<MoveSeriesResult> => {
		const rule = await lockSeries(tx, id)
		if (rule === null) return { kind: 'not_found' }
		const exceptions = await seriesExceptionsFrom(tx, id, input.from)
		const marks = await seriesMarksFrom(tx, id, input.from)
		const result = cutSeries(rule, exceptions, input, now, marks)
		if (result.kind !== 'ok') return { kind: result.kind }
```

Продолжить этот owner: `keepCutLessons` возвращает `originalOn → row.id`, сохраняя zone и marks по 21.1. Транзакция уже обновляет old ends, сохраняет tail и создаёт new rule (45–52); end использует тот же seam (56–71). Записать intent/journal до выхода из этой транзакции. Ошибка recorder должна откатить domain change; отказ domain validation не создаёт intent.

`calendar/outbox.ts` и `transitions.ts` копируют transaction/result дисциплину, но NEW outbox/ETag/retry алгоритмы берут из RESEARCH `2/`5. Не копировать всю series.ts и не вызывать HTTP внутри tx. `schedule.ts:175–227` закрывает обе create-ветки; duplicate-existing series не получает фиктивную новую revision. `changes.ts:120–251` содержит все шесть move/cancel/restore мутаций; записывать intent только после успешной записи, включая helper-return paths.

Title invalidation: `cards/cards.ts:69–83` остаётся владельцем updateCard. Добавить его атомарный callback при реальной смене имени; teacher-bound callback передаёт `routes/students.ts:89–96`. Он получает refs через schedule row owner и пишет outbox в том же tx. Это закрывает projected field, не переносит владение cards в calendar.

### P3 — connection.ts и credentials.ts

**Crypto/import conventions, lines 1–2, 10–12:**

```ts
import { and, eq, sql } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'
```

```ts
import { type DbExecutor, accounts, sessions } from '@dv-lab/db'

import { accountSummaryColumns, toAccountSummary } from './account-rows.ts'
```

**Opaque secret/digest, lines 20–35:**

```ts
export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex')
}

export async function issueSession(
	executor: DbExecutor,
	{ accountId, authEpoch }: { accountId: string; authEpoch: number }
): Promise<string> {
	const token = randomBytes(32).toString('base64url')
	await executor.insert(sessions).values({
		tokenHash: hashSessionToken(token),
		accountId,
		authEpoch,
		expiresAt: sql`now() + make_interval(secs => ${SESSION_TTL_SECONDS})`,
	})
	return token
```

**Validated DB identity, lines 48–53:**

```ts
and(
	eq(sessions.tokenHash, hashSessionToken(token)),
	sql`${sessions.expiresAt} > now()`,
	eq(accounts.status, 'active'),
	eq(accounts.authEpoch, sessions.authEpoch)
)
```

Copy random state + digest persistence + expiry/epoch predicates. Call auth owner для app session. `AppEnv` уже содержит session.token (middleware:15–19), но `AccountSummary` не содержит authEpoch (contracts/auth:76); NEW connection flow привязывается к проверенной session/epoch в БД. Нельзя выдавать authEpoch за существующее поле client DTO.

Refresh token нужен для использования, поэтому session hash не заменяет encryption. Envelope/AAD/KEK rotation, consumed state/PKCE, cross-process refresh lock и generation CAS — NEW поведение credentials/connection. `sessions.ts:70–88` удаляет app sessions: эту deletion policy не переносить на Calendar mappings/intents. Provider ошибки нормализовать до возвращения/логирования; app global onError логирует Error, а не безопасно разбирает любой SDK объект.

### P4 — web connection и conflicts

**Imports, lines 3–8:**

```tsx
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { Panel } from '@/components/app/layout-parts'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api-client'
```

**Read guard, lines 41–51:**

```tsx
	useEffect(() => {
		let current = true
		void apiRequest<SettingsResponse>('GET', '/settings').then((result) => {
			if (!current) return
			if (!result.ok) {
				setLoadFailed(true)
				return
			}
			saved.current = result.data.settings.paysSoonLessons
			setText(String(result.data.settings.paysSoonLessons))
			setReady(true)
```

Cleanup выставляет `current = false` (53–57); save освобождает inflight/saving в finally (98–101). Copy lifecycle/query discipline, затем в общем hook валидировать Calendar snapshot схемой contracts: существующий generic `apiRequest` использует cast, он не подтверждает DTO. Не переносить PaymentsCard autosave/revert timer в consent/disconnect. `calendar-panel.tsx` вызывает hook и существующие Panel/Banner/ReadError/Skeleton/ConfirmDialog, не копирует компоненты.

`settings-screen.tsx:13–18,62–77` — точный owner URL tab. `calendar` добавляется к General. `schedule-screen.tsx` вызывает тот же snapshot hook для статуса; browser не запускает dispatcher. `google-conflicts.tsx` владеет одним запросом на current candidate/inputKey и его complete/error/stale состояниями. Create/move forms передают draft; recurrence раскрывает сервер. Loading/read error не преобразуется в not_connected/None/no conflicts.

`DateField` сейчас принимает `value: string` и безусловно форматирует дату (25–39). NEW signature: `value: string | null`, `placeholder?: string`; существующий `onChange(value: string)` сохраняется, поскольку Calendar выбирает валидную дату. Null → Choose date, без вызова formatter/toDate. Новый Check through начинается с null; диапазон включает весь lesson end. Это правка существующего поля, не второй date picker.

`ConfirmDialog` уже принимает `cancelLabel` и фокусирует вторичную кнопку (16–25,69–71): CALL с `cancelLabel="Keep connected"` и primary tone. Accepted disconnect закрывает modal, server snapshot показывает progress/error; потерянный POST ответ требует GET. Новое подтверждение на Retry disconnect не вводить. Copy/casing, focus после callback, nonblocking conflicts и публичные тексты остаются в UI-SPEC.

### P5 — durable E2E в существующем harness

**Imports, lines 1–7:**

```ts
import type { Page } from '@playwright/test'

import { api } from './support/api.ts'
import { cleanupFixtures } from './support/data.ts'
import { addDays, mondayOf, startedSlotToday, VN, vnToday } from './support/dates.ts'
import { record, text } from './support/input.ts'
import { expect, test, type Card, type Fx } from './support/test.ts'
```

**Observable move result, lines 48–58:**

```ts
let dialog = await openTodayLesson(page, card)
await chooseMark(page, dialog, 'Done', 'Deducts 1 lesson (60 min).')
await moveLesson(page, dialog, targetDate, '11:00')
await expect(page).toHaveURL(/\/schedule$/)
await inspectMovedDestination(page, card, targetDate, key)
const target = (await fx.week(mondayOf(targetDate))).find((entry) => entry.key === key && entry.outcome === 'done')
if (!target) throw new Error('Moved destination is missing from the real week response')
const today = await fx.today()
expect(
	[...today.lessons, ...today.earlier].some((entry) => entry.key === key && entry.startsAt === target.startsAt)
).toBe(false)
```

Copy public UI action + visible outcome + public response/persistence assertion. `e2e/support/api.ts:17–44` уже вызывает `BASE/api`, задаёт Origin, проверяет статус, sanitizes transport error и dispose response. Новые typed facts расширяют этот owner. Не копировать захардкоженную VN как новый oracle: 21.1 обновляет fixtures/zone helpers.

Существующий harness использует реальные SQL fixtures и cleanup. Это не разрешение делать tested action через SQL, писать provider mock suite или чистить Calendar данные. Нужные setup/observation остаются ограничены разрешёнными synthetic fixtures; связь с реальным primary Google Calendar требует отдельной execution authority. Provider mutation/recovery proof не заменяется SQL-счётчиком. Новый `e2e/calendar.spec.ts` — сценарий того же harness, не новый test layer.

## Shared Patterns

### S1 — schema и validation owners

`packages/contracts/src/settings.ts:1,6–12`:

```ts
import { z } from 'zod'
```

```ts
export const updateSettingsRequest = z.object({
	paysSoonLessons: z.number().int().min(PAYS_SOON_LESSONS_MIN).max(PAYS_SOON_LESSONS_MAX),
})

export type TeacherSettings = { paysSoonLessons: number }

export type SettingsResponse = { settings: TeacherSettings }
```

CALL общие валидаторы dates/time из contracts; baseline `schedule.ts:17–25` содержит isoDate/clockTime/minutes/datetime, 21.1 добавляет expectedDefaultTimeZone. NEW Calendar request schemas strict и discriminated; SDK types, secrets, Node API и core imports туда не попадают. `auth.ts:42–70` владеет ErrorCode/ErrorResponse; `index.ts:1–7` владеет exports.

DB модели продолжают `schema.ts`: natural key `lessonExceptions` (240–258), FK restrict, unique alternative refs `lessonMarks` (291–309), account-bound settings (313–322). NEW Calendar tables добавляют уникальность connection/local identity и provider identity, generation/revision/transition state. Секретные поля — ciphertext envelope. Generated migration/snapshot не копировать из старой миграции. Если реальный schema.ts перерастёт <500 lines, planner распределяет Calendar declarations внутри DB owner до исполнения, не механически переименовывает существующий schema.

### Transaction и canonical domain CALL

`packages/db/src/connection.ts:28–32`:

```ts
export type Database = ReturnType<typeof createDb>['db']

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export type DbExecutor = Database | Transaction
```

`schedule/rows.ts:181–188`:

```ts
export async function lockSeries(executor: DbExecutor, id: string): Promise<SeriesRule | null> {
	const [row] = await executor.select(seriesColumns).from(lessonSeries).where(eq(lessonSeries.id, id)).for('update')
	return row ? toSeriesRule(row) : null
}

export async function lockLesson(executor: DbExecutor, id: string): Promise<SingleLesson | null> {
	const [row] = await executor.select(lessonColumns).from(lessons).where(eq(lessons.id, id)).for('update')
	return row ? toSingleLesson(row) : null
}
```

CALL эти loaders/mappers/locks и core. `loadScheduleRows` (337–400) загружает окно; этого недостаточно, чтобы найти ended/empty series при bootstrap/recovery. Новый by-ref/lineage read добавляется в тот же row owner с явной областью, не через week UI DTO и не через копирование SQL в worker. `readSnapshot` (331–333) сейчас repeatable-read/read-only; relocation в DB принадлежит 21.1.

### Composition, shutdown, errors

`lifecycle.ts:3` и `server.ts:46–48`:

```ts
export type Closable = { name: string; close: () => Promise<void> }
```

```ts
housekeeping.start()

lifecycle.manage({ server, wss, resources: [housekeeping, { name: 'pg-pool', close: () => pool.end() }] })
```

NEW worker предоставляет `start(): Promise<void>` и `Closable`. `server.ts` создаёт/запускает его и ставит worker перед pool. `lifecycle.ts:71–77` уже закрывает resources по порядку: файл CALL, не обязательная правка. Pump/queue/network abort закрывает сам worker в пределах существующего deadline. `app.ts` только получает зависимости; import приложения не запускает worker.

`config.ts:25–28` — единственный application env parser; `resolveDatabaseUrl` остаётся в DB. `migrate.ts:7–12` использует migrator и process.exitCode=1 при ошибке. Queue schema/queues создаёт migration owner; app runtime не повышает права и не отключает maintenance ради обхода permission error. Existing provisioning grants только public schema (`ensure-db.sql:31–34`); queue grants задаются отдельно.

`request-context.ts:60–62`:

```ts
export const errorBody = (code: ErrorCode, message: string, extra?: { retryAfterSeconds?: number }) => ({
	error: { code, message, requestId: currentRequestId(), ...extra },
})
```

CALL errorBody/logger, но до их вызова gateway/connection превращает raw SDK exception в безопасную категорию. `request-context.ts:47–54` пишет `c.req.path` без query; Caddy `log { format json }` (16–19) требует отдельной redaction callback query. Ни logger, ни queue не получают token, event body, title, calendar ID/email или callback query.

## Public signatures and cross-module wiring

Все Calendar declarations ниже **NEW proposals**. Уже существующие сигнатуры отмечены CALL; форма 21.1 помечена DEPENDENCY. Внутренние типы Calendar не нужно экспортировать в общий contracts, если их не получает web.

| Owner                                        | Public/cross-module surface                                                                                                                                                                                                                                                                             | Callers / boundary                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| contracts/calendar.ts                        | `GoogleConnectionSnapshot`, `CalendarIssue`, `GoogleConflictResult`, `GoogleConflictInterval` точно по RESEARCH `8; NEW request schemas                                                                                                                                                                 | API validates; web parses result. Две оси connection/sync; not_connected имеет calendar/sync null                                                                        |
| contracts/calendar.ts                        | NEW `GoogleConflictRequest`: discriminated candidate create/move/move_series с соответствующим validated schedule input/ref, `inputKey: string`, `checkThrough: string \| null`                                                                                                                         | Server получает domain candidate, не готовый Google payload/URL/calendarId; 21.1 default-zone precondition сохраняется                                                   |
| routes/google.ts                             | NEW `googleRoutes({ db, connection, conflicts })`                                                                                                                                                                                                                                                       | `app.route('/google', …)`; session-bound account supplied by route                                                                                                       |
| connection.ts                                | NEW `beginConsent(session: CalendarSession): Promise<{ authorizationUrl: string }>`; `completeConsent(session: CalendarSession, callback: GoogleCallbackInput): Promise<CalendarIssue \| null>`; `readConnection(accountId): Promise<GoogleConnectionSnapshot>`; `disconnect(accountId): Promise<void>` | session — server-only account/token binding; callback — validated code/state/error. Flow epoch читается в БД. Generation fence проверяется при сохранении                |
| credentials.ts                               | NEW encrypted seal/open/rewrap и `withAccessToken(connectionId, operation)`                                                                                                                                                                                                                             | Gateway получает только usable token в bounded operation; callback exchange/revoke владеет connection. Refresh coordination не отдаётся нескольким SDK clients           |
| gateway.ts                                   | NEW typed operations для 10 INTEGRATE capabilities из COVERAGE                                                                                                                                                                                                                                          | OAuth operations вызывают только connection/credentials; events.insert/patch — только worker/transitions. instances/list pagination остаётся здесь                       |
| event-mapping.ts                             | NEW deterministic master/single ID, local-ref → canonical instance lookup, pure event projection                                                                                                                                                                                                        | CALL core + row snapshots; Google DTO остаются в api/calendar; auth generation не входит в ID                                                                            |
| outbox.ts                                    | NEW `recordCalendarChange(tx: DbExecutor, accountId: string, refs: readonly CalendarTargetRef[], transition?: CalendarTransition): Promise<void>`                                                                                                                                                       | `CalendarTargetRef = ScheduleOccurrenceRef \| { kind: 'rule'; seriesId: string }`; aggregate rule не подменяется fake originalOn. Only tx supplied by caller; no network |
| transitions.ts                               | NEW `DetachedOccurrence = { seriesId: string; originalOn: string; lessonId: string }`; `recordDetachedOccurrences(tx, accountId, detached): Promise<void>`                                                                                                                                              | Предписано RESEARCH:504–520. Хранить lineage, old/new boundaries, temporal facts и progress; служебные типы не wire contract                                             |
| schedule/series.ts                           | NEW result `keepCutLessons(...): Promise<DetachedOccurrence[]>` с явным old seriesId; existing moveSeries/endSeries получают teacher-bound recorder                                                                                                                                                     | API создаёт lesson IDs, core их не угадывает. public schedule response не обязан раскрывать journal                                                                      |
| schedule/{schedule,changes,series}.ts        | NEW injected `CalendarChangeRecorder` как явный аргумент domain mutation                                                                                                                                                                                                                                | Callback замыкает accountId в route; receives same tx + domain refs/transition. Отказ recorder откатывает mutation; no-op recorder не является production default        |
| schedule/rows.ts                             | NEW by-ref/bootstrap read и выборка refs ученика; existing mappers/locks CALL                                                                                                                                                                                                                           | Workers/conflicts/bootstrap/rename используют один canonical row owner. Данные для master не теряются при фильтре только future week                                     |
| cards/cards.ts                               | Extend updateCard с транзакционным `onTitleChanged(tx, studentId): Promise<void>`                                                                                                                                                                                                                       | Route связывает accountId, schedule refs и recorder. Только реальная смена canonical displayName; marks/payment/settings не вызывают Calendar writes                     |
| worker.ts                                    | NEW `start(): Promise<void>`; `name: string`, `close(): Promise<void>`                                                                                                                                                                                                                                  | server composes; lifecycle calls close. Outbox retained until generation/revision CAS acknowledgement                                                                    |
| web hooks/use-google-connection.ts           | NEW hook result: loading/error/ready snapshot + `refresh(): Promise<void>`                                                                                                                                                                                                                              | Shared Settings/Schedule semantics; no second dispatcher, no optimistic connected                                                                                        |
| web google-conflicts.tsx                     | NEW `useGoogleConflicts(candidate, checkThrough)` и presentation exports                                                                                                                                                                                                                                | create/move hosts use inputKey generation/stale guard; backend раскрывает candidates. UI не вычисляет provider pages                                                     |
| web date-field.tsx                           | NEW nullable value и optional placeholder; onChange remains valid string                                                                                                                                                                                                                                | Check through null safe; прежние непустые callers совместимы                                                                                                             |
| web lib/api-client.ts; schedule-mutations.ts | CALL `apiRequest` / `mutate`; менять transport/route builders не требуется                                                                                                                                                                                                                              | Google reads/connection requests use apiRequest; existing schedule writes retain mutate                                                                                  |

NEW internal `CalendarSession = { accountId: string; token: string }`; `GoogleCallbackInput` — output строгой callback schema (code/state либо безопасный error), не raw URL. Route передаёт существующие account.id/session.token; epoch проверяет connection owner. Conflict route вызывает новый `planConflictIntervals(executor, candidate, checkThrough, timeContext)` в schedule owner, затем gateway с конечными intervals/inputKey/checkedRange и edited ref. Core вычисляет occurrences; gateway читает страницы и фильтрует union/self-identity. Отдельного conflicts service не требуется.

HTTP contracts: `POST /google/connect` возвращает NEW `{ authorizationUrl: string }` для same-tab navigation; `GET /google/callback` выдаёт только fixed `/settings?tab=calendar` с server-selected safe outcome; `GET /google/connection` возвращает snapshot; `POST /google/disconnect` принимает существующую server-bound identity и возвращает accepted 202 без объявления завершения revoke; `POST /google/conflicts` возвращает полный GoogleConflictResult либо typed error. Повтор disconnect продолжает ту же подтверждённую operation. Точные payload schema exports planner фиксирует в contracts; уже принятые DTO/состояния не переименовывает.

### Recurring instance, cut и restart history

1. `ScheduleOccurrenceRef` (contracts/schedule:66–67) — CALL: single lessonId либо seriesId + natural originalOn. NEW master/single event ID детерминирован по stable connection/calendar/local identity; instance ID/originalStartTime приходит от Google. Не строить suffix и не делать insert для moved occurrence.
2. `keepCutLessons` возвращает вставленные IDs. Domain tx одновременно фиксирует old prefix boundary, new rule, detached lineage и durable intent/journal. Core 21.1 решает natural cutoff, old creation zone и preserved instant/mark.
3. Worker сериализует **connection**, что включает master, instances и detached singles. Перед trim сохраняет normalized old instance identity/ETag/prefix facts; отменяет старые tail representations; trim old master; ensure detached singles/new master. Empty old series → cancel master.
4. При lost response/409/412 сначала GET + ownership/revision/ETag reconciliation. Пока old representation может оставаться активным, не создавать вторую. После trim проверить prefix exceptions и восстановить still-valid owned prefix при необходимости.
5. Каждый remote stage checkpointed. Restart продолжает journal и актуальную revision; не вызывает local cut заново. Pump возобновляет pending/unknown работу, boss.send не очищает intent. Старый response не ack новую generation/revision.
6. Disconnect останавливает dispatch и fence-ит in-flight работу; при failed revoke сохраняет видимый disconnecting/error. Live credentials очищаются после revoke, события/mappings/intents остаются. Same-target reconnect продолжает latest state/journal. Это recovery исходящей доставки, не Phase 25 inbound reconciliation.

### Dependency 21.1 — CALL после реализации

Exact source of the proposed contract: sibling `../../phase-21-1-default-time-zone/dv-lab/.planning/phases/21.1-default-time-zone/21.1-RESEARCH.md:414–432`; relocation/preconditions — `21.1-PATTERNS.md:460–474`. Эти документы — planning inputs, не code analogs.

- `TeacherSettings.defaultTimeZone` задаёт новые inputs/display. `SeriesRule/ScheduleSeries.timeZone` и `SingleLesson/ScheduleLesson/ScheduleBlock.timeZone` сохраняют creation/rule zone; default change не создаёт intent/reschedule/новые IDs.
- `type LocalTimeCandidates = readonly Date[]`; `localTimeCandidates(date: string, time: string, zone: string): LocalTimeCandidates`; `startOfZonedDay(date: string, zone: string): Date` — NEW 21.1. Calendar CALL, не copy DST math.
- `cutSeries` success сохраняет `{ kind: 'ok'; oldEndsOn; newRule; lessons }`; NewSeriesRule/CutLesson получают timeZone, `CutLesson.originalOn` сохраняется. End сохраняет moved/marked/cancelled tail. Manual gap — ошибка, fold — первый instant, recurrence gap — skip.
- Create/move/whole-series/end inputs получают `expectedDefaultTimeZone`. Marks/cancel/restore сохраняют instant/ref guards. `readSnapshot<T>(db, read): Promise<T>` переходит в DB owner; mutation context принадлежит settings owner.
- Baseline source ещё содержит fixed SCHEDULE_TIME_ZONE и отсутствующие future fields. Не копировать эту семантику в event-mapping/conflicts и не добавлять fallback-зону, чтобы обойти dependency.

### Public routes и proxy boundary

`apps/web/lib/api-client.ts:8–16`:

```ts
export async function apiRequest<T>(method: ApiMethod, path: string, body?: unknown): Promise<ApiResult<T>> {
	let response: Response
	try {
		response = await fetch(`/api${path}`, {
			method,
			credentials: 'same-origin',
			cache: 'no-store',
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
```

CALL `apiRequest('GET', '/google/connection')`; Hono mounts `/google`. Development rewrite (`next.config.ts:9–12`) и production Caddy (`Caddyfile:47–52`) уже снимают внешний `/api`. Callback снаружи остаётся `https://dv-lab.dev/api/google/callback`. Next API routes и двойной `/api/api` не создавать.

`apps/web/proxy.ts:6–9`:

```ts
export function proxy(request: NextRequest) {
	const token = request.cookies.get(SESSION_COOKIE)?.value
	if (token !== undefined && SESSION_TOKEN_PATTERN.test(token)) return NextResponse.next()
	return NextResponse.redirect(new URL('/login', request.url), 307)
}
```

Перед cookie branch добавить exact pathname set `/welcome`, `/privacy`, `/terms`. Не prefix regex, который откроет похожие пути. Страницы вне `(app)`, статические, без getMe. `app/(app)/layout.tsx:11–27` остаётся session/role boundary; `app/(app)/page.tsx` остаётся Today на `/`. LoginPage (11–14) вызывает getMe/redirect, поэтому целиком его не копировать для public policy. Root ThemeProvider/layout — CALL; approved prose/layout из UI-SPEC.

## SC / Requirements Coverage

| SC  | Requirement | Owners / decisive future evidence                                                                                                                                                                       |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1 | GCAL-01     | P1/P3, credentials/config/Caddy, calendar E2E: consent/session/state/scope negative paths, encrypted refresh, no leaks; Production + actual day-8 refresh остаются внешней приёмкой                     |
| SC2 | GCAL-02     | P2, event-mapping/transitions, move/marks/no-show: single/master exactly once, canonical instances, cut/end prefix и detached history, provider recovery after unknown result                           |
| SC3 | GCAL-03     | P2, outbox/worker/server/migrate/privileges: commit-to-send restart, two fast edits, delayed stale response, generation/revision fence, real role and shutdown paths                                    |
| SC4 | GCAL-09     | P1/P3/P4, hook/panel/banner: expired/revoked/reconnect, distinct sync error, retained pending count, failed revoke/reload/retry и same-target resume                                                    |
| SC5 | GCAL-10     | gateway/contracts/row+core CALL, shared conflicts/forms: page 2+, full candidate union, failed page unavailable, own occurrence exclusion, all-day exclusive end, Check through/inputKey stale response |
| SC6 | GCAL-01     | public pages/proxy/calendar E2E: anonymous and expired-cookie access without session API; private root/teacher guard preserved; actual Branding/deploy/Production checked externally                    |

COVERAGE решает 42 capabilities: 10 INTEGRATE, 32 OPT-OUT. Четыре OAuth protocol операции → connection/credentials через gateway; CalendarList.list → primary identity; events.insert/get/patch/instances → queued write/recovery owner; events.list → complete conflict read. OAuth exchange/refresh/revoke не являются Calendar event writes. Не копировать сюда полную capability matrix и не добавлять отсутствующие methods.

Будущие checks используют существующий `yarn test:e2e` и явно названные `e2e/calendar.spec.ts`, `e2e/move.spec.ts`, `e2e/marks.spec.ts`, `e2e/no-show.spec.ts`. Перед реализацией записать failure modes из таблицы и scenarios; после исполнения приложить diff fingerprint, fixture refs, expected/observed, exit и rerun command. Никаких новых unit/component/contract/integration suites. Сейчас все runtime/provider/Production/day-8 проверки **NOT RUN**; doc-check не заменяет их.

## No Analog Found

| File / surface                                                                                                | Role / flow                    | Disposition                                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `apps/api/src/calendar/gateway.ts`                                                                            | service / request-response     | Google SDK/pagination/conditional calls ещё отсутствуют; RESEARCH `1/`4/`6, narrow operations from COVERAGE |
| `apps/api/src/calendar/event-mapping.ts`                                                                      | utility / transform            | Canonical instance identity/deterministic remote ID/ETag projection — NEW; domain recurrence CALL           |
| `apps/api/src/calendar/worker.ts`                                                                             | service / event-driven         | Durable remote queue/pump/reconciliation ещё нет; CALL lifecycle, implement RESEARCH `2/`3                  |
| `apps/web/app/welcome/page.tsx`, `apps/web/app/privacy/page.tsx`, `apps/web/app/terms/page.tsx`               | route / request-response       | Public static prose without auth read ещё нет; UI-SPEC copy + existing root UI primitives                   |
| `packages/db/drizzle/<generated>/migration.sql`, `packages/db/drizzle/<generated>/snapshot.json`, `yarn.lock` | generated / batch or transform | Генераторы назначают содержимое; ручной аналог не нужен                                                     |

P3 не даёт готовой envelope encryption/OAuth реализации; P2 не даёт atomic remote exactly-once; P4 не даёт полного Calendar state machine. Для этих новых частей аналог определяет структуру, а принятые RESEARCH/ARCH определяют поведение. Обязательные runtime proof остаются невыполненными.

## Metadata

**Search scope:** точные referenced owners в apps/api, apps/web, packages/contracts, packages/db, e2e и deploy; внешняя 21.1 только planning contracts. Project .codex/skills и .agents/skills отсутствуют. CodeGraph не использовался по заданию. Пять основных аналогов подтверждены через `git ls-files -- <path>`; прочие named source owners также tracked. Никакие install/runtime mirrors не используются.

**Files read for source extraction:** 45. Исходные байты зафиксированы ниже; env examples/compose/manifests фигурируют как будущие owners без чтения секретов. Документные входы зафиксированы отдельно, UI fingerprint снят после parent correction `Keep connected`. Они могут меняться параллельно: изменившийся input требует проверить относящееся к нему назначение, не переписывать source.

**Tool adapter:** Read/Write connectors недоступны; выполнены read-only shell reads и запись только PATTERNS через patch editor. Source/runtime не исполнялись. Root pin до записи: `ROOT_PIN_OK`.

### Source fingerprints

| Path                                                             | SHA-256                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/api/src/routes/settings.ts`                                | `49225b2ded62c487bb30ce7ba4b6a675cc979078c8a51ba57c0d098da99ee2a6` |
| `apps/api/src/schedule/series.ts`                                | `b4a1eba21ccad6be1b4ad5b95fedabc8fc9ef86f1afcf6446f64d63455ec4d3b` |
| `apps/api/src/auth/sessions.ts`                                  | `3a48addc2d39e15b5a9f46e8bb61a7dfaa9e5892314bdba84a5f6e1c87de87c5` |
| `apps/web/app/(app)/settings/_components/payments-card.tsx`      | `d3032cd1b4925bb63a044ef4635fd44d9d920b1adf22840394d4a69ee29aff4b` |
| `e2e/move.spec.ts`                                               | `86d556e1bf93b5b8617284be603e24ecac36176388ee00211892cece6a2cdf7a` |
| `apps/api/src/auth/middleware.ts`                                | `86e78399ebe845a36f60008e808a34ea9a2bece1e052cae1f621d90a1af88bcf` |
| `apps/api/src/app.ts`                                            | `5d184125f67458196791fcbfe61c96d257003f26d629f65e7d4cf941eba33831` |
| `apps/api/src/server.ts`                                         | `9dd2688bc134ca0af0923eb6e9031bbaa89d2434e893d6619844c13d81c173c3` |
| `apps/api/src/lifecycle.ts`                                      | `81eebd2f099c80b943689f6f19b38048372cf2741062bf27b0a2630494a705a1` |
| `apps/api/src/config.ts`                                         | `3eb713ebcbb41326df4b916935b6d802af8e6e0eedb451849251469aecce5ace` |
| `apps/api/src/migrate.ts`                                        | `ae807d1215ca0d6fc8c3fd39f4312dea7f9aeac4e1da35afced919302adc0f49` |
| `apps/api/src/request-context.ts`                                | `6861bf8626bae3f022ce50854b1c068e65d19c55e1740018c5d7c97fc4e34270` |
| `packages/db/src/connection.ts`                                  | `fac3b0ddb9b85fa2aaed028b30a54d034d053d749e76f8c635424a525ffaca90` |
| `packages/db/src/schema.ts`                                      | `534cb2982403d4655fb443641ca4f8b0bcf8dd99a55700c7ba1fa16c12c6e292` |
| `packages/contracts/src/schedule.ts`                             | `8aca7568586280125042611c28574f5ff79f600132435693aee96c134a306eed` |
| `packages/contracts/src/settings.ts`                             | `bffe93c722dbda99cfd34809cea86128c906f00d8268fb7e8ceca8043a228cf1` |
| `packages/contracts/src/auth.ts`                                 | `48ed576a2acea8e26fc6a2d628ae7d2ec1da45e8aa1da829039d74382094c691` |
| `packages/contracts/src/index.ts`                                | `7e0d630dadb381140dbcd8a6a2e64b42eea5df2e44feeea39fdad0ac103ced72` |
| `apps/api/src/schedule/rows.ts`                                  | `9b9db2487dc41197c853140a858f9e842eacc0ed80aa82e9fc85dab599f740c9` |
| `apps/api/src/schedule/schedule.ts`                              | `6ccc98f1616d036e617fbe85fe0ee1232a677047160b1e4fa3ce44921eba0370` |
| `apps/api/src/schedule/changes.ts`                               | `06df23f218d39b47f5a40cd830b94d3514010c4dfb8799e32f7a1daea3cc1d5a` |
| `apps/api/src/routes/schedule.ts`                                | `04ca5d16195d184fefb83125dcd3b0908a468adebc8a3b3e02aad803e74a2529` |
| `apps/api/src/cards/cards.ts`                                    | `492678fefa2b54ed09ccdd29cdddbd4b79fecde9dead50aeaaff615a6ceaf741` |
| `apps/api/src/routes/students.ts`                                | `77a0566a7f6711660e36f47c0e439710c2714bd361b76d8fc28bc03019378a28` |
| `apps/web/app/(app)/settings/_components/settings-screen.tsx`    | `baf3c84649241c1349e2dad7454f20347da42aedcb8d596920f25a75f80fbfb1` |
| `apps/web/app/(app)/schedule/_components/schedule-screen.tsx`    | `e37ea6d4fdde1f9b08f30cd30e1b12dfd6b679c8156b706b5f7c77f254244649` |
| `apps/web/app/(app)/schedule/_components/new-lesson-content.tsx` | `346d560a43293da0201aa8300e3b81c57fe942dea195926d5d1b4357956f3c07` |
| `apps/web/app/(app)/schedule/_components/lesson-move-form.tsx`   | `fb55a50b754e536bddef6c1959453924e3227ec760ed511a884ca8a2593805a0` |
| `apps/web/app/(app)/schedule/_components/move-series-dialog.tsx` | `8c80d3304c409fa69f280c1ceaccacd149dc79472da04a5dca051c0e39a9d28c` |
| `apps/web/app/(app)/schedule/_components/schedule-mutations.ts`  | `96ea33d45248222e6850f9b763469d17c26118a96672585bd42b4bc36159f8f5` |
| `apps/web/components/app/date-field.tsx`                         | `61281baa00b1c7347e267dda5bfeec571b678ca4dcb3dd23b0e3ac9f1f45a9b1` |
| `apps/web/components/app/confirm-dialog.tsx`                     | `b0e8f102a9b713191f802d3f01030e066ec3766530fe42c5f23427590cbc7b5a` |
| `apps/web/lib/api-client.ts`                                     | `fe19848e334e7604c0a8c25edb692c061b87ba3a50170d061dae0bd8ba9a435d` |
| `apps/web/proxy.ts`                                              | `22f16473b22504e9309dd3a7641f7b5737de058c3163f4bd6770cdefc6c529bf` |
| `apps/web/next.config.ts`                                        | `0780c61c3e6b96eeeaadbc38541827abfdd8475c47a5bbc3cc8b62fb8cd4c738` |
| `apps/web/app/login/page.tsx`                                    | `0c563faef70c7e2f553d0d7502975bf1dc80a1be57af4872fe0f34ebb0c6e5fb` |
| `apps/web/app/(app)/page.tsx`                                    | `446c32b4066455ad2a9146430e6ebb9ce3ceb09a6e790efed9c4101c01f33571` |
| `apps/web/app/(app)/layout.tsx`                                  | `eb03accff8990ffba3b7032274cc173a0bf6346b91bd92e99e4ba15e111e58db` |
| `deploy/caddy/Caddyfile`                                         | `477bf69482f540f00602bc8f73cb241a6247407730e9bc9f7c66e1b3aa1aae54` |
| `deploy/postgres/ensure-db.sql`                                  | `1299c81d7072acf314386e36f041247d7f6f2910d98d88c433e1367962586f0b` |
| `e2e/support/api.ts`                                             | `9bd07aed9b8743353d0a7c841b2370bb83026418dc5ce4c9787abf44afd9f5a1` |
| `e2e/support/test.ts`                                            | `7270fe2a7fc03188a6f73b6545d4b157f02b46b5146d2e9c567955271f056e1b` |
| `e2e/support/data.ts`                                            | `3b81b170d66b82f9263a37091fc2f2c6acf026749b2fa1ad30a8563d4c85c1c7` |
| `playwright.config.ts`                                           | `a859f00e3b6ecbe6b318d58ea01e8358085746a58033ed36da28b8b9325539c4` |
| `apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx`  | `55d77f46f503ed05345cd6f227754d00658a0d9388eafcd79bdc2bf31c15a67a` |

### Input fingerprints

| Path                                                                                                 | SHA-256                                                            |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `AGENTS.md`                                                                                          | `fbef0e319fe49ffb5ab0067e8feac8093172f958b0a70808ff5a376bbb72c9be` |
| `.planning/EXECUTOR-RULES.md`                                                                        | `1eca1fa30e110bd04658cbf885d1b2189ce854f3cd3ed49664194f6121cbd449` |
| `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md`                     | `8c6c46f764d8efd745b66bc0039a356ad993fc54a6c592ea9d3615f8eca6c9f7` |
| `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-RESEARCH.md`                    | `fda38527ae6e910389eab5d85df1d465e1a9dbdf86d63ef53e349750a25a6b3b` |
| `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-ARCH-REVIEW.md`                 | `8b64810fa8d47bd761ca9beca9031d23948037a90d07a2a172c3bd3506007fa1` |
| `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-UI-SPEC.md`                     | `a0f0e8ffb69918c94ddaa6525f8286635127a8f154edc183e1c8c446f92ea3de` |
| `.planning/phases/24-google-calendar-connection-and-outbound-sync/COVERAGE.md`                       | `71d503f2568410940193b9d57c16906b82fbca1f12a546b462ff65acece60f92` |
| `../../phase-21-1-default-time-zone/dv-lab/.planning/phases/21.1-default-time-zone/21.1-RESEARCH.md` | `3db87f2370abb6cbfd6b94e563b8bc7d67eb42b23a4e09bf09647f7efeded657` |
| `../../phase-21-1-default-time-zone/dv-lab/.planning/phases/21.1-default-time-zone/21.1-PATTERNS.md` | `46a6e5d67acc41ac1f1c655c19ac78954c76e5e1883b163df502e2b2ca3d056c` |

### Reproducible doc-check

Из указанного ROOT. Команда читает только документы/source bytes и Git index; таблицы разбираются по trim ячеек, без зависимости от Prettier alignment.

```sh
python3 -c 'from pathlib import Path
import hashlib, json, re, subprocess
root = Path.cwd()
phase = root / ".planning/phases/24-google-calendar-connection-and-outbound-sync"
path = phase / "24-PATTERNS.md"
text = path.read_text()
body = text.split("### Reproducible doc-check\n", 1)[0]
def section(start, end, source=body):
    return source.split(start + "\n", 1)[1].split(end + "\n", 1)[0]
def cells(source):
    return [[c.strip().strip(chr(96)) for c in line.strip().strip("|").split("|")]
            for line in source.splitlines() if line.lstrip().startswith("|")]
inventory = [r for r in cells(section("## File Classification", "## Pattern Assignments"))
             if len(r) == 7 and r[1] in {"NEW", "MOD", "GENERATED"}]
source_pairs = [r for r in cells(section("### Source fingerprints", "### Input fingerprints"))
                if len(r) == 2 and re.fullmatch("[0-9a-f]{64}", r[1])]
input_pairs = [r for r in cells(body.split("### Input fingerprints\n", 1)[1])
               if len(r) == 2 and re.fullmatch("[0-9a-f]{64}", r[1])]
analogs = [r for r in cells(section("## Pattern Assignments", "### P1 — routes/google.ts и HTTP wiring"))
           if len(r) == 3 and re.fullmatch("P[1-5]", r[0])]
modified = [r[0] for r in inventory if r[1] == "MOD"]
tracked = set(subprocess.check_output(["git", "ls-files", "--", *modified,
              *[r[0] for r in source_pairs], *[r[1] for r in analogs]], text=True).splitlines())
def changed(pairs):
    return [p for p, digest in pairs if not (root / p).is_file()
            or hashlib.sha256((root / p).read_bytes()).hexdigest() != digest]
source_changes, input_changes = changed(source_pairs), changed(input_pairs)
coverage = [r for r in cells((phase / "COVERAGE.md").read_text())
            if len(r) == 3 and r[1] in {"INTEGRATE", "OPT-OUT"}]
sc_rows = [r for r in cells(section("## SC / Requirements Coverage", "## No Analog Found"))
           if len(r) == 3 and re.fullmatch("SC[1-6]", r[0])]
checks = {
    "root": str(root.resolve()) == "/Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab",
    "inventory": len(inventory) == 53 and len({r[0] for r in inventory}) == 53,
    "states": [sum(r[1] == state for r in inventory) for state in ["NEW", "MOD", "GENERATED"]] == [16, 34, 3],
    "existing_tracked": all(p in tracked and (root / p).is_file() for p in modified),
    "new_not_existing": all(not (root / r[0]).exists() for r in inventory if r[1] == "NEW"),
    "five_tracked_analogs": len(analogs) == 5 and all(r[1] in tracked for r in analogs),
    "source_fingerprints": len(source_pairs) == 45 and not source_changes and all(p in tracked for p, _ in source_pairs),
    "input_fingerprints": len(input_pairs) == 9 and not input_changes,
    "sc_and_requirements": {r[0] for r in sc_rows} == {"SC1", "SC2", "SC3", "SC4", "SC5", "SC6"} and
        set(re.findall("GCAL-[0-9]+", " ".join(r[1] for r in sc_rows))) == {"GCAL-01", "GCAL-02", "GCAL-03", "GCAL-09", "GCAL-10"},
    "capabilities": len(coverage) == 42 and len({r[0] for r in coverage}) == 42 and sum(r[1] == "INTEGRATE" for r in coverage) == 10,
    "boundaries": all(k in body for k in ["recordCalendarChange", "recordDetachedOccurrences", "originalOn", "originalStart",
        "Keep connected", "expectedDefaultTimeZone", "readSnapshot", "/welcome", "/privacy", "/terms", "NOT RUN"]),
    "fences": sum(line.startswith(chr(96) * 3) for line in text.splitlines()) % 2 == 0,
    "no_sentinel_or_trailing_space": not re.search("^<!-- gsd:write-continue -->$", text, re.M) and all(line == line.rstrip() for line in text.splitlines())
}
ok = all(checks.values())
print(json.dumps({"status": "PASS" if ok else "FAIL", "checks": checks, "classified": len(inventory),
                  "analogs": len(analogs), "source_fingerprints": len(source_pairs), "capabilities": len(coverage),
                  "changed_sources": source_changes, "changed_inputs": input_changes,
                  "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}, ensure_ascii=False))
raise SystemExit(0 if ok else 1)'
```

**Evidence:** doc-check завершён с exit 0: PASS, 13 checks; classified=53, analogs=5, source_fingerprints=45, capabilities=42, changed_sources=[], changed_inputs=[]. Отдельно 22/22 code excerpts совпали с прочитанными source bytes. `git status --short -- .planning/phases/24-google-calendar-connection-and-outbound-sync/24-PATTERNS.md apps packages e2e deploy scripts yarn.lock package.json` показал только новый PATTERNS. Это статическая проверка документа. E2E, install, runtime, DB, Google и публикация не запускались.
