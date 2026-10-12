'use client'

import { useRef, useState } from 'react'

import { CalendarPlus } from 'lucide-react'

import { CalendarRecovery } from '@/components/app/calendar-command-notice'
import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import { CalendarReadNotice } from '@/components/app/google-calendar-state'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { SkeletonTable } from '@/components/ui/skeleton'
import { calendarLesson, canEditCalendarEvent } from '@/lib/lesson-actions'
import { weekRange } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'

import type { CalendarEventView, GoogleScheduleWindow } from '@dv-lab/contracts'
import { addDays, mondayOf, scheduleDate, scheduleToday, zonedInstant } from '@dv-lab/core'

import { useMinuteNow } from '../../_components/use-minute-now'
import { CalendarEventDialog } from './calendar-event-details'
import { CalendarLessonDialog } from './calendar-lesson-dialog'
import { LessonCountDialog } from './lesson-count-dialog'
import { NewLessonDialog } from './new-lesson-dialog'
import { ScheduleToolbar } from './schedule-toolbar'
import type { MoveSeed } from './use-lesson-drag'
import { useLessonStudents } from './use-lesson-students'
import { useScheduleWeek } from './use-schedule-week'
import { FRAME_HEIGHT, OPEN_SCROLL_TOP, WeekGrid, type SlotChoice } from './week-grid'

const NOTICE_SLOT = 'min-h-44 sm:min-h-26'

function ScheduleLoading() {
	return (
		<PageScroll>
			<PageHeader title="Schedule" />
			<div className="space-y-4">
				<div data-slot="calendar-read-slot" className={NOTICE_SLOT} />
				<div className={FRAME_HEIGHT}>
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
	const today = scheduleToday(now, mainTimeZone)
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
		seed: Pick<SlotChoice, 'date' | 'time' | 'durationMinutes'>
		mainTimeZone: string
		asOf: string
	} | null>(null)
	const students = useLessonStudents(draft !== null)
	const returnFocus = useRef<HTMLElement | null>(null)
	const titleRef = useRef<HTMLHeadingElement>(null)
	const [zone, setZone] = useSecondZone(week.query?.mainTimeZone ?? null)

	if (week.query === null)
		return week.kind === 'error' ? (
			<PageScroll>
				<PageHeader title="Schedule" />
				<ReadError screen="schedule" onRefresh={() => void reload()} />
			</PageScroll>
		) : (
			<ScheduleLoading />
		)

	const data = week.data
	const requestedMonday = week.query.monday
	const { mainTimeZone, monday, today, currentYear, currentMonday, read, write, events } = displayWindow(
		data,
		week.query,
		now
	)
	const selected = events.find((event) => event.eventKey === selection?.eventKey) ?? selection
	const secondZone = zone ? { id: zone, caption: zoneLabel(zone, zonedInstant(monday, '12:00', mainTimeZone)) } : null

	const editable = read.state === 'fresh' && write.state === 'ready' && !commands.blocked && week.kind === 'ready'
	function openNew(seed: Pick<SlotChoice, 'date' | 'time' | 'durationMinutes'>) {
		if (!editable || read.state !== 'fresh') return
		setDraft({ seed, mainTimeZone, asOf: read.fetchedAt })
	}
	function refreshForms() {
		setSelection(null)
		setDraft(null)
		void reload()
	}

	function openEvent(event: CalendarEventView) {
		returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
		setSelection(event)
		setMoveSeed(undefined)
	}
	function canMove(event: CalendarEventView) {
		return (
			editable &&
			data !== null &&
			canEditCalendarEvent(event, data) &&
			event.status !== 'cancelled' &&
			Date.parse(event.when.startsAt) > Math.max(now.getTime(), Date.now())
		)
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

	function go(target: string, current: boolean) {
		setSelection(null)
		navigate(target, current)
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
									openNew({ date: monday === currentMonday ? today : monday, time: '09:00', durationMinutes: 60 })
								}
							>
								New lesson
							</Button>
						</div>
					}
				/>
				<ScheduleToolbar
					monday={week.query.monday}
					currentMonday={currentMonday}
					mainTimeZone={mainTimeZone}
					onToday={() => go(currentMonday, true)}
					onPrevious={() => go(addDays(requestedMonday, -7), false)}
					onNext={() => go(addDays(requestedMonday, 7), false)}
					zone={zone}
					onZoneChange={setZone}
				/>
				<div
					data-slot="schedule-window"
					data-requested-start={week.query.monday}
					data-snapshot-start={
						data?.snapshotRange ? scheduleDate(new Date(data.snapshotRange.start), mainTimeZone) : undefined
					}
					className="space-y-4"
					aria-busy={week.kind === 'loading'}
				>
					{week.kind === 'loading' && data === null ? (
						<>
							<div data-slot="calendar-read-slot" className={NOTICE_SLOT} />
							<div className={FRAME_HEIGHT}>
								<SkeletonTable rows={10} className="h-full" />
							</div>
						</>
					) : (
						<>
							<div data-slot="calendar-read-slot" className={NOTICE_SLOT}>
								<CalendarReadNotice
									read={read}
									write={write}
									timeZone={mainTimeZone}
									onRefresh={async () => {
										await reload()
									}}
								/>
							</div>
							<WeekGrid
								emptyNote={
									read.state === 'fresh' && events.length === 0 ? 'No Google Calendar events in this range.' : null
								}
								placed={selected !== null && moveSeed !== undefined ? { event: selected, seed: moveSeed } : null}
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
						</>
					)}
				</div>
				<CalendarRecovery showEmpty={false} />
			</PageScroll>
			{draft !== null ? (
				<NewLessonDialog
					{...draft}
					students={students}
					available={editable}
					currentMainTimeZone={mainTimeZone}
					secondZone={zone}
					onClose={() => setDraft(null)}
					onCreated={() => setDraft(null)}
					onRefresh={refreshForms}
				/>
			) : null}
			<SelectedEventDialog
				moveSeed={moveSeed}
				event={selected}
				window={data}
				now={now}
				timeZone={mainTimeZone}
				secondZone={zone}
				currentYear={currentYear}
				onClose={closeEvent}
				onMoveDiscard={() => setMoveSeed(undefined)}
				onRefresh={refreshForms}
			/>
		</>
	)
}

function SelectedEventDialog({
	moveSeed,
	event,
	window,
	now,
	timeZone,
	secondZone,
	currentYear,
	onClose,
	onMoveDiscard,
	onRefresh,
}: {
	moveSeed?: MoveSeed
	event: CalendarEventView | null
	window: GoogleScheduleWindow | null
	now: Date
	timeZone: string
	secondZone: string | null
	currentYear: number
	onClose: () => void
	onMoveDiscard: () => void
	onRefresh: () => void
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
			/>
		)
	return (
		<CalendarEventDialog
			event={event}
			timeZone={timeZone}
			secondZone={secondZone}
			currentYear={currentYear}
			onClose={onClose}
		/>
	)
}
