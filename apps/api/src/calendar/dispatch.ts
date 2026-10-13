import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { canChange } from '@dv-lab/core'
import {
	googleCommands,
	googleCommandStages,
	googleConnections,
	googleStageRequest,
	type Database,
	type DbExecutor,
	type GoogleEventTime,
	type GoogleStageAcknowledgement,
	type GoogleStageAttempt,
} from '@dv-lab/db'

import { applyConfirmedCommand, applyConfirmedCut } from '../schedule/command-apply.ts'
import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import {
	observedBaseline,
	storedGoogleResult,
	unownedFingerprint,
	type VerifiedGoogleResponse,
} from './command-result.ts'
import { applyConfirmedEvent, EVENT_OPERATIONS } from './event-commands.ts'
import { CalendarFault, GoogleWriteFault, type GoogleGateway } from './gateway.ts'
import type { ConnectionRow } from './google-access.ts'
import {
	CommandFault,
	failUnsentCommand,
	preparedCommand,
	readCommand,
	retireReservations,
	type CommandRow,
	type StageRow,
} from './journal.ts'
import { upsertEventFacts, type EventFact } from './projection.ts'
import { classifyRecurrence, matchesMaster } from './recurring.ts'
import { checkReplacement } from './single-observation.ts'

export type CommandAccess = { db: Database; accessToken: string; connection: ConnectionRow; signal: AbortSignal }
type PatchRequest = Extract<PreparedCalendarCommand['request'], { method: 'patch' }>
type InsertRequest = Extract<PreparedCalendarCommand['request'], { method: 'insert' }>
type Baseline = NonNullable<PatchRequest['cancellationBaseline']>
type DispatchWindow = {
	privateProperties: Record<string, string>
	baseline?: Baseline
	observation?: Awaited<ReturnType<GoogleGateway['observeEvent']>>
}
type ReadyDispatch = { request: PreparedCalendarCommand['request']; companion: StageRow | null }

const LESSON_OPERATIONS: ReadonlySet<string> = new Set([
	'create',
	'move',
	'cancel',
	'restore',
	'move_series',
	'end_series',
])
const SQL_ADMITTED: ReadonlySet<string> = new Set(['event_update', 'event_delete', 'assign'])

function lessonStartGate(command: PreparedCalendarCommand, now: Date) {
	if (!LESSON_OPERATIONS.has(command.operation)) return
	const start = command.request.payload.start
	const startsAt = start && 'dateTime' in start ? start.dateTime : command.plan.lineage[0]?.startsAt
	if (!startsAt || !canChange(new Date(startsAt), now)) throw new CommandFault('not_applied')
}

async function companionStage(executor: DbExecutor, commandId: string, lock: boolean) {
	const query = executor
		.select()
		.from(googleCommandStages)
		.where(and(eq(googleCommandStages.commandId, commandId), eq(googleCommandStages.kind, 'create_master')))
	const [row] = lock ? await query.for('update') : await query
	return row ?? null
}

function newAttempt(generation: number, now: Date, requestDigest: string, ifMatch: string | null): GoogleStageAttempt {
	return {
		attemptId: randomUUID(),
		generation,
		startedAt: now.toISOString(),
		finishedAt: null,
		outcome: 'dispatching',
		ifMatch,
		requestDigest,
		httpStatus: null,
		errorCode: null,
	}
}

async function startCompanion(db: Database, stage: StageRow, generation: number) {
	const request = googleStageRequest.parse(stage.request)
	if (request.method !== 'insert') throw new CommandFault('precondition_failed')
	const [started] = await db
		.update(googleCommandStages)
		.set({
			state: 'dispatching',
			effect: 'unknown',
			generation,
			attempts: [...stage.attempts, newAttempt(generation, new Date(), request.digest, null)],
			updatedAt: sql`now()`,
		})
		.where(and(eq(googleCommandStages.id, stage.id), ne(googleCommandStages.state, 'acknowledged')))
		.returning()
	return started ?? null
}

