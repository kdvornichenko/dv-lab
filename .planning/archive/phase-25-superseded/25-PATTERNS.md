# Phase 25: Google Calendar Two-Way Sync — Pattern Map

**Mapped:** 2026-10-12
**Source pin:** `56e1be2ae06eb6b3f9260af7cd268d945e453727` (24-08/12 integrated).
**Files classified:** 62 ownership rows, including conditional and generated files.
**Analogs found:** 59 / 62; exact 48, role-match 9, partial 2, none 3.

## Scope Card

Результат: дать planner25 проверенные владельцы, сигнатуры и узкие образцы для SC1–SC5/F01–F09.
В scope: Future Write Map из RESEARCH P1–P7 плюс принятые A1/A2 ARCH-REVIEW.
Вне scope: source edits, новые интерфейсы реализации, STATE/ROADMAP/UI/research, Git mutations, runtime, DB, env, provider, browser, deps, удаление, агенты, Chat/IELTS и полный аудит.
Запись: только этот файл. Main и чужие worktrees не изменяются.
Приёмка: каждый future owner имеет criterion → role/flow → tracked analog/signature либо явный пробел.
Проверка: tracked gate, pinned source SHA-256, строки excerpts, полнота SC/F, размер <500 строк и root pin.
A1: интегрированные source08/12 доступны в указанном commit; доказательство — Git pin и исходники ниже.
A2: final24-09/10/11 ещё не основание для execution25; подтверждение — CONTEXT и ARCH-REVIEW. Final rebind обязателен.
Work map: классификация закрывает F08; B1–B5/L1–L11 закрывают SC/F строк таблицы; L12 закрывает только путь доказательства F09.
Stop: карта питает PLAN25; никаких source/type/build/functional checks.

## File Classification

NEW/MOD — proposed future write set, не изменения этого mapper. CONDITIONAL — только при необходимости финальных shapes24. PARENT — координируемый владелец, не разрешение mapper на запись. GENERATED — точное имя назначит Drizzle.
Match exact у MOD означает существующего владельца роли/потока, а не уже реализованную inbound capability.
Все новые имена в этой карте **PROPOSED**. Existing signatures относятся только к source pin.

