import { Hono } from 'hono'
import { timingSafeEqual } from 'node:crypto'

import type { Database } from '@dv-lab/db'

import type { AppEnv } from '../auth/middleware.ts'
import { notificationTarget, requestPass } from '../calendar/sync-store.ts'
import { channelTokenHash } from '../calendar/watch.ts'

const BUMP_INTERVAL_MS = 1000
const TRACKED_CHANNELS = 1024
const TOKEN_LIMIT = 256

function sameHash(stored: string, actual: string) {
	const left = Buffer.from(stored, 'hex')
	const right = Buffer.from(actual, 'hex')
	return left.length === right.length && left.length > 0 && timingSafeEqual(left, right)
}

export function googleNotificationRoutes(deps: { db: Database; wake?: (connectionId: string) => void }) {
	const app = new Hono<AppEnv>()
	const lastBump = new Map<string, number>()
	app.post('/', async (c) => {
		const channelId = c.req.header('x-goog-channel-id') ?? ''
		const token = c.req.header('x-goog-channel-token') ?? ''
		const state = c.req.header('x-goog-resource-state') ?? ''
		if (!token || token.length > TOKEN_LIMIT) return c.body(null, 404)
		const target = await notificationTarget(deps.db, channelId)
		if (!target || !sameHash(target.tokenHash, channelTokenHash(token))) return c.body(null, 404)
		if (state === 'sync') return c.body(null, 204)
		const now = Date.now()
		if (now - (lastBump.get(channelId) ?? 0) < BUMP_INTERVAL_MS) return c.body(null, 204)
		if (lastBump.size >= TRACKED_CHANNELS) lastBump.clear()
		lastBump.set(channelId, now)
		const connectionId = await requestPass(deps.db, channelId)
		if (connectionId) deps.wake?.(connectionId)
		return c.body(null, 204)
	})
	return app
}
