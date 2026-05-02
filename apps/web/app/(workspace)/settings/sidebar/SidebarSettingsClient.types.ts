import type { ComponentProps, ReactNode } from 'react'

import type { SidebarItem } from '@/components/SidebarSettingsProvider'
import type { Button } from '@/components/ui/button'

export type SidebarFormState = {
	title: string
	href: string
	icon: string
	visible: boolean
}

export type SortableSidebarItemProps = {
	item: SidebarItem
	onDelete: (id: string) => void
	onEdit: (item: SidebarItem) => void
	onToggle: (id: string) => void
}

export type SidebarToolButtonProps = Omit<ComponentProps<typeof Button>, 'size' | 'aria-label'> & {
	children: ReactNode
	label: string
}
