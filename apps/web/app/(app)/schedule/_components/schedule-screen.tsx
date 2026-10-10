'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { CalendarPlus } from 'lucide-react'

import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { SkeletonTable, SkeletonText } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'
import { occurrenceSlot, type OccurrenceSlot } from '@/lib/lesson-mark-text'
import { lessonCount, vnWhen, weekEyebrow, weekPhrase, weekRange, weekSummary } from '@/lib/schedule-format'
import { exitFallbackMs, spring } from '@/lib/springs'
import { zoneLabel } from '@/lib/time-zones'

import type {
	LessonMarkKind,
	ScheduleBlock,
	ScheduleSeries,
	ScheduleWeekResponse,
	StudentsResponse,
} from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, addDays, mondayOf, zonedInstant, zonedParts } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { EndSeriesDialog } from './end-series-dialog'
import { LessonDialog, type ActionOutcome, type PairTarget } from './lesson-dialog'
import { MoveSeriesDialog } from './move-series-dialog'
import { NewLessonDialog, type OverlapBlock, type StudentsState } from './new-lesson-dialog'
import { markLesson, mutate } from './schedule-mutations'
import { ScheduleToolbar } from './schedule-toolbar'
import { FRAME_HEIGHT, OPEN_SCROLL_TOP, WeekGrid, type SecondZone, type SlotChoice } from './week-grid'

type OpenLesson = { key: string; slot: OccurrenceSlot }

type SeriesDialogState = {
	kind: 'move' | 'end'
	rule: ScheduleSeries
	studentName: string
	lessonDate: string
	returnTo: OpenLesson
}

