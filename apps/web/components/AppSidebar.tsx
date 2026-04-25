'use client'

import { BookOpenCheck } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarTrigger,
	useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import { iconRegistry, useSidebarSettings } from './SidebarSettingsProvider'

export function AppSidebar() {
	const pathname = usePathname()
	const { closeMobile, mobileOpen, open } = useSidebar()
	const { visibleItems } = useSidebarSettings()
	const expanded = open || mobileOpen

	return (
		<Sidebar>
			<SidebarHeader className={expanded ? 'justify-between' : 'justify-center'}>
				<Link href="/" className="flex min-w-0 items-center gap-2">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-950 text-white">
						<BookOpenCheck className="h-5 w-5" />
					</span>
					{expanded && <span className="truncate text-sm font-semibold">Teacher CRM</span>}
				</Link>
				{expanded && <SidebarTrigger />}
			</SidebarHeader>

			<SidebarContent>
				{!expanded && <SidebarTrigger className="mx-auto mb-2" />}
				{visibleItems.map((item) => {
					const Icon = iconRegistry[item.icon]
					const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href.split('#')[0])
					return (
						<Link
							key={item.id}
							href={item.href}
							className={cn(
								'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950',
								!expanded && 'justify-center px-0',
								isActive && 'bg-zinc-950 text-white hover:bg-zinc-900 hover:text-white'
							)}
							title={item.title}
							onClick={closeMobile}
						>
							<Icon className="h-4 w-4 shrink-0" />
							{expanded && <span className="truncate">{item.title}</span>}
						</Link>
					)
				})}
			</SidebarContent>

			<SidebarFooter>
				{expanded ? (
					<div className="rounded-md border border-zinc-200 p-3">
						<div className="flex items-center justify-between gap-2">
							<p className="text-xs font-medium text-zinc-500">Calendar</p>
							<Badge tone="amber">setup</Badge>
						</div>
						<p className="mt-2 text-xs leading-5 text-zinc-600">
							Server OAuth and sync policy are tracked in the GSD plan.
						</p>
					</div>
				) : (
					<div className="mx-auto h-2 w-2 rounded-full bg-amber-500" />
				)}
			</SidebarFooter>
		</Sidebar>
	)
}
