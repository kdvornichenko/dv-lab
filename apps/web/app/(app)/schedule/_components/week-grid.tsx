'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { Elevated } from '@/lib/elevated'
import { occurrenceSlot } from '@/lib/lesson-mark-text'
import { dayNumber, gutterLabel, hourLabel, weekdayCaps } from '@/lib/schedule-format'
import { cn } from '@/lib/utils'

import type { ScheduleBlock } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, addDays, scheduleDate, zonedParts } from '@dv-lab/core'

import { EventTooltip } from './event-tooltip'
import type { BlockLayout } from './lesson-block'

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
const SLOTS_PER_DAY = DAY_MINUTES / SLOT_MINUTES
const DRAG_THRESHOLD = 4
const MAX_FRAME_SLOTS = 240 / SLOT_MINUTES
const CLICK_FRAME_MINUTES = 60
const EDGE_ZONE = 48
const SCROLL_STEP = 16
const CHIP_BELOW_MINUTES = 30

export interface SecondZone {
	id: string
	caption: string
}

export interface SlotChoice {
	date: string
	time: string
	durationMinutes: number
	dragged: boolean
}

export interface SlotFrame {
	date: string
	time: string
	durationMinutes: number
}

interface WeekGridProps {
	monday: string
	today: string
	now: Date
	secondZone: SecondZone | null
	blocks?: readonly ScheduleBlock[]
	currentYear?: number
	onOpen?: (block: ScheduleBlock) => void
	onSlot?: (choice: SlotChoice) => void
	frame?: SlotFrame | null
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
		const date = scheduleDate(new Date(block.startsAt))
		const list = groups.get(date)
		if (list) list.push(block)
		else groups.set(date, [block])
	}
	return groups
}

