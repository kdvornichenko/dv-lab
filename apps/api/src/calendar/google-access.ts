import { and, eq, isNull, sql } from 'drizzle-orm'

import { googleConnections, type Database, type DbExecutor } from '@dv-lab/db'

import { CalendarFault, type GoogleGateway, type GoogleTokens } from './gateway.ts'
import type { ConnectionLease, ConnectionLeaseContext } from './lease.ts'
import type { CalendarObservation } from './observation.ts'
import type { TokenEnvelope } from './token-envelope.ts'

export type ConnectionRow = typeof googleConnections.$inferSelect
export type CalendarAccess = { accessToken: string; connection: ConnectionRow; db: Database; signal: AbortSignal }
type Access = { token: string; expiresAt: number; generation: number; credentialGeneration: number }
type Issued = { token: string; row: ConnectionRow }

const REFRESH_BUDGET_MS = 30000

export async function findConnection(db: DbExecutor, accountId: string): Promise<ConnectionRow | undefined> {
	const [row] = await db.select().from(googleConnections).where(currentConnection(accountId)).limit(1)
	return row
}

export function currentConnection(accountId: string) {
	return and(eq(googleConnections.accountId, accountId), isNull(googleConnections.retiredAt))
}

export function credentialBinding(row: ConnectionRow) {
	return {
		accountId: row.accountId,
		connectionId: row.id,
		generation: row.credentialGeneration,
		purpose: 'refresh' as const,
	}
}

function usable(row: ConnectionRow | undefined): ConnectionRow {
	if (!row || row.state === 'not_connected') throw new CalendarFault('connection_required')
	if (row.state !== 'connected' || row.credentialMode !== 'active')
		throw new CalendarFault(row.state === 'permission_required' ? 'permission_required' : 'reconnect_required')
	return row
}

function calendarFault(error: unknown): CalendarFault {
	return error instanceof CalendarFault ? error : new CalendarFault('provider_unavailable')
}

async function within<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
	signal.throwIfAborted()
	return new Promise<T>((resolve, reject) => {
		const abort = () => reject(signal.reason)
		signal.addEventListener('abort', abort, { once: true })
		task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
	})
}

