'use client'

import type { FC } from 'react'

import { addDays, differenceInMinutes, format, isToday, setHours, startOfDay } from 'date-fns'
import { CalendarPlus, MapPin, Video } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import { TONE_RAIL } from '../constants'
import { useCalendar } from '../context'
import { AttendeeStack, EventBadges } from '../event-parts'
import { eventTone, formatEventTime, sameDayEvents } from '../utils'
import type { AgendaSectionProps } from './AgendaView.types'

export const CalendarDayView: FC = () => {
	const { date, events, locale, onEventClick, onTimeSlotClick } = useCalendar()
	const selectedDay = startOfDay(date)
	const nextDay = addDays(selectedDay, 1)
	const selectedLabel = isToday(selectedDay) ? 'Today' : 'Selected day'
	const nextLabel = isToday(nextDay) ? 'Today' : 'Next day'
	const visibleEvents = [selectedDay, nextDay].flatMap((day) => sameDayEvents(events, day))
	const bookedMinutes = visibleEvents.reduce(
		(sum, event) => sum + Math.max(differenceInMinutes(event.end, event.start), 0),
		0
	)

	return (
		<ScrollArea className="bg-surface font-body text-ink h-full">
			<div className="mx-auto max-w-3xl px-4 py-5">
				<div className="text-ink-muted font-mono text-[10px] uppercase tracking-[0.3em]">
					{format(selectedDay, 'EEE, d MMM', { locale })} · agenda
				</div>
				<h2 className="font-heading mt-1 text-3xl tracking-tight">Agenda</h2>
				<p data-private className="text-ink-muted mt-1 text-sm">
					{visibleEvents.length} lessons · {Math.round(bookedMinutes / 60)}h {bookedMinutes % 60}m booked
				</p>

				<AgendaSection
					label={selectedLabel}
					date={selectedDay}
					events={sameDayEvents(events, selectedDay)}
					onEventClick={onEventClick}
				/>
				<AgendaSection
					label={nextLabel}
					date={nextDay}
					events={sameDayEvents(events, nextDay)}
					onEventClick={onEventClick}
				/>

				{visibleEvents.length === 0 && (
					<button
						type="button"
						className="border-line-strong bg-surface-muted text-ink-muted hover:bg-sage-soft/45 mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm transition-colors"
						onClick={() => onTimeSlotClick?.(setHours(selectedDay, 10))}
					>
						<CalendarPlus className="h-4 w-4" />
						Add first lesson
					</button>
				)}
			</div>
		</ScrollArea>
	)
}

const AgendaSection: FC<AgendaSectionProps> = ({ label, date, events, onEventClick }) => {
	const { locale } = useCalendar()

	return (
		<section className="mt-8">
			<div className="mb-2 flex items-end justify-between">
				<span className="text-ink-muted font-mono text-[10px] uppercase tracking-[0.25em]">{label}</span>
				<span className="text-ink-muted font-mono text-[10px] uppercase tracking-[0.25em]">
					{format(date, 'EEE, d MMM', { locale })}
				</span>
			</div>
			<ol className="flex flex-col gap-1.5">
				{events.map((event, index) => {
					const previous = events[index - 1]
					const gap = previous ? differenceInMinutes(event.start, previous.end) : 0

					return (
						<li key={event.id} className="contents">
							{gap >= 20 && (
								<div className="text-ink-muted flex items-center gap-3 px-1 py-1.5 text-xs">
									<span className="bg-line-soft h-px flex-1" />
									<span className="font-mono text-[10px] uppercase tracking-[0.2em]">Focus · {gap}m</span>
									<span className="bg-line-soft h-px flex-1" />
								</div>
							)}
							<button
								type="button"
								className="border-line-soft bg-surface hover:bg-surface-muted/70 grid grid-cols-[80px_1fr] gap-3 rounded-lg border px-3 py-3 text-left transition-colors"
								onClick={() => onEventClick?.(event)}
							>
								<div className="font-mono text-[11px] tabular-nums">
									<div className="text-ink">{formatEventTime(event.start)}</div>
									<div className="text-ink-muted">{formatEventTime(event.end)}</div>
								</div>
								<div className="flex min-w-0 items-center gap-3">
									<span className={cn('h-12 w-1 shrink-0 rounded-full', TONE_RAIL[eventTone(event)])} />
									<div className="min-w-0 flex-1">
										<div data-private className="text-ink truncate text-sm font-medium">
											{event.title}
										</div>
										<div className="text-ink-muted mt-0.5 flex items-center gap-2 font-mono text-[10px]">
											{event.location?.toLowerCase().includes('zoom') ? (
												<Video className="size-3" />
											) : (
												<MapPin className="size-3" />
											)}
											<span className="truncate">{event.location ?? event.subtitle ?? 'Lesson'}</span>
										</div>
										<div className="mt-1 flex flex-wrap items-center gap-1.5">
											<EventBadges badges={event.badges} />
										</div>
									</div>
									<AttendeeStack attendees={event.attendees} />
								</div>
							</button>
						</li>
					)
				})}
				{events.length === 0 && (
					<li className="border-line-strong bg-surface-muted text-ink-muted rounded-lg border border-dashed px-3 py-5 text-sm">
						No lessons scheduled.
					</li>
				)}
			</ol>
		</section>
	)
}
