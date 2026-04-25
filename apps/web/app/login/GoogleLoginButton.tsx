'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

import { GOOGLE_CALENDAR_REQUIRED_SCOPES } from '@teacher-crm/api-types'

const googleCalendarScopes = ['openid', 'email', 'profile', ...GOOGLE_CALENDAR_REQUIRED_SCOPES].join(' ')

export function GoogleLoginButton() {
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState(false)

	async function signInWithGoogle() {
		setPending(true)
		setError(null)

		const supabase = createClient()
		const { error: signInError } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback?next=/`,
				scopes: googleCalendarScopes,
				queryParams: {
					access_type: 'offline',
					include_granted_scopes: 'true',
					prompt: 'consent',
				},
			},
		})

		if (signInError) {
			setPending(false)
			setError(signInError.message)
		}
	}

	return (
		<div className="space-y-3">
			<Button className="w-full" disabled={pending} onClick={signInWithGoogle} type="button">
				{pending ? 'Opening Google...' : 'Continue with Google'}
			</Button>
			{error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
		</div>
	)
}
