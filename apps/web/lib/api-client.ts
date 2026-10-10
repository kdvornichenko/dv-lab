import type { ErrorResponse } from '@dv-lab/contracts'

export type ApiResult<T> =
	{ ok: true; status: number; data: T } | { ok: false; status: number; error: ErrorResponse['error'] | null }

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function apiRequest<T>(method: ApiMethod, path: string, body?: unknown): Promise<ApiResult<T>> {
	let response: Response
	try {
		response = await fetch(`/api${path}`, {
			method,
			credentials: 'same-origin',
			cache: 'no-store',
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
		})
	} catch {
		return { ok: false, status: 0, error: null }
	}
	if (response.status === 204) return { ok: true, status: 204, data: undefined as T }
	if (response.ok) {
		try {
			return { ok: true, status: response.status, data: (await response.json()) as T }
		} catch {
			return { ok: false, status: response.status, error: null }
		}
	}
	try {
		const payload = (await response.json()) as Partial<ErrorResponse> | null
		return { ok: false, status: response.status, error: payload?.error ?? null }
	} catch {
		return { ok: false, status: response.status, error: null }
	}
}
