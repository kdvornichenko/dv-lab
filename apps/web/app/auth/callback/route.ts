import { createServerClient, type CookieOptions } from '@supabase/ssr'

import { NextResponse, type NextRequest } from 'next/server'

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

function loginErrorRedirect(origin: string, code: string) {
	const url = new URL('/login', origin)
	url.searchParams.set('error', code)
	return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get('code')
	const next = safeNextPath(requestUrl.searchParams.get('next'))

	if (requestUrl.searchParams.has('error')) {
		console.error('Google OAuth provider rejected the sign-in request', {
			error: requestUrl.searchParams.get('error'),
			errorDescription: requestUrl.searchParams.get('error_description'),
		})
		return loginErrorRedirect(requestUrl.origin, 'oauth_provider_rejected')
	}

	if (!code) {
		return loginErrorRedirect(requestUrl.origin, 'missing_oauth_code')
	}

	const redirectResponse = NextResponse.redirect(new URL(next, requestUrl.origin))
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll()
				},
				setAll(cookiesToSet: SupabaseCookieToSet[]) {
					cookiesToSet.forEach(({ name, value, options }) => redirectResponse.cookies.set(name, value, options))
				},
			},
		}
	)
	const { error } = await supabase.auth.exchangeCodeForSession(code)

	if (error) {
		console.error('Supabase OAuth exchange failed', { message: error.message })
		return loginErrorRedirect(requestUrl.origin, 'oauth_exchange_failed')
	}

	return redirectResponse
}
