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
		<Sidebar className="border-line bg-surface-muted">
			<SidebarHeader className={expanded ? 'border-line justify-between border-b' : 'justify-center'}>
				<Link href="/" className="flex min-w-0 items-center gap-2">
					<span className="bg-sage text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
						<BookOpenCheck className="h-5 w-5" />
					</span>
					{expanded && <span className="text-ink truncate text-sm font-semibold leading-tight">Teacher ledger</span>}
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
								'text-ink-muted hover:bg-sage-soft hover:text-ink flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98]',
								!expanded && 'justify-center px-0',
								isActive && 'bg-sage text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
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
					<div className="border-line bg-surface rounded-md border p-3">
						<div className="flex items-center justify-between gap-2">
							<p className="text-ink-muted text-xs font-medium">Calendar</p>
							<Badge tone="amber">setup</Badge>
						</div>
						<p className="text-ink-muted mt-2 text-xs leading-5">Connect Google before calendar sync.</p>
					</div>
				) : (
					<div className="bg-warning mx-auto h-2 w-2 rounded-full" />
				)}
			</SidebarFooter>
		</Sidebar>
	)
}
