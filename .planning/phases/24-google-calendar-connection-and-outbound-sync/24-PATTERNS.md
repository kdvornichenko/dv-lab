# Phase 24: Google Calendar — Pattern Map

**Mapped:** 2026-10-11
**Files classified:** 81: 23 NEW, 55 MOD, 3 GENERATED. Это будущий write set, не выполненные изменения.
**Analogs:** сохранены пять основных аналогов P1–P5. Existing-owner означает продолжение текущего владельца; новый Google алгоритм из этого не следует.

## Scope

Результат — narrow PatternMap DELTA под CONTEXT D-13/D-14 и текущие RESEARCH/ARCH/COVERAGE. Запись только в `24-PATTERNS.md`. SC2/SC3/SC4+C2 требуют карты command → provider ack → projection, общего чтения Schedule/Today/nextLessonAt и явной границы local history. Сохранены действующие назначения SC1/SC5/SC6 и source evidence.

В scope: будущие owners/пути, CALL/copy границы, stable DTO/signatures, пять аналогов и fingerprints. Вне scope: implementation, Git mutations, dependencies, DB/env/runtime/browser/Google, новый research/audit и правки соседних документов. UI draft меняется параллельно; его unfinished copy не является входом этой delta.

A1. Baseline — merged Phase 21; Phase 21.1 approved planned, ещё не implemented. Основание: запрос и repo-local Stable Interface/PLAN-INDEX 21.1. Опровергается совместимыми source exports; исполнитель сверяет их перед реализацией.
A2. Сохранённые source excerpts относятся к тем же байтам baseline. Основание: SHA-256 и повторная проверка excerpts; несовпадение делает соответствующий аналог непроверенным.

Карта работы: RESEARCH §1–3/§8/Planned write set → inventory и contracts (SC2–4,C2); существующие owners → prepare/apply/read/status CALL (те же критерии); fingerprints/excerpts/doc-check → доказательство static handoff. Stop: исправленная карта и пройденный static doc-check. Runtime acceptance остаётся NOT RUN.

## File Classification

`NEW` — proposed path, не существующий export. `MOD` — будущая правка existing owner. `GENERATED` — штатный output, не шаблон ручного редактирования. P1–P5 раскрыты ниже; S1 — schema conventions. Inventory следует RESEARCH; сохранены необходимые existing form seams `new-lesson-dialog.tsx` и `date-field.tsx` для SC2/SC5. Окончательные UI copy/props назначаются отдельным UI owner.

