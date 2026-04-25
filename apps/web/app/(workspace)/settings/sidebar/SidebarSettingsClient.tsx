'use client'

import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'

import { iconRegistry, useSidebarSettings } from '@/components/SidebarSettingsProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SidebarSettingsClient() {
	const { items, toggleItem, moveItem, resetItems } = useSidebarSettings()

	return (
		<main className="min-h-[100dvh] bg-[#F7F5EF] px-4 py-5 sm:px-6 lg:px-8">
			<div className="mx-auto grid w-full max-w-[960px] gap-5">
				<header className="flex flex-col gap-3 border-b border-[#E6E0D4] pb-5 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-medium text-[#2F6F5E]">AppSidebar</p>
						<h1 className="mt-2 text-2xl font-semibold text-[#181713]">Sidebar settings</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-[#6F6B63]">
							Keep the daily teaching controls visible and move secondary sections lower.
						</p>
					</div>
					<Button variant="secondary" onClick={resetItems}>
						<RotateCcw className="h-4 w-4" />
						Reset
					</Button>
				</header>

				<Card className="rounded-lg border-[#E6E0D4] bg-white shadow-none">
					<CardHeader className="border-b border-[#EFE8DC]">
						<CardTitle className="text-base text-[#181713]">Navigation items</CardTitle>
						<p className="text-sm text-[#6F6B63]">Locked items stay available for routine work.</p>
					</CardHeader>
					<CardContent className="space-y-3 pt-4">
						{items.map((item, index) => {
							const Icon = iconRegistry[item.icon]
							return (
								<div
									key={item.id}
									className="grid gap-3 rounded-lg border border-[#E6E0D4] bg-[#FBFAF6] p-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
								>
									<span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#E7F0EC] text-[#2F6F5E]">
										<Icon className="h-4 w-4 shrink-0" />
									</span>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-medium text-[#181713]">{item.title}</p>
											{item.locked && <Badge tone="neutral">locked</Badge>}
											{!item.visible && <Badge tone="amber">hidden</Badge>}
										</div>
										<p className="truncate font-mono text-xs text-[#6F6B63]">{item.href}</p>
									</div>
									<div className="flex gap-2 md:justify-end">
										<Button
											size="icon"
											variant="secondary"
											aria-label={`Move ${item.title} up`}
											onClick={() => moveItem(item.id, 'up')}
											disabled={index === 0}
										>
											<ArrowUp className="h-4 w-4" />
										</Button>
										<Button
											size="icon"
											variant="secondary"
											aria-label={`Move ${item.title} down`}
											onClick={() => moveItem(item.id, 'down')}
											disabled={index === items.length - 1}
										>
											<ArrowDown className="h-4 w-4" />
										</Button>
										<Button
											size="sm"
											variant={item.visible ? 'ghost' : 'secondary'}
											onClick={() => toggleItem(item.id)}
											disabled={item.locked}
										>
											{item.visible ? 'Hide' : 'Show'}
										</Button>
									</div>
								</div>
							)
						})}
					</CardContent>
				</Card>
			</div>
		</main>
	)
}
