import { describe, expect, it } from 'vitest'

import { loadConfig } from '../src/config.ts'

const databaseUrl = 'postgres://dvlab_app:config-test-secret@127.0.0.1:5432/dvlab_test'

const minimal = {
	NODE_ENV: 'test',
	PORT: '4000',
	APP_ORIGIN: 'https://dv-lab.dev/',
	DATABASE_URL: databaseUrl,
}

function failure(env: NodeJS.ProcessEnv) {
	try {
		loadConfig(env)
	} catch (error) {
		return (error as Error).message
	}
	throw new Error('loadConfig accepted an invalid environment')
}

describe('loadConfig', () => {
	it('fills defaults, strips the trailing slash of APP_ORIGIN and takes the app database URL', () => {
		const config = loadConfig({ ...minimal })

		expect(config).toEqual({
			NODE_ENV: 'test',
			PORT: 4000,
			APP_ORIGIN: 'https://dv-lab.dev',
			LOG_LEVEL: 'info',
			SHUTDOWN_DEADLINE_MS: 10000,
			GIT_SHA: 'unknown',
			databaseUrl,
		})
	})

	it.each([
		['abc', 'abc'],
		['empty', ''],
		['zero', '0'],
		['above 65535', '70000'],
	])('rejects PORT %s instead of substituting a default', (_name, value) => {
		const message = failure({ ...minimal, PORT: value })

		expect(message).toContain('Invalid environment')
		expect(message).toContain('PORT')
	})

	it('rejects a missing PORT', () => {
		const { PORT: _port, ...env } = minimal

		expect(failure(env)).toContain('PORT')
	})

	it.each([
		['with a path', 'https://dv-lab.dev/x'],
		['with a query', 'https://dv-lab.dev/?a=1'],
		['that is not a URL', 'dv-lab'],
		['with a non-http scheme', 'ftp://dv-lab.dev'],
	])('rejects APP_ORIGIN %s', (_name, value) => {
		expect(failure({ ...minimal, APP_ORIGIN: value })).toContain('APP_ORIGIN')
	})

	it('rejects an unknown LOG_LEVEL', () => {
		expect(failure({ ...minimal, LOG_LEVEL: 'verbose' })).toContain('LOG_LEVEL')
	})

	it.each(['999', '60001'])('rejects SHUTDOWN_DEADLINE_MS %s outside 1000..60000', (value) => {
		expect(failure({ ...minimal, SHUTDOWN_DEADLINE_MS: value })).toContain('SHUTDOWN_DEADLINE_MS')
	})

	it('does not put the database URL or its password into the error text', () => {
		const message = failure({ ...minimal, PORT: 'abc' })

		expect(message).not.toContain(databaseUrl)
		expect(message).not.toContain('config-test-secret')
	})

	it('refuses a test run against a database without the _test suffix', () => {
		const message = failure({ ...minimal, DATABASE_URL: 'postgres://dvlab_app:x@127.0.0.1:5432/dvlab' })

		expect(message).toContain('DATABASE_URL')
	})
})
