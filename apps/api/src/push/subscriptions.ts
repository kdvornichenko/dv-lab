import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import type { PushDevice, PushSubscribeRequest } from '@dv-lab/contracts'
import { type DbExecutor, pushSubscriptions } from '@dv-lab/db'

export type SaveSubscriptionResult = { kind: 'created'; id: string } | { kind: 'updated'; id: string } | { kind: 'taken' }

export type ActiveSubscription = {
	id: string
	endpoint: string
	p256dh: string
	auth: string
	secondTimeZone: string | null
}

export async function saveSubscription(
	executor: DbExecutor,
	accountId: string,
	input: PushSubscribeRequest
): Promise<SaveSubscriptionResult> {
	const [row] = await executor
		.insert(pushSubscriptions)
		.values({
			accountId,
			endpoint: input.endpoint,
			p256dh: input.keys.p256dh,
			auth: input.keys.auth,
			deviceLabel: input.deviceLabel ?? null,
			secondTimeZone: input.secondTimeZone ?? null,
			lastSeenAt: sql`now()`,
		})
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: {
				p256dh: input.keys.p256dh,
				auth: input.keys.auth,
				...(input.deviceLabel === undefined ? {} : { deviceLabel: input.deviceLabel }),
				...(input.secondTimeZone === undefined ? {} : { secondTimeZone: input.secondTimeZone }),
				lastSeenAt: sql`now()`,
				revokedAt: null,
			},
			setWhere: eq(pushSubscriptions.accountId, accountId),
		})
		.returning({ id: pushSubscriptions.id, inserted: sql<boolean>`(xmax = 0)` })
	if (!row) return { kind: 'taken' }
	return { kind: row.inserted ? 'created' : 'updated', id: row.id }
}

export async function removeSubscription(executor: DbExecutor, accountId: string, endpoint: string): Promise<boolean> {
	const rows = await executor
		.update(pushSubscriptions)
		.set({ revokedAt: sql`coalesce(${pushSubscriptions.revokedAt}, now())` })
		.where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.accountId, accountId)))
		.returning({ id: pushSubscriptions.id })
	return rows.length > 0
}

export async function touchSubscription(
	executor: DbExecutor,
	accountId: string,
	endpoint: string,
	secondTimeZone: string | undefined
): Promise<boolean> {
	const rows = await executor
		.update(pushSubscriptions)
		.set({ lastSeenAt: sql`now()`, ...(secondTimeZone === undefined ? {} : { secondTimeZone }) })
		.where(
			and(
				eq(pushSubscriptions.endpoint, endpoint),
				eq(pushSubscriptions.accountId, accountId),
				isNull(pushSubscriptions.revokedAt)
			)
		)
		.returning({ id: pushSubscriptions.id })
	return rows.length > 0
}

export function activeSubscriptions(executor: DbExecutor, accountId: string): Promise<ActiveSubscription[]> {
	return executor
		.select({
			id: pushSubscriptions.id,
			endpoint: pushSubscriptions.endpoint,
			p256dh: pushSubscriptions.p256dh,
			auth: pushSubscriptions.auth,
			secondTimeZone: pushSubscriptions.secondTimeZone,
		})
		.from(pushSubscriptions)
		.where(and(eq(pushSubscriptions.accountId, accountId), isNull(pushSubscriptions.revokedAt)))
		.orderBy(asc(pushSubscriptions.createdAt))
}

export async function listDevices(executor: DbExecutor, accountId: string): Promise<PushDevice[]> {
	const rows = await executor
		.select({
			id: pushSubscriptions.id,
			deviceLabel: pushSubscriptions.deviceLabel,
			revokedAt: pushSubscriptions.revokedAt,
			lastSuccessAt: pushSubscriptions.lastSuccessAt,
		})
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.accountId, accountId))
		.orderBy(asc(pushSubscriptions.createdAt))
	return rows.map((row) => ({
		id: row.id,
		deviceLabel: row.deviceLabel,
		revoked: row.revokedAt !== null,
		lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
	}))
}
