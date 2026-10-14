'use client'

import { Banner, BannerTitle } from '@/components/ui/banner'
import { formatDate } from '@/lib/schedule-format'

import type { CalendarEventView } from '@dv-lab/contracts'

import { useScheduleArrival, type ArrivalParams } from './use-schedule-arrival'

export function ScheduleArrival({
	failed,
	ready,
	monday,
	events,
	mainTimeZone,
	currentYear,
	...params
}: ArrivalParams & {
	failed: boolean
	ready: boolean
	monday: string
	events: readonly CalendarEventView[]
	mainTimeZone: string
	currentYear: number
}) {
	const arrival = useScheduleArrival({ ...params, failed, ready, monday, events, mainTimeZone, currentYear })
	return (
		<>
			<span role="status" aria-live="polite" className="sr-only">
				{arrival.announcement}
			</span>
			{arrival.gone === null ? null : (
				<Banner
					status="info"
					role="status"
					dismissible
					dismissLabel="Close"
					onDismiss={arrival.dismissGone}
					className="mb-2 shrink-0"
					data-slot="schedule-arrival-gone"
				>
					<BannerTitle>
						That lesson is no longer on {formatDate(arrival.gone, currentYear)}. It was moved or cancelled.
					</BannerTitle>
				</Banner>
			)}
		</>
	)
}
