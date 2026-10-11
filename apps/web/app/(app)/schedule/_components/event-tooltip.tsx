'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { Tooltip } from '@/components/ui/tooltip'

import type { CalendarEventView } from '@dv-lab/contracts'

import { CalendarEventDetails, eventTitle } from './calendar-event-details'
import type { BlockLayout } from './calendar-layout'
import { LessonBlock } from './lesson-block'

const OPEN_DELAY = 200
const SKIP_DELAY = 300

const clock = { closedAt: 0 }

interface EventTooltipProps {
	event: CalendarEventView
	layout: BlockLayout | null
	secondZone: string | null
	currentYear: number
	mainTimeZone: string
	onOpen: (event: CalendarEventView) => void
}

export function EventTooltip({ event, layout, secondZone, currentYear, mainTimeZone, onOpen }: EventTooltipProps) {
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

	return (
		<Tooltip
			side="right"
			sideOffset={8}
			forceOpen={open}
			className="max-w-[280px] rounded-xl bg-surface-4 p-3 text-foreground shadow-surface-3 [text-box:normal] supports-[text-box:trim-both]:py-3"
			content={
				<div data-slot="event-tooltip" className="flex flex-col gap-1">
					<span className="text-body font-semibold wrap-anywhere">{eventTitle(event)}</span>
					<CalendarEventDetails
						event={event}
						timeZone={mainTimeZone}
						secondZone={secondZone}
						currentYear={currentYear}
					/>
				</div>
			}
		>
			<LessonBlock
				event={event}
				mainTimeZone={mainTimeZone}
				layout={layout}
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
