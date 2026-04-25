import { createServerClient, type CookieOptions } from '@supabase/ssr'

import { NextResponse } from 'next/server'

type SupabaseCookieToSet = {
	name: string
	value: string
	options: CookieOptions
}

function safeNextPath(value: string | null) {
	if (!value || !value.startsWith('/')) return '/'
	if (value.startsWith('//')) return '/'
	return value
}

function safeDecodeCookieValue(value: string) {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

function cookiesFromHeader(value: string | null) {
	if (!value) return []

	return value
		.split(';')
		.map((cookie) => {
			const separatorIndex = cookie.indexOf('=')
			if (separatorIndex === -1) return null
			const name = cookie.slice(0, separatorIndex).trim()
			const rawValue = cookie.slice(separatorIndex + 1).trim()
			if (!name || !rawValue) return null
			return { name, value: safeDecodeCookieValue(rawValue) }
		})
		.filter((cookie): cookie is { name: string; value: string } => Boolean(cookie))
}

export async function GET(request: Request) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get('code')
	const next = safeNextPath(requestUrl.searchParams.get('next'))

	if (!code) {
		return NextResponse.redirect(new URL('/login?error=missing_oauth_code', requestUrl.origin))
	}

	const redirectResponse = NextResponse.redirect(new URL(next, requestUrl.origin))
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return cookiesFromHeader(request.headers.get('cookie'))
				},
				setAll(cookiesToSet: SupabaseCookieToSet[]) {
					cookiesToSet.forEach(({ name, value, options }) => redirectResponse.cookies.set(name, value, options))
				},
			},
		}
	)
	const { error } = await supabase.auth.exchangeCodeForSession(code)

	if (error) {
		return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
	}

	return redirectResponse
}