| New/Modified File                                                                | Role      | Data Flow                     | Closest tracked Analog                                               | Match      | Criterion            | Pattern assignment / symbol                                                                                                        |
| -------------------------------------------------------------------------------- | --------- | ----------------------------- | -------------------------------------------------------------------- | ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `NEW packages/contracts/src/calendar-sync.ts`                                    | model     | request-response              | `packages/contracts/src/calendar.ts`                                 | role-match | SC1–5/F01–08         | B1; PROPOSED GoogleSyncSnapshot/GoogleReviewList/GoogleReviewDecisionRequest/GoogleReviewDecisionSnapshot and query schemas        |
| `MOD packages/contracts/src/index.ts`                                            | config    | transform                     | `packages/contracts/src/index.ts`                                    | exact      | F08                  | L1: barrel export, new schemas defined once                                                                                        |
| `NEW packages/db/src/calendar-sync-schema.ts`                                    | model     | CRUD                          | `packages/db/src/calendar-read-schema.ts`                            | role-match | SC1–5/F01–07         | B2: seven proposed tables; outbound mapping remains command-owned                                                                  |
| `NEW packages/db/src/calendar-sync-values.ts`                                    | model     | transform                     | `packages/db/src/calendar-values.ts`                                 | role-match | SC1–4/F04–07         | B2: validated persisted values; PROPOSED CompleteInboundBatch and projection plan                                                  |
| `MOD packages/db/src/index.ts`                                                   | config    | transform                     | `packages/db/src/index.ts`                                           | exact      | F08                  | L1: export new schema/value owners                                                                                                 |
| `CONDITIONAL packages/db/src/schema.ts`                                          | model     | CRUD                          | `packages/db/src/schema.ts`                                          | exact      | SC1–5/F08            | L1: existing students ownership; schema export only if generator configuration requires                                            |
| `GENERATED packages/db/drizzle/<generated>/migration.sql`                        | migration | batch                         | `packages/db/drizzle/20261011161301_google_calendar/migration.sql`   | role-match | SC1–5/F08            | L1: generated additive artifacts, future names unknown; do not handwrite                                                           |
| `GENERATED packages/db/drizzle/<generated>/snapshot.json`                        | config    | transform                     | `—`                                                                  | none       | SC1–5/F08            | Generated by Drizzle with migration; not a handwritten source analog                                                               |
| `MOD apps/api/src/calendar/gateway.ts`                                           | service   | request-response              | `apps/api/src/calendar/gateway.ts`                                   | exact      | SC1,5/F01,02         | B3: add PROPOSED syncEvents/watchEvents/stopChannel; keep events window method                                                     |
| `NEW apps/api/src/calendar/sync-provider.ts`                                     | utility   | transform                     | `apps/api/src/calendar/provider-events.ts`                           | role-match | SC1,2,5/F02,05       | B3: PROPOSED parseSyncPage(input: unknown): ProviderSyncPage                                                                       |
| `NEW apps/api/src/calendar/sync.ts`                                              | service   | event-driven,batch            | `apps/api/src/calendar/worker.ts`                                    | role-match | SC1,4,5/F01,02,07    | B4: PROPOSED createCalendarSync; requestCheck/run/readStatus/acceptNotification                                                    |
| `NEW apps/api/src/calendar/sync-store.ts`                                        | store     | CRUD,batch                    | `apps/api/src/calendar/read-store.ts`                                | role-match | SC1–4/F02,06,07      | B5: complete batch publication/cursor CAS; journal idempotency L2                                                                  |
| `NEW apps/api/src/calendar/watch.ts`                                             | service   | event-driven                  | `—`                                                                  | none       | SC1,5/F01,09         | No registered callback/renewal protocol exists; B4 supplies lifecycle only                                                         |
| `MOD apps/api/src/calendar/worker.ts`                                            | service   | event-driven,batch            | `apps/api/src/calendar/worker.ts`                                    | exact      | SC1,4,5/F01,02       | B4: createCalendarWorker, existing same-writer dispatch/recovery                                                                   |
| `MOD apps/api/src/calendar/queue-schema.ts`                                      | config    | batch                         | `apps/api/src/calendar/queue-schema.ts`                              | exact      | SC5/F01,09           | L3: calendarQueueOptions; prepareCalendarQueue(migratorUrl: string): Promise<void>                                                 |
| `CONDITIONAL apps/api/src/calendar/credentials.ts`                               | service   | request-response              | `apps/api/src/calendar/credentials.ts`                               | exact      | SC1,4,5/F08          | L4: withAccessToken<T>; avoid recursive lease                                                                                      |
| `MOD apps/api/src/calendar/connection-control.ts`                                | service   | event-driven,CRUD             | `apps/api/src/calendar/connection-control.ts`                        | exact      | SC5/F01              | L3: disconnect(actor: ConsentActor); start/close; retire old-generation channels                                                   |
| `MOD apps/api/src/server.ts`                                                     | provider  | event-driven                  | `apps/api/src/server.ts`                                             | exact      | SC1,5/F08            | L3: composition, shared credentials/lease and resource close list                                                                  |
| `MOD apps/api/src/app.ts`                                                        | route     | request-response              | `apps/api/src/app.ts`                                                | exact      | SC1/F08              | L5: createApp(deps: AppDeps); narrow webhook mount before origin guard                                                             |
| `CONDITIONAL apps/api/src/lifecycle.ts`                                          | service   | event-driven                  | `apps/api/src/lifecycle.ts`                                          | exact      | SC5/F08              | L3: Lifecycle.manage/shutdown; register existing Closable contract first                                                           |
| `NEW apps/api/src/calendar/review.ts`                                            | service   | CRUD,request-response         | `apps/api/src/calendar/journal.ts`                                   | role-match | SC3/F03,05,06        | L2/L5: PROPOSED CalendarReview.list/decide/readDecision; local decision, not provider command                                      |
| `NEW apps/api/src/calendar/matching.ts`                                          | utility   | transform                     | `packages/contracts/src/identity.ts`                                 | partial    | SC3/F04              | L6: normalization only; no existing account-bound matching resolver                                                                |
| `MOD apps/api/src/cards/cards.ts`                                                | service   | CRUD                          | `apps/api/src/cards/cards.ts`                                        | exact      | SC3/F04              | L6: PROPOSED calendarMatchCandidates(executor: DbExecutor, accountId: string): Promise<readonly CalendarMatchCandidate[]>          |
| `MOD apps/api/src/calendar/event-mapping.ts`                                     | utility   | transform,CRUD                | `apps/api/src/calendar/event-mapping.ts`                             | exact      | SC2,3,4/F04,05,07    | L7: loadMappings/bindEvent; shared identity interface PROPOSED, planner-owned                                                      |
| `MOD apps/api/src/schedule/single-command.ts`                                    | service   | request-response,CRUD         | `apps/api/src/schedule/single-command.ts`                            | exact      | SC2,3,4/F04,05,07    | L7: singleTarget/prepareSingleCommand/validateEvidence; A1/A2 admission required                                                   |
| `MOD apps/api/src/calendar/single-observation.ts`                                | service   | request-response              | `apps/api/src/calendar/single-observation.ts`                        | exact      | SC2,3,4/F05,07       | L7: observeSingle(access: CommandAccess, input: SingleCommand, gateway: GoogleGateway): Promise<SingleEvidence>                    |
| `MOD apps/api/src/calendar/commands.ts`                                          | service   | request-response,CRUD         | `apps/api/src/calendar/commands.ts`                                  | exact      | SC3,4/F05,07         | L7: admitSingle; provider observation before SQL admission                                                                         |
| `CONDITIONAL apps/api/src/schedule/command-plan.ts`                              | service   | transform,CRUD                | `apps/api/src/schedule/command-plan.ts`                              | exact      | SC2,4/F05,07         | L7: prepareSingleCommand caller; PreparedCalendarCommand still only create/move/cancel/restore                                     |
| `NEW apps/api/src/schedule/inbound-projection.ts`                                | service   | batch,CRUD                    | `apps/api/src/schedule/command-apply.ts`                             | role-match | SC2,4/F05,07         | B5/L8: PROPOSED applyInboundProjection(tx: DbExecutor, batch: CompleteInboundBatch): Promise<InboundPublication>                   |
| `MOD apps/api/src/calendar/history.ts`                                           | service   | CRUD                          | `apps/api/src/calendar/history.ts`                                   | exact      | SC2,4/F07            | L8: PROPOSED freezeOccurrenceFacts(tx: DbExecutor, input: FreezeOccurrenceFacts): Promise<void>                                    |
| `MOD apps/api/src/schedule/rows.ts`                                              | service   | CRUD,transform                | `apps/api/src/schedule/rows.ts`                                      | exact      | SC2,4/F07            | L8: loadMarkRows; frozen facts with current marks exactly once                                                                     |
| `CONDITIONAL apps/api/src/schedule/marks.ts`                                     | service   | CRUD                          | `apps/api/src/schedule/marks.ts`                                     | exact      | SC2,4/F07            | L8: markOccurrence/markLesson existing lock+transaction; no frozen mark copy                                                       |
| `MOD apps/api/src/calendar/read-store.ts`                                        | store     | CRUD,batch                    | `apps/api/src/calendar/read-store.ts`                                | exact      | SC1,2,4/F02,07       | B5: PROPOSED publishWindowInTransaction(tx: DbExecutor, input: CompleteWindowPublication): Promise<ReadPublication>                |
| `MOD apps/api/src/calendar/read-model.ts`                                        | service   | request-response              | `apps/api/src/calendar/read-model.ts`                                | exact      | SC1,2/F02,07         | L9: readCalendarWindow/readNextLessons existing shared view                                                                        |
| `MOD apps/api/src/calendar/read-state.ts`                                        | model     | request-response              | `apps/api/src/calendar/read-state.ts`                                | exact      | SC1,2/F02,07         | L9: CalendarReadContext/ReadReceipt/currentRead WeakMap; not background durability                                                 |
| `MOD apps/api/src/calendar/reads.ts`                                             | service   | request-response              | `apps/api/src/calendar/reads.ts`                                     | exact      | SC1,2/F02,07         | L4/L9: refreshCalendarRead(context: CalendarReadContext, selection: CalendarReadSelection): Promise<void>                          |
| `MOD apps/api/src/calendar/series-context.ts`                                    | service   | request-response,transform    | `apps/api/src/calendar/series-context.ts`                            | exact      | SC2/F05,07           | L7: readSeriesContexts(transport: ReadTransport, snapshot: MappingSnapshot, now: Date): Promise<CalendarSeriesContext[]>           |
| `CONDITIONAL apps/api/src/calendar/read-pages.ts`                                | utility   | streaming,transform           | `apps/api/src/calendar/read-pages.ts`                                | exact      | SC2,3/F04,05         | L7/B3: bindEvent consumers at 75/93/129; collection sync must not reuse ordered traversal                                          |
| `CONDITIONAL apps/api/src/cards/card-facts.ts`                                   | service   | transform,request-response    | `apps/api/src/cards/card-facts.ts`                                   | exact      | SC2,4/F07            | L8/L9: balance and next adapter; prefer unchanged caller                                                                           |
| `CONDITIONAL apps/api/src/today/today.ts`                                        | service   | request-response,transform    | `apps/api/src/today/today.ts`                                        | exact      | SC2/F07              | L9: readToday(executor: DbExecutor, context: CardReadContext, paysSoonLessons: number): Promise<TodayResponse>                     |
| `MOD apps/api/src/calendar/dispatch.ts`                                          | service   | event-driven,CRUD             | `apps/api/src/calendar/dispatch.ts`                                  | exact      | SC4/F07              | L10: projectCommand(access: Pick<CommandAccess, 'db' \| 'signal'>, command: CommandRow)                                            |
| `MOD apps/api/src/calendar/recovery.ts`                                          | service   | event-driven,request-response | `apps/api/src/calendar/recovery.ts`                                  | exact      | SC4/F07              | L10: reconcileCommand(access: CommandAccess, command: CommandRow, gateway: GoogleGateway, explicit = false)                        |
| `MOD apps/api/src/schedule/command-apply.ts`                                     | service   | CRUD                          | `apps/api/src/schedule/command-apply.ts`                             | exact      | SC4/F07              | B5/L10: applyConfirmedCommand(tx: DbExecutor, command: PreparedCalendarCommand, confirmation: VerifiedGoogleResult): Promise<void> |
| `MOD apps/api/src/calendar/command-result.ts`                                    | utility   | transform                     | `apps/api/src/calendar/command-result.ts`                            | exact      | SC4/F07              | L10: exact ACK verifier; no unrelated inbound applied                                                                              |
| `MOD apps/api/src/routes/google.ts`                                              | route     | request-response              | `apps/api/src/routes/google.ts`                                      | exact      | SC3/F08              | L5: googleRoutes; session-derived ConsentActor, noStore, schema parse, refusal                                                     |
| `NEW apps/api/src/routes/google-notifications.ts`                                | route     | event-driven,request-response | `—`                                                                  | none       | SC1,5/F08            | No provider callback-auth route; L5 gives Hono/error shape only, never teacher guard                                               |
| `MOD apps/web/app/(app)/settings/_components/calendar-card.tsx`                  | component | request-response,event-driven | `apps/web/app/(app)/settings/_components/calendar-card.tsx`          | exact      | F01–08               | L11: CalendarCard({callbackOutcome}: {callbackOutcome: string \| null}); existing panels/focus                                     |
| `MOD apps/web/components/app/google-calendar-state.tsx`                          | hook      | request-response,event-driven | `apps/web/components/app/google-calendar-state.tsx`                  | exact      | F01–08               | L11: useGoogleConnection(callbackOutcome: string \| null = null); validated safe reads                                             |
| `CONDITIONAL apps/web/lib/lesson-actions.ts`                                     | utility   | transform                     | `apps/web/lib/lesson-actions.ts`                                     | exact      | SC2,3/F05,07         | L11: canEditCalendarEvent(event: CalendarEventView, window: GoogleScheduleWindow): event is CalendarLesson                         |
| `CONDITIONAL apps/web/app/(app)/schedule/_components/schedule-mutations.ts`      | hook      | request-response,event-driven | `apps/web/app/(app)/schedule/_components/schedule-mutations.ts`      | exact      | SC4/F07              | L11: useScheduleMutation(selection: CalendarSelection \| null); public readWindow + stale gate                                     |
| `CONDITIONAL apps/web/app/(app)/schedule/_components/calendar-lesson-dialog.tsx` | component | event-driven                  | `apps/web/app/(app)/schedule/_components/calendar-lesson-dialog.tsx` | exact      | SC2,3/F05,07         | L11: CalendarLessonDialog(props: Props); action writer and confirmed toast                                                         |
| `CONDITIONAL apps/web/app/(app)/schedule/_components/lesson-move-form.tsx`       | component | event-driven                  | `apps/web/app/(app)/schedule/_components/lesson-move-form.tsx`       | exact      | SC2,4/F05,07         | L11: LessonMoveForm(...: LessonMoveFormProps); captured event/ref + useScheduleMutation                                            |
| `PARENT e2e/calendar-evidence.spec.ts`                                           | test      | request-response,event-driven | `e2e/calendar-evidence.spec.ts`                                      | exact      | SC1,5/F09            | L12: existing real consent/evidence journey                                                                                        |
| `PARENT e2e/calendar-settings.spec.ts`                                           | test      | request-response,event-driven | `e2e/calendar-settings.spec.ts`                                      | exact      | SC3,5/F03–06,09      | L12: snapshot/openSettings/mutationAuthority; real settings                                                                        |
| `PARENT e2e/calendar-view.spec.ts`                                               | test      | request-response,event-driven | `e2e/calendar-view.spec.ts`                                          | exact      | SC1,2,3/F02,05,09    | L12: public view, no false empty/ready                                                                                             |
| `PARENT e2e/calendar.spec.ts`                                                    | test      | request-response,event-driven | `e2e/calendar.spec.ts`                                               | exact      | SC1,3,4/F02,06,07,09 | L12: existing read/command recovery support                                                                                        |
| `PARENT e2e/move.spec.ts`                                                        | test      | request-response,event-driven | `e2e/move.spec.ts`                                                   | exact      | SC2,4/F05,07,09      | L12: singleChanges/singleRace, extend inbound assignment variants                                                                  |
| `PARENT e2e/marks.spec.ts`                                                       | test      | request-response,event-driven | `e2e/marks.spec.ts`                                                  | exact      | SC2,4/F07,09         | L12: calendarHistoryMarks; current mark/accounting evidence                                                                        |
| `PARENT e2e/today.spec.ts`                                                       | test      | request-response,event-driven | `e2e/today.spec.ts`                                                  | exact      | SC2/F07,09           | L12: calendarHistoryRead/calendarNextCards/calendarTodayUi                                                                         |
| `PARENT e2e/support/calendar-fault-protocol.ts`                                  | utility   | event-driven,transform        | `e2e/support/calendar-fault-protocol.ts`                             | partial    | SC1,5/F09            | L12: protocol limits; no fake 410/watch proof; observation allowlist only if needed                                                |
| `CONDITIONAL apps/api/src/calendar/observation.ts`                               | utility   | event-driven,transform        | `apps/api/src/calendar/observation.ts`                               | exact      | SC1,5/F09            | L12: safe observed revision/timing/hash allowlist; parent-owned evidence                                                           |
| `PARENT deploy/compose.yaml`                                                     | config    | event-driven                  | `deploy/compose.yaml`                                                | exact      | SC5/F08,09           | Existing runtime owner only; no new environment or mapper deployment                                                               |

