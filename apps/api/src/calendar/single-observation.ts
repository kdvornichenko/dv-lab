import { and, desc, eq, sql } from 'drizzle-orm'

import {
	googleCommands,
	googleCommandStages,
	googleConnections,
	googleStageAcknowledgement,
	type DbExecutor,
	type GoogleStageAcknowledgement,
} from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import { singleTarget, type SingleCommand, type SingleObservation } from '../schedule/single-command.ts'
import { cancellationAcknowledgement } from './command-result.ts'
import type { CommandAccess } from './dispatch.ts'
import { replacementCommand, reserveReplacement } from './event-mapping.ts'
import { CalendarFault, GoogleWriteFault, type GoogleGateway } from './gateway.ts'
import { CommandFault, failUnsentCommand, preparedCommand, readCommand, type CommandRow } from './journal.ts'

type EventAck = Extract<GoogleStageAcknowledgement, { kind: 'event' | 'cancellation' }>
export type AbsenceProof = Extract<GoogleStageAcknowledgement, { kind: 'absence' }>
export type SingleEvidence =
	| { kind: 'present'; observation: SingleObservation }
	| { kind: 'absent'; proof: AbsenceProof; cancellation: EventAck }
	| { kind: 'unresolved'; cancellation: EventAck }

async function confirmedCancellation(
	executor: DbExecutor,
	accountId: string,
	localEntityId: string,
	eventId: string
): Promise<EventAck> {
	const commands = await executor
		.select()
		.from(googleCommands)
		.where(and(eq(googleCommands.accountId, accountId), eq(googleCommands.state, 'applied')))
		.orderBy(desc(googleCommands.appliedAt))
	const latest = commands.find((command) =>
		command.plan.affectedRefs.some((ref) => ref.kind === 'single' && ref.lessonId === localEntityId)
	)
	if (!latest || latest.operation !== 'cancel') throw new CommandFault('external_change')
	const stages = await executor.select().from(googleCommandStages).where(eq(googleCommandStages.commandId, latest.id))
	const write = stages.find((stage) => stage.kind === 'write' && stage.state === 'acknowledged')
	const ack = cancellationAcknowledgement(write?.acknowledgement, eventId)
	if (!ack) throw new CommandFault('external_change')
	if (
		stages.some((stage) =>
			stage.attempts.some((attempt) => attempt.outcome === 'unknown' || attempt.outcome === 'dispatching')
		)
	)
		throw new CommandFault('command_pending')
	return ack
}

export async function observeSingle(
	access: CommandAccess,
	input: SingleCommand,
	gateway: GoogleGateway
): Promise<SingleEvidence> {
	const target = await singleTarget(access.db, access.connection.accountId, input)
	if (
		target.event.snapshotRevision !== access.connection.snapshotRevision ||
		target.event.generation !== access.connection.generation
	)
		throw new CommandFault('precondition_failed')
	return readSingleEvidence(
		access,
		{
			calendarId: target.mapping.calendarId,
			eventId: target.mapping.eventId,
			localEntityId: target.mapping.localEntityId,
			timeZone: target.window.displayTimeZone,
		},
		input.operation === 'restore',
		gateway
	)
}

async function readSingleEvidence(
	access: CommandAccess,
	identity: { calendarId: string; eventId: string; localEntityId: string; timeZone: string },
	restore: boolean,
	gateway: GoogleGateway
): Promise<SingleEvidence> {
	const primary = await gateway.primary(access.accessToken, access.signal)
	if (primary.id !== identity.calendarId) throw new CommandFault('external_change')
	try {
		return {
			kind: 'present',
			observation: await gateway.observeEvent(
				access.accessToken,
				primary.id,
				identity.eventId,
				identity.timeZone,
				access.signal
			),
		}
	} catch (error) {
		if (!(error instanceof GoogleWriteFault && error.outcome === 'missing') || !restore) throw error
	}
	const cancellation = await confirmedCancellation(
		access.db,
		access.connection.accountId,
		identity.localEntityId,
		identity.eventId
	)
	try {
		const accessible = await gateway.primary(access.accessToken, access.signal)
		if (accessible.id !== identity.calendarId) throw new CommandFault('external_change')
		if (
			!(await gateway.identityAbsent(
				access.accessToken,
				accessible.id,
				identity.localEntityId,
				access.signal,
				identity.eventId
			))
		)
			return { kind: 'unresolved', cancellation }
		const proof = googleStageAcknowledgement.parse({
			kind: 'absence',
			eventId: identity.eventId,
			checkedAt: new Date().toISOString(),
			calendarAccessConfirmed: true,
			identitySearchComplete: true,
		})
		if (proof.kind !== 'absence') throw new CommandFault('precondition_failed')
		return { kind: 'absent', proof, cancellation }
	} catch (error) {
		if (error instanceof CalendarFault && (error.code === 'permission_required' || error.code === 'reconnect_required'))
			throw error
		return { kind: 'unresolved', cancellation }
	}
}

