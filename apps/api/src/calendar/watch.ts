import { and, eq, isNull, sql } from 'drizzle-orm'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Logger } from 'pino'

import { googleSyncState, type Database } from '@dv-lab/db'

import type { ChannelPair, ChannelRequest } from './gateway-sync.ts'
import type { SyncFacts } from './projection.ts'

export type WatchSource = {
	watch(
		token: string,
		calendarId: string,
		request: ChannelRequest,
		signal: AbortSignal
	): Promise<{ resourceId: string; expiresAt: Date }>
	stopChannel(token: string, pair: ChannelPair, signal: AbortSignal): Promise<void>
}
export type WatchOutcome = 'insecure' | 'kept' | 'registered' | 'renewed' | 'watch_failed' | 'raced'

const CHANNEL_TTL_SECONDS = 604800
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000
const CALL_BUDGET_MS = 30000
const s = googleSyncState

export function channelTokenHash(token: string) {
	return createHash('sha256').update(token).digest('hex')
}

export function createCalendarWatch(deps: {
	db: Database
	source: WatchSource
	appOrigin: string
	logger: Pick<Logger, 'info' | 'warn'>
}) {
	const origin = new URL(deps.appOrigin)
	const secure = origin.protocol === 'https:'
	const address = `${origin.origin}/api/google/notifications`
	const budget = () => AbortSignal.timeout(CALL_BUDGET_MS)

	async function stop(pairs: readonly ChannelPair[], token: string) {
		let stopped = 0
		let failed = 0
		for (const pair of pairs) {
			try {
				await deps.source.stopChannel(token, pair, budget())
				stopped += 1
			} catch {
				failed += 1
			}
		}
		if (failed) deps.logger.warn({ stopped, failed }, 'Calendar channel stop failed')
		return { stopped, failed }
	}

	async function current(connectionId: string) {
		const [row] = await deps.db.select().from(s).where(eq(s.connectionId, connectionId))
		return row
	}

	async function stopRetiring(row: SyncFacts, token: string) {
		if (!row.retiringChannelId || !row.retiringResourceId) return
		const pair = { id: row.retiringChannelId, resourceId: row.retiringResourceId }
		const result = await stop([pair], token)
		const owner = and(eq(s.connectionId, row.connectionId), eq(s.retiringChannelId, pair.id))
		if (result.failed) {
			await deps.db
				.update(s)
				.set({ watchIssue: 'stop_failed', updatedAt: sql`now()` })
				.where(owner)
			return
		}
		await deps.db
			.update(s)
			.set({ retiringChannelId: null, retiringResourceId: null, watchIssue: null, updatedAt: sql`now()` })
			.where(owner)
	}

	async function register(row: SyncFacts, token: string) {
		const id = randomUUID()
		const secret = randomBytes(32).toString('base64url')
		try {
			const channel = await deps.source.watch(
				token,
				row.calendarId,
				{ id, token: secret, address, ttlSeconds: CHANNEL_TTL_SECONDS },
				budget()
			)
			return { id, resourceId: channel.resourceId, tokenHash: channelTokenHash(secret), expiresAt: channel.expiresAt }
		} catch {
			return null
		}
	}

	async function maintain(row: SyncFacts, token: string): Promise<WatchOutcome> {
		if (!secure) return 'insecure'
		await stopRetiring(row, token)
		const fresh = (await current(row.connectionId)) ?? row
		const now = Date.now()
		const live = fresh.channelId !== null && fresh.channelExpiresAt !== null && fresh.channelExpiresAt.getTime() > now
		if (live && fresh.channelExpiresAt && fresh.channelExpiresAt.getTime() - now > RENEW_BEFORE_MS) return 'kept'
		if (live && fresh.retiringChannelId) return 'kept'
		const channel = await register(fresh, token)
		if (!channel) {
			await deps.db
				.update(s)
				.set({ watchIssue: 'watch_failed', updatedAt: sql`now()` })
				.where(eq(s.connectionId, fresh.connectionId))
			deps.logger.warn({ failed: 1 }, 'Calendar channel registration failed')
			return 'watch_failed'
		}
		const retiring =
			live && fresh.channelId && fresh.channelResourceId
				? { retiringChannelId: fresh.channelId, retiringResourceId: fresh.channelResourceId }
				: {}
		const [updated] = await deps.db
			.update(s)
			.set({
				channelId: channel.id,
				channelResourceId: channel.resourceId,
				channelTokenHash: channel.tokenHash,
				channelExpiresAt: channel.expiresAt,
				...retiring,
				watchIssue: null,
				updatedAt: sql`now()`,
			})
			.where(
				and(
					eq(s.connectionId, fresh.connectionId),
					fresh.channelId === null ? isNull(s.channelId) : eq(s.channelId, fresh.channelId)
				)
			)
			.returning()
		if (!updated) {
			await stop([{ id: channel.id, resourceId: channel.resourceId }], token)
			return 'raced'
		}
		deps.logger.info({ registered: 1, renewed: live ? 1 : 0 }, 'Calendar channel registered')
		if (!live) return 'registered'
		await stopRetiring(updated, token)
		return 'renewed'
	}

	async function stopAll(connectionId: string, token: string) {
		const row = await current(connectionId)
		if (!row) return { stopped: 0, failed: 0 }
		const pairs: ChannelPair[] = []
		if (row.channelId && row.channelResourceId) pairs.push({ id: row.channelId, resourceId: row.channelResourceId })
		if (row.retiringChannelId && row.retiringResourceId)
			pairs.push({ id: row.retiringChannelId, resourceId: row.retiringResourceId })
		return stop(pairs, token)
	}

	return { maintain, stop, stopAll }
}

export type CalendarWatch = ReturnType<typeof createCalendarWatch>
