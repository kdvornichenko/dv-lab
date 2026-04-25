'use client'

import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'

import { iconRegistry, useSidebarSettings } from '@/components/SidebarSettingsProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SidebarSettingsClient() {
	const { items, toggleItem, moveItem, resetItems } = useSidebarSettings()

	return (
		<main className="px-4 py-5 sm:px-6 lg:px-8">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
				<header className="flex flex-col gap-3 border-b border-zinc-200 pb-5 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-medium text-sky-700">AppSidebar</p>
						<h1 className="mt-2 text-2xl font-semibold text-zinc-950">Sidebar settings</h1>
					</div>
					<Button variant="secondary" onClick={resetItems}>
						<RotateCcw className="h-4 w-4" />
						Reset
					</Button>
				</header>

				<Card>
					<CardHeader>
						<CardTitle>Navigation items</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{items.map((item, index) => {
							const Icon = iconRegistry[item.icon]
							return (
								<div key={item.id} className="flex items-center gap-3 rounded-md border border-zinc-200 p-3">
									<Icon className="h-4 w-4 shrink-0 text-sky-700" />
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-medium text-zinc-950">{item.title}</p>
											{item.locked && <Badge>locked</Badge>}
											{!item.visible && <Badge tone="amber">hidden</Badge>}
										</div>
										<p className="truncate text-xs text-zinc-500">{item.href}</p>
									</div>
									<div className="flex gap-2">
										<Button
											size="icon"
											variant="secondary"
											onClick={() => moveItem(item.id, 'up')}
											disabled={index === 0}
										>
											<ArrowUp className="h-4 w-4" />
										</Button>
										<Button
											size="icon"
											variant="secondary"
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