| New/Modified File | State | Role | Data Flow | Closest Analog | SC | Owner / boundary |
| --- | --- | --- | --- | --- | --- | --- |
| `packages/contracts/src/calendar.ts` | NEW | model | request-response | S1 exact | SC1–5,C2 | Strict Calendar DTO/schema; read capability, command receipt/status. |
| `packages/contracts/src/today.ts` | MOD | model | request-response | owner exact | C2 | Today calendarRead/calendarWrite; future projection, local history. |
| `packages/contracts/src/students.ts` | MOD | model | request-response | owner exact | C2 | StudentRow.nextLesson и совместимый nextLessonAt. |
| `packages/contracts/src/auth.ts` | MOD | model | request-response | owner exact | SC1,SC4 | Safe ErrorCode; existing error envelope. |
| `packages/contracts/src/index.ts` | MOD | model | request-response | owner exact | SC1–5,C2 | Export новых contracts без SDK/core. |
| `packages/db/src/calendar-schema.ts` | NEW | model | CRUD | S1 role-match | SC1–4,C2 | Connection/flow, event cache/coverage/next index, command/stage/mapping/reservations; historyCutoverAt. |
| `packages/db/src/index.ts` | MOD | config | transform | owner exact | SC1–4,C2 | Export Calendar schema. |
| `packages/db/drizzle.config.ts` | MOD | config | transform | owner exact | SC1–4,C2 | Включить новый schema owner в generator. |
| `packages/db/drizzle/<generated>/migration.sql` | GENERATED | migration | batch | none | SC1–4,C2 | Штатный additive generator output; без ручной правки. |
| `packages/db/drizzle/<generated>/snapshot.json` | GENERATED | migration | batch | none | SC1–4,C2 | Штатный additive generator output; без ручной правки. |
| `apps/api/src/calendar/read-model.ts` | NEW | service | request-response | none | SC2,SC4,C2 | Единственный normalized facts/provenance, coverage и next proofs owner. |
| `apps/api/src/calendar/reads.ts` | NEW | service | request-response | none | SC2,SC4,SC5,C2 | Complete pages, атомарная публикация; last-known/unavailable; shared refresh. |
| `apps/api/src/calendar/gateway.ts` | NEW | service | request-response | none | SC1,SC2,SC5 | Google transport/validation/pagination/safe errors; COVERAGE methods. |
| `apps/api/src/calendar/event-mapping.ts` | NEW | service | request-response | none | SC2,SC5,C2 | Provider identity/binding, deterministic IDs и representationGeneration. |
| `apps/api/src/calendar/commands.ts` | NEW | service | request-response | P2 role-match | SC2,SC3 | Fresh admission, entity barrier, immutable preparation; command status/recovery. |
| `apps/api/src/calendar/journal.ts` | NEW | service | request-response | P2 role-match | SC2,SC3 | Request identity, reserved IDs, attempt/stage state и confirmed apply checkpoint. |
| `apps/api/src/calendar/worker.ts` | NEW | service | request-response | none | SC2,SC3,SC4 | Connection writer lease, bounded dispatch/reconcile; pg-boss wake-up. |
| `apps/api/src/calendar/transitions.ts` | NEW | service | request-response | P2 role-match | SC2,SC3 | Cut/end remote stages, partial state и explicit resume; no repeated cut. |
| `apps/api/src/calendar/connection.ts` | NEW | service | request-response | P3 role-match | SC1,SC4 | Consent/primary/generation, flat snapshot, revoke/operator recovery. |
| `apps/api/src/calendar/credentials.ts` | NEW | service | request-response | P3 role-match | SC1,SC4 | Encrypted refresh envelope, refresh lock/generation CAS. |
| `apps/api/src/schedule/command-plan.ts` | NEW | service | CRUD | P2 role-match | SC2,SC3 | Pure core preparation; captured versions/zone, reserved lineage; no confirmed writes. |
| `apps/api/src/schedule/command-apply.ts` | NEW | service | CRUD | P2 role-match | SC2,SC3 | Idempotent SQL apply только VerifiedGoogleResult; current marks under locks. |
| `apps/api/src/schedule/schedule.ts` | MOD | service | CRUD | P2 exact | SC2–4,C2 | Read future через Google; create preparation/apply seams. |
| `apps/api/src/schedule/changes.ts` | MOD | service | CRUD | P2 exact | SC2–4,C2 | Move/cancel/restore preparation/apply; не early confirmed mutation. |
| `apps/api/src/schedule/series.ts` | MOD | service | CRUD | P2 exact | SC2–4,C2 | Cut/end core CALL; reserved IDs и originalOn lineage. |
| `apps/api/src/schedule/rows.ts` | MOD | service | CRUD | owner exact | SC2–4,C2 | Existing loaders/mappers/locks; by-ref facts и local history eligibility. |
| `apps/api/src/schedule/marks.ts` | MOD | service | CRUD | owner exact | SC2–4,C2 | Local marks только history/confirmed binding; reject pending/external/legacy future. |
| `apps/api/src/today/today.ts` | MOD | service | CRUD | owner exact | C2 | Upcoming/counts из shared projection; Earlier/Pays soon local. |
| `apps/api/src/cards/card-facts.ts` | MOD | service | CRUD | owner exact | C2 | cardNextLessons → shared next index/status; cardBalances unchanged. |
| `apps/api/src/cards/card-rows.ts` | MOD | service | CRUD | owner exact | C2 | toCardRow передаёт nextLesson и nextLessonAt. |
| `apps/api/src/cards/cards.ts` | MOD | service | CRUD | owner exact | C2 | Account/context к facts; cached read в card tx; rename local. |
| `apps/api/src/routes/google.ts` | NEW | route | request-response | P1 exact | SC1–5,C2 | Connection, conflicts, command lookup/list/status/resume endpoints. |
| `apps/api/src/routes/schedule.ts` | MOD | route | request-response | P1 exact | SC1–5,C2 | Fresh read + 202 command submission; retain local mark endpoints. |
| `apps/api/src/routes/today.ts` | MOD | route | request-response | P1 exact | SC1–5,C2 | Shared refresh до DB snapshot; account context. |
| `apps/api/src/routes/students.ts` | MOD | route | request-response | P1 exact | SC1–5,C2 | Next refresh до GET snapshot; context к card responses. |
| `apps/api/src/app.ts` | MOD | config | request-response | owner exact | SC1–5,C2 | Inject owners; mount /google; no import startup. |
| `apps/api/src/config.ts` | MOD | config | event-driven | owner exact | SC1,SC3 | Единый parser config/key names. |
| `apps/api/src/server.ts` | MOD | config | event-driven | owner exact | SC1,SC3 | Composition/start; worker resource перед DB pool. |
| `apps/api/src/lifecycle.ts` | MOD | config | event-driven | owner exact | SC1,SC3 | Существующий ordered close/deadline seam; согласовать завершение Calendar resource. |
| `apps/api/src/migrate.ts` | MOD | config | event-driven | owner exact | SC1,SC3 | Queue schema/queues под migrator; runtime без DDL. |
| `deploy/postgres/ensure-db.sql` | MOD | config | batch | owner exact | SC1,SC3 | Queue privileges отдельно от domain grants. |
| `deploy/compose.yaml` | MOD | config | batch | owner exact | SC1,SC3 | Config в api/migrate; существующая topology. |
| `deploy/env.example` | MOD | config | batch | owner exact | SC1,SC3 | Deployment config names; без credentials. |
| `.env.example` | MOD | config | batch | owner exact | SC1,SC3 | Development config names; не читается в этой работе. |
| `deploy/caddy/Caddyfile` | MOD | config | batch | owner exact | SC1,SC3 | OAuth query redaction; retain API/address boundary. |
| `apps/api/package.json` | MOD | config | batch | owner exact | SC1,SC3 | Exact dependency pins из RESEARCH; отдельная execution authority. |
| `yarn.lock` | GENERATED | config | batch | none | SC1,SC3 | Штатный output разрешённой установки. |
| `apps/web/app/(app)/settings/_components/settings-screen.tsx` | MOD | component | request-response | P4 exact | SC1,SC4 | Existing URL tab owner. |
| `apps/web/app/(app)/settings/_components/calendar-card.tsx` | NEW | component | request-response | P4 exact | SC1,SC4 | Connection state/actions/revoke guidance; shared read/status owner. |
| `apps/web/app/(app)/schedule/_components/schedule-screen.tsx` | MOD | component | request-response | owner exact | SC2,SC4 | Google window/read/write; no independent local future. |
| `apps/web/app/(app)/schedule/_components/week-grid.tsx` | MOD | component | request-response | owner exact | SC2,SC4 | Provider timed/all-day view, covered snapshot. |
| `apps/web/app/(app)/schedule/_components/lesson-block.tsx` | MOD | component | request-response | owner exact | SC2,SC4 | Binding + capability; external read-only. |
| `apps/web/app/(app)/schedule/_components/event-tooltip.tsx` | MOD | component | request-response | owner exact | SC2,SC4 | Provider fields/status; no fabricated lesson binding. |
| `apps/web/app/(app)/schedule/_components/lesson-details.tsx` | MOD | component | request-response | owner exact | SC2,SC4 | Version and action barriers. |
| `apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx` | MOD | component | request-response | owner exact | SC2,SC4 | Gate all mutations/recover pending command. |
| `apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx` | MOD | component | request-response | owner exact | SC2,SC5 | Create candidate/meta и receipt; не close на 202. |
| `apps/web/app/(app)/schedule/_components/new-lesson-content.tsx` | MOD | component | request-response | owner exact | SC2,SC5 | Shared conflicts/capability; draft in memory. |
| `apps/web/app/(app)/schedule/_components/lesson-move-form.tsx` | MOD | component | request-response | owner exact | SC2,SC5 | Target version; conflict inputKey; pending status. |
| `apps/web/app/(app)/schedule/_components/move-series-dialog.tsx` | MOD | component | request-response | owner exact | SC2,SC3,SC5 | Whole-series version, finite check; partial/recovery state. |
| `apps/web/app/(app)/schedule/_components/end-series-dialog.tsx` | MOD | component | request-response | owner exact | SC2,SC3 | End command receipt/recovery. |
| `apps/web/app/(app)/schedule/_components/schedule-mutations.ts` | MOD | component | request-response | owner exact | SC2,SC3,SC4 | mutate → receipt/status; ok только applied. |
| `apps/web/app/(app)/schedule/_components/use-slot-drag.ts` | MOD | component | request-response | owner exact | SC2,SC4 | Block drag без fresh write capability/при command barrier. |
| `apps/web/components/app/google-calendar-state.tsx` | NEW | component | request-response | P4 flow-match | SC4,C2 | Shared connection/read/write + recoverable command state; Settings/Schedule/Today. |
| `apps/web/components/app/google-conflicts.tsx` | NEW | component | request-response | P4 flow-match | SC5 | Shared strict result/inputKey handling; complete overlaps advisory. |
| `apps/web/components/app/date-field.tsx` | MOD | component | request-response | owner exact | SC5 | Existing nullable Check through seam; valid source evidence retained. |
| `apps/web/app/(app)/_components/today-screen.tsx` | MOD | component | request-response | owner exact | C2 | Upcoming/counts и freshness; preserve local history/Pays soon. |
| `apps/web/app/(app)/_components/today-lessons.tsx` | MOD | component | request-response | owner exact | C2 | Shared command gates for future; historical marks available. |
| `apps/web/app/(app)/students/_components/students-screen.tsx` | MOD | component | request-response | owner exact | C2 | Next known/none/unknown + status; unknown не No next lesson. |
| `apps/web/app/welcome/page.tsx` | NEW | route | request-response | none | SC6 | Static public route; UI copy owned separately. |
| `apps/web/app/privacy/page.tsx` | NEW | route | request-response | none | SC6 | Static public route; UI copy owned separately. |
| `apps/web/app/terms/page.tsx` | NEW | route | request-response | none | SC6 | Static public route; UI copy owned separately. |
| `apps/web/proxy.ts` | MOD | middleware | request-response | owner exact | SC6 | Exact public pathname allowlist. |
| `e2e/calendar.spec.ts` | NEW | test | request-response | P5 exact | SC1–6,C2 | Durable public journey по failure map; existing harness. |
| `e2e/move.spec.ts` | MOD | test | request-response | P5 exact | SC1–6,C2 | Durable public journey по failure map; existing harness. |
| `e2e/marks.spec.ts` | MOD | test | request-response | P5 exact | SC1–6,C2 | Durable public journey по failure map; existing harness. |
| `e2e/today.spec.ts` | MOD | test | request-response | P5 exact | SC1–6,C2 | Durable public journey по failure map; existing harness. |
| `e2e/support/api.ts` | MOD | utility | request-response | owner exact | SC1–6,C2 | Typed authorized fixtures, target/persistence binding; safe evidence. |
| `e2e/support/data.ts` | MOD | utility | request-response | owner exact | SC1–6,C2 | Typed authorized fixtures, target/persistence binding; safe evidence. |
| `e2e/support/test.ts` | MOD | utility | request-response | owner exact | SC1–6,C2 | Typed authorized fixtures, target/persistence binding; safe evidence. |
| `e2e/support/calendar.ts` | NEW | utility | request-response | P5 role-match | SC1–6,C2 | Typed authorized fixtures, target/persistence binding; safe evidence. |

