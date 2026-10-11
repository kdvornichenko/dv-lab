import { and, desc, eq } from 'drizzle-orm'

import { seriesStart } from '@dv-lab/core'
import { googleEventMappings, googleReadEvents, googleReadWindows, lessonSeries, type DbExecutor } from '@dv-lab/db'

import { seriesColumns, toSeriesRule } from '../schedule/rows.ts'
import type { SingleCommand, SingleObservation } from '../schedule/single-command.ts'
import { cancelledOccurrences } from './cancelled-occurrences.ts'
import type { CommandAccess } from './dispatch.ts'
import { CalendarFault, GoogleWriteFault, type GoogleGateway } from './gateway.ts'
import { CommandFault } from './journal.ts'
import { eventVersion } from './read-state.ts'
import { matchesMaster } from './recurring.ts'

async function occurrenceTarget(executor: DbExecutor, accountId: string, input: SingleCommand) {
	if (input.ref.kind !== 'series') throw new CommandFault('history_only')
	const [mapping] = await executor
		.select()
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.accountId, accountId),
				eq(googleEventMappings.localEntityId, input.ref.seriesId),
				eq(googleEventMappings.entityKind, 'series'),
				eq(googleEventMappings.state, 'active')
			)
		)
	if (!mapping) throw new CommandFault('history_only')
	const [row] = await executor.select(seriesColumns).from(lessonSeries).where(eq(lessonSeries.id, input.ref.seriesId))
	if (!row) throw new CommandFault('history_only')
	const rule = toSeriesRule(row)
	const natural = seriesStart(rule, input.ref.originalOn)
	if (!natural) throw new CommandFault('history_only')
	const ref = input.ref
	const rows = await executor
		.select()
		.from(googleReadEvents)
		.where(
			and(
				eq(googleReadEvents.accountId, accountId),
				eq(googleReadEvents.connectionId, mapping.connectionId),
				eq(googleReadEvents.recurringEventId, mapping.eventId)
			)
		)
		.orderBy(desc(googleReadEvents.snapshotRevision))
	let event = rows.find(
		(item) =>
			item.localRef?.kind === 'series' &&
			item.localRef.originalOn === ref.originalOn &&
			eventVersion(item) === input.input.expectedVersion
	)
	let cancellationBaselineFingerprint: string | undefined
	if (!event && input.operation === 'restore') {
		const [latest] = await executor
			.select()
			.from(googleReadWindows)
			.where(
				and(
					eq(googleReadWindows.accountId, accountId),
					eq(googleReadWindows.connectionId, mapping.connectionId),
					eq(googleReadWindows.coverageState, 'complete')
				)
			)
			.orderBy(desc(googleReadWindows.snapshotRevision))
			.limit(1)
		const historical = latest
			? (await cancelledOccurrences(executor, latest)).find(
					(item) =>
						item.localRef?.kind === 'series' &&
						item.localRef.seriesId === ref.seriesId &&
						item.localRef.originalOn === ref.originalOn &&
						eventVersion(item) === input.input.expectedVersion
				)
			: undefined
		event = historical
		cancellationBaselineFingerprint = historical?.cancellationBaselineFingerprint
	}
	if (!event || event.bindingKind !== 'lesson') throw new CommandFault('precondition_failed')
	const [window] = await executor.select().from(googleReadWindows).where(eq(googleReadWindows.id, event.windowId))
	if (!window || window.coverageState !== 'complete') throw new CommandFault('precondition_failed')
	return { mapping, rule, natural, event, window, cancellationBaselineFingerprint }
}

export type InstanceEvidence = {
	kind: 'instance'
	target: Awaited<ReturnType<typeof occurrenceTarget>>
	observation: SingleObservation | null
	lookupVerified: boolean
}

export async function observeInstance(
	access: CommandAccess,
	input: SingleCommand,
	gateway: GoogleGateway
): Promise<InstanceEvidence> {
	const target = await occurrenceTarget(access.db, access.connection.accountId, input)
	if (
		target.event.snapshotRevision !== access.connection.snapshotRevision ||
		target.event.generation !== access.connection.generation ||
		target.mapping.calendarId !== access.connection.calendarId
	)
		throw new CommandFault('precondition_failed')
	const primary = await gateway.primary(access.accessToken, access.signal)
	if (primary.id !== target.mapping.calendarId) throw new CommandFault('external_change')
	const master = await gateway.master(
		access.accessToken,
		primary.id,
		target.mapping.eventId,
		target.rule.timeZone,
		access.signal
	)
	if (!matchesMaster(master, target.rule)) throw new CommandFault('external_change')
	const canonical = await gateway.canonicalInstance(
		access.accessToken,
		primary.id,
		target.mapping.eventId,
		target.natural.toISOString(),
		access.signal
	)
	if (canonical.kind !== 'found') return { kind: 'instance', target, observation: null, lookupVerified: false }
	if (canonical.eventId !== target.event.eventId) throw new CommandFault('external_change')
	return readInstance(access, input, gateway, target, canonical.eventId)
}

async function readInstance(
	access: CommandAccess,
	input: SingleCommand,
	gateway: GoogleGateway,
	target: InstanceEvidence['target'],
	eventId: string
): Promise<InstanceEvidence> {
	let observation: SingleObservation
	try {
		observation = await gateway.observeEvent(
			access.accessToken,
			target.mapping.calendarId,
			eventId,
			target.rule.timeZone,
			access.signal
		)
	} catch (error) {
		if (
			(error instanceof GoogleWriteFault && error.outcome === 'missing') ||
			(error instanceof CalendarFault && error.code === 'invalid_provider_data')
		)
			return { kind: 'instance', target, observation: null, lookupVerified: false }
		throw error
	}
	const original = observation.event.originalStartTime
	if (
		observation.event.recurringEventId !== target.mapping.eventId ||
		!original ||
		!('dateTime' in original) ||
		Date.parse(original.dateTime) !== target.natural.getTime() ||
		(observation.event.etag !== target.event.etag &&
			!(
				input.operation === 'restore' &&
				observation.event.status === 'cancelled' &&
				target.cancellationBaselineFingerprint === observation.unownedWritableFingerprint
			))
	)
		throw new CommandFault('external_change')
	return { kind: 'instance', target, observation, lookupVerified: true }
}