export async function checkReplacement(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	gateway: GoogleGateway
) {
	const eventId = command.plan.preconditions[0]?.eventId
	if (!eventId) throw new CommandFault('precondition_failed')
	const evidence = await readSingleEvidence(
		access,
		{
			calendarId: command.calendarId,
			eventId,
			localEntityId: command.request.payload.markers.localEntityId,
			timeZone: command.plan.capturedTimeZone,
		},
		true,
		gateway
	)
	if (evidence.kind !== 'absent') throw new CommandFault('external_change')
}

export async function resumeUnsentRestore(access: CommandAccess, command: CommandRow, gateway: GoogleGateway) {
	if (command.dispatchDeadline <= new Date() || access.connection.generation !== command.generation) {
		await failUnsentCommand(access.db, command.id)
		return readCommand(access.db, command.accountId, command.id)
	}
	const { prepared, stage } = await preparedCommand(access.db, command)
	if (prepared.operation !== 'restore' || stage.attempts.length || prepared.request.method !== 'patch')
		throw new CommandFault('precondition_failed')
	const evidence = await readSingleEvidence(
		access,
		{
			calendarId: command.calendarId,
			eventId: prepared.request.eventId,
			localEntityId: prepared.request.payload.markers.localEntityId,
			timeZone: prepared.plan.capturedTimeZone,
		},
		true,
		gateway
	)
	if (evidence.kind === 'unresolved') return command
	if (evidence.kind === 'absent' && !prepared.plan.preconditions[0]?.unownedWritable) return command
	if (
		evidence.kind === 'present' &&
		(evidence.observation.event.etag !== prepared.request.ifMatch ||
			evidence.observation.unownedWritableFingerprint !== prepared.plan.preconditions[0]?.unownedWritableFingerprint)
	)
		return command
	await access.db.transaction(async (tx) => {
		const [connection] = await tx
			.select()
			.from(googleConnections)
			.where(eq(googleConnections.id, command.connectionId))
			.for('update')
		const current = await readCommand(tx, command.accountId, command.id)
		access.signal.throwIfAborted()
		if (
			current.state !== 'recovery_required' ||
			current.dispatchedAt ||
			current.dispatchDeadline <= new Date() ||
			connection?.generation !== command.generation ||
			connection.state !== 'connected'
		)
			throw new CommandFault('not_applied')
		if (evidence.kind === 'absent')
			await persistResumedReplacement(tx, await replacementCommand(tx, prepared, evidence.proof, 2), stage.id)
		await tx
			.update(googleCommands)
			.set({ state: 'pending', issue: null, nextAction: 'wait', updatedAt: sql`now()` })
			.where(eq(googleCommands.id, command.id))
	})
	return readCommand(access.db, command.accountId, command.id)
}

async function persistResumedReplacement(tx: DbExecutor, prepared: PreparedCalendarCommand, oldStageId: string) {
	const proof = prepared.absenceProof
	if (!proof) throw new CommandFault('precondition_failed')
	await reserveReplacement(tx, prepared)
	await tx.update(googleCommands).set({ plan: prepared.plan }).where(eq(googleCommands.id, prepared.id))
	await tx
		.update(googleCommandStages)
		.set({ state: 'failed', effect: 'none', updatedAt: sql`now()` })
		.where(eq(googleCommandStages.id, oldStageId))
	await tx.insert(googleCommandStages).values([
		{
			accountId: prepared.accountId,
			connectionId: prepared.connectionId,
			commandId: prepared.id,
			stage: 1,
			previousStage: 0,
			generation: prepared.generation,
			kind: 'verify',
			request: { method: 'get', eventId: proof.eventId },
			acknowledgement: proof,
			state: 'acknowledged',
			effect: 'confirmed',
			acknowledgedAt: new Date(proof.checkedAt),
		},
		{
			accountId: prepared.accountId,
			connectionId: prepared.connectionId,
			commandId: prepared.id,
			stage: 2,
			previousStage: 1,
			generation: prepared.generation,
			kind: 'write',
			request: prepared.request,
		},
	])
}
