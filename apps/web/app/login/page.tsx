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
		<main className="grid min-h-[100dvh] place-items-center bg-[#F7F5EF] px-4 py-10">
			<div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.55fr)] lg:items-center">
				<section className="rounded-lg border border-[#E6E0D4] bg-white p-5 shadow-none sm:p-6">
					<div className="flex items-center gap-2 text-sm font-medium text-[#2F6F5E]">
						<CalendarDays className="h-4 w-4" />
						Teacher English CRM
					</div>
					<h1 className="mt-3 text-2xl font-semibold text-[#181713]">Private teaching desk</h1>
					<p className="mt-2 max-w-xl text-sm leading-6 text-[#6F6B63]">
						Sign in with Google to open lessons, attendance, payments, and calendar sync for your workspace.
					</p>
					{authError && (
						<p className="mt-4 rounded-md border border-[#EDCBC5] bg-[#F8E9E6] px-3 py-2 text-sm text-[#A64235]">
							{authError}
						</p>
					)}
					<div className="mt-5 max-w-sm">
						<GoogleLoginButton />
					</div>
				</section>

				<Card className="rounded-lg border-[#E6E0D4] bg-[#FBFAF6] shadow-none">
					<CardHeader className="border-b border-[#E6E0D4]">
						<CardTitle className="text-base text-[#181713]">Today preview</CardTitle>
						<p className="text-sm text-[#6F6B63]">The first screen opens on operational attention.</p>
					</CardHeader>
					<CardContent className="space-y-3 pt-4">
						{previewItems.map((item) => {
							const Icon = item.icon
							return (
								<div key={item.label} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
									<div className="flex min-w-0 items-center gap-2">
										<Icon className="h-4 w-4 shrink-0 text-[#2F6F5E]" />
										<span className="truncate text-sm text-[#181713]">{item.label}</span>
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
