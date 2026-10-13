import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

import {
	googleCommands,
	googleCommandStages,
	googleConnections,
	googleStageRequest,
	googleCommandPlan,
	googleStageAcknowledgement,
	type GoogleStageRequest,
	type GoogleStageAcknowledgement,
	type GoogleStageAttempt,
	type DbExecutor,
} from '@dv-lab/db'

import type { CommandAccess } from './dispatch.ts'
import { CalendarFault, GoogleWriteFault } from './gateway.ts'
import { CommandFault, digest, readCommand, retireReservations, type CommandRow, type StageRow } from './journal.ts'

export async function transitionStage(
	access: Pick<CommandAccess, 'db'>,
	command: Pick<CommandRow, 'id' | 'accountId'>,
	stage: number
) {
	const [row] = await access.db
		.select()
		.from(googleCommandStages)
		.where(
			and(
				eq(googleCommandStages.commandId, command.id),
				eq(googleCommandStages.accountId, command.accountId),
				eq(googleCommandStages.stage, stage)
			)
		)
	return row
}

export function cutCompletionIsCurrent(
	stage: Pick<StageRow, 'generation' | 'acknowledgement'>,
	connection: Pick<CommandAccess['connection'], 'generation' | 'credentialGeneration'>
) {
	return (
		stage.generation === connection.generation &&
		stage.acknowledgement?.kind === 'cut_complete' &&
		stage.acknowledgement.credentialGeneration === connection.credentialGeneration
	)
}

export function isTransitionAuthFault(error: unknown): error is CalendarFault & {
	code: 'reconnect_required' | 'permission_required'
} {
	return error instanceof CalendarFault && (error.code === 'reconnect_required' || error.code === 'permission_required')
}

function canRestartAcknowledgement(row: StageRow, connection: CommandAccess['connection']) {
	if (row.kind === 'write') return false
	if (row.generation !== connection.generation) return true
	return row.acknowledgement?.kind === 'cut_complete' && !cutCompletionIsCurrent(row, connection)
}

function checkGrant(
	connection: typeof googleConnections.$inferSelect | undefined,
	command: CommandRow,
	access: CommandAccess
): asserts connection is typeof googleConnections.$inferSelect {
	if (
		!connection ||
		connection.state !== 'connected' ||
		connection.credentialMode !== 'active' ||
		connection.calendarId !== command.calendarId ||
		connection.generation !== access.connection.generation ||
		connection.credentialGeneration !== access.connection.credentialGeneration
	)
		throw new CommandFault('reconnect_required')
}

export async function beginTransitionStage(
	access: CommandAccess,
	command: CommandRow,
	stage: number,
	request: GoogleStageRequest,
	recoveryOf?: StageRow
) {
	return access.db.transaction(async (tx) => {
		const [connection] = await tx
			.select()
			.from(googleConnections)
			.where(eq(googleConnections.id, command.connectionId))
			.for('update')
		const current = await readCommand(tx, command.accountId, command.id)
		checkGrant(connection, current, access)
		access.signal.throwIfAborted()
		const previousStage = await validateAdmission(tx, access, current, command, stage, recoveryOf)
		const write = request.method === 'insert' || request.method === 'patch'
		if (
			write &&
			current.effect !== 'partial' &&
			(current.dispatchDeadline.getTime() <= Date.now() || current.generation !== access.connection.generation)
		)
			throw new CommandFault('not_applied')
		await tx
			.insert(googleCommandStages)
			.values({
				accountId: command.accountId,
				connectionId: command.connectionId,
				commandId: command.id,
				stage,
				previousStage,
				generation: connection.generation,
				kind: write ? 'write' : 'verify',
				request,
			})
			.onConflictDoNothing({ target: [googleCommandStages.commandId, googleCommandStages.stage] })
		const [row] = await tx
			.select()
			.from(googleCommandStages)
			.where(and(eq(googleCommandStages.commandId, command.id), eq(googleCommandStages.stage, stage)))
			.for('update')
		if (!row || !isDeepStrictEqual(googleStageRequest.parse(row.request), googleStageRequest.parse(request)))
			throw new CommandFault('precondition_failed')
		if (row.state === 'acknowledged' && !recoveryOf && !canRestartAcknowledgement(row, connection))
			throw new CommandFault('precondition_failed')
		const attempt: GoogleStageAttempt = {
			attemptId: randomUUID(),
			generation: connection.generation,
			startedAt: new Date().toISOString(),
			finishedAt: null,
			outcome: 'dispatching',
			ifMatch: request.method === 'patch' ? request.ifMatch : null,
			requestDigest: write ? request.digest : digest(JSON.stringify(request)),
			httpStatus: null,
			errorCode: null,
		}
		const [started] = await tx
			.update(googleCommandStages)
			.set({
				state: 'dispatching',
				effect: 'unknown',
				acknowledgement: null,
				acknowledgedAt: null,
				generation: connection.generation,
				attempts: [...row.attempts, attempt],
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommandStages.id, row.id))
			.returning()
		if (!write && current.effect === 'confirmed')
			await tx
				.update(googleCommands)
				.set({
					state: 'partial_recovery',
					effect: 'partial',
					issue: 'provider_unavailable',
					nextAction: 'resume_recovery',
					updatedAt: sql`now()`,
				})
				.where(eq(googleCommands.id, current.id))
		if (write)
			await tx
				.update(googleCommands)
				.set({
					state: 'dispatching',
					effect: current.effect === 'partial' ? 'partial' : 'unknown',
					dispatchedAt: current.dispatchedAt ?? new Date(),
					issue: null,
					nextAction: 'wait',
					updatedAt: sql`now()`,
				})
				.where(eq(googleCommands.id, command.id))
		if (!started) throw new CommandFault('precondition_failed')
		return started
	})
}

