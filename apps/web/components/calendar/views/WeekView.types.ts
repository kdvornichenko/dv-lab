import type { CSSProperties } from 'react'

import type { CalendarEvent } from '../types'

export type HourSlotProps = {
	day: Date
	hour: number
	hourIndex: number
	onTimeSlotClick?: (date: Date) => void
}

export type SlotDropZoneProps = {
	slot: Date
	startHour: number
}

export type WeekEventProps = {
	event: CalendarEvent
	onEventClick?: (event: CalendarEvent) => void
	style: CSSProperties
}
