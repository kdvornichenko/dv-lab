'use client'

import { createPortal } from 'react-dom'

import { CalendarPlus } from 'lucide-react'

import { PageHeader, PageScroll, WorkspacePage } from '@/components/app/layout-parts'
import { useTopbarSlot } from '@/components/app/topbar-slot'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Elevated } from '@/lib/elevated'
import { weekRange } from '@/lib/schedule-format'

import { DAY_START_MINUTES, SCHEDULE_TIME_ZONE, lessonDay, mondayOf } from '@dv-lab/core'

import { useMinuteNow } from '../../_components/use-minute-now'
import { AgendaSkeleton } from './agenda-skeleton'
import { ScheduleBar } from './schedule-toolbar'
import { WeekGrid, type GridPlaceholder } from './week-grid'

export const NOTICE_SLOT = 'min-h-44 sm:min-h-26'
export const WORKSPACE_BODY = 'flex min-h-0 flex-1 flex-col px-2 pt-1 pb-2'
export const STRIP = 'flex min-h-7 flex-wrap items-center gap-2'
export const STRIP_TOOLS = 'ml-auto flex items-center gap-2'

const FIRST_HOUR = DAY_START_MINUTES / 60

function block(day: number, hour: number, minutes: number): GridPlaceholder {
	return { day, start: (hour - FIRST_HOUR) * 60, minutes }
}

export const LOADING_BLOCKS: readonly GridPlaceholder[] = [
	block(0, 10, 60),
	block(1, 9.5, 90),
	block(1, 13, 60),
	block(2, 14, 60),
	block(3, 11, 60),
	block(3, 13, 90),
	block(4, 10, 60),
	block(5, 12, 60),
]

export function useLaptop() {
	const left = useTopbarSlot('left')
	const right = useTopbarSlot('right')
	return left !== null && right !== null ? { left, right } : null
}

function ignore() {}

function never() {
	return false
}

function LoadingSlots() {
	return (
		<div className={STRIP_TOOLS}>
			<Skeleton className="size-7 rounded-md" />
			<Skeleton className="size-7 rounded-md" />
			<Skeleton className="size-7 rounded-md" />
		</div>
	)
}

export function ScheduleLoading() {
	const now = useMinuteNow()
	const laptop = useLaptop()
	const today = now === null ? null : lessonDay(now, SCHEDULE_TIME_ZONE)
	const monday = today === null ? null : mondayOf(today)
	const grid =
		now === null || today === null || monday === null ? (
			<>
				<AgendaSkeleton />
				<Elevated
					offset={1}
					shadowLevel={2}
					className="relative hidden min-h-90 flex-1 flex-col overflow-hidden rounded-2xl lg:flex"
				/>
			</>
		) : (
			<WeekGrid
				monday={monday}
				today={today}
				now={now}
				mainTimeZone={SCHEDULE_TIME_ZONE}
				secondZone={null}
				events={[]}
				editable={false}
				onOpen={ignore}
				canMove={never}
				canEdit={never}
				onMove={ignore}
				placeholders={LOADING_BLOCKS}
				zoneKnown={false}
			/>
		)
	if (laptop === null)
		return (
			<PageScroll>
				<PageHeader
					title={monday === null ? ' ' : weekRange(monday)}
					actions={
						<Button leadingIcon={CalendarPlus} disabled>
							New event
						</Button>
					}
				/>
				<div className={STRIP}>
					{today !== null && monday !== null ? (
						<ScheduleBar
							monday={monday}
							currentMonday={monday}
							today={today}
							onToday={ignore}
							onPrevious={ignore}
							onNext={ignore}
							onWeek={ignore}
							summary={null}
							titleRef={null}
							heading={false}
						/>
					) : (
						<span />
					)}
					<LoadingSlots />
				</div>
				<div aria-busy className="space-y-4">
					<div data-slot="calendar-read-slot" className={NOTICE_SLOT} />
					{grid}
				</div>
			</PageScroll>
		)
	return (
		<>
			{today !== null && monday !== null
				? createPortal(
						<ScheduleBar
							monday={monday}
							currentMonday={monday}
							today={today}
							onToday={ignore}
							onPrevious={ignore}
							onNext={ignore}
							onWeek={ignore}
							summary={null}
							titleRef={null}
						/>,
						laptop.left
					)
				: null}
			{createPortal(
				<div className="flex items-center gap-2">
					<Skeleton className="size-7 rounded-md" />
					<Skeleton className="size-7 rounded-md" />
					<Skeleton className="size-7 rounded-md" />
				</div>,
				laptop.right
			)}
			<WorkspacePage>
				<div aria-busy className={WORKSPACE_BODY}>
					{grid}
				</div>
			</WorkspacePage>
		</>
	)
}
