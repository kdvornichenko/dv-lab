import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { CenteredPanel } from '@/components/app/layout-parts'
import { getMe } from '@/lib/session'

import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string | string[] }> }) {
	const { reason } = await searchParams
	const me = await getMe().catch(() => null)
	if (me) redirect('/')
	return (
		<CenteredPanel>
			<div className="flex flex-col gap-1">
				<h1 className="text-display font-semibold tracking-tight text-foreground">Sign in to dv-lab</h1>
				<p className="text-body text-muted-foreground">Use your login or email and password.</p>
			</div>
			<LoginForm expired={reason === 'expired'} />
		</CenteredPanel>
	)
}
