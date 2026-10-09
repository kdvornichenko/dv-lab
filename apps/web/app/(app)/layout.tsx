import type { ReactNode } from 'react'

import { redirect } from 'next/navigation'

import { getMe } from '@/lib/session'

import { AppShell } from './_components/app-shell'

export default async function AppLayout({ children }: { children: ReactNode }) {
	const me = await getMe()
	if (!me) redirect('/login?reason=expired')
	return <AppShell account={me.account}>{children}</AppShell>
}
