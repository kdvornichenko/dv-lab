'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import type { Locale } from 'date-fns'
import { ru } from 'date-fns/locale'

import type { CalendarEvent, CalendarProps, View } from './types'

type ContextType = {
	view: View
	setView: (view: View) => void
	date: Date
	setDate: (date: Date) => void
	events: CalendarEvent[]
	locale: Locale
	setEvents: (date: CalendarEvent[]) => void
	onChangeView?: (view: View) => void
	onEventClick?: (event: CalendarEvent) => void
	onTimeSlotClick?: (date: Date) => void
	enableHotkeys?: boolean
	today: Date
}

const Context = createContext<ContextType>({} as ContextType)

export const Calendar = ({
	children,
	defaultDate = new Date(),
	locale = ru,
	enableHotkeys = true,
	view: _defaultMode = 'week',
	onEventClick,
	onTimeSlotClick,
	events: defaultEvents = [],
	onChangeView,
}: CalendarProps) => {
	const [view, setView] = useState<View>(_defaultMode)
	const [date, setDate] = useState(defaultDate)
	const [events, setEvents] = useState<CalendarEvent[]>(defaultEvents)

	useEffect(() => {
		setEvents(defaultEvents)
	}, [defaultEvents])

	const changeView = (view: View) => {
		setView(view)
		onChangeView?.(view)
	}

	useHotkeys('m', () => changeView('month'), {
		enabled: enableHotkeys,
	})

	useHotkeys('w', () => changeView('week'), {
		enabled: enableHotkeys,
	})

	useHotkeys('y', () => changeView('year'), {
		enabled: enableHotkeys,
	})

	useHotkeys('d', () => changeView('day'), {
		enabled: enableHotkeys,
	})

	return (
		<Context.Provider
			value={{
				view,
				setView,
				date,
				setDate,
				events,
				setEvents,
				locale,
				enableHotkeys,
				onEventClick,
				onTimeSlotClick,
				onChangeView,
				today: new Date(),
			}}
		>
			{children}
		</Context.Provider>
	)
}

export const useCalendar = () => useContext(Context)
