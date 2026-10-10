'use client'

import { useCallback, type MouseEvent } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { Elevated } from '@/lib/elevated'
import { dayNumber, gutterLabel, hourLabel, weekdayCaps } from '@/lib/schedule-format'
import { cn } from '@/lib/utils'

import type { ScheduleBlock } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, addDays, zonedParts } from '@dv-lab/core'

import { EventTooltip } from './event-tooltip'
import { blockSlot, type BlockLayout } from './lesson-block'

export const HOUR_HEIGHT = 48
export const FRAME_HEIGHT = 'h-[max(28rem,calc(100svh-20rem))]'
export const OPEN_SCROLL_TOP = 7 * HOUR_HEIGHT
const MINUTE_HEIGHT = HOUR_HEIGHT / 60
const SLOT_MINUTES = 15
const SLOT_HEIGHT = (HOUR_HEIGHT * SLOT_MINUTES) / 60
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const COLUMNS = 'grid grid-cols-[100px_repeat(7,minmax(0,1fr))]'
const MIN_DISPLAY_MINUTES = 30
const DAY_MINUTES = 24 * 60

export interface SecondZone {
	id: string
	caption: string
}

interface WeekGridProps {
	monday: string
	today: string
	now: Date
	secondZone: SecondZone | null
	blocks?: readonly ScheduleBlock[]
	currentYear?: number
	onOpen?: (block: ScheduleBlock) => void
	onSlot?: (date: string, time: string) => void
	scrollTopRef?: { current: number }
}

interface PlacedBlock {
	block: ScheduleBlock
	layout: BlockLayout
}

function placeDay(blocks: readonly ScheduleBlock[]): PlacedBlock[] {
	const items = blocks
		.map((block) => {
			const start = zonedParts(new Date(block.startsAt), SCHEDULE_TIME_ZONE).minutes
			const shown = Math.min(Math.max(block.durationMinutes, MIN_DISPLAY_MINUTES), DAY_MINUTES - start)
			return { block, start, end: start + shown, shown }
		})
		.sort((left, right) => left.start - right.start || (left.block.key < right.block.key ? -1 : 1))
	const placed: PlacedBlock[] = []
	let cluster: typeof items = []
	let clusterEnd = -1
	const flush = () => {
		const laneEnds: number[] = []
		const lanes = cluster.map((item) => {
			let lane = laneEnds.findIndex((end) => end <= item.start)
			if (lane === -1) lane = laneEnds.length
			laneEnds[lane] = item.end
			return lane
		})
		cluster.forEach((item, index) => {
			placed.push({
				block: item.block,
				layout: {
					top: item.start * MINUTE_HEIGHT,
					height: item.shown * MINUTE_HEIGHT - 2,
					lane: lanes[index],
					lanes: laneEnds.length,
				},
			})
		})
		cluster = []
	}
	for (const item of items) {
		if (cluster.length > 0 && item.start >= clusterEnd) flush()
		cluster.push(item)
		clusterEnd = cluster.length === 1 ? item.end : Math.max(clusterEnd, item.end)
	}
	flush()
	return placed
}

function groupByDate(blocks: readonly ScheduleBlock[]): Map<string, ScheduleBlock[]> {
	const groups = new Map<string, ScheduleBlock[]>()
	for (const block of blocks) {
		const date = zonedParts(new Date(block.startsAt), SCHEDULE_TIME_ZONE).date
		const list = groups.get(date)
		if (list) list.push(block)
		else groups.set(date, [block])
	}
	return groups
}

