'use client'

import Link from 'next/link'

import { TimePair } from '@/components/app/time-pair'
import { formatFullDate, formatRange, mainRange, secondRange } from '@/lib/schedule-format'

import type { CalendarEventView } from '@dv-lab/contracts'
import { addDays } from '@dv-lab/core'

export function eventTitle(event: CalendarEventView): string {
	return event.title?.trim() || 'Busy'
}

export function eventStatus(event: CalendarEventView): string {
	if (event.status === 'cancelled') return 'Cancelled'
	if (event.status === 'tentative') return 'Tentative'
	return event.binding.kind === 'lesson' ? 'Planned' : 'Confirmed'
}

export function eventRange(event: CalendarEventView, timeZone: string): string {
	if (event.when.kind === 'all_day') return 'All day'
	const start = new Date(event.when.startsAt)
	const minutes = (Date.parse(event.when.endsAt) - start.getTime()) / 60000
	return formatRange(start, minutes, timeZone)
}

export function EventTime({
	event,
	timeZone,
	secondZone,
	currentYear,
}: {
	event: CalendarEventView
	timeZone: string
	secondZone: string | null
	currentYear: number
}) {
	if (event.when.kind === 'all_day') {
		const last = addDays(event.when.endsBefore, -1)
		return (
			<>
				<span>All day</span>
				<span className="text-muted-foreground">
					{event.when.startsOn}
					{last !== event.when.startsOn ? ` – ${last}` : ''}
				</span>
				<span className="text-caption text-muted-foreground">{event.when.timeZone}</span>
			</>
		)
	}
	const start = new Date(event.when.startsAt)
	const end = new Date(event.when.endsAt)
	const minutes = (end.getTime() - start.getTime()) / 60000
	const firstDay = formatFullDate(start, timeZone, currentYear)
	const lastDay = formatFullDate(end, timeZone, currentYear)
	return (
		<>
			<span className="text-muted-foreground">
				{firstDay}
				{lastDay !== firstDay ? ` – ${lastDay}` : ''}
			</span>
			<TimePair
				as="span"
				main={mainRange(start, minutes, timeZone, null)}
				second={secondRange(start, minutes, timeZone, secondZone)}
				mainClassName="text-body tabular-nums"
			/>
		</>
	)
}

export function CalendarEventDetails({
	editable = false,
	event,
	timeZone,
	secondZone,
	currentYear,
}: {
	editable?: boolean
	event: CalendarEventView
	timeZone: string
	secondZone: string | null
	currentYear: number
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1 text-body wrap-anywhere" data-slot="calendar-event-details">
			<EventTime event={event} timeZone={timeZone} secondZone={secondZone} currentYear={currentYear} />
			<span>{eventStatus(event)}</span>
			<span>{event.blocksTime ? 'Busy' : 'Available'}</span>
			<span className="text-muted-foreground">Google Calendar event</span>
			<span className="text-muted-foreground">{editable ? 'Editable' : 'Read-only'}</span>
			{event.binding.kind === 'transition' ? (
				<p className="text-muted-foreground">
					This change has not been confirmed. Check its status before trying again.{' '}
					<Link href="/settings?tab=calendar" className="underline underline-offset-2">
						Check status
					</Link>
				</p>
			) : null}
		</div>
	)
}