## Pattern Assignments

Пять сильных базовых образцов B1–B5. L1–L12 ниже — actual owners и seams, а не продолжение широкого поиска.
Таблица назначает каждый файл конкретному excerpt/signature. Копировать форму границы; inbound semantics не переносить из outbound без изменения admission.

### B1 — Registry DTO, validation and imports

Для calendar-sync.ts: reuse calendarReadStatus, CalendarEventView, calendarVersion/revision and occurrence refs; public DTO не раскрывает token/channel secret/provider raw error.
**packages/contracts/src/calendar.ts:1–3**

```typescript
import { z } from 'zod'

import {
```

**packages/contracts/src/calendar.ts:89–100**

```typescript
export const calendarReadStatus = z.discriminatedUnion('state', [
	z.strictObject({ state: z.literal('fresh'), fetchedAt: calendarInstant, revision: calendarRevision }),
	z.strictObject({
		state: z.literal('last_known'),
		fetchedAt: calendarInstant,
		revision: calendarRevision,
		reason: calendarIssue,
	}),
	z.strictObject({ state: z.literal('unavailable'), reason: calendarIssue }),
])

export type CalendarReadStatus = z.infer<typeof calendarReadStatus>
```

**packages/contracts/src/calendar.ts:261–265**

```typescript
export const calendarCommandMeta = z.strictObject({ requestId: z.uuid(), expectedVersion: calendarVersion })
export type CalendarCommandMeta = z.infer<typeof calendarCommandMeta>

export const createCalendarLessonRequest = createLessonRequest.extend(calendarCommandMeta.shape).strict()
export const moveCalendarLessonRequest = moveLessonRequest.extend(calendarCommandMeta.shape).strict()
```

PROPOSED wire owners: GoogleSyncSnapshot, GoogleReviewList, GoogleReviewDecisionRequest, GoogleReviewDecisionSnapshot, GoogleSyncReadQuery, GoogleReviewListQuery; одно определение schema/type в calendar-sync.ts. Collection/full/window/command/delivery — отдельные факты.

