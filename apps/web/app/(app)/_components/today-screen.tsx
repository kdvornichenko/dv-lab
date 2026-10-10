'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { Stat } from '@/components/app/stat'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { SkeletonStat, SkeletonText } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'
import { formatFullDate, formatTime, lessonCount, secondWhen, withSecond } from '@/lib/schedule-format'

import type { ScheduleBlock, TodayResponse } from '@dv-lab/contracts'
import {
	SCHEDULE_TIME_ZONE,
	countsAsLesson,
	lessonsPhrase,
	scheduleToday,
	todayCounts,
	zonedInstant,
	type TodayCounts,
} from '@dv-lab/core'

import { useMinuteNow } from './use-minute-now'

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: TodayResponse }

async function readToday(): Promise<ReadState> {
	const result = await apiRequest<TodayResponse>('GET', '/today')
	return result.ok ? { kind: 'ready', data: result.data } : { kind: 'error' }
}

function dayTitle(date: string): string {
	return formatFullDate(zonedInstant(date, '12:00', SCHEDULE_TIME_ZONE), SCHEDULE_TIME_ZONE, Number(date.slice(0, 4)))
}

function countsOf(data: TodayResponse, now: Date): TodayCounts {
	return todayCounts(
		{
			lessons: data.lessons.map((block) => ({
				key: block.key,
				startsAt: new Date(block.startsAt),
				outcome: block.outcome,
				studentStatus: block.studentStatus,
				openingOn: block.ledger.openingOn,
			})),
			earlier: data.earlier.length,
			paysSoon: data.paysSoon.length,
		},
		now
	)
}

function nextBlock(blocks: readonly ScheduleBlock[], counts: TodayCounts): ScheduleBlock | null {
	if (counts.nextKey === null) return null
	return blocks.find((block) => block.key === counts.nextKey && countsAsLesson(block.outcome)) ?? null
}

function summaryLine(counts: TodayCounts, next: ScheduleBlock | null, zone: string | null): string {
	if (counts.lessons === 0) return 'No lessons today'
	const count = lessonCount(counts.lessons)
	if (next === null) return count
	const start = new Date(next.startsAt)
	const when = withSecond(`${formatTime(start, SCHEDULE_TIME_ZONE)} VN`, secondWhen(start, zone))
	return `${count} · next: ${next.studentName} at ${when}`
}

function lessonsOrFewer(threshold: number): string {
	return `${lessonsPhrase(threshold, 1)} or fewer left`
}

function Counters({ counts, threshold }: { counts: TodayCounts; threshold: number }) {
	const quiet = counts.lessons === 0
	return (
		<div className="@container">
			<div data-slot="today-counters" className="grid grid-cols-2 gap-3 @min-[40rem]:grid-cols-4">
				<Stat
					label="Today"
					value={counts.lessons}
					hint={quiet ? undefined : counts.toCome === 0 ? 'All started' : `${counts.toCome} still to come`}
				/>
				<Stat label="Done" value={counts.done} hint={quiet ? undefined : `of ${counts.started} started`} />
				<Stat
					label="To mark"
					value={counts.toMark}
					hint={counts.toMark === 0 ? undefined : `${counts.toMarkToday} today, ${counts.toMarkEarlier} earlier`}
				/>
				<Stat label="Pays soon" value={counts.paysSoon} hint={lessonsOrFewer(threshold)} />
			</div>
		</div>
	)
}

function LoadingCounters() {
	return (
		<div className="@container">
			<div className="grid grid-cols-2 gap-3 @min-[40rem]:grid-cols-4">
				{Array.from({ length: 4 }, (_, index) => (
					<SkeletonStat key={index} />
				))}
			</div>
		</div>
	)
}

function Shell({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
	return (
		<PageScroll>
			<PageHeader title={title} description={description} />
			{children}
		</PageScroll>
	)
}

export function TodayScreen() {
	const now = useMinuteNow()
	if (now === null) {
		return (
			<Shell title="Today" description={<SkeletonText className="w-64 py-0.5" />}>
				<LoadingCounters />
			</Shell>
		)
	}
	return <LoadedToday now={now} />
}

function LoadedToday({ now }: { now: Date }) {
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [zone] = useSecondZone()
	const requests = useRef(0)

	const load = useCallback(async () => {
		requests.current += 1
		const id = requests.current
		const next = await readToday()
		if (id === requests.current) setState(next)
	}, [])

	useEffect(() => {
		let current = true
		requests.current += 1
		const id = requests.current
		void readToday().then((next) => {
			if (current && id === requests.current) setState(next)
		})
		return () => {
			current = false
		}
	}, [])

	const today = scheduleToday(now)
	const answered = state.kind === 'ready' ? state.data.date : null

	useEffect(() => {
		if (answered === null || answered === today) return
		void load()
	}, [now, answered, today, load])

	if (state.kind === 'error') {
		return (
			<Shell title={dayTitle(today)}>
				<ReadError screen="Today" onRefresh={load} />
			</Shell>
		)
	}
	if (state.kind === 'loading') {
		return (
			<Shell title={dayTitle(today)} description={<SkeletonText className="w-64 py-0.5" />}>
				<LoadingCounters />
			</Shell>
		)
	}

	const { data } = state
	const counts = countsOf(data, now)
	const next = nextBlock(data.lessons, counts)
	return (
		<Shell title={dayTitle(data.date)} description={summaryLine(counts, next, zone)}>
			<Counters counts={counts} threshold={data.paysSoonLessons} />
		</Shell>
	)
}
