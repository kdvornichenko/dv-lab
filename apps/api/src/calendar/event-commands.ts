import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import {
	calendarEventDetails,
	type CalendarEditScope,
	type CalendarEventDetails,
	type CalendarIssue,
	type ValidatedCalendarCommand,
} from '@dv-lab/contracts'
import { addDays, localTimeCandidates, scheduleDate, weekdayOf, zonedParts } from '@dv-lab/core'
import {
	googleCommandPlan,
	googleCommands,
	googleCommandStages,
	googleConnections,
	googleStageRequest,
	type DbExecutor,
	type GoogleEventTime,
	type GoogleStageRequest,
} from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import { lockTeacherTimeContext, readTeacherSettings } from '../settings/settings.ts'
import type { VerifiedGoogleResult } from './command-result.ts'
import { readDescription } from './event-description.ts'
import { bindEvent, loadMappings } from './event-mapping.ts'
import { currentConnection, findConnection } from './google-access.ts'
import {
	CommandFault,
	commandHash,
	digest,
	findRequest,
	matchingReceipt,
	persistCommand,
	receipt,
	unresolvedCommands,
} from './journal.ts'
import { masterRow, rowByKey, rowEvent, syncFacts, type ProjectionRow, type SyncFacts } from './projection.ts'
import { eventColor, eventColors } from './read-model.ts'
import { eventVersion, type CalendarReadContext } from './read-state.ts'
import { advanceCommandRevision } from './read-store.ts'
import { masterRepresentation } from './recurring.ts'

export type EventCommand = Extract<
	ValidatedCalendarCommand,
	{ operation: 'event_create' | 'event_update' | 'event_delete' }
>
type UpdateCommand = Extract<EventCommand, { operation: 'event_update' }>
type DeleteCommand = Extract<EventCommand, { operation: 'event_delete' }>
type Patch = Extract<GoogleStageRequest, { method: 'patch' }>
type Insert = Extract<GoogleStageRequest, { method: 'insert' }>
type Connection = typeof googleConnections.$inferSelect & { calendarId: string }
type Target = { row: ProjectionRow; master: ProjectionRow | null; kind: 'single' | 'weekly' | 'other' }
type Scopes = { edit: CalendarEditScope[]; delete: CalendarEditScope[]; reason: CalendarIssue | null }
type Timed = { startsAt: Date; endsAt: Date; zone: string }
type OwnedFields = { summary?: string; colorId?: string | null; description?: string | null; location?: string | null }
type Prepared = { prepared: PreparedCalendarCommand; companion: Insert | null }

export const EVENT_OPERATIONS: ReadonlySet<string> = new Set(['event_create', 'event_update', 'event_delete'])
export const COMPANION_STAGE = 2
const ALL_SCOPES: CalendarEditScope[] = ['one', 'following', 'all']
const TIME_FIELDS = new Set(['date', 'startTime', 'durationMinutes'])

export function isEventCommand(input: ValidatedCalendarCommand): input is EventCommand {
	return EVENT_OPERATIONS.has(input.operation)
}

function eventIdFor(connection: Connection, localEntityId: string) {
	return `dv${digest(JSON.stringify([connection.id, connection.calendarId, 'event', localEntityId, 0]))}`
}

function timedOf(row: Pick<ProjectionRow, 'start' | 'end'>): Timed | null {
	const { start, end } = row
	if (!start || !end || !('dateTime' in start) || !('dateTime' in end)) return null
	return { startsAt: new Date(start.dateTime), endsAt: new Date(end.dateTime), zone: start.timeZone }
}

function minutesOf(time: Timed) {
	return Math.round((time.endsAt.getTime() - time.startsAt.getTime()) / 60000)
}

