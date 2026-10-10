'use client'

import { useCallback, type MouseEvent } from 'react'

import { Elevated } from '@/lib/elevated'
import { dayNumber, gutterLabel, hourLabel, weekdayCaps } from '@/lib/schedule-format'
import { cn } from '@/lib/utils'

import { SCHEDULE_TIME_ZONE, addDays, zonedParts } from '@dv-lab/core'

export const HOUR_HEIGHT = 48
export const OPEN_SCROLL_TOP = 7 * HOUR_HEIGHT
const MINUTE_HEIGHT = HOUR_HEIGHT / 60
const SLOT_MINUTES = 15
const SLOT_HEIGHT = (HOUR_HEIGHT * SLOT_MINUTES) / 60
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const COLUMNS = 'grid grid-cols-[5rem_repeat(7,minmax(0,1fr))]'

export interface SecondZone {
	id: string
	caption: string
}

interface WeekGridProps {
	monday: string
	today: string
	now: Date
	secondZone: SecondZone | null
	onSlot?: (date: string, time: string) => void
}

function slotTime(offsetY: number): string {
	const slots = Math.max(0, Math.min(95, Math.floor(offsetY / SLOT_HEIGHT)))
	const minutes = slots * SLOT_MINUTES
	return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function GutterPair({
	first,
	second,
	className,
	top,
}: {
	first: string
	second: string | null
	className?: string
	top?: number
}) {
	return (
		<div
			style={top === undefined ? undefined : { top }}
			className={cn(
				'flex justify-end gap-[12px] text-caption whitespace-nowrap text-muted-foreground tabular-nums',
				className
			)}
		>
			<span className="w-8 text-right">{first}</span>
			{second !== null ? <span className="w-8 text-right opacity-70">{second}</span> : null}
		</div>
	)
}

export function WeekGrid({ monday, today, now, secondZone, onSlot }: WeekGridProps) {
	const dates = Array.from({ length: 7 }, (_, index) => addDays(monday, index))
	const nowParts = zonedParts(now, SCHEDULE_TIME_ZONE)
	const scroller = useCallback((node: HTMLDivElement | null) => {
		if (node) node.scrollTop = OPEN_SCROLL_TOP
	}, [])

	function handleSlot(event: MouseEvent<HTMLDivElement>, date: string) {
		if (!onSlot || event.target !== event.currentTarget) return
		const rect = event.currentTarget.getBoundingClientRect()
		onSlot(date, slotTime(event.clientY - rect.top))
	}

	return (
		<Elevated
			offset={1}
			shadowLevel={2}
			data-slot="week-grid"
			className="flex h-[max(28rem,calc(100svh-18rem))] flex-col overflow-hidden rounded-2xl"
		>
			<div data-slot="week-grid-head" className={cn(COLUMNS, '[scrollbar-gutter:stable] overflow-y-hidden')}>
				<div data-slot="week-grid-corner" className="flex items-end justify-end pr-1 pb-2">
					<GutterPair first="VN" second={secondZone ? secondZone.caption : null} />
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
				className="scroll-fade min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto"
			>
				<div className={cn(COLUMNS, 'relative')} style={{ height: HOUR_HEIGHT * 24 }}>
					<div data-slot="week-grid-gutter" className="relative">
						{HOURS.map((hour) => (
							<GutterPair
								key={hour}
								first={hourLabel(hour)}
								second={secondZone ? gutterLabel(monday, hour, secondZone.id) : null}
								top={hour * HOUR_HEIGHT}
								className={cn('absolute inset-x-0 pr-1', hour > 0 && '-translate-y-1/2')}
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
							</div>
						)
					})}
					{HOURS.map((hour) => (
						<div
							key={hour}
							data-slot="week-grid-line"
							data-hour={hour}
							className="pointer-events-none absolute right-0 left-20 h-px bg-gcal-line"
							style={{ top: hour * HOUR_HEIGHT }}
						/>
					))}
				</div>
			</div>
		</Elevated>
	)
}
