import { CalendarDays } from 'lucide-react'
import { redirect } from 'next/navigation'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

import { GoogleLoginButton } from './GoogleLoginButton'

export const dynamic = 'force-dynamic'

type LoginPageProps = {
	searchParams?: Promise<{
		error?: string | string[]
	}>
}

function firstParam(value: string | string[] | undefined) {
	if (Array.isArray(value)) return value[0]
	return value
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
	const params = await searchParams
	const authError = firstParam(params?.error)
	const supabase = await createClient()
	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (user) redirect('/')

	return (
		<main className="flex min-h-screen items-center justify-center px-4 py-10">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<CalendarDays className="h-5 w-5" />
						Teacher English CRM
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm leading-6 text-zinc-600">
						Sign in with Google. The same Google account is requested for Calendar access.
					</p>
					{authError && (
						<p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{authError}</p>
					)}
					<GoogleLoginButton />
				</CardContent>
			</Card>
		</main>
	)
}