function dayShift(to: string, from: string) {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

function localInstant(date: string, time: string, zone: string) {
	const instant = localTimeCandidates(date, time, zone)[0]
	if (!instant) throw new CommandFault('nonexistent_local_time', 400)
	return instant
}

function timePair(startsAt: Date, minutes: number, zone: string) {
	return {
		start: { dateTime: startsAt.toISOString(), timeZone: zone },
		end: { dateTime: new Date(startsAt.getTime() + minutes * 60000).toISOString(), timeZone: zone },
	}
}

function weeklyFrom(startsAt: Date, minutes: number, zone: string, endsOn: string | null) {
	const local = zonedParts(startsAt, zone)
	const representation = masterRepresentation({
		weekday: weekdayOf(local.date),
		startTime: local.time,
		timeZone: zone,
		durationMinutes: minutes,
		startsOn: local.date,
		endsOn: endsOn !== null && endsOn >= local.date ? endsOn : null,
	})
	if (!representation) throw new CommandFault('invalid_request', 400)
	return { start: representation.start, end: representation.end, recurrence: representation.recurrence }
}

function originalOf(row: ProjectionRow): { time: GoogleEventTime; on: string } {
	const original = row.originalStart
	if (!original) throw new CommandFault('precondition_failed')
	return {
		time: original,
		on: 'date' in original ? original.date : scheduleDate(new Date(original.dateTime), original.timeZone),
	}
}

function markerId(row: ProjectionRow | null) {
	return row?.markerKind === 'event' && row.markerLocalId ? row.markerLocalId : randomUUID()
}

function windowCheck(sync: SyncFacts | null, startsAt: Date | null, endsAt: Date | null) {
	if (!sync || !startsAt) return
	if (startsAt < sync.windowStart || (endsAt ?? startsAt) > sync.windowEnd)
		throw new CommandFault('outside_sync_window')
}

function targetKind(row: ProjectionRow, master: ProjectionRow | null): Target['kind'] {
	if (row.rowKind !== 'instance') return 'single'
	return master?.recurrenceKind === 'weekly' && master.recurrenceWeekday !== null && timedOf(master)
		? 'weekly'
		: 'other'
}

function scopeRules(target: Target): Scopes {
	if (target.row.allDay) return { edit: [], delete: ['one'], reason: 'read_only_event' }
	if (target.kind === 'single') return { edit: ['one'], delete: ['one'], reason: null }
	if (target.kind === 'weekly') return { edit: [...ALL_SCOPES], delete: [...ALL_SCOPES], reason: null }
	return { edit: ['one'], delete: ['one'], reason: 'unsupported_recurrence' }
}

async function isBound(executor: DbExecutor, connection: Pick<Connection, 'id' | 'accountId'>, row: ProjectionRow) {
	const snapshot = await loadMappings(
		executor,
		connection.accountId,
		connection.id,
		row.markerLocalId ? [row.markerLocalId] : []
	)
	const mapped = snapshot.mappings.some(
		(mapping) =>
			mapping.state !== 'retired' &&
			(mapping.eventId === row.eventId || (mapping.entityKind === 'series' && mapping.eventId === row.recurringEventId))
	)
	if (mapped) return true
	const event = { ...rowEvent(row), markerLocalId: row.markerLocalId, markerKind: row.markerKind }
	return bindEvent(event, snapshot).bindingKind !== 'external'
}

async function lockConnection(executor: DbExecutor, accountId: string): Promise<Connection> {
	const [connection] = await executor.select().from(googleConnections).where(currentConnection(accountId)).for('update')
	if (!connection?.calendarId || connection.state !== 'connected') throw new CommandFault('connection_required')
	if ((await unresolvedCommands(executor, accountId)).length) throw new CommandFault('command_pending')
	return { ...connection, calendarId: connection.calendarId }
}

async function loadTarget(executor: DbExecutor, connection: Connection, eventKey: string): Promise<Target> {
	const row = await rowByKey(executor, connection.id, eventKey)
	if (!row || row.status === 'cancelled' || row.rowKind === 'master') throw new CommandFault('not_found', 404)
	if (await isBound(executor, connection, row)) throw new CommandFault('invalid_request', 400)
	const found = row.recurringEventId ? await masterRow(executor, connection.id, row.recurringEventId) : null
	const master = found && found.status !== 'cancelled' ? found : null
	return { row, master, kind: targetKind(row, master) }
}

function stagePatch(
	commandId: string,
	target: { eventId: string; etag: string; marker: ProjectionRow | null },
	payload: OwnedFields & Record<string, unknown>,
	instance?: Patch['instance']
): Patch {
	const hash = digest(JSON.stringify({ eventId: target.eventId, ...payload }))
	const request = googleStageRequest.parse({
		method: 'patch',
		eventId: target.eventId,
		ifMatch: target.etag,
		digest: hash,
		...(instance ? { instance } : {}),
		payload: {
			...payload,
			markers: {
				entityKind: 'event',
				localEntityId: markerId(target.marker),
				representationGeneration: 0,
				commandId,
				stage: 0,
				digest: hash,
				schemaVersion: 1,
			},
		},
	})
	if (request.method !== 'patch') throw new CommandFault('precondition_failed')
	return request
}

function stageInsert(
	commandId: string,
	connection: Connection,
	stage: number,
	payload: Record<string, unknown> & { summary: string }
): Insert {
	const localEntityId = randomUUID()
	const eventId = eventIdFor(connection, localEntityId)
	const hash = digest(JSON.stringify({ eventId, ...payload }))
	const request = googleStageRequest.parse({
		method: 'insert',
		eventId,
		digest: hash,
		payload: {
			...payload,
			status: 'confirmed',
			markers: {
				entityKind: 'event',
				localEntityId,
				representationGeneration: 0,
				commandId,
				stage,
				digest: hash,
				schemaVersion: 1,
			},
		},
	})
	if (request.method !== 'insert') throw new CommandFault('precondition_failed')
	return request
}

function instanceIdentity(row: ProjectionRow): Patch['instance'] {
	if (!row.recurringEventId) return undefined
	const original = originalOf(row)
	return {
		masterEventId: row.recurringEventId,
		originalOn: original.on,
		originalStartTime: original.time,
		lookupVerified: true,
	}
}

function preparedValue(
	id: string,
	input: EventCommand,
	connection: Connection,
	sync: SyncFacts | null,
	plan: unknown,
	request: Patch | Insert,
	now: Date
): PreparedCalendarCommand {
	return {
		id,
		accountId: connection.accountId,
		connectionId: connection.id,
		calendarId: connection.calendarId,
		requestId: input.input.requestId,
		inputHash: commandHash(input),
		expectedVersion: input.input.expectedVersion,
		baseRevision: sync?.revision ?? 0n,
		generation: connection.generation,
		operation: input.operation,
		plan: googleCommandPlan.parse(plan),
		request,
		createdAt: now,
		dispatchDeadline: new Date(now.getTime() + 30000),
	}
}

function planOf(input: Record<string, unknown>, timeZone: string, request: Patch | null) {
	return {
		version: 1,
		input,
		capturedTimeZone: timeZone,
		capturedRule: null,
		reservations: [],
		lineage: [],
		preconditions: request
			? [{ eventId: request.eventId, etag: request.ifMatch, unownedWritableFingerprint: null, unownedWritable: null }]
			: [],
		affectedRefs: [],
		oldEndsOn: null,
		newRule: null,
	}
}

async function prepareCreate(
	executor: DbExecutor,
	input: Extract<EventCommand, { operation: 'event_create' }>,
	context: CalendarReadContext,
	connection: Connection
): Promise<Prepared> {
	const settings = await lockTeacherTimeContext(
		executor,
		context.accountId,
		input.input.expectedDefaultTimeZone,
		context.now
	)
	if (!settings.ok) throw new CommandFault(settings.error)
	const zone = settings.context.defaultTimeZone
	const startsAt = localInstant(input.input.date, input.input.startTime, zone)
	const endsAt = new Date(startsAt.getTime() + input.input.durationMinutes * 60000)
	const sync = await syncFacts(executor, connection.id)
	windowCheck(sync, startsAt, endsAt)
	const id = randomUUID()
	const time =
		input.input.repeats === 'weekly'
			? weeklyFrom(startsAt, input.input.durationMinutes, zone, null)
			: timePair(startsAt, input.input.durationMinutes, zone)
	const request = stageInsert(id, connection, 0, {
		summary: input.input.title,
		...time,
		...(input.input.colorId !== null ? { colorId: input.input.colorId } : {}),
		...(input.input.description ? { description: input.input.description } : {}),
		...(input.input.location ? { location: input.input.location } : {}),
	})
	const { requestId, expectedVersion, ...value } = input.input
	const plan = planOf({ operation: 'event_create', eventId: request.eventId, ...value }, zone, null)
	return { prepared: preparedValue(id, input, connection, sync, plan, request, context.now), companion: null }
}

function ownedChanges(changes: UpdateCommand['input']['changes']): OwnedFields {
	return {
		...(changes.title !== undefined ? { summary: changes.title } : {}),
		...(changes.colorId !== undefined ? { colorId: changes.colorId } : {}),
		...(changes.description !== undefined ? { description: changes.description } : {}),
		...(changes.location !== undefined ? { location: changes.location } : {}),
	}
}

function changedTime(changes: UpdateCommand['input']['changes'], current: Timed, defaultZone: string) {
	const local = zonedParts(current.startsAt, defaultZone)
	const minutes = changes.durationMinutes ?? minutesOf(current)
	const startsAt =
		changes.date !== undefined || changes.startTime !== undefined
			? localInstant(changes.date ?? local.date, changes.startTime ?? local.time, defaultZone)
			: current.startsAt
	const changed = startsAt.getTime() !== current.startsAt.getTime() || minutes !== minutesOf(current)
	return { startsAt, minutes, changed }
}

function seriesFacts(master: ProjectionRow) {
	const time = timedOf(master)
	if (!time || master.recurrenceWeekday === null) throw new CommandFault('unsupported_recurrence')
	const local = zonedParts(time.startsAt, time.zone)
	return { time, local, minutes: minutesOf(time) }
}

function trimmedRecurrence(master: ProjectionRow, originalOn: string) {
	const facts = seriesFacts(master)
	if (originalOn <= facts.local.date) return null
	const trimmed = masterRepresentation({
		weekday: weekdayOf(facts.local.date),
		startTime: facts.local.time,
		timeZone: facts.time.zone,
		durationMinutes: facts.minutes,
		startsOn: facts.local.date,
		endsOn: addDays(originalOn, -1),
	})
	return trimmed?.recurrence ?? null
}

function masterTime(
	master: ProjectionRow,
	row: Timed,
	next: { startsAt: Date; minutes: number },
	repeats: 'once' | 'weekly' | undefined
) {
	const facts = seriesFacts(master)
	const zone = facts.time.zone
	const shift = dayShift(zonedParts(next.startsAt, zone).date, zonedParts(row.startsAt, zone).date)
	const first = addDays(facts.local.date, shift)
	const clock = zonedParts(next.startsAt, zone).time
	const startsAt = localInstant(first, clock, zone)
	if (repeats === 'once') return { ...timePair(startsAt, next.minutes, zone), recurrence: [] as string[] }
	if (shift % 7 === 0 && (shift === 0 || master.recurrenceUntil === null)) return timePair(startsAt, next.minutes, zone)
	return weeklyFrom(
		startsAt,
		next.minutes,
		zone,
		master.recurrenceUntil === null ? null : addDays(master.recurrenceUntil, shift)
	)
}

async function prepareUpdate(
	executor: DbExecutor,
	input: UpdateCommand,
	context: CalendarReadContext,
	connection: Connection
): Promise<Prepared> {
	const target = await loadTarget(executor, connection, input.eventKey)
	const { row, master, kind } = target
	if (row.eventType !== 'default') throw new CommandFault('read_only_event')
	if (input.input.expectedVersion !== eventVersion(row)) throw new CommandFault('precondition_failed')
	const sync = await syncFacts(executor, connection.id)
	windowCheck(sync, row.startsAt, row.endsAt)
	const rules = scopeRules(target)
	const scope = input.input.scope
	const changes = input.input.changes
	if (row.allDay) throw new CommandFault('read_only_event')
	const fields = Object.entries(changes).flatMap(([key, value]) => (value === undefined ? [] : [key]))
	if (kind === 'other' && fields.some((key) => !TIME_FIELDS.has(key))) throw new CommandFault('unsupported_recurrence')
	if (!rules.edit.includes(scope))
		throw new CommandFault(
			kind === 'other' ? 'unsupported_recurrence' : 'invalid_request',
			kind === 'other' ? 409 : 400
		)
	const current = timedOf(row)
	if (!current) throw new CommandFault('read_only_event')
	const { defaultTimeZone } = await readTeacherSettings(executor, context.accountId)
	const next = changedTime(changes, current, defaultTimeZone)
	windowCheck(sync, next.startsAt, new Date(next.startsAt.getTime() + next.minutes * 60000))
	const owned = ownedChanges(changes)
	const id = randomUUID()
	let request: Patch
	let companion: Insert | null = null
	if (scope === 'one' && kind === 'single') {
		const time =
			changes.repeats === 'weekly'
				? weeklyFrom(next.startsAt, next.minutes, current.zone, null)
				: next.changed
					? timePair(next.startsAt, next.minutes, current.zone)
					: {}
		request = stagePatch(id, { eventId: row.eventId, etag: row.etag, marker: row }, { ...owned, ...time })
	} else if (scope === 'one') {
		if (changes.repeats !== undefined && changes.repeats !== 'weekly') throw new CommandFault('invalid_request', 400)
		const time = next.changed ? timePair(next.startsAt, next.minutes, current.zone) : {}
		request = stagePatch(
			id,
			{ eventId: row.eventId, etag: row.etag, marker: row },
			{ ...owned, ...time },
			instanceIdentity(row)
		)
	} else {
		if (!master) throw new CommandFault('unsupported_recurrence')
		const original = originalOf(row)
		const trimmed = scope === 'following' ? trimmedRecurrence(master, original.on) : null
		if (trimmed === null) {
			const time = next.changed || changes.repeats === 'once' ? masterTime(master, current, next, changes.repeats) : {}
			request = stagePatch(id, { eventId: master.eventId, etag: master.etag, marker: master }, { ...owned, ...time })
		} else {
			request = stagePatch(id, { eventId: master.eventId, etag: master.etag, marker: master }, { recurrence: trimmed })
			const zone = seriesFacts(master).time.zone
			const time =
				changes.repeats === 'once'
					? timePair(next.startsAt, next.minutes, zone)
					: weeklyFrom(next.startsAt, next.minutes, zone, master.recurrenceUntil)
			companion = stageInsert(id, connection, COMPANION_STAGE, {
				summary: changes.title ?? master.summary ?? row.summary ?? '',
				...time,
				colorId: changes.colorId !== undefined ? changes.colorId : master.colorId,
				description: changes.description !== undefined ? changes.description : master.description,
				location: changes.location !== undefined ? changes.location : master.location,
			})
		}
	}
	const zone = request.eventId === row.eventId || !master ? current.zone : (timedOf(master)?.zone ?? current.zone)
	const plan = planOf(
		{ operation: 'event_update', eventKey: input.eventKey, eventId: request.eventId, scope, changes },
		zone,
		request
	)
	return { prepared: preparedValue(id, input, connection, sync, plan, request, context.now), companion }
}

async function prepareDelete(
	executor: DbExecutor,
	input: DeleteCommand,
	context: CalendarReadContext,
	connection: Connection
): Promise<Prepared> {
	const target = await loadTarget(executor, connection, input.eventKey)
	const { row, master, kind } = target
	if (row.eventType !== 'default') throw new CommandFault('read_only_event')
	if (input.input.expectedVersion !== eventVersion(row)) throw new CommandFault('precondition_failed')
	const sync = await syncFacts(executor, connection.id)
	windowCheck(sync, row.startsAt, row.endsAt)
	const scope = input.input.scope
	if (!scopeRules(target).delete.includes(scope)) {
		if (row.allDay) throw new CommandFault('read_only_event')
		if (kind === 'other') throw new CommandFault('unsupported_recurrence')
		throw new CommandFault('invalid_request', 400)
	}
	const id = randomUUID()
	const zone = row.start?.timeZone ?? connection.calendarTimeZone ?? 'UTC'
	let request: Patch
	if (scope === 'one') {
		request = stagePatch(
			id,
			{ eventId: row.eventId, etag: row.etag, marker: row },
			{ status: 'cancelled' },
			instanceIdentity(row)
		)
	} else {
		if (!master) throw new CommandFault('unsupported_recurrence')
		const trimmed = scope === 'following' ? trimmedRecurrence(master, originalOf(row).on) : null
		request = stagePatch(
			id,
			{ eventId: master.eventId, etag: master.etag, marker: master },
			trimmed === null ? { status: 'cancelled' } : { recurrence: trimmed }
		)
	}
	const plan = planOf(
		{ operation: 'event_delete', eventKey: input.eventKey, eventId: request.eventId, scope },
		request.eventId === row.eventId ? zone : (master?.start?.timeZone ?? zone),
		request
	)
	return { prepared: preparedValue(id, input, connection, sync, plan, request, context.now), companion: null }
}

export async function prepareEventCommand(
	executor: DbExecutor,
	input: EventCommand,
	context: CalendarReadContext
): Promise<Prepared> {
	const connection = await lockConnection(executor, context.accountId)
	if (input.operation === 'event_create') return prepareCreate(executor, input, context, connection)
	if (input.operation === 'event_update') return prepareUpdate(executor, input, context, connection)
	return prepareDelete(executor, input, context, connection)
}

export async function admitEventCommand(executor: DbExecutor, input: EventCommand, context: CalendarReadContext) {
	const repeated = await findRequest(executor, context.accountId, input.input.requestId)
	if (repeated) return matchingReceipt(repeated, input)
	const { prepared, companion } = await prepareEventCommand(executor, input, context)
	if (Date.now() >= prepared.dispatchDeadline.getTime()) throw new CommandFault('not_applied')
	await persistCommand(executor, prepared)
	if (companion)
		await executor.insert(googleCommandStages).values({
			accountId: prepared.accountId,
			connectionId: prepared.connectionId,
			commandId: prepared.id,
			stage: COMPANION_STAGE,
			generation: prepared.generation,
			kind: 'create_master',
			request: companion,
		})
	return receipt(prepared)
}

export async function applyConfirmedEvent(
	tx: DbExecutor,
	command: PreparedCalendarCommand,
	confirmation: VerifiedGoogleResult
): Promise<void> {
	const [connection] = await tx
		.select()
		.from(googleConnections)
		.where(and(eq(googleConnections.id, command.connectionId), eq(googleConnections.accountId, command.accountId)))
		.for('update')
	if (
		!connection ||
		connection.state !== 'connected' ||
		connection.generation !== confirmation.generation ||
		connection.calendarId !== command.calendarId
	)
		throw new CommandFault('reconnect_required')
	const [current] = await tx
		.select()
		.from(googleCommands)
		.where(and(eq(googleCommands.id, command.id), eq(googleCommands.accountId, command.accountId)))
		.for('update')
	if (current?.state === 'applied') return
	if (
		!current ||
		current.state !== 'projection_pending' ||
		!EVENT_OPERATIONS.has(current.operation) ||
		confirmation.commandId !== command.id ||
		confirmation.acknowledgement.ownedDigest !== command.request.digest
	)
		throw new CommandFault('precondition_failed')
	const confirmedRevision = await advanceCommandRevision(
		tx,
		command.accountId,
		command.connectionId,
		confirmation.generation
	)
	await tx
		.update(googleCommands)
		.set({
			state: 'applied',
			effect: 'confirmed',
			issue: null,
			nextAction: 'none',
			confirmedRevision,
			appliedAt: sql`now()`,
			updatedAt: sql`now()`,
		})
		.where(eq(googleCommands.id, command.id))
}

function repeatOf(target: Target): CalendarEventDetails['repeat'] {
	if (target.kind === 'single') return { kind: 'once' }
	const master = target.master
	if (target.kind === 'weekly' && master?.recurrenceWeekday)
		return { kind: 'weekly', weekday: master.recurrenceWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7 }
	return {
		kind: 'other',
		frequency: master?.recurrenceFrequency ?? 'custom',
		interval: master?.recurrenceInterval && master.recurrenceInterval > 0 ? master.recurrenceInterval : 1,
	}
}

export async function readEventDetails(
	executor: DbExecutor,
	accountId: string,
	eventKey: string
): Promise<CalendarEventDetails | null> {
	const connection = await findConnection(executor, accountId)
	if (!connection?.calendarId || connection.state !== 'connected') return null
	const row = await rowByKey(executor, connection.id, eventKey)
	if (!row || row.status === 'cancelled' || row.rowKind === 'master') return null
	const found = row.recurringEventId ? await masterRow(executor, connection.id, row.recurringEventId) : null
	const master = found && found.status !== 'cancelled' ? found : null
	const target: Target = { row, master, kind: targetKind(row, master) }
	const sync = await syncFacts(executor, connection.id)
	let scopes = scopeRules(target)
	const blocked = (reason: CalendarIssue): Scopes => ({ edit: [], delete: [], reason })
	if (row.eventType !== 'default' || (await isBound(executor, connection, row))) scopes = blocked('read_only_event')
	else if (sync && row.startsAt && (row.startsAt < sync.windowStart || (row.endsAt ?? row.startsAt) > sync.windowEnd))
		scopes = blocked('outside_sync_window')
	else if ((await unresolvedCommands(executor, accountId)).length) scopes = blocked('command_pending')
	const reading = readDescription(row.description)
	return calendarEventDetails.parse({
		eventKey: row.eventKey,
		version: eventVersion(row),
		title: row.summary,
		description: row.description,
		descriptionBlocks: reading.blocks,
		descriptionFormatted: reading.formatted,
		location: row.location,
		color: eventColor(row.colorId, eventColors(sync)),
		repeat: repeatOf(target),
		scopes,
	})
}
