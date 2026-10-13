'use client'

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { CalendarPlus } from 'lucide-react'

import { CalendarRecovery } from '@/components/app/calendar-command-notice'
import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import { CalendarReadNotice, CalendarReadStatusButton } from '@/components/app/google-calendar-state'
import { PageHeader, PageScroll, WorkspacePage } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { TimeZonePicker, useSecondZone } from '@/components/app/time-zone-picker'
import { useTopbarSlot } from '@/components/app/topbar-slot'
import { Button } from '@/components/ui/button'
import { SkeletonTable } from '@/components/ui/skeleton'
import { calendarLesson, canEditCalendarEvent, canEditPlainEvent, changeableLesson } from '@/lib/lesson-actions'
import { weekRange } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'

import type { CalendarEventView, GoogleScheduleWindow } from '@dv-lab/contracts'
import { addDays, lessonDay, mondayOf, scheduleDate, zonedInstant, zonedParts } from '@dv-lab/core'

import { useMinuteNow } from '../../_components/use-minute-now'
import { CalendarEventDialog } from './calendar-event-details'
import { CalendarLessonDialog } from './calendar-lesson-dialog'
import { LessonCountDialog } from './lesson-count-dialog'
import { NewLessonDialog, type NewLessonDraft } from './new-lesson-dialog'
import { useOptimisticWrites, type WriteRunner } from './optimistic-writes'
import { ScheduleBar, ScheduleToolbar, useScheduleKeys, weekSummary } from './schedule-toolbar'
import type { MoveSeed } from './use-lesson-drag'
import { useLessonStudents, type StudentsState } from './use-lesson-students'
import { useScheduleWeek } from './use-schedule-week'
import { OPEN_SCROLL_TOP, WeekGrid, type SlotChoice } from './week-grid'

const NOTICE_SLOT = 'min-h-44 sm:min-h-26'
const MOBILE_FRAME = 'h-112'
const WORKSPACE_BODY = 'flex min-h-0 flex-1 flex-col px-2 pt-1 pb-2'

function useLaptop() {
	const left = useTopbarSlot('left')
	const right = useTopbarSlot('right')
	return left !== null && right !== null ? { left, right } : null
}

function ScheduleLoading() {
	const laptop = useLaptop()
	if (laptop !== null)
		return (
			<WorkspacePage>
				<div className={WORKSPACE_BODY}>
					<SkeletonTable rows={10} className="h-full" />
				</div>
			</WorkspacePage>
		)
	return (
		<PageScroll>
			<PageHeader title="Schedule" />
			<div className="space-y-4">
				<div data-slot="calendar-read-slot" className={NOTICE_SLOT} />
				<div className={MOBILE_FRAME}>
					<SkeletonTable rows={10} className="h-full" />
				</div>
			</div>
		</PageScroll>
	)
}

export function ScheduleScreen() {
	const now = useMinuteNow()
	if (now === null) return <ScheduleLoading />
	return <LoadedSchedule now={now} />
}

function displayWindow(data: GoogleScheduleWindow | null, query: { monday: string; mainTimeZone: string }, now: Date) {
	const range = data?.snapshotRange ?? data?.requestedRange
	const mainTimeZone = range?.timeZone ?? query.mainTimeZone
	const monday = range === undefined ? query.monday : scheduleDate(new Date(range.start), mainTimeZone)
	const today = lessonDay(now, mainTimeZone)
	return {
		mainTimeZone,
		monday,
		today,
		currentYear: Number(today.slice(0, 4)),
		currentMonday: mondayOf(today),
		read: data?.read ?? ({ state: 'unavailable', reason: 'provider_unavailable' } as const),
		write: data?.write ?? ({ state: 'blocked', reason: 'provider_unavailable' } as const),
		events: (data?.events ?? []).filter((event) => event.status !== 'cancelled'),
	}
}

