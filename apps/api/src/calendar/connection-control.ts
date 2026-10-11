import { and, eq, inArray, notExists, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { Logger } from 'pino'

import { googleCommands, googleCommandStages, googleConnections, type Database, type DbExecutor } from '@dv-lab/db'

import { readConnection } from './connection.ts'
import { credentialBinding, findConnection, type ConnectionRow, type Credentials } from './credentials.ts'
import { CalendarFault, GOOGLE_REQUEST_TIMEOUT_MS, type GoogleGateway } from './gateway.ts'
import { retireReservations } from './journal.ts'
import type { ConnectionLease, ConnectionLeaseContext } from './lease.ts'
import { requireConsentSession, type ConsentActor } from './oauth-session.ts'
import type { CalendarObservation } from './observation.ts'
import type { TokenEnvelope } from './token-envelope.ts'

type ControlDeps = {
	db: Database
	lease: ConnectionLease
	credentials: Credentials
	envelope: TokenEnvelope
	gateway: GoogleGateway
	logger: Logger
	observation: CalendarObservation
	isStopping: () => boolean
}

function matches(row: ConnectionRow) {
	return and(
		eq(googleConnections.id, row.id),
		eq(googleConnections.generation, row.generation),
		eq(googleConnections.credentialGeneration, row.credentialGeneration),
		eq(googleConnections.credentialMode, 'revoke_only')
	)
}

async function failUnsent(tx: DbExecutor, connectionId: string) {
	const failed = await tx
		.update(googleCommands)
		.set({
			state: 'failed',
			effect: 'none',
			issue: 'not_applied',
			nextAction: 'retry_new_command',
			updatedAt: sql`now()`,
		})
		.where(
			and(
				eq(googleCommands.connectionId, connectionId),
				inArray(googleCommands.state, ['pending', 'dispatching', 'recovery_required']),
				eq(googleCommands.effect, 'none'),
				notExists(
					tx
						.select({ id: googleCommandStages.id })
						.from(googleCommandStages)
						.where(
							and(
								eq(googleCommandStages.commandId, googleCommands.id),
								eq(googleCommandStages.kind, 'write'),
								sql`exists (select 1 from jsonb_array_elements(${googleCommandStages.attempts}) as attempt(value) where attempt.value->>'outcome' <> 'rejected')`
							)
						)
				)
			)
		)
		.returning({ id: googleCommands.id })
	for (const command of failed) {
		await retireReservations(tx, command.id)
		await tx
			.update(googleCommandStages)
			.set({ state: 'failed', effect: 'none', updatedAt: sql`now()` })
			.where(and(eq(googleCommandStages.commandId, command.id), eq(googleCommandStages.state, 'pending')))
	}
	await tx
		.update(googleCommands)
		.set({
			state: 'outcome_unknown',
			effect: 'unknown',
			issue: 'command_pending',
			nextAction: 'wait',
			updatedAt: sql`now()`,
		})
		.where(
			and(
				eq(googleCommands.connectionId, connectionId),
				eq(googleCommands.state, 'dispatching'),
				inArray(googleCommands.effect, ['none', 'unknown'])
			)
		)
	await tx
		.update(googleCommands)
		.set({
			state: 'partial_recovery',
			issue: 'command_pending',
			nextAction: 'resume_recovery',
			updatedAt: sql`now()`,
		})
		.where(
			and(
				eq(googleCommands.connectionId, connectionId),
				eq(googleCommands.state, 'dispatching'),
				eq(googleCommands.effect, 'partial')
			)
		)
	await tx
		.update(googleCommands)
		.set({
			state: 'projection_pending',
			issue: null,
			nextAction: 'wait',
			updatedAt: sql`now()`,
		})
		.where(
			and(
				eq(googleCommands.connectionId, connectionId),
				eq(googleCommands.state, 'dispatching'),
				eq(googleCommands.effect, 'confirmed')
			)
		)
}

export function createConnectionControl(deps: ControlDeps) {
	let timer: ReturnType<typeof setInterval> | undefined
	let current: Promise<void> | undefined
	const stopped = new AbortController()
	const accepting = () => !stopped.signal.aborted && !deps.isStopping()

	async function finish(db: DbExecutor, row: ConnectionRow, resolution: 'provider_confirmed' | 'operator_confirmed') {
		const [updated] = await db
			.update(googleConnections)
			.set({
				state: 'not_connected',
				issue: 'connection_required',
				encryptedRefreshToken: null,
				credentialMode: null,
				credentialGeneration: row.credentialGeneration + 1,
				disconnectResolution: resolution,
				revokeFinishedAt: row.revokeAttemptId ? sql`now()` : null,
				updatedAt: sql`now()`,
			})
			.where(matches(row))
			.returning()
		deps.credentials.evict(row.accountId)
		if (!updated) throw new CalendarFault('command_pending')
		return updated
	}

	async function fail(db: DbExecutor, row: ConnectionRow) {
		const [updated] = await db
			.update(googleConnections)
			.set({
				state: 'disconnect_failed',
				issue: 'disconnect_failed',
				revokeFinishedAt: sql`now()`,
				updatedAt: sql`now()`,
			})
			.where(matches(row))
			.returning()
		if (updated) deps.observation.control(row, updated, 'google_disconnect_failed')
	}

	async function revoke(context: ConnectionLeaseContext, row: ConnectionRow) {
		if (row.revokeAttemptId && !row.revokeFinishedAt) {
			if (row.revokeStartedAt && Date.now() - row.revokeStartedAt.getTime() >= GOOGLE_REQUEST_TIMEOUT_MS) {
				await fail(context.db, row)
			}
			return
		}
		if (!row.encryptedRefreshToken || !accepting()) return
		const [attempt] = await context.db
			.update(googleConnections)
			.set({
				revokeAttemptId: randomUUID(),
				revokeStartedAt: sql`now()`,
				revokeFinishedAt: null,
				revokeAttemptCount: sql`${googleConnections.revokeAttemptCount} + 1`,
				updatedAt: sql`now()`,
			})
			.where(matches(row))
			.returning()
		if (!attempt?.encryptedRefreshToken) return
		try {
			const token = deps.envelope.open(attempt.encryptedRefreshToken, credentialBinding(attempt))
			await deps.gateway.revoke(token, AbortSignal.any([context.signal, stopped.signal]))
		} catch {
			await fail(context.db, attempt)
			return
		}
		const resolved = await finish(context.db, attempt, 'provider_confirmed')
		deps.observation.control(attempt, resolved, 'google_disconnect_resolved')
	}

	async function pump() {
		if (!accepting()) return
		try {
			const pending = await deps.db
				.select({ accountId: googleConnections.accountId })
				.from(googleConnections)
				.where(eq(googleConnections.state, 'disconnecting'))
				.orderBy(googleConnections.updatedAt)
				.limit(20)
			for (const row of pending) {
				if (!accepting()) return
				try {
					await deps.lease.run(row.accountId, async (context) => {
						const connection = await findConnection(context.db, row.accountId)
						if (connection?.state === 'disconnecting') await revoke(context, connection)
					})
				} catch (error) {
					if (!(error instanceof CalendarFault && error.code === 'command_pending'))
						deps.logger.warn({ calendarError: 'provider_unavailable' }, 'calendar control unavailable')
				}
			}
		} catch {
			deps.logger.warn({ calendarError: 'provider_unavailable' }, 'calendar control unavailable')
		}
	}

	function wake() {
		if (!accepting() || current) return
		current = pump().finally(() => {
			current = undefined
		})
	}

	return {
		name: 'calendar-connection-control',
		start() {
			if (!accepting() || timer) return
			timer = setInterval(wake, 1000)
			timer.unref()
			wake()
		},
		async disconnect(actor: ConsentActor) {
			if (!accepting()) throw new CalendarFault('provider_unavailable')
			const transition = await deps.db.transaction(async (tx) => {
				await requireConsentSession(tx, actor)
				const [row] = await tx
					.select()
					.from(googleConnections)
					.where(eq(googleConnections.accountId, actor.accountId))
					.for('update')
					.limit(1)
				if (!row || row.state === 'not_connected' || row.state === 'disconnecting') return
				if (!row.encryptedRefreshToken) throw new CalendarFault('reconnect_required')
				if (row.revokeAttemptId && !row.revokeFinishedAt) throw new CalendarFault('command_pending')
				const [updated] = await tx
					.update(googleConnections)
					.set({
						state: 'disconnecting',
						issue: null,
						generation: row.generation + 1,
						credentialMode: 'revoke_only',
						disconnectResolution: 'none',
						updatedAt: sql`now()`,
					})
					.where(and(eq(googleConnections.id, row.id), eq(googleConnections.generation, row.generation)))
					.returning()
				if (!updated) throw new CalendarFault('command_pending')
				await failUnsent(tx, row.id)
				return { before: row, after: updated }
			})
			if (transition) deps.observation.control(transition.before, transition.after, 'google_disconnect_started')
			deps.credentials.evict(actor.accountId)
			wake()
			return readConnection(deps.db, actor.accountId)
		},
		async confirmRevoked(actor: ConsentActor) {
			if (!accepting()) throw new CalendarFault('provider_unavailable')
			await deps.lease.run(actor.accountId, async ({ db }) => {
				const resolved = await db.transaction(async (tx) => {
					await requireConsentSession(tx, actor)
					const row = await findConnection(tx, actor.accountId)
					if (row?.state !== 'disconnect_failed' || !row.revokeFinishedAt) throw new CalendarFault('command_pending')
					return { before: row, after: await finish(tx, row, 'operator_confirmed') }
				})
				deps.observation.control(resolved.before, resolved.after, 'google_disconnect_resolved')
			})
			return readConnection(deps.db, actor.accountId)
		},
		async close() {
			stopped.abort()
			if (timer) clearInterval(timer)
			timer = undefined
			await current
		},
	}
}

export type ConnectionControl = ReturnType<typeof createConnectionControl>
