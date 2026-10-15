'use client'

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { CalendarRecovery } from '@/components/app/calendar-command-notice'
import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import { CalendarReadStatusButton } from '@/components/app/google-calendar-state'
import { PageScroll, WorkspacePage } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { TimeZonePicker, useSecondZone } from '@/components/app/time-zone-picker'
import { calendarLesson, canEditCalendarEvent, canEditPlainEvent, changeableLesson } from '@/lib/lesson-actions'
import { zoneLabel } from '@/lib/time-zones'
import { cn } from '@/lib/utils'

import type { CalendarEventView, GoogleScheduleWindow } from '@dv-lab/contracts'
import { addDays, lessonDay, mondayOf, scheduleDate, zonedInstant } from '@dv-lab/core'

import { useMinuteNow } from '../../_components/use-minute-now'
import { CalendarEventDialog, CalendarLessonDialog, NewLessonDialog, useScheduleDialogsPreload } from './lazy-dialogs'
import { LessonCountDialog } from './lesson-count-dialog'
import type { NewLessonDraft } from './new-lesson-dialog'
import { useOptimisticWrites, type WriteRunner } from './optimistic-writes'
import { ScheduleArrival } from './schedule-arrival'
import {
	PHONE_BODY,
	PHONE_ROW,
	WORKSPACE_BODY,
	LOADING_BLOCKS,
	ScheduleLoading,
	useLaptop,
	usePhoneGrid,
} from './schedule-loading'
import { useSchedulePrefetch } from './schedule-prefetch'
import { ScheduleBar, TOOLBAR_BUTTONS, useScheduleKeys, weekSummary } from './schedule-toolbar'
import type { MoveSeed } from './use-lesson-drag'
import { useLessonStudents, type StudentsState } from './use-lesson-students'
import { arrivalMonday, useDropArrivalParams, type ArrivalParams } from './use-schedule-arrival'
import { useScheduleWeek } from './use-schedule-week'
import { WeekGrid, type SlotChoice } from './week-grid'

export function ScheduleScreen({ arrival }: { arrival: ArrivalParams }) {
	const now = useMinuteNow()
	if (now === null) return <ScheduleLoading />
	return <LoadedSchedule now={now} arrival={arrival} />
}

const NO_EVENTS: readonly CalendarEventView[] = []

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

function LoadedSchedule({ now, arrival }: { now: Date; arrival: ArrivalParams }) {
	const [initialMonday] = useState(() => arrivalMonday(arrival))
	const { state: week, reload, navigate, peek } = useScheduleWeek(initialMonday)
	const scrollTopRef = useRef<number | null>(null)
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
	const students = useLessonStudents(week.data !== null)
	const returnFocus = useRef<HTMLElement | null>(null)
	const titleRef = useRef<HTMLHeadingElement>(null)
	const [zone, setZone] = useSecondZone(week.query?.mainTimeZone ?? null)
	const laptop = useLaptop()
	const phone = usePhoneGrid()
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
	useDropArrivalParams(week.query === null && week.kind === 'error')
	useSchedulePrefetch(
		week.data?.events ?? NO_EVENTS,
		now,
		week.data?.requestedRange.timeZone ?? week.query?.mainTimeZone ?? null,
		week.kind === 'ready'
	)
	useScheduleDialogsPreload(week.data !== null)

	if (week.query === null)
		return week.kind === 'error' ? (
			<PageScroll>
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
	const arrived = (
		<ScheduleArrival
			{...arrival}
			failed={week.kind === 'error'}
			ready={week.kind === 'ready' && data !== null && !loadingFirst && requestedMonday === monday}
			monday={monday}
			events={events}
			mainTimeZone={mainTimeZone}
			currentYear={currentYear}
		/>
	)
	const grid = (
		<WeekGrid
			emptyNote={read.state === 'fresh' && events.length === 0 ? 'No Google Calendar events in this range.' : null}
			placed={selected !== null && moveSeed !== undefined ? { event: selected, seed: moveSeed } : null}
			mark={writes.mark}
			monday={monday}
			mainTimeZone={mainTimeZone}
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
			onWeekStep={(direction) => (direction > 0 ? navigation.onNext() : navigation.onPrevious())}
			placeholders={loadingFirst ? LOADING_BLOCKS : undefined}
			phone={phone}
			loadingBlocks={LOADING_BLOCKS}
			pager={
				phone && laptop === null
					? {
							onTurn: (target) => go(target, target === currentMonday),
							pageEvents: (target) => {
								const known = peek(target, mainTimeZone)
								return known === null ? null : known.events.filter((event) => event.status !== 'cancelled')
							},
						}
					: undefined
			}
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
				onMarked={async () => {
					await reload()
				}}
				onWrite={writes.run}
			/>
		</>
	)

	const pendingRecovery =
		commands.view.entries.some((entry) => entry.command?.state !== 'failed') ||
		(commands.view.connection?.pendingCommandCount ?? 0) > 0
	const tools = (
		<>
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
		</>
	)

	const body = (
		<>
			{arrived}
			{grid}
		</>
	)

	if (laptop !== null) {
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
				{inBar(<div className={cn('flex items-center gap-2', TOOLBAR_BUTTONS)}>{tools}</div>, laptop.right)}
				<WorkspacePage>
					<div {...windowAttributes} className={phone ? PHONE_BODY : WORKSPACE_BODY}>
						{body}
					</div>
				</WorkspacePage>
				{dialogs}
			</>
		)
	}

	return (
		<>
			<WorkspacePage>
				<div {...windowAttributes} className={PHONE_BODY}>
					<div className={cn(PHONE_ROW, TOOLBAR_BUTTONS)}>
						<ScheduleBar
							{...navigation}
							compact
							onWeek={pickWeek}
							today={today}
							titleRef={null}
							summary={null}
							heading={false}
						/>
						{tools}
					</div>
					{body}
				</div>
			</WorkspacePage>
			{dialogs}
		</>
	)
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
	onMarked,
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
	onMarked: () => Promise<void>
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
				onMarked={onMarked}
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
