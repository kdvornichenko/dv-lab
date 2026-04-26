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

export type SidebarItem = {
	id: string
	title: string
	href: string
	icon: string
	visible: boolean
	locked?: boolean
}

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

const defaultItems: SidebarItem[] = [
	{ id: 'dashboard', title: 'Dashboard', href: '/', icon: 'LayoutDashboard', visible: true, locked: true },
	{ id: 'lessons', title: 'Lessons', href: '/lessons', icon: 'ListChecks', visible: true },
	{ id: 'students', title: 'Students', href: '/students', icon: 'GraduationCap', visible: true },
	{ id: 'payments', title: 'Payments', href: '/payments', icon: 'Banknote', visible: true },
	{ id: 'calendar', title: 'Google Calendar', href: '/calendar', icon: 'CalendarClock', visible: true },
	{ id: 'errors', title: 'Error Log', href: '/errors', icon: 'AlertTriangle', visible: true },
	{
		id: 'settings',
		title: 'Sidebar Settings',
		href: '/settings/sidebar',
		icon: 'Settings',
		visible: true,
		locked: true,
	},
]

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
	const [items, setItems] = React.useState(defaultItems)
	const [hydrated, setHydrated] = React.useState(false)

	React.useEffect(() => {
		const stored = window.localStorage.getItem('teacher-crm-sidebar')
		if (!stored) {
			setHydrated(true)
			return
		}
		try {
			const storedItems = JSON.parse(stored) as SidebarItem[]
			const storedById = new Map(storedItems.map((item) => [item.id, item]))
			const storedOrder = new Map(storedItems.map((item, index) => [item.id, index]))
			setItems(
				[...defaultItems]
					.sort((a, b) => (storedOrder.get(a.id) ?? 999) - (storedOrder.get(b.id) ?? 999))
					.map((item) => ({
						...item,
						visible: storedById.get(item.id)?.visible ?? item.visible,
						locked: item.locked,
					}))
			)
		} catch {
			setItems(defaultItems)
		} finally {
			setHydrated(true)
		}
	}, [])

	React.useEffect(() => {
		if (!hydrated) return
		window.localStorage.setItem('teacher-crm-sidebar', JSON.stringify(items))
	}, [hydrated, items])

	const value = React.useMemo<SidebarSettingsContextValue>(
		() => ({
			items,
			visibleItems: hydrated ? items.filter((item) => item.visible) : [],
			loading: !hydrated,
			toggleItem: (id) =>
				setItems((current) =>
					current.map((item) => (item.id === id && !item.locked ? { ...item, visible: !item.visible } : item))
				),
			moveItem: (id, direction) =>
				setItems((current) => {
					const index = current.findIndex((item) => item.id === id)
					const nextIndex = direction === 'up' ? index - 1 : index + 1
					if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
					const copy = [...current]
					const [item] = copy.splice(index, 1)
					copy.splice(nextIndex, 0, item)
					return copy
				}),
			reorderItems: (activeId, overId) =>
				setItems((current) => {
					const activeIndex = current.findIndex((item) => item.id === activeId)
					const overIndex = current.findIndex((item) => item.id === overId)
					if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return current
					const copy = [...current]
					const [item] = copy.splice(activeIndex, 1)
					copy.splice(overIndex, 0, item)
					return copy
				}),
			addItem: (item) =>
				setItems((current) => [
					...current,
					{
						...item,
						id: newSidebarItemId(item.title, current),
					},
				]),
			updateItem: (id, input) =>
				setItems((current) => current.map((item) => (item.id === id && !item.locked ? { ...item, ...input } : item))),
			deleteItem: (id) => setItems((current) => current.filter((item) => item.id !== id || item.locked)),
			resetItems: () => setItems(defaultItems),
		}),
		[hydrated, items]
	)

	return <SidebarSettingsContext.Provider value={value}>{children}</SidebarSettingsContext.Provider>
}

export function useSidebarSettings() {
	const value = React.useContext(SidebarSettingsContext)
	if (!value) throw new Error('useSidebarSettings must be used within SidebarSettingsProvider.')
	return value
}
