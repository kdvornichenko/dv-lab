import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

function safeNextPath(value: string | null) {
	if (!value || !value.startsWith('/')) return '/'
	if (value.startsWith('//')) return '/'
	return value
}

export async function GET(request: Request) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get('code')
	const next = safeNextPath(requestUrl.searchParams.get('next'))

	if (!code) {
		return NextResponse.redirect(new URL('/login?error=missing_oauth_code', requestUrl.origin))
	}

	const supabase = await createClient()
	const { error } = await supabase.auth.exchangeCodeForSession(code)

	if (error) {
		return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
	}

	return NextResponse.redirect(new URL(next, requestUrl.origin))
}
