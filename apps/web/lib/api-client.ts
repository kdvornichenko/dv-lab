import { errorCodes, type ErrorResponse } from '@dv-lab/contracts'

export type ApiResult<T> =
	{ ok: true; status: number; data: T } | { ok: false; status: number; error: ErrorResponse['error'] | null }

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export const API_CACHE_INVALIDATED = 'dvlab:cache-invalidated'
export const SESSION_CACHE_CHANNEL =
	typeof window === 'undefined' ? null : new BroadcastChannel('dvlab:session-changed')
export const DATA_CHANGED_CHANNEL = typeof window === 'undefined' ? null : new BroadcastChannel('dvlab:data-changed')

export async function apiRequest<T>(
	method: ApiMethod,
	path: string,
	body?: unknown,
	options?: { signal?: AbortSignal }
): Promise<ApiResult<T>> {
	let response: Response
	try {
		response = await fetch(`/api${path}`, {
			signal: options?.signal,
			method,
			credentials: 'same-origin',
			cache: 'no-store',
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
		})
	} catch {
		return { ok: false, status: 0, error: null }
	}
	notifyCache(response, method, path)
	if (response.status === 204) return { ok: true, status: 204, data: undefined as T }
	if (response.ok) {
		try {
			const data: unknown = await response.json()
			return { ok: true, status: response.status, data: data as T }
		} catch {
			return { ok: false, status: response.status, error: null }
		}
	}
	try {
		const payload: unknown = await response.json()
		return { ok: false, status: response.status, error: errorFrom(payload) }
	} catch {
		return { ok: false, status: response.status, error: null }
	}
}

export type EventSchema<T> = {
	safeParse: (value: unknown) => { success: true; data: T } | { success: false }
}

export type EventStreamResult = { ok: true } | { ok: false; status: number }

function eventData(frame: string): string {
	return frame
		.split('\n')
		.filter((line) => line.startsWith('data:'))
		.map((line) => line.slice(5).replace(/^ /, ''))
		.join('\n')
}

export async function apiEventStream<T>(
	path: string,
	options: { signal: AbortSignal; schema: EventSchema<T>; onEvent: (event: T) => void }
): Promise<EventStreamResult> {
	let response: Response
	try {
		response = await fetch(`/api${path}`, {
			signal: options.signal,
			method: 'GET',
			credentials: 'same-origin',
			cache: 'no-store',
			headers: { accept: 'text/event-stream' },
		})
	} catch {
		return { ok: false, status: 0 }
	}
	notifyCache(response, 'GET', path)
	if (!response.ok || response.body === null) return { ok: false, status: response.status }
	const reader = response.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ''
	try {
		for (;;) {
			const chunk = await reader.read()
			if (chunk.done) break
			buffer += decoder.decode(chunk.value, { stream: true })
			for (let cut = buffer.indexOf('\n\n'); cut >= 0; cut = buffer.indexOf('\n\n')) {
				const data = eventData(buffer.slice(0, cut))
				buffer = buffer.slice(cut + 2)
				if (data === '') continue
				let parsed: unknown
				try {
					parsed = JSON.parse(data)
				} catch {
					await reader.cancel()
					return { ok: false, status: response.status }
				}
				const checked = options.schema.safeParse(parsed)
				if (!checked.success) {
					await reader.cancel()
					return { ok: false, status: response.status }
				}
				options.onEvent(checked.data)
			}
		}
	} catch {
		return { ok: false, status: 0 }
	}
	return { ok: true }
}

const UNCHANGED_PATHS = new Set([
	'/auth/renew',
	'/google/conflicts',
	'/google/connect',
	'/google/disconnect',
	'/google/disconnect/confirm-revoked',
])

const STATUS_CHECK = /^\/chat\/(?:actions\/[^/]+\/(?:check|decline)|turns\/[^/]+\/stop)$/

function notifyCache(response: Response, method: ApiMethod, path: string): void {
	if (typeof window === 'undefined') return
	if (response.status === 401 && path !== '/auth/sign-in') window.location.replace('/login?reason=expired')
	if (!response.ok || method === 'GET' || UNCHANGED_PATHS.has(path) || STATUS_CHECK.test(path)) return
	if (path === '/auth/sign-in' || path === '/auth/sign-out') {
		SESSION_CACHE_CHANNEL?.postMessage('changed')
	} else {
		window.dispatchEvent(new Event(API_CACHE_INVALIDATED))
		DATA_CHANGED_CHANNEL?.postMessage('changed')
	}
}

function errorFrom(value: unknown): ErrorResponse['error'] | null {
	if (typeof value !== 'object' || value === null || !('error' in value)) return null
	const error = value.error
	if (typeof error !== 'object' || error === null || !('code' in error) || !('message' in error)) return null
	const code = errorCodes.find((code) => code === error.code)
	if (!code || typeof error.message !== 'string') return null
	return {
		code,
		message: error.message,
		requestId: 'requestId' in error && typeof error.requestId === 'string' ? error.requestId : undefined,
		retryAfterSeconds:
			'retryAfterSeconds' in error && typeof error.retryAfterSeconds === 'number' ? error.retryAfterSeconds : undefined,
	}
}
