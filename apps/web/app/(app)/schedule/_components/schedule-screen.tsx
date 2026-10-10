'use client'

import { useMemo, useSyncExternalStore } from 'react'

import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { SkeletonTable } from '@/components/ui/skeleton'
import { weekRange } from '@/lib/schedule-format'

import { SCHEDULE_TIME_ZONE, mondayOf, zonedParts } from '@dv-lab/core'

import { WeekGrid, type SecondZone } from './week-grid'

const FRAME_HEIGHT = 'h-[max(28rem,calc(100svh-18rem))]'
const DEFAULT_SECOND_ZONE: SecondZone = { id: 'Europe/Moscow', caption: 'MSK' }

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
	const today = zonedParts(now, SCHEDULE_TIME_ZONE).date
	const monday = mondayOf(today)
	return (
		<PageScroll>
			<PageHeader title={weekRange(monday)} />
			<WeekGrid monday={monday} today={today} now={now} secondZone={DEFAULT_SECOND_ZONE} />
		</PageScroll>
	)
}
