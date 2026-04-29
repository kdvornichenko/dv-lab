'use client'

import { useMemo } from 'react'

import { addDays, format, isSameDay, isToday, startOfWeek } from 'date-fns'
import { Plus } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import { HOUR_PX, TONE_EVENT, WEEK_END_HOUR, WEEK_START_HOUR } from '../constants'
import { useCalendar } from '../context'
import { calendarSlot, eventTone, formatEventTime, sameDayEvents } from '../utils'

export const CalendarWeekView = () => {
	const { date, locale, events, onEventClick, onTimeSlotClick } = useCalendar()
	const hours = useMemo(
		() => Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR + 1 }, (_, index) => WEEK_START_HOUR + index),
		[]
	)
	const days = useMemo(() => {
		const start = startOfWeek(date, { weekStartsOn: 1 })
		return Array.from({ length: 7 }, (_, index) => addDays(start, index))
	}, [date])
	const weekEvents = useMemo(
		() => events.filter((event) => days.some((day) => isSameDay(day, event.start))),
		[days, events]
	)

	return (
		<ScrollArea className="h-full bg-surface font-body text-ink">
			<div className="min-w-230">
				<div className="bg-surface">
					<div className="sticky top-0 z-100 grid grid-cols-[64px_repeat(7,1fr)] border-b border-line-soft bg-surface/10 backdrop-blur-xs">
						<div className="border-r border-line-soft" />
						{days.map((day) => (
							<div key={day.toISOString()} className="border-line-soft px-3 py-3 last:border-r-0 sm:border-r">
								<div className="font-mono text-[10px] tracking-[0.25em] text-ink-muted uppercase">
									{format(day, 'EEE', { locale })}
								</div>
								<div
									className={cn(
										'mt-0.5 inline-flex size-7 items-center justify-center rounded-full font-heading text-base',
										isToday(day) && 'bg-ink text-surface'
									)}
								>
									{format(day, 'd')}
								</div>
							</div>
						))}
					</div>

					<div className="grid grid-cols-[64px_repeat(7,1fr)]">
						<div className="border-r border-line-soft">
							{hours.map((hour) => (
								<div
									key={hour}
									className="flex items-start justify-end px-2 py-1 font-mono text-[10px] text-ink-muted"
									style={{ height: HOUR_PX }}
								>
									{String(hour).padStart(2, '0')}:00
								</div>
							))}
						</div>

						{days.map((day) => (
							<div
								key={day.toISOString()}
								className="relative border-line-soft last:border-r-0 sm:border-r"
								style={{ height: hours.length * HOUR_PX }}
							>
								{hours.map((hour, hourIndex) => (
									<button
										key={hour}
										type="button"
										className="absolute inset-x-0 border-t border-line-soft text-left transition-colors hover:bg-sage-soft/45 focus-visible:bg-sage-soft/60 focus-visible:ring-2 focus-visible:ring-sage/35 focus-visible:outline-none"
										style={{ top: hourIndex * HOUR_PX, height: HOUR_PX }}
										onClick={() => onTimeSlotClick?.(calendarSlot(day, hour))}
										aria-label={`Add lesson at ${format(calendarSlot(day, hour), 'HH:mm')}`}
									>
										<span className="mt-2 ml-2 inline-flex items-center gap-1 rounded-md text-sage opacity-0 transition-opacity hover:opacity-100 focus:opacity-100">
											<Plus className="h-3 w-3" />
										</span>
									</button>
								))}

								{isToday(day) && <NowLine />}

								{sameDayEvents(weekEvents, day).map((event) => {
									const startMinutes = event.start.getHours() * 60 + event.start.getMinutes()
									const endMinutes = event.end.getHours() * 60 + event.end.getMinutes()
									const calendarStart = WEEK_START_HOUR * 60
									const top = ((startMinutes - calendarStart) / 60) * HOUR_PX
									const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_PX - 2, 28)

									return (
										<button
											key={event.id}
											type="button"
											className={cn(
												'absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-left shadow-sm',
												TONE_EVENT[eventTone(event)]
											)}
											style={{
												top: Math.max(top, 0),
												height,
												left: 4,
												width: 'calc(100% - 8px)',
											}}
											onClick={() => onEventClick?.(event)}
										>
											<div className="truncate text-xs leading-tight font-medium">{event.title}</div>
											<div className="font-mono text-xs opacity-70">
												{formatEventTime(event.start)}-{formatEventTime(event.end)}
											</div>
											{event.badges?.some((badge) => badge.tone === 'danger') && (
												<div className="mt-0.5 font-mono text-xs">
													{event.badges.find((badge) => badge.tone === 'danger')?.label}
												</div>
											)}
										</button>
									)
								})}
							</div>
						))}
					</div>
				</div>
			</div>
		</ScrollArea>
	)
}

function NowLine() {
	const now = new Date()
	const currentMinutes = now.getHours() * 60 + now.getMinutes()
	const calendarStart = WEEK_START_HOUR * 60
	const calendarEnd = (WEEK_END_HOUR + 1) * 60

	if (currentMinutes < calendarStart || currentMinutes > calendarEnd) return null

	return (
		<div
			className="absolute inset-x-0 z-20 flex items-center"
			style={{ top: ((currentMinutes - calendarStart) / 60) * HOUR_PX }}
		>
			<span className="size-2 rounded-full bg-danger ring-2 ring-danger/30" />
			<span className="h-px flex-1 bg-danger" />
		</div>
	)
}
