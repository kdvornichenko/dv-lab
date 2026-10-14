import { Suspense, type ReactNode } from 'react'

import { redirect } from 'next/navigation'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { CalendarCommandProvider } from '@/components/app/calendar-command-provider'
import { getMe } from '@/lib/session'

import { AppShell } from './_components/app-shell'
import { SessionRenewal } from './_components/session-renewal'
import { StudentLanding } from './_components/student-landing'

export default function AppLayout({ children }: { children: ReactNode }) {
	return (
		<Suspense fallback={null}>
			<AuthenticatedLayout>{children}</AuthenticatedLayout>
		</Suspense>
	)
}

async function AuthenticatedLayout({ children }: { children: ReactNode }) {
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
		<NuqsAdapter>
			<AppShell key={me.account.id} account={me.account}>
				<CalendarCommandProvider key={me.account.id} accountId={me.account.id}>
					<SessionRenewal renewDue={me.renewDue} />
					{children}
				</CalendarCommandProvider>
			</AppShell>
		</NuqsAdapter>
	)
}