export function createCredentials(deps: {
	db: Database
	lease: ConnectionLease
	envelope: TokenEnvelope
	gateway: GoogleGateway
	observation: CalendarObservation
}) {
	const access = new Map<string, Access>()
	const inflight = new Map<string, Promise<Issued>>()
	const stopped = new AbortController()

	function cached(row: ConnectionRow) {
		const entry = access.get(row.accountId)
		if (
			entry &&
			entry.generation === row.generation &&
			entry.credentialGeneration === row.credentialGeneration &&
			entry.expiresAt > Date.now() + 60000 &&
			row.encryptedRefreshToken?.keyId === deps.envelope.activeKeyId
		)
			return entry.token
		return undefined
	}

	function remember(row: ConnectionRow, tokens: GoogleTokens) {
		access.set(row.accountId, {
			token: tokens.access_token,
			expiresAt: tokens.expiry_date,
			generation: row.generation,
			credentialGeneration: row.credentialGeneration,
		})
	}

	async function persistRefresh(row: ConnectionRow, refreshToken: string, tokens: GoogleTokens, signal: AbortSignal) {
		signal.throwIfAborted()
		const credentialGeneration = row.credentialGeneration + 1
		const encryptedRefreshToken = deps.envelope.seal(tokens.refresh_token ?? refreshToken, {
			...credentialBinding(row),
			generation: credentialGeneration,
		})
		const [updated] = await deps.db
			.update(googleConnections)
			.set({
				encryptedRefreshToken,
				credentialGeneration,
				updatedAt: sql`now()`,
			})
			.where(
				and(
					eq(googleConnections.id, row.id),
					eq(googleConnections.generation, row.generation),
					eq(googleConnections.credentialGeneration, row.credentialGeneration),
					eq(googleConnections.credentialMode, 'active')
				)
			)
			.returning()
		return updated
	}

	async function markRejected(row: ConnectionRow, code: 'reconnect_required' | 'permission_required') {
		access.delete(row.accountId)
		await deps.db
			.update(googleConnections)
			.set({ state: code, issue: code, updatedAt: sql`now()` })
			.where(
				and(
					eq(googleConnections.id, row.id),
					eq(googleConnections.generation, row.generation),
					eq(googleConnections.credentialGeneration, row.credentialGeneration),
					eq(googleConnections.credentialMode, 'active')
				)
			)
	}

	async function refresh(row: ConnectionRow, retried: boolean): Promise<Issued> {
		const signal = AbortSignal.any([stopped.signal, AbortSignal.timeout(REFRESH_BUDGET_MS)])
		if (!row.encryptedRefreshToken) {
			await markRejected(row, 'reconnect_required')
			throw new CalendarFault('reconnect_required')
		}
		const refreshToken = deps.envelope.open(row.encryptedRefreshToken, credentialBinding(row))
		const startedAt = Date.now()
		let tokens: GoogleTokens
		try {
			tokens = await deps.gateway.refresh(refreshToken, signal)
		} catch (error) {
			if (
				error instanceof CalendarFault &&
				(error.code === 'reconnect_required' || error.code === 'permission_required')
			)
				await markRejected(row, error.code)
			throw calendarFault(error)
		}
		const providerSucceededAt = Date.now()
		const updated = await persistRefresh(row, refreshToken, tokens, signal)
		if (updated) {
			deps.observation.accessRefreshed(row, updated, { startedAt, providerSucceededAt, expiresAt: tokens.expiry_date })
			remember(updated, tokens)
			return { token: tokens.access_token, row: updated }
		}
		const current = usable(await findConnection(deps.db, row.accountId))
		if (current.generation === row.generation && current.credentialGeneration > row.credentialGeneration) {
			remember(current, tokens)
			return { token: tokens.access_token, row: current }
		}
		access.delete(row.accountId)
		if (retried) throw new CalendarFault('provider_unavailable')
		return refresh(current, true)
	}

	function issue(row: ConnectionRow, force: boolean): Promise<Issued> {
		const token = force ? undefined : cached(row)
		if (token) return Promise.resolve({ token, row })
		const running = inflight.get(row.accountId)
		if (running) return running
		access.delete(row.accountId)
		const task = refresh(row, false)
		inflight.set(row.accountId, task)
		const clear = () => {
			if (inflight.get(row.accountId) === task) inflight.delete(row.accountId)
		}
		task.then(clear, clear)
		return task
	}

	return {
		async accessToken(accountId: string, signal?: AbortSignal): Promise<CalendarAccess> {
			const bounded = signal ? AbortSignal.any([stopped.signal, signal]) : stopped.signal
			try {
				bounded.throwIfAborted()
				const row = usable(await findConnection(deps.db, accountId))
				const issued = await within(issue(row, false), bounded)
				bounded.throwIfAborted()
				return { accessToken: issued.token, connection: issued.row, db: deps.db, signal: bounded }
			} catch (error) {
				throw calendarFault(error)
			}
		},
		async refreshRejectedAccess(context: ConnectionLeaseContext & { connection: ConnectionRow }) {
			const current = await findConnection(context.db, context.connection.accountId)
			if (
				!current ||
				current.generation !== context.connection.generation ||
				current.credentialGeneration < context.connection.credentialGeneration ||
				current.state !== 'connected' ||
				current.credentialMode !== 'active'
			)
				throw new CalendarFault('reconnect_required')
			const refreshed = await within(
				issue(current, current.credentialGeneration === context.connection.credentialGeneration),
				context.signal
			)
			context.signal.throwIfAborted()
			return { ...context, accessToken: refreshed.token, connection: refreshed.row }
		},
		evict(accountId: string) {
			access.delete(accountId)
		},
		async withAccessToken<T>(
			accountId: string,
			operation: (input: CalendarAccess) => Promise<T>,
			signal?: AbortSignal
		): Promise<T> {
			return deps.lease.run(accountId, async (context) => {
				const bounded = signal ? { ...context, signal: AbortSignal.any([context.signal, signal]) } : context
				bounded.signal.throwIfAborted()
				const row = usable(await findConnection(context.db, accountId))
				let issued: Issued
				try {
					issued = await within(issue(row, false), bounded.signal)
					bounded.signal.throwIfAborted()
				} catch (error) {
					throw calendarFault(error)
				}
				try {
					return await operation({ accessToken: issued.token, connection: issued.row, ...bounded })
				} catch (error) {
					if (error instanceof CalendarFault && error.code === 'reconnect_required') access.delete(accountId)
					throw calendarFault(error)
				}
			})
		},
		name: 'calendar-credentials',
		async close() {
			stopped.abort()
			await Promise.allSettled([...inflight.values()])
			inflight.clear()
			access.clear()
		},
	}
}

export type Credentials = ReturnType<typeof createCredentials>
