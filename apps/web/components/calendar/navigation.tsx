'use client'

import { forwardRef, useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import {
	addDays,
	addMonths,
	addWeeks,
	addYears,
	format,
	startOfWeek,
	subDays,
	subMonths,
	subWeeks,
	subYears,
} from 'date-fns'

import { Button } from '@/components/ui/button'

import { useCalendar } from './context'
import type { View } from './types'

export const CalendarViewTrigger = forwardRef<
	HTMLButtonElement,
	React.HTMLAttributes<HTMLButtonElement> & {
		view: View
	}
>(({ children, view, ...props }, ref) => {
	const { view: currentView, setView, onChangeView } = useCalendar()

	return (
		<Button
			ref={ref}
			aria-current={currentView === view}
			size="sm"
			variant="ghost"
			{...props}
			onClick={() => {
				setView(view)
				onChangeView?.(view)
			}}
		>
			{children}
		</Button>
	)
})
CalendarViewTrigger.displayName = 'CalendarViewTrigger'

export const CalendarNextTrigger = forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(
	({ children, onClick, ...props }, ref) => {
		const { date, setDate, view, enableHotkeys } = useCalendar()

		const next = useCallback(() => {
			if (view === 'day') {
				setDate(addDays(date, 1))
			} else if (view === 'week') {
				setDate(addWeeks(date, 1))
			} else if (view === 'month') {
				setDate(addMonths(date, 1))
			} else if (view === 'year') {
				setDate(addYears(date, 1))
			}
		}, [date, view, setDate])

		useHotkeys('ArrowRight', () => next(), {
			enabled: enableHotkeys,
		})

		return (
			<Button
				size="icon"
				variant="outline"
				ref={ref}
				{...props}
				onClick={(e) => {
					next()
					onClick?.(e)
				}}
			>
				{children}
			</Button>
		)
	}
)
CalendarNextTrigger.displayName = 'CalendarNextTrigger'

export const CalendarPrevTrigger = forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(
	({ children, onClick, ...props }, ref) => {
		const { date, setDate, view, enableHotkeys } = useCalendar()

		const prev = useCallback(() => {
			if (view === 'day') {
				setDate(subDays(date, 1))
			} else if (view === 'week') {
				setDate(subWeeks(date, 1))
			} else if (view === 'month') {
				setDate(subMonths(date, 1))
			} else if (view === 'year') {
				setDate(subYears(date, 1))
			}
		}, [date, view, setDate])

		useHotkeys('ArrowLeft', () => prev(), {
			enabled: enableHotkeys,
		})

		return (
			<Button
				size="icon"
				variant="outline"
				ref={ref}
				{...props}
				onClick={(e) => {
					prev()
					onClick?.(e)
				}}
			>
				{children}
			</Button>
		)
	}
)
CalendarPrevTrigger.displayName = 'CalendarPrevTrigger'

export const CalendarTodayTrigger = forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(
	({ children, onClick, ...props }, ref) => {
		const { setDate, enableHotkeys, today } = useCalendar()

		const jumpToToday = useCallback(() => {
			setDate(today)
		}, [today, setDate])

		useHotkeys('t', () => jumpToToday(), {
			enabled: enableHotkeys,
		})

		return (
			<Button
				variant="outline"
				ref={ref}
				{...props}
				onClick={(e) => {
					jumpToToday()
					onClick?.(e)
				}}
			>
				{children}
			</Button>
		)
	}
)
CalendarTodayTrigger.displayName = 'CalendarTodayTrigger'

export const CalendarCurrentDate = () => {
	const { date, locale, view } = useCalendar()
	const label =
		view === 'day'
			? format(date, 'dd MMMM yyyy', { locale })
			: view === 'week'
				? `${format(startOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale })} - ${format(addDays(startOfWeek(date, { weekStartsOn: 1 }), 6), 'd MMM', { locale })}`
				: view === 'year'
					? format(date, 'yyyy', { locale })
					: format(date, 'LLLL yyyy', { locale })

	return (
		<time dateTime={date.toISOString()} className="font-heading text-ink tabular-nums">
			{label}
		</time>
	)
}
