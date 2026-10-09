import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { createLogger } from '../src/request-context.ts'

function memoryLogger() {
	const lines: string[] = []
	const stream = new Writable({
		write(chunk, _encoding, done) {
			for (const line of chunk.toString().split('\n')) if (line) lines.push(line)
			done()
		},
	})
	return { logger: createLogger('info', stream), records: () => lines.map((line) => JSON.parse(line)) }
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
})
