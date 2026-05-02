import type { CalendarEvent } from '../types'

export type AgendaSectionProps = {
	label: string
	date: Date
	events: CalendarEvent[]
	onEventClick?: (event: CalendarEvent) => void
}
