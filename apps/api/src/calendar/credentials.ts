import { and, eq, sql } from 'drizzle-orm'

import { googleConnections, type Database, type DbExecutor } from '@dv-lab/db'

import { CalendarFault, type GoogleGateway, type GoogleTokens } from './gateway.ts'
import type { ConnectionLease, ConnectionLeaseContext } from './lease.ts'
import type { CalendarObservation } from './observation.ts'
import type { TokenEnvelope } from './token-envelope.ts'

export type ConnectionRow = typeof googleConnections.$inferSelect
type Access = { token: string; expiresAt: number; generation: number; credentialGeneration: number }

export async function findConnection(db: DbExecutor, accountId: string): Promise<ConnectionRow | undefined> {
	const [row] = await db.select().from(googleConnections).where(eq(googleConnections.accountId, accountId)).limit(1)
	return row
}

export function credentialBinding(row: ConnectionRow) {
	return {
		accountId: row.accountId,
		connectionId: row.id,
		generation: row.credentialGeneration,
		purpose: 'refresh' as const,
	}
}

export function createCredentials(deps: {
	lease: ConnectionLease
	envelope: TokenEnvelope
	gateway: GoogleGateway
	observation: CalendarObservation
}) {
	const access = new Map<string, Access>()

	async function persistRefresh(
		context: ConnectionLeaseContext,
		row: ConnectionRow,
		refreshToken: string,
		tokens: GoogleTokens
	) {
		context.signal.throwIfAborted()
		const credentialGeneration = row.credentialGeneration + 1
		const encryptedRefreshToken = deps.envelope.seal(tokens.refresh_token ?? refreshToken, {
			...credentialBinding(row),
			generation: credentialGeneration,
		})
		const [updated] = await context.db
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
		if (!updated) throw new CalendarFault('reconnect_required')
		return updated
	}

	async function token(context: ConnectionLeaseContext, row: ConnectionRow) {
		const cached = access.get(row.accountId)
		if (
			cached &&
			cached.generation === row.generation &&
			cached.credentialGeneration === row.credentialGeneration &&
			cached.expiresAt > Date.now() + 60000 &&
			row.encryptedRefreshToken?.keyId === deps.envelope.activeKeyId
		)
			return { token: cached.token, row }
		access.delete(row.accountId)
		if (!row.encryptedRefreshToken) throw new CalendarFault('reconnect_required')
		const refreshToken = deps.envelope.open(row.encryptedRefreshToken, credentialBinding(row))
		const startedAt = Date.now()
		const tokens = await deps.gateway.refresh(refreshToken, context.signal)
		const providerSucceededAt = Date.now()
		const updated = await persistRefresh(context, row, refreshToken, tokens)
		deps.observation.accessRefreshed(row, updated, { startedAt, providerSucceededAt, expiresAt: tokens.expiry_date })
		access.set(row.accountId, {
			token: tokens.access_token,
			expiresAt: tokens.expiry_date,
			generation: updated.generation,
			credentialGeneration: updated.credentialGeneration,
		})
		return { token: tokens.access_token, row: updated }
	}

	async function recordFailure(db: Database, row: ConnectionRow, error: unknown): Promise<never> {
		access.delete(row.accountId)
		if (!(error instanceof CalendarFault)) throw new CalendarFault('provider_unavailable')
		if (error.code === 'reconnect_required' || error.code === 'permission_required') {
			await db
				.update(googleConnections)
				.set({ state: error.code, issue: error.code, updatedAt: sql`now()` })
				.where(
					and(
						eq(googleConnections.id, row.id),
						eq(googleConnections.generation, row.generation),
						eq(googleConnections.credentialMode, 'active')
					)
				)
		}
		throw error
	}

	return {
		async refreshRejectedAccess(context: ConnectionLeaseContext & { connection: ConnectionRow }) {
			const current = await findConnection(context.db, context.connection.accountId)
			if (
				!current ||
				current.generation !== context.connection.generation ||
				current.credentialGeneration !== context.connection.credentialGeneration ||
				current.state !== 'connected'
			)
				throw new CalendarFault('reconnect_required')
			access.delete(current.accountId)
			const refreshed = await token(context, current)
			context.signal.throwIfAborted()
			return { ...context, accessToken: refreshed.token, connection: refreshed.row }
		},
		evict(accountId: string) {
			access.delete(accountId)
		},
		async withAccessToken<T>(
			accountId: string,
			operation: (input: {
				accessToken: string
				connection: ConnectionRow
				db: Database
				signal: AbortSignal
			}) => Promise<T>,
			signal?: AbortSignal
		): Promise<T> {
			return deps.lease.run(accountId, async (context) => {
				const bounded = signal ? { ...context, signal: AbortSignal.any([context.signal, signal]) } : context
				bounded.signal.throwIfAborted()
				const row = await findConnection(context.db, accountId)
				if (!row || row.state === 'not_connected') throw new CalendarFault('connection_required')
				if (row.state !== 'connected' || row.credentialMode !== 'active')
					throw new CalendarFault(row.state === 'permission_required' ? 'permission_required' : 'reconnect_required')
				try {
					const value = await token(bounded, row)
					bounded.signal.throwIfAborted()
					return await operation({ accessToken: value.token, connection: value.row, ...bounded })
				} catch (error) {
					return recordFailure(context.db, row, error)
				}
			})
		},
		name: 'calendar-credentials',
		async close() {
			access.clear()
		},
	}
}

export type Credentials = ReturnType<typeof createCredentials>