Общая web-логика принадлежит `components/app/google-calendar-state.tsx` и `google-conflicts.tsx`. Старые proposals `hooks/use-google-connection.ts`, `calendar-panel.tsx` и `calendar/outbox.ts` заменены текущими owners Research; это не удаление source. Отдельные provider framework, Calendar repository, service topology и API client не нужны.

Cards остаётся владельцем имени/учёта. `studentName` фиксируется при подготовке Calendar command; обычное переименование карточки — локальная операция, без автоматического Google write. Cards/routes-students входят в inventory из-за account context и общего next read, не title-change recorder.

## Pattern Assignments

| ID  | Tracked source                                              | Copy scope                                                                                  |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| P1  | `apps/api/src/routes/settings.ts`                           | Hono route factory, teacher guard, readJson, typed response/error envelope                  |
| P2 | `apps/api/src/schedule/series.ts` | Core refusal, SQL transaction и ID/mark lineage; будущие prepare/apply разделены provider ack |
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

Copy factory/guard/validation structure для `routes/google.ts`. Вызвать существующие middleware и `errorBody`, не копировать их реализации. `routes/schedule.ts`, `routes/today.ts` и `routes/students.ts` уже имеют HTTP guard; расширить wiring для общего refresh/read и command submission/status. Account ID берётся из session, не из body.

Показанный import `readSnapshot` — baseline. По repo-local 21.1-PATTERNS и PLAN-INDEX его целевой owner — `packages/db/src/connection.ts`, export через `@dv-lab/db`. Новый Calendar route использует этот целевой owner после 21.1, не создаёт зависимость Google → schedule ради общего read helper.

Callback GET сохраняет session/teacher/state binding. `sameOrigin` уже пропускает GET (middleware:26–41), поэтому Origin не заменяет проверку callback. POST connect/disconnect/conflicts/command-resume проходит существующий same-origin guard из `app.ts:44–47`. Добавить callback `no-store` и `Referrer-Policy: no-referrer`; не ослаблять глобальную защиту.

### P2 — prepare/apply, lineage и command journal

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

Baseline показывает точку создания detached IDs и копирования marks. Он **не** является шаблоном раннего сохранения урока. `schedule/command-plan.ts` вызывает pure core cut/end и existing loaders для проверки, захватывает zone/version/lineage. Admission резервирует IDs один раз в command journal; confirmed lesson/series rows ещё не меняются.

`schedule/command-apply.ts::applyConfirmedCommand` после `VerifiedGoogleResult` выполняет идемпотентную SQL transaction: old boundary, reserved detached IDs, new rule, mapping/projection и journal applied. Перед переносом marks перечитывает их текущие значения под блокировками. Не копировать старую захваченную mark и не выполнять повторный cut при retry.

Existing `schedule.ts:175–227`, `changes.ts:120–251` и `series.ts:37–71` дают validation/result/SQL seams. Публичные Calendar writes больше не вызывают их ранние mutators перед provider ack. Preparation и confirmed apply переиспользуют владельцев правил и строк; HTTP внутри domain transaction отсутствует.

`calendar/commands.ts` владеет fresh admission и command status; `journal.ts` — request identity, reservation, immutable plan/stage state; `worker.ts` — единственный writer; `transitions.ts` — ordered remote cut/end. P2 даёт transaction/result дисциплину, но не готовый durable remote алгоритм. Не создавать recorder/outbox, который сначала подтверждает local Save и позднее догоняет Google.

Повтор того же account/requestId/body возвращает прежний receipt; иной body с тем же ID даёт 409. Entity barrier блокирует вторую команду на ту же identity. Команды не coalesce в latest state. Неотправленная команда после истечения admission/deadline завершается `failed/not_applied`; новое сохранение требует свежего действия пользователя. Уже dispatched unknown/partial effect восстанавливается по journal и provider facts.

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

Refresh token нужен для использования, поэтому session hash не заменяет encryption. Envelope/AAD/KEK rotation, consumed state/PKCE, cross-process refresh lock и generation CAS — NEW поведение credentials/connection. `sessions.ts:70–88` удаляет app sessions: эту deletion policy не переносить на Calendar mappings/journals. Provider ошибки нормализовать до возвращения/логирования; app global onError логирует Error, а не безопасно разбирает любой SDK объект.

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

Cleanup выставляет `current = false` (53–57); save освобождает inflight/saving в finally (98–101). Copy lifecycle/query discipline и CALL `apiRequest`; generic cast в transport не валидирует DTO. Shared Calendar state проверяет contracts schema. Не переносить PaymentsCard autosave/revert timer в consent, disconnect или Calendar Save.

