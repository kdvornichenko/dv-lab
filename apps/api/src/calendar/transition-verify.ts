import { scheduleDate, seriesStart } from '@dv-lab/core'
import {
	googleStageAcknowledgement,
	type GoogleObservedResource,
	type GoogleStageAcknowledgement,
	type GoogleCutCompletion,
} from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import type { CommandAccess } from './dispatch.ts'
import { type GoogleGateway } from './gateway.ts'
import { CommandFault, digest, type StageRow } from './journal.ts'
import { matchesMaster } from './recurring.ts'
import { transitionStage } from './transition-journal.ts'
import { observedResource, readOldInactive, sameResource, sameTime, verifyPrimary } from './transition-proof.ts'
import { transitionSteps, type TransitionStep } from './transition-stages.ts'

export async function prefixSource(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	step: Extract<TransitionStep, { source: GoogleObservedResource }>,
	gateway: GoogleGateway
) {
	const captured = step.source
	const original = captured.event.originalStartTime
	const cut = command.plan.cut
	const rule = command.plan.capturedRule
	if (!original || !('dateTime' in original) || !cut || !rule) throw new CommandFault('precondition_failed')
	const canonical = await gateway.canonicalInstance(
		access.accessToken,
		command.calendarId,
		cut.master.event.eventId,
		original.dateTime,
		access.signal
	)
	if (canonical.kind !== 'found' || canonical.eventId !== captured.event.eventId)
		throw new CommandFault('external_change')
	const actual = await observedResource(access, command, canonical.eventId, gateway)
	if (sameResource(actual, captured)) return { actual, repair: false }
	const trim = transitionSteps(command).find((item) => item.purpose === 'trim')
	const row = trim ? await transitionStage(access, command, trim.stage) : undefined
	const request = row?.request
	if (!row || row.state !== 'acknowledged' || request?.method !== 'patch') throw new CommandFault('external_change')
	verifyPrefixDefault(command, actual, original.dateTime, trim!.stage, request.digest)
	return { actual, repair: true }
}

async function cancelledRepresentation(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	id: string,
	gateway: GoogleGateway,
	rows: readonly StageRow[]
) {
	const cancellation = rows.find(
		(row) =>
			row.request.method === 'patch' &&
			row.request.eventId === id &&
			row.request.payload.status === 'cancelled' &&
			row.state === 'acknowledged'
	)
	if (!cancellation || !cancellation.acknowledgement) throw new CommandFault('precondition_failed')
	const ack = cancellation.acknowledgement
	if (ack.kind !== 'cancellation' || ack.response.id !== id) throw new CommandFault('external_change')
	const current = await gateway.cancelledEvent(access.accessToken, command.calendarId, id, access.signal)
	if (current.id !== id) throw new CommandFault('external_change')
	return { eventId: id, stageId: cancellation.id, current }
}

async function verifyRepresentations(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	gateway: GoogleGateway,
	rows: readonly StageRow[]
) {
	const actual: GoogleObservedResource[] = []
	const cancelled: Awaited<ReturnType<typeof cancelledRepresentation>>[] = []
	for (const reservation of command.plan.reservations) {
		const lineage = command.plan.lineage.find(
			(item) => item.to.kind === 'single' && item.to.lessonId === reservation.localEntityId
		)
		if (lineage?.status === 'cancelled') {
			cancelled.push(await cancelledRepresentation(access, command, reservation.eventId, gateway, rows))
			continue
		}
		const resource = await observedResource(
			access,
			command,
			reservation.eventId,
			gateway,
			lineage?.timeZone ?? command.plan.newRule?.timeZone ?? command.plan.capturedTimeZone
		)
		verifyRepresentation(command, resource, reservation, lineage, rows)
		actual.push(resource)
	}
	return { actual, cancelled }
}

