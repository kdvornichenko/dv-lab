import { Cat, Paintbrush, PanelLeft, Settings } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const settingsLinks = [
	{
		title: 'Sidebar',
		description: 'Reorder navigation, hide secondary links, and add custom items.',
		href: '/settings/sidebar',
		icon: PanelLeft,
		badge: 'navigation',
	},
	{
		title: 'Theme',
		description: 'Tune CRM colors, radius, and font choices, then preview before applying globally.',
		href: '/settings/theme',
		icon: Paintbrush,
		badge: 'visual system',
	},
	{
		title: 'Pet',
		description: 'Turn the workspace pet on or off, keep sound explicit, and set movement level.',
		href: '/settings/pet',
		icon: Cat,
		badge: 'workspace',
	},
] as const

export default function SettingsPage() {
	return (
		<main className="p-unit min-h-full">
			<div className="w-full space-y-5">
				<header className="border-line bg-surface rounded-lg border p-5 shadow-xl">
					<div className="text-sage flex items-center gap-2 text-sm font-semibold">
						<Settings className="h-4 w-4" />
						Workspace settings
					</div>
					<h1 className="text-ink mt-3 text-2xl font-semibold">Settings</h1>
					<p className="text-ink-muted mt-2 text-sm leading-6">
						Manage navigation and visual tokens for the teacher CRM workspace.
					</p>
				</header>

				<section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{settingsLinks.map((item) => {
						const Icon = item.icon
						return (
							<Link
								key={item.href}
								href={item.href}
								className="border-line bg-surface hover:border-sage-line focus-visible:ring-ring/35 focus-visible:ring-3 group rounded-lg border p-4 shadow-lg transition-colors duration-150 ease-out focus-visible:outline-none"
							>
								<div className="flex items-start justify-between gap-4">
									<span className="border-sage-line bg-sage-soft text-sage flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
										<Icon className="h-5 w-5" />
									</span>
									<Badge tone="neutral">{item.badge}</Badge>
								</div>
								<h2 className="text-ink group-hover:text-sage mt-4 text-lg font-semibold transition">{item.title}</h2>
								<p className="text-ink-muted mt-2 text-sm leading-6">{item.description}</p>
								<Button className="mt-4" size="sm" variant="secondary" asChild>
									<span>Open</span>
								</Button>
							</Link>
						)
					})}
				</section>
			</div>
		</main>
	)
}
