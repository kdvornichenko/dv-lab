import type { GoogleScheduleWindow } from '@dv-lab/contracts'
import { mondayOf, scheduleDate, overlaps } from '@dv-lab/core'

import { eventTitle } from './calendar-event-details'
import type { OverlapBlock } from './new-lesson-dialog'

export async function readCalendarOverlaps(
	date: string,
	readWindow: (date: string) => Promise<GoogleScheduleWindow | null>
): Promise<OverlapBlock[] | null> {
	const window = await readWindow(date)
	if (
		window === null ||
		window.read.state !== 'fresh' ||
		scheduleDate(new Date(window.requestedRange.start), window.requestedRange.timeZone) !== mondayOf(date)
	)
		return null
	return window.events.flatMap((event) =>
		event.when.kind === 'timed' && event.blocksTime && event.status !== 'cancelled'
			? [
					{
						key: event.eventKey,
						startsAt: new Date(event.when.startsAt),
						durationMinutes: (Date.parse(event.when.endsAt) - Date.parse(event.when.startsAt)) / 60000,
						outcome: 'planned' as const,
						studentName: eventTitle(event),
					},
				]
			: []
	)
}

export function overlapsOn(
	date: string,
	day: { date: string; items: OverlapBlock[] } | null,
	candidate: { startsAt: Date; durationMinutes: number } | null,
	omitKey?: string
) {
	return candidate !== null && day?.date === date ? overlaps(day.items, candidate, omitKey) : []
}
