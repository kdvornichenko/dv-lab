import { and, eq } from 'drizzle-orm'

import { googleEventMappings, type DbExecutor } from '@dv-lab/db'

import type { SingleCommand, SingleObservation } from '../schedule/single-command.ts'
import { cancelledOccurrenceBaseline } from './cancelled-occurrences.ts'
import type { CommandAccess } from './dispatch.ts'
import { rowForLocal } from './event-mapping.ts'
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
	const local = await rowForLocal(executor, mapping.connectionId, input.ref)
	if (
		local?.kind !== 'series' ||
		local.mapping.id !== mapping.id ||
		local.row.eventType !== 'default' ||
		eventVersion(local.row) !== input.input.expectedVersion
	)
		throw new CommandFault('precondition_failed')
	const cancellationBaselineFingerprint =
		local.row.status === 'cancelled'
			? await cancelledOccurrenceBaseline(executor, mapping, input.ref, local.row.eventId)
			: undefined
	return { mapping, rule: local.rule, natural: local.natural, row: local.row, cancellationBaselineFingerprint }
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
		target.mapping.connectionId !== access.connection.id ||
		target.mapping.calendarId !== access.connection.calendarId
	)
		throw new CommandFault('precondition_failed')
	const master = await gateway.master(
		access.accessToken,
		target.mapping.calendarId,
		target.mapping.eventId,
		target.rule.timeZone,
		access.signal
	)
	if (!matchesMaster(master, target.rule)) throw new CommandFault('external_change')
	const canonical = await gateway.canonicalInstance(
		access.accessToken,
		target.mapping.calendarId,
		target.mapping.eventId,
		target.natural.toISOString(),
		access.signal
	)
	if (canonical.kind !== 'found') return { kind: 'instance', target, observation: null, lookupVerified: false }
	if (canonical.eventId !== target.row.eventId) throw new CommandFault('external_change')
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
		(observation.event.etag !== target.row.etag &&
			!(
				input.operation === 'restore' &&
				observation.event.status === 'cancelled' &&
				target.cancellationBaselineFingerprint === observation.unownedWritableFingerprint
			))
	)
		throw new CommandFault('external_change')
	return { kind: 'instance', target, observation, lookupVerified: true }
}
