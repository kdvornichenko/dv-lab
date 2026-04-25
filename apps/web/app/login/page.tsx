import { CalendarDays, CheckCircle2, Clock3, ReceiptText } from 'lucide-react'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

const previewItems = [
	{ label: 'Today lessons', value: '2', icon: Clock3 },
	{ label: 'Attendance marks', value: 'pending', icon: CheckCircle2 },
	{ label: 'Payment risk', value: 'review', icon: ReceiptText },
] as const

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
			<div className="grid w-full max-w-5xl gap-5 lg:flex lg:items-center">
				<section className="border-line bg-surface rounded-lg border p-5 shadow-none sm:p-6 lg:flex-1">
					<div className="text-sage flex items-center gap-2 text-sm font-medium">
						<CalendarDays className="h-4 w-4" />
						Teacher English CRM
					</div>
					<h1 className="text-ink mt-3 text-2xl font-semibold">Private teaching desk</h1>
					<p className="text-ink-muted mt-2 max-w-xl text-sm leading-6">
						Sign in with Google to open lessons, attendance, payments, and calendar sync for your workspace.
					</p>
					{authError && (
						<p className="border-danger-line bg-danger-soft text-danger mt-4 rounded-md border px-3 py-2 text-sm">
							{authError}
						</p>
					)}
					<div className="mt-5 max-w-sm">
						<GoogleLoginButton />
					</div>
				</section>

				<Card className="border-line bg-surface-muted lg:w-90 rounded-lg shadow-none lg:shrink-0">
					<CardHeader className="border-line border-b">
						<CardTitle className="text-ink text-base">Today preview</CardTitle>
						<p className="text-ink-muted text-sm">The first screen opens on operational attention.</p>
					</CardHeader>
					<CardContent className="space-y-3 pt-4">
						{previewItems.map((item) => {
							const Icon = item.icon
							return (
								<div
									key={item.label}
									className="bg-surface flex items-center justify-between gap-3 rounded-md px-3 py-2"
								>
									<div className="flex min-w-0 items-center gap-2">
										<Icon className="text-sage h-4 w-4 shrink-0" />
										<span className="text-ink truncate text-sm">{item.label}</span>
									</div>
									<Badge tone="neutral" className="font-mono tabular-nums">
										{item.value}
									</Badge>
								</div>
							)
						})}
					</CardContent>
				</Card>
			</div>
		</main>
	)
}