function clock(minutes: number): string {
	if (minutes >= DAY_MINUTES) return '24:00'
	return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function slotAt(clientY: number, columnTop: number): number {
	return Math.max(0, Math.min(SLOTS_PER_DAY - 1, Math.floor((clientY - columnTop) / SLOT_HEIGHT)))
}

function timeMinutes(time: string): number {
	return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

function clampSlot(anchor: number, slot: number): number {
	if (slot - anchor >= MAX_FRAME_SLOTS) return anchor + MAX_FRAME_SLOTS - 1
	if (anchor - slot >= MAX_FRAME_SLOTS) return anchor - MAX_FRAME_SLOTS + 1
	return slot
}

interface DragState {
	date: string
	anchor: number
	slot: number
}

interface Press {
	pointerId: number
	date: string
	column: HTMLElement
	startX: number
	startY: number
	lastY: number
	anchor: number
	slot: number
	started: boolean
}

function SlotFrameBlock({
	start,
	minutes,
	state,
	flip,
}: {
	start: number
	minutes: number
	state: 'drag' | 'draft'
	flip: boolean
}) {
	const range = `${clock(start)}–${clock(start + minutes)}`
	const visible = Math.min(minutes, DAY_MINUTES - start)
	return (
		<div
			data-slot="week-grid-frame"
			data-state={state}
			data-minutes={minutes}
			data-range={range}
			className="pointer-events-none absolute z-20 rounded-md bg-selected/85 px-[6px] py-[2px] text-foreground ring-1 ring-foreground/40 ring-inset"
			style={{ top: start * MINUTE_HEIGHT, height: visible * MINUTE_HEIGHT, left: 2, width: 'calc(100% - 6px)' }}
		>
			{minutes < CHIP_BELOW_MINUTES ? (
				<span
					data-slot="week-grid-frame-chip"
					className={cn(
						'absolute top-1/2 -translate-y-1/2 rounded-md bg-surface-4 px-2 py-0.5 text-micro whitespace-nowrap text-foreground shadow-surface-4',
						flip ? 'right-full mr-1' : 'left-full ml-1'
					)}
				>
					{range}
				</span>
			) : (
				<span className="block text-caption whitespace-nowrap">{range}</span>
			)}
		</div>
	)
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
	frame = null,
	scrollTopRef,
}: WeekGridProps) {
	const dates = Array.from({ length: 7 }, (_, index) => addDays(monday, index))
	const nowParts = zonedParts(now, SCHEDULE_TIME_ZONE)
	const bodyRef = useRef<HTMLDivElement | null>(null)
	const pressRef = useRef<Press | null>(null)
	const [drag, setDrag] = useState<DragState | null>(null)
	const scroller = useCallback(
		(node: HTMLDivElement | null) => {
			bodyRef.current = node
			if (node) node.scrollTop = scrollTopRef ? scrollTopRef.current : OPEN_SCROLL_TOP
		},
		[scrollTopRef]
	)
	const groups = groupByDate(blocks)
	const dragging = drag !== null

	const cancelDrag = useCallback(() => {
		const press = pressRef.current
		pressRef.current = null
		if (press) {
			try {
				press.column.releasePointerCapture(press.pointerId)
			} catch {}
		}
		setDrag(null)
	}, [])

	useEffect(() => {
		if (!dragging) return
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return
			event.preventDefault()
			cancelDrag()
		}
		document.addEventListener('keydown', onKey)
		window.addEventListener('blur', cancelDrag)
		return () => {
			document.removeEventListener('keydown', onKey)
			window.removeEventListener('blur', cancelDrag)
		}
	}, [dragging, cancelDrag])

	useEffect(() => {
		if (!dragging) return
		let frameId = 0
		const tick = () => {
			const body = bodyRef.current
			const press = pressRef.current
			if (body && press && press.started) {
				const rect = body.getBoundingClientRect()
				const fromTop = press.lastY - rect.top
				const fromBottom = rect.bottom - press.lastY
				let delta = 0
				if (fromTop < EDGE_ZONE) delta = -Math.ceil((1 - Math.max(fromTop, 0) / EDGE_ZONE) * SCROLL_STEP)
				else if (fromBottom < EDGE_ZONE) delta = Math.ceil((1 - Math.max(fromBottom, 0) / EDGE_ZONE) * SCROLL_STEP)
				if (delta !== 0) {
					const before = body.scrollTop
					body.scrollTop = before + delta
					if (body.scrollTop !== before) {
						const slot = clampSlot(press.anchor, slotAt(press.lastY, press.column.getBoundingClientRect().top))
						press.slot = slot
						setDrag((current) => (current && current.slot !== slot ? { ...current, slot } : current))
					}
				}
			}
			frameId = requestAnimationFrame(tick)
		}
		frameId = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frameId)
	}, [dragging])

	function pressColumn(event: ReactPointerEvent<HTMLDivElement>, date: string) {
		if (!onSlot || event.target !== event.currentTarget) return
		if (event.button !== 0 || event.pointerType === 'touch') return
		const column = event.currentTarget
		pressRef.current = {
			pointerId: event.pointerId,
			date,
			column,
			startX: event.clientX,
			startY: event.clientY,
			lastY: event.clientY,
			anchor: slotAt(event.clientY, column.getBoundingClientRect().top),
			slot: slotAt(event.clientY, column.getBoundingClientRect().top),
			started: false,
		}
		try {
			column.setPointerCapture(event.pointerId)
		} catch {}
	}

	function moveColumn(event: ReactPointerEvent<HTMLDivElement>) {
		const press = pressRef.current
		if (!press || event.pointerId !== press.pointerId) return
		press.lastY = event.clientY
		if (!press.started) {
			if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) < DRAG_THRESHOLD) return
			press.started = true
		}
		const slot = clampSlot(press.anchor, slotAt(event.clientY, press.column.getBoundingClientRect().top))
		press.slot = slot
		setDrag((current) =>
			current && current.date === press.date && current.anchor === press.anchor && current.slot === slot
				? current
				: { date: press.date, anchor: press.anchor, slot }
		)
	}

	function releaseColumn(event: ReactPointerEvent<HTMLDivElement>) {
		const press = pressRef.current
		if (!press || event.pointerId !== press.pointerId) return
		const slot = press.slot
		pressRef.current = null
		try {
			press.column.releasePointerCapture(press.pointerId)
		} catch {}
		setDrag(null)
		if (!press.started) {
			onSlot?.({
				date: press.date,
				time: clock(press.anchor * SLOT_MINUTES),
				durationMinutes: CLICK_FRAME_MINUTES,
				dragged: false,
			})
			return
		}
		const low = Math.min(press.anchor, slot)
		onSlot?.({
			date: press.date,
			time: clock(low * SLOT_MINUTES),
			durationMinutes: (Math.abs(slot - press.anchor) + 1) * SLOT_MINUTES,
			dragged: true,
		})
	}

	return (
		<TooltipProvider>
			<Elevated
				offset={1}
				shadowLevel={2}
				data-slot="week-grid"
				data-dragging={dragging ? '' : undefined}
				className={cn(FRAME_HEIGHT, 'flex flex-col overflow-hidden rounded-2xl data-[dragging]:**:cursor-ns-resize!')}
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
						{dates.map((date, dayIndex) => {
							const isToday = date === today
							const live = drag !== null && drag.date === date ? drag : null
							const shownFrame = !dragging && frame !== null && frame.date === date ? frame : null
							return (
								<div
									key={date}
									data-slot="week-grid-column"
									data-date={date}
									onPointerDown={(event) => pressColumn(event, date)}
									onPointerMove={moveColumn}
									onPointerUp={releaseColumn}
									onPointerCancel={cancelDrag}
									className={cn(
										'relative border-l border-gcal-line select-none',
										isToday && 'bg-hover',
										dragging && 'cursor-ns-resize'
									)}
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
											key={`${block.key}:${occurrenceSlot(block.outcome)}`}
											block={block}
											layout={layout}
											secondZone={secondZone ? secondZone.id : null}
											currentYear={currentYear}
											now={now}
											onOpen={(chosen) => onOpen?.(chosen)}
										/>
									))}
									{live !== null ? (
										<SlotFrameBlock
											start={Math.min(live.anchor, live.slot) * SLOT_MINUTES}
											minutes={(Math.abs(live.slot - live.anchor) + 1) * SLOT_MINUTES}
											state="drag"
											flip={dayIndex === 6}
										/>
									) : null}
									{shownFrame !== null ? (
										<SlotFrameBlock
											start={timeMinutes(shownFrame.time)}
											minutes={shownFrame.durationMinutes}
											state="draft"
											flip={dayIndex === 6}
										/>
									) : null}
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
