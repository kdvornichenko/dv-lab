import { eq } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'

import { timeZoneIdentity } from '@dv-lab/contracts'
import { scheduleDate } from '@dv-lab/core'
import {
	googleConnections,
	googleObservedResource,
	type GoogleObservedResource,
	type GoogleCutPlan,
	type GoogleStageAcknowledgement,
} from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import type { CommandAccess } from './dispatch.ts'
import { GoogleWriteFault, type GoogleGateway } from './gateway.ts'
import { CommandFault, type StageRow } from './journal.ts'
import { matchesMaster, sameRecurrence } from './recurring.ts'
import { cancelledTailHistory } from './transition-cancellations.ts'
import { transitionStage } from './transition-journal.ts'
import { transitionSteps } from './transition-stages.ts'

export function sameTime(
	left: GoogleObservedResource['event']['start'],
	right: GoogleObservedResource['event']['start']
) {
	if (!left || !right) return left === right
	if ('date' in left && 'date' in right)
		return left.date === right.date && timeZoneIdentity(left.timeZone) === timeZoneIdentity(right.timeZone)
	return (
		'dateTime' in left &&
		'dateTime' in right &&
		Date.parse(left.dateTime) === Date.parse(right.dateTime) &&
		timeZoneIdentity(left.timeZone) === timeZoneIdentity(right.timeZone)
	)
}

export function sameResource(actual: GoogleObservedResource, expected: GoogleObservedResource) {
	const left = actual.event
	const right = expected.event
	return (
		left.eventId === right.eventId &&
		left.recurringEventId === right.recurringEventId &&
		left.status === right.status &&
		left.summary === right.summary &&
		left.eventType === right.eventType &&
		sameTime(left.start, right.start) &&
		sameTime(left.end, right.end) &&
		sameTime(left.originalStartTime, right.originalStartTime) &&
		actual.unownedWritableFingerprint === expected.unownedWritableFingerprint &&
		sameRecurrenceOrEmpty(actual.recurrence, expected.recurrence)
	)
}

function sameRecurrenceOrEmpty(actual: readonly string[], expected: readonly string[]) {
	return (actual.length === 0 && expected.length === 0) || sameRecurrence(actual, expected)
}

export async function observedResource(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	id: string,
	gateway: GoogleGateway,
	timeZone = command.plan.capturedTimeZone
) {
	return googleObservedResource.parse(
		await gateway.observeEvent(access.accessToken, command.calendarId, id, timeZone, access.signal)
	)
}

export async function verifyPrimary(access: CommandAccess, command: PreparedCalendarCommand, gateway: GoogleGateway) {
	const [connection] = await access.db
		.select()
		.from(googleConnections)
		.where(eq(googleConnections.id, command.connectionId))
	if (
		!connection ||
		connection.state !== 'connected' ||
		connection.calendarId !== command.calendarId ||
		connection.generation !== access.connection.generation ||
		access.connection.calendarId !== command.calendarId
	)
		throw new CommandFault('reconnect_required')
}

async function captureResources(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	sources: readonly GoogleObservedResource[],
	gateway: GoogleGateway
) {
	const resources: GoogleObservedResource[] = []
	for (const source of sources) {
		const actual = await observedResource(access, command, source.event.eventId, gateway)
		if (!sameResource(actual, source) || actual.event.etag !== source.event.etag)
			throw new CommandFault('external_change')
		resources.push(actual)
	}
	return resources
}

export async function readCutCapture(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	gateway: GoogleGateway
): Promise<GoogleStageAcknowledgement> {
	const cut = command.plan.cut
	if (!cut) throw new CommandFault('precondition_failed')
	await verifyPrimary(access, command, gateway)
	const master = await observedResource(access, command, cut.master.event.eventId, gateway)
	if (!sameResource(master, cut.master) || master.event.etag !== cut.master.event.etag)
		throw new CommandFault('external_change')
	const family = await gateway.familyEvents(access.accessToken, command.calendarId, master.event.eventId, access.signal)
	if (!isDeepStrictEqual(family.map((item) => item.id).sort(), [...cut.familyIds].sort()))
		throw new CommandFault('external_change')
	const prefix = await captureResources(access, command, cut.prefix, gateway)
	const tail = await captureResources(access, command, cut.tail, gateway)
	const cancelledTail = await captureCancellations(access, command, cut.cancelledTail, gateway)
	const cancelledPrefix = await captureCancellations(access, command, cut.cancelledPrefix, gateway)
	return {
		kind: 'cut_capture',
		checkedAt: new Date().toISOString(),
		master,
		prefix,
		tail,
		cancelledTail,
		cancelledPrefix,
	}
}

async function cancellationStage(
	access: CommandAccess,
	command: PreparedCalendarCommand
): Promise<StageRow | undefined> {
	const trim = transitionSteps(command).find((step) => step.purpose === 'trim')
	const row = trim ? await transitionStage(access, command, trim.stage) : undefined
	return row?.state === 'acknowledged' && row.acknowledgement?.kind === 'cancellation' ? row : undefined
}

