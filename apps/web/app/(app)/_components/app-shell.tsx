'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { Search } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { ThemeToggle } from '@/components/app/theme-toggle'
import { SidebarInsetTopbar } from '@/components/sidebar-app/inset-topbar'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Tooltip } from '@/components/ui/tooltip'
import { SurfaceProvider } from '@/lib/surface-context'

import type { AccountSummary } from '@dv-lab/contracts'

import { AppSidebar } from './app-sidebar'
import { CommandPalette } from './command-palette'
import { sectionForPath } from './sections'
import { ToastProvider } from './toasts'

function Topbar({ onOpenSearch }: { onOpenSearch: () => void }) {
	const section = sectionForPath(usePathname())
	return (
		<SidebarInsetTopbar>
			<span className="min-w-0 flex-1 truncate text-body text-foreground">{section.label}</span>
			<div className="flex shrink-0 items-center gap-1 pr-2">
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
	const [palette, setPalette] = useState({ open: false, key: 0, initialQuery: '' })

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
			<div className="bg-surface-1">
				<a
					href="#content"
					className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface-3 focus:px-4 focus:py-2 focus:text-body focus:text-foreground focus:shadow-surface-3"
				>
					Skip to content
				</a>
				<SidebarProvider persist={false} peek="hover" width="15rem" className="h-dvh min-h-0 overflow-hidden">
					<AppSidebar account={account} onOpenSearch={openSearch} />
					<SidebarInset className="overflow-hidden">
						<SurfaceProvider value={2}>
							<Topbar onOpenSearch={() => openSearch()} />
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
		</ToastProvider>
	)
}
