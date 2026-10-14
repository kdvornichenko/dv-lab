import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { accounts, createDb, googleCalendarEvents, googleConnections, resolveDatabaseUrl } from '@dv-lab/db'

import { upsertEventFacts, type EventFact } from '../src/calendar/projection.ts'

const env = { ...process.env, NODE_ENV: 'test' }
const app = createDb(resolveDatabaseUrl('app', env))
const migrator = createDb(resolveDatabaseUrl('migrator', env))
const accountId = randomUUID()
const connectionId = randomUUID()
const calendarId = `projection-${randomUUID()}@example.test`
const COUNT = 2600

function fact(index: number): EventFact {
	const start = new Date(Date.UTC(2026, 0, 1, 8) + index * 3600000)
	const end = new Date(start.getTime() + 1800000)
	return {
		eventId: `bulk-${index}`,
		etag: `"etag-${index}"`,
		status: 'confirmed',
		factAt: new Date(),
		recurringEventId: null,
		originalStartTime: null,
		eventType: 'default',
		start: { dateTime: start.toISOString(), timeZone: 'UTC' },
		end: { dateTime: end.toISOString(), timeZone: 'UTC' },
		summary: 'Event',
		transparency: 'opaque',
		description: null,
		location: null,
		colorId: null,
		markerLocalId: null,
		markerKind: null,
	}
}

beforeAll(async () => {
	await migrator.db.insert(accounts).values({
		id: accountId,
		login: `projection-${accountId}`,
		displayName: 'Projection',
		role: 'teacher',
		status: 'deactivated',
		passwordHash: 'x',
	})
	await migrator.db.insert(googleConnections).values({
		id: connectionId,
		accountId,
		calendarId,
		calendarLabel: 'Projection',
		calendarTimeZone: 'UTC',
		historyCutoverAt: new Date(),
	})
})

afterAll(async () => {
	await migrator.db.delete(googleCalendarEvents).where(eq(googleCalendarEvents.connectionId, connectionId))
	await migrator.db.delete(googleConnections).where(eq(googleConnections.id, connectionId))
	await migrator.db.delete(accounts).where(eq(accounts.id, accountId))
	await Promise.all([app.pool.end(), migrator.pool.end()])
})

describe('upsertEventFacts', () => {
	it('stores a full window larger than one statement can bind under the app role', async () => {
		const facts = Array.from({ length: COUNT }, (_, index) => fact(index))
		const result = await app.db.transaction((tx) =>
			upsertEventFacts(tx, { accountId, connectionId, calendarId }, facts, { seenEpoch: 1 })
		)

		expect(result).toEqual({ inserted: COUNT, changed: 0 })
		const [row] = await app.db
			.select({ count: sql<number>`count(*)::int` })
			.from(googleCalendarEvents)
			.where(eq(googleCalendarEvents.connectionId, connectionId))
		expect(row?.count).toBe(COUNT)
	})
})