function slotTime(offsetY: number): string {
	const slots = Math.max(0, Math.min(95, Math.floor(offsetY / SLOT_HEIGHT)))
	const minutes = slots * SLOT_MINUTES
	return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function GutterPair({
	local,
	second,
	className,
	top,
}: {
	local: string
	second: string | null
	className?: string
	top?: number
}) {
	return (
		<div
			style={top === undefined ? undefined : { top }}
			className={cn(
				'flex justify-end gap-2 pr-2 pl-[12px] text-caption whitespace-nowrap text-muted-foreground tabular-nums',
				className
			)}
		>
			{second !== null ? <span className="w-[36px] text-right">{second}</span> : null}
			<span className="w-[36px] text-right">{local}</span>
		</div>
	)
}

export function WeekGrid({
	monday,
	today,
	now,
	secondZone,
	blocks = [],
	currentYear = 0,
	onOpen,
	onSlot,
	scrollTopRef,
}: WeekGridProps) {
	const dates = Array.from({ length: 7 }, (_, index) => addDays(monday, index))
	const nowParts = zonedParts(now, SCHEDULE_TIME_ZONE)
	const scroller = useCallback(
		(node: HTMLDivElement | null) => {
			if (node) node.scrollTop = scrollTopRef ? scrollTopRef.current : OPEN_SCROLL_TOP
		},
		[scrollTopRef]
	)
	const groups = groupByDate(blocks)

	function handleSlot(event: MouseEvent<HTMLDivElement>, date: string) {
		if (!onSlot || event.target !== event.currentTarget) return
		const rect = event.currentTarget.getBoundingClientRect()
		onSlot(date, slotTime(event.clientY - rect.top))
	}

	return (
		<TooltipProvider>
			<Elevated
				offset={1}
				shadowLevel={2}
				data-slot="week-grid"
				className={cn(FRAME_HEIGHT, 'flex flex-col overflow-hidden rounded-2xl')}
			>
				<div data-slot="week-grid-head" className={cn(COLUMNS, '[scrollbar-gutter:stable] overflow-y-hidden')}>
					<div data-slot="week-grid-corner" className="flex items-end justify-end pb-2">
						<GutterPair local="VN" second={secondZone ? secondZone.caption : null} />
					</div>
					{dates.map((date) => {
						const isToday = date === today
						return (
							<div
								key={date}
								data-slot="week-grid-day"
								data-date={date}
								className="flex flex-col items-center gap-1 border-l border-gcal-line pt-2 pb-2"
							>
								<span
									className={cn(
										'text-caption tracking-wider text-muted-foreground uppercase',
										isToday && 'text-gcal-today'
									)}
								>
									{weekdayCaps(date)}
								</span>
								<span
									data-slot="week-grid-date"
									className={cn(
										'flex size-11 items-center justify-center rounded-full text-display font-normal tabular-nums',
										isToday ? 'bg-gcal-today text-gcal-today-ink' : 'text-foreground'
									)}
								>
									{dayNumber(date)}
								</span>
							</div>
						)
					})}
				</div>
				<div
					ref={scroller}
					data-slot="week-grid-body"
					onScroll={(event) => {
						if (scrollTopRef) scrollTopRef.current = event.currentTarget.scrollTop
					}}
					className="scroll-fade min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto"
				>
					<div className={cn(COLUMNS, 'relative')} style={{ height: HOUR_HEIGHT * 24 }}>
						<div data-slot="week-grid-gutter" className="relative">
							{HOURS.map((hour) => (
								<GutterPair
									key={hour}
									local={hourLabel(hour)}
									second={secondZone ? gutterLabel(monday, hour, secondZone.id) : null}
									top={hour * HOUR_HEIGHT}
									className={cn('absolute inset-x-0', hour > 0 && '-translate-y-1/2')}
								/>
							))}
						</div>
						{dates.map((date) => {
							const isToday = date === today
							return (
								<div
									key={date}
									data-slot="week-grid-column"
									data-date={date}
									onClick={(event) => handleSlot(event, date)}
									className={cn('relative border-l border-gcal-line', isToday && 'bg-hover')}
								>
									{isToday ? (
										<div
											data-slot="week-grid-now"
											className="pointer-events-none absolute inset-x-0 z-20 h-0.5 -translate-y-1/2 bg-gcal-now"
											style={{ top: nowParts.minutes * MINUTE_HEIGHT }}
										>
											<span
												aria-hidden
												className="absolute top-1/2 left-0 size-3 -translate-y-1/2 rounded-full bg-gcal-now"
											/>
											<span className="sr-only">Now {nowParts.time}</span>
										</div>
									) : null}
									{placeDay(groups.get(date) ?? []).map(({ block, layout }) => (
										<EventTooltip
											key={`${block.key}:${blockSlot(block)}`}
											block={block}
											layout={layout}
											secondZone={secondZone ? secondZone.id : null}
											currentYear={currentYear}
											onOpen={(chosen) => onOpen?.(chosen)}
										/>
									))}
								</div>
							)
						})}
						{HOURS.map((hour) => (
							<div
								key={hour}
								data-slot="week-grid-line"
								data-hour={hour}
								className="pointer-events-none absolute right-0 left-[100px] h-px bg-gcal-line"
								style={{ top: hour * HOUR_HEIGHT }}
							/>
						))}
					</div>
				</div>
			</Elevated>
		</TooltipProvider>
	)
}
