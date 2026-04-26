import type { ReactNode } from 'react'

import { redirect } from 'next/navigation'

import { AppSidebar } from '@/components/AppSidebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { createClient } from '@/lib/supabase/server'

import { WorkspaceProviders } from '../providers'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
	const supabase = await createClient()
	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (!user) redirect('/login')

	return (
		<WorkspaceProviders>
			<SidebarProvider className="min-h-dvh">
				<AppSidebar />
				<SidebarInset className="h-dvh min-h-0 overflow-hidden bg-transparent">
					<ScrollArea className="h-full min-h-0">
						<div className="min-h-full">{children}</div>
					</ScrollArea>
				</SidebarInset>
			</SidebarProvider>
		</WorkspaceProviders>
	)
}
