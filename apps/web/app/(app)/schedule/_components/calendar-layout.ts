import type { CalendarEventView } from '@dv-lab/contracts'
import { addDays, startOfZonedDay, zonedParts } from '@dv-lab/core'

export interface BlockLayout {
	top: number
	height: number
	lane: number
	lanes: number
}

type Segment = { event: CalendarEventView; start: number; end: number }

function orderEvents(left: CalendarEventView, right: CalendarEventView): number {
	if (left.when.kind === 'all_day')
		return right.when.kind === 'all_day' ? left.when.startsOn.localeCompare(right.when.startsOn) : -1
	if (right.when.kind === 'all_day') return 1
	return Date.parse(left.when.startsAt) - Date.parse(right.when.startsAt)
}

export function eventsOn(events: readonly CalendarEventView[], date: string, timeZone: string) {
	const start = startOfZonedDay(date, timeZone).getTime()
	const end = startOfZonedDay(addDays(date, 1), timeZone).getTime()
	return events
		.filter(({ when }) =>
			when.kind === 'all_day'
				? when.startsOn <= date && date < when.endsBefore
				: Date.parse(when.startsAt) < end && Date.parse(when.endsAt) > start
		)
		.sort(orderEvents)
}

function segments(events: readonly CalendarEventView[], date: string, timeZone: string): Segment[] {
	const dayStart = startOfZonedDay(date, timeZone).getTime()
	const dayEnd = startOfZonedDay(addDays(date, 1), timeZone).getTime()
	const result: Segment[] = []
	for (const event of eventsOn(events, date, timeZone)) {
		if (event.when.kind !== 'timed') continue
		const first = Date.parse(event.when.startsAt)
		const last = Date.parse(event.when.endsAt)
		const start = first <= dayStart ? 0 : zonedParts(new Date(first), timeZone).minutes
		const end = last >= dayEnd ? 1440 : zonedParts(new Date(last), timeZone).minutes
		result.push({ event, start, end: Math.min(1440, Math.max(end, start + 30)) })
	}
	return result.sort(
		(left, right) => left.start - right.start || left.event.eventKey.localeCompare(right.event.eventKey)
	)
}

function placeCluster(cluster: Segment[], minuteHeight: number) {
	const laneEnds: number[] = []
	const placed = cluster.map((item) => {
		let lane = laneEnds.findIndex((end) => end <= item.start)
		if (lane === -1) lane = laneEnds.length
		laneEnds[lane] = item.end
		return {
			event: item.event,
			layout: {
				top: item.start * minuteHeight,
				height: (item.end - item.start) * minuteHeight - 2,
				lane,
				lanes: 0,
			},
		}
	})
	for (const item of placed) item.layout.lanes = laneEnds.length
	return placed
}

export function placeDay(events: readonly CalendarEventView[], date: string, timeZone: string, hourHeight: number) {
	const placed: { event: CalendarEventView; layout: BlockLayout }[] = []
	let cluster: Segment[] = []
	let clusterEnd = -1
	for (const item of segments(events, date, timeZone)) {
		if (cluster.length > 0 && item.start >= clusterEnd) {
			placed.push(...placeCluster(cluster, hourHeight / 60))
			cluster = []
		}
		cluster.push(item)
		clusterEnd = Math.max(clusterEnd, item.end)
	}
	placed.push(...placeCluster(cluster, hourHeight / 60))
	return placed
}
