import { cache } from 'react'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { SESSION_COOKIE, type MeResponse } from '@dv-lab/contracts'

export const getMe = cache(async (): Promise<MeResponse | null> => {
	const token = (await cookies()).get(SESSION_COOKIE)?.value
	if (!token) return null
	const base = process.env.API_INTERNAL_URL
	if (!base) throw new Error('API_INTERNAL_URL is not set')
	const response = await fetch(`${base}/auth/me`, {
		headers: { cookie: `${SESSION_COOKIE}=${token}` },
		cache: 'no-store',
	})
	if (response.status === 401) return null
	if (!response.ok) throw new Error('Session lookup failed')
	return (await response.json()) as MeResponse
})

export async function requireTeacherPage(): Promise<MeResponse> {
	const me = await getMe()
	if (!me) redirect('/login?reason=expired')
	if (me.account.role === 'student') redirect('/')
	return me
}
