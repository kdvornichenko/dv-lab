'use client'

import { useEffect, useState } from 'react'

import { RefreshCw } from 'lucide-react'
import Link from 'next/link'

import { Panel } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { TimePair } from '@/components/app/time-pair'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Banner, BannerAction, BannerActions, BannerTitle } from '@/components/ui/banner'
import { Skeleton } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'
import { calendarLesson, type CalendarLesson } from '@/lib/lesson-actions'
import { formatDay, formatTime, mainWhen, secondWhen, yearInZone } from '@/lib/schedule-format'
import { lessonHref } from '@/lib/schedule-links'
import { cn } from '@/lib/utils'

import { googleScheduleWindow, type GoogleScheduleWindow, type StudentDetail } from '@dv-lab/contracts'
import { addDays, lessonDay, mondayOf, scheduleToday } from '@dv-lab/core'

import { ScheduleBar } from '../../../schedule/_components/schedule-toolbar'

type WeekResult = { kind: 'error' } | { kind: 'ready'; data: GoogleScheduleWindow }
type WeekState = { monday: string; version: number; result: WeekResult }

const SKELETON_ROWS = 3

async function readWeek(monday: string): Promise<WeekResult> {
	const result = await apiRequest<unknown>('GET', `/schedule/week?start=${monday}`)
	if (!result.ok) return { kind: 'error' }
	const parsed = googleScheduleWindow.safeParse(result.data)
	return parsed.success ? { kind: 'ready', data: parsed.data } : { kind: 'error' }
}

function startOf(event: CalendarLesson): number {
	return Date.parse(event.when.startsAt)
}

function studentLessons(
	data: GoogleScheduleWindow,
	studentId: string,
	monday: string,
	mainTimeZone: string
): CalendarLesson[] {
	const sunday = addDays(monday, 6)
	return data.events.filter((event): event is CalendarLesson => {
		if (!calendarLesson(event) || event.binding.studentId !== studentId) return false
		const day = lessonDay(new Date(event.when.startsAt), mainTimeZone)
		return monday <= day && day <= sunday
	})
}

function wordFor(event: CalendarLesson): { word: string | null; struck: boolean; muted: boolean } {
	if (event.status === 'cancelled') return { word: 'Cancelled', struck: true, muted: true }
	if (event.binding.mark === 'done') return { word: 'Done', struck: false, muted: true }
	if (event.binding.mark === 'no_show') return { word: 'No-show', struck: false, muted: true }
	return { word: null, struck: false, muted: false }
}

function LessonRow({
	event,
	now,
	mainTimeZone,
	secondZone,
	next,
}: {
	event: CalendarLesson
	now: Date
	mainTimeZone: string
	secondZone: string | null
	next: boolean
}) {
	const start = new Date(event.when.startsAt)
	const year = yearInZone(now, mainTimeZone)
	const { word, struck, muted } = wordFor(event)
	const label = `${mainWhen(start, mainTimeZone, secondZone, year)}, ${word?.toLowerCase() ?? 'scheduled'}`
	return (
		<li data-slot="lessons-row" data-event-key={event.eventKey}>
			<Link
				href={lessonHref(lessonDay(start, mainTimeZone), event.binding.ref)}
				aria-label={label}
				className={cn(
					'flex min-h-10 items-center gap-3 rounded-lg px-3 py-1 tabular-nums outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring',
					muted && 'text-muted-foreground',
					next && 'bg-active font-semibold'
				)}
			>
				<span data-slot="lessons-row-date" className="min-w-0 shrink-0 sm:min-w-24">
					{formatDay(start, mainTimeZone, year)}
				</span>
				<TimePair
					className={cn('min-w-0 flex-1 wrap-anywhere', struck && 'line-through')}
					main={formatTime(start, mainTimeZone)}
					second={secondWhen(start, mainTimeZone, secondZone)}
				/>
				{word === null ? null : (
					<span data-slot="lessons-row-word" className="shrink-0 text-caption font-normal text-muted-foreground">
						{word}
					</span>
				)}
			</Link>
		</li>
	)
}

function RowsLoading() {
	return (
		<ul className="flex flex-col gap-1 px-1 pb-2" aria-hidden>
			{Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<li key={index} className="flex h-10 items-center gap-3 px-3">
					<Skeleton className="h-3 w-20" />
					<Skeleton className="h-3 w-12" />
				</li>
			))}
		</ul>
	)
}