function LoadedSchedule({ now }: { now: Date }) {
	const { state: week, reload, navigate } = useScheduleWeek()
	const scrollTopRef = useRef(OPEN_SCROLL_TOP)
	const [selection, setSelection] = useState<CalendarEventView | null>(null)
	const [moveSeed, setMoveSeed] = useState<MoveSeed | undefined>(undefined)
	const commands = useCalendarCommands()
	const [draft, setDraft] = useState<{
		seed: Pick<SlotChoice, 'date' | 'time' | 'durationMinutes' | 'dragged'>
		mainTimeZone: string
		asOf: string
		initial?: NewLessonDraft
	} | null>(null)
	const [redo, setRedo] = useState<NewLessonDraft | null>(null)
	const refused = useCallback(() => {
		void reload()
	}, [reload])
	const writes = useOptimisticWrites(refused)
	const students = useLessonStudents(
		draft !== null || selection !== null || (week.data?.events.some((event) => event.suggestion !== null) ?? false)
	)
	const returnFocus = useRef<HTMLElement | null>(null)
	const titleRef = useRef<HTMLHeadingElement>(null)
	const [zone, setZone] = useSecondZone(week.query?.mainTimeZone ?? null)
	const laptop = useLaptop()
	const requested = week.query?.monday ?? null
	const todayMonday = week.query ? mondayOf(lessonDay(now, week.query.mainTimeZone)) : null
	useScheduleKeys({
		onToday: () => {
			if (todayMonday !== null) go(todayMonday, true)
		},
		onPrevious: () => {
			if (requested !== null) go(addDays(requested, -7), false)
		},
		onNext: () => {
			if (requested !== null) go(addDays(requested, 7), false)
		},
	})
	function go(target: string, current: boolean) {
		setSelection(null)
		navigate(target, current)
	}

	if (week.query === null)
		return week.kind === 'error' ? (
			<PageScroll>
				{laptop === null ? <PageHeader title="Schedule" /> : null}
				<ReadError screen="schedule" onRefresh={() => void reload()} />
			</PageScroll>
		) : (
			<ScheduleLoading />
		)

	const data = week.data
	const requestedMonday = week.query.monday
	const shown = displayWindow(data, week.query, now)
	const { mainTimeZone, monday, today, currentYear, currentMonday, read, write } = shown
	const events = writes.apply(shown.events)
	const selected = events.find((event) => event.eventKey === selection?.eventKey) ?? selection
	const secondZone = zone ? { id: zone, caption: zoneLabel(zone, zonedInstant(monday, '12:00', mainTimeZone)) } : null

	const editable =
		read.state === 'fresh' && write.state === 'ready' && !commands.blocked && !writes.writing && week.kind === 'ready'
	function openNew(seed: Pick<SlotChoice, 'date' | 'time' | 'durationMinutes' | 'dragged'>) {
		if (!editable || read.state !== 'fresh') return
		setDraft({ seed, mainTimeZone, asOf: read.fetchedAt })
	}
	if (redo !== null && editable && read.state === 'fresh' && draft === null) {
		setRedo(null)
		setDraft({ seed: redo.seed, mainTimeZone, asOf: read.fetchedAt, initial: redo })
	}
	function refreshForms() {
		setSelection(null)
		setDraft(null)
		void reload()
	}

	function openEvent(event: CalendarEventView) {
		if (event.eventKey.startsWith('optimistic:')) return
		returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
		setSelection(event)
		setMoveSeed(undefined)
	}
	function canMove(event: CalendarEventView) {
		if (!editable || data === null || writes.mark(event) !== null) return false
		if (calendarLesson(event)) return canEditCalendarEvent(event, data) && changeableLesson(event)
		return canEditPlainEvent(event, data)
	}
	function studentName(id: string) {
		return students.kind === 'ready' ? (students.rows.find((row) => row.id === id)?.displayName ?? null) : null
	}
	function canEdit(event: CalendarEventView) {
		return editable && data !== null && canEditCalendarEvent(event, data)
	}

	function closeEvent() {
		setSelection(null)
		setMoveSeed(undefined)
		requestAnimationFrame(() => {
			if (returnFocus.current?.isConnected) returnFocus.current.focus()
			else titleRef.current?.focus()
		})
	}

	const navigation = {
		monday: week.query.monday,
		currentMonday,
		onToday: () => go(currentMonday, true),
		onPrevious: () => go(addDays(requestedMonday, -7), false),
		onNext: () => go(addDays(requestedMonday, 7), false),
	}
	const pickWeek = (target: string) => go(target, target === currentMonday)
	const loadingFirst = week.kind === 'loading' && data === null
	const refreshWeek = async () => {
		await reload()
	}
	const grid = (
		<WeekGrid
			emptyNote={read.state === 'fresh' && events.length === 0 ? 'No Google Calendar events in this range.' : null}
			placed={selected !== null && moveSeed !== undefined ? { event: selected, seed: moveSeed } : null}
			mark={writes.mark}
			monday={monday}
			mainTimeZone={mainTimeZone}
			today={today}
			now={now}
			secondZone={secondZone}
			events={events}
			currentYear={currentYear}
			onOpen={openEvent}
			canMove={canMove}
			canEdit={canEdit}
			studentName={studentName}
			onMove={(event, seed) => {
				if (!canMove(event)) return
				openEvent(event)
				setMoveSeed(seed)
			}}
			editable={editable}
			onSlot={(seed) => void openNew(seed)}
			frame={draft?.seed ?? null}
			scrollTopRef={scrollTopRef}
		/>
	)
	const windowAttributes = {
		'data-slot': 'schedule-window',
		'data-requested-start': week.query.monday,
		'data-snapshot-start': data?.snapshotRange
			? scheduleDate(new Date(data.snapshotRange.start), mainTimeZone)
			: undefined,
		'aria-busy': week.kind === 'loading',
	}
	const dialogs = (
		<>
			{draft !== null ? (
				<NewLessonDialog
					{...draft}
					events={events}
					students={students}
					available={editable}
					currentMainTimeZone={mainTimeZone}
					secondZone={zone}
					onClose={() => setDraft(null)}
					onRefresh={refreshForms}
					onWrite={writes.run}
					onRedo={setRedo}
				/>
			) : null}
			<SelectedEventDialog
				moveSeed={moveSeed}
				students={students}
				event={selected}
				window={data}
				editable={editable}
				now={now}
				timeZone={mainTimeZone}
				secondZone={zone}
				currentYear={currentYear}
				onClose={closeEvent}
				onMoveDiscard={() => setMoveSeed(undefined)}
				onRefresh={refreshForms}
				onWrite={writes.run}
			/>
		</>
	)

	if (laptop !== null) {
		const pendingRecovery =
			commands.view.entries.some((entry) => entry.command?.state !== 'failed') ||
			(commands.view.connection?.pendingCommandCount ?? 0) > 0
		return (
			<>
				{inBar(
					<ScheduleBar
						{...navigation}
						onWeek={pickWeek}
						today={today}
						titleRef={titleRef}
						summary={loadingFirst ? null : weekSummary(events, monday, mainTimeZone)}
					/>,
					laptop.left
				)}
				{inBar(
					<div className="flex items-center gap-2">
						{loadingFirst ? (
							<span className="size-7" />
						) : (
							<CalendarReadStatusButton
								read={read}
								write={write}
								timeZone={mainTimeZone}
								onRefresh={refreshWeek}
								pendingRecovery={pendingRecovery}
								recovery={<CalendarRecovery showEmpty={false} />}
							/>
						)}
						<ScheduleZone monday={week.query.monday} mainTimeZone={mainTimeZone} zone={zone} onZoneChange={setZone} />
						<LessonCountDialog iconOnly />
					</div>,
					laptop.right
				)}
				<WorkspacePage>
					<div {...windowAttributes} className={WORKSPACE_BODY}>
						{loadingFirst ? <SkeletonTable rows={10} className="h-full" /> : grid}
					</div>
				</WorkspacePage>
				{dialogs}
			</>
		)
	}

	return (
		<>
			<PageScroll>
				<PageHeader
					titleRef={titleRef}
					title={weekRange(monday)}
					actions={
						<div className="flex items-center gap-2">
							<LessonCountDialog />
							<Button
								leadingIcon={CalendarPlus}
								disabled={!editable}
								onClick={() =>
									openNew(
										monday === currentMonday
											? { ...nextWholeHour(now, mainTimeZone), durationMinutes: 60, dragged: false }
											: { date: monday, time: '09:00', durationMinutes: 60, dragged: false }
									)
								}
							>
								New event
							</Button>
						</div>
					}
				/>
				<ScheduleToolbar {...navigation} mainTimeZone={mainTimeZone} zone={zone} onZoneChange={setZone} />
				<div {...windowAttributes} className="space-y-4">
					{loadingFirst ? (
						<>
							<div data-slot="calendar-read-slot" className={NOTICE_SLOT} />
							<div className={MOBILE_FRAME}>
								<SkeletonTable rows={10} className="h-full" />
							</div>
						</>
					) : (
						<>
							<div data-slot="calendar-read-slot" className={NOTICE_SLOT}>
								<CalendarReadNotice read={read} write={write} timeZone={mainTimeZone} onRefresh={refreshWeek} />
							</div>
							{grid}
						</>
					)}
				</div>
				<CalendarRecovery showEmpty={false} />
			</PageScroll>
			{dialogs}
		</>
	)
}

