'use client'
import { type ReactNode } from 'react'

import { DropdownMenu, DropdownTrigger, DropdownContent } from '@/components/ui/dropdown'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { fontWeights } from '@/lib/font-weight'
import { useIcons } from '@/lib/icon-context'
import { useShape } from '@/lib/shape-context'
import { SIDEBAR_MENU_POPUP } from '@/lib/sidebar-menu-grid'
import { useSize } from '@/lib/size-context'
import { cn } from '@/lib/utils'

export interface SidebarWorkspaceHeaderProps {
	name: ReactNode
	tile: ReactNode
	menu?: ReactNode
	checkedIndex?: number
}
export function SidebarWorkspaceHeader({ name, tile, menu, checkedIndex }: SidebarWorkspaceHeaderProps) {
	const iconSize = useSize().icon
	const icons = useIcons()
	const ChevronDown = icons['chevron-down']
	const { isPeeking } = useSidebar()
	const tileSlot = (
		<span
			aria-hidden
			className={`pointer-events-none absolute top-1/2 left-1.5 -translate-y-1/2 transition-opacity duration-80 ${isPeeking ? 'opacity-0' : 'opacity-100'}`}
		>
			{tile}
		</span>
	)
	const triggerFade = `[&>span:first-child]:hidden [&_svg]:size-4 transition-opacity duration-80 ${isPeeking ? 'opacity-100' : 'pointer-events-none opacity-0'}`
	const nameSpan = (
		<span
			className="min-w-0 truncate text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)] text-foreground"
			style={{ fontVariationSettings: fontWeights.semibold }}
		>
			{name}
		</span>
	)
	if (!menu) {
		return (
			<div className="relative flex h-8 items-center pr-2 pl-8">
				<SidebarTrigger
					size="icon-compact"
					aria-hidden={!isPeeking || undefined}
					tabIndex={isPeeking ? undefined : -1}
					className={`absolute top-1/2 left-1 -translate-y-1/2 ${triggerFade}`}
				/>
				{tileSlot}
				{nameSpan}
			</div>
		)
	}
	return (
		<SidebarMenu aria-label="Workspace" className="@container">
			<SidebarMenuItem>
				<SidebarTrigger
					size="icon-compact"
					aria-hidden={!isPeeking || undefined}
					tabIndex={isPeeking ? undefined : -1}
					className={`absolute top-1/2 left-1 z-20 -translate-y-1/2 ${triggerFade}`}
				/>
				<DropdownMenu>
					<DropdownTrigger
						render={
							<SidebarMenuButton aria-label="Switch workspace" className="pl-8">
								{tileSlot}
								{nameSpan}
								<span className="ml-auto inline-flex @max-[7rem]:hidden">
									<ChevronDown size={iconSize} strokeWidth={1.5} className="text-muted-foreground" />
								</span>
							</SidebarMenuButton>
						}
					/>

					<DropdownContent className={SIDEBAR_MENU_POPUP} align="start" sideOffset={4} checkedIndex={checkedIndex}>
						{menu}
					</DropdownContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
export function WorkspaceTile({ children, className }: { children: ReactNode; className?: string }) {
	const shape = useShape()
	return (
		<span
			className={cn(
				'flex size-5 shrink-0 items-center justify-center bg-foreground text-[length:var(--fs-micro-compact,10px)] leading-[var(--lh-micro-compact,12px)] text-background',
				shape.bgRadius >= 20 ? 'rounded-full' : 'rounded-md',
				className
			)}
			style={{ fontVariationSettings: fontWeights.semibold }}
		>
			{children}
		</span>
	)
}
