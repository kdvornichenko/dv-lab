import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { canChange } from '@dv-lab/core'
import {
	googleCommands,
	googleCommandStages,
	googleConnections,
	type Database,
	type GoogleStageAttempt,
} from '@dv-lab/db'

import { applyConfirmedCommand } from '../schedule/command-apply.ts'
import { commandWindow, type PreparedCalendarCommand } from '../schedule/command-plan.ts'
import { storedGoogleResult, type VerifiedGoogleResponse } from './command-result.ts'
import type { ConnectionRow } from './credentials.ts'
import { CalendarFault, GoogleWriteFault, type GoogleGateway } from './gateway.ts'
import {
	CommandFault,
	failUnsentCommand,
	preparedCommand,
	readCommand,
	retireReservations,
	type CommandRow,
	type StageRow,
} from './journal.ts'
import { traverseEvents } from './read-pages.ts'
import { checkReplacement } from './single-observation.ts'

export type CommandAccess = { db: Database; accessToken: string; connection: ConnectionRow; signal: AbortSignal }

async function prepareDispatch(access: CommandAccess, command: PreparedCalendarCommand, stage: StageRow) {
	access.signal.throwIfAborted()
	const now = new Date()
	const start = command.request.payload.start
	const startsAt = start && 'dateTime' in start ? start.dateTime : command.plan.lineage[0]?.startsAt
	if (command.dispatchDeadline <= now || !startsAt || !canChange(new Date(startsAt), now))
		throw new CommandFault('not_applied')
	await access.db.transaction(async (tx) => {
		const [connection] = await tx
			.select()
			.from(googleConnections)
			.where(eq(googleConnections.id, command.connectionId))
			.for('update')
		if (
			!connection ||
			connection.state !== 'connected' ||
			connection.generation !== command.generation ||
			connection.calendarId !== command.calendarId
		)
			throw new CommandFault('not_applied')
		const [current] = await tx.select().from(googleCommands).where(eq(googleCommands.id, command.id)).for('update')
		if (!current || current.state !== 'pending') throw new CommandFault('command_pending')
		const attempt: GoogleStageAttempt = {
			attemptId: randomUUID(),
			generation: connection.generation,
			startedAt: now.toISOString(),
			finishedAt: null,
			outcome: 'dispatching',
			ifMatch: command.request.method === 'patch' ? command.request.ifMatch : null,
			requestDigest: command.request.digest,
			httpStatus: null,
			errorCode: null,
		}
		access.signal.throwIfAborted()
		await tx
			.update(googleCommandStages)
			.set({ state: 'dispatching', effect: 'unknown', attempts: [...stage.attempts, attempt], updatedAt: sql`now()` })
			.where(eq(googleCommandStages.id, stage.id))
		await tx
			.update(googleCommands)
			.set({ state: 'dispatching', effect: 'unknown', dispatchedAt: now, updatedAt: sql`now()` })
			.where(eq(googleCommands.id, command.id))
	})
}

async function checkDispatchWindow(access: CommandAccess, command: PreparedCalendarCommand, gateway: GoogleGateway) {
	if (access.connection.generation !== command.generation || access.connection.calendarId !== command.calendarId)
		throw new CommandFault('not_applied')
	const primary = await gateway.primary(access.accessToken, access.signal)
	if (primary.id !== command.calendarId) throw new CommandFault('external_change')
	if (command.operation === 'restore' && command.request.method === 'insert') {
		await checkReplacement(access, command, gateway)
		return {}
	}
	if (command.request.method === 'patch') {
		const observed = await gateway.observeEvent(
			access.accessToken,
			command.calendarId,
			command.request.eventId,
			command.plan.capturedTimeZone,
			access.signal
		)
		const before = command.plan.preconditions.find((item) => item.eventId === command.request.eventId)
		if (
			!before ||
			observed.event.etag !== command.request.ifMatch ||
			observed.unownedWritableFingerprint !== before.unownedWritableFingerprint
		)
			throw new CommandFault('external_change')
		return observed.privateProperties
	}
	const window = await commandWindow(access.db, command.accountId, command.expectedVersion)
	const before = new Map(command.plan.preconditions.map((event) => [event.eventId, event.etag]))
	const observed = new Map<string, string>()
	await traverseEvents(
		{ ...access, gateway, calendarId: command.calendarId },
		{
			timeMin: window.windowStart.toISOString(),
			timeMax: window.windowEnd.toISOString(),
		},
		(events) => {
			for (const event of events) observed.set(event.eventId, event.etag)
			return false
		}
	)
	if (observed.size !== before.size || [...observed].some(([id, etag]) => before.get(id) !== etag))
		throw new CommandFault('external_change')
	return {}
}

