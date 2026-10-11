'use client'

import type { ComponentProps, CSSProperties } from 'react'

import { Check, UserX } from 'lucide-react'

import { DotShape } from '@/components/app/status-dot'
import { movedDate, occurrenceSlot, statusKey, statusLabel, type StatusKey } from '@/lib/lesson-mark-text'
import { formatDay, formatRange, formatTime, vnRange } from '@/lib/schedule-format'
import { cn } from '@/lib/utils'

import type { ScheduleBlock } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

export interface BlockLayout {
	top: number
	height: number
	lane: number
	lanes: number
}

type Sign = 'dot' | 'check' | 'user-x' | null

const PLANNED_LOOK = 'bg-selected text-foreground ring-1 ring-surface-2'
const DIMMED_LOOK = `${PLANNED_LOOK} opacity-60`

const BLOCK_LOOK: Record<StatusKey, { shell: string; struck: boolean; sign: Sign }> = {
	planned: { shell: PLANNED_LOOK, struck: false, sign: null },
	needs_mark: { shell: PLANNED_LOOK, struck: false, sign: 'dot' },
	done: { shell: DIMMED_LOOK, struck: false, sign: 'check' },
	no_show: { shell: DIMMED_LOOK, struck: false, sign: 'user-x' },
	cancelled: { shell: 'text-muted-foreground ring-1 ring-selected ring-inset', struck: true, sign: null },
	moved: {
		shell: 'text-foreground outline-2 -outline-offset-2 outline-selected outline-dashed',
		struck: false,
		sign: null,
	},
}

function BlockSign({ sign }: { sign: Exclude<Sign, null> }) {
	if (sign === 'dot') {
		return (
			<DotShape tone="amber" className="absolute top-[6px] right-[6px] ring-1 ring-surface-2" data-slot="block-sign" />
		)
	}
	const Icon = sign === 'check' ? Check : UserX
	return <Icon aria-hidden data-slot="block-sign" data-sign={sign} className="absolute top-[4px] right-[4px] size-3" />
}

interface LessonBlockProps extends Omit<ComponentProps<'button'>, 'onClick'> {
	block: ScheduleBlock
	layout: BlockLayout
	secondZone: string | null
	currentYear: number
	now: Date
	onOpen: (block: ScheduleBlock) => void
	onClick?: ComponentProps<'button'>['onClick']
}

export function LessonBlock({
	block,
	layout,
	secondZone,
	currentYear,
	now,
	onOpen,
	onClick,
	className,
	style,
	...props
}: LessonBlockProps) {
	const start = new Date(block.startsAt)
	const range = formatRange(start, block.durationMinutes, SCHEDULE_TIME_ZONE)
	const movedLabel = movedDate(block)
	const look = BLOCK_LOOK[statusKey(block, now)]
	const label = [
		block.studentName,
		formatDay(start, SCHEDULE_TIME_ZONE, currentYear),
		vnRange(start, block.durationMinutes, secondZone),
		statusLabel(block, now),
	].join(', ')
	const short = block.durationMinutes < 45
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
			data-slot={occurrenceSlot(block.outcome)}
			aria-label={label}
			style={{ ...position, ...style }}
			onClick={(event) => {
				onClick?.(event)
				onOpen(block)
			}}
			className={cn(
				'absolute z-10 block cursor-pointer overflow-hidden rounded-md px-[6px] py-[2px] text-left focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none',
				look.shell,
				className
			)}
		>
			<span
				className={cn('block truncate text-caption font-semibold', look.struck && 'line-through', look.sign && 'pr-4')}
			>
				{lines[0]}
			</span>
			{lines.length > 1 ? <span className="block truncate text-caption tabular-nums">{lines[1]}</span> : null}
			{look.sign === null ? null : <BlockSign sign={look.sign} />}
		</button>
	)
}