async function inactiveMaster(access: CommandAccess, command: PreparedCalendarCommand, gateway: GoogleGateway) {
	const cut = command.plan.cut
	const rule = command.plan.capturedRule
	if (!cut || !rule || !command.plan.oldEndsOn) throw new CommandFault('precondition_failed')
	const cancellation = await cancellationStage(access, command)
	if (cancellation) return readCancelledMaster(access, command, gateway, cancellation)
	const actual = await observedResource(access, command, cut.master.event.eventId, gateway)
	if (!matchesMaster(actual, { ...rule, endsOn: command.plan.oldEndsOn })) throw new CommandFault('external_change')
	return { master: actual, cancellationStageId: null, cancelledMaster: null }
}

export async function readOldInactive(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	gateway: GoogleGateway
): Promise<Extract<GoogleStageAcknowledgement, { kind: 'cut_inactive' }>> {
	const cut = command.plan.cut
	if (!cut) throw new CommandFault('precondition_failed')
	await verifyPrimary(access, command, gateway)
	const proof = await inactiveMaster(access, command, gateway)
	const family = await gateway.familyEvents(
		access.accessToken,
		command.calendarId,
		cut.master.event.eventId,
		access.signal
	)
	const tail: GoogleObservedResource[] = []
	const cancelledTail: Extract<GoogleStageAcknowledgement, { kind: 'cut_inactive' }>['cancelledTail'] = []
	for (const member of family) {
		if (scheduleDate(new Date(member.originalStartTime.dateTime), command.plan.capturedTimeZone) < cut.cutoff) continue
		if (await hasCancellationProof(access, command, member.id)) {
			const current = await gateway.cancelledInstance(access.accessToken, command.calendarId, member.id, access.signal)
			if (
				current.id !== member.id ||
				current.recurringEventId !== cut.master.event.eventId ||
				Date.parse(current.originalStartTime.dateTime) !== Date.parse(member.originalStartTime.dateTime)
			)
				throw new CommandFault('external_change')
			cancelledTail.push(current)
			continue
		}
		if (member.status === 'cancelled') continue
		const resource = await observedResource(access, command, member.id, gateway)
		if (resource.event.status !== 'cancelled') throw new CommandFault('external_change')
		tail.push(resource)
	}
	const present = new Set(family.map((item) => item.id))
	return {
		kind: 'cut_inactive',
		checkedAt: new Date().toISOString(),
		...proof,
		cancelledTail,
		family,
		tail,
		absentIds: cut.tail.filter((item) => !present.has(item.event.eventId)).map((item) => item.event.eventId),
		complete: true,
	}
}

async function hasCancellationProof(access: CommandAccess, command: PreparedCalendarCommand, id: string) {
	if (command.plan.cut?.cancelledTail.some((item) => item.current.id === id)) return true
	for (const step of transitionSteps(command).filter((item) => item.purpose === 'tail')) {
		const row = await transitionStage(access, command, step.stage)
		if (
			row?.state === 'acknowledged' &&
			row.acknowledgement?.kind === 'cancellation' &&
			row.acknowledgement.response.id === id
		)
			return true
	}
	return false
}

async function captureCancellations(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	sources: GoogleCutPlan['cancelledTail'],
	gateway: GoogleGateway
) {
	const cancelledTail: GoogleCutPlan['cancelledTail'] = []
	const input = command.plan.input
	if (!('seriesId' in input)) throw new CommandFault('precondition_failed')
	for (const source of sources) {
		const actual = await cancelledTailHistory(access, input.seriesId, source.originalOn, source.current.id, gateway)
		if (
			actual.stageId !== source.stageId ||
			!isDeepStrictEqual(actual.baselineEvent, source.baselineEvent) ||
			actual.unownedWritableFingerprint !== source.unownedWritableFingerprint
		)
			throw new CommandFault('external_change')
		cancelledTail.push(actual)
	}
	return cancelledTail
}

async function readCancelledMaster(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	gateway: GoogleGateway,
	stage: StageRow
) {
	try {
		const current = await gateway.cancelledEvent(
			access.accessToken,
			command.calendarId,
			command.plan.cut!.master.event.eventId,
			access.signal
		)
		if (current.id !== command.plan.cut!.master.event.eventId) throw new CommandFault('external_change')
		return { master: null, cancellationStageId: stage.id, cancelledMaster: current }
	} catch (error) {
		if (!(error instanceof GoogleWriteFault && error.outcome === 'missing')) throw error
		const identity = command.plan.input
		if (
			!('seriesId' in identity) ||
			!(await gateway.identityAbsent(access.accessToken, command.calendarId, identity.seriesId, access.signal))
		)
			throw new CommandFault('external_change')
		return { master: null, cancellationStageId: stage.id, cancelledMaster: null }
	}
}
