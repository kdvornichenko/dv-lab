import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { SESSION_COOKIE, SESSION_TOKEN_PATTERN } from '@dv-lab/contracts'

export function proxy(request: NextRequest) {
	const token = request.cookies.get(SESSION_COOKIE)?.value
	if (token !== undefined && SESSION_TOKEN_PATTERN.test(token)) return NextResponse.next()
	return NextResponse.redirect(new URL('/login', request.url), 307)
}

export const config = {
	matcher: ['/((?!api|login|_next/static|_next/image|favicon.ico|robots.txt).*)'],
}
