import { Writable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

import { type AppDeps, createApp } from '../src/app.ts'
import { createLogger } from '../src/request-context.ts'

function memoryLogger() {
	const lines: string[] = []
	const stream = new Writable({
		write(chunk, _encoding, done) {
			for (const line of chunk.toString().split('\n')) if (line) lines.push(line)
			done()
		},
	})
	return {
		logger: createLogger('info', stream),
		raw: () => lines.join('\n'),
		records: () => lines.map((line) => JSON.parse(line)),
	}
}

function build(execute: () => Promise<unknown>, stopping = false) {
	const log = memoryLogger()
	const db = { execute: vi.fn(execute) }
	const app = createApp({
		logger: log.logger,
		db: db as unknown as AppDeps['db'],
		gitSha: 'abc1234',
		appOrigin: 'http://localhost:3000',
		production: false,
		isStopping: () => stopping,
		signIn: {} as unknown as AppDeps['signIn'],
	})
	return { app, db, ...log }
}

describe('GET /healthz', () => {
	it('answers 200 with status ok, db ok and the sha after a database query', async () => {
		const { app, db } = build(async () => ({ rows: [{ '?column?': 1 }] }))

		const res = await app.request('/healthz')

		expect(res.status).toBe(200)
		expect(await res.json()).toEqual({ status: 'ok', sha: 'abc1234', db: 'ok' })
		expect(db.execute).toHaveBeenCalledTimes(1)
	})

	it('answers 503 with status stopping and skips the database while the process stops', async () => {
		const { app, db } = build(async () => ({ rows: [] }), true)

		const res = await app.request('/healthz')

		expect(res.status).toBe(503)
		expect(await res.json()).toEqual({ status: 'stopping', sha: 'abc1234' })
		expect(db.execute).not.toHaveBeenCalled()
	})

	it('answers 503 with status error and db error when the database query fails, and logs the cause', async () => {
		const { app, records } = build(async () => {
			throw new Error('connection refused by db-host-secret')
		})

		const res = await app.request('/healthz')

		expect(res.status).toBe(503)
		const body = await res.json()
		expect(body).toEqual({ status: 'error', sha: 'abc1234', db: 'error' })
		expect(JSON.stringify(body)).not.toContain('db-host-secret')
		const warning = records().find((line) => line.msg === 'health database check failed')
		expect(warning).toMatchObject({ level: 'warn' })
		expect(warning.err.message).toContain('connection refused')
	})
})
