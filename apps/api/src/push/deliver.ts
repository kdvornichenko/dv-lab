import { eq, sql } from 'drizzle-orm'
import type { Logger } from 'pino'
import webpush from 'web-push'

import { type Database, pushSubscriptions } from '@dv-lab/db'

import type { PushConfig } from '../config.ts'
import type { PushDeliver } from './scheduler.ts'

type SendNotification = typeof webpush.sendNotification

type WebPushDeliverOptions = {
	push: Extract<PushConfig, { enabled: true }>
	db: Database
	logger: Logger
	send?: SendNotification
}

const TTL_SECONDS = 600
const SOCKET_TIMEOUT_MS = 10_000
const GONE = new Set([404, 410])

function statusOf(error: unknown): number | null {
	if (typeof error !== 'object' || error === null || !('statusCode' in error)) return null
	return typeof error.statusCode === 'number' ? error.statusCode : null
}

export function createWebPushDeliver({
	push,
	db,
	logger,
	send = webpush.sendNotification,
}: WebPushDeliverOptions): PushDeliver {
	const options = {
		vapidDetails: { subject: push.subject, publicKey: push.publicKey, privateKey: push.privateKey },
		TTL: TTL_SECONDS,
		timeout: SOCKET_TIMEOUT_MS,
	}
	return async (subscription, payload, urgency) => {
		const byId = eq(pushSubscriptions.id, subscription.id)
		try {
			const result = await send(
				{ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
				JSON.stringify(payload),
				urgency === undefined ? options : { ...options, TTL: urgency.ttlSeconds, urgency: urgency.urgency }
			)
			await db
				.update(pushSubscriptions)
				.set({ lastSuccessAt: sql`now()`, failedAt: null })
				.where(byId)
			logger.debug({ subscriptionId: subscription.id, statusCode: result.statusCode }, 'push delivered')
		} catch (error) {
			const statusCode = statusOf(error)
			if (statusCode !== null && GONE.has(statusCode)) {
				await db
					.update(pushSubscriptions)
					.set({ revokedAt: sql`coalesce(${pushSubscriptions.revokedAt}, now())` })
					.where(byId)
				logger.info({ subscriptionId: subscription.id, statusCode }, 'push subscription gone')
				return
			}
			await db
				.update(pushSubscriptions)
				.set({ failedAt: sql`now()` })
				.where(byId)
			logger.warn({ subscriptionId: subscription.id, statusCode }, 'push delivery failed')
		}
	}
}