function finishAttempt(attempts: GoogleStageAttempt[], outcome: GoogleStageAttempt['outcome'], status: number | null) {
	return attempts.map((attempt, index) =>
		index === attempts.length - 1
			? {
					...attempt,
					outcome,
					finishedAt: new Date().toISOString(),
					httpStatus: status,
				}
			: attempt
	)
}

export async function acknowledgeCommand(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	result: VerifiedGoogleResponse,
	source: 'insert' | 'get' = 'insert'
) {
	access.signal.throwIfAborted()
	await access.db.transaction(async (tx) => {
		const [connection] = await tx
			.select()
			.from(googleConnections)
			.where(eq(googleConnections.id, command.connectionId))
			.for('update')
		const [current] = await tx.select().from(googleCommands).where(eq(googleCommands.id, command.id)).for('update')
		if (!current || current.state === 'applied' || current.state === 'failed') return
		const { stage } = await preparedCommand(tx, current)
		const fresh =
			connection?.state === 'connected' &&
			connection.generation === result.generation &&
			connection.calendarId === command.calendarId
		access.signal.throwIfAborted()
		await tx
			.update(googleCommandStages)
			.set({
				state: 'acknowledged',
				effect: 'confirmed',
				generation: result.generation,
				acknowledgement: result.acknowledgement,
				acknowledgedAt: sql`now()`,
				attempts:
					source === 'insert' ? finishAttempt(stage.attempts, 'acknowledged', result.httpStatus) : stage.attempts,
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommandStages.id, stage.id))
		await tx
			.update(googleCommands)
			.set({
				state: fresh ? 'projection_pending' : 'recovery_required',
				effect: 'confirmed',
				issue: fresh ? null : 'reconnect_required',
				nextAction: fresh ? 'wait' : 'resume_recovery',
				acknowledgedAt: sql`now()`,
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommands.id, command.id))
	})
}

async function refusedDispatch(db: Database, command: PreparedCalendarCommand, error: unknown) {
	const rejected = error instanceof GoogleWriteFault && error.outcome === 'rejected'
	await db.transaction(async (tx) => {
		const current = await readCommand(tx, command.accountId, command.id)
		if (!['dispatching', 'outcome_unknown'].includes(current.state)) return
		const { stage } = await preparedCommand(tx, current)
		await tx
			.update(googleCommandStages)
			.set({
				state: rejected ? 'failed' : 'outcome_unknown',
				effect: rejected ? 'none' : 'unknown',
				attempts: finishAttempt(
					stage.attempts,
					rejected ? 'rejected' : 'unknown',
					error instanceof GoogleWriteFault ? error.httpStatus : null
				),
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommandStages.id, stage.id))
		await tx
			.update(googleCommands)
			.set({
				state: rejected ? 'failed' : 'outcome_unknown',
				effect: rejected ? 'none' : 'unknown',
				issue: rejected ? 'not_applied' : 'provider_unavailable',
				nextAction: rejected ? 'retry_new_command' : 'wait',
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommands.id, command.id))
		if (rejected) await retireReservations(tx, command.id)
	})
}

export async function projectCommand(access: Pick<CommandAccess, 'db' | 'signal'>, command: CommandRow) {
	const { prepared, stage } = await preparedCommand(access.db, command)
	if (!stage.acknowledgement) throw new CommandFault('precondition_failed')
	const result = storedGoogleResult(stage.acknowledgement, prepared.request, stage.generation)
	access.signal.throwIfAborted()
	await access.db.transaction(async (tx) => {
		access.signal.throwIfAborted()
		await applyConfirmedCommand(tx, prepared, result)
		access.signal.throwIfAborted()
	})
}

export async function dispatchCommand(access: CommandAccess, command: CommandRow, gateway: GoogleGateway) {
	const { prepared, stage } = await preparedCommand(access.db, command)
	let privateProperties: Record<string, string>
	try {
		privateProperties = await checkDispatchWindow(access, prepared, gateway)
		await prepareDispatch(access, prepared, stage)
	} catch (error) {
		if (!(error instanceof CommandFault && error.code === 'command_pending'))
			await failUnsentCommand(access.db, command.id)
		throw error
	}
	try {
		const result =
			prepared.request.method === 'patch'
				? await gateway.patch(
						access.accessToken,
						command.calendarId,
						prepared.request,
						prepared.plan.capturedTimeZone,
						access.connection.generation,
						privateProperties,
						access.signal
					)
				: await gateway.insert(
						access.accessToken,
						command.calendarId,
						prepared.request,
						prepared.plan.capturedTimeZone,
						access.connection.generation,
						access.signal
					)
		await acknowledgeCommand(access, prepared, result)
	} catch (error) {
		await refusedDispatch(access.db, prepared, error)
		if (error instanceof CalendarFault) throw error
		return
	}
	const confirmed = await readCommand(access.db, command.accountId, command.id)
	if (confirmed.state === 'projection_pending') await projectCommand(access, confirmed)
}
