import type { CalendarEventView } from '@dv-lab/contracts'
import { addDays, lessonDayMinutes, startOfLessonDay } from '@dv-lab/core'

export const COLUMN_STRIP = 12
const COLUMN_INSET = 2
const LANE_GAP = 2
const LANE_MIN = 20
const CASCADE_STEP = 12
const DAY_MINUTES = 1440
const MIN_DRAWN_MINUTES = 30

export interface BlockLayout {
	top: number
	height: number
	left: number
	width: number
	layer: number
	cutTop: boolean
	cutBottom: boolean
}

type Segment = { event: CalendarEventView; start: number; end: number; cutTop: boolean; cutBottom: boolean }
type Laned = Segment & { lane: number; span: number }

function orderEvents(left: CalendarEventView, right: CalendarEventView): number {
	if (left.when.kind === 'all_day')
		return right.when.kind === 'all_day' ? left.when.startsOn.localeCompare(right.when.startsOn) : -1
	if (right.when.kind === 'all_day') return 1
	return Date.parse(left.when.startsAt) - Date.parse(right.when.startsAt)
}

export function eventsOn(events: readonly CalendarEventView[], date: string, timeZone: string) {
	const start = startOfLessonDay(date, timeZone).getTime()
	const end = startOfLessonDay(addDays(date, 1), timeZone).getTime()
	return events
		.filter(({ when }) =>
			when.kind === 'all_day'
				? when.startsOn <= date && date < when.endsBefore
				: Date.parse(when.startsAt) < end && Date.parse(when.endsAt) > start
		)
		.sort(orderEvents)
}

function segments(events: readonly CalendarEventView[], date: string, timeZone: string): Segment[] {
	const dayStart = startOfLessonDay(date, timeZone).getTime()
	const dayEnd = startOfLessonDay(addDays(date, 1), timeZone).getTime()
	const result: Segment[] = []
	for (const event of eventsOn(events, date, timeZone)) {
		if (event.when.kind !== 'timed') continue
		const first = Date.parse(event.when.startsAt)
		const last = Date.parse(event.when.endsAt)
		const cutTop = first < dayStart
		const cutBottom = last > dayEnd
		const start = cutTop ? 0 : lessonDayMinutes(new Date(first), timeZone)
		const end = last >= dayEnd ? DAY_MINUTES : lessonDayMinutes(new Date(last), timeZone)
		result.push({ event, start, end: Math.max(end, start + 1), cutTop, cutBottom })
	}
	return result.sort(
		(left, right) =>
			left.start - right.start || right.end - left.end || left.event.eventKey.localeCompare(right.event.eventKey)
	)
}

function laneCluster(cluster: Segment[]): { items: Laned[]; lanes: number } {
	const laneEnds: number[] = []
	const items: Laned[] = cluster.map((item) => {
		let lane = laneEnds.findIndex((end) => end <= item.start)
		if (lane === -1) lane = laneEnds.length
		laneEnds[lane] = item.end
		return { ...item, lane, span: 1 }
	})
	const lanes = laneEnds.length
	for (const item of items) {
		let span = 1
		while (
			item.lane + span < lanes &&
			!items.some((other) => other.lane === item.lane + span && other.start < item.end && other.end > item.start)
		)
			span++
		item.span = span
	}
	return { items, lanes }
}

function placeCluster(cluster: Segment[], minuteHeight: number, columnWidth: number) {
	const { items, lanes } = laneCluster(cluster)
	const room = Math.max(columnWidth - COLUMN_INSET - COLUMN_STRIP, LANE_MIN)
	const fit = Math.max(1, Math.floor((room + LANE_GAP) / (LANE_MIN + LANE_GAP)))
	const shown = Math.min(lanes, fit)
	const laneWidth = (room - LANE_GAP * (shown - 1)) / shown
	const lastLeft = COLUMN_INSET + (shown - 1) * (laneWidth + LANE_GAP)
	const cascadeStart = Math.max(COLUMN_INSET, lastLeft - (lanes - shown) * CASCADE_STEP)
	return items.map((item) => {
		const cascade = lanes > fit && item.lane >= fit - 1
		const lane = cascade ? fit - 1 : item.lane
		const span = cascade ? 1 : Math.max(1, Math.min(item.span, (lanes > fit ? fit - 1 : shown) - lane))
		const width = span * laneWidth + (span - 1) * LANE_GAP
		const left = cascade
			? Math.min(cascadeStart + (item.lane - (fit - 1)) * CASCADE_STEP, COLUMN_INSET + room - width)
			: COLUMN_INSET + lane * (laneWidth + LANE_GAP)
		const drawnEnd = Math.min(DAY_MINUTES, Math.max(item.end, item.start + MIN_DRAWN_MINUTES))
		return {
			event: item.event,
			layout: {
				top: item.start * minuteHeight,
				height: (drawnEnd - item.start) * minuteHeight - 2,
				left,
				width,
				layer: cascade ? item.lane - (fit - 1) : 0,
				cutTop: item.cutTop,
				cutBottom: item.cutBottom,
			},
		}
	})
}

export function placeDay(
	events: readonly CalendarEventView[],
	date: string,
	timeZone: string,
	hourHeight: number,
	columnWidth: number
) {
	const placed: { event: CalendarEventView; layout: BlockLayout }[] = []
	let cluster: Segment[] = []
	let clusterEnd = -1
	for (const item of segments(events, date, timeZone)) {
		if (cluster.length > 0 && item.start >= clusterEnd) {
			placed.push(...placeCluster(cluster, hourHeight / 60, columnWidth))
			cluster = []
		}
		cluster.push(item)
		clusterEnd = Math.max(clusterEnd, item.end)
	}
	if (cluster.length > 0) placed.push(...placeCluster(cluster, hourHeight / 60, columnWidth))
	return placed
}
