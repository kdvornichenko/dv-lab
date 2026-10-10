'use client'

import type { ComponentProps, CSSProperties } from 'react'

import { formatDay, formatDayMonth, formatRange, formatTime, vnRange } from '@/lib/schedule-format'
import { cn } from '@/lib/utils'

import type { ScheduleBlock, ScheduleBlockStatus } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

export type BlockSlot = 'from' | 'to'

export function blockSlot(block: Pick<ScheduleBlock, 'status'>): BlockSlot {
	return block.status === 'moved' ? 'from' : 'to'
}

export interface BlockLayout {
	top: number
	height: number
	lane: number
	lanes: number
}

const DOT: Record<ScheduleBlockStatus, string> = {
	scheduled: 'bg-info',
	cancelled: 'bg-destructive',
	moved: 'bg-warning',
}

export function LessonStatus({ status, movedTo }: { status: ScheduleBlockStatus; movedTo?: string }) {
	const word =
		status === 'scheduled'
			? 'Planned'
			: status === 'cancelled'
				? 'Cancelled'
				: movedTo
					? `Moved to ${movedTo}`
					: 'Moved'
	return (
		<span className="inline-flex items-center gap-2">
			<span aria-hidden className={cn('size-2 shrink-0 rounded-full', DOT[status])} />
			<span>{word}</span>
		</span>
	)
}

const STATUS_CLASS: Record<ScheduleBlockStatus, string> = {
	scheduled: 'bg-selected text-foreground ring-1 ring-surface-2',
	cancelled: 'text-muted-foreground ring-1 ring-selected ring-inset',
	moved: 'text-foreground outline-2 -outline-offset-2 outline-selected outline-dashed',
}

interface LessonBlockProps extends Omit<ComponentProps<'button'>, 'onClick'> {
	block: ScheduleBlock
	layout: BlockLayout
	secondZone: string | null
	currentYear: number
	onOpen: (block: ScheduleBlock) => void
	onClick?: ComponentProps<'button'>['onClick']
}

export function LessonBlock({
	block,
	layout,
	secondZone,
	currentYear,
	onOpen,
	onClick,
	className,
	style,
	...props
}: LessonBlockProps) {
	const start = new Date(block.startsAt)
	const range = formatRange(start, block.durationMinutes, SCHEDULE_TIME_ZONE)
	const movedLabel =
		block.status === 'moved' && block.movedTo !== null
			? formatDayMonth(new Date(block.movedTo), SCHEDULE_TIME_ZONE)
			: null
	const statusWord =
		block.status === 'scheduled'
			? 'planned'
			: block.status === 'cancelled'
				? 'cancelled'
				: `moved to ${movedLabel ?? ''}`
	const label = [
		block.studentName,
		formatDay(start, SCHEDULE_TIME_ZONE, currentYear),
		vnRange(start, block.durationMinutes, secondZone),
		statusWord,
	].join(', ')
	const short = block.durationMinutes <= 30
	const lines = short
		? [
				movedLabel !== null
					? `${block.studentName} → ${movedLabel}`
					: `${block.studentName}, ${formatTime(start, SCHEDULE_TIME_ZONE)}`,
			]
		: [block.studentName, movedLabel !== null ? `→ ${movedLabel}` : range]
	const position: CSSProperties = {
		top: layout.top,
		height: layout.height,
		left: `calc(${layout.lane} / ${layout.lanes} * 100% + 2px)`,
		width: `calc(100% / ${layout.lanes} - 6px)`,
	}
	return (
		<button
			type="button"
			{...props}
			data-key={block.key}
			data-slot={blockSlot(block)}
			aria-label={label}
			style={{ ...position, ...style }}
			onClick={(event) => {
				onClick?.(event)
				onOpen(block)
			}}
			className={cn(
				'absolute z-10 block cursor-pointer overflow-hidden rounded-md px-[6px] py-[2px] text-left focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none',
				STATUS_CLASS[block.status],
				className
			)}
		>
			<span className={cn('block truncate text-caption font-semibold', block.status === 'cancelled' && 'line-through')}>
				{lines[0]}
			</span>
			{lines.length > 1 ? <span className="block truncate text-caption tabular-nums">{lines[1]}</span> : null}
		</button>
	)
}
