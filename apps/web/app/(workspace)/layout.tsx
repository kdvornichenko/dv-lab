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
				<SidebarInset className="min-h-[100dvh] bg-[#F7F5EF]">
					<header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#E6E0D4] bg-[#FBFAF6]/95 px-4 backdrop-blur-md">
						<SidebarTrigger className="lg:hidden" />
						<Separator orientation="vertical" className="lg:hidden" />
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-semibold text-[#181713]">Teacher English CRM</p>
							<p className="truncate text-xs text-[#6F6B63]">Today control, attendance, payments, calendar</p>
						</div>
						<div className="hidden items-center gap-2 rounded-md border border-[#D8D0C2] bg-white px-2.5 py-1.5 text-xs text-[#6F6B63] sm:flex">
							<span className="h-2 w-2 rounded-full bg-[#2F6F5E]" />
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