### B2 — Additive persistence and typed JSON values

Образец таблиц: calendar-read-schema.ts:20–30,48–64; imports :1–18. JSONB типизирован через db value owner (:87), ссылки RESTRICT (:88). Для sync tables нужны собственные epoch/cursor/identity checks, а не window fields.
**packages/db/src/calendar-read-schema.ts:23–26** (узкий excerpt)

```typescript
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id').notNull(),
		connectionId: uuid('connection_id').notNull(),
		calendarId: text('calendar_id').notNull(),
```

**packages/db/src/calendar-values.ts:46–49** (узкий excerpt)

```typescript
export const googleLocalRef = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('single'), lessonId: z.uuid() }),
	z.strictObject({ kind: z.literal('series'), seriesId: z.uuid(), originalOn: isoDate }),
])
```

Семь PROPOSED таблиц: google_sync_cursors (SC1/5), google_sync_batches (SC1/2/4), google_sync_events (SC1/3), google_watch_channels (SC1/5), google_inbound_bindings (SC2/3), google_review_decisions (SC3/F06), google_occurrence_history (SC2/4).
Existing googleEventMappings: calendar-schema.ts:313–335,354–367. commandId обязателен (:330); canonical original tuple предусмотрен лишь outbound occurrence (:327–328,360). Не делать commandId nullable и не создавать фиктивную команду для inbound.
History хранит факты урока, не снимок mark; новые индексы двух origin сами по себе не обеспечат cross-origin uniqueness.

### B3 — Provider parsing and transport

Existing typed signatures: parseEventPage(input: unknown): ProviderPage (:89); EventQuery (:46–51) требует timeMin. ProviderPage (:44) не имеет syncToken.
**apps/api/src/calendar/provider-events.ts:89–92** (узкий excerpt)

```typescript
export function parseEventPage(input: unknown): ProviderPage {
	const parsed = page.safeParse(input)
	if (!parsed.success) throw new CalendarFault('invalid_provider_data')
	const events: ProviderEvent[] = []
```

**apps/api/src/calendar/gateway.ts:314–317** (узкий excerpt)

```typescript
		async events(accessToken: string, query: EventQuery, signal: AbortSignal) {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: accessToken })
			const response = await safeCall(() =>
```

gateway.ts:328–331 показывает retry:false + parser. safeCall :376–385 сводит HTTP failures к CalendarFault; не копировать его потерю статуса для реального 410.
PROPOSED syncEvents(accessToken: string, query: CollectionSyncQuery, signal: AbortSignal): Promise<ProviderSyncPage>; watchEvents(accessToken: string, calendarId: string, request: WatchRegistration, signal: AbortSignal): Promise<ProviderChannel>; stopChannel(accessToken: string, channel: RegisteredChannel, signal: AbortSignal): Promise<void>.
PROPOSED parseSyncPage(input: unknown): ProviderSyncPage. Separate parser сохраняет master/marker/canonical sparse identity и terminal token. Collection paging не использует read-pages.ts:23–30 ordered-start validation.
Методы, filter restrictions, watch races и 410 обоснованы RESEARCH P1–P3; это не source capability. До execution сверить официальные references по docs/google-calendar/READING.md.

### B4 — Worker/control, lease and abort

Existing createCalendarWorker(deps:{db:Database; databaseUrl:string; credentials:Credentials; lease:ConnectionLease; gateway:GoogleGateway; logger:Logger; isStopping:()=>boolean}) — worker.ts:19–27.
**apps/api/src/calendar/worker.ts:56–59** (узкий excerpt)

```typescript
			if (command.state === 'projection_pending') {
				await deps.lease.run(command.accountId, async (access) => {
					const current = await readCommand(access.db, command.accountId, command.id)
					if (current.state !== 'projection_pending') return
```

Projection-only ветка берёт lease напрямую. Provider ветка берёт его через credentials; не вкладывать один вызов в другой.
PROPOSED createCalendarSync(deps: CalendarSyncDeps): CalendarSync; requestCheck(input: SyncWakeup): Promise<void>; run(accountId: string): Promise<void>; readStatus(executor: DbExecutor, accountId: string): Promise<GoogleSyncSnapshot>; acceptNotification(input: NotificationInput): Promise<NotificationOutcome>.
Worker supplies lifecycle/admission shape only. Durable requested/processed sequence, catch-up, watch registration and nightly reconciliation ещё отсутствуют.

### B5 — Transaction-scoped apply and read publication

Existing applyConfirmedCommand(tx: DbExecutor, command: PreparedCalendarCommand, confirmation: VerifiedGoogleResult): Promise<void>, command-apply.ts:12–16. Imports :1–10 показывают DB barrel, type imports, domain owner calls.
**apps/api/src/schedule/command-apply.ts:17–20** (узкий excerpt)

```typescript
const [connection] = await tx
	.select()
	.from(googleConnections)
	.where(and(eq(googleConnections.id, command.connectionId), eq(googleConnections.accountId, command.accountId)))
```

**apps/api/src/calendar/read-store.ts:74–77** (узкий excerpt)

```typescript
export async function publishWindow(input: {
	db: Database
	context: CalendarReadContext
	selection: WindowSelection
```

publishWindow owns its own db.transaction (:87); revision/window/event write + connection revision precede receipt (:118–136). Не вызывать wrapper внутри inbound transaction.
PROPOSED publishWindowInTransaction(tx: DbExecutor, input: CompleteWindowPublication): Promise<ReadPublication>; applyInboundProjection(tx: DbExecutor, batch: CompleteInboundBatch): Promise<InboundPublication>.
Применение batch, histories, current marks, accepted view/revision, cursor/processed sequence публикуется одной короткой транзакцией после provider HTTP. Complete batch/facts validates generation/base revision under same writer.

## Shared Patterns

### L1 — Exports and generated owners

contracts index.ts:8 — `export * from './calendar.ts'`; db index.ts:5–7 экспортирует calendar schema/read-schema/values. DbExecutor = Database | Transaction, connection.ts:28–35.
Existing schema.ts:94–108 — students/displayName/status owner, без accountId на карточке. CONDITIONAL schema change не означает вторую schema definition.
Generated migration analog: packages/db/drizzle/20261011161301_google_calendar/migration.sql:1–8 — CREATE TABLE with typed keys; snapshot.json генерируется тем же инструментом. Future artifact names не выдумывать; yarn db:generate выполняет будущий migration owner, не mapper.

### L2 — Immutable request journal and safe refusal

**apps/api/src/calendar/journal.ts:119–122** (узкий excerpt)

```typescript
export function digest(value: string): string {
	return createHash('sha256').update(value).digest('hex')
}
```

**apps/api/src/calendar/journal.ts:147–150** (узкий excerpt)

```typescript
export async function findRequest(executor: DbExecutor, accountId: string, requestId: string) {
	const [command] = await executor
		.select()
		.from(googleCommands)
```

Existing signatures: digest(value: string): string; commandHash(input: ValidatedCalendarCommand): string; findRequest(executor: DbExecutor, accountId: string, requestId: string) (inferred Promise<CommandRow | undefined>).
Review copies body digest + account/request uniqueness, not outbound command schema or effect. Re-read provider outside SQL; active session/teacher/card and current review version inside commit.
CommandFault extends Error with code: ErrorCode and status:400|404|409|503, journal.ts:109–116. google.ts:37–42 maps owner faults through errorBody. No provider payload in error text.