async function acknowledgeCompanion(db: Database, stageId: string, result: VerifiedGoogleResponse, observed: boolean) {
	await db.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(googleCommandStages)
			.where(eq(googleCommandStages.id, stageId))
			.for('update')
		if (!current || current.state === 'acknowledged') return
		if (!observed && current.state !== 'dispatching') throw new CommandFault('precondition_failed')
		await tx
			.update(googleCommandStages)
			.set({
				state: 'acknowledged',
				effect: 'confirmed',
				acknowledgement: result.acknowledgement,
				acknowledgedAt: sql`now()`,
				attempts: observed
					? confirmObservedAttempts(current.attempts)
					: finishAttempt(current.attempts, 'acknowledged', result.httpStatus),
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommandStages.id, stageId))
	})
}

export async function ensureCompanion(access: CommandAccess, command: CommandRow, gateway: GoogleGateway) {
	const stage = await companionStage(access.db, command.id, false)
	if (!stage || stage.state === 'acknowledged') return
	const { prepared } = await preparedCommand(access.db, command)
	const request = googleStageRequest.parse(stage.request)
	if (request.method !== 'insert') return
	try {
		const found = await gateway.confirmedEvent(
			access.accessToken,
			command.calendarId,
			request,
			prepared.plan.capturedTimeZone,
			access.connection.generation,
			access.signal
		)
		if (!found.recoveryIssue) await acknowledgeCompanion(access.db, stage.id, found, true)
		return
	} catch (error) {
		if (!(error instanceof GoogleWriteFault && error.outcome === 'missing')) return
	}
	const started = await startCompanion(access.db, stage, access.connection.generation)
	if (started) await sendCompanion(access, prepared, started, gateway).catch(() => undefined)
}

function withPreserved(stage: StageRow, observation: DispatchWindow['observation']): InsertRequest {
	const request = googleStageRequest.parse(stage.request)
	if (request.method !== 'insert') throw new CommandFault('precondition_failed')
	if (!observation) return request
	const preserved = observedBaseline(observation, request.payload).unownedWritable
	const parsed = googleStageRequest.parse({
		...request,
		payload: { ...request.payload, ...(preserved ? { preserved } : {}) },
	})
	if (parsed.method !== 'insert') throw new CommandFault('precondition_failed')
	return parsed
}

async function prepareDispatch(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	stage: StageRow,
	window: DispatchWindow
): Promise<ReadyDispatch> {
	access.signal.throwIfAborted()
	const now = new Date()
	if (command.dispatchDeadline <= now) throw new CommandFault('not_applied')
	lessonStartGate(command, now)
	return access.db.transaction(async (tx) => {
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
		const latest = await preparedCommand(tx, current)
		if (
			latest.stage.id !== stage.id ||
			latest.stage.state !== 'pending' ||
			latest.prepared.request.digest !== command.request.digest
		)
			throw new CommandFault('precondition_failed')
		const request =
			window.baseline && command.request.method === 'patch'
				? googleStageRequest.parse({ ...command.request, cancellationBaseline: window.baseline })
				: command.request
		if (request.method !== 'insert' && request.method !== 'patch') throw new CommandFault('precondition_failed')
		access.signal.throwIfAborted()
		await tx
			.update(googleCommandStages)
			.set({
				state: 'dispatching',
				effect: 'unknown',
				request,
				attempts: [
					...stage.attempts,
					newAttempt(connection.generation, now, request.digest, request.method === 'patch' ? request.ifMatch : null),
				],
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommandStages.id, stage.id))
		const pending = await companionStage(tx, command.id, true)
		let companion: StageRow | null = null
		if (pending && pending.state !== 'acknowledged') {
			if (pending.state !== 'pending') throw new CommandFault('precondition_failed')
			const insert = withPreserved(pending, window.observation)
			const [prepared] = await tx
				.update(googleCommandStages)
				.set({ request: insert, generation: connection.generation, updatedAt: sql`now()` })
				.where(eq(googleCommandStages.id, pending.id))
				.returning()
			companion = prepared ?? null
		}
		await tx
			.update(googleCommands)
			.set({ state: 'dispatching', effect: 'unknown', dispatchedAt: now, updatedAt: sql`now()` })
			.where(eq(googleCommands.id, command.id))
		return { request, companion }
	})
}

