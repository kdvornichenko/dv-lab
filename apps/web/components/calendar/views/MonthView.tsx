'use client'

import { useMemo } from 'react'

import { format, isSameMonth, isToday } from 'date-fns'

import { cn } from '@/lib/utils'

import { TONE_EVENT } from '../constants'
import { useCalendar } from '../context'
import { eventTone, formatEventTime, generateWeekdays, getDaysInMonth, sameDayEvents } from '../utils'

export const CalendarMonthView = () => {
	const { date, events, locale, setDate, setView, onChangeView, onEventClick } = useCalendar()
	const monthDates = useMemo(() => getDaysInMonth(date), [date])
	const weekDays = useMemo(() => generateWeekdays(locale), [locale])

	return (
		<div className="bg-surface font-body text-ink flex h-full flex-col p-4">
			<div className="border-line-soft bg-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
				<div className="border-line-soft grid grid-cols-7 border-b">
					{weekDays.map((day) => (
						<div key={day} className="text-ink-muted px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em]">
							{day}
						</div>
					))}
				</div>
				<div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
					{monthDates.map((day, index) => {
						const dayEvents = sameDayEvents(events, day)
						const visibleEvents = dayEvents.slice(0, 3)
						const overflow = dayEvents.length - visibleEvents.length
						const out = !isSameMonth(date, day)
						const openWeek = () => {
							setDate(day)
							setView('week')
							onChangeView?.('week')
						}

						return (
							<div
								key={day.toISOString()}
								className={cn(
									'min-h-27 border-line-soft hover:bg-sage-soft/45 relative border-b border-r p-1.5 text-left transition-colors',
									index % 7 === 6 && 'border-r-0',
									out && 'bg-surface-muted/35 text-ink-muted'
								)}
							>
								<button
									type="button"
									className="focus-visible:ring-sage/35 absolute inset-0 p-1.5 text-left focus-visible:outline-none focus-visible:ring-2"
									onClick={openWeek}
									aria-label={`Open week of ${format(day, 'd MMMM yyyy', { locale })}`}
								>
									<span
										className={cn(
											'flex size-7 items-center justify-center rounded-full font-mono text-[12px]',
											isToday(day) ? 'bg-ink text-surface' : 'text-ink/80'
										)}
									>
										{format(day, 'd')}
									</span>
								</button>
								<div className="relative z-10 mt-8 flex flex-col gap-0.5">
									{visibleEvents.map((event) => (
										<button
											data-private
											key={event.id}
											type="button"
											className={cn(
												'truncate rounded border px-1.5 py-0.5 text-left text-[10px] leading-tight',
												TONE_EVENT[eventTone(event)]
											)}
											onClick={(clickEvent) => {
												clickEvent.stopPropagation()
												onEventClick?.(event)
											}}
										>
											{formatEventTime(event.start)} {event.title}
										</button>
									))}
									{overflow > 0 && <span className="text-ink-muted px-1 font-mono text-[10px]">+{overflow} more</span>}
								</div>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
