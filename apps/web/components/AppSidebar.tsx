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
		<Sidebar className="border-[#E6E0D4] bg-[#FBFAF6]">
			<SidebarHeader className={expanded ? 'justify-between border-b border-[#E6E0D4]' : 'justify-center'}>
				<Link href="/" className="flex min-w-0 items-center gap-2">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#2F6F5E] text-white">
						<BookOpenCheck className="h-5 w-5" />
					</span>
					{expanded && (
						<span className="truncate text-sm font-semibold leading-tight text-[#181713]">Teacher ledger</span>
					)}
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
								'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-[#6F6B63] transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[#E7F0EC] hover:text-[#181713] active:scale-[0.98]',
								!expanded && 'justify-center px-0',
								isActive && 'bg-[#2F6F5E] text-white hover:bg-[#285F51] hover:text-white'
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
					<div className="rounded-md border border-[#E6E0D4] bg-white p-3">
						<div className="flex items-center justify-between gap-2">
							<p className="text-xs font-medium text-[#6F6B63]">Calendar</p>
							<Badge tone="amber">setup</Badge>
						</div>
						<p className="mt-2 text-xs leading-5 text-[#6F6B63]">Connect Google before calendar sync.</p>
					</div>
				) : (
					<div className="mx-auto h-2 w-2 rounded-full bg-[#9A6A1F]" />
				)}
			</SidebarFooter>
		</Sidebar>
	)
}
