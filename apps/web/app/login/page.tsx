import { CalendarDays } from 'lucide-react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { GoogleLoginButton } from './GoogleLoginButton'

export const dynamic = 'force-dynamic'

type LoginPageProps = {
	searchParams?: Promise<{
		error?: string | string[]
	}>
}

const loginErrorMessages: Record<string, string> = {
	missing_oauth_code: 'Google did not return an authorization code. Start sign-in again.',
	oauth_exchange_failed: 'Google sign-in completed, but the session could not be created. Start sign-in again.',
	oauth_provider_rejected: 'Google rejected the sign-in request. Check the Google OAuth consent and redirect settings.',
	oauth_start_failed: 'Google sign-in could not be started. Check the Supabase Google provider settings.',
}

function firstParam(value: string | string[] | undefined) {
	if (Array.isArray(value)) return value[0]
	return value
}

function loginErrorMessage(code: string | undefined) {
	if (!code) return null
	return loginErrorMessages[code] ?? 'Sign-in failed. Start sign-in again.'
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
	const params = await searchParams
	const authError = loginErrorMessage(firstParam(params?.error))
	const supabase = await createClient()
	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (user) redirect('/')

	return (
		<main className="bg-canvas grid min-h-dvh place-items-center px-4 py-10">
			<div className="grid w-fit gap-5 lg:flex lg:items-center">
				<section className="border-line bg-surface space-y-2 rounded-lg border p-5 shadow-none sm:p-6 lg:flex-1">
					<div className="text-sage flex items-center gap-2 text-sm font-medium">
						<CalendarDays className="h-4 w-4" />
						Teacher English CRM
					</div>
					<h1 className="text-ink text-2xl font-semibold">Private teaching desk</h1>
					<p className="text-ink-muted max-w-xl text-sm leading-6">
						Sign in with Google to open individual lessons, payments, and calendar sync for your workspace.
					</p>
					{authError && (
						<p className="border-danger-line bg-danger-soft text-danger rounded-md border px-3 py-2 text-sm">
							{authError}
						</p>
					)}
					<GoogleLoginButton />
				</section>
			</div>
		</main>
	)
}
