'use client'
import { type ReactNode } from 'react'

import { DropdownMenu, DropdownTrigger, DropdownContent } from '@/components/ui/dropdown'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar'
import { useIcons } from '@/lib/icon-context'
import { SIDEBAR_MENU_POPUP } from '@/lib/sidebar-menu-grid'
import { useSize } from '@/lib/size-context'
import { cn } from '@/lib/utils'

export interface SidebarUserFooterProps {
	name: ReactNode
	avatar: ReactNode
	menu: ReactNode
	className?: string
}
export function SidebarUserFooter({ name, avatar, menu, className }: SidebarUserFooterProps) {
	const iconSize = useSize().icon
	const icons = useIcons()
	const ChevronsUpDown = icons['chevrons-up-down']
	return (
		<SidebarMenu aria-label="User" className={cn(className)}>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownTrigger
						render={
							<SidebarMenuButton aria-label="Open user menu">
								<span className="-mr-0.5 -ml-0.5 flex size-5 shrink-0 items-center justify-center">{avatar}</span>
								<span className="text-foreground min-w-0 truncate text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)]">
									{name}
								</span>
								<span className="-mr-0.5 ml-auto flex size-6 shrink-0 items-center justify-center">
									<ChevronsUpDown size={iconSize} strokeWidth={1.5} className="text-muted-foreground" />
								</span>
							</SidebarMenuButton>
						}
					/>
					<DropdownContent className={SIDEBAR_MENU_POPUP} side="top" align="start" sideOffset={6}>
						{menu}
					</DropdownContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
