import { and, count, eq, isNull, notInArray, sql } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'

import { googleConnectionSnapshot, type GoogleConnectionSnapshot } from '@dv-lab/contracts'
import { googleCommands, googleConnections, googleOAuthFlows, type Database, type DbExecutor } from '@dv-lab/db'

import { credentialBinding, findConnection, type ConnectionRow, type Credentials } from './credentials.ts'
import { CalendarFault, type GoogleGateway, type GoogleTokens, type PrimaryCalendar } from './gateway.ts'
import type { ConnectionLease, ConnectionLeaseContext } from './lease.ts'
import { requireConsentSession, type ConsentActor } from './oauth-session.ts'
import type { TokenEnvelope } from './token-envelope.ts'

const actions: Record<GoogleConnectionSnapshot['state'], GoogleConnectionSnapshot['allowedActions']> = {
	not_connected: ['connect'],
	connected: ['disconnect'],
	reconnect_required: ['reconnect', 'disconnect'],
	permission_required: ['reconnect', 'disconnect'],
	disconnecting: [],
	disconnect_failed: ['retry_disconnect', 'confirm_revoked'],
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export type ConsentCallback = { state: string; code: string } | { state: string; error: string }

export async function readConnection(db: DbExecutor, accountId: string): Promise<GoogleConnectionSnapshot> {
	const row = await findConnection(db, accountId)
	const [pending] = await db
		.select({ value: count() })
		.from(googleCommands)
		.where(and(eq(googleCommands.accountId, accountId), notInArray(googleCommands.state, ['applied', 'failed'])))
	const state = row?.state ?? 'not_connected'
	return googleConnectionSnapshot.parse({
		state,
		generation: row?.generation ?? 0,
		issue: row?.issue ?? (state === 'not_connected' ? 'connection_required' : null),
		calendar: row?.calendarId ? { id: row.calendarId, label: row.calendarLabel, timeZone: row.calendarTimeZone } : null,
		pendingCommandCount: pending?.value ?? 0,
		disconnectResolution: row?.disconnectResolution ?? 'none',
		allowedActions: actions[state],
	})
}

export function createConnection(deps: {
	db: Database
	lease: ConnectionLease
	envelope: TokenEnvelope
	gateway: GoogleGateway
	credentials: Credentials
}) {
	async function consume(
		context: ConnectionLeaseContext,
		actor: ConsentActor,
		input: ConsentCallback,
		row: ConnectionRow
	) {
		return context.db.transaction(async (tx) => {
			const session = await requireConsentSession(tx, actor)
			const [flow] = await tx
				.select()
				.from(googleOAuthFlows)
				.where(
					and(
						eq(googleOAuthFlows.stateDigest, digest(input.state)),
						eq(googleOAuthFlows.accountId, actor.accountId),
						eq(googleOAuthFlows.connectionId, row.id),
						eq(googleOAuthFlows.generation, row.generation),
						eq(googleOAuthFlows.sessionTokenHash, session.tokenHash),
						eq(googleOAuthFlows.sessionEpoch, session.epoch),
						isNull(googleOAuthFlows.consumedAt),
						sql`${googleOAuthFlows.expiresAt} > now()`
					)
				)
				.for('update')
				.limit(1)
			if (!flow?.encryptedVerifier) throw new CalendarFault('invalid_state')
			await tx
				.update(googleOAuthFlows)
				.set({ consumedAt: sql`now()`, encryptedVerifier: null })
				.where(eq(googleOAuthFlows.stateDigest, flow.stateDigest))
			return flow
		})
	}

	async function install(
		context: ConnectionLeaseContext,
		actor: ConsentActor,
		row: ConnectionRow,
		tokens: GoogleTokens,
		primary: PrimaryCalendar
	) {
		if (row.calendarId && row.calendarId !== primary.id) throw new CalendarFault('wrong_primary')
		const refreshToken =
			tokens.refresh_token ??
			(row.encryptedRefreshToken ? deps.envelope.open(row.encryptedRefreshToken, credentialBinding(row)) : null)
		if (!refreshToken) throw new CalendarFault('missing_refresh_token')
		context.signal.throwIfAborted()
		const credentialGeneration = row.credentialGeneration + 1
		const encryptedRefreshToken = deps.envelope.seal(refreshToken, {
			...credentialBinding(row),
			generation: credentialGeneration,
		})
		await context.db.transaction(async (tx) => {
			await requireConsentSession(tx, actor)
			const [updated] = await tx
				.update(googleConnections)
				.set({
					state: 'connected',
					issue: null,
					calendarId: primary.id,
					calendarLabel: primary.label,
					calendarTimeZone: primary.timeZone,
					historyCutoverAt: row.historyCutoverAt ?? new Date(),
					generation: row.generation + 1,
					credentialGeneration,
					encryptedRefreshToken,
					credentialMode: 'active',
					disconnectResolution: 'none',
					revokeAttemptId: null,
					revokeStartedAt: null,
					revokeFinishedAt: null,
					updatedAt: sql`now()`,
				})
				.where(
					and(
						eq(googleConnections.id, row.id),
						eq(googleConnections.generation, row.generation),
						eq(googleConnections.credentialGeneration, row.credentialGeneration)
					)
				)
				.returning({ id: googleConnections.id })
			if (!updated) throw new CalendarFault('invalid_state')
		})
		deps.credentials.evict(actor.accountId)
	}

	return {
		readConnection: (accountId: string) => readConnection(deps.db, accountId),
		async beginConsent(actor: ConsentActor): Promise<{ url: string }> {
			return deps.lease.run(actor.accountId, async (context) => {
				const session = await requireConsentSession(context.db, actor)
				await context.db.insert(googleConnections).values({ accountId: actor.accountId }).onConflictDoNothing()
				const row = await findConnection(context.db, actor.accountId)
				if (!row || row.credentialMode === 'revoke_only') throw new CalendarFault('disconnect_failed')
				const state = randomBytes(32).toString('base64url')
				const verifier = randomBytes(32).toString('base64url')
				const encryptedVerifier = deps.envelope.seal(verifier, {
					accountId: actor.accountId,
					connectionId: row.id,
					generation: row.generation,
					purpose: 'verifier',
				})
				await context.db.insert(googleOAuthFlows).values({
					stateDigest: digest(state),
					accountId: actor.accountId,
					connectionId: row.id,
					sessionTokenHash: session.tokenHash,
					sessionEpoch: session.epoch,
					generation: row.generation,
					encryptedVerifier,
					expiresAt: sql`now() + interval '10 minutes'`,
				})
				return { url: deps.gateway.authorizationUrl(state, createHash('sha256').update(verifier).digest('base64url')) }
			})
		},
		async completeConsent(actor: ConsentActor, input: ConsentCallback): Promise<void> {
			await deps.lease.run(actor.accountId, async (context) => {
				const row = await findConnection(context.db, actor.accountId)
				if (!row || row.credentialMode === 'revoke_only') throw new CalendarFault('invalid_state')
				const flow = await consume(context, actor, input, row)
				if ('error' in input) throw new CalendarFault('denied')
				if (!flow.encryptedVerifier) throw new CalendarFault('invalid_state')
				const verifier = deps.envelope.open(flow.encryptedVerifier, {
					accountId: actor.accountId,
					connectionId: row.id,
					generation: flow.generation,
					purpose: 'verifier',
				})
				const tokens = await deps.gateway.exchange(input.code, verifier, context.signal)
				const primary = await deps.gateway.primary(tokens.access_token, context.signal)
				await install(context, actor, row, tokens, primary)
			})
		},
	}
}

export type CalendarConnection = ReturnType<typeof createConnection>