### L3 — Queue, connection generation and composition

**apps/api/src/calendar/queue-schema.ts:6–9** (узкий excerpt)

```typescript
export const calendarQueueOptions = {
	schema: 'google_calendar_queue',
	migrate: false,
	createSchema: false,
```

prepareCalendarQueue(migratorUrl: string): Promise<void> (:16), queue creation/grants :39–47 — migration owner, not application runtime DDL. Current schedule:false is not nightly support.
connection-control.ts:233–260 disconnect(actor: ConsentActor) checks session and updates generation under SQL lock; :280–284 aborts/clears timer/awaits active work. Watch retire/stop must use this lifecycle, never resurrect credentials.
server.ts:43–70 constructs one lease, gateway, credentials, reads, worker and commands. Resource list :70 and lifecycle.manage :105–109 own close ordering. Lifecycle type :27–30 exposes manage/shutdown; Closable contract is existing source, new timer/daemon owner unnecessary.
Existing deploy/compose.yaml is deployment owner; no standalone environment or extra runtime configuration invented here.

### L4 — Shared access, no recursive lease

**apps/api/src/calendar/credentials.ts:130–146**

```typescript
		async withAccessToken<T>(
			accountId: string,
			operation: (input: {
				accessToken: string
				connection: ConnectionRow
				db: Database
				signal: AbortSignal
			}) => Promise<T>,
			signal?: AbortSignal
		): Promise<T> {
			return deps.lease.run(accountId, async (context) => {
				const bounded = signal ? { ...context, signal: AbortSignal.any([context.signal, signal]) } : context
				bounded.signal.throwIfAborted()
				const row = await findConnection(context.db, accountId)
				if (!row || row.state === 'not_connected') throw new CalendarFault('connection_required')
				if (row.state !== 'connected' || row.credentialMode !== 'active')
					throw new CalendarFault(row.state === 'permission_required' ? 'permission_required' : 'reconnect_required')
```

lease.ts:8 ConnectionLeaseContext={db:Database;signal:AbortSignal}; run<T>(accountId:string, operation:(context:ConnectionLeaseContext)=>Promise<T>):Promise<T> (:50). Account advisory lock :26–32; finally releases :33–46.
Provider HTTP uses access.signal and access.db returned by withAccessToken. Own provider-less projection can use lease.run. Never add lease.run around withAccessToken or recursively refresh through listCards.

### L5 — Teacher routes and separate notification admission

**apps/api/src/routes/google.ts:32–35**

```typescript
function actor(c: Context<AppEnv, string, {}>): ConsentActor {
	const session = c.get('session')
	return { accountId: session.account.id, sessionToken: session.token }
}
```

**apps/api/src/routes/google.ts:53–56** (узкий excerpt)

```typescript
export function googleRoutes({ db, connection, control, commands, isStopping }: GoogleRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use(
		'*',
```

Route reads by requestId validate params before journal lookup, google.ts:111–116. PROPOSED review.list(executor:DbExecutor, context:CalendarReadContext, query:GoogleReviewListQuery):Promise<GoogleReviewList>; decide(actor:ConsentActor,input:GoogleReviewDecisionRequest):Promise<GoogleReviewDecisionSnapshot>; readDecision(executor:DbExecutor,accountId:string,requestId:string):Promise<GoogleReviewDecisionSnapshot>.
PROPOSED GET /google/sync, GET /google/review, POST /google/review/decisions, GET /google/review/decisions/by-request/:requestId, POST /google/notifications.
createApp(deps:AppDeps) mounts sameOrigin globally at app.ts:59. sameOrigin(appOrigin:string):MiddlewareHandler rejects unsafe cross-origin requests, auth/middleware.ts:32–41.
Webhook must have separate mounting/auth branch; copying googleRoutes session/Origin guards would reject Google callbacks. No broad Origin exemption and no resourceUri fetch. Prefix /api remains proxy-owned.
No existing watch secret/resource/generation admission analog: protocol is PROPOSED RESEARCH P2.

### L6 — Exact name match without another card read engine

**packages/contracts/src/identity.ts:13–15**

```typescript
export function normalizeDisplayName(name: string): string {
	return name.trim().replace(/\s+/g, ' ')
}
```

**apps/api/src/cards/cards.ts:46–47**

```typescript
export async function cardIds(executor: DbExecutor): Promise<string[]> {
	return (await executor.select({ id: students.id }).from(students)).map((row) => row.id)
```

Existing listCards(executor: DbExecutor, context: CardReadContext): Promise<Pick<StudentsResponse,'students'|'unassignedPayments'>>, cards.ts:78–86, calls cardFacts; not a safe matching helper.
PROPOSED calendarMatchCandidates is a narrow card-owner read with active-teacher validation, active cards, entire normalized displayName, case-sensitive equality. Persisted bindings precede names and survive rename/archive. No fuzzy/first-token matching or imaginary students.accountId.

### L7 — A1/A2: shared identity before consumers and same confirmed writer

Existing bindEvent(event: ProviderEvent, snapshot: MappingSnapshot): BoundEvent, event-mapping.ts:196; BoundEvent :123–129 distinguishes localRef/student/representation/command/bindingKind. loadMappings(executor:DbExecutor, accountId:string, connectionId:string) reads only app mappings (:131–135).
**apps/api/src/calendar/event-mapping.ts:168–171** (узкий excerpt)

```typescript
function localRef(event: ProviderEvent, mapping: MappingRow, snapshot: MappingSnapshot): GoogleLocalRef | null {
	if (mapping.entityKind === 'single') {
		return event.recurringEventId ? null : { kind: 'single', lessonId: mapping.localEntityId }
	}
```

**apps/api/src/schedule/single-command.ts:29–32** (узкий excerpt)

```typescript
export async function singleTarget(executor: DbExecutor, accountId: string, input: SingleCommand) {
	if (input.ref.kind !== 'single') throw new CommandFault('history_only')
	const [mapping] = await executor
		.select()
```

**apps/api/src/schedule/single-command.ts:237–240** (узкий excerpt)

```typescript
	const markers = observed.privateProperties
	if (input.operation === 'restore' && observed.event.status === 'cancelled' && !markers.dvLocalId) return
	if (
		markers.dvLocalId !== target.mapping.localEntityId ||
```

Existing validateEvidence(evidence: SingleEvidence, target: Awaited<ReturnType<typeof singleTarget>>, input: SingleCommand), single-command.ts:226–230; prepareSingleCommand(executor:DbExecutor,input:SingleCommand,context:CalendarReadContext,evidence:SingleEvidence):Promise<PreparedCalendarCommand> (:83–88).
Admission chain: commands.ts:112 observeSingle → :113 transaction → :115 prepareScheduleCommand → single-command.ts:96 singleTarget/:102 validateEvidence. observeSingle :60 resolves the same target; :69–72 passes its provider identity to readSingleEvidence.
Read consumers: read-pages.ts:75/93/129 bindEvent; series-context.ts:67 active app master mappings and :86 supportedRule. Existing readSeriesContexts signature :61–65. Expand one shared resolver at all consumers, not only read-side early return.
A1: distinguish persisted app provenance from current inbound projection/ref. Stable account/calendar/grant, canonical identity, collisions and reserved/retired fences participate in admission. Inbound binding never creates fake commandId or proves ACK.
A2: local single representing provider instance retains actual recurringEventId + originalStartTime (date-vs-instant/zone) + parent binding/projection epoch. Provider representation kind is distinct from local ref kind. Same public Move/Cancel/Restore writer targets exactly that instance; no R2 standalone clone.
Missing representability/eligibility yields server unavailable capability, not false Ready. Unsupported whole-series edits stay unavailable.
The resolver signature and final09 occurrence methods are **PROPOSED**, planner-owned. No new method body is designed here.