`settings-screen.tsx:13–18,62–77` — existing URL tab owner. Новый `calendar-card.tsx` и Schedule/Today используют общий `components/app/google-calendar-state.tsx`: connection, read freshness, write capability и pending command recovery. Browser не запускает writer. Loading/error не превращается в not_connected, пустое расписание или «нет следующего урока».

`schedule-mutations.ts` остаётся входом всех schedule writes, но его result меняется: 202 receipt → status polling/lookup → `applied` → перечитать shared projection → success/close. Потерянный POST response разрешается lookup по тому же requestId; reload/new tab восстанавливает unresolved commands с сервера. SessionStorage может хранить только opaque requestId/commandId; draft остаётся в памяти. Нельзя закрыть форму как saved или показать confirmed урок на 202.

Read-only gate охватывает create, drag, move, cancel/restore, whole-series actions и вызовы из Today. `last_known` виден только для покрытого snapshotRange; unavailable не означает пустой календарь. External/all-day events показываются из provider view, не получают lesson binding по имени. Исторические marks/Pays soon доступны по local-history правилам.

`google-conflicts.tsx` владеет current candidate/inputKey и strict `not_checked | complete | unavailable` result. Сервер раскрывает recurrence. Только complete overlaps являются advisory; unavailable Google блокирует Save. Draft/change ответа предыдущего inputKey не подтверждает текущий candidate.

`DateField` сейчас принимает `value: string` и безусловно форматирует дату (25–39). Сохранённый planned seam для Check through: `value: string | null`, `placeholder?: string`; `onChange(value: string)` остаётся. Null отображается без formatter/toDate. Это existing component, не второй picker.

`ConfirmDialog` уже принимает `cancelLabel` и фокусирует вторичную кнопку (16–25,69–71). Reuse этого API для disconnect; финальная copy принадлежит UI owner. Accepted disconnect показывает progress, lost response требует GET; `disconnect_failed` и operator-confirmed revoke остаются разными состояниями. DTO/allowedActions определяет RESEARCH §2; unfinished UI copy здесь не фиксируется.

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

DB conventions берутся из `schema.ts`: natural key `lessonExceptions` (240–258), FK restrict, unique alternative refs `lessonMarks` (291–309), account-bound settings (313–322). NEW `calendar-schema.ts` владеет connection/flow, normalized event cache и coverage/next proofs, command/stage journal, mapping/reservations и historyCutoverAt. Account/generation/provider identity/version присутствуют в ключах и predicates. Refresh envelope хранится encrypted; минимальный event snapshot и validated command payload действительно persisted, не только в памяти. Прочие Google поля не сохраняются. `db/src/index.ts` экспортирует owner, `drizzle.config.ts` включает его в schema input (baseline указывает только `./src/schema.ts`). Generated migration/snapshot не копировать и не править руками.

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

CALL эти loaders/mappers/locks и core. `loadScheduleRows` (337–400) остаётся источником local domain facts/history/preparation. Он больше не доказывает будущий Google calendar или next lesson. By-ref/lineage read для подготовки и recovery остаётся в rows owner; worker не копирует SQL и не реконструирует command из week UI DTO. `readSnapshot` (331–333) сейчас repeatable-read/read-only; перенос в DB принадлежит 21.1.

### C2 — один read model для Schedule, Today и next lesson

Existing `today/today.ts:25–29`:

```ts
export async function readToday(executor: DbExecutor, accountId: string, now: Date): Promise<TodayResponse> {
	const date = scheduleToday(now)
	const dayStart = midnight(date)
	const day = await readWindow(executor, dayStart, midnight(addDays(date, 1)), now)
	const past = await readWindow(executor, midnight(addDays(date, -MARK_LOOKBACK_DAYS)), dayStart, now)
```

Existing `cards/card-facts.ts:43–50`:

```ts
async function cardNextLessons(
	executor: DbExecutor,
	cards: readonly FactSource[],
	now: Date
): Promise<Map<string, Date>> {
	const rows = await loadScheduleRows(executor, { from: now, to: null, studentIds: cards.map((card) => card.id) })
	return nextLessons({ ...rows, now })
}
```

Existing `routes/today.ts:17–20`:

```ts
	routes.get('/', async (c) => {
		const accountId = c.get('session').account.id
		const today = await readSnapshot(db, (executor) => readToday(executor, accountId, new Date()))
		return c.json(today satisfies TodayResponse, 200)
```

Это три integration seams, не дополнительные основные аналоги. Future Schedule/Today upcoming/counts и `cardNextLessons` переходят на `calendar/read-model.ts` + `reads.ts`. Read-model хранит normalized Google facts с account, connection generation, provider ID/ETag, snapshot revision, fetchedAt и coverage. Reads получает все страницы, валидирует их и публикует complete window одной transaction. Page failure сохраняет прежний covered last-known; иначе unavailable. Нельзя дополнять окно legacy future rows.

`routes/{schedule,today,students}.ts` выполняют общий refresh **до** DB snapshot. Today читает тот же window owner, без отдельного Google reader. Cards читает shared next index. Пересекающийся новый read/command projection инвалидирует устаревшие window/next proofs; generation/revision CAS не даёт позднему ответу перезаписать новые факты. Read не снимает pending command barrier.

Next index использует ordered provider stream и известные student mappings. Полностью прочитанный prefix до первого подходящего урока доказывает known; end-of-list или доказанное отсутствие bindings — none. Deadline/оборванная страница — unknown для неразрешённых студентов. Нет скрытого горизонта и fallback на local recurrence. Last-known next, который уже прошёл, не превращается автоматически в следующий. Batch index публикуется атомарно; частичный week не получает fresh.

`cardFacts` получает accountId и обязательный `nextLesson: NextLessonRead`; `toCardRow` (card-rows:44–55) передаёт status и совместимый nextLessonAt. `cardBalances` (card-facts:26–41), local payments и Pays soon сохраняют владельца. Card create/update/archive/restore/opening-balance ответы читают cached facts без HTTP внутри write transaction. `createCard` возвращает корректный unknown/none status; `importCard` facts не вызывает и не расширяется.

`historyCutoverAt` фиксируется при первой активации режима. Существовавшая до cutover прошлая history и все existing marks сохраняются. Legacy future без binding не становится подтверждённой history с течением времени: historical read filter и `schedule/marks.ts` (43–85) исключают новые marks для этих rows, pending и external events. Новые confirmed lessons переходят в history обычным путём. Автоэкспорт legacy future и title matching отсутствуют.

API reference для этих reads: [pagination](../../../docs/google-calendar/articles/guides/pagination.md), [events.list](../../../docs/google-calendar/articles/v3/reference/events/list.md), поля `singleEvents/orderBy/pageToken/nextPageToken/timeMin/timeMax`. Чтение всех страниц подтверждает complete traversal, не SQL-атомарность состояния Google между запросами. Source-of-truth/публикация/proofs — решение RESEARCH §1.

### Composition, shutdown, errors

