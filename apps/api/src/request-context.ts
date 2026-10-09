import { AsyncLocalStorage } from 'node:async_hooks'
import type { MiddlewareHandler } from 'hono'
import pino, { type DestinationStream, type Logger } from 'pino'

const storage = new AsyncLocalStorage<{ requestId: string }>()

export const currentRequestId = () => storage.getStore()?.requestId

export function createLogger(level: string, destination?: DestinationStream): Logger {
	return pino({ level }, destination)
}

export const requestContext =
	(_logger: Logger): MiddlewareHandler<{ Variables: { requestId: string } }> =>
	async (_c, next) => {
		await next()
	}

export const errorBody = (code: string, message: string) => ({
	error: { code, message, requestId: currentRequestId() },
})
