'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { SidebarSearchField } from '@/components/sidebar-app/search-field'
import { SidebarWorkspaceHeader, WorkspaceTile } from '@/components/sidebar-app/workspace-header'
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@/components/ui/sidebar'

import { isSectionActive, sections } from './sections'

export function AppSidebar() {
	const pathname = usePathname()
	const { isMobile, setOpenMobile } = useSidebar()

	return (
		<Sidebar variant={isMobile ? 'sidebar' : 'inset'}>
			<SidebarHeader>
				<SidebarWorkspaceHeader name="dv-lab" tile={<WorkspaceTile>D</WorkspaceTile>} />
				<SidebarSearchField
					placeholder="Search"
					aria-label="Search sections and actions"
					aria-haspopup="dialog"
					readOnly
					value=""
				/>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu aria-label="Sections">
						{sections.map((section) => {
							const active = isSectionActive(section, pathname)
							return (
								<SidebarMenuItem key={section.id}>
									<SidebarMenuButton
										icon={section.icon}
										isActive={active}
										aria-current={active ? 'page' : undefined}
										render={<Link href={section.href} />}
										onClick={() => {
											if (isMobile) setOpenMobile(false)
										}}
									>
										{section.label}
									</SidebarMenuButton>
								</SidebarMenuItem>
							)
						})}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	)
}