`lifecycle.ts:3` и `server.ts:46–48`:

```ts
export type Closable = { name: string; close: () => Promise<void> }
```

```ts
housekeeping.start()

lifecycle.manage({ server, wss, resources: [housekeeping, { name: 'pg-pool', close: () => pool.end() }] })
```

NEW worker предоставляет `start(): Promise<void>` и `Closable`. `server.ts` создаёт/запускает его и ставит worker перед pool. `lifecycle.ts:71–77` уже закрывает resources по порядку; использовать этот seam для Calendar close/deadline, без второго shutdown owner. Journal recovery/queue/network abort закрывает сам worker в пределах существующего deadline. `app.ts` только получает зависимости; import приложения не запускает worker.

`config.ts:25–28` — единственный application env parser; `resolveDatabaseUrl` остаётся в DB. `migrate.ts:7–12` использует migrator и process.exitCode=1 при ошибке. Queue schema/queues создаёт migration owner; app runtime не повышает права и не отключает maintenance ради обхода permission error. Existing provisioning grants только public schema (`ensure-db.sql:31–34`); queue grants задаются отдельно.

`request-context.ts:60–62`:

```ts
export const errorBody = (code: ErrorCode, message: string, extra?: { retryAfterSeconds?: number }) => ({
	error: { code, message, requestId: currentRequestId(), ...extra },
})
```

CALL errorBody/logger, но до их вызова gateway/connection превращает raw SDK exception в безопасную категорию. `request-context.ts:47–54` пишет `c.req.path` без query; Caddy `log { format json }` (16–19) требует отдельной redaction callback query. Ни logger, ни queue не получают token, event body, title, calendar ID/email или callback query.

## Public signatures and cross-module wiring

Все Calendar declarations — **NEW, ещё не source exports**. Точные DTO принадлежат RESEARCH §2 и contracts owner; карта назначает callers, не вводит вторую схему. Internal prepared/provider types остаются в API; web получает только contracts.

| Owner | Public/cross-module surface | Callers / boundary |
| --- | --- | --- |
| contracts/calendar.ts | `GoogleConnectionSnapshot`, `CalendarIssue`, `CalendarReadStatus`, `CalendarEventView`, `GoogleScheduleWindow`, `NextLessonRead` | Flat connection state; read fresh/last_known/unavailable; write ready/blocked; binding lesson/transition/external |
| contracts/calendar.ts + schedule.ts | `CalendarCommandMeta`, `CalendarCommandReceipt`, `CalendarCommandSnapshot` | requestId + expectedVersion; 202 receipt; confirmedRevision/affectedRefs/effect/state/nextAction по RESEARCH |
| contracts/today.ts + students.ts | `TodayResponse.calendarRead/calendarWrite`; `StudentRow.nextLesson` | Upcoming/next из shared projection; nextLessonAt только из nextLesson.startsAt; known non-null, none/unknown null |
| calendar/reads.ts + read-model.ts | `refreshCalendarRead`, `readCalendarWindow`, `readNextLessons` | Authenticated routes refresh до DB snapshot; readers получают явные context/selection; same normalized facts/proofs |
| calendar/commands.ts + journal.ts | `submitCalendarCommand`, `readCalendarCommand`; by-request/unresolved lookup | Account-scoped admission/status; immutable typed payload, IDs/ETags/lineage и dispatch deadline |
| schedule/command-plan.ts | `prepareScheduleCommand` | CALL existing core/rows; no confirmed mutation |
| schedule/command-apply.ts | `applyConfirmedCommand` | Worker после verified provider facts; idempotent SQL+mapping/read-model+journal applied |
| calendar/transitions.ts | Persisted cut/end stages и reserved old-series/originalOn → detached lesson ID lineage | Journal хранит progress/ETags/partial effect; explicit resume того же command |
| calendar/gateway.ts | Narrow typed operations из COVERAGE | OAuth из connection/credentials; event writes только worker/transitions; all-page read для window/next/conflicts/reconcile |
| calendar/event-mapping.ts | Deterministic identity, canonical instance binding, representationGeneration | Generation OAuth не входит в provider ID; representation меняется только по prescribed absence proof |
| calendar/connection.ts + credentials.ts | Consent, flat snapshot, disconnect/retry/confirm-revoked; token operation | Server session/epoch binding; encrypted refresh; provider-confirmed и operator-confirmed revoke различны |
| schedule/rows.ts | CALL loaders/mappers/locks; planned by-ref/lineage/history read | Preparation/apply/history, без independent future projection |
| cards/card-facts.ts + cards.ts + card-rows.ts | `cardFacts` дополнен accountId и `CardFacts.nextLesson`; existing card callers передают context | get/list/update/archive/restore/setOpeningBalance → cached shared next read; create status без сети; importCard unchanged |
| calendar/worker.ts | Planned `start(): Promise<void>`, `name: string`, `close(): Promise<void>` | server composition; lifecycle close; journal truth и connection-scoped DB lease |
| web components/app/google-calendar-state.tsx | Shared validated connection/read/write/command status + refresh | Settings/Schedule/Today; unresolved recovery после reload; no optimistic connected/saved |
| web components/app/google-conflicts.tsx | Shared candidate/checkThrough/inputKey → strict result presentation | Create/move/series forms; recurrence только server; unavailable blocks write |
| web date-field.tsx | Planned nullable value + optional placeholder; onChange valid string | Existing picker для пустого Check through |
| web api-client.ts + schedule-mutations.ts | CALL transport `apiRequest`; MOD `mutate` receipt/status result | Schedule callers признают success только после applied и shared read refresh |

Exact internal signatures из RESEARCH Planned write set:

```text
type CalendarReadContext = { accountId: string; now: Date }
type CalendarReadSelection =
  | { kind: 'window'; start: Date; end: Date; displayTimeZone: string }
  | { kind: 'next'; studentIds: readonly string[] }

refreshCalendarRead(context: CalendarReadContext, selection: CalendarReadSelection): Promise<void>
readCalendarWindow(executor: DbExecutor, context: CalendarReadContext,
  selection: Extract<CalendarReadSelection, { kind: 'window' }>): Promise<GoogleScheduleWindow>
readNextLessons(executor: DbExecutor, context: CalendarReadContext,
  studentIds: readonly string[]): Promise<ReadonlyMap<string, NextLessonRead>>
submitCalendarCommand(context: CalendarReadContext,
  input: ValidatedCalendarCommand): Promise<CalendarCommandReceipt>
readCalendarCommand(context: CalendarReadContext, commandId: string): Promise<CalendarCommandSnapshot>
prepareScheduleCommand(executor: DbExecutor, input: ValidatedCalendarCommand,
  context: CalendarReadContext): Promise<PreparedCalendarCommand>
applyConfirmedCommand(tx: DbExecutor, command: PreparedCalendarCommand,
  confirmation: VerifiedGoogleResult): Promise<void>
```

