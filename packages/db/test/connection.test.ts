import { describe, expect, test } from 'vitest'

import { resolveDatabaseUrl } from '../src/connection.ts'

const appUrl = 'postgresql://dvlab_app:app-secret@HOST:5432/dvlab_test'
const migratorUrl = 'postgresql://dvlab_migrator:migrator-secret@HOST:5432/dvlab_test'

function errorOf(action: () => unknown): Error {
	try {
		action()
	} catch (error) {
		if (error instanceof Error) return error
		throw error
	}
	throw new Error('expected an error')
}

describe('resolveDatabaseUrl', () => {
	test('app role reads DATABASE_URL', () => {
		expect(resolveDatabaseUrl('app', { DATABASE_URL: appUrl, MIGRATOR_DATABASE_URL: migratorUrl })).toBe(appUrl)
	})

	test('migrator role reads MIGRATOR_DATABASE_URL', () => {
		expect(resolveDatabaseUrl('migrator', { DATABASE_URL: appUrl, MIGRATOR_DATABASE_URL: migratorUrl })).toBe(
			migratorUrl
		)
	})

	test('missing variable is reported by name', () => {
		expect(() => resolveDatabaseUrl('app', { MIGRATOR_DATABASE_URL: migratorUrl })).toThrow(
			'DATABASE_URL is missing or is not a postgres URL'
		)
	})

	test('empty variable is reported by name', () => {
		expect(() => resolveDatabaseUrl('migrator', { MIGRATOR_DATABASE_URL: '' })).toThrow(
			'MIGRATOR_DATABASE_URL is missing or is not a postgres URL'
		)
	})

	test('non-postgres URL is reported by name', () => {
		expect(() => resolveDatabaseUrl('app', { DATABASE_URL: 'http://dvlab_app:app-secret@HOST/dvlab_test' })).toThrow(
			'DATABASE_URL is missing or is not a postgres URL'
		)
	})

	test('invalid URL error does not reveal the password', () => {
		const error = errorOf(() =>
			resolveDatabaseUrl('app', { DATABASE_URL: 'http://dvlab_app:Leaky-Pass-42@HOST/dvlab_test' })
		)
		expect(error.message).not.toContain('Leaky-Pass-42')
		expect(String(error.cause ?? '')).not.toContain('Leaky-Pass-42')
	})

	test('wrong test database error does not reveal the password', () => {
		const error = errorOf(() =>
			resolveDatabaseUrl('app', {
				NODE_ENV: 'test',
				DATABASE_URL: 'postgresql://dvlab_app:Leaky-Pass-42@HOST:5432/dvlab_dev',
			})
		)
		expect(error.message).toBe('DATABASE_URL must point to a database whose name ends with _test')
		expect(String(error.cause ?? '')).not.toContain('Leaky-Pass-42')
	})

	test.each(['dvlab_dev', 'dvlab', 'dvlab_test2'])('test environment rejects database %s', (database) => {
		expect(() =>
			resolveDatabaseUrl('migrator', {
				NODE_ENV: 'test',
				MIGRATOR_DATABASE_URL: `postgresql://dvlab_migrator:migrator-secret@HOST:5432/${database}`,
			})
		).toThrow('MIGRATOR_DATABASE_URL must point to a database whose name ends with _test')
	})

	test('test environment accepts database dvlab_test', () => {
		expect(resolveDatabaseUrl('migrator', { NODE_ENV: 'test', MIGRATOR_DATABASE_URL: migratorUrl })).toBe(migratorUrl)
	})

	test('production environment accepts database dvlab', () => {
		const url = 'postgresql://dvlab_app:app-secret@HOST:5432/dvlab'
		expect(resolveDatabaseUrl('app', { NODE_ENV: 'production', DATABASE_URL: url })).toBe(url)
	})
})
