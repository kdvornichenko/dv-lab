import type { NextRequest } from 'next/server'

const localPortlessOrigin = 'https://web.teacher-crm.localhost'

function firstHeaderValue(value: string | null) {
	return value?.split(',')[0]?.trim() || null
}

function hostWithoutPort(value: string | null) {
	return firstHeaderValue(value)?.split(':')[0] ?? null
}

function originFromForwardedHeaders(request: NextRequest) {
	const host = firstHeaderValue(request.headers.get('x-forwarded-host'))
	if (!host) return null

	const proto = firstHeaderValue(request.headers.get('x-forwarded-proto')) ?? 'https'
	return `${proto}://${host}`
}

function originFromLocalPortlessAlias(request: NextRequest, fallbackOrigin: string) {
	if (process.env.NODE_ENV !== 'development') return null
	if (!fallbackOrigin.startsWith('https://')) return null

	const host = hostWithoutPort(request.headers.get('host'))
	if (host !== '127.0.0.1' && host !== 'localhost') return null

	return localPortlessOrigin
}

export function publicOrigin(request: NextRequest, fallbackOrigin: string) {
	return (
		process.env.PORTLESS_URL ??
		originFromForwardedHeaders(request) ??
		originFromLocalPortlessAlias(request, fallbackOrigin) ??
		fallbackOrigin
	)
}
