'use client'

import { useState } from 'react'

import { KeyRound, LogOut, UserRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { SidebarSearchField } from '@/components/sidebar-app/search-field'
import { SidebarUserFooter } from '@/components/sidebar-app/user-footer'
import { SidebarWorkspaceHeader, WorkspaceTile } from '@/components/sidebar-app/workspace-header'
import { MenuItem } from '@/components/ui/menu-item'
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@/components/ui/sidebar'

import type { AccountSummary } from '@dv-lab/contracts'

import { ChangePasswordDialog } from './change-password-dialog'
import { isSectionActive, sections } from './sections'
import { useSignOut } from './use-sign-out'

interface AppSidebarProps {
	account: AccountSummary
	onOpenSearch: (initialQuery?: string) => void
}

export function AppSidebar({ account, onOpenSearch }: AppSidebarProps) {
	const pathname = usePathname()
	const { isMobile, setOpenMobile } = useSidebar()
	const { signOut } = useSignOut()
	const [changePasswordOpen, setChangePasswordOpen] = useState(false)

	function openSearch(initialQuery?: string) {
		if (isMobile) setOpenMobile(false)
		onOpenSearch(initialQuery)
	}

	return (
		<>
			<Sidebar variant={isMobile ? 'sidebar' : 'inset'}>
				<SidebarHeader>
					<SidebarWorkspaceHeader name="dv-lab" tile={<WorkspaceTile>D</WorkspaceTile>} />
					<SidebarSearchField
						placeholder="Search"
						aria-label="Search sections and actions"
						aria-haspopup="dialog"
						readOnly
						value=""
						onClick={() => openSearch()}
						onKeyDown={(event) => {
							if (event.metaKey || event.ctrlKey || event.altKey) return
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault()
								openSearch()
							} else if (event.key.length === 1) {
								event.preventDefault()
								openSearch(event.key)
							}
						}}
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
				<SidebarFooter>
					<SidebarUserFooter
						name={account.displayName}
						avatar={<UserRound size={16} className="text-muted-foreground" aria-hidden />}
						menu={
							<>
								<MenuItem
									icon={KeyRound}
									label="Change password"
									index={0}
									onSelect={() => setChangePasswordOpen(true)}
								/>
								<MenuItem icon={LogOut} label="Sign out" index={1} onSelect={() => void signOut()} />
							</>
						}
					/>
				</SidebarFooter>
			</Sidebar>
			{changePasswordOpen ? <ChangePasswordDialog onClose={() => setChangePasswordOpen(false)} /> : null}
		</>
	)
}
