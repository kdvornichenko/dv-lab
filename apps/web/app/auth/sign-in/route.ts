import { createServerClient, type CookieMethodsServer, type SetAllCookies } from '@supabase/ssr'

import { NextResponse, type NextRequest } from 'next/server'

import { publicOrigin } from '@/lib/public-origin'

import { GOOGLE_CALENDAR_REQUIRED_SCOPES } from '@teacher-crm/api-types'

const googleCalendarScopes = ['openid', 'email', 'profile', ...GOOGLE_CALENDAR_REQUIRED_SCOPES].join(' ')

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

	const next = safeNextPath(requestUrl.searchParams.get('next'))
	const cookiesToSet: Parameters<SetAllCookies>[0] = []
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll()
				},
				setAll(nextCookies) {
					cookiesToSet.push(...nextCookies)
				},
			} satisfies CookieMethodsServer,
		}
	)
	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
			scopes: googleCalendarScopes,
			queryParams: {
				access_type: 'offline',
				include_granted_scopes: 'true',
				prompt: 'consent',
			},
		},
	})

	if (error || !data.url) {
		console.error('Supabase OAuth start failed', { message: error?.message })
		return loginErrorRedirect(origin, 'oauth_start_failed')
	}

	const redirectResponse = NextResponse.redirect(data.url)
	cookiesToSet.forEach(({ name, value, options }) => redirectResponse.cookies.set(name, value, options))

	return redirectResponse
}