`ValidatedCalendarCommand` — strict discriminated schedule input + target/meta. `PreparedCalendarCommand` — immutable typed plan из journal; `VerifiedGoogleResult` — validated provider/stage facts, не boolean ack. Existing auth `session.account.id/session.token` передаются server-side; epoch проверяется в DB, не выдумывается в client DTO.

### HTTP handoff и command status

| Endpoint без /api | Result / gate |
| --- | --- |
| POST /google/connect; GET /google/callback | Authorization URL; fixed clean settings redirect, session/state binding |
| GET /google/connection | Flat GoogleConnectionSnapshot: state/calendar/generation/issue/pendingCommandCount/disconnectResolution/allowedActions |
| GET /schedule/week?start=YYYY-MM-DD | GoogleScheduleWindow; requestedRange/snapshotRange, read status и write capability |
| POST /schedule/lessons | Existing create input + requestId/expectedVersion window token → 202 receipt |
| POST /schedule/lessons/:id/{move,cancel,restore} | Existing body + command meta/version target → 202 receipt |
| POST /schedule/series/:id/occurrences/:originalOn/{move,cancel,restore} | Same natural ref + command meta/version → 202 receipt |
| POST /schedule/series/:id/{move,end} | Whole affected-series version → 202 receipt |
| GET /google/commands/by-request/:requestId | Lost-response lookup; 404 только journal-not-found, retry тот же requestId/body |
| GET /google/commands?state=unresolved | Reload/new-tab recovery; count commands, не stages/jobs |
| GET /google/commands/:commandId | Account-scoped CalendarCommandSnapshot; applied требует reread общей projection |
| POST /google/commands/:commandId/resume | Только partial_recovery/recovery_required; fresh revalidation, та же команда |
| POST /google/conflicts | Strict not_checked/complete/unavailable; complete includes matchedStartsAt |
| POST /google/disconnect | Durable revoke, stopped dispatch; connection status показывает result |
| POST /google/disconnect/confirm-revoked | Explicit operator confirmation, не provider success |
| Existing /mark endpoints | Local history/confirmed binding; reject pending/external/legacy future |

До acceptance 409 precondition_failed/command_pending/external_change/history_only либо connection/reconnect/permission-required; 503 provider_unavailable. Confirmed domain rows не вставляются. `connected` не доказывает текущую сеть: admission и dispatch проверяют её заново. Definitive failure допускает новую команду только с новым requestId/expectedVersion и новым Save.

### Provider ack, cut и restart history

1. Fresh admission проверяет provider/preconditions и domain eligibility; transaction резервирует IDs/entity barrier и immutable journal. No confirmed local Save до ack. Job содержит только commandId; lost wake-up восстанавливается из journal.
2. Worker сериализует stable connection через session advisory lease на отдельном DB connection. Перед HTTP сохраняет attempt. Неотправленная команда с потерянным admission/deadline завершается failed/not_applied; reconnect не запускает offline backlog.
3. После неизвестного remote outcome worker сверяет actual provider facts, ownership, identity и ETag. Markers сами по себе не proof. Conditional update использует captured version; [versioned resources](../../../docs/google-calendar/articles/guides/version-resources.md) описывает If-Match/412. Stale command не переписывает внешнее изменение.
4. Подтверждённый Google effect + сбой SQL даёт projection_pending: повторить только idempotent apply. `applied` устанавливается вместе с projection commit; response после restart не повторяет Google write.
5. `ScheduleOccurrenceRef` — existing single lessonId либо seriesId + natural originalOn. Instance ID/originalStartTime принадлежат Google. Не строить suffix и не вставлять отдельный event вместо moved occurrence. Identity/restore policy из RESEARCH §4; отдельного API исследования здесь нет.
6. Для cut/end plan резервирует old/new rule IDs и detached lineage один раз. Remote stages: captured-precondition read → cancel old tail/trim → proof old tail inactive → ensure detached singles/new master. Пока старая representation может быть active, вторую не создавать; учитывать still-valid prefix.
7. Каждый stage checkpointed. Partial Google facts показываются через transition binding; нет false full Save или rollback уже случившегося provider effect. Explicit resume продолжает тот же command после fresh checks. Final proof допускает apply; текущие marks читаются под locks, история не теряется.
8. `representationGeneration` — persisted часть deterministic ID, не OAuth generation/retry counter. Missing cancelled single restore требует bound-access и GET/all-pages absence proof по RESEARCH; один 404 недостаточен. Retry использует уже reserved generation.
9. Disconnect останавливает dispatch и fence-ит in-flight операции. Failed revoke остаётся видимым; provider-confirmed и operator-confirmed resolution не смешиваются. Same-target reconnect разрешает уже dispatched unknown/partial recovery, но не оживляет unsent commands. Phase 25 watch/matching не требуется для обычных Phase 24 reads.

### Dependency 21.1 — CALL после реализации

Источники в этом repo: [21.1 RESEARCH](../21.1-default-time-zone/21.1-RESEARCH.md), Stable Interface; [21.1 PATTERNS](../21.1-default-time-zone/21.1-PATTERNS.md), shared owners; [21.1 PLAN-INDEX](../21.1-default-time-zone/21.1-PLAN-INDEX.md), review clarifications. Это planning inputs, не code analogs.

- TeacherSettings.defaultTimeZone задаёт новые inputs/display. Stored lesson/series timeZone сохраняет creation/rule zone; default change не reschedule и не создаёт IDs/commands.
- Planned core CALL: `LocalTimeCandidates = readonly Date[]`; `localTimeCandidates(date,time,zone)`; `startOfZonedDay(date,zone)`. Calendar не копирует DST math.
- Cut success сохраняет `{ kind: 'ok'; oldEndsOn; newRule; lessons }`; newRule/CutLesson получают timeZone, CutLesson.originalOn сохраняется. API резервирует IDs; core их не придумывает. Phase 24 переносит confirmed insert/mark seam за provider ack.
- Create/move/whole-series/end используют expectedDefaultTimeZone; marks/cancel/restore сохраняют instant/ref guards. readSnapshot переходит в DB, mutation context принадлежит settings.
- Baseline fixed SCHEDULE_TIME_ZONE не переносится в новое mapping/conflicts поведение. Existing 21.1 planning слово outbox не задаёт алгоритм Phase 24: D-13/D-14 и текущий Research владеют command-before-apply контрактом.

D2: `CalendarSeriesContext={series:ScheduleSeries,version:string}` и `GoogleScheduleWindow.series` связывают общий reads/read-model owner с Whole series/End после reload. Producer проверяет Google master/canonical rule и future reference prefix; consumers переиспользуют ScheduleSeries21.1 со stored timeZone/referenceOccurrence и whole-series version. Missing context запрещает действие. Владельцы: contracts/calendar с read-only reuse contracts/schedule21.1, calendar/reads+read-model, move-series/end-series/lesson-dialogs; планы02/05/11/12. E2E reload→Whole series с moved reference не допускает замены natural rule actual временем.

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