### L8 — History freeze inputs, current marks and one accounting owner

**apps/api/src/schedule/rows.ts:298–301**

```typescript
export async function loadMarkRows(
	executor: DbExecutor,
	studentIds: readonly string[]
): Promise<Array<BalanceLesson & { studentId: string }>> {
```

**apps/api/src/schedule/rows.ts:333–336** (узкий excerpt)

```typescript
if (row.markOn === null) continue
const exception = exceptions.get(occurrenceKey({ kind: 'series', seriesId: row.id, originalOn: row.markOn }))
const occurrence = occurrenceAt(toSeriesRule(row), row.markOn, exception)
if (occurrence === null) continue
```

historyEligibility(executor:DbExecutor, accountId:string, subjects:readonly HistorySubject[]) — history.ts:192–211 returns Set<string>; mark eligibility remains current (:202).
markOccurrence(db:Database,accountId:string,seriesId:string,originalOn:string,input:MarkInput,now:Date):Promise<MarkResult> (:45–52) and markLesson(db:Database,accountId:string,id:string,input:MarkInput,now:Date):Promise<MarkResult> (:78–84) lock history connection and domain row within existing transaction.
PROPOSED freezeOccurrenceFacts freezes ref/student/start/zone/duration/status once before master bounds change. Recheck live marks under locks; do not preserve an immutable mark copy. loadMarkRows prefers frozen inputs, emits each ref once.
card-facts.ts:41 loads current marks, :45 calls studentBalance; cardFacts(executor:DbExecutor,cards:readonly FactSource[],context:CardReadContext):Promise<Map<string,CardFacts>> (:50–54) also uses readNextLessons (:56). No second accounting or schedule engine. Payments/opening balance untouched.

### L9 — Shared published read, explicit coverage

Existing readCalendarWindow(executor:DbExecutor,context:CalendarReadContext,selection:WindowSelection):Promise<GoogleScheduleWindow> — read-model.ts:70–74.
Existing readNextLessons(executor:DbExecutor,context:CalendarReadContext,studentIds:readonly string[]):Promise<ReadonlyMap<string,NextLessonRead>> — :185–189.
Existing readToday signature today.ts:39–43 reads the same readCalendarWindow (:48); adapters conditional on final24 shapes only.
**apps/api/src/calendar/read-state.ts:12–15** (узкий excerpt)

```typescript
export type ReadReceipt = {
	connectionId: string
	generation: number
	revision: bigint
```

currentRead(context: CalendarReadContext) (:27–29) is request-scoped WeakMap. Durable accepted batch/status cannot be inferred from it. Background publication must produce persistent revision/coverage; request receipt only for matching complete range.
refreshCalendarRead takes credentials lease and records safe CalendarFault fallback, reads.ts:22–25,57–60. GET refresh cannot itself prove closed-page background delivery.

### L10 — Frozen command intent and stale ACK ordering

**apps/api/src/calendar/dispatch.ts:245–248** (узкий excerpt)

```typescript
export async function projectCommand(access: Pick<CommandAccess, 'db' | 'signal'>, command: CommandRow) {
	const { prepared, stage } = await preparedCommand(access.db, command)
	if (!stage.acknowledgement) throw new CommandFault('precondition_failed')
	const result = storedGoogleResult(stage.acknowledgement, prepared.request, stage.generation)
```

verifyGoogleResult(input:unknown,request:WriteRequest,timeZone:string,generation:number,httpStatus:number,conditionalPatch=false):VerifiedGoogleResponse — command-result.ts:79–86; exact private markers + owned fields :89–105.
reconcileCommand(access:CommandAccess,command:CommandRow,gateway:GoogleGateway,explicit=false), recovery.ts:161–169, checks dispatchedAt and calendar before recovery.
Latest provider publication must not be replaced by stale stored ACK. Keep immutable attempts/plan/state; unrelated inbound observations never set applied/confirmed. Unknown/partial barriers retain truthful effect. Shared stale-ACK seam includes dispatch/recovery/apply/result AND L7 admission.
Source08 supports create and single changes; PreparedCalendarCommand.operation :34 is create|move|cancel|restore. Source09/10/11 final interfaces are not existing evidence.

### L11 — Existing Settings/read/forms, capabilities and focus

Existing useGoogleConnection(callbackOutcome:string|null=null), google-calendar-state.tsx:188–210, guards 401/403, sequence/inflight and apiRequest<unknown>.
CalendarCard :113–134 has pending guard and focus restoration. Reuse its panels and variant A/v40; new review/status DTO must be parsed at boundary. New UI subfile names, if needed, are planner inventory, not asserted existing paths.
**apps/web/lib/lesson-actions.ts:23–26**

```typescript
export function canEditCalendarEvent(event: CalendarEventView, window: GoogleScheduleWindow): event is CalendarLesson {
	return (
		calendarLesson(event) && window.read.state === 'fresh' && window.write.state === 'ready' && event.editBlock === null
	)
```

**apps/web/app/(app)/schedule/\_components/calendar-lesson-dialog.tsx:116–119** (узкий excerpt)

```typescript
	async function change(action: 'cancel' | 'restore') {
		if (pending || !editable) return
		setFailure(false)
		const result = await command.mutate(initial.binding.ref, action, { expectedStartsAt: initial.when.startsAt })
```

CalendarLessonDialog(props: Props) :27–39 receives event/window/time zones/refresh callback. LessonMoveForm :64–78 receives LessonMoveFormProps; captured event/ref :82–88 feeds useScheduleMutation.
Existing useScheduleMutation(selection:CalendarSelection|null) :120; mutate(target:Target,action:Action,body:Body={}):Promise<CalendarMutationResult> :137. Public window refresh precedes stale checks (:144–151).
Safe visible revision polling is presentation only. Decision uncertainty recovers by requestId, no blind POST replay. Zero review is known only on complete catalog/list; Connection ≠ watch active ≠ checked calendar. Preserve dirty draft on stale version; no premature Saved toast.

### L12 — Existing real public E2E source, no runtime PASS

**e2e/move.spec.ts:52–55** (узкий excerpt)

```typescript
test('[calendar] single changes wait for conditional ACK and retain identity through two moves and cancel/restore', async ({
	page,
}) => {
	await singleChanges(page.request)
```

