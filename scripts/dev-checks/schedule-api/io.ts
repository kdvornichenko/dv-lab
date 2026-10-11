import type { Api, ApiPayload, CallOptions, Helpers, Reply } from './types.ts'

const helpers = (await import('../api.mjs')) as unknown as Helpers

export const { quote, sql, startApi, teacherCookie, studentCookie, TEACHER_LOGIN } = helpers

const FIXTURE_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function dateSensitive(method: string, path: string): boolean {
	if (method === 'PUT') return /^\/students\/[^/]+\/opening-balance$/.test(path)
	if (method !== 'POST') return false
	return (
		path === '/schedule/lessons' ||
		path === '/payments' ||
		/^\/schedule\/(?:lessons\/[^/]+\/move|series\/[^/]+\/(?:move|end|occurrences\/[^/]+\/move))$/.test(path)
	)
}

export function call<T = ApiPayload>(api: Api, method: string, path: string, options?: CallOptions): Promise<Reply<T>> {
	const body = options?.body
	if (body === undefined || body.expectedDefaultTimeZone !== undefined || !dateSensitive(method, path))
		return helpers.call<T>(api, method, path, options)
	return helpers.call<T>(api, method, path, {
		...options,
		body: { ...body, expectedDefaultTimeZone: FIXTURE_TIME_ZONE },
	})
}
