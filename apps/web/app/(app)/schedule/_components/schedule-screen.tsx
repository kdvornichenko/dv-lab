'use client'

import { useRef, useState } from 'react'

import { CalendarPlus } from 'lucide-react'

import { CalendarReadNotice } from '@/components/app/google-calendar-state'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { SkeletonTable } from '@/components/ui/skeleton'
import { weekRange } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'

import type { CalendarEventView, GoogleScheduleWindow } from '@dv-lab/contracts'
import { addDays, mondayOf, scheduleDate, scheduleToday, zonedInstant } from '@dv-lab/core'

import { useMinuteNow } from '../../_components/use-minute-now'
import { CalendarEventDialog } from './calendar-event-details'
import { ScheduleToolbar } from './schedule-toolbar'
import { useScheduleWeek } from './use-schedule-week'
import { FRAME_HEIGHT, OPEN_SCROLL_TOP, WeekGrid } from './week-grid'

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
	const [selectedKey, setSelectedKey] = useState<string | null>(null)
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
	const selected = events.find((event) => event.eventKey === selectedKey) ?? null
	const secondZone = zone ? { id: zone, caption: zoneLabel(zone, zonedInstant(monday, '12:00', mainTimeZone)) } : null

	function openEvent(event: CalendarEventView) {
		returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
		setSelectedKey(event.eventKey)
	}

	function closeEvent() {
		setSelectedKey(null)
		requestAnimationFrame(() => {
			if (returnFocus.current?.isConnected) returnFocus.current.focus()
			else titleRef.current?.focus()
		})
	}

	function go(target: string, current: boolean) {
		setSelectedKey(null)
		navigate(target, current)
	}

	return (
		<>
			<PageScroll>
				<PageHeader
					titleRef={titleRef}
					title={weekRange(monday)}
					actions={
						<Button leadingIcon={CalendarPlus} disabled>
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
							<CalendarReadNotice read={read} write={write} timeZone={mainTimeZone} onRefresh={reload} />
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
								editable={false}
								scrollTopRef={scrollTopRef}
							/>
						</>
					)}
				</div>
			</PageScroll>
			{selected !== null ? (
				<CalendarEventDialog
					event={selected}
					timeZone={mainTimeZone}
					secondZone={zone}
					currentYear={currentYear}
					onClose={closeEvent}
				/>
			) : null}
		</>
	)
}
