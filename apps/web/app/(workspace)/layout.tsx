import type { ReactNode } from 'react'

import { redirect } from 'next/navigation'

import { AppSidebar } from '@/components/AppSidebar'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { createClient } from '@/lib/supabase/server'

import { Providers } from '../providers'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
	const supabase = await createClient()
	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (!user) redirect('/login')

	return (
		<Providers>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-200 bg-white px-4">
						<SidebarTrigger className="lg:hidden" />
						<Separator orientation="vertical" className="lg:hidden" />
						<div className="min-w-0">
							<p className="truncate text-sm font-medium text-zinc-950">Teacher English CRM</p>
							<p className="truncate text-xs text-zinc-500">Students, attendance, payments, and calendar sync</p>
						</div>
					</header>
					<div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
				</SidebarInset>
			</SidebarProvider>
		</Providers>
	)
}
