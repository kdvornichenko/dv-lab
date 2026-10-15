'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { Search } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

import { ThemeToggle } from '@/components/app/theme-toggle'
import { TopbarSlotProvider, TopbarSlotTarget } from '@/components/app/topbar-slot'
import { SidebarInsetTopbar } from '@/components/sidebar-app/inset-topbar'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Tooltip } from '@/components/ui/tooltip'
import { API_CACHE_INVALIDATED, SESSION_CACHE_CHANNEL } from '@/lib/api-client'
import { SurfaceProvider } from '@/lib/surface-context'

import type { AccountSummary } from '@dv-lab/contracts'

import { AppSidebar } from './app-sidebar'
import { CommandPalette } from './command-palette'
import { sectionForPath } from './sections'
import { ToastProvider } from './toasts'

function Topbar({ onOpenSearch, pathname, pending }: { onOpenSearch: () => void; pathname: string; pending: boolean }) {
	const section = sectionForPath(pathname)
	return (
		<SidebarInsetTopbar className="max-md:px-3">
			<span
				aria-busy={pending}
				className="min-w-0 flex-1 truncate text-body text-foreground [header:has(#topbar-slot:not(:empty))_&]:hidden"
			>
				{section.label}
			</span>
			<TopbarSlotTarget side="left" id="topbar-slot" className="flex min-w-0 flex-1 items-center gap-2 empty:hidden" />
			<div className="flex shrink-0 items-center gap-1 md:gap-2 md:pr-2 pointer-coarse:gap-4 md:pointer-coarse:gap-4">
				<TopbarSlotTarget side="right" id="topbar-actions" className="flex items-center gap-2 empty:hidden" />
				<span className="md:hidden">
					<Tooltip content="Search" delayDuration={200}>
						<Button variant="ghost" size="icon-compact" aria-label="Search" onClick={onOpenSearch}>
							<Search />
						</Button>
					</Tooltip>
				</span>
				<ThemeToggle />
			</div>
		</SidebarInsetTopbar>
	)
}

export function AppShell({ account, children }: { account: AccountSummary; children: ReactNode }) {
	const router = useRouter()
	const pathname = usePathname()
	const [navigation, setNavigation] = useState<{ from: string; to: string } | null>(null)
	if (navigation !== null && navigation.from !== pathname) setNavigation(null)
	const pendingPath = navigation?.from === pathname ? navigation.to : null
	const [palette, setPalette] = useState({ open: false, key: 0, initialQuery: '' })

	useEffect(() => {
		const invalidateSession = () => window.location.reload()
		SESSION_CACHE_CHANNEL?.addEventListener('message', invalidateSession)
		const invalidate = () => router.refresh()
		const restore = (event: PageTransitionEvent) => {
			if (event.persisted) window.location.reload()
		}
		window.addEventListener(API_CACHE_INVALIDATED, invalidate)
		window.addEventListener('pageshow', restore)
		return () => {
			SESSION_CACHE_CHANNEL?.removeEventListener('message', invalidateSession)
			window.removeEventListener(API_CACHE_INVALIDATED, invalidate)
			window.removeEventListener('pageshow', restore)
		}
	}, [router])

	const openSearch = useCallback((initialQuery = '') => {
		setPalette((current) => ({ open: true, key: current.key + 1, initialQuery }))
	}, [])

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return
			event.preventDefault()
			if (document.querySelector("[role='dialog']:not([data-palette])")) return
			setPalette((current) =>
				current.open ? { ...current, open: false } : { open: true, key: current.key + 1, initialQuery: '' }
			)
		}
		document.addEventListener('keydown', onKeyDown)
		return () => document.removeEventListener('keydown', onKeyDown)
	}, [])

	return (
		<ToastProvider>
			<TopbarSlotProvider>
				<div className="bg-surface-1">
					<a
						href="#content"
						className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface-3 focus:px-4 focus:py-2 focus:text-body focus:text-foreground focus:shadow-surface-3"
					>
						Skip to content
					</a>
					<SidebarProvider persist={false} peek="hover" width="15rem" className="h-dvh min-h-0 overflow-hidden">
						<AppSidebar
							account={account}
							onOpenSearch={openSearch}
							pendingPath={pendingPath}
							onNavigate={(to) => setNavigation(to === pathname ? null : { from: pathname, to })}
						/>
						<SidebarInset className="overflow-hidden bg-surface-2">
							<SurfaceProvider value={2}>
								<Topbar
									onOpenSearch={() => openSearch()}
									pathname={pendingPath ?? pathname}
									pending={pendingPath !== null}
								/>
								<main id="content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
									{children}
								</main>
							</SurfaceProvider>
						</SidebarInset>
					</SidebarProvider>
					<CommandPalette
						key={palette.key}
						open={palette.open}
						initialQuery={palette.initialQuery}
						onOpenChange={(open) => setPalette((current) => ({ ...current, open }))}
					/>
				</div>
			</TopbarSlotProvider>
		</ToastProvider>
	)
}
