export class GoogleCalendarRequestError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message)
		this.name = 'GoogleCalendarRequestError'
	}
}

const googleRequestTimeoutMs = 10_000

export function sanitizeGoogleErrorMessage(value: string) {
	return value
		.replace(/ya29\.[A-Za-z0-9._~+/=-]+/g, '[REDACTED_TOKEN]')
		.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
		.replace(/access_token=([^&\s]+)/gi, 'access_token=[REDACTED]')
		.replace(/refresh_token=([^&\s]+)/gi, 'refresh_token=[REDACTED]')
}

export async function googleJson<T>(
	url: string,
	accessToken: string,
	init: RequestInit = {},
	fetcher: typeof fetch = fetch
): Promise<T> {
	const headers = new Headers(init.headers)
	headers.set('authorization', `Bearer ${accessToken}`)
	if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), googleRequestTimeoutMs)
	if (init.signal) {
		if (init.signal.aborted) controller.abort()
		else init.signal.addEventListener('abort', () => controller.abort(), { once: true })
	}

	let response: Response
	try {
		response = await fetcher(url, {
			...init,
			headers,
			signal: controller.signal,
		})
	} catch (error) {
		if (controller.signal.aborted) {
			throw new GoogleCalendarRequestError('Google Calendar request timed out', 504)
		}
		throw error
	} finally {
		clearTimeout(timeout)
	}
	const body = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null

	if (!response.ok) {
		const message =
			body && typeof body === 'object' && 'error' in body && body.error?.message
				? sanitizeGoogleErrorMessage(body.error.message)
				: `Google Calendar request failed with ${response.status}`
		throw new GoogleCalendarRequestError(message, response.status)
	}

	return body as T
}
