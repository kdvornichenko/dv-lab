import { CalendarDays, MessagesSquare, Settings, Sun, Users, type LucideIcon } from 'lucide-react'

export interface Section {
	id: string
	label: string
	href: string
	icon: LucideIcon
	exact?: boolean
}

export const sections: Section[] = [
	{ id: 'today', label: 'Today', href: '/', icon: Sun, exact: true },
	{ id: 'chat', label: 'Chat', href: '/chat', icon: MessagesSquare },
	{ id: 'students', label: 'Students', href: '/students', icon: Users },
	{ id: 'schedule', label: 'Schedule', href: '/schedule', icon: CalendarDays },
	{ id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
]

export function isSectionActive(section: Section, pathname: string) {
	if (section.exact) return pathname === section.href
	return pathname === section.href || pathname.startsWith(`${section.href}/`)
}

export function sectionForPath(pathname: string) {
	return sections.find((section) => isSectionActive(section, pathname)) ?? sections[0]
}
