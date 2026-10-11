import { and, eq, sql } from 'drizzle-orm'

import {
	googleCommands,
	googleCommandStages,
	googleConnections,
	googleCommandPlan,
	googleStageRequest,
	type GoogleStageRequest,
} from '@dv-lab/db'

import type { CommandAccess } from './dispatch.ts'
import type { GoogleGateway } from './gateway.ts'
import { CommandFault, failUnsentCommand, preparedCommand, readCommand, type CommandRow } from './journal.ts'
import { matchesMaster } from './recurring.ts'

export async function resumeUnsentInstance(access: CommandAccess, command: CommandRow, gateway: GoogleGateway) {
	if (command.dispatchDeadline.getTime() <= Date.now() || command.generation !== access.connection.generation) {
		await failUnsentCommand(access.db, command.id)
		return readCommand(access.db, command.accountId, command.id)
	}
	const { prepared, stage } = await preparedCommand(access.db, command)
	const request = prepared.request
	if (request.method !== 'patch' || !request.instance || request.instance.lookupVerified)
		throw new CommandFault('precondition_failed')
	const identity = request.instance
	if (!('dateTime' in identity.originalStartTime) || !prepared.plan.capturedRule)
		throw new CommandFault('precondition_failed')
	const primary = await gateway.primary(access.accessToken, access.signal)
	if (primary.id !== command.calendarId) throw new CommandFault('external_change')
	const master = await gateway.master(
		access.accessToken,
		command.calendarId,
		identity.masterEventId,
		prepared.plan.capturedTimeZone,
		access.signal
	)
	if (!matchesMaster(master, prepared.plan.capturedRule)) throw new CommandFault('external_change')
	const canonical = await gateway.canonicalInstance(
		access.accessToken,
		command.calendarId,
		identity.masterEventId,
		identity.originalStartTime.dateTime,
		access.signal
	)
	if (canonical.kind !== 'found' || canonical.eventId !== request.eventId) return command
	const observed = await gateway.observeEvent(
		access.accessToken,
		command.calendarId,
		request.eventId,
		prepared.plan.capturedTimeZone,
		access.signal
	)
	if (
		observed.event.etag !== request.ifMatch ||
		observed.event.recurringEventId !== identity.masterEventId ||
		!observed.event.originalStartTime ||
		!('dateTime' in observed.event.originalStartTime) ||
		Date.parse(observed.event.originalStartTime.dateTime) !== Date.parse(identity.originalStartTime.dateTime)
	)
		throw new CommandFault('external_change')
	const verified = googleStageRequest.parse({
		...request,
		instance: { ...identity, lookupVerified: true },
		...(request.payload.status === 'cancelled'
			? {
					cancellationBaseline: {
						baselineEvent: observed.event,
						unownedWritableFingerprint: observed.unownedWritableFingerprint,
						unownedWritable: observed.unownedWritable,
					},
				}
			: {}),
		payload: { ...request.payload, markers: { ...request.payload.markers, stage: stage.stage + 2 } },
	})
	await saveInstancePreparation(
		access,
		command,
		stage.stage,
		verified,
		observed.unownedWritableFingerprint,
		observed.unownedWritable
	)
	return readCommand(access.db, command.accountId, command.id)
}

async function saveInstancePreparation(
	access: CommandAccess,
	command: CommandRow,
	previousStage: number,
	request: GoogleStageRequest,
	fingerprint: string,
	writable: CommandRow['plan']['preconditions'][number]['unownedWritable']
) {
	if (request.method !== 'patch' || !request.instance) throw new CommandFault('precondition_failed')
	const identity = request.instance
	await access.db.transaction(async (tx) => {
		const [connection] = await tx
			.select()
			.from(googleConnections)
			.where(eq(googleConnections.id, command.connectionId))
			.for('update')
		const [current] = await tx.select().from(googleCommands).where(eq(googleCommands.id, command.id)).for('update')
		access.signal.throwIfAborted()
		if (
			!connection ||
			connection.state !== 'connected' ||
			connection.generation !== command.generation ||
			connection.credentialGeneration !== access.connection.credentialGeneration ||
			connection.calendarId !== command.calendarId ||
			current?.state !== 'recovery_required' ||
			current.dispatchedAt ||
			current.dispatchDeadline.getTime() <= Date.now()
		)
			throw new CommandFault('not_applied')
		await tx
			.update(googleCommandStages)
			.set({ state: 'failed', effect: 'none', updatedAt: sql`now()` })
			.where(
				and(
					eq(googleCommandStages.commandId, command.id),
					eq(googleCommandStages.stage, previousStage),
					eq(googleCommandStages.state, 'pending')
				)
			)
		const common = {
			accountId: command.accountId,
			connectionId: command.connectionId,
			commandId: command.id,
			generation: command.generation,
		}
		await tx.insert(googleCommandStages).values({
			...common,
			stage: previousStage + 1,
			previousStage,
			kind: 'verify',
			request: {
				method: 'instances',
				eventId: identity.masterEventId,
				originalStartTime: identity.originalStartTime,
			},
			state: 'acknowledged',
			effect: 'confirmed',
			acknowledgement: {
				kind: 'instance_lookup',
				checkedAt: new Date().toISOString(),
				complete: true,
				masterEventId: identity.masterEventId,
				originalStartTime: identity.originalStartTime,
				eventIds: [request.eventId],
			},
			acknowledgedAt: new Date(),
		})
		await tx
			.insert(googleCommandStages)
			.values({ ...common, stage: previousStage + 2, previousStage: previousStage + 1, kind: 'write', request })
		await tx
			.update(googleCommands)
			.set({
				state: 'pending',
				issue: null,
				nextAction: 'none',
				plan: googleCommandPlan.parse({
					...current.plan,
					preconditions: current.plan.preconditions.map((item) => ({
						...item,
						unownedWritableFingerprint: fingerprint,
						unownedWritable: writable,
					})),
				}),
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommands.id, command.id))
	})
}
