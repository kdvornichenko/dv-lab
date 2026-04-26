'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Sidebar, SidebarContent, SidebarFooter, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { iconRegistry, useSidebarSettings } from './SidebarSettingsProvider'

export function AppSidebar() {
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const { closeMobile, mobileOpen, open } = useSidebar()
	const { loading, visibleItems } = useSidebarSettings()
	const expanded = open || mobileOpen
	const activeView = searchParams.get('view') ?? 'dashboard'

	function itemView(href: string) {
		if (!href.startsWith('/?')) return href === '/' ? 'dashboard' : href
		return new URLSearchParams(href.slice(2)).get('view') ?? 'dashboard'
	}

	return (
		<Sidebar
			collapsible="icon"
			suppressHydrationWarning
			className="border-line bg-surface/92 shadow-[18px_0_60px_-52px_var(--shadow-sage)]"
		>
			<SidebarContent className="p-2">
				{!expanded && <SidebarTrigger className="mx-auto mb-2" />}
				<div className="space-y-1.5">
					{loading &&
						Array.from({ length: 5 }).map((_, index) => (
							<div key={index} className={cn('flex h-10 items-center gap-3 px-3', !expanded && 'justify-center px-0')}>
								<Skeleton className="h-4 w-4 rounded-md" />
								{expanded && <Skeleton className="h-4 flex-1 rounded-md" />}
							</div>
						))}
					{visibleItems.map((item) => {
						const Icon = iconRegistry[item.icon] ?? iconRegistry.Circle
						const baseHref = item.href.split('?')[0]
						const isWorkspaceView = item.href === '/' || item.href.startsWith('/?')
						const isActive = isWorkspaceView
							? pathname === '/' && itemView(item.href) === activeView
							: pathname === baseHref || pathname.startsWith(`${baseHref}/`)
						return (
							<Link
								key={item.id}
								href={item.href}
								className={cn(
									'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-ink-muted transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-sage-soft hover:text-sage active:scale-[0.98]',
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
				</div>
			</SidebarContent>

			<SidebarFooter>
				{expanded ? (
					<div className="rounded-lg border border-warning-line bg-warning-soft p-3">
						<div className="flex items-center justify-between gap-2">
							<p className="text-xs font-semibold text-warning">Calendar</p>
							<Badge tone="amber">setup</Badge>
						</div>
						<p className="mt-2 text-xs leading-5 text-ink-muted">Connect Google before calendar sync.</p>
					</div>
				) : (
					<div className="mx-auto h-2 w-2 rounded-full bg-warning" />
				)}
			</SidebarFooter>
		</Sidebar>
	)
}
