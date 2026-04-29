'use client'

import { useMemo } from 'react'

import { format, isSameDay, setMonth } from 'date-fns'

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import { useCalendar } from '../context'
import { generateWeekdays, getDaysInMonth } from '../utils'

export const CalendarYearView = () => {
	const { date, today, locale, setDate, setView, onChangeView } = useCalendar()
	const months = useMemo(() => Array.from({ length: 12 }, (_, index) => getDaysInMonth(setMonth(date, index))), [date])
	const weekDays = useMemo(() => generateWeekdays(locale), [locale])

	return (
		<ScrollArea className="bg-surface font-body text-ink h-full">
			<div className="min-w-210 grid grid-cols-4 gap-6 p-5">
				{months.map((days, index) => (
					<div key={days[15].toISOString()} className="border-line-soft rounded-lg border p-3">
						<div className="font-heading text-sm">{format(setMonth(date, index), 'LLLL', { locale })}</div>
						<div className="my-3 grid grid-cols-7 gap-1">
							{weekDays.map((day) => (
								<div key={day} className="text-ink-muted text-center font-mono text-[9px]">
									{day}
								</div>
							))}
						</div>
						<div className="grid grid-cols-7 gap-1 text-center text-[10px] tabular-nums">
							{days.map((day) => (
								<button
									key={day.toISOString()}
									type="button"
									className={cn(
										'grid aspect-square place-content-center rounded-full',
										day.getMonth() !== index && 'text-ink-muted/45',
										isSameDay(today, day) && day.getMonth() === index && 'bg-sage text-primary-foreground'
									)}
									onClick={() => {
										setDate(day)
										setView('week')
										onChangeView?.('week')
									}}
								>
									{format(day, 'd')}
								</button>
							))}
						</div>
					</div>
				))}
			</div>
		</ScrollArea>
	)
}
