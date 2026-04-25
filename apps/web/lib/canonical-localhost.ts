type RequestUrlParts = {
	origin: string
	pathname: string
	search: string
}

export function localhostRedirectLocation(requestUrl: RequestUrlParts, hostHeader: string | null) {
	const requestedHost = hostHeader?.split(':')[0]
	if (requestedHost !== '127.0.0.1') return null

	const requestedPort = hostHeader?.split(':')[1]
	const protocol = requestUrl.origin.split(':')[0] || 'http'
	return `${protocol}://localhost${requestedPort ? `:${requestedPort}` : ''}${requestUrl.pathname}${requestUrl.search}`
}
