import type { ReactNode } from 'react'

import { redirect } from 'next/navigation'

import { getMe } from '@/lib/session'

import { AppShell } from './_components/app-shell'
import { SessionRenewal } from './_components/session-renewal'
import { StudentLanding } from './_components/student-landing'

export default async function AppLayout({ children }: { children: ReactNode }) {
	const me = await getMe()
	if (!me) redirect('/login?reason=expired')
	if (me.account.role === 'student') {
		return (
			<>
				<SessionRenewal renewDue={me.renewDue} />
				<StudentLanding account={me.account} />
			</>
		)
	}
	return (
		<AppShell account={me.account}>
			<SessionRenewal renewDue={me.renewDue} />
			{children}
		</AppShell>
	)
}
