import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, test } from 'vitest'

import { createDb, resolveDatabaseUrl } from '../src/connection.ts'
import { appInfo } from '../src/schema.ts'

const app = createDb(resolveDatabaseUrl('app', process.env))
const migrator = createDb(resolveDatabaseUrl('migrator', process.env))

beforeEach(async () => {
	await migrator.db.execute(sql`truncate table app_info`)
})

afterAll(async () => {
	await Promise.all([app.pool.end(), migrator.pool.end()])
})

describe('app role', () => {
	test('app role writes and reads app_info', async () => {
		await app.db.insert(appInfo).values({ key: 'greeting', value: 'hello' })
		expect(await app.db.select({ value: appInfo.value }).from(appInfo).where(eq(appInfo.key, 'greeting'))).toEqual([
			{ value: 'hello' },
		])

		await app.db.update(appInfo).set({ value: 'bye' }).where(eq(appInfo.key, 'greeting'))
		expect(await app.db.select({ value: appInfo.value }).from(appInfo).where(eq(appInfo.key, 'greeting'))).toEqual([
			{ value: 'bye' },
		])

		await app.db.delete(appInfo).where(eq(appInfo.key, 'greeting'))
		expect(await app.db.select().from(appInfo)).toEqual([])
	})
})
