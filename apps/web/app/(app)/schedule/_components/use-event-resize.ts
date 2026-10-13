import { useCallback, useEffect, useRef, useState, type PointerEvent, type MouseEvent, type RefObject } from 'react'

import type { CalendarEventView } from '@dv-lab/contracts'
import { lessonDay, lessonDayMinutes, lessonDaySlot } from '@dv-lab/core'

import { DRAG_THRESHOLD, RESIZE_STRIP_SELECTOR, useEdgeScroll, type MoveSeed } from './use-lesson-drag'
import { SLOT_MINUTES } from './use-slot-drag'
import type { SlotFrame } from './week-grid'

const DAY_MINUTES = 1440

type Press = {
	pointerId: number
	button: HTMLElement
	column: HTMLElement
	event: CalendarEventView
	date: string
	x: number
	y: number
	lastX: number
	lastY: number
	startMinutes: number
	durationMinutes: number
	footOffset: number
	started: boolean
}
export type EventResize = { eventKey: string; frame: SlotFrame }

export function useEventResize(
	bodyRef: RefObject<HTMLDivElement | null>,
	hourHeight: number,
	events: readonly CalendarEventView[],
	mainTimeZone: string,
	enabled: boolean,
	canMove: (event: CalendarEventView) => boolean,
	onResize: (event: CalendarEventView, seed: MoveSeed) => void
) {
	const press = useRef<Press | null>(null)
	const suppressClick = useRef(false)
	const [resize, setResize] = useState<EventResize | null>(null)
	const fingerprint = JSON.stringify(events)
	const minuteHeight = hourHeight / 60
	const cancel = useCallback(() => {
		const previous = press.current
		press.current = null
		if (previous?.started) suppressClick.current = true
		if (previous?.button.hasPointerCapture(previous.pointerId))
			previous.button.releasePointerCapture(previous.pointerId)
		setResize(null)
	}, [])
	useEffect(() => cancel, [enabled, fingerprint, mainTimeZone, cancel])
	useEffect(() => {
		const escape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || !press.current) return
			event.preventDefault()
			cancel()
		}
		document.addEventListener('keydown', escape)
		window.addEventListener('blur', cancel)
		return () => {
			document.removeEventListener('keydown', escape)
			window.removeEventListener('blur', cancel)
		}
	}, [cancel])

	function frameAt(y: number, current: Press): SlotFrame {
		const top = current.column.getBoundingClientRect().top
		const raw = (y - top - current.footOffset) / minuteHeight
		const snapped = Math.round(raw / SLOT_MINUTES) * SLOT_MINUTES
		const end = Math.min(Math.max(snapped, current.startMinutes + SLOT_MINUTES), DAY_MINUTES)
		return { ...lessonDaySlot(current.date, current.startMinutes), durationMinutes: end - current.startMinutes }
	}

	const frameRef = useRef(frameAt)
	useEffect(() => {
		frameRef.current = frameAt
	})
	useEdgeScroll(
		bodyRef,
		resize !== null,
		() => (press.current?.started ? { x: press.current.lastX, y: press.current.lastY } : null),
		(_x, y) => {
			const current = press.current
			if (!current) return
			setResize({ eventKey: current.event.eventKey, frame: frameRef.current(y, current) })
		}
	)

	function down(event: PointerEvent<HTMLDivElement>) {
		suppressClick.current = false
		if (!enabled || event.button !== 0 || event.pointerType === 'touch' || !event.isPrimary) return
		if (!(event.target instanceof Element) || !event.target.closest(RESIZE_STRIP_SELECTOR)) return
		const button = event.target.closest<HTMLElement>('[data-event-key]')
		const source = events.find((item) => item.eventKey === button?.dataset.eventKey)
		if (!button || !source || source.when.kind !== 'timed' || !canMove(source)) return
		const column = button.closest<HTMLElement>('[data-slot="week-grid-column"]')
		const start = new Date(source.when.startsAt)
		const date = lessonDay(start, mainTimeZone)
		if (!column || column.dataset.date !== date) return
		const startMinutes = lessonDayMinutes(start, mainTimeZone)
		const durationMinutes = (Date.parse(source.when.endsAt) - start.getTime()) / 60000
		if (startMinutes + durationMinutes > DAY_MINUTES) return
		press.current = {
			pointerId: event.pointerId,
			button,
			column,
			event: source,
			date,
			x: event.clientX,
			y: event.clientY,
			lastX: event.clientX,
			lastY: event.clientY,
			startMinutes,
			durationMinutes,
			footOffset: event.clientY - column.getBoundingClientRect().top - (startMinutes + durationMinutes) * minuteHeight,
			started: false,
		}
		button.setPointerCapture(event.pointerId)
	}

	function move(event: PointerEvent<HTMLDivElement>) {
		const current = press.current
		if (!current || current.pointerId !== event.pointerId) return
		if (!enabled || !canMove(current.event)) return cancel()
		current.lastX = event.clientX
		current.lastY = event.clientY
		if (!current.started && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_THRESHOLD) return
		current.started = true
		event.preventDefault()
		event.stopPropagation()
		setResize({ eventKey: current.event.eventKey, frame: frameAt(event.clientY, current) })
	}

	function up(event: PointerEvent<HTMLDivElement>) {
		const current = press.current
		if (!current || current.pointerId !== event.pointerId) return
		const seed = frameAt(event.clientY, current)
		const resized = current.started
		cancel()
		if (!resized) return
		event.preventDefault()
		event.stopPropagation()
		const bounds = bodyRef.current?.getBoundingClientRect()
		if (
			!bounds ||
			event.clientY < bounds.top ||
			event.clientY >= bounds.bottom ||
			event.clientX < bounds.left ||
			event.clientX >= bounds.right
		)
			return
		const source = events.find((item) => item.eventKey === current.event.eventKey)
		if (!enabled || !source || !canMove(source) || JSON.stringify(source) !== JSON.stringify(current.event)) return
		if (seed.durationMinutes === current.durationMinutes) return
		onResize(source, { ...seed, gesture: 'resize' })
	}

	function click(event: MouseEvent<HTMLDivElement>) {
		if (!suppressClick.current) return
		suppressClick.current = false
		event.preventDefault()
		event.stopPropagation()
	}

	return {
		resize: enabled ? resize : null,
		handlers: {
			onPointerDownCapture: down,
			onPointerMoveCapture: move,
			onPointerUpCapture: up,
			onPointerCancelCapture: cancel,
			onLostPointerCapture: cancel,
			onClickCapture: click,
		},
	}
}
