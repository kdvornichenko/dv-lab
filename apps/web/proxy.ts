import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

const oauthCallbackParams = ['code', 'error', 'error_description'] as const

function redirect(location: URL | string) {
	return new Response(null, { headers: { Location: location.toString() }, status: 307 })
}

function nextPathWithoutOauthParams(request: NextRequest) {
	const nextSearchParams = new URLSearchParams(request.nextUrl.searchParams)
	oauthCallbackParams.forEach((param) => nextSearchParams.delete(param))

	const queryString = nextSearchParams.toString()
	return `${request.nextUrl.pathname}${queryString ? `?${queryString}` : ''}`
}

function oauthCallbackRedirect(request: NextRequest) {
	if (request.nextUrl.pathname === '/auth/callback') return null
	if (request.nextUrl.pathname !== '/') return null
	if (!request.nextUrl.searchParams.has('code') && !request.nextUrl.searchParams.has('error')) return null

	const callbackUrl = new URL('/auth/callback', request.nextUrl.origin)
	oauthCallbackParams.forEach((param) => {
		const value = request.nextUrl.searchParams.get(param)
		if (value) callbackUrl.searchParams.set(param, value)
	})
	callbackUrl.searchParams.set('next', nextPathWithoutOauthParams(request))

	return redirect(callbackUrl)
}

export async function proxy(request: NextRequest) {
	const callbackRedirect = oauthCallbackRedirect(request)
	if (callbackRedirect) return callbackRedirect

	return updateSession(request)
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