async function sendCompanion(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	stage: StageRow,
	gateway: GoogleGateway
) {
	const request = googleStageRequest.parse(stage.request)
	if (request.method !== 'insert') throw new CommandFault('precondition_failed')
	let result: VerifiedGoogleResponse
	try {
		result = await gateway.insert(
			access.accessToken,
			command.calendarId,
			request,
			command.plan.capturedTimeZone,
			access.connection.generation,
			access.signal
		)
		if (result.recoveryIssue) throw new CalendarFault(result.recoveryIssue)
		const preserved = request.payload.preserved
		if (
			preserved &&
			unownedFingerprint(preserved, request.payload) !== result.acknowledgement.unownedWritableFingerprint
		)
			throw new CalendarFault('external_change')
	} catch (error) {
		const retry = error instanceof GoogleWriteFault && error.httpStatus === 401
		const rejected = error instanceof GoogleWriteFault && error.outcome === 'rejected' && !retry
		await access.db
			.update(googleCommandStages)
			.set({
				state: retry ? 'pending' : rejected ? 'failed' : 'outcome_unknown',
				effect: retry || rejected ? 'none' : 'unknown',
				attempts: finishAttempt(
					stage.attempts,
					retry || rejected ? 'rejected' : 'unknown',
					error instanceof GoogleWriteFault ? error.httpStatus : null
				),
				updatedAt: sql`now()`,
			})
			.where(and(eq(googleCommandStages.id, stage.id), eq(googleCommandStages.state, 'dispatching')))
		throw error
	}
	await acknowledgeCompanion(access.db, stage.id, result, false)
}

async function checkInstanceDispatch(access: CommandAccess, command: PreparedCalendarCommand, gateway: GoogleGateway) {
	if (command.request.method !== 'patch') return
	if (command.request.instance) {
		const identity = command.request.instance
		if (!identity.lookupVerified || !command.plan.capturedRule || !('dateTime' in identity.originalStartTime))
			throw new CommandFault('external_change')
		const master = await gateway.master(
			access.accessToken,
			command.calendarId,
			identity.masterEventId,
			command.plan.capturedTimeZone,
			access.signal
		)
		if (!matchesMaster(master, command.plan.capturedRule)) throw new CommandFault('external_change')
		const instance = await gateway.canonicalInstance(
			access.accessToken,
			command.calendarId,
			identity.masterEventId,
			identity.originalStartTime.dateTime,
			access.signal
		)
		if (instance.kind !== 'found' || instance.eventId !== command.request.eventId)
			throw new CommandFault('external_change')
	}
}

function sameOriginal(observed: GoogleEventTime | null, expected: GoogleEventTime) {
	if (!observed) return false
	if ('date' in expected) return 'date' in observed && observed.date === expected.date
	return 'dateTime' in observed && Date.parse(observed.dateTime) === Date.parse(expected.dateTime)
}

async function observeAdmittedPatch(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	request: PatchRequest,
	gateway: GoogleGateway
): Promise<DispatchWindow> {
	const observation = await gateway.observeEvent(
		access.accessToken,
		command.calendarId,
		request.eventId,
		command.plan.capturedTimeZone,
		access.signal
	)
	if (observation.event.eventId !== request.eventId || observation.event.etag !== request.ifMatch)
		throw new CommandFault('external_change')
	const instance = request.instance
	if (
		instance &&
		(observation.event.recurringEventId !== instance.masterEventId ||
			!sameOriginal(observation.event.originalStartTime, instance.originalStartTime))
	)
		throw new CommandFault('external_change')
	if (!instance && observation.event.recurringEventId) throw new CommandFault('external_change')
	const baseline = observedBaseline(observation, request.payload)
	return {
		privateProperties: observation.privateProperties,
		observation,
		baseline: {
			unownedWritableFingerprint: baseline.unownedWritableFingerprint,
			unownedWritable: baseline.unownedWritable,
			baselineEvent: observation.event,
		},
	}
}