export async function acknowledgeTransition(
	access: CommandAccess,
	command: CommandRow,
	stage: StageRow,
	acknowledgement: GoogleStageAcknowledgement,
	httpStatus: number | null
) {
	const ack = googleStageAcknowledgement.parse(acknowledgement)
	await access.db.transaction(async (tx) => {
		const [connection] = await tx
			.select()
			.from(googleConnections)
			.where(eq(googleConnections.id, command.connectionId))
			.for('update')
		checkGrant(connection, command, access)
		const [current] = await tx
			.select()
			.from(googleCommandStages)
			.where(eq(googleCommandStages.id, stage.id))
			.for('update')
		access.signal.throwIfAborted()
		const attempt = current?.attempts.at(-1)
		if (
			!current ||
			current.state !== 'dispatching' ||
			attempt?.attemptId !== stage.attempts.at(-1)?.attemptId ||
			attempt?.generation !== connection.generation
		)
			throw new CommandFault('precondition_failed')
		const attempts = current.attempts.map((value, index) =>
			index === current.attempts.length - 1
				? { ...value, outcome: 'acknowledged' as const, finishedAt: new Date().toISOString(), httpStatus }
				: value
		)
		await tx
			.update(googleCommandStages)
			.set({
				state: 'acknowledged',
				effect: 'confirmed',
				acknowledgement: ack,
				acknowledgedAt: new Date(),
				attempts,
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommandStages.id, stage.id))
		if (ack.kind === 'cut_complete')
			await tx
				.update(googleCommands)
				.set({
					state: 'projection_pending',
					effect: 'confirmed',
					acknowledgedAt: new Date(),
					issue: null,
					nextAction: 'wait',
					updatedAt: sql`now()`,
				})
				.where(eq(googleCommands.id, command.id))
		if (stage.kind === 'write') {
			const running = (await readCommand(tx, command.accountId, command.id)).dispatchDeadline.getTime() > Date.now()
			await tx
				.update(googleCommands)
				.set({
					state: running ? 'dispatching' : 'partial_recovery',
					effect: 'partial',
					acknowledgedAt: new Date(),
					issue: running ? null : 'provider_unavailable',
					nextAction: running ? 'wait' : 'resume_recovery',
					updatedAt: sql`now()`,
				})
				.where(eq(googleCommands.id, command.id))
		}
	})
}

export async function pauseTransition(
	access: CommandAccess,
	command: CommandRow,
	stage: StageRow | undefined,
	error: unknown
) {
	await access.db.transaction(async (tx) => {
		const current = await readCommand(tx, command.accountId, command.id)
		if (current.state === 'applied' || current.state === 'failed' || current.state === 'projection_pending') return
		if (stage) {
			const [latest] = await tx
				.select()
				.from(googleCommandStages)
				.where(eq(googleCommandStages.id, stage.id))
				.for('update')
			const rejected = error instanceof GoogleWriteFault && (error.outcome === 'rejected' || error.httpStatus === 412)
			if (latest?.state === 'dispatching')
				await tx
					.update(googleCommandStages)
					.set({
						state: rejected ? 'failed' : 'outcome_unknown',
						effect: rejected ? 'none' : 'unknown',
						attempts: latest.attempts.map((attempt, index) =>
							index === latest.attempts.length - 1
								? {
										...attempt,
										outcome: rejected ? ('rejected' as const) : ('unknown' as const),
										finishedAt: new Date().toISOString(),
										httpStatus: error instanceof GoogleWriteFault ? error.httpStatus : null,
										errorCode: 'transport' as const,
									}
								: attempt
						),
						updatedAt: sql`now()`,
					})
					.where(eq(googleCommandStages.id, latest.id))
		}
		if (await failDefinitiveTransition(tx, current, error)) return
		const issue =
			error instanceof CommandFault && error.code === 'external_change'
				? 'external_change'
				: isTransitionAuthFault(error) || (error instanceof CommandFault && error.code === 'reconnect_required')
					? error.code
					: 'provider_unavailable'
		await tx
			.update(googleCommands)
			.set({
				state: current.effect === 'partial' ? 'partial_recovery' : 'recovery_required',
				issue,
				nextAction: 'resume_recovery',
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommands.id, command.id))
	})
}

