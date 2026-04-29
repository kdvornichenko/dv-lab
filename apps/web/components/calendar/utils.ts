import type { Locale } from 'date-fns'
import { addDays, format, isSameDay, setHours, startOfDay, startOfMonth, startOfWeek } from 'date-fns'

import type { CalendarEvent, CalendarTone } from './types'

export function formatEventTime(date: Date) {
	return format(date, 'HH:mm')
}

export function calendarSlot(day: Date, hour: number) {
	const slot = setHours(startOfDay(day), hour)
	slot.setMinutes(0, 0, 0)
	return slot
}

export function eventTone(event: CalendarEvent): CalendarTone {
	if (event.isAlert) return 'pink'
	return event.color ?? 'default'
}

export function sameDayEvents(events: CalendarEvent[], date: Date) {
	return events.filter((event) => isSameDay(event.start, date)).sort((a, b) => a.start.getTime() - b.start.getTime())
}

export const getDaysInMonth = (date: Date) => {
	const startOfMonthDate = startOfMonth(date)
	const startOfWeekForMonth = startOfWeek(startOfMonthDate, {
		weekStartsOn: 1,
	})

	let currentDate = startOfWeekForMonth
	const calendar = []

	while (calendar.length < 42) {
		calendar.push(new Date(currentDate))
		currentDate = addDays(currentDate, 1)
	}

	return calendar
}

export const generateWeekdays = (locale: Locale) => {
	const daysOfWeek = []
	for (let i = 0; i < 7; i++) {
		const date = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i)
		daysOfWeek.push(format(date, 'EEE', { locale }))
	}
	return daysOfWeek
}
