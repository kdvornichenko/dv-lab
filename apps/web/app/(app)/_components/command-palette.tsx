'use client'

import { Autocomplete } from '@base-ui/react/autocomplete'

import { Monitor, Moon, Search, Sun, type LucideIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

import { sections } from './sections'

type Action = { type: 'route'; href: string } | { type: 'theme'; theme: 'light' | 'dark' | 'system' }

interface Item {
	value: string
	label: string
	icon: LucideIcon
	action: Action
}

interface Group {
	value: string
	items: Item[]
}

const groups: Group[] = [
	{
		value: 'Sections',
		items: sections.map((section) => ({
			value: `section-${section.id}`,
			label: section.label,
			icon: section.icon,
			action: { type: 'route', href: section.href },
		})),
	},
	{
		value: 'Theme',
		items: [
			{ value: 'theme-light', label: 'Light theme', icon: Sun, action: { type: 'theme', theme: 'light' } },
			{ value: 'theme-dark', label: 'Dark theme', icon: Moon, action: { type: 'theme', theme: 'dark' } },
			{ value: 'theme-system', label: 'System theme', icon: Monitor, action: { type: 'theme', theme: 'system' } },
		],
	},
]

interface CommandPaletteProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	initialQuery: string
}

export function CommandPalette({ open, onOpenChange, initialQuery }: CommandPaletteProps) {
	const router = useRouter()
	const { setTheme } = useTheme()

	function run(item: Item) {
		if (item.action.type === 'route') router.push(item.action.href)
		else setTheme(item.action.theme)
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="lg" position="top" showCloseButton={false} className="overflow-hidden p-0" data-palette="">
				<DialogTitle className="sr-only">Search</DialogTitle>
				<DialogDescription className="sr-only">Go to a section, change the theme or sign out.</DialogDescription>
				<Autocomplete.Root open inline items={groups} defaultValue={initialQuery} autoHighlight="always" keepHighlight>
					<Autocomplete.InputGroup className="flex h-12 items-center gap-2 px-4">
						<Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
						<Autocomplete.Input
							aria-label="Search sections and actions"
							placeholder="Search sections and actions"
							className="h-full min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none"
						/>
					</Autocomplete.InputGroup>
					<div className="max-h-[min(60dvh,24rem)] overflow-y-auto border-t border-border">
						<Autocomplete.Empty>
							<p className="py-12 text-center text-body text-muted-foreground">No matching sections or actions</p>
						</Autocomplete.Empty>
						<Autocomplete.List className="p-2">
							{(group: Group) => (
								<Autocomplete.Group key={group.value} items={group.items}>
									<Autocomplete.GroupLabel className="px-2 pt-2 pb-1 text-caption text-muted-foreground">
										{group.value}
									</Autocomplete.GroupLabel>
									<Autocomplete.Collection>
										{(item: Item) => (
											<Autocomplete.Item
												key={item.value}
												value={item}
												onClick={() => run(item)}
												className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-body text-foreground outline-none select-none data-highlighted:bg-active"
											>
												<item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
												<span className="min-w-0 flex-1 truncate">{item.label}</span>
											</Autocomplete.Item>
										)}
									</Autocomplete.Collection>
								</Autocomplete.Group>
							)}
						</Autocomplete.List>
					</div>
				</Autocomplete.Root>
			</DialogContent>
		</Dialog>
	)
}