export async function readCutComplete(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	gateway: GoogleGateway
): Promise<GoogleStageAcknowledgement> {
	const cut = command.plan.cut
	if (!cut) throw new CommandFault('precondition_failed')
	await verifyPrimary(access, command, gateway)
	const rows: StageRow[] = []
	const steps = transitionSteps(command)
	for (const step of steps.filter((item) => item.purpose !== 'complete')) {
		const row = await transitionStage(access, command, step.stage)
		if (!row || row.state !== 'acknowledged' || !row.acknowledgement) throw new CommandFault('precondition_failed')
		rows.push(row)
	}
	const inactive = await readOldInactive(access, command, gateway)
	const representations = await verifyRepresentations(access, command, gateway, rows)
	const identityProofs = await verifyIdentities(
		access,
		command,
		gateway,
		representations.cancelled.map((item) => item.eventId)
	)
	const canonicalInstances = await verifyNewInstances(access, command, representations.actual, gateway)
	const cancelledPrefix = await verifyCancelledPrefix(access, command, gateway)
	const prefix: GoogleObservedResource[] = []
	for (const expected of cut.prefix) {
		const actual = await observedResource(access, command, expected.event.eventId, gateway)
		if (!sameResource(actual, expected)) throw new CommandFault('external_change')
		prefix.push(actual)
	}
	return googleStageAcknowledgement.parse({
		kind: 'cut_complete',
		credentialGeneration: access.connection.credentialGeneration,
		checkedAt: new Date().toISOString(),
		planDigest: digest(JSON.stringify(command.plan)),
		stageIds: rows.map((row) => row.id),
		master: inactive.master,
		cancellationStageId: inactive.cancellationStageId,
		cancelledMaster: inactive.cancelledMaster,
		oldTail: inactive.tail,
		oldCancelledTail: inactive.cancelledTail,
		family: inactive.family,
		absentIds: inactive.absentIds,
		complete: true,
		identityProofs,
		canonicalInstances,
		representations: representations.actual,
		cancelledRepresentations: representations.cancelled,
		prefix,
		cancelledPrefix,
	})
}

export function verifyPrefixDefault(
	command: PreparedCalendarCommand,
	actual: GoogleObservedResource,
	original: string,
	stage: number,
	requestDigest: string
) {
	const rule = command.plan.capturedRule!
	const cut = command.plan.cut!
	const natural = seriesStart(rule, scheduleDate(new Date(original), rule.timeZone))
	const start = actual.event.start
	const end = actual.event.end
	if (!natural || !start || !end || !('dateTime' in start) || !('dateTime' in end))
		throw new CommandFault('external_change')
	if (
		actual.privateProperties.dvCommandId !== command.id ||
		actual.privateProperties.dvStage !== String(stage) ||
		actual.privateProperties.dvDigest !== requestDigest ||
		actual.event.status !== 'confirmed' ||
		actual.event.summary !== cut.master.event.summary ||
		Date.parse(start.dateTime) !== natural.getTime() ||
		Date.parse(end.dateTime) !== natural.getTime() + rule.durationMinutes * 60000 ||
		actual.unownedWritableFingerprint !== cut.master.unownedWritableFingerprint
	)
		throw new CommandFault('external_change')
}

function verifyRepresentation(
	command: PreparedCalendarCommand,
	resource: GoogleObservedResource,
	reservation: PreparedCalendarCommand['plan']['reservations'][number],
	lineage: PreparedCalendarCommand['plan']['lineage'][number] | undefined,
	rows: readonly StageRow[]
) {
	const insert = rows.find((row) => row.request.method === 'insert' && row.request.eventId === reservation.eventId)
	if (
		!insert ||
		insert.request.method !== 'insert' ||
		resource.event.status !== 'confirmed' ||
		resource.privateProperties.dvCommandId !== command.id ||
		resource.privateProperties.dvStage !== String(insert.stage) ||
		resource.privateProperties.dvDigest !== insert.request.digest
	)
		throw new CommandFault('external_change')
	verifyRepresentationTime(command, resource, reservation, lineage)
	if (
		!insert.request.payload.preserved ||
		resource.unownedWritableFingerprint !==
			(insert.acknowledgement?.kind === 'master' || insert.acknowledgement?.kind === 'event'
				? insert.acknowledgement.unownedWritableFingerprint
				: null)
	)
		throw new CommandFault('external_change')
}

