import type { GoogleStageRequest, GoogleObservedResource } from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import type { CommandAccess } from './dispatch.ts'
import { CalendarFault, GoogleWriteFault, type GoogleGateway } from './gateway.ts'
import { CommandFault, type CommandRow, type StageRow } from './journal.ts'
import { acknowledgeRecoveredWrite, acknowledgeTransition, beginTransitionStage } from './transition-journal.ts'
import { observedResource, sameResource, verifyPrimary } from './transition-proof.ts'

type Write = Extract<GoogleStageRequest, { method: 'insert' | 'patch' }>

export async function transitionObservation(
	access: CommandAccess,
	command: CommandRow,
	prepared: PreparedCalendarCommand,
	stage: number,
	eventId: string,
	previous: StageRow,
	gateway: GoogleGateway
) {
	const row = await beginTransitionStage(access, command, stage, { method: 'get', eventId }, previous)
	const resource = await observedResource(access, prepared, eventId, gateway)
	await acknowledgeTransition(
		access,
		command,
		row,
		{ kind: 'cut_observation', resource, checkedAt: new Date().toISOString() },
		200
	)
	return resource
}

async function reconcileWrite(
	access: CommandAccess,
	command: CommandRow,
	prepared: PreparedCalendarCommand,
	row: StageRow,
	request: Write,
	gateway: GoogleGateway
) {
	const verification = await beginTransitionStage(
		access,
		command,
		row.stage + 1,
		{ method: 'get', eventId: request.eventId },
		row
	)
	try {
		const result = await gateway.confirmedEvent(
			access.accessToken,
			command.calendarId,
			request,
			prepared.plan.capturedTimeZone,
			access.connection.generation,
			access.signal
		)
		if (result.recoveryIssue) throw new CommandFault(result.recoveryIssue)
		await acknowledgeTransition(access, command, verification, result.acknowledgement, result.httpStatus)
		await acknowledgeRecoveredWrite(access, command, row, verification, result.acknowledgement)
		return true
	} catch (error) {
		if (!(error instanceof CalendarFault || error instanceof GoogleWriteFault)) throw error
		if (request.method === 'insert' && error instanceof GoogleWriteFault && error.outcome === 'missing') {
			await verifyPrimary(access, prepared, gateway)
			if (
				!(await gateway.identityAbsent(
					access.accessToken,
					command.calendarId,
					request.payload.markers.localEntityId,
					access.signal,
					request.eventId
				))
			)
				throw new CommandFault('external_change')
			await acknowledgeTransition(
				access,
				command,
				verification,
				{
					kind: 'absence',
					eventId: request.eventId,
					checkedAt: new Date().toISOString(),
					calendarAccessConfirmed: true,
					identitySearchComplete: true,
				},
				null
			)
			return false
		}
		if (request.method !== 'patch') throw error
		const current = await observedResource(access, prepared, request.eventId, gateway)
		const baseline =
			prepared.plan.cut?.tail.find((item) => item.event.eventId === request.eventId) ?? prepared.plan.cut?.master
		if (!baseline || current.event.etag !== request.ifMatch || !sameResource(current, baseline))
			throw new CommandFault('external_change')
		await acknowledgeTransition(
			access,
			command,
			verification,
			{ kind: 'cut_observation', resource: current, checkedAt: new Date().toISOString() },
			200
		)
		return false
	}
}

export async function sendTransitionWrite(
	access: CommandAccess,
	command: CommandRow,
	prepared: PreparedCalendarCommand,
	ordinal: number,
	request: Write,
	previous: StageRow | undefined,
	gateway: GoogleGateway,
	source?: GoogleObservedResource
) {
	if (previous?.attempts.length && previous.state !== 'acknowledged') {
		if (await reconcileWrite(access, command, prepared, previous, request, gateway)) return
	}
	const stage = await beginTransitionStage(access, command, ordinal, request)
	const result =
		request.method === 'insert'
			? await gateway.insert(
					access.accessToken,
					command.calendarId,
					request,
					prepared.plan.capturedTimeZone,
					access.connection.generation,
					access.signal
				)
			: await gateway.patch(
					access.accessToken,
					command.calendarId,
					request,
					prepared.plan.capturedTimeZone,
					access.connection.generation,
					source?.privateProperties ?? prepared.plan.cut!.master.privateProperties,
					access.signal
				)
	await acknowledgeTransition(access, command, stage, result.acknowledgement, result.httpStatus)
	if (result.recoveryIssue) throw new CommandFault(result.recoveryIssue)
}
