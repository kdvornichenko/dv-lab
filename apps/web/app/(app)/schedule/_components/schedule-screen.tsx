'use client'

import { useEffect, useRef, useState } from 'react'

import { CalendarPlus } from 'lucide-react'

import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { SkeletonTable, SkeletonText } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'
import { hasStaleActions } from '@/lib/lesson-actions'
import { occurrenceSlot } from '@/lib/lesson-mark-text'
import { lessonCount, weekEyebrow, weekPhrase, weekRange, weekSummary } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'

import type { ScheduleBlock, StudentsResponse } from '@dv-lab/contracts'
import { addDays, countsAsLesson, mondayOf, scheduleDate, scheduleToday, zonedInstant, zonedParts } from '@dv-lab/core'

import { useMinuteNow } from '../../_components/use-minute-now'
import type { PairTarget } from './lesson-dialog'
import { LessonDialogs, type LessonSelection } from './lesson-dialogs'
import { NewLessonDialog, type StudentsState } from './new-lesson-dialog'
import { ScheduleToolbar } from './schedule-toolbar'
import { useScheduleWeek } from './use-schedule-week'
import { FRAME_HEIGHT, OPEN_SCROLL_TOP, WeekGrid, type SecondZone, type SlotChoice } from './week-grid'

type OpenLesson = LessonSelection

type NewLessonSeed = { date: string; time: string; durationMinutes?: number; frame?: number }

function ScheduleLoading() {
	return (
		<PageScroll>
			<PageHeader title="Schedule" />
			<div className={FRAME_HEIGHT}>
				<SkeletonTable rows={10} className="h-full" />
			</div>
		</PageScroll>
	)
}

export function ScheduleScreen() {
	const now = useMinuteNow()
	if (now === null) return <ScheduleLoading />
	return <LoadedSchedule minuteNow={now} />
}

function LoadedSchedule({ minuteNow }: { minuteNow: Date }) {
	const { state: week, now, reload, navigate, blocksOn } = useScheduleWeek(minuteNow)
	const scrollTopRef = useRef(OPEN_SCROLL_TOP)
	const [lesson, setLesson] = useState<OpenLesson | null>(null)
	const [students, setStudents] = useState<StudentsState>({ kind: 'loading' })
	const [newLesson, setNewLesson] = useState<NewLessonSeed | null>(null)
	const newButton = useRef<HTMLButtonElement>(null)
	const titleRef = useRef<HTMLHeadingElement>(null)
	const [zone, setZone] = useSecondZone(week.kind === 'error' ? null : (week.query?.mainTimeZone ?? null))

	useEffect(() => {
		let current = true
		void apiRequest<StudentsResponse>('GET', '/students').then((result) => {
			if (current) setStudents(result.ok ? { kind: 'ready', rows: result.data.students } : { kind: 'error' })
		})
		return () => {
			current = false
		}
	}, [])

	const staleActions = week.kind === 'ready' && hasStaleActions(week.data.blocks, now)

	useEffect(() => {
		if (staleActions) void reload()
	}, [now, staleActions, reload])

	if (week.kind === 'error') {
		return (
			<PageScroll>
				<PageHeader title="Schedule" />
				<ReadError screen="schedule" onRefresh={() => void reload()} />
			</PageScroll>
		)
	}
	if (week.query === null) return <ScheduleLoading />

	const { mainTimeZone } = week.query
	const monday = week.query.monday
	const today = scheduleToday(now, mainTimeZone)
	const currentYear = Number(today.slice(0, 4))
	const currentMonday = mondayOf(today)
	const secondZone: SecondZone | null = zone
		? { id: zone, caption: zoneLabel(zone, zonedInstant(monday, '12:00', mainTimeZone)) }
		: null

	function openNew() {
		const hour = Math.floor(zonedParts(now, mainTimeZone).minutes / 60) + 1
		setNewLesson(
			hour >= 24
				? { date: addDays(today, 1), time: '00:00' }
				: { date: today, time: `${String(hour).padStart(2, '0')}:00` }
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

	function closeLesson(target: LessonSelection | null) {
		setLesson(null)
		if (target !== null) focusBlock(target)
	}

	function openPair(target: PairTarget) {
		const targetMonday = mondayOf(scheduleDate(target.at, mainTimeZone))
		if (targetMonday !== monday) navigate(targetMonday, false)
		setLesson({ key: target.key, slot: target.slot })
	}

	function go(targetMonday: string, current: boolean) {
		setLesson(null)
		navigate(targetMonday, current)
	}

	const ready = week.kind === 'ready'
	const openBlock =
		ready && lesson !== null
			? (week.data.blocks.find((block) => block.key === lesson.key && occurrenceSlot(block.outcome) === lesson.slot) ??
				null)
			: null
	const planned = ready ? week.data.blocks.filter((block) => countsAsLesson(block.outcome)).length : 0

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
				mainTimeZone={mainTimeZone}
				onToday={() => go(currentMonday, true)}
				onPrevious={() => go(addDays(monday, -7), false)}
				onNext={() => go(addDays(monday, 7), false)}
				zone={zone}
				onZoneChange={setZone}
			/>
			{ready ? (
				<WeekGrid
					mainTimeZone={mainTimeZone}
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
			{ready ? (
				<LessonDialogs
					mainTimeZone={mainTimeZone}
					asOf={week.data.asOf}
					selected={openBlock}
					series={week.data.series}
					now={now}
					secondZone={zone}
					currentYear={currentYear}
					today={today}
					blocksOn={blocksOn}
					reload={reload}
					onClose={closeLesson}
					onOpenPair={openPair}
				/>
			) : null}
			{ready && newLesson !== null ? (
				<NewLessonDialog
					mainTimeZone={mainTimeZone}
					asOf={week.data.asOf}
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
