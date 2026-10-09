'use client'

import { LogOut } from 'lucide-react'

import { CenteredPanel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'

import type { AccountSummary } from '@dv-lab/contracts'

import { useSignOut } from './use-sign-out'

export function StudentLanding({ account }: { account: AccountSummary }) {
	const { signOut, pending } = useSignOut()
	return (
		<CenteredPanel>
			<div className="flex flex-col gap-1">
				<h1 className="text-display font-semibold tracking-tight break-words text-foreground">
					Signed in as {account.displayName}
				</h1>
				<p className="text-body break-words text-muted-foreground">{account.login}</p>
			</div>
			<Button variant="secondary" leadingIcon={LogOut} loading={pending} onClick={() => void signOut()}>
				{pending ? 'Signing out…' : 'Sign out'}
			</Button>
		</CenteredPanel>
	)
}
