'use client'

import type { FC } from 'react'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Sidebar, SidebarContent, SidebarFooter, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { iconRegistry, useSidebarSettings } from './SidebarSettingsProvider'
import { Button } from './ui/button'

export const AppSidebar: FC = () => {
	const pathname = usePathname()
	const { closeMobile, mobileOpen, open } = useSidebar()
	const { loading, visibleItems } = useSidebarSettings()
	const expanded = open || mobileOpen

	function workspaceHref(href: string) {
		if (!href.startsWith('/?')) return href
		const view = new URLSearchParams(href.slice(2)).get('view')
		return view && view !== 'dashboard' ? `/${view}` : '/'
	}

	function isItemActive(href: string) {
		const baseHref = workspaceHref(href).split('?')[0] || '/'
		if (baseHref === '/') return pathname === '/'
		return pathname === baseHref || pathname.startsWith(`${baseHref}/`)
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
					<div className="flex flex-col gap-y-1">
						{visibleItems.map((item) => {
							const Icon = iconRegistry[item.icon] ?? iconRegistry.Circle
							const href = workspaceHref(item.href)
							const isActive = isItemActive(item.href)
							return (
								<Button
									key={item.id}
									variant={isActive ? 'default' : 'ghost'}
									asChild
									className="justify-start text-left"
								>
									<Link href={href} title={item.title} onClick={closeMobile}>
										<Icon className="h-4 w-4 shrink-0" />
										{expanded && <span className="truncate">{item.title}</span>}
									</Link>
								</Button>
							)
						})}
					</div>
				</div>
			</SidebarContent>

			<Image src="assets/scottish-fold-cat-sprite.svg" alt="" width={40} height={40} />

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