function nextWholeHour(now: Date, mainTimeZone: string) {
	const parts = zonedParts(now, mainTimeZone)
	const hour = Math.floor(parts.minutes / 60) + 1
	return hour >= 24
		? { date: addDays(parts.date, 1), time: '00:00' }
		: { date: parts.date, time: `${String(hour).padStart(2, '0')}:00` }
}

function inBar(node: ReactNode, slot: HTMLElement) {
	return createPortal(node, slot)
}

function ScheduleZone({
	monday,
	mainTimeZone,
	zone,
	onZoneChange,
}: {
	monday: string
	mainTimeZone: string
	zone: string | null
	onZoneChange: (zone: string | null) => void
}) {
	const labelAt = useMemo(() => zonedInstant(monday, '12:00', mainTimeZone), [monday, mainTimeZone])
	return (
		<TimeZonePicker
			trigger="toolbar"
			value={zone}
			onChange={onZoneChange}
			allowNone
			excludeMain={mainTimeZone}
			labelAt={labelAt}
		/>
	)
}

function SelectedEventDialog({
	moveSeed,
	students,
	event,
	window,
	editable,
	now,
	timeZone,
	secondZone,
	currentYear,
	onClose,
	onMoveDiscard,
	onRefresh,
	onWrite,
}: {
	moveSeed?: MoveSeed
	students: StudentsState
	event: CalendarEventView | null
	window: GoogleScheduleWindow | null
	editable: boolean
	now: Date
	timeZone: string
	secondZone: string | null
	currentYear: number
	onClose: () => void
	onMoveDiscard: () => void
	onRefresh: () => void
	onWrite: WriteRunner
}) {
	if (event === null) return null
	if (window !== null && calendarLesson(event))
		return (
			<CalendarLessonDialog
				moveSeed={moveSeed}
				key={event.eventKey}
				event={event}
				window={window}
				now={now}
				mainTimeZone={timeZone}
				secondZone={secondZone}
				onClose={onClose}
				onMoveDiscard={onMoveDiscard}
				onRefresh={onRefresh}
				onWrite={onWrite}
			/>
		)
	return (
		<CalendarEventDialog
			key={event.eventKey}
			moveSeed={moveSeed}
			students={students}
			event={event}
			window={window}
			editable={editable}
			timeZone={timeZone}
			secondZone={secondZone}
			currentYear={currentYear}
			onClose={onClose}
			onMoveDiscard={onMoveDiscard}
			onReload={onRefresh}
			onWrite={onWrite}
		/>
	)
}
