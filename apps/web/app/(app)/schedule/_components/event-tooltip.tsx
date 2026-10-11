'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { StatusDot } from '@/components/app/status-dot'
import { TimePair } from '@/components/app/time-pair'
import { Tooltip } from '@/components/ui/tooltip'
import { blockEffect, statusTone, statusWord, tooltipDeduction } from '@/lib/lesson-mark-text'
import { formatFullDate, formatRange, secondRange } from '@/lib/schedule-format'

import type { ScheduleBlock } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

import { LessonBlock, type BlockLayout } from './lesson-block'

const OPEN_DELAY = 200
const SKIP_DELAY = 300

const clock = { closedAt: 0 }

interface EventTooltipProps {
	block: ScheduleBlock
	layout: BlockLayout
	secondZone: string | null
	currentYear: number
	now: Date
	onOpen: (block: ScheduleBlock) => void
}

export function EventTooltip({ block, layout, secondZone, currentYear, now, onOpen }: EventTooltipProps) {
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
	const word = statusWord(block, now)
	const deduction = tooltipDeduction(blockEffect(block, now), block.ledger.lessonMinutes)

	return (
		<Tooltip
			side="right"
			sideOffset={8}
			forceOpen={open}
			className="max-w-[280px] rounded-xl bg-surface-4 p-3 text-foreground shadow-surface-3 [text-box:normal] supports-[text-box:trim-both]:py-3"
			content={
				<div data-slot="event-tooltip" className="flex flex-col gap-1">
					<span className="text-body font-semibold">{block.studentName}</span>
					<span className="text-body text-muted-foreground">
						{formatFullDate(start, SCHEDULE_TIME_ZONE, currentYear)}
					</span>
					<TimePair
						as="span"
						main={`${formatRange(start, block.durationMinutes, SCHEDULE_TIME_ZONE)} VN`}
						second={second}
						mainClassName="text-body tabular-nums"
					/>
					<span className="inline-flex items-center gap-2 text-body">
						<StatusDot tone={statusTone(block, now)} label={word} passive />
						<span>{word}</span>
					</span>
					{deduction === null ? null : (
						<span data-slot="event-tooltip-deduction" className="text-caption text-muted-foreground">
							{deduction}
						</span>
					)}
				</div>
			}
		>
			<LessonBlock
				block={block}
				layout={layout}
				secondZone={secondZone}
				currentYear={currentYear}
				now={now}
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
