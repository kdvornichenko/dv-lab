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
import { apiRequest } from '@/lib/api-client'
import { calendarLesson } from '@/lib/lesson-actions'
import { weekRange } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'

import type { CalendarEventView, GoogleScheduleWindow, StudentsResponse } from '@dv-lab/contracts'
import { addDays, mondayOf, scheduleDate, scheduleToday, zonedInstant } from '@dv-lab/core'

import { useMinuteNow } from '../../_components/use-minute-now'
import { CalendarEventDialog } from './calendar-event-details'
import { CalendarLessonDialog } from './calendar-lesson-dialog'
import { NewLessonDialog, type StudentsState } from './new-lesson-dialog'
import { ScheduleToolbar } from './schedule-toolbar'
import { useScheduleWeek } from './use-schedule-week'
import { FRAME_HEIGHT, OPEN_SCROLL_TOP, WeekGrid, type SlotChoice } from './week-grid'

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
		events: data?.events ?? [],
	}
}

function LoadedSchedule({ now }: { now: Date }) {
	const { state: week, reload, navigate } = useScheduleWeek()
	const scrollTopRef = useRef(OPEN_SCROLL_TOP)
	const [selection, setSelection] = useState<CalendarEventView | null>(null)
	const commands = useCalendarCommands()
	const [students, setStudents] = useState<StudentsState>({ kind: 'loading' })
	const [draft, setDraft] = useState<{
		seed: Pick<SlotChoice, 'date' | 'time' | 'durationMinutes'>
		mainTimeZone: string
		asOf: string
	} | null>(null)
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
	async function openNew(seed: Pick<SlotChoice, 'date' | 'time' | 'durationMinutes'>) {
		if (!editable || read.state !== 'fresh') return
		setStudents({ kind: 'loading' })
		setDraft({ seed, mainTimeZone, asOf: read.fetchedAt })
		const result = await apiRequest<StudentsResponse>('GET', '/students')
		setStudents(result.ok ? { kind: 'ready', rows: result.data.students } : { kind: 'error' })
		await reload()
	}
	function refreshForms() {
		setSelection(null)
		setDraft(null)
		void reload()
	}

	function openEvent(event: CalendarEventView) {
		returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
		setSelection(event)
	}

	function closeEvent() {
		setSelection(null)
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
						<Button
							leadingIcon={CalendarPlus}
							disabled={!editable}
							onClick={() => void openNew({ date: today, time: '09:00', durationMinutes: 60 })}
						>
							New lesson
						</Button>
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
						<div className={FRAME_HEIGHT}>
							<SkeletonTable rows={10} className="h-full" />
						</div>
					) : (
						<>
							<CalendarReadNotice
								read={read}
								write={write}
								timeZone={mainTimeZone}
								onRefresh={async () => {
									await reload()
								}}
							/>
							{read.state === 'fresh' && events.length === 0 ? (
								<p className="text-body text-muted-foreground">No Google Calendar events in this range.</p>
							) : null}
							<WeekGrid
								monday={monday}
								mainTimeZone={mainTimeZone}
								today={today}
								now={now}
								secondZone={secondZone}
								events={events}
								currentYear={currentYear}
								onOpen={openEvent}
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
				event={selected}
				window={data}
				now={now}
				timeZone={mainTimeZone}
				secondZone={zone}
				currentYear={currentYear}
				onClose={closeEvent}
				onRefresh={refreshForms}
			/>
		</>
	)
}

function SelectedEventDialog({
	event,
	window,
	now,
	timeZone,
	secondZone,
	currentYear,
	onClose,
	onRefresh,
}: {
	event: CalendarEventView | null
	window: GoogleScheduleWindow | null
	now: Date
	timeZone: string
	secondZone: string | null
	currentYear: number
	onClose: () => void
	onRefresh: () => void
}) {
	if (event === null) return null
	if (window !== null && calendarLesson(event))
		return (
			<CalendarLessonDialog
				key={event.eventKey}
				event={event}
				window={window}
				now={now}
				mainTimeZone={timeZone}
				secondZone={secondZone}
				onClose={onClose}
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