function LessonsPanel({
	id,
	title,
	events,
	empty,
	highlight,
	now,
	mainTimeZone,
	secondZone,
}: {
	id: string
	title: string
	events: CalendarLesson[]
	empty: boolean
	highlight: string | null
	now: Date
	mainTimeZone: string
	secondZone: string | null
}) {
	return (
		<Panel id={id} title={title}>
			{events.length === 0 ? (
				empty ? (
					<p className="px-4 pb-4 text-body text-muted-foreground">No lessons in this range</p>
				) : null
			) : (
				<ul className="flex flex-col px-1 pb-2 text-body">
					{events.map((event) => (
						<LessonRow
							key={event.eventKey}
							event={event}
							now={now}
							mainTimeZone={mainTimeZone}
							secondZone={secondZone}
							next={event.eventKey === highlight}
						/>
					))}
				</ul>
			)}
		</Panel>
	)
}

interface LessonsTabProps {
	student: StudentDetail
	mainTimeZone: string
	asOf: string
	refreshKey: number
}

export function LessonsTab({ student, mainTimeZone, asOf, refreshKey }: LessonsTabProps) {
	const [secondZone] = useSecondZone(mainTimeZone)
	const [monday, setMonday] = useState(() => mondayOf(asOf))
	const [nonce, setNonce] = useState(0)
	const [state, setState] = useState<WeekState | null>(null)
	const version = refreshKey + nonce

	useEffect(() => {
		let current = true
		void readWeek(monday).then((result) => {
			if (current) setState({ monday, version, result })
		})
		return () => {
			current = false
		}
	}, [monday, version, student.id])

	const now = new Date()
	const today = scheduleToday(now, mainTimeZone)
	const currentMonday = mondayOf(today)
	const loading = state === null || state.monday !== monday
	const refreshing = state !== null && state.version !== version

	const bar = (
		<ScheduleBar
			monday={monday}
			currentMonday={currentMonday}
			today={today}
			onToday={() => setMonday(currentMonday)}
			onPrevious={() => setMonday(addDays(monday, -7))}
			onNext={() => setMonday(addDays(monday, 7))}
			onWeek={setMonday}
			summary={null}
			titleRef={null}
			heading={false}
		/>
	)

	if (loading) {
		return (
			<div className="flex flex-col gap-4" data-slot="lessons-tab" data-state="loading">
				{bar}
				<div className="grid gap-4 lg:grid-cols-2">
					<Panel id="student-lessons-upcoming" title="Upcoming lessons">
						<RowsLoading />
					</Panel>
					<Panel id="student-lessons-history" title="History">
						<RowsLoading />
					</Panel>
				</div>
			</div>
		)
	}

	if (state.result.kind === 'error') {
		return (
			<div className="flex flex-col gap-4" data-slot="lessons-tab" data-state="error">
				{bar}
				<ReadError screen="lessons" onRefresh={() => setNonce((value) => value + 1)} />
			</div>
		)
	}

	const { data } = state.result
	const complete = data.read.state === 'fresh'
	const lessons = studentLessons(data, student.id, monday, mainTimeZone).sort((a, b) => startOf(a) - startOf(b))
	const upcoming = lessons.filter((event) => startOf(event) > now.getTime())
	const history = lessons.filter((event) => startOf(event) <= now.getTime()).reverse()
	const next = upcoming.find((event) => event.status !== 'cancelled')?.eventKey ?? null
	const shared = { now, mainTimeZone, secondZone }

	return (
		<div className="flex flex-col gap-4" data-slot="lessons-tab" data-state={complete ? 'fresh' : 'partial'}>
			{bar}
			{complete ? null : (
				<Banner status="warning" role="alert">
					<BannerTitle>The full lesson range has not been checked. Refresh before making changes.</BannerTitle>
					<BannerActions className="col-start-2 row-start-2 my-0 mt-2 ml-0">
						<BannerAction leadingIcon={RefreshCw} loading={refreshing} onClick={() => setNonce((value) => value + 1)}>
							Refresh records
						</BannerAction>
					</BannerActions>
				</Banner>
			)}
			{complete && lessons.length === 0 ? (
				<Panel>
					<div className="flex flex-col gap-1 px-6 py-12 text-center">
						<p className="text-title font-semibold text-foreground">No lessons in this range</p>
						<p className="text-body text-muted-foreground">Choose another week to view lessons.</p>
					</div>
				</Panel>
			) : lessons.length === 0 ? null : (
				<div className="grid gap-4 lg:grid-cols-2">
					{complete || upcoming.length > 0 ? (
						<LessonsPanel
							id="student-lessons-upcoming"
							title="Upcoming lessons"
							events={upcoming}
							empty={complete}
							highlight={next}
							{...shared}
						/>
					) : null}
					{complete || history.length > 0 ? (
						<LessonsPanel
							id="student-lessons-history"
							title="History"
							events={history}
							empty={complete}
							highlight={null}
							{...shared}
						/>
					) : null}
				</div>
			)}
		</div>
	)
}
