import { and, eq, inArray, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import type { IgnoreCalendarEventRequest, ValidatedCalendarCommand } from '@dv-lab/contracts'
import { weekdayOf, zonedParts, type Weekday } from '@dv-lab/core'
import {
	googleCalendarEvents,
	googleCommandPlan,
	googleConnections,
	googleEventIgnores,
	googleEventMappings,
	googleStageRequest,
	lessons,
	lessonSeries,
	students,
	type Database,
	type DbExecutor,
	type GoogleStageRequest,
} from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import { LESSON_MARKERS } from './event-mapping.ts'
import { currentConnection } from './google-access.ts'
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
import { masterRow, rowByKey, syncFacts, type ProjectionRow } from './projection.ts'
import { eventVersion, type CalendarReadContext } from './read-state.ts'

export type AssignCommand = Extract<ValidatedCalendarCommand, { operation: 'assign' }>
type Patch = Extract<GoogleStageRequest, { method: 'patch' }>
type Connection = typeof googleConnections.$inferSelect & { calendarId: string }
type MasterFields = Pick<
	ProjectionRow,
	'start' | 'end' | 'status' | 'allDay' | 'recurrenceKind' | 'recurrenceWeekday' | 'recurrenceUntil'
>
export type MasterRule = {
	weekday: Weekday
	startTime: string
	timeZone: string
	durationMinutes: number
	startsOn: string
	until: string | null
}
type Adoption = { id: string; generation: number }

export function masterSeriesRule(master: MasterFields, zone?: string): MasterRule | null {
	const { start, end } = master
	if (master.status === 'cancelled' || master.allDay || master.recurrenceKind !== 'weekly') return null
	if (!start || !end || !('dateTime' in start) || !('dateTime' in end)) return null
	const startsAt = new Date(start.dateTime)
	const minutes = (Date.parse(end.dateTime) - startsAt.getTime()) / 60000
	if (startsAt.getTime() % 60000 !== 0 || !Number.isInteger(minutes) || minutes < 1) return null
	if (weekdayOf(zonedParts(startsAt, start.timeZone).date) !== master.recurrenceWeekday) return null
	const timeZone = zone ?? start.timeZone
	const local = zonedParts(startsAt, timeZone)
	return {
		weekday: local.weekday,
		startTime: local.time,
		timeZone,
		durationMinutes: minutes,
		startsOn: local.date,
		until: master.recurrenceUntil,
	}
}

async function lockConnection(executor: DbExecutor, accountId: string): Promise<Connection> {
	const [connection] = await executor.select().from(googleConnections).where(currentConnection(accountId)).for('update')
	if (!connection?.calendarId || connection.state !== 'connected') throw new CommandFault('connection_required')
	if ((await unresolvedCommands(executor, accountId)).length) throw new CommandFault('command_pending')
	return { ...connection, calendarId: connection.calendarId }
}

async function isBound(executor: DbExecutor, connectionId: string, eventIds: readonly string[]) {
	const [mapped] = await executor
		.select({ id: googleEventMappings.id })
		.from(googleEventMappings)
		.where(and(eq(googleEventMappings.connectionId, connectionId), inArray(googleEventMappings.eventId, [...eventIds])))
		.limit(1)
	if (mapped) return true
	const [marked] = await executor
		.select({ eventId: googleCalendarEvents.eventId })
		.from(googleCalendarEvents)
		.where(
			and(
				eq(googleCalendarEvents.connectionId, connectionId),
				inArray(googleCalendarEvents.eventId, [...eventIds]),
				inArray(googleCalendarEvents.markerKind, LESSON_MARKERS),
				sql`exists (select 1 from ${googleEventMappings} where ${googleEventMappings.connectionId} = ${connectionId} and ${googleEventMappings.state} = 'active' and ${googleEventMappings.localEntityId} = ${googleCalendarEvents.markerLocalId})`
			)
		)
		.limit(1)
	return Boolean(marked)
}

async function adoption(
	executor: DbExecutor,
	connection: Connection,
	target: ProjectionRow,
	scope: 'event' | 'series',
	studentId: string
): Promise<Adoption | null> {
	const id = target.markerLocalId
	if (!id || target.markerKind !== (scope === 'series' ? 'series' : 'single')) return null
	const [owned] = await executor
		.select({ id: googleEventMappings.id })
		.from(googleEventMappings)
		.where(and(eq(googleEventMappings.accountId, connection.accountId), eq(googleEventMappings.localEntityId, id)))
		.limit(1)
	if (!owned) return null
	const [entity] =
		scope === 'series'
			? await executor.select({ studentId: lessonSeries.studentId }).from(lessonSeries).where(eq(lessonSeries.id, id))
			: await executor.select({ studentId: lessons.studentId }).from(lessons).where(eq(lessons.id, id))
	if (!entity) return null
	if (entity.studentId !== studentId) throw new CommandFault('invalid_request', 400)
	const [latest] = await executor
		.select({ generation: sql<number | null>`max(${googleEventMappings.representationGeneration})::int` })
		.from(googleEventMappings)
		.where(and(eq(googleEventMappings.connectionId, connection.id), eq(googleEventMappings.localEntityId, id)))
	return { id, generation: latest?.generation === null || latest === undefined ? 0 : latest.generation + 1 }
}

function markerPatch(
	commandId: string,
	target: ProjectionRow,
	entityKind: 'single' | 'series',
	entity: { id: string; generation: number }
): Patch {
	const hash = digest(JSON.stringify({ eventId: target.eventId, assign: entity.id, entityKind, commandId }))
	const request = googleStageRequest.parse({
		method: 'patch',
		eventId: target.eventId,
		ifMatch: target.etag,
		digest: hash,
		payload: {
			markers: {
				entityKind,
				localEntityId: entity.id,
				representationGeneration: entity.generation,
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

export async function prepareAssign(
	executor: DbExecutor,
	input: AssignCommand,
	context: CalendarReadContext
): Promise<PreparedCalendarCommand> {
	const connection = await lockConnection(executor, context.accountId)
	const row = await rowByKey(executor, connection.id, input.eventKey)
	if (!row || row.rowKind === 'master') throw new CommandFault('not_found', 404)
	if (row.eventType !== 'default' || row.allDay) throw new CommandFault('read_only_event')
	if (row.status === 'cancelled' || input.input.expectedVersion !== eventVersion(row))
		throw new CommandFault('precondition_failed')
	const sync = await syncFacts(executor, connection.id)
	if (sync && row.startsAt && (row.startsAt < sync.windowStart || (row.endsAt ?? row.startsAt) > sync.windowEnd))
		throw new CommandFault('outside_sync_window')
	const [student] = await executor
		.select({ status: students.status })
		.from(students)
		.where(eq(students.id, input.input.studentId))
		.for('update')
	if (!student || student.status !== 'active') throw new CommandFault('invalid_request', 400)
	const master = row.recurringEventId ? await masterRow(executor, connection.id, row.recurringEventId) : null
	const target = master ?? row
	const scope = row.recurringEventId ? 'series' : 'event'
	const rule = master ? masterSeriesRule(master) : null
	if (row.recurringEventId && (!rule || (rule.until !== null && rule.until < rule.startsOn)))
		throw new CommandFault('unsupported_recurrence')
	if (!row.start || !('dateTime' in row.start)) throw new CommandFault('read_only_event')
	if (await isBound(executor, connection.id, [row.eventId, target.eventId]))
		throw new CommandFault('precondition_failed')
	const adopted = await adoption(executor, connection, target, scope, input.input.studentId)
	const entity = adopted ?? { id: randomUUID(), generation: 0 }
	const id = randomUUID()
	const request = markerPatch(id, target, scope === 'series' ? 'series' : 'single', entity)
	const capturedRule =
		rule && !adopted
			? {
					weekday: rule.weekday,
					startTime: rule.startTime,
					timeZone: rule.timeZone,
					durationMinutes: rule.durationMinutes,
					startsOn: rule.startsOn,
					endsOn: rule.until,
				}
			: null
	const plan = googleCommandPlan.parse({
		version: 1,
		input: {
			operation: 'assign',
			eventKey: input.eventKey,
			eventId: target.eventId,
			studentId: input.input.studentId,
			scope,
		},
		capturedTimeZone: target.start?.timeZone ?? connection.calendarTimeZone ?? 'UTC',
		capturedRule,
		reservations: [],
		lineage: [],
		preconditions: [
			{ eventId: target.eventId, etag: target.etag, unownedWritableFingerprint: null, unownedWritable: null },
		],
		affectedRefs: [
			rule
				? { kind: 'series', seriesId: entity.id, originalOn: rule.startsOn }
				: { kind: 'single', lessonId: entity.id },
		],
		oldEndsOn: null,
		newRule: null,
	})
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
		operation: 'assign',
		plan,
		request,
		createdAt: context.now,
		dispatchDeadline: new Date(context.now.getTime() + 30000),
	}
}

export async function admitAssign(executor: DbExecutor, input: AssignCommand, context: CalendarReadContext) {
	const repeated = await findRequest(executor, context.accountId, input.input.requestId)
	if (repeated) return matchingReceipt(repeated, input)
	const prepared = await prepareAssign(executor, input, context)
	if (Date.now() >= prepared.dispatchDeadline.getTime()) throw new CommandFault('not_applied')
	await persistCommand(executor, prepared)
	return receipt(prepared)
}

export function ignoreEvent(
	db: Database,
	accountId: string,
	eventKey: string,
	input: IgnoreCalendarEventRequest
): Promise<void> {
	return db.transaction(async (tx) => {
		const [connection] = await tx.select().from(googleConnections).where(currentConnection(accountId)).for('update')
		if (!connection?.calendarId || connection.state !== 'connected') throw new CommandFault('connection_required')
		const row = await rowByKey(tx, connection.id, eventKey)
		const [previous] = await tx
			.select()
			.from(googleEventIgnores)
			.where(and(eq(googleEventIgnores.accountId, accountId), eq(googleEventIgnores.requestId, input.requestId)))
		if (previous) {
			if (row && previous.connectionId === connection.id && previous.eventId === (row.recurringEventId ?? row.eventId))
				return
			throw new CommandFault('precondition_failed')
		}
		if (!row || row.rowKind === 'master') throw new CommandFault('not_found', 404)
		if (input.expectedVersion !== eventVersion(row)) throw new CommandFault('precondition_failed')
		if (await isBound(tx, connection.id, [row.eventId, ...(row.recurringEventId ? [row.recurringEventId] : [])]))
			throw new CommandFault('precondition_failed')
		await tx
			.insert(googleEventIgnores)
			.values({
				accountId,
				connectionId: connection.id,
				calendarId: connection.calendarId,
				eventId: row.recurringEventId ?? row.eventId,
				requestId: input.requestId,
			})
			.onConflictDoNothing()
	})
}
