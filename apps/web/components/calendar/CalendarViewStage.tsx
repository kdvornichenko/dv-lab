'use client'

import { useEffect, useRef } from 'react'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { VIEW_ORDER } from './constants'
import { useCalendar } from './context'
import { CalendarDayView } from './views/AgendaView'
import { CalendarMonthView } from './views/MonthView'
import { CalendarWeekView } from './views/WeekView'
import { CalendarYearView } from './views/YearView'

export const CalendarViewStage = () => {
	const { view } = useCalendar()
	const shouldReduceMotion = useReducedMotion()
	const previousViewRef = useRef(view)
	const direction = VIEW_ORDER.indexOf(view) >= VIEW_ORDER.indexOf(previousViewRef.current) ? 1 : -1
	const motionState = shouldReduceMotion
		? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
		: {
				initial: { opacity: 0, x: direction * 28, filter: 'blur(12px)' },
				animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
				exit: { opacity: 0, x: direction * -28, filter: 'blur(12px)' },
			}

	useEffect(() => {
		previousViewRef.current = view
	}, [view])

	return (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={view}
				className="h-full"
				initial={motionState.initial}
				animate={motionState.animate}
				exit={motionState.exit}
				transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: [0.22, 1, 0.36, 1] }}
			>
				{view === 'day' && <CalendarDayView />}
				{view === 'week' && <CalendarWeekView />}
				{view === 'month' && <CalendarMonthView />}
				{view === 'year' && <CalendarYearView />}
			</motion.div>
		</AnimatePresence>
	)
}