| SC | Requirement | Owners / decisive future evidence |
| --- | --- | --- |
| SC1 | GCAL-01 | P1/P3, credentials/config/Caddy; consent/session/state/encrypted refresh, safe errors; Production/day-8 остаются external acceptance |
| SC2 | GCAL-02 | P2/command-plan/apply/mapping/transitions; no confirmed row до ack, single/master/instance identity, cut/end lineage и current marks |
| SC3 | GCAL-03 | Commands/journal/worker; 202 status recovery, duplicate request, entity barrier, admission expiry, unknown/partial/projection_pending, restart/lease/shutdown |
| SC4 | GCAL-09 | P1/P3/P4/read owners; outage last-known/unavailable, every write blocked, pending recovery, truthful revoke/reconnect без unsent replay |
| SC5 | GCAL-10 | Gateway/contracts/core + shared conflicts; all pages, finite candidate/inputKey, complete advisory overlap, unavailable blocks write |
| SC6 | GCAL-01 | Public pages/proxy; anonymous/expired cookie access, private root preserved; live Branding/Production отдельно |
| C2 | Shared Google projection | Schedule + Today upcoming/counts + cardNextLessons; same provider time/status/version, known/none/unknown, local Earlier/marks/balances/Pays soon preserved |

COVERAGE сохраняет 42 capabilities: 10 INTEGRATE, 32 OPT-OUT. `events.list` обслуживает ordinary window/next reads, conflicts и recovery; Google read в Phase 24 не отложен до watch/matching Phase 25. OAuth/CalendarList/mutation capabilities сохраняют owners COVERAGE; новая matrix здесь не создаётся.

Future durable scenarios до реализации поведения:

| Failure mode | Expected observable result / journey |
| --- | --- |
| Outage/disconnected/incomplete page | Covered last-known либо unavailable; no local future fallback/false empty; Schedule/Today write actions blocked — calendar/today |
| Changed Google time/status и stale index | Same shared projection на Schedule/Today/Students; next unknown при incomplete proof, history/Pays soon available — today |
| POST lost response/reload/double submit | Same requestId receipt/status; 202 не saved; unresolved recovered; conflicting body/identity rejected — calendar/move |
| Unsent deadline/outage/restart | failed/not_applied; reconnect не создаёт урок без нового Save — calendar |
| Dispatched unknown или ack→SQL failure | Reconcile facts; no duplicate Google event; projection_pending повторяет только apply — move |
| Partial cut/end + concurrent mark | Explicit recovery, one active representation, exact reserved lineage; current mark/history preserved — move/marks |
| Legacy future crosses cutover | Не появляется в Earlier и не принимает новую mark как confirmed lesson; existing marks remain — marks/today |
| Conflict incomplete/stale result | unavailable blocks write; complete overlap advisory; old inputKey не снимает gate — calendar |
| Revoke failure/operator confirmation | Truthful disconnect_failed/provider_confirmed/operator_confirmed; no unsent replay — calendar |

Использовать существующие `e2e/{calendar,move,marks,today}.spec.ts` по изменённому поведению. Локальный `yarn test:e2e` проверяет localhost через wait-dev и не подходит для отдельного HTTPS target. Для него применять direct `E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts e2e/move.spec.ts e2e/marks.spec.ts e2e/today.spec.ts --grep '\[calendar\]' --project=light` и preflight origin/build/разрешённой persistence из RESEARCH §Failure modes. Это будущая команда, сейчас не запущенная. P5 сохраняет harness/public-interface/persistence boundary; новые isolated suites не нужны. Evidence исполнения: diff fingerprint, fixture refs, expected/observed result, exit и rerun command. Сейчас E2E/runtime/provider/Production/day-8 — **NOT RUN**.

## No Analog Found

| File / surface | Role / flow | Disposition |
| --- | --- | --- |
| calendar/read-model.ts + reads.ts | service / request-response | Новый Google facts/coverage/next owner; existing Today/cards дают caller seams, не готовый provider read |
| calendar/gateway.ts + event-mapping.ts | service / transform | Google typed transport/conditional identity — NEW по RESEARCH/COVERAGE; domain recurrence CALL |
| calendar/worker.ts | service / event-driven | Durable lease/reconcile/recovery — NEW; lifecycle/start/close CALL |
| calendar commands/journal/transitions | service / event-driven | P2 только structural transaction аналог; remote command state machine не существует в baseline |
| public welcome/privacy/terms | route / request-response | Static public prose без auth read; root UI primitives CALL, copy отдельно |
| generated migrations/snapshot/yarn.lock | generated / batch | Генераторы владеют содержимым; ручной аналог не нужен |

P3 не реализует OAuth/envelope; P4 не реализует Calendar state machine. Аналоги сохраняют структуру и conventions, текущие RESEARCH/ARCH задают новое поведение.

## Metadata

**Search scope:** сохранены пять основных P1–P5 и 45 исходных fingerprints. Для C2/schema wiring прочитаны только seven existing owners: today/today, cards/card-facts, cards/card-rows, routes/today, schedule/marks, contracts/today и db/drizzle.config. Итого 52 source inputs. Поиск новых аналогов не проводился. CodeGraph исключён заданным narrow scope.

**Document inputs:** текущие CONTEXT/RESEARCH/ARCH/COVERAGE; repo-local 21.1 RESEARCH/PATTERNS/PLAN-INDEX; READING и узкие pagination/events.list/version-resources references. UI draft не frozen input. При изменении input проверяется затронутое назначение; неизменные inputs не требуют повторного исследования.

**Write boundary:** только PATTERNS через patch editor. Source, env, DB, runtime и Git state не изменялись. Static doc-check ниже проверяет root, inventory, tracked owners, сохранённые excerpts, fingerprints и границы текущего контракта. Это не runtime readiness.

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
| `apps/api/src/today/today.ts` | `dcc5b2f1126b3a9f34f0ffbf076a437651c378ad4318b4170886eef07d2cc11e` |
| `apps/api/src/cards/card-facts.ts` | `dfe6f168fdf78715ed8da076c8e09d88adabe3137fedd13886285a6dafb25948` |
| `apps/api/src/cards/card-rows.ts` | `8c430aa7dbda7e4bbc7d7c586ce58b0c9002d410c4b530262a550014cd94e67f` |
| `apps/api/src/routes/today.ts` | `c3ed42cb1b0d487a90723239e5f55ae389a5bc375702ae582b29e79b6dbbd8f9` |
| `apps/api/src/schedule/marks.ts` | `bd34ff3f9084dc8eb1d7de192bf47b407c04298890db6541163aa3209f483a71` |
| `packages/contracts/src/today.ts` | `a9011daf4de98d811c0385318a341936a91aa8b10f88431f2f53ccbf81ba3346` |
| `packages/db/drizzle.config.ts` | `74a78fbefaef09f8dcde9b60faf78cf216259a5c9253a229c598654b823812ce` |

