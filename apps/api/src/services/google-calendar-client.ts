export class GoogleCalendarRequestError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message)
		this.name = 'GoogleCalendarRequestError'
	}
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

	const response = await fetcher(url, {
		...init,
		headers,
	})
	const body = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null

	if (!response.ok) {
		const message =
			body && typeof body === 'object' && 'error' in body && body.error?.message
				? body.error.message
				: `Google Calendar request failed with ${response.status}`
		throw new GoogleCalendarRequestError(message, response.status)
	}

	return body as T
}
