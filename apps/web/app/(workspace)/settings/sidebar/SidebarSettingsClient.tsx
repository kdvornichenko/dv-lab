'use client'

import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'

import { iconRegistry, useSidebarSettings } from '@/components/SidebarSettingsProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SidebarSettingsClient() {
	const { items, toggleItem, moveItem, resetItems } = useSidebarSettings()

	return (
		<main className="bg-canvas min-h-dvh px-4 py-5 sm:px-6 lg:px-8">
			<div className="max-w-240 mx-auto grid w-full gap-5">
				<header className="border-line flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sage text-sm font-medium">AppSidebar</p>
						<h1 className="text-ink mt-2 text-2xl font-semibold">Sidebar settings</h1>
						<p className="text-ink-muted mt-2 max-w-2xl text-sm leading-6">
							Keep the daily teaching controls visible and move secondary sections lower.
						</p>
					</div>
					<Button variant="secondary" onClick={resetItems}>
						<RotateCcw className="h-4 w-4" />
						Reset
					</Button>
				</header>

				<Card className="border-line bg-surface rounded-lg shadow-none">
					<CardHeader className="border-line-soft border-b">
						<CardTitle className="text-ink text-base">Navigation items</CardTitle>
						<p className="text-ink-muted text-sm">Locked items stay available for routine work.</p>
					</CardHeader>
					<CardContent className="space-y-3 pt-4">
						{items.map((item, index) => {
							const Icon = iconRegistry[item.icon]
							return (
								<div
									key={item.id}
									className="border-line bg-surface-muted grid gap-3 rounded-lg border p-3 md:flex md:items-center md:justify-between"
								>
									<span className="bg-sage-soft text-sage flex h-9 w-9 items-center justify-center rounded-md">
										<Icon className="h-4 w-4 shrink-0" />
									</span>
									<div className="min-w-0 md:flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="text-ink font-medium">{item.title}</p>
											{item.locked && <Badge tone="neutral">locked</Badge>}
											{!item.visible && <Badge tone="amber">hidden</Badge>}
										</div>
										<p className="text-ink-muted truncate font-mono text-xs">{item.href}</p>
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