function verifyRepresentationTime(
	command: PreparedCalendarCommand,
	resource: GoogleObservedResource,
	reservation: PreparedCalendarCommand['plan']['reservations'][number],
	lineage: PreparedCalendarCommand['plan']['lineage'][number] | undefined
) {
	if (reservation.entityKind === 'series') {
		if (!command.plan.newRule || !matchesMaster(resource, command.plan.newRule))
			throw new CommandFault('external_change')
	} else {
		const start = resource.event.start
		const end = resource.event.end
		if (
			!lineage ||
			!start ||
			!end ||
			!('dateTime' in start) ||
			!('dateTime' in end) ||
			Date.parse(start.dateTime) !== Date.parse(lineage.startsAt) ||
			Date.parse(end.dateTime) !== Date.parse(lineage.startsAt) + lineage.durationMinutes * 60000
		)
			throw new CommandFault('external_change')
	}
}

async function verifyIdentities(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	gateway: GoogleGateway,
	cancelledIds: readonly string[]
) {
	const proofs: GoogleCutCompletion['identityProofs'] = []
	for (const reservation of command.plan.reservations) {
		const events = await gateway.identityEvents(
			access.accessToken,
			command.calendarId,
			reservation.localEntityId,
			access.signal,
			cancelledIds
		)
		const active = events.filter(
			(item) => item.status !== 'cancelled' && !(item.status === undefined && cancelledIds.includes(item.id))
		)
		const cancelled = command.plan.lineage.some(
			(item) =>
				item.to.kind === 'single' && item.to.lessonId === reservation.localEntityId && item.status === 'cancelled'
		)
		if (cancelled ? active.length !== 0 : active.length !== 1 || active[0].id !== reservation.eventId)
			throw new CommandFault('external_change')
		proofs.push({
			localEntityId: reservation.localEntityId,
			complete: true,
			events: events.map(({ id, status }) => ({ id, status })),
		})
	}
	return proofs
}

async function verifyNewInstances(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	resources: readonly GoogleObservedResource[],
	gateway: GoogleGateway
) {
	const instances: GoogleObservedResource[] = []
	for (const resource of resources.filter((item) => item.recurrence.length > 0)) {
		const start = resource.event.start
		if (!start || !('dateTime' in start)) throw new CommandFault('external_change')
		const canonical = await gateway.canonicalInstance(
			access.accessToken,
			command.calendarId,
			resource.event.eventId,
			start.dateTime,
			access.signal
		)
		if (canonical.kind !== 'found') throw new CommandFault('external_change')
		const instance = await observedResource(access, command, canonical.eventId, gateway, start.timeZone)
		if (
			instance.event.recurringEventId !== resource.event.eventId ||
			instance.event.status !== 'confirmed' ||
			!sameTime(instance.event.start, resource.event.start) ||
			!sameTime(instance.event.end, resource.event.end) ||
			!sameTime(instance.event.originalStartTime, resource.event.start)
		)
			throw new CommandFault('external_change')
		instances.push(instance)
	}
	return instances
}

async function verifyCancelledPrefix(access: CommandAccess, command: PreparedCalendarCommand, gateway: GoogleGateway) {
	const current: GoogleCutCompletion['cancelledPrefix'] = []
	for (const source of command.plan.cut!.cancelledPrefix) {
		const canonical = await gateway.canonicalInstance(
			access.accessToken,
			command.calendarId,
			source.current.recurringEventId,
			source.current.originalStartTime.dateTime,
			access.signal
		)
		if (canonical.kind !== 'found' || canonical.eventId !== source.current.id) throw new CommandFault('external_change')
		const actual = await gateway.cancelledInstance(
			access.accessToken,
			command.calendarId,
			canonical.eventId,
			access.signal
		)
		if (
			actual.recurringEventId !== source.current.recurringEventId ||
			Date.parse(actual.originalStartTime.dateTime) !== Date.parse(source.current.originalStartTime.dateTime)
		)
			throw new CommandFault('external_change')
		current.push(actual)
	}
	return current
}