### Input fingerprints

| Path | SHA-256 |
| --- | --- |
| `AGENTS.md` | `fbef0e319fe49ffb5ab0067e8feac8093172f958b0a70808ff5a376bbb72c9be` |
| `.planning/EXECUTOR-RULES.md` | `1eca1fa30e110bd04658cbf885d1b2189ce854f3cd3ed49664194f6121cbd449` |
| `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md` | `ac66b788f6df2dba913b123bd60dd518896ea88915038421e9366834f88317c3` |
| `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-RESEARCH.md` | `431e89eb6d21f9a7d96a0ca58200e32d4b868363cb3582e9787c14ff07746876` |
| `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-ARCH-REVIEW.md` | `6a9d9f9f85d052706b57a5577e588ff93aae067eee9b00dbcece68c8ce2c20ae` |
| `.planning/phases/24-google-calendar-connection-and-outbound-sync/COVERAGE.md` | `5788937674bec567ca5f067caa49b8a9d95e2635922b4f3673216514bb9efaec` |
| `.planning/phases/21.1-default-time-zone/21.1-RESEARCH.md` | `3db87f2370abb6cbfd6b94e563b8bc7d67eb42b23a4e09bf09647f7efeded657` |
| `.planning/phases/21.1-default-time-zone/21.1-PATTERNS.md` | `46a6e5d67acc41ac1f1c655c19ac78954c76e5e1883b163df502e2b2ca3d056c` |
| `.planning/phases/21.1-default-time-zone/21.1-PLAN-INDEX.md` | `a95caaa4ac5015c5979dc7bac32e807b2e9a67b996dce8982954d8eefbd9e8e5` |
| `docs/google-calendar/READING.md` | `3d8d9ce8a7efc33c7cfa9fb5762e68d2b978eeb8f0a14673cd80aaf63dba5d6f` |
| `docs/google-calendar/articles/guides/pagination.md` | `a727b2120e1f15d3808d86be3d9eeef801abc5ccb2bfb185fd1b6a34946b0890` |
| `docs/google-calendar/articles/guides/version-resources.md` | `813c9eb7af279ef18f06fa82101c4fa398af72bc0e4ac412ba12387d0d0c2a31` |
| `docs/google-calendar/articles/v3/reference/events/list.md` | `12f04274c628c8b50afa1eeae6ea97d6a4a9f30e1f86fc1046bc6afa230f5e23` |

### Reproducible doc-check

Из указанного ROOT. Команда читает только document/source bytes и Git index; таблицы разбираются по trim ячеек. Source snippets проверяются после нормализации внешних отступов каждой строки; их токены/порядок строк должны совпасть.

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
           if len(r) == 3 and re.fullmatch("SC[1-6]|C2", r[0])]
def normalized(value):
    return "\n".join(line.strip() for line in value.strip().splitlines())
snippets = re.findall(r"```tsx?\n(.*?)\n```", body, re.S)
sources = [normalized((root / p).read_text()) for p, _ in source_pairs]
missing_excerpts = [i + 1 for i, block in enumerate(snippets) if not any(normalized(block) in s for s in sources)]
links = re.findall(r"\]\(([^)]+)\)", body)
local_links = [p.split("#", 1)[0] for p in links if not p.startswith(("http:", "https:", "#"))]
missing_links = [p for p in local_links if not (phase / p).is_file()]
checks = {
    "root": str(root.resolve()) == "/Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab",
    "inventory": len(inventory) == 80 and len({r[0] for r in inventory}) == 80,
    "states": [sum(r[1] == state for r in inventory) for state in ["NEW", "MOD", "GENERATED"]] == [23, 54, 3],
    "existing_tracked": all(p in tracked and (root / p).is_file() for p in modified),
    "new_not_existing": all(not (root / r[0]).exists() for r in inventory if r[1] == "NEW"),
    "five_tracked_analogs": len(analogs) == 5 and all(r[1] in tracked for r in analogs),
    "source_fingerprints": len(source_pairs) == 52 and not source_changes and all(p in tracked for p, _ in source_pairs),
    "input_fingerprints": len(input_pairs) == 13 and not input_changes,
    "source_excerpts": len(snippets) == 25 and not missing_excerpts,
    "local_links": bool(local_links) and not missing_links and "../../phase-21-1-default-time-zone" not in body,
    "sc_and_requirements": {r[0] for r in sc_rows} == {"SC1", "SC2", "SC3", "SC4", "SC5", "SC6", "C2"} and
        set(re.findall("GCAL-[0-9]+", " ".join(r[1] for r in sc_rows))) == {"GCAL-01", "GCAL-02", "GCAL-03", "GCAL-09", "GCAL-10"},
    "capabilities": len(coverage) == 42 and len({r[0] for r in coverage}) == 42 and sum(r[1] == "INTEGRATE" for r in coverage) == 10,
    "boundaries": all(k in body for k in ["prepareScheduleCommand", "applyConfirmedCommand", "readNextLessons",
        "historyCutoverAt", "partial_recovery", "projection_pending", "by-request/:requestId", "representationGeneration",
        "expectedDefaultTimeZone", "readSnapshot", "/welcome", "/privacy", "/terms", "NOT RUN"]),
    "no_retired_write_owners": not any(r[0].endswith(("/outbox.ts", "/use-google-connection.ts", "/calendar-panel.tsx")) for r in inventory),
    "fences": sum(line.startswith(chr(96) * 3) for line in text.splitlines()) % 2 == 0,
    "no_sentinel_or_trailing_space": not re.search("^<!-- gsd:write-continue -->$", text, re.M) and all(line == line.rstrip() for line in text.splitlines())
}
ok = all(checks.values())
print(json.dumps({"status": "PASS" if ok else "FAIL", "checks": checks, "classified": len(inventory),
                  "analogs": len(analogs), "source_fingerprints": len(source_pairs), "input_fingerprints": len(input_pairs),
                  "excerpts": len(snippets), "missing_excerpts": missing_excerpts, "missing_links": missing_links,
                  "capabilities": len(coverage), "changed_sources": source_changes, "changed_inputs": input_changes,
                  "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}, ensure_ascii=False))
raise SystemExit(0 if ok else 1)'
```

**Evidence:** встроенный doc-check завершён с exit 0: PASS, 16 checks; classified=80, analogs=5, source_fingerprints=52, input_fingerprints=13, excerpts=25, capabilities=42. changed_sources=[], changed_inputs=[], missing_excerpts=[], missing_links=[]. `git diff --check -- .planning/phases/24-google-calendar-connection-and-outbound-sync/24-PATTERNS.md` завершён с exit 0, output пуст. Runtime/E2E/install/DB/Google/Production проверки NOT RUN; они не входят в этот handoff.