async function checkDispatchWindow(
	access: CommandAccess,
	command: PreparedCalendarCommand,
	gateway: GoogleGateway
): Promise<DispatchWindow> {
	if (access.connection.generation !== command.generation || access.connection.calendarId !== command.calendarId)
		throw new CommandFault('not_applied')
	if (command.operation === 'restore' && command.request.method === 'insert') {
		await checkReplacement(access, command, gateway)
		return { privateProperties: {} }
	}
	if (command.request.method === 'patch' && SQL_ADMITTED.has(command.operation))
		return observeAdmittedPatch(access, command, command.request, gateway)
	if (command.request.method === 'patch') {
		await checkInstanceDispatch(access, command, gateway)
		const observed = await gateway.observeEvent(
			access.accessToken,
			command.calendarId,
			command.request.eventId,
			command.plan.capturedTimeZone,
			access.signal
		)
		const before = command.plan.preconditions.find((item) => item.eventId === command.request.eventId)
		const start = observed.event.start
		if (start && 'dateTime' in start && !canChange(new Date(start.dateTime), new Date()))
			throw new CommandFault('not_applied')
		if (
			!before ||
			observed.event.etag !== command.request.ifMatch ||
			observed.unownedWritableFingerprint !== before.unownedWritableFingerprint
		)
			throw new CommandFault('external_change')
		return { privateProperties: observed.privateProperties }
	}
	return { privateProperties: {} }
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
	source: 'write' | 'get' = 'write'
) {
	access.signal.throwIfAborted()
	if (result.commandId !== command.id || result.acknowledgement.ownedDigest !== command.request.digest)
		throw new CommandFault('precondition_failed')
	if (!preservesUnowned(command, result)) throw new CalendarFault('external_change')
	await access.db.transaction(async (tx) => {
		const [connection] = await tx
			.select()
			.from(googleConnections)
			.where(eq(googleConnections.id, command.connectionId))
			.for('update')
		const [current] = await tx.select().from(googleCommands).where(eq(googleCommands.id, command.id)).for('update')
		if (!current || current.state === 'applied' || current.state === 'failed') return
		const { stage } = await preparedCommand(tx, current)
		if (
			stage.request.method !== command.request.method ||
			!('digest' in stage.request) ||
			stage.request.digest !== command.request.digest ||
			stage.request.eventId !== command.request.eventId
		)
			throw new CommandFault('precondition_failed')
		const fresh =
			connection?.state === 'connected' &&
			connection.generation === result.generation &&
			connection.generation === access.connection.generation &&
			connection.calendarId === command.calendarId
		const canProject = fresh && !result.recoveryIssue
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
					source === 'write'
						? finishAttempt(stage.attempts, 'acknowledged', result.httpStatus)
						: confirmObservedAttempts(stage.attempts),
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommandStages.id, stage.id))
		await tx
			.update(googleCommands)
			.set({
				state: canProject ? 'projection_pending' : 'recovery_required',
				effect: 'confirmed',
				issue: fresh ? (result.recoveryIssue ?? null) : 'reconnect_required',
				nextAction: canProject ? 'wait' : 'resume_recovery',
				acknowledgedAt: sql`now()`,
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommands.id, command.id))
	})
}

async function refusedDispatch(db: Database, command: PreparedCalendarCommand, error: unknown) {
	const rejected = error instanceof GoogleWriteFault && error.outcome === 'rejected' && error.httpStatus !== 412
	const external = error instanceof CalendarFault && error.code === 'external_change'
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
					error instanceof GoogleWriteFault && (error.outcome === 'rejected' || error.httpStatus === 409)
						? 'rejected'
						: 'unknown',
					error instanceof GoogleWriteFault ? error.httpStatus : null
				),
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommandStages.id, stage.id))
		await tx
			.update(googleCommands)
			.set({
				state: rejected ? 'failed' : external ? 'recovery_required' : 'outcome_unknown',
				effect: rejected ? 'none' : 'unknown',
				issue: rejected ? 'not_applied' : external ? 'external_change' : 'provider_unavailable',
				nextAction: rejected ? 'retry_new_command' : external ? 'resume_recovery' : 'wait',
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommands.id, command.id))
		if (!rejected) return
		await tx
			.update(googleCommandStages)
			.set({ state: 'failed', effect: 'none', updatedAt: sql`now()` })
			.where(
				and(
					eq(googleCommandStages.commandId, command.id),
					eq(googleCommandStages.kind, 'create_master'),
					eq(googleCommandStages.state, 'pending')
				)
			)
		await retireReservations(tx, command.id)
	})
}

