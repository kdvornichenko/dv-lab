'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'

import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { SkeletonTable } from '@/components/ui/skeleton'
import { weekEyebrow, weekRange } from '@/lib/schedule-format'
import { zoneCaption } from '@/lib/time-zones'

import { SCHEDULE_TIME_ZONE, addDays, mondayOf, zonedInstant, zonedParts } from '@dv-lab/core'

import { ScheduleToolbar } from './schedule-toolbar'
import { SecondZoneSelect, useSecondZone } from './second-zone-select'
import { WeekGrid, type SecondZone } from './week-grid'

const FRAME_HEIGHT = 'h-[max(28rem,calc(100svh-18rem))]'

function subscribeMinute(callback: () => void) {
	let timer: ReturnType<typeof setTimeout>
	const schedule = () => {
		timer = setTimeout(
			() => {
				callback()
				schedule()
			},
			60000 - (Date.now() % 60000) + 50
		)
	}
	schedule()
	return () => clearTimeout(timer)
}

const minuteNow = () => Math.floor(Date.now() / 60000)
const serverNow = () => null

function useScheduleNow(): Date | null {
	const minute = useSyncExternalStore(subscribeMinute, minuteNow, serverNow)
	return useMemo(() => (minute === null ? null : new Date(minute * 60000)), [minute])
}

export function ScheduleScreen() {
	const now = useScheduleNow()
	if (now === null) {
		return (
			<PageScroll>
				<PageHeader title="Schedule" />
				<div className={FRAME_HEIGHT}>
					<SkeletonTable rows={10} className="h-full" />
				</div>
			</PageScroll>
		)
	}
	return <LoadedSchedule now={now} />
}

function LoadedSchedule({ now }: { now: Date }) {
	const [offset, setOffset] = useState(0)
	const today = zonedParts(now, SCHEDULE_TIME_ZONE).date
	const currentMonday = mondayOf(today)
	const monday = addDays(currentMonday, offset * 7)
	const [zone, setZone] = useSecondZone()
	const secondZone: SecondZone | null = zone
		? { id: zone, caption: zoneCaption(zone, zonedInstant(monday, '12:00', SCHEDULE_TIME_ZONE), 'gutter') }
		: null
	return (
		<PageScroll>
			<PageHeader eyebrow={weekEyebrow(monday, currentMonday)} title={weekRange(monday)} />
			<ScheduleToolbar
				monday={monday}
				currentMonday={currentMonday}
				onToday={() => setOffset(0)}
				onPrevious={() => setOffset((value) => value - 1)}
				onNext={() => setOffset((value) => value + 1)}
				zoneControl={<SecondZoneSelect zone={zone} monday={monday} onChange={setZone} />}
			/>
			<WeekGrid monday={monday} today={today} now={now} secondZone={secondZone} />
		</PageScroll>
	)
}
