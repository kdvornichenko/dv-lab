import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'

import { NextResponse, type NextRequest } from 'next/server'

import { publicOrigin } from '@/lib/public-origin'

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
	const origin = publicOrigin(request, requestUrl.origin)
	const code = requestUrl.searchParams.get('code')
	const next = safeNextPath(requestUrl.searchParams.get('next'))

	if (requestUrl.searchParams.has('error')) {
		console.error('Google OAuth provider rejected the sign-in request', {
			error: requestUrl.searchParams.get('error'),
			errorDescription: requestUrl.searchParams.get('error_description'),
		})
		return loginErrorRedirect(origin, 'oauth_provider_rejected')
	}

	if (!code) {
		return loginErrorRedirect(origin, 'missing_oauth_code')
	}

	const redirectResponse = NextResponse.redirect(new URL(next, origin))
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll()
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value, options }) => redirectResponse.cookies.set(name, value, options))
				},
			} satisfies CookieMethodsServer,
		}
	)
	const { error } = await supabase.auth.exchangeCodeForSession(code)

	if (error) {
		console.error('Supabase OAuth exchange failed', { message: error.message })
		return loginErrorRedirect(origin, 'oauth_exchange_failed')
	}

	return redirectResponse
}
