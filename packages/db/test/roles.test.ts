import { eq, sql } from 'drizzle-orm'
import { readdirSync } from 'node:fs'
import { afterAll, beforeEach, describe, expect, test } from 'vitest'

import { createDb, resolveDatabaseUrl } from '../src/connection.ts'
import { migrationsFolder, runMigrations } from '../src/migrate.ts'
import { appInfo } from '../src/schema.ts'

const app = createDb(resolveDatabaseUrl('app', process.env))
const migrator = createDb(resolveDatabaseUrl('migrator', process.env))

function pgCode(error: unknown): unknown {
	if (!(error instanceof Error)) return undefined
	if ('code' in error && typeof error.code === 'string') return error.code
	return pgCode(error.cause)
}

async function rejectionCode(action: PromiseLike<unknown>): Promise<unknown> {
	try {
		await action
	} catch (error) {
		return pgCode(error)
	}
	return 'resolved'
}

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

	test('app role has no elevated attributes', async () => {
		const { rows } = await app.pool.query(
			'select current_user as role, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls from pg_roles where rolname = current_user'
		)
		expect(rows).toEqual([
			{ role: 'dvlab_app', rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false },
		])
	})

	test('app role cannot create tables', async () => {
		expect(await rejectionCode(app.db.execute(sql`create table app_role_probe (id integer)`))).toBe('42501')
	})

	test('app role cannot truncate app_info', async () => {
		expect(await rejectionCode(app.db.execute(sql`truncate table app_info`))).toBe('42501')
	})

	test('app role cannot read the migrations journal', async () => {
		expect(await rejectionCode(app.db.execute(sql`select * from drizzle.__drizzle_migrations`))).toBe('42501')
	})

	test('app role uses pg_trgm through its search_path', async () => {
		const { rows } = await app.pool.query("select similarity('dvlab', 'dvlab') as score")
		expect(rows).toEqual([{ score: 1 }])
	})

	test('app role cannot run migrations', async () => {
		expect(await rejectionCode(runMigrations(resolveDatabaseUrl('app', process.env)))).toBe('42501')
	})
})

describe('migrator role', () => {
	test('migrator role is not a superuser and owns the database', async () => {
		const { rows } = await migrator.pool.query(
			'select current_user as role, (select rolsuper from pg_roles where rolname = current_user) as rolsuper, pg_get_userbyid(datdba) as owner from pg_database where datname = current_database()'
		)
		expect(rows).toEqual([{ role: 'dvlab_migrator', rolsuper: false, owner: 'dvlab_migrator' }])
	})

	test('concurrent migrations both finish with one journal entry per migration folder', async () => {
		const folders = readdirSync(migrationsFolder, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
		const url = resolveDatabaseUrl('migrator', process.env)
		expect(await Promise.all([runMigrations(url), runMigrations(url)])).toEqual([folders, folders])
	})
})
