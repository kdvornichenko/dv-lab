import type { MiddlewareHandler } from 'hono'
import { AsyncLocalStorage } from 'node:async_hooks'
import pino, { type DestinationStream, type Logger } from 'pino'

const storage = new AsyncLocalStorage<{ requestId: string }>()
const VALID_ID = /^[\w-]{8,64}$/

const currentRequestId = () => storage.getStore()?.requestId

export function createLogger(level: string, destination?: DestinationStream): Logger {
	return pino(
		{
			level,
			base: { service: 'api' },
			timestamp: pino.stdTimeFunctions.isoTime,
			formatters: { level: (label) => ({ level: label }) },
			mixin: () => ({ requestId: currentRequestId() }),
			redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[redacted]' },
		},
		destination
	)
}

export const requestContext =
	(logger: Logger): MiddlewareHandler<{ Variables: { requestId: string } }> =>
	async (c, next) => {
		const incoming = c.req.header('x-request-id')
		const requestId = incoming && VALID_ID.test(incoming) ? incoming : crypto.randomUUID()
		c.set('requestId', requestId)
		c.header('x-request-id', requestId)
		const started = performance.now()
		await storage.run({ requestId }, async () => {
			try {
				await next()
			} finally {
				logger.info(
					{
						method: c.req.method,
						path: c.req.path,
						status: c.res.status,
						durationMs: Math.round(performance.now() - started),
					},
					'request'
				)
			}
		})
	}

export const errorBody = (code: string, message: string) => ({
	error: { code, message, requestId: currentRequestId() },
})
