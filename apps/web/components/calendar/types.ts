import type { ReactNode } from 'react'

import type { Locale } from 'date-fns'

export type View = 'day' | 'week' | 'month' | 'year'
export type CalendarTone = 'default' | 'blue' | 'green' | 'pink' | 'purple' | 'orange' | 'gray'
export type CalendarBadgeTone = 'neutral' | 'success' | 'danger'

export type CalendarEventBadge = {
	label: string
	tone?: CalendarBadgeTone
}

export type CalendarEvent = {
	id: string
	start: Date
	end: Date
	title: string
	subtitle?: string
	location?: string
	attendees?: string[]
	color?: CalendarTone
	isAlert?: boolean
	badges?: CalendarEventBadge[]
	kind?: 'lesson' | 'block' | 'free'
	lessonId?: string
	occurrenceIndex?: number
	occurrenceStartsAt?: string
	blockId?: string
	isPrivate?: boolean
	draggable?: boolean
}

export type CalendarProps = {
	children: ReactNode
	defaultDate?: Date
	events?: CalendarEvent[]
	view?: View
	locale?: Locale
	enableHotkeys?: boolean
	onChangeView?: (view: View) => void
	onEventClick?: (event: CalendarEvent) => void
	onTimeSlotClick?: (date: Date) => void
	onEventDrop?: (event: CalendarEvent, startsAt: Date) => void
	availabilityMode?: boolean
}