E01/E03: calendar-evidence.spec.ts:17–23 real session/evidence; E03/E04–08/E12: calendar-settings.spec.ts:20–40 public API + settings + explicit mutation authority.
E02/E04/E08/E09: calendar.spec.ts:9–18 imports existing real recovery journeys.
E02/E07/E10/E12: calendar-view.spec.ts:18–28 asserts unavailable vs empty and rejects legacy future.
E09/E10: move.spec.ts:52–72 covers single changes/race/tombstones; extend assignment→Move/Cancel/Restore and materialized instance sibling preservation, not a new isolated suite.
E10: marks.spec.ts:3 calendarHistoryMarks; today.spec.ts:4–6 history/next/Today real journeys.
Fault protocol calendar-fault-protocol.ts:18–28 supports GET/POST/PATCH, events/event/calendarList, drop/delay/stop and real event pageSize. No synthetic 410, watch/stop/instances proof.
observation.ts:10–28 uses identity hashes/revision/timestamps; extend safe facts via parent's existing evidence owner only. No raw payload/token/provider identity in public artifact.
Actual 410/short TTL/early callback/closed-page publication/nightly due proof remains UNVERIFIED until parent executes E01–E12 on actual authorized TEST PRIMARY and existing persistence/runtime. Personal PRIMARY is not substitute.
Future rerun labels in RESEARCH are PROPOSED; zero matched tests or skipped connected fixtures cannot pass. No functional/provider runs by mapper.

## No Analog Found

| Future file/capability                          | Reason / planner source                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| calendar/watch.ts                               | No registered watch callback/renewal owner. Worker/control offer lifecycle only; use RESEARCH P2/P3 protocol.                                     |
| routes/google-notifications.ts                  | No callback-secret/resource/generation authentication route. Teacher routes are shape-only; use P2 + independent mount.                           |
| generated snapshot.json                         | Machine-generated data, not handwritten code pattern; generated together with migration.                                                          |
| matching.ts complete resolver                   | identity.ts is only a normalization partial analog; matching/admission policy is PROPOSED P4/P5 + A1/A2.                                          |
| inbound projection/history freeze               | command-apply/history/rows are role analogs, not existing inbound projection or immutable-history table capability.                               |
| final24-09/10/11 occurrence/cut/conflict owners | Rebind final tracked symbols before dependent planning/execution; do not read uncommitted other ROOT02 or claim planned03 fields are implemented. |

## Metadata

**Analog search scope:** listed calendar/schedule/cards/contracts/db/Settings/forms/E2E owners only. CodeGraph absent; no indexing.
**Source reads:** pinned tracked Git source, narrow non-overlapping ranges; initial symbol inventory. No gitignored runtime/install mirror cited.
**Docs:** 25-CONTEXT, RESEARCH Future Write Map/P1–P7/F matrix, accepted ARCH-REVIEW A1/A2, AGENTS, EXECUTOR-RULES, gsd-phase-recipe and docs/google-calendar/READING.
**Source fingerprint convention:** SHA-256 of full tracked blob at source pin; below for every extracted source. Line ranges above refer to that blob.

