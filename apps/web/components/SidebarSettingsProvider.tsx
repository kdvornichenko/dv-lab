'use client'

import * as React from 'react'

import {
	AlertTriangle,
	Banknote,
	CalendarClock,
	Circle,
	GraduationCap,
	LayoutDashboard,
	ListChecks,
	Settings,
	type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { DEFAULT_SIDEBAR_ITEMS, type SidebarItem } from '@teacher-crm/api-types'

import { teacherCrmApi } from '@/lib/crm/api'

export type { SidebarItem }

export const iconRegistry: Record<string, LucideIcon> = {
	LayoutDashboard,
	GraduationCap,
	ListChecks,
	CalendarClock,
	Banknote,
	AlertTriangle,
	Settings,
	Circle,
}

const defaultItems: SidebarItem[] = DEFAULT_SIDEBAR_ITEMS.map((item) => ({ ...item }))

type SidebarSettingsContextValue = {
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

const SidebarSettingsContext = React.createContext<SidebarSettingsContextValue | null>(null)

function slug(value: string) {
	return (
		value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'item'
	)
}

function newSidebarItemId(title: string, items: readonly SidebarItem[]) {
	const base = `nav-${slug(title)}`
	let candidate = base
	let suffix = 2
	while (items.some((item) => item.id === candidate)) {
		candidate = `${base}-${suffix}`
		suffix += 1
	}
	return candidate
}

export function SidebarSettingsProvider({ children }: { children: React.ReactNode }) {
	const [items, setItems] = React.useState<SidebarItem[]>(defaultItems)
	const [isLoading, setIsLoading] = React.useState(true)

	React.useEffect(() => {
		let cancelled = false

		async function loadSidebarSettings() {
			try {
				const response = await teacherCrmApi.listSidebarItems()
				if (!cancelled) setItems(response.items)
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Failed to load sidebar settings'
				toast.error('Sidebar settings unavailable', { description: message })
			} finally {
				if (!cancelled) setIsLoading(false)
			}
		}

		void loadSidebarSettings()
		return () => {
			cancelled = true
		}
	}, [])

	const persistItems = React.useCallback(async (nextItems: SidebarItem[]) => {
		try {
			const response = await teacherCrmApi.saveSidebarItems(nextItems)
			setItems(response.items)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to save sidebar settings'
			toast.error('Sidebar settings not saved', { description: message })
		}
	}, [])

	const commitItems = React.useCallback(
		(updater: (current: SidebarItem[]) => SidebarItem[]) => {
			setItems((current) => {
				const nextItems = updater(current)
				void persistItems(nextItems)
				return nextItems
			})
		},
		[persistItems]
	)

	const value = React.useMemo<SidebarSettingsContextValue>(
		() => ({
			items,
			visibleItems: isLoading ? [] : items.filter((item) => item.visible),
			loading: isLoading,
			toggleItem: (id) =>
				commitItems((current) =>
					current.map((item) => (item.id === id && !item.locked ? { ...item, visible: !item.visible } : item))
				),
			moveItem: (id, direction) =>
				commitItems((current) => {
					const index = current.findIndex((item) => item.id === id)
					const nextIndex = direction === 'up' ? index - 1 : index + 1
					if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
					const copy = [...current]
					const [item] = copy.splice(index, 1)
					copy.splice(nextIndex, 0, item)
					return copy
				}),
			reorderItems: (activeId, overId) =>
				commitItems((current) => {
					const activeIndex = current.findIndex((item) => item.id === activeId)
					const overIndex = current.findIndex((item) => item.id === overId)
					if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return current
					const copy = [...current]
					const [item] = copy.splice(activeIndex, 1)
					copy.splice(overIndex, 0, item)
					return copy
				}),
			addItem: (item) =>
				commitItems((current) => [
					...current,
					{
						...item,
						id: newSidebarItemId(item.title, current),
					},
				]),
			updateItem: (id, input) =>
				commitItems((current) =>
					current.map((item) => (item.id === id && !item.locked ? { ...item, ...input } : item))
				),
			deleteItem: (id) => commitItems((current) => current.filter((item) => item.id !== id || item.locked)),
			resetItems: () => commitItems(() => defaultItems.map((item) => ({ ...item }))),
		}),
		[commitItems, isLoading, items]
	)

	return <SidebarSettingsContext.Provider value={value}>{children}</SidebarSettingsContext.Provider>
}

export function useSidebarSettings() {
	const value = React.useContext(SidebarSettingsContext)
	if (!value) throw new Error('useSidebarSettings must be used within SidebarSettingsProvider.')
	return value
}
