import { and, eq, sql } from 'drizzle-orm'
import { randomInt, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

import {
	googleCommands,
	googleCommandStages,
	googleStageAcknowledgement,
	type Database,
	type GoogleStageAcknowledgement,
	type GoogleStageAttempt,
} from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import type { VerifiedGoogleResponse } from './command-result.ts'
import { acknowledgeCommand, preservesUnowned, projectCommand, type CommandAccess } from './dispatch.ts'
import { CalendarFault, GoogleWriteFault, type GoogleGateway } from './gateway.ts'
import {
	CommandFault,
	digest,
	preparedCommand,
	readCommand,
	retireReservations,
	type CommandRow,
	type StageRow,
} from './journal.ts'

const RECONCILE_BUDGET_MS = 30000
const MAX_READ_ATTEMPTS = 3

export async function requireRecovery(
	db: Database,
	command: CommandRow,
	issue: 'provider_unavailable' | 'external_change' | 'reconnect_required'
) {
	if (command.state === 'applied' || command.state === 'failed') return
	await db
		.update(googleCommands)
		.set({ state: 'recovery_required', issue, nextAction: 'resume_recovery', updatedAt: sql`now()` })
		.where(and(eq(googleCommands.id, command.id), eq(googleCommands.state, command.state)))
}

export function recoveryExpired(command: CommandRow) {
	const since = command.state === 'projection_pending' ? command.acknowledgedAt : command.dispatchedAt
	return since !== null && Date.now() - since.getTime() >= RECONCILE_BUDGET_MS
}

async function beginRead(access: CommandAccess, command: PreparedCalendarCommand): Promise<StageRow> {
	return access.db.transaction(async (tx) => {
		const request = { method: 'get' as const, eventId: command.request.eventId }
		await tx
			.insert(googleCommandStages)
			.values({
				accountId: command.accountId,
				connectionId: command.connectionId,
				commandId: command.id,
				stage: command.request.payload.markers.stage + 1,
				previousStage: command.request.payload.markers.stage,
				generation: access.connection.generation,
				kind: 'verify',
				request,
			})
			.onConflictDoNothing({ target: [googleCommandStages.commandId, googleCommandStages.stage] })
		const [stage] = await tx
			.select()
			.from(googleCommandStages)
			.where(
				and(
					eq(googleCommandStages.commandId, command.id),
					eq(googleCommandStages.stage, command.request.payload.markers.stage + 1)
				)
			)
			.for('update')
		if (!stage) throw new CommandFault('precondition_failed')
		const attempt: GoogleStageAttempt = {
			attemptId: randomUUID(),
			generation: access.connection.generation,
			startedAt: new Date().toISOString(),
			finishedAt: null,
			outcome: 'dispatching',
			ifMatch: null,
			requestDigest: digest(JSON.stringify(request)),
			httpStatus: null,
			errorCode: null,
		}
		const [updated] = await tx
			.update(googleCommandStages)
			.set({
				state: 'dispatching',
				effect: 'unknown',
				generation: access.connection.generation,
				attempts: [...stage.attempts, attempt],
				acknowledgement: null,
				acknowledgedAt: null,
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommandStages.id, stage.id))
			.returning()
		if (!updated) throw new CommandFault('precondition_failed')
		return updated
	})
}

async function finishRead(
	access: CommandAccess,
	stage: StageRow,
	acknowledgement: GoogleStageAcknowledgement | null,
	status: number | null
) {
	access.signal.throwIfAborted()
	await access.db
		.update(googleCommandStages)
		.set({
			state: acknowledgement ? 'acknowledged' : 'outcome_unknown',
			effect: acknowledgement ? 'confirmed' : 'unknown',
			acknowledgement,
			acknowledgedAt: acknowledgement ? sql`now()` : null,
			attempts: stage.attempts.map((attempt, index) =>
				index === stage.attempts.length - 1
					? {
							...attempt,
							finishedAt: new Date().toISOString(),
							outcome: acknowledgement ? ('acknowledged' as const) : ('unknown' as const),
							httpStatus: status,
						}
					: attempt
			),
			updatedAt: sql`now()`,
		})
		.where(eq(googleCommandStages.id, stage.id))
}

async function observeAbsence(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	stage: StageRow,
	gateway: GoogleGateway
) {
	const primary = await gateway.primary(access.accessToken, access.signal)
	if (primary.id !== command.calendarId) throw new CalendarFault('external_change')
	const absent = await gateway.identityAbsent(
		access.accessToken,
		command.calendarId,
		command.request.payload.markers.localEntityId,
		access.signal
	)
	if (!absent) throw new CalendarFault('external_change')
	const acknowledgement = googleStageAcknowledgement.parse({
		kind: 'absence',
		eventId: command.request.eventId,
		checkedAt: new Date().toISOString(),
		calendarAccessConfirmed: true,
		identitySearchComplete: true,
	})
	await finishRead(access, stage, acknowledgement, 404)
	const current = await readCommand(access.db, command.accountId, command.id)
	if (await rejectObservedPrecondition(access, current)) return
	if (recoveryExpired(current)) return failObserved(access, current, 'not_applied')
	await requireRecovery(access.db, current, 'provider_unavailable')
}

async function unappliedPatch(access: CommandAccess, command: PreparedCalendarCommand, gateway: GoogleGateway) {
	if (command.request.method !== 'patch') return false
	try {
		const observed = await gateway.observeEvent(
			access.accessToken,
			command.calendarId,
			command.request.eventId,
			command.plan.capturedTimeZone,
			access.signal
		)
		return observed.event.etag === command.request.ifMatch
	} catch {
		return false
	}
}

export async function reconcileCommand(
	access: CommandAccess,
	command: CommandRow,
	gateway: GoogleGateway,
	explicit = false
) {
	const { prepared } = await preparedCommand(access.db, command)
	if (!command.dispatchedAt || access.connection.calendarId !== command.calendarId)
		throw new CommandFault('precondition_failed')
	await abandonedDispatch(access.db, command)
	command = await readCommand(access.db, command.accountId, command.id)
	const [previous] = await access.db
		.select()
		.from(googleCommandStages)
		.where(
			and(
				eq(googleCommandStages.commandId, command.id),
				eq(googleCommandStages.stage, prepared.request.payload.markers.stage + 1)
			)
		)
	if (!explicit && (recoveryExpired(command) || (previous?.attempts.length ?? 0) >= MAX_READ_ATTEMPTS))
		return requireRecovery(access.db, command, 'provider_unavailable')
	const lastAttempt = previous?.attempts.at(-1)
	if (
		!explicit &&
		lastAttempt &&
		Date.now() - Date.parse(lastAttempt.startedAt) <
			Math.min(10000, 5000 * 2 ** (previous.attempts.length - 1) + randomInt(0, 1001))
	)
		return
	const stage = await beginRead(access, prepared)
	let result: VerifiedGoogleResponse
	try {
		result = await gateway.confirmedEvent(
			access.accessToken,
			command.calendarId,
			prepared.request,
			prepared.plan.capturedTimeZone,
			access.connection.generation,
			access.signal
		)
	} catch (error) {
		return handleReadFailure(access, command, stage, gateway, error, explicit)
	}
	await finishRead(access, stage, result.acknowledgement, result.httpStatus)
	if (!preservesUnowned(prepared, result)) return requireRecovery(access.db, command, 'external_change')
	await acknowledgeCommand(access, prepared, result, 'get')
	const confirmed = await readCommand(access.db, command.accountId, command.id)
	if (confirmed.state === 'projection_pending') await projectCommand(access, confirmed)
}

async function handleReadFailure(
	access: CommandAccess,
	command: CommandRow,
	stage: StageRow,
	gateway: GoogleGateway,
	error: unknown,
	explicit: boolean
) {
	if (error instanceof GoogleWriteFault && error.outcome === 'missing' && command.effect === 'unknown') {
		const { prepared } = await preparedCommand(access.db, command)
		try {
			return await observeAbsence(access, prepared, stage, gateway)
		} catch (absenceError) {
			error = absenceError
		}
	} else if (error instanceof GoogleWriteFault && error.outcome === 'missing') {
		error = new CalendarFault('external_change')
	}
	await finishRead(access, stage, null, error instanceof GoogleWriteFault ? error.httpStatus : null)
	const current = await readCommand(access.db, command.accountId, command.id)
	const external = error instanceof CalendarFault && error.code === 'external_change'
	if (external && (await rejectObservedPrecondition(access, current))) return
	if (external && recoveryExpired(current)) {
		const { prepared } = await preparedCommand(access.db, current)
		if (await unappliedPatch(access, prepared, gateway)) return failObserved(access, current, 'not_applied')
	}
	if (error instanceof GoogleWriteFault && error.rateLimited) return rateLimitedRead(access, current, error, explicit)
	if (explicit || stage.attempts.length >= MAX_READ_ATTEMPTS || external)
		await requireRecovery(access.db, current, external ? 'external_change' : 'provider_unavailable')
	if (error instanceof CalendarFault) throw error
}

async function rateLimitedRead(access: CommandAccess, command: CommandRow, error: GoogleWriteFault, explicit: boolean) {
	await requireRecovery(access.db, command, 'provider_unavailable')
	const remaining = RECONCILE_BUDGET_MS - (Date.now() - (command.dispatchedAt?.getTime() ?? 0))
	if (error.retryAfterMs === null || error.retryAfterMs > remaining) return
	await delay(error.retryAfterMs, undefined, { signal: access.signal })
	if (explicit || recoveryExpired(command)) return
	await access.db
		.update(googleCommands)
		.set({ state: command.state, issue: 'provider_unavailable', nextAction: 'wait', updatedAt: sql`now()` })
		.where(and(eq(googleCommands.id, command.id), eq(googleCommands.state, 'recovery_required')))
}

async function abandonedDispatch(db: Database, command: CommandRow) {
	if (command.state !== 'dispatching') return
	await db.transaction(async (tx) => {
		const { stage } = await preparedCommand(tx, command)
		await tx
			.update(googleCommandStages)
			.set({
				state: 'outcome_unknown',
				effect: 'unknown',
				updatedAt: sql`now()`,
				attempts: stage.attempts.map((attempt) =>
					attempt.outcome === 'dispatching'
						? {
								...attempt,
								outcome: 'unknown' as const,
								finishedAt: new Date().toISOString(),
								errorCode: 'transport' as const,
							}
						: attempt
				),
			})
			.where(and(eq(googleCommandStages.id, stage.id), eq(googleCommandStages.state, 'dispatching')))
		await tx
			.update(googleCommands)
			.set({ state: 'outcome_unknown', effect: 'unknown', updatedAt: sql`now()` })
			.where(and(eq(googleCommands.id, command.id), eq(googleCommands.state, 'dispatching')))
	})
}

async function rejectObservedPrecondition(access: CommandAccess, command: CommandRow) {
	const { stage } = await preparedCommand(access.db, command)
	if (
		!stage.attempts.length ||
		stage.attempts.some((attempt) => attempt.outcome !== 'rejected') ||
		!stage.attempts.some((attempt) => attempt.httpStatus === 409 || attempt.httpStatus === 412)
	)
		return false
	await failObserved(access, command, 'external_change')
	return true
}

async function failObserved(access: CommandAccess, command: CommandRow, issue: 'external_change' | 'not_applied') {
	await access.db.transaction(async (tx) => {
		const current = await readCommand(tx, command.accountId, command.id)
		if (current.state !== command.state || current.effect !== 'unknown') throw new CommandFault('precondition_failed')
		const { stage } = await preparedCommand(tx, current)
		await tx
			.update(googleCommandStages)
			.set({ state: 'failed', effect: 'none', updatedAt: sql`now()` })
			.where(eq(googleCommandStages.id, stage.id))
		await tx
			.update(googleCommands)
			.set({
				state: 'failed',
				effect: 'none',
				issue,
				nextAction: 'retry_new_command',
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommands.id, command.id))
		await retireReservations(tx, command.id)
	})
}
