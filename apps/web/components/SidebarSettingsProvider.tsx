'use client'

import * as React from 'react'

import {
	Banknote,
	CalendarClock,
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
	icon: keyof typeof iconRegistry
	visible: boolean
	locked?: boolean
}

export const iconRegistry = {
	LayoutDashboard,
	GraduationCap,
	ListChecks,
	CalendarClock,
	Banknote,
	Settings,
} satisfies Record<string, LucideIcon>

const defaultItems: SidebarItem[] = [
	{ id: 'dashboard', title: 'Dashboard', href: '/', icon: 'LayoutDashboard', visible: true, locked: true },
	{ id: 'students', title: 'Students', href: '/#students', icon: 'GraduationCap', visible: true },
	{ id: 'lessons', title: 'Lessons', href: '/#lessons', icon: 'ListChecks', visible: true },
	{ id: 'calendar', title: 'Google Calendar', href: '/#calendar', icon: 'CalendarClock', visible: true },
	{ id: 'payments', title: 'Payments', href: '/#payments', icon: 'Banknote', visible: true },
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
	toggleItem: (id: string) => void
	moveItem: (id: string, direction: 'up' | 'down') => void
	resetItems: () => void
}

const SidebarSettingsContext = React.createContext<SidebarSettingsContextValue | null>(null)

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
			setItems(defaultItems.map((item) => ({ ...item, ...storedById.get(item.id), locked: item.locked })))
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
			visibleItems: items.filter((item) => item.visible),
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
			resetItems: () => setItems(defaultItems),
		}),
		[items]
	)

	return <SidebarSettingsContext.Provider value={value}>{children}</SidebarSettingsContext.Provider>
}

export function useSidebarSettings() {
	const value = React.useContext(SidebarSettingsContext)
	if (!value) throw new Error('useSidebarSettings must be used within SidebarSettingsProvider.')
	return value
}
