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
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@/components/ui/sidebar'

import type { AccountSummary } from '@dv-lab/contracts'

import { useChatContext } from '../chat/_components/chat-provider'
import { ChangePasswordDialog } from './change-password-dialog'
import { isSectionActive, sections } from './sections'
import { useSignOut } from './use-sign-out'

interface AppSidebarProps {
	account: AccountSummary
	onOpenSearch: (initialQuery?: string) => void
	onNavigate: (href: string) => void
	pendingPath: string | null
}

export function AppSidebar({ account, onOpenSearch, onNavigate, pendingPath }: AppSidebarProps) {
	const currentPath = usePathname()
	const pathname = pendingPath ?? currentPath
	const { isMobile, setOpenMobile } = useSidebar()
	const { signOut } = useSignOut()
	const { signal } = useChatContext()
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
								const dot = section.id === 'chat' ? signal : null
								return (
									<SidebarMenuItem key={section.id}>
										<SidebarMenuButton
											icon={section.icon}
											isActive={active}
											aria-current={active ? 'page' : undefined}
											aria-label={
												dot === 'warning'
													? 'Chat, waiting for your decision'
													: dot === 'info'
														? 'Chat, new reply'
														: undefined
											}
											render={<Link href={section.href} onNavigate={() => onNavigate(section.href)} />}
											onClick={() => {
												if (isMobile) setOpenMobile(false)
											}}
										>
											{section.label}
										</SidebarMenuButton>
										{dot === null ? null : (
											<SidebarMenuBadge>
												<span
													aria-hidden
													className={`size-2 rounded-full ring-2 ring-surface-1 ${dot === 'warning' ? 'bg-warning' : 'bg-info'}`}
												/>
											</SidebarMenuBadge>
										)}
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