function acknowledgedFacts(ack: GoogleStageAcknowledgement | null): EventFact[] {
	if (ack?.kind === 'event') return [{ ...ack.event, factAt: new Date(ack.checkedAt) }]
	if (ack?.kind === 'master')
		return [
			{
				...ack.event,
				master: true,
				recurrence: classifyRecurrence(ack.recurrence, ack.event.start?.timeZone ?? 'UTC'),
				factAt: new Date(ack.checkedAt),
			},
		]
	if (ack?.kind !== 'cancellation') return []
	const factAt = new Date(ack.checkedAt)
	const baseline = ack.baselineEvent
	if (baseline) return [{ ...baseline, status: 'cancelled', etag: ack.response.etag ?? baseline.etag, factAt }]
	return [
		{
			eventId: ack.response.id,
			status: 'cancelled',
			...(ack.response.etag ? { etag: ack.response.etag } : {}),
			factAt,
		},
	]
}

async function projectFacts(tx: DbExecutor, command: CommandRow, facts: readonly EventFact[]) {
	await tx
		.select({ id: googleConnections.id })
		.from(googleConnections)
		.where(eq(googleConnections.id, command.connectionId))
		.for('update')
	await upsertEventFacts(
		tx,
		{ accountId: command.accountId, connectionId: command.connectionId, calendarId: command.calendarId },
		facts
	)
}

async function writtenFacts(tx: DbExecutor, command: CommandRow, kinds: ('write' | 'create_master')[]) {
	const stages = await tx
		.select({ acknowledgement: googleCommandStages.acknowledgement })
		.from(googleCommandStages)
		.where(
			and(
				eq(googleCommandStages.commandId, command.id),
				inArray(googleCommandStages.kind, kinds),
				eq(googleCommandStages.state, 'acknowledged')
			)
		)
		.orderBy(asc(googleCommandStages.stage))
	return stages.flatMap((stage) => acknowledgedFacts(stage.acknowledgement))
}

async function projectEvent(access: Pick<CommandAccess, 'db' | 'signal'>, command: CommandRow) {
	const { prepared, stage } = await preparedCommand(access.db, command)
	if (!stage.acknowledgement) throw new CommandFault('precondition_failed')
	const companion = await companionStage(access.db, command.id, false)
	if (companion && companion.state !== 'acknowledged') {
		await access.db
			.update(googleCommands)
			.set({
				state: 'recovery_required',
				issue: 'provider_unavailable',
				nextAction: 'resume_recovery',
				updatedAt: sql`now()`,
			})
			.where(and(eq(googleCommands.id, command.id), eq(googleCommands.state, 'projection_pending')))
		return
	}
	const result = storedGoogleResult(stage.acknowledgement, prepared.request, stage.generation)
	access.signal.throwIfAborted()
	await access.db.transaction(async (tx) => {
		access.signal.throwIfAborted()
		await projectFacts(tx, command, await writtenFacts(tx, command, ['write', 'create_master']))
		await applyConfirmedEvent(tx, prepared, result)
		access.signal.throwIfAborted()
	})
}

export async function projectCommand(access: Pick<CommandAccess, 'db' | 'signal'>, command: CommandRow) {
	if (EVENT_OPERATIONS.has(command.operation)) return projectEvent(access, command)
	if (command.plan.cut) {
		const { prepared } = await preparedCommand(access.db, command)
		try {
			await access.db.transaction(async (tx) => {
				access.signal.throwIfAborted()
				await projectFacts(tx, command, await writtenFacts(tx, command, ['write']))
				await applyConfirmedCut(tx, prepared)
				access.signal.throwIfAborted()
			})
		} catch (error) {
			if (!(error instanceof CommandFault)) throw error
			await access.db
				.update(googleCommands)
				.set({
					state: 'recovery_required',
					issue: error.code === 'reconnect_required' ? 'reconnect_required' : 'external_change',
					nextAction: 'resume_recovery',
					updatedAt: sql`now()`,
				})
				.where(and(eq(googleCommands.id, command.id), eq(googleCommands.state, 'projection_pending')))
		}
		return
	}
	const { prepared, stage } = await preparedCommand(access.db, command)
	if (!stage.acknowledgement) throw new CommandFault('precondition_failed')
	const result = storedGoogleResult(stage.acknowledgement, prepared.request, stage.generation)
	access.signal.throwIfAborted()
	await access.db.transaction(async (tx) => {
		access.signal.throwIfAborted()
		await projectFacts(tx, command, acknowledgedFacts(result.acknowledgement))
		await applyConfirmedCommand(tx, prepared, result)
		access.signal.throwIfAborted()
	})
}

