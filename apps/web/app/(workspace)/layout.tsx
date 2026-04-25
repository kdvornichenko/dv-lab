import type { ReactNode } from 'react'

import { redirect } from 'next/navigation'

import { AppSidebar } from '@/components/AppSidebar'
import { ScrollArea } from '@/components/ui/scroll-area'
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
				<SidebarInset className="bg-canvas min-h-dvh">
					<header className="border-line bg-surface-muted/95 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-md">
						<SidebarTrigger className="lg:hidden" />
						<Separator orientation="vertical" className="lg:hidden" />
						<div className="min-w-0 flex-1">
							<p className="text-ink truncate text-sm font-semibold">Teacher English CRM</p>
							<p className="text-ink-muted truncate text-xs">Today control, attendance, payments, calendar</p>
						</div>
						<div className="border-line-strong bg-surface text-ink-muted hidden items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs sm:flex">
							<span className="bg-sage h-2 w-2 rounded-full" />
							Private workspace
						</div>
					</header>
					<ScrollArea className="min-h-0 flex-1">
						<div>{children}</div>
					</ScrollArea>
				</SidebarInset>
			</SidebarProvider>
		</Providers>
	)
}
