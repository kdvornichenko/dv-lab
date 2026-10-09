import { Writable } from 'node:stream'
import { setTimeout as sleep } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { createLogger } from '../src/request-context.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

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

describe('request context', () => {
	it('writes one access line with the incoming request id and echoes it in the response header', async () => {
		const { logger, records } = memoryLogger()
		const app = createApp({ logger })

		const res = await app.request('/healthz', { headers: { 'x-request-id': 'abc-12345' } })

		expect(res.status).toBe(200)
		expect(res.headers.get('x-request-id')).toBe('abc-12345')
		const lines = records()
		expect(lines).toHaveLength(1)
		expect(lines[0]).toMatchObject({
			requestId: 'abc-12345',
			method: 'GET',
			path: '/healthz',
			status: 200,
			level: 'info',
		})
		expect(typeof lines[0].durationMs).toBe('number')
	})

	it.each([
		['is absent', undefined],
		['is shorter than 8 characters', 'abcdefg'],
		['is longer than 64 characters', 'a'.repeat(65)],
		['contains a space', 'abc def 123'],
		['contains characters outside word and dash', 'abc.def/123'],
	])('replaces the request id with a UUID when the incoming id %s', async (_name, incoming) => {
		const { logger, records } = memoryLogger()
		const app = createApp({ logger })

		const res = await app.request('/healthz', incoming ? { headers: { 'x-request-id': incoming } } : {})

		const issued = res.headers.get('x-request-id')
		expect(issued).toMatch(UUID)
		expect(records()).toHaveLength(1)
		expect(records()[0].requestId).toBe(issued)
	})

	it('keeps an incoming id of exactly 64 characters', async () => {
		const { logger } = memoryLogger()
		const app = createApp({ logger })
		const id = 'a'.repeat(64)

		const res = await app.request('/healthz', { headers: { 'x-request-id': id } })

		expect(res.headers.get('x-request-id')).toBe(id)
	})

	it('answers a handler error with the generic envelope, hides the exception text and logs it with the same request id', async () => {
		const { logger, records } = memoryLogger()
		const app = createApp({ logger })
		app.get('/boom', () => {
			throw new Error('secret detail')
		})

		const res = await app.request('/boom', { headers: { 'x-request-id': 'boom-request-1' } })

		expect(res.status).toBe(500)
		const body = await res.json()
		expect(body).toEqual({
			error: { code: 'internal_error', message: 'Internal Server Error', requestId: 'boom-request-1' },
		})
		expect(JSON.stringify(body)).not.toContain('secret detail')
		const lines = records()
		expect(lines).toHaveLength(2)
		expect(lines[0]).toMatchObject({ level: 'error', requestId: 'boom-request-1', msg: 'request failed' })
		expect(lines[1]).toMatchObject({ level: 'info', requestId: 'boom-request-1', status: 500, path: '/boom' })
	})

	it('answers an unknown path with the not_found envelope carrying the response request id', async () => {
		const { logger, records } = memoryLogger()
		const app = createApp({ logger })

		const res = await app.request('/missing')

		expect(res.status).toBe(404)
		const issued = res.headers.get('x-request-id')
		expect(issued).toMatch(UUID)
		expect(await res.json()).toEqual({
			error: { code: 'not_found', message: 'Not Found', requestId: issued },
		})
		expect(records()[0]).toMatchObject({ requestId: issued, status: 404, path: '/missing' })
	})

	it('keeps the request id for a background task that finishes after the response', async () => {
		const { logger, records } = memoryLogger()
		const app = createApp({ logger })
		app.get('/background', (c) => {
			setTimeout(() => logger.info('background done'), 20)
			return c.text('accepted')
		})

		const res = await app.request('/background', { headers: { 'x-request-id': 'bg-request-1' } })
		await sleep(80)

		expect(res.status).toBe(200)
		const background = records().find((line) => line.msg === 'background done')
		expect(background).toMatchObject({ requestId: 'bg-request-1' })
	})

	it('gives concurrent requests their own request ids in access lines and in handler logs', async () => {
		const { logger, records } = memoryLogger()
		const app = createApp({ logger })
		app.get('/slow', async (c) => {
			await sleep(c.req.header('x-delay') === 'long' ? 40 : 10)
			logger.info('handler done')
			return c.text('done')
		})

		await Promise.all([
			app.request('/slow', { headers: { 'x-request-id': 'req-aaaa-1111', 'x-delay': 'long' } }),
			app.request('/slow', { headers: { 'x-request-id': 'req-bbbb-2222' } }),
		])

		const lines = records()
		const access = lines.filter((line) => line.msg === 'request')
		expect(access.map((line) => line.requestId).sort()).toEqual(['req-aaaa-1111', 'req-bbbb-2222'])
		const handler = lines.filter((line) => line.msg === 'handler done')
		expect(handler.map((line) => line.requestId).sort()).toEqual(['req-aaaa-1111', 'req-bbbb-2222'])
		expect(handler[0].requestId).toBe('req-bbbb-2222')
	})

	it('replaces cookie and authorization header values with [redacted] in logs', async () => {
		const { logger, raw, records } = memoryLogger()
		const app = createApp({ logger })
		app.get('/echo', (c) => {
			logger.info(
				{ req: { headers: { cookie: 'session=cookie-secret', authorization: 'Bearer token-secret' } } },
				'incoming',
			)
			return c.text('ok')
		})

		await app.request('/echo', { headers: { 'x-request-id': 'redact-req-1' } })

		const incoming = records().find((line) => line.msg === 'incoming')
		expect(incoming.req.headers).toEqual({ cookie: '[redacted]', authorization: '[redacted]' })
		expect(raw()).not.toContain('cookie-secret')
		expect(raw()).not.toContain('token-secret')
	})
})
