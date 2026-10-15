'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { MapPin } from 'lucide-react'

import { Tooltip } from '@/components/ui/tooltip'

import { placeView, type CalendarEventView } from '@dv-lab/contracts'

import { CalendarEventDetails, EventTime, eventTitle } from './calendar-event-details'
import type { BlockLayout } from './calendar-layout'
import { LessonBlock } from './lesson-block'
import { SYNCING_LINE, type BlockMark } from './optimistic-writes'

const OPEN_DELAY = 200
const SKIP_DELAY = 300

const clock = { closedAt: 0 }
const READ_ONLY_EVENT_LINE = 'Read-only. Change it in Google Calendar.'

function PlainEventCard({
	event,
	timeZone,
	secondZone,
	currentYear,
	suggested,
}: {
	event: CalendarEventView
	timeZone: string
	secondZone: string | null
	currentYear: number
	suggested: string | null
}) {
	const place = placeView(event.location)
	return (
		<div data-slot="event-tooltip" data-variant="plain" className="flex flex-col gap-1">
			<span className="text-body font-semibold wrap-anywhere">{eventTitle(event)}</span>
			<div className="flex min-w-0 flex-col gap-1 text-body wrap-anywhere">
				<EventTime event={event} timeZone={timeZone} secondZone={secondZone} currentYear={currentYear} />
			</div>
			{place === null ? null : place.kind === 'address' ? (
				<span data-slot="event-place-label" className="text-caption wrap-anywhere text-muted-foreground">
					{place.label}
				</span>
			) : (
				<span className="flex min-w-0 items-start gap-1 text-caption wrap-anywhere text-muted-foreground">
					<MapPin size={16} className="shrink-0" aria-hidden />
					<span className="min-w-0">{place.text}</span>
				</span>
			)}
			{suggested !== null ? (
				<span className="text-caption text-muted-foreground">May be {suggested}&apos;s lesson. Click to assign.</span>
			) : null}
			{event.status === 'tentative' ? <span className="text-caption text-muted-foreground">Tentative</span> : null}
			{event.editBlock === 'read_only_event' ? (
				<span className="text-caption text-muted-foreground">{READ_ONLY_EVENT_LINE}</span>
			) : null}
		</div>
	)
}

interface EventTooltipProps {
	event: CalendarEventView
	layout: BlockLayout | null
	secondZone: string | null
	currentYear: number
	mainTimeZone: string
	editable: boolean
	movable?: boolean
	ghost?: boolean
	mark?: BlockMark | null
	phone?: boolean
	needsMark?: boolean
	studentName?: (id: string) => string | null
	onOpen: (event: CalendarEventView) => void
}

export function EventTooltip({
	event,
	layout,
	secondZone,
	currentYear,
	mainTimeZone,
	editable,
	movable,
	ghost,
	mark = null,
	phone = false,
	needsMark = false,
	studentName,
	onOpen,
}: EventTooltipProps) {
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
			forceOpen={open && !ghost}
			className="max-w-[280px] rounded-xl bg-surface-4 p-3 text-foreground shadow-surface-3 [text-box:normal] supports-[text-box:trim-both]:py-3"
			content={
				mark === 'syncing' ? (
					<div data-slot="event-tooltip" data-variant="syncing" className="flex flex-col gap-1">
						<span className="text-body font-semibold wrap-anywhere">{eventTitle(event)}</span>
						<div className="flex min-w-0 flex-col gap-1 text-body wrap-anywhere">
							<EventTime event={event} timeZone={mainTimeZone} secondZone={secondZone} currentYear={currentYear} />
						</div>
						<span className="text-caption text-muted-foreground">{SYNCING_LINE}</span>
					</div>
				) : event.binding.kind === 'external' ? (
					<PlainEventCard
						event={event}
						timeZone={mainTimeZone}
						secondZone={secondZone}
						currentYear={currentYear}
						suggested={event.suggestion === null ? null : (studentName?.(event.suggestion.studentId) ?? null)}
					/>
				) : (
					<div data-slot="event-tooltip" className="flex flex-col gap-1">
						<span className="text-body font-semibold wrap-anywhere">{eventTitle(event)}</span>
						<CalendarEventDetails
							editable={editable}
							event={event}
							timeZone={mainTimeZone}
							secondZone={secondZone}
							currentYear={currentYear}
						/>
					</div>
				)
			}
		>
			<LessonBlock
				editable={editable}
				movable={movable}
				ghost={ghost}
				mark={mark}
				phone={phone}
				needsMark={needsMark}
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
