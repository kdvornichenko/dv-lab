import { and, count, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import { createHash, randomBytes, randomUUID } from 'node:crypto'

import {
	googleConnectionSnapshot,
	type ChooseGoogleCalendarRequest,
	type GoogleCalendarList,
	type GoogleConnectionSnapshot,
} from '@dv-lab/contracts'
import {
	googleCommands,
	googleConnections,
	googleEventMappings,
	googleOAuthFlows,
	type Database,
	type DbExecutor,
} from '@dv-lab/db'

import type { WritableCalendar } from './gateway-sync.ts'
import { CalendarFault, type GoogleGateway, type GoogleTokens, type PrimaryCalendar } from './gateway.ts'
import {
	credentialBinding,
	currentConnection,
	findConnection,
	type ConnectionRow,
	type Credentials,
} from './google-access.ts'
import { CommandFault } from './journal.ts'
import type { ConnectionLease, ConnectionLeaseContext } from './lease.ts'
import { requireConsentSession, type ConsentActor } from './oauth-session.ts'
import type { CalendarObservation } from './observation.ts'
import { ensureSyncRow, retireSyncRow } from './sync-store.ts'
import type { TokenEnvelope } from './token-envelope.ts'
import type { CalendarWatch } from './watch.ts'

const actions: Record<GoogleConnectionSnapshot['state'], GoogleConnectionSnapshot['allowedActions']> = {
	not_connected: ['connect', 'switch'],
	connected: ['disconnect', 'switch'],
	reconnect_required: ['reconnect', 'disconnect', 'switch'],
	permission_required: ['reconnect', 'disconnect', 'switch'],
	disconnecting: [],
	disconnect_failed: ['retry_disconnect', 'confirm_revoked'],
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const LIST_BUDGET_MS = 30000
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
		allowedActions: actions[state].filter((action) => action !== 'switch' || row?.calendarId),
	})
}

async function unresolved(executor: DbExecutor, accountId: string) {
	const [pending] = await executor
		.select({ value: count() })
		.from(googleCommands)
		.where(and(eq(googleCommands.accountId, accountId), notInArray(googleCommands.state, ['applied', 'failed'])))
	return (pending?.value ?? 0) > 0
}

function choice(row: ConnectionRow | undefined, input: ChooseGoogleCalendarRequest): ConnectionRow | null {
	if (!row || row.state !== 'connected') throw new CalendarFault('connection_required')
	if (row.generation !== input.expectedGeneration) throw new CommandFault('precondition_failed')
	return row.calendarId === input.calendarId ? null : row
}

