'use client'

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { WorkspacePage } from '@/components/app/layout-parts'
import { useTopbarSlot } from '@/components/app/topbar-slot'
import { Skeleton } from '@/components/ui/skeleton'
import { Elevated } from '@/lib/elevated'

import { SCHEDULE_TIME_ZONE, lessonDay, mondayOf } from '@dv-lab/core'

import { useMinuteNow } from '../../_components/use-minute-now'
import { ScheduleBar } from './schedule-toolbar'
import { WeekGrid, type GridPlaceholder } from './week-grid'

export const WORKSPACE_BODY = 'flex min-h-0 flex-1 flex-col px-2 pt-1 pb-2'
export const PHONE_BODY = 'flex min-h-0 flex-1 flex-col'
export const PHONE_ROW = 'flex h-9 shrink-0 items-center gap-1 px-3 pt-0.5 pb-1.5'
const PHONE_QUERY = '(max-width: 1023px)'

function block(day: number, hour: number, minutes: number): GridPlaceholder {
	return { day, start: hour * 60, minutes }
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

function subscribePhone(onChange: () => void) {
	const query = window.matchMedia(PHONE_QUERY)
	query.addEventListener('change', onChange)
	return () => query.removeEventListener('change', onChange)
}

export function usePhoneGrid() {
	return useSyncExternalStore(
		subscribePhone,
		() => window.matchMedia(PHONE_QUERY).matches,
		() => false
	)
}

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
		<div className="flex items-center gap-1">
			<Skeleton className="size-7 rounded-md" />
			<Skeleton className="size-7 rounded-md" />
			<Skeleton className="size-7 rounded-md" />
		</div>
	)
}

export function ScheduleLoading() {
	const now = useMinuteNow()
	const laptop = useLaptop()
	const phone = usePhoneGrid()
	const today = now === null ? null : lessonDay(now, SCHEDULE_TIME_ZONE)
	const monday = today === null ? null : mondayOf(today)
	const grid =
		now === null || today === null || monday === null ? (
			phone ? (
				<div className="min-h-0 flex-1" />
			) : (
				<Elevated
					offset={1}
					shadowLevel={2}
					className="relative flex min-h-90 flex-1 flex-col overflow-hidden rounded-2xl"
				/>
			)
		) : (
			<WeekGrid
				monday={monday}
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
				phone={phone}
			/>
		)
	if (laptop === null)
		return (
			<WorkspacePage>
				<div aria-busy className={PHONE_BODY}>
					<div className={PHONE_ROW}>
						{today !== null && monday !== null ? (
							<ScheduleBar
								compact
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
							<span className="flex-1" />
						)}
						<LoadingSlots />
					</div>
					{grid}
				</div>
			</WorkspacePage>
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
				<div aria-busy className={phone ? PHONE_BODY : WORKSPACE_BODY}>
					{grid}
				</div>
			</WorkspacePage>
		</>
	)
}
