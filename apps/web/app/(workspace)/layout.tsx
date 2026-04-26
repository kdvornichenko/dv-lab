import type { ReactNode } from 'react'

import { redirect } from 'next/navigation'

import { AppSidebar } from '@/components/AppSidebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
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
				<SidebarInset className="min-h-dvh bg-transparent">
					<ScrollArea className="min-h-0 flex-1">
						<div className="min-h-full">{children}</div>
					</ScrollArea>
				</SidebarInset>
			</SidebarProvider>
		</Providers>
	)
}
