'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { Tooltip } from '@/components/ui/tooltip'
import { formatDayMonth, formatFullDate, formatRange, secondRange } from '@/lib/schedule-format'

import type { ScheduleBlock } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

import { LessonBlock, LessonStatus, type BlockLayout } from './lesson-block'

const OPEN_DELAY = 200
const SKIP_DELAY = 300

const clock = { closedAt: 0 }

interface EventTooltipProps {
	block: ScheduleBlock
	layout: BlockLayout
	secondZone: string | null
	currentYear: number
	onOpen: (block: ScheduleBlock) => void
}

export function EventTooltip({ block, layout, secondZone, currentYear, onOpen }: EventTooltipProps) {
	const [open, setOpen] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

	function cancel() {
		if (timer.current !== null) {
			clearTimeout(timer.current)
			timer.current = null
		}
	}

	function close() {
		cancel()
		if (open) clock.closedAt = Date.now()
		setOpen(false)
	}

	function enter(event: PointerEvent<HTMLButtonElement>) {
		if (event.pointerType !== 'mouse') return
		cancel()
		const delay = Date.now() - clock.closedAt < SKIP_DELAY ? 0 : OPEN_DELAY
		timer.current = setTimeout(() => {
			timer.current = null
			setOpen(true)
		}, delay)
	}

	useEffect(() => {
		if (!open) return
		const onScroll = () => {
			clock.closedAt = Date.now()
			setOpen(false)
		}
		window.addEventListener('scroll', onScroll, true)
		return () => window.removeEventListener('scroll', onScroll, true)
	}, [open])

	useEffect(
		() => () => {
			if (timer.current !== null) clearTimeout(timer.current)
		},
		[]
	)

	const start = new Date(block.startsAt)
	const second = secondRange(start, block.durationMinutes, secondZone)
	const movedTo =
		block.status === 'moved' && block.movedTo !== null
			? formatDayMonth(new Date(block.movedTo), SCHEDULE_TIME_ZONE)
			: undefined

	return (
		<Tooltip
			side="right"
			sideOffset={8}
			forceOpen={open}
			className="max-w-[280px] rounded-xl bg-surface-4 p-3 text-foreground shadow-surface-3 [text-box:normal] supports-[text-box:trim-both]:py-3"
			content={
				<div data-slot="event-tooltip" className="flex flex-col gap-1">
					<span className="text-body font-semibold">{block.studentName}</span>
					<span className="text-caption text-muted-foreground">
						{formatFullDate(start, SCHEDULE_TIME_ZONE, currentYear)}
					</span>
					<span className="text-caption tabular-nums">
						{formatRange(start, block.durationMinutes, SCHEDULE_TIME_ZONE)} VN{second === null ? '' : ` · ${second}`}
					</span>
					<span className="text-caption">
						<LessonStatus status={block.status} movedTo={movedTo} />
					</span>
				</div>
			}
		>
			<LessonBlock
				block={block}
				layout={layout}
				secondZone={secondZone}
				currentYear={currentYear}
				onOpen={(chosen) => {
					close()
					onOpen(chosen)
				}}
				onPointerEnter={enter}
				onPointerLeave={close}
			/>
		</Tooltip>
	)
}
