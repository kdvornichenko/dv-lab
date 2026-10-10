'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { SkeletonTable, SkeletonText } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'
import { lessonCount, weekEyebrow, weekPhrase, weekRange, weekSummary, weeksBetween } from '@/lib/schedule-format'
import { zoneCaption } from '@/lib/time-zones'

import type { ScheduleBlock, ScheduleWeekResponse } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, addDays, mondayOf, zonedInstant, zonedParts } from '@dv-lab/core'

import { blockSlot, type BlockSlot } from './lesson-block'
import { LessonDialog, type PairTarget } from './lesson-dialog'
import { ScheduleToolbar } from './schedule-toolbar'
import { SecondZoneSelect, useSecondZone } from './second-zone-select'
import { OPEN_SCROLL_TOP, WeekGrid, type SecondZone } from './week-grid'

const FRAME_HEIGHT = 'h-[max(28rem,calc(100svh-18rem))]'

type OpenLesson = { key: string; slot: BlockSlot }

type WeekState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: ScheduleWeekResponse }

async function readWeek(monday: string): Promise<WeekState> {
	const result = await apiRequest<ScheduleWeekResponse>('GET', `/schedule/week?start=${monday}`)
	return result.ok ? { kind: 'ready', data: result.data } : { kind: 'error' }
}

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
	const [loaded, setLoaded] = useState<{ monday: string; state: WeekState } | null>(null)
	const scrollTopRef = useRef(OPEN_SCROLL_TOP)
	const [lesson, setLesson] = useState<OpenLesson | null>(null)
	const today = zonedParts(now, SCHEDULE_TIME_ZONE).date
	const currentMonday = mondayOf(today)
	const monday = addDays(currentMonday, offset * 7)
	const [zone, setZone] = useSecondZone()
	const secondZone: SecondZone | null = zone
		? { id: zone, caption: zoneCaption(zone, zonedInstant(monday, '12:00', SCHEDULE_TIME_ZONE), 'gutter') }
		: null

	useEffect(() => {
		let current = true
		void readWeek(monday).then((state) => {
			if (current) setLoaded({ monday, state })
		})
		return () => {
			current = false
		}
	}, [monday])

	async function refresh() {
		setLoaded({ monday, state: await readWeek(monday) })
	}

	function closeLesson() {
		const closed = lesson
		setLesson(null)
		if (closed === null) return
		requestAnimationFrame(() =>
			document.querySelector<HTMLElement>(`[data-key="${closed.key}"][data-slot="${closed.slot}"]`)?.focus()
		)
	}

	function openPair(target: PairTarget) {
		const targetMonday = mondayOf(zonedParts(target.at, SCHEDULE_TIME_ZONE).date)
		setOffset(weeksBetween(currentMonday, targetMonday))
		setLesson({ key: target.key, slot: target.slot })
	}

	function go(change: (value: number) => number) {
		setLesson(null)
		setOffset(change)
	}

	const week: WeekState = loaded !== null && loaded.monday === monday ? loaded.state : { kind: 'loading' }
	const currentYear = Number(today.slice(0, 4))

	if (week.kind === 'error') {
		return (
			<PageScroll>
				<PageHeader title="Schedule" />
				<ReadError screen="schedule" onRefresh={refresh} />
			</PageScroll>
		)
	}

	const ready = week.kind === 'ready'
	const openBlock =
		ready && lesson !== null
			? (week.data.blocks.find((block) => block.key === lesson.key && blockSlot(block) === lesson.slot) ?? null)
			: null
	const openSeriesId = openBlock !== null && openBlock.ref.kind === 'series' ? openBlock.ref.seriesId : null
	const openSeries =
		ready && openSeriesId !== null ? (week.data.series.find((rule) => rule.id === openSeriesId) ?? null) : null
	const planned = ready ? week.data.blocks.filter((block) => block.status === 'scheduled').length : 0

	return (
		<PageScroll>
			<PageHeader
				eyebrow={weekEyebrow(monday, currentMonday)}
				title={weekRange(monday)}
				description={ready ? weekSummary(week.data.blocks) : <SkeletonText className="w-48 py-0.5" />}
			/>
			<ScheduleToolbar
				monday={monday}
				currentMonday={currentMonday}
				onToday={() => go(() => 0)}
				onPrevious={() => go((value) => value - 1)}
				onNext={() => go((value) => value + 1)}
				zoneControl={<SecondZoneSelect zone={zone} monday={monday} onChange={setZone} />}
			/>
			{ready ? (
				<WeekGrid
					monday={monday}
					today={today}
					now={now}
					secondZone={secondZone}
					blocks={week.data.blocks}
					currentYear={currentYear}
					onOpen={(block: ScheduleBlock) => setLesson({ key: block.key, slot: blockSlot(block) })}
					scrollTopRef={scrollTopRef}
				/>
			) : (
				<div className={FRAME_HEIGHT}>
					<SkeletonTable rows={10} className="h-full" />
				</div>
			)}
			{ready ? (
				<p aria-live="polite" className="sr-only">
					{weekPhrase(monday)}, {lessonCount(planned)}
				</p>
			) : null}
			{openBlock !== null && ready ? (
				<LessonDialog
					key={`${openBlock.key}:${blockSlot(openBlock)}`}
					block={openBlock}
					series={openSeries}
					secondZone={zone}
					currentYear={currentYear}
					onClose={closeLesson}
					onOpenPair={openPair}
				/>
			) : null}
		</PageScroll>
	)
}
