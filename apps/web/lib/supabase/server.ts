import { createServerClient, type CookieOptions } from '@supabase/ssr'

import { cookies } from 'next/headers'

type SupabaseCookieToSet = {
	name: string
	value: string
	options: CookieOptions
}

export async function createClient() {
	const cookieStore = await cookies()

	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return cookieStore.getAll()
				},
				setAll(cookiesToSet: SupabaseCookieToSet[]) {
					try {
						cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
					} catch {
						// Server Components cannot set cookies; proxy.ts refreshes sessions.
					}
				},
			},
		}
	)
}