type NewLessonSeed = { date: string; time: string; durationMinutes?: number; frame?: number }

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
	const [monday, setMonday] = useState(() => mondayOf(zonedParts(now, SCHEDULE_TIME_ZONE).date))
	const [loaded, setLoaded] = useState<{ monday: string; state: WeekState } | null>(null)
	const scrollTopRef = useRef(OPEN_SCROLL_TOP)
	const [lesson, setLesson] = useState<OpenLesson | null>(null)
	const [version, setVersion] = useState(0)
	const [students, setStudents] = useState<StudentsState>({ kind: 'loading' })
	const [newLesson, setNewLesson] = useState<NewLessonSeed | null>(null)
	const [seriesDialog, setSeriesDialog] = useState<SeriesDialogState | null>(null)
	const weeks = useRef(new Map<string, ScheduleWeekResponse>())
	const focusAfterLoad = useRef<OpenLesson | null>(null)
	const newButton = useRef<HTMLButtonElement>(null)
	const titleRef = useRef<HTMLHeadingElement>(null)
	const toast = useToast()
	const today = zonedParts(now, SCHEDULE_TIME_ZONE).date
	const currentYear = Number(today.slice(0, 4))
	const currentMonday = mondayOf(today)
	const [zone, setZone] = useSecondZone()
	const secondZone: SecondZone | null = zone
		? { id: zone, caption: zoneLabel(zone, zonedInstant(monday, '12:00', SCHEDULE_TIME_ZONE)) }
		: null

	useEffect(() => {
		let current = true
		void readWeek(monday).then((state) => {
			if (!current) return
			if (state.kind === 'ready') weeks.current.set(monday, state.data)
			setLoaded({ monday, state })
		})
		return () => {
			current = false
		}
	}, [monday, version])

	useEffect(() => {
		let current = true
		void apiRequest<StudentsResponse>('GET', '/students').then((result) => {
			if (current) setStudents(result.ok ? { kind: 'ready', rows: result.data.students } : { kind: 'error' })
		})
		return () => {
			current = false
		}
	}, [])

	useEffect(() => {
		const target = focusAfterLoad.current
		if (target === null || loaded === null) return
		focusAfterLoad.current = null
		focusBlock(target)
	}, [loaded])

	function reload() {
		weeks.current.clear()
		setVersion((value) => value + 1)
	}

	function refresh() {
		setLoaded(null)
		reload()
	}

	async function blocksOn(date: string): Promise<OverlapBlock[]> {
		const target = mondayOf(date)
		let data = weeks.current.get(target)
		if (data === undefined) {
			const state = await readWeek(target)
			if (state.kind !== 'ready') return []
			data = state.data
			weeks.current.set(target, data)
		}
		return data.blocks.map((block) => ({
			key: block.key,
			startsAt: new Date(block.startsAt),
			durationMinutes: block.durationMinutes,
			outcome: block.outcome,
			studentName: block.studentName,
		}))
	}

	function openNew() {
		const parts = zonedParts(now, SCHEDULE_TIME_ZONE)
		const hour = Math.floor(parts.minutes / 60) + 1
		setNewLesson(
			hour >= 24
				? { date: addDays(parts.date, 1), time: '00:00' }
				: { date: parts.date, time: `${String(hour).padStart(2, '0')}:00` }
		)
	}

	function openSlot(choice: SlotChoice) {
		setNewLesson({
			date: choice.date,
			time: choice.time,
			durationMinutes: choice.dragged ? choice.durationMinutes : undefined,
			frame: choice.durationMinutes,
		})
	}

	function closeNew() {
		setNewLesson(null)
		requestAnimationFrame(() => newButton.current?.focus())
	}

	function focusBlock(target: OpenLesson) {
		requestAnimationFrame(() => {
			const element = document.querySelector<HTMLElement>(`[data-key="${target.key}"][data-slot="${target.slot}"]`)
			if (element) element.focus()
			else titleRef.current?.focus()
		})
	}

	function closeLesson() {
		const closed = lesson
		setLesson(null)
		if (closed !== null) focusBlock(closed)
	}

	function startSeriesDialog(block: ScheduleBlock, rule: ScheduleSeries, kind: 'move' | 'end') {
		const next: SeriesDialogState = {
			kind,
			rule,
			studentName: block.studentName,
			lessonDate: block.ref.kind === 'series' ? block.ref.originalOn : today,
			returnTo: { key: block.key, slot: occurrenceSlot(block.outcome) },
		}
		setLesson(null)
		setTimeout(() => setSeriesDialog(next), exitFallbackMs(spring.slow))
	}

	function closeSeries() {
		const closed = seriesDialog
		setSeriesDialog(null)
		if (closed !== null) focusBlock(closed.returnTo)
	}

	function seriesChanged() {
		const closed = seriesDialog
		setSeriesDialog(null)
		focusAfterLoad.current = closed === null ? null : closed.returnTo
		reload()
	}

	async function changeLesson(block: ScheduleBlock, action: 'cancel' | 'restore'): Promise<ActionOutcome> {
		const result = await mutate(block.ref, action, { expectedStartsAt: block.startsAt })
		if (result.kind === 'failed') return 'failed'
		reload()
		if (result.kind === 'stale') return 'stale'
		toast.show({
			title: action === 'cancel' ? 'Lesson cancelled' : 'Lesson restored',
			description: `${block.studentName}, ${vnWhen(new Date(block.startsAt), null, currentYear)}.`,
		})
		return 'ok'
	}

	async function markBlock(block: ScheduleBlock, kind: LessonMarkKind): Promise<ActionOutcome> {
		const result = await markLesson(block, kind)
		if (result.kind === 'failed') return 'failed'
		if (result.kind === 'stale') {
			reload()
			return 'stale'
		}
		weeks.current.clear()
		const state = await readWeek(monday)
		if (state.kind !== 'ready') {
			reload()
			return 'ok'
		}
		weeks.current.set(monday, state.data)
		setLoaded({ monday, state })
		return 'ok'
	}

	function openPair(target: PairTarget) {
		const targetMonday = mondayOf(zonedParts(target.at, SCHEDULE_TIME_ZONE).date)
		setMonday(targetMonday)
		setLesson({ key: target.key, slot: target.slot })
	}

	function go(change: (value: string) => string) {
		setLesson(null)
		setMonday(change)
	}

	const week: WeekState = loaded !== null && loaded.monday === monday ? loaded.state : { kind: 'loading' }

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
			? (week.data.blocks.find((block) => block.key === lesson.key && occurrenceSlot(block.outcome) === lesson.slot) ??
				null)
			: null
	const openSeriesId = openBlock !== null && openBlock.ref.kind === 'series' ? openBlock.ref.seriesId : null
	const openSeries =
		ready && openSeriesId !== null ? (week.data.series.find((rule) => rule.id === openSeriesId) ?? null) : null
	const planned = ready ? week.data.blocks.filter((block) => block.status === 'scheduled').length : 0
	const seriesRule =
		seriesDialog === null
			? null
			: ready
				? (week.data.series.find((rule) => rule.id === seriesDialog.rule.id) ?? seriesDialog.rule)
				: seriesDialog.rule

	return (
		<PageScroll>
			<PageHeader
				titleRef={titleRef}
				eyebrow={weekEyebrow(monday, currentMonday)}
				title={weekRange(monday)}
				description={ready ? weekSummary(week.data.blocks) : <SkeletonText className="w-48 py-0.5" />}
				actions={
					<Button
						ref={newButton}
						leadingIcon={CalendarPlus}
						disabled={!ready || students.kind === 'loading'}
						onClick={() => openNew()}
					>
						New lesson
					</Button>
				}
			/>
			<ScheduleToolbar
				monday={monday}
				currentMonday={currentMonday}
				onToday={() => go(() => currentMonday)}
				onPrevious={() => go((value) => addDays(value, -7))}
				onNext={() => go((value) => addDays(value, 7))}
				zone={zone}
				onZoneChange={setZone}
			/>
			{ready ? (
				<WeekGrid
					monday={monday}
					today={today}
					now={now}
					secondZone={secondZone}
					blocks={week.data.blocks}
					currentYear={currentYear}
					onOpen={(block: ScheduleBlock) => setLesson({ key: block.key, slot: occurrenceSlot(block.outcome) })}
					onSlot={openSlot}
					frame={
						newLesson?.frame === undefined
							? null
							: { date: newLesson.date, time: newLesson.time, durationMinutes: newLesson.frame }
					}
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
					key={`${openBlock.key}:${occurrenceSlot(openBlock.outcome)}`}
					block={openBlock}
					series={openSeries}
					now={now}
					secondZone={zone}
					currentYear={currentYear}
					onClose={closeLesson}
					onOpenPair={openPair}
					onCancel={() => changeLesson(openBlock, 'cancel')}
					onRestore={() => changeLesson(openBlock, 'restore')}
					onMark={(kind) => markBlock(openBlock, kind)}
					blocksOn={blocksOn}
					onStale={reload}
					onMoved={(startsAt) => {
						reload()
						openPair({ key: openBlock.key, slot: 'to', at: startsAt })
					}}
					onSeries={(kind) => {
						if (openSeries !== null) startSeriesDialog(openBlock, openSeries, kind)
					}}
				/>
			) : null}
			{seriesRule !== null && seriesDialog?.kind === 'move' ? (
				<MoveSeriesDialog
					rule={seriesRule}
					studentName={seriesDialog.studentName}
					now={now}
					today={today}
					currentYear={currentYear}
					onClose={closeSeries}
					onStale={reload}
					onMoved={seriesChanged}
				/>
			) : null}
			{seriesRule !== null && seriesDialog?.kind === 'end' ? (
				<EndSeriesDialog
					rule={seriesRule}
					studentName={seriesDialog.studentName}
					lessonDate={seriesDialog.lessonDate}
					now={now}
					today={today}
					currentYear={currentYear}
					onClose={closeSeries}
					onStale={reload}
					onEnded={seriesChanged}
				/>
			) : null}
			{newLesson !== null ? (
				<NewLessonDialog
					students={students}
					seed={newLesson}
					today={today}
					secondZone={zone}
					currentYear={currentYear}
					blocksOn={blocksOn}
					onClose={closeNew}
					onCreated={() => {
						closeNew()
						reload()
					}}
				/>
			) : null}
		</PageScroll>
	)
}
