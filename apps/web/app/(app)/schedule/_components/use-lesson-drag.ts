import { useCallback, useEffect, useRef, useState, type PointerEvent, type MouseEvent, type RefObject } from 'react'

import type { CalendarEventView } from '@dv-lab/contracts'
import { scheduleDate, zonedInstant } from '@dv-lab/core'

import { clock, SLOT_MINUTES } from './use-slot-drag'
import type { SlotFrame } from './week-grid'

export type MoveSeed = Pick<SlotFrame, 'date' | 'time'>
type Press = {
	pointerId: number
	button: HTMLElement
	event: CalendarEventView
	x: number
	y: number
	offset: number
	started: boolean
}

export function useLessonDrag(
	bodyRef: RefObject<HTMLDivElement | null>,
	hourHeight: number,
	events: readonly CalendarEventView[],
	mainTimeZone: string,
	enabled: boolean,
	canMove: (event: CalendarEventView) => boolean,
	onMove: (event: CalendarEventView, seed: MoveSeed) => void
) {
	const press = useRef<Press | null>(null)
	const suppressClick = useRef(false)
	const [frame, setFrame] = useState<SlotFrame | null>(null)
	const fingerprint = JSON.stringify(events)
	const cancel = useCallback(() => {
		const previous = press.current
		press.current = null
		if (previous?.started) suppressClick.current = true
		if (previous?.button.hasPointerCapture(previous.pointerId))
			previous.button.releasePointerCapture(previous.pointerId)
		setFrame(null)
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

	function down(event: PointerEvent<HTMLDivElement>) {
		suppressClick.current = false
		if (!enabled || event.button !== 0 || event.pointerType !== 'mouse' || !event.isPrimary) return
		const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-event-key]') : null
		const source = events.find((item) => item.eventKey === button?.dataset.eventKey)
		if (!button || !source || source.when.kind !== 'timed' || !canMove(source)) return
		const column = button.closest<HTMLElement>('[data-slot="week-grid-column"]')
		if (column?.dataset.date !== scheduleDate(new Date(source.when.startsAt), mainTimeZone)) return
		press.current = {
			pointerId: event.pointerId,
			button,
			event: source,
			x: event.clientX,
			y: event.clientY,
			offset: event.clientY - button.getBoundingClientRect().top,
			started: false,
		}
		button.setPointerCapture(event.pointerId)
	}

	function destination(event: PointerEvent<HTMLDivElement>, current: Press): SlotFrame | null {
		if (current.event.when.kind !== 'timed') return null
		const body = bodyRef.current
		if (!body) return null
		const viewport = body.getBoundingClientRect()
		if (event.clientY < viewport.top || event.clientY >= viewport.bottom) return null
		const column = Array.from(body.querySelectorAll<HTMLElement>('[data-slot="week-grid-column"]')).find((item) => {
			const rect = item.getBoundingClientRect()
			return event.clientX >= rect.left && event.clientX < rect.right
		})
		const date = column?.dataset.date
		if (!column || !date) return null
		const minutes =
			Math.round(
				(event.clientY - column.getBoundingClientRect().top - current.offset) / (hourHeight / 60) / SLOT_MINUTES
			) * SLOT_MINUTES
		const durationMinutes = (Date.parse(current.event.when.endsAt) - Date.parse(current.event.when.startsAt)) / 60000
		if (minutes < 0 || minutes + durationMinutes > 1440) return null
		const time = clock(minutes)
		try {
			if (zonedInstant(date, time, mainTimeZone).getTime() <= Date.now()) return null
		} catch {
			return null
		}
		return { date, time, durationMinutes }
	}

	function move(event: PointerEvent<HTMLDivElement>) {
		const current = press.current
		if (!current || current.pointerId !== event.pointerId) return
		if (!enabled || !canMove(current.event)) return cancel()
		if (!current.started && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4) return
		current.started = true
		event.preventDefault()
		event.stopPropagation()
		const next = destination(event, current)
		setFrame(next)
	}

	function up(event: PointerEvent<HTMLDivElement>) {
		const current = press.current
		if (!current || current.pointerId !== event.pointerId) return
		const seed = destination(event, current)
		const dragged = current.started
		cancel()
		if (!dragged) return
		event.preventDefault()
		event.stopPropagation()
		if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4) return
		const source = events.find((item) => item.eventKey === current.event.eventKey)
		if (!enabled || !source || !canMove(source) || JSON.stringify(source) !== JSON.stringify(current.event)) return
		if (!seed || source.when.kind !== 'timed') return
		if (zonedInstant(seed.date, seed.time, mainTimeZone).toISOString() === new Date(source.when.startsAt).toISOString())
			return
		onMove(source, seed)
	}

	function click(event: MouseEvent<HTMLDivElement>) {
		if (!suppressClick.current) return
		suppressClick.current = false
		event.preventDefault()
		event.stopPropagation()
	}
	return {
		frame: enabled ? frame : null,
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