export async function acknowledgeRecoveredWrite(
	access: CommandAccess,
	command: CommandRow,
	write: StageRow,
	verification: StageRow,
	acknowledgement: GoogleStageAcknowledgement
) {
	await access.db.transaction(async (tx) => {
		const [connection] = await tx
			.select()
			.from(googleConnections)
			.where(eq(googleConnections.id, command.connectionId))
			.for('update')
		checkGrant(connection, command, access)
		const [read] = await tx
			.select()
			.from(googleCommandStages)
			.where(eq(googleCommandStages.id, verification.id))
			.for('update')
		const [current] = await tx
			.select()
			.from(googleCommandStages)
			.where(eq(googleCommandStages.id, write.id))
			.for('update')
		access.signal.throwIfAborted()
		if (
			!read ||
			read.state !== 'acknowledged' ||
			read.generation !== connection.generation ||
			read.previousStage !== write.stage ||
			!current ||
			current.state === 'acknowledged'
		)
			throw new CommandFault('precondition_failed')
		await tx
			.update(googleCommandStages)
			.set({
				state: 'acknowledged',
				effect: 'confirmed',
				acknowledgement: googleStageAcknowledgement.parse(acknowledgement),
				generation: connection.generation,
				acknowledgedAt: new Date(),
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommandStages.id, write.id))
		await tx
			.update(googleCommands)
			.set({
				state: 'partial_recovery',
				effect: 'partial',
				acknowledgedAt: new Date(),
				issue: 'provider_unavailable',
				nextAction: 'resume_recovery',
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommands.id, command.id))
	})
}

async function validateAdmission(
	tx: DbExecutor,
	access: CommandAccess,
	current: CommandRow,
	command: CommandRow,
	stage: number,
	recoveryOf?: StageRow
) {
	if (current.state === 'applied' || current.state === 'failed') throw new CommandFault('precondition_failed')
	if (
		current.inputHash !== command.inputHash ||
		!isDeepStrictEqual(googleCommandPlan.parse(current.plan), googleCommandPlan.parse(command.plan))
	)
		throw new CommandFault('precondition_failed')
	const previousStage = recoveryOf ? recoveryOf.stage : stage === 1 ? 0 : stage > 1 ? stage - 3 : null
	if (previousStage !== null) {
		const [previous] = await tx
			.select()
			.from(googleCommandStages)
			.where(and(eq(googleCommandStages.commandId, command.id), eq(googleCommandStages.stage, previousStage)))
			.for('update')
		if (!previous || (recoveryOf ? previous.id !== recoveryOf.id : previous.state !== 'acknowledged'))
			throw new CommandFault('command_pending')
	}
	if (
		current.effect === 'none' &&
		(current.dispatchDeadline.getTime() <= Date.now() || current.generation !== access.connection.generation)
	)
		throw new CommandFault('not_applied')
	return previousStage
}

async function failDefinitiveTransition(tx: DbExecutor, current: CommandRow, error: unknown) {
	const rejected = error instanceof GoogleWriteFault && (error.outcome === 'rejected' || error.httpStatus === 412)
	if (current.dispatchedAt && !rejected) return false
	const confirmed = await tx
		.select({ id: googleCommandStages.id })
		.from(googleCommandStages)
		.where(
			and(
				eq(googleCommandStages.commandId, current.id),
				eq(googleCommandStages.kind, 'write'),
				eq(googleCommandStages.state, 'acknowledged')
			)
		)
	if (confirmed.length) return false
	await tx
		.update(googleCommands)
		.set({
			state: 'failed',
			effect: 'none',
			issue: 'not_applied',
			nextAction: 'retry_new_command',
			updatedAt: sql`now()`,
		})
		.where(eq(googleCommands.id, current.id))
	await retireReservations(tx, current.id)
	return true
}