export async function dispatchCommand(
	access: CommandAccess,
	command: CommandRow,
	gateway: GoogleGateway,
	refresh401?: (access: CommandAccess) => Promise<CommandAccess>
) {
	const { prepared: stored, stage } = await preparedCommand(access.db, command)
	let window: DispatchWindow
	let ready: ReadyDispatch
	try {
		window = await checkDispatchWindow(access, stored, gateway)
		ready = await prepareDispatch(access, stored, stage, window)
	} catch (error) {
		if (!(error instanceof CommandFault && error.code === 'command_pending'))
			await failUnsentCommand(
				access.db,
				command.id,
				error instanceof CommandFault && error.code === 'external_change' ? 'external_change' : 'not_applied'
			)
		throw error
	}
	const prepared: PreparedCalendarCommand = { ...stored, request: ready.request }
	try {
		const result =
			prepared.request.method === 'patch'
				? await gateway.patch(
						access.accessToken,
						command.calendarId,
						prepared.request,
						prepared.plan.capturedTimeZone,
						access.connection.generation,
						window.privateProperties,
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
		if (
			error instanceof GoogleWriteFault &&
			error.httpStatus === 401 &&
			refresh401 &&
			command.dispatchDeadline > new Date()
		) {
			await rejectForRefresh(access, prepared)
			try {
				const refreshed = await refresh401(access)
				return await dispatchCommand(refreshed, await readCommand(refreshed.db, command.accountId, command.id), gateway)
			} catch (refreshError) {
				await failUnsentCommand(access.db, command.id)
				throw refreshError
			}
		}
		await refusedDispatch(access.db, prepared, error)
		if (error instanceof CalendarFault) throw error
		return
	}
	const confirmed = await readCommand(access.db, command.accountId, command.id)
	if (confirmed.state !== 'projection_pending') return
	if (ready.companion) {
		const started = await startCompanion(access.db, ready.companion, access.connection.generation)
		if (started) await sendCompanion(access, prepared, started, gateway).catch(() => undefined)
	}
	await projectCommand(access, confirmed)
}

export function preservesUnowned(command: PreparedCalendarCommand, result: VerifiedGoogleResponse) {
	const actual = result.acknowledgement.unownedWritableFingerprint
	if (command.request.method === 'insert') {
		const preserved = command.request.payload.preserved
		if (!preserved) return command.operation === 'create' || command.operation === 'event_create'
		return unownedFingerprint(preserved, command.request.payload) === actual
	}
	const before = command.plan.preconditions.find(
		(item) => item.eventId === command.request.eventId
	)?.unownedWritableFingerprint
	return (before ?? command.request.cancellationBaseline?.unownedWritableFingerprint) === actual
}

function confirmObservedAttempts(attempts: GoogleStageAttempt[]) {
	return attempts.map((attempt) =>
		attempt.outcome === 'unknown' || attempt.outcome === 'dispatching'
			? { ...attempt, outcome: 'acknowledged' as const, finishedAt: attempt.finishedAt ?? new Date().toISOString() }
			: attempt
	)
}

async function rejectForRefresh(access: CommandAccess, command: PreparedCalendarCommand) {
	await access.db.transaction(async (tx) => {
		const current = await readCommand(tx, command.accountId, command.id)
		const { stage } = await preparedCommand(tx, current)
		if (
			current.state !== 'dispatching' ||
			stage.request.method !== command.request.method ||
			stage.attempts.some((attempt) => attempt.httpStatus === 401)
		)
			throw new CommandFault('not_applied')
		await tx
			.update(googleCommandStages)
			.set({
				state: 'pending',
				effect: 'none',
				attempts: finishAttempt(stage.attempts, 'rejected', 401),
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommandStages.id, stage.id))
		await tx
			.update(googleCommands)
			.set({ state: 'pending', effect: 'none', updatedAt: sql`now()` })
			.where(eq(googleCommands.id, command.id))
	})
}