| Tracked source / SHA-256                                                                                                                                                                                                                                                                                                                                      | Tracked source / SHA-256                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/calendar.ts`<br>`5e950d4517bb6989e04ea551a1c35c7f9c589e2374566f63ddba3bd139470780`                                                                                                                                                                                                                                                    | `packages/contracts/src/identity.ts`<br>`95ea129e65d82ee1c3de917d1d77afac6ebbb1af60ad20162be8856c9aa68ead`                               |
| `packages/db/src/calendar-read-schema.ts`<br>`d086cfe5e16ae8878610bb8c5a36feb215e6f37c2dc75aa701470dc3be61c918`                                                                                                                                                                                                                                               | `packages/db/src/calendar-values.ts`<br>`0ed178f0e1dd69c149624a609ae931caadcc5794e87bdb37eab3fff5b19669f9`                               |
| `packages/db/src/calendar-schema.ts`<br>`3e0a840276411c7c541c9859a86d57a8d4b2cf7604237d2ba94599a92dcaa2ac`                                                                                                                                                                                                                                                    | `apps/api/src/calendar/provider-events.ts`<br>`931d35911fc787048f955448471b4571a07a83d72ec24dcbabc07030334901c9`                         |
| `apps/api/src/calendar/gateway.ts`<br>`b92ef39b597044b71d798dbdb2b268e75c125093a03f2609527d83b9ac8068a3`                                                                                                                                                                                                                                                      | `apps/api/src/calendar/credentials.ts`<br>`a7cf69a8c7ead25891caa5e0b5d1657c596aab4556cf9a859a2bba3a55c5b8ea`                             |
| `apps/api/src/calendar/worker.ts`<br>`0a7b812e13f432469e36bd27efe43f4db01a5b1b3e510c9b27f7f87f3a496f91`                                                                                                                                                                                                                                                       | `apps/api/src/calendar/queue-schema.ts`<br>`37431dc2988b0a37b414295763195a2e357cac9074d59bfd94d51cebf900a022`                            |
| `apps/api/src/calendar/read-store.ts`<br>`e7bfcf062f167c4a569c0a7a4dce815ab2b4066e727567d5abfac440ab465991`                                                                                                                                                                                                                                                   | `apps/api/src/calendar/event-mapping.ts`<br>`4f6dbe3ff27e4f9d358b70fa935d35394bf40aec75fb05c13a130b0735929181`                           |
| `apps/api/src/schedule/single-command.ts`<br>`37e1cbbed83e573fa69ea6420f716bde18d85beb6812cffd9e7e795aacac74a9`                                                                                                                                                                                                                                               | `apps/api/src/calendar/single-observation.ts`<br>`d487817db635baf765e3b3d8b5bf3bd3c53d95c15fa4e02c0179d335359bbecf`                      |
| `apps/api/src/calendar/commands.ts`<br>`1c23a28eafca7264c992488c74016c0ab872820ad5686ebe55d561e9a2eb3d70`                                                                                                                                                                                                                                                     | `apps/api/src/schedule/command-apply.ts`<br>`d8e7f974de8195c180a21c5ce0b28af018ffebb6064bf2030a7c755639d3bc2b`                           |
| `apps/api/src/calendar/command-result.ts`<br>`479fbe7e230d8c7279a2969ebbd5d3a58bec2855965cb02c32421b9aacb432ac`                                                                                                                                                                                                                                               | `apps/api/src/calendar/dispatch.ts`<br>`e7c2c7351e73514023f272a7a93290ccee1ca785023fda1ae74fd6c55a78499c`                                |
| `apps/api/src/calendar/read-state.ts`<br>`356adc5e4658cc215240977f1527ed593a456337aa92e725c97efca92cce4f8a`                                                                                                                                                                                                                                                   | `apps/api/src/calendar/reads.ts`<br>`c50033505db90e93281f9c3ba926d1d0fbef1d9e74c2cf69f3bb0d72864952c8`                                   |
| `apps/api/src/calendar/read-model.ts`<br>`a9ec89b4995f71fcfa91edda1e486528f0aea4f48fa2aceace2a2cf6c854a966`                                                                                                                                                                                                                                                   | `apps/api/src/calendar/series-context.ts`<br>`173ebbbf41160f00e79139668ba3a779e7974924213c6ca3747c91f217a35d47`                          |
| `apps/api/src/calendar/history.ts`<br>`210b275282101b331a05618f89dc4d10bf8d450435d42bf4f7ac9c8f37c8b89f`                                                                                                                                                                                                                                                      | `apps/api/src/schedule/rows.ts`<br>`5c807ba53236e73b1d8548cba3ef82078378cc344bea56999c0c0bbdca49069e`                                    |
| `apps/api/src/schedule/marks.ts`<br>`c89a86b02d80456ec0bf62b79fa54f0ffeee71cf7af33385db4c8118e97ebb90`                                                                                                                                                                                                                                                        | `apps/api/src/cards/cards.ts`<br>`9e1884977d1528bd7d2d880d3b61afe636c78d6c4fd7f208782e772be91f5670`                                      |
| `apps/api/src/cards/card-facts.ts`<br>`d739eef3cc82a2101934626a34072ef41d4d9bfc8bbbe4415a36dc3681a52e44`                                                                                                                                                                                                                                                      | `apps/api/src/routes/google.ts`<br>`d2f943f2e8cce97d87ef2a041743fb1eb32c60fa60119eb983f5d3c26a23a975`                                    |
| `apps/api/src/app.ts`<br>`a6e7ad6dfc55d44f8e3e5e3a43563743b33e41e9c2e4dccde5a5c7dc81c3a8bf`                                                                                                                                                                                                                                                                   | `apps/api/src/server.ts`<br>`ea018ce5ec2a63427e66afbe570f5815b52937bf6cbacdb622ed81dd10a105e1`                                           |
| `apps/api/src/lifecycle.ts`<br>`81eebd2f099c80b943689f6f19b38048372cf2741062bf27b0a2630494a705a1`                                                                                                                                                                                                                                                             | `apps/web/components/app/google-calendar-state.tsx`<br>`a5db56c1523d5546b4138e3534ae1942284baca5d6b035adfda15b314df4c87d`                |
| `apps/web/app/(app)/settings/_components/calendar-card.tsx`<br>`51ac09d103f66dc539617284e9785890a89e01cf4f236e2d2c1291f4453d442d`                                                                                                                                                                                                                             | `apps/api/src/calendar/read-pages.ts`<br>`b3fb8d26c6cefaee765209ce303f9c92e9aef12af9fef5cf75e5faa69d5818b1`                              |
| `e2e/move.spec.ts`<br>`5c15b5a3e41c85229d262afee1a426cd0617acf03cb3b587eb582ed60a1949e4`                                                                                                                                                                                                                                                                      | `e2e/calendar-settings.spec.ts`<br>`dd50b0d5a202747187c6d6a9ed89234d3f436c32577b5da94ecefcd404dd3e2e`                                    |
| `e2e/calendar-evidence.spec.ts`<br>`fbd4a526cdd37c168f6a49e4c4f9114ac2cf012ef8ebb0f1c74822c99edaeb38`                                                                                                                                                                                                                                                         | `e2e/support/calendar-fault-protocol.ts`<br>`25e64ea68d21c1563efa93f9803ac92869764b36076e3a1e679522cf6b31fb2d`                           |
| `apps/api/src/calendar/lease.ts`<br>`b43a15bd1296882a01e35f3cdb185c096b0ded5c521624a2d53e8fb32c8f8618`                                                                                                                                                                                                                                                        | `apps/api/src/calendar/connection-control.ts`<br>`4a1804b704ebea0ae08fc0b6a2e4cd2057851ed1b751e9767a94a60ba5b70302`                      |
| `apps/api/src/calendar/recovery.ts`<br>`1156436c0dd40a3d04efa231f4fc2e5c3415b09a2e92bb86a38b5f82a8b9b2bd`                                                                                                                                                                                                                                                     | `packages/contracts/src/index.ts`<br>`6c7bcb4d755988c6eb422f6685cda144b68ae7aac7ac8a858b8d18f7c695782b`                                  |
| `packages/db/src/index.ts`<br>`62334d82d655463b34b9cae5f2761f1a8cf043c9877ed09a09b664b7eb20f740`                                                                                                                                                                                                                                                              | `packages/db/src/schema.ts`<br>`3f190ad368cb89b5cabd7a08c57ab94c4c4c815a9aa09d92cc877cb3218551de`                                        |
| `packages/db/src/connection.ts`<br>`2bb3e709933b907ddce8f6cb61d5a16231b72e56e72975d500907abc918ff8c2`                                                                                                                                                                                                                                                         | `apps/api/src/auth/middleware.ts`<br>`86e78399ebe845a36f60008e808a34ea9a2bece1e052cae1f621d90a1af88bcf`                                  |
| `apps/api/src/calendar/journal.ts`<br>`30a73a7a98c0342afdc828997bb097dc8291d18692013d5f46fbca539e603e37`                                                                                                                                                                                                                                                      | `apps/api/src/schedule/command-plan.ts`<br>`0ca7606f6d1c7350a194824bad52e0f01e31211f075e0637e9d0a51207723e0e`                            |
| `apps/api/src/today/today.ts`<br>`58ec98bd5a9cf5666d0998217df05c0bd5454a8840e5dc41644ae23b151ef008`                                                                                                                                                                                                                                                           | `apps/web/app/(app)/schedule/_components/lesson-move-form.tsx`<br>`23e96fe81f05a35ab938e661a9be48fee24c46c3054a226fb2eb472516bff1f8`     |
| `apps/web/app/(app)/schedule/_components/calendar-lesson-dialog.tsx`<br>`17025a2d6e9e60d588f605a6322e3c5a470dfc88cda42017c2c6aafe0daf356b`                                                                                                                                                                                                                    | `e2e/calendar.spec.ts`<br>`fc65ce54a23658896df67d1e6ae7b8eb05d24efbd82958d1b6f44a8a04a10e33`                                             |
| `e2e/calendar-view.spec.ts`<br>`9e315be8dfe067d9a6236f46e14a076407aef8fc02d37bfccbd5530d2f35320b`                                                                                                                                                                                                                                                             | `e2e/marks.spec.ts`<br>`796f06a06e7ba07c6fe8a9684ea72a02c98ec56953c5c4d887c050cc8acf63cf`                                                |
| `e2e/today.spec.ts`<br>`e86a5351c1e46e7cefb8f6c4e2d5eb25efded09276b03d6c10f43e154bc13c2a`                                                                                                                                                                                                                                                                     | `deploy/compose.yaml`<br>`3bc30aa826d8d03af72fd097b1150de0c33dbf6cba5650270e1837ed59874871`                                              |
| `apps/web/app/(app)/schedule/_components/schedule-mutations.ts`<br>`d0ada3836b04356a3a07debddb579308e9b04f05475d65f2d89155cc0af67501`                                                                                                                                                                                                                         | `packages/db/drizzle/20261011161301_google_calendar/migration.sql`<br>`39770e5580071ee4832b9d36d47bd54b9ed6f99ef03461aae639352412b645b4` |
| `apps/web/lib/lesson-actions.ts`<br>`9284fb89230ba444452d0de13cf74793d0c7dd2f3103c575f282071115fac0bd`                                                                                                                                                                                                                                                        | `apps/api/src/calendar/observation.ts`<br>`2ded06e5db78b2fe4d604e844dcf484046466c41e85f8ec0a5b1f7cbbec714d3`                             |
| **Static status:** root pin PASS (exit 0, ROOT_PIN_OK): `bash scripts/gsd/root-pin.sh ~/.claude/worktrees/phase-24-google-calendar-preparation/dv-lab`. Classification and excerpt references checked. Write connector unavailable (open_workspace returned Internal error twice); single-file patch tool fallback, no shell file creation. |
| **Limits:** source/type/lint/build/tests/browser/DB/provider not run. This map is ready for planner consumption only; final24 rebind and real SC acceptance remain required. Mapper writes only 25-PATTERNS.md.                                                                                                                                               |