export function createConnection(deps: {
	db: Database
	lease: ConnectionLease
	envelope: TokenEnvelope
	gateway: GoogleGateway
	credentials: Credentials
	observation: CalendarObservation
	watch: Pick<CalendarWatch, 'stop'>
	wake: (connectionId: string) => void
}) {
	async function consentTarget(
		row: ConnectionRow,
		primary: PrimaryCalendar,
		accessToken: string,
		signal: AbortSignal
	): Promise<PrimaryCalendar> {
		if (row.calendarId === null || row.calendarId === primary.id) return primary
		const kept = (await deps.gateway.calendars(accessToken, signal)).find((calendar) => calendar.id === row.calendarId)
		return kept ? { id: kept.id, label: kept.label, timeZone: kept.timeZone } : primary
	}

	async function switchCalendar(
		tx: DbExecutor,
		row: ConnectionRow,
		sealed: NonNullable<ConnectionRow['encryptedRefreshToken']>,
		chosen: WritableCalendar
	) {
		const refreshToken = deps.envelope.open(sealed, credentialBinding(row))
		const id = randomUUID()
		const credentialGeneration = row.credentialGeneration + 1
		const encryptedRefreshToken = deps.envelope.seal(refreshToken, {
			...credentialBinding({ ...row, id }),
			generation: credentialGeneration,
		})
		const [retired] = await tx
			.update(googleConnections)
			.set({
				state: 'not_connected',
				issue: 'connection_required',
				encryptedRefreshToken: null,
				credentialMode: null,
				revokeAttemptId: null,
				revokeStartedAt: null,
				revokeFinishedAt: null,
				retiredAt: sql`now()`,
				updatedAt: sql`now()`,
			})
			.where(
				and(
					eq(googleConnections.id, row.id),
					eq(googleConnections.generation, row.generation),
					eq(googleConnections.credentialGeneration, row.credentialGeneration),
					eq(googleConnections.state, 'connected'),
					isNull(googleConnections.retiredAt)
				)
			)
			.returning({ id: googleConnections.id })
		if (!retired) throw new CommandFault('precondition_failed')
		await tx.insert(googleConnections).values({
			id,
			accountId: row.accountId,
			state: 'connected',
			issue: null,
			calendarId: chosen.id,
			calendarLabel: chosen.label,
			calendarTimeZone: chosen.timeZone,
			historyCutoverAt: new Date(),
			generation: row.generation + 1,
			credentialGeneration,
			encryptedRefreshToken,
			credentialMode: 'active',
			disconnectResolution: 'none',
			snapshotRevision: row.snapshotRevision,
		})
		const pairs = await retireSyncRow(tx, row.id)
		await ensureSyncRow(tx, { id, accountId: row.accountId, calendarId: chosen.id }, new Date())
		return { id, pairs }
	}

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

	async function retire(tx: DbExecutor, row: ConnectionRow) {
		if (await unresolved(tx, row.accountId)) throw new CalendarFault('command_pending')
		const [retired] = await tx
			.update(googleConnections)
			.set({ retiredAt: sql`now()`, updatedAt: sql`now()` })
			.where(
				and(
					eq(googleConnections.id, row.id),
					eq(googleConnections.generation, row.generation),
					eq(googleConnections.credentialGeneration, row.credentialGeneration),
					eq(googleConnections.state, 'not_connected'),
					isNull(googleConnections.retiredAt)
				)
			)
			.returning({ id: googleConnections.id })
		if (!retired) throw new CalendarFault('invalid_state')
		await tx
			.update(googleEventMappings)
			.set({ state: 'retired', retiredAt: sql`now()` })
			.where(
				and(
					eq(googleEventMappings.accountId, row.accountId),
					eq(googleEventMappings.connectionId, row.id),
					inArray(googleEventMappings.state, ['reserved', 'active'])
				)
			)
	}

	async function install(
		context: ConnectionLeaseContext,
		actor: ConsentActor,
		row: ConnectionRow,
		tokens: GoogleTokens,
		calendar: PrimaryCalendar,
		issuedAt: number
	) {
		const switching = row.calendarId !== null && row.calendarId !== calendar.id
		if (switching && row.state !== 'not_connected') throw new CalendarFault('wrong_primary')
		const refreshToken =
			tokens.refresh_token ??
			(!switching && row.encryptedRefreshToken
				? deps.envelope.open(row.encryptedRefreshToken, credentialBinding(row))
				: null)
		if (!refreshToken) throw new CalendarFault('missing_refresh_token')
		context.signal.throwIfAborted()
		const id = switching ? randomUUID() : row.id
		const credentialGeneration = row.credentialGeneration + 1
		const encryptedRefreshToken = deps.envelope.seal(refreshToken, {
			...credentialBinding({ ...row, id }),
			generation: credentialGeneration,
		})
		const target = {
			state: 'connected' as const,
			issue: null,
			calendarId: calendar.id,
			calendarLabel: calendar.label,
			calendarTimeZone: calendar.timeZone,
			generation: row.generation + 1,
			credentialGeneration,
			encryptedRefreshToken,
			credentialMode: 'active' as const,
			disconnectResolution: 'none' as const,
			revokeAttemptId: null,
			revokeStartedAt: null,
			revokeFinishedAt: null,
			updatedAt: sql`now()`,
		}
		const returning = {
			id: googleConnections.id,
			generation: googleConnections.generation,
			credentialGeneration: googleConnections.credentialGeneration,
		}
		const installed = await context.db.transaction(async (tx) => {
			await requireConsentSession(tx, actor)
			if (switching) {
				await retire(tx, row)
				const [created] = await tx
					.insert(googleConnections)
					.values({
						...target,
						id,
						accountId: row.accountId,
						historyCutoverAt: new Date(),
						snapshotRevision: row.snapshotRevision,
					})
					.returning(returning)
				if (!created) throw new CalendarFault('invalid_state')
				return created
			}
			const [updated] = await tx
				.update(googleConnections)
				.set({ ...target, historyCutoverAt: row.historyCutoverAt ?? new Date() })
				.where(
					and(
						eq(googleConnections.id, row.id),
						eq(googleConnections.generation, row.generation),
						eq(googleConnections.credentialGeneration, row.credentialGeneration),
						isNull(googleConnections.retiredAt)
					)
				)
				.returning(returning)
			if (!updated) throw new CalendarFault('invalid_state')
			return updated
		})
		deps.observation.consentAccepted(installed, issuedAt, tokens.expiry_date)
		deps.credentials.evict(actor.accountId)
	}

	return {
		readConnection: (accountId: string) => readConnection(deps.db, accountId),
		async listCalendars(actor: ConsentActor): Promise<GoogleCalendarList> {
			const access = await deps.credentials.accessToken(actor.accountId, AbortSignal.timeout(LIST_BUDGET_MS))
			const calendars = await deps.gateway.calendars(access.accessToken, access.signal)
			return {
				calendars: calendars.map((calendar) => ({
					...calendar,
					current: calendar.id === access.connection.calendarId,
				})),
			}
		},
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
				deps.observation.consentStarted(row)
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
				const issuedAt = Date.now()
				const primary = await deps.gateway.primary(tokens.access_token, context.signal)
				const target = await consentTarget(row, primary, tokens.access_token, context.signal)
				await install(context, actor, row, tokens, target, issuedAt)
			})
		},
		async chooseCalendar(actor: ConsentActor, input: ChooseGoogleCalendarRequest): Promise<GoogleConnectionSnapshot> {
			const switched = await deps.lease.run(actor.accountId, async (context) => {
				if (!choice(await findConnection(context.db, actor.accountId), input)) return null
				if (await unresolved(context.db, actor.accountId)) throw new CalendarFault('command_pending')
				const access = await deps.credentials.accessToken(actor.accountId, context.signal)
				const calendars = await deps.gateway.calendars(access.accessToken, context.signal)
				const chosen = calendars.find((calendar) => calendar.id === input.calendarId)
				if (!chosen) throw new CommandFault('invalid_request', 400)
				context.signal.throwIfAborted()
				const moved = await context.db.transaction(async (tx) => {
					await requireConsentSession(tx, actor)
					const [locked] = await tx
						.select()
						.from(googleConnections)
						.where(currentConnection(actor.accountId))
						.for('update')
						.limit(1)
					const current = choice(locked, input)
					if (!current?.encryptedRefreshToken) throw new CommandFault('precondition_failed')
					if (await unresolved(tx, actor.accountId)) throw new CalendarFault('command_pending')
					return switchCalendar(tx, current, current.encryptedRefreshToken, chosen)
				})
				return { ...moved, token: access.accessToken }
			})
			deps.credentials.evict(actor.accountId)
			if (switched) {
				if (switched.pairs.length) await deps.watch.stop(switched.pairs, switched.token)
				deps.wake(switched.id)
			}
			return readConnection(deps.db, actor.accountId)
		},
	}
}

export type CalendarConnection = ReturnType<typeof createConnection>
