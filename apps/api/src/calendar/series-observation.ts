import { and, eq } from 'drizzle-orm'

import { scheduleDate, seriesStart } from '@dv-lab/core'
import { googleEventMappings, googleObservedResource, type GoogleObservedResource, type DbExecutor } from '@dv-lab/db'

import { prepareSeriesChange, type SeriesCommand } from '../schedule/series.ts'
import type { CommandAccess } from './dispatch.ts'
import type { GoogleGateway } from './gateway.ts'
import { CommandFault } from './journal.ts'
import { opaqueVersion } from './read-state.ts'
import { matchesMaster } from './recurring.ts'

export async function observeSeries(access: CommandAccess, input: SeriesCommand, now: Date, gateway: GoogleGateway) {
	const mapping = await seriesBinding(access.db, access.connection.accountId, input.seriesId)
	if (mapping.connectionId !== access.connection.id || mapping.calendarId !== access.connection.calendarId)
		throw new CommandFault('precondition_failed')
	const prepared = await access.db.transaction((tx) => prepareSeriesChange(tx, access.connection.accountId, input, now))
	const primary = await gateway.primary(access.accessToken, access.signal)
	if (primary.id !== mapping.calendarId) throw new CommandFault('external_change')
	const master = googleObservedResource.parse(
		await gateway.observeEvent(
			access.accessToken,
			mapping.calendarId,
			mapping.eventId,
			prepared.rule.timeZone,
			access.signal
		)
	)
	if (
		!matchesMaster(master, prepared.rule) ||
		opaqueVersion([mapping.id, mapping.representationGeneration, master.event.etag]) !== input.input.expectedVersion
	)
		throw new CommandFault('precondition_failed')
	if (
		master.privateProperties.dvLocalId !== input.seriesId ||
		master.privateProperties.dvKind !== 'series' ||
		master.privateProperties.dvGeneration !== String(mapping.representationGeneration)
	)
		throw new CommandFault('external_change')
	const family = await gateway.familyEvents(access.accessToken, mapping.calendarId, mapping.eventId, access.signal)
	validateFamily(family, prepared)
	const prefix: GoogleObservedResource[] = []
	for (const member of family) {
		const originalOn = scheduleDate(new Date(member.originalStartTime.dateTime), prepared.rule.timeZone)
		if (originalOn >= prepared.naturalCutoff) continue
		prefix.push(
			googleObservedResource.parse(
				await gateway.observeEvent(
					access.accessToken,
					mapping.calendarId,
					member.id,
					prepared.rule.timeZone,
					access.signal
				)
			)
		)
	}
	const tail: GoogleObservedResource[] = []
	for (const lesson of prepared.lessons) {
		const natural = seriesStart(prepared.rule, lesson.originalOn)
		if (!natural) throw new CommandFault('external_change')
		const actual = await gateway.canonicalInstance(
			access.accessToken,
			mapping.calendarId,
			mapping.eventId,
			natural.toISOString(),
			access.signal
		)
		if (actual.kind !== 'found') throw new CommandFault('external_change')
		const observed = googleObservedResource.parse(
			await gateway.observeEvent(
				access.accessToken,
				mapping.calendarId,
				actual.eventId,
				prepared.rule.timeZone,
				access.signal
			)
		)
		if (
			!observed.event.start ||
			!('dateTime' in observed.event.start) ||
			Date.parse(observed.event.start.dateTime) !== lesson.startsAt.getTime() ||
			!observed.unownedWritable
		)
			throw new CommandFault('external_change')
		tail.push(observed)
	}
	access.signal.throwIfAborted()
	return {
		kind: 'series' as const,
		mapping,
		prepared,
		master,
		prefix,
		tail,
		familyIds: family.map((item) => item.id).sort(),
	}
}

export type SeriesEvidence = Awaited<ReturnType<typeof observeSeries>>

function validateFamily(
	family: Awaited<ReturnType<GoogleGateway['familyEvents']>>,
	prepared: Awaited<ReturnType<typeof prepareSeriesChange>>
) {
	for (const member of family) {
		const originalOn = scheduleDate(new Date(member.originalStartTime.dateTime), prepared.rule.timeZone)
		if (originalOn >= prepared.naturalCutoff && !prepared.lessons.some((lesson) => lesson.originalOn === originalOn))
			throw new CommandFault('external_change')
	}
}

export async function seriesBinding(executor: DbExecutor, accountId: string, seriesId: string) {
	const [mapping] = await executor
		.select()
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.accountId, accountId),
				eq(googleEventMappings.localEntityId, seriesId),
				eq(googleEventMappings.entityKind, 'series'),
				eq(googleEventMappings.state, 'active')
			)
		)
	if (!mapping) throw new CommandFault('history_only')
	return mapping
}
