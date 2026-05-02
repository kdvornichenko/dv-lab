import type { PropsWithChildren } from 'react'

import type { SidebarItem } from '@teacher-crm/api-types'

export type SidebarSettingsProviderProps = PropsWithChildren

export type SidebarSettingsContextValue = {
	items: SidebarItem[]
	visibleItems: SidebarItem[]
	loading: boolean
	toggleItem: (id: string) => void
	moveItem: (id: string, direction: 'up' | 'down') => void
	reorderItems: (activeId: string, overId: string) => void
	addItem: (item: Omit<SidebarItem, 'id' | 'locked'>) => void
	updateItem: (id: string, input: Partial<Omit<SidebarItem, 'id' | 'locked'>>) => void
	deleteItem: (id: string) => void
	resetItems: () => void
}
